/* ==========================================================================
   apb architekten ag – CMS (Testversion)
   Bearbeitet Projekte, Bilder, Pläne, Startseite. Änderungen landen als Entwurf im Browser
   (localStorage) und werden beim Veröffentlichen als ein Commit nach GitHub geschrieben:
   assets/data/cms.json + hochgeladene Originalbilder (assets/img/cms/…). Danach baut GitHub die Seite neu.
   ========================================================================== */
document.addEventListener("DOMContentLoaded", function () {   // erst nach data.js (wird am Seitenende geladen)
  "use strict";
  var REPO = { owner: "dominik-mettler", name: "Website-apb", branch: "claude/apb-website-redesign-jmiwyv" };
  var KEY = "apb-cms-entwurf", TOKEN_KEY = "apb-cms-token";
  var D = window.APB || { projects: [], cats: [] };
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function el(h) { var d = document.createElement("div"); d.innerHTML = h.trim(); return d.firstChild; }
  var FAKTEN = ["Verfahren", "Status", "Fertigstellung", "Bearbeitung", "Bauherr", "Kosten", "Kosteneinhaltung", "Kenndaten", "Kennwerte", "Bauzeit", "Auszeichnung", "Label", "Adresse"];
  var STATUS = ["Realisiert", "In Ausführung", "In Planung", "Wettbewerb", "Nicht realisiert"];
  var BLOECKE = [["hero", "Startbilder (Karussell)", true], ["intro", "Einleitung «seit 1996»"], ["jubilaeum", "30 Jahre apb"], ["auswahl", "Projektauswahl (Leiste)"], ["aktuell", "Aktuell"],
    ["themen", "Themen"], ["leistungen", "Leistungen"], ["karte", "Projekte auf der Karte"], ["karriere", "Karriere"], ["kontakt", "Kontakt / Abschluss", true]];

  var root = $("[data-cms-app]"); if (!root) return;
  var PUB = { projekte: {}, neu: {}, startseite: {}, seiten: {} }, DRAFT = null, BLOBS = {}, UPL = {};   // UPL: Pfad -> Blob (noch nicht veröffentlicht)
  window.APB_BLOB = {};   // Pfad (ohne Endung) -> Objekt-URL, auch für die Vorschau-Fenster
  var byId = {}; D.projects.forEach(function (p) { byId[p.id] = p; });
  var tab = "projekte", aktuell = null, medienFilter = { q: "", art: "", projekt: "", aus: false };

  /* ---------- Entwurf ---------- */
  function speichern() { try { localStorage.setItem(KEY, JSON.stringify(DRAFT)); } catch (e) { meldung("Entwurf konnte im Browser nicht gespeichert werden (Speicher voll?).", true); } status(); }
  function laden() {
    return fetch("assets/data/cms.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) {
      PUB = Object.assign({ projekte: {}, neu: {}, startseite: {}, seiten: {} }, j);
      var lokal = null; try { lokal = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
      DRAFT = lokal || clone(PUB);
      if (lokal) enUebernehmen(PUB, DRAFT);
      ["projekte", "neu", "startseite", "seiten"].forEach(function (k) { if (!DRAFT[k]) DRAFT[k] = {}; });
    });
  }
  function istNeu(id) { return !!(DRAFT.neu || {})[id]; }
  function ov(id, anlegen) { var t = istNeu(id) ? DRAFT.neu : DRAFT.projekte; if (!t[id] && anlegen) t[id] = {}; return t[id] || {}; }
  // Effektiver Wert eines Projekts: veröffentlichte Daten (window.APB) + Entwurf
  function basisBilder(p) {
    if (p.files) return p.files.map(function (f, i) { return { src: f, cap: (p.cap || {})[i + 1] || "", dim: (p.img || [])[i] }; });
    var b = p.base || "assets/img/projects/" + p.id + "/";
    return (p.img || []).map(function (d, i) { return { src: b + String(i + 1).padStart(2, "0"), cap: (p.cap || {})[i + 1] || "", dim: d }; });
  }
  function basisPlaene(p) {
    if (p.planfiles) return p.planfiles.map(function (f, i) { return { src: f, cap: (p.plans || [])[i] || "" }; });
    return (p.plans || []).map(function (c, i) { return { src: (p.base || "") + "plan-" + String(i + 1).padStart(2, "0"), cap: c }; });
  }
  function wert(id, k) {
    var o = ov(id), p = byId[id] || {};
    if (k in o) return o[k];
    if (k === "bilder") return basisBilder(p);
    if (k === "plaene") return basisPlaene(p);
    if (k === "quellen") return p.quellen || [];
    if (k === "en") return {};
    if (k === "geo") return p.geo || null;
    return p[k];
  }
  function setze(id, k, v) {
    var o = ov(id, true);
    if (k === "desc" && !("desc" in o) && !istNeu(id)) o._desc_orig = clone((byId[id] || {}).desc || []);   // für die Übersetzung: was war schon geprüft?
    o[k] = v; speichern();
  }
  function alleIds() {
    var ids = Object.keys(DRAFT.neu || {}).concat(D.projects.map(function (p) { return p.id; }));
    return ids.filter(function (x, i) { return ids.indexOf(x) === i; });
  }
  function geaendert(id) { var a = (DRAFT.projekte || {})[id] || (DRAFT.neu || {})[id], b = (PUB.projekte || {})[id] || (PUB.neu || {})[id]; return JSON.stringify(a || null) !== JSON.stringify(b || null); }
  function anzahlAenderungen() {
    var n = alleIds().filter(geaendert).length;
    if (JSON.stringify(DRAFT.startseite || {}) !== JSON.stringify(PUB.startseite || {})) n++;
    if (JSON.stringify(DRAFT.seiten || {}) !== JSON.stringify(PUB.seiten || {})) n++;
    return n;
  }
  function bildUrl(src, klein, plan) {
    if (window.APB_BLOB[src]) return window.APB_BLOB[src];
    if (plan) return src + (klein ? "-s" : "") + ".webp";
    return src + (klein ? "-s.webp" : ".jpg");
  }

  /* ---------- Gerüst ---------- */
  root.innerHTML =
    '<div class="cms-bar"><nav class="cms-tabs" role="tablist">' +
    [["projekte", "Projekte"], ["medien", "Medien"], ["startseite", "Startseite"], ["veroeffentlichen", "Veröffentlichen"]].map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join("") +
    '</nav><span class="cms-status" aria-live="polite"></span><button type="button" class="cms-btn ghost" data-cms-out>Abmelden</button></div>' +
    '<div class="cms-meldung" role="status" hidden></div><div class="cms-body"></div>';
  var body = $(".cms-body", root);
  $$(".cms-tabs button", root).forEach(function (b) { b.addEventListener("click", function () { tab = b.dataset.tab; zeichnen(); }); });
  function status() {
    var n = anzahlAenderungen(), u = Object.keys(UPL).length;
    $(".cms-status", root).innerHTML = n ? "<b>" + n + "</b> " + (n === 1 ? "Änderung" : "Änderungen") + (u ? " · " + u + " neue Datei" + (u > 1 ? "en" : "") : "") + " im Entwurf" : "Alles veröffentlicht";
    $(".cms-status", root).classList.toggle("offen", !!n);
  }
  var mt = null;
  function meldung(t, fehler) { var m = $(".cms-meldung", root); m.textContent = t; m.hidden = false; m.classList.toggle("fehler", !!fehler); clearTimeout(mt); mt = setTimeout(function () { m.hidden = true; }, fehler ? 9000 : 4000); }
  window.addEventListener("beforeunload", function (e) { if (Object.keys(UPL).length) { e.preventDefault(); e.returnValue = ""; } });
  function zeichnen() {
    $$(".cms-tabs button", root).forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === tab); });
    ({ projekte: projekteTab, medien: medienTab, startseite: startTab, veroeffentlichen: pubTab })[tab]();
    status();
  }

  /* ---------- Ziehen zum Sortieren (Maus und Touch über Pfeile) ---------- */
  function sortierbar(liste, onOrder) {
    var drag = null;
    $$("[data-i]", liste).forEach(function (it) {
      if (it.dataset.fest) return;
      it.draggable = true;
      it.addEventListener("dragstart", function (e) { drag = it; it.classList.add("ziehen"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", it.dataset.i); } catch (x) {} });
      it.addEventListener("dragend", function () { it.classList.remove("ziehen"); drag = null; });
      it.addEventListener("dragover", function (e) {
        if (!drag || drag === it || it.dataset.fest) return; e.preventDefault();
        var r = it.getBoundingClientRect(), nach = liste.classList.contains("raster") ? (e.clientX > r.left + r.width / 2) : (e.clientY > r.top + r.height / 2);
        liste.insertBefore(drag, nach ? it.nextSibling : it);
      });
    });
    liste.ondragover = function (e) { if (drag) e.preventDefault(); };
    liste.ondrop = function (e) { e.preventDefault(); onOrder($$("[data-i]", liste).map(function (x) { return +x.dataset.i; })); };
    liste.onclick = function (e) {
      var b = e.target.closest("[data-schieb]"); if (!b) return;
      var it = b.closest("[data-i]"), r = $$("[data-i]", liste).map(function (x) { return +x.dataset.i; }), i = r.indexOf(+it.dataset.i), j = i + (+b.dataset.schieb);
      if (j < 0 || j >= r.length) return; var t = r[i]; r[i] = r[j]; r[j] = t; onOrder(r);
    };
  }
  function umordnen(arr, ord) { return ord.map(function (i) { return arr[i]; }); }

  /* ================= Projekte ================= */
  var listeQ = "", listeF = "alle";
  function projekteTab() {
    body.innerHTML = '<div class="cms-split"><aside class="cms-liste"><div class="cms-liste-kopf"><input type="search" class="cms-in" placeholder="Projekt suchen …" value="' + esc(listeQ) + '">' +
      '<select class="cms-in cms-lf"><option value="alle">Alle</option><option value="geaendert">Geändert</option><option value="neu">Neu</option><option value="aus">Ausgeblendet</option></select>' +
      '<button type="button" class="cms-btn" data-neu>+ Neues Projekt</button></div><ul></ul></aside><section class="cms-edit"></section></div>';
    $(".cms-lf", body).value = listeF;
    $("input", body).addEventListener("input", function (e) { listeQ = e.target.value; liste(); });
    $(".cms-lf", body).addEventListener("change", function (e) { listeF = e.target.value; liste(); });
    $("[data-neu]", body).addEventListener("click", neuesProjekt);
    liste(); if (aktuell && alleIds().indexOf(aktuell) > -1) editor(aktuell); else $(".cms-edit", body).innerHTML = '<p class="cms-leer">Projekt links auswählen oder ein neues anlegen.</p>';
  }
  function liste() {
    var q = listeQ.toLowerCase();
    var ids = alleIds().filter(function (id) {
      var t = (id + " " + wert(id, "name") + " " + wert(id, "ort")).toLowerCase();
      if (q && t.indexOf(q) < 0) return false;
      if (listeF === "geaendert" && !geaendert(id)) return false;
      if (listeF === "neu" && !istNeu(id)) return false;
      if (listeF === "aus" && !ov(id).versteckt) return false;
      return true;
    });
    $(".cms-liste ul", body).innerHTML = ids.map(function (id) {
      var b = wert(id, "bilder")[0];
      return '<li><button type="button" data-id="' + id + '" aria-current="' + (id === aktuell) + '">' + (b ? '<img src="' + esc(bildUrl(b.src, true)) + '" alt="" loading="lazy">' : '<span class="cms-noimg"></span>') +
        "<span><b>" + esc(wert(id, "name")) + "</b><small>" + esc(id) + " · " + esc(wert(id, "ort") || "") + (wert(id, "year") ? " · " + wert(id, "year") : "") + "</small></span>" +
        (istNeu(id) ? '<i class="tag neu">neu</i>' : geaendert(id) ? '<i class="tag">geändert</i>' : "") + (ov(id).versteckt ? '<i class="tag aus">aus</i>' : "") + "</button></li>";
    }).join("") || '<li class="cms-leer">Keine Projekte gefunden.</li>';
    $$(".cms-liste ul button", body).forEach(function (b) { b.addEventListener("click", function () { aktuell = b.dataset.id; liste(); editor(aktuell); }); });
  }
  function neuesProjekt() {
    var nr = prompt("Projektnummer und Kürzel, z. B. «352-mfh» (Nummer aus der Projektliste von apb):", "");
    if (!nr) return; nr = nr.trim().toLowerCase().replace(/\s+/g, "-");
    if (!/^\d{3}(-\d+)?-[a-z0-9]{2,6}$/.test(nr)) { meldung("Bitte im Format «352-mfh» eingeben (3 Ziffern, Bindestrich, Kürzel).", true); return; }
    if (alleIds().indexOf(nr) > -1) { meldung("Diese Projekt-ID gibt es schon.", true); return; }
    DRAFT.neu[nr] = { nr: nr.split("-")[0], name: "Neues Projekt", ort: "", sub: "", text: "", status: "Realisiert", cats: [], facts: [["Bauherr", ""], ["Fertigstellung", ""]], bilder: [], plaene: [] };
    speichern(); aktuell = nr; listeF = "alle"; projekteTab();
    meldung("Neues Projekt angelegt. Ohne Bilder wird es nicht veröffentlicht.");
  }

  function editor(id) {
    var box = $(".cms-edit", body), o = ov(id), p = byId[id] || {};
    var cats = wert(id, "cats") || [], en = wert(id, "en") || {}, geo = wert(id, "geo");
    box.innerHTML =
      '<div class="cms-ed-kopf"><div><span class="eyebrow">' + (istNeu(id) ? "Neues Projekt" : "Projekt") + " " + esc(id) + '</span><h2>' + esc(wert(id, "name")) + ' <span>' + esc(wert(id, "ort") || "") + "</span></h2></div>" +
      '<div class="cms-ed-aktion"><a class="cms-btn ghost" target="_blank" rel="noopener" href="projekt.html?p=' + encodeURIComponent(id) + '&cms=1">Vorschau ↗</a>' +
      (geaendert(id) ? '<button type="button" class="cms-btn ghost" data-verwerfen>Änderungen verwerfen</button>' : "") + "</div></div>" +
      sek("Grunddaten", '<div class="cms-grid">' +
        feld("Name", '<input class="cms-in" data-k="name" value="' + esc(wert(id, "name")) + '">') + feld("Ort", '<input class="cms-in" data-k="ort" value="' + esc(wert(id, "ort") || "") + '">') +
        feld("Untertitel (eine Zeile)", '<input class="cms-in" data-k="sub" value="' + esc(wert(id, "sub") || "") + '">', 2) +
        feld("Kurztext (Einleitung, 1–3 Sätze)", '<textarea class="cms-in" rows="3" data-k="text">' + esc(wert(id, "text") || "") + "</textarea>", 2) +
        feld("Jahr (Fertigstellung)", '<input class="cms-in" type="number" min="1980" max="2040" data-k="year" value="' + esc(wert(id, "year") || "") + '">') +
        feld("Status", '<select class="cms-in" data-k="status">' + STATUS.map(function (s) { return "<option" + (s === wert(id, "status") ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select>") +
        feld("Kategorien", '<div class="cms-chips">' + D.cats.map(function (c) { return '<button type="button" class="cms-chip" data-cat="' + c[0] + '" aria-pressed="' + (cats.indexOf(c[0]) > -1) + '">' + esc(c[1]) + "</button>"; }).join("") + "</div>", 2) +
        feld("Sichtbarkeit", '<label class="cms-chk"><input type="checkbox" data-k="sel"' + (wert(id, "sel") ? " checked" : "") + '> In «Auswahl» zeigen</label><label class="cms-chk"><input type="checkbox" data-k="versteckt"' + (o.versteckt ? " checked" : "") + "> Projekt auf der Website ausblenden</label>", 2) +
        "</div>") +
      sek("Fotos", '<p class="cms-hilfe">Ziehen zum Sortieren – das erste Bild ist das Titelbild. Bildunterschrift nur bei Innenaufnahmen (Raum benennen). Neue Fotos werden zugeschnitten (3:2 quer oder 4:5 hoch).</p><ul class="cms-bilder raster"></ul>' +
        '<label class="cms-drop"><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-upload="foto"><b>Fotos hinzufügen</b><span>hierher ziehen oder klicken</span></label>') +
      sek("Pläne", '<p class="cms-hilfe">Pläne werden nie zugeschnitten. Auswahl: Situation, 1–2 Grundrisse, 1–2 Schnitte, 1–2 Ansichten – ohne Planbeschriftung.</p><ul class="cms-plaene raster"></ul>' +
        '<label class="cms-drop"><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-upload="plan"><b>Pläne hinzufügen</b><span>als Bild (JPG/PNG), hierher ziehen oder klicken</span></label>') +
      sek("Fakten", '<p class="cms-hilfe">Erscheinen rechts auf der Projektseite, auf den Themenseiten und für Suchmaschinen. Nur Angaben aus dem Datenblatt bzw. geprüfte Werte.</p><ul class="cms-zeilen" data-liste="facts"></ul><button type="button" class="cms-btn ghost" data-plus="facts">+ Zeile</button>') +
      sek("Projektbeschrieb", '<ul class="cms-zeilen gross" data-liste="desc"></ul><button type="button" class="cms-btn ghost" data-plus="desc">+ Abschnitt</button>') +
      sek("Nachweise (Links auf fremde Quellen)", '<p class="cms-hilfe">Z. B. Projektseite der Gemeinde, Wettbewerbsbericht, Presseartikel. Nur https-Adressen.</p><ul class="cms-zeilen" data-liste="quellen"></ul><button type="button" class="cms-btn ghost" data-plus="quellen">+ Quelle</button>') +
      sek("Standort", '<div class="cms-grid">' + feld("Adresse suchen", '<div class="cms-reihe"><input class="cms-in" data-geo-q placeholder="Strasse Nr, Ort" value="' + esc((wert(id, "facts") || []).filter(function (f) { return f[0] === "Adresse"; }).map(function (f) { return f[1]; })[0] || "") + '"><button type="button" class="cms-btn ghost" data-geo-such>Suchen</button></div><ul class="cms-geo-tr"></ul>', 2) +
        feld("Koordinaten", '<span class="cms-geo">' + (geo ? geo[0].toFixed(5) + ", " + geo[1].toFixed(5) : "noch keine") + "</span>", 2) + "</div>") +
      sek("Englisch", enHTML(id, en));
    // Grunddaten
    $$("[data-k]", box).forEach(function (inp) {
      inp.addEventListener("change", function () {
        var k = inp.dataset.k, v = inp.type === "checkbox" ? inp.checked : inp.value;
        if (k === "year") v = v ? +v : null;
        if (k === "versteckt") { if (v) setze(id, k, true); else { delete ov(id, true).versteckt; speichern(); } } else setze(id, k, v);
        if (k === "name" || k === "ort") $("h2", box).innerHTML = esc(wert(id, "name")) + " <span>" + esc(wert(id, "ort") || "") + "</span>";
        liste();
      });
    });
    $$(".cms-chip", box).forEach(function (b) { b.addEventListener("click", function () { var c = (wert(id, "cats") || []).slice(), i = c.indexOf(b.dataset.cat); if (i > -1) c.splice(i, 1); else c.push(b.dataset.cat); setze(id, "cats", c); b.setAttribute("aria-pressed", i < 0); }); });
    $$("[data-en]", box).forEach(function (inp) { inp.addEventListener("change", function () { var e = clone(wert(id, "en") || {}); e[inp.dataset.en] = inp.value; e._bearbeitet = true; setze(id, "en", e); }); });
    var vw = $("[data-verwerfen]", box); if (vw) vw.addEventListener("click", function () {
      if (!confirm("Alle nicht veröffentlichten Änderungen an diesem Projekt verwerfen?")) return;
      var pub = (PUB.projekte || {})[id], pubN = (PUB.neu || {})[id];
      if (istNeu(id)) { if (pubN) DRAFT.neu[id] = clone(pubN); else { delete DRAFT.neu[id]; aktuell = null; } }
      else if (pub) DRAFT.projekte[id] = clone(pub); else delete DRAFT.projekte[id];
      speichern(); projekteTab();
    });
    bilderListe(id); planListe(id); zeilen(id, "facts"); zeilen(id, "desc"); zeilen(id, "quellen");
    $$("[data-upload]", box).forEach(function (inp) {
      var drop = inp.closest(".cms-drop");
      inp.addEventListener("change", function () { hochladen(id, inp.dataset.upload, Array.prototype.slice.call(inp.files)); inp.value = ""; });
      drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("ueber"); });
      drop.addEventListener("dragleave", function () { drop.classList.remove("ueber"); });
      drop.addEventListener("drop", function (e) { e.preventDefault(); drop.classList.remove("ueber"); hochladen(id, inp.dataset.upload, Array.prototype.slice.call(e.dataTransfer.files).filter(function (f) { return /^image\//.test(f.type); })); });
    });
    $("[data-geo-such]", box).addEventListener("click", function () { geoSuche(id, box); });
  }
  // Englisch: wird beim Veröffentlichen automatisch übersetzt (tools/cms_uebersetzen.py) und hier zur Kontrolle gezeigt
  function enHTML(id, en) {
    var q = en._quelle || {}, zeilen = [];
    function z(schl, de, gross) {
      var neu = !en[schl] || q[schl] !== de;
      zeilen.push('<div class="cms-en-z"><small>' + esc(de) + '</small>' + (neu ? '<span class="cms-en-offen">' + (en[schl] ? "Deutsch geändert – wird beim Veröffentlichen neu übersetzt" : "wird beim Veröffentlichen übersetzt") + "</span>" :
        (gross ? '<textarea class="cms-in" rows="3" data-en="' + schl + '">' + esc(en[schl]) + "</textarea>" : '<input class="cms-in" data-en="' + schl + '" value="' + esc(en[schl]) + '">')) + "</div>");
    }
    var o = ov(id), bez = { name: "Name", sub: "Untertitel", text: "Kurztext" };
    ["name", "sub", "text"].forEach(function (f) { if (f in o && o[f]) z(f, o[f], f === "text"); });
    // Listen: nur Einträge mit maschineller Übersetzung zeigen – alles andere hat schon geprüftes Englisch
    function zl(schl, de, gross) { if (de && en[schl]) z(schl, de, gross); }
    (o.desc || []).forEach(function (d, k) { zl("desc." + k + ".0", d[0]); zl("desc." + k + ".1", d[1], true); });
    (o.facts || []).forEach(function (d, k) { zl("facts." + k + ".0", d[0]); zl("facts." + k + ".1", d[1]); });
    (o.bilder || []).forEach(function (b, k) { zl("cap." + k, b.cap); });
    void bez;
    return '<p class="cms-hilfe">Englisch entsteht automatisch beim Veröffentlichen (DeepL mit eurem Glossar) und erscheint danach hier. Wenn etwas komisch klingt: hier korrigieren und nochmals veröffentlichen – die Korrektur bleibt, bis sich der deutsche Text ändert. Texte, die nicht im CMS geändert wurden, haben schon ihre geprüfte Übersetzung.</p>' +
      (zeilen.length ? '<div class="cms-en">' + zeilen.join("") + "</div>" : '<p class="cms-hilfe">Noch keine im CMS geänderten Texte.</p>');
  }
  // Englisch, das der Server inzwischen erzeugt hat, in den Entwurf übernehmen (ausser es wurde hier von Hand bearbeitet)
  function enUebernehmen(quelle, ziel) {
    ["projekte", "neu"].forEach(function (g) {
      Object.keys((quelle || {})[g] || {}).forEach(function (id) {
        var s = quelle[g][id].en, t = (ziel[g] || {})[id]; if (!s || !t) return;
        if (!t.en || !t.en._bearbeitet) t.en = clone(s);
      });
    });
  }
  function sek(t, h) { return '<section class="cms-sek"><h3>' + t + "</h3>" + h + "</section>"; }
  function feld(l, h, breit) { return '<label class="cms-feld' + (breit ? " breit" : "") + '"><span>' + l + "</span>" + h + "</label>"; }

  function bilderListe(id) {
    var ul = $(".cms-bilder", body), b = wert(id, "bilder");
    ul.innerHTML = b.map(function (x, i) {
      return '<li data-i="' + i + '" class="' + (x.aus ? "aus" : "") + '"><div class="cms-thumb"><img src="' + esc(bildUrl(x.src, true)) + '" alt="" loading="lazy">' + (i === 0 && !x.aus ? '<i class="tag">Titelbild</i>' : "") + (UPL[x.src + "-orig.jpg"] ? '<i class="tag neu">neu</i>' : "") + "</div>" +
        '<input class="cms-in" placeholder="Bildunterschrift (optional)" value="' + esc(x.cap || "") + '" data-cap="' + i + '">' +
        '<div class="cms-mini"><button type="button" data-schieb="-1" title="nach vorne">←</button><button type="button" data-schieb="1" title="nach hinten">→</button><button type="button" data-crop="' + i + '">Zuschneiden</button><button type="button" data-aus="' + i + '">' + (x.aus ? "Einblenden" : "Ausblenden") + "</button></div></li>";
    }).join("") || '<li class="cms-leer">Noch keine Fotos.</li>';
    sortierbar(ul, function (ord) { setze(id, "bilder", umordnen(wert(id, "bilder"), ord)); bilderListe(id); liste(); });
    $$("[data-cap]", ul).forEach(function (inp) { inp.addEventListener("change", function () { var a = clone(wert(id, "bilder")); a[+inp.dataset.cap].cap = inp.value; setze(id, "bilder", a); }); });
    $$("[data-aus]", ul).forEach(function (bt) { bt.addEventListener("click", function () { var a = clone(wert(id, "bilder")), k = +bt.dataset.aus; if (a[k].aus) delete a[k].aus; else a[k].aus = true; setze(id, "bilder", a); bilderListe(id); }); });
    $$("[data-crop]", ul).forEach(function (bt) { bt.addEventListener("click", function () { var a = wert(id, "bilder"), k = +bt.dataset.crop; zuschneiden(bildUrl(a[k].src, false), function (blob, dim) { var s = neuerPfad(id, "foto"); ablegen(s, blob, "-orig.jpg"); var n = clone(wert(id, "bilder")); n[k] = { src: s, cap: n[k].cap, dim: dim }; setze(id, "bilder", n); bilderListe(id); liste(); }); }); });
  }
  function planListe(id) {
    var ul = $(".cms-plaene", body), b = wert(id, "plaene");
    ul.innerHTML = b.map(function (x, i) {
      return '<li data-i="' + i + '" class="plan ' + (x.aus ? "aus" : "") + '"><div class="cms-thumb plan"><img src="' + esc(bildUrl(x.src, true, true)) + '" alt="" loading="lazy"></div>' +
        '<input class="cms-in" placeholder="z. B. Situation, Grundriss EG" value="' + esc(x.cap || "") + '" data-cap="' + i + '">' +
        '<div class="cms-mini"><button type="button" data-schieb="-1">←</button><button type="button" data-schieb="1">→</button><button type="button" data-aus="' + i + '">' + (x.aus ? "Einblenden" : "Ausblenden") + "</button></div></li>";
    }).join("") || '<li class="cms-leer">Noch keine Pläne.</li>';
    sortierbar(ul, function (ord) { setze(id, "plaene", umordnen(wert(id, "plaene"), ord)); planListe(id); });
    $$("[data-cap]", ul).forEach(function (inp) { inp.addEventListener("change", function () { var a = clone(wert(id, "plaene")); a[+inp.dataset.cap].cap = inp.value; setze(id, "plaene", a); }); });
    $$("[data-aus]", ul).forEach(function (bt) { bt.addEventListener("click", function () { var a = clone(wert(id, "plaene")), k = +bt.dataset.aus; if (a[k].aus) delete a[k].aus; else a[k].aus = true; setze(id, "plaene", a); planListe(id); }); });
  }
  function zeilen(id, k) {
    var ul = $('[data-liste="' + k + '"]', body), a = wert(id, k) || [];
    var ph = { facts: ["Bezeichnung", "Wert"], desc: ["Titel (z. B. Situation)", "Text"], quellen: ["Bezeichnung (z. B. Gemeinde Uster: Projektseite)", "https://…"] }[k];
    ul.innerHTML = a.map(function (z, i) {
      return '<li data-i="' + i + '"><span class="cms-griff" title="Ziehen zum Sortieren">⋮⋮</span><input class="cms-in" ' + (k === "facts" ? 'list="cms-fakten" ' : "") + 'placeholder="' + ph[0] + '" value="' + esc(z[0]) + '" data-z="0">' +
        (k === "desc" ? '<textarea class="cms-in" rows="4" placeholder="' + ph[1] + '" data-z="1">' + esc(z[1]) + "</textarea>" : '<input class="cms-in" placeholder="' + ph[1] + '" value="' + esc(z[1]) + '" data-z="1"' + (k === "quellen" ? ' type="url"' : "") + ">") +
        '<div class="cms-mini"><button type="button" data-schieb="-1">↑</button><button type="button" data-schieb="1">↓</button><button type="button" data-weg title="Entfernen">✕</button></div></li>';
    }).join("");
    sortierbar(ul, function (ord) { setze(id, k, umordnen(wert(id, k), ord)); zeilen(id, k); });
    $$("li", ul).forEach(function (li) {
      var i = +li.dataset.i;
      $$("[data-z]", li).forEach(function (inp) { inp.addEventListener("change", function () {
        var n = clone(wert(id, k) || []);
        if (k === "quellen" && inp.dataset.z === "1" && inp.value && !/^https:\/\//.test(inp.value)) { meldung("Nachweise brauchen eine https-Adresse.", true); return; }
        n[i][+inp.dataset.z] = inp.value; setze(id, k, n);
      }); });
      $("[data-weg]", li).addEventListener("click", function () { var n = clone(wert(id, k) || []); n.splice(i, 1); setze(id, k, n); zeilen(id, k); });
    });
    var plus = $('[data-plus="' + k + '"]', body);
    plus.onclick = function () { var n = clone(wert(id, k) || []); n.push(["", ""]); setze(id, k, n); zeilen(id, k); var l = $$("li", ul); if (l.length) $("input,textarea", l[l.length - 1]).focus(); };
  }
  function geoSuche(id, box) {
    var q = $("[data-geo-q]", box).value.trim(), out = $(".cms-geo-tr", box); if (q.length < 3) return;
    out.innerHTML = "<li>Suche …</li>";
    fetch("https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&origins=address&limit=5&sr=4326&searchText=" + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (j) {
      var rs = j.results || [];
      out.innerHTML = rs.map(function (r, i) { return '<li><button type="button" data-g="' + i + '">' + r.attrs.label.replace(/<[^>]+>/g, "") + "</button></li>"; }).join("") || "<li>Nichts gefunden.</li>";
      $$("[data-g]", out).forEach(function (b) { b.addEventListener("click", function () { var a = rs[+b.dataset.g].attrs; setze(id, "geo", [Math.round(a.lat * 1e6) / 1e6, Math.round(a.lon * 1e6) / 1e6]); $(".cms-geo", box).textContent = a.lat.toFixed(5) + ", " + a.lon.toFixed(5); out.innerHTML = ""; meldung("Standort gesetzt."); }); });
    }).catch(function () { out.innerHTML = "<li>Suche nicht erreichbar.</li>"; });
  }

  /* ---------- Hochladen + Zuschneiden ---------- */
  function neuerPfad(id, art) { return "assets/img/cms/" + id + "/" + (art === "plan" ? "plan-" : "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function ablegen(stem, blob, endung) { UPL[stem + endung] = blob; window.APB_BLOB[stem] = URL.createObjectURL(blob); status(); }
  function hochladen(id, art, files) {
    if (!files.length) return;
    var reihe = files.slice();
    (function weiter() {
      var f = reihe.shift(); if (!f) return;
      if (f.size > 40e6) { meldung(f.name + " ist grösser als 40 MB.", true); return weiter(); }
      var url = URL.createObjectURL(f);
      if (art === "plan") {
        verkleinern(url, 3600, function (blob) {
          var s = neuerPfad(id, "plan"); ablegen(s, blob, "-orig.png");
          var n = clone(wert(id, "plaene")); n.push({ src: s, cap: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") }); setze(id, "plaene", n); planListe(id); weiter();
        }, "image/png");
      } else zuschneiden(url, function (blob, dim) {
        var s = neuerPfad(id, "foto"); ablegen(s, blob, "-orig.jpg");
        var n = clone(wert(id, "bilder")); n.push({ src: s, cap: "", dim: dim }); setze(id, "bilder", n); bilderListe(id); liste(); weiter();
      }, f.name, weiter);
    })();
  }
  function verkleinern(url, max, cb, typ) {
    var im = new Image(); im.onload = function () {
      var f = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.round(im.naturalWidth * f); c.height = Math.round(im.naturalHeight * f);
      var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(function (b) { cb(b); }, typ || "image/jpeg", 0.92);
    }; im.src = url;
  }
  // Zuschneiden: Rahmen mit festem Seitenverhältnis (3:2 quer, 4:5 hoch), verschieben, an den Ecken ziehen, 90° drehen
  function zuschneiden(url, fertig, titel, abbruch) {
    var dlg = el('<div class="cms-dlg" role="dialog" aria-modal="true" aria-label="Bild zuschneiden"><div class="cms-dlg-in crop">' +
      '<div class="cms-crop-kopf"><b>Zuschneiden' + (titel ? " · " + esc(titel) : "") + '</b><div class="cms-seg"><button type="button" data-v="1.5" aria-pressed="true">3:2 quer</button><button type="button" data-v="0.8" aria-pressed="false">4:5 hoch</button></div>' +
      '<button type="button" class="cms-btn ghost" data-dreh>⟳ 90°</button></div><div class="cms-crop-flaeche"><canvas></canvas></div>' +
      '<div class="cms-crop-fuss"><span class="cms-hilfe">Rahmen verschieben, an den Ecken grösser/kleiner ziehen.</span><button type="button" class="cms-btn ghost" data-abbr>Abbrechen</button><button type="button" class="cms-btn" data-ok>Übernehmen</button></div></div></div>');
    document.body.appendChild(dlg);
    var cv = $("canvas", dlg), g = cv.getContext("2d"), im = new Image(), ratio = 1.5, rot = 0, src = null, sk = 1, r = null, drag = null;
    function quelle() {   // gedrehte Quelle als Canvas
      var c = document.createElement("canvas"), w = im.naturalWidth, h = im.naturalHeight;
      c.width = rot % 180 ? h : w; c.height = rot % 180 ? w : h;
      var x = c.getContext("2d"); x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 180); x.drawImage(im, -w / 2, -h / 2); return c;
    }
    function start() {
      src = quelle();
      var fl = $(".cms-crop-flaeche", dlg), mw = fl.clientWidth || 900, mh = fl.clientHeight || 560;
      sk = Math.min(mw / src.width, mh / src.height, 1); cv.width = Math.round(src.width * sk); cv.height = Math.round(src.height * sk);
      var w = cv.width, h = w / ratio; if (h > cv.height) { h = cv.height; w = h * ratio; }
      w *= 0.92; h *= 0.92; r = { x: (cv.width - w) / 2, y: (cv.height - h) / 2, w: w, h: h }; malen();
    }
    function malen() {
      g.clearRect(0, 0, cv.width, cv.height); g.drawImage(src, 0, 0, cv.width, cv.height);
      g.fillStyle = "rgba(0,0,0,.55)"; g.beginPath(); g.rect(0, 0, cv.width, cv.height); g.rect(r.x, r.y + r.h, r.w, -r.h); g.fill("evenodd");
      g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.strokeRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; for (var i = 1; i < 3; i++) { g.beginPath(); g.moveTo(r.x + r.w * i / 3, r.y); g.lineTo(r.x + r.w * i / 3, r.y + r.h); g.moveTo(r.x, r.y + r.h * i / 3); g.lineTo(r.x + r.w, r.y + r.h * i / 3); g.stroke(); }
      g.fillStyle = "#f15d30"; [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].forEach(function (q) { g.fillRect(q[0] - 7, q[1] - 7, 14, 14); });
      var aufl = Math.round(r.w / sk) + " × " + Math.round(r.h / sk) + " px";
      $(".cms-crop-fuss .cms-hilfe", dlg).textContent = "Ausschnitt " + aufl + (r.w / sk < 1600 ? " – eher klein, ideal ab 2400 px Breite" : "") + " · Rahmen verschieben, Ecken ziehen.";
    }
    function pos(e) { var b = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [(t.clientX - b.left) * cv.width / b.width, (t.clientY - b.top) * cv.height / b.height]; }
    function ab(e) {
      var p = pos(e), ecken = [[r.x, r.y, "nw"], [r.x + r.w, r.y, "ne"], [r.x, r.y + r.h, "sw"], [r.x + r.w, r.y + r.h, "se"]];
      var ec = ecken.filter(function (q) { return Math.abs(q[0] - p[0]) < 16 && Math.abs(q[1] - p[1]) < 16; })[0];
      if (ec) drag = { art: ec[2], r0: Object.assign({}, r) };
      else if (p[0] > r.x && p[0] < r.x + r.w && p[1] > r.y && p[1] < r.y + r.h) drag = { art: "move", dx: p[0] - r.x, dy: p[1] - r.y };
      if (drag) e.preventDefault();
    }
    function zieh(e) {
      if (!drag) return; e.preventDefault(); var p = pos(e);
      if (drag.art === "move") { r.x = Math.max(0, Math.min(cv.width - r.w, p[0] - drag.dx)); r.y = Math.max(0, Math.min(cv.height - r.h, p[1] - drag.dy)); }
      else {
        var o = drag.r0, fx = drag.art.indexOf("w") > -1 ? o.x + o.w : o.x, fy = drag.art.indexOf("n") > -1 ? o.y + o.h : o.y;   // fester Gegenpunkt
        var w = Math.max(40, Math.abs(p[0] - fx)), h = w / ratio;
        var maxW = (drag.art.indexOf("w") > -1 ? fx : cv.width - fx), maxH = (drag.art.indexOf("n") > -1 ? fy : cv.height - fy);
        if (w > maxW) { w = maxW; h = w / ratio; } if (h > maxH) { h = maxH; w = h * ratio; }
        r = { x: drag.art.indexOf("w") > -1 ? fx - w : fx, y: drag.art.indexOf("n") > -1 ? fy - h : fy, w: w, h: h };
      }
      malen();
    }
    function los() { drag = null; }
    cv.addEventListener("mousedown", ab); window.addEventListener("mousemove", zieh); window.addEventListener("mouseup", los);
    cv.addEventListener("touchstart", ab, { passive: false }); cv.addEventListener("touchmove", zieh, { passive: false }); cv.addEventListener("touchend", los);
    function zu() { window.removeEventListener("mousemove", zieh); window.removeEventListener("mouseup", los); dlg.remove(); }
    $$(".cms-seg button", dlg).forEach(function (b) { b.addEventListener("click", function () { ratio = +b.dataset.v; $$(".cms-seg button", dlg).forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); start(); }); });
    $("[data-dreh]", dlg).addEventListener("click", function () { rot = (rot + 90) % 360; start(); });
    $("[data-abbr]", dlg).addEventListener("click", function () { zu(); if (abbruch) abbruch(); });
    $("[data-ok]", dlg).addEventListener("click", function () {
      var sw = r.w / sk, sh = r.h / sk, tw = Math.min(2400, Math.round(ratio >= 1 ? sw : sw)), f = Math.min(1, (ratio >= 1 ? 2400 : 1600) / sw);
      var c = document.createElement("canvas"); c.width = Math.round(sw * f); c.height = Math.round(sh * f);
      c.getContext("2d").drawImage(src, r.x / sk, r.y / sk, sw, sh, 0, 0, c.width, c.height);
      c.toBlob(function (b) { zu(); fertig(b, [c.width, c.height]); }, "image/jpeg", 0.9); void tw;
    });
    im.onload = start; im.onerror = function () { zu(); meldung("Bild konnte nicht geladen werden.", true); if (abbruch) abbruch(); }; im.src = url;
  }

  /* ================= Medien ================= */
  function alleMedien() {
    var out = [];
    alleIds().forEach(function (id) {
      var n = wert(id, "name"), o = wert(id, "ort") || "";
      wert(id, "bilder").forEach(function (x, i) { out.push({ id: id, art: "foto", i: i, src: x.src, cap: x.cap || "", aus: !!x.aus, name: n, ort: o, neu: !!UPL[x.src + "-orig.jpg"] }); });
      wert(id, "plaene").forEach(function (x, i) { out.push({ id: id, art: "plan", i: i, src: x.src, cap: x.cap || "", aus: !!x.aus, name: n, ort: o, neu: !!UPL[x.src + "-orig.png"] }); });
    });
    return out;
  }
  function medienTab() {
    var f = medienFilter;
    body.innerHTML = '<div class="cms-medien"><div class="cms-mfilter"><input type="search" class="cms-in" placeholder="Suchen: Projekt, Ort, Bildunterschrift, Datei …" value="' + esc(f.q) + '">' +
      '<select class="cms-in" data-f="art"><option value="">Fotos und Pläne</option><option value="foto">Nur Fotos</option><option value="plan">Nur Pläne</option></select>' +
      '<select class="cms-in" data-f="projekt"><option value="">Alle Projekte</option>' + alleIds().map(function (id) { return '<option value="' + id + '">' + esc(id + " · " + wert(id, "name")) + "</option>"; }).join("") + "</select>" +
      '<label class="cms-chk"><input type="checkbox" data-f="aus"> nur ausgeblendete</label><span class="cms-mzahl"></span></div><ul class="cms-mraster"></ul></div>';
    $("[data-f=art]", body).value = f.art; $("[data-f=projekt]", body).value = f.projekt; $("[data-f=aus]", body).checked = f.aus;
    $("input[type=search]", body).addEventListener("input", function (e) { f.q = e.target.value; raster(); });
    $$("[data-f]", body).forEach(function (s) { s.addEventListener("change", function () { f[s.dataset.f] = s.type === "checkbox" ? s.checked : s.value; raster(); }); });
    raster();
    function raster() {
      var q = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      var m = alleMedien().filter(function (x) {
        if (f.art && x.art !== f.art) return false; if (f.projekt && x.id !== f.projekt) return false; if (f.aus && !x.aus) return false;
        var hay = (x.id + " " + x.name + " " + x.ort + " " + x.cap + " " + x.src + " " + (x.art === "plan" ? "plan" : "foto")).toLowerCase();
        return q.every(function (w) { return hay.indexOf(w) > -1; });
      });
      $(".cms-mzahl", body).textContent = m.length + " Dateien";
      $(".cms-mraster", body).innerHTML = m.slice(0, 400).map(function (x, k) {
        return '<li><button type="button" data-m="' + k + '" class="' + (x.aus ? "aus " : "") + x.art + '"><img src="' + esc(bildUrl(x.src, true, x.art === "plan")) + '" alt="" loading="lazy"><span><b>' + esc(x.name) + "</b><small>" + (x.art === "plan" ? "Plan" : "Foto") + " " + (x.i + 1) + (x.cap ? " · " + esc(x.cap) : "") + "</small></span>" + (x.neu ? '<i class="tag neu">neu</i>' : "") + "</button></li>";
      }).join("") || '<li class="cms-leer">Keine Treffer.</li>';
      $$("[data-m]", body).forEach(function (b) { b.addEventListener("click", function () { detail(m[+b.dataset.m]); }); });
    }
    function detail(x) {
      var plan = x.art === "plan", gross = bildUrl(x.src, false, plan);
      var dlg = el('<div class="cms-dlg" role="dialog" aria-modal="true" aria-label="Datei"><div class="cms-dlg-in medium"><div class="cms-md-bild' + (plan ? " plan" : "") + '"><img src="' + esc(gross) + '" alt=""></div><div class="cms-md-info">' +
        '<span class="eyebrow">' + (plan ? "Plan" : "Foto") + " " + (x.i + 1) + '</span><h3>' + esc(x.name) + " <span>" + esc(x.ort) + "</span></h3>" +
        feld(plan ? "Planbezeichnung" : "Bildunterschrift", '<input class="cms-in" data-cap value="' + esc(x.cap) + '">', 2) +
        '<dl><dt>Datei</dt><dd>' + esc(x.src) + (x.neu ? " (neu, noch nicht veröffentlicht)" : "") + '</dd><dt>Grösse</dt><dd class="cms-px">…</dd></dl>' +
        '<div class="cms-reihe">' + (plan ? "" : '<button type="button" class="cms-btn" data-crop>Zuschneiden</button>') + '<button type="button" class="cms-btn ghost" data-aus>' + (x.aus ? "Einblenden" : "Ausblenden") + '</button><button type="button" class="cms-btn ghost" data-zum>Zum Projekt</button><a class="cms-btn ghost" href="' + esc(gross) + '" target="_blank" rel="noopener">Original ↗</a></div>' +
        '<button type="button" class="cms-dlg-x" aria-label="Schliessen">×</button></div></div></div>');
      document.body.appendChild(dlg);
      var zu = function () { dlg.remove(); raster(); };
      $(".cms-dlg-x", dlg).addEventListener("click", zu); dlg.addEventListener("click", function (e) { if (e.target === dlg) zu(); });
      var bi = $(".cms-md-bild img", dlg); bi.onload = function () { $(".cms-px", dlg).textContent = bi.naturalWidth + " × " + bi.naturalHeight + " px (Webversion)"; };
      var k = plan ? "plaene" : "bilder";
      $("[data-cap]", dlg).addEventListener("change", function (e) { var a = clone(wert(x.id, k)); a[x.i].cap = e.target.value; setze(x.id, k, a); x.cap = e.target.value; });
      $("[data-aus]", dlg).addEventListener("click", function () { var a = clone(wert(x.id, k)); if (a[x.i].aus) delete a[x.i].aus; else a[x.i].aus = true; setze(x.id, k, a); zu(); });
      $("[data-zum]", dlg).addEventListener("click", function () { dlg.remove(); aktuell = x.id; tab = "projekte"; zeichnen(); });
      var cr = $("[data-crop]", dlg); if (cr) cr.addEventListener("click", function () {
        dlg.remove();
        zuschneiden(gross, function (blob, dim) { var s = neuerPfad(x.id, "foto"); ablegen(s, blob, "-orig.jpg"); var a = clone(wert(x.id, "bilder")); a[x.i] = { src: s, cap: a[x.i].cap, dim: dim }; setze(x.id, "bilder", a); raster(); meldung("Neuer Ausschnitt übernommen."); });
      });
    }
  }

  /* ================= Startseite ================= */
  var HERO_STD = (function () { var h = document.querySelector("[data-hero-std]"); return h ? h.getAttribute("data-hero-std").split(",") : ["333-kff", "319-sag", "308-mzu", "310-gws", "313-gbw", "327-sdu"]; })();
  var LEISTE_STD = D.rail || ["319-sag", "333-kff", "310-gws", "292-mlw", "313-gbw", "318-epu", "263-piu"];
  function startTab() {
    var st = DRAFT.startseite, bl = DRAFT.seiten["index.html"] || {};
    var hero = st.hero || HERO_STD, leiste = st.leiste || LEISTE_STD;
    var reih = (bl.reihenfolge || []).slice(); BLOECKE.forEach(function (b) { if (reih.indexOf(b[0]) < 0) reih.push(b[0]); });
    reih = ["hero"].concat(reih.filter(function (k) { return k !== "hero" && k !== "kontakt"; })).concat(["kontakt"]);
    var aus = bl.aus || [];
    body.innerHTML = '<div class="cms-start"><div class="cms-ed-kopf"><div><span class="eyebrow">Startseite</span><h2>Was zeigt die Startseite?</h2></div><div class="cms-ed-aktion"><a class="cms-btn ghost" href="index.html?cms=1" target="_blank" rel="noopener">Vorschau ↗</a></div></div>' +
      sek("Startbilder (Karussell oben)", '<p class="cms-hilfe">3–8 Projekte. Gezeigt wird jeweils das Titelbild. Ziehen zum Sortieren.</p><ul class="cms-pliste raster" data-l="hero"></ul>' + waehler("hero")) +
      sek("Projektauswahl (Leiste «Ausgewählte Arbeiten»)", '<p class="cms-hilfe">4–10 Projekte, ziehen zum Sortieren.</p><ul class="cms-pliste raster" data-l="leiste"></ul>' + waehler("leiste")) +
      sek("Blöcke der Startseite", '<p class="cms-hilfe">Reihenfolge der Abschnitte ziehen oder mit den Pfeilen ändern, einzelne ausblenden. Startbilder und Abschluss bleiben fest – so kann die Seite nicht «kaputt» gehen.</p><ul class="cms-bloecke"></ul>') +
      sek("Projekte in «Auswahl»", '<p class="cms-hilfe">Filter «Auswahl» auf der Projektseite. Antippen zum Ein-/Ausschalten.</p><div class="cms-chips">' + alleIds().map(function (id) { return '<button type="button" class="cms-chip" data-sel="' + id + '" aria-pressed="' + !!wert(id, "sel") + '">' + esc(wert(id, "name")) + "</button>"; }).join("") + "</div>") + "</div>";
    projListe("hero", hero); projListe("leiste", leiste);
    var ul = $(".cms-bloecke", body);
    ul.innerHTML = reih.map(function (k, i) {
      var b = BLOECKE.filter(function (x) { return x[0] === k; })[0]; if (!b) return "";
      return '<li data-i="' + i + '"' + (b[2] ? ' data-fest="1" class="fest"' : aus.indexOf(k) > -1 ? ' class="aus"' : "") + '><span class="cms-griff">' + (b[2] ? "🔒" : "⋮⋮") + "</span><b>" + esc(b[1]) + "</b>" +
        (b[2] ? '<small>fest</small>' : '<div class="cms-mini"><button type="button" data-schieb="-1">↑</button><button type="button" data-schieb="1">↓</button><button type="button" data-baus="' + k + '">' + (aus.indexOf(k) > -1 ? "Einblenden" : "Ausblenden") + "</button></div>") + "</li>";
    }).join("");
    sortierbar(ul, function (ord) {
      var neu = ord.map(function (i) { return reih[i]; }).filter(function (k) { return k !== "hero" && k !== "kontakt"; });
      var s = DRAFT.seiten["index.html"] = Object.assign({}, DRAFT.seiten["index.html"] || {}); s.reihenfolge = neu; speichern(); startTab();
    });
    $$("[data-baus]", ul).forEach(function (b) { b.addEventListener("click", function () { var s = DRAFT.seiten["index.html"] = Object.assign({}, DRAFT.seiten["index.html"] || {}), a = (s.aus || []).slice(), i = a.indexOf(b.dataset.baus); if (i > -1) a.splice(i, 1); else a.push(b.dataset.baus); s.aus = a; speichern(); startTab(); }); });
    $$("[data-sel]", body).forEach(function (b) { b.addEventListener("click", function () { var v = !wert(b.dataset.sel, "sel"); setze(b.dataset.sel, "sel", v); b.setAttribute("aria-pressed", v); }); });
  }
  function waehler(l) { return '<div class="cms-reihe"><select class="cms-in" data-add="' + l + '"><option value="">+ Projekt hinzufügen …</option>' + alleIds().map(function (id) { return '<option value="' + id + '">' + esc(id + " · " + wert(id, "name") + ", " + (wert(id, "ort") || "")) + "</option>"; }).join("") + "</select></div>"; }
  function projListe(l, ids) {
    var ul = $('[data-l="' + l + '"]', body), max = l === "hero" ? 8 : 10;
    ul.innerHTML = ids.map(function (id, i) { var b = wert(id, "bilder").filter(function (x) { return !x.aus; })[0]; return '<li data-i="' + i + '"><div class="cms-thumb">' + (b ? '<img src="' + esc(bildUrl(b.src, true)) + '" alt="" loading="lazy">' : "") + '<i class="tag">' + (i + 1) + "</i></div><b>" + esc(wert(id, "name") || id) + "</b><small>" + esc(wert(id, "ort") || "") + '</small><div class="cms-mini"><button type="button" data-schieb="-1">←</button><button type="button" data-schieb="1">→</button><button type="button" data-weg="' + i + '">Entfernen</button></div></li>'; }).join("");
    function set(neu) { DRAFT.startseite = Object.assign({}, DRAFT.startseite); DRAFT.startseite[l] = neu; speichern(); startTab(); }
    sortierbar(ul, function (ord) { set(ord.map(function (i) { return ids[i]; })); });
    $$("[data-weg]", ul).forEach(function (b) { b.addEventListener("click", function () { var n = ids.slice(); n.splice(+b.dataset.weg, 1); if (n.length < (l === "hero" ? 1 : 2)) { meldung("Mindestens " + (l === "hero" ? 1 : 2) + " Projekte.", true); return; } set(n); }); });
    $('[data-add="' + l + '"]', body).addEventListener("change", function (e) { var v = e.target.value; if (!v) return; if (ids.indexOf(v) > -1) { meldung("Ist schon drin."); return; } if (ids.length >= max) { meldung("Höchstens " + max + " Projekte.", true); return; } set(ids.concat([v])); });
  }

  /* ================= Veröffentlichen ================= */
  function token() { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function pubTab() {
    var ids = alleIds().filter(geaendert), u = Object.keys(UPL);
    var st = JSON.stringify(DRAFT.startseite || {}) !== JSON.stringify(PUB.startseite || {}), se = JSON.stringify(DRAFT.seiten || {}) !== JSON.stringify(PUB.seiten || {});
    body.innerHTML = '<div class="cms-pub"><div class="cms-ed-kopf"><div><span class="eyebrow">Veröffentlichen</span><h2>Entwurf prüfen und online stellen</h2></div></div>' +
      sek("Änderungen im Entwurf", (ids.length || st || se ? "<ul class=\"cms-aend\">" + ids.map(function (id) { return "<li><b>" + esc(wert(id, "name")) + "</b> <small>" + esc(id) + (istNeu(id) ? " · neu" : "") + (ov(id).versteckt ? " · ausgeblendet" : "") + "</small></li>"; }).join("") +
        (st ? "<li><b>Startseite</b> <small>Startbilder / Auswahl-Leiste</small></li>" : "") + (se ? "<li><b>Startseite</b> <small>Blöcke</small></li>" : "") + "</ul>" : '<p class="cms-hilfe">Keine Änderungen – alles ist veröffentlicht.</p>') +
        (u.length ? '<p class="cms-hilfe">' + u.length + " neue Bilddatei(en) werden mitgeschickt. Sie liegen nur in diesem Browser-Fenster – vor dem Schliessen veröffentlichen.</p>" : "")) +
      sek("Zugang zu GitHub", '<p class="cms-hilfe">Veröffentlichen schreibt einen Commit ins Repository; GitHub baut die Seite danach in rund 3 Minuten neu. Dafür braucht es einen persönlichen Zugangsschlüssel (Fine-grained Token) mit Zugriff nur auf <b>' + REPO.owner + "/" + REPO.name + '</b> und der Berechtigung <b>Contents: Read and write</b> – erstellen unter GitHub → Settings → Developer settings → Fine-grained tokens. Der Schlüssel bleibt nur in diesem Browser-Tab (sessionStorage) und wird nirgends gespeichert.</p>' +
        '<div class="cms-reihe"><input class="cms-in" type="password" autocomplete="off" placeholder="github_pat_…" data-tok value="' + esc(token()) + '"><button type="button" class="cms-btn ghost" data-tok-ok>Übernehmen</button></div>') +
      sek("Aktion", '<div class="cms-reihe"><button type="button" class="cms-btn" data-pub' + (ids.length || st || se ? "" : " disabled") + '>Jetzt veröffentlichen</button><button type="button" class="cms-btn ghost" data-exp>Entwurf als Datei sichern</button>' +
        '<label class="cms-btn ghost">Entwurf laden<input type="file" accept="application/json" hidden data-imp></label><button type="button" class="cms-btn ghost" data-weg-alle>Ganzen Entwurf verwerfen</button></div><div class="cms-pub-log" aria-live="polite"></div>') + "</div>";
    $("[data-tok-ok]", body).addEventListener("click", function () { try { sessionStorage.setItem(TOKEN_KEY, $("[data-tok]", body).value.trim()); } catch (e) {} meldung("Schlüssel für diesen Tab übernommen."); });
    $("[data-exp]", body).addEventListener("click", function () { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(DRAFT, null, 2)], { type: "application/json" })); a.download = "cms-entwurf-" + new Date().toISOString().slice(0, 10) + ".json"; a.click(); if (u.length) meldung("Hinweis: neue Bilder sind in der Datei nicht enthalten.", true); });
    $("[data-imp]", body).addEventListener("change", function (e) { var f = e.target.files[0]; if (!f) return; f.text().then(function (t) { try { var j = JSON.parse(t); if (!j.projekte) throw 0; DRAFT = j; speichern(); meldung("Entwurf geladen."); pubTab(); } catch (x) { meldung("Datei ist kein CMS-Entwurf.", true); } }); });
    $("[data-weg-alle]", body).addEventListener("click", function () { if (!confirm("Den ganzen Entwurf verwerfen? Veröffentlichte Inhalte bleiben unverändert.")) return; DRAFT = clone(PUB); UPL = {}; speichern(); pubTab(); });
    $("[data-pub]", body).addEventListener("click", veroeffentlichen);
  }
  function gh(pfad, opt) {
    opt = opt || {};
    return fetch("https://api.github.com/repos/" + REPO.owner + "/" + REPO.name + pfad, { method: opt.method || "GET", headers: { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, body: opt.body ? JSON.stringify(opt.body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j && j.message) || ("HTTP " + r.status)); return j; }); });
  }
  function b64(blob) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(",")[1]); }; fr.readAsDataURL(blob); }); }
  function utf8b64(t) { return btoa(unescape(encodeURIComponent(t))); }
  function veroeffentlichen() {
    var log = $(".cms-pub-log", body), knopf = $("[data-pub]", body);
    function l(t) { log.insertAdjacentHTML("beforeend", "<p>" + esc(t) + "</p>"); }
    if (!token()) { meldung("Bitte zuerst den GitHub-Schlüssel eintragen und «Übernehmen».", true); return; }
    // nur Bilder mitschicken, die im Entwurf noch verwendet werden
    var benutzt = {}; alleIds().forEach(function (id) { wert(id, "bilder").concat(wert(id, "plaene")).forEach(function (x) { benutzt[x.src] = 1; }); });
    var dateien = Object.keys(UPL).filter(function (p) { return benutzt[p.replace(/-orig\.(jpg|png)$/, "")]; });
    var aus = clone(DRAFT); aus._hinweis = PUB._hinweis || "Änderungen aus dem CMS (cms.html)."; aus.version = 1; aus.stand = new Date().toISOString();
    knopf.disabled = true; log.innerHTML = ""; l("Verbinde mit GitHub …");
    var basis, baum;
    // zuerst den aktuellen Stand holen: inzwischen automatisch erzeugtes Englisch nicht überschreiben
    gh("/contents/assets/data/cms.json?ref=" + encodeURIComponent(REPO.branch)).then(function (j) {
      try { enUebernehmen(JSON.parse(decodeURIComponent(escape(atob(String(j.content || "").replace(/\s/g, ""))))), aus); } catch (e) {}
    }, function () {})
      .then(function () { return gh("/git/ref/heads/" + encodeURIComponent(REPO.branch)); }).then(function (r) { basis = r.object.sha; return gh("/git/commits/" + basis); })
      .then(function (c) { baum = c.tree.sha; l(dateien.length ? dateien.length + " Bild(er) hochladen …" : "Änderungen vorbereiten …");
        return dateien.reduce(function (pr, pfad) { return pr.then(function (acc) { return b64(UPL[pfad]).then(function (d) { return gh("/git/blobs", { method: "POST", body: { content: d, encoding: "base64" } }); }).then(function (bl) { acc.push({ path: pfad, mode: "100644", type: "blob", sha: bl.sha }); l("✓ " + pfad.split("/").pop()); return acc; }); }); }, Promise.resolve([])); })
      .then(function (eintraege) { return gh("/git/blobs", { method: "POST", body: { content: utf8b64(JSON.stringify(aus, null, 1)), encoding: "base64" } }).then(function (bl) { eintraege.push({ path: "assets/data/cms.json", mode: "100644", type: "blob", sha: bl.sha }); return gh("/git/trees", { method: "POST", body: { base_tree: baum, tree: eintraege } }); }); })
      .then(function (t) { return gh("/git/commits", { method: "POST", body: { message: "CMS: Inhalte aktualisiert (" + anzahlAenderungen() + " Änderungen" + (dateien.length ? ", " + dateien.length + " Bilder" : "") + ")", tree: t.sha, parents: [basis] } }); })
      .then(function (c) { return gh("/git/refs/heads/" + encodeURIComponent(REPO.branch), { method: "PATCH", body: { sha: c.sha } }).then(function () { return c; }); })
      .then(function (c) {
        PUB = clone(aus); DRAFT = clone(aus); UPL = {}; speichern();
        l("Veröffentlicht (Commit " + c.sha.slice(0, 7) + "). GitHub baut die Seite jetzt neu und übersetzt neue Texte ins Englische – in rund 3 Minuten ist alles online. Das Englisch erscheint danach im CMS (Seite neu laden) und kann dort korrigiert werden.");
        log.insertAdjacentHTML("beforeend", '<p><a href="https://github.com/' + REPO.owner + "/" + REPO.name + '/actions" target="_blank" rel="noopener">Fortschritt auf GitHub ansehen ↗</a></p>');
        meldung("Veröffentlicht. Die Seite ist in rund 3 Minuten aktualisiert.");
      })
      .catch(function (e) {
        var t = String(e.message || e);
        l("Fehler: " + t + (/Bad credentials|401/.test(t) ? " – der Schlüssel ist ungültig oder abgelaufen." : /Not Found|404/.test(t) ? " – kein Zugriff auf das Repository (Berechtigung «Contents: Read and write» nötig)." : /Update is not a fast forward|422/.test(t) ? " – inzwischen wurde etwas anderes veröffentlicht. Bitte nochmals versuchen." : ""));
        knopf.disabled = false; meldung("Veröffentlichen hat nicht geklappt – Details unten. Der Entwurf bleibt erhalten.", true);
      });
  }

  /* ---------- Start ---------- */
  var dl = document.createElement("datalist"); dl.id = "cms-fakten"; dl.innerHTML = FAKTEN.map(function (f) { return '<option value="' + f + '">'; }).join(""); document.body.appendChild(dl);
  $("[data-cms-out]", root).addEventListener("click", function () { document.dispatchEvent(new Event("cms-logout")); });
  function los() { laden().then(zeichnen); }
  if (document.documentElement.classList.contains("cms-on")) los(); else document.addEventListener("cms-login", los, { once: true });
});
