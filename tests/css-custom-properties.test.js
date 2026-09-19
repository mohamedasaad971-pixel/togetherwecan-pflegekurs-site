const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const css = fs.readFileSync("stil.css", "utf8");

test("every CSS custom property reference has a declaration", () => {
  const declared = new Set(
    Array.from(css.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g), (match) => match[1])
  );
  const referenced = new Set(
    Array.from(css.matchAll(/var\(\s*--([a-zA-Z0-9_-]+)/g), (match) => match[1])
  );
  const undefinedProperties = Array.from(referenced)
    .filter((property) => !declared.has(property))
    .sort();

  assert.deepEqual(
    undefinedProperties,
    [],
    `undefined CSS custom properties: ${undefinedProperties.join(", ")}`
  );
});
