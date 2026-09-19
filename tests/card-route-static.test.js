const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const app = fs.readFileSync("app.js", "utf8");

test("unit card links use the route for the active build mode", () => {
  const start = app.indexOf("function kopfZeile(e, intern)");
  const end = app.indexOf("function zeichne(e, intern)", start);

  assert.notEqual(start, -1, "unit header function should exist");
  assert.notEqual(end, -1, "unit header function should have a boundary");

  const headerBlock = app.slice(start, end);
  assert.match(
    headerBlock,
    /intern\s*\?\s*["']#\/karten-intern\/["']\s*:\s*["']#\/karten\/["']/,
    "internal previews and learner pages should use their matching card routes"
  );
  assert.match(headerBlock, /href=\\?"["']\s*\+\s*kartenPfad\s*\+/);
  assert.doesNotMatch(
    headerBlock,
    /href=["']#\/karten-intern\//,
    "the unit header must not hard-code the internal-only route"
  );
});
