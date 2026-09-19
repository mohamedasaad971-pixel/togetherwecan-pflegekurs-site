// يحرس ضدّ تغييرٍ غير مقصودٍ يمنع فهرسة الموقع العامّ: حذفُ الفهرسة من
// robots.txt، أو إضافةُ <meta name="robots" content="noindex"> في index.html.
// تغييرٌ مقصودٌ هنا يلزمه تعديلُ هذا الحارس أيضاً في نفس الـPR، فيصير مرئيّاً
// في المراجعة لا صامتاً.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const errors = [];

const robots = fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8");
if (!/^Allow:\s*\/\s*$/m.test(robots)) {
  errors.push('robots.txt لم يعد يحتوي "Allow: /" — الموقعُ العامّ لن يُفهرَس.');
}
if (/^Disallow:\s*\/\s*$/m.test(robots)) {
  errors.push('robots.txt صار يحتوي "Disallow: /" — يمنع فهرسة الموقع كلّه.');
}

// يقرأ قيمةَ سمةٍ من وسمٍ سواءٌ اقتُبست بـ" أو ' أو بلا اقتباسٍ أصلاً
// (الثلاثةُ HTML صحيحةٌ وتعمل في المتصفّح).
function readAttr(tag, attrName) {
  var re = new RegExp(attrName + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|(\\S+))', "i");
  var m = tag.match(re);
  if (!m) return null;
  return m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3].replace(/[>/]+$/, "");
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
const hasNoindexMeta = metaTags.some((tag) => {
  const name = readAttr(tag, "name");
  const content = readAttr(tag, "content");
  return (
    name && name.toLowerCase() === "robots" &&
    content && content.toLowerCase().split(/[,\s]+/).includes("noindex")
  );
});
if (hasNoindexMeta) {
  errors.push("index.html صار يحمل meta robots noindex — سيُخفى الموقعُ عن محرّكات البحث.");
}

if (errors.length) {
  console.error("تغييرٌ غيرُ متوقَّعٍ في إعدادات الفهرسة:");
  errors.forEach((e) => console.error("  " + e));
  process.exit(1);
}

console.log("إعداداتُ robots.txt وnoindex كما هي متوقَّعة.");
