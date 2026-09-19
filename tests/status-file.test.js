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
  "معتمد سريريا",
  "معتمد طبيا",
  "معتمدة سريريا",
  "معتمدة طبيا",
  "clinically approved",
  "medically approved",
];

test("STATUS.md exists and is not empty", () => {
  assert.ok(fs.existsSync(STATUS_PATH), "STATUS.md is missing");
  const raw = fs.readFileSync(STATUS_PATH, "utf8").trim();
  assert.ok(raw.length > 0, "STATUS.md is empty");
});

test("STATUS.md leaks no internal details or approval claims", () => {
  const raw = fs.readFileSync(STATUS_PATH, "utf8");
  const lower = raw.toLowerCase();

  assert.equal(EMAIL_RE.test(raw), false, "STATUS.md must not contain an email address");
  assert.equal(
    HEX_ID_RE.test(raw),
    false,
    "STATUS.md must not contain a long hex id (looks like a job/asset id)"
  );

  const offenders = BANNED_SUBSTRINGS.filter((s) => lower.includes(s));
  assert.deepEqual(
    offenders,
    [],
    `STATUS.md contains banned substrings: ${offenders.join(", ")}`
  );
});
