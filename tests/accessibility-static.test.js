const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const app = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("stil.css", "utf8");

test("translation reveal is keyboard accessible and stateful", () => {
  assert.match(app, /<button type="button" class="ar-umschalter"/);
  assert.match(app, /aria-controls=/);
  assert.match(app, /class="ar-inhalt"/);
  assert.match(app, /knopf\.setAttribute\("aria-expanded"/);
  assert.match(app, /inhalt\.setAttribute\("aria-hidden"/);
  assert.match(app, /closest\("\.ar-umschalter"\)/);
  assert.doesNotMatch(app, /setAttribute\("role", "button"\)/);
  assert.match(app, /"Hide translation"/);
  assert.match(css, /\.ar-umschalter:focus-visible/);
});

test("delegated translation handlers are bound once", () => {
  const start = app.indexOf("function arSchaltBinden()");
  const end = app.indexOf("/* ————— الصفحة الأولى", start);

  assert.notEqual(start, -1, "translation binding function should exist");
  assert.notEqual(end, -1, "translation binding function should have a boundary");

  const bindingBlock = app.slice(start, end);
  assert.match(bindingBlock, /data-ar-schalt-gebunden/);
  assert.equal(
    (bindingBlock.match(/\.addEventListener\s*\(\s*["']click["']/g) || []).length,
    1,
    "translation binding should register exactly one delegated click listener"
  );
});

test("visible select labels target their controls", () => {
  for (const id of ["w-ar", "w-tempo", "k-richtung"]) {
    assert.match(
      app,
      new RegExp(`<label[^>]+for=["']${id}["'][^>]*>[^<]+<\\/label>[\\s\\S]*?<select id=["']${id}["']`),
      `select #${id} should follow a label that targets it`
    );
  }
});
