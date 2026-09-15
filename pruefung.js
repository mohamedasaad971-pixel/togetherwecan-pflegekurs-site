/* محاكاةُ الامتحان بوقتٍ محدَّد — بناءُ الجولة، وحسابُ الوقت، وتقديرُ
   ما يمكن تقديرُه آليّاً. ملفٌّ خالصٌ بلا DOM ولا تخزين.

   **ما هي**: تمرينٌ بوقتٍ على بنية § 45 PflAPrV — محطّةٌ عمليّةٌ ومحطّةٌ
   شفهيّةٌ وأسئلةٌ مكتوبة — من محتوى الدورة نفسِه.

   **وما ليست**: امتحاناً، ولا تقييماً رسميّاً، ولا تنبّؤاً بنتيجة. ولا
   تُصحَّح المحطّتان آليّاً: الآلةُ تصحّح ما له جوابٌ واحد وحسب، والباقي
   تقييمٌ ذاتيٌّ بمعايير المحطّة المكتوبة في المحتوى.

   وقرارُ محمد: **لا تُستعمَل الجملُ المسوّدة (`beispiel`) في تقييمٍ عالي
   الأهمّيّة قبل اعتمادها** — فلا تدخل هذه الجولةَ تمارينُ الفراغ أصلاً. */
(function (global) {
  "use strict";

  var D = (typeof require !== "undefined" && typeof module !== "undefined")
    ? require("./diagnose.js") : global.DIAGNOSE;

  var FRAGEN_ZAHL = 6;
  var MINUTE_JE_FRAGE = 1;

  function stationen(elemente, teil) {
    return (elemente || []).filter(function (e) {
      return e._art === "training" && e.teil === teil && e.zeit_min;
    });
  }

  function waehleStation(liste, gesehen) {
    var gesucht = {};
    (gesehen || []).forEach(function (k) { gesucht[k] = true; });
    var frisch = liste.filter(function (e) { return !gesucht[e.id]; });
    return (frisch[0] || liste[0] || null);
  }

  /* جولةٌ واحدة: محطّةٌ عمليّةٌ وأخرى شفهيّةٌ وستّةُ أسئلةٍ مكتوبة.
     والوقتُ **مجموعُ ما هو مكتوبٌ في المحطّتين** زائدَ دقيقةٍ لكلّ سؤال
     — لا رقمَ مخترَعاً. */
  function bauen(elemente, wahl) {
    var opt = wahl || {};
    var gesehen = opt.gesehen || [];
    var praktisch = waehleStation(stationen(elemente, "praktisch"), gesehen);
    var muendlich = waehleStation(stationen(elemente, "muendlich"), gesehen);
    if (!praktisch || !muendlich) return null;
    var bank = D ? D.alleFragen(elemente) : [];
    var frisch = bank.filter(function (f) { return gesehen.indexOf(f.id) < 0; });
    var fragen = (frisch.length >= FRAGEN_ZAHL ? frisch : bank).slice(0, FRAGEN_ZAHL);
    return {
      praktisch: praktisch, muendlich: muendlich, fragen: fragen,
      dauer_min: (praktisch.zeit_min || 0) + (muendlich.zeit_min || 0) +
        fragen.length * MINUTE_JE_FRAGE
    };
  }

  /* الوقتُ بلحظةِ نهايةٍ مطلقةٍ لا بعدّادٍ يعمل في الصفحة: صفحةٌ أُغلقت
     أو حاسوبٌ نام لا يوقفان الامتحان، والاستئنافُ يحسب ما بقي بصدق. */
  function starten(runde, jetzt) {
    var beginn = jetzt ? new Date(jetzt) : new Date();
    return {
      aktiv: true, fertig: false,
      gestartet: beginn.toISOString(),
      endet: new Date(beginn.getTime() + runde.dauer_min * 60000).toISOString(),
      dauer_min: runde.dauer_min,
      teile: {
        praktisch: runde.praktisch.id, muendlich: runde.muendlich.id,
        fragen: runde.fragen.map(function (f) { return f.id; })
      },
      antworten: {}, selbst: {}
    };
  }

  function restSekunden(lauf, jetzt) {
    if (!lauf || !lauf.endet) return 0;
    var nun = jetzt ? new Date(jetzt) : new Date();
    return Math.max(0, Math.round((new Date(lauf.endet) - nun) / 1000));
  }

  function abgelaufen(lauf, jetzt) {
    return !!lauf && restSekunden(lauf, jetzt) <= 0;
  }

  function zeitText(sekunden) {
    var m = Math.floor(sekunden / 60), s = sekunden % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ما يُصحَّح آليّاً: الأسئلةُ وحدَها. ولا يُخلَط بما حكم به المتعلّمُ
     على نفسِه في المحطّتين. */
  function bewerten(lauf, runde) {
    var richtig = 0, offen = [];
    (runde.fragen || []).forEach(function (f) {
      var soll = D.richtigeWahl(f.frage);
      var gewaehlt = (lauf.antworten || {})[f.id];
      if (gewaehlt === soll) richtig++;
      else offen.push({ frage: f, gewaehlt: gewaehlt == null ? -1 : gewaehlt, soll: soll });
    });
    return { richtig: richtig, gesamt: (runde.fragen || []).length, offen: offen };
  }

  /* التقييمُ الذاتيُّ للمحطّتين: عددُ ما أقرّه المتعلّمُ من معاييرها.
     يُعرَض معدوداً ولا يُجمَع مع ما فوق. */
  function selbststand(lauf, runde) {
    var aus = {};
    ["praktisch", "muendlich"].forEach(function (teil) {
      var e = runde[teil] || {};
      var liste = (lauf.selbst || {})[e.id] || [];
      aus[teil] = { element: e.id, bestaetigt: liste.length,
                    gesamt: (e.kriterien || []).length };
    });
    return aus;
  }

  var API = {
    FRAGEN_ZAHL: FRAGEN_ZAHL, stationen: stationen, bauen: bauen,
    starten: starten, restSekunden: restSekunden, abgelaufen: abgelaufen,
    zeitText: zeitText, bewerten: bewerten, selbststand: selbststand
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.PRUEFUNG = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
