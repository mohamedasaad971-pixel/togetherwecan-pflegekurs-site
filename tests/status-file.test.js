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
const HEX_ID_RE = /\b[0-9a-f]{12,}\b/i;

// نفس مدى التشكيل العربيّ المستبعَد في tests/no-clinical-approval-claim.test.js
// (U+0610–U+061A، U+064B–U+065F، U+0670، U+06D6–U+06ED)، كي لا يُفلت ادّعاءٌ
// مشكَّلٌ مثل "معتمَد سريريّاً" من المطابقة. مكتوبٌ بترميز \u بدل الحرف
// العربيّ الحرفيّ عمداً: النسخة الحرفيّة السابقة هنا اختلط ترتيب طرفَي مدىً
// فيها (كتابةً أو نسخاً عبر نصٍّ ثنائيّ الاتّجاه) فابتلعت حروفاً عربيّةً
// حقيقيّةً بدل التشكيل فقط — رغم تطابقها الظاهريّ مع النسخة الصحيحة عند
// العرض (ملاحظة Codex). تحقّقتُ برمجيّاً من تطابق هذا التعبير حرفاً حرفاً مع
// DIACRITIC في no-clinical-approval-claim.test.js عبر كامل مدى U+0600–U+06FF.
const DIACRITIC = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;

// عبارةُ الادّعاء بصيغتَي الفعل والصفة مذكّرةً ومؤنّثة ("معتمد"/"معتمدة"/"اعتُمد")،
// بعد حذف التشكيل وطيّ المسافات (بما فيها فواصل الأسطر) إلى مسافةٍ واحدة.
const CLAIM_PATTERNS = [
  /(?:ا|م)عتمد[ة]?\s+سريريا/,
  /معتمد[ة]?\s+طبيا/,
  "clinically approved",
  "medically approved",
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

function normalize(raw) {
  return raw.replace(DIACRITIC, "").replace(/\s+/g, " ").toLowerCase();
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
