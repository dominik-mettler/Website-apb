/* ==========================================================================
   apb architekten ag – 3D-Ansicht (CesiumJS + swisstopo)
   Gelände: swissALTI3D mit Schattierung, Gebäude: swissBUILDINGS3D, Bäume: swissTLM3D Vegetation.
   Standard ist ein heller «Modellbau»-Look (ohne Luftbild): weisse Volumen, Sonnenschatten,
   feine Konturen, Projektgebäude in apb-Orange. Alternativ Luftbild oder amtliche Vermessung.
   Wird erst geladen, wenn jemand die 3D-Ansicht öffnet.
   ========================================================================== */
(function () {
  "use strict";
  var BASE = (window.APB_ROOT || "") + "assets/vendor/cesium/";
  var loading = null, viewer = null, box = null, tileset = null, trees = null, edges = null, layers = {}, entities = {}, onKey = null, focusFeat = null, modus = "modell";
  var CATCOL = { wohnen: "#e2b04a", lernen: "#5aa9d6", leiten: "#a796e0", glauben: "#d8d2c4", pflegen: "#6cc08b", reisen: "#e0708f", kaufen: "#e3925a", arbeiten: "#9bb8ab", turnen: "#5aa9d6", beleuchten: "#d8d2c4" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function img(p) { return (p.base || (window.APB_ROOT || "") + "assets/img/projects/" + p.id + "/") + "01-s.webp" + (p.fv ? "?v=" + p.fv : ""); }

  function load() {
    if (window.Cesium) return Promise.resolve();
    if (loading) return loading;
    window.CESIUM_BASE_URL = BASE;
    loading = new Promise(function (res, rej) {
      var css = document.createElement("link"); css.rel = "stylesheet"; css.href = BASE + "Widgets/widgets.css"; document.head.appendChild(css);
      var s = document.createElement("script"); s.src = BASE + "Cesium.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    return loading;
  }

  function wmts(layer, ext, maxLevel) {
    return new Cesium.UrlTemplateImageryProvider({ rectangle: Cesium.Rectangle.fromDegrees(5.8, 45.75, 10.6, 47.85),
      url: "https://wmts.geo.admin.ch/1.0.0/" + layer + "/default/current/3857/{z}/{x}/{y}." + ext,
      tilingScheme: new Cesium.WebMercatorTilingScheme(), maximumLevel: maxLevel || 19,
      credit: new Cesium.Credit("© swisstopo")
    });
  }

  function ui(title) {
    box = document.createElement("div");
    box.className = "m3d"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "3D-Ansicht");
    box.innerHTML = '<div class="m3d-top"><div class="m3d-title"><span class="eyebrow">3D-Ansicht · swisstopo</span><b>' + esc(title) + '</b></div>' +
      '<div class="m3d-ctrl"><div class="map-switch" role="group" aria-label="Kartengrundlage"><button type="button" data-l="modell" aria-pressed="true">Modell</button><button type="button" data-l="av" aria-pressed="false">Karte</button><button type="button" data-l="luft" aria-pressed="false">Luftbild</button></div>' +
      '<button type="button" class="m3d-b" data-b="1" aria-pressed="true">Bäume</button><button type="button" class="m3d-close" aria-label="3D-Ansicht schliessen">×</button></div></div>' +
      '<div class="m3d-stage"><div class="m3d-cesium"></div><div class="m3d-load"><span></span>3D-Daten werden geladen …</div><div class="m3d-card" hidden></div>' +
      '<p class="m3d-help">Ziehen: drehen · Rechte Maustaste oder Ctrl + Ziehen: neigen · Mausrad: zoomen</p></div>';
    document.body.appendChild(box);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(function () { box.classList.add("on"); });
    box.querySelector(".m3d-close").addEventListener("click", close);
    onKey = function (e) { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    box.querySelector(".m3d-close").focus();
  }

  function close() {
    if (!box) return;
    document.removeEventListener("keydown", onKey);
    var b = box; box = null;
    b.classList.remove("on");
    setTimeout(function () { if (viewer) { viewer.destroy(); viewer = null; tileset = null; trees = null; edges = null; focusFeat = null; entities = {}; } b.remove(); }, 350);
    document.body.style.overflow = "";
  }

  function card(p) {
    var c = box.querySelector(".m3d-card");
    if (!p) { c.hidden = true; return; }
    c.innerHTML = '<a href="' + (p.url || "projekt.html?p=" + encodeURIComponent(p.id)) + '"><img src="' + img(p) + '" alt=""><span><b>' + esc(p.name) + "</b><small>" + esc(p.ort) + (p.year ? " · " + p.year : "") + '</small><em>Zum Projekt →</em></span></a><button type="button" aria-label="Schliessen">×</button>';
    c.hidden = false;
    c.querySelector("button").onclick = function () { c.hidden = true; };
  }

  var terrainReady = null;
  function groundAt(lon, lat) {
    var c = Cesium.Cartographic.fromDegrees(lon, lat);
    return (terrainReady || Promise.reject()).then(function (t) {
      return Cesium.sampleTerrainMostDetailed(t, [c]).then(function (r) { return r[0].height || 500; });
    }).catch(function () { return 500; });
  }
  function fly(p, instant) {
    var lon = p.geo[1], lat = p.geo[0];
    groundAt(lon, lat).then(function (h) {
      if (!viewer) return;
      p._h = h;
      var bs = new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(lon, lat, h), 40);
      var off = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(-35), Cesium.Math.toRadians(-30), p.distanz || (p.geoExakt === false ? 1400 : 420));
      if (instant) { viewer.camera.flyToBoundingSphere(bs, { offset: off, duration: 0 }); }
      else viewer.camera.flyToBoundingSphere(bs, { offset: off, duration: 2.2 });
      viewer.scene.requestRender();
    });
  }

  function open(opts) {
    opts = opts || {};
    var list = opts.projects || (window.APB && window.APB.projects) || [];
    var focus = opts.focus || null;
    ui(opts.titel || (focus ? focus.name + ", " + focus.ort : "Projekte von apb architekten"));
    load().then(function () {
      if (!box) return;
      Cesium.Ion.defaultAccessToken = "";
      var cont = box.querySelector(".m3d-cesium");
      viewer = new Cesium.Viewer(cont, {
        baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, requestRenderMode: true, maximumRenderTimeChange: Infinity
      });
      var sc = viewer.scene;
      var PAPIER = Cesium.Color.fromCssColorString("#e4e1da");
      sc.globe.baseColor = PAPIER;
      sc.globe.depthTestAgainstTerrain = true;
      sc.globe.enableLighting = true;                 // Geländeschattierung aus der Sonne (Hügel lesbar ohne Luftbild)
      sc.globe.dynamicAtmosphereLighting = false;
      sc.globe.showGroundAtmosphere = false;
      sc.skyAtmosphere.show = true;
      sc.skyAtmosphere.brightnessShift = 0.25; sc.skyAtmosphere.saturationShift = -0.6;
      sc.fog.enabled = true; sc.fog.density = 1.6e-4;
      sc.highDynamicRange = false;
      sc.postProcessStages.fxaa.enabled = true;
      // Sonne: Spätsommer-Nachmittag, schöne lange Schatten aus Südwest
      viewer.clock.currentTime = Cesium.JulianDate.fromIso8601("2026-08-28T14:30:00Z");
      viewer.clock.shouldAnimate = false;
      sc.light = new Cesium.SunLight({ intensity: 2.0 });
      // Kartengrundlagen: im Modus «Modell» nur ein Hauch amtlicher Vermessung (Strassen, Parzellen) für die Orientierung
      layers.luft = viewer.imageryLayers.addImageryProvider(wmts("ch.swisstopo.swissimage-product", "jpeg", 20));
      layers.av = viewer.imageryLayers.addImageryProvider(wmts("ch.kantone.cadastralwebmap-farbe", "png", 20));
      layers.luft.show = false;
      // Projektgebäude in apb-Orange. Grundriss aus der amtlichen Vermessung (tools/projekt_volumen.py).
      // Bestehende Gebäude im swisstopo-Modell werden eingefärbt; Neubauten (fehlen im Modell, Stand 2013/14) als Volumen ergänzt.
      var fokusBox = null, ersetzt = false;
      // Bestand ausblenden (z. B. Gebäude auf einer untersuchten Parzelle): [lonMin, lonMax, latMin, latMax]
      var ausblend = opts.ausblenden ? "(${Longitude} > " + opts.ausblenden[0] + " && ${Longitude} < " + opts.ausblenden[1] + " && ${Latitude} > " + opts.ausblenden[2] + " && ${Latitude} < " + opts.ausblenden[3] + ")" : null;
      if (focus && focus.vol && focus.vol.length) {
        var teile = [];
        focus.vol.forEach(function (v) {
          var xs = v[0].map(function (q) { return q[0]; }), ys = v[0].map(function (q) { return q[1]; });
          var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
          teile.push("(${Longitude} > " + x0 + " && ${Longitude} < " + x1 + " && ${Latitude} > " + y0 + " && ${Latitude} < " + y1 + ")");
          if ((v[2] || 0) >= 2013 && !focus.umg) {
            ersetzt = true;
            viewer.entities.add({ polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray([].concat.apply([], v[0])),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, extrudedHeight: v[1], extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              material: Cesium.Color.fromCssColorString("#f15d30"), outline: false } });
          }
        });
        fokusBox = teile.join(" || ");
      }
      // Lücke im swisstopo-Gebäudemodell: Ersatzumgebung aus amtlicher Vermessung + GWR (tools/umgebung_luecke.py)
      if (focus && focus.umg) {
        var boxen = (focus.vol || []).map(function (v) {
          var xs = v[0].map(function (q) { return q[0]; }), ys = v[0].map(function (q) { return q[1]; });
          return [Math.min.apply(null, xs), Math.max.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, ys)];
        });
        fetch((window.APB_ROOT || "") + focus.umg).then(function (r) { return r.json(); }).then(function (geb) {
          if (!viewer) return;
          var weiss = Cesium.Color.fromCssColorString("#f7f4ee"), orange = Cesium.Color.fromCssColorString("#f15d30");
          geb.forEach(function (g) {
            var cx = 0, cy = 0; g[0].forEach(function (q) { cx += q[0]; cy += q[1]; }); cx /= g[0].length; cy /= g[0].length;
            var istProjekt = boxen.some(function (b) { return cx > b[0] && cx < b[1] && cy > b[2] && cy < b[3]; });
            viewer.entities.add({ polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray([].concat.apply([], g[0])),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, extrudedHeight: g[1], extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              material: istProjekt ? orange : weiss, outline: false } });
          });
          sc.requestRender();
        }).catch(function () {});
      }
      function grundlage(m) {
        modus = m;
        layers.luft.show = m === "luft";
        layers.av.show = m !== "luft";
        layers.av.saturation = 0;
        layers.av.alpha = m === "modell" ? 0.32 : 1;
        layers.av.contrast = m === "modell" ? 0.9 : 1.25;
        layers.av.brightness = m === "modell" ? 1.25 : 1;
        sc.globe.enableLighting = m !== "luft";
        if (tileset) tileset.style = gebStil();
        sc.requestRender();
      }
      function gebStil() {
        var basis = modus === "luft" ? "color('#f3f1ec', 0.95)" : "color('#f7f4ee', 1.0)";
        var st = { show: "true", color: { conditions: [] } };
        if (fokusBox) {
          st.color.conditions.push([fokusBox, "color('#f15d30', 1.0)"]);
          if (ersetzt) st.show = "!(" + fokusBox + ")";
        }
        if (ausblend) st.show = st.show === "true" ? "!" + ausblend : "(" + st.show + ") && !" + ausblend;
        st.color.conditions.push(["true", basis]);
        return new Cesium.Cesium3DTileStyle(st);
      }
      terrainReady = Cesium.CesiumTerrainProvider.fromUrl("https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/", { requestVertexNormals: true });
      terrainReady.then(function (t) { if (viewer) { viewer.terrainProvider = t; sc.requestRender(); } }).catch(function () {});
      Cesium.Cesium3DTileset.fromUrl("https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json", { maximumScreenSpaceError: 4, shadows: Cesium.ShadowMode.DISABLED }).then(function (ts) {
        if (!viewer) return;
        tileset = ts; sc.primitives.add(ts);
        ts.colorBlendMode = Cesium.Cesium3DTileColorBlendMode.REPLACE;
        ts.style = gebStil();
        ts.initialTilesLoaded.addEventListener(function () { var l = box && box.querySelector(".m3d-load"); if (l) l.classList.add("done"); markiere(); });
        ts.allTilesLoaded.addEventListener(markiere);
        sc.requestRender();
      }).catch(function () { var l = box && box.querySelector(".m3d-load"); if (l) l.innerHTML = "3D-Gebäude konnten nicht geladen werden."; });
      // Bäume (swissTLM3D Vegetation): als ruhige, grüngraue Kugeln/Kegel
      Cesium.Cesium3DTileset.fromUrl("https://3d.geo.admin.ch/ch.swisstopo.vegetation.3d/v1/tileset.json", { maximumScreenSpaceError: 8, shadows: Cesium.ShadowMode.DISABLED }).then(function (ts) {
        if (!viewer) return;
        trees = ts; sc.primitives.add(ts);
        ts.colorBlendMode = Cesium.Cesium3DTileColorBlendMode.MIX; ts.colorBlendAmount = 0.75;
        ts.style = new Cesium.Cesium3DTileStyle({ color: "color('#a9bb98', 1.0)" });
        sc.requestRender();
      }).catch(function () { var bb = box && box.querySelector(".m3d-b"); if (bb) bb.hidden = true; });
      setTimeout(function () { var l = box && box.querySelector(".m3d-load"); if (l) l.classList.add("done"); }, 9000);
      function markiere() {}

      list.forEach(function (p) {
        var col = Cesium.Color.fromCssColorString(CATCOL[p.cats[0]] || "#edebe6");
        var isF = focus && p.id === focus.id;
        entities[p.id] = viewer.entities.add({
          id: "p-" + p.id, position: Cesium.Cartesian3.fromDegrees(p.geo[1], p.geo[0]),
          point: { pixelSize: isF ? 18 : 12, color: isF ? Cesium.Color.fromCssColorString("#f15d30") : col, outlineColor: Cesium.Color.fromCssColorString("#0c0c0b"), outlineWidth: 2,
                   heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: p.name, font: "500 14px Inter, Helvetica, Arial, sans-serif", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
                   style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, isF && p.vol ? -70 : -22), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                   disableDepthTestDistance: Number.POSITIVE_INFINITY, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, isF ? 1e5 : 4500) }
        });
        entities[p.id].apb = p;
      });
      entities.atelier = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(8.695723, 47.348162),
        point: { pixelSize: 14, color: Cesium.Color.fromCssColorString("#f15d30"), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        label: { text: "Atelier apb", font: "600 13px Inter, Helvetica, Arial, sans-serif", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                 pixelOffset: new Cesium.Cartesian2(0, -22), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 6000) }
      });

      var h = new Cesium.ScreenSpaceEventHandler(sc.canvas);
      h.setInputAction(function (ev) {
        var pk = sc.pick(ev.position);
        var ent = pk && pk.id && pk.id.apb ? pk.id : null;
        card(ent ? ent.apb : null);
        if (ent) fly(ent.apb);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      $$q(box, ".map-switch button").forEach(function (b) {
        b.addEventListener("click", function () {
          grundlage(b.dataset.l);
          $$q(box, ".map-switch button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
          sc.requestRender();
        });
      });
      var bb = box.querySelector(".m3d-b");
      bb.addEventListener("click", function () { if (!trees) return; trees.show = !trees.show; bb.setAttribute("aria-pressed", trees.show); sc.requestRender(); });
      grundlage("modell");

      if (opts.zeichne) { try { opts.zeichne(viewer, Cesium, groundAt); } catch (e) { if (window.console) console.error(e); } }
      if (opts.ort) { fly({ geo: [opts.ort.lat, opts.ort.lon], geoExakt: true, distanz: opts.ort.distanz }, true); }
      else if (focus) { fly(focus, true); card(focus); }
      else {
        var c = opts.center || [47.30, 8.69], z = opts.zoom || 10;
        var alt = Math.max(600, Math.min(30000, 22000000 / Math.pow(2, z)));
        viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(c[1], c[0] - alt * 0.75 / 111000, alt), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 } });
      }
      sc.requestRender();
    }).catch(function () {
      if (box) box.querySelector(".m3d-load").innerHTML = "Die 3D-Ansicht konnte nicht geladen werden. Ihr Browser unterstützt möglicherweise kein WebGL.";
    });
  }
  function $$q(r, s) { return Array.prototype.slice.call(r.querySelectorAll(s)); }

  window.APB3D = { open: open, close: close, _v: function () { return viewer; } };
})();
