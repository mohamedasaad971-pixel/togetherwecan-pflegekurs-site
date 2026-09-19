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
// - "\" متبوعةً بأيّ فاصل أسطرٍ تعترف به ECMAScript فعليّاً — LF، أو CRLF، أو
//   U+2028 (Line Separator)، أو U+2029 (Paragraph Separator)، لا "\n"/"\r\n"
//   فقط — هي استمرارُ سطرٍ (line continuation): يُسقطه JS كلَّه (الـ"\"
//   وفاصلَ الأسطر معاً) بلا أثرٍ، لا مسافةً ولا حرفاً — فتصير الفراغُ الوحيدُ
//   بين الكلمتين هو ما كان موجوداً فعلاً في السلسلة قبل موضع الاستمرار
//   (ملاحظة Codex الثالثة، ووسّعتُها لاحقاً لتشمل U+2028/U+2029 أيضاً بملاحظةٍ
//   تالية). يُفقَد عدُّ رقم السطر لهذا الموضع تحديداً (تقريرُ الخطأ يبقى
//   تقريبيّاً هنا، لا أدقّ ممكن).
// - "\n"/"\t"/"\r"/"\f"/"\v" (محارفُ تباعدٍ مهرَّبةٌ *حرفيّاً*، لا استمرارَ
//   سطرٍ) تُصيَّر كلُّها مسافةً — كما يراها المتصفّحُ فعلاً — لا حرفاً حرفيّاً
//   يُلصق كلمتين (ملاحظة Codex؛ أُضيفت "\f" بملاحظةٍ لاحقة، و"\v" معها
//   استباقاً لنفس الفئة).
// - "\uNNNN"، "\u{...}"، و"\xNN" (مراجعُ يونيكود/سداسيّةٌ) تُفكّ إلى المحرف
//   الفعليّ الذي تمثّله، لا نصّها الحرفيّ — وإلّا أمكن تهريبُ الادّعاء بأكمله
//   حرفاً حرفاً (ملاحظة Codex الثانية). مرجعٌ غيرُ صالحٍ (نقطةُ ترميزٍ خارج
//   المدى) يبقى كما هو بلا فكٍّ بدل رمي استثناء.
// - مرجعٌ ثُمانيٌّ قديمٌ (Annex B legacy octal escape، كـ"\040" للمسافة) في
//   نصٍّ غيرِ صارمٍ (بلا "use strict") يُفكّ إلى المحرف الفعليّ أيضاً، أسوةً
//   بالمراجع السداسيّة/اليونيكوديّة أعلاه، لا بإسقاط الـ"\" وترك الأرقام
//   حرفيّةً ملتصقةً بالكلمة المجاورة (ملاحظة Codex): رقمٌ أوّلُ من 0-3 يقبل
//   حتى رقمَين ثُمانيَّين إضافيَّين، ورقمٌ أوّلُ من 4-7 يقبل رقماً واحداً فقط
//   إضافيّاً — طبقاً لقواعد ECMAScript لهذا النوع من المراجع. "\8"/"\9" ليسا
//   ثُمانيَّين أصلاً (يبقيان كما هما عبر فرع "أيّ تهريبٍ آخر" أدناه).
// - "\""/"\'" تصيران محرفَ الاقتباس نفسَه (فيتطابق شكلا الاقتباس بين app.js
//   غيرِ المهرَّب وui-de.js/ui-en.js المهرَّبين كمفاتيح قاموس).
// - أيّ تهريبٍ آخر (\\، \/، ...) يُسقَط الـ"\" منه فقط ويبقى المحرفُ كما هو،
//   وهو السلوكُ الآمن الافتراضيّ لأيّ تهريبٍ لا يغيّر المعنى البصريّ هنا.
// U+2028 وU+2029 مبنيان من رمز محرفهما العددي (String.fromCharCode) لا
// كتابةً حرفيةً مباشرة: الكتابةُ الحرفيّةُ لأيّهما داخل نصّ مصدر جافاسكربت
// (بما فيه هذا الملفّ) تُعامَل فاصلَ سطرٍ فعليّاً فتكسر الحرفيّةَ النمطيّةَ
// (regex literal) — نفسُ الالتباس الذي يعالجه هذا التعبيرُ نفسه في الملفّات
// المفحوصة.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
// "\r?\n" وحدها كانت تفوّت CR منفردةً (بلا LF تاليةٍ): فاصلُ سطرٍ صالحٌ
// بمعيار ECMAScript أيضاً (LineTerminatorSequence)، مثل LF وCRLF وLS وPS
// (ملاحظة Codex). "\r\n" تُطابَق أوّلاً ككتلةٍ واحدةٍ (بديلٌ أوّل)، فلا
// تُستهلَك الـ"\r" وحدَها تاركةً الـ"\n" التالية بلا استيعاب؛ CR منفردةٌ (لا
// LF بعدها) أو LF منفردةٌ أو LS أو PS تُطابَق عبر صنف المحارف التالي.
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

// يفكّ مراجعَ محارف HTML (العدديّة، ومرجعٌ اسميٌّ شائعٌ)، أسوةً بـ
// check-robots-and-indexing.js: نصٌّ منشورٌ مثل "appr&#111;ved" يراه
// المتصفّحُ "approved" فعليّاً، لا النصَّ الحرفيَّ غيرَ المفكوك (ملاحظة
// Codex). المرجعُ العدديّ لا يلزمه ";" بمعيار HTML5.
// الجدولُ الأصليّ اقتصر على ستّة أسماءَ شائعة، فلم يفكّ مراجعَ اسميّةً
// معياريّةً أخرى (كـ"&Tab;" لفراغ، يُستخدَم فاصلاً بين كلمتَي ادّعاءٍ في
// نمط المطابقة)، فادّعاءٌ مثل "clinically&Tab;approved" كان يُفلت من
// الفحص (ملاحظة Codex؛ نفس الثغرة في الجدول المطابق تماماً في
// check-media-paths.js). معيار HTML5 يعرّف أكثرَ من ٢٠٠٠ مرجعٍ اسميٍّ
// (أغلبُها تكرارٌ بصيغٍ قديمةٍ لتوافق متصفّحاتٍ سابقة)؛ تضمينُها كلَّها هنا
// حرفيّاً خارج نطاق حارسٍ نصّيٍّ بلا اعتماديّاتٍ خارجيّة. بدلاً من ذلك:
// مجموعةُ Latin-1 الكاملة من معيار HTML4 (٩٦ مرجعاً، ٠xA0–٠xFF بالترتيب)
// مبنيّةٌ برمجيّاً من قائمة الأسماء القياسيّة الثابتة (نفسُها المستخدَمة في
// check-media-paths.js)، زائداً مراجعُ الفراغ البنيويّة التي أظهرها مثالُ
// Codex، زائداً علاماتٌ طباعيّةٌ شائعة. تضييقٌ نطاقيٌّ مقصودٌ موثَّقٌ هنا،
// لا سهواً؛ مرجعٌ اسميٌّ نادرٌ جدّاً خارج هذه المجموعة يبقى محتمَلاً نظريّاً.
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
  // ";" اختياريّةٌ بعد الصيغتَين العدديّتين، ويجب أن يلتقطها النمطُ نفسُه حين
  // تكون موجودةً — وإلّا بقيت معلَّقةً حرفيّاً في الناتج (كـ"appro;ved" بدل
  // "approved").
  // "X" مقبولةٌ أيضاً بديلاً عن "x" في مرجعٍ سداسيّ عشريّ بمعيار HTML5،
  // أسوةً بنفس الإصلاح في check-robots-and-indexing.js (ملاحظة Codex).
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

// يطبّع الملفَّ كلَّه دفعةً واحدة (لا سطراً سطراً)، فتلتقط العبارةُ حتّى لو
// قسمها التفافُ HTML بين سطرين، مع بقاء خريطةٍ لرقم السطر الأصليّ لكلّ حرفٍ
// في الناتج، ليبقى تقرير الخطأ مفيداً.
function normalizeWithLineMap(raw) {
  let normalized = "";
  const lineOfIndex = [];
  let line = 1;
  let inWhitespaceRun = false;
  for (const ch of decodeHtmlEntities(unescapeJsStringEscapes(raw))) {
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
// وسمُ HTML ضمنيٌّ (كـ"<strong>") لا يغيّر ما يراه المستخدم فعليّاً — لا بين
// كلمتَي الادّعاء، ولا داخل كلمةٍ واحدةٍ ("clini<strong>cally</strong>
// approved" تُعرَض "clinically approved" متّصلةً)، ولا حتى وسومٌ متعدّدةٌ
// متتاليةٌ بين نفس الحرفَين (كـ"clini<strong><em>cally</em></strong>") —
// لأنّ الوسمَ نفسَه عديمُ العرض (zero-width) في الصفحة المعروضة. محاولةٌ
// أولى بتحمّل وسمٍ واحدٍ اختياريٍّ بين كلّ حرفَين عبر regex (تحمّلُ "؟" ثمّ
// تُوسِّعُه "*" لعدّة وسومٍ) أثبتت هشاشتَها: توسيعُها إلى "*" سبّب تراجعاً
// عكسيّاً (catastrophic backtracking) فعليّاً على الملفّات الحقيقيّة —
// "ا"/"م" حرفان شائعان جدّاً في العربيّة، وكلُّ ظهورٍ لهما يبدأ محاولةَ
// مطابقةٍ تتفرّع عبر كلّ توليفةٍ ممكنةٍ لتوزيع الوسوم المجاورة قبل أن تفشل.
// البديلُ الآمن هنا: إزالة كلّ الوسوم من النصّ المُطبَّع دفعةً واحدةً (بحثٌ
// عامٌّ خطّيٌّ بنمط TAG_GAP نفسِه، لا تكراراً متداخلاً به)، ثمّ مطابقةُ
// العبارة المحظورة حرفيّاً على النصّ الخالي من الوسوم — فلا حاجةَ بعدها لأيّ
// تحمّلٍ للوسوم داخل نمط العبارة نفسِه، ولا خطرَ تراجعٍ عكسيّ.
// TAG_GAP نفسُها لا تتوقّف عند أوّل ">" فقط: قيمةُ سمةٍ مقتبسةٌ داخل الوسم
// قد تحمل ">" حرفيّةً (كـ<strong title="a > b">)، فتقطع الوسمَ قبل إغلاقه
// الفعليّ وتُفلت الادّعاءَ من جديد (ملاحظة Codex) — نفس الأسلوب المستخدَم
// لالتقاط <meta> في check-robots-and-indexing.js.
// فرعُ الاحتياط [^<>] يستبعد "\"" و"'" أيضاً، لا "<" و">" فقط: بدونهما يبقى
// أيّ محرف اقتباسٍ مقبولاً عبر بديلَين معاً — بديل الاقتباس نفسه، وبديل
// الاحتياط (الذي لا يستبعد الاقتباس) — فوسمٌ غيرُ مغلَقٍ يحوي اقتباساتٍ
// كثيرةً بلا ">" يفتح عدداً أُسّيّاً من توزيعاتٍ ممكنةٍ بين البديلَين قبل أن
// يفشل تماماً كالتراجع العكسيّ الذي عولج أعلاه (مثالُ Codex: "<" متبوعةً
// بعشرات التكرارات لـ'"a' بلا ">" مغلقة). استبعادُ الاقتباس من فرع الاحتياط
// يجعل البديلَين متنافيَين (أيّ اقتباسٍ يُحسم حصراً عبر بديل الاقتباس)، فلا
// توزيعاتٍ بديلةٌ للتراجع عبرها؛ لا يغيّر هذا أيَّ وسمٍ صالحٍ يُطابَق فعليّاً،
// إذ الاقتباس داخل وسمٍ سليمٍ يقع دائماً ضمن قيمة سمةٍ مقتبسة.
const TAG_GAP = "<(?:\"[^\"]*\"|'[^']*'|[^<>\"'])*>";

// يزيل كلَّ وسمٍ مطابقٍ لـTAG_GAP من normalized عبر بحثٍ عامٍّ خطّيٍّ واحد
// (لا تكراراً متداخلاً بداخل نمط عبارةٍ أطول، وهو ما سبّب التراجعَ العكسيّ
// أعلاه)، مع خريطةٍ تُعيد كلَّ فهرسٍ في النصّ الناتج (stripped) إلى فهرسه
// الأصليّ في normalized — يلزم ذلك لاحقاً لتحديد رقم السطر عبر lineOfIndex،
// ولفحص ALLOWED_EXACT_FRAGMENTS الذي يحتاج الوسومَ المحيطةَ كما هي في
// normalized.
// وسومٌ ذاتُ فاصلٍ بصريٍّ فعليٍّ في العرض (سطرٌ جديدٌ أو حدُّ كتلة)، بخلاف
// وسوم التنسيق الداخليّ الشفّافة (كـ<strong>/<em>) التي لا تُغيّر تدفّق
// النصّ أصلاً: إسقاطُ هذه الوسوم بلا أثرٍ (كبقيّة الوسوم) كان يُلصق كلمتَين
// منفصلتَين بصريّاً (كـ"clinically<br>approved"، تُعرَض في سطرَين) في كلمةٍ
// واحدةٍ ("clinicallyapproved")، فتُفلت من مطابقة العبارة رغم ظهورها
// للمستخدم مفصولةً (ملاحظة Codex). القائمةُ عناصرُ HTML القياسيّة ذاتُ
// العرض الكتليّ أو الفاصل السطريّ، لا كلَّ وسمٍ محتمَل.
// القائمةُ عناصرُ HTML5 الكتليّةُ/القطاعيّةُ/التجميعيّةُ القياسيّة كلُّها،
// لا مجموعةً جزئيّةً مختارةً بحسب المثال فقط: نسيان عنصرٍ كتليٍّ حقيقيٍّ
// (كـ<main>/<aside> في المثال الذي ذكره Codex) يُبقي نفسَ فئة الثغرة قائمةً
// لعنصرٍ آخر لم يُختبَر بعد.
const BLOCK_SEPARATOR_TAGS = new Set([
  "br", "p", "div", "li", "ul", "ol", "dl", "dt", "dd", "tr", "td", "th",
  "table", "thead", "tbody", "tfoot", "caption", "colgroup",
  "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "aside", "nav",
  "header", "footer", "main", "figure", "figcaption", "form", "fieldset",
  "legend", "address", "details", "summary", "dialog", "menu",
  "blockquote", "pre", "hr",
]);
function tagName(tagText) {
  const m = tagText.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/);
  return m ? m[1].toLowerCase() : "";
}
function stripTagsWithMap(normalized) {
  const strippedChars = [];
  const indexMap = [];
  const tagRe = new RegExp(TAG_GAP, "g");
  let lastIndex = 0;
  let m;
  while ((m = tagRe.exec(normalized))) {
    for (let i = lastIndex; i < m.index; i++) {
      strippedChars.push(normalized[i]);
      indexMap.push(i);
    }
    if (BLOCK_SEPARATOR_TAGS.has(tagName(m[0]))) {
      // مسافةٌ واحدةٌ بديلاً عن الوسم، لا أكثر: التطابقُ لاحقاً يستخدم \s+
      // فيتحمّل أيّ عددٍ من المسافات المتتالية (كـ"clinically" + مسافةُ
      // الوسم + مسافةٌ حقيقيّةٌ مجاورةٌ في المصدر).
      strippedChars.push(" ");
      indexMap.push(m.index);
    }
    lastIndex = tagRe.lastIndex;
  }
  for (let i = lastIndex; i < normalized.length; i++) {
    strippedChars.push(normalized[i]);
    indexMap.push(i);
  }
  return { stripped: strippedChars.join(""), indexMap };
}

function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// الإنجليزيّة/الألمانيّة بفاصلٍ [\s-]+ لا مسافةٍ حرفيّةٍ وحدها: الصيغةُ
// الموصولة بشرطةٍ ("clinically-approved") ادّعاءٌ بنفس المعنى، ولم تكن
// السلاسلُ الحرفيّةُ السابقةُ (مطابَقةٌ بـindexOf) تكتشفها (ملاحظة Codex).
const ARABIC_ROOT = "عتمد";
const COMBINED_CLAIM = new RegExp(`(?:ا|م)${ARABIC_ROOT}[ة]?\\s+${escapeRegExp("سريريا")}`);
const BANNED_PHRASES = [
  COMBINED_CLAIM,
  new RegExp(`(?:ا|م)${ARABIC_ROOT}[ة]?\\s+${escapeRegExp("طبيا")}`),
  new RegExp(`${escapeRegExp("clinically")}[\\s-]+${escapeRegExp("approved")}`),
  new RegExp(`${escapeRegExp("klinisch")}[\\s-]+${escapeRegExp("freigegeben")}`),
  new RegExp(`${escapeRegExp("medically")}[\\s-]+${escapeRegExp("approved")}`),
  new RegExp(`${escapeRegExp("medizinisch")}[\\s-]+${escapeRegExp("freigegeben")}`),
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
  const { stripped, indexMap } = stripTagsWithMap(normalized);
  for (const phrase of BANNED_PHRASES) {
    for (const strippedIdx of findMatchIndices(stripped, phrase)) {
      const idx = indexMap[strippedIdx];
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
