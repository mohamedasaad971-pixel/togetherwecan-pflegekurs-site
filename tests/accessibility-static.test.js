const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const app = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("stil.css", "utf8");

function loadTranslations(file, tableName) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context);
  return context.window[tableName];
}

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
  const uiDe = loadTranslations("ui-de.js", "UI_DE");
  const uiEn = loadTranslations("ui-en.js", "UI_EN");
  const labels = [
    ["w-ar", "ظهورها"],
    ["w-tempo", "سرعة الفيديو"],
    ["k-richtung", "وجهُ البطاقة"],
  ];

  for (const [id, arabicText] of labels) {
    assert.match(
      app,
      new RegExp(`<label[^>]+for=["']${id}["'][^>]*>[^<]+<\\/label>[\\s\\S]*?<select id=["']${id}["']`),
      `select #${id} should follow a label that targets it`
    );
    const key = `<label class="klein matt" for="${id}">${arabicText}</label>`;
    assert.match(uiDe[key], new RegExp(`for=["']${id}["']`));
    assert.match(uiEn[key], new RegExp(`for=["']${id}["']`));
  }
});
