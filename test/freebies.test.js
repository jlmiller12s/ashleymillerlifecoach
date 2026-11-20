const test = require("node:test");
const assert = require("node:assert/strict");
const service = require("../lib/freebies");
const { makeHandler } = require("../api/freebies");
const env = {
  ROOTED_RESEND_API_KEY: "fake",
  FREEBIE_MOMENTUM_SEGMENT_ID: "map",
  FREEBIE_RELEASE_SEGMENT_ID: "matrix",
  FREEBIE_SITE_URL: "https://example.com",
  CRON_SECRET: "secret",
};
function fixture(options = {}) {
  const queries = [],
    calls = [];
  const row = {
    token_hash: "a".repeat(64),
    unsubscribe_token: "b".repeat(64),
    email: "reader@example.com",
    first_name: "<Jane>",
    resource: options.resource || "momentum-map",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    ...options.row,
  };
  const db = {
    async query(sql, args) {
      queries.push([sql, args]);
      if (sql.includes("RETURNING count")) return { rows: [{ count: 1 }] };
      if (sql.includes("SELECT * FROM ashley_freebies")) return { rows: [row] };
      if (sql.includes("SELECT s.*,d.step"))
        return {
          rows:
            queries.filter(([s]) => s.includes("SELECT s.*,d.step")).length ===
            1
              ? [{ ...row, step: 1 }]
              : [],
        };
      return { rows: [] };
    },
    release() {},
    async connect() {
      return this;
    },
  };
  const fetch = async (url, init) => {
    calls.push([url, init]);
    if (options.fail && url.endsWith("/emails"))
      return { ok: false, status: 500 };
    if (init.method === "GET")
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "contact",
          unsubscribed: !!options.unsubscribed,
        }),
      };
    return { ok: true, status: 200, json: async () => ({ id: "sent" }) };
  };
  return { row, queries, calls, db, fetch };
}
test("invalid consent/resource and honeypot never send emails", async () => {
  const f = fixture();
  for (const body of [
    { resource: "unknown" },
    {
      resource: "momentum-map",
      firstName: "Jane",
      email: "reader@example.com",
      consent: false,
    },
  ])
    await assert.rejects(service.subscribe(body, "ip", env, f));
  await service.subscribe({ website: "spam" }, "ip", env, f);
  assert.equal(f.calls.length, 0);
});
test("signup sends confirmation only and stores a hashed expiring token", async () => {
  const f = fixture();
  await service.subscribe(
    {
      resource: "release-reclaim",
      firstName: "Jane",
      email: "reader@example.com",
      consent: true,
    },
    "ip",
    env,
    f,
  );
  assert.equal(f.calls.length, 1);
  const message = JSON.parse(f.calls[0][1].body);
  assert.match(message.text, /freebie-confirm#[a-f0-9]{64}/);
  assert.doesNotMatch(message.text, /downloads/);
  const insert = f.queries.find(([q]) =>
    q.startsWith("INSERT INTO ashley_freebies.signups"),
  );
  assert.equal(insert[1][3], "release-reclaim");
  assert.ok(!message.text.includes(insert[1][0]));
});
for (const resource of ["momentum-map", "release-reclaim"])
  test(
    resource +
      " confirmation targets its segment and PDF, and queues three follow-ups",
    async () => {
      const f = fixture({ resource });
      await service.confirm("c".repeat(64), env, f);
      const segment = resource === "momentum-map" ? "map" : "matrix";
      assert.ok(f.calls.some(([url]) => url.endsWith("/segments/" + segment)));
      const message = JSON.parse(
        f.calls.find(([url]) => url.endsWith("/emails"))[1].body,
      );
      assert.ok(message.text.includes(service.offers[resource].file));
      assert.match(message.html, /&lt;Jane&gt;/);
      assert.equal(
        f.queries.filter(([q]) =>
          q.startsWith("INSERT INTO ashley_freebies.deliveries"),
        ).length,
        3,
      );
      assert.ok(f.queries.some(([q]) => q === "COMMIT"));
    },
  );
test("confirmed and expired tokens cannot send again", async () => {
  const confirmed = fixture({ row: { confirmed_at: new Date() } });
  await service.confirm("c".repeat(64), env, confirmed);
  assert.equal(confirmed.calls.length, 0);
  const expired = fixture({ row: { expires_at: "2000-01-01" } });
  await assert.rejects(service.confirm("c".repeat(64), env, expired));
  assert.equal(expired.calls.length, 0);
});
test("global unsubscribe prevents enrollment and welcome delivery", async () => {
  const f = fixture({ unsubscribed: true });
  await assert.rejects(service.confirm("c".repeat(64), env, f), {
    status: 409,
  });
  assert.equal(f.calls.length, 1);
});
test("provider failure rolls back and preserves retryability", async () => {
  const f = fixture({ fail: true });
  await assert.rejects(service.confirm("c".repeat(64), env, f));
  assert.ok(f.queries.some(([q]) => q === "ROLLBACK"));
  assert.ok(
    !f.queries.some(([q]) => q.startsWith("UPDATE ashley_freebies.signups")),
  );
});
test("follow-ups skip locally or globally unsubscribed contacts", async () => {
  for (const options of [
    { row: { unsubscribed_at: new Date() } },
    { unsubscribed: true },
  ]) {
    const f = fixture(options);
    assert.equal(await service.followups(env, f), 0);
    assert.ok(!f.calls.some(([url]) => url.endsWith("/emails")));
  }
});
test("follow-ups send once with a stable idempotency key", async () => {
  const f = fixture();
  assert.equal(await service.followups(env, f), 1);
  const email = f.calls.find(([url]) => url.endsWith("/emails"));
  assert.match(email[1].headers["Idempotency-Key"], /^freebie-followup-/);
  assert.ok(
    f.queries.some(([q]) => q.startsWith("UPDATE ashley_freebies.deliveries")),
  );
});
test("unsubscribe stops both sequences by email", async () => {
  const f = fixture();
  await service.unsubscribe("b".repeat(64), env, f);
  assert.match(f.queries[0][0], /WHERE email IN/);
});
test("endpoint enforces origin and cron authorization", async () => {
  const handler = makeHandler({
    env,
    subscribe: async () => {},
    followups: async () => {},
  });
  for (const [method, headers, status] of [
    ["POST", { origin: "https://evil.example" }, 403],
    ["GET", {}, 401],
    ["GET", { authorization: "Bearer secret" }, 200],
    ["POST", { origin: "https://example.com" }, 200],
  ]) {
    const res = { setHeader() {}, end() {} };
    await handler({ method, headers, body: { resource: "momentum-map" } }, res);
    assert.equal(res.statusCode, status);
  }
});
