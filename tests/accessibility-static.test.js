const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const app = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("stil.css", "utf8");

test("translation reveal is keyboard accessible and stateful", () => {
  assert.match(app, /addEventListener\("keydown"/);
  assert.match(app, /ev\.key !== "Enter" && ev\.key !== " "/);
  assert.match(app, /setAttribute\("tabindex", "0"\)/);
  assert.match(app, /setAttribute\("role", "button"\)/);
  assert.match(app, /setAttribute\("aria-expanded"/);
  assert.match(app, /"Hide translation"/);
  assert.match(app, /ev\.preventDefault\(\)/);
  assert.match(css, /\.ar-schalt\[role="button"\]:focus-visible/);
});

test("delegated translation handlers are bound once", () => {
  assert.match(app, /data-ar-schalt-gebunden/);
  assert.equal((app.match(/addEventListener\("click"/g) || []).length, 1);
});
