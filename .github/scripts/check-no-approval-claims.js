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

const DIACRITIC = /[ؐ-ًؚ-ٰٟۖ-ۭ]/;

// يطبّع الملفَّ كلَّه دفعةً واحدة (لا سطراً سطراً)، فتلتقط العبارةُ حتّى لو
// قسمها التفافُ HTML بين سطرين، مع بقاء خريطةٍ لرقم السطر الأصليّ لكلّ حرفٍ
// في الناتج، ليبقى تقرير الخطأ مفيداً.
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

const offenders = [];
for (const file of SHIPPED_FILES) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  const { normalized, lineOfIndex } = normalizeWithLineMap(raw);
  for (const phrase of BANNED_PHRASES) {
    for (const idx of findMatchIndices(normalized, phrase)) {
      offenders.push(`${file}:${lineOfIndex[idx]} — "${phrase}"`);
    }
  }
}

if (offenders.length) {
  console.error("عباراتُ ادّعاء اعتمادٍ سريريّ/طبّيّ عامّ وُجدت:");
  offenders.forEach((o) => console.error("  " + o));
  process.exit(1);
}

console.log("لا ادّعاءَ اعتمادٍ سريريّ/طبّيّ عامّ في الملفّات المنشورة.");
