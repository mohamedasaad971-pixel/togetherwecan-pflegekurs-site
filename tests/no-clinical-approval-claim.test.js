/* يمنع عودةَ أيّ جملةٍ تدّعي اعتماداً سريريّاً/طبّياً عامّاً للمحتوى، بعد أن
   حذف محمد (٢٠٢٦-٠٩-١٣) جملةً من هذا النوع لأنها صارت كاذبة (راجع
   app.js:358-360) واشترط ألّا يحلّ محلّها ادّعاءٌ مشابه. راجع issue #4. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
// امسح كلَّ ملفّ .js/.html في الجذر بدل قائمةٍ يدويّة، كي لا يفوت ملفٌّ
// جديدٌ (فات modus.js من قائمةٍ سابقة هنا — راجع مراجعة Codex على #5).
const SHIPPED_FILES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".js") || f.endsWith(".html"));

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
function normalize(text) {
  return text.replace(DIACRITICS, "").toLowerCase();
}

// عباراتٌ ادّعاءُ اعتمادٍ سريريّ/طبّيّ عامّ، لا تسمياتُ حالةٍ مشروطةٌ ببيانات
// عنصرٍ بعينه (راجع issue #4): شارةُ "معتمد سريريّاً ومنهجيّاً" في صفحة
// التغطية مستثناةٌ عمداً بالنمط السلبيّ (?!\s*ومنهجيا) أدناه، لأنّ "ومنهجيّاً"
// بعدها يجعلها تسميةَ حالةٍ مزدوجةَ الشرط لا ادّعاءً عامّاً.
const BANNED_PHRASES = [
  /(?:ا|م)عتمد سريريا(?!\s*ومنهجيا)/,
  /معتمد طبيا/,
  "clinically approved",
  "klinisch freigegeben",
  "medically approved",
  "medizinisch freigegeben",
];

function matchesBannedPhrase(normalizedLine, phrase) {
  return phrase instanceof RegExp
    ? phrase.test(normalizedLine)
    : normalizedLine.includes(phrase);
}

test("no shipped file claims general clinical/medical approval", () => {
  const offenders = [];
  for (const file of SHIPPED_FILES) {
    const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
    const lines = raw.split("\n");
    lines.forEach((line, i) => {
      const normalized = normalize(line);
      for (const phrase of BANNED_PHRASES) {
        if (matchesBannedPhrase(normalized, phrase)) {
          offenders.push(`${file}:${i + 1} contains banned phrase "${phrase}"`);
        }
      }
    });
  }
  assert.deepEqual(offenders, []);
});
