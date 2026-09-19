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

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
const hasNoindexMeta = metaTags.some((tag) => {
  const isRobotsTag = /name\s*=\s*["']robots["']/i.test(tag);
  const hasNoindex = /content\s*=\s*["'][^"']*\bnoindex\b[^"']*["']/i.test(tag);
  return isRobotsTag && hasNoindex;
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
