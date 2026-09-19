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
  const hasDisallowRoot = rules.some((r) => r.type === "disallow" && r.value === "/");
  const hasAllowRoot = rules.some((r) => r.type === "allow" && r.value === "/");
  if (hasDisallowRoot) {
    errors.push('robots.txt: مجموعة User-agent: * صارت تحتوي "Disallow: /" — يمنع فهرسة الموقع كلّه.');
  } else if (!hasAllowRoot) {
    errors.push('robots.txt: مجموعة User-agent: * لم تعد تحتوي "Allow: /" — الموقعُ العامّ لن يُفهرَس بثقة.');
  }
}

// يقرأ قيمةَ سمةٍ من وسمٍ سواءٌ اقتُبست بـ" أو ' أو بلا اقتباسٍ أصلاً
// (الثلاثةُ HTML صحيحةٌ وتعمل في المتصفّح). حدُّ اسم السمة بـ (?<![\w-])
// قبلها يمنع مطابقة "name" داخل سمةٍ أخرى تنتهي به، مثل "data-name".
function readAttr(tag, attrName) {
  var re = new RegExp('(?<![\\w-])' + attrName + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|(\\S+))', "i");
  var m = tag.match(re);
  if (!m) return null;
  return m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3].replace(/[>/]+$/, "");
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
// يلتقط الوسمَ كاملاً حتى لو وقعت ">" داخل قيمةٍ مقتبسةٍ (كـ data-note="a > b")،
// بدل التوقّف عند أوّل ">" بصرف النظر عن الاقتباس.
const metaTags = html.match(/<meta\b(?:"[^"]*"|'[^']*'|[^>])*>/gi) || [];
// "none" يكافئ "noindex, nofollow" عند محرّكات البحث، لا "noindex" وحدها.
const BLOCKING_TOKENS = new Set(["noindex", "none"]);
const hasNoindexMeta = metaTags.some((tag) => {
  const name = readAttr(tag, "name");
  const content = readAttr(tag, "content");
  if (!name || name.toLowerCase() !== "robots" || !content) return false;
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
