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

  function img(p, i, s) { return "assets/img/projects/" + p.id + "/" + String(i || 1).padStart(2, "0") + (s ? "-s" : "") + ".jpg"; }
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
        num.style.setProperty("--fill", (100 - k * 100) + "%");
      };
      window.addEventListener("scroll", f, { passive: true }); f();
    } else if (num) num.style.setProperty("--fill", "0%");
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

  intro();
  transitions();
  jubiTeaser();
  chronik();
})();
