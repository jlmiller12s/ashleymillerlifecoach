const { randomBytes, createHash } = require("node:crypto");
const { resend } = require("./rootedLetter");
const { createPostgresPoolOptions } = require("./crmRuntimeStore");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const offers = {
  "momentum-map": {
    title: "The 48-Hour Momentum Map",
    file: "momentum-map.pdf",
    segment: "FREEBIE_MOMENTUM_SEGMENT_ID",
  },
  "release-reclaim": {
    title: "The Release & Reclaim Matrix",
    file: "release-reclaim-matrix.pdf",
    segment: "FREEBIE_RELEASE_SEGMENT_ID",
  },
};
function settings(env) {
  const key = env.FREEBIE_RESEND_API_KEY || env.ROOTED_RESEND_API_KEY;
  if (
    !key ||
    !env.FREEBIE_MOMENTUM_SEGMENT_ID ||
    !env.FREEBIE_RELEASE_SEGMENT_ID
  )
    throw Error("Missing setup");
  const origin = new URL(
    env.FREEBIE_SITE_URL || "https://www.ashleymillerlifecoach.com",
  ).origin;
  if (
    !origin.startsWith("https://") &&
    !(env.NODE_ENV !== "production" && origin.startsWith("http://localhost:"))
  )
    throw Error("Invalid origin");
  return {
    origin,
    from:
      env.FREEBIE_EMAIL_FROM ||
      "Ashley Miller <ashley@rootedwomencollective.com>",
    providerEnv: { ROOTED_RESEND_API_KEY: key },
  };
}
const invalid = (message) => Object.assign(Error(message), { status: 400 });
let ready, pool;
async function storage(deps, env = process.env) {
  if (deps.db) return deps.db;
  if (!pool) {
    const connection = env.FREEBIE_POSTGRES_URL || env.POSTGRES_URL;
    if (!connection) throw Error("Freebie storage unavailable");
    pool = new (require("pg").Pool)({ ...createPostgresPoolOptions(connection), max:3, connectionTimeoutMillis:10000 });
  }
  const db = pool;
  if (!ready)
    ready = db
      .query(
        `CREATE SCHEMA IF NOT EXISTS ashley_freebies;
 REVOKE ALL ON SCHEMA ashley_freebies FROM PUBLIC;
 CREATE TABLE IF NOT EXISTS ashley_freebies.signups (
 token_hash text PRIMARY KEY,email text NOT NULL,first_name text NOT NULL,resource text NOT NULL,unsubscribe_token text NOT NULL,
 consent_version text NOT NULL DEFAULT 'freebies-v1',created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',confirmed_at timestamptz,unsubscribed_at timestamptz);
 CREATE TABLE IF NOT EXISTS ashley_freebies.deliveries (
 token_hash text REFERENCES ashley_freebies.signups(token_hash),step integer NOT NULL,due_at timestamptz NOT NULL,sent_at timestamptz,PRIMARY KEY(token_hash,step));
 CREATE TABLE IF NOT EXISTS ashley_freebies.limits (key text PRIMARY KEY,count integer NOT NULL,expires_at timestamptz NOT NULL);
 REVOKE ALL ON ALL TABLES IN SCHEMA ashley_freebies FROM PUBLIC;`,
      )
      .catch((e) => {
        ready = undefined;
        throw e;
      });
  await ready;
  return db;
}
async function rateLimit(db, key, maximum, hours=1) {
  const result=await db.query(`INSERT INTO ashley_freebies.limits (key,count,expires_at) VALUES ($1,1,now()+($2*interval '1 hour'))
  ON CONFLICT (key) DO UPDATE SET count=CASE WHEN ashley_freebies.limits.expires_at<now() THEN 1 ELSE ashley_freebies.limits.count+1 END,
  expires_at=CASE WHEN ashley_freebies.limits.expires_at<now() THEN now()+($2*interval '1 hour') ELSE ashley_freebies.limits.expires_at END RETURNING count`,[hash(key),hours]);
  if(result.rows[0].count>maximum)throw Object.assign(Error('Please wait before trying again.'),{status:429});
}
function provider(env, deps) {
  const config = settings(env);
  let last = 0;
  return async (route, method, body, key) => {
    if (!deps.fetch) {
      const wait = 600 - (Date.now() - last);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    }
    last = Date.now();
    return resend(config.providerEnv, route, method, body, deps.fetch, key);
  };
}
async function subscribe(body, ip, env = process.env, deps = {}) {
  const config = settings(env);
  if (body.website) return;
  if (!Object.hasOwn(offers, body.resource))
    throw invalid("Choose one of the two worksheets.");
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.firstName === "string" ? body.firstName.trim() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !name ||
    name.length > 80 ||
    /[\r\n]/.test(name) ||
    body.consent !== true
  )
    throw invalid("Enter your name, a valid email, and check the consent box.");
  const db = await storage(deps, env);
  await rateLimit(db, "freebie-ip:" + ip, 10);
  await rateLimit(db, "freebie-email:" + email, 3);
  await rateLimit(
    db,
    "freebie-daily:" + new Date().toISOString().slice(0, 10),
    80,
    24,
  );
  const token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO ashley_freebies.signups (token_hash,email,first_name,resource,unsubscribe_token) VALUES ($1,$2,$3,$4,$5)",
    [hash(token), email, name, body.resource, randomBytes(32).toString("hex")],
  );
  await provider(env, deps)(
    "/emails",
    "POST",
    {
      from: config.from,
      to: [email],
      subject: `Confirm your request: ${offers[body.resource].title}`,
      text: `Hi ${name},\n\nConfirm your email to receive ${offers[body.resource].title} and a few follow-up notes from Ashley:\n\n${config.origin}/freebie-confirm#${token}\n\nThis link expires in 24 hours. If you didn't request this, ignore this email. You won't be subscribed.\n\nAshley Miller\n1200 Lake Saint Louis Blvd, Unit #525, Lake Saint Louis, MO 63367`,
    },
    "freebie-confirm-" + hash(token),
  );
}
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function emailContent(row, step, env) {
  const config = settings(env),
    offer = offers[row.resource];
  const messages =
    row.resource === "momentum-map"
      ? [
          [
            "Your next 48 hours start here",
            "Your next chapter doesn’t need a permission slip. It needs a first step. Set aside 15 minutes, open your map, and choose one move that fits your real life. Small counts.",
          ],
          [
            "Did you make your 15-minute move?",
            "You don’t need a perfect afternoon. What’s one thing you can do with the next 15 minutes? Open your map, pick your move, and give it a place on today’s calendar. If you already started, pause long enough to notice that. You moved.",
          ],
          [
            "Someday is sneaky",
            "After the busy week. After everyone else is settled. Another week can pass while your own next step waits. Today, try a smaller question: what is possible with the time I actually have? Let that be enough to begin.",
          ],
          [
            "You don’t have to keep going alone",
            "If your map helped you find a first step, Homeroom is a place to keep showing up with coaching and community. Want to talk through your next chapter one-on-one first? Book a free Clarity Call. Bring your real life.",
          ],
        ]
      : [
          [
            "You get to put some things down",
            "Your Release & Reclaim Matrix is here. You don’t have to solve your whole life today. Give yourself a quiet few minutes to notice what you’re carrying and what you want to make room for. Start honestly. Start small.",
          ],
          [
            "What are you ready to release?",
            "Take another look at your matrix. Which thing keeps asking for more energy than you have to give? Name one small boundary or conversation that could help. You’re allowed to practice before it feels natural.",
          ],
          [
            "A yes needs room",
            "It’s hard to hear your own next step when every spare minute already belongs to something else. What would you like to reclaim: rest, creativity, a little courage? Choose one small way to give it room this week.",
          ],
          [
            "Let’s name your next step",
            "Releasing what’s been holding you back is part of our work in 1:1 coaching. If your matrix brought up more questions, bring them to a free Clarity Call. Prefer coaching with community? Come explore Homeroom.",
          ],
        ];
  const [subject, copy] = messages[step];
  const unsubscribe = `${config.origin}/freebie-unsubscribe#${row.unsubscribe_token}`;
  const links =
    step < 2
      ? [[`Open ${offer.title}`, `${config.origin}/downloads/${offer.file}`]]
      : [
          ["Explore Homeroom", `${config.origin}/homeroom`],
          ["Book a free Clarity Call", `${config.origin}/book`],
        ];
  const footer =
    "Ashley Miller · 1200 Lake Saint Louis Blvd, Unit #525, Lake Saint Louis, MO 63367";
  return {
    from: config.from,
    to: [row.email],
    subject,
    text: `Hi ${row.first_name},\n\n${copy}\n\n${links.map(([label, url]) => label + ": " + url).join("\n")}\n\nAshley\n${footer}\nUnsubscribe from freebie follow-ups: ${unsubscribe}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;max-width:600px;margin:auto"><p>Hi ${escape(row.first_name)},</p><p>${escape(copy)}</p>${links.map(([label, url]) => `<p><a style="display:inline-block;background:#a61667;color:white;padding:12px 20px;border-radius:8px" href="${url}">${escape(label)}</a></p>`).join("")}<p>♡ Ashley</p><hr><p style="font-size:12px">${footer}<br><a href="${unsubscribe}">Unsubscribe from freebie follow-ups</a></p></div>`,
  };
}
async function confirm(token, env = process.env, deps = {}) {
  settings(env);
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw invalid("Invalid link. Please request your worksheet again.");
  const db = await storage(deps, env),
    client = await db.connect(),
    api = provider(env, deps);
  try {
    await client.query("BEGIN");
    const row = (
      await client.query(
        "SELECT * FROM ashley_freebies.signups WHERE token_hash=$1 FOR UPDATE",
        [hash(token)],
      )
    ).rows[0];
    if (!row)
      throw invalid(
        "This link has expired. Please request your worksheet again.",
      );
    if (row.confirmed_at) {
      await client.query("COMMIT");
      return;
    }
    if (new Date(row.expires_at).getTime() < Date.now())
      throw invalid(
        "This link has expired. Please request your worksheet again.",
      );
    // Serialize confirmations across separate requests for this address.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      row.email,
    ]);
    const route = "/contacts/" + encodeURIComponent(row.email),
      existing = await api(route, "GET");
    const optedOut = (
      await client.query(
        "SELECT token_hash FROM ashley_freebies.signups WHERE email=$1 AND unsubscribed_at IS NOT NULL LIMIT 1",
        [row.email],
      )
    ).rows[0];
    if (existing?.unsubscribed || optedOut)
      throw Object.assign(
        Error(
          "This address has unsubscribed. Please contact Ashley for help rejoining.",
        ),
        { status: 409 },
      );
    const segment = env[offers[row.resource].segment];
    if (!existing)
      await api("/contacts", "POST", {
        email: row.email,
        first_name: row.first_name,
        unsubscribed: false,
        segments: [{ id: segment }],
      });
    else
      await api(route + "/segments/" + encodeURIComponent(segment), "POST", {});
    await api(
      "/emails",
      "POST",
      emailContent(row, 0, env),
      "freebie-welcome-" + row.token_hash,
    );
    await client.query(
      "UPDATE ashley_freebies.signups SET confirmed_at=now() WHERE token_hash=$1",
      [row.token_hash],
    );
    const prior = (
      await client.query(
        "SELECT token_hash FROM ashley_freebies.signups WHERE email=$1 AND resource=$2 AND confirmed_at IS NOT NULL AND token_hash<>$3 LIMIT 1",
        [row.email, row.resource, row.token_hash],
      )
    ).rows[0];
    if (!prior)
      for (const [step, day] of [
        [1, 2],
        [2, 4],
        [3, 7],
      ])
        await client.query(
          "INSERT INTO ashley_freebies.deliveries (token_hash,step,due_at) VALUES ($1,$2,now()+($3*interval '1 day')) ON CONFLICT DO NOTHING",
          [row.token_hash, step, day],
        );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
async function unsubscribe(token, env = process.env, deps = {}) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw invalid("Invalid unsubscribe link.");
  const db = await storage(deps, env);
  await db.query(
    "UPDATE ashley_freebies.signups SET unsubscribed_at=now() WHERE email IN (SELECT email FROM ashley_freebies.signups WHERE unsubscribe_token=$1)",
    [token],
  );
}
async function followups(env = process.env, deps = {}) {
  const db = await storage(deps, env),
    api = provider(env, deps);
  let sent = 0;
  const deadline = Date.now() + 40000;
  for (let i = 0; i < 100 && Date.now() < deadline; i++) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const row = (
        await client.query(`SELECT s.*,d.step FROM ashley_freebies.deliveries d JOIN ashley_freebies.signups s USING(token_hash)
 WHERE d.sent_at IS NULL AND d.due_at<=now() ORDER BY d.due_at LIMIT 1 FOR UPDATE OF d,s SKIP LOCKED`)
      ).rows[0];
      if (!row) {
        await client.query("COMMIT");
        break;
      }
      const contact = row.unsubscribed_at
        ? null
        : await api("/contacts/" + encodeURIComponent(row.email), "GET");
      if (contact && !contact.unsubscribed && !row.unsubscribed_at) {
        await api(
          "/emails",
          "POST",
          emailContent(row, row.step, env),
          `freebie-followup-${row.token_hash}-${row.step}`,
        );
        sent++;
      }
      await client.query(
        "UPDATE ashley_freebies.deliveries SET sent_at=now() WHERE token_hash=$1 AND step=$2",
        [row.token_hash, row.step],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  return sent;
}
module.exports = {
  subscribe,
  confirm,
  unsubscribe,
  followups,
  settings,
  emailContent,
  offers,
};
