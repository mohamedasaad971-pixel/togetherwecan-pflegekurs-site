const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const app = fs.readFileSync("app.js", "utf8");

test("lesson anchors bypass the page router", () => {
  const start = app.indexOf("function leiten()");
  const end = app.indexOf("spracheBinden();", start);

  assert.notEqual(start, -1, "router function should exist");
  assert.notEqual(end, -1, "router function should have a boundary");

  const router = app.slice(start, end);
  assert.match(
    router,
    /if\s*\(pfad\s*===\s*["']quiz["']\s*\|\|\s*pfad\.indexOf\(["']a-["']\)\s*===\s*0\)\s*return;/,
    "quiz and section anchors should not be treated as page routes"
  );
  assert.ok(
    router.indexOf('pfad === "quiz"') < router.indexOf("navMarkieren();"),
    "anchor guard should run before routing redraws the page"
  );
});
