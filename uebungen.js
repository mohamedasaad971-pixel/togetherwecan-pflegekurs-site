/* تمارينُ مشتقّةٌ من محتوى الحالة نفسِه — ترتيبُ خطواتٍ وملءُ فراغات.
   ملفٌّ خالصٌ بلا DOM ولا تخزين، ليُختبَر خارجَ المتصفّح.

   **ولا يُخترَع فيه نصٌّ ولا تفسير.** خطواتُ الترتيب هي `ablauf` بترتيبها
   المعتمَد، وتعليلُ كلّ خطوةٍ هو `sicherheit` المكتوبُ فيها. وجملُ
   الفراغات هي `vokabeln[].sag` — الصياغةُ المهنيّةُ للمصطلح — والمصطلحُ
   يُحذَف منها فيصير هو الجواب. فإن لم يرد المصطلحُ في جملته حرفيّاً
   سقط التمرين ولم تُؤلَّف له جملة. */
(function (global) {
  "use strict";

  var ARTIKEL = /^(der|die|das)\s+/i;

  function ohneArtikel(wort) {
    return String(wort || "").replace(ARTIKEL, "").trim();
  }

  /* خلطٌ ثابتٌ بمفتاح: التمرينُ نفسُه يظهر بالترتيب نفسِه في كلّ زيارة،
     فلا يتبدّل تحت يد المتعلّم كلَّما أُعيد رسمُ الصفحة — ويبقى مع ذلك
     مختلفاً عن الترتيب الصحيح. */
  function streuung(schluessel) {
    var h = 2166136261;
    var text = String(schluessel);
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return function () {
      h ^= h << 13; h >>>= 0;
      h ^= h >> 17;
      h ^= h << 5; h >>>= 0;
      return h / 4294967296;
    };
  }

  function mischen(liste, schluessel) {
    var wuerfel = streuung(schluessel);
    var aus = liste.slice();
    for (var i = aus.length - 1; i > 0; i--) {
      var j = Math.floor(wuerfel() * (i + 1));
      var hilfe = aus[i]; aus[i] = aus[j]; aus[j] = hilfe;
    }
    /* خلطٌ أعاد الترتيبَ الصحيحَ نفسَه ليس تمريناً. */
    var gleich = aus.every(function (x, i) { return x === liste[i]; });
    if (gleich && aus.length > 1) aus.push(aus.shift());
    return aus;
  }

  /* ————— ترتيبُ خطوات الإجراء ————— */
  function ordnung(fall) {
    var schritte = (fall && fall.ablauf) || [];
    if (schritte.length < 3) return null;
    var stellen = schritte.map(function (_, i) { return i; });
    return {
      id: fall.id,
      schritte: schritte.map(function (s, i) {
        return {
          nr: i,
          de: s.schritt_de || "",
          ar: s.schritt_ar || "",
          warum: s.sicherheit || ""
        };
      }),
      gemischt: mischen(stellen, "ordnung:" + fall.id)
    };
  }

  /* ————— ملءُ الفراغات ————— */
  var BUCHSTABE = /[A-Za-zÄÖÜäöüßáéíóú]/;

  /* المصطلحُ يُلتقَط كلمةً كاملة. وبلا هذا الشرط التقط «begutachtung»
     داخلَ «Neubegutachtung» فصار الفراغُ يقطع كلمةً نصفين — وذلك تمرينٌ
     في التقطيع لا في المصطلح. */
  function amWortrand(satz, stelle, laenge) {
    var davor = stelle > 0 ? satz.charAt(stelle - 1) : "";
    var danach = satz.charAt(stelle + laenge);
    return !BUCHSTABE.test(davor) && !BUCHSTABE.test(danach);
  }

  function luecke(satz, wort) {
    var nackt = ohneArtikel(wort);
    if (!satz || nackt.length < 4) return null;
    var klein = satz.toLowerCase();
    var stelle = klein.indexOf(nackt.toLowerCase());
    while (stelle >= 0 && !amWortrand(satz, stelle, nackt.length)) {
      stelle = klein.indexOf(nackt.toLowerCase(), stelle + 1);
    }
    if (stelle < 0) return null;
    return {
      vor: satz.slice(0, stelle),
      nach: satz.slice(stelle + nackt.length),
      loesung: satz.slice(stelle, stelle + nackt.length)
    };
  }

  /* أين يُبحَث عن المصطلح، بالترتيب: صياغتُه المهنيّة، ثمّ سطرُ التوثيق،
     ثمّ ما قيل للمريض، ثمّ نصُّ التوثيق في الحالة، ثمّ أسطرُ الحوار.
     وكلُّها نصوصٌ معتمَدةٌ في الحالة نفسِها — ولا تُؤلَّف جملة. */
  function quellsaetze(fall, wort) {
    var saetze = [wort.sag, wort.dokument, wort.patient].map(function (s) {
      return { satz: s, entwurf: false };
    });
    var dok = (fall && fall.dokumentation) || {};
    if (dok.text_de) saetze.push({ satz: dok.text_de, entwurf: false });
    ((fall && fall.dialog) || []).forEach(function (z) {
      saetze.push({ satz: z.de, entwurf: false });
    });
    /* جملةُ المثال آخرُ ما يُلتمَس: مصطلحٌ لا يرد في نصوص الحالة أصلاً
       كُتبت له جملة. **وقرارُ محمد (١٤ أيلول، تصحيحُ قرارٍ سابق): تُدمَج
       في الموقع ولا تُحجَب عن المتعلّم لمجرّد أنّها تنتظر مراجعة.**
       فتدخل كغيرها، ويبقى وسمُ `entwurf` محمولاً معها: تعرضه نسخةُ
       المراجعة للمراجِع، ولا يُعرَض للمتعلّم. */
    if (wort.beispiel && wort.beispiel.de) {
      saetze.push({ satz: wort.beispiel.de,
                    entwurf: (wort.beispiel.status || "ungeprueft") !== "geprueft" });
    }
    return saetze;
  }

  function luecken(fall, hoechstens) {
    var woerter = (fall && fall.vokabeln) || [];
    var namen = woerter.map(function (w) { return ohneArtikel(w.de); });
    var aus = [];
    woerter.forEach(function (w, i) {
      var geteilt = null, entwurf = false;
      quellsaetze(fall, w).some(function (q) {
        geteilt = luecke(q.satz, w.de);
        entwurf = geteilt ? q.entwurf : false;
        return !!geteilt;
      });
      if (!geteilt) return;
      var andere = namen.filter(function (n, j) { return j !== i && n; });
      if (andere.length < 2) return;
      aus.push({
        wi: i,
        vor: geteilt.vor,
        nach: geteilt.nach,
        loesung: geteilt.loesung,
        optionen: mischen([geteilt.loesung].concat(andere.slice(0, 3)),
                          "luecke:" + fall.id + ":" + i),
        de: w.de,
        entwurf: entwurf,
        ar: w.ar || "",
        en: w.en || "",
        patient: w.patient || "",
        dokument: w.dokument || ""
      });
    });
    return aus.slice(0, hoechstens || 8);
  }

  /* مقارنةٌ عادلة: فرقُ حرفٍ كبيرٍ أو مسافةٍ ليس خطأً لغويّاً هنا. */
  function gleichwertig(eingabe, loesung) {
    function nackt(x) {
      return String(x || "").toLowerCase().replace(/[\s‏‎]+/g, "")
        .replace(/[.,;:!?»«"'()]/g, "");
    }
    return nackt(eingabe) === nackt(loesung) && nackt(loesung) !== "";
  }

  var API = {
    ohneArtikel: ohneArtikel, mischen: mischen, ordnung: ordnung,
    luecke: luecke, luecken: luecken, gleichwertig: gleichwertig
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.UEBUNGEN = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
