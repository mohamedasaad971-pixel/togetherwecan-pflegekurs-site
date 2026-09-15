/* الاختبارُ التشخيصيُّ أوّلَ الدورة — اختيارٌ من أسئلةٍ قائمة، لا أسئلةٌ
   جديدة. ملفٌّ خالصٌ بلا DOM ولا تخزين، ليُختبَر خارجَ المتصفّح.

   **ما هو**: اثنا عشر سؤالاً موزّعةً على مجالات الكفاءة، تدلّ على **أين
   يبدأ** المتعلّم. **وما ليس هو**: قياسَ مستوًى لغويٍّ ولا تقييماً
   رسميّاً ولا تنبّؤاً بنتيجة الامتحان. اثنا عشر سؤالاً لا تفعل ذلك،
   ولا يُقال إنّها تفعله.

   والأسئلةُ مأخوذةٌ بأعيانها من اختبارات الوحدات، فلا يُخترَع سؤالٌ
   سريريٌّ هنا ولا تفسير. وتسميةُ المجال تأتي من `anforderungen.bereiche`
   كما هي. */
(function (global) {
  "use strict";

  var JE_BEREICH = 2;

  function bereichVon(prueft) {
    var text = String(prueft || "");
    if (!text) return "";
    if (text.indexOf("P45") === 0) return "P45";
    return text.split(".")[0];
  }

  /* البنكُ كلُّه: كلُّ سؤالٍ مفردٍ موسومٍ بمتطلَّب في الدورة — نحوٌ من
     مئةٍ وعشرين. والتشخيصُ يأخذ منه اثني عشر. */
  function alleFragen(elemente) {
    var aus = [];
    (elemente || []).forEach(function (e) {
      var quiz = e && e.quiz;
      if (!quiz || !quiz.fragen) return;
      quiz.fragen.forEach(function (f) {
        if (f.art !== "einfach" || !f.prueft) return;
        aus.push({
          id: f.id, element: e.id, titel: e.titelAr || e.titel_de || e.id,
          prueft: f.prueft, bereich: bereichVon(f.prueft), frage: f
        });
      });
    });
    return aus;
  }

  /* الاختيار: **التغطيةُ ثابتةٌ والأسئلةُ تتبدّل.** سؤالان من كلّ مجالٍ
     في كلّ محاولة — هذا لا يتغيّر، وإلّا لم تُقارَن محاولةٌ بمحاولة.
     وأمّا أيُّ سؤالين، **فأوّلُ ما لم يره المتعلّمُ بعد**، حتّى لا تصير
     الإعادةُ حفظاً للإجابات.

     وكان هنا دورانٌ على رقم المحاولة أيضاً، فأُزيل: الكسرُ المتعمَّد
     أثبت أنّه لا يغيّر شيئاً — قائمةُ «ما لم يُرَ» وحدَها تكفي — وآليّةٌ
     لا أثرَ لها كذبٌ على قارئ الشِّفرة. ولا عشوائيّةَ هنا: المدخلاتُ
     نفسُها تعطي الأسئلةَ نفسَها. */
  function waehlen(elemente, wahl) {
    var opt = wahl || {};
    var zahl = opt.jeBereich || JE_BEREICH;
    var gesehen = {};
    (opt.gesehen || []).forEach(function (kennung) { gesehen[kennung] = true; });

    var nach = {};
    alleFragen(elemente).forEach(function (f) {
      (nach[f.bereich] = nach[f.bereich] || []).push(f);
    });

    var aus = [];
    Object.keys(nach).sort().forEach(function (bereich) {
      var alle = nach[bereich];
      var frisch = alle.filter(function (f) { return !gesehen[f.id]; });
      var reihen = [frisch, alle];   // ما لم يُرَ أوّلاً، ثمّ ما بقي
      var genommen = [], elementeGenutzt = {};
      reihen.forEach(function (reihe) {
        reihe.forEach(function (f) {
          if (genommen.length >= zahl || genommen.indexOf(f) >= 0) return;
          if (elementeGenutzt[f.element]) return;
          elementeGenutzt[f.element] = true;
          genommen.push(f);
        });
      });
      // مجالٌ أسئلتُه كلُّها من عنصرٍ واحد: يُملأ النقصُ بلا شرط العنصر.
      reihen.forEach(function (reihe) {
        reihe.forEach(function (f) {
          if (genommen.length >= zahl || genommen.indexOf(f) >= 0) return;
          genommen.push(f);
        });
      });
      aus = aus.concat(genommen);
    });
    return aus;
  }

  /* حجمُ البنك لكلّ مجال. يُعرَض للمتعلّم لأنّ مجالاً بسبعة أسئلةٍ
     تنفد أسئلتُه بعد ثلاث محاولات، فتتكرّر — ويُقال ذلك ولا يُستَر. */
  function bankgroesse(elemente) {
    var nach = {};
    alleFragen(elemente).forEach(function (f) {
      nach[f.bereich] = (nach[f.bereich] || 0) + 1;
    });
    return nach;
  }

  function richtigeWahl(frage) {
    var i = -1;
    (frage.optionen || []).forEach(function (o, j) { if (o.richtig) i = j; });
    return i;
  }

  /* التقدير: عددٌ لكلّ مجال، لا درجةٌ واحدةٌ للمتعلّم. «نقطةُ قوّة» تعني
     أنّه أصاب أسئلةَ ذلك المجال كلَّها هنا — لا أنّه يتقنه. */
  function auswerten(auswahl, antworten) {
    var bereiche = {};
    (auswahl || []).forEach(function (f) {
      var b = bereiche[f.bereich] = bereiche[f.bereich] ||
        { bereich: f.bereich, richtig: 0, gesamt: 0, falsch: [] };
      b.gesamt++;
      var gewaehlt = (antworten || {})[f.id];
      if (gewaehlt != null && gewaehlt === richtigeWahl(f.frage)) b.richtig++;
      else b.falsch.push(f);
    });
    var liste = Object.keys(bereiche).sort().map(function (k) { return bereiche[k]; });
    return {
      bereiche: liste,
      beantwortet: (auswahl || []).filter(function (f) {
        return (antworten || {})[f.id] != null;
      }).length,
      gesamt: (auswahl || []).length,
      richtig: liste.reduce(function (s, b) { return s + b.richtig; }, 0),
      staerken: liste.filter(function (b) { return b.gesamt && b.richtig === b.gesamt; }),
      schwaechen: liste.filter(function (b) { return b.richtig < b.gesamt; })
    };
  }

  /* المسارُ المقترَح: **بالمتطلَّب الذي أخطأه بعينه، لا بالمجال كلِّه.**
     أوّلُ صياغةٍ رشّحت كلَّ عنصرٍ يمسّ مجالاً فيه خطأ، فخرجت خمسةٌ وخمسون
     عنصراً — أي الدورةُ كلُّها، وهذا ليس مساراً بل قائمة. والمتطلَّبُ
     الواحد (I.4a مثلاً) يثبته عنصرٌ أو عنصران، فيصير الترشيحُ قصيراً
     وصادقاً: «هنا، لأنّك أخطأتَ هذا».

     والترتيبُ ترتيبُ الدورة لا ترتيبُ الضعف: البناءُ متدرّجٌ، وقفزُه
     يعاقب المتعلّمَ مرّتين. */
  function weg(elemente, ergebnis) {
    var quelle = {};
    (ergebnis.schwaechen || []).forEach(function (b) {
      (b.falsch || []).forEach(function (f) {
        (quelle[f.prueft] = quelle[f.prueft] || []).push(
          { frage: f.id, element: f.element, bereich: f.bereich });
      });
    });
    if (!Object.keys(quelle).length) return [];
    var aus = [];
    (elemente || []).forEach(function (e) {
      var treffer = Object.keys(e._belegt || {}).filter(function (kennung) {
        return quelle[kennung];
      }).sort();
      if (treffer.length) {
        aus.push({
          id: e.id, titel: e.titelAr || e.titel_de || e.id, art: e._art,
          wegen: treffer,
          /* سببُ التوصية محفوظٌ لا مستنتَجٌ لاحقاً: أيُّ سؤالٍ أخطأه
             المتعلّمُ أدّى إلى ترشيح هذا العنصر بأيّ متطلَّب. */
          weil: treffer.map(function (kennung) {
            return { prueft: kennung, fragen: quelle[kennung].map(function (q) {
              return q.frage;
            }) };
          })
        });
      }
    });
    return aus;
  }

  var API = {
    JE_BEREICH: JE_BEREICH, bereichVon: bereichVon, alleFragen: alleFragen,
    waehlen: waehlen, bankgroesse: bankgroesse, richtigeWahl: richtigeWahl,
    auswerten: auswerten, weg: weg
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.DIAGNOSE = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
