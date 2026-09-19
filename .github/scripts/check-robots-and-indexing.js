// يحرس ضدّ تغييرٍ غير مقصودٍ يمنع فهرسة الموقع العامّ: حذفُ الفهرسة من
// robots.txt لمجموعة User-agent: * تحديداً (لا أيّ سطرٍ في الملفّ)، أو
// إضافةُ meta robots تمنع الفهرسة في index.html. تغييرٌ مقصودٌ هنا يلزمه
// تعديلُ هذا الحارس أيضاً في نفس الـPR، فيصير مرئيّاً في المراجعة لا صامتاً.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const errors = [];

// يقسم robots.txt إلى مجموعاتٍ (كلُّ مجموعةٍ: أسطرُ User-agent المتتالية ثم
// قواعدُها)، أسوةً بمعيار robots.txt، بدل معاملة كلّ سطرٍ في الملفّ توجيهاً
// عامّاً بصرف النظر عن المجموعة التي يقع فيها (اسمُ التوجيه غيرُ حسّاسٍ لحالة
// الأحرف).
function parseRobotsGroups(text) {
  const groups = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) {
      current.rules.push({ type: field, value });
    }
  }
  return groups;
}

const robots = fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8");
const starGroups = parseRobotsGroups(robots).filter((g) => g.agents.includes("*"));
if (starGroups.length === 0) {
  errors.push("robots.txt لم تعد فيه مجموعة User-agent: * — سلوكُ الفهرسة للعامّة غيرُ معرَّف.");
} else {
  const rules = starGroups.flatMap((g) => g.rules);
  // "Disallow: /" و"Disallow: /*" متكافئتان عمليّاً: كلُّ مسارٍ يبدأ بـ"/"،
  // و"*" تطابق أيّ شيءٍ بعدها (حتى الفراغ) — فكلتاهما تمنعان الموقعَ كلّه.
  // لا نحاول هنا تطبيق دلالات مطابقة مساراتٍ عامّةً (كـ"/*.pdf$")، بل هذه
  // الحالةَ المحدَّدةَ فقط: قاعدةٌ لا تحمل غير "/" ونجمةٍ اختياريّةٍ بعدها.
  const BLOCKS_EVERYTHING = /^\/\*?$/;
  const hasDisallowRoot = rules.some((r) => r.type === "disallow" && BLOCKS_EVERYTHING.test(r.value));
  const hasAllowRoot = rules.some((r) => r.type === "allow" && r.value === "/");
  if (hasDisallowRoot) {
    errors.push('robots.txt: مجموعة User-agent: * صارت تحتوي قاعدةَ Disallow تمنع كلَّ مسارٍ ("/" أو "/*") — يمنع فهرسة الموقع كلّه.');
  } else if (!hasAllowRoot) {
    errors.push('robots.txt: مجموعة User-agent: * لم تعد تحتوي "Allow: /" — الموقعُ العامّ لن يُفهرَس بثقة.');
  }
}

// يفكّك الوسمَ إلى سماتٍ (اسمٌ ← قيمة) بالمرور عليه سمةً سمةً، بدل البحث عن
// اسم سمةٍ بتعبيرٍ نمطيٍّ في أيّ موضعٍ من نصّ الوسم — فذلك البحثُ قد يجد
// نصَّ سمةٍ حقيقيّةٍ داخل قيمةٍ مقتبسةٍ لسمةٍ أخرى (كـ data-note='name="x"')
// ويرجع بقيمةٍ خاطئة. كلُّ تكرارٍ للنمط يلتهم سمةً واحدةً كاملةً (اسمَها ثم
// قيمتَها المقتبسة أو غير المقتبسة إن وُجدت) قبل الانتقال إلى ما بعدها.
const ATTR_RE = /([^\s"'=<>`\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
function parseTagAttrs(tag) {
  // لا نحذف "/" السابقة لـ">" هنا: هي علامةُ إغلاقٍ ذاتيٍّ فعليّةٌ فقط حين
  // تسبقها مسافةٌ أو قيمةٌ مقتبسة، لكنّها جزءٌ حقيقيٌّ من قيمة سمةٍ غير
  // مقتبسةٍ حين تلي حرفَ قيمةٍ مباشرةً بلا مسافة (كـ"content=noindex/>"،
  // حيث القيمةُ الفعليّةُ "noindex/" لا "noindex" بمعيار HTML5) — حذفُها
  // دائماً كان يحوّل قيمةً غيرَ حاجبةٍ فعليّاً إلى "noindex" فيُخفق الفحصُ
  // خطأً (ملاحظة Codex). صنفُ محارف اسم السمة أدناه يستبعد "/" أصلاً، فتُهمَل
  // شرطةُ الإغلاق الذاتيّ اليتيمة (المسبوقةُ بمسافةٍ أو باقتباسٍ) تلقائيّاً
  // دون معالجةٍ خاصّة، بينما تبقى الشرطةُ المتّصلةُ بقيمةٍ غير مقتبسةٍ جزءاً
  // منها كما يقتضي المعيار.
  const inner = tag.replace(/^<[a-zA-Z][a-zA-Z0-9-]*/, "").replace(/>$/, "");
  const attrs = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(inner))) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) {
      attrs[name] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : "";
    }
  }
  return attrs;
}
// يفكّ مراجع محارف HTML (العدديّة والاسميّة الشائعة) في قيمة السمة قبل
// مقارنتها: المتصفّح والزاحفُ يريان "no&#105;ndex" هو "noindex" فعليّاً، لا
// النصَّ الحرفيَّ غيرَ المفكوك (ملاحظة Codex). والمرجعُ العدديّ لا يلزمه ";"
// أصلاً بمعيار HTML5 — يُقبل حتى بلا فاصلةٍ منقوطة، كـ"&#105ndex" (ملاحظة
// Codex الثانية) — بخلاف المرجع الاسميّ الذي أبقيتُه هنا يلزم ";".
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decodeEntities(value) {
  // ";" اختياريّةٌ بعد الصيغتَين العدديّتين هنا أيضاً (السطرُ أعلاه)، ويجب
  // أن يلتقطها النمطُ نفسُه حين تكون موجودةً — وإلّا بقيت معلَّقةً حرفيّاً في
  // الناتج (كـ"noi;ndex" بدل "noindex")، وهو خطأٌ انزلق حين أُضيف اختيارُ
  // ";" في جولةٍ سابقة (اكتُشف أثناء التحقّق من إصلاحٍ مشابهٍ في الملفّ
  // الآخر، لا بملاحظةٍ من Codex على هذا الموضع تحديداً).
  // "X" مقبولةٌ أيضاً بديلاً عن "x" في مرجعٍ سداسيّ عشريّ بمعيار HTML5
  // (&#X6E; صالحةٌ تماماً كـ&#x6E;)؛ استبعادها كان يترك المرجعَ كلَّه غيرَ
  // مطابَقٍ فلا يُفكّ (ملاحظة Codex).
  return value.replace(/&(#[xX][0-9a-fA-F]+;?|#\d+;?|[a-zA-Z]+;)/g, (whole, ref) => {
    if (ref[0] === "#") {
      const digits = ref.replace(/;$/, "");
      const codePoint = digits[1] === "x" || digits[1] === "X" ? parseInt(digits.slice(2), 16) : parseInt(digits.slice(1), 10);
      if (Number.isNaN(codePoint)) return whole;
      // نقطةُ ترميزٍ خارج المدى الصالح (> 0x10FFFF) ترمي String.fromCodePoint
      // استثناءً بدل إرجاع محرف؛ المتصفّحُ يستبدلها بمحرف "�" ولا ينهار، فمن
      // الأسلم هنا إبقاءُ النصّ الأصليّ كما هو بدل تعطيل السكربت (ملاحظة Codex).
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
function readAttr(tag, attrName) {
  const value = parseTagAttrs(tag)[attrName.toLowerCase()];
  return value === undefined ? null : decodeEntities(value);
}

const htmlRaw = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
// يُسقَط تعليقُ HTML (<!-- ... --> )، ومحتوى <script>/<style>، ومحتوى
// <template> قبل البحث عن <meta>: كلُّها خاملةٌ فعليّاً لا ينفّذها المتصفّح
// كتوجيه HTML مباشر — <template> بالذات يبقى في جزءٍ (fragment) منفصلٍ عن
// شجرة المستند حتى يُستنسَخ صراحةً بجافاسكربت — فمطابقةُ وسمٍ داخل أيٍّ منها
// كأنّه توجيهٌ فعليٌّ تمنع فهرسة صفحةٍ تبقى قابلةً للفهرسة فعلاً (ملاحظة
// Codex؛ التعليقات جولةٌ، والسكربت/الأسلوب جولةٌ تالية، والتمبلت جولةٌ ثالثة).
// إسقاطُ <template> يتكرّر حتى ثباتِ الناتج (لا مرّةً واحدة): النمطُ غيرُ
// الجشعِ يتوقّف عند أوّل </template>، فـ<template> متداخلةً (كـ
// <template><template></template><meta ...></template>) كانت تترك وسمَ
// meta الداخليَّ الخاملَ ظاهراً بعد إزالة طبقةٍ واحدةٍ فقط؛ التكرارُ يزيل
// الطبقةَ الأعمق أوّلاً ثم ما فوقها إلى أن يستقرّ النصّ (ملاحظة Codex).
// <textarea> و<title> نصٌّ خامٌّ (RCDATA) بمعيار HTML5 مثل <script>/<style>:
// محتواهما نصٌّ حرفيٌّ لا يُفسَّره المتصفّح وسوماً، فـ<meta ...> داخل
// <textarea>...</textarea> مجرّد نصٍّ ظاهرٍ للمستخدم لا توجيهَ فهرسةٍ فعليّاً
// (ملاحظة Codex؛ نفس المنطق ينطبق على <title>). بخلاف <template> أعلاه، لا
// تسمح RCDATA بوسمٍ متداخلٍ من نفس النوع فعليّاً (ينتهي المحتوى عند أوّل
// وسم إغلاقٍ حرفيّ)، فلا حاجة لتكرار المطابقة حتى الثبات هنا.
let html = htmlRaw
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
  .replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea\s*>/gi, "")
  .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, "");
const TEMPLATE_LEAF_RE = /<template\b[^>]*>((?:(?!<template\b|<\/template\s*>)[\s\S])*?)<\/template\s*>/gi;
let htmlBeforeTemplatePass;
do {
  htmlBeforeTemplatePass = html;
  html = html.replace(TEMPLATE_LEAF_RE, "");
} while (html !== htmlBeforeTemplatePass);
// يلتقط الوسمَ كاملاً حتى لو وقعت ">" داخل قيمةٍ مقتبسةٍ (كـ data-note="a > b")،
// بدل التوقّف عند أوّل ">" بصرف النظر عن الاقتباس.
const metaTags = html.match(/<meta\b(?:"[^"]*"|'[^']*'|[^>])*>/gi) || [];
// "none" يكافئ "noindex, nofollow" عند محرّكات البحث، لا "noindex" وحدها.
const BLOCKING_TOKENS = new Set(["noindex", "none"]);
// name="robots" يخاطب كلَّ الزواحف، لكن اسماً خاصّاً بزاحفٍ بعينه (كـ
// googlebot) يُطاع من محرّكه هو تحديداً حتى لو بقي name="robots" العامّ
// مسموحاً — فإخفاءُ الموقع عن محرّكٍ واحدٍ فقط يفلت من هذا الفحص لولا هذه
// القائمة (ملاحظة Codex). القائمةُ محدودةٌ عمداً بأسماء الزواحف الرئيسيّة
// المعروفة، لا كلّ زاحفٍ متخيَّل.
const ROBOTS_META_NAMES = new Set([
  "robots",
  "googlebot",
  "bingbot",
  "duckduckbot",
  "slurp",
  "baiduspider",
  "yandex",
]);
const hasNoindexMeta = metaTags.some((tag) => {
  const name = readAttr(tag, "name");
  const content = readAttr(tag, "content");
  if (!name || !ROBOTS_META_NAMES.has(name.toLowerCase()) || !content) return false;
  return content
    .toLowerCase()
    .split(/[,\s]+/)
    .some((token) => BLOCKING_TOKENS.has(token));
});
if (hasNoindexMeta) {
  errors.push("index.html صار يحمل meta robots تمنع الفهرسة — سيُخفى الموقعُ عن محرّكات البحث.");
}

if (errors.length) {
  console.error("تغييرٌ غيرُ متوقَّعٍ في إعدادات الفهرسة:");
  errors.forEach((e) => console.error("  " + e));
  process.exit(1);
}

console.log("إعداداتُ robots.txt وnoindex كما هي متوقَّعة.");
