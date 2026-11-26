/* ==========================================================================
   apb architekten ag – Interaktionen
   ========================================================================== */
(function () {
  "use strict";

  var D = window.APB || { projects: [], cats: [] };
  var ROOT = window.APB_ROOT || "";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var page = document.body.getAttribute("data-page");
  var catLabel = {};
  D.cats.forEach(function (c) { catLabel[c[0]] = c[1]; });
  var byId = {};
  D.projects.forEach(function (p) { byId[p.id] = p; });

  /* ---------- helpers ---------- */
  function img(p, i, small) { var n = i || 1, b = (p.base || ROOT + "assets/img/projects/" + p.id + "/") + String(n).padStart(2, "0"); return b + (small ? "-s.webp" : n === 1 ? ".webp" : ".jpg") + (p.fv ? "?v=" + p.fv : ""); }
  function plan(p, k, small) { return (p.base || "") + "plan-" + String(k).padStart(2, "0") + (small ? "-s" : "") + ".webp" + (p.pv ? "?v=" + p.pv : ""); }
  function url(p) { return p.url || "projekt.html?p=" + encodeURIComponent(p.id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function yearOf(p) { return p.year || (p.status === "Nicht realisiert" ? "Projekt" : "–"); }
  function statusClass(s) { return s === "Realisiert" ? "" : s === "Nicht realisiert" ? "no" : "prog"; }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  /* ---------- header: solid on scroll, hide on scroll down ---------- */
  var header = $(".site-header");
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    var threshold = document.body.classList.contains("on-dark") ? window.innerHeight * 0.75 : 10;
    header.classList.toggle("is-solid", y > threshold);
    var hide = y > 400 && y > lastY + 4 && !document.body.classList.contains("menu-open") && !document.documentElement.classList.contains("pz-on");   // im Potenzial-Tool bleibt die Kopfzeile (3D klebt darunter)
    if (y < lastY - 4 || y < 400) hide = false;
    if (Math.abs(y - lastY) > 4) {
      header.classList.toggle("is-hidden", hide);
      document.body.classList.toggle("head-hidden", hide);
      lastY = y;
    }
  }
  if (header) { window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); }

  /* ---------- mobile menu ---------- */
  var menuBtn = $(".menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      var open = !document.body.classList.contains("menu-open");
      document.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", open);
      document.body.style.overflow = open ? "hidden" : "";
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) menuBtn.click();
    });
  }

  /* ---------- reveal on scroll ---------- */
  function splitLines(root) {
    $$("[data-split]", root).forEach(function (h) {
      if (h.dataset.done) return;
      h.dataset.done = 1;
      var parts = h.innerHTML.split(/<br\s*\/?>/i);
      h.innerHTML = parts.map(function (t, i) { return '<span class="split-line"><span style="--d:' + (i * 0.09) + 's">' + t + "</span></span>"; }).join("");
      h.classList.add("rv-split");
    });
  }
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }) : null;
  function observe(root) {
    splitLines(root);
    $$(".rv, .rv-img, .rv-split", root).forEach(function (n) {
      if (io && !reduced) io.observe(n); else n.classList.add("in");
    });
  }

  /* ---------- custom cursor label ---------- */
  var cursor = null;
  if (finePointer) {
    cursor = el('<div class="cursor" aria-hidden="true"></div>');
    document.body.appendChild(cursor);
    document.addEventListener("mousemove", function (e) {
      cursor.style.setProperty("--x", e.clientX + "px");
      cursor.style.setProperty("--y", e.clientY + "px");
    }, { passive: true });
    document.addEventListener("mouseover", function (e) {
      var t = e.target.closest("[data-cursor]");
      if (t) { cursor.textContent = t.getAttribute("data-cursor"); cursor.classList.add("on"); }
      else cursor.classList.remove("on");
    });
  }

  /* ---------- drag-to-scroll ---------- */
  function dragScroll(track) {
    var down = false, sx = 0, sl = 0, moved = 0, v = 0, lastX = 0, raf;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;
      down = true; moved = 0; sx = e.clientX; lastX = e.clientX; sl = track.scrollLeft; cancelAnimationFrame(raf);
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 5) track.classList.add("dragging");
      v = e.clientX - lastX; lastX = e.clientX;
      track.scrollLeft = sl - dx;
    });
    window.addEventListener("pointerup", function () {
      if (!down) return;
      down = false;
      setTimeout(function () { track.classList.remove("dragging"); }, 0);
      (function glide() {
        if (Math.abs(v) < 0.5) return;
        track.scrollLeft -= v; v *= 0.93; raf = requestAnimationFrame(glide);
      })();
    });
    track.addEventListener("click", function (e) { if (moved > 5) { e.preventDefault(); e.stopPropagation(); } }, true);
  }

  /* ---------- card markup ---------- */
  function card(p, i) {
    var tag = p.status === "Realisierung" ? '<span class="tag">In Realisierung</span>' : p.status === "Nicht realisiert" ? '<span class="tag">Projekt</span>' : "";
    return '<a class="card" href="' + url(p) + '" data-cursor="Ansehen" data-id="' + p.id + '" style="--d:' + Math.min(i || 0, 8) * 0.05 + 's">' +
      '<div class="media">' + tag + '<img src="' + img(p, 1, true) + '" alt="' + esc(p.name + ", " + p.ort) + '" loading="lazy" decoding="async" width="800" height="600"></div>' +
      '<div class="card-meta"><h3>' + esc(p.name) + ' <span class="ort">' + esc(p.ort) + "</span></h3>" +
      '<span class="yr">' + esc(yearOf(p)) + "</span></div>" +
      '<p class="card-sub">' + esc(p.sub) + "</p></a>";
  }

  /* ---------- map ---------- */
  var OFFICE = [47.348162, 8.695723];
  var leafletQ = null;
  function withLeaflet(cb) {
    if (window.L) return cb();
    if (leafletQ) return leafletQ.push(cb);
    leafletQ = [cb];
    var css = document.createElement("link"); css.rel = "stylesheet"; css.href = ROOT + "assets/vendor/leaflet/leaflet.css"; document.head.appendChild(css);
    var s = document.createElement("script"); s.src = ROOT + "assets/vendor/leaflet/leaflet.js";
    s.onload = function () { var q = leafletQ; leafletQ = []; q.forEach(function (f) { f(); }); };
    document.head.appendChild(s);
  }
  var m3dQ = null;
  function open3d(o) {
    if (window.APB3D) return window.APB3D.open(o);
    if (!m3dQ) { m3dQ = document.createElement("script"); m3dQ.src = window.APB_3D || ROOT + "assets/js/map3d.js"; document.head.appendChild(m3dQ); }
    m3dQ.addEventListener("load", function () { window.APB3D.open(o); }, { once: true });
  }
  window.apbOpen3d = open3d;
  function makeMap(node, opts) {
    if (!window.L || !node) return null;
    opts = opts || {};
    var map = L.map(node, { scrollWheelZoom: false, zoomControl: false, attributionControl: true }).setView(opts.center || [47.33, 8.68], opts.zoom || 10);
    var attr = '&copy; <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener">swisstopo</a>';
    var base = function (layer, ext) { return L.tileLayer("https://wmts.geo.admin.ch/1.0.0/" + layer + "/default/current/3857/{z}/{x}/{y}." + ext, { maxZoom: 19, maxNativeZoom: 18, attribution: attr }); };
    /* «Karte» = amtliche Vermessung S/W; weit herausgezoomt (keine Vermessungsdaten) die graue Landeskarte */
    var grau = L.tileLayer("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg", { maxZoom: 14, attribution: attr });
    var av = L.tileLayer("https://wmts.geo.admin.ch/1.0.0/ch.kantone.cadastralwebmap-farbe/default/current/3857/{z}/{x}/{y}.png", { minZoom: 15, maxZoom: 20, maxNativeZoom: 20, attribution: "Amtliche Vermessung" });
    var karte = L.layerGroup([grau, av]).addTo(map), luft = base("ch.swisstopo.swissimage", "jpeg");
    var LAY = { karte: karte, luft: luft }, CLS = { karte: "is-av", luft: "" };
    node.classList.add("is-av");
    L.control.zoom({ position: "bottomright", zoomInTitle: "Hineinzoomen", zoomOutTitle: "Herauszoomen" }).addTo(map);
    var sw = L.control({ position: "topright" });
    sw.onAdd = function () {
      var d = L.DomUtil.create("div", "map-tools");
      d.innerHTML = '<div class="map-switch" role="group" aria-label="Kartengrundlage"><button type="button" data-l="karte" aria-pressed="true" title="Amtliche Vermessung (schwarz-weiss)">Karte</button><button type="button" data-l="luft" aria-pressed="false">Luftbild</button></div>' +
        (opts.threeD !== false ? '<button type="button" class="map-3d" title="In die 3D-Ansicht wechseln">3D</button>' : "");
      L.DomEvent.disableClickPropagation(d);
      L.DomEvent.disableScrollPropagation(d);
      var b = d.querySelectorAll(".map-switch button");
      Array.prototype.forEach.call(b, function (btn) {
        btn.onclick = function () {
          var k = btn.dataset.l;
          Object.keys(LAY).forEach(function (n) { if (n !== k && map.hasLayer(LAY[n])) map.removeLayer(LAY[n]); });
          LAY[k].addTo(map);
          node.classList.remove("is-av"); if (CLS[k]) node.classList.add(CLS[k]);
          Array.prototype.forEach.call(b, function (x) { x.setAttribute("aria-pressed", x === btn); });
        };
      });
      var t = d.querySelector(".map-3d");
      if (t) t.onclick = function () {
        var o = typeof opts.threeD === "function" ? opts.threeD() : {};
        o.center = o.center || [map.getCenter().lat, map.getCenter().lng];
        o.zoom = o.zoom || map.getZoom();
        open3d(o);
      };
      return d;
    };
    sw.addTo(map);
    node.addEventListener("click", function () { map.scrollWheelZoom.enable(); });
    node.addEventListener("mouseleave", function () { map.scrollWheelZoom.disable(); });
    if (opts.office !== false) {
      L.marker(OFFICE, { icon: L.divIcon({ className: "pin-hit", html: '<div class="pin-buero"><img src="' + ROOT + 'assets/img/buero-marke.png" alt="" width="34" height="34"></div>', iconSize: [44, 44], iconAnchor: [22, 22] }), zIndexOffset: 1000, title: "apb architekten ag" })
        .addTo(map).bindPopup('<div class="pop"><div><b>apb architekten ag</b>Seestrasse 110a, 8610 Uster<br><a href="https://www.google.com/maps/dir/?api=1&destination=47.348162,8.695723" target="_blank" rel="noopener">Route planen →</a></div></div>');
    }
    return map;
  }
  var CATCOL = { wohnen: "#e2b04a", lernen: "#5aa9d6", leiten: "#a796e0", glauben: "#d8d2c4", pflegen: "#6cc08b", reisen: "#e0708f", kaufen: "#e3925a", arbeiten: "#9bb8ab", turnen: "#5aa9d6", beleuchten: "#d8d2c4" };
  function pinColor(p) { return CATCOL[p.cats[0]] || "#edebe6"; }
  function projectMarkers(map, list) {
    var layer = L.layerGroup().addTo(map);
    var markers = {};
    list.forEach(function (p) {
      var m = L.marker(p.geo, { icon: L.divIcon({ className: "", html: '<div class="pin" data-id="' + p.id + '" style="background:' + pinColor(p) + '"></div>', iconSize: [26, 26], iconAnchor: [13, 13], className: "pin-hit" }), title: p.name + ", " + p.ort });
      m.bindPopup('<a class="pop" href="' + url(p) + '"><img src="' + img(p, 1, true) + '" alt=""><div><b>' + esc(p.name) + "</b><span>" + esc(p.ort) + " · " + esc(yearOf(p)) + "</span></div></a>", { closeButton: false, offset: [0, -4] });
      m.on("mouseover", function () { m.openPopup(); });
      m.addTo(layer); markers[p.id] = m;
    });
    return { layer: layer, markers: markers };
  }

  /* ==========================================================================
     HOME
     ========================================================================== */
  function initHome() {
    /* hero slider */
    var hero = $(".hero");
    if (hero) {
      var ids = hero.getAttribute("data-slides").split(",");
      var slides = ids.map(function (id) { return byId[id]; }).filter(Boolean);
      var stage = $(".hero-stage", hero), titleBox = $(".hero-title", hero), bars = $(".hero-bars", hero), count = $(".hero-count", hero);
      var DUR = 7000, cur = -1, timer = null;
      stage.innerHTML = slides.map(function (p, i) {
        var s = img(p, 1, window.innerWidth < 900);
        return '<div class="hero-slide" aria-hidden="true"><img ' + (i ? 'data-src="' : 'fetchpriority="high" src="') + s + '" alt="' + esc(p.name + ", " + p.ort) + '"></div>';
      }).join("");
      bars.innerHTML = slides.map(function (p, i) { return '<button type="button" aria-label="Projekt ' + (i + 1) + ": " + esc(p.name) + '"><i></i>' + esc(p.name) + "</button>"; }).join("");
      bars.style.setProperty("--dur", DUR + "ms");
      var slideEls = $$(".hero-slide", stage), barEls = $$("button", bars);
      function go(n) {
        n = (n + slides.length) % slides.length;
        if (n === cur) return;
        if (cur >= 0) { slideEls[cur].classList.remove("is-active"); barEls[cur].classList.remove("is-active"); }
        cur = n;
        var p = slides[n];
        [n, (n + 1) % slides.length].forEach(function (k) { var im = slideEls[k].querySelector("img[data-src]"); if (im) { im.src = im.getAttribute("data-src"); im.removeAttribute("data-src"); } });
        slideEls[n].classList.add("is-active");
        void barEls[n].offsetWidth;
        barEls[n].classList.add("is-active");
        titleBox.innerHTML =
          '<span class="eyebrow">' + esc(p.ort) + " · " + esc(yearOf(p)) + "</span>" +
          '<h1><a href="' + url(p) + '" class="swap" data-cursor="Projekt"><span>' + esc(p.name) + "</span></a></h1>" +
          '<p class="swap hero-text"><span style="animation-delay:.12s">' + esc(p.sub) + "</span></p>";
        count.innerHTML = "<b>" + String(n + 1).padStart(2, "0") + "</b> / " + String(slides.length).padStart(2, "0");
        restart();
      }
      function restart() { clearTimeout(timer); if (!hero.classList.contains("paused")) timer = setTimeout(function () { go(cur + 1); }, DUR); }
      barEls.forEach(function (b, i) { b.addEventListener("click", function () { go(i); }); });
      $(".hero-ctrl .prev", hero).addEventListener("click", function () { go(cur - 1); });
      $(".hero-ctrl .next", hero).addEventListener("click", function () { go(cur + 1); });
      hero.addEventListener("mouseenter", function () { hero.classList.add("paused"); clearTimeout(timer); });
      hero.addEventListener("mouseleave", function () { hero.classList.remove("paused"); restart(); });
      var tx = null;
      hero.addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; }, { passive: true });
      hero.addEventListener("touchend", function (e) {
        if (tx == null) return; var dx = e.changedTouches[0].clientX - tx; tx = null;
        if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
      });
      document.addEventListener("keydown", function (e) {
        if (window.scrollY > window.innerHeight * 0.6) return;
        if (e.key === "ArrowRight") go(cur + 1); if (e.key === "ArrowLeft") go(cur - 1);
      });
      document.addEventListener("visibilitychange", function () { if (document.hidden) clearTimeout(timer); else restart(); });
      go(0);
    }

    /* statement word highlight on scroll */
    var st = $(".statement");
    if (st && !reduced) {
      var words = [];
      (function wrap(node) {
        $$(":scope > *", node).length;
        Array.prototype.slice.call(node.childNodes).forEach(function (c) {
          if (c.nodeType === 3) {
            var frag = document.createDocumentFragment();
            c.textContent.split(/(\s+)/).forEach(function (w) {
              if (!w) return;
              if (/^\s+$/.test(w)) frag.appendChild(document.createTextNode(w));
              else { var s = document.createElement("span"); s.className = "w"; s.textContent = w; frag.appendChild(s); words.push(s); }
            });
            c.parentNode.replaceChild(frag, c);
          } else if (c.nodeType === 1) wrap(c);
        });
      })(st);
      var tick = function () {
        var r = st.getBoundingClientRect(), vh = window.innerHeight;
        var prog = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
        var n = Math.round(prog * words.length);
        words.forEach(function (w, i) { w.classList.toggle("on", i < n); });
      };
      window.addEventListener("scroll", tick, { passive: true }); tick();
    }

    /* selection rail */
    var rail = $("#rail");
    if (rail) {
      var order = ["319-sag", "333-kff", "310-gws", "292-mlw", "313-gbw", "318-epu", "263-piu"];
      var sel = order.map(function (id) { return byId[id]; }).filter(Boolean);
      rail.innerHTML = sel.map(function (p) {
        return '<div class="rail-item">' + card(p) + "</div>";
      }).join("");
      $$(".card", rail).forEach(function (c) { c.setAttribute("data-cursor", "Ziehen"); var im = c.querySelector("img"), q = byId[c.dataset.id]; im.srcset = img(q, 1, true) + " 800w, " + img(q, 1) + " 1600w"; im.sizes = "(max-width: 860px) 80vw, 36vw"; });
      dragScroll(rail);
      var bar = $(".rail-progress i");
      var upd = function () {
        var max = rail.scrollWidth - rail.clientWidth;
        var w = rail.clientWidth / rail.scrollWidth;
        bar.style.width = w * 100 + "%";
        bar.style.transform = "translateX(" + (max ? (rail.scrollLeft / max) * (1 / w - 1) * 100 : 0) + "%)";
      };
      rail.addEventListener("scroll", upd, { passive: true }); window.addEventListener("resize", upd); upd();
      $$(".rail-btns button").forEach(function (b) {
        b.addEventListener("click", function () { rail.scrollBy({ left: (b.classList.contains("prev") ? -1 : 1) * rail.clientWidth * 0.6, behavior: "smooth" }); });
      });
    }

    /* themes explorer */
    var tl = $(".themes-list"), tv = $(".themes-view");
    if (tl) {
      var featured = { wohnen: "292-mlw", lernen: "319-sag", leiten: "313-gbw", glauben: "310-gws", pflegen: "263-piu", reisen: "270-bsb", kaufen: "251-asch", arbeiten: "281-mzv", turnen: "311-sbh", beleuchten: "016-kpf" };
      tl.innerHTML = D.cats.map(function (c, i) {
        var n = D.projects.filter(function (p) { return p.cats.indexOf(c[0]) > -1; }).length;
        return '<a href="projekte.html#thema=' + c[0] + '" data-cat="' + c[0] + '"><small>' + String(i + 1).padStart(2, "0") + "</small>" + c[1] + '<span class="cnt">' + n + "</span></a>";
      }).join("");
      tv.innerHTML = D.cats.map(function (c) { var p = byId[featured[c[0]]]; return '<img data-cat="' + c[0] + '" src="' + img(p, 1, true) + '" alt="" loading="lazy">'; }).join("") + "<figcaption></figcaption>";
      var cap = $("figcaption", tv);
      var show = function (cat) {
        $$("img", tv).forEach(function (i) { i.classList.toggle("on", i.dataset.cat === cat); });
        $$("a", tl).forEach(function (a) { a.classList.toggle("is-on", a.dataset.cat === cat); });
        var p = byId[featured[cat]]; cap.textContent = p.name + ", " + p.ort;
      };
      $$("a", tl).forEach(function (a) { a.addEventListener("mouseenter", function () { show(a.dataset.cat); }); a.addEventListener("focus", function () { show(a.dataset.cat); }); });
      show("wohnen");
    }

    /* home map */
    var hm = $("#home-map");
    if (hm) {
      var mapStarted = false;
      var start = function () {
        if (mapStarted) return; mapStarted = true;
        withLeaflet(function () {
          var map = makeMap(hm, { center: [47.34, 8.66], zoom: 10 });
          if (map) {
            projectMarkers(map, D.projects);
            map.fitBounds(L.latLngBounds(D.projects.map(function (p) { return p.geo; })), { padding: [40, 40] });
          }
        });
      };
      if (io) new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { start(); o.disconnect(); } }, { rootMargin: "300px" }).observe(hm); else start();
    }
  }

  /* ---------- counters ---------- */
  function initCounters() {
    $$("[data-count]").forEach(function (n) {
      var end = parseFloat(n.getAttribute("data-count")), pre = n.getAttribute("data-pre") || "", done = false;
      var run = function () {
        if (done) return; done = true;
        if (reduced) { n.textContent = pre + end; return; }
        var t0 = null, dur = 1800;
        (function f(t) {
          if (!t0) t0 = t; var k = Math.min(1, (t - t0) / dur); k = 1 - Math.pow(1 - k, 4);
          n.textContent = pre + Math.round(end * k); if (k < 1) requestAnimationFrame(f);
        })(performance.now());
      };
      if (io) new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { run(); o.disconnect(); } }, { threshold: 0.4 }).observe(n); else run();
    });
  }

  /* ==========================================================================
     PROJEKTE
     ========================================================================== */
  function initProjects() {
    var state = { cat: "alle", view: "raster", q: "", sort: "nr", dir: "desc", tags: [], cost: "" };
    var TAGS = [["minergie", "MINERGIE"], ["denkmal", "Denkmalschutz / Ortsbild"], ["wettbewerb", "Wettbewerb / Planerwahl 1. Rang"], ["holzbau", "Holzbau"]];
    var COSTS = [["0-2", "bis 2 Mio.", 0, 2], ["2-5", "2 – 5 Mio.", 2, 5], ["5-10", "5 – 10 Mio.", 5, 10], ["10-99", "über 10 Mio.", 10, 999]];
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get("thema") && (catLabel[h.get("thema")] || h.get("thema") === "auswahl")) state.cat = h.get("thema");
    if (h.get("ansicht")) state.view = h.get("ansicht");
    state.mit = h.get("mit") && (D.beteiligte || {})[h.get("mit")] ? h.get("mit") : "";

    var chips = $("#chips"), grid = $("#pgrid"), tbody = $("#plist tbody"), countEl = $("#count"), empty = $(".empty");
    var views = { raster: $("#v-raster"), liste: $("#v-liste"), karte: $("#v-karte"), zeitachse: $("#v-zeitachse") };
    var all = D.projects.slice();
    var cats = [["alle", "Alle"], ["auswahl", "Auswahl"]].concat(D.cats);
    chips.innerHTML = cats.map(function (c) {
      var n = c[0] === "alle" ? all.length : all.filter(function (p) { return c[0] === "auswahl" ? p.sel : p.cats.indexOf(c[0]) > -1; }).length;
      return '<button type="button" class="chip" data-cat="' + c[0] + '" aria-pressed="false">' + c[1] + "<sup>" + n + "</sup></button>";
    }).join("");

    var ftags = $("#ftags"), fcost = $("#fcost"), fpanel = $("#filter-panel"), fbtn = $("#filter-btn"), fn = $("#filter-n");
    if (ftags) {
      ftags.innerHTML = TAGS.map(function (t) { var n = all.filter(function (p) { return (p.tags || []).indexOf(t[0]) > -1; }).length; return '<button type="button" class="chip" data-tag="' + t[0] + '" aria-pressed="false">' + t[1] + "<sup>" + n + "</sup></button>"; }).join("");
      fcost.innerHTML = COSTS.map(function (c) { var n = all.filter(function (p) { return p.mio && p.mio >= c[2] && p.mio < c[3]; }).length; return '<button type="button" class="chip" data-cost="' + c[0] + '" aria-pressed="false">' + c[1] + "<sup>" + n + "</sup></button>"; }).join("");
      fbtn.addEventListener("click", function () { var o = fpanel.hidden; fpanel.hidden = !o; fbtn.setAttribute("aria-expanded", o); });
      ftags.addEventListener("click", function (e) { var b = e.target.closest(".chip"); if (!b) return; var t = b.dataset.tag, i = state.tags.indexOf(t); if (i > -1) state.tags.splice(i, 1); else state.tags.push(t); render(); });
      fcost.addEventListener("click", function (e) { var b = e.target.closest(".chip"); if (!b) return; state.cost = state.cost === b.dataset.cost ? "" : b.dataset.cost; render(); });
      $("#freset").addEventListener("click", function () { state.tags = []; state.cost = ""; state.cat = "alle"; state.q = ""; state.mit = ""; $("#q").value = ""; render(); });
    }
    function match(p) {
      if (state.mit && !(p.team || []).some(function (t) { return (t[2] || []).indexOf(state.mit) > -1; })) return false;
      if (state.cat === "auswahl" && !p.sel) return false;
      if (state.tags.length && !state.tags.every(function (t) { return (p.tags || []).indexOf(t) > -1; })) return false;
      if (state.cost) { var c = COSTS.filter(function (x) { return x[0] === state.cost; })[0]; if (!p.mio || p.mio < c[2] || p.mio >= c[3]) return false; }
      if (state.cat !== "alle" && state.cat !== "auswahl" && p.cats.indexOf(state.cat) < 0) return false;
      if (state.q) {
        var hay = (p.name + " " + p.ort + " " + p.sub + " " + p.text + " " + p.facts.map(function (f) { return f[1]; }).join(" ") + " " + p.cats.map(function (c) { return catLabel[c]; }).join(" ") + " " + (p.team || []).map(function (t) { return t[1] + " " + (t[2] || []).map(function (k) { return (D.beteiligte || {})[k] ? D.beteiligte[k].n : ""; }).join(" "); }).join(" ")).toLowerCase();
        return state.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
      }
      return true;
    }
    function sorted(list) {
      var k = state.sort, m = state.dir === "asc" ? 1 : -1;
      return list.slice().sort(function (a, b) {
        var va = k === "year" ? (a.year || 0) : k === "nr" ? a.id : (a[k] || "").toLowerCase();
        var vb = k === "year" ? (b.year || 0) : k === "nr" ? b.id : (b[k] || "").toLowerCase();
        return va < vb ? -m : va > vb ? m : 0;
      });
    }

    var map = null, mk = null;
    function render() {
      $$(".chip", chips).forEach(function (c) { c.setAttribute("aria-pressed", c.dataset.cat === state.cat); });
      $$(".views button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.view === state.view); });
      Object.keys(views).forEach(function (k) { views[k].hidden = k !== state.view; });
      if (ftags) {
        $$(".chip", ftags).forEach(function (c) { c.setAttribute("aria-pressed", state.tags.indexOf(c.dataset.tag) > -1); });
        $$(".chip", fcost).forEach(function (c) { c.setAttribute("aria-pressed", c.dataset.cost === state.cost); });
        var nf = state.tags.length + (state.cost ? 1 : 0); fn.hidden = !nf; fn.textContent = nf;
        if (nf && fpanel.hidden) { fpanel.hidden = false; fbtn.setAttribute("aria-expanded", true); }
      }
      var list = sorted(all.filter(match));
      var extra = state.tags.map(function (t) { return TAGS.filter(function (x) { return x[0] === t; })[0][1]; });
      if (state.cost) extra.push(COSTS.filter(function (x) { return x[0] === state.cost; })[0][1]);
      countEl.innerHTML = "<b>" + list.length + "</b> " + (list.length === 1 ? "Projekt" : "Projekte") + (state.cat !== "alle" ? " · " + (state.cat === "auswahl" ? "Auswahl" : catLabel[state.cat]) : "") + (extra.length ? " · " + esc(extra.join(" · ")) : "") +
        (state.mit ? ' <span class="mit-tag">mit <b>' + esc(D.beteiligte[state.mit].n) + '</b><button type="button" class="mit-x" aria-label="Filter entfernen">×</button></span>' : "");
      empty.classList.toggle("on", !list.length);
      var mx = $(".mit-x", countEl); if (mx) mx.addEventListener("click", function () { state.mit = ""; render(); });
      if (state.view === "raster") grid.innerHTML = list.map(card).join("");
      if (state.view === "liste") {
        tbody.innerHTML = list.map(function (p) {
          return '<tr data-id="' + p.id + '"><td class="nr">' + p.nr + '</td><td class="nm"><a href="' + url(p) + '">' + esc(p.name) + '</a></td><td class="ort">' + esc(p.ort) + '</td><td class="cat">' + p.cats.map(function (c) { return catLabel[c]; }).join(", ") + '</td><td class="st"><span class="status-dot ' + statusClass(p.status) + '"></span>' + esc(p.status) + '</td><td class="yr">' + esc(yearOf(p)) + "</td></tr>";
        }).join("");
        $$("#plist th button").forEach(function (b) { b.setAttribute("data-dir", b.dataset.sort === state.sort ? state.dir : ""); });
      }
      if (state.view === "karte") withLeaflet(function () {
        if (!map) { map = makeMap($("#pmap"), { threeD: function () { return { projects: sorted(all.filter(match)) }; } }); }
        if (map) {
          if (mk) map.removeLayer(mk.layer);
          mk = projectMarkers(map, list);
          var used = {}; list.forEach(function (p) { used[p.cats[0]] = 1; });
          $("#pmap-legend").innerHTML = D.cats.filter(function (c) { return used[c[0]]; }).map(function (c) { return '<span><i style="background:' + CATCOL[c[0]] + '"></i>' + c[1] + "</span>"; }).join("") + '<span><img class="leg-buero" src="' + ROOT + 'assets/img/buero-marke.png" alt="" width="16" height="16">Atelier Uster</span>';
          var ml = $("#maplist");
          ml.innerHTML = list.map(function (p) { return '<li><a href="' + url(p) + '" data-id="' + p.id + '"><img src="' + img(p, 1, true) + '" alt="" loading="lazy" width="800" height="600"><span><b>' + esc(p.name) + "</b><small>" + esc(p.ort) + (p.year ? " · " + p.year : "") + (p.geoExakt ? "" : " · Lage ungefähr") + '</small></span><i style="background:' + pinColor(p) + '"></i></a></li>'; }).join("");
          var hl = function (id, on) { var el = map.getContainer().querySelector('.pin[data-id="' + id + '"]'); if (el) el.classList.toggle("on", on); };
          $$("a", ml).forEach(function (a) {
            a.addEventListener("mouseenter", function () { hl(a.dataset.id, true); var mm = mk.markers[a.dataset.id]; if (mm) { mm.openPopup(); } });
            a.addEventListener("mouseleave", function () { hl(a.dataset.id, false); });
            a.addEventListener("focus", function () { var mm = mk.markers[a.dataset.id]; if (mm) { map.panTo(mm.getLatLng()); mm.openPopup(); } });
          });
          Object.keys(mk.markers).forEach(function (id) {
            mk.markers[id].on("mouseover", function () { var a = ml.querySelector('a[data-id="' + id + '"]'); if (a) { $$("a.on", ml).forEach(function (x) { x.classList.remove("on"); }); a.classList.add("on"); a.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" }); } });
          });
          setTimeout(function () { map.invalidateSize(); if (list.length) map.fitBounds(L.latLngBounds(list.map(function (p) { return p.geo; }).concat([OFFICE])), { padding: [50, 50], maxZoom: 13 }); }, 30);
        }
      });
      if (state.view === "zeitachse") renderTimeline(list);
      var hs = new URLSearchParams();
      if (state.cat !== "alle") hs.set("thema", state.cat);
      if (state.view !== "raster") hs.set("ansicht", state.view);
      if (state.mit) hs.set("mit", state.mit);
      history.replaceState(null, "", hs.toString() ? "#" + hs.toString() : location.pathname + location.search);
    }

    function renderTimeline(list) {
      var tl = $("#timeline .tl-inner"), open = $("#tl-open");
      var tlY = function (p) { return p.year || p.tlYear; };   /* tlYear: nur für die Zeitachse */
      var dated = list.filter(tlY);
      var undated = list.filter(function (p) { return !tlY(p); });
      var y0 = 2002, y1 = 2026, html = "";
      for (var y = y0; y <= y1; y++) {
        var ps = dated.filter(function (p) { return tlY(p) === y; });
        if (!ps.length) { html += '<div class="tl-year gap" aria-hidden="true"><span class="yl">' + String(y).slice(2) + "</span></div>"; continue; }
        html += '<div class="tl-year"><span class="yl">' + y + '</span><div class="row">' + ps.map(function (p) {
          return '<a class="tl-item" href="' + url(p) + '" data-cursor="Ansehen"><img src="' + img(p, 1, true) + '" alt="" loading="lazy" width="800" height="600"><span>' + esc(p.name) + " <em>" + esc(p.ort) + "</em></span></a>";
        }).join("") + "</div></div>";
      }
      tl.innerHTML = html;
      open.hidden = !undated.length;
      $(".pgrid", open).innerHTML = undated.map(card).join("");
      var t = $("#timeline"); t.scrollLeft = t.scrollWidth;
    }

    chips.addEventListener("click", function (e) { var b = e.target.closest(".chip"); if (!b) return; state.cat = b.dataset.cat; render(); });
    $$(".views button").forEach(function (b) { b.addEventListener("click", function () { state.view = b.dataset.view; render(); }); });
    var qi = $("#q"), qt;
    qi.addEventListener("input", function () { clearTimeout(qt); qt = setTimeout(function () { state.q = qi.value.trim(); render(); }, 120); });
    $$("#plist th button").forEach(function (b) {
      b.addEventListener("click", function () {
        if (state.sort === b.dataset.sort) state.dir = state.dir === "asc" ? "desc" : "asc";
        else { state.sort = b.dataset.sort; state.dir = b.dataset.sort === "year" || b.dataset.sort === "nr" ? "desc" : "asc"; }
        render();
      });
    });
    tbody.addEventListener("click", function (e) { var tr = e.target.closest("tr"); if (tr && !e.target.closest("a")) location.href = url(byId[tr.dataset.id]); });
    dragScroll($("#timeline"));

    /* list hover preview following cursor */
    var prev = $(".hover-preview"), pimg = $("img", prev);
    if (finePointer && prev) {
      tbody.addEventListener("mousemove", function (e) {
        var tr = e.target.closest("tr"); if (!tr) return;
        var src = img(byId[tr.dataset.id], 1, true);
        if (pimg.getAttribute("src") !== src) pimg.src = src;
        var x = Math.min(e.clientX + 28, window.innerWidth - 340), y = Math.min(e.clientY - 120, window.innerHeight - 260);
        prev.style.setProperty("--x", x + "px"); prev.style.setProperty("--y", Math.max(y, 80) + "px");
        prev.classList.add("on");
      });
      tbody.addEventListener("mouseleave", function () { prev.classList.remove("on"); });
    }
    window.addEventListener("hashchange", function () {
      var h2 = new URLSearchParams(location.hash.slice(1));
      state.cat = h2.get("thema") || "alle"; state.view = h2.get("ansicht") || state.view; render();
    });
    render();
  }

  /* ==========================================================================
     PROJEKT (Detail)
     ========================================================================== */
  /* ---------- Beteiligte (Fachplaner): klickbar ab 2 gemeinsamen Projekten ---------- */
  var BET = D.beteiligte || {};
  function betHTML(t) {
    var keys = (t[2] || []).filter(function (k) { return BET[k]; });
    if (!keys.length) return esc(t[1]);
    var btn = function (k, txt) { return '<button type="button" class="bt" data-bet="' + k + '" aria-haspopup="true" aria-expanded="false">' + esc(txt) + "</button>"; };
    if (keys.length === 1 && (t[2] || []).length === 1) return btn(keys[0], t[1]);
    return (t[2] || []).map(function (k) { return BET[k] ? btn(k, BET[k].n) : esc(k); }).join(", ");
  }
  function betMenu(root) {
    var menu = null, owner = null;
    function zu() { if (menu) { menu.remove(); menu = null; } if (owner) { owner.setAttribute("aria-expanded", "false"); owner = null; } }
    root.addEventListener("click", function (e) {
      var b = e.target.closest(".bt"); if (!b) return;
      e.preventDefault(); var war = owner === b; zu(); if (war) return;
      var k = b.dataset.bet, x = BET[k]; if (!x) return;
      menu = document.createElement("div"); menu.className = "bt-menu"; menu.setAttribute("role", "menu");
      menu.innerHTML = '<span class="bt-name">' + esc(x.n) + "</span>" +
        '<a role="menuitem" href="projekte.html#mit=' + k + '">Alle Projekte mit ' + esc(x.n) + " (" + x.c + ")</a>" +
        (x.w ? '<a role="menuitem" href="' + esc(x.w) + '" target="_blank" rel="noopener">Website ↗</a>' : "") +
        (x.a === "apb" ? '<a role="menuitem" href="buero.html#team">Zum Team</a>' : "");
      document.body.appendChild(menu);
      var r = b.getBoundingClientRect(), mw = Math.min(320, innerWidth - 24);
      menu.style.left = Math.max(12, Math.min(r.left + scrollX, scrollX + innerWidth - mw - 12)) + "px";
      menu.style.top = (r.bottom + scrollY + 6) + "px";
      owner = b; b.setAttribute("aria-expanded", "true");
      var first = menu.querySelector("a"); if (first) first.focus({ preventScroll: true });
    });
    document.addEventListener("click", function (e) { if (menu && !e.target.closest(".bt-menu") && !e.target.closest(".bt")) zu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu) { var o = owner; zu(); if (o) o.focus(); } });
    addEventListener("resize", zu);
  }

  function initProject() {
    var id = new URLSearchParams(location.search).get("p") || document.body.getAttribute("data-pid");
    var root = $("#project");
    if (id === "wettbewerbe") return renderCompetitions(root);
    var p = byId[id] || D.projects[0];
    var list = D.projects.slice().sort(function (a, b) { return a.id < b.id ? 1 : -1; });
    var idx = list.indexOf(p);
    var prevP = list[(idx - 1 + list.length) % list.length], nextP = list[(idx + 1) % list.length];
    document.title = p.name + ", " + p.ort + " – apb architekten ag";
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute("content", p.name + ", " + p.ort + ": " + p.text);

    var related = D.projects.filter(function (q) { return q !== p && q.cats.some(function (c) { return p.cats.indexOf(c) > -1; }); });
    related.sort(function (a, b) {
      var sa = a.cats.filter(function (c) { return p.cats.indexOf(c) > -1; }).length, sb = b.cats.filter(function (c) { return p.cats.indexOf(c) > -1; }).length;
      return sb - sa || (b.year || 0) - (a.year || 0);
    });
    var areal = p.areal ? D.projects.filter(function (q) { return q !== p && q.areal === p.areal; }) : [];
    related = areal.concat(related.filter(function (q) { return areal.indexOf(q) < 0; })).slice(0, 3);

    var n = p.img.length;
    var gal = "";
    for (var i = 2; i <= n; i++) {
      var cap = p.cap[String(i)];
      gal += '<figure class="rv" data-i="' + i + '" data-cursor="Vergrössern"><img src="' + img(p, i, true) + '" width="' + p.img[i - 1][0] + '" height="' + p.img[i - 1][1] + '" alt="' + esc(p.name + " – Bild " + i + (cap ? ": " + cap : "")) + '" loading="lazy" decoding="async">' + (cap ? "<figcaption>" + esc(cap) + "</figcaption>" : "") + "</figure>";
    }

    root.innerHTML =
      '<section class="p-hero" data-cursor="Vergrössern"><img src="' + img(p, 1) + '" alt="' + esc(p.name + ", " + p.ort) + '" fetchpriority="high">' +
      '<div class="wrap"><span class="eyebrow">Projekt ' + p.nr + " · " + p.cats.map(function (c) { return catLabel[c]; }).join(" · ") + "</span>" +
      '<h1><span class="split-line in"><span>' + esc(p.name) + '</span></span><span class="split-line in ort"><span style="--d:.1s">' + esc(p.ort) + "</span></span></h1></div></section>" +
      '<div class="wrap"><div class="p-crumbs"><nav aria-label="Brotkrumen"><a href="index.html">Start</a><span>/</span><a href="projekte.html">Projekte</a><span>/</span><span aria-current="page">' + esc(p.name) + "</span></nav>" +
      '<div class="p-pn"><a class="prev" href="' + url(prevP) + '"><span class="arr"></span>Vorheriges</a><a href="' + url(nextP) + '">Nächstes<span class="arr"></span></a></div></div>' +
      '<div class="p-body"><div class="p-intro"><p class="sub rv">' + esc(p.sub) + '</p><p class="lead rv" style="--d:.1s">' + esc(p.text) + "</p>" +
      (areal.length ? '<p class="p-areal rv" style="--d:.15s">Teil der <b>' + esc(p.areal) + '</b> <span>– ebenfalls auf diesem Areal:</span> ' + areal.map(function (q) { return '<a href="' + url(q) + '">' + esc(q.name) + "</a>"; }).join(", ") + "</p>" : "") +
      '<div class="p-cats rv" style="--d:.2s">' + p.cats.map(function (c) { return '<a class="chip" href="projekte.html#thema=' + c + '">' + catLabel[c] + "</a>"; }).join("") + "</div></div>" +
      '<aside class="facts rv"><dl>' + p.facts.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl>" +
        (p.quellen && p.quellen.length ? '<div class="p-quellen"><span class="eyebrow">' + (D.lang === "en" ? "Sources" : "Nachweise") + '</span><ul>' + p.quellen.map(function (q) { return '<li><a href="' + esc(q[1]) + '" target="_blank" rel="noopener">' + esc(q[0]) + " ↗</a></li>"; }).join("") + "</ul></div>" : "") +
      '<div class="mini-map map" id="mini-map" aria-label="Standort auf der Karte"></div><button type="button" class="btn-3d" id="p3d"><span aria-hidden="true">3D</span>Umgebung in 3D ansehen<i aria-hidden="true">→</i></button></aside></div>' +
      (gal ? '<div class="gallery' + (n > 4 ? " lead-wide" : "") + '">' + gal + "</div>" : "") + "</div>" +
      (p.desc && p.desc.length ? '<section class="section tight p-desc"><div class="wrap"><div class="section-head"><h2 class="h2 rv">Projektbeschrieb</h2></div><div class="p-desc-grid">' +
        p.desc.map(function (d) { return '<div class="rv">' + (d[0] ? "<h3>" + esc(d[0]) + "</h3>" : "") + "<p>" + esc(d[1]) + "</p></div>"; }).join("") + "</div></div></section>" : "") +
      (p.video ? '<section class="section tight p-video"><div class="wrap"><div class="section-head"><h2 class="h2 rv">Bauablauf im Zeitraffer</h2><span class="muted small rv">' + esc(p.video.text) + '</span></div><div class="tl-player rv" data-src="' + esc(p.video.src) + '" data-poster="' + esc(p.video.poster) + '" data-strip="' + esc(p.video.strip) + '"></div></div></section>' : "") +
      (p.plans && p.plans.length ? '<section class="section tight p-plans"><div class="wrap"><div class="section-head"><h2 class="h2 rv">Pläne</h2><span class="muted small rv">Zum Vergrössern anklicken</span></div><div class="plan-grid">' +
        p.plans.map(function (pl, k) { return '<figure class="plan rv" data-k="' + k + '" data-cursor="Vergrössern"><div class="plan-img"><img src="' + plan(p, k + 1, true) + '" alt="' + esc(pl) + '" loading="lazy" width="1200" height="800"></div><figcaption>' + esc(pl) + "</figcaption></figure>"; }).join("") + "</div></div></section>" : "") +
      (p.team && p.team.length ? '<section class="section tight p-team"><div class="wrap"><div class="section-head"><h2 class="h2 rv">Beteiligte</h2></div><dl class="team-list rv">' +
        p.team.map(function (t) { return "<div><dt>" + esc(t[0]) + "</dt><dd>" + betHTML(t) + "</dd></div>"; }).join("") + "</dl></div></section>" : "") +
      (related.length ? '<section class="section tight related"><div class="wrap"><div class="section-head"><h2 class="h2">Verwandte Projekte</h2><a class="link" href="projekte.html#thema=' + p.cats[0] + '">Alle Projekte «' + catLabel[p.cats[0]] + '»<span class="arr"></span></a></div><div class="pgrid">' + related.map(card).join("") + "</div></div></section>" : "") +
      '<a class="next-project" href="' + url(nextP) + '" data-cursor="Weiter"><img src="' + img(nextP, 1) + '" alt="" loading="lazy"><div class="wrap"><span class="eyebrow">Nächstes Projekt</span><h2 class="display">' + esc(nextP.name) + "</h2></div></a>";

    /* lightbox */
    var lbImgs = []; for (var k = 1; k <= n; k++) lbImgs.push({ src: img(p, k), th: img(p, k, true), cap: p.cap[String(k)] || "" });
    var lb = lightbox(lbImgs, p.name + ", " + p.ort);
    $$(".gallery figure", root).forEach(function (f) { f.addEventListener("click", function () { lb.open(+f.dataset.i - 1); }); });
    $(".p-hero", root).addEventListener("click", function (e) { if (!e.target.closest("a")) lb.open(0); });
    if (p.plans && p.plans.length) {
      var lbp = lightbox(p.plans.map(function (pl, k) { return { src: plan(p, k + 1), th: plan(p, k + 1, true), cap: pl }; }), p.name + " – Pläne", "plans");
      $$(".plan", root).forEach(function (f) { f.addEventListener("click", function () { lbp.open(+f.dataset.k); }); });
    }

    /* parallax hero */
    var hi = $(".p-hero img", root);
    if (!reduced) window.addEventListener("scroll", function () { var y = window.scrollY; if (y < window.innerHeight) hi.style.transform = "translate3d(0," + y * 0.25 + "px,0) scale(" + (1 + y * 0.0002) + ")"; }, { passive: true });

    document.addEventListener("keydown", function (e) {
      if (lb.isOpen() || /input|textarea/i.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight" && e.altKey) location.href = url(nextP);
      if (e.key === "ArrowLeft" && e.altKey) location.href = url(prevP);
    });

    if (window.apbTimelapse) window.apbTimelapse(root); else setTimeout(function () { if (window.apbTimelapse) window.apbTimelapse(root); }, 300);
    withLeaflet(function () {
      var mm = makeMap($("#mini-map"), { center: p.geo, zoom: p.geoExakt ? 15 : 13, threeD: false });
      if (mm) {
        projectMarkers(mm, [p]);
        mm.setView(p.geo, p.geoExakt ? 15 : 13);
      }
    });
    var b3 = $("#p3d"); if (b3) b3.addEventListener("click", function () { open3d({ focus: p }); });
    betMenu(root);
    observe(root);
  }

  function renderCompetitions(root) {
    document.title = "Wettbewerbe und Architekten-Auswahlverfahren – apb architekten ag";
    document.body.classList.remove("on-dark");
    var C = D.competitions;
    var src = function (c, s) { return ROOT + "assets/img/projects/wettbewerbe/" + String(c.i).padStart(2, "0") + (s ? "-s.webp" : ".jpg"); };
    root.innerHTML =
      '<section class="page-hero"><div class="wrap"><span class="eyebrow">Projekte</span><h1 class="display" data-split>Wettbewerbe<br>&amp; Auswahl&shy;verfahren</h1>' +
      '<div class="page-hero-grid"><p class="lead rv">Teilnahme an zahlreichen öffentlichen Wettbewerben und Architekten-Auswahlverfahren.</p>' +
      '<div class="aside rv"><a class="link" href="projekte.html">Alle Projekte<span class="arr"></span></a></div></div></div></section>' +
      '<div class="wrap" style="padding-bottom:clamp(80px,10vw,160px)"><h2 class="sr-only">Wettbewerbsbeiträge</h2><div class="pgrid even">' + C.map(function (c, i) {
        var parts = c.t.split("///").map(function (s) { return s.trim(); });
        var linked = c.p && byId[c.p];
        return '<a class="card" ' + (linked ? 'href="' + url(linked) + '"' : 'href="#" data-i="' + i + '"') + ' data-cursor="' + (linked ? "Projekt" : "Vergrössern") + '" data-lb="' + i + '"><div class="media">' + (parts[2] ? '<span class="tag">' + esc(parts[2]) + "</span>" : "") +
          '<img src="' + src(c, true) + '" alt="' + esc(parts[0]) + '" loading="lazy"></div><div class="card-meta"><h3>' + esc(parts[0]) + ' <span class="ort">' + esc(parts[1] || "") + "</span></h3></div>" +
          (linked ? '<p class="card-sub">' + esc(linked.text) + "</p>" : '<p class="card-sub">Wettbewerbsbeitrag</p>') + "</a>";
      }).join("") + "</div></div>";
    var lb = lightbox(C.map(function (c) { return { src: src(c), th: src(c, true), cap: c.t.replace(/\s*\/\/\/\s*/g, " · ") }; }), "Wettbewerbe");
    $$('[href="#"][data-lb]', root).forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); lb.open(+a.dataset.lb); }); });
    observe(root);
  }

  /* ---------- lightbox ---------- */
  function lightbox(items, title, kind) {
    var box = el('<div class="lightbox" role="dialog" aria-modal="true" aria-label="Bildergalerie"><div class="lb-top"><span class="lb-cap"></span><button type="button" class="lb-close" aria-label="Schliessen">×</button></div>' +
      '<div class="lb-stage"><button type="button" class="nav-btn prev" aria-label="Vorheriges Bild"><span class="arr"></span></button><img alt=""><button type="button" class="nav-btn next" aria-label="Nächstes Bild"><span class="arr"></span></button></div>' +
      '<div class="lb-thumbs">' + items.map(function (it, i) { return '<button type="button" aria-label="Bild ' + (i + 1) + '"><img src="' + it.th + '" alt="" loading="lazy"></button>'; }).join("") + "</div></div>");
    if (kind) box.classList.add("lb-" + kind);
    document.body.appendChild(box);
    var im = $(".lb-stage img", box), cap = $(".lb-cap", box), th = $$(".lb-thumbs button", box), cur = 0, open = false, lastFocus;
    function show(i) {
      cur = (i + items.length) % items.length;
      im.style.opacity = 0;
      var pre = new Image(); pre.onload = pre.onerror = function () { im.src = items[cur].src; im.style.opacity = 1; }; pre.src = items[cur].src;
      cap.textContent = String(cur + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0") + "  ·  " + title + (items[cur].cap ? " – " + items[cur].cap : "");
      th.forEach(function (b, k) { b.classList.toggle("on", k === cur); });
      th[cur].scrollIntoView({ block: "nearest", inline: "center", behavior: reduced ? "auto" : "smooth" });
    }
    function o(i) { lastFocus = document.activeElement; open = true; box.classList.add("on"); document.body.style.overflow = "hidden"; show(i); $(".lb-close", box).focus(); }
    function c() { open = false; box.classList.remove("on"); document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
    $(".lb-close", box).addEventListener("click", c);
    $(".nav-btn.prev", box).addEventListener("click", function () { show(cur - 1); });
    $(".nav-btn.next", box).addEventListener("click", function () { show(cur + 1); });
    th.forEach(function (b, k) { b.addEventListener("click", function () { show(k); }); });
    $(".lb-stage", box).addEventListener("click", function (e) { if (e.target === e.currentTarget) c(); });
    document.addEventListener("keydown", function (e) {
      if (!open) return;
      if (e.key === "Escape") c(); if (e.key === "ArrowRight") show(cur + 1); if (e.key === "ArrowLeft") show(cur - 1);
      if (e.key === "Tab") { var f = $$("button", box); var a = f.indexOf(document.activeElement); if (e.shiftKey && a <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && a === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    });
    var sx = null;
    box.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (e) { if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); });
    return { open: o, isOpen: function () { return open; } };
  }

  /* ==========================================================================
     LEISTUNGEN: SIA-Phasen, Tabs, Akkordeon
     ========================================================================== */
  function initSIA() {
    var root = $("#sia"); if (!root) return;
    var P = [
      { c: "1.1", g: "Strategische Planung", t: "Strategische Planung", l: ["Zustandsanalyse (Grundstück, Gebäude, Schadstoffe, etc.)", "Bedürfnisformulierung und Lösungsstrategien"] },
      { c: "2.1", g: "Vorstudien", t: "Vorstudie", l: ["Definition des Vorhabens und Nachweis der Machbarkeit"] },
      { c: "3.1", g: "Projektierung", t: "Vorprojekt", l: ["Lösungsmöglichkeiten und Grobschätzung der Baukosten ±20%", "Vorprojekt und Kostenschätzung ±15%"], cost: 15, cost0: 20 },
      { c: "3.2", g: "Projektierung", t: "Bauprojekt", l: ["Detailstudien und Baubeschrieb mit Material- und Farbkonzept", "Bewilligungsfähiges Bauprojekt und Kostenvoranschlag ±10%"], cost: 10 },
      { c: "3.3", g: "Projektierung", t: "Bewilligungs­verfahren", l: ["Baugesuch und Baubewilligung"] },
      { c: "4.1", g: "Ausschreibung", t: "Ausschreibung", l: ["Pläne und Leistungsbeschriebe, Offertvergleich, Vergabe"] },
      { c: "5.1", g: "Realisierung", t: "Ausführungs­planung", l: ["Ausführungspläne, Werkverträge", "Ausführungsplanung"] },
      { c: "5.2", g: "Realisierung", t: "Ausführung", l: ["Gestalterische Leitung", "Bauleitung und Kostenkontrolle"] },
      { c: "5.3", g: "Realisierung", t: "Abschluss", l: ["Inbetriebnahme, Schlussabrechnung, Dokumentation", "Garantiearbeiten"] }
    ];
    var bar = $(".sia-bar", root), det = $(".sia-detail", root), cur = 0, auto = null;
    bar.innerHTML = P.map(function (p, i) { return '<button type="button" class="sia-step" role="tab" aria-selected="false" data-i="' + i + '"><span class="code">Phase ' + p.c + '</span><span class="t">' + p.t + "</span></button>"; }).join("");
    var steps = $$(".sia-step", bar);
    function show(i, user) {
      cur = (i + P.length) % P.length;
      if (user) stop();
      steps.forEach(function (s, k) { s.classList.toggle("on", k === cur); s.classList.toggle("done", k < cur); s.setAttribute("aria-selected", k === cur); });
      var p = P[cur], costIdx = -1;
      var lastCost = null; for (var k = 0; k <= cur; k++) if (P[k].cost) lastCost = P[k].cost;
      det.innerHTML = '<div class="big anim">' + p.c + '</div><div class="txt anim"><span class="eyebrow">' + p.g + "</span><h3 style=\"margin-top:14px\">" + p.t + '</h3><ul class="ticks">' + p.l.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" +
        '<div class="cost-meter"><div class="lbl"><span>Kostengenauigkeit</span><span>' + (lastCost ? "±" + lastCost + "%" : cur < 2 ? "noch offen" : "") + '</span></div><div class="track"><span class="mid"></span><span class="band"></span></div></div></div>';
      var band = $(".band", det), w = lastCost ? lastCost * 2 : 44;
      if (cur >= 5) w = Math.max(3, 10 * 2 - (cur - 4) * 5);
      requestAnimationFrame(function () { band.style.width = (cur < 2 ? 48 : 0) + "%"; band.style.transform = "translateX(-50%)"; requestAnimationFrame(function () { band.style.width = (cur < 2 ? 48 : w * 1.1) + "%"; }); });
      if (cur < 2) band.style.opacity = .35;
    }
    function stop() { clearInterval(auto); auto = null; var b = $(".sia-play", root); if (b) b.textContent = "Ablauf abspielen"; }
    steps.forEach(function (s) { s.addEventListener("click", function () { show(+s.dataset.i, true); }); s.addEventListener("mouseenter", function () { if (!auto) show(+s.dataset.i); }); });
    $(".sia-prev", root).addEventListener("click", function () { show(cur - 1, true); });
    $(".sia-next", root).addEventListener("click", function () { show(cur + 1, true); });
    var playBtn = $(".sia-play", root);
    if (playBtn) playBtn.addEventListener("click", function () {
      if (auto) return stop();
      this.textContent = "Pause"; show(0);
      auto = setInterval(function () { if (cur === P.length - 1) stop(); else show(cur + 1); }, 2600);
    });
    show(0);
  }

  function initTabs() {
    $$("[data-tabs]").forEach(function (t) {
      var btns = $$('[role="tab"]', t), panels = btns.map(function (b) { return document.getElementById(b.getAttribute("aria-controls")); });
      function sel(i) { btns.forEach(function (b, k) { b.setAttribute("aria-selected", k === i); b.tabIndex = k === i ? 0 : -1; panels[k].hidden = k !== i; }); }
      btns.forEach(function (b, i) {
        b.addEventListener("click", function () { sel(i); });
        b.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { var n = (i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length; sel(n); btns[n].focus(); } });
      });
      sel(0);
    });
  }

  function initAccordion() {
    $$(".acc").forEach(function (acc) {
      $$(".acc-btn", acc).forEach(function (b) {
        b.addEventListener("click", function () {
          var item = b.closest(".acc-item"), open = !item.classList.contains("open");
          if (acc.hasAttribute("data-single")) $$(".acc-item", acc).forEach(function (i) { i.classList.remove("open"); $(".acc-btn", i).setAttribute("aria-expanded", "false"); });
          item.classList.toggle("open", open); b.setAttribute("aria-expanded", open);
          if (open && item.id) history.replaceState(null, "", "#" + item.id);
        });
      });
      if (location.hash) { var t = acc.querySelector(location.hash + ".acc-item"); if (t) { $(".acc-btn", t).click(); setTimeout(function () { t.scrollIntoView({ block: "start" }); }, 50); } }
    });
  }

  /* ==========================================================================
     KONTAKT
     ========================================================================== */
  function initContact() {
    $$(".copy").forEach(function (c) {
      c.addEventListener("click", function (e) {
        var v = c.getAttribute("data-copy"); if (!v || !navigator.clipboard) return;
        if (e.metaKey || e.ctrlKey) return;
        if (window.matchMedia("(hover: hover)").matches) {
          e.preventDefault();
          navigator.clipboard.writeText(v).then(function () {
            var h = $(".hint", c), old = h.textContent; c.classList.add("ok"); h.textContent = "Kopiert";
            setTimeout(function () { c.classList.remove("ok"); h.textContent = old; }, 1600);
          });
        }
      });
    });
    var f = $("#contact-form");
    if (f) f.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(f), topic = d.get("anliegen") || "Anfrage";
      var body = (d.get("nachricht") || "") + "\n\n—\n" + (d.get("name") || "") + (d.get("telefon") ? "\nTel. " + d.get("telefon") : "") + (d.get("email") ? "\n" + d.get("email") : "");
      location.href = "mailto:info@apb-architekten.ch?subject=" + encodeURIComponent(topic + " – " + (d.get("name") || "Website")) + "&body=" + encodeURIComponent(body);
    });
    var cm = $("#contact-map");
    if (cm) withLeaflet(function () { var m = makeMap(cm, { center: OFFICE, zoom: 14 }); if (m) m.setView([OFFICE[0], OFFICE[1] - (innerWidth > 900 ? 0.0012 : 0)], 17); });
  }

  /* ---------- boot ---------- */
  if (page === "home") initHome();
  if (page === "projekte") initProjects();
  if (page === "projekt") initProject();
  initSIA(); initTabs(); initAccordion(); initContact(); initCounters();
  observe(document);
})();
