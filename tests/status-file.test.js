/* حارسٌ ثابتٌ لملفّ STATUS.md العامّ: يمنع تسرّب تفاصيل داخليّة (رسائل خطأ
   مزوّدين، معرّفات API/أصول/مهامّ، بيانات شخصيّة) وأيّ ادّعاء اعتمادٍ
   سريريّ/طبّي (لا مراجعة سريريّة بشريّة بتاتاً — راجع README.md وissue #4)
   إلى هذا المستودع العامّ. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const STATUS_PATH = path.join(__dirname, "..", "STATUS.md");

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// بيانات شخصيّةٌ غيرُ البريد: رقمُ هاتفٍ. يتطلّب ٩ أرقامٍ فعليّةٍ على الأقلّ
// (ربّما مفصولةً بمسافةٍ/شرطةٍ/نقطةٍ/قوسٍ، وبادئة "+" اختياريّة) — لا ٧ فقط:
// تاريخٌ بصيغة "٢٠٢٦-٠٩-١٩" يحمل ٨ أرقامٍ فعليّاً بالضبط، وهذا الملفُّ يذكر
// تاريخَ تحديثٍ بهذه الصيغة تحديداً؛ عتبةُ ٩ تُبقي التاريخَ مقبولاً بينما
// تكشف رقمَ هاتفٍ حقيقيّاً (تسعةُ أرقامٍ فأكثر في كلّ صيغ الهاتف الدوليّة
// والمحليّة تقريباً) دون مطابقةٍ زائفة. \p{Nd} لا \d: الملفُّ عربيٌّ، ورقمُ
// هاتفٍ مكتوبٌ بأرقامٍ هنديّةٍ عربيّةٍ ("٤٩ ١٥١...") بيانٌ شخصيٌّ واقعيٌّ هنا
// كأيّ رقمٍ لاتينيّ، لكنّ \d يقتصر على أرقام ASCII فيُفلته كليّاً (ملاحظة
// Codex) — صنفُ يونيكود للأرقام العشريّة (بعلامة "u") يشملها جميعاً.
const PHONE_RE = /\+?\p{Nd}(?:[\s().-]{0,2}\p{Nd}){8,}/u;
// لا \b: فاصلا الكلمة والمعرّف حرفا كلمةٍ كلاهما ("_" و[0-9a-f])، فلا حدَّ بينهما
// عند بادئةٍ تقليديّةٍ كـ"asset_" أو"job_" (ملاحظة Codex)؛ استبعادُ التوسّع بحرفٍ
// سداسيَّ عشريَّ إضافيٍّ على أيّ طرفٍ يكفي لاكتشاف المعرّف بلا مطابقةٍ زائفة.
const HEX_ID_RE = /(?<![0-9a-f])[0-9a-f]{12,}(?![0-9a-f])/i;

// نفس مدى التشكيل العربيّ المستبعَد في tests/no-clinical-approval-claim.test.js
// (U+0610–U+061A، U+064B–U+065F، U+0670، U+06D6–U+06ED)، كي لا يُفلت ادّعاءٌ
// مشكَّلٌ مثل "معتمَد سريريّاً" من المطابقة. مكتوبٌ بترميز \u بدل الحرف
// العربيّ الحرفيّ عمداً: النسخة الحرفيّة السابقة هنا اختلط ترتيب طرفَي مدىً
// فيها (كتابةً أو نسخاً عبر نصٍّ ثنائيّ الاتّجاه) فابتلعت حروفاً عربيّةً
// حقيقيّةً بدل التشكيل فقط — رغم تطابقها الظاهريّ مع النسخة الصحيحة عند
// العرض (ملاحظة Codex). تحقّقتُ برمجيّاً من تطابق هذا التعبير حرفاً حرفاً مع
// DIACRITIC في no-clinical-approval-claim.test.js عبر كامل مدى U+0600–U+06FF.
const DIACRITIC = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

// عبارةُ الادّعاء بصيغتَي الفعل والصفة مذكّرةً ومؤنّثةً ومنصوبةً ("معتمد"/
// "معتمدة"/"معتمداً"/"اعتُمد"/"اعتُمدت")، بعد حذف التشكيل وطيّ المسافات (بما
// فيها فواصل الأسطر) إلى مسافةٍ واحدة. [ةتا] لا [ةت] وحدها: الصفةُ المؤنّثة
// تنتهي بتاءٍ مربوطةٍ ("معتمدة")، والفعلُ الماضي المبنيّ للمجهول المؤنّث
// ينتهي بتاءٍ متحرّكةٍ ("اعتُمدت")، والصفةُ المنصوبة ("معتمداً") يبقى ألِفُها
// بعد حذف تنوين الفتح تشكيلاً لا حرفاً — إغفال أيٍّ من الثلاثة كان يُفلت
// صيغته من المطابقة (ملاحظة Codex: الصيغة المنصوبة تحديداً).
// STATUS.md يُعرَض Markdown، وMarkdown يمرّر وسمَ HTML ضمنيّاً كـ"<strong>"
// إلى الصفحة المعروضة بلا تغييرٍ ("clinically <strong>approved</strong>"
// تُعرَض "clinically approved" متّصلةً)؛ الفاصلُ بين كلمتَي كلّ عبارةٍ أدناه
// يقبل الآن وسماً واحداً أو أكثر بالتبادل مع المسافة (لا يتوقّف عند ">" داخل
// قيمة سمةٍ مقتبسةٍ، أسوةً بـTAG_GAP في check-no-approval-claims.js)، فلا
// يُفلت وسمٌ بينهما الادّعاءَ من الاكتشاف (ملاحظة Codex).
const TAG_GAP = '<(?:"[^"]*"|\'[^\']*\'|[^<>])*>';
const CLAIM_PATTERNS = [
  new RegExp(`(?:ا|م)عتمد[ةتا]?(?:\\s|${TAG_GAP})+سريريا`),
  new RegExp(`(?:ا|م)عتمد[ةتا]?(?:\\s|${TAG_GAP})+طبيا`),
  new RegExp(`clinically(?:\\s|${TAG_GAP})+approved`),
  new RegExp(`medically(?:\\s|${TAG_GAP})+approved`),
  new RegExp(`klinisch(?:\\s|${TAG_GAP})+freigegeben`),
  new RegExp(`medizinisch(?:\\s|${TAG_GAP})+freigegeben`),
];
const BANNED_SUBSTRINGS = [
  "elevenlabs",
  "midjourney",
  "heygen",
  "api key",
  "api-key",
  "job id",
  "asset id",
  "traceback",
  "stack trace",
];

// طيُّ التشكيل/المسافات نفسُه المستخدَم لمطابقة معرّفات مراجع Markdown
// ("[نصّ]" مقابل تعريف "[نصّ]: عنوان") بلا حساسيّةٍ لحالة الأحرف أو تكرار
// المسافات، أسوةً بمعيار CommonMark لمطابقة المعرّفات.
function foldReferenceLabel(text) {
  return text.replace(DIACRITIC, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// يفكّ مراجعَ محارف HTML (العدديّة والاسميّة الشائعة)، أسوةً بالدالّة نفسها
// في check-robots-and-indexing.js/check-no-approval-claims.js: عبارةٌ
// كـ"clinically&nbsp;approved" في Markdown تُعرَض "clinically approved"
// بمسافةٍ حقيقيّةٍ فعليّاً، لكنّ "&nbsp;" الحرفيّة نصٌّ عاديٌّ لا مسافةٌ
// بمعنى \s، فتُفلت أنماط CLAIM_PATTERNS من المطابقة ما لم تُفكَّ أوّلاً
// (ملاحظة Codex). المرجعُ العدديّ لا يلزمه ";" بمعيار HTML5.
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decodeHtmlEntities(text) {
  return text.replace(/&(#[xX][0-9a-fA-F]+;?|#\d+;?|[a-zA-Z]+;)/g, (whole, ref) => {
    if (ref[0] === "#") {
      const digits = ref.replace(/;$/, "");
      const codePoint =
        digits[1] === "x" || digits[1] === "X" ? parseInt(digits.slice(2), 16) : parseInt(digits.slice(1), 10);
      if (Number.isNaN(codePoint)) return whole;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return whole;
      }
    }
    const name = ref.slice(0, -1);
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : whole;
  });
}

function normalize(rawInput) {
  const raw = decodeHtmlEntities(rawInput);
  // إزالة فواصل تنسيق Markdown (**تشديد**، `شفرة`، ~~شطب~~) قبل طيّ المسافات:
  // بلا هذا، عبارةٌ كـ"معتمد **سريريّاً**" تبقى غيرَ مطابقةٍ لأنماط \s+ رغم أنّ
  // الصفحة المعروضة تحمل الادّعاء فعلاً (ملاحظة Codex).
  // ورابطُ Markdown "[نصّ](عنوان)" يُستبدَل بنصّه وحده (لا بالعنوان): عبارةٌ
  // كـ"معتمد [سريريّاً](...)" تُعرَض "معتمد سريريّاً" فعليّاً، لا أن يبقى بين
  // الكلمتَين قوسا نصٍّ وعنوانٌ يُفشلان مطابقة \s+ (ملاحظة Codex). ورابطُ
  // Markdown بصيغة المرجع "[نصّ][معرّف]" (مع تعريفٍ منفصلٍ لاحقاً كـ
  // "[معرّف]: عنوان") صيغةٌ قياسيّةٌ أخرى تُعرَض النصَّ نفسَه أيضاً، فتُسقَط
  // بنفس المنطق — لا يكفي إسقاط صيغة القوسين وحدها (ملاحظة Codex الثانية).
  // وأخيراً صيغةُ "المرجع المختصَر" ("[نصّ]" وحدها، حين يوجد تعريفٌ لهذا
  // النصّ بعينه) تُعرَض نصَّها أيضاً بمعيار Markdown — بخلاف الصيغتَين
  // أعلاه، هذه لا تُسقَط دائماً: قوسان حول نصٍّ عاديٍّ (لا رابط) شائعان في
  // نثرٍ عاديٍّ (كتعليقٍ بين قوسين)، فتُقارَن فقط بمجموعة المعرّفات الموجودة
  // فعلاً في الملفّ (سطرٌ بصيغة "[معرّف]: عنوان")، لا كلُّ "[نصّ]" حرفيّاً
  // (ملاحظة Codex الثالثة).
  const withoutDiacritics = raw.replace(DIACRITIC, "");
  const referenceLabels = new Set();
  const REFERENCE_DEFINITION_RE = /^[ \t]{0,3}\[([^\]]+)\]:\s*\S+/gm;
  let definitionMatch;
  while ((definitionMatch = REFERENCE_DEFINITION_RE.exec(withoutDiacritics))) {
    referenceLabels.add(foldReferenceLabel(definitionMatch[1]));
  }
  return withoutDiacritics
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/\[([^\]]*)\]/g, (whole, text) =>
      referenceLabels.has(foldReferenceLabel(text)) ? text : whole
    )
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

test("STATUS.md exists and is not empty", () => {
  assert.ok(fs.existsSync(STATUS_PATH), "STATUS.md is missing");
  const raw = fs.readFileSync(STATUS_PATH, "utf8").trim();
  assert.ok(raw.length > 0, "STATUS.md is empty");
});

test("STATUS.md leaks no internal details or approval claims", () => {
  const raw = fs.readFileSync(STATUS_PATH, "utf8");
  const normalized = normalize(raw);

  assert.equal(EMAIL_RE.test(raw), false, "STATUS.md must not contain an email address");
  assert.equal(PHONE_RE.test(raw), false, "STATUS.md must not contain a phone number");
  assert.equal(
    HEX_ID_RE.test(raw),
    false,
    "STATUS.md must not contain a long hex id (looks like a job/asset id)"
  );

  const offenders = [...BANNED_SUBSTRINGS, ...CLAIM_PATTERNS].filter((phrase) =>
    phrase instanceof RegExp ? phrase.test(normalized) : normalized.includes(phrase)
  );
  assert.deepEqual(
    offenders,
    [],
    `STATUS.md contains banned content: ${offenders.join(", ")}`
  );
});
