// يمنع نشرَ أيّ نصٍّ يدّعي اعتماداً سريريّاً/طبّياً عامّاً للمحتوى. راجع
// app.js:358-360 وissue #4: هذا شرطُ صاحب المستودع، لا اقتراحُ أسلوب.
// لا يطال هذا تسمياتِ حالةٍ مشروطةً ببيانات عنصرٍ بعينه (مثل شارة
// "معتمد سريريّاً ومنهجيّاً" في صفحة التغطية)، بل جملَ الادّعاء العامّ فقط.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const SHIPPED_FILES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".js") || f.endsWith(".html"));

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
function normalize(text) {
  return text.replace(DIACRITICS, "").toLowerCase();
}

// نمطٌ لا قائمةٌ حرفيّة: يلتقط صيغتَي الفعل والصفة معاً ("اعتُمد"/"معتمد")
// مع استثناءٍ سلبيٍّ لِـ"…ومنهجيّاً" كي لا يطال شارة "معتمد سريريّاً
// ومنهجيّاً" المشروطة ببيانات صفحة التغطية (خارج نطاق issue #4).
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

const offenders = [];
for (const file of SHIPPED_FILES) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  raw.split("\n").forEach((line, i) => {
    const normalized = normalize(line);
    for (const phrase of BANNED_PHRASES) {
      if (matchesBannedPhrase(normalized, phrase)) {
        offenders.push(`${file}:${i + 1} — "${phrase}"`);
      }
    }
  });
}

if (offenders.length) {
  console.error("عباراتُ ادّعاء اعتمادٍ سريريّ/طبّيّ عامّ وُجدت:");
  offenders.forEach((o) => console.error("  " + o));
  process.exit(1);
}

console.log("لا ادّعاءَ اعتمادٍ سريريّ/طبّيّ عامّ في الملفّات المنشورة.");
