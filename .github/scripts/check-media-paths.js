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

// جافاسكربت يسمح بكتابة "/" داخل نصٍّ حرفيٍّ مهروبةً ("medien\/x.mp3")، وهي
// تُقيَّم إلى "medien/x.mp3" وقت التشغيل، لكنّ المصدر الخامّ يحمل شرطةً
// مائلةً عكسيّةً قبل كلّ "/" كهذه، فلا يطابقها هذا النمط أصلاً (فيمرّ
// المسارُ بلا تحقّقٍ صامتاً بدل أن يُبلَّغ مفقوداً — ملاحظة Codex). نفكّ هذا
// الهروب في نسخةٍ من النصّ خاصّةٍ بالمطابقة فقط، قبل البحث عن المسارات.
function unescapeForwardSlashes(text) {
  return text.replace(/\\\//g, "/");
}

const referenced = new Set();
for (const file of SOURCE_FILES) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  const text = unescapeForwardSlashes(raw);
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
