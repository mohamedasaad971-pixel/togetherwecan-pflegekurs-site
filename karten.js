/* جدولةُ بطاقات المفردات — تكرارٌ متباعدٌ بصناديق لايتنر.
   ملفٌّ خالصٌ بلا DOM ولا تخزين، ليُختبَر خارجَ المتصفّح. */
(function (global) {
  "use strict";

  /* الفواصلُ بالأيّام لكلّ صندوق. الصندوقُ صفر يعود في الجلسة نفسِها.
     والاختيارُ مقصود: مضاعفةٌ تقريبيّة، وسقفٌ عند خمسةٍ وثلاثين يوماً حتّى
     لا تغيب مفردةٌ مهنيّةٌ فصلاً كاملاً قبل الامتحان. */
  var INTERVALLE = [0, 1, 3, 7, 16, 35];
  var LETZTE_BOX = INTERVALLE.length - 1;

  function tagText(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function heute(jetzt) {
    return tagText(jetzt ? new Date(jetzt) : new Date());
  }

  function plusTage(datum, tage) {
    var d = new Date(datum + "T00:00:00");
    d.setDate(d.getDate() + tage);
    return tagText(d);
  }

  function neu(schluessel, jetzt) {
    return { schluessel: schluessel, box: 0, faellig: heute(jetzt),
             richtig: 0, falsch: 0, zuletzt: "" };
  }

  /* الجواب: عرفها فترتفع صندوقاً، أو لم يعرفها فتعود إلى الصفر.
     العودةُ إلى الصفر لا إلى صندوقٍ أدنى بدرجة: مفردةٌ مهنيّةٌ نُسيت تُعامَل
     كأنّها جديدة، فالنسيانُ في هذا السياق ليس تراجعاً طفيفاً. */
  function antworten(karte, gewusst, jetzt) {
    var box = gewusst ? Math.min(karte.box + 1, LETZTE_BOX) : 0;
    return {
      schluessel: karte.schluessel,
      box: box,
      faellig: plusTage(heute(jetzt), INTERVALLE[box]),
      richtig: karte.richtig + (gewusst ? 1 : 0),
      falsch: karte.falsch + (gewusst ? 0 : 1),
      zuletzt: heute(jetzt)
    };
  }

  function istFaellig(karte, jetzt) {
    return !karte || karte.faellig <= heute(jetzt);
  }

  /* يجمع المفردات من عناصر المحتوى ويدمج المكرّر بالكلمة الألمانيّة نفسِها،
     فتبقى المفردةُ بطاقةً واحدةً ولو وردت في حالتين. */
  function sammle(elemente) {
    var karten = [];
    var index = {};
    (elemente || []).forEach(function (el) {
      (el.vokabeln || []).forEach(function (w) {
        if (!w || !w.de) return;
        var schluessel = String(w.de).trim();
        if (!schluessel) return;
        var karte = index[schluessel];
        if (!karte) {
          karte = {
            schluessel: schluessel, de: w.de, ar: w.ar,
            patient: w.patient, sag: w.sag, dokument: w.dokument,
            quellen: []
          };
          index[schluessel] = karte;
          karten.push(karte);
        }
        if (karte.quellen.indexOf(el.id) < 0) karte.quellen.push(el.id);
      });
    });
    return karten;
  }

  /* البطاقاتُ المستحقّة اليوم: الجديدةُ أوّلاً بحسب ترتيب المحتوى، ثمّ
     المؤجَّلةُ بحسب أقدم استحقاق. */
  function waehle(karten, fortschritt, jetzt) {
    fortschritt = fortschritt || {};
    return karten.filter(function (k) {
      return istFaellig(fortschritt[k.schluessel], jetzt);
    }).sort(function (a, b) {
      var fa = fortschritt[a.schluessel], fb = fortschritt[b.schluessel];
      if (!fa && fb) return -1;
      if (fa && !fb) return 1;
      if (!fa && !fb) return 0;
      return fa.faellig < fb.faellig ? -1 : fa.faellig > fb.faellig ? 1 : 0;
    });
  }

  function verteilung(karten, fortschritt) {
    var boxen = INTERVALLE.map(function () { return 0; });
    var neue = 0;
    karten.forEach(function (k) {
      var f = (fortschritt || {})[k.schluessel];
      if (!f) neue++;
      else boxen[f.box]++;
    });
    return { neue: neue, boxen: boxen };
  }

  var API = {
    INTERVALLE: INTERVALLE, LETZTE_BOX: LETZTE_BOX,
    heute: heute, plusTage: plusTage, neu: neu, antworten: antworten,
    istFaellig: istFaellig, sammle: sammle, waehle: waehle,
    verteilung: verteilung
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.KARTEN = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
