/* ==========================================================================
   apb architekten ag – V2: Intro, Seitenübergänge, 30 Jahre
   ========================================================================== */
(function () {
  "use strict";

  var D = window.APB || { projects: [], cats: [] };
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  var Y0 = 1996, Y1 = 2026;

  function img(p, i, small) { var n = i || 1, b = "assets/img/projects/" + p.id + "/" + String(n).padStart(2, "0"); return b + (small ? "-s.webp" : n === 1 ? ".webp" : ".jpg"); }
  function url(p) { return "projekt.html?p=" + encodeURIComponent(p.id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  /* Meilensteine – ausschliesslich Fakten aus der bisherigen Website */
  var MS = {
    1996: [{ t: "Gründung", d: "Peter Brader gründet die apb architekten ag in Uster." }],
    2003: [{ t: "Baupreis des AFZO", d: "Das Mehrfamilienhaus «Wilstrasse» in Uster wird mit dem Baupreis des Architekturforums Zürcher Oberland ausgezeichnet." }],
    2010: [{ t: "Wettbewerb gewonnen", d: "Pflegezentrum Im Grund, Uster: 1. Rang im selektiven Verfahren – Anbau, Umbau und Sanierung mit MINERGIE-Zertifikat." }],
    2011: [{ t: "Neue Inhaber", d: "Durch Management-Buy-out wird das Büro vollständig an Pia Kiebel und Thomas Schinkhof übertragen." }],
    2025: [{ t: "Erstes Kinderhospiz der Schweiz", d: "Fertigstellung des Kinderhospizes Flamingo in Fällanden – für Kinder mit lebenslimitierenden Krankheiten." }],
    2026: [{ t: "30 Jahre apb architekten", d: "Mehr als 100 realisierte Projekte aus dem öffentlichen und privaten Sektor und Handwerkerleistungen von ca. 200 Millionen Franken." }]
  };
  var byYear = {};
  D.projects.forEach(function (p) { if (p.year) (byYear[p.year] = byYear[p.year] || []).push(p); });

  /* ---------- Intro ---------- */
  function intro() {
    var box = $(".intro-ov");
    if (!box || !root.classList.contains("intro")) return;
    if (getComputedStyle(box).position !== "fixed") { root.classList.remove("intro"); return; }
    var yr = $(".intro-year b", box), t0 = null, done = false;
    function count(t) {
      if (!t0) t0 = t;
      var k = Math.min(1, Math.max(0, (t - t0 - 1100) / 1300)); k = 1 - Math.pow(1 - k, 3);
      yr.textContent = Math.round(Y0 + (Y1 - Y0) * k);
      if (k < 1 && !done) requestAnimationFrame(count);
    }
    requestAnimationFrame(count);
    function finish() {
      if (done) return; done = true;
      yr.textContent = Y1;
      store("apb-intro", "1");
      box.classList.add("out");
      setTimeout(function () { root.classList.remove("intro"); }, 1000);
    }
    var timer = setTimeout(finish, 3000);
    box.addEventListener("click", function () { clearTimeout(timer); finish(); });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { clearTimeout(timer); finish(); document.removeEventListener("keydown", k); } });
  }

  /* ---------- Seitenübergang ---------- */
  function transitions() {
    var pt = $(".pt");
    if (!pt) return;
    if (root.classList.contains("pt-in")) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          pt.classList.add("reveal"); root.classList.remove("pt-in");
          setTimeout(function () { pt.classList.remove("reveal"); }, 800);
        });
      });
    }
    if (reduced) return;
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || /^(mailto|tel|javascript):/i.test(href)) return;
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return;
      if (u.pathname === location.pathname && u.search === location.search) return;
      e.preventDefault();
      store("apb-pt", "1");
      pt.classList.remove("reveal"); pt.classList.add("leave");
      setTimeout(function () { location.href = a.href; }, 560);
    });
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) { pt.classList.remove("leave", "reveal"); root.classList.remove("pt-in"); }
    });
  }

  /* ---------- Startseite: 30-Jahre-Teaser ---------- */
  function jubiTeaser() {
    var wrap = $("#jubi-bars");
    if (!wrap) return;
    var row = $(".bars-row", wrap), tip = $(".bars-tip", wrap), html = "";
    for (var y = Y0; y <= Y1; y++) {
      var ps = byYear[y] || [], ms = MS[y];
      html += '<a class="bar' + (ps.length ? "" : " nil") + (ms ? " ms" : "") + '" style="--n:' + ps.length + '" href="chronik.html#j' + y + '" data-y="' + y + '" aria-label="' + y + ": " + (ps.length ? ps.length + " Projekte" : "Chronik") + '"></a>';
    }
    row.innerHTML = html;
    $$(".bar", row).forEach(function (b) {
      b.addEventListener("mouseenter", function () {
        var y = +b.dataset.y, ps = byYear[y] || [], ms = MS[y];
        if (!ps.length && !ms) { tip.classList.remove("on"); return; }
        var p = ps[0];
        tip.innerHTML = (p ? '<img src="' + img(p, 1, true) + '" alt="">' : "") + "<div><b>" + y + "</b>" +
          (ms ? '<span style="color:var(--accent)">● ' + esc(ms[0].t) + "</span><br>" : "") +
          ps.map(function (q) { return esc(q.name) + ", " + esc(q.ort); }).join("<br>") + "</div>";
        var r = b.getBoundingClientRect(), w = wrap.getBoundingClientRect();
        var x = Math.min(Math.max(r.left + r.width / 2 - w.left, 120), w.width - 120);
        tip.style.left = x + "px"; tip.classList.add("on");
      });
    });
    row.addEventListener("mouseleave", function () { tip.classList.remove("on"); });

    /* "30" füllt sich beim Scrollen */
    var num = $(".jubi-num");
    if (num && !reduced) {
      var f = function () {
        var r = num.getBoundingClientRect(), vh = window.innerHeight;
        var k = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.7)));
        num.style.setProperty("--p", (k * 100) + "%");
      };
      window.addEventListener("scroll", f, { passive: true }); f();
    } else if (num) num.style.setProperty("--p", "100%");
  }

  /* ---------- Chronik-Seite ---------- */
  function chronik() {
    var main = $("#chron-main");
    if (!main) return;

    /* Hero: "30" mit wechselnden Projektbildern */
    var big = $(".big30"), cap = $(".c-hero .cap");
    var heroIds = ["333-kff", "319-sag", "310-gws", "292-mlw", "313-gbw", "263-piu", "270-bsb", "318-epu"];
    var hi = 0;
    function swap() {
      var p = D.projects.filter(function (q) { return q.id === heroIds[hi % heroIds.length]; })[0];
      big.style.backgroundImage = "url(" + img(p, p.id === "333-kff" ? 1 : 1) + ")";
      if (cap) cap.innerHTML = "Im «30»: <br>" + esc(p.name) + ", " + esc(p.ort);
      hi++;
    }
    heroIds = heroIds.filter(function (id) { return id !== "333-kff"; });
    swap();
    if (!reduced) setInterval(swap, 4000);

    /* Jahresblöcke */
    var years = [], count = 0, html = "";
    for (var y = Y0; y <= Y1; y++) {
      var ps = byYear[y] || [], ms = MS[y] || [];
      if (!ps.length && !ms.length) continue;
      years.push(y);
      html += '<section class="yr-block" id="j' + y + '" data-y="' + y + '"><div class="yr-head"><h2>' + y + "</h2><span>" +
        (y - Y0 === 0 ? "Gründungsjahr" : (y - Y0) + ". Jahr") + (ps.length ? " · " + ps.length + (ps.length === 1 ? " Fertigstellung" : " Fertigstellungen") : "") + "</span></div>" +
        ms.map(function (m) { return '<div class="milestone rv"><div><h3>' + esc(m.t) + "</h3><p>" + esc(m.d) + "</p></div></div>"; }).join("") +
        (ps.length ? '<div class="yr-projects">' + ps.map(function (p) {
          return '<a class="card rv" href="' + url(p) + '" data-cursor="Ansehen"><div class="media"><img src="' + img(p, 1, true) + '" alt="' + esc(p.name + ", " + p.ort) + '" loading="lazy"></div><div class="card-meta"><h3>' + esc(p.name) + ' <span class="ort">' + esc(p.ort) + '</span></h3></div><p class="card-sub">' + esc(p.sub) + "</p></a>";
        }).join("") + "</div>" : "") + "</section>";
    }
    main.innerHTML = html;
    $$(".rv", main).forEach(function (n) {
      if (reduced || !("IntersectionObserver" in window)) { n.classList.add("in"); return; }
      var o = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); o.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
      o.observe(n);
    });

    /* Scrubber */
    var scrub = $(".scrub"), sh = "";
    for (y = Y0; y <= Y1; y++) {
      var n = (byYear[y] || []).length, has = n || MS[y];
      sh += '<button type="button" class="' + (has ? "" : "nil") + '" style="--n:' + n + '" data-y="' + y + '" aria-label="Zu ' + y + '"' + (has ? "" : " disabled") + "></button>";
    }
    scrub.innerHTML = sh;
    $$("button", scrub).forEach(function (b) {
      b.addEventListener("click", function () { var t = document.getElementById("j" + b.dataset.y); if (t) t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); });
    });

    /* Rollende Jahreszahl */
    var yearBox = $(".chron-year");
    yearBox.innerHTML = "1996".split("").map(function () {
      var s = ""; for (var d = 0; d <= 9; d++) s += "<i>" + d + "</i>"; return '<span class="dg"><span>' + s + "</span></span>";
    }).join("");
    var digits = $$(".dg > span", yearBox);
    var cntP = $("#c-projects"), cntA = $("#c-age"), mob = $(".mob-year b"), mobBar = $(".mob-year .track i");
    function setYear(y) {
      String(y).split("").forEach(function (d, i) { digits[i].style.transform = "translateY(" + (-d * 10) + "%)"; });
      var c = 0; for (var k = Y0; k <= y; k++) c += (byYear[k] || []).length;
      cntP.textContent = c; cntA.textContent = y - Y0;
      if (mob) mob.textContent = y;
      if (mobBar) mobBar.style.width = ((y - Y0) / (Y1 - Y0)) * 100 + "%";
      $$("button", scrub).forEach(function (b) { var by = +b.dataset.y; b.classList.toggle("on", by === y); b.classList.toggle("past", by < y && !b.classList.contains("nil")); });
    }
    digits.forEach(function (d) { d.style.transform = "translateY(0)"; });
    setYear(Y0);
    var blocks = $$(".yr-block", main);
    var onScroll = function () {
      var line = window.innerHeight * 0.4, cur = years[0];
      blocks.forEach(function (b) { if (b.getBoundingClientRect().top < line) cur = +b.dataset.y; });
      setYear(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    if (/^#j\d{4}$/.test(location.hash)) { var t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(function () { t.scrollIntoView(); }, 60); }
  }


  /* ---------- Globale Suche ---------- */
  var PAGES = [
    ["Projekte", "Alle Projekte – Raster, Liste, Karte, Zeitachse", "projekte.html", "architektur übersicht"],
    ["Wettbewerbe & Auswahlverfahren", "Projekte", "projekt.html?p=wettbewerbe", "wettbewerb planerwahl rang modell"],
    ["Planung", "Leistungen", "leistungen.html#planung", "firmenphilosophie planen bauen"],
    ["SIA-Norm 112 – Phasen", "Leistungen", "leistungen.html#sia-112", "sia phasen vorprojekt bauprojekt ausschreibung bauleitung kosten"],
    ["Leistungsfinder", "Leistungen – welche Leistung passt?", "leistungen.html#finder", "finder beratung hilfe"],
    ["Bauherrenberatung", "Leistungen", "leistungen.html#bauherren", "beratung bauherr gemeinde studienauftrag kostenschätzung machbarkeit grundstück"],
    ["Käuferbetreuung", "Leistungen", "leistungen.html#kaeufer", "käufer stockwerkeigentum eigentumswohnung"],
    ["Liegenschaftsanalyse", "Leistungen", "leistungen.html#liegenschaft", "liegenschaft zustandsanalyse bestand gebäudezustand schadstoffe erdbeben"],
    ["Firmenprofil", "Büro", "buero.html#profil", "geschichte gründung 1996 2011 mitgliedschaften sia minergie"],
    ["Atelier", "Büro – Turicum-Gebäude, Uster", "buero.html#atelier", "büro seestrasse archicad bim"],
    ["Team", "Büro", "buero.html#team", "mitarbeitende architekten"],
    ["30 Jahre apb", "Chronik 1996–2026", "chronik.html", "jubiläum chronik geschichte"],
    ["Karriere", "Stellen & Initiativbewerbung", "karriere.html", "jobs stellen bewerbung"],
    ["Lehrstelle Zeichner/-in EFZ", "Karriere – Lehrbeginn August 2028", "karriere.html#lehrstelle", "lehre lehrling ausbildung schnupper"],
    ["Kontakt", "Seestrasse 110a, 8610 Uster", "kontakt.html", "adresse telefon email anfahrt"],
    ["Impressum & Datenschutz", "Rechtliches", "impressum.html", "datenschutz"]
  ];
  [["Projektleiter/-in", "projektleiter-in"], ["Junior Projektleiter/-in", "junior-projektleiter-in"], ["Architekt/-in", "architekt-in"], ["Bauleiter/-in", "bauleiter-in"], ["Techniker/-in", "techniker-in"], ["Zeichner/-in", "zeichner-in"], ["Administration", "administration"]].forEach(function (j) {
    PAGES.push([j[0], "Karriere – Stellenprofil", "karriere.html#" + j[1], "stelle job bewerbung"]);
  });
  [["Pia Kiebel", "Inhaberin – Planung, Bauleitung"], ["Thomas Schinkhof", "Inhaber – Planung, Bauleitung"], ["Andrea Abegg", "Planung"], ["Maike Brasse", "Planung, Bauleitung"], ["Daniel Dammann", "Planung, Bauleitung"], ["Laura Keller", "Planung"], ["Dominik Mettler", "Planung"], ["Claudia Wintsch", "Planung"]].forEach(function (m) {
    PAGES.push([m[0], "Team – " + m[1], "buero.html#team", "team"]);
  });
  function fold(t) { return String(t).toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/é|è/g, "e").replace(/ß/g, "ss"); }
  function search() {
    var btns = $$(".search-btn");
    if (!btns.length) return;
    var catL = {}; (D.cats || []).forEach(function (c) { catL[c[0]] = c[1]; });
    var PI = D.projects.map(function (p) {
      var bh = (p.facts.filter(function (f) { return f[0] === "Bauherr"; })[0] || [])[1] || "";
      return { p: p, hay: fold([p.name, p.ort, p.sub, p.text, bh, p.nr, p.year, p.status, p.cats.map(function (c) { return catL[c]; }).join(" "), p.facts.map(function (f) { return f[1]; }).join(" ")].join(" ")), nm: fold(p.name + " " + p.ort), bh: bh };
    });
    var GI = PAGES.map(function (g) { return { g: g, hay: fold(g.join(" ")), nm: fold(g[0]) }; });
    var box = document.createElement("div");
    box.className = "sx"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Suche");
    box.innerHTML = '<div class="sx-head"><label class="sx-field"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="7" cy="7" r="5"/><path d="M11 11l4 4"/></svg><span class="sr-only">Suchbegriff</span><input id="sx-q" type="search" autocomplete="off" placeholder="Projekt, Ort, Leistung …"><button type="button" class="sx-close">Esc</button></label>' +
      '<div class="sx-hint">Zum Beispiel: <button type="button">Schulhaus</button><button type="button">Uster</button><button type="button">MINERGIE</button><button type="button">SBB</button><button type="button">denkmalgeschützt</button><button type="button">Wettbewerb</button></div></div><div class="sx-body" id="sx-res"></div>';
    document.body.appendChild(box);
    var q = $("#sx-q", box), res = $("#sx-res", box), sel = 0, items = [], last;
    function hl(t, words) { var out = esc(t); words.forEach(function (w) { if (w.length < 2) return; out = out.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); }); return out; }
    function run() {
      var raw = q.value.trim(), w = fold(raw).split(/\s+/).filter(Boolean), words = raw.split(/\s+/).filter(Boolean);
      var pr, gr;
      if (!w.length) { pr = PI.filter(function (x) { return x.p.sel; }); gr = GI.slice(0, 6); }
      else {
        var score = function (x) { var s = 0; w.forEach(function (t) { if (x.nm.indexOf(t) === 0) s += 6; else if (x.nm.indexOf(" " + t) > -1) s += 4; else if (x.nm.indexOf(t) > -1) s += 3; else s += 1; }); return s; };
        var ok = function (x) { return w.every(function (t) { return x.hay.indexOf(t) > -1; }); };
        pr = PI.filter(ok).sort(function (a, b) { return score(b) - score(a) || (b.p.year || 0) - (a.p.year || 0); });
        gr = GI.filter(ok).sort(function (a, b) { return score(b) - score(a); });
      }
      var html = "";
      if (pr.length) html += '<div class="sx-group"><h3>' + (w.length ? pr.length + (pr.length === 1 ? " Projekt" : " Projekte") : "Ausgewählte Projekte") + "</h3>" + pr.slice(0, 12).map(function (x) {
        return '<a class="sx-item" href="' + url(x.p) + '"><img src="' + img(x.p, 1, true) + '" alt="" loading="lazy"><span><b>' + hl(x.p.name, words) + ' <span style="color:var(--mute);font-weight:400">' + hl(x.p.ort, words) + "</span></b><small>" + hl(x.p.sub, words) + (x.bh ? " · " + hl(x.bh, words) : "") + '</small></span><span class="k">' + (x.p.year || x.p.status) + "</span></a>";
      }).join("") + "</div>";
      if (gr.length) html += '<div class="sx-group"><h3>Seiten</h3>' + gr.slice(0, 8).map(function (x) {
        return '<a class="sx-item page" href="' + x.g[2] + '"><span><b>' + hl(x.g[0], words) + "</b><small>" + esc(x.g[1]) + '</small></span><span class="k">↵</span></a>';
      }).join("") + "</div>";
      if (!html) html = '<p class="sx-empty">Keine Treffer für «' + esc(raw) + '». Versuchen Sie einen Ort, eine Nutzung oder einen Bauherrn.</p>';
      res.innerHTML = html; items = $$(".sx-item", res); sel = 0; mark();
    }
    function mark() { items.forEach(function (it, i) { it.classList.toggle("sel", i === sel); }); if (items[sel]) items[sel].scrollIntoView({ block: "nearest" }); }
    function open() { last = document.activeElement; box.classList.add("on"); document.body.style.overflow = "hidden"; run(); setTimeout(function () { q.focus(); q.select(); }, 30); }
    function close() { box.classList.remove("on"); document.body.style.overflow = ""; if (last && last.focus) last.focus(); }
    btns.forEach(function (b) { b.addEventListener("click", open); });
    $(".sx-close", box).addEventListener("click", close);
    box.addEventListener("click", function (e) { if (e.target === box || e.target === res) close(); });
    $$(".sx-hint button", box).forEach(function (b) { b.addEventListener("click", function () { q.value = b.textContent; run(); q.focus(); }); });
    q.addEventListener("input", run);
    q.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); mark(); }
      if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      if (e.key === "Enter" && items[sel]) { e.preventDefault(); items[sel].click(); }
    });
    res.addEventListener("click", function (e) { var a = e.target.closest("a.sx-item"); if (a && a.getAttribute("href").indexOf("#") > -1 && a.pathname === location.pathname) close(); });
    document.addEventListener("keydown", function (e) {
      var typing = /input|textarea|select/i.test((document.activeElement || {}).tagName || "");
      if (e.key === "Escape" && box.classList.contains("on")) { close(); return; }
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); open(); }
    });
  }

  /* ---------- Leistungsfinder ---------- */
  var RES = {
    oeff: { t: "Bauherrenberatung für öffentliche Bauherren", d: "Die Interessen und Anforderungen öffentlicher Auftraggeber unterscheiden sich von denen der privaten Bauherren. Wir unterstützen Gemeinden, Schul- und Kirchgemeinden von der ersten Kostenschätzung bis zur Auswahl der Planer.", l: ["Erstellung von Studienaufträgen und Kostenschätzungen für öffentliche Bauvorhaben", "Erarbeiten von Projektablaufplänen", "Erstellung von Projektierungs- und Baukreditgenehmigungs-Dossiers", "Erstellen von Ausschreibungsunterlagen für Planerwahlverfahren"], a: "#bauherren", k: "beratung", p: "313-gbw" },
    priv: { t: "Bauherrenberatung für private Bauherren", d: "Von der Suche nach dem geeigneten Grundstück bis zur Machbarkeitsstudie: Wir klären, was auf Ihrem Grundstück möglich ist und was es kostet.", l: ["Hilfe bei der Suche geeigneter Grundstücke", "Machbarkeitsstudien für Neubauten und Umbauten", "Beratung betreffend der baugesetzlichen Vorgaben", "Kostenschätzungen"], a: "#bauherren", k: "beratung", p: "318-epu" },
    plan: { t: "Planung und Realisierung nach SIA 112", d: "Ob Neubau oder Umbau, ob Modernisierung oder Sanierung: Wir planen und realisieren Ihr Vorhaben termin- und kostengerecht – von der Vorstudie bis zur Schlussabrechnung, aus einer Hand.", l: ["Vorprojekt und Kostenschätzung ±15%", "Bewilligungsfähiges Bauprojekt und Kostenvoranschlag ±10%", "Ausschreibung, Offertvergleich, Vergabe", "Bauleitung und Kostenkontrolle"], a: "#sia-112", k: "neubau", p: "319-sag" },
    umbau: { t: "Umbau und Sanierung", d: "Denkmalschutz-Objekte, energetische Sanierungen, Umbauten unter Betrieb und in Etappen gehören zu unseren Kernkompetenzen.", l: ["Analysen zum Gebäudezustand und Beratung zu energetischen Förderungen", "Planung nach SIA 112 von der Vorstudie bis zum Abschluss", "Bauleitung und Kostenkontrolle", "MINERGIE- und MINERGIE-P-Gebäude"], a: "#sia-112", k: "umbau", p: "300-bswae" },
    lieg: { t: "Liegenschaftsanalyse", d: "Die Bestandsanalyse einer Liegenschaft bildet die Grundlage für langfristige Planungen und aktuelle Bauvorhaben. Wir führen alle erforderlichen Schritte für Sie durch.", l: ["Begehung und Massaufnahmen vor Ort", "Dokumentation und Einschätzung des Gebäudezustandes anhand von Einzelbauteilen", "Einschätzung der kurz-, mittel- und langfristigen Massnahmen inkl. Budgets", "Massnahmenbericht"], a: "#liegenschaft", k: "liegenschaft", p: "309-mpg" },
    kauf: { t: "Käuferbetreuung", d: "Bauträger, die Projekte mit Stockwerkeigentum verkaufen, delegieren die Käuferbetreuung in der Regel an den Architekten des Gebäudes. Wir begleiten die Käufer Schritt für Schritt.", l: ["Besprechung von Käuferwünschen und Überprüfung der Machbarkeit", "Beratung bei der Farb- und Materialwahl", "Ermittlung der Mehr- und/oder Minderkosten", "Kontrolle der Bauausführung und Begleitung der Bauabnahme"], a: "#kaeufer", k: "kaeufer", p: "292-mlw" }
  };
  var TREE = {
    q: "Wer sind Sie?", o: [
      ["Öffentliche Hand", "Gemeinde, Schulpflege, Kirchgemeinde", { q: "Wo stehen Sie mit Ihrem Vorhaben?", o: [["Am Anfang", "Bedarf, Kosten und Ablauf klären", "oeff"], ["Planerwahl vorbereiten", "Studienauftrag, Ausschreibung, Bewertung", "oeff"], ["Bereit zur Umsetzung", "Neubau, Erweiterung oder Sanierung", "plan"], ["Bestehendes Gebäude", "Zustand und Massnahmen beurteilen", "lieg"]] }],
      ["Private Bauherrschaft", "Einfamilienhaus, Stadtvilla, Umbau", { q: "Was haben Sie vor?", o: [["Grundstück & Machbarkeit", "Was ist möglich, was kostet es?", "priv"], ["Neubau", "Planen und bauen aus einer Hand", "plan"], ["Umbau oder Sanierung", "Bestehendes weiterentwickeln", "umbau"], ["Gebäudezustand prüfen", "Analyse und Massnahmenbericht", "lieg"]] }],
      ["Investor oder Bauträger", "Mehrfamilienhäuser, Überbauungen", { q: "Wobei können wir helfen?", o: [["Überbauung realisieren", "Bis 50 Wohneinheiten, Planung und Bauleitung", "plan"], ["Käufer betreuen lassen", "Stockwerkeigentum verkaufen", "kauf"], ["Liegenschaft analysieren", "Bestand bewerten und planen", "lieg"]] }],
      ["Käufer:in einer Eigentumswohnung", "Ausbauwünsche, Begleitung", "kauf"]
    ]
  };
  function finder() {
    var root = $("#finder-app"); if (!root) return;
    var path = [];
    function node() { var n = TREE; path.forEach(function (i) { n = n.o[i][2]; }); return n; }
    function render() {
      var n = node();
      var steps = '<div class="finder-steps" aria-hidden="true"><i class="on"></i><i class="' + (path.length >= 1 ? "on" : "") + '"></i><i class="' + (typeof n === "string" ? "on" : "") + '"></i></div>';
      $(".finder-progress", root.parentNode).innerHTML = steps;
      if (typeof n === "string") {
        var r = RES[n], p = D.projects.filter(function (x) { return x.id === r.p; })[0];
        root.innerHTML = '<div class="finder-res"><span class="eyebrow">Unsere Empfehlung</span><h3>' + r.t + "</h3><p>" + r.d + '</p><ul class="ticks">' + r.l.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" +
          '<div class="acts"><a class="btn" href="kontakt.html#' + r.k + '">Anfrage stellen<span class="arr"></span></a><a class="btn ghost" href="' + r.a + '">Mehr dazu</a>' + (p ? '<a class="btn ghost" href="' + url(p) + '">Referenz: ' + esc(p.name) + "</a>" : "") + "</div>" +
          '<button type="button" class="finder-back">Nochmals von vorne</button></div>';
        $(".finder-back", root).addEventListener("click", function () { path = []; render(); });
        return;
      }
      root.innerHTML = '<p class="finder-q">' + n.q + '</p><div class="finder-opts">' + n.o.map(function (o, i) {
        return '<button type="button" data-i="' + i + '"><span>' + o[0] + "<small>" + o[1] + '</small></span><span class="arr"></span></button>';
      }).join("") + "</div>" + (path.length ? '<button type="button" class="finder-back">Zurück</button>' : "");
      $$(".finder-opts button", root).forEach(function (b) { b.addEventListener("click", function () { path.push(+b.dataset.i); render(); var f = root.querySelector("button, a"); if (f) f.focus({ preventScroll: true }); }); });
      var bk = $(".finder-back", root); if (bk) bk.addEventListener("click", function () { path.pop(); render(); });
    }
    render();
  }

  /* ---------- Kontaktformular vorausfüllen ---------- */
  function contactPrefill() {
    var f = $("#contact-form"); if (!f) return;
    var map = { neubau: ["Neubau", "Wir planen einen Neubau und würden gerne ein erstes Gespräch vereinbaren."], umbau: ["Umbau / Sanierung", "Wir planen einen Umbau bzw. eine Sanierung und würden gerne ein erstes Gespräch vereinbaren."], beratung: ["Bauherrenberatung", "Wir interessieren uns für eine Bauherrenberatung."], liegenschaft: ["Liegenschaftsanalyse", "Wir interessieren uns für eine Analyse unserer Liegenschaft."], kaeufer: ["Käuferbetreuung", "Wir interessieren uns für die Käuferbetreuung."], bewerbung: ["Bewerbung", ""] };
    var k = location.hash.slice(1), m = map[k]; if (!m) return;
    var r = f.querySelector('input[name="anliegen"][value="' + m[0] + '"]'); if (r) r.checked = true;
    var t = $("#f-msg"); if (t && !t.value && m[1]) t.value = m[1] + "\n\n";
    setTimeout(function () { f.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); var n = $("#f-name"); if (n) n.focus({ preventScroll: true }); }, 400);
  }

  /* ---------- Projekt: Referenzblatt & Link ---------- */
  function projectTools() {
    var cats = $(".p-cats"); if (!cats || !D.projects.length) return;
    var id = new URLSearchParams(location.search).get("p");
    var p = D.projects.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var tools = document.createElement("div"); tools.className = "p-tools rv in";
    tools.innerHTML = '<button type="button" class="pt-print"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 6V1.5h8V6M4 12H2.5V6.5h11V12H12M4 9.5h8v5H4z"/></svg>Referenzblatt (PDF)</button>' +
      '<button type="button" class="pt-link"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.6 2.6 0 013.6 3.6L10.5 8M9 11.5l-1.2 1.2a2.6 2.6 0 01-3.6-3.6L5.5 8"/></svg><span>Link kopieren</span></button>';
    cats.parentNode.appendChild(tools);
    var host = document.createElement("div"); host.className = "print-host";
    var facts = p.facts.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("");
    var extra = [2, 3].filter(function (i) { return i <= p.img.length; });
    host.innerHTML = '<div class="print-sheet"><div class="ps-head"><img src="assets/img/logo-dark.png" alt="apb architekten ag"><span>Referenzprojekt · Nr. ' + p.nr + "<br>apb architekten ag · Seestrasse 110a · 8610 Uster</span></div>" +
      '<div class="ps-title">' + esc(p.name) + " <em>" + esc(p.ort) + '</em></div><div class="ps-sub">' + esc(p.sub) + "</div>" +
      '<img class="ps-hero" src="' + img(p, 1) + '" alt="">' +
      '<div class="ps-grid"><div><p>' + esc(p.text) + "</p>" + (extra.length ? '<div class="ps-imgs">' + extra.map(function (i) { return '<img src="' + img(p, i, true) + '" alt="">'; }).join("") + "</div>" : "") + '</div><dl class="ps-facts">' + facts + "</dl></div>" +
      '<div class="ps-foot"><span>+41 (0)44 944 60 80 · info@apb-architekten.ch · www.apb-architekten.ch</span><span>Mitglied SIA · MINERGIE®-Fachpartner</span></div></div>';
    $("main").appendChild(host);
    $(".pt-print", tools).addEventListener("click", function () {
      var ims = $$("img", host), n = ims.length, done = 0, go = function () { if (++done >= n) window.print(); };
      ims.forEach(function (im) { var pre = new Image(); pre.onload = pre.onerror = go; pre.src = im.src; });
    });
    $(".pt-link", tools).addEventListener("click", function () {
      var sp = $(".pt-link span", tools);
      var ok = function () { sp.textContent = "Kopiert"; setTimeout(function () { sp.textContent = "Link kopieren"; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(ok, function () { prompt("Link", location.href); }); else ok();
    });
  }


  /* ---------- Variante B: Index-Startseite ---------- */
  function indexHero() {
    var ix = $(".ix"); if (!ix) return;
    var ids = ix.getAttribute("data-ids").split(","), ps = ids.map(function (id) { return D.projects.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);
    var bg = $(".ix-bg", ix), list = $(".ix-list", ix);
    bg.innerHTML = ps.map(function (p, i) { return '<img src="' + img(p, 1) + '" alt=""' + (i ? ' loading="lazy"' : "") + ">"; }).join("");
    list.innerHTML = ps.map(function (p, i) {
      return '<a href="' + url(p) + '" data-i="' + i + '" data-cursor="Projekt"><span class="nr">' + String(i + 1).padStart(2, "0") + '</span><span class="nm">' + esc(p.name) + " <em>" + esc(p.ort) + '</em></span><span class="yr">' + (p.year || "") + "</span></a>";
    }).join("");
    var imgs = $$("img", bg), links = $$("a", list), cur = -1, timer, hover = false;
    function show(i) { if (i === cur) return; cur = i; imgs.forEach(function (m, k) { m.classList.toggle("on", k === i); }); links.forEach(function (a, k) { a.classList.toggle("on", k === i); }); }
    function auto() { clearInterval(timer); if (reduced) return; timer = setInterval(function () { if (!hover && !root.classList.contains("intro")) show((cur + 1) % ps.length); }, 3500); }
    links.forEach(function (a) {
      a.addEventListener("mouseenter", function () { hover = true; show(+a.dataset.i); });
      a.addEventListener("focus", function () { show(+a.dataset.i); });
    });
    list.addEventListener("mouseleave", function () { hover = false; auto(); });
    show(0); auto();
  }

  /* ---------- Variante C: Mosaik-Startseite ---------- */
  function mosaic() {
    var mo = $(".mo"); if (!mo) return;
    document.body.classList.add("variant-c");
    var grid = $(".mo-grid", mo);
    var mobile = window.matchMedia("(max-width: 860px)").matches;
    var pool = D.projects.filter(function (p) { return p.img.length > 1 && p.id !== "333-kff"; });
    pool.sort(function () { return Math.random() - 0.5; });
    var n = mobile ? 13 : 9, big = mobile ? [0, 6] : [0, 5];
    var shown = pool.slice(0, n), rest = pool.slice(n);
    grid.innerHTML = shown.map(function (p, i) {
      return '<a class="mo-tile' + (big.indexOf(i) > -1 ? " big" : "") + '" href="' + url(p) + '" data-cursor="Projekt"><img src="' + img(p, 1, true) + '" alt="' + esc(p.name + ", " + p.ort) + '"><span>' + esc(p.name) + " · " + esc(p.ort) + "</span></a>";
    }).join("");
    if (reduced) return;
    var tiles = $$(".mo-tile", grid);
    setInterval(function () {
      if (root.classList.contains("intro") || !rest.length || document.hidden) return;
      var k = Math.floor(Math.random() * tiles.length), t = tiles[k];
      if (t.matches(":hover")) return;
      var next = rest.shift(), old = shown[k];
      var im = $("img", t), nw = new Image();
      nw.onload = function () {
        im.classList.add("out");
        setTimeout(function () {
          im.src = nw.src; im.alt = next.name + ", " + next.ort; t.href = url(next); $("span", t).textContent = next.name + " · " + next.ort;
          requestAnimationFrame(function () { im.classList.remove("out"); });
        }, 650);
      };
      nw.src = img(next, 1, true);
      shown[k] = next; rest.push(old);
    }, 1800);
  }


  /* ---------- Präsentation: Vorher/Nachher-Regler ---------- */
  function compare() {
    $$("[data-cmp]").forEach(function (f) {
      var r = $("input", f);
      var set = function () { f.style.setProperty("--p", r.value + "%"); };
      r.addEventListener("input", set); set();
      if (!reduced && "IntersectionObserver" in window) {
        var o = new IntersectionObserver(function (es) {
          if (!es[0].isIntersecting) return; o.disconnect();
          var t0 = null; (function a(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / 1600); r.value = 50 + Math.sin(k * Math.PI * 2) * 22 * (1 - k); set(); if (k < 1) requestAnimationFrame(a); })(performance.now());
        }, { threshold: .5 });
        o.observe(f);
      }
    });
  }

  intro();
  transitions();
  compare();
  indexHero();
  mosaic();
  search();
  finder();
  contactPrefill();
  projectTools();
  jubiTeaser();
  chronik();
})();
