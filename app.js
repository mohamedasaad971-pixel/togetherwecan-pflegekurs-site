/* مشغّل الدورة. يقرأ window.DATEN (محتوى نسخة الطلّاب، لم تراجعه جهةٌ
   سريريّة بعد)، ويحمّل window.DATEN_INTERN عند الطلب للمعاينة الداخليّة وحدَها.
   يعمل بفتح الملفّ مباشرةً — لا خادمَ ولا شبكة. */
(function () {
  "use strict";

  var SCHLUESSEL = "twc-pflege-v1";
  var ROLLE_AR = { wissen: "درس معرفيّ", fall: "حالة", training: "تدريب", pruefung: "تقييم" };
  var PRUEFUNG_AR = {
    quellen: "مصادر ناقصة", klinisch: "مراجعة سريريّة", curriculum: "مراجعة منهجيّة"
  };
  var ART_AR = { wissen: "درس معرفيّ", fall: "حالة تطبيقيّة", training: "محطّة تدريب" };
  var WER_AR = {
    Patient: "المريض", Pflegekraft: "الممرّض/ة", Arzt: "الطبيب/ة",
    Angehoerige: "أحد الأقارب", Kollege: "زميل/ة من مهنةٍ أخرى"
  };
  var ISBAR = [
    ["identifikation", "I — التعريف"], ["situation", "S — الموقف"],
    ["hintergrund", "B — الخلفيّة"], ["beurteilung", "A — التقدير"],
    ["empfehlung", "R — الطلب"]
  ];
  /* لماذا عاد هذا البند إلى المراجعة. ولكلٍّ واقعةٌ مسجَّلةٌ خلفه. */
  var WH_GRUND = {
    quiz: "أخطأتَه في اختبار الوحدة",
    diagnose: "أخطأتَه في الاختبار التشخيصيّ",
    selbsturteil: "حكمتَ على نطقك: يحتاج إعادة",
    offene_punkte: "بقيت بنودٌ لم تُقِرَّ بها في تقييمك الذاتيّ",
    karte: "مفردةٌ أخطأتَ فيها في البطاقات"
  };
  var WH_TYP = { frage: "سؤال", satz: "جملةٌ منطوقة", wort: "مفردة" };

  /* درجاتُ التقييم الذاتيّ الثلاث. حكمُ المتعلّم على نفسِه، لا درجةُ آلة. */
  var STUFEN = [["wieder", "يحتاج إعادة"], ["ok", "مقبول"], ["sicher", "واثق"]];
  var SCHRITTE = [
    "einleitung", "patient", "film", "szenen", "dialog", "vokabeln", "ablauf",
    "aufklaerung", "isbar", "dokumentation", "fragen", "fehler", "transfer",
    "bewertung", "abschluss"
  ];

  /* ————— الحالة المحفوظة محلّيّاً ————— */
  /* الترجمةُ العربيّةُ مخفيّةٌ افتراضاً («عند الطلب»): الجملةُ الألمانيّة
   أوّلاً، والترجمةُ بضغطة. وهذا قرارٌ تعليميّ — الترجمةُ الظاهرةُ سلفاً
   تكشف الجوابَ قبل أن يحاول المتعلّم. ومن أرادها كاملةً فالمفتاحُ في
   شريط الأدوات، ويُحفَظ اختيارُه. */
  var zustand = { ar: "klick", sprache: "ar", tempo: 1, zuletzt: "", fortschritt: {} };
  try {
    var roh = localStorage.getItem(SCHLUESSEL);
    if (roh) { var g = JSON.parse(roh); for (var k in g) zustand[k] = g[k]; }
  } catch (e) { /* متصفّحٌ يمنع التخزين — نكمل بلا حفظ */ }

  function sichern() {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(zustand)); } catch (e) {}
  }

  /* ————— تقدّمُ الكلام: مخزنٌ واحدٌ محلّيّ —————
     يُحفَظ **عددُ المحاولات وما أقرّه المتعلّمُ عن نفسِه** — ولا يُحفَظ
     الصوتُ أبداً. تسجيلُه يبقى في ذاكرة الصفحة ويزول بإغلاقها، وهذا
     وعدُ الخصوصيّة الذي لا يُنقَض. */
  var SPRECH_VERSION = 1;
  zustand.sprech = zustand.sprech || {};
  zustand.sprechVersion = zustand.sprechVersion || SPRECH_VERSION;

  function sprechStand(schluessel) {
    return zustand.sprech[schluessel] ||
      { versuche: 0, geprueft: 0, gesamt: 0, datum: "" };
  }
  function sprechMerken(schluessel, stand) {
    stand.datum = new Date().toISOString().slice(0, 10);
    zustand.sprech[schluessel] = stand;
    sichern();
  }
  function sprechZuruecksetzen() { zustand.sprech = {}; sichern(); }

  /* إقرارُ الأهداف: فهارسُ ما قال المتعلّمُ إنّه يستطيعه في كلّ حالة.
     حكمُه هو، لا درجةٌ تُحسَب له، ويبقى في متصفّحه. */
  zustand.ziele = zustand.ziele || {};
  function zieleStand(fall) { return zustand.ziele[fall] || []; }
  function zieleMerken(fall, fertige) { zustand.ziele[fall] = fertige; sichern(); }

  /* ————— نصوصُ الواجهة —————
     الواجهةُ تُترجَم بالمفتاح العربيِّ نفسِه: `ui("الزمن")`. والجدولُ في
     `ui-en.js`، فلا يختلط نصُّ الواجهة بمنطق العرض. وما لا مقابلَ له يظهر
     بالعربيّة — واختبارٌ يمنع أن يبقى كذلك في صمت. */
  /* ————— اللغاتُ الثلاث —————
     المفتاحُ هو النصُّ العربيُّ نفسُه (كما في `app/ui-en.js`)، فلا
     يُخترَع مفتاحٌ ثالثٌ يُنسى تحديثُه.

     **وسلسلةُ الرجوع معلنةٌ لا ضمنيّة**: الألمانيّةُ ← الإنجليزيّةُ ←
     العربيّة. فلو نقص مفتاحٌ ألمانيٌّ ظهر الإنجليزيُّ لا الفراغ، ولو
     نقص الاثنان ظهر العربيُّ — ويكشف الناقصَ حارسٌ في
     `tests/test_oberflaeche.py` فلا يبقى صامتاً. */
  var RUECKFALL = { de: ["UI_DE", "UI_EN"], en: ["UI_EN"], ar: [] };

  function ui(ar) {
    var kette = RUECKFALL[zustand.sprache || "ar"] || [];
    for (var i = 0; i < kette.length; i++) {
      var tabelle = window[kette[i]] || {};
      if (Object.prototype.hasOwnProperty.call(tabelle, ar)) return tabelle[ar];
    }
    return ar;
  }

  /* ————— أدوات ————— */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fett(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"); }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d; }

  /* ————— اللغة الثالثة —————
     القاعدةُ نفسُها المكتوبةُ في tools/pruefe.py: ar ← en، و x_ar ← x_en،
     و titelAr ← titelEn، وما عداه يأخذ _en. ولا تُملأ الإنجليزيّةُ الغائبةُ
     بالعربيّة: المتعلّم يُقال له إنّها ناقصة، ولا يُوهَم أنّه يقرأ ترجمة. */
  function enName(schluessel) {
    if (schluessel === "ar") return "en";
    if (schluessel.slice(-3) === "_ar") return schluessel.slice(0, -3) + "_en";
    if (schluessel.slice(-2) === "Ar") return schluessel.slice(0, -2) + "En";
    return schluessel + "_en";
  }
  var EN_FEHLT = "No English translation yet.";
  var ARABISCH = /[\u0600-\u06FF]/;

  /* نصُّ شرحٍ عربيّ: يتبع اللغةَ المختارة ولا يخضع لزرّ الإخفاء، لأنّه شرحٌ
     لا ترجمةَ سطرٍ ألمانيّ. */
  function txt(objekt, schluessel) {
    if (!objekt) return "";
    var ar = objekt[schluessel], en = objekt[enName(schluessel)];
    /* حقلٌ لا عربيّةَ فيه — مثالُ توثيقٍ ألمانيٌّ مقتبَسٌ في خانةٍ عربيّة —
       لا تُطلَب له ترجمة: هذا معيارُ tools/pruefe.py نفسُه. والمقتبَسُ يبقى
       كما هو في اللغتين، ولا يُقال عنه إنّ ترجمتَه ناقصة. */
    if (!en && !ARABISCH.test(ar || "")) en = ar;
    return '<span class="s-ar">' + fett(ar) + "</span>" +
      '<span class="s-en">' + (en ? fett(en) : '<i class="fehlt">' + EN_FEHLT + "</i>") +
      "</span>";
  }

  /* شرحٌ **بجانبه أصلُه الألمانيُّ مطبوعٌ في السطر التالي**.

     في الواجهة الألمانيّة لا معنى لأن يقرأ المتعلّمُ الإنجليزيّةَ فوق
     الألمانيّة نفسِها: صفحةٌ بلغتين مكدَّستين، وقد مُنع التكديسُ صراحةً
     («تُعرَض واجهةٌ واحدةٌ بحسب اختيار المستخدم»). فتُطوى الترجمةُ هناك
     ويبقى الأصل. والرجوعُ إلى الإنجليزيّة يبقى حيث **لا أصلَ ألمانيّاً**
     — وذاك موضعُه `RUECKFALL`. */
  function txtNebenDeutsch(objekt, schluessel) {
    if ((zustand.sprache || "ar") === "de") return "";
    return txt(objekt, schluessel);
  }

  /* ترجمةُ سطرٍ ألمانيّ: تخضع لزرّ الإخفاء («كاملة · عند الطلب · مخفيّة»). */
  function uebersetzung(objekt, schluessel) {
    if (!objekt || !objekt[schluessel]) return "";
    var en = objekt[enName(schluessel)];
    return '<div class="ar-schalt"><p class="ar">' + fett(objekt[schluessel]) + "</p>" +
      '<p class="en">' + (en ? fett(en) : '<i class="fehlt">' + EN_FEHLT + "</i>") +
      "</p></div>";
  }

  /* عنوانٌ: إن غابت الإنجليزيّةُ عُرض الألمانيّ لا تنبيهُ الغياب.

     العنوانُ يُستعمَل للتمييز — في قائمةٍ من ثلاثين عنصراً تصير ثلاثون
     جملةَ «لا ترجمة» قائمةً لا تُقرأ. والألمانيُّ هنا ليس ملءاً صامتاً:
     هو لغةُ الامتحان والأصل، ويُرى أنّه ألمانيّ. */
  /* عنوانُ العنصر بلغةِ الواجهة وحدَها — لا عنوانان معاً.
     الألمانيّةُ تأخذ الألمانيَّ وهو الأصل؛ والإنجليزيّةُ الإنجليزيَّ وإن
     غاب فالألمانيّ (لا تنبيهَ غيابٍ في قائمةٍ من خمسةٍ وخمسين سطراً)؛
     والعربيّةُ العربيّ. */
  function titelText(objekt, arName, deName) {
    var sprache = zustand.sprache || "ar";
    if (sprache === "de") {
      return objekt[deName] ? esc(objekt[deName]) : fett(objekt[arName]);
    }
    if (sprache !== "en") return fett(objekt[arName]);
    var en = objekt[enName(arName)];
    if (en) return fett(en);
    return objekt[deName] ? esc(objekt[deName]) : '<i class="fehlt">' + EN_FEHLT + "</i>";
  }

  /* هل العنوانُ المعروضُ هو الألمانيُّ نفسُه؟ عندئذٍ لا يُكرَّر تحته. */
  function titelIstDeutsch(objekt, arName, deName) {
    var sprache = zustand.sprache || "ar";
    if (sprache === "de") return !!(deName && objekt[deName]);
    return sprache === "en" && !objekt[enName(arName)];
  }

  /* قائمةُ نصوصٍ عربيّة ولها قائمةٌ إنجليزيّةٌ موازيةٌ بالطول نفسِه. */
  function txtListe(objekt, schluessel) {
    var ar = objekt[schluessel] || [], en = objekt[enName(schluessel)] || [];
    return ar.map(function (wert, i) {
      return "<li>" + '<span class="s-ar">' + fett(wert) + "</span>" +
        '<span class="s-en">' +
        (en[i] ? fett(en[i]) : '<i class="fehlt">' + EN_FEHLT + "</i>") +
        "</span></li>";
    }).join("");
  }
  var QUELLTYP_AR = {
    fachstandard: ui("معيار مهنيّ"), hausstandard: ui("معيار المؤسّسة"),
    gesetz: ui("نصّ قانونيّ"), entwurf: ui("مسوّدة — غير مُثبَت")
  };

  /* عناوينُ المصادر مكتوبةٌ بالعربيّة في الغالب («معيارُ المؤسّسة في
     الضغط الرباطيّ») ولا مقابلَ لها. وعرضُها في واجهةٍ ألمانيّةٍ
     أو إنجليزيّةٍ **اختلاطُ لغاتٍ** وهو ما مُنع صراحةً.

     ولأنّها بيانُ إسنادٍ داخليٌّ — وكلُّها اليومَ `entwurf` — فالقاعدة:
     المتعلّمُ في الواجهتين الأخريين يرى **وسمَ نوع المصدر** وحدَه وهو
     الخبرُ العامل («مصدرٌ مسوّدة»)، والتفصيلُ يبقى في الواجهة العربيّة
     **وفي نسخة المراجعة بأيّ لغة** — فمن يراجع يحتاج الإسنادَ كاملاً.
     والتفصيلُ كلُّه في `curriculum/quellenlage.md` وفي ورقة المراجعة. */
  /* «٣ يوماً» عربيّةٌ سليمة، فكانت الوحدةُ كلمةً واحدةً تُلصَق خلف
     الرقم. والألمانيّةُ لا تحتمل ذلك: اللافتةُ المجرّدة «3 Tage»،
     والظرفُ بعد `in` يطلب الجرّ «in 3 Tagen»، والواحدُ مفردٌ «1 Tag».
     فأنتج اللصقُ على الشاشة «in 3 Tage» و«Box 1: 1 Tage». والوحدةُ
     الآن جملةٌ كاملةٌ فيها موضعٌ للرقم، تصوغها كلُّ لغةٍ بنحوِها. */
  function mitZahl(vorlage, n) {
    return vorlage.replace("{n}", n);
  }

  function tageText(n, nachher) {
    if (n === 0) return ui("اليوم");
    if (n === 1) return nachher ? ui("بعد يوم") : ui("يومٌ واحد");
    return mitZahl(nachher ? ui("بعد {n} يوماً") : ui("{n} يوماً"), n);
  }

  function quelleDetails() {
    return (zustand.sprache || "ar") === "ar" || window.MODUS !== "lernende";
  }

  function quelleText(q) {
    if (!q) return "—";
    if (typeof q === "string") return esc(q);
    if (!quelleDetails()) {
      return '<span class="chip ' + (q.typ === "entwurf" ? "warn" : "gedeckt") + '">' +
        esc(ui(QUELLTYP_AR[q.typ] || q.typ)) + "</span>";
    }
    var teile = [];
    if (q.titel) teile.push(esc(q.titel));
    if (q.herausgeber) teile.push(esc(q.herausgeber));
    if (q.ausgabe) teile.push(esc(q.ausgabe));
    if (q.gueltig_ab) teile.push(ui("نافذٌ من ") + esc(q.gueltig_ab));
    if (q.stelle) teile.push(esc(q.stelle));
    if (q.url) teile.push('<a href="' + esc(q.url) + '" target="_blank" rel="noopener">' +
      esc(q.url) + "</a>");
    if (q.abgerufen_am) teile.push(ui("اطُّلع عليه ") + esc(q.abgerufen_am));
    var kopf = '<span class="chip ' + (q.typ === "entwurf" ? "warn" : "gedeckt") + '">' +
      esc(ui(QUELLTYP_AR[q.typ] || q.typ)) + "</span> ";
    var rumpf = kopf + teile.join(" · ");
    /* `hinweis` ملاحظةُ مراجعةٍ داخليّةٌ مكتوبةٌ بالعربيّة وحدَها ولا
       مقابلَ لها. فعرضُها في واجهةٍ ألمانيّةٍ أو إنجليزيّةٍ تكديسُ لغاتٍ
       بلا فائدة، والوسمُ «مصادر مسوّدة» يقول ما يلزم. فتظهر في
       العربيّة، ويبقى في الأخريين الوسمُ وحدَه. */
    if (q.typ === "entwurf" && q.hinweis && (zustand.sprache || "ar") === "ar") {
      rumpf += ui('<div class="sicher">ينقصه: ') + fett(q.hinweis) + "</div>";
    }
    return rumpf;
  }

  /* سطرٌ ألمانيٌّ ومعه ترجمتُه بلغة المتعلّم، ثمّ التعليلُ إن وُجد.
     يأخذ الكائنَ كلَّه لا نصّين، حتّى يجد المقابلَ الإنجليزيَّ بنفسه. */
  function zweisprachig(objekt, deName, arName, warumName) {
    if (!objekt) return "";
    deName = deName || "de"; arName = arName || "ar";
    return '<p class="de">' + esc(objekt[deName]) + "</p>" +
      uebersetzung(objekt, arName) +
      (warumName && objekt[warumName]
        ? '<p class="warum">' + txt(objekt, warumName) + "</p>" : "");
  }

  var internGeladen = false;
  function internLaden(fertig) {
    if (internGeladen || window.DATEN_INTERN) { internGeladen = true; return fertig(); }
    var s = document.createElement("script");
    s.src = "daten-intern.js";
    s.onload = function () { internGeladen = true; fertig(); };
    s.onerror = function () { fertig(ui("تعذّر تحميل daten-intern.js — شغّل tools/bau.py.")); };
    document.head.appendChild(s);
  }

  function finde(id, intern) {
    var quelle = intern && window.DATEN_INTERN ? window.DATEN_INTERN : window.DATEN;
    var liste = quelle.elemente || [];
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return null;
  }

  /* ————— شريط الأدوات ————— */
  function werkzeug(mitTempo) {
    /* مفتاحُ ظهور الترجمة لا معنى له في الواجهة الألمانيّة: نصُّ التدريب
       ألمانيٌّ أصلاً ولا تُعرَض له ترجمة. ومفتاحٌ لا يفعل شيئاً كذبٌ
       صغير، فيُحذَف لا يُعطَّل. */
    var uebersetzbar = (zustand.sprache || "ar") !== "de";
    return '<div class="werkzeug">' +
      (uebersetzbar
        ? ui('<label class="klein matt">ظهورها</label>') +
          '<select id="w-ar">' +
          ui('<option value="an">كاملة</option>') +
          ui('<option value="klick">عند الطلب</option>') +
          ui('<option value="aus">مخفيّة</option></select>')
        : "") +
      (mitTempo ? ui('<label class="klein matt">سرعة الفيديو</label>') +
        '<select id="w-tempo"><option>0.75</option><option>1</option>' +
        '<option>1.25</option><option>1.5</option><option>2</option></select>' : "") +
      "</div>";
  }

  /* مبدّلُ اللغة في الرأس: يُربَط مرّةً، لأنّ الرأسَ لا يُعاد رسمُه. */
  function spracheBinden() {
    var sp = document.getElementById("w-sprache");
    if (sp) {
      sp.value = zustand.sprache || "ar";
      sp.onchange = function () {
        zustand.sprache = sp.value;
        document.body.setAttribute("data-sprache", sp.value);
        sichern();
        /* النصُّ نفسُه يبدّله CSS، لكنّ ما يُبنى مرّةً عند الرسم — شريطُ حالة
           الترجمة، ومسارُ الترجمة فوق الفيديو، ووجهُ البطاقة — لا يبدّله.
           فيُعاد الرسمُ بدل أن يبقى نصفُ الصفحة على اللغة السابقة. */
        leiten();
      };
    }
  }

  function werkzeugBinden() {
    var a = document.getElementById("w-ar");
    if (a) {
      a.value = zustand.ar;
      a.onchange = function () {
        zustand.ar = a.value; document.body.setAttribute("data-ar", a.value); sichern();
      };
    }
    var t = document.getElementById("w-tempo");
    if (t) {
      t.value = String(zustand.tempo);
      t.onchange = function () {
        zustand.tempo = parseFloat(t.value); sichern();
        var v = document.querySelector("video"); if (v) v.playbackRate = zustand.tempo;
      };
    }
    document.body.addEventListener("click", function (ev) {
      var s = ev.target.closest ? ev.target.closest(".ar-schalt") : null;
      if (s && document.body.getAttribute("data-ar") === "klick") s.classList.toggle("offen");
    });
  }

  /* ————— الصفحة الأولى ————— */
  function start() {
    var d = window.DATEN, k = d.kurs, z = d.zaehler;
    var h = "<h1>" + titelText(k, "titelAr", "titel_de") + "</h1>" +
      (titelIstDeutsch(k, "titelAr", "titel_de") ? ""
        : '<p class="matt">' + esc(k.titel_de) + "</p>") +
      ui('<div class="karte"><h2>هدف المنهج</h2>') +
      (txtNebenDeutsch(k, "ziel_ar") ? "<p>" + txtNebenDeutsch(k, "ziel_ar") + "</p>" : "") +
      '<p class="de klein">' + esc(k.ziel_de) + "</p></div>";

    h += tor(d);

    /* كان هنا: «لا يظهر هنا إلّا ما اعتمده مراجِعٌ سريريّ». وصار المحتوى
       كلُّه يدخل نسخةَ الطلّاب بقرار محمد (٢٠٢٦-٠٩-١٣)، **فالجملةُ صارت
       كاذبة** فحُذفت. ولا يُوضَع مكانَها ادّعاءُ اعتماد — وذلك شرطُه. */
    h += ui('<div class="karte"><h2>دروس المتعلّم</h2>');
    var frei = (d.elemente || []);
    if (!frei.length) {
      h += ui('<div class="band warn">لا عنصرَ في هذا البناء بعد.') +
        ui('<span class="klein">شغّل <code>tools/bau.py</code>.</span></div>');
    } else {
      h += '<div class="liste">' + frei.map(karte).join("") + "</div>";
    }
    h += "</div>";
    return h;
  }

  function tor(d) {
    /* أسماءُ العدّادات تغيّرت مع إعادة التسمية إلى belegt/freigegeben،
       وبقي هنا الاسمان القديمان، فكان المجموعُ NaN على الصفحة. */
    var z = d.zaehler, n = z.offen + z.belegt + z.freigegeben;
    /* كان العنوانُ «… ١٠٠٪» مكتوباً بيدٍ، فبقي يقول مئةً بالمئة بينما
       العدّاداتُ تحته تقول غيرَ ذلك. فصار يُشتقّ من العدّادات نفسِها. */
    var h = ui('<div class="karte"><h2>تغطية المتطلّبات الرسميّة — ') +
      z.belegt + ui(" من ") + n + "</h2>" +
      ui('<p class="quelle">§ 45 PflAPrV ومجالات الكفاءة I–V في Anlage 2 — ') + n + ui(" متطلّباً</p>") +
      '<div class="zahlen">' +
      '<div class="zahl"><b>' + z.offen + ui("</b><span>غير مغطّى</span></div>") +
      '<div class="zahl"><b>' + z.belegt + ui("</b><span>مرتبط بأدلّة</span></div>") +
      '<div class="zahl"><b>' + z.freigegeben +
      ui("</b><span>معتمد سريريّاً ومنهجيّاً</span></div>") +
      "</div>";
    if (!d.vollstaendig) {
      h += ui('<div class="band rot">المنهج غير مكتمل — ') + z.offen + ui(" متطلّباً بلا تغطية.") +
        ui('<span class="klein">لا يُعلَن الاكتمالُ ما بقيت فجوة. ولا يُعَدُّ المتطلّبُ مغطًّى ') +
        ui("قبل أن تجتمع عليه العناصرُ الأربعة: درسٌ معرفيّ، وحالةٌ تطبيقيّة، وتدريبٌ، ومعيارُ تقييم.</span></div>");
    } else if (!d.freigegeben_vollstaendig) {
      h += ui('<div class="band warn">كلُّ المتطلّبات مرتبطةٌ بأدلّة، ولم تكتمل المراجعتان بعد.') +
        ui('<span class="klein">«مرتبط بأدلّة» يعني أنّ الرابط سليمُ الشكل: المسارُ موجودٌ ') +
        ui("ونوعُه يصلح. ولا يعني أنّ إنساناً شهد بأنّ المسار يحقّق المتطلَّب دلالةً — ") +
        ui("تلك هي المراجعة المنهجيّة، وإلى جانبها السريريّة على المضمون.</span></div>");
    } else {
      h += ui('<div class="band gut">كلُّ المتطلّبات معتمدةٌ سريريّاً ومنهجيّاً.</div>');
    }
    h += ui('<p><a href="#/abdeckung">افتح المصفوفة كاملةً ←</a></p></div>');
    return h;
  }

  function karte(e) {
    var f = zustand.fortschritt[e.id];
    var anteil = f && f.schritte ? Math.round(f.schritte.length / SCHRITTE.length * 100) : 0;
    return '<a href="#/e/' + esc(e.id) + '">' +
      '<div class="t">' + titelText(e, "titelAr", "titel_de") + "</div>" +
      '<div class="klein matt">' + esc(e.id) + " · " + ui(ART_AR[e._art] || e._art) + "</div>" +
      (anteil ? '<div class="fort"><i style="width:' + anteil + '%"></i></div>' +
        '<div class="klein matt">' + anteil + ui("٪</div>") : "") +
      quizMarke(e.id) +
      "</a>";
  }

  function quizMarke(id) {
    var r = (zustand.quiz || {})[id];
    if (!r) return "";
    return '<div class="klein"><span class="chip ' +
      (r.prozent >= 70 ? "frei" : "warn") + '">' + ui("الاختبار: ") + r.prozent +
        ui("٪</span></div>");
  }

  /* ————— خطّةُ المنهج ————— */
  function lehrplan() {
    var d = window.DATEN, plan = d.lehrplan;
    if (!plan) return ui('<div class="band rot">خطّةُ المنهج غائبة — شغّل tools/bau.py.</div>');
    var gesamt = alsListe(plan.einheiten).reduce(function (n, e) {
      return n + e._zaehler.gesamt;
    }, 0);
    var h = ui("<h1>المنهج</h1>") +
      '<p class="matt">' + alsListe(plan.einheiten).length + ui(" وحدةً تقتسم ") + gesamt +
      ui(" متطلّباً رسميّاً. <strong>كلُّ متطلَّبٍ في وحدةٍ واحدةٍ</strong> لا أكثرَ ") +
      ui("ولا أقلّ، ويفحص ذلك <code>tools/pruefe_lehrplan.py</code>.</p>") +
      '<p class="klein matt">' + txt(plan, "_hinweis") || "" + "</p>";

    h += ui('<div class="karte"><h2>الوحدات</h2>') +
      '<div class="tabellerei"><table><thead><tr>' +
      ui("<th>#</th><th>الوحدة</th><th>متطلّبات</th><th>الحال</th><th>ما بُني</th>") +
      "</tr></thead><tbody>";
    alsListe(plan.einheiten).forEach(function (e) {
      var z = e._zaehler;
      var anteil = Math.round((z.gesamt - z.offen) / z.gesamt * 100);
      var gebaut = [];
      ["wissen", "faelle", "training"].forEach(function (rolle) {
        (e._gebaut[rolle] || []).forEach(function (id) {
          gebaut.push('<a href="#/e/' + esc(id) + '">' + esc(id) + "</a>");
        });
      });
      var geplant = [];
      ["wissen", "faelle", "training"].forEach(function (rolle) {
        (e.geplant[rolle] || []).forEach(function (id) {
          if ((e._gebaut[rolle] || []).indexOf(id) < 0) geplant.push(esc(id));
        });
      });
      h += '<tr><td class="n" data-k="#">' + esc(e.id) + "</td>" +
        '<td data-k="' + ui("الوحدة") + '">' + titelText(e, "titelAr", "titel_de") +
        '<div class="de klein matt">' + esc(e.titel_de) + "</div>" +
        '<div class="klein matt">' + txt(e, "zweck_ar") + "</div></td>" +
        '<td data-k="' + ui("متطلّبات") + '" class="n">' + z.gesamt + "</td>" +
        '<td data-k="' + ui("الحال") + '">' +
        '<div class="fort"><i style="width:' + anteil + '%"></i></div>' +
        '<div class="klein matt">' + z.offen + ui(" غير مغطّى · ") + z.belegt +
        ui(" مرتبط · ") + z.freigegeben + ui(" معتمد</div></td>") +
        '<td data-k="' + ui("ما بُني") + '" class="klein">' +
        (gebaut.length ? gebaut.join(" · ") : ui('<span class="matt">لا شيء</span>')) +
        (geplant.length ? ui('<div class="matt">مخطَّط: ') + geplant.join(" · ") +
          "</div>" : "") + "</td></tr>";
    });
    h += "</tbody></table></div></div>";
    return h;
  }

  /* ————— مصفوفة التغطية ————— */
  function abdeckung() {
    var d = window.DATEN, a = d.anforderungen, tab = d.abdeckung;
    var h = ui("<h1>تغطية المتطلّبات الرسميّة</h1>") +
      ui('<p class="matt">كلُّ متطلَّبٍ رسميّ مربوطٌ بأربعة عناصر: درسٌ معرفيّ، وحالةٌ تطبيقيّة، ') +
      ui("وتدريبٌ شفهيٌّ أو عمليّ، ومعيارُ تقييم. وثلاثةٌ من أربعةٍ فجوة.</p>") +
      /* ما مصدرُ النصّ وما قيمةُ ترجمته: يُقال في الصفحة نفسِها لا في ملفٍّ
         لا يفتحه أحد. ونصُّ القانون ألمانيٌّ رسميّ، والترجمتان للفهم. */
      '<p class="quelle">' + txt(a, "_hinweis") + "</p>";
    h += tor(d);

    h += ui('<div class="karte"><h2>§ 45 PflAPrV — شكل الامتحان</h2>') +
      '<p class="quelle">' + esc(a.__quelle_pruefungsteile) + "</p>";
    alsListe(a.pruefungsteile).forEach(function (t) {
      h += "<h3>" + titelText(t, "titel_ar", "titel_de") + ' <span class="chip">' +
        (t.teil === "muendlich" ? ui("شفهيّ")
          : t.teil === "praktisch" ? ui("عمليّ") : ui("عامّ")) + "</span></h3>" +
        (titelIstDeutsch(t, "titel_ar", "titel_de") ? ""
          : '<p class="de klein">' + esc(t.titel_de) + "</p>") +
        zeilenTabelle(t.anforderungen, tab);
    });
    h += "</div>";

    alsListe(a.bereiche).forEach(function (b) {
      h += '<div class="karte"><h2>' + esc(b.id) + " — "
        + titelText(b, "titel_ar", "titel_de") + "</h2>" +
        (titelIstDeutsch(b, "titel_ar", "titel_de") ? ""
          : '<p class="de klein">' + esc(b.titel_de) + "</p>");
      alsListe(b.unter).forEach(function (u) {
        var offen = alsListe(u.einzeln).filter(function (e) {
          return tab[e.id] && tab[e.id].status === "offen";
        }).length;
        h += "<details><summary>" + esc(u.id) + " — "
          + titelText(u, "titel_ar", "titel_de") +
          ' <span class="chip ' + (offen ? "offen" : "gedeckt") + '">' +
          (offen ? offen + ui(" من ") + alsListe(u.einzeln).length + ui(" بلا تغطية") : ui("مغطّى كلُّه")) +
          "</span></summary><div>" +
          (titelIstDeutsch(u, "titel_ar", "titel_de") ? ""
            : '<p class="de klein">' + esc(u.titel_de) + "</p>") +
          zeilenTabelle(u.einzeln, tab) + "</div></details>";
      });
      h += "</div>";
    });
    return h;
  }

  function zeilenTabelle(liste, tab) {
    var h = '<div class="tabellerei"><table><thead><tr>' +
      ui("<th>المعرّف</th><th>المتطلَّب</th><th>الحالة</th><th>ما ينقص</th><th>الأدلّة</th>") +
      "</tr></thead><tbody>";
    alsListe(liste).forEach(function (e) {
      var t = tab[e.id] || { status: "offen", fehlende_rollen: [], elemente: [] };
      var chip = t.status === "freigegeben"
        ? ui('<span class="chip frei">معتمد سريريّاً ومنهجيّاً</span>')
        : t.status === "belegt"
          ? '<span class="chip gedeckt" title="' + ui("رابطٌ سليمُ الشكل، بلا مراجعةٍ بشريّة بعد") + '">' +
            ui("مرتبط بأدلّة</span>")
          : ui('<span class="chip offen">غير مغطّى</span>');
      var offenePruefungen = (t.fehlende_pruefungen || []).map(function (k) {
        return ui(PRUEFUNG_AR[k] || k);
      });
      h += '<tr><td class="n" data-k="' + ui("المعرّف") + '">' + esc(e.id) + "</td>" +
        '<td data-k="' + ui("المتطلَّب") + '">' + txtNebenDeutsch(e, "ar") +
        '<div class="de klein">' + esc(e.de) + "</div></td>" +
        '<td data-k="' + ui("الحالة") + '">' + chip + "</td>" +
        '<td data-k="' + ui("ما ينقص") + '" class="klein matt">' +
        (t.fehlende_rollen.length
          ? t.fehlende_rollen.map(function (r) { return ui(ROLLE_AR[r] || r); }).join(" · ")
          : offenePruefungen.length ? offenePruefungen.join(" · ") : "—") + "</td>" +
        '<td data-k="' + ui("الأدلّة") + '" class="klein matt">' + belegeText(t) + "</td></tr>";
    });
    return h + "</tbody></table></div>";
  }

  function belegeText(t) {
    var rollen = Object.keys(t.belege || {});
    if (!rollen.length) return "—";
    return rollen.map(function (r) {
      return "<b>" + esc(ui(ROLLE_AR[r] || r)) + ":</b> " +
        t.belege[r].map(function (p) { return "<code>" + esc(p) + "</code>"; }).join(" ");
    }).join("<br>");
  }

  /* ————— المعاينة الداخليّة ————— */
  function intern(fertig) {
    internLaden(function (fehler) {
      if (fehler) return fertig('<div class="band rot">' + esc(fehler) + "</div>");
      var d = window.DATEN_INTERN;
      var h = ui("<h1>المعاينة الداخليّة</h1>") +
        ui('<div class="band warn">قيد المراجعة السريريّة') +
        ui('<span class="klein">كلُّ ما في هذه الصفحة غيرُ معتمد. لا يُعرض على مرشّحٍ، ') +
        ui("ولا يُوصف بأنّه صحيحٌ أو مكتمل، قبل مراجعة ممرّض/ة مؤهَّل/ة.</span></div>") +
        '<div class="liste">' + (d.elemente || []).map(function (e) {
          return '<a href="#/e/' + esc(e.id) + '">' +
            '<div class="t">' + titelText(e, "titelAr", "titel_de") + "</div>" +
            '<div class="klein matt">' + esc(e.id) + " · " + ui(ART_AR[e._art] || e._art) +
            ui(" · يثبت ") + Object.keys(e.nachweise || {}).length + ui(" متطلّباً</div>") +
            '<div class="klein">' + statusChip(ui("سريريّ"), e._status_klinisch) + " " +
            statusChip(ui("منهجيّ"), e._status_curriculum) + "</div>" +
            quizMarke(e.id) + "</a>";
        }).join("") + "</div>";
      fertig(h);
    });
  }

  function statusChip(name, wert) {
    var klasse = wert === "geprueft" ? "frei" : wert === "in_pruefung" ? "gedeckt" : "warn";
    var text = wert === "geprueft" ? ui("معتمد") :
      wert === "in_pruefung" ? ui("قيد المراجعة") : ui("غير مراجَع");
    return '<span class="chip ' + klasse + '">' + name + ": " + text + "</span>";
  }

  /* ————— عنصرٌ واحد ————— */
  function element(id, fertig) {
    var e = finde(id, false);
    if (e) return fertig(zeichne(e, false));
    internLaden(function (fehler) {
      if (fehler) return fertig('<div class="band rot">' + esc(fehler) + "</div>");
      var e2 = finde(id, true);
      if (!e2) return fertig(ui('<div class="band rot">لا عنصرَ بالمعرّف ') + esc(id) + "</div>");
      fertig(zeichne(e2, true));
    });
  }

  function kopfZeile(e, intern) {
    var h = "";
    if (intern) {
      h += ui('<div class="band warn">قيد المراجعة السريريّة') +
        ui('<span class="klein">هذا العنصر غيرُ معتمد. المصدر: ') +
        quelleText(e.__quelle) + "</span></div>";
    }
    /* حالةُ ترجمة العنصر تُعلَّم على body: عنصرٌ بلا إنجليزيّةٍ أصلاً يكفيه
       شريطٌ واحدٌ يقول ذلك، ولا يُكرَّر التنبيهُ مئةَ مرّةٍ تحت كلّ سطر. */
    document.body.setAttribute("data-en", e._status_en || "fehlt");
    /* الإنجليزيّةُ حالةٌ ثالثةٌ مستقلّةٌ عن المراجعتين: حتّى مادّةٌ اجتازت
       المراجعتين السريريّة والمنهجيّة قد تكون ترجمتُها مسوّدة، والمتعلّمُ
       يُقال له ذلك بلغته. */
    if ((zustand.sprache || "ar") === "en" && e._status_en !== "geprueft") {
      h += '<div class="en-band">' + (e._status_en === "ungeprueft"
        ? "English draft — translated but not reviewed. The German text is the source; "
          + "where the two differ, the German governs."
        : "This element has no English translation yet. Switch the translation "
          + "language to العربيّة, or read the German.") + "</div>";
    }
    h += "<h1>" + titelText(e, "titelAr", "titel_de") + "</h1>" +
      (titelIstDeutsch(e, "titelAr", "titel_de") ? ""
        : '<p class="de matt">' + esc(e.titel_de) + "</p>") +
      '<p class="klein matt">' + esc(e.id) + " · " + ui(ART_AR[e._art] || e._art) +
      (e.achse ? ui(" · المحور: ") + txt(e, "achse") : "") + "</p>";
    var ziele = Object.keys(e.nachweise || {});
    if (ziele.length) {
      h += ui('<p class="klein matt">يثبت ') + ziele.length + ui(" متطلّباً: ") +
        ziele.map(function (k) {
          var rollen = Object.keys(e.nachweise[k]).map(function (r) {
            return ui(ROLLE_AR[r] || r);
          }).join(ui("، "));
          return '<span class="chip" title="' + esc(rollen) + '">' + esc(k) + "</span>";
        }).join(" ") + "</p>";
    }
    h += '<p class="klein">' + statusChip(ui("سريريّ"), e._status_klinisch) + " " +
      statusChip(ui("منهجيّ"), e._status_curriculum) + "</p>";
    if ((e.vokabeln || []).length) {
      h += '<p class="klein"><a href="#/karten-intern/' + esc(e.id) + '">' +
        ui("بطاقاتُ هذه الوحدة (") + alsListe(e.vokabeln).length + ui(" مفردة) ←</a></p>");
    }
    if (e._quellen_status === "draft") {
      h += ui('<p class="klein"><span class="chip warn">مصادر مسوّدة</span> ') +
        ui("لا يمكن اعتمادُ هذا العنصر قبل إكمال كلّ مصدرٍ فيه.</p>");
    }
    return h;
  }

  function zeichne(e, intern) {
    aktuell = e;
    if (e._art === "fall") return fall(e, intern) + quizBlock(e);
    if (e._art === "wissen") return wissen(e, intern) + quizBlock(e);
    return training(e, intern) + quizBlock(e);
  }

  function wissen(e, intern) {
    var h = kopfZeile(e, intern) + werkzeug(false);
    h += ui('<div class="karte"><h2>المقدّمة</h2>') +
      zweisprachig(e.einleitung) +
      ui("<h3>أهداف الدرس</h3><ul>") + alsListe(e.lernziele).map(function (z) {
        return "<li>" + txtNebenDeutsch(z, "ar")
          + '<div class="de klein">' + esc(z.de) + "</div></li>";
      }).join("") + "</ul></div>";
    alsListe(e.abschnitte).forEach(function (a) {
      h += '<div class="karte"><h2>' + titelText(a, "titel_ar", "titel_de") + "</h2>" +
        (titelIstDeutsch(a, "titel_ar", "titel_de") ? ""
          : '<p class="de klein matt">' + esc(a.titel_de) + "</p>") +
        zweisprachig(a, "text_de", "text_ar") + "</div>";
    });
    return h;
  }

  function training(e, intern) {
    var h = kopfZeile(e, intern) + werkzeug(false);
    h += ui('<div class="karte"><h2>المهمّة</h2>') +
      ui('<p class="klein matt">القسم: ') + (e.teil === "muendlich" ? ui("شفهيّ") : ui("عمليّ")) +
      ui(" · الزمن: ") + esc(e.zeit_min) + ui(" دقيقة</p>") +
      zweisprachig(e.auftrag) + "</div>";
    h += ui('<div class="karte"><h2>الإجابة النموذجيّة</h2><ol>') +
      alsListe(e.modell).map(function (m) { return '<li class="de">' + esc(m) + "</li>"; }).join("") +
      "</ol></div>";
    h += ui('<div class="karte"><h2>معايير التقييم</h2>') + kriterien(e.kriterien) + "</div>";
    return h;
  }

  function kriterien(liste) {
    return ui('<div class="tabellerei"><table><thead><tr><th>المعيار</th><th>ما الذي يُحسب</th>') +
      "</tr></thead><tbody>" + liste.map(function (k) {
        return '<tr><td data-k="' + ui("المعيار") + '">' + txt(k, "name") + "</td>" +
          '<td data-k="' + ui("ما الذي يُحسب") + '">' + txt(k, "was_zaehlt") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* مسارُ الترجمة فوق الفيديو: واحدٌ لا ثلاثة. ثلاثةُ أسطرٍ ثابتةٍ تحجب
     الإجراءَ السريريَّ على الهاتف، وهو أهمُّ ما في الصورة. */
  function untertitelSpur(film) {
    var spuren = film.untertitel || {};
    var sprache = zustand.sprache || "ar";
    var datei = spuren[sprache];
    if (!datei) return "";
    var namen = { de: "Deutsch", en: "English", ar: ui("العربيّة") };
    /* تبقى الترجمةُ اختياريّةً: لا نضع default كي يبدأ الفيلم نظيفاً. */
    return '<track kind="subtitles" srclang="' + esc(sprache) +
      '" label="' + esc(namen[sprache] || sprache) +
      '" src="' + esc(datei) + '">';
  }

  /* الخطوات الخمس عشرة */
  function fall(e, intern) {
    var h = kopfZeile(e, intern) + fortschrittBalken(e) + werkzeug(true);

    h += abschnitt(e, "einleitung", ui("١ · المقدّمة والأهداف"),
      zweisprachig(e.einleitung) + zieleListe(e));

    var p = e.patient, v = p.vitalwerte || {};
    h += abschnitt(e, "patient", ui("٢ · المريض والموقف"),
      '<div class="tabellerei"><table><tbody>' +
      zeile(ui("الاسم"), p.name) +
      zeile(ui("العمر"), p.alter) + zeile(ui("الجنس"), p.geschlecht) +
      zeile(ui("القسم"), p.station) + zeile(ui("التشخيص"), p.diagnose) +
      zeile(ui("ض. الدم"), v.rr) + zeile(ui("النبض"), v.puls) +
      zeile(ui("الحرارة"), v.temp) + zeile(ui("الأكسجة"), v.spo2) +
      "</tbody></table></div>" + zweisprachig(e.situation));

    var film = e.film || {};
    var filmBlock;
    if (film.ganz) {
      filmBlock = '<video controls preload="metadata" style="width:100%;border-radius:12px" src="' +
        esc(film.ganz) + '">' + untertitelSpur(film) + "</video>";
    } else if (film.probe && film.probe.pfad) {
      // مقطعٌ من مشهدٍ واحد. ويُقال ذلك فوقَه وتحته، فلا يُقرأ فيلماً كاملاً.
      filmBlock =
        ui('<p class="matt">لا فيلمَ كاملاً بعد. وهذا <b>مقطعٌ تجريبيٌّ</b> من مشهدٍ واحد:</p>') +
        '<video controls preload="metadata" style="width:100%;border-radius:12px"' +
        (film.probe.poster ? ' poster="' + esc(film.probe.poster) + '"' : "") +
        ' src="' + esc(film.probe.pfad) + '"></video>' +
        (txtNebenDeutsch(film.probe, "was_ar")
          ? '<p class="klein matt">' + txtNebenDeutsch(film.probe, "was_ar") + "</p>" : "") +
        '<p class="de klein">' + esc(film.probe.was_de) + "</p>";
    } else {
      filmBlock = ui('<p class="matt">لا ملفّ فيديو بعد. <code>media/</code> خارج المستودع، ') +
        ui("و<code>film.ganz</code> فارغ في هذه الحالة.</p>");
    }
    h += abschnitt(e, "film", ui("٣ · الفيديو كاملاً"), filmBlock);

    h += abschnitt(e, "szenen", ui("٤ · مشاهد الفيديو"),
      (film.szenen && film.szenen.length)
        ? '<ol class="schritte">' + film.szenen.map(function (s) {
            return "<li><strong>" + titelText(s, "titel_ar", "titel_de") + "</strong>" +
              (titelIstDeutsch(s, "titel_ar", "titel_de") ? ""
                : '<div class="de klein">' + esc(s.titel_de) + "</div>") +
              '<div class="klein matt">' + esc(s.von) + "s – " + esc(s.bis) + "s</div></li>";
          }).join("") + "</ol>"
        : ui('<p class="matt">لم تُقسَّم المشاهد بعد. البنيةُ <code>film.szenen[]</code> جاهزة ') +
          ui("وتنتظر الفيديو.</p>"));

    h += drehbuchBlock(e);

    // صوتُ السطرِ الواحد: مشغّلٌ صغيرٌ بجانب اسم المتكلّم، لا مقطعٌ
    // واحدٌ للمشهد كلِّه — فالمتعلّمُ يعيد الجملةَ التي عثر فيها وحدَها.
    function tonZeile(z) {
      if (!z.ton) return "";
      return '<audio class="satzton" controls preload="none" src="' +
        esc(z.ton) + '"></audio>';
    }
    var mitTon = alsListe(e.dialog).filter(function (z) { return z.ton; }).length;
    var gesamt = alsListe(e.dialog).length;
    h += abschnitt(e, "dialog", ui("٥ · الحوار"),
      (mitTon
        ? (mitTon === gesamt
            ? ui('<p class="quelle">لكلّ سطرٍ تسجيلُه. والأصواتُ مركَّبةٌ لا بشريّة.</p>')
            : ui('<p class="quelle">بعضُ السطورِ لها تسجيل. والأصواتُ مركَّبةٌ لا بشريّة.</p>'))
      /* شرطُ محمد حين قبِل الاختصارَ المنطوق (١٥ أيلول): «الاختصاراتُ
         مثل `hab` طبيعيّة، لكن ينبغي توضيحُها للمتعلّم إن اعتُمدت».
         وإلّا قرأ المتعلّمُ «habe» وسمع «hab» فظنّ أنّه أخطأ السمعَ أو
         أنّ في النصّ خطأً. */
      + ui('<p class="quelle klein">وقد تسمع في التسجيل اختصارَ الكلام ')
      + '<span class="de">„ich hab"</span>' + ui(" بدل ")
      + '<span class="de">„ich habe"</span>' + ui("، و")
      + '<span class="de">„ich mach"</span>' + ui(" بدل ")
      + '<span class="de">„ich mache"</span>'
      + ui('. وهذا طبيعيٌّ في الألمانيّة المحكيّة. والمكتوبُ هو الصورةُ ')
      + ui('الكاملة، وكلتاهما صحيحة.</p>')
        : "") +
      alsListe(e.dialog).map(function (z, zi) {
        /* الحلقةُ تحت أسطر الممرّضة وحدَها: هي دورُ المتعلّم في الامتحان،
           وهي ما عليه أن يقدر على قولِه هو، لا أن يسمعَه فقط. */
        return '<div class="zeile ' + esc(z.who) + '">' +
          '<div class="wer">' + ui(WER_AR[z.who] || esc(z.who)) + "</div>" +
          tonZeile(z) +
          zweisprachig(z, "de", "ar", "why") +
          (z.who === "Pflegekraft" && z.de
            ? sprechschleife("d:" + e.id + ":" + zi, z.de, z.ton || "", e.vokabeln)
            : "") + "</div>";
      }).join("") +
      ui("<details><summary>نصّ الفيديو — الألمانيّة متّصلة</summary><div>") +
      '<p class="de">' + alsListe(e.dialog).map(function (z) {
        return esc((WER_AR[z.who] ? z.who : z.who) + ": " + z.de);
      }).join("<br>") + "</p></div></details>");

    var mitWortton = alsListe(e.vokabeln).filter(function (w) { return w.ton; }).length;
    h += abschnitt(e, "vokabeln", ui("٦ · المفردات والأساليب الثلاثة"),
      ui('<p class="quelle">المعلومةُ الواحدة بثلاثة أساليب.</p>') +
      (mitWortton
        ? ui('<p class="quelle">اسمع المصطلح، ثمّ سجّل نفسَك وقارن. ') +
          ui("<b>تسجيلُك يبقى في متصفّحك</b>: لا يُرفع ولا يُحفَظ، ويزول بإغلاق الصفحة.</p>")
        : "") +
      '<div class="tabellerei"><table><thead><tr>' +
      ui("<th>الألمانيّة</th><th>العربيّة</th><th>مع المريض</th><th>مع الفريق</th><th>في التوثيق</th>") +
      "</tr></thead><tbody>" + alsListe(e.vokabeln).map(function (w, wi) {
        return '<tr><td data-k="' + ui("الألمانيّة") + '" class="de">' +
          esc(w.de) + sprechuebung(w, wi) + "</td>" +
          '<td data-k="' + ui("العربيّة") + '">' + txt(w, "ar") + "</td>" +
          '<td data-k="' + ui("مع المريض") + '" class="de klein">' + esc(w.patient) + "</td>" +
          '<td data-k="' + ui("مع الفريق") + '" class="de klein">' + esc(w.sag) + "</td>" +
          '<td data-k="' + ui("في التوثيق") + '" class="de klein">' + esc(w.dokument) + "</td></tr>";
      }).join("") + "</tbody></table></div>" + lueckenBlock(e));

    h += abschnitt(e, "ablauf", ui("٧ · الإجراء التمريضيّ الآمن"),
      '<ol class="schritte">' + alsListe(e.ablauf).map(function (s) {
        return "<li>" + txtNebenDeutsch(s, "schritt_ar") +
          '<div class="de klein">' + esc(s.schritt_de) + "</div>" +
          ui('<p class="sicher">السلامة: ') + txt(s, "sicherheit") + "</p>" +
          ui('<p class="quelle-klein">المصدر: ') + quelleText(s.quelle) + "</p></li>";
      }).join("") + "</ol>" + ordnungBlock(e));

    h += abschnitt(e, "aufklaerung", ui("٨ · التواصل مع المريض"),
      zweisprachig(e.aufklaerung) +
      ui('<div class="band warn">عند الرفض<span class="klein">') +
      txt(e.aufklaerung, "bei_ablehnung") + "</span></div>");

    h += abschnitt(e, "isbar", ui("٩ · تسليم الحالة بـ ISBAR"),
      '<div class="isbar">' + ISBAR.map(function (pair) {
        var f = e.isbar[pair[0]] || {};
        return '<div><div class="b">' + esc(ui(pair[1])) + "</div>" +
          zweisprachig(f) +
          (f._grenze ? '<p class="warum">' + txt(f, "_grenze") + "</p>" : "") + "</div>";
      }).join("") + "</div>");

    var dok = e.dokumentation;
    h += abschnitt(e, "dokumentation", ui("١٠ · التوثيق التمريضيّ"),
      '<div class="doku"><pre>' + esc(dok.text_de) + "</pre>" +
      "<p>" + txt(dok, "warum") + "</p>" +
      ui('<p class="klein matt">الزمن: ') + txt(dok, "zeit") + ui(" · التوقيع: ") + txt(dok, "zeichen") +
      "</p></div>");

    h += abschnitt(e, "fragen", ui("١١ · أسئلة الممتحن"),
      alsListe(e.fragen).map(function (f) {
        return '<details><summary><span class="de-zeile">' + esc(f.frage) +
          "</span></summary><div>" +
          "<p>" + txt(f, "antwort") + "</p></div></details>";
      }).join(""));

    h += abschnitt(e, "fehler", ui("١٢ · أخطاء خطيرة"),
      ui('<div class="tabellerei"><table><thead><tr><th>الخطأ</th><th>لماذا</th>') +
      ui("<th>الصواب</th><th>النوع</th></tr></thead><tbody>") +
      alsListe(e.fehler).map(function (f) {
        return '<tr><td data-k="' + ui("الخطأ") + '" class="de">' + esc(f.was) + "</td>" +
          '<td data-k="' + ui("لماذا") + '">' + txt(f, "warum") + "</td>" +
          '<td data-k="' + ui("الصواب") + '">' + txt(f, "fix") + "</td>" +
          '<td data-k="' + ui("النوع") + '">' + (f.schwere === "sicherheit"
            ? ui('<span class="chip rot">سلامة</span>')
            : ui('<span class="chip warn">لغة</span>')) + "</td></tr>";
      }).join("") + "</tbody></table></div>");

    h += abschnitt(e, "transfer", ui("١٣ · حالة نقل المعرفة"),
      zweisprachig(e.transfer, "situation_de", "situation_ar") +
      ui("<h3>المطلوب</h3>") + zweisprachig(e.transfer, "auftrag_de", "auftrag_ar") +
      transferModell(e));

    h += abschnitt(e, "bewertung", ui("١٤ · التقييم"),
      kriterien(e.bewertung.kriterien) +
      (e.bewertung.aufnahme ? aufnahmeBlock() : ""));

    h += abschnitt(e, "abschluss", ui("١٥ · النتيجة وخطّة المراجعة"),
      zweisprachig(e.abschluss.zusammenfassung) +
      (e.abschluss.wiederholen && e.abschluss.wiederholen.length
        ? ui("<h3>يُراجَع</h3><ul>") + txtListe(e.abschluss, "wiederholen") +
          "</ul>" : "") + zielpruefung(e));

    return h;
  }

  function drehbuchBlock(e) {
    // مادّةُ إنتاجٍ لفريق العمل. لا تُعرض في نسخة الطلّاب.
    var b = e.drehbuch;
    if (!b || window.MODUS === "lernende") return "";
    /* «حالةُ النصّ: stabil» كانت وحدَها في الترويسة، فقرأها القارئُ
       إذناً بالإنتاج. وهي لا تقول ذلك: النصُّ ثابتٌ، والفيديو شأنٌ آخر
       يقرّره محمد في curriculum/medien.json. فأُضيف حالُ الوسائط بجانبها. */
    var stand = (window.DATEN.medien_stand || {})[e.id] || "";
    var wort = stand === "angenommen" ? ui("فيديو مقبول")
      : stand === "entwurf" ? ui("فيديو مسوّدة")
      : stand === "abgelehnt" ? ui("فيديو مرفوض")
      : ui("لا فيديو مقبول");
    return ui('<div class="karte"><h2>قائمة اللقطات — لفريق الإنتاج</h2>') +
      '<p class="quelle">' + alsListe(b.szenen).length + ui(" مشهداً · ") + b.gesamt_s +
      ui(" ثانية · حالةُ النصّ: ") +
      '<span class="chip ' + (b.status === "stabil" ? "gedeckt" : "warn") + '">' +
      esc(b.status) + "</span>" +
      ' <span class="chip ' + (stand === "angenommen" ? "gedeckt" : "warn") + '">' +
      wort + "</span></p>" +
      ui('<div class="band warn">قائمةُ اللقطات مادّةُ عملٍ لا أمرَ إنتاج.') +
      ui('<span class="klein">لا يُنتَج فيديو ولا يُربَط بالمحتوى قبل أن يقبله ') +
      ui("محمد فيصير حالُه <code>angenommen</code> في <code>curriculum/medien.json</code>. ") +
      ui("وقائمةٌ لا فيديو مقبولٌ لها قد تكون قديمةً وقد تُعاد.</span></div>") +
      ui('<p class="klein matt">المستندُ الكامل: <code>drehbuch/') + esc(e.id) +
      ui(".md</code> — مولَّدٌ بـ <code>tools/drehbuch.py</code></p>") +
      '<div class="tabellerei"><table><thead><tr>' +
      ui("<th>#</th><th>المشهد</th><th>الزمن</th><th>اللقطة</th><th>أسطر الحوار</th>") +
      "</tr></thead><tbody>" + alsListe(b.szenen).map(function (s) {
        return '<tr><td class="n" data-k="#">' + s.nr + "</td>" +
          '<td data-k="' + ui("المشهد") + '">' + txt(s, "titel_ar") +
          '<div class="de klein matt">' + esc(s.titel_de) + "</div></td>" +
          '<td data-k="' + ui("الزمن") + '" class="n">' + s.von_s + "–" + s.bis_s + ui(" ث</td>") +
          '<td data-k="' + ui("اللقطة") + '" class="klein">' + esc(s.einstellung) + "</td>" +
          '<td data-k="' + ui("أسطر الحوار") + '" class="klein matt">' +
          ((s.dialog || []).length
            ? s.dialog.map(function (j) { return "dialog[" + j + "]"; }).join(ui("، "))
            : "—") + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
  }

  function zeile(k, v) {
    return v == null || v === "" ? "" :
      '<tr><td data-k="' + esc(k) + '" class="n">' + esc(k) + "</td>" +
      '<td data-k="' + esc(k) + '">' + esc(v) + "</td></tr>";
  }

  /* قراءةُ قائمةٍ من عنصرٍ أو من بيانات المنهج. كان العارضُ يكتب `e.fragen.map(...)` مباشرةً،
     فيتّكل على أنّ المخطَّط يضمن الحقل. وضمانُ المخطَّط في مكانٍ آخر:
     عنصرٌ ينقصه حقلٌ **يُسقط الصفحة كلَّها** لا القسمَ وحدَه. وكان
     `fragen: []` في الدروس العشرين يستر هذا لو مرّ درسٌ بمسار الحالات.
     والاسمُ `alsListe` لا `liste`: في السطر ١٧٠ متغيّرٌ محلّيٌّ بذلك
     الاسم، وحارسُ `test_app_js` كشف التعارضَ فور وقوعه. */
  function alsListe(x) { return Array.isArray(x) ? x : []; }

  function abschnitt(e, kennung, titel, inhalt) {
    var f = zustand.fortschritt[e.id] || { schritte: [] };
    var fertig = f.schritte.indexOf(kennung) >= 0;
    return '<div class="karte" id="a-' + kennung + '" data-a="' + kennung + '">' +
      "<h2>" + esc(titel) + "</h2>" + inhalt +
      '<div class="werkzeug"><button class="fertig' + (fertig ? " haupt" : "") +
      '" data-fall="' + esc(e.id) + '" data-a="' + kennung + '">' +
      (fertig ? ui("تمّ ✓") : ui("علّم أنّه تمّ")) + "</button></div></div>";
  }

  function fortschrittBalken(e) {
    var f = zustand.fortschritt[e.id] || { schritte: [] };
    var anteil = Math.round(f.schritte.length / SCHRITTE.length * 100);
    return ui('<div class="karte" id="balken"><h2>تقدّمك</h2>') +
      '<div class="fort"><i style="width:' + anteil + '%"></i></div>' +
      '<p class="klein matt">' + f.schritte.length + ui(" من ") + SCHRITTE.length +
      ui(" أقسام · ") + anteil + ui("٪") +
      (f.letzte ? ' — <a href="#a-' + esc(f.letzte) + ui('">عُد إلى آخر موضع</a>') : "") +
      "</p></div>";
  }

  /* ————— محاكاةُ الامتحان بوقت —————
     جولةٌ على بنية § 45: محطّةٌ عمليّةٌ ومحطّةٌ شفهيّةٌ وأسئلةٌ مكتوبة،
     بوقتٍ **مجموعٍ من أزمنة المحطّات المكتوبة في المحتوى** لا مخترَع.

     وثلاثةُ حدود لا تُتجاوَز: **تقييمٌ تدريبيٌّ لا رسميّ**، ولا تنبّؤَ
     بنتيجة، ولا تصحيحَ آليّاً لما لا جوابَ واحدَ له — فالمحطّتان
     تقييمٌ ذاتيٌّ بمعاييرهما المكتوبة.

     والوقتُ بلحظةِ نهايةٍ مطلقةٍ محفوظة: تُغلَق الصفحةُ أو ينقطع العملُ
     فيُحسَب الباقي بصدقٍ عند العودة، ولا يُمنَح المتعلّمُ وقتاً لم
     يستحقّه ولا يُسلَب وقتاً استحقّه. */

  var prUhr = null;

  function prRunde() {
    var lauf = zustand.pruefung;
    if (!window.PRUEFUNG) return null;
    if (lauf && lauf.teile) {
      var hole = function (kennung) {
        return window.DATEN.elemente.filter(function (e) { return e.id === kennung; })[0];
      };
      var fragen = [];
      (lauf.teile.fragen || []).forEach(function (kennung) {
        DIAGNOSE.alleFragen(window.DATEN.elemente).forEach(function (f) {
          if (f.id === kennung) fragen.push(f);
        });
      });
      return { praktisch: hole(lauf.teile.praktisch), muendlich: hole(lauf.teile.muendlich),
               fragen: fragen, dauer_min: lauf.dauer_min };
    }
    return PRUEFUNG.bauen(window.DATEN.elemente, { gesehen: (zustand.pruefungGesehen || []) });
  }

  function prWarnung() {
    return ui('<div class="band warn">تقييمٌ تدريبيٌّ لا رسميّ') +
      ui('<span class="klein">هذه محاكاةٌ من محتوى الدورة على بنية ') +
      ui("§ 45 PflAPrV. <b>ليست امتحاناً، ولا تقييماً رسميّاً، ولا اعتماداً، ") +
      ui("ولا تنبّؤاً بنتيجتك.</b> والتصحيحُ الآليُّ للأسئلة وحدَها؛ ") +
      ui("والمحطّتان تقيسهما بنفسك بمعاييرهما. ولا تدخلها جملُ التمارين ") +
      ui("المسوّدة.</span></div>");
  }

  function prStation(e, teil) {
    if (!e) return "";
    return '<div class="karte"><h2>' +
      (teil === "praktisch" ? ui("المحطّة العمليّة") : ui("المحطّة الشفهيّة")) +
      " — " + esc(e.id) + "</h2>" +
      '<p class="quelle">' + esc(e.zeit_min) + ui(" دقيقة") + "</p>" +
      "<h3>" + txt(e, "titelAr") + "</h3>" +
      zweisprachig(e.auftrag) + "</div>";
  }

  function prSelbstliste(e) {
    if (!e) return "";
    var an = ((zustand.pruefung || {}).selbst || {})[e.id] || [];
    return '<div class="karte" data-selbst="' + esc(e.id) + '"><h2>' +
      ui("قيّم نفسَك في ") + esc(e.id) + "</h2>" +
      ui('<p class="klein matt">بمعايير هذه المحطّة كما هي في المحتوى. ') +
      ui("<b>حكمُك أنت</b> — لا تصحيحَ آليّاً لها.</p><ul class=\"pr-selbst\">") +
      alsListe(e.kriterien).map(function (k, i) {
        return '<li><label><input type="checkbox" data-k="' + i + '"' +
          (an.indexOf(i) >= 0 ? " checked" : "") + "> <b>" + txt(k, "name") +
          "</b> — " + txt(k, "was_zaehlt") + "</label></li>";
      }).join("") + "</ul>" +
      ui("<details><summary>الإجابةُ النموذجيّة لهذه المحطّة</summary><ol>") +
      alsListe(e.modell).map(function (m) {
        return '<li class="de">' + esc(m) + "</li>";
      }).join("") + "</ol></details></div>";
  }

  function pruefungSeite() {
    var runde = prRunde();
    if (!runde) {
      return ui("<h1>محاكاة الامتحان</h1>") +
        ui('<div class="band rot">لا محطّاتِ تدريبٍ كافية لبناء جولة.</div>');
    }
    var lauf = zustand.pruefung;
    var h = ui("<h1>محاكاة الامتحان — بوقت</h1>") + prWarnung();

    /* ١ · لا جولةَ بعد */
    if (!lauf || !lauf.aktiv) {
      var frueher = (zustand.pruefungVerlauf || []).slice(-1)[0];
      h += ui('<div class="karte"><h2>ما ستفعله</h2><ol>') +
        ui("<li>محطّةٌ عمليّة: ") + esc(runde.praktisch.id) + " · " +
        esc(runde.praktisch.zeit_min) + ui(" دقيقة</li>") +
        ui("<li>محطّةٌ شفهيّة: ") + esc(runde.muendlich.id) + " · " +
        esc(runde.muendlich.zeit_min) + ui(" دقيقة</li>") +
        ui("<li>أسئلةٌ مكتوبة: ") + alsListe(runde.fragen).length +
        ui(" أسئلة، دقيقةٌ لكلٍّ منها</li></ol>") +
        '<p class="quelle">' + ui("الوقت كلُّه: ") + runde.dauer_min + ui(" دقيقة") +
        ui(" — مجموعُ أزمنة المحطّات المكتوبة في المحتوى") + "</p>" +
        (frueher ? '<p class="klein matt">' + ui("آخر جولة: ") + esc(frueher.datum) +
          ui(" · الأسئلة ") + frueher.richtig + " / " + frueher.gesamt + "</p>" : "") +
        '<div class="werkzeug"><button id="pr-start" class="haupt">' +
        ui("ابدأ الجولة") + "</button></div></div>";
      return h;
    }

    /* ٢ · جولةٌ انتهى وقتُها في غياب المتعلّم */
    if (PRUEFUNG.abgelaufen(lauf) && !lauf.fertig) {
      h += ui('<div class="band warn">انتهى الوقتُ') +
        ui('<span class="klein">انقضى وقتُ الجولة، وما أجبتَ عنه محفوظ. ') +
        ui("وهذا ما يجري في الامتحان أيضاً: ينتهي الوقتُ حيث انتهى.</span></div>");
    }

    /* ٣ · الجولةُ جارية أو منتهية */
    var fertig = lauf.fertig || PRUEFUNG.abgelaufen(lauf);
    h += '<div class="karte"><h2>' + ui("الوقت") + "</h2>" +
      '<p class="quelle"><span id="pr-uhr">' +
      PRUEFUNG.zeitText(PRUEFUNG.restSekunden(lauf)) + "</span>" +
      ui(" من ") + lauf.dauer_min + ui(" دقيقة") + "</p>" +
      '<div class="werkzeug">' +
      (fertig ? "" : '<button id="pr-fertig" class="haupt">' + ui("أنهِ الآن") + "</button>") +
      '<button id="pr-verwerfen">' + ui("احذف الجولة") + "</button>" +
      '<span class="klein matt">' +
      ui("إجاباتُك تُحفَظ أوّلاً بأوّل في متصفّحك، فلا يضيع شيءٌ بالانقطاع.") +
      "</span></div></div>";

    h += prStation(runde.praktisch, "praktisch") + prStation(runde.muendlich, "muendlich");

    h += '<div class="karte" id="pr-fragen"><h2>' + ui("الأسئلة المكتوبة") + "</h2>" +
      '<ol class="quizliste">' + alsListe(runde.fragen).map(function (f) {
        var gewaehlt = (lauf.antworten || {})[f.id];
        return '<li data-q="' + esc(f.id) + '"><div class="qtext">' +
          txt(f.frage, "frage_ar") + "</div>" +
          alsListe(f.frage.optionen).map(function (o, j) {
            return '<label class="opt" data-o="' + j + '">' +
              '<input type="radio" name="pr-' + esc(f.id) + '" value="' + j + '"' +
              (gewaehlt === j ? " checked" : "") + (fertig ? " disabled" : "") + ">" +
              '<span class="otext">' + txt(o, "text_ar") +
              '<span class="zeichen"></span>' +
              '<span class="warum-opt">' + txt(o, "warum") + "</span></span></label>";
          }).join("") + "</li>";
      }).join("") + "</ol></div>";

    if (!fertig) return h;

    /* ٤ · النتيجة */
    var erg = PRUEFUNG.bewerten(lauf, runde);
    h += '<div class="karte"><h2>' + ui("نتيجةُ الجزء المصحَّح آليّاً") + "</h2>" +
      '<p class="quelle">' + erg.richtig + " / " + erg.gesamt + ui(" من الأسئلة المكتوبة") +
      "</p>" +
      ui('<p class="klein matt">هذا كلُّ ما يمكن تصحيحُه آليّاً. والمحطّتان ') +
      ui("تقيسهما بنفسك تحت، ولا يُجمَع الاثنان في درجةٍ واحدة.</p>") +
      (erg.offen.length
        ? ui("<h3>ما لم تُصِبه</h3><ul>") + erg.offen.map(function (o) {
            return "<li>" + txt(o.frage.frage, "frage_ar") +
              '<div class="klein">' + ui("الصواب: ") +
              txt(o.frage.frage.optionen[o.soll], "text_ar") + "</div>" +
              '<div class="klein matt">' + txt(o.frage.frage.optionen[o.soll], "warum") +
              "</div></li>";
          }).join("") + "</ul>"
        : "") + "</div>";
    h += prSelbstliste(runde.praktisch) + prSelbstliste(runde.muendlich);
    h += ui('<div class="karte"><h2>وبعد؟</h2>') +
      ui('<p>ما أخطأتَه من الأسئلة يدخل <a href="#/wiederholung">المراجعة</a> ') +
      ui('من تلقاء نفسِه. و<a href="#/fortschritt">لوحةُ التقدّم</a> تعرض ') +
      ui("ما جرى.</p>") +
      '<div class="werkzeug"><button id="pr-neu">' + ui("جولةٌ جديدة") +
      "</button></div></div>";
    return h;
  }

  function pruefungBinden() {
    if (prUhr) { clearInterval(prUhr); prUhr = null; }
    var anfang = document.getElementById("pr-start");
    if (anfang) {
      anfang.onclick = function () {
        var runde = PRUEFUNG.bauen(window.DATEN.elemente,
          { gesehen: zustand.pruefungGesehen || [] });
        if (!runde) return;
        zustand.pruefung = PRUEFUNG.starten(runde);
        sichern();
        leiten();
      };
      return;
    }
    var lauf = zustand.pruefung;
    if (!lauf) return;
    var runde = prRunde();

    var verwerfen = document.getElementById("pr-verwerfen");
    if (verwerfen) verwerfen.onclick = function () {
      delete zustand.pruefung; sichern(); leiten();
    };
    var neu = document.getElementById("pr-neu");
    if (neu) neu.onclick = function () {
      zustand.pruefungGesehen = (zustand.pruefungGesehen || [])
        .concat([lauf.teile.praktisch, lauf.teile.muendlich], lauf.teile.fragen || []);
      delete zustand.pruefung; sichern(); leiten();
    };

    /* الحفظُ عند كلّ نقرة، لا عند الإنهاء: انقطاعٌ بعد سؤالين لا يضيّعهما. */
    Array.prototype.forEach.call(
      document.querySelectorAll('#pr-fragen input[type="radio"]'), function (ein) {
        ein.onchange = function () {
          var kennung = ein.name.slice(3);
          lauf.antworten = lauf.antworten || {};
          lauf.antworten[kennung] = parseInt(ein.value, 10);
          sichern();
        };
      });

    Array.prototype.forEach.call(document.querySelectorAll("[data-selbst]"), function (block) {
      var kennung = block.getAttribute("data-selbst");
      Array.prototype.forEach.call(block.querySelectorAll("input"), function (ein) {
        ein.onchange = function () {
          var an = [];
          Array.prototype.forEach.call(block.querySelectorAll("input"), function (e2) {
            if (e2.checked) an.push(parseInt(e2.getAttribute("data-k"), 10));
          });
          lauf.selbst = lauf.selbst || {};
          lauf.selbst[kennung] = an;
          sichern();
        };
      });
    });

    var fertig = document.getElementById("pr-fertig");
    if (fertig) fertig.onclick = function () {
      lauf.fertig = true;
      prAbschliessen(lauf, runde);
      leiten();
    };

    var uhr = document.getElementById("pr-uhr");
    if (uhr && !lauf.fertig && !PRUEFUNG.abgelaufen(lauf)) {
      prUhr = setInterval(function () {
        var rest = PRUEFUNG.restSekunden(lauf);
        uhr.textContent = PRUEFUNG.zeitText(rest);
        if (rest <= 0) {
          clearInterval(prUhr); prUhr = null;
          lauf.fertig = true;
          prAbschliessen(lauf, runde);
          leiten();
        }
      }, 1000);
    }
  }

  /* إنهاءُ الجولة: تُسجَّل النتيجةُ المصحَّحةُ آليّاً، **ويدخل ما أُخطئ
     فيه المراجعةَ** كما يدخلها خطأُ أيّ اختبار. */
  function prAbschliessen(lauf, runde) {
    var erg = PRUEFUNG.bewerten(lauf, runde);
    zustand.pruefungVerlauf = (zustand.pruefungVerlauf || []).concat([{
      datum: new Date().toISOString().slice(0, 10),
      richtig: erg.richtig, gesamt: erg.gesamt,
      praktisch: runde.praktisch.id, muendlich: runde.muendlich.id
    }]).slice(-10);
    zustand.quiz = zustand.quiz || {};
    erg.offen.forEach(function (o) {
      var kennung = o.frage.element;
      var alt = zustand.quiz[kennung] || { prozent: 0, datum: "", falsch: [] };
      if (alt.falsch.indexOf(o.frage.id) < 0) alt.falsch = alt.falsch.concat([o.frage.id]);
      alt.datum = new Date().toISOString().slice(0, 10);
      zustand.quiz[kennung] = alt;
    });
    sichern();
  }

  /* ————— لوحةُ التقدّم —————
     قسمان لا يختلطان: **ما قاسه البرنامج** (سؤالٌ صائبٌ أو خاطئ، قسمٌ
     عُلّم أنّه تمّ) و**ما قاله المتعلّمُ عن نفسِه** (حكمُه على نطقه،
     وإقرارُه بالأهداف). ولا رقمَ واحدٌ يجمعهما، ولا «مستوًى»، ولا
     تنبّؤٌ بامتحان — قرارُ محمد نصّاً. */

  function ftBalken(richtig, gesamt) {
    var anteil = gesamt ? Math.round(richtig / gesamt * 100) : 0;
    return '<div class="fort"><i style="width:' + anteil + '%"></i></div>';
  }

  function fortschrittSeite() {
    var E = window.DATEN.elemente;
    var a = FORTSCHRITT.abschluss(zustand, E);
    var bereiche = FORTSCHRITT.bereiche(zustand, E);
    var fehler = FORTSCHRITT.haeufigeFehler(zustand, E);
    var posten = whPosten();
    var faellig = WIEDERHOLUNG.faellige(posten, zustand);
    var selbst = FORTSCHRITT.selbsturteil(zustand);
    var ziele = FORTSCHRITT.ziele(zustand, E);

    var h = ui("<h1>تقدّمك</h1>") +
      ui('<p class="matt">كلُّ ما في هذه الصفحة من متصفّحك وحدَه: لا حساب، ') +
      ui("ولا خادم، ولا شيءَ يُرسَل. وتمسحه متى شئت من الصفحات نفسِها.</p>");

    /* ١ · ما جرى */
    h += ui('<div class="karte"><h2>ما أنجزتَه</h2>') +
      '<div class="tabellerei"><table><tbody>' +
      zeile(ui("عناصرُ بدأتَها"), a.begonnen + ui(" من ") + a.elemente) +
      zeile(ui("أقسامٌ علّمتَ أنّها تمّت"), a.abschnitte) +
      zeile(ui("اختباراتُ وحداتٍ أدّيتَها"), a.quizzes) +
      zeile(ui("منها فوق حدّ النجاح"), a.bestanden) +
      "</tbody></table></div></div>";

    /* ٢ · القوّة والضعف — وقائعُ مقيسة */
    h += ui('<div class="karte"><h2>الإصابة بحسب المجال</h2>') +
      ui('<p class="klein matt">من أسئلة الاختبارات والتشخيص. سؤالٌ له ') +
      ui("جوابٌ صائبٌ واحد، فهذه وقائعُ لا تقدير.</p>");
    if (!bereiche.length) {
      h += ui('<p class="matt">لم تُجِب عن اختبارٍ بعد.</p>');
    } else {
      h += '<div class="tabellerei"><table><thead><tr>' +
        ui("<th>المجال</th><th>أصبتَ</th><th></th></tr></thead><tbody>") +
        bereiche.map(function (b) {
          return '<tr><td data-k="' + ui("المجال") + '"><span class="chip">' +
            esc(b.bereich) + "</span> " + bereichName(b.bereich) + "</td>" +
            '<td data-k="' + ui("أصبتَ") + '">' + b.richtig + " / " + b.gesamt + "</td>" +
            "<td>" + ftBalken(b.richtig, b.gesamt) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }
    h += "</div>";

    /* ٣ · الأخطاء المتكرّرة */
    h += ui('<div class="karte"><h2>أخطاءٌ تكرّرت</h2>') +
      ui('<p class="klein matt">ما أخطأتَ فيه مرّتين فأكثرَ في المراجعة.</p>');
    h += fehler.length
      ? "<ul>" + fehler.slice(0, 12).map(function (x) {
          var p = x.posten;
          return "<li>" + '<span class="chip">' + ui(WH_TYP[p.typ] || p.typ) + "</span> " +
            (p.typ === "frage" ? txt(p.frage, "frage_ar") : esc(p.text || "")) +
            ' <span class="klein matt">' + ui("أخطأتَ فيه ") + x.falsch +
            ui(" مرّات") + (p.element ? ' — <a href="#/e/' + esc(p.element) + '">' +
              esc(p.element) + "</a>" : "") + "</span></li>";
        }).join("") + "</ul>"
      : ui('<p class="matt">لا خطأَ تكرّر — أو لم تراجع بعد.</p>');
    h += "</div>";

    /* ٤ · المستحقُّ اليوم */
    h += ui('<div class="karte"><h2>مستحقٌّ للمراجعة</h2>') +
      '<p class="quelle">' + faellig.length + ui(" مستحقٌّ اليوم من ") +
      posten.length + ui(" بنداً") + "</p>" +
      ui('<p><a href="#/wiederholung">افتح المراجعة</a></p></div>');

    /* ٥ · ما قلتَه عن نفسك — مفصولٌ عمّا قبله */
    h += ui('<div class="karte"><h2>ما قلتَه أنت عن نفسك</h2>') +
      ui('<div class="band warn">هذا قولُك لا قياسُنا') +
      ui('<span class="klein">حكمُك على نطقك وإقرارُك بالأهداف رأيُك أنت. ') +
      ui("لا يُجمَع مع ما فوقَه في رقمٍ واحد، ولا يصير درجةً، ") +
      ui("ولا تصحيحَ آليّاً للنطق هنا.</span></div>") +
      '<div class="tabellerei"><table><tbody>' +
      zeile(ui("جملٌ سجّلتَ نطقَها"), selbst.saetze) +
      zeile(ui("محاولاتُ نطقٍ"), selbst.versuche) +
      zeile(ui("قلتَ عنها: يحتاج إعادة"), selbst.wieder) +
      zeile(ui("قلتَ عنها: مقبول"), selbst.ok) +
      zeile(ui("قلتَ عنها: واثق"), selbst.sicher) +
      zeile(ui("بنودُ تقييمٍ ذاتيٍّ أقررتَ بها"),
        selbst.punkte + ui(" من ") + selbst.punkteGesamt) +
      zeile(ui("أهدافٌ قلتَ إنّك تستطيعها"),
        ziele.bestaetigt + ui(" من ") + ziele.gesamt) +
      "</tbody></table></div></div>";

    return h;
  }

  /* ————— المراجعةُ المتباعدة —————
     ما يعود إلى المتعلّم **ممّا فعله هو**: سؤالٌ أخطأه، وجملةٌ حكم على
     نطقه فيها بنفسِه، ومفردةٌ نسيها. والجدولةُ واحدةٌ مكتوبةٌ على الصفحة
     — صناديقُ لايتنر — وقابلةٌ لإعادة الضبط بزرّ.

     ولا يصير حكمُ المتعلّم على نفسِه واقعةً آليّة: بندُ النطق يقول عند
     كلّ عرضٍ إنّه **بحسب حكمك أنت**. */

  function whPosten() {
    return window.WIEDERHOLUNG ? WIEDERHOLUNG.sammle(zustand, window.DATEN.elemente) : [];
  }

  function whZeile(x) {
    var s = WIEDERHOLUNG.stand(x, zustand);
    var kopf = x.typ === "frage" ? txt(x.frage, "frage_ar")
      : x.typ === "satz" ? '<span class="de">' + esc(x.text) + "</span>"
      : '<span class="de">' + esc(x.text) + "</span> — " + esc(x.ar || "");
    return '<li data-s="' + esc(x.schluessel) + '">' +
      '<div class="wh-kopf"><span class="chip">' + ui(WH_TYP[x.typ] || x.typ) +
      "</span> " + kopf + "</div>" +
      '<p class="klein matt">' + ui(WH_GRUND[x.grund] || x.grund) +
      (x.auch ? " · " + ui(WH_GRUND[x.auch] || x.auch) : "") +
      (x.datum ? " · " + esc(x.datum) : "") +
      (x.element ? ' — <a href="#/e/' + esc(x.element) + '">' + esc(x.element) + "</a>" : "") +
      "</p>" +
      (x.typ === "satz"
        ? ui('<p class="klein matt">هذا حكمُك أنت على نطقك، لا قياسٌ آليّ.</p>')
        : "") +
      '<div class="werkzeug"><button class="wh-gut">' + ui("عرفتُه الآن") + "</button>" +
      '<button class="wh-schlecht">' + ui("ما زال صعباً") + "</button>" +
      '<span class="klein matt">' +
      (s.neu ? ui("جديدٌ في المراجعة") : ui("الصندوق ") + s.box + ui(" · يعود ") +
        tageText(s.tage, true)) + "</span></div></li>";
  }

  function wiederholungSeite() {
    var posten = whPosten();
    var faellig = WIEDERHOLUNG.faellige(posten, zustand);
    var z = WIEDERHOLUNG.zaehlen(posten, zustand);
    var h = ui("<h1>المراجعة — ما يعود إليك اليوم</h1>") +
      ui('<p class="matt">لا يدخل هنا إلّا ما فعلتَه أنت: سؤالٌ أخطأتَه، ') +
      ui("وجملةٌ حكمتَ على نطقك فيها، ومفردةٌ نسيتَها. ولا شيءَ يُرسَل، ") +
      ui("وكلُّ هذا في متصفّحك.</p>");

    h += ui('<div class="karte"><h2>الجدولة — كيف تعمل</h2>') +
      ui('<p>ما تعرفه يرتفع صندوقاً فيتباعد موعدُه، وما تنساه يعود إلى ') +
      ui("الصندوق الأوّل. والفواصلُ بالأيّام:</p>") +
      '<p class="quelle">' + KARTEN.INTERVALLE.map(function (t, i) {
        return ui("صندوق ") + i + ": " + tageText(t, false);
      }).join(" · ") + "</p>" +
      '<div class="werkzeug"><button id="wh-zuruecksetzen">' +
      ui("أعد ضبط جدولة المراجعة") + "</button>" +
      '<span class="klein matt">' +
      ui("يمسح مواعيدَ هذه البنود وحدَها — لا إجاباتِك ولا تسجيلاتِك.") +
      "</span></div></div>";

    h += ui('<div class="karte"><h2>الحال</h2>') +
      '<p class="quelle">' + z.gesamt + ui(" بنداً في المراجعة · ") +
      z.faellig + ui(" مستحقٌّ اليوم") + "</p>" +
      '<p class="klein matt">' + ui("المستحقُّ اليوم: ") +
      WIEDERHOLUNG.TYPEN.map(function (t) {
        return ui(WH_TYP[t]) + " " + (z[t] || 0);
      }).join(" · ") + "</p></div>";

    if (!posten.length) {
      return h + ui('<div class="band">لا شيءَ في المراجعة بعد.') +
        ui('<span class="klein">تدخل البنودُ هنا وحدَها: بعد اختبارِ وحدةٍ ') +
        ui("تُخطئ فيه، أو بعد أن تحكم على نطقك في حلقة الكلام، أو بعد ") +
        ui("بطاقةٍ تنساها.</span></div>");
    }
    if (!faellig.length) {
      return h + ui('<div class="band">لا مستحقَّ اليوم.') +
        ui('<span class="klein">البنودُ كلُّها مجدوَلةٌ في المستقبل. ') +
        ui("والجدولةُ فوق، وزرُّ إعادة الضبط معها.</span></div>");
    }
    return h + ui('<div class="karte"><h2>مستحقٌّ اليوم</h2><ul class="wh-liste">') +
      faellig.map(whZeile).join("") + "</ul></div>";
  }

  function wiederholungBinden() {
    var liste = document.querySelector("ul.wh-liste");
    var knopf = document.getElementById("wh-zuruecksetzen");
    if (knopf) {
      knopf.onclick = function () {
        var posten = whPosten();
        zustand.karten = zustand.karten || {};
        posten.forEach(function (x) {
          var alt = zustand.karten[x.schluessel];
          if (!alt) return;
          /* بندُ الخطأ والنطق يعود جديداً بحذفه. أمّا المفردةُ فسجلُّها
             هو نفسُه ما يجعلها «صعبة»، فلو حُذف خرجت من المراجعة صامتةً
             — والزرُّ يَعِد بمسح المواعيد لا بمسح ما جرى. فتُردّ إلى
             الصندوق الأوّل ويبقى عدُّ خطئها. */
          if (x.typ === "wort") {
            zustand.karten[x.schluessel] = {
              schluessel: x.schluessel, box: 0, faellig: KARTEN.heute(),
              richtig: alt.richtig || 0, falsch: alt.falsch || 0,
              zuletzt: alt.zuletzt || ""
            };
          } else {
            delete zustand.karten[x.schluessel];
          }
        });
        sichern();
        leiten();
      };
    }
    if (!liste) return;
    Array.prototype.forEach.call(liste.querySelectorAll("li"), function (li) {
      var schluessel = li.getAttribute("data-s");
      function antworten(gewusst) {
        zustand.karten = zustand.karten || {};
        var alt = zustand.karten[schluessel] || KARTEN.neu(schluessel);
        zustand.karten[schluessel] = KARTEN.antworten(alt, gewusst);
        sichern();
        leiten();
      }
      li.querySelector(".wh-gut").onclick = function () { antworten(true); };
      li.querySelector(".wh-schlecht").onclick = function () { antworten(false); };
    });
  }

  /* ————— مهمّةُ النقل: بمَ تُقاس، وأين إجابتُها —————
     كانت المهمّةُ تُطلَب من المتعلّم ثمّ لا يتلقّى عليها شيئاً. وقرارُ
     محمد: تُبنى لها إجابةٌ نموذجيّةٌ ومعاييرُ **من المحتوى الموثوق
     الموجود وحدَه**. فما يُعرَض هنا ليس نصّاً جديداً بل **مرجعٌ مفتوح**:
     معاييرُ الحالة نفسُها، وأسئلتُها المهنيّةُ بإجاباتها، وخطواتُ
     إجرائها. وما لا مادّةَ له في الحالة **يُقال إنّه بلا مصدر** ولا
     يُخترَع له جواب. */

  function transferModell(e) {
    var m = (e.transfer || {}).modell;
    if (!m) return "";
    var masse = alsListe((e.bewertung || {}).kriterien);
    var h = ui("<h3>بمَ تُقاس هذه المهمّة</h3>") +
      ui('<p class="klein matt">معاييرُ هذه الحالة نفسُها — لا معاييرُ ') +
      ui("أخرى كُتبت للمهمّة.</p><ul>") +
      alsListe(m.kriterien).map(function (name) {
        var k = masse.filter(function (x) { return x.name === name; })[0];
        return "<li><b>" + (k ? txt(k, "name") : esc(name)) + "</b>" +
          (k ? " — " + txt(k, "was_zaehlt") : "") + "</li>";
      }).join("") + "</ul>";

    var teile = alsListe(m.fachfragen).map(function (i) {
      var f = alsListe(e.fragen)[i];
      return f ? '<li><div class="de"><b>' + esc(f.frage) + "</b></div>" +
        '<div class="klein">' + txt(f, "antwort") + "</div>" +
        '<p class="quelle-klein">' + ui("من ") + "<code>fragen[" + i + "]</code></p></li>" : "";
    }).concat(alsListe(m.ablauf).map(function (i) {
      var a = alsListe(e.ablauf)[i];
      return a ? "<li>" + txt(a, "schritt_ar") +
        '<div class="de klein">' + esc(a.schritt_de) + "</div>" +
        (a.sicherheit ? ui('<p class="sicher">السلامة: ') + txt(a, "sicherheit") + "</p>" : "") +
        '<p class="quelle-klein">' + ui("من ") + "<code>ablauf[" + i + "]</code></p></li>" : "";
    })).join("");

    if (teile) {
      h += ui("<details><summary>الإجابةُ النموذجيّة — مركّبةٌ من هذه الحالة</summary>") +
        ui('<p class="klein matt">لا نصَّ جديداً هنا: هذه مقاطعُ من الحالة ') +
        ui("نفسِها، ومكانُ كلٍّ منها مكتوبٌ تحته. حاوِل أوّلاً ثمّ افتح.</p>") +
        '<ul class="t-modell">' + teile + "</ul></details>";
    }
    if (alsListe(m.offen).length) {
      h += ui('<div class="band warn">جوانبُ تحتاج محتوًى من مختصّ') +
        '<span class="klein"><ul>' + txtListe(m, "offen") + "</ul>" +
        ui("لا مادّةَ لها في هذه الحالة، ولم يُكتَب لها جوابٌ من الاجتهاد. ") +
        ui("وهي مسجَّلةٌ في <code>curriculum/luecken.md</code> بانتظار مختصّ.") +
        "</span></div>";
    }
    if ((m.status || "ungeprueft") !== "geprueft") {
      h += ui('<p class="klein matt">تركيبُ هذه الإجابة ومعاييرُها <b>مسوّدة</b> ') +
        ui("تنتظر مراجعةَ مدرّس.</p>");
    }
    return h;
  }

  /* ————— الاختبارُ التشخيصيّ أوّلَ الدورة —————
     اثنا عشر سؤالاً من اختبارات الوحدات — لا أسئلةَ جديدة — تدلّ على
     **أين يبدأ** المتعلّم. وليست قياسَ مستوًى ولا تقييماً رسميّاً، ويُقال
     ذلك في الصفحة لا في ملفٍّ جانبيّ.

     ويُحكَم هنا على إجابةٍ، فينطبق شرطُ م٥: لكلّ خيارٍ تفسيرُه، ويُعرَض
     تفسيرُ ما اختاره المتعلّمُ وتفسيرُ الصواب. والموضعُ مسجَّلٌ في
     `tests/test_rueckmeldung.py`. */

  /* المحاولةُ رقمُها محفوظ، وما رآه المتعلّمُ محفوظٌ معه — فالاختيارُ
     يتبدّل بين المحاولات والتغطيةُ لا تتبدّل. */
  function diagnoseAuswahl() {
    if (!window.DIAGNOSE) return [];
    var d = zustand.diagnose || {};
    return DIAGNOSE.waehlen(window.DATEN.elemente,
      { runde: d.runde || 0, gesehen: d.gesehen || [] });
  }

  function bereichName(kennung) {
    var bereiche = ((window.DATEN.anforderungen || {}).bereiche) || [];
    for (var i = 0; i < bereiche.length; i++) {
      if (bereiche[i].id === kennung) return txt(bereiche[i], "titel_ar");
    }
    if (kennung === "P45") return ui("أجزاء الامتحان — § 45 PflAPrV");
    return esc(kennung);
  }

  function diagnoseSeite() {
    var auswahl = diagnoseAuswahl();
    var frueher = zustand.diagnose;
    var h = ui("<h1>اختبارٌ تشخيصيّ — أين تبدأ؟</h1>") +
      ui('<p class="matt">اثنا عشر سؤالاً مأخوذةً من اختبارات الوحدات، ') +
      ui("سؤالان من كلّ مجال. تُجيب مرّةً، فتعرف أيَّ المجالات تحتاج ") +
      ui("وقتاً أكثر، ومن أيّ عنصرٍ تبدأ.</p>") +
      ui('<div class="band warn">مؤشّرُ بدءٍ لا تقييمٌ رسميّ') +
      ui('<span class="klein">اثنا عشر سؤالاً لا تقيس مستواك اللغويّ، ') +
      ui("ولا تتنبّأ بنتيجة امتحان المعرفة، ولا تصلح شهادةً لأحد. ") +
      ui("وإجاباتُك تبقى في متصفّحك.</span></div>");

    if (!auswahl.length) {
      return h + ui('<div class="band rot">لا أسئلةَ موسومةً بمتطلَّب — ') +
        ui("لا يمكن بناءُ التشخيص.</div>");
    }
    var bank = DIAGNOSE.bankgroesse(window.DATEN.elemente);
    var kleinster = Object.keys(bank).sort(function (a, b) { return bank[a] - bank[b]; })[0];
    var bankZahl = Object.keys(bank).reduce(function (s2, k) { return s2 + bank[k]; }, 0);
    h += '<p class="klein matt">' +
      ui("المحاولة رقم ") + (((frueher || {}).runde || 0) + 1) +
      ui(" · بنكُ الأسئلة ") + bankZahl + ui(" سؤالاً، تُختار منها اثنا عشر. ") +
      ui("وأصغرُ مجالٍ (") + esc(kleinster) + ui(") فيه ") + bank[kleinster] +
      ui(" أسئلة، فقد تتكرّر أسئلتُه بعد محاولاتٍ قليلة.") + "</p>";
    if (frueher && frueher.datum) {
      h += '<p class="klein matt">' + ui("آخر نتيجة: ") + esc(frueher.datum) +
        ui(" · أصبتَ ") + frueher.richtig + ui(" من ") + frueher.gesamt + "</p>";
    }

    h += '<div id="dg" class="karte"><ol class="quizliste">' +
      auswahl.map(function (f) {
        return '<li data-q="' + esc(f.id) + '"><div class="qtext">' +
          txt(f.frage, "frage_ar") + "</div>" +
          '<p class="qhinweis">' + ui("اختر إجابةً واحدة") +
          ui(" · من ") + esc(f.element) + ui(" · يختبر ") + esc(f.prueft) + "</p>" +
          alsListe(f.frage.optionen).map(function (o, j) {
            return '<label class="opt" data-o="' + j + '">' +
              '<input type="radio" name="dg-' + esc(f.id) + '" value="' + j + '">' +
              '<span class="otext">' + txt(o, "text_ar") +
              '<span class="zeichen"></span>' +
              '<span class="warum-opt">' + txt(o, "warum") + "</span></span></label>";
          }).join("") + "</li>";
      }).join("") + "</ol>" +
      '<div class="werkzeug"><button id="dg-fertig" class="haupt">' +
      ui("أظهِر النتيجة") + "</button>" +
      '<button id="dg-runde">' + ui("محاولةٌ جديدة بأسئلةٍ أخرى") + "</button>" +
      '<button id="dg-neu">' + ui("امسح التشخيص") + "</button>" +
      '<span id="dg-lage" class="klein matt"></span></div></div>' +
      '<div id="dg-erg"></div>';
    return h;
  }

  function diagnoseErgebnis(auswahl, ergebnis) {
    var pfad = DIAGNOSE.weg(window.DATEN.elemente, ergebnis);
    var h = '<div class="karte"><h2>' + ui("النتيجة") + "</h2>" +
      '<p class="quelle">' + ui("أصبتَ ") + ergebnis.richtig + ui(" من ") +
      ergebnis.gesamt + ui(" · وهذا مؤشّرُ بدءٍ لا تقييمٌ رسميّ") + "</p>" +
      ui('<div class="tabellerei"><table><thead><tr><th>المجال</th>') +
      ui("<th>أصبتَ</th></tr></thead><tbody>") +
      ergebnis.bereiche.map(function (b) {
        return '<tr><td data-k="' + ui("المجال") + '">' +
          '<span class="chip">' + esc(b.bereich) + "</span> " + bereichName(b.bereich) +
          "</td>" + '<td data-k="' + ui("أصبتَ") + '">' +
          '<span class="chip ' + (b.richtig === b.gesamt ? "gedeckt" : "warn") + '">' +
          b.richtig + " / " + b.gesamt + "</span></td></tr>";
      }).join("") + "</tbody></table></div>";

    if (!ergebnis.schwaechen.length) {
      h += ui('<p>أصبتَ كلَّ الأسئلة. وهذا لا يعني أنّك لا تحتاج الدورة: ') +
        ui("اثنا عشر سؤالاً لا تغطّي اثنين وتسعين متطلَّباً. ابدأ من أوّلها.</p>");
    } else {
      h += ui("<h3>ابدأ من هنا</h3>") +
        ui('<p class="klein matt">بترتيب الدورة، ولكلّ عنصرٍ سببُ ترشيحه: ') +
        ui("المتطلَّبُ الذي أخطأتَ سؤالَه وهذا العنصرُ يثبته.</p><ol class=\"dg-weg\">") +
        pfad.map(function (e) {
          return '<li><a href="#/e/' + esc(e.id) + '">' + esc(e.id) + " — " +
            esc(e.titel) + "</a> " + e.wegen.map(function (k) {
              return '<span class="chip">' + esc(k) + "</span>";
            }).join(" ") +
            '<div class="klein matt">' + ui("لأنّك أخطأتَ: ") +
            alsListe(e.weil).map(function (w) {
              return esc(w.prueft) + " (" + alsListe(w.fragen).map(esc).join(" ") + ")";
            }).join(" · ") + "</div></li>";
        }).join("") + "</ol>";
    }
    return h + ui('<p class="klein matt">تحت كلّ سؤالٍ أخطأتَه سببُ الخطأ ') +
      ui("وسببُ الصواب.</p></div>");
  }

  function diagnoseBinden() {
    var wurzel = document.getElementById("dg");
    if (!wurzel) return;
    var auswahl = diagnoseAuswahl();
    var lage = document.getElementById("dg-lage");

    /* زرّان لا واحد: «أسئلةٌ أخرى» تُبقي ما رآه المتعلّم كي لا يُعادَ
       عليه، و«امسح» تعيده إلى الصفر — قرارُه هو، ومكتوبٌ على الزرّ. */
    document.getElementById("dg-runde").onclick = function () {
      var d = zustand.diagnose || {};
      var gesehen = (d.gesehen || []).slice();
      auswahl.forEach(function (f) {
        if (gesehen.indexOf(f.id) < 0) gesehen.push(f.id);
      });
      zustand.diagnose = { runde: (d.runde || 0) + 1, gesehen: gesehen };
      sichern();
      leiten();
    };

    document.getElementById("dg-neu").onclick = function () {
      delete zustand.diagnose;
      sichern();
      leiten();
    };

    document.getElementById("dg-fertig").onclick = function () {
      var antworten = {};
      auswahl.forEach(function (f) {
        var gewaehlt = wurzel.querySelector('input[name="dg-' + f.id + '"]:checked');
        if (gewaehlt) antworten[f.id] = parseInt(gewaehlt.value, 10);
      });
      if (Object.keys(antworten).length < auswahl.length) {
        lage.textContent = ui("أجب عن كلّ الأسئلة أوّلاً — بقي ") +
          (auswahl.length - Object.keys(antworten).length);
        return;
      }
      lage.textContent = "";
      var ergebnis = DIAGNOSE.auswerten(auswahl, antworten);

      auswahl.forEach(function (f) {
        var li = wurzel.querySelector('[data-q="' + f.id + '"]');
        var soll = DIAGNOSE.richtigeWahl(f.frage);
        var stimmt = antworten[f.id] === soll;
        li.className = stimmt ? "gut" : "schlecht";
        Array.prototype.forEach.call(li.querySelectorAll(".opt"), function (opt, j) {
          var zeichen = opt.querySelector(".zeichen");
          opt.querySelector("input").disabled = true;
          if (j === soll) { opt.classList.add("war-richtig"); zeichen.textContent = "✓"; }
          else if (j === antworten[f.id]) {
            opt.classList.add("war-falsch-gewaehlt"); zeichen.textContent = "✗";
          }
        });
      });
      wurzel.classList.add("quiz-fertig");

      var alt = zustand.diagnose || {};
      var gesehen = (alt.gesehen || []).slice();
      auswahl.forEach(function (f) {
        if (gesehen.indexOf(f.id) < 0) gesehen.push(f.id);
      });
      zustand.diagnose = {
        datum: new Date().toISOString().slice(0, 10),
        runde: alt.runde || 0,
        gesehen: gesehen,
        richtig: ergebnis.richtig, gesamt: ergebnis.gesamt,
        bereiche: ergebnis.bereiche.map(function (b) {
          return { bereich: b.bereich, richtig: b.richtig, gesamt: b.gesamt };
        }),
        antworten: antworten,
        /* سببُ كلّ توصيةٍ يُحفَظ مع التوصية: أيُّ سؤالٍ أخطأه المتعلّم
           أدّى إلى ترشيح هذا العنصر. ولوحةُ التقدّم تقرؤه كما هو. */
        empfehlungen: DIAGNOSE.weg(window.DATEN.elemente, ergebnis).map(function (e) {
          return { element: e.id, wegen: e.wegen, weil: e.weil };
        })
      };
      sichern();
      document.getElementById("dg-erg").innerHTML = diagnoseErgebnis(auswahl, ergebnis);
      document.getElementById("dg-erg").scrollIntoView();
    };
  }

  /* ————— تمارينُ بعد كلّ جزء —————
     مشتقّةٌ من محتوى الحالة نفسِه في `app/uebungen.js`: ترتيبُ خطوات
     `ablauf` بترتيبها المعتمَد، وملءُ فراغٍ في جملةٍ مكتوبةٍ أصلاً في
     `vokabeln`. **ولا يُؤلَّف نصٌّ ولا تفسير**: تعليلُ الترتيب هو
     `sicherheit`، وتفسيرُ الكلمة هو معناها وأساليبُها الثلاثة كما هي.

     والجوابُ فوق التمرين في الصفحة — وهذا يُقال صراحةً، ويُعطى زرٌّ
     يُخفي ما فوق. فالتمرينُ الذي جوابُه مكشوفٌ بلا تنبيهٍ يخدع صاحبَه. */

  function uebungStand(schluessel) {
    return (zustand.uebung || {})[schluessel] ||
      { versuche: 0, richtig: 0, gesamt: 0, datum: "" };
  }
  function uebungMerken(schluessel, stand) {
    zustand.uebung = zustand.uebung || {};
    stand.datum = new Date().toISOString().slice(0, 10);
    zustand.uebung[schluessel] = stand;
    sichern();
  }

  function frueherZeile(schluessel) {
    var s = uebungStand(schluessel);
    return s.versuche
      ? '<p class="klein matt">' + ui("سابقاً: ") + s.richtig + ui(" من ") + s.gesamt +
        ui(" · محاولات: ") + s.versuche + "</p>"
      : "";
  }

  function verbergenKnopf(ziel) {
    return '<button class="u-verbergen" data-ziel="' + ziel + '">' +
      ui("أخفِ ما فوق") + "</button>";
  }

  function ordnungBlock(e) {
    var o = window.UEBUNGEN && UEBUNGEN.ordnung(e);
    if (!o) return "";
    return '<div class="uebung ordnung" data-s="o:' + esc(e.id) + '">' +
      ui("<h3>تمرين — رتّب خطوات الإجراء</h3>") +
      ui('<p class="klein matt">بالترتيب الذي تنفّذها به. ') +
      ui("<b>والقائمةُ فوقَه فيها الجواب</b> — أخفِها وجرّب من ذاكرتك.</p>") +
      '<ol class="o-liste">' + o.gemischt.map(function (nr) {
        var s = o.schritte[nr];
        return '<li data-nr="' + nr + '"><div class="o-zeile">' +
          '<span class="de">' + esc(s.de) + "</span>" +
          '<span class="o-knoepfe"><button class="o-auf" title="' + ui("لأعلى") +
          '">▲</button><button class="o-ab" title="' + ui("لأسفل") + '">▼</button></span>' +
          "</div>" +
          (s.warum ? '<p class="sicher o-warum" hidden>' + ui("لماذا هنا: ") +
            txt(s, "warum") + "</p>" : "") + "</li>";
      }).join("") + "</ol>" +
      '<div class="werkzeug"><button class="o-pruefen">' + ui("تحقّق") + "</button>" +
      verbergenKnopf(".schritte") +
      '<span class="o-stand klein matt"></span></div>' +
      frueherZeile("o:" + e.id) + "</div>";
  }

  function lueckenBlock(e) {
    var l = window.UEBUNGEN ? UEBUNGEN.luecken(e) : [];
    if (!l.length) return "";
    return '<div class="uebung luecken" data-s="l:' + esc(e.id) + '">' +
      ui("<h3>تمرين — أكمل الفراغ</h3>") +
      ui('<p class="klein matt">الجملُ مأخوذةٌ من الجدول فوقَه كما هي. ') +
      ui("اكتب المصطلحَ الناقص، والخياراتُ عند الحاجة.</p>") +
      '<ol class="l-liste">' + l.map(function (x, i) {
        return '<li data-i="' + i + '" data-loesung="' + esc(x.loesung) + '">' +
          '<div class="de l-satz">' + esc(x.vor) +
          '<input class="l-ein" type="text" size="16" autocomplete="off" spellcheck="false">' +
          esc(x.nach) + "</div>" +
          '<div class="werkzeug"><button class="l-hilfe">' + ui("الخيارات") + "</button>" +
          '<span class="l-optionen" hidden>' + x.optionen.map(function (o) {
            return '<button class="l-opt">' + esc(o) + "</button>";
          }).join("") + "</span></div>" +
          /* وسمُ المسوّدة للمراجِع لا للمتعلّم: حالُ المراجعة تبقى في
             البيانات وفي ورقة المراجعة، ولا تُعرَض في نسخة الطلّاب —
             قرارُ محمد: تُدمَج ولا تُحجَب، والحالُ داخليّة. */
          (x.entwurf && window.MODUS !== "lernende"
            ? ui('<p class="klein matt l-entwurf">جملةٌ مسوّدةٌ من البرنامج — ') +
              ui("تنتظر مراجعةَ مدرّسٍ أو مختصّ.</p>")
            : "") +
          '<div class="l-warum" hidden>' +
          '<span class="l-richtig"></span>' +
          '<div class="klein">' + ui("المعنى: ") + txt(x, "ar") + "</div>" +
          (x.patient ? '<div class="de klein matt">' + ui("مع المريض: ") +
            esc(x.patient) + "</div>" : "") +
          (x.dokument ? '<div class="de klein matt">' + ui("في التوثيق: ") +
            esc(x.dokument) + "</div>" : "") +
          "</div></li>";
      }).join("") + "</ol>" +
      '<div class="werkzeug"><button class="l-pruefen">' + ui("تحقّق") + "</button>" +
      verbergenKnopf(".tabellerei") +
      '<span class="l-stand klein matt"></span></div>' +
      frueherZeile("l:" + e.id) + "</div>";
  }

  function verbergenBinden(block) {
    var knopf = block.querySelector(".u-verbergen");
    if (!knopf) return;
    knopf.onclick = function () {
      var umgebung = block.parentNode;
      var ziel = umgebung.querySelector(knopf.getAttribute("data-ziel"));
      if (!ziel) return;
      ziel.hidden = !ziel.hidden;
      knopf.textContent = ziel.hidden ? ui("أظهِر ما فوق") : ui("أخفِ ما فوق");
    };
  }

  function ordnungBinden() {
    Array.prototype.forEach.call(document.querySelectorAll("div.ordnung"), function (block) {
      var liste = block.querySelector(".o-liste");
      var stand = block.querySelector(".o-stand");
      var versuche = 0;
      verbergenBinden(block);

      function tauschen(li, richtung) {
        var nachbar = richtung < 0 ? li.previousElementSibling : li.nextElementSibling;
        if (!nachbar) return;
        if (richtung < 0) liste.insertBefore(li, nachbar);
        else liste.insertBefore(nachbar, li);
      }
      Array.prototype.forEach.call(liste.querySelectorAll("li"), function (li) {
        li.querySelector(".o-auf").onclick = function () { tauschen(li, -1); };
        li.querySelector(".o-ab").onclick = function () { tauschen(li, 1); };
      });

      block.querySelector(".o-pruefen").onclick = function () {
        var zeilen = liste.querySelectorAll("li");
        var richtig = 0;
        versuche++;
        Array.prototype.forEach.call(zeilen, function (li, i) {
          var passt = parseInt(li.getAttribute("data-nr"), 10) === i;
          li.className = passt ? "gut" : "schlecht";
          var warum = li.querySelector(".o-warum");
          /* التفسيرُ يظهر عند الخطأ وحدَه: من أصاب لا يُعطَّل بشرحٍ لم يطلبه. */
          if (warum) warum.hidden = passt;
          if (passt) richtig++;
        });
        stand.textContent = richtig + ui(" من ") + zeilen.length + ui(" في موضعها") +
          (richtig === zeilen.length ? ui(" — الترتيبُ كلُّه صحيح.")
            : ui(" · تحت كلِّ خطوةٍ في غير موضعها سببُ موضعها."));
        uebungMerken(block.getAttribute("data-s"),
          { versuche: versuche, richtig: richtig, gesamt: zeilen.length, datum: "" });
      };
    });
  }

  function lueckenBinden() {
    Array.prototype.forEach.call(document.querySelectorAll("div.luecken"), function (block) {
      var stand = block.querySelector(".l-stand");
      var versuche = 0;
      verbergenBinden(block);

      Array.prototype.forEach.call(block.querySelectorAll(".l-liste li"), function (li) {
        var feld = li.querySelector(".l-ein");
        var optionen = li.querySelector(".l-optionen");
        li.querySelector(".l-hilfe").onclick = function () {
          optionen.hidden = !optionen.hidden;
        };
        Array.prototype.forEach.call(li.querySelectorAll(".l-opt"), function (knopf) {
          knopf.onclick = function () { feld.value = knopf.textContent; };
        });
      });

      block.querySelector(".l-pruefen").onclick = function () {
        var zeilen = block.querySelectorAll(".l-liste li");
        var richtig = 0;
        versuche++;
        Array.prototype.forEach.call(zeilen, function (li) {
          var loesung = li.getAttribute("data-loesung");
          var feld = li.querySelector(".l-ein");
          var passt = UEBUNGEN.gleichwertig(feld.value, loesung);
          li.className = feld.value ? (passt ? "gut" : "schlecht") : "";
          li.querySelector(".l-warum").hidden = !feld.value;
          li.querySelector(".l-richtig").textContent = passt
            ? ui("صحيح: ") + loesung
            : ui("الصواب: ") + loesung;
          if (passt) richtig++;
        });
        stand.textContent = richtig + ui(" من ") + zeilen.length + ui(" صحيحة") +
          (richtig === zeilen.length ? "" : ui(" · تحت كلِّ فراغٍ معناه وأساليبُه."));
        uebungMerken(block.getAttribute("data-s"),
          { versuche: versuche, richtig: richtig, gesamt: zeilen.length, datum: "" });
      };
    });
  }

  /* ————— الأهدافُ ومواضعُ قياسها —————
     هدفٌ لا يقول أين يُقاس أمنيةٌ لا هدف. فكلُّ هدفٍ يحمل `nachweis`
     يشير إلى سؤالٍ أو معيارٍ **في هذه الحالة نفسِها**، ويُعرَض مرّتين:
     أوّلَ الحالة وعداً، وآخرَها سؤالاً للمتعلّم عن نفسِه. والربطُ مسوّدةٌ
     حتى يراجعه مدرّسٌ مؤهَّل — **ويقول ذلك في الصفحة، لا في ملفٍّ جانبيّ.**
     وما لم يُربَط بعدُ مسجَّلٌ في `curriculum/luecken.md` ولا يُخترَع له
     سؤال. */

  function nachweisTeile(e, ziel) {
    var n = (ziel && ziel.nachweis) || {};
    var teile = [];
    var fragen = alsListe((e.quiz || {}).fragen);
    alsListe(n.quiz).forEach(function (kennung) {
      var nr = 0;
      fragen.forEach(function (f, j) { if (f.id === kennung) nr = j + 1; });
      if (nr) teile.push('<a href="#quiz">' + ui("سؤال الاختبار ") + nr + "</a>");
    });
    alsListe(n.fachfragen).forEach(function (i) {
      teile.push('<a href="#a-fragen">' + ui("السؤال المهنيّ ") + (i + 1) + "</a>");
    });
    alsListe(n.kriterien).forEach(function (name) {
      var treffer = alsListe((e.bewertung || {}).kriterien).filter(function (k) {
        return k.name === name;
      })[0];
      teile.push('<a href="#a-bewertung">' + ui("معيار ") + "«" +
        (treffer ? txt(treffer, "name") : esc(name)) + "»</a>");
    });
    return teile;
  }

  function zieleListe(e) {
    var ziele = alsListe(e.lernziele);
    return ui("<h3>أهداف الحالة — بعد هذه الحالة تستطيع أن…</h3><ul>") +
      ziele.map(function (z) {
        var teile = nachweisTeile(e, z);
        return "<li>" + txt(z, "ar") + '<div class="de klein">' + esc(z.de) + "</div>" +
          (teile.length
            ? '<div class="klein matt messung">' + ui("يُقاس في: ") + teile.join(" · ") + "</div>"
            : "") + "</li>";
      }).join("") + "</ul>" +
      (ziele.some(function (z) { return (z.nachweis || {}).status !== "geprueft"; })
        ? ui('<p class="klein matt">ربطُ الأهداف بمواضع قياسها <b>مسوّدة</b> ') +
          ui("تنتظر مراجعةَ مدرّسٍ مؤهَّل.</p>")
        : "");
  }

  function zielpruefung(e) {
    var ziele = alsListe(e.lernziele);
    if (!ziele.length) return "";
    var gemerkt = zieleStand(e.id);
    return ui("<h3>ما الذي تستطيعه الآن؟</h3>") +
      ui('<p class="klein matt">حكمُك أنت، لا درجةٌ تُحسَب لك. ') +
      ui("ويبقى في متصفّحك ولا يُرسَل.</p>") +
      '<ul class="zielpruefung" data-fall="' + esc(e.id) + '">' +
      ziele.map(function (z, i) {
        var an = gemerkt.indexOf(i) >= 0;
        var teile = nachweisTeile(e, z);
        return '<li><label><input type="checkbox" data-z="' + i + '"' +
          (an ? " checked" : "") + "> " + txt(z, "ar") + "</label>" +
          (teile.length
            ? '<div class="klein matt z-hin"' + (an ? " hidden" : "") + ">" +
              ui("راجِع: ") + teile.join(" · ") + "</div>"
            : "") + "</li>";
      }).join("") + '</ul><p class="klein matt z-stand"></p>';
  }

  function zielpruefungBinden() {
    var listen = document.querySelectorAll("ul.zielpruefung");
    if (!listen.length) return;
    Array.prototype.forEach.call(listen, function (liste) {
      var kennung = liste.getAttribute("data-fall");
      var stand = liste.parentNode.querySelector(".z-stand");
      var kaesten = liste.querySelectorAll("input[type=checkbox]");
      function zeigen() {
        var fertige = [];
        Array.prototype.forEach.call(kaesten, function (ein) {
          var hin = ein.parentNode.parentNode.querySelector(".z-hin");
          if (ein.checked) fertige.push(parseInt(ein.getAttribute("data-z"), 10));
          if (hin) hin.hidden = ein.checked;
        });
        if (stand) {
          stand.textContent = ui("أقررتَ بـ") + fertige.length + ui(" من ") +
            kaesten.length + (fertige.length === kaesten.length ? "" :
              ui(" — وما بقي فيه موضعُ مراجعةٍ فوقَه."));
        }
        return fertige;
      }
      Array.prototype.forEach.call(kaesten, function (ein) {
        ein.onchange = function () { zieleMerken(kennung, zeigen()); };
      });
      zeigen();
    });
  }

  /* ————— حلقةُ الكلام —————
     المعيارُ الحاسم: لا تكفي كثرةُ التسجيلات. المتعلّمُ **يسمع نموذجاً،
     ثمّ يتكلّم، ثمّ يقارن، ثمّ يحكم على نفسِه بمعاييرَ صريحة، ثمّ يعيد**.
     ولا يوجد هنا تصحيحٌ آليٌّ للنطق — ولا يُدَّعى. الحكمُ لأذنِ المتعلّم،
     وأداتُه المقارنةُ المباشرة ومعاييرُ معدودةٌ مشتقّةٌ من النصِّ نفسِه.

     وقرارُ محمد في ١٤ أيلول: **السرعةُ ليست معياراً.** الهدفُ وضوحُ
     التواصل لا محاكاةُ إيقاعِ المتحدّث؛ فمن قلّد السرعةَ وضيّع المقاطعَ
     خسر المريضَ ونجح في التقليد. */

  /* المصطلحاتُ المهنيّةُ الواردةُ في هذه الجملة بعينِها. المعيارُ يسمّي ما
     في السطر لا كلاماً عامّاً: «نطقتُ Minderdurchblutung بدقّة» أنفعُ من
     «انتبه للمصطلحات». وتُنزَع أداةُ التعريف لأنّ الجملةَ قد تصرّفها. */
  function fachtreffer(text, begriffe) {
    var gefunden = [];
    var klein = String(text).toLowerCase();
    alsListe(begriffe).forEach(function (w) {
      var wort = String((w && w.de) || "").replace(/^(der|die|das)\s+/i, "").trim();
      if (wort.length > 3 && klein.indexOf(wort.toLowerCase()) >= 0) gefunden.push(wort);
    });
    return gefunden;
  }

  /* أربعةُ معاييرَ قصيرةٍ ملحوظةٍ بالأذن، مشتقّةٌ من الجملة. والخامسُ
     (التركيزُ على نقطةٍ واحدةٍ في الإعادة) مخفيٌّ حتى تقع إعادةٌ فعلاً. */
  function selbstpruefungen(text, begriffe) {
    var treffer = fachtreffer(text, begriffe);
    var zahlen = /\d/.test(text);
    var p = [ui("قلتُ الجملةَ كاملةً دون حذفِ المعنى.")];
    if (zahlen && treffer.length) {
      p.push(ui("نطقتُ الأرقامَ والمصطلحَ «") + esc(treffer[0]) + ui("» بدقّة."));
    } else if (zahlen) {
      p.push(ui("نطقتُ الأرقامَ والجرعاتِ كما هي، رقماً رقماً."));
    } else if (treffer.length) {
      p.push(ui("نطقتُ المصطلحَ المهنيَّ «") + esc(treffer[0]) + ui("» بدقّة."));
    } else {
      p.push(ui("نطقتُ الكلماتِ المهنيّةَ بدقّة."));
    }
    p.push(ui("كان نطقي مفهوماً من أوّلِ سماع."));
    if (text.indexOf("?") >= 0) {
      p.push(ui("رفعتُ نبرةَ السؤال ووقفتُ عند آخرِه."));
    } else if (/[,;:—–]/.test(text)) {
      p.push(ui("وقفتُ عند الفواصل ولم أَصِلِ الجملَ ببعضها."));
    } else {
      p.push(ui("وقفاتي في مواضعها ونبرتي واضحةٌ للتعليمات."));
    }
    return p;
  }

  /* التقييمُ الذاتيُّ ثلاثُ درجاتٍ لا غير، وليس درجةَ آلةٍ ولا نسبةً:
     المتعلّمُ يقول كيف سمع نفسَه. وما بعدَه توصيةٌ **محدَّدة** تسمّي بنداً
     واحداً لم يُقَرّ — لأنّ إعادةً تصلح خمسةَ أشياءَ معاً لا تصلح شيئاً. */
  function empfehlung(stufe, offen) {
    if (stufe === "wieder") {
      return offen.length
        ? ui("اسمع النموذجَ مرّةً، ثمّ أعِد وركّز على نقطةٍ واحدة: ") + offen[0]
        : ui("اسمع النموذجَ مرّةً، ثمّ أعِد على مَهَلٍ — الوضوحُ قبل السرعة.");
    }
    if (stufe === "ok") {
      return offen.length
        ? ui("قريب. أعِد مرّةً واحدةً من أجل: ") + offen[0] + ui(" ثمّ قارن التسجيلين.")
        : ui("أعِد مرّةً واحدةً وقارن التسجيلين؛ إن تساويا فانتقل.");
    }
    return offen.length
      ? ui("قبل أن تنتقل، أعِد مرّةً واحدةً من أجل: ") + offen[0]
      : ui("انتقل إلى السطر التالي — وسيعود هذا السطرُ في المراجعة.");
  }

  function stufenname(schluessel) {
    for (var i = 0; i < STUFEN.length; i++) {
      if (STUFEN[i][0] === schluessel) return ui(STUFEN[i][1]);
    }
    return "";
  }

  function sprechschleife(schluessel, text, ton, begriffe) {
    var stand = sprechStand(schluessel);
    return '<div class="schleife" data-s="' + esc(schluessel) + '"' +
      (ton ? ' data-ton="' + esc(ton) + '"' : "") + ">" +
      '<div class="werkzeug">' +
      (ton ? ui('<button class="s-modell">▶ النموذج</button>') : "") +
      ui('<button class="s-mik">🎙 تكلّم أنت</button>') +
      ui('<button class="s-meins" disabled>▶ تسجيلي</button>') +
      (ton ? ui('<button class="s-ab" disabled>🔁 النموذج ثمّ أنت</button>') : "") +
      '<span class="s-lage klein matt"></span></div>' +
      '<div class="s-pruefung" hidden>' +
      ui('<p class="klein matt">احكم على نفسِك — <b>لا تصحيحَ آليّاً للنطق هنا</b>، ') +
      ui('والحكمُ لأذنك:</p><ul class="s-liste">') +
      selbstpruefungen(text, begriffe).map(function (p) {
        return '<li><label><input type="checkbox"> ' + p + "</label></li>";
      }).join("") +
      '<li class="s-wieder" hidden><label><input type="checkbox"> ' +
      ui("في هذه الإعادة ركّزتُ على نقطةٍ واحدةٍ وقارنتُها بالمحاولة السابقة.") +
      "</label></li></ul>" +
      ui('<p class="klein matt s-frage">كيف تسمع محاولتك؟</p>') +
      '<div class="werkzeug s-stufen">' +
      STUFEN.map(function (s) {
        return '<button class="s-stufe" data-stufe="' + s[0] + '">' + ui(s[1]) + "</button>";
      }).join("") + "</div>" +
      '<p class="s-rat klein"></p>' +
      '<div class="werkzeug">' +
      ui('<button class="s-nochmal">أعد المحاولة</button>') +
      '<span class="s-zaehler klein matt"></span></div></div>' +
      (stand.versuche
        ? '<p class="klein matt s-frueher">' + ui("سابقاً: ") + stand.versuche +
          ui(" محاولة · أقررتَ بـ") + stand.geprueft + ui(" من ") + stand.gesamt +
          (stand.stufe ? ui(" · حكمُك: ") + stufenname(stand.stufe) : "") + "</p>"
        : "") +
      "</div>";
  }

  function sprechschleifeBinden() {
    var blocks = document.querySelectorAll("div.schleife");
    if (!blocks.length) return;
    Array.prototype.forEach.call(blocks, function (b) {
      var schluessel = b.getAttribute("data-s");
      var tonPfad = b.getAttribute("data-ton");
      var modell = tonPfad ? new Audio(tonPfad) : null;
      var kModell = b.querySelector(".s-modell");
      var kMik = b.querySelector(".s-mik");
      var kMeins = b.querySelector(".s-meins");
      var kAb = b.querySelector(".s-ab");
      var lage = b.querySelector(".s-lage");
      var pruefung = b.querySelector(".s-pruefung");
      var zaehler = b.querySelector(".s-zaehler");
      var kNochmal = b.querySelector(".s-nochmal");
      var wiederP = b.querySelector("li.s-wieder");
      var rat = b.querySelector(".s-rat");
      var eigen = null, rec = null, stuecke = [], versuche = 0, stufe = "";

      /* البنودُ المعروضةُ وحدَها تُحتسَب: بندُ الإعادة مخفيٌّ قبل الإعادة،
         فلو عُدَّ لقال للمتعلّم «أقررتَ بثلاثةٍ من خمسة» وهو لم يُتَح له
         الخامس. */
      function kaesten() {
        return Array.prototype.filter.call(
          b.querySelectorAll(".s-liste input"),
          function (ein) { return !ein.parentNode.parentNode.hidden; });
      }
      function offene() {
        return kaesten().filter(function (ein) { return !ein.checked; })
          .map(function (ein) { return ein.parentNode.textContent.trim(); });
      }
      function merken() {
        var k = kaesten();
        sprechMerken(schluessel, {
          versuche: versuche, stufe: stufe,
          geprueft: k.filter(function (ein) { return ein.checked; }).length,
          gesamt: k.length, datum: ""
        });
      }
      function ratZeigen() {
        rat.textContent = stufe ? empfehlung(stufe, offene()) : "";
      }

      if (kModell) kModell.onclick = function () { modell.currentTime = 0; modell.play(); };
      kMeins.onclick = function () { if (eigen) { eigen.currentTime = 0; eigen.play(); } };
      if (kAb) kAb.onclick = function () {
        if (!eigen) return;
        modell.currentTime = 0; modell.play();
        modell.onended = function () { eigen.currentTime = 0; eigen.play(); };
      };
      if (kNochmal) kNochmal.onclick = function () { kMik.onclick(); };

      Array.prototype.forEach.call(b.querySelectorAll(".s-liste input"), function (ein) {
        ein.onchange = function () { merken(); ratZeigen(); };
      });

      Array.prototype.forEach.call(b.querySelectorAll(".s-stufe"), function (knopf) {
        knopf.onclick = function () {
          stufe = knopf.getAttribute("data-stufe");
          Array.prototype.forEach.call(b.querySelectorAll(".s-stufe"), function (k2) {
            k2.className = "s-stufe" + (k2 === knopf ? " haupt" : "");
          });
          merken();
          ratZeigen();
        };
      });

      kMik.onclick = function () {
        if (rec && rec.state === "recording") { rec.stop(); return; }
        if (!window.isSecureContext || !navigator.mediaDevices || !window.MediaRecorder) {
          lage.textContent = ui("التسجيل يحتاج خادماً محلّيّاً (http://localhost).");
          return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (strom) {
          stuecke = [];
          rec = new MediaRecorder(strom);
          rec.ondataavailable = function (ev) { if (ev.data.size) stuecke.push(ev.data); };
          rec.onstop = function () {
            strom.getTracks().forEach(function (t) { t.stop(); });
            eigen = new Audio(URL.createObjectURL(new Blob(stuecke, { type: rec.mimeType })));
            versuche++;
            kMeins.disabled = false;
            if (kAb) kAb.disabled = false;
            kMik.textContent = ui("🎙 تكلّم أنت");
            pruefung.hidden = false;
            /* محاولةٌ جديدةٌ تعني حكماً جديداً: يسقط حكمُ السابقة وتوصيتُها
               حتى يسمع المتعلّمُ نفسَه من جديد. */
            stufe = "";
            Array.prototype.forEach.call(b.querySelectorAll(".s-stufe"), function (k2) {
              k2.className = "s-stufe";
            });
            rat.textContent = "";
            if (versuche > 1) wiederP.hidden = false;
            zaehler.textContent = ui("المحاولة ") + versuche +
              (versuche > 1 ? ui(" · قارنها بالأولى بأذنك") : "");
            lage.textContent = ui("سُجّل — في متصفّحك وحدَه، ويزول بإغلاق الصفحة.");
            merken();
          };
          rec.start();
          kMik.textContent = ui("■ أوقف");
          lage.textContent = ui("يسجّل… اضغط لتقف.");
        }).catch(function (fehler) {
          lage.textContent = fehler.name === "NotAllowedError"
            ? ui("لم يُؤذن بالميكروفون. ولا شيءَ يُرسَل في الحالتين.")
            : ui("تعذّر التسجيل: ") + fehler.name;
        });
      };
    });
  }

  // تمرينُ النطق على المصطلح الواحد: اسمعه، ثمّ سجّل نفسَك، ثمّ قارن.
  // والتسجيلُ لا يغادر المتصفّح — لا رفعَ ولا حفظَ في ملفّ.
  function sprechuebung(w, wi) {
    if (!w.ton) return "";
    return '<span class="sprech" data-wi="' + wi + '">' +
      '<button class="wortton" title="' + ui("اسمع") + '" data-ton="' +
      esc(w.ton) + '">▶</button>' +
      '<button class="wortmik" title="' + ui("سجّل نفسك") + '">🎙</button>' +
      '<button class="wortmein" title="' + ui("اسمع تسجيلك") + '" disabled>▶</button>' +
      '<span class="wortlage klein matt"></span></span>';
  }

  function sprechuebungBinden() {
    var reihen = document.querySelectorAll("span.sprech");
    if (!reihen.length) return;
    Array.prototype.forEach.call(reihen, function (reihe) {
      var hoer = reihe.querySelector(".wortton");
      var mik = reihe.querySelector(".wortmik");
      var mein = reihe.querySelector(".wortmein");
      var lage = reihe.querySelector(".wortlage");
      var ton = new Audio(hoer.getAttribute("data-ton"));
      var eigen = null, rec = null, stuecke = [];

      hoer.onclick = function () { ton.currentTime = 0; ton.play(); };
      mein.onclick = function () { if (eigen) { eigen.currentTime = 0; eigen.play(); } };

      mik.onclick = function () {
        if (rec && rec.state === "recording") { rec.stop(); return; }
        if (!window.isSecureContext || !navigator.mediaDevices || !window.MediaRecorder) {
          lage.textContent = ui("التسجيل يحتاج خادماً محلّيّاً (http://localhost).");
          return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (strom) {
          stuecke = [];
          rec = new MediaRecorder(strom);
          rec.ondataavailable = function (ev) { if (ev.data.size) stuecke.push(ev.data); };
          rec.onstop = function () {
            strom.getTracks().forEach(function (t) { t.stop(); });
            eigen = new Audio(URL.createObjectURL(new Blob(stuecke, { type: rec.mimeType })));
            mein.disabled = false;
            mik.textContent = "🎙";
            lage.textContent = ui("سُجّل — في متصفّحك وحدَه.");
          };
          rec.start();
          mik.textContent = "■";
          lage.textContent = ui("يسجّل… اضغط لتقف.");
        }).catch(function (fehler) {
          lage.textContent = fehler.name === "NotAllowedError"
            ? ui("لم يُؤذن بالميكروفون. ولا شيءَ يُرسَل في الحالتين.")
            : ui("تعذّر التسجيل: ") + fehler.name;
        });
      };
    });
  }

  function aufnahmeBlock() {
    return ui('<div class="karte" style="margin-top:12px"><h3>سجّل إجابتك</h3>') +
      ui('<p class="klein matt">التسجيلُ يبقى في متصفّحك: لا يُرفع، ولا يُحفَظ في ملفّ، ') +
      ui("ويزول بإغلاق الصفحة. ولا يُقيَّم آليّاً — قارنه أنت بالإجابة النموذجيّة.</p>") +
      '<div class="werkzeug">' +
      ui('<button id="auf-start">ابدأ التسجيل</button>') +
      ui('<button id="auf-stop" disabled>أوقف</button>') +
      '<span id="auf-lage" class="klein matt"></span></div>' +
      '<audio id="auf-ton" controls style="width:100%;display:none"></audio></div>';
  }

  function aufnahmeBinden() {
    // لا تسمِّه `start`: هناك دالّةُ صفحةٍ بهذا الاسم، والتسميةُ تحجبها هنا.
    var knopfStart = document.getElementById("auf-start");
    if (!knopfStart) return;
    var stop = document.getElementById("auf-stop");
    var lage = document.getElementById("auf-lage");
    var ton = document.getElementById("auf-ton");
    var rec = null, stuecke = [];

    if (!window.isSecureContext) {
      knopfStart.disabled = true;
      lage.textContent = ui("التسجيل يحتاج صفحةً على http://localhost — لا ملفّاً مفتوحاً ") +
        ui("مباشرةً بـ file://. شغّل: python3 -m http.server 8131");
      return;
    }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      knopfStart.disabled = true;
      lage.textContent = ui("متصفّحك لا يتيح التسجيل هنا.");
      return;
    }
    knopfStart.onclick = function () {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (strom) {
        stuecke = [];
        rec = new MediaRecorder(strom);
        rec.ondataavailable = function (ev) { if (ev.data.size) stuecke.push(ev.data); };
        rec.onstop = function () {
          strom.getTracks().forEach(function (t) { t.stop(); });
          ton.src = URL.createObjectURL(new Blob(stuecke, { type: rec.mimeType }));
          ton.style.display = "block";
          lage.textContent = ui("انتهى. التسجيلُ في متصفّحك وحدَه.");
        };
        rec.start();
        knopfStart.disabled = true; stop.disabled = false;
        lage.textContent = ui("يسجّل…");
      }).catch(function (fehler) {
        var text = ui("تعذّر التسجيل: ") + fehler.name;
        if (fehler.name === "NotAllowedError") {
          text = ui("لم يُؤذن باستعمال الميكروفون. اسمح للصفحة به من إعدادات المتصفّح ") +
            ui("ثمّ أعد المحاولة. ولا شيء يُرسَل في الحالتين.");
        } else if (fehler.name === "NotFoundError") {
          text = ui("لا ميكروفونَ متاح على هذا الجهاز.");
        }
        lage.textContent = text;
      });
    };
    stop.onclick = function () {
      if (rec && rec.state !== "inactive") rec.stop();
      knopfStart.disabled = false; stop.disabled = true;
    };
  }

  function fertigBinden() {
    Array.prototype.forEach.call(document.querySelectorAll("button.fertig"), function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-fall"), a = b.getAttribute("data-a");
        var f = zustand.fortschritt[id] || (zustand.fortschritt[id] = { schritte: [] });
        var i = f.schritte.indexOf(a);
        if (i >= 0) { f.schritte.splice(i, 1); b.classList.remove("haupt"); b.textContent = ui("علّم أنّه تمّ"); }
        else { f.schritte.push(a); b.classList.add("haupt"); b.textContent = ui("تمّ ✓"); }
        f.letzte = a; zustand.zuletzt = location.hash; sichern();
        var balken = document.getElementById("balken");
        if (balken) {
          var anteil = Math.round(f.schritte.length / SCHRITTE.length * 100);
          balken.querySelector(".fort i").style.width = anteil + "%";
          balken.querySelector("p").innerHTML = f.schritte.length + ui(" من ") + SCHRITTE.length +
            ui(" أقسام · ") + anteil + ui("٪ — <a href=\"#a-") + a + ui("\">عُد إلى آخر موضع</a>");
        }
      };
    });
  }

  /* ————— اختبار الوحدة ————— */
  var aktuell = null;

  function quizBlock(e) {
    var q = e.quiz;
    if (!q || !q.fragen || !q.fragen.length) return "";
    var frueher = (zustand.quiz || {})[e.id];
    var mehrfach = alsListe(q.fragen).some(function (f) { return f.art === "mehrfach"; });
    var h = '<div class="karte" id="quiz"><h2>' + txt(q, "titel_ar") + "</h2>" +
      '<p class="quelle">' + alsListe(q.fragen).length + ui(" أسئلة · النجاح من ") +
      esc(q.bestehen) + ui("٪") +
      (mehrfach ? ui(" · سؤالُ «اختر كلَّ ما ينطبق» لا يُحتسب إلّا كاملاً") : "") +
      (frueher ? ui(" · آخر محاولة: ") + frueher.prozent + ui("٪ في ") + esc(frueher.datum) : "") +
      "</p>";
    h += '<div id="quiz-erg"></div><ol class="quizliste">';
    alsListe(q.fragen).forEach(function (f, i) {
      var typ = f.art === "mehrfach" ? "checkbox" : "radio";
      h += '<li data-q="' + esc(f.id) + '"><div class="qtext">' + txt(f, "frage_ar") + "</div>" +
        (f.frage_de ? '<p class="de klein matt">' + esc(f.frage_de) + "</p>" : "") +
        '<p class="qhinweis">' +
        (f.art === "mehrfach" ? ui("اختر كلَّ ما ينطبق") : ui("اختر إجابةً واحدة")) +
        (f.prueft ? ui(" · يختبر ") + esc(f.prueft) : "") + "</p>";
      alsListe(f.optionen).forEach(function (o, j) {
        h += '<label class="opt" data-o="' + j + '">' +
          '<input type="' + typ + '" name="q-' + esc(f.id) + '" value="' + j + '">' +
          '<span class="otext">' + txt(o, "text_ar") +
          (o.text_de ? '<div class="de klein matt">' + esc(o.text_de) + "</div>" : "") +
          '<span class="zeichen"></span>' +
          '<span class="warum-opt">' + txt(o, "warum") + "</span></span></label>";
      });
      h += "</li>";
    });
    h += "</ol>" +
      '<div class="werkzeug">' +
      ui('<button class="haupt" id="quiz-pruefen">صحّح إجاباتي</button>') +
      ui('<button id="quiz-neu">أعد المحاولة</button></div></div>');
    return h;
  }

  function quizBinden() {
    var knopf = document.getElementById("quiz-pruefen");
    if (!knopf || !aktuell || !aktuell.quiz) return;
    var wurzel = document.getElementById("quiz");

    knopf.onclick = function () {
      var richtigZahl = 0, offen = [];
      aktuell.quiz.fragen.forEach(function (f) {
        var li = wurzel.querySelector('[data-q="' + f.id + '"]');
        var gewaehlt = [];
        Array.prototype.forEach.call(li.querySelectorAll("input"), function (ein, j) {
          if (ein.checked) gewaehlt.push(j);
          ein.disabled = true;
        });
        var soll = [];
        alsListe(f.optionen).forEach(function (o, j) { if (o.richtig) soll.push(j); });
        var stimmt = gewaehlt.length === soll.length &&
          soll.every(function (j) { return gewaehlt.indexOf(j) >= 0; });
        if (stimmt) richtigZahl++;
        else offen.push(f);
        li.classList.add(stimmt ? "gut" : "schlecht");
        Array.prototype.forEach.call(li.querySelectorAll(".opt"), function (opt, j) {
          var ist = f.optionen[j].richtig;
          var gew = gewaehlt.indexOf(j) >= 0;
          var zeichen = opt.querySelector(".zeichen");
          if (ist) { opt.classList.add("war-richtig"); zeichen.textContent = "✓"; }
          else if (gew) { opt.classList.add("war-falsch-gewaehlt"); zeichen.textContent = "✗"; }
        });
      });

      var gesamt = aktuell.quiz.fragen.length;
      var prozent = Math.round(richtigZahl / gesamt * 100);
      var bestanden = prozent >= aktuell.quiz.bestehen;
      wurzel.classList.add("quiz-fertig");
      var erg = document.getElementById("quiz-erg");
      erg.className = "quiz-erg " + (bestanden ? "gut" : "schlecht");
      erg.innerHTML = "<b>" + prozent + ui("٪</b> — ") + richtigZahl + ui(" من ") + gesamt +
        (bestanden ? ui(" · اجتزتَ الاختبار") : ui(" · دون حدّ النجاح (") +
          aktuell.quiz.bestehen + ui("٪)")) +
        (offen.length
          ? "<ul>" + offen.map(function (f) {
              return "<li>" + txt(f, "frage_ar") +
                (f.prueft ? ' <span class="chip">' + esc(f.prueft) + "</span>" : "") +
                "</li>";
            }).join("") + "</ul>"
          : "");

      zustand.quiz = zustand.quiz || {};
      zustand.quiz[aktuell.id] = {
        prozent: prozent,
        datum: new Date().toISOString().slice(0, 10),
        falsch: offen.map(function (f) { return f.id; })
      };
      sichern();
      erg.scrollIntoView({ block: "nearest" });
    };

    document.getElementById("quiz-neu").onclick = function () {
      leiten();
    };
  }

  /* ————— بطاقات المفردات ————— */
  var sitzung = null;

  function kartenQuelle(intern) {
    var d = intern && window.DATEN_INTERN ? window.DATEN_INTERN : window.DATEN;
    return d.elemente || [];
  }

  function kartenSeite(intern, nurId) {
    var elemente = kartenQuelle(intern).filter(function (e) {
      return !nurId || e.id === nurId;
    });
    var alle = KARTEN.sammle(elemente);
    var fort = zustand.karten || {};
    var faellig = KARTEN.waehle(alle, fort);
    var v = KARTEN.verteilung(alle, fort);

    var h = ui("<h1>بطاقات المفردات</h1>") +
      ui('<p class="matt">تكرارٌ متباعد بصناديق. البطاقةُ التي تعرفها ترتفع صندوقاً ') +
      ui("فيتباعد موعدُها، والتي تنساها تعود إلى الأوّل.</p>");
    if (intern) {
      h += ui('<div class="band warn">بطاقاتُ المعاينة الداخليّة') +
        ui('<span class="klein">مشتقّةٌ من محتوًى غيرِ مراجَع. لا تُعرض على مرشّح.</span></div>');
    }
    if (nurId) {
      h += ui('<p class="klein matt">وحدةٌ واحدة: <span class="chip">') + esc(nurId) +
        '</span> — <a href="#/karten' + (intern ? "-intern" : "") + ui('">كلُّ البطاقات</a></p>');
    }

    if (!alle.length) {
      h += ui('<div class="band warn">لا مفردةَ واحدة هنا.');
      if (nurId) {
        h += ui('<span class="klein">لا توجد مفرداتٌ لهذه الوحدة في <code>vokabeln[]</code>. جرّب ') +
          '<a href="#/karten' + (intern ? "-intern" : "") + '">' + ui("كلَّ البطاقات") + "</a>.</span></div>";
      } else {
        h += ui('<span class="klein">البطاقاتُ تُشتقّ من <code>vokabeln[]</code> في المحتوى، ') +
          ui("ولا توجد مفرداتٌ في هذا البناء بعد. جرّب ") +
          ui('<a href="#/karten-intern">بطاقات المعاينة الداخليّة</a>.</span></div>');
      }
      return h;
    }

    h += ui('<div class="karte"><h2>حالةُ المجموعة</h2>') +
      '<div class="boxen"><div class="neu"><b>' + v.neue + ui("</b><span>جديدة</span></div>") +
      v.boxen.map(function (n, i) {
        var tage = KARTEN.INTERVALLE[i];
        var wann = tageText(tage, true);
        return "<div><b>" + n + ui("</b><span>صندوق ") + (i + 1) +
          " · " + wann + "</span></div>";
      }).join("") + "</div>" +
      ui('<p class="klein matt">المجموع ') + alle.length + ui(" بطاقة · المستحقُّ اليوم ") +
      faellig.length + "</p>" + werkzeugRichtung() + "</div>";

    h += '<div class="karte" id="buehne"></div>';
    return h;
  }

  function werkzeugRichtung() {
    return '<div class="werkzeug">' +
      ui('<label class="klein matt">وجهُ البطاقة</label>') +
      '<select id="k-richtung">' +
      ui('<option value="de">ألمانيّ ← عربيّ</option>') +
      ui('<option value="ar">عربيّ ← ألمانيّ</option></select></div>');
  }

  function kartenBinden(intern, nurId) {
    var buehne = document.getElementById("buehne");
    if (!buehne) return;
    var wahl = document.getElementById("k-richtung");
    if (wahl) {
      wahl.value = zustand.kartenRichtung || "de";
      wahl.onchange = function () {
        zustand.kartenRichtung = wahl.value; sichern(); zeichneKarte();
      };
    }

    var elemente = kartenQuelle(intern).filter(function (e) {
      return !nurId || e.id === nurId;
    });
    var alle = KARTEN.sammle(elemente);
    sitzung = {
      liste: KARTEN.waehle(alle, zustand.karten || {}),
      i: 0, offen: false, richtig: 0, falsch: 0, wiederholt: 0
    };
    zeichneKarte();

    function zeichneKarte() {
      if (!sitzung.liste.length) {
        buehne.innerHTML = ui('<div class="band gut">لا بطاقةَ مستحقّةً اليوم.') +
          ui('<span class="klein">عُد غداً، أو اختر وحدةً بعينها من صفحتها.</span></div>');
        return;
      }
      if (sitzung.i >= sitzung.liste.length) return zeichneEnde();
      var k = sitzung.liste[sitzung.i];
      var vonDe = (zustand.kartenRichtung || "de") === "de";
      /* وجهُ البطاقة غيرُ الألمانيّ يتبع لغةَ المتعلّم. وإن لم تكن للمفردة
         إنجليزيّةٌ بعد، قيل ذلك صراحةً بدل أن تُدسَّ العربيّةُ مكانها. */
      var glosse = (zustand.sprache || "ar") === "en"
        ? (k.en || EN_FEHLT) : k.ar;
      var vorn = vonDe ? k.de : glosse;
      var h = '<div class="karte-buehne">' +
        '<div class="karte-vorn' + (vonDe ? " de" : "") + '">' + esc(vorn) + "</div>";
      if (sitzung.offen) {
        h += '<div class="karte-hinten">' +
          '<div class="karte-vorn' + (vonDe ? "" : " de") + '" style="font-size:20px">' +
          esc(vonDe ? glosse : k.de) + "</div>" +
          '<div class="reg">' +
          ui("<b>مع المريض</b><span>") + esc(k.patient || "—") + "</span>" +
          ui("<b>مع الفريق</b><span>") + esc(k.sag || "—") + "</span>" +
          ui("<b>في التوثيق</b><span>") + esc(k.dokument || "—") + "</span></div>" +
          ui('<div class="karte-quellen">من: ') + (k.quellen || []).map(function (id) {
            return '<a href="#/e/' + esc(id) + '">' + esc(id) + "</a>";
          }).join(" · ") + "</div></div>";
      }
      h += "</div>";
      h += '<div class="werkzeug" style="justify-content:center">' +
        (sitzung.offen
          ? ui('<button class="haupt" id="k-gut">عرفتها</button>') +
            ui('<button id="k-schlecht">لم أعرفها</button>')
          : ui('<button class="haupt" id="k-zeigen">أظهر الجواب</button>')) +
        "</div>" +
        '<p class="zaehlwerk">' + (sitzung.i + 1) + ui(" من ") + sitzung.liste.length +
        ui(" · عرفتُ ") + sitzung.richtig + ui(" · لم أعرف ") + sitzung.falsch + "</p>";
      buehne.innerHTML = h;

      var zeigen = document.getElementById("k-zeigen");
      if (zeigen) zeigen.onclick = function () { sitzung.offen = true; zeichneKarte(); };
      var gut = document.getElementById("k-gut");
      if (gut) gut.onclick = function () { antworten(true); };
      var schlecht = document.getElementById("k-schlecht");
      if (schlecht) schlecht.onclick = function () { antworten(false); };
    }

    function antworten(gewusst) {
      var k = sitzung.liste[sitzung.i];
      zustand.karten = zustand.karten || {};
      var alt = zustand.karten[k.schluessel] || KARTEN.neu(k.schluessel);
      zustand.karten[k.schluessel] = KARTEN.antworten(alt, gewusst);
      sichern();
      if (gewusst) sitzung.richtig++;
      else {
        sitzung.falsch++;
        // ما لم يُعرف يعود في آخر الجلسة نفسِها، مرّةً واحدةً لا أكثر
        if (sitzung.wiederholt < 20 && sitzung.liste.indexOf(k, sitzung.i + 1) < 0) {
          sitzung.liste.push(k); sitzung.wiederholt++;
        }
      }
      sitzung.i++; sitzung.offen = false;
      zeichneKarte();
    }

    function zeichneEnde() {
      var gesamt = sitzung.richtig + sitzung.falsch;
      buehne.innerHTML = '<div class="quiz-erg gut"><b>' + sitzung.richtig + "/" +
        gesamt + ui("</b> — انتهت الجلسة.") +
        ui('<ul><li>عرفتَ ') + sitzung.richtig + ui(" بطاقة، فارتفعت صندوقاً.</li>") +
        ui("<li>لم تعرف ") + sitzung.falsch + ui("، فعادت إلى الصندوق الأوّل.</li></ul></div>") +
        '<div class="werkzeug"><button class="haupt" onclick="location.reload()">' +
        ui("جلسةٌ جديدة</button></div>");
    }
  }

  /* ————— شريطُ وضع النسخة ————— */
  function modusBand() {
    var m = window.MODUS || "entwicklung";
    if (m === "lernende") return "";
    if (m === "pruefung") {
      return ui('<div class="modusband pruefung">نسخة مراجعة — غير معتمدة للطلاب') +
        ui("<span>كلُّ ما فيها مسوّدةٌ لم تُراجَع سريريّاً ولا منهجيّاً. ") +
        ui("للفريق والمراجِعين وحدَهم، ولا تُقدَّم إلى طالبٍ بوصفها مادّةً معتمدة.</span></div>");
    }
    return ui('<div class="modusband entwicklung">نسخة تطوير محلّيّة') +
      ui("<span>ليست نسخةَ طلّابٍ ولا نسخةَ مراجعةٍ منشورة.</span></div>");
  }

  /* ————— التوجيه ————— */
  function zeichnen(html) {
    var blatt = document.getElementById("blatt");
    blatt.innerHTML = modusBand() + html + '<div class="fuss">' +
      ui("Togetherwecan Jobs · المحتوى محلّيٌّ بالكامل، لا يغادر هذا الجهاز<br>") +
      ui("بُني بـ <code>tools/bau.py</code> — لا تُحرَّر <code>app/daten*.js</code> بيدك</div>");
    werkzeugBinden(); fertigBinden(); aufnahmeBinden(); quizBinden();
    sprechuebungBinden();
    sprechschleifeBinden();
    zielpruefungBinden();
    ordnungBinden();
    lueckenBinden();
    var v = document.querySelector("video"); if (v) v.playbackRate = zustand.tempo;
    var ziel = location.hash.indexOf("#a-") === 0 ? document.querySelector(location.hash) : null;
    if (ziel) ziel.scrollIntoView();
    else window.scrollTo(0, 0);
  }

  function navMarkieren() {
    /* المعاينةُ الداخليّةُ ليست للطلّاب: ملفُّها لا يُشحَن في نسختهم،
       فكان الرابطُ يبقى في الشريط ويعطي المتعلّمَ رسالةَ مطوّرين
       («شغّل tools/bau.py»). فيُخفى الرابطُ ويُردّ المسار. */
    if (window.MODUS === "lernende") {
      /* لا تسمِّه `intern`: الاسمُ لدالّةِ صفحةِ المعاينة، ومتغيّرٌ
         محلّيٌّ به يحجبها — وقد سقط الحارسُ عليّ به فوراً. */
      var internLink = document.querySelector('#nav a[href="#/intern"]');
      if (internLink) internLink.remove();
    }
    var pfad = location.hash || "#/";
    Array.prototype.forEach.call(document.querySelectorAll("#nav a"), function (a) {
      a.classList.toggle("an", a.getAttribute("href") === pfad);
    });
  }

  /* إطارُ الصفحة: الاتّجاهُ واللغةُ وعناوينُ التنقّل والعنوانُ في اللسان.
     العربيّةُ من اليمين والإنجليزيّةُ من اليسار، فتنقلب الصفحةُ كلُّها لا
     النصُّ وحدَه — وإلّا بقيت الأزرارُ والجداولُ معكوسةً على قارئ الإنجليزيّة. */
  function rahmenSprache() {
    var sprache = zustand.sprache || "ar";
    var wurzel = document.documentElement;
    wurzel.setAttribute("lang", sprache);
    /* العربيّةُ وحدَها من اليمين. والألمانيّةُ والإنجليزيّةُ من اليسار. */
    wurzel.setAttribute("dir", sprache === "ar" ? "rtl" : "ltr");
    Array.prototype.forEach.call(document.querySelectorAll("#nav a"), function (a) {
      var roh = a.getAttribute("data-text-ar");
      if (roh) a.textContent = ui(roh);
    });
    document.title = ui("دورة التحضير لامتحان المعرفة في التمريض — Togetherwecan Jobs");
    /* نصُّ الانتظار: يُترجَم ما دام هو الظاهر، ولا يُلمَس بعد رسم الصفحة. */
    var blatt = document.getElementById("blatt");
    var warte = blatt && blatt.getAttribute("data-text-ar");
    if (warte && blatt.textContent.trim() === warte) blatt.textContent = ui(warte);
  }

  function leiten() {
    document.body.setAttribute("data-ar", zustand.ar);
    rahmenSprache();
    document.body.setAttribute("data-sprache", zustand.sprache || "ar");
    var pfad = (location.hash || "#/").slice(1);
    if (pfad.indexOf("a-") === 0) return;
    navMarkieren();
    if (pfad === "" || pfad === "/") return zeichnen(start());
    if (pfad === "/abdeckung") return zeichnen(abdeckung());
    if (pfad === "/lehrplan") return zeichnen(lehrplan());
    if (pfad === "/diagnose") { zeichnen(diagnoseSeite()); diagnoseBinden(); return; }
    if (pfad === "/fortschritt") return zeichnen(fortschrittSeite());
    if (pfad === "/pruefung") { zeichnen(pruefungSeite()); pruefungBinden(); return; }
    if (pfad === "/wiederholung") {
      zeichnen(wiederholungSeite()); wiederholungBinden(); return;
    }
    if (pfad === "/intern") {
      if (window.MODUS === "lernende") { location.hash = "#/"; return; }
      return intern(zeichnen);
    }
    var mk = pfad.match(/^\/karten(-intern)?(?:\/(.+))?$/);
    if (mk) {
      // لا تسمِّ هذا `intern`: الاسمُ لدالّةِ صفحةِ المعاينة، وتعريفٌ محلّيٌّ
      // به يحجبها في نطاق `leiten` كلِّه فتتعطّل `#/intern`.
      var internModus = !!mk[1];
      var nurId = mk[2] ? decodeURIComponent(mk[2]) : null;
      if (!internModus) {
        zeichnen(kartenSeite(false, nurId));
        kartenBinden(false, nurId);
        return;
      }
      return internLaden(function (fehler) {
        if (fehler) return zeichnen('<div class="band rot">' + esc(fehler) + "</div>");
        zeichnen(kartenSeite(true, nurId));
        kartenBinden(true, nurId);
      });
    }
    var m = pfad.match(/^\/e\/(.+)$/);
    if (m) return element(decodeURIComponent(m[1]), zeichnen);
    zeichnen(ui('<div class="band rot">لا صفحةَ بهذا العنوان.</div>'));
  }

  spracheBinden();
  rahmenSprache();
  window.addEventListener("hashchange", leiten);
  if (!window.DATEN) {
    document.getElementById("blatt").innerHTML =
      ui('<div class="band rot">app/daten.js غائب — شغّل <code>python3 tools/bau.py</code>.</div>');
  } else {
    leiten();
  }
})();
