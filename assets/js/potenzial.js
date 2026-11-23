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
      '<button type="button" class="btn pz-3d"' + (k.ring ? "" : " disabled") + ">" + t("Baufeld in 3D", "Building envelope in 3D") + '<span class="arr"></span></button></div>';
    var werte = "";
    if (z) {
      werte += zeile(t("Dichte", "Density"), esc(k.dichte), g.artikel ? esc(g.name + ", BZO " + g.artikel) : "");
      werte += zeile(t("Geschosse", "Storeys"), z.vg ? z.vg + " VG" + (z.dg != null ? " + " + z.dg + " DG" : "") + (z.attika ? " / Attika" : "") : (t("frei im Rahmen der Höhen", "free within height limits")));
      werte += zeile(t("Fassadenhöhe", "Facade height"), z.fh ? zahl(z.fh, 1) + " m" + (z.fh_giebel ? " · " + t("giebelseitig", "gable") + " " + zahl(z.fh_giebel, 1) + " m" : "") : (z.gh ? t("Gebäudehöhe ", "Building height ") + zahl(z.gh, 1) + " m" : ""));
      werte += zeile(t("Gebäudelänge", "Building length"), z.laenge ? "max. " + z.laenge + " m" : "");
      werte += zeile(t("Grenzabstand", "Boundary distance"), (z.ga_k ? t("klein ", "small ") + zahl(z.ga_k, 1) + " m" : "") + (z.ga_g ? " · " + t("gross ", "large ") + zahl(z.ga_g, 1) + " m" : ""), g.grosser_abstand ? esc(g.grosser_abstand) : "");
      werte += zeile(t("Grünflächenziffer", "Green space ratio"), z.gfz_gruen ? "min. " + Math.round(z.gfz_gruen * 100) + " %" : "");
      werte += '<div class="pz-sep"></div>';
      werte += zeile(t("Geschossfläche max.", "Max. floor area"), k.gf ? "ca. " + zahl(k.gf) + " m²" : "", k.bm ? t("Baumasse ", "Building volume ") + zahl(k.bm) + " m³ ÷ " + GH + " m" : "");
      werte += zeile(t("Baufeld", "Building envelope"), k.bfA ? "ca. " + zahl(k.bfA) + " m²" : t("nicht berechenbar", "not computable"), k.fuss && k.bfA ? (k.fuss <= k.bfA ? t("Fussabdruck ", "Footprint ") + zahl(k.fuss) + " m² " + t("passt", "fits") : t("Fussabdruck ", "Footprint ") + zahl(k.fuss) + " m² > " + t("Baufeld – Höhe/Länge begrenzt", "envelope – limited by height/length")) : "");
      werte += zeile(t("Wohnungen", "Apartments"), k.whg ? "ca. " + k.whg : "", k.whg ? t("Ø ", "avg ") + zahl(k.schnitt) + " m² NWF · " + t("Ausbaustandard ", "standard ") + standard + " · HNF ≈ " + Math.round(EFF * 100) + " % GF" : "");
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
    res.innerHTML = kopf + '<div class="pz-grid"><div class="pz-werte"><h4>' + t("Baurecht &amp; Kennwerte", "Zoning &amp; key figures") + "</h4>" + werte + "</div>" +
      '<div class="pz-ampel"><h4>' + t("ÖREB-Kataster", "PLR cadastre") + "</h4><ul>" + amp + "</ul><p class=\"muted small\">" + a.nicht + t(" weitere Themen nicht betroffen (z. B. Gewässerraum, Wald, belastete Standorte).", " further topics not affected.") + "</p></div></div>" +
      '<p class="pz-disc">' + t("Ersteinschätzung auf Basis öffentlicher Daten – ersetzt keine Vorabklärung beim Bauamt. Baufeld vereinfacht: Grenzabstände ohne Mehrlängenzuschlag und Baulinien, grosser Abstand vor südorientierten Grenzen.", "Initial assessment based on public data – no substitute for a preliminary enquiry with the building authority.") + "</p>";
    res.hidden = false;
    var b3 = res.querySelector(".pz-3d");
    if (b3) b3.addEventListener("click", function () { zeige3D(a, k); });
  }

  function zeige3D(a, k) {
    var ll = function (r) { var o = []; r.forEach(function (p) { var w = wgs(p[0], p[1]); o.push(w[0], w[1]); }); return o; };
    var c = k.ring.reduce(function (s, p) { return [s[0] + p[0] / k.ring.length, s[1] + p[1] / k.ring.length]; }, [0, 0]), cw = wgs(c[0], c[1]);
    var opts = {
      titel: t("Parzelle ", "Plot ") + a.re.Number + ", " + a.re.MunicipalityName + (a.zoneKey ? " · " + a.zoneKey : ""),
      ort: { lat: cw[1], lon: cw[0] },
      zeichne: function (v, C) {
        var weiss = C.Color.fromCssColorString("#ffffff"), orange = C.Color.fromCssColorString("#f15d30");
        var g = ll(k.ring); g.push(g[0], g[1]);
        v.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(g), width: 3, material: weiss, clampToGround: true } });
        if (k.bf) {
          var h = k.hoehe || 9;
          v.entities.add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(ll(k.bf)), heightReference: C.HeightReference.CLAMP_TO_GROUND,
            extrudedHeight: h, extrudedHeightReference: C.HeightReference.RELATIVE_TO_GROUND, material: orange.withAlpha(0.35), outline: false } });
          var b = ll(k.bf); b.push(b[0], b[1]);
          v.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(b), width: 2, material: orange, clampToGround: true } });
        }
        a.eintraege.forEach(function (e) {
          if (!/Baulinie/i.test(e.code + e.legende) || !e.geo) return;
          e.geo.forEach(function (gg) {
            var l = gg.Line || gg.line; if (!l || !l.coordinates) return;
            var p = []; l.coordinates.forEach(function (q) { var w = wgs(q[0], q[1]); p.push(w[0], w[1]); });
            v.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(p), width: 2, material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString("#e5484d") }), clampToGround: true } });
          });
        });
      }
    };
    if (window.APB3D) return window.APB3D.open(opts);
    var s = document.createElement("script"); s.src = window.APB_3D || ROOT + "assets/js/map3d.js"; s.onload = function () { window.APB3D.open(opts); }; document.head.appendChild(s);
  }

  /* ---------- Ablauf ---------- */
  var status = root.querySelector(".pz-status");
  function meldung(m, fehler) { status.textContent = m || ""; status.classList.toggle("err", !!fehler); }
  function waehle(treffer) {
    root.querySelector(".pz-liste").innerHTML = "";
    root.querySelector(".pz-q").value = treffer.label;
    meldung(t("Parzelle und ÖREB-Kataster werden abgefragt …", "Querying plot and PLR cadastre …"));
    root.querySelector(".pz-res").hidden = true;
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
})();
