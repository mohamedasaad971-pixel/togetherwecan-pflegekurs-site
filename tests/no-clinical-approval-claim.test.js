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

const DIACRITIC = /[ؐ-ًؚ-ٰٟۖ-ۭ]/;

// يطبّع الملفَّ كلَّه دفعةً واحدة (لا سطراً سطراً)، فتلتقط العبارةُ حتّى لو
// قسمها التفافُ HTML بين سطرين (راجع مراجعة Codex المطابقة على #6)، مع
// بقاء خريطةٍ لرقم السطر الأصليّ لكلّ حرفٍ في الناتج، ليبقى تقرير الخطأ مفيداً.
function normalizeWithLineMap(raw) {
  let normalized = "";
  const lineOfIndex = [];
  let line = 1;
  let inWhitespaceRun = false;
  for (const ch of raw) {
    if (DIACRITIC.test(ch)) continue;
    if (/\s/.test(ch)) {
      if (!inWhitespaceRun) {
        normalized += " ";
        lineOfIndex.push(line);
        inWhitespaceRun = true;
      }
      if (ch === "\n") line++;
      continue;
    }
    inWhitespaceRun = false;
    normalized += ch.toLowerCase();
    lineOfIndex.push(line);
  }
  return { normalized, lineOfIndex };
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

function findMatchIndices(normalized, phrase) {
  const indices = [];
  if (phrase instanceof RegExp) {
    const global = new RegExp(
      phrase.source,
      phrase.flags.includes("g") ? phrase.flags : phrase.flags + "g"
    );
    let m;
    while ((m = global.exec(normalized))) {
      indices.push(m.index);
      if (m[0].length === 0) global.lastIndex++;
    }
  } else {
    for (let i = normalized.indexOf(phrase); i !== -1; i = normalized.indexOf(phrase, i + 1)) {
      indices.push(i);
    }
  }
  return indices;
}

test("no shipped file claims general clinical/medical approval", () => {
  const offenders = [];
  for (const file of SHIPPED_FILES) {
    const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
    const { normalized, lineOfIndex } = normalizeWithLineMap(raw);
    for (const phrase of BANNED_PHRASES) {
      for (const idx of findMatchIndices(normalized, phrase)) {
        offenders.push(`${file}:${lineOfIndex[idx]} contains banned phrase "${phrase}"`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
