/* ==========================================================================
   apb architekten ag – 3D-Ansicht (CesiumJS + swisstopo)
   Gelände: swissALTI3D (3d.geo.admin.ch), Gebäude: swissBUILDINGS3D,
   Bilder: SWISSIMAGE oder amtliche Vermessung (Cadastral Web Map, S/W).
   Wird erst geladen, wenn jemand die 3D-Ansicht öffnet.
   ========================================================================== */
(function () {
  "use strict";
  var BASE = "assets/vendor/cesium/";
  var loading = null, viewer = null, box = null, tileset = null, layers = {}, entities = {}, onKey = null;
  var CATCOL = { wohnen: "#e2b04a", lernen: "#5aa9d6", leiten: "#a796e0", glauben: "#d8d2c4", pflegen: "#6cc08b", reisen: "#e0708f", kaufen: "#e3925a", arbeiten: "#9bb8ab", turnen: "#5aa9d6", beleuchten: "#d8d2c4" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function img(p) { return (p.base || "assets/img/projects/" + p.id + "/") + "01-s.webp"; }

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
      '<div class="m3d-ctrl"><div class="map-switch" role="group" aria-label="Kartengrundlage"><button type="button" data-l="luft" aria-pressed="true">Luftbild</button><button type="button" data-l="av" aria-pressed="false">Vermessung</button></div>' +
      '<button type="button" class="m3d-b" data-b="1" aria-pressed="true">Gebäude</button><button type="button" class="m3d-close" aria-label="3D-Ansicht schliessen">×</button></div></div>' +
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
    setTimeout(function () { if (viewer) { viewer.destroy(); viewer = null; tileset = null; entities = {}; } b.remove(); }, 350);
    document.body.style.overflow = "";
  }

  function card(p) {
    var c = box.querySelector(".m3d-card");
    if (!p) { c.hidden = true; return; }
    c.innerHTML = '<a href="projekt.html?p=' + encodeURIComponent(p.id) + '"><img src="' + img(p) + '" alt=""><span><b>' + esc(p.name) + "</b><small>" + esc(p.ort) + (p.year ? " · " + p.year : "") + '</small><em>Zum Projekt →</em></span></a><button type="button" aria-label="Schliessen">×</button>';
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
      var bs = new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(lon, lat, h), 40);
      var off = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(-20), Cesium.Math.toRadians(-34), p.geoExakt === false ? 1400 : 520);
      if (instant) { viewer.camera.flyToBoundingSphere(bs, { offset: off, duration: 0 }); }
      else viewer.camera.flyToBoundingSphere(bs, { offset: off, duration: 2.2 });
      viewer.scene.requestRender();
    });
  }

  function open(opts) {
    opts = opts || {};
    var list = opts.projects || (window.APB && window.APB.projects) || [];
    var focus = opts.focus || null;
    ui(focus ? focus.name + ", " + focus.ort : "Projekte von apb architekten");
    load().then(function () {
      if (!box) return;
      Cesium.Ion.defaultAccessToken = "";
      var cont = box.querySelector(".m3d-cesium");
      viewer = new Cesium.Viewer(cont, {
        baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, requestRenderMode: true, maximumRenderTimeChange: Infinity
      });
      var sc = viewer.scene;
      sc.globe.baseColor = Cesium.Color.fromCssColorString("#1d1d1b");
      sc.globe.depthTestAgainstTerrain = true;
      sc.skyAtmosphere.show = true;
      sc.fog.enabled = true;
      layers.luft = viewer.imageryLayers.addImageryProvider(wmts("ch.swisstopo.swissimage-product", "jpeg", 20));
      layers.av = viewer.imageryLayers.addImageryProvider(wmts("ch.kantone.cadastralwebmap-farbe", "png", 20));
      layers.av.show = false; layers.av.saturation = 0; layers.av.contrast = 1.25;
      terrainReady = Cesium.CesiumTerrainProvider.fromUrl("https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/");
      terrainReady.then(function (t) { if (viewer) { viewer.terrainProvider = t; sc.requestRender(); } }).catch(function () {});
      Cesium.Cesium3DTileset.fromUrl("https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json", { maximumScreenSpaceError: 6 }).then(function (ts) {
        if (!viewer) return;
        tileset = ts; sc.primitives.add(ts);
        ts.colorBlendMode = Cesium.Cesium3DTileColorBlendMode.REPLACE;
        ts.style = new Cesium.Cesium3DTileStyle({ color: "color('#ecebe7', 1.0)" });
        ts.initialTilesLoaded.addEventListener(function () { var l = box && box.querySelector(".m3d-load"); if (l) l.classList.add("done"); });
        sc.requestRender();
      }).catch(function () { var l = box && box.querySelector(".m3d-load"); if (l) l.innerHTML = "3D-Gebäude konnten nicht geladen werden."; });
      setTimeout(function () { var l = box && box.querySelector(".m3d-load"); if (l) l.classList.add("done"); }, 9000);

      list.forEach(function (p) {
        var col = Cesium.Color.fromCssColorString(CATCOL[p.cats[0]] || "#edebe6");
        var isF = focus && p.id === focus.id;
        entities[p.id] = viewer.entities.add({
          id: "p-" + p.id, position: Cesium.Cartesian3.fromDegrees(p.geo[1], p.geo[0]),
          point: { pixelSize: isF ? 18 : 12, color: isF ? Cesium.Color.fromCssColorString("#f15d30") : col, outlineColor: Cesium.Color.fromCssColorString("#0c0c0b"), outlineWidth: 2,
                   heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: { text: p.name, font: "500 14px Inter, Helvetica, Arial, sans-serif", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
                   style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -22), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
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
          var av = b.dataset.l === "av";
          layers.av.show = av; layers.luft.show = !av;
          $$q(box, ".map-switch button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
          sc.requestRender();
        });
      });
      var bb = box.querySelector(".m3d-b");
      bb.addEventListener("click", function () { if (!tileset) return; tileset.show = !tileset.show; bb.setAttribute("aria-pressed", tileset.show); sc.requestRender(); });

      if (focus) { fly(focus, true); card(focus); }
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
