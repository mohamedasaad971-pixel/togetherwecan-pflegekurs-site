// يتحقّق أنّ كلّ مسار "medien/…" مذكورٍ في JS/HTML موجودٌ فعلاً في المستودع
// ومُدرَجٌ في PAKET.json، حتّى لا يُنشر مسارٌ ميّتٌ أو غيرُ موصوفٍ في الحزمة.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const SOURCE_FILES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".js") || f.endsWith(".html"));

// المسارُ قد يتضمّن مجلّداتٍ فرعيّة (medien/course/intro.mp4)، فلا يُقتصر
// الشرطُ على أحرف اسم الملفّ وحدَه بلا فاصل "/". وصنفُ المحارف يقبل حروفَ
// يونيكود (\p{L})، أرقامَه (\p{N})، وعلاماتِه التشكيليّة (\p{M})، لا ASCII
// وحدَها: مستودعٌ ألمانيّ/عربيّ قد يسمّي ملفّاً حقيقيّاً "medien/überblick.mp3"
// أو باسمٍ عربيّ، وكان صنفُ المحارف السابقَ يقطعه عند أوّل محرفٍ غيرِ ASCII
// (فيُبلَّغ خطأً أنّه مفقودٌ من القرص أو من PAKET.json رغم وجوده)، أو يُسقطه
// كلّياً إن جاء المحرفُ غيرُ ASCII أوّل اسم الملفّ (ملاحظة Codex). وتُقبَل
// أيضاً ثلاثيّةٌ كاملةٌ من ترميز URL ("%" فحرفَين سداسيَّي عشريَّين معاً، لا
// "%" وحدَها) لملفٍّ حقيقيٍّ اسمُه يحوي محارفَ يلزمها ترميزٌ في مسارٍ (كمسافةٍ:
// "medien/intro%20one.mp3" — ملاحظة Codex). لا نقبل مسافةً أو قوساً حرفيَّين
// غيرَ مُرمَّزَين في صنف المحارف: كلاهما شائعٌ في نثرٍ مجاورٍ (كـ"...mp3)
// للاستماع" أو جملةٍ عاديّةٍ)، فقبولُهما مباشرةً يُبقي المطابقةَ مستمرّةً في
// الجملة المحيطة بدل التوقّف عند نهاية المسار الفعليّ لكلّ مسارٍ حاليٍّ في
// هذا المستودع (تحقّقتُ: لا مسافةَ ولا قوسَ في أيّ من ٣٣٨ مسار وسائطَ فعليٍّ
// اليوم) — عكسُ الترميزِ المئويّ غيرِ الملتبس أعلاه.
const MEDIA_REF = /medien\/(?:%[0-9a-fA-F]{2}|[\p{L}\p{N}\p{M}_.\-/])+/gu;

// يفكّ ترميز URL المئويّ ("%20" ← مسافة) في المرجع بعد المطابقة، إذ يُقارَن
// لاحقاً بالمسار الفعليّ على القرص وبقائمة PAKET.json — وكلاهما يحمل اسمَ
// الملفّ الحقيقيَّ غيرَ المرمَّز، لا الشكلَ المرمَّز في وسم HTML/جافاسكربت.
function decodePercentEscapes(ref) {
  try {
    return decodeURIComponent(ref);
  } catch {
    return ref;
  }
}

// "." من أحرف المسار المشروعة (امتدادُ الملفّ)، فلا يمكن استبعادها من صنف
// المحارف أعلاه؛ لكنّ هذا يجعل المطابقة تبتلع نقطةَ نهاية جملةٍ نثريّةٍ تلي
// المسارَ مباشرةً (كـ"Audio: medien/amina-00.mp3.")، فيُبلَّغ مسارٌ مفقودٌ لا
// وجودَ له أصلاً. نحذف تذييلاً من علامات ترقيمٍ ختاميّةٍ شائعةٍ من نهاية كلّ
// مطابَقةٍ، لكن فقط حين يبقى بعد الحذف امتدادُ ملفٍّ فعليٌّ (نقطةٌ فحروفٌ/أرقامٌ
// في النهاية) — لا حين يكون جزءاً حقيقيّاً من اسم ملفٍّ لا نعرفه (ملاحظة Codex).
const TRAILING_SENTENCE_PUNCT_RE = /[.,;:!?]+$/;
const HAS_EXTENSION_RE = /\.[\p{L}\p{N}]+$/u;
function stripTrailingSentencePunct(ref) {
  const stripped = ref.replace(TRAILING_SENTENCE_PUNCT_RE, "");
  return stripped !== ref && HAS_EXTENSION_RE.test(stripped) ? stripped : ref;
}

const paket = JSON.parse(fs.readFileSync(path.join(ROOT, "PAKET.json"), "utf8"));
const listed = new Set(paket.dateien || []);

// جافاسكربت يسمح بتهريب أيّ محرفٍ في نصٍّ حرفيٍّ ("medien\/x.mp3"، أو
// "medien/missing.mp3" بمرجع يونيكود)، فيُقيَّم كلاهما إلى مسارٍ حقيقيٍّ
// وقت التشغيل رغم أنّ المصدر الخامّ لا يطابق نمط المسار أصلاً (يفوته حرفٌ
// مهرَّبٌ واحدٌ فيمرّ المسارُ بلا تحقّقٍ صامتاً بدل أن يُبلَّغ مفقوداً —
// ملاحظة Codex، جولتان: "\/" أوّلاً، ثمّ أيُّ تهريبٍ آخر كمرجع يونيكود).
// نفكّ كلَّ تهريبات سلاسل JS ذات الأثر (نفسُ unescapeJsStringEscapes في
// check-no-approval-claims.js) في نسخةٍ من النصّ خاصّةٍ بالمطابقة فقط، قبل
// البحث عن المسارات.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const JS_ESCAPE_RE = new RegExp(
  "\\\\(?:(\\r\\n|[\\r\\n" + LINE_SEPARATOR + PARAGRAPH_SEPARATOR + "])|u\\{([0-9a-fA-F]+)\\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([0-3][0-7]{0,2}|[4-7][0-7]?)|(.))",
  "g"
);
function unescapeJsStringEscapes(raw) {
  return raw.replace(
    JS_ESCAPE_RE,
    (whole, lineCont, uBrace, uHex4, xHex2, octal, other) => {
      if (lineCont !== undefined) return "";
      const hex = uBrace !== undefined ? uBrace : uHex4 !== undefined ? uHex4 : xHex2;
      if (hex !== undefined) {
        try {
          return String.fromCodePoint(parseInt(hex, 16));
        } catch {
          return whole;
        }
      }
      if (octal !== undefined) {
        try {
          return String.fromCodePoint(parseInt(octal, 8));
        } catch {
          return whole;
        }
      }
      if (other === "n" || other === "t" || other === "r" || other === "f" || other === "v") return " ";
      return other;
    }
  );
}

// يفكّ مراجعَ محارف HTML (العدديّة والاسميّة الشائعة)، أسوةً بالفكّ نفسِه في
// check-no-approval-claims.js وcheck-robots-and-indexing.js: قيمةُ سمةٍ مثل
// src="medien/&#109;issing.mp3" يراها المتصفّحُ "medien/missing.mp3"
// فعليّاً، لا النصَّ الحرفيَّ غيرَ المفكوك — وMEDIA_REF لا يطابق "&" أصلاً،
// فمسارٌ مكسورٌ بهذا الشكل كان يُفلت من الفحص كلّيّاً بدل أن يُبلَّغ مفقوداً
// (ملاحظة Codex). يقتصر هذا الفكّ على ملفّات .html حصراً (أسوةً بقصر فكّ
// تهريبات JS على .js وحدها أدناه)، لا تعميمَه على كلّ نصّ .js: مسارٌ مبنيٌّ
// كسلسلة JS عاديّةٍ ويُسنَد إلى خاصّيةٍ كـ.src مباشرةً (لا يُدرَج عبر
// innerHTML) لا يمرّ بفكّ محارف HTML إطلاقاً وقت التشغيل، فمرجعُ محرفٍ
// حرفيٌّ فيه (كـ"amina&#45;00.mp3" الناتج من esc() مثلاً) يبقى جزءاً
// حرفيّاً من الرابط الفعليّ المطلوب؛ فكُّه هنا كان يُطابقه خطأً بمسارٍ
// موجودٍ فيُخفي مساراً مكسوراً فعليّاً من نوعٍ آخر (ملاحظة Codex الثانية).
// الجدولُ الأصليّ اقتصر على ستّة أسماءَ شائعة، فلم يفكّ مراجعَ اسميّةً
// معياريّةً أخرى (كـ"&sol;" لـ"/" — حرفٌ يلزم MEDIA_REF نفسَها لمطابقة
// "medien/" أصلاً)، فمسارٌ يستبدل "/" بـ"&sol;" كان يُفلت من الفحص كلّيّاً
// (ملاحظة Codex). معيار HTML5 يعرّف أكثرَ من ٢٠٠٠ مرجعٍ اسميٍّ (أغلبُها
// تكرارٌ بصيغٍ قديمةٍ لتوافق متصفّحاتٍ سابقة)؛ تضمينُها كلَّها هنا حرفيّاً
// خارج نطاق حارسٍ نصّيٍّ بلا اعتماديّاتٍ خارجيّة. بدلاً من ذلك: مجموعةُ
// Latin-1 الكاملة من معيار HTML4 (٩٦ مرجعاً، ٠xA0–٠xFF بالترتيب — تغطّي كلّ
// الحروف اللاتينيّة المشكَّلة الشائعة في المحتوى الألمانيّ) مبنيّةٌ
// برمجيّاً من قائمة الأسماء القياسيّة الثابتة، زائداً مراجعُ الفراغ/الفاصل
// البنيويّة التي أظهرها مثالُ Codex ("sol" لـ"/"، "Tab"/"NewLine" لفراغٍ)،
// زائداً مجموعةٌ من العلامات الطباعيّة الشائعة في النثر. هذا يغطّي كلَّ
// حالةٍ واقعيّةٍ محتملةٍ في محتوًى حقيقيٍّ دون حمل الجدول الكامل غيرِ
// العمليّ؛ مرجعٌ اسميٌّ نادرٌ جدّاً خارج هذه المجموعة يبقى محتمَلاً نظريّاً،
// وهذا تضييقٌ نطاقيٌّ مقصودٌ موثَّقٌ هنا، لا سهواً.
const LATIN1_ENTITY_NAMES = (
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr " +
  "deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest " +
  "Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml " +
  "ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig " +
  "agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml " +
  "eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml"
).split(" ");
const HTML_NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
LATIN1_ENTITY_NAMES.forEach((name, i) => {
  HTML_NAMED_ENTITIES[name] = String.fromCharCode(0xa0 + i);
});
Object.assign(HTML_NAMED_ENTITIES, {
  sol: "/", Tab: "\t", NewLine: "\n",
  mdash: "—", ndash: "–", hellip: "…", trade: "™", bull: "•",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
});
function decodeHtmlEntities(text) {
  return text.replace(/&(#[xX][0-9a-fA-F]+;?|#\d+;?|[a-zA-Z]+;)/g, (whole, ref) => {
    if (ref[0] === "#") {
      const digits = ref.replace(/;$/, "");
      const codePoint = digits[1] === "x" || digits[1] === "X" ? parseInt(digits.slice(2), 16) : parseInt(digits.slice(1), 10);
      if (Number.isNaN(codePoint)) return whole;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return whole;
      }
    }
    const name = ref.slice(0, -1);
    return Object.prototype.hasOwnProperty.call(HTML_NAMED_ENTITIES, name) ? HTML_NAMED_ENTITIES[name] : whole;
  });
}
// <script>/<style> ليسا سياقَ HTML نصّيّاً بمعيار HTML5 (RCDATA/raw text)،
// فمرجعُ محرفٍ حرفيٌّ داخلهما (كـ"medien/amina&#45;00.mp3" في new
// Audio(...)) لا يفكّه المتصفّحُ إطلاقاً؛ فكُّه هنا كان يحوّل الطلبَ
// الحرفيَّ المكسورَ إلى مسارٍ موجودٍ خطأً فيُخفي كسراً فعليّاً (ملاحظة
// Codex). النمطُ نفسُه المستخدَم لإسقاط هذا المحتوى في
// check-robots-and-indexing.js.
const RAW_TEXT_ELEMENT_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
function decodeHtmlEntitiesOutsideRawText(text) {
  let result = "";
  let lastIndex = 0;
  let m;
  RAW_TEXT_ELEMENT_RE.lastIndex = 0;
  while ((m = RAW_TEXT_ELEMENT_RE.exec(text))) {
    result += decodeHtmlEntities(text.slice(lastIndex, m.index)) + m[0];
    lastIndex = RAW_TEXT_ELEMENT_RE.lastIndex;
  }
  return result + decodeHtmlEntities(text.slice(lastIndex));
}

const referenced = new Set();
for (const file of SOURCE_FILES) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  // فكُّ تهريبات سلاسل JS معنيٌّ بملفّات .js حصراً: "\" ليست محرفَ تهريبٍ في
  // نصّ HTML أصلاً (لا في قيمة سمةٍ ولا في نصٍّ عاديّ)، فقيمةُ سمةٍ حرفيّةٌ
  // مثل src="medien/amina-00.mp3" في ملفّ .html تطلب هذا المسارَ
  // الحرفيَّ بعينه (بالشرطة المائلة العكسيّة وحروف a كما هي)، لا
  // "medien/amina-00.mp3" — ولو صادف أنّ فكَّها هنا ينتج مساراً موجوداً
  // فعلاً على القرص، فذلك يُخفي مساراً حقيقيّاً مكسوراً عن هذا الفحص
  // (ملاحظة Codex). تطبيقُ الفكّ على .html كما على .js كان يفوّت هذه الحالة.
  const jsUnescaped = file.endsWith(".js") ? unescapeJsStringEscapes(raw) : raw;
  const text = file.endsWith(".html") ? decodeHtmlEntitiesOutsideRawText(jsUnescaped) : jsUnescaped;
  const matches = text.match(MEDIA_REF) || [];
  for (const m of matches) referenced.add(decodePercentEscapes(stripTrailingSentencePunct(m)));
}

const missingOnDisk = [];
const missingFromPaket = [];
for (const ref of referenced) {
  if (!fs.existsSync(path.join(ROOT, ref))) missingOnDisk.push(ref);
  if (!listed.has(ref)) missingFromPaket.push(ref);
}

if (missingOnDisk.length || missingFromPaket.length) {
  if (missingOnDisk.length) {
    console.error("مساراتُ وسائط مذكورةٌ في الكود ولا وجودَ لها في المستودع:");
    missingOnDisk.forEach((m) => console.error("  " + m));
  }
  if (missingFromPaket.length) {
    console.error("مساراتُ وسائط مذكورةٌ في الكود وغيرُ مُدرجةٍ في PAKET.json:");
    missingFromPaket.forEach((m) => console.error("  " + m));
  }
  process.exit(1);
}

console.log(`تحقّقتُ من ${referenced.size} مسار وسائط — كلُّها موجودةٌ ومُدرجة.`);
