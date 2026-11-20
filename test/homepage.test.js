const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
test("homepage presents Ashley coaching with valid internal destination pages", () => {
  assert.match(home, /Christian life coach/i);
  assert.equal((home.match(/<h1[ >]/g) || []).length, 1);
  for (const route of [
    "about",
    "coaching",
    "homeroom",
    "no-permission-slip",
    "rooted-women",
    "book",
  ]) {
    assert.ok(home.includes('href="/' + route));
    assert.ok(fs.existsSync(path.join(root, route + ".html")));
  }
});
test("freebie public pages collect consent without publishing download URLs or fake success", () => {
  for (const page of [
    "index",
    "about",
    "coaching",
    "homeroom",
    "no-permission-slip",
  ]) {
    const html = fs.readFileSync(path.join(root, page + ".html"), "utf8");
    assert.match(html, /name="consent" required/);
    assert.match(html, /action="\/api\/freebies" method="post"/);
    assert.doesNotMatch(html, /href=["'][^"']*\/downloads\//);
    assert.doesNotMatch(html, /alert\(['"]Thank you/);
  }
});
