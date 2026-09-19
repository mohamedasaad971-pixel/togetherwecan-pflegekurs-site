/* يمنع عودةَ أيّ جملةٍ تدّعي اعتماداً سريريّاً/طبّياً عامّاً للمحتوى، بعد أن
   حذف محمد (٢٠٢٦-٠٩-١٣) جملةً من هذا النوع لأنها صارت كاذبة (راجع
   app.js:358-360) واشترط ألّا يحلّ محلّها ادّعاءٌ مشابه. راجع issue #4. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SHIPPED_FILES = [
  "index.html",
  "app.js",
  "ui-de.js",
  "ui-en.js",
  "daten.js",
  "karten.js",
  "diagnose.js",
  "fortschritt.js",
  "pruefung.js",
  "uebungen.js",
  "wiederholung.js",
];

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
function normalize(text) {
  return text.replace(DIACRITICS, "").toLowerCase();
}

// عباراتٌ ادّعاءُ اعتمادٍ سريريّ/طبّيّ عامّ، لا تسمياتُ حالةٍ مشروطةٌ ببيانات
// عنصرٍ بعينه (تلك خارج نطاق هذا الحارس، راجع issue #4).
const BANNED_PHRASES = [
  normalize("اعتمد سريريا"),
  normalize("معتمد طبيا"),
  "clinically approved",
  "klinisch freigegeben",
  "medically approved",
  "medizinisch freigegeben",
];

test("no shipped file claims general clinical/medical approval", () => {
  const offenders = [];
  for (const file of SHIPPED_FILES) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    const raw = fs.readFileSync(fullPath, "utf8");
    const lines = raw.split("\n");
    lines.forEach((line, i) => {
      const normalized = normalize(line);
      for (const phrase of BANNED_PHRASES) {
        if (normalized.includes(phrase)) {
          offenders.push(`${file}:${i + 1} contains banned phrase "${phrase}"`);
        }
      }
    });
  }
  assert.deepEqual(offenders, []);
});
