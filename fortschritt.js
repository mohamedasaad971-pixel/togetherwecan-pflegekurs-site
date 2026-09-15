/* لوحةُ التقدّم — تحسب ما جرى فعلاً، ولا تخلط ما قاسه البرنامجُ بما
   قاله المتعلّمُ عن نفسِه. ملفٌّ خالصٌ بلا DOM ولا تخزين.

   القاعدةُ الحاكمة (قرارُ محمد): **لا يُحوَّل التقييمُ الذاتيُّ إلى
   حقيقةٍ آليّة.** فالأرقامُ هنا نوعان لا يُجمَعان في رقمٍ واحد:

   - **وقائعُ مقيسة**: سؤالٌ أُجيب صواباً أو خطأً، وقسمٌ عُلّم أنّه تمّ.
   - **أقوالُ المتعلّم عن نفسِه**: حكمُه على نطقه، وإقرارُه بالأهداف.

   ولذلك لا «نسبةَ إتقانٍ» واحدة، ولا «مستوًى»، ولا تنبّؤٌ بامتحان. */
(function (global) {
  "use strict";

  var W = (typeof require !== "undefined" && typeof module !== "undefined")
    ? require("./wiederholung.js") : global.WIEDERHOLUNG;
  var D = (typeof require !== "undefined" && typeof module !== "undefined")
    ? require("./diagnose.js") : global.DIAGNOSE;

  function bereichVon(prueft) {
    return D ? D.bereichVon(prueft) : String(prueft || "").split(".")[0];
  }

  /* ————— وقائعُ مقيسة ————— */

  /* ما أنجزه المتعلّم من أقسام الحالات: عددٌ لا رأي. */
  function abschluss(zustand, elemente) {
    var fort = (zustand || {}).fortschritt || {};
    var quiz = (zustand || {}).quiz || {};
    var begonnen = 0, abschnitte = 0;
    (elemente || []).forEach(function (e) {
      var f = fort[e.id];
      if (f && (f.schritte || []).length) {
        begonnen++;
        abschnitte += f.schritte.length;
      }
    });
    var quizzes = Object.keys(quiz);
    return {
      elemente: (elemente || []).length,
      begonnen: begonnen,
      abschnitte: abschnitte,
      quizzes: quizzes.length,
      bestanden: quizzes.filter(function (k) {
        var e = (elemente || []).filter(function (x) { return x.id === k; })[0];
        var grenze = ((e || {}).quiz || {}).bestehen || 80;
        return (quiz[k].prozent || 0) >= grenze;
      }).length
    };
  }

  /* الإصابةُ بحسب مجال الكفاءة — من اختبارات الوحدات والتشخيص معاً.
     وكلُّها وقائع: سؤالٌ له جوابٌ صائبٌ واحد. */
  function bereiche(zustand, elemente) {
    var nach = {};
    function zaehle(bereich, richtig) {
      var b = nach[bereich] = nach[bereich] || { bereich: bereich, richtig: 0, gesamt: 0 };
      b.gesamt++;
      if (richtig) b.richtig++;
    }
    var quiz = (zustand || {}).quiz || {};
    (elemente || []).forEach(function (e) {
      var stand = quiz[e.id];
      if (!stand) return;
      var falsch = stand.falsch || [];
      (((e.quiz || {}).fragen) || []).forEach(function (f) {
        if (!f.prueft) return;
        zaehle(bereichVon(f.prueft), falsch.indexOf(f.id) < 0);
      });
    });
    var d = (zustand || {}).diagnose || {};
    Object.keys(d.antworten || {}).forEach(function (kennung) {
      (elemente || []).forEach(function (e) {
        (((e.quiz || {}).fragen) || []).forEach(function (f) {
          if (f.id !== kennung || !f.prueft) return;
          var soll = -1;
          (f.optionen || []).forEach(function (o, j) { if (o.richtig) soll = j; });
          zaehle(bereichVon(f.prueft), d.antworten[kennung] === soll);
        });
      });
    });
    return Object.keys(nach).sort().map(function (k) { return nach[k]; });
  }

  /* الأخطاءُ المتكرّرة: بنودٌ أخطأ فيها المتعلّمُ أكثرَ من مرّةٍ في
     المراجعة. والعدُّ من سجلّ البطاقات نفسِه، لا من تقدير. */
  function haeufigeFehler(zustand, elemente, ab) {
    var grenze = ab == null ? 2 : ab;
    var fort = (zustand || {}).karten || {};
    return (W ? W.sammle(zustand, elemente) : []).map(function (x) {
      var s = fort[x.schluessel] || {};
      return { posten: x, falsch: s.falsch || 0, richtig: s.richtig || 0, box: s.box || 0 };
    }).filter(function (x) {
      return x.falsch >= grenze;
    }).sort(function (a, b) { return b.falsch - a.falsch; });
  }

  /* ————— أقوالُ المتعلّم عن نفسِه ————— */

  /* تُعرَض معدودةً ولا تُحوَّل إلى نسبةِ إتقان: «قلتَ عن ثلاث جملٍ إنّها
     تحتاج إعادة» واقعةٌ عن قولِه، لا عن نطقِه. */
  function selbsturteil(zustand) {
    var sprech = (zustand || {}).sprech || {};
    var aus = { saetze: 0, versuche: 0, wieder: 0, ok: 0, sicher: 0, ohne: 0,
                punkte: 0, punkteGesamt: 0 };
    Object.keys(sprech).forEach(function (k) {
      var s = sprech[k] || {};
      aus.saetze++;
      aus.versuche += s.versuche || 0;
      aus.punkte += s.geprueft || 0;
      aus.punkteGesamt += s.gesamt || 0;
      if (s.stufe === "wieder") aus.wieder++;
      else if (s.stufe === "ok") aus.ok++;
      else if (s.stufe === "sicher") aus.sicher++;
      else aus.ohne++;
    });
    return aus;
  }

  /* إقرارُ الأهداف: كم هدفاً قال المتعلّمُ إنّه يستطيعه. قولُه هو. */
  function ziele(zustand, elemente) {
    var gemerkt = (zustand || {}).ziele || {};
    var aus = { bestaetigt: 0, gesamt: 0, faelle: 0 };
    (elemente || []).forEach(function (e) {
      var liste = e.lernziele || [];
      if (!liste.length) return;
      var an = gemerkt[e.id];
      if (!an) return;
      aus.faelle++;
      aus.gesamt += liste.length;
      aus.bestaetigt += an.length;
    });
    return aus;
  }

  var API = {
    bereichVon: bereichVon, abschluss: abschluss, bereiche: bereiche,
    haeufigeFehler: haeufigeFehler, selbsturteil: selbsturteil, ziele: ziele
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.FORTSCHRITT = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
