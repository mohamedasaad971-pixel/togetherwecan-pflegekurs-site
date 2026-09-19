/* حارس انحدارٍ لملفّ PROJECT-BOOTSTRAP.md: يمنع أن يغيب الملفّ، أو أن يفرغ
   من أحد أقسامه الستّة المطلوبة، أو أن يتسرّب إليه بريدٌ إلكترونيّ أو
   معرّفٌ سداسيّ عشريٌّ طويل (شكل معرّفات المهامّ/الأصول) أو ادّعاء اعتمادٍ
   سريريّ — بالقياس على نفس حارس STATUS.md (راجع #9). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FILE_PATH = path.join(__dirname, "..", "PROJECT-BOOTSTRAP.md");

const REQUIRED_HEADINGS = [
  "## دور الوكيل",
  "## حقائق يجب احترامها",
  "## ترتيب الأولويّات",
  "## سياسة الفروع وPRs",
  "## الملفّات المرجعيّة الواجب قراءتها أوّلاً",
  "## ما يجب عدم فعله",
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// لا \b: بادئةٌ تقليديّةٌ كـ"task_"/"asset_" حرفُها الأخير ("_") وأوّلُ رقمٍ
// سداسيَّ عشريَّ بعدها حرفا كلمةٍ كلاهما، فلا حدَّ بينهما يطابقه \b (ملاحظة
// Codex على #14، مطابقةٌ لِما أُصلح في HEX_ID_RE من tests/status-file.test.js).
const LONG_HEX_ID_RE = /(?<![0-9a-fA-F])[0-9a-fA-F]{16,}(?![0-9a-fA-F])/;
// نفس مدى التشكيل العربيّ المستبعَد في tests/no-clinical-approval-claim.test.js
// وtests/status-file.test.js (U+0610–U+061A، U+064B–U+065F، U+0670،
// U+06D6–U+06ED)، كي لا يُفلت ادّعاءٌ مشكَّلٌ مثل "معتمَد سريريّاً" من
// المطابقة (ملاحظة Codex على #14).
const DIACRITIC_RE = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const APPROVAL_CLAIM_RE = /(?:ا|م)عتمد[ة]?\s+(?:سريريا|طبيا)/;

test("PROJECT-BOOTSTRAP.md exists and contains every required section", () => {
  assert.equal(fs.existsSync(FILE_PATH), true, "PROJECT-BOOTSTRAP.md must exist at repo root");
  const raw = fs.readFileSync(FILE_PATH, "utf8");
  assert.ok(raw.trim().length > 0, "PROJECT-BOOTSTRAP.md must not be empty");
  for (const heading of REQUIRED_HEADINGS) {
    assert.ok(raw.includes(heading), `missing required section: "${heading}"`);
  }
});

test("PROJECT-BOOTSTRAP.md leaks no internal details", () => {
  const raw = fs.readFileSync(FILE_PATH, "utf8");
  const withoutDiacritics = raw.replace(DIACRITIC_RE, "");
  assert.doesNotMatch(raw, EMAIL_RE, "must not contain an email address");
  assert.doesNotMatch(raw, LONG_HEX_ID_RE, "must not contain a long hex id");
  assert.doesNotMatch(withoutDiacritics, APPROVAL_CLAIM_RE, "must not contain a clinical approval claim");
});
