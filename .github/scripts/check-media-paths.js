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
// كلّياً إن جاء المحرفُ غيرُ ASCII أوّل اسم الملفّ (ملاحظة Codex).
const MEDIA_REF = /medien\/[\p{L}\p{N}\p{M}_.\-/]+/gu;

const paket = JSON.parse(fs.readFileSync(path.join(ROOT, "PAKET.json"), "utf8"));
const listed = new Set(paket.dateien || []);

const referenced = new Set();
for (const file of SOURCE_FILES) {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  const matches = text.match(MEDIA_REF) || [];
  for (const m of matches) referenced.add(m);
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
