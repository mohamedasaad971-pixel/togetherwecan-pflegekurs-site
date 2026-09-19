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

// يستخرج محتوى السلاسل الحرفيّة والتعليقات فقط من كودٍ جافاسكربتيٍّ خامّ،
// ويُسقط كودَ البرنامج الفعليَّ بينها (يُبقي فواصلَ أسطره فقط لتبقى أرقامُ
// الأسطر في تقارير الأخطاء مطابقةً للملفّ الأصليّ). عبارةُ ادّعاءٍ متعدّدةُ
// الكلمات لا يمكن أن تختبئ إلا داخل سلسلةٍ حرفيّةٍ أو تعليق — لا داخل
// معرّفاتٍ أو عوامل مقارنةٍ كـ"<"/">" — فإسقاطُ الكود الخامّ بينها لا يفوّت
// أيّ ادّعاءٍ ممكن، ويزيل جذرَ مشكلةٍ لا حلَّ نمطيّاً موثوقاً لها: التمييزُ
// بين "<" عاملَ مقارنةٍ و"<" بدايةَ وسم HTML بأيّ حدٍّ نمطيٍّ (حرفٌ يلي "<"
// أم لا) يفشل حتماً أمام كودٍ مضغوطٍ بلا مسافات (كـ"i<n" أو "a<b)" — حرفٌ
// واحدٌ متغيّرٌ شائعٌ يقع مباشرةً بعد "<"، فيُعامَل وسماً هائلاً يمتدّ حتى
// أوّل ">" تالية ويُسقط كلَّ ما بينهما — بما فيه ادّعاءٌ حقيقيٌّ في سلسلةٍ
// حرفيّةٍ بين عاملَي المقارنة (ملاحظة Codex، جولتان: أوّلاً بمسافاتٍ حول
// العامل، ثمّ بكودٍ مضغوطٍ بلا مسافات — تضييقُ نمط TAG_GAP وحده لا يكفي
// أبداً لحسم هذا اللَبس، إذ حروفٌ قصيرةٌ كـ"b" أسماءُ وسومٍ حقيقيّةٌ أيضاً
// (Bold) فلا يفيد حتى تقييدُها بقائمة أسماء وسومٍ معروفة).
// يجب تمييزُ "/" حرفيّةً نمطيّةً (regex literal، كـ`/"/ `) عن "/" عاملَ
// قسمةٍ: محاولةٌ أولى أهملت هذا الفرقَ فأصابت خللاً حقيقيّاً — انتظرتُ محارف
// اقتباسٍ داخل حرفيّةٍ نمطيّةٍ (كـ`.replace(/"/g, "&quot;")` في app.js
// الفعليّ) كأنّها بدايةُ سلسلةٍ حقيقيّة، فبحثت عن إغلاقٍ بعيدٍ ووجدَتْه في
// اقتباس سلسلةٍ حقيقيّةٍ تالية، فاختلّت حالةُ التتبّع لبقيّة الملفّ كلِّه
// من تلك النقطة (اكتُشف بالتحقّق الذاتيّ على الملفّات الحقيقيّة، لا
// بملاحظة Codex). جافاسكربت نفسُها تحسم هذا بالسياق النحويّ الكامل (موضعُ
// تعبيرٍ أم قيمة)؛ هنا نستخدم تخميناً عمليّاً شائعاً في الماسحات الخفيفة:
// "/" تبدأ حرفيّةً نمطيّةً إن سبقها (بعد تجاهل الفراغ) أحدُ محارف "لا يمكن
// أن يتبعها قسمةٌ" (فاتحةُ قوسٍ، فاصلةٌ، عاملٌ، ...) أو كلمةٌ مفتاحيّةٌ من
// هذا النوع (return/typeof/...)، أو بداية الملفّ — غيرَ ذلك (بعد معرّفٍ أو
// رقمٍ أو قوسٍ مغلَقٍ) فهي قسمةٌ عاديّة. هذا تخمينٌ لا تحليلٌ نحويٌّ كامل،
// لكنّه يكفي لأنماط الكود الحقيقيّة الشائعة، ويمنع الخللَ الحرجَ أعلاه —
// أسوأ أثرٍ متبقٍّ لتخمينٍ خاطئٍ نادر هو تفويتُ جزءٍ من نصٍّ لا اختلالُ
// تتبّعٍ يمتدّ للملفّ كلِّه (فالمسارُ الخاطئ الوحيدُ الخطِر — معاملةُ حرفيّةٍ
// نمطيّةٍ سلسلةً — أُغلق بمعالجة الحرفيّة النمطيّة صراحةً بدل تركها للمسار
// الافتراضيّ).
const REGEX_PRECEDER_CHAR = /[(,=:!&|?{}[;+\-*/%^~<>\n]/;
const REGEX_PRECEDER_KEYWORD = /^(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;
function looksLikeRegexStart(raw, i) {
  let k = i - 1;
  while (k >= 0 && /\s/.test(raw[k])) k--;
  if (k < 0) return true;
  if (REGEX_PRECEDER_CHAR.test(raw[k])) return true;
  let wordStart = k + 1;
  while (wordStart > 0 && /[a-zA-Z_$]/.test(raw[wordStart - 1])) wordStart--;
  return REGEX_PRECEDER_KEYWORD.test(raw.slice(wordStart, k + 1));
}
// تتخطّى حرفيّةً نمطيّةً كاملةً (بدايتُها raw[i] === "/") حتّى إغلاقها،
// متجاهلةً محارف الاقتباس داخلها تماماً — فلا تُعامَل بدايةَ سلسلةٍ أبداً.
// "/" داخل صنف محارفَ ([...]) لا تُغلق الحرفيّةَ (بمعيار ECMAScript)، ولا
// نتبع الحرفيّةَ عبر سطرٍ جديدٍ (غيرُ صالحةٍ نحويّاً بلا "\": توقّفٌ آمنٌ).
function skipRegexLiteral(raw, i, n) {
  let j = i + 1;
  let inClass = false;
  while (j < n) {
    const c = raw[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === "\n") break;
    if (c === "[") {
      inClass = true;
      j++;
      continue;
    }
    if (c === "]") {
      inClass = false;
      j++;
      continue;
    }
    if (c === "/" && !inClass) {
      j++;
      break;
    }
    j++;
  }
  while (j < n && /[a-zA-Z]/.test(raw[j])) j++;
  return j;
}
function extractJsStringsAndComments(raw) {
  let result = "";
  let i = 0;
  const n = raw.length;
  let spanStart = 0;
  function flushSkippedNewlines(uptoIndex) {
    for (let k = spanStart; k < uptoIndex; k++) {
      if (raw[k] === "\n") result += "\n";
    }
  }
  while (i < n) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (ch === "/" && next === "/") {
      flushSkippedNewlines(i);
      let j = i + 2;
      while (j < n && raw[j] !== "\n") j++;
      result += raw.slice(i, j);
      i = j;
      spanStart = i;
    } else if (ch === "/" && next === "*") {
      flushSkippedNewlines(i);
      const end = raw.indexOf("*/", i + 2);
      const j = end === -1 ? n : end + 2;
      result += raw.slice(i, j);
      i = j;
      spanStart = i;
    } else if (ch === "/" && looksLikeRegexStart(raw, i)) {
      flushSkippedNewlines(i);
      i = skipRegexLiteral(raw, i, n);
      spanStart = i;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      flushSkippedNewlines(i);
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (raw[j] === "\\") {
          j += 2;
          continue;
        }
        if (raw[j] === quote) {
          j++;
          break;
        }
        j++;
      }
      j = Math.min(j, n);
      result += raw.slice(i, j);
      i = j;
      spanStart = i;
    } else {
      i++;
    }
  }
  flushSkippedNewlines(n);
  return result;
}
// نفسُ الاستخلاص أعلاه، مطبَّقٌ على محتوى كلّ <script> داخل ملفّ .html:
// كودُ <script> جافاسكربتٌ فعليٌّ يحمل نفس اللَبس بين "<"/">" مقارنةً أم
// وسماً، فيلزمه نفسُ المعالجة، لا الفحصَ المباشر كبقيّة نصّ HTML المحيط
// به (الذي يبقى يُفحص كاملاً كما هو، فهو سياقُ HTML حقيقيٌّ بالفعل).
function extractJsFromHtmlScripts(html) {
  return html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi, (whole, openTag, code, closeTag) => {
    return openTag + extractJsStringsAndComments(code) + closeTag;
  });
}

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
// ";" اختياريّةٌ بعد الصيغتَين العدديّتين، ويجب أن يلتقطها النمطُ نفسُه حين
// تكون موجودةً — وإلّا بقيت معلَّقةً حرفيّاً في الناتج (كـ"appro;ved" بدل
// "approved").
// "X" مقبولةٌ أيضاً بديلاً عن "x" في مرجعٍ سداسيّ عشريّ بمعيار HTML5،
// أسوةً بنفس الإصلاح في check-robots-and-indexing.js (ملاحظة Codex).
const ENTITY_RE = /&(#[xX][0-9a-fA-F]+;?|#\d+;?|[a-zA-Z]+;)/g;
// المراجعُ الاسميّةُ حسّاسةٌ لحالة الأحرف بمعيار HTML5 ("&Tab;" مرجعٌ صالحٌ،
// "&tab;" ليس كذلك — يبقى حرفيّاً كما هو ولا يُفكّ). محاولةٌ أولى بحثت
// بمفتاحٍ مُصغَّرٍ (لأنّ normalizeWithLineMap كان يُصغِّر كلَّ النصّ قبل
// وصوله هنا) كانت تُحسم كلَّ مطابقةٍ بلا حساسيّةٍ لحالة الأحرف، فتُفكّ
// "&tab;" الحرفيّة كأنّها "&Tab;" الصالحة وتُفشل الفحصَ خطأً على نصٍّ
// يبقى فيه "&tab;" ظاهراً حرفيّاً فعلاً (ملاحظة Codex). الإصلاحُ الفعليّ في
// normalizeWithLineMap: مرجعُ محرفٍ محتملٌ (يطابق ENTITY_RE) يُنسَخ إلى
// normalized بحالة أحرفه الأصليّة كما هو، بمعزلٍ عن تصغير بقيّة النصّ من
// حوله — فيصل هنا بحالته الحقيقيّة، والمطابقةُ التالية حسّاسةٌ لحالة
// الأحرف كما يلزم.
function decodeEntityRef(ref) {
  let replacement;
  if (ref[0] === "#") {
    const digits = ref.replace(/;$/, "");
    const codePoint = digits[1] === "x" || digits[1] === "X" ? parseInt(digits.slice(2), 16) : parseInt(digits.slice(1), 10);
    if (Number.isNaN(codePoint)) return null;
    try {
      replacement = String.fromCodePoint(codePoint);
    } catch {
      return null;
    }
  } else {
    const name = ref.slice(0, -1);
    if (!Object.prototype.hasOwnProperty.call(HTML_NAMED_ENTITIES, name)) return null;
    replacement = HTML_NAMED_ENTITIES[name];
  }
  // ناتجُ الفكّ لم يمرّ بخطوتَي normalizeWithLineMap (تصغيرٌ، إسقاطُ تشكيل)
  // لأنّه لم يكن موجوداً بعدُ حين عملت عليه: مرجعٌ عدديٌّ قد يُعيد علامةَ
  // تشكيلٍ عربيّةً حرفيّاً (كـ"&#1614;" ← U+064E) لم يرَها فحصُ DIACRITIC
  // هناك أصلاً، فتُطبَّقان هنا الآن على الناتج المفكوك تحديداً (ملاحظة
  // Codex).
  let out = "";
  for (const ch of replacement) {
    if (DIACRITIC.test(ch)) continue;
    out += ch.toLowerCase();
  }
  return out;
}
// نفسُ فكّ المراجع أعلاه، لكن مع خريطةٍ تُعيد كلَّ فهرسٍ في الناتج المفكوك
// إلى فهرسه الأصليّ في النصّ الخامّ — تلزم عند فكّ المراجع بعد تحديد حدود
// السماتِ/الوسوم لا قبله (راجع التعليق أعلى stripTagsWithMap)، إذ يتغيّر
// طولُ النصّ عند الفكّ فيفسد التوافقَ المباشر بين الفهرسَين. الفهرسُ
// تقريبيٌّ فقط لمحارف مرجعٍ مفكوكٍ (بداية المرجع حرفيّاً)، لا الأصليّ
// حرفاً حرفاً، أسوةً بتقريب أرقام الأسطر المقبول أصلاً في هذا الملفّ عند
// أيّ تحويلٍ يغيّر الطول (استمرارُ سطرٍ، وسومٌ فاصلة...).
function decodeHtmlEntitiesWithIndexMap(text) {
  const decoded = [];
  const indexMap = [];
  let last = 0;
  const re = new RegExp(ENTITY_RE.source, "g");
  let m;
  while ((m = re.exec(text))) {
    for (let i = last; i < m.index; i++) {
      decoded.push(text[i]);
      indexMap.push(i);
    }
    const replacement = decodeEntityRef(m[1]) ?? m[0];
    for (const ch of replacement) {
      decoded.push(ch);
      indexMap.push(m.index);
    }
    last = re.lastIndex;
  }
  for (let i = last; i < text.length; i++) {
    decoded.push(text[i]);
    indexMap.push(i);
  }
  return { decoded: decoded.join(""), indexMap };
}

// يطبّع الملفَّ كلَّه دفعةً واحدة (لا سطراً سطراً)، فتلتقط العبارةُ حتّى لو
// قسمها التفافُ HTML بين سطرين، مع بقاء خريطةٍ لرقم السطر الأصليّ لكلّ حرفٍ
// في الناتج، ليبقى تقرير الخطأ مفيداً.
// فكُّ مراجع HTML لا يقع هنا: تقديمُه على تحديد حدود السماتِ/الوسوم (في
// stripTagsWithMap لاحقاً) قد يصنع بنيةً مزيَّفةً — قيمةُ سمةٍ حقيقيّةٍ
// واحدةٍ مثل data-note="&quot; title=&quot;clinically approved&quot;"
// تحمل سمةً واحدةً فقط (الاقتباساتُ الداخليّةُ نصٌّ حرفيٌّ، لا اقتباساتٍ
// بنيويّةً)، لكنّ فكَّ "&quot;" إلى '"' *قبل* تفكيك السمات يُنتج اقتباساتٍ
// حقيقيّةً مزيَّفةً يُخطئ التفكيكُ اللاحقُ فيقرأها سمةَ "title" منفصلةً
// وهميّة، فيُخفق الفحصُ على محتوًى آمنٍ فعليّاً (ملاحظة Codex). الفكُّ الآن
// يقع لاحقاً في stripTagsWithMap، بعد إيجاد الوسوم وتفكيك سماتها على النصّ
// الخامّ غير المفكوك، وعلى النصّ المستخرَج (قيمةُ سمةٍ، أو نصٌّ بين وسمَين)
// فقط لا على الوسم بأكمله.
// مرجعُ محرفٍ محتملٌ (يطابق ENTITY_RE بدءاً من "&") يُنسَخ إلى normalized
// بحالة أحرفه الأصليّة كما هو — لا يُصغَّر مع بقيّة النصّ — لأنّ الأسماءَ
// الاسميّةَ حسّاسةٌ لحالة الأحرف (فكٌّ لاحقٌ حسّاسٌ لحالة الأحرف يحتاج
// النصَّ الأصليَّ لا نسخةً مُصغَّرة؛ ملاحظة Codex، بعد أن أصلحتُ الجولةَ
// السابقةَ بتصغير المفتاح والمرجع معاً فأخفقت المطابقةَ بلا حساسيّةٍ لحالة
// الأحرف على مرجعٍ حرفيٍّ غيرِ صالحٍ كـ"&tab;").
function normalizeWithLineMap(raw) {
  const text = unescapeJsStringEscapes(raw);
  let normalized = "";
  const lineOfIndex = [];
  let line = 1;
  let inWhitespaceRun = false;
  const entityRe = new RegExp(ENTITY_RE.source, "y");
  let i = 0;
  while (i < text.length) {
    if (text[i] === "&") {
      entityRe.lastIndex = i;
      const m = entityRe.exec(text);
      if (m) {
        for (const ch of m[0]) {
          normalized += ch;
          lineOfIndex.push(line);
        }
        inWhitespaceRun = false;
        i += m[0].length;
        continue;
      }
    }
    const codePoint = text.codePointAt(i);
    const ch = String.fromCodePoint(codePoint);
    if (DIACRITIC.test(ch)) {
      i += ch.length;
      continue;
    }
    if (/\s/.test(ch)) {
      if (!inWhitespaceRun) {
        normalized += " ";
        lineOfIndex.push(line);
        inWhitespaceRun = true;
      }
      if (ch === "\n") line++;
      i += ch.length;
      continue;
    }
    inWhitespaceRun = false;
    normalized += ch.toLowerCase();
    lineOfIndex.push(line);
    i += ch.length;
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
// "<\/?[a-zA-Z][a-zA-Z0-9-]*" إلزاميّةٌ بعد "<" (لا فرعُ الاحتياط وحده): هذا
// الملفّ يفحص .js مباشرةً أيضاً، لا HTML فقط، وفيها "<"/">" عاملا مقارنةٍ
// شائعان جدّاً لا وسمَين. صيغةُ TAG_GAP السابقة (بلا اشتراط اسم وسمٍ) كانت
// تطابق أيَّ "<...>" حرفيّاً — فكودٌ عاديٌّ مثل "if (a < b) {} ...ادّعاءٌ
// فعليٌّ هنا... if (c > d) {}" يُعامَل وسماً واحداً هائلاً يمتدّ من أوّل "<"
// إلى أوّل ">" تالية، فيُحذف كلُّ ما بينهما — بما فيه ادّعاءٌ حقيقيٌّ — دون
// أن يصل مطابقةَ العبارة إطلاقاً (ملاحظة Codex: ثغرةٌ في كودٍ عاديٍّ غيرِ
// متعمَّدٍ، لا حالةً عدائيّةً فقط). اشتراطُ اسم وسمٍ حقيقيّ (حرفٌ فحروفٌ/
// أرقامٌ/شرطات) مباشرةً بعد "<" أو "</" يمنع "< b" (مسافةٌ لا حرفَ اسمٍ) من
// مطابقة TAG_GAP أصلاً، فتبقى المقارنةُ الحسابيّةُ محارفَ عاديّةً في النصّ
// المفحوص، بينما وسومٌ حقيقيّةٌ كـ"<br>"/"</strong>"/"<p class=x>" تبقى
// تُطابَق كما هي (اسمُ الوسم يقع دائماً مباشرةً بعد "<"/"</" بمعيار HTML5).
const TAG_GAP = "<\\/?[a-zA-Z][a-zA-Z0-9-]*(?:\"[^\"]*\"|'[^']*'|[^<>\"'])*>";

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
// إسقاطُ وسمٍ كاملٍ كان يُسقِط أيضاً نصَّ سماتٍ يراها المستخدمُ أو تقنيّةُ
// الإتاحة فعليّاً، لا الوسمَ المرئيَّ وحده — "<input value="معتمد سريريا">"
// ينشر القيمةَ ظاهرةً في الحقل، و"alt"/"title"/الوصفُ الإتاحيّ (aria-*)
// يُعلَنان بقارئ الشاشة أو يظهران تلميحاً — إسقاطُهما بلا فحصٍ كان يُفلت
// الادّعاءَ من المطابقة كلّيّاً رغم ظهوره فعليّاً (ملاحظة Codex). نستخرج
// قيمةَ كلّ سمةٍ نصّيّةٍ معروفةٍ من الوسم قبل إسقاطه، ونُدرجها في النصّ
// المطابَق (محاطةً بمسافتَين، كنصٍّ منفصلٍ لا كجزءٍ من تدفّق الكلمات
// المجاورة).
const TEXT_BEARING_ATTRS = new Set(["alt", "title", "value", "placeholder", "aria-label", "aria-description", "label"]);
// يفكّك الوسمَ إلى سماتٍ (اسمٌ ← قيمة) بالمرور عليه سمةً سمةً — كلُّ تكرارٍ
// يلتهم سمةً واحدةً كاملةً (اسمَها ثم قيمتَها المقتبسة أو غيرَ المقتبسة)
// قبل الانتقال إلى ما بعدها — بدل البحث عن اسم سمةٍ في أيّ موضعٍ من نصّ
// الوسم بتعبيرٍ نمطيٍّ مستقلٍّ لكلّ اسم: ذلك البحثُ المستقلُّ كان يجد نصَّ
// سمةٍ حقيقيّةٍ داخل قيمةٍ مقتبسةٍ لسمةٍ أخرى (كـ"title" داخل
// data-note=' title="clinically approved" ') ويُخفق الفحصَ خطأً على محتوًى
// آمنٍ فعليّاً — لا سمةَ title حقيقيّةً هناك أصلاً (ملاحظة Codex). نفسُ
// نمط ATTR_RE/parseTagAttrs المستخدَم أصلاً في check-robots-and-indexing.js
// لنفس السبب. النصُّ هنا مأخوذٌ من normalized (بعد normalizeWithLineMap)،
// وفراغاتُه كلُّها مسافاتٌ ASCII عاديّةٌ مُطبَّعةٌ بالفعل، فـ"\s" هنا كافٍ
// (لا حاجة لتقييد ASCII كما في check-robots-and-indexing.js التي تعمل على
// نصٍّ خامّ قد يحمل لامسافةً فاصلةً حرفيّاً).
const ATTR_TOKEN_RE = /([^\s"'=<>`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
function extractTextBearingAttrValues(tagText) {
  const inner = tagText.replace(/^<\/?[a-zA-Z][a-zA-Z0-9-]*/, "").replace(/>$/, "");
  const values = [];
  let m;
  ATTR_TOKEN_RE.lastIndex = 0;
  while ((m = ATTR_TOKEN_RE.exec(inner))) {
    if (!TEXT_BEARING_ATTRS.has(m[1].toLowerCase())) continue;
    values.push(m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : "");
  }
  return values;
}
// يدفع نصّاً بين-الوسوم إلى strippedChars بعد فكّ مراجع HTML فيه، مع
// خريطة فهارسَ تُعيده إلى موضعه في normalized (راجع تعليق
// decodeHtmlEntitiesWithIndexMap وnormalizeWithLineMap لسبب تأخير الفكّ
// إلى هنا تحديداً، بعد تحديد حدود الوسوم لا قبله).
function pushDecodedText(strippedChars, indexMap, text, baseIndex) {
  const { decoded, indexMap: chunkMap } = decodeHtmlEntitiesWithIndexMap(text);
  for (let k = 0; k < decoded.length; k++) {
    strippedChars.push(decoded[k]);
    indexMap.push(baseIndex + chunkMap[k]);
  }
}
function stripTagsWithMap(normalized) {
  const strippedChars = [];
  const indexMap = [];
  const tagRe = new RegExp(TAG_GAP, "g");
  let lastIndex = 0;
  let m;
  while ((m = tagRe.exec(normalized))) {
    pushDecodedText(strippedChars, indexMap, normalized.slice(lastIndex, m.index), lastIndex);
    for (const attrValue of extractTextBearingAttrValues(m[0])) {
      strippedChars.push(" ");
      indexMap.push(m.index);
      pushDecodedText(strippedChars, indexMap, attrValue, m.index);
      strippedChars.push(" ");
      indexMap.push(m.index);
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
  pushDecodedText(strippedChars, indexMap, normalized.slice(lastIndex), lastIndex);
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
  const scanned = file.endsWith(".js") ? extractJsStringsAndComments(raw) : extractJsFromHtmlScripts(raw);
  const { normalized, lineOfIndex } = normalizeWithLineMap(scanned);
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
