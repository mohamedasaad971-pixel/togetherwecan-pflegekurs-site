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

// يفكّ مهرَّبات سلاسل JS ذات الأثر على المطابقة قبل التطبيع:
// - "\n"/"\t"/"\r" (سطرٌ جديدٌ أو تبويبٌ مهرَّبان) تُصيَّران مسافةً — كما يراهما
//   المتصفّحُ فعلاً — لا حرفاً حرفيّاً يُلصق كلمتين (ملاحظة Codex الأولى).
// - "\uNNNN"، "\u{...}"، و"\xNN" (مراجعُ يونيكود/سداسيّةٌ) تُفكّ إلى المحرف
//   الفعليّ الذي تمثّله، لا نصّها الحرفيّ (فـ"a" يصير "a"، لا "u0061"
//   ملتصقةً بما حولها) — وإلّا أمكن تهريبُ الادّعاء بأكمله حرفاً حرفاً
//   (ملاحظة Codex الثانية). مرجعٌ غيرُ صالحٍ (نقطةُ ترميزٍ خارج المدى) يبقى
//   كما هو بلا فكٍّ بدل رمي استثناء.
// - "\""/"\'" تصيران محرفَ الاقتباس نفسَه (فيتطابق شكلا الاقتباس بين app.js
//   غيرِ المهرَّب وui-de.js/ui-en.js المهرَّبين كمفاتيح قاموس).
// - أيّ تهريبٍ آخر (\\، \/، ...) يُسقَط الـ"\" منه فقط ويبقى المحرفُ كما هو،
//   وهو السلوكُ الآمن الافتراضيّ لأيّ تهريبٍ لا يغيّر المعنى البصريّ هنا.
function unescapeJsStringEscapes(raw) {
  return raw.replace(
    /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(.))/g,
    (whole, uBrace, uHex4, xHex2, other) => {
      const hex = uBrace !== undefined ? uBrace : uHex4 !== undefined ? uHex4 : xHex2;
      if (hex !== undefined) {
        try {
          return String.fromCodePoint(parseInt(hex, 16));
        } catch {
          return whole;
        }
      }
      if (other === "n" || other === "t" || other === "r") return " ";
      return other;
    }
  );
}

// يطبّع الملفَّ كلَّه دفعةً واحدة (لا سطراً سطراً)، فتلتقط العبارةُ حتّى لو
// قسمها التفافُ HTML بين سطرين، مع بقاء خريطةٍ لرقم السطر الأصليّ لكلّ حرفٍ
// في الناتج، ليبقى تقرير الخطأ مفيداً.
function normalizeWithLineMap(raw) {
  let normalized = "";
  const lineOfIndex = [];
  let line = 1;
  let inWhitespaceRun = false;
  for (const ch of unescapeJsStringEscapes(raw)) {
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
// كهذا كان يسمح بأيّ جملةٍ من هذا الشكل (ملاحظة Codex على #6).
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
// المستودع. الاستثناءُ مربوطٌ بالملفّ *وبوسم الفتح المحيط معاً*، لا بنصّ
// الشارة وحده: فمجرّد نشر النصّ نفسِه بوسمٍ آخر (كـ"<p>" بدل "<span>"، حتى
// داخل app.js نفسِه) يبقى مرفوضاً — لا يكفي أن يكون الملفُّ صحيحاً، بل
// السياقُ الحرفيُّ (الوسمُ الذي يلفّ الشارتين فعليّاً في الكود) أيضاً
// (ملاحظة Codex بعد التضييق الأوّل بالملفّ وحده).
const ALLOWED_EXACT_FRAGMENTS = new Set([
  "<span>معتمد سريريا ومنهجيا",
  '<span class="chip frei">معتمد سريريا ومنهجيا',
  '<div class="band gut">كل المتطلبات معتمدة سريريا ومنهجيا.',
]);
const FRAGMENT_ALLOWED_FILES = new Set(["app.js", "ui-de.js", "ui-en.js"]);

function isAllowedExactSegment(file, normalized, matchIndex) {
  if (!FRAGMENT_ALLOWED_FILES.has(file)) return false;
  const before = normalized.lastIndexOf(">", matchIndex);
  const after = normalized.indexOf("<", matchIndex);
  if (before === -1 || after === -1) return false;
  const tagStart = normalized.lastIndexOf("<", before);
  if (tagStart === -1) return false;
  return ALLOWED_EXACT_FRAGMENTS.has(normalized.slice(tagStart, after).trim());
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

const offenders = [];
for (const file of SHIPPED_FILES) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  const { normalized, lineOfIndex } = normalizeWithLineMap(raw);
  for (const phrase of BANNED_PHRASES) {
    for (const idx of findMatchIndices(normalized, phrase)) {
      if (phrase === COMBINED_CLAIM && isAllowedExactSegment(file, normalized, idx)) continue;
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
