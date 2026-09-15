/* المراجعةُ المتباعدة: ما يعود، ولماذا، ومتى.
   ملفٌّ خالصٌ بلا DOM ولا تخزين، ليُختبَر خارجَ المتصفّح.

   **لا يولّد هذا الملفُّ محتوًى ولا حكماً.** يقرأ ما فعله المتعلّمُ فعلاً
   ويجمعه في قائمةٍ واحدة:

   - **سؤالٌ أخطأه** في اختبار وحدةٍ أو في التشخيص — واقعةٌ مسجَّلة.
   - **جملةٌ نطقها وحكم على نفسِه** فيها بـ«يحتاج إعادة» أو ترك بنداً
     غيرَ مُقَرّ — **حكمُه هو**، ويُقال ذلك عند كلّ عرض، فلا يصير رأيُ
     المتعلّم في نفسِه قياساً آليّاً.
   - **مفردةٌ في صندوقٍ منخفض** من بطاقاته.

   والجدولةُ واحدةٌ للجميع: صناديقُ لايتنر في `app/karten.js` — ١ · ٣ · ٧
   · ١٦ · ٣٥ يوماً — فلا يحتاج المتعلّمُ أن يفهم نظامين. */
(function (global) {
  "use strict";

  var K = (typeof require !== "undefined" && typeof module !== "undefined")
    ? require("./karten.js") : global.KARTEN;

  var TYPEN = ["frage", "satz", "wort"];

  function elementeNach(elemente) {
    var index = {};
    (elemente || []).forEach(function (e) { index[e.id] = e; });
    return index;
  }

  function frageFinden(element, kennung) {
    var fragen = ((element || {}).quiz || {}).fragen || [];
    for (var i = 0; i < fragen.length; i++) {
      if (fragen[i].id === kennung) return fragen[i];
    }
    return null;
  }

  /* أسئلةٌ أخطأها المتعلّمُ في اختبارات الوحدات. */
  function ausQuiz(zustand, index) {
    var aus = [];
    var quiz = (zustand || {}).quiz || {};
    Object.keys(quiz).forEach(function (elementId) {
      var stand = quiz[elementId] || {};
      (stand.falsch || []).forEach(function (kennung) {
        var e = index[elementId];
        var f = frageFinden(e, kennung);
        if (!f) return;
        aus.push({
          schluessel: "f:" + elementId + ":" + kennung,
          typ: "frage", element: elementId,
          titel: (e && (e.titelAr || e.titel_de)) || elementId,
          frage: f, prueft: f.prueft || "",
          grund: "quiz", datum: stand.datum || ""
        });
      });
    });
    return aus;
  }

  /* أسئلةٌ أخطأها في التشخيص — الواقعةُ نفسُها، فتُدمَج بالمفتاح نفسِه. */
  function ausDiagnose(zustand, index) {
    var d = (zustand || {}).diagnose || {};
    var antworten = d.antworten || {};
    var aus = [];
    Object.keys(antworten).forEach(function (kennung) {
      Object.keys(index).forEach(function (elementId) {
        var f = frageFinden(index[elementId], kennung);
        if (!f) return;
        var soll = -1;
        (f.optionen || []).forEach(function (o, j) { if (o.richtig) soll = j; });
        if (antworten[kennung] === soll) return;
        aus.push({
          schluessel: "f:" + elementId + ":" + kennung,
          typ: "frage", element: elementId,
          titel: index[elementId].titelAr || index[elementId].titel_de || elementId,
          frage: f, prueft: f.prueft || "",
          grund: "diagnose", datum: d.datum || ""
        });
      });
    });
    return aus;
  }

  /* جملٌ نطقها المتعلّمُ وحكم على نفسِه فيها. المفتاحُ `d:<حالة>:<سطر>`
     كما تكتبه حلقةُ الكلام. */
  function ausSprechen(zustand, index) {
    var sprech = (zustand || {}).sprech || {};
    var aus = [];
    Object.keys(sprech).forEach(function (schluessel) {
      var stand = sprech[schluessel] || {};
      var teile = String(schluessel).split(":");
      var element = index[teile[1]];
      var zeile = element && (element.dialog || [])[Number(teile[2])];
      if (!zeile) return;
      var unsicher = stand.stufe === "wieder";
      var offen = (stand.gesamt || 0) > 0 && (stand.geprueft || 0) < stand.gesamt;
      if (!unsicher && !offen) return;
      aus.push({
        schluessel: "s:" + schluessel,
        typ: "satz", element: teile[1],
        titel: element.titelAr || element.titel_de || teile[1],
        text: zeile.de || "", ton: zeile.ton || "",
        stufe: stand.stufe || "", geprueft: stand.geprueft || 0,
        gesamt: stand.gesamt || 0, versuche: stand.versuche || 0,
        grund: unsicher ? "selbsturteil" : "offene_punkte",
        datum: stand.datum || ""
      });
    });
    return aus;
  }

  /* مفرداتٌ في الصندوقين الأوّلين: ما يُنسى سريعاً. */
  function ausKarten(zustand, elemente, grenze) {
    var fort = (zustand || {}).karten || {};
    var aus = [];
    (K.sammle(elemente) || []).forEach(function (karte) {
      var stand = fort[karte.schluessel];
      if (!stand || stand.box > (grenze == null ? 1 : grenze)) return;
      if (!stand.falsch) return;   // لم يُخطئ فيها قطّ: ليست صعبةً عليه
      aus.push({
        schluessel: karte.schluessel, typ: "wort", element: (karte.quellen || [])[0] || "",
        titel: karte.de, text: karte.de, ar: karte.ar,
        grund: "karte", box: stand.box, datum: stand.zuletzt || ""
      });
    });
    return aus;
  }

  function sammle(zustand, elemente) {
    var index = elementeNach(elemente);
    var alle = ausQuiz(zustand, index)
      .concat(ausDiagnose(zustand, index))
      .concat(ausSprechen(zustand, index))
      .concat(ausKarten(zustand, elemente));
    var gesehen = {};
    var aus = [];
    alle.forEach(function (x) {
      if (gesehen[x.schluessel]) {
        /* الواقعةُ نفسُها من مصدرين: تُذكَر المصادرُ كلُّها ولا يُكرَّر البند. */
        var alt = gesehen[x.schluessel];
        if (alt.grund !== x.grund) alt.auch = x.grund;
        return;
      }
      gesehen[x.schluessel] = x;
      aus.push(x);
    });
    return aus;
  }

  function faellige(posten, zustand, jetzt) {
    var fort = (zustand || {}).karten || {};
    return (posten || []).filter(function (x) {
      return K.istFaellig(fort[x.schluessel], jetzt);
    });
  }

  /* حالُ بندٍ واحدٍ بكلماتٍ مفهومة: في أيّ صندوقٍ هو، ومتى يعود. */
  function stand(posten, zustand, jetzt) {
    var fort = (zustand || {}).karten || {};
    var s = fort[posten.schluessel];
    if (!s) return { neu: true, box: 0, faellig: K.heute(jetzt), tage: 0 };
    return { neu: false, box: s.box, faellig: s.faellig,
             tage: K.INTERVALLE[s.box], richtig: s.richtig, falsch: s.falsch };
  }

  function zaehlen(posten, zustand, jetzt) {
    var aus = { gesamt: (posten || []).length, faellig: 0 };
    TYPEN.forEach(function (t) { aus[t] = 0; });
    faellige(posten, zustand, jetzt).forEach(function (x) {
      aus.faellig++;
      aus[x.typ] = (aus[x.typ] || 0) + 1;
    });
    return aus;
  }

  var API = {
    TYPEN: TYPEN, sammle: sammle, faellige: faellige, stand: stand,
    zaehlen: zaehlen, ausQuiz: ausQuiz, ausDiagnose: ausDiagnose,
    ausSprechen: ausSprechen, ausKarten: ausKarten
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.WIEDERHOLUNG = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
