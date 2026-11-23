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
    aktuellR = null; letzteParzelle = null; letzte = null;
    zeichneParzelle(a, k);
    renderVolumen(a, k);
  }

  /* ---------- 3D (eingebettet, ganze Fläche rechts) ---------- */
  var V3 = null, C3 = null, ds = null, karteBereit = null, bodenH = 450, letzte = null, aktuellR = null, letzteParzelle = null;
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
      letzteParzelle = true;
      if (aktuellR) {                                     // zulässiges Baufeld als Fläche (Rasterzeilen à 1 m)
        var R = aktuellR, schritt = 2;
        for (var j = 0; j < R.ny; j += schritt) {
          var i = 0;
          while (i < R.nx) {
            while (i < R.nx && !R.m[j * R.nx + i]) i++;
            var i0 = i; while (i < R.nx && R.m[j * R.nx + i]) i++;
            if (i > i0) {
              var x0 = R.x0 + i0 * R.h - R.h / 2, x1 = R.x0 + (i - 1) * R.h + R.h / 2, y0 = R.y0 + j * R.h - R.h / 2, y1 = y0 + schritt * R.h;
              ds.entities.add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])), material: orange.withAlpha(0.22), classificationType: C.ClassificationType.TERRAIN } });
            }
          }
        }
        R.kanten.forEach(function (e) { if (e.strasse) ds.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(llArr([e.a, e.b])), width: 5, material: C.Color.fromCssColorString("#8fb7d6"), clampToGround: true } }); });
      } else if (k.bf) {
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

  /* ---------- Umgebung: Strassen und Nachbarbauten (amtliche Vermessung, geodienste.ch) ---------- */
  function umgebung(ring) {
    var xs = ring.map(function (p) { return p[0]; }), ys = ring.map(function (p) { return p[1]; });
    var a = wgs(Math.min.apply(null, xs) - 40, Math.min.apply(null, ys) - 40), b = wgs(Math.max.apply(null, xs) + 40, Math.max.apply(null, ys) + 40);
    var u = "https://geodienste.ch/db/av_0/deu?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:LCSF&SRSNAME=EPSG:2056&OUTPUTFORMAT=geojson&COUNT=800&BBOX=" + [a[1], a[0], b[1], b[0]].join(",") + ",EPSG:4326";
    return json(u).then(function (j) {
      var s = [], g = [];
      (j.features || []).forEach(function (f) {
        if (!f.geometry || f.geometry.type !== "Polygon") return;
        var art = f.properties.Art, r = f.geometry.coordinates[0];
        if (/Strasse|Trottoir|Verkehrsinsel/i.test(art)) s.push(r); else if (art === "Gebaeude") g.push(r);
      });
      return { strassen: s, gebaeude: g };
    }).catch(function () { return { strassen: [], gebaeude: [] }; });
  }

  /* ---------- Geometrie-Hilfen ---------- */
  function distSeg(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
  function distRing(p, r) { var d = 1e9; for (var i = 0; i < r.length; i++) d = Math.min(d, distSeg(p, r[i], r[(i + 1) % r.length])); return d; }
  function ecken(p) {                       // Bauteil {c, L, T, ang} -> 4 Ecken; p0->p1 Längsseite, p0->p3 Tiefe
    var u = [Math.cos(p.ang), Math.sin(p.ang)], v = [-u[1], u[0]], hl = p.L / 2, ht = p.T / 2;
    return [[-hl, -ht], [hl, -ht], [hl, ht], [-hl, ht]].map(function (q) { return [p.c[0] + u[0] * q[0] + v[0] * q[1], p.c[1] + u[1] * q[0] + v[1] * q[1]]; });
  }
  function aussenNormale(a, b, c) { var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), n = [dy / L, -dx / L]; var m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if ((m[0] - c[0]) * n[0] + (m[1] - c[1]) * n[1] < 0) n = [-n[0], -n[1]]; return n; }

  /* ---------- Raster des zulässigen Baufelds ---------- */
  // Zelle zulässig: innerhalb der Parzelle, Grenzabstand je Kante (gross vor Süd), Vorzone zur Strasse, hinter Baulinien.
  var VORZONE = 6;
  function raster(a, k, umg) {
    var z = a.zone || {}, ring = k.ring; if (!ring) return null;
    var c = ring.reduce(function (s, p) { return [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length]; }, [0, 0]);
    var kanten = ring.map(function (p, i) {
      var q = ring[(i + 1) % ring.length], n = aussenNormale(p, q, c), m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      var strasse = umg.strassen.some(function (s) { return innen(s, m[0] + n[0] * 1.5, m[1] + n[1] * 1.5) || distRing(m, s) < 1.2; });
      var d = (z.ga_g && n[1] < -Math.SQRT1_2) ? z.ga_g : (z.ga_k || 4);
      if (strasse) d = Math.max(d, VORZONE);
      return { a: p, b: q, n: n, d: d, strasse: strasse, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
    });
    // Baulinien: verbotene Seite = Seite der Strasse
    var linien = [];
    a.eintraege.forEach(function (e) {
      if (!/Baulinie/i.test(e.code + e.legende) || !e.geo) return;
      e.geo.forEach(function (gg) { var l = gg.Line || gg.line; if (l && l.coordinates) linien.push(l.coordinates); });
    });
    function seite(l, p) { var best = 1e9, sg = 0; for (var i = 0; i + 1 < l.length; i++) { var d = distSeg(p, l[i], l[i + 1]); if (d < best) { best = d; sg = (l[i + 1][0] - l[i][0]) * (p[1] - l[i][1]) - (l[i + 1][1] - l[i][1]) * (p[0] - l[i][0]) > 0 ? 1 : -1; } } return sg; }
    var verbot = linien.map(function (l) {
      var sk = kanten.filter(function (e) { return e.strasse; });
      var probe = sk.length ? [(sk[0].a[0] + sk[0].b[0]) / 2 + sk[0].n[0] * 3, (sk[0].a[1] + sk[0].b[1]) / 2 + sk[0].n[1] * 3] : null;
      if (!probe) { var pts = umg.strassen.length ? umg.strassen[0] : null; probe = pts ? pts[0] : null; }
      return probe ? seite(l, probe) : 0;
    });
    var xs = ring.map(function (p) { return p[0]; }), ys = ring.map(function (p) { return p[1]; });
    var R = { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), h: 0.5 };
    R.nx = Math.ceil((Math.max.apply(null, xs) - R.x0) / R.h) + 1; R.ny = Math.ceil((Math.max.apply(null, ys) - R.y0) / R.h) + 1;
    R.m = new Uint8Array(R.nx * R.ny); var anz = 0;
    for (var j = 0; j < R.ny; j++) for (var i = 0; i < R.nx; i++) {
      var p = [R.x0 + i * R.h, R.y0 + j * R.h];
      if (!innen(ring, p[0], p[1])) continue;
      var ok = kanten.every(function (e) { return distSeg(p, e.a, e.b) >= e.d - 0.01; });
      if (ok) ok = linien.every(function (l, li) { return !verbot[li] || seite(l, p) !== verbot[li]; });
      if (ok) { R.m[j * R.nx + i] = 1; anz++; }
    }
    R.flaeche = anz * R.h * R.h; R.kanten = kanten; R.c = c;
    R.frei = function (x, y) { var i = Math.round((x - R.x0) / R.h), j = Math.round((y - R.y0) / R.h); return i >= 0 && j >= 0 && i < R.nx && j < R.ny && R.m[j * R.nx + i] === 1; };
    R.passt = function (p) {                // Rechteck liegt vollständig im zulässigen Raster (Rand dicht, Inneres grob)
      var u = [Math.cos(p.ang), Math.sin(p.ang)], v = [-u[1], u[0]];
      for (var s = -p.L / 2; s <= p.L / 2 + 1e-6; s += Math.min(1, p.L / 2)) for (var t = -p.T / 2; t <= p.T / 2 + 1e-6; t += (Math.abs(s) >= p.L / 2 - 1e-6 ? 1 : p.T / 2)) {
        if (!R.frei(p.c[0] + u[0] * s + v[0] * t, p.c[1] + u[1] * s + v[1] * t)) return false;
      }
      return true;
    };
    var sz = Math.max(3, Math.ceil(Math.sqrt(anz / 450)));      // höchstens ca. 450 Stützpunkte
    var zc = null;
    R.zellen = function () { if (zc) return zc; zc = []; for (var j2 = 0; j2 < R.ny; j2 += sz) for (var i2 = 0; i2 < R.nx; i2 += sz) if (R.m[j2 * R.nx + i2]) zc.push([R.x0 + i2 * R.h, R.y0 + j2 * R.h]); return zc; };
    return R;
  }

  /* ---------- Volumen-Generator ---------- */
  // Regeln (content/potenzial/SETZUNG-UND-STANDARDS.md): im zulässigen Baufeld, Vorzone/Zugang von der Strasse,
  // Volumen nach Norden, Längsfassade nach Süden, besonnter Aussenraum, nicht an den Rand gedrückt, kompakt.
  var TIEFE = 13, PUNKT = 17;
  function abstandTeile(p, q) { var a = ecken(p), b = ecken(q), d = 1e9; a.forEach(function (x) { d = Math.min(d, distRing(x, b)); }); b.forEach(function (x) { d = Math.min(d, distRing(x, a)); }); var ov = a.some(function (x) { return innen(b, x[0], x[1]); }) || b.some(function (x) { return innen(a, x[0], x[1]); }); return ov ? -1 : d; }
  function bewerten(v, a, k, R) {
    var z = a.zone || {}, nMax = Math.max(1, Math.min(z.vg || 99, Math.floor((k.hoehe || GH * 3) / GH)));
    v.fuss = v.teile.reduce(function (s, p) { return s + p.L * p.T; }, 0);
    var dgA = (v.dach === "attika" && (z.attika || z.dg)) ? 0.6 : (v.dach === "sattel" && z.dg ? 0.55 : 0);
    if (!v.fest) v.n = Math.max(1, Math.min(nMax, Math.floor(k.gf / v.fuss - dgA + 1e-9)));
    v.nMax = nMax;
    v.dg = (v.n >= nMax && k.gf >= v.fuss * (v.n + dgA)) || v.fest ? dgA : 0;
    v.gf = v.fuss * (v.n + v.dg); v.aus = Math.min(1.2, v.gf / k.gf);
    var alle = []; v.teile.forEach(function (p) { ecken(p).forEach(function (q) { alle.push(q); }); });
    var cy = alle.reduce(function (s, q) { return s + q[1]; }, 0) / alle.length;
    var bfy = R.zellen().map(function (q) { return q[1]; }), y0 = Math.min.apply(null, bfy), y1 = Math.max.apply(null, bfy);
    v.nord = y1 > y0 ? Math.max(0, Math.min(1, (cy - y0) / (y1 - y0))) : 0.5;
    v.ow = v.teile.reduce(function (s, p) { return s + (p.L > p.T * 1.2 ? Math.pow(Math.cos(p.ang), 2) : 0.8); }, 0) / v.teile.length;
    // Strassenbezug: Fassade parallel zur Strasse, Abstand 6–15 m
    var sk = R.kanten.filter(function (e) { return e.strasse; });
    if (sk.length) {
      var best = 0;
      v.teile.forEach(function (p) {
        sk.forEach(function (e) {
          var ea = Math.atan2(e.b[1] - e.a[1], e.b[0] - e.a[0]), par = Math.abs(Math.cos(p.ang - ea)), parT = Math.abs(Math.sin(p.ang - ea));
          var d = Math.min.apply(null, ecken(p).map(function (q) { return distSeg(q, e.a, e.b); }));
          var ds = d < 5.5 ? 0.3 : d <= 15 ? 1 : Math.max(0, 1 - (d - 15) / 20);
          best = Math.max(best, Math.max(par, parT * 0.8) * ds);
        });
      });
      v.strasse = best;
    } else v.strasse = 0.6;
    // nicht an den Rand: Reserve über den Mindestabstand hinaus (ausser zur Strasse)
    var reserve = 1e9;
    v.teile.forEach(function (p) { ecken(p).forEach(function (q) { R.kanten.forEach(function (e) { if (!e.strasse) reserve = Math.min(reserve, distSeg(q, e.a, e.b) - e.d); }); }); });
    v.rand = Math.max(0, Math.min(1, reserve / 4));
    // besonnter Aussenraum: freie Rasterfläche südlich der Bauten
    var miny = Math.min.apply(null, alle.map(function (q) { return q[1]; })), sued = R.zellen().filter(function (q) { return q[1] < miny - 2; }).length, tot = R.zellen().length || 1;
    v.sued = Math.min(1, sued / tot * 1.6);
    var umf = v.teile.reduce(function (s, p) { return s + 2 * (p.L + p.T); }, 0);
    v.kompakt = Math.min(1, v.fuss * 4 / (umf * TIEFE));
    v.ok = v.teile.every(R.passt);
    v.score = Math.round(100 * (0.26 * Math.min(1, v.aus) + 0.14 * v.nord + 0.14 * v.ow + 0.16 * v.strasse + 0.10 * v.rand + 0.12 * v.sued + 0.08 * v.kompakt));
    if (!v.ok) v.score = Math.min(v.score, 20);
    return v;
  }
  function generieren(a, k, R) {
    var z = a.zone || {}; if (!R || !k.gf || R.flaeche < 80) return [];
    var Lmax = z.laenge || 40, gap = 2 * (z.ga_k || 5);
    var dach = /Giebeldächer|nur Giebel/i.test((a.gem || {}).dach || "") ? "sattel" : (z.attika || z.dg ? "attika" : "flach");
    var zellen = R.zellen(), kand = [];
    function maxLaenge(c, T, ang, Lmin, Lcap) { for (var L = Lcap; L >= Lmin; L -= 2) { var p = { c: c, L: L, T: T, ang: ang }; if (R.passt(p)) return p; } return null; }
    for (var deg = -60; deg <= 90; deg += 15) {
      var ang = deg * Math.PI / 180, riegel = [];
      zellen.forEach(function (c) { var p = maxLaenge(c, TIEFE, ang, 14, Lmax); if (p) riegel.push(p); });
      riegel.sort(function (x, y) { return y.L - x.L || y.c[1] - x.c[1]; });
      riegel.slice(0, 6).forEach(function (r) {
        kand.push({ typ: "zeile", teile: [r] });
        var u = [Math.cos(ang), Math.sin(ang)], v = [-u[1], u[0]];
        // Winkel und Hof: Flügel an den Enden, Richtung Süden
        var sv = v[1] < 0 ? 1 : -1;            // v so, dass Flügel nach Süden zeigen
        [-1, 1].forEach(function (ende) {
          for (var W = Math.min(Lmax, 30); W >= 10; W -= 2) {
            var c = [r.c[0] + u[0] * ende * (r.L / 2 - TIEFE / 2) - v[0] * sv * (TIEFE / 2 + W / 2), r.c[1] + u[1] * ende * (r.L / 2 - TIEFE / 2) - v[1] * sv * (TIEFE / 2 + W / 2)];
            var f = { c: c, L: W, T: TIEFE, ang: ang + Math.PI / 2 };
            if (R.passt(f)) { kand.push({ typ: "winkel", teile: [r, f] }); break; }
          }
        });
        if (r.L >= 32) for (var W2 = Math.min(Lmax, 28); W2 >= 10; W2 -= 2) {
          var f1 = { c: [r.c[0] - u[0] * (r.L / 2 - TIEFE / 2) - v[0] * sv * (TIEFE / 2 + W2 / 2), r.c[1] - u[1] * (r.L / 2 - TIEFE / 2) - v[1] * sv * (TIEFE / 2 + W2 / 2)], L: W2, T: TIEFE, ang: ang + Math.PI / 2 };
          var f2 = { c: [r.c[0] + u[0] * (r.L / 2 - TIEFE / 2) - v[0] * sv * (TIEFE / 2 + W2 / 2), r.c[1] + u[1] * (r.L / 2 - TIEFE / 2) - v[1] * sv * (TIEFE / 2 + W2 / 2)], L: W2, T: TIEFE, ang: ang + Math.PI / 2 };
          if (R.passt(f1) && R.passt(f2)) { kand.push({ typ: "hof", teile: [r, f1, f2] }); break; }
        }
        // Riegel + Punkthaus südlich
        zellen.forEach(function (c) {
          var p = { c: c, L: PUNKT, T: PUNKT, ang: ang };
          if (c[1] < r.c[1] && R.passt(p) && abstandTeile(r, p) >= gap) kand.push({ typ: "kombi", teile: [r, p] });
        });
      });
      // Punkthäuser: 1–3 mit Gebäudeabstand
      var punkte = zellen.map(function (c) { return { c: c, L: PUNKT, T: PUNKT, ang: ang }; }).filter(R.passt);
      punkte.sort(function (x, y) { return y.c[1] - x.c[1]; });
      if (punkte.length) {
        var gew = [punkte[0]];
        punkte.forEach(function (p) { if (gew.length < 3 && gew.every(function (q) { return abstandTeile(p, q) >= gap; })) gew.push(p); });
        kand.push({ typ: "punkt", teile: gew.slice(0, 1) });
        if (gew.length > 1) kand.push({ typ: "punkt", teile: gew });
      }
    }
    var NAMEN = { zeile: t("Zeile / Riegel", "Row / slab"), punkt: t("Punkthaus", "Point block"), winkel: t("Winkel", "L-shape"), hof: t("Hof / U-Form", "Courtyard / U"), kombi: t("Riegel + Punkt", "Slab + point") };
    var beste = {};
    kand.forEach(function (v) { v.dach = dach; v.name = NAMEN[v.typ]; bewerten(v, a, k, R); if (v.ok && (!beste[v.typ] || v.score > beste[v.typ].score)) beste[v.typ] = v; });
    return Object.keys(beste).map(function (x) { return beste[x]; }).sort(function (x, y) { return y.score - x.score; }).slice(0, 5);
  }
  function gruende(v) {
    var g = [];
    g.push([v.aus > 0.85 && v.aus <= 1.001, t("Ausnützung ", "Density used ") + Math.round(v.aus * 100) + " %" + (v.aus > 1.001 ? t(" – überschritten!", " – exceeded!") : "")]);
    g.push([v.strasse > 0.7, v.strasse > 0.7 ? t("Adresse zur Strasse, Vorplatz und Zugang", "Address to the street, forecourt and access") : t("Bezug zur Strasse schwach", "Weak relation to the street")]);
    g.push([v.nord > 0.55, v.nord > 0.55 ? t("Volumen im Norden – Aussenraum im Süden", "Building to the north – garden to the south") : t("Volumen eher im Süden der Parzelle", "Building rather to the south")]);
    g.push([v.ow > 0.7, v.ow > 0.7 ? t("Hauptfassaden nach Süden", "Main facades facing south") : t("Ost-/Westorientierung", "East/west orientation")]);
    g.push([v.rand > 0.5, v.rand > 0.5 ? t("Luft zu den Nachbarn (mehr als Mindestabstand)", "Space to neighbours beyond minimum") : t("Am Mindestabstand zu den Nachbarn", "At minimum distance to neighbours")]);
    g.push([v.sued > 0.4, t("Besonnter Aussenraum Süd ", "Sunny southern open space ") + Math.round(v.sued * 100) + " %"]);
    return '<ul class="pz-gruende">' + g.map(function (x) { return '<li class="' + (x[0] ? "" : "m") + '">' + esc(x[1]) + "</li>"; }).join("") + "</ul>";
  }

  /* ---------- 3D-Darstellung der Volumen (Dach, Lukarnen, Fenster, Balkone, Eingang) ---------- */
  var FARBE = { "2.5": "#8fb7d6", "3.5": "#6cc08b", "4.5": "#e2b04a", "5.5": "#e0708f", kern: "#9a978f" };
  var NEIGUNG = 35 * Math.PI / 180;
  function zeigeVolumen(v, mix) {
    letzte = { v: v, mix: mix };
    karte().then(function () {
      var C = C3; ds.entities.values.filter(function (e) { return e._pzVol; }).forEach(function (e) { ds.entities.remove(e); });
      function add(o) { var e = ds.entities.add(o); e._pzVol = 1; return e; }
      var b0 = bodenH, R = aktuellR;
      var WEISS = C.Color.fromCssColorString("#fbfaf7"), GLAS = C.Color.fromCssColorString("#3d4b57"), BAND = C.Color.fromCssColorString("#cfcac0"), DACH = C.Color.fromCssColorString("#b9b2a6"), ORANGE = C.Color.fromCssColorString("#f15d30");
      function quad(p1, p2, z1, z2, farbe, off, n) {          // senkrechte Fläche p1–p2 von z1 bis z2, um off nach aussen versetzt
        var o = n ? [n[0] * off, n[1] * off] : [0, 0];
        var a1 = [p1[0] + o[0], p1[1] + o[1]], a2 = [p2[0] + o[0], p2[1] + o[1]];
        add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArrayHeights(llArr([a1], z1).concat(llArr([a2], z1), llArr([a2], z2), llArr([a1], z2))), perPositionHeight: true, material: farbe } });
      }
      function flaecheH(pts, hs, farbe) { var arr = []; pts.forEach(function (p, i) { arr = arr.concat(llArr([p], hs[i])); }); add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArrayHeights(arr), perPositionHeight: true, material: farbe } }); }
      var strasseKanten = R ? R.kanten.filter(function (e) { return e.strasse; }) : [];
      v.teile.forEach(function (p, ti) {
        var r = ecken(p), H = v.n * GH, cz = p.c;
        // Körper (oder Wohnungen geschossweise)
        if (mix && mix.teile[ti]) {
          mix.teile[ti].forEach(function (st) { st.felder.forEach(function (f) {
            add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(f.r)), height: b0 + st.g * GH + 0.12, extrudedHeight: b0 + (st.g + 1) * GH - 0.12, material: C.Color.fromCssColorString(FARBE[f.typ]).withAlpha(0.96), outline: true, outlineColor: C.Color.WHITE.withAlpha(0.9) } });
          }); });
        } else add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(r)), height: b0, extrudedHeight: b0 + H, material: WEISS } });
        // Geschossbänder
        for (var g = 1; g <= v.n; g++) {
          var gr = r.map(function (q) { return [cz[0] + (q[0] - cz[0]) * 1.004, cz[1] + (q[1] - cz[1]) * 1.004]; });
          add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(gr)), height: b0 + g * GH - 0.28, extrudedHeight: b0 + g * GH, material: BAND } });
        }
        // Fassaden: Fenster, Balkone (Süd), Eingang (Strasse)
        var seiten = [[r[0], r[1]], [r[1], r[2]], [r[2], r[3]], [r[3], r[0]]];
        seiten.forEach(function (sd) {
          var n = aussenNormale(sd[0], sd[1], cz), Ls = Math.hypot(sd[1][0] - sd[0][0], sd[1][1] - sd[0][1]), e = [(sd[1][0] - sd[0][0]) / Ls, (sd[1][1] - sd[0][1]) / Ls];
          var sued = n[1] < -0.5, schritt = sued ? 3.0 : 3.4, anz = Math.floor((Ls - 1.6) / schritt);
          var start = (Ls - (anz - 1) * schritt) / 2;
          for (var g2 = 0; g2 < v.n; g2++) {
            for (var w = 0; w < anz; w++) {
              var m = start + w * schritt, wb = sued ? 1.9 : 1.3, z1 = b0 + g2 * GH + (sued ? 0.15 : 0.95), z2 = b0 + g2 * GH + 2.35;
              if (g2 === 0 && !mix && strasseKanten.length && w === Math.floor(anz / 2) && isStrassenSeite(sd, n)) { z1 = b0 + 0.05; z2 = b0 + 2.6; wb = 2.2; }
              quad([sd[0][0] + e[0] * (m - wb / 2), sd[0][1] + e[1] * (m - wb / 2)], [sd[0][0] + e[0] * (m + wb / 2), sd[0][1] + e[1] * (m + wb / 2)], z1, z2, GLAS, 0.06, n);
            }
            // Balkone an der Südfassade (je ca. 9 m eine Loggia/Balkonplatte)
            if (sued && g2 > 0 && Ls > 8) {
              for (var bk = 4.5; bk + 2.2 < Ls; bk += 9) {
                var a1 = [sd[0][0] + e[0] * (bk - 2.2), sd[0][1] + e[1] * (bk - 2.2)], a2 = [sd[0][0] + e[0] * (bk + 2.2), sd[0][1] + e[1] * (bk + 2.2)];
                var pl = [a1, a2, [a2[0] + n[0] * 2, a2[1] + n[1] * 2], [a1[0] + n[0] * 2, a1[1] + n[1] * 2]];
                add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(pl)), height: b0 + g2 * GH - 0.22, extrudedHeight: b0 + g2 * GH, material: WEISS } });
                quad(pl[3], pl[2], b0 + g2 * GH, b0 + g2 * GH + 1.0, C.Color.WHITE.withAlpha(0.55), 0, null);
              }
            }
          }
          // Eingang: Vordach zur Strasse
          if (!mix && isStrassenSeite(sd, n) && ti === 0) {
            var mm = Ls / 2, c1 = [sd[0][0] + e[0] * (mm - 1.8), sd[0][1] + e[1] * (mm - 1.8)], c2 = [sd[0][0] + e[0] * (mm + 1.8), sd[0][1] + e[1] * (mm + 1.8)];
            var vd = [c1, c2, [c2[0] + n[0] * 1.6, c2[1] + n[1] * 1.6], [c1[0] + n[0] * 1.6, c1[1] + n[1] * 1.6]];
            add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(vd)), height: b0 + 2.7, extrudedHeight: b0 + 2.9, material: ORANGE } });
            var tuer = [sd[0][0] + e[0] * mm + n[0] * 0.5, sd[0][1] + e[1] * mm + n[1] * 0.5];
            var se = strasseKanten.reduce(function (bst, k2) { var d = distSeg(tuer, k2.a, k2.b); return !bst || d < bst.d ? { d: d, k: k2 } : bst; }, null);
            if (se) {
              var kk = se.k, dx = kk.b[0] - kk.a[0], dy = kk.b[1] - kk.a[1], L2 = dx * dx + dy * dy, tt = Math.max(0, Math.min(1, ((tuer[0] - kk.a[0]) * dx + (tuer[1] - kk.a[1]) * dy) / L2));
              var sp = [kk.a[0] + dx * tt + kk.n[0] * 0.5, kk.a[1] + dy * tt + kk.n[1] * 0.5];
              add({ polyline: { positions: C.Cartesian3.fromDegreesArray(llArr([sp, tuer])), width: 7, material: C.Color.fromCssColorString("#d6d1c7"), clampToGround: true } });
            }
          }
        });
        // Dach
        var z0 = b0 + H;
        if (v.dach === "flach" || (v.dach === "attika" && !v.dg)) {
          add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(r)), height: z0, extrudedHeight: z0 + 0.5, material: WEISS } });
        } else if (v.dach === "attika") {
          var u0 = [Math.cos(p.ang), Math.sin(p.ang)], vv = [-u0[1], u0[0]], nordV = vv[1] >= 0 ? 1 : -1;
          var att = { c: [p.c[0] + vv[0] * nordV * p.T * 0.12, p.c[1] + vv[1] * nordV * p.T * 0.12], L: p.L * 0.82, T: p.T * 0.7, ang: p.ang };
          add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(ecken(att))), height: z0, extrudedHeight: z0 + GH, material: mix ? C.Color.fromCssColorString(FARBE["4.5"]).withAlpha(0.96) : WEISS } });
          add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(ecken(att))), height: z0 + GH, extrudedHeight: z0 + GH + 0.35, material: BAND } });
          r.forEach(function (q, i) { quad(q, r[(i + 1) % 4], z0, z0 + 1.0, C.Color.WHITE.withAlpha(0.5), 0, null); });   // Geländer
          var ae = ecken(att);
          [[ae[0], ae[1]], [ae[2], ae[3]]].forEach(function (sd) { var n = aussenNormale(sd[0], sd[1], att.c); if (n[1] < -0.3) { var Ls = Math.hypot(sd[1][0] - sd[0][0], sd[1][1] - sd[0][1]); quad([sd[0][0] + (sd[1][0] - sd[0][0]) * 0.08, sd[0][1] + (sd[1][1] - sd[0][1]) * 0.08], [sd[0][0] + (sd[1][0] - sd[0][0]) * 0.92, sd[0][1] + (sd[1][1] - sd[0][1]) * 0.92], z0 + 0.1, z0 + 2.4, GLAS, 0.06, n); } });
        } else {
          // Sattel- oder Walmdach mit Vordach; First parallel zur Längsseite
          var lang = p.L >= p.T, Lr = lang ? p.L : p.T, Tr = lang ? p.T : p.L, ang2 = lang ? p.ang : p.ang + Math.PI / 2;
          var u1 = [Math.cos(ang2), Math.sin(ang2)], v1 = [-u1[1], u1[0]], ue = 0.6;
          function P(s, t2) { return [p.c[0] + u1[0] * s + v1[0] * t2, p.c[1] + u1[1] * s + v1[1] * t2]; }
          var hl = Lr / 2 + ue, ht = Tr / 2 + ue, fh = (Tr / 2) * Math.tan(NEIGUNG), zt = z0 - ue * Math.tan(NEIGUNG), walm = v.dach === "walm";
          var fA = walm ? Lr / 2 - Tr / 2 : hl;
          flaecheH([P(-hl, -ht), P(hl, -ht), P(fA, 0), P(-fA, 0)], [zt, zt, z0 + fh, z0 + fh], DACH);
          flaecheH([P(-hl, ht), P(hl, ht), P(fA, 0), P(-fA, 0)], [zt, zt, z0 + fh, z0 + fh], DACH);
          if (walm) {
            flaecheH([P(-hl, -ht), P(-hl, ht), P(-fA, 0)], [zt, zt, z0 + fh], DACH);
            flaecheH([P(hl, -ht), P(hl, ht), P(fA, 0)], [zt, zt, z0 + fh], DACH);
          } else {
            flaecheH([P(-Lr / 2, -Tr / 2), P(-Lr / 2, Tr / 2), P(-Lr / 2, 0)], [z0, z0, z0 + fh], WEISS);   // Giebel
            flaecheH([P(Lr / 2, -Tr / 2), P(Lr / 2, Tr / 2), P(Lr / 2, 0)], [z0, z0, z0 + fh], WEISS);
          }
          // Lukarnen auf der Südseite (gesamt höchstens 1/3 der Fassadenlänge)
          if (v.lukarnen && v.dg) {
            var suedT = (v1[1] < 0 ? 1 : -1) * Tr / 2, anzL = Math.max(1, Math.floor(Lr / 3 / 2.6)), bL = 2.2, abst = Lr / (anzL + 1);
            for (var li = 1; li <= anzL; li++) {
              var s0 = -Lr / 2 + li * abst, tf = suedT * 0.55, zf = z0 + (Tr / 2 - Math.abs(tf)) * Math.tan(NEIGUNG);
              var tb = suedT * 0.05, sg = suedT > 0 ? 1 : -1;
              var basis = [P(s0 - bL / 2, tf), P(s0 + bL / 2, tf), P(s0 + bL / 2, tb), P(s0 - bL / 2, tb)];
              add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(basis)), height: zf - 0.2, extrudedHeight: zf + 1.6, material: WEISS } });
              flaecheH([P(s0 - bL / 2 - 0.2, tf + sg * 0.3), P(s0 + bL / 2 + 0.2, tf + sg * 0.3), P(s0 + bL / 2 + 0.2, tb), P(s0 - bL / 2 - 0.2, tb)], [zf + 1.6, zf + 1.6, zf + 1.9, zf + 1.9], DACH);
              var nf = [v1[0] * sg, v1[1] * sg];
              quad(P(s0 - 0.7, tf), P(s0 + 0.7, tf), zf + 0.1, zf + 1.4, GLAS, 0.05, nf);
            }
          }
        }
      });
      V3.scene.requestRender();
    });
  }
  function isStrassenSeite(sd, n) {
    var R = aktuellR; if (!R) return false;
    var m = [(sd[0][0] + sd[1][0]) / 2, (sd[0][1] + sd[1][1]) / 2];
    return R.kanten.some(function (e) { if (!e.strasse) return false; var en = e.n; return en[0] * n[0] + en[1] * n[1] > 0.7 && distSeg(m, e.a, e.b) < 25; });
  }

  /* ---------- Wohnungsmix ---------- */
  var mixAnteile = { "2.5": 30, "3.5": 40, "4.5": 25, "5.5": 5 };
  function mixRechnen(v) {
    var nwf = NWF[standard], zaehl = { "2.5": 0, "3.5": 0, "4.5": 0, "5.5": 0 }, flaecheSum = 0, ziel = {}, total = 0, summe = 0;
    Object.keys(mixAnteile).forEach(function (x) { summe += mixAnteile[x]; });
    Object.keys(mixAnteile).forEach(function (x) { ziel[x] = summe ? mixAnteile[x] / summe : 0; });
    function naechster() { var best = null, bv = -1e9; Object.keys(ziel).forEach(function (x) { if (!ziel[x]) return; var d = ziel[x] * (total + 1) - zaehl[x]; if (d > bv) { bv = d; best = x; } }); return best || "3.5"; }
    var teile = v.teile.map(function (p) {
      var r = ecken(p), lang = p.L >= p.T, L = lang ? p.L : p.T, T = lang ? p.T : p.L;
      var a0 = lang ? r[0] : r[1], u = lang ? [r[1][0] - r[0][0], r[1][1] - r[0][1]] : [r[2][0] - r[1][0], r[2][1] - r[1][1]], w = lang ? [r[3][0] - r[0][0], r[3][1] - r[0][1]] : [r[0][0] - r[1][0], r[0][1] - r[1][1]];
      var punkt = L < T * 1.35, stock = [];
      for (var g = 0; g < v.n; g++) {
        var felder = [], pos = 0, seit = 0;
        while (pos < L - 0.1) {
          var kernJetzt = punkt ? (felder.length === 1) : (felder.length === 0 && L > 24) || seit >= 24;
          if (kernJetzt && !felder.some(function (f) { return f.typ === "kern" && punkt; })) { var kb = Math.min(5.5, L - pos); felder.push({ typ: "kern", a: pos, b: pos + kb }); pos += kb; seit = 0; continue; }
          var typ = naechster(), br = punkt ? nwf[typ] / (T * 0.5) : nwf[typ] / ((T - 1.2) * 0.88);
          if (pos + br > L + 0.5) { if (L - pos >= 5) br = L - pos; else { if (felder.length) felder[felder.length - 1].b = L; break; } }
          felder.push({ typ: typ, a: pos, b: Math.min(L, pos + br) }); pos += br; seit += br; zaehl[typ]++; total++; flaecheSum += nwf[typ];
        }
        stock.push({ g: g, felder: felder.map(function (f) { var s0 = f.a / L, s1 = f.b / L; f.r = [[a0[0] + u[0] * s0, a0[1] + u[1] * s0], [a0[0] + u[0] * s1, a0[1] + u[1] * s1], [a0[0] + u[0] * s1 + w[0], a0[1] + u[1] * s1 + w[1]], [a0[0] + u[0] * s0 + w[0], a0[1] + u[1] * s0 + w[1]]]; return f; }) });
      }
      return stock;
    });
    if (v.dg && v.dach === "attika") v.teile.forEach(function () { zaehl["4.5"]++; total++; flaecheSum += nwf["4.5"]; });
    if (v.dg && v.dach !== "attika") v.teile.forEach(function (p) { var k2 = Math.max(1, Math.round(p.L * p.T * 0.55 * EFF / nwf["3.5"])); zaehl["3.5"] += k2; total += k2; flaecheSum += k2 * nwf["3.5"]; });
    return { teile: teile, zaehl: zaehl, total: total, nwf: flaecheSum };
  }
  function renderMix(v) {
    var box = root.querySelector(".pz-mix"), m = mixRechnen(v), nwf = NWF[standard];
    var regler = Object.keys(mixAnteile).map(function (x) { return '<label><span><i style="background:' + FARBE[x] + '"></i>' + x + ' Zi.</span><input type="range" min="0" max="80" step="5" value="' + mixAnteile[x] + '" data-typ="' + x + '" aria-label="' + t("Anteil ", "Share ") + x + ' Zi."><b>' + mixAnteile[x] + " %</b></label>"; }).join("");
    var zeilen = Object.keys(m.zaehl).map(function (x) { return m.zaehl[x] ? "<tr><td><i style=\"display:inline-block;width:10px;height:10px;border-radius:2px;background:" + FARBE[x] + ";margin-right:6px\"></i>" + x + " Zi.</td><td>" + m.zaehl[x] + "</td><td>" + nwf[x] + " m²</td><td>" + zahl(m.zaehl[x] * nwf[x]) + " m²</td></tr>" : ""; }).join("");
    box.innerHTML = '<div class="pz-sek"><h4>' + t("4 · Wohnungsmix", "4 · Unit mix") + '</h4><div class="pz-regler">' + regler + "</div>" +
      '<table class="pz-tab"><thead><tr><th>' + t("Typ", "Type") + "</th><th>" + t("Anz.", "No.") + "</th><th>Ø NWF</th><th>Total</th></tr></thead><tbody>" + zeilen + "</tbody><tfoot><tr><td>Total</td><td>" + m.total + "</td><td></td><td>" + zahl(m.nwf) + " m²</td></tr></tfoot></table>" +
      '<p class="muted small">' + t("Geschossfläche ", "Floor area ") + zahl(v.gf) + " m² · NWF/GF " + Math.round(m.nwf / v.gf * 100) + " % · " + t("Ausbaustandard ", "Standard ") + standard + ". " + t("Wohnungen durchgesteckt (Wohnen Süd, Schlafen Nord), Kerne grau. Werte vorläufig – Kalibrierung mit apb-Studien folgt.", "Provisional values.") + '</p><button type="button" class="btn ghost pz-mix-aus">' + t("Zurück zum Volumen", "Back to massing") + "</button></div>";
    box.hidden = false;
    Array.prototype.forEach.call(box.querySelectorAll("input[type=range]"), function (inp) {
      inp.addEventListener("input", function () { mixAnteile[inp.dataset.typ] = +inp.value; inp.nextElementSibling.textContent = inp.value + " %"; });
      inp.addEventListener("change", function () { renderMix(v); });
    });
    box.querySelector(".pz-mix-aus").addEventListener("click", function () { box.hidden = true; zeigeVolumen(v, null); });
    zeigeVolumen(v, m);
  }

  /* ---------- Entwerfen: Volumen weiterbearbeiten ---------- */
  function editor(v, a, k) {
    var box = root.querySelector(".pz-edit"), z = a.zone || {}, R = aktuellR, sel = 0;
    function pruefen() {
      v.fest = true; bewerten(v, a, k, R);
      var hoeheOk = !k.hoehe || v.n * GH <= k.hoehe + 0.01, laengeOk = v.teile.every(function (p) { return Math.max(p.L, p.T) <= (z.laenge || 999) + 0.01; });
      var abstOk = v.teile.every(function (p, i) { return v.teile.every(function (q, j) { return i >= j || abstandTeile(p, q) === 0 || abstandTeile(p, q) >= 2 * (z.ga_k || 5) || anliegend(p, q); }); });
      var chk = [[v.teile.every(R.passt), t("Im zulässigen Baufeld (Grenzabstände, Vorzone, Baulinien)", "Within the permitted envelope")],
        [v.aus <= 1.001, t("Ausnützung ", "Density ") + Math.round(v.aus * 100) + " % " + t("der zulässigen", "of permitted")],
        [hoeheOk, t("Höhe ", "Height ") + zahl(v.n * GH, 1) + " m" + (k.hoehe ? " (max. " + zahl(k.hoehe, 1) + " m)" : "")],
        [laengeOk, t("Gebäudelänge ", "Building length ") + zahl(Math.max.apply(null, v.teile.map(function (p) { return Math.max(p.L, p.T); })), 1) + " m" + (z.laenge ? " (max. " + z.laenge + " m)" : "")],
        [abstOk, t("Abstände zwischen den Baukörpern", "Distances between volumes")]];
      box.querySelector(".pz-chk").innerHTML = chk.map(function (c) { return '<li class="' + (c[0] ? "" : "m") + '">' + esc(c[1]) + "</li>"; }).join("");
      box.querySelector(".pz-edit-kz").textContent = "GF " + zahl(v.gf) + " m² · " + v.n + " " + t("Geschosse", "storeys") + " · Score " + v.score;
      zeigeVolumen(v, null);
    }
    function anliegend(p, q) { return abstandTeile(p, q) < 0.6; }
    function sync() {
      var p = v.teile[sel];
      box.querySelector("[data-e=L]").value = Math.round(p.L); box.querySelector("[data-e=L] + b").textContent = Math.round(p.L) + " m";
      box.querySelector("[data-e=T]").value = Math.round(p.T); box.querySelector("[data-e=T] + b").textContent = Math.round(p.T) + " m";
      box.querySelector("[data-e=n]").value = v.n; box.querySelector("[data-e=n] + b").textContent = v.n;
      box.querySelector("[data-e=ang]").value = Math.round(p.ang * 180 / Math.PI); box.querySelector("[data-e=ang] + b").textContent = Math.round(p.ang * 180 / Math.PI) + "°";
    }
    var teilSel = v.teile.length > 1 ? '<label class="pz-f"><span>' + t("Baukörper", "Volume") + '</span><select class="pz-teil">' + v.teile.map(function (p, i) { return '<option value="' + i + '">' + (i + 1) + "</option>"; }).join("") + "</select></label>" : "";
    var luk = v.dach === "sattel" && (z.dg || 0) ? '<label class="pz-chkbox"><input type="checkbox" class="pz-luk"' + (v.lukarnen ? " checked" : "") + "> " + t("Lukarnen (Südseite, max. 1/3 Fassadenlänge)", "Dormers (south, max. 1/3 of facade)") + "</label>" : "";
    box.innerHTML = '<div class="pz-sek"><h4>' + t("3 · Entwerfen", "3 · Design") + '</h4><p class="muted small">' + t("Volumen weiterentwickeln – Prüfung läuft live mit.", "Refine the massing – checks run live.") + "</p>" + teilSel +
      '<div class="pz-regler">' +
      '<label><span>' + t("Länge", "Length") + '</span><input type="range" data-e="L" min="8" max="' + Math.max(20, (z.laenge || 40) + 10) + '" step="1"><b></b></label>' +
      '<label><span>' + t("Tiefe", "Depth") + '</span><input type="range" data-e="T" min="8" max="24" step="1"><b></b></label>' +
      '<label><span>' + t("Geschosse", "Storeys") + '</span><input type="range" data-e="n" min="1" max="' + (v.nMax + 1) + '" step="1"><b></b></label>' +
      '<label><span>' + t("Drehung", "Rotation") + '</span><input type="range" data-e="ang" min="-180" max="180" step="5"><b></b></label></div>' +
      '<div class="pz-move" role="group" aria-label="' + t("Verschieben", "Move") + '"><button type="button" data-m="0,1">↑ N</button><button type="button" data-m="-1,0">← W</button><button type="button" data-m="1,0">O →</button><button type="button" data-m="0,-1">S ↓</button></div>' +
      '<label class="pz-f"><span>' + t("Dachform", "Roof form") + '</span><select class="pz-dach2"><option value="attika">' + t("Flachdach + Attika", "Flat roof + attic") + '</option><option value="flach">' + t("Flachdach", "Flat roof") + '</option><option value="sattel">' + t("Satteldach", "Pitched roof") + '</option><option value="walm">' + t("Walmdach", "Hipped roof") + "</option></select></label>" + luk +
      '<p class="pz-edit-kz"></p><ul class="pz-gruende pz-chk"></ul><button type="button" class="btn pz-go2">' + t("Weiter → Wohnungsmix", "Next → unit mix") + '<span class="arr"></span></button></div>';
    box.hidden = false;
    box.querySelector(".pz-dach2").value = v.dach;
    sync(); pruefen();
    Array.prototype.forEach.call(box.querySelectorAll("input[type=range]"), function (inp) {
      inp.addEventListener("input", function () {
        var p = v.teile[sel], x = +inp.value;
        if (inp.dataset.e === "L") p.L = x; else if (inp.dataset.e === "T") p.T = x; else if (inp.dataset.e === "n") v.n = x; else p.ang = x * Math.PI / 180;
        sync(); pruefen();
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll(".pz-move button"), function (b) { b.addEventListener("click", function () { var d = b.dataset.m.split(","); var p = v.teile[sel]; p.c = [p.c[0] + d[0] * 1, p.c[1] + d[1] * 1]; pruefen(); }); });
    var ts = box.querySelector(".pz-teil"); if (ts) ts.addEventListener("change", function () { sel = +ts.value; sync(); });
    box.querySelector(".pz-dach2").addEventListener("change", function (e) { v.dach = e.target.value; editor(v, a, k); });
    var lk = box.querySelector(".pz-luk"); if (lk) lk.addEventListener("change", function () { v.lukarnen = lk.checked; pruefen(); });
    box.querySelector(".pz-go2").addEventListener("click", function () { renderMix(v); root.querySelector(".pz-mix").scrollIntoView({ behavior: "smooth", block: "start" }); });
  }

  function renderVolumen(a, k) {
    var box = root.querySelector(".pz-vol"); root.querySelector(".pz-mix").hidden = true; root.querySelector(".pz-edit").hidden = true;
    box.innerHTML = '<div class="pz-sek"><h4>' + t("2 · Volumen", "2 · Massing") + '</h4><p class="muted small">' + t("Strassen und Nachbarbauten werden geladen, Varianten werden gerechnet …", "Loading streets and neighbours, computing options …") + "</p></div>"; box.hidden = false;
    if (!k.ring) return;
    umgebung(k.ring).then(function (umg) {
      var R = raster(a, k, umg); aktuellR = R;
      if (letzteParzelle) zeichneParzelle(a, k);          // mit Strassenseite neu zeichnen
      var vs = generieren(a, k, R);
      if (!vs.length) { box.innerHTML = '<div class="pz-sek"><h4>' + t("2 · Volumen", "2 · Massing") + '</h4><p class="pz-hint warn">' + t("Für diese Parzelle konnten keine Volumen erzeugt werden (Zone nicht erfasst oder Baufeld zu klein).", "No massing options could be generated for this plot.") + "</p></div>"; return; }
      var sk = R.kanten.filter(function (e) { return e.strasse; }).length;
      box.innerHTML = '<div class="pz-sek"><h4>' + t("2 · Volumen", "2 · Massing") + '</h4><p class="muted small">' + t("Zulässiges Baufeld ca. ", "Permitted envelope approx. ") + zahl(R.flaeche) + " m² · " + (sk ? t("Strassenseite erkannt – Vorzone ", "Street side detected – forecourt ") + VORZONE + " m" : t("keine Strasse direkt angrenzend", "no adjacent street")) + '</p><ul class="pz-var">' + vs.map(function (v, i) {
        return '<li><button type="button" data-i="' + i + '" aria-pressed="' + (i === 0) + '"><b>' + esc(v.name) + '</b><span class="sc">' + v.score + "</span><small>" + v.teile.length + " " + t("Baukörper", "volumes") + " · " + v.n + " " + t("Geschosse", "storeys") + (v.dg ? " + " + (v.dach === "attika" ? "Attika" : "DG") : "") + " · GF " + zahl(v.gf) + " m² · " + Math.round(v.aus * 100) + " %</small><span class=\"bar\"><i style=\"width:" + v.score + '%"></i></span></button></li>';
      }).join("") + '</ul><div class="pz-why"></div><button type="button" class="btn pz-go">' + t("Dieses Volumen entwerfen", "Refine this massing") + '<span class="arr"></span></button></div>';
      var gew = vs[0];
      function waehleV(i) { gew = vs[i]; Array.prototype.forEach.call(box.querySelectorAll(".pz-var button"), function (b) { b.setAttribute("aria-pressed", +b.dataset.i === i); }); box.querySelector(".pz-why").innerHTML = gruende(gew); root.querySelector(".pz-mix").hidden = true; root.querySelector(".pz-edit").hidden = true; zeigeVolumen(gew, null); }
      Array.prototype.forEach.call(box.querySelectorAll(".pz-var button"), function (b) { b.addEventListener("click", function () { waehleV(+b.dataset.i); }); });
      box.querySelector(".pz-go").addEventListener("click", function () { var kopie = JSON.parse(JSON.stringify(gew)); editor(kopie, a, k); root.querySelector(".pz-edit").scrollIntoView({ behavior: "smooth", block: "start" }); });
      waehleV(0);
    });
  }

  /* ---------- Ablauf ---------- */
  var status = root.querySelector(".pz-status");
  function meldung(m, fehler) { status.textContent = m || ""; status.classList.toggle("err", !!fehler); }
  function waehle(treffer) {
    root.querySelector(".pz-liste").innerHTML = "";
    root.querySelector(".pz-q").value = treffer.label;
    meldung(t("Parzelle und ÖREB-Kataster werden abgefragt …", "Querying plot and PLR cadastre …"));
    root.querySelector(".pz-res").hidden = true; root.querySelector(".pz-vol").hidden = true; root.querySelector(".pz-mix").hidden = true; root.querySelector(".pz-edit").hidden = true;
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
