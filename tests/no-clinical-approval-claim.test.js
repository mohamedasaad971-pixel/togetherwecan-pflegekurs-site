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

// عبارةُ الادّعاء السريريّ الجذريّة، بصيغتَي الفعل والصفة مذكّرةً ومؤنّثة
// ("معتمد"/"معتمدة"/"اعتُمد")، بلا استثناءٍ نمطيّ: تُستثنى فقط حين تكون هي
// وحدَها محتوى عقدة نصٍّ كاملةٍ بين وسمَي HTML (تساوي تماماً إحدى الشارتين
// المعروفتَين في صفحة التغطية، راجع ALLOWED_EXACT_SEGMENTS)، لا حين ترد داخل
// جملةٍ أعمّ مثل "المحتوى معتمد سريريّاً ومنهجيّاً" — استثناءٌ نمطيٌّ سابقٌ
// كهذا كان يسمح بأيّ جملةٍ من هذا الشكل (ملاحظة Codex على #5).
const COMBINED_CLAIM = /(?:ا|م)عتمد[ة]?\s+سريريا/;
const BANNED_PHRASES = [
  COMBINED_CLAIM,
  /معتمد[ة]?\s+طبيا/,
  "clinically approved",
  "klinisch freigegeben",
  "medically approved",
  "medizinisch freigegeben",
];

// المواضع الوحيدة المسموح فيها بعبارة الادّعاء: شارتا حالةٍ مشروطتان ببيانات
// متطلَّبٍ بعينه في صفحة التغطية (#/abdeckung) — واحدةٌ لكلّ متطلَّب، وأخرى
// لاكتمالها كلِّها معاً — لا ادّعاءٌ عامّ. خارج نطاق issue #4 بقرار صاحب
// المستودع.
const ALLOWED_EXACT_SEGMENTS = new Set([
  "معتمد سريريا ومنهجيا",
  "كل المتطلبات معتمدة سريريا ومنهجيا.",
]);

function isAllowedExactSegment(normalized, matchIndex) {
  const before = normalized.lastIndexOf(">", matchIndex);
  const after = normalized.indexOf("<", matchIndex);
  if (before === -1 || after === -1) return false;
  return ALLOWED_EXACT_SEGMENTS.has(normalized.slice(before + 1, after).trim());
}

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
        if (phrase === COMBINED_CLAIM && isAllowedExactSegment(normalized, idx)) continue;
        offenders.push(`${file}:${lineOfIndex[idx]} contains banned phrase "${phrase}"`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
