/* ==========================================================================
   apb architekten ag – Potenzial (Etappe 1)
   Parzelle suchen -> amtliche Vermessung (geo.admin) -> ÖREB-Auszug Kanton Zürich (maps.zh.ch)
   -> Zonenwerte aus assets/data/bzo.json -> Kennwerte, Ampel, Baufeld (in 3D)
   Ersteinschätzung, ersetzt keine Vorabklärung beim Bauamt.
   ========================================================================== */
(function () {
  "use strict";
  var ROOT = window.APB_ROOT || "";
  var EN = (document.documentElement.lang || "").indexOf("en") === 0;
  var root = document.querySelector("[data-pz-tool]");
  if (!root) return;
  var BZO = null, aktuell = null, standard = "mittel";
  var NWF = { einfach: { "2.5": 50, "3.5": 70, "4.5": 90, "5.5": 110 }, mittel: { "2.5": 60, "3.5": 82, "4.5": 105, "5.5": 125 }, gehoben: { "2.5": 75, "3.5": 100, "4.5": 130, "5.5": 155 } };
  var MIX = { "2.5": 0.30, "3.5": 0.40, "4.5": 0.25, "5.5": 0.05 };
  var GH = 3.0;                       // Geschosshöhe [m] (Annahme)
  var EFF = 0.78;                     // Hauptnutzfläche / Geschossfläche (Annahme, Spänner)

  function t(de, en) { return EN && en ? en : de; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function txt(x) { return Array.isArray(x) ? (x[0] && x[0].Text) || "" : (x && x.Text) || x || ""; }
  function zahl(n, d) { return Number(n).toLocaleString("de-CH", { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }).replace(/,/g, "’"); }
  function norm(s) { return String(s || "").toLowerCase().replace(/\s*\(zh\)|\s+zh$/g, "").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/[^a-z0-9]/g, ""); }
  function el(h) { var d = document.createElement("div"); d.innerHTML = h; return d.firstElementChild; }
  function json(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  // LV95 -> WGS84 (Näherungsformel swisstopo, ~1 m)
  function wgs(E, N) {
    var y = (E - 2600000) / 1e6, x = (N - 1200000) / 1e6;
    var lo = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
    var la = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
    return [lo * 100 / 36, la * 100 / 36];
  }

  /* ---------- Geometrie (LV95, Meter) ---------- */
  function flaeche(r) { var a = 0; for (var i = 0; i < r.length; i++) { var p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function vereinfachen(r) {
    var o = r.slice(); if (o.length > 1 && o[0][0] === o[o.length - 1][0] && o[0][1] === o[o.length - 1][1]) o.pop();
    var geaendert = true;
    while (geaendert && o.length > 3) {
      geaendert = false;
      for (var i = 0; i < o.length; i++) {
        var a = o[(i - 1 + o.length) % o.length], b = o[i], c = o[(i + 1) % o.length];
        var ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
        var kreuz = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / Math.max(Math.hypot(c[0] - a[0], c[1] - a[1]), 1e-9);
        if (ab < 0.8 || bc < 0.01 || kreuz < 0.35) { o.splice(i, 1); geaendert = true; break; }
      }
    }
    if (flaeche(o) < 0) o.reverse();          // gegen den Uhrzeigersinn
    return o;
  }
  function innen(r, x, y) { var c = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; }
  // Baufeld: jede Kante um ihren Abstand nach innen versetzen (grosser Abstand vor südorientierten Kanten)
  function baufeld(r, ga_k, ga_g) {
    var n = r.length, linien = [];
    for (var i = 0; i < n; i++) {
      var p = r[i], q = r[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
      var nx = dy / L, ny = -dx / L;                       // Normale nach aussen (Ring im Gegenuhrzeigersinn)
      var d = (ga_g && ny < -Math.SQRT1_2) ? ga_g : ga_k;   // Aussenseite schaut nach Süden
      linien.push({ p: [p[0] - nx * d, p[1] - ny * d], v: [dx, dy], d: d });
    }
    var out = [];
    for (var k = 0; k < n; k++) {
      var A = linien[(k - 1 + n) % n], B = linien[k];
      var den = A.v[0] * B.v[1] - A.v[1] * B.v[0];
      if (Math.abs(den) < 1e-9) { out.push(B.p); continue; }
      var s = ((B.p[0] - A.p[0]) * B.v[1] - (B.p[1] - A.p[1]) * B.v[0]) / den;
      out.push([A.p[0] + A.v[0] * s, A.p[1] + A.v[1] * s]);
    }
    var ok = out.length >= 3 && flaeche(out) > 4 && out.every(function (pt) { return innen(r, pt[0], pt[1]); });
    return ok ? out : null;
  }

  /* ---------- Daten ---------- */
  function suche(q) {
    var u = "https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&origins=address,parcel&sr=4326&limit=8&searchText=" + encodeURIComponent(q);
    return json(u).then(function (r) { return (r.results || []).map(function (x) { return { label: x.attrs.label.replace(/<[^>]+>/g, ""), lat: x.attrs.lat, lon: x.attrs.lon, art: x.attrs.origin }; }); });
  }
  function parzelleAn(lat, lon) {
    var g = lon + "," + lat, ext = (lon - .001) + "," + (lat - .001) + "," + (lon + .001) + "," + (lat + .001);
    var u = "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&layers=all:ch.swisstopo-vd.amtliche-vermessung&tolerance=0&sr=4326&returnGeometry=false&imageDisplay=100,100,96&geometry=" + g + "&mapExtent=" + ext;
    return json(u).then(function (r) { var x = (r.results || [])[0]; if (!x) throw new Error("keine Parzelle"); return x.attributes || x.properties; });
  }
  function oereb(egrid) { return json("https://maps.zh.ch/oereb/v2/extract/json?GEOMETRY=true&EGRID=" + encodeURIComponent(egrid)).then(function (r) { return r.GetExtractByIdResponse.Extract; }); }
  function bzo() { return BZO ? Promise.resolve(BZO) : json(ROOT + "assets/data/bzo.json").then(function (d) { BZO = d; return d; }); }

  /* ---------- Auswertung ---------- */
  var AMPEL = [
    [/Belastete|Gewaesserraum|Gewaesserabstand|Wald|Planungszone|Projektierungszone|Sicherheitszone/i, "rot"],
    [/Grundwasser|Baulinie|AenderungMitVorwirkung|Ueberlagernd/i, "gelb"],
  ];
  function ampelFarbe(code, sub, legende) {
    if (/Laermempfindlich/i.test(code)) return /IV/.test(legende) ? "rot" : /III/.test(legende) ? "gelb" : "gruen";
    if (/Arealüberbauung zulässig/i.test(legende)) return "gruen";
    for (var i = 0; i < AMPEL.length; i++) if (AMPEL[i][0].test(code + " " + (sub || ""))) return AMPEL[i][1];
    return "info";
  }
  function auswerten(ex, b) {
    var re = ex.RealEstate, beschr = re.RestrictionOnLandownership || [];
    var gem = null;
    Object.keys(b).forEach(function (k) { if (norm(b[k].name) === norm(re.MunicipalityName)) gem = b[k]; });
    var zoneTxt = "", zone = null, zoneKey = "";
    beschr.forEach(function (r) {
      if (/Grundnutzung/.test(r.Theme.SubCode || "") && r.Theme.code === "ch.Nutzungsplanung" && !zoneTxt) zoneTxt = txt(r.LegendText);
    });
    var m = zoneTxt.match(/\(([^)]+)\)\s*$/), kurz = m ? m[1] : zoneTxt;
    if (gem) Object.keys(gem.zonen).forEach(function (k) { if (norm(k) === norm(kurz)) { zone = gem.zonen[k]; zoneKey = k; } });
    if (gem && !zone) Object.keys(gem.zonen).forEach(function (k) { if (!zone && norm(k) === norm(kurz).replace(/g$/, "")) { zone = gem.zonen[k]; zoneKey = k; } });
    var eintraege = beschr.map(function (r) {
      var leg = txt(r.LegendText);
      return { thema: txt(r.Theme.Text), code: r.Theme.code || r.Theme.Code || "", sub: r.Theme.SubCode || "", legende: leg, farbe: ampelFarbe(r.Theme.code || "", r.Theme.SubCode, leg),
               anteil: r.PartInPercent, laenge: r.LengthShare, geo: r.Geometry, docs: (r.LegalProvisions || []).map(function (d) { return { t: txt(d.Title), u: txt(d.TextAtWeb) }; }) };
    });
    // Doppelte (gleiche Legende) zusammenfassen
    var seen = {}; eintraege = eintraege.filter(function (e) { var k = e.code + e.legende; if (seen[k]) return false; seen[k] = 1; return true; });
    var grenze = ((re.Limit || re.limit || {}).coordinates || [])[0] || [];
    if (re.limit && re.limit.type === "MultiPolygon") grenze = re.limit.coordinates[0][0];
    return { re: re, gem: gem, zone: zone, zoneKey: zoneKey, zoneTxt: zoneTxt, eintraege: eintraege, grenze: grenze, nicht: (ex.NotConcernedTheme || []).length, pdf: "https://maps.zh.ch/oereb/v2/extract/pdf?EGRID=" + re.EGRID };
  }
  function kennwerte(a) {
    var A = a.re.LandRegistryArea, z = a.zone || {}, k = { A: A };
    k.hoehe = z.fh || z.gh || (z.vg ? z.vg * GH : null);
    k.geschosse = z.vg || (k.hoehe ? Math.max(1, Math.floor(k.hoehe / GH)) : null);
    if (z.az) { k.gf = z.az * A; k.dichte = "AZ " + Math.round(z.az * 100) + " %"; }
    else if (z.bmz) { k.bm = z.bmz * A; k.gf = k.bm / GH; k.dichte = "BMZ " + z.bmz + " m³/m²"; }
    else if (z.uez && k.geschosse) { k.gf = z.uez * A * k.geschosse; k.dichte = "ÜZ " + Math.round(z.uez * 100) + " %"; }
    if (k.gf) {
      k.hnf = k.gf * EFF;
      var nwf = NWF[standard], schnitt = 0; Object.keys(MIX).forEach(function (t) { schnitt += MIX[t] * nwf[t]; });
      k.whg = Math.max(1, Math.floor(k.hnf / schnitt)); k.schnitt = schnitt;
      if (k.geschosse) k.fuss = k.gf / k.geschosse;
    }
    var ring = a.grenze.length ? vereinfachen(a.grenze) : null;
    k.ring = ring;
    if (ring && (z.ga_k || z.ga_g)) {
      k.bf = baufeld(ring, z.ga_k || z.ga_g, z.ga_g || null);
      if (k.bf) k.bfA = flaeche(k.bf);
    }
    return k;
  }

  /* ---------- Darstellung ---------- */
  function zeile(l, v, q) { return v == null || v === "" ? "" : '<div class="pz-kv"><span>' + esc(l) + "</span><b>" + v + "</b>" + (q ? "<small>" + q + "</small>" : "") + "</div>"; }
  function render(a, k) {
    var z = a.zone, g = a.gem, re = a.re;
    var res = root.querySelector(".pz-res");
    var kopf = '<div class="pz-kopf"><div><span class="eyebrow">' + t("Parzelle", "Plot") + " " + esc(re.Number) + " · " + esc(re.MunicipalityName) + '</span><h3>' + esc(a.zoneTxt || t("Zone unbekannt", "Zone unknown")) + "</h3>" +
      '<p class="muted small">EGRID ' + esc(re.EGRID) + " · " + zahl(re.LandRegistryArea) + ' m² · <a href="' + a.pdf + '" target="_blank" rel="noopener">' + t("ÖREB-Auszug (PDF)", "PLR extract (PDF)") + " ↗</a></p></div>" +
      "</div>";
    var werte = "";
    if (z) {
      werte += zeile(t("Dichte", "Density"), esc(k.dichte), g.artikel ? esc(g.name + ", BZO " + g.artikel) : "");
      werte += zeile(t("Geschosse", "Storeys"), z.vg ? z.vg + " VG" + (z.dg != null ? " + " + z.dg + " DG" : "") + (z.attika ? " / Attika" : "") : (t("frei im Rahmen der Höhen", "free within height limits")));
      werte += zeile(t("Fassadenhöhe", "Facade height"), z.fh ? zahl(z.fh, 1) + " m" + (z.fh_giebel ? " · " + t("giebelseitig", "gable") + " " + zahl(z.fh_giebel, 1) + " m" : "") : (z.gh ? t("Gebäudehöhe ", "Building height ") + zahl(z.gh, 1) + " m" : ""));
      werte += zeile(t("Gebäudelänge", "Building length"), z.laenge ? "max. " + z.laenge + " m" : "");
      werte += zeile(t("Grenzabstand", "Boundary distance"), (z.ga_k ? (z.ga_g ? t("klein ", "small ") : t("Grundabstand ", "basic ")) + zahl(z.ga_k, 1) + " m" + (z.ga_max ? " (max. " + zahl(z.ga_max, 1) + " m)" : "") : "") + (z.ga_g ? " · " + t("gross ", "large ") + zahl(z.ga_g, 1) + " m" : ""), g.grosser_abstand ? esc(g.grosser_abstand) : "");
      werte += zeile(t("Grünflächenziffer", "Green space ratio"), z.gfz_gruen ? "min. " + Math.round(z.gfz_gruen * 100) + " %" : "");
      werte += '<div class="pz-sep"></div>';
      werte += zeile(t("Geschossfläche max.", "Max. floor area"), k.gf ? "ca. " + zahl(k.gf) + " m²" : "", k.bm ? t("Baumasse ", "Building volume ") + zahl(k.bm) + " m³ ÷ " + GH + " m" : "");
      werte += zeile(t("Baufeld", "Building envelope"), k.bfA ? "ca. " + zahl(k.bfA) + " m²" : t("nicht berechenbar", "not computable"), k.fuss && k.bfA ? (k.fuss <= k.bfA ? t("Fussabdruck ", "Footprint ") + zahl(k.fuss) + " m² " + t("passt", "fits") : t("Fussabdruck ", "Footprint ") + zahl(k.fuss) + " m² > " + t("Baufeld – Höhe/Länge begrenzt", "envelope – limited by height/length")) : "");
      werte += zeile(t("Wohnungen", "Apartments"), k.whg ? "ca. " + k.whg : "", k.whg ? t("Ø ", "avg ") + zahl(k.schnitt) + " m² NWF · " + t("Ausbaustandard ", "standard ") + standard + " · HNF ≈ " + Math.round(EFF * 100) + " % GF" : "");
      if (z.az_bonus && g.gewerbe_bonus) werte += '<p class="pz-hint">' + esc(g.gewerbe_bonus) + "</p>";
      if (g.areal) werte += '<p class="pz-hint">' + t("Arealüberbauung: ", "Special development: ") + esc(g.areal) + "</p>";
      if (/ENTWURF|OFFEN/.test(g.stand)) werte += '<p class="pz-hint warn">' + esc(g.stand) + "</p>";
      werte += '<p class="muted small">' + t("Quelle: ", "Source: ") + '<a href="' + esc(g.quelle) + '" target="_blank" rel="noopener">BZO ' + esc(g.name) + "</a> · " + esc(g.stand) + "</p>";
    } else {
      werte = '<p class="pz-hint warn">' + (a.gem ? t("Diese Zone ist noch nicht in unserer Tabelle (nur Wohnzonen erfasst). ", "This zone is not yet in our table (residential zones only). ")
        : t("Diese Gemeinde ist noch nicht in unserer Tabelle. Erfasst: Uster, Gossau, Volketswil, Greifensee, Schwerzenbach, Fällanden, Mönchaltorf, Egg, Maur, Wetzikon, Grüningen, Pfäffikon.", "This municipality is not yet in our table.")) +
        t(" Der ÖREB-Auszug rechts gilt trotzdem.", " The PLR extract still applies.") + "</p>";
    }
    var amp = a.eintraege.map(function (e) {
      var d = e.docs.filter(function (x) { return x.u; }).slice(0, 2).map(function (x) { return '<a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.t || "Dokument") + " ↗</a>"; }).join(" · ");
      return '<li class="a-' + e.farbe + '"><i aria-hidden="true"></i><div><b>' + esc(e.legende) + "</b><small>" + esc(e.thema) + (e.anteil && e.anteil < 100 ? " · " + e.anteil + " %" : "") + (e.laenge ? " · " + e.laenge + " m" : "") + "</small>" + (d ? "<small>" + d + "</small>" : "") + "</div></li>";
    }).join("");
    res.innerHTML = kopf + '<div class="pz-grid"><div class="pz-werte"><h4>' + t("1 · Baurecht &amp; Kennwerte", "1 · Zoning &amp; key figures") + "</h4>" + werte + "</div>" +
      '<div class="pz-ampel"><h4>' + t("ÖREB-Kataster", "PLR cadastre") + "</h4><ul>" + amp + "</ul><p class=\"muted small\">" + a.nicht + t(" weitere Themen nicht betroffen (z. B. Gewässerraum, Wald, belastete Standorte).", " further topics not affected.") + "</p></div></div>" +
      '<p class="pz-disc">' + t("Ersteinschätzung auf Basis öffentlicher Daten – ersetzt keine Vorabklärung beim Bauamt. Baufeld vereinfacht: Grenzabstände ohne Mehrlängenzuschlag und Baulinien, grosser Abstand vor südorientierten Grenzen.", "Initial assessment based on public data – no substitute for a preliminary enquiry with the building authority.") + "</p>";
    res.hidden = false;
    zeichneParzelle(a, k);
    letzte = null;
    renderVolumen(a, k);
  }

  /* ---------- 3D (eingebettet, ganze Fläche rechts) ---------- */
  var V3 = null, C3 = null, ds = null, karteBereit = null, bodenH = 450, letzte = null;
  function karte() {
    if (karteBereit) return karteBereit;
    var host = document.querySelector("[data-pz-karte]");
    karteBereit = new Promise(function (res) {
      function los() {
        window.APB3D.open({ container: host, ohneProjekte: true, center: [47.338, 8.72], zoom: 13,
          onKlick: function (lat, lon) { waehle({ lat: lat, lon: lon, label: t("Punkt in der Karte", "Point on map") }); } });
        (function warte() { var v = window.APB3D._v(); if (v) { V3 = v; C3 = window.Cesium; ds = new C3.CustomDataSource("pz"); V3.dataSources.add(ds); res(); } else setTimeout(warte, 150); })();
      }
      if (window.APB3D) return los();
      var s = document.createElement("script"); s.src = window.APB_3D || ROOT + "assets/js/map3d.js"; s.onload = los; document.head.appendChild(s);
    });
    return karteBereit;
  }
  function llArr(r, h) { var o = []; r.forEach(function (p) { var w = wgs(p[0], p[1]); o.push(w[0], w[1]); if (h != null) o.push(h); }); return o; }
  function zeichneParzelle(a, k) {
    karte().then(function () {
      ds.entities.removeAll();
      var C = C3, weiss = C.Color.WHITE, orange = C.Color.fromCssColorString("#f15d30");
      if (!k.ring) return;
      var c = k.ring.reduce(function (s, p) { return [s[0] + p[0] / k.ring.length, s[1] + p[1] / k.ring.length]; }, [0, 0]), cw = wgs(c[0], c[1]);
      var g = llArr(k.ring); g.push(g[0], g[1]);
      ds.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(g), width: 3, material: weiss, clampToGround: true } });
      if (k.bf) {
        var b = llArr(k.bf); b.push(b[0], b[1]);
        ds.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(b), width: 2, material: new C.PolylineDashMaterialProperty({ color: orange, dashLength: 10 }), clampToGround: true } });
      }
      a.eintraege.forEach(function (e) {
        if (!/Baulinie/i.test(e.code + e.legende) || !e.geo) return;
        e.geo.forEach(function (gg) { var l = gg.Line || gg.line; if (!l || !l.coordinates) return;
          ds.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(llArr(l.coordinates)), width: 2, material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString("#e5484d") }), clampToGround: true } }); });
      });
      var bb = (k.bf || k.ring).map(function (p) { return wgs(p[0], p[1]); });
      window.APB3D.ausblenden([Math.min.apply(null, bb.map(function (q) { return q[0]; })), Math.max.apply(null, bb.map(function (q) { return q[0]; })), Math.min.apply(null, bb.map(function (q) { return q[1]; })), Math.max.apply(null, bb.map(function (q) { return q[1]; }))]);
      window.APB3D.flyTo(cw[1], cw[0], Math.max(170, Math.min(650, Math.sqrt(a.re.LandRegistryArea) * 5)));
      window.APB3D.boden(cw[0], cw[1]).then(function (h) { bodenH = h; if (letzte) zeigeVolumen(letzte.v, letzte.mix); });
    });
  }

  /* ---------- Volumen-Generator ---------- */
  // Regeln (content/potenzial/SETZUNG-UND-STANDARDS.md): Volumen nach Norden, Riegel Ost–West, Erschliessung Nord,
  // Besonnung (Aussenraum Süd), Ausschöpfung, Kompaktheit. Lärm/Strasse folgen mit dem Lärmkataster.
  var TIEFE = 13, PUNKT = 17;
  function intervalle(poly, t) {           // Schnitt der Waagrechten t mit dem Polygon (lokale s/t-Koordinaten)
    var xs = [];
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[j], b = poly[i];
      if ((a[1] > t) !== (b[1] > t)) xs.push(a[0] + (t - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    xs.sort(function (x, y) { return x - y; });
    var out = []; for (var k = 0; k + 1 < xs.length; k += 2) out.push([xs[k], xs[k + 1]]);
    return out;
  }
  function schnitt(A, B) { var o = []; A.forEach(function (a) { B.forEach(function (b) { var lo = Math.max(a[0], b[0]), hi = Math.min(a[1], b[1]); if (hi - lo > 0.01) o.push([lo, hi]); }); }); return o; }
  function band(poly, t0, t1) { var iv = null; for (var t = t0 + 0.05; t <= t1 - 0.05 + 1e-9; t += Math.max(0.5, (t1 - t0) / 12)) { var x = intervalle(poly, t); iv = iv ? schnitt(iv, x) : x; if (!iv.length) return []; } var e = intervalle(poly, t1 - 0.05); return schnitt(iv || e, e); }
  function rot(p, th) { var c = Math.cos(th), s = Math.sin(th); return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; }
  function zurueck(p, th) { var c = Math.cos(th), s = Math.sin(th); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
  function rechteck(s0, s1, t0, t1, th, o) { return [[s0, t0], [s1, t0], [s1, t1], [s0, t1]].map(function (p) { var q = zurueck(p, th); return [q[0] + o[0], q[1] + o[1]]; }); }
  // bestes Band (Länge, Lage) für ein Rechteck der Tiefe T; t von "oben" (Norden im gedrehten System) nach unten
  function besterRiegel(poly, T, Lmax, Lmin, tmax, tmin) {
    var best = null;
    for (var t1 = tmax; t1 - T >= tmin - 1e-9; t1 -= 1) {
      band(poly, t1 - T, t1).forEach(function (iv) {
        var L = Math.min(Lmax, iv[1] - iv[0]); if (L < Lmin) return;
        var s0 = iv[0] + (iv[1] - iv[0] - L) / 2;
        var sc = L * 2 + (t1 - tmin) * 0.6;              // lang und möglichst weit "nördlich"
        if (!best || sc > best.sc) best = { s0: s0, s1: s0 + L, t0: t1 - T, t1: t1, L: L, sc: sc };
      });
    }
    return best;
  }
  function generieren(a, k) {
    var z = a.zone || {}, bf = k.bf; if (!bf || !k.gf) return [];
    var o = bf.reduce(function (s, p) { return [s[0] + p[0] / bf.length, s[1] + p[1] / bf.length]; }, [0, 0]);
    var lokal = bf.map(function (p) { return [p[0] - o[0], p[1] - o[1]]; });
    var nMax = Math.max(1, Math.min(z.vg || 99, Math.floor((k.hoehe || GH * 3) / GH)));
    var Lmax = z.laenge || 40, dach = /Giebeldächer|nur Giebel/i.test((a.gem || {}).dach || "") ? "sattel" : (z.attika || z.dg ? "attika" : "flach");
    var kandidaten = [];
    for (var deg = -75; deg <= 90; deg += 15) {
      var th = deg * Math.PI / 180, poly = lokal.map(function (p) { return rot(p, th); });
      var ts = poly.map(function (p) { return p[1]; }), tmin = Math.min.apply(null, ts), tmax = Math.max.apply(null, ts);
      var nordOben = Math.cos(th) > 0.2;                 // gedrehte t-Achse zeigt nach Norden
      if (!nordOben) continue;
      var r = besterRiegel(poly, TIEFE, Lmax, 12, tmax, tmin);
      if (r) {
        kandidaten.push({ typ: "zeile", th: th, deg: deg, teile: [rechteck(r.s0, r.s1, r.t0, r.t1, th, o)], L: r.L });
        // Winkel: Flügel am West- oder Ostende nach Süden
        [0, 1].forEach(function (seite) {
          var s0 = seite ? r.s1 - TIEFE : r.s0, s1 = s0 + TIEFE, best = 0;
          for (var W = 8; W <= Lmax; W += 1) { if (band(poly.map(function (p) { return [p[0], p[1]]; }), r.t0 - W, r.t0).some(function (iv) { return iv[0] <= s0 + 0.01 && iv[1] >= s1 - 0.01; })) best = W; else break; }
          if (best >= 8) kandidaten.push({ typ: "winkel", th: th, deg: deg, teile: [rechteck(r.s0, r.s1, r.t0, r.t1, th, o), rechteck(s0, s1, r.t0 - best, r.t0, th, o)], L: r.L + best });
        });
        // Hof/U: Flügel an beiden Enden
        if (r.L >= 30) {
          var wl = 0, wr = 0;
          for (var W2 = 8; W2 <= Lmax; W2 += 1) { var ok = band(poly, r.t0 - W2, r.t0); if (ok.some(function (iv) { return iv[0] <= r.s0 + 0.01 && iv[1] >= r.s0 + TIEFE - 0.01; }) && ok.some(function (iv) { return iv[0] <= r.s1 - TIEFE + 0.01 && iv[1] >= r.s1 - 0.01; })) wl = wr = W2; else break; }
          if (wl >= 10) kandidaten.push({ typ: "hof", th: th, deg: deg, teile: [rechteck(r.s0, r.s1, r.t0, r.t1, th, o), rechteck(r.s0, r.s0 + TIEFE, r.t0 - wl, r.t0, th, o), rechteck(r.s1 - TIEFE, r.s1, r.t0 - wr, r.t0, th, o)], L: r.L + 2 * wl });
        }
        // Kombination: Riegel Nord + Punkthaus Süd (Gebäudeabstand ≥ 2 × Grenzabstand)
        var abst = 2 * (z.ga_k || 5), p2 = besterRiegel(poly, PUNKT, PUNKT, PUNKT, r.t0 - abst, tmin);
        if (p2) kandidaten.push({ typ: "kombi", th: th, deg: deg, teile: [rechteck(r.s0, r.s1, r.t0, r.t1, th, o), rechteck(p2.s0, p2.s1, p2.t0, p2.t1, th, o)], L: r.L });
      }
      // Punkthäuser (1–3), nach Norden gestaffelt
      var p1 = besterRiegel(poly, PUNKT, PUNKT, PUNKT, tmax, tmin);
      if (p1) {
        var teile = [rechteck(p1.s0, p1.s1, p1.t0, p1.t1, th, o)], gap = 2 * (z.ga_k || 5);
        var neben = band(poly, p1.t0, p1.t1).filter(function (iv) { return iv[1] - iv[0] >= PUNKT; });
        neben.forEach(function (iv) {
          if (teile.length >= 3) return;
          [[iv[0], iv[0] + PUNKT], [iv[1] - PUNKT, iv[1]]].forEach(function (s) {
            if (teile.length >= 3) return;
            if (s[0] >= p1.s1 + gap - 0.01 || s[1] <= p1.s0 - gap + 0.01) {
              var dupl = teile.length > 1 && Math.abs(s[0] - teile.s0x) < 1; if (dupl) return;
              teile.push(rechteck(s[0], s[1], p1.t0, p1.t1, th, o)); teile.s0x = s[0];
            }
          });
        });
        kandidaten.push({ typ: "punkt", th: th, deg: deg, teile: teile, L: PUNKT });
      }
    }
    // Geschosse nach Dichte, Kennzahlen, Bewertung
    kandidaten.forEach(function (v) {
      v.fuss = v.teile.reduce(function (s, r) { return s + Math.abs(flaeche(r)); }, 0);
      var dg = (dach === "attika" && (z.attika || z.dg)) ? 0.6 : (dach === "sattel" && z.dg ? 0.55 : 0);
      v.n = Math.max(1, Math.min(nMax, Math.floor(k.gf / v.fuss - dg + 1e-9)));
      v.dg = (v.n === nMax && k.gf >= v.fuss * (v.n + dg)) ? dg : 0;
      v.gf = v.fuss * (v.n + v.dg); v.dach = dach;
      v.aus = Math.min(1, v.gf / k.gf);
      var ns = []; v.teile.forEach(function (r) { r.forEach(function (p) { ns.push(p[1]); }); });
      var bfN = bf.map(function (p) { return p[1]; }), nMin = Math.min.apply(null, bfN), nMx = Math.max.apply(null, bfN);
      var mitte = ns.reduce(function (s, x) { return s + x; }, 0) / ns.length;
      v.nord = nMx > nMin ? (mitte - nMin) / (nMx - nMin) : 0.5;
      v.suedRaum = nMx > nMin ? (Math.min.apply(null, ns) - nMin) / (nMx - nMin) : 0;
      v.ow = v.typ === "punkt" ? 0.8 : Math.pow(Math.cos(v.th), 2);         // Längsachse Ost–West
      var umf = v.teile.reduce(function (s, r) { return s + 2 * (Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) + Math.hypot(r[2][0] - r[1][0], r[2][1] - r[1][1])); }, 0);
      v.kompakt = Math.min(1, (v.fuss * 4) / (umf * TIEFE));
      v.score = Math.round(100 * (0.30 * v.aus + 0.20 * v.nord + 0.15 * v.ow + 0.15 * v.suedRaum + 0.10 * v.kompakt + 0.10 * (v.typ === "kombi" || v.typ === "punkt" ? 0.7 : 0.8)));
    });
    var NAMEN = { zeile: t("Zeile / Riegel", "Row / slab"), punkt: t("Punkthaus", "Point block"), winkel: t("Winkel", "L-shape"), hof: t("Hof / U-Form", "Courtyard / U"), kombi: t("Riegel + Punkt", "Slab + point") };
    var beste = {};
    kandidaten.forEach(function (v) { v.name = NAMEN[v.typ]; if (!beste[v.typ] || v.score > beste[v.typ].score) beste[v.typ] = v; });
    return Object.keys(beste).map(function (k2) { return beste[k2]; }).sort(function (x, y) { return y.score - x.score; }).slice(0, 5);
  }
  function gruende(v) {
    var g = [];
    g.push([v.aus > 0.9, t("Ausnützung ", "Density used ") + Math.round(v.aus * 100) + " %"]);
    g.push([v.nord > 0.6, v.nord > 0.6 ? t("Volumen im Norden – Aussenraum im Süden", "Building to the north – garden to the south") : t("Volumen nicht an der Nordseite", "Building not on the north side")]);
    if (v.typ !== "punkt") g.push([v.ow > 0.7, v.ow > 0.7 ? t("Längsfassade nach Süden (Ost–West-Riegel)", "Long facade facing south") : t("Längsachse Nord–Süd: Ost-/Westwohnungen", "North–south axis: east/west units")]);
    else g.push([true, t("Rundum orientiert, 2–4 Wohnungen pro Geschoss", "All-round orientation, 2–4 units per floor")]);
    g.push([v.suedRaum > 0.25, t("Besonnter Aussenraum Süd: ", "Sunny southern open space: ") + Math.round(v.suedRaum * 100) + " %"]);
    return '<ul class="pz-gruende">' + g.map(function (x) { return '<li class="' + (x[0] ? "" : "m") + '">' + esc(x[1]) + "</li>"; }).join("") + "</ul>";
  }
  var FARBE = { "2.5": "#8fb7d6", "3.5": "#6cc08b", "4.5": "#e2b04a", "5.5": "#e0708f", kern: "#9a978f" };
  function zeigeVolumen(v, mix) {
    letzte = { v: v, mix: mix };
    karte().then(function () {
      var C = C3, alt = ds.entities.values.filter(function (e) { return e._pzVol; }); alt.forEach(function (e) { ds.entities.remove(e); });
      function add(o) { var e = ds.entities.add(o); e._pzVol = 1; return e; }
      var weiss = C.Color.fromCssColorString("#fbfaf7"), orange = C.Color.fromCssColorString("#f15d30"), b0 = bodenH;
      v.teile.forEach(function (r, ti) {
        var H = v.n * GH;
        if (mix && mix.teile[ti]) {
          mix.teile[ti].forEach(function (st) {                // Wohnungen geschossweise als farbige Scheiben
            st.felder.forEach(function (f) {
              add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(f.r)), height: b0 + st.g * GH + 0.15, extrudedHeight: b0 + (st.g + 1) * GH - 0.15,
                material: C.Color.fromCssColorString(FARBE[f.typ]).withAlpha(0.95), outline: true, outlineColor: C.Color.WHITE.withAlpha(0.8) } });
            });
          });
        } else {
          add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(r)), height: b0, extrudedHeight: b0 + H, material: weiss, outline: true, outlineColor: orange } });
        }
        // Dach
        if (v.dg && v.dach === "attika") {
          var c = r.reduce(function (s, p) { return [s[0] + p[0] / 4, s[1] + p[1] / 4]; }, [0, 0]);
          var att = r.map(function (p) { return [c[0] + (p[0] - c[0]) * 0.86, c[1] + (p[1] - c[1]) * 0.86]; });
          // Attika nach Norden schieben (Terrasse Süd)
          var dy = (Math.max.apply(null, r.map(function (p) { return p[1]; })) - Math.max.apply(null, att.map(function (p) { return p[1]; })));
          att = att.map(function (p) { return [p[0], p[1] + dy * 0.9]; });
          add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(att)), height: b0 + H, extrudedHeight: b0 + H + GH, material: mix ? C.Color.fromCssColorString(FARBE["4.5"]).withAlpha(0.95) : weiss, outline: true, outlineColor: orange } });
        } else if (v.dach === "sattel") {
          var lang = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) >= Math.hypot(r[2][0] - r[1][0], r[2][1] - r[1][1]);
          var A = lang ? r : [r[1], r[2], r[3], r[0]], m1 = [(A[0][0] + A[3][0]) / 2, (A[0][1] + A[3][1]) / 2], m2 = [(A[1][0] + A[2][0]) / 2, (A[1][1] + A[2][1]) / 2];
          var fh = TIEFE / 2 * Math.tan(35 * Math.PI / 180);
          [[A[0], A[1], m2, m1], [A[3], A[2], m2, m1]].forEach(function (fl) {
            add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArrayHeights(llArr([fl[0], fl[1]], b0 + H).concat(llArr([fl[2], fl[3]], b0 + H + fh))), perPositionHeight: true, material: C.Color.fromCssColorString("#d9d4ca"), outline: true, outlineColor: orange } });
          });
        }
      });
      V3.scene.requestRender();
    });
  }

  /* ---------- Wohnungsmix ---------- */
  var mixAnteile = { "2.5": 30, "3.5": 40, "4.5": 25, "5.5": 5 };
  function mixRechnen(v) {
    var nwf = NWF[standard], tiefeNutz = TIEFE - 1.2;      // Aussenwände
    var summe = 0; Object.keys(mixAnteile).forEach(function (k2) { summe += mixAnteile[k2]; });
    var zaehl = { "2.5": 0, "3.5": 0, "4.5": 0, "5.5": 0 }, flaecheSum = 0, ziel = {};
    Object.keys(mixAnteile).forEach(function (k2) { ziel[k2] = summe ? mixAnteile[k2] / summe : 0; });
    var total = 0;
    function naechsterTyp() {                               // grösster Rückstand gegenüber dem Zielmix
      var best = null, bv = -1;
      Object.keys(ziel).forEach(function (k2) { if (!ziel[k2]) return; var d = ziel[k2] * (total + 1) - zaehl[k2]; if (d > bv) { bv = d; best = k2; } });
      return best || "3.5";
    }
    var teile = v.teile.map(function (r) {
      var e1 = [r[1][0] - r[0][0], r[1][1] - r[0][1]], e2 = [r[3][0] - r[0][0], r[3][1] - r[0][1]];
      var L1 = Math.hypot(e1[0], e1[1]), L2 = Math.hypot(e2[0], e2[1]), u = L1 >= L2 ? e1 : e2, w = L1 >= L2 ? e2 : e1, L = Math.max(L1, L2);
      var stock = [];
      var nG = v.n + (v.dg && v.dach === "attika" ? 0 : 0);
      for (var g = 0; g < nG; g++) {
        var felder = [], pos = 0, seitKern = 0;
        var kernBreite = 5.5, maxZwischen = v.typ === "punkt" ? 99 : 26;
        // Punkthaus: Kern in der Mitte, Wohnungen links/rechts
        while (pos < L - 0.1) {
          if (seitKern >= maxZwischen || (pos === 0 && v.typ !== "punkt" && L > 30) || (v.typ === "punkt" && felder.length === 2 && !felder.some(function (f) { return f.typ === "kern"; }))) {
            var kb = Math.min(kernBreite, L - pos); felder.push({ typ: "kern", a: pos, b: pos + kb }); pos += kb; seitKern = 0; continue;
          }
          var typ = naechsterTyp(), breite = nwf[typ] / (tiefeNutz * 0.88);
          if (v.typ === "punkt") breite = nwf[typ] / ((TIEFE + PUNKT) / 2 * 0.62);
          if (pos + breite > L + 0.5) { if (L - pos >= 5) { breite = L - pos; } else { if (felder.length) felder[felder.length - 1].b = L; break; } }
          felder.push({ typ: typ, a: pos, b: Math.min(L, pos + breite) }); pos += breite; seitKern += breite;
          zaehl[typ]++; total++; flaecheSum += nwf[typ];
        }
        stock.push({ g: g, felder: felder.map(function (f) {
          var a0 = f.a / L, b1 = f.b / L;
          f.r = [[r[0][0] + u[0] * a0, r[0][1] + u[1] * a0], [r[0][0] + u[0] * b1, r[0][1] + u[1] * b1], [r[0][0] + u[0] * b1 + w[0], r[0][1] + u[1] * b1 + w[1]], [r[0][0] + u[0] * a0 + w[0], r[0][1] + u[1] * a0 + w[1]]];
          return f; }) });
      }
      return stock;
    });
    if (v.dg && v.dach === "attika") { v.teile.forEach(function () { zaehl["4.5"]++; total++; flaecheSum += nwf["4.5"]; }); }
    return { teile: teile, zaehl: zaehl, total: total, nwf: flaecheSum };
  }
  function renderMix(v) {
    var box = root.querySelector(".pz-mix"), m = mixRechnen(v), nwf = NWF[standard];
    var regler = Object.keys(mixAnteile).map(function (k2) {
      return '<label><span><i style="background:' + FARBE[k2] + '"></i>' + k2 + ' Zi.</span><input type="range" min="0" max="80" step="5" value="' + mixAnteile[k2] + '" data-typ="' + k2 + '" aria-label="' + t("Anteil ", "Share ") + k2 + ' Zi."><b>' + mixAnteile[k2] + " %</b></label>";
    }).join("");
    var zeilen = Object.keys(m.zaehl).map(function (k2) { return m.zaehl[k2] ? "<tr><td><i style=\"display:inline-block;width:10px;height:10px;border-radius:2px;background:" + FARBE[k2] + ";margin-right:6px\"></i>" + k2 + " Zi.</td><td>" + m.zaehl[k2] + "</td><td>" + nwf[k2] + " m²</td><td>" + zahl(m.zaehl[k2] * nwf[k2]) + " m²</td></tr>" : ""; }).join("");
    box.innerHTML = '<div class="pz-sek"><h4>' + t("3 · Wohnungsmix", "3 · Unit mix") + '</h4><div class="pz-regler">' + regler + "</div>" +
      '<table class="pz-tab"><thead><tr><th>' + t("Typ", "Type") + "</th><th>" + t("Anz.", "No.") + "</th><th>Ø NWF</th><th>" + t("Total", "Total") + "</th></tr></thead><tbody>" + zeilen + "</tbody>" +
      "<tfoot><tr><td>" + t("Total", "Total") + "</td><td>" + m.total + "</td><td></td><td>" + zahl(m.nwf) + " m²</td></tr></tfoot></table>" +
      '<p class="muted small">' + t("Geschossfläche ", "Floor area ") + zahl(v.gf) + " m² · " + t("Nutzungsgrad NWF/GF ", "Efficiency ") + Math.round(m.nwf / v.gf * 100) + " % · " + t("Ausbaustandard ", "Standard ") + standard + ". " +
      t("Wohnungen durchgesteckt (Wohnen Süd, Schlafen Nord), Kerne grau. Flächenwerte vorläufig – Kalibrierung mit apb-Studien folgt.", "Through-units (living south, bedrooms north), cores grey. Provisional values.") + "</p></div>";
    box.hidden = false;
    Array.prototype.forEach.call(box.querySelectorAll("input[type=range]"), function (inp) {
      inp.addEventListener("input", function () { mixAnteile[inp.dataset.typ] = +inp.value; inp.nextElementSibling.textContent = inp.value + " %"; });
      inp.addEventListener("change", function () { renderMix(v); });
    });
    zeigeVolumen(v, m);
  }
  function renderVolumen(a, k) {
    var box = root.querySelector(".pz-vol"); root.querySelector(".pz-mix").hidden = true;
    var vs = generieren(a, k);
    if (!vs.length) { box.innerHTML = '<div class="pz-sek"><h4>' + t("2 · Volumen", "2 · Massing") + '</h4><p class="pz-hint warn">' + t("Für diese Parzelle konnten noch keine Volumen erzeugt werden (Zone nicht erfasst oder Baufeld zu klein).", "No massing options could be generated for this plot yet.") + "</p></div>"; box.hidden = false; return; }
    var dachSel = '<select class="pz-dach" aria-label="' + t("Dachform", "Roof form") + '"><option value="attika"' + (vs[0].dach === "attika" ? " selected" : "") + '>' + t("Flachdach + Attika", "Flat roof + attic") + '</option><option value="flach"' + (vs[0].dach === "flach" ? " selected" : "") + '>' + t("Flachdach", "Flat roof") + '</option><option value="sattel"' + (vs[0].dach === "sattel" ? " selected" : "") + '>' + t("Satteldach", "Pitched roof") + "</option></select>";
    box.innerHTML = '<div class="pz-sek"><h4>' + t("2 · Volumen", "2 · Massing") + " " + dachSel + '</h4><ul class="pz-var">' + vs.map(function (v, i) {
      return '<li><button type="button" data-i="' + i + '" aria-pressed="' + (i === 0) + '"><b>' + esc(v.name) + '</b><span class="sc">' + v.score + "</span><small>" + v.teile.length + " " + t("Baukörper", "volumes") + " · " + v.n + " " + t("Geschosse", "storeys") + (v.dg ? " + " + (v.dach === "attika" ? "Attika" : "DG") : "") + " · GF " + zahl(v.gf) + " m² · " + t("Ausnützung ", "density ") + Math.round(v.aus * 100) + " %</small><span class=\"bar\"><i style=\"width:" + v.score + '%"></i></span></button></li>';
    }).join("") + '</ul><div class="pz-why"></div><button type="button" class="btn pz-go">' + t("Volumen bestätigen → Wohnungsmix", "Confirm massing → unit mix") + '<span class="arr"></span></button></div>';
    box.hidden = false;
    var gewaehlt = vs[0];
    function waehleV(i) { gewaehlt = vs[i]; Array.prototype.forEach.call(box.querySelectorAll(".pz-var button"), function (b) { b.setAttribute("aria-pressed", +b.dataset.i === i); }); box.querySelector(".pz-why").innerHTML = gruende(gewaehlt); root.querySelector(".pz-mix").hidden = true; zeigeVolumen(gewaehlt, null); }
    Array.prototype.forEach.call(box.querySelectorAll(".pz-var button"), function (b) { b.addEventListener("click", function () { waehleV(+b.dataset.i); }); });
    box.querySelector(".pz-dach").addEventListener("change", function (e) { var d = e.target.value; vs.forEach(function (v) { v.dach = d; var z = a.zone || {}; var dg = d === "attika" && (z.attika || z.dg) ? 0.6 : (d === "sattel" && z.dg ? 0.55 : 0); v.dg = k.gf >= v.fuss * (v.n + dg) ? dg : 0; v.gf = v.fuss * (v.n + v.dg); v.aus = Math.min(1, v.gf / k.gf); }); waehleV(vs.indexOf(gewaehlt)); });
    box.querySelector(".pz-go").addEventListener("click", function () { renderMix(gewaehlt); root.querySelector(".pz-mix").scrollIntoView({ behavior: "smooth", block: "start" }); });
    waehleV(0);
  }

  /* ---------- Ablauf ---------- */
  var status = root.querySelector(".pz-status");
  function meldung(m, fehler) { status.textContent = m || ""; status.classList.toggle("err", !!fehler); }
  function waehle(treffer) {
    root.querySelector(".pz-liste").innerHTML = "";
    root.querySelector(".pz-q").value = treffer.label;
    meldung(t("Parzelle und ÖREB-Kataster werden abgefragt …", "Querying plot and PLR cadastre …"));
    root.querySelector(".pz-res").hidden = true; root.querySelector(".pz-vol").hidden = true; root.querySelector(".pz-mix").hidden = true;
    parzelleAn(treffer.lat, treffer.lon).then(function (p) {
      if (!p.egris_egrid) throw new Error("ohne EGRID");
      return Promise.all([oereb(p.egris_egrid), bzo()]);
    }).then(function (r) {
      var a = auswerten(r[0], r[1]); aktuell = a; meldung("");
      render(a, kennwerte(a));
    }).catch(function (e) {
      meldung(t("Für diesen Ort konnte kein ÖREB-Auszug geladen werden (nur Kanton Zürich). ", "No PLR extract for this location (Canton of Zurich only). ") + "(" + e.message + ")", true);
    });
  }
  var form = root.querySelector(".pz-such"), q = root.querySelector(".pz-q"), liste = root.querySelector(".pz-liste"), timer = null;
  q.addEventListener("input", function () {
    clearTimeout(timer);
    var v = q.value.trim(); if (v.length < 3) { liste.innerHTML = ""; return; }
    timer = setTimeout(function () {
      suche(v).then(function (rs) {
        liste.innerHTML = rs.map(function (r, i) { return '<li><button type="button" data-i="' + i + '"><span>' + esc(r.label) + "</span><small>" + (r.art === "parcel" ? t("Parzelle", "Plot") : t("Adresse", "Address")) + "</small></button></li>"; }).join("");
        Array.prototype.forEach.call(liste.querySelectorAll("button"), function (b) { b.addEventListener("click", function () { waehle(rs[+b.dataset.i]); }); });
      }).catch(function () {});
    }, 250);
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); var b = liste.querySelector("button"); if (b) b.click(); });
  root.querySelector(".pz-std").addEventListener("change", function (e) { standard = e.target.value; if (aktuell) render(aktuell, kennwerte(aktuell)); });
  // 3D starten, sobald eingeloggt
  if (document.documentElement.classList.contains("pz-on")) karte();
  document.addEventListener("pz-login", function () { karte(); });
})();
