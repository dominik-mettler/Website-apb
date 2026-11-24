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
    // Grundnutzung: Eintrag mit Zonencode in Klammern bevorzugen (grösster Flächenanteil); manche Gemeinden liefern Erklärungssätze
    var gn = beschr.filter(function (r) { return /Grundnutzung/.test(r.Theme.SubCode || "") && r.Theme.code === "ch.Nutzungsplanung"; });
    gn.sort(function (x, y) { var cx = /\([^)]{1,14}\)\s*$/.test(txt(x.LegendText)) ? 1 : 0, cy = /\([^)]{1,14}\)\s*$/.test(txt(y.LegendText)) ? 1 : 0; return (cy - cx) || ((y.AreaShare || 0) - (x.AreaShare || 0)); });
    if (gn.length) zoneTxt = txt(gn[0].LegendText);
    var m = zoneTxt.match(/\(([^)]{1,14})\)\s*$/), kurz = m ? m[1] : "";
    if (!kurz) { var m2 = zoneTxt.match(/\b((?:WG|W|L|E|Z|K)\s?\d+(?:[.\/]\d+)?[A-Z]?)\b/); kurz = m2 ? m2[1] : zoneTxt; }
    if (zoneTxt.length > 70) zoneTxt = zoneTxt.slice(0, 68) + " …";
    // mehrere Zonen auf der Parzelle: Anteile merken
    var teilzonen = gn.map(function (r) {
      var lt = txt(r.LegendText), mm = lt.match(/\(([^)]{1,14})\)\s*$/), code = mm ? mm[1] : "", zz = null, kk = "";
      if (gem && code) Object.keys(gem.zonen).forEach(function (k2) { if (!zz && (norm(k2) === norm(code) || norm(k2) === norm(code).replace(/g$/, ""))) { zz = gem.zonen[k2]; kk = k2; } });
      var ringe = []; (r.Geometry || []).forEach(function (g2) { var sf = g2.Surface || g2.surface; if (!sf || !sf.coordinates) return; if (sf.type === "MultiPolygon") sf.coordinates.forEach(function (pl) { ringe.push(pl[0]); }); else ringe.push(sf.coordinates[0]); });
      return { text: lt, code: code || lt.slice(0, 30), anteil: r.AreaShare || 0, zone: zz, key: kk, ringe: ringe };
    }).filter(function (x, i, arr) { return arr.findIndex(function (y) { return y.code === x.code; }) === i; });
    if (gem) Object.keys(gem.zonen).forEach(function (k) { if (norm(k) === norm(kurz)) { zone = gem.zonen[k]; zoneKey = k; } });
    if (gem && !zone) Object.keys(gem.zonen).forEach(function (k) { if (!zone && norm(k) === norm(kurz).replace(/g$/, "")) { zone = gem.zonen[k]; zoneKey = k; } });
    // Hauptzone: grösster Anteil unter den erfassten Bauzonen mit Wohnen (z. B. Dorfzone neben Landwirtschaftszone)
    var bau = teilzonen.filter(function (x) { return x.zone && x.zone.wohnen !== false; }).sort(function (x, y) { return y.anteil - x.anteil; })[0];
    if (bau && (!zone || zone.wohnen === false)) { zone = bau.zone; zoneKey = bau.key; zoneTxt = bau.text; }
    var eintraege = beschr.map(function (r) {
      var leg = txt(r.LegendText);
      return { thema: txt(r.Theme.Text), code: r.Theme.code || r.Theme.Code || "", sub: r.Theme.SubCode || "", legende: leg, farbe: ampelFarbe(r.Theme.code || "", r.Theme.SubCode, leg),
               anteil: r.PartInPercent, laenge: r.LengthShare, geo: r.Geometry, docs: (r.LegalProvisions || []).map(function (d) { return { t: txt(d.Title), u: txt(d.TextAtWeb) }; }) };
    });
    // Doppelte (gleiche Legende) zusammenfassen
    var seen = {}; eintraege = eintraege.filter(function (e) { var k = e.code + e.legende; if (seen[k]) return false; seen[k] = 1; return true; });
    var grenze = ((re.Limit || re.limit || {}).coordinates || [])[0] || [];
    if (re.limit && re.limit.type === "MultiPolygon") grenze = re.limit.coordinates[0][0];
    var nichtBau = teilzonen.some(function (x) { return !x.zone || x.zone.wohnen === false; });
    var bauRinge = teilzonen.length > 1 && nichtBau ? [].concat.apply([], teilzonen.filter(function (x) { return x.zone && x.zone.wohnen !== false; }).map(function (x) { return x.ringe; })) : null;
    return { datum: ex.CreationDate, teilzonen: teilzonen, bauRinge: bauRinge && bauRinge.length ? bauRinge : null, re: re, gem: gem, zone: zone, zoneKey: zoneKey, zoneTxt: zoneTxt, eintraege: eintraege, grenze: grenze, nicht: (ex.NotConcernedTheme || []).length, pdf: "https://maps.zh.ch/oereb/v2/extract/pdf?EGRID=" + re.EGRID };
  }
  function kennwerte(a) {
    var A = a.re.LandRegistryArea, z = a.zone || {}, k = { A: A };
    var ring = a.grenze.length ? vereinfachen(a.grenze) : null;
    k.ring = ring;
    if (ring && (z.ga_k || z.ga_g)) {
      k.bf = baufeld(ring, z.ga_k || z.ga_g, z.ga_g || null);
      if (k.bf) k.bfA = flaeche(k.bf);
    }
    if (z.wohnen === false) { k.keinWohnen = true; return k; }
    k.hoehe = z.fh || z.gh || (z.vg ? z.vg * GH : null);
    k.geschosse = z.vg || (k.hoehe ? Math.max(1, Math.floor(k.hoehe / GH)) : null);
    if (z.az) { k.gf = z.az * A; k.dichte = "AZ " + Math.round(z.az * 100) + " %"; }
    else if (z.bmz) { k.bm = z.bmz * A; k.gf = k.bm / GH; k.dichte = "BMZ " + z.bmz + " m³/m²"; }
    else if (z.uez && k.geschosse) { k.gf = z.uez * A * k.geschosse; k.dichte = "ÜZ " + Math.round(z.uez * 100) + " %"; }
    else if (z.gf_modus === "baufeld" && k.bfA && k.geschosse) {     // Kernzonen: keine Dichteziffer – Baufeld × Geschosse als Obergrenze
      k.gf = k.bfA * k.geschosse; k.baufeldModus = true; k.dichte = t("keine Ziffer – Grundmasse", "no ratio – basic dimensions");
    }
    // Parzelle in mehreren Zonen: Geschossfläche je Zone nach Flächenanteil (Nichtbauzonen zählen 0)
    if (a.teilzonen && a.teilzonen.length > 1 && k.gf) {
      var summe = 0, teile2 = [];
      a.teilzonen.forEach(function (tz) {
        var zz = tz.zone, gfT = 0;
        if (zz && zz.wohnen !== false) gfT = zz.az ? zz.az * tz.anteil : zz.bmz ? zz.bmz * tz.anteil / GH : (zz.gf_modus === "baufeld" && k.bfA ? k.bfA * (tz.anteil / A) * (zz.vg || k.geschosse || 1) : 0);
        summe += gfT; teile2.push({ code: tz.key || tz.code, anteil: tz.anteil, gf: gfT, erfasst: !!zz });
      });
      k.gf = summe; k.teilzonen = teile2; k.dichte = t("anteilig aus ", "weighted from ") + teile2.length + t(" Zonen", " zones");
    }
    if (k.gf) {
      k.hnf = k.gf * EFF;
      var nwf = NWF[standard], schnitt = 0; Object.keys(MIX).forEach(function (t2) { schnitt += MIX[t2] * nwf[t2]; });
      k.whg = Math.max(1, Math.floor(k.hnf / schnitt)); k.schnitt = schnitt;
      if (k.geschosse) k.fuss = k.gf / k.geschosse;
    }
    return k;
  }

  /* ---------- Erklärungen zum Baurecht (Info-Symbol) ---------- */
  var INFO = {
    az: t("Ausnützungsziffer (AZ): Verhältnis der anrechenbaren Geschossfläche (Vollgeschosse sowie anrechenbare Dach- und Untergeschosse) zur anrechenbaren Grundstücksfläche. Beispiel: AZ 50 % auf 1'000 m² ergibt 500 m² Geschossfläche. Grundlage: § 255 PBG, Wert aus der BZO der Gemeinde.", "Floor area ratio: chargeable floor area divided by plot area (§ 255 PBG)."),
    bmz: t("Baumassenziffer (BMZ): zulässiges oberirdisches Bauvolumen in m³ pro m² anrechenbarer Grundstücksfläche. Beispiel: BMZ 2.0 auf 1'000 m² ergibt 2'000 m³ – bei rund 3 m Geschosshöhe etwa 670 m² Geschossfläche. Grundlage: § 258 PBG, Wert aus der BZO.", "Building volume ratio: above-ground volume per m² of plot (§ 258 PBG)."),
    uez: t("Überbauungsziffer (ÜZ): Anteil der Grundstücksfläche, der von Gebäuden überdeckt werden darf (Fussabdruck). Grundlage: § 256 PBG, Wert aus der BZO.", "Site coverage ratio (§ 256 PBG)."),
    geschosse: t("Vollgeschosse (VG) zählen voll. Dachgeschosse (DG) liegen im Dachraum eines Schrägdachs, Attikageschosse sind auf dem Flachdach von der Fassade zurückversetzt. Anrechenbare Untergeschosse ragen deutlich über das Terrain. Die zulässige Zahl legt die BZO fest (Definitionen §§ 275 ff. PBG).", "Full storeys, attic/penthouse and basement storeys as defined in §§ 275 ff. PBG and the municipal code."),
    fh: t("Fassadenhöhe: grösster Höhenunterschied zwischen dem massgebenden Terrain und der Schnittlinie der Fassade mit der Dachfläche (Harmonisierung der Baubegriffe, IVHB). Giebelseitig bei Schrägdächern und bei Attikageschossen gelten höhere Werte. Ältere BZO verwenden noch die Gebäudehöhe. Grundlage: PBG/ABV, Werte aus der BZO.", "Facade height per harmonised building terms (IVHB)."),
    laenge: t("Gebäudelänge: längere Seite des kleinsten Rechtecks, welches das Gebäude umschliesst. Die BZO begrenzt sie je Zone; bei Arealüberbauungen ist oft mehr möglich.", "Building length: longer side of the smallest enclosing rectangle; limited per zone."),
    abstand: t("Grenzabstand: Mindestabstand des Gebäudes zur Parzellengrenze. Viele Gemeinden unterscheiden einen grossen Grundabstand vor der Hauptwohnseite (meist gegen Süden) und einen kleinen an den übrigen Seiten. Bei langen Fassaden kommt ein Mehrlängenzuschlag dazu. Grundlage: §§ 260 ff. PBG, ABV und BZO.", "Boundary distance: §§ 260 ff. PBG and municipal code; larger distance in front of the main (south) facade."),
    gruen: t("Grünflächenziffer: Mindestanteil der Grundstücksfläche, der als natürliche oder bepflanzte Fläche erhalten bleiben muss (keine Gebäude, Plätze oder Abstellflächen). Grundlage: PBG, Wert aus der BZO.", "Minimum share of green space on the plot."),
    gf: t("Maximale Geschossfläche: aus Dichteziffer und Grundstücksfläche abgeleitet. Das ist das zentrale Mass für das Potenzial der Parzelle – Arealüberbauungs- oder Gewerbeboni sind nicht eingerechnet.", "Maximum floor area derived from the density ratio and plot area."),
    baufeld: t("Baufeld: Fläche, auf der ein Gebäude stehen darf – Parzelle abzüglich Grenzabstände, Vorzone zur Strasse (Annahme 6 m) und Flächen vor Baulinien. Vereinfachte Ersteinschätzung (ohne Mehrlängenzuschlag, Näherbaurechte oder Gebäudeabstände zu Nachbarn).", "Permitted building envelope (simplified)."),
    whg: t("Wohnungsschätzung: Hauptnutzfläche rund 78 % der Geschossfläche, geteilt durch die mittlere Wohnungsgrösse des gewählten Ausbaustandards (Mix 2.5 / 3.5 / 4.5 / 5.5 Zi.). Mindestflächen nach dem Wohnungs-Bewertungs-System (WBS) des Bundesamts für Wohnungswesen.", "Estimate based on usable area and average unit size."),
    standard: t("Ausbaustandard: bestimmt die Wohnungsgrössen pro Typ (einfach – mittel – gehoben, z. B. 3.5 Zi. 70 / 82 / 100 m²). Das Volumen und die zulässige Geschossfläche ändern sich nicht – aber bei gleicher Fläche gibt es mit «einfach» mehr und kleinere, mit «gehoben» weniger und grössere Wohnungen. Er wirkt auf die Wohnungsschätzung, den Wohnungsmix und das PDF. Die Werte sind vorläufig und werden mit apb-Studien kalibriert.", "Fit-out standard sets unit sizes per type; it changes the number of apartments, not the massing."),
    score: t("Punktzahl der Setzung (0–100): Bewertung der Variante nach festen Regeln – Ausnützung der zulässigen Geschossfläche (25 %), Bezug zur Strasse mit Vorplatz und Zugang (16 %), Luft zu den Nachbarn (14 %), Lage im Norden der Parzelle (12 %), Hauptfassaden nach Süden (13 %), besonnter Aussenraum im Süden (12 %), Kompaktheit (8 %). Höher ist besser; die Punktzahl vergleicht Varianten untereinander und ist keine Bewilligungsaussage.", "Siting score (0–100) from fixed weighted rules; compares options, not a permit statement."),
    areal: t("Arealüberbauung: Bei grösseren zusammenhängenden Flächen und besonders guter Gestaltung erlaubt die BZO Abweichungen von der Regelbauweise, etwa mehr Ausnützung, Geschosse oder Gebäudelänge. Grundlage: §§ 69 ff. PBG.", "Special development with bonuses (§§ 69 ff. PBG).")
  };
  var INFO_OEREB = [
    [/Baulinie/i, t("Baulinien begrenzen die Überbauung gegenüber Strassen, Wegen oder anderen Anlagen. Zwischen Baulinie und Verkehrsanlage dürfen grundsätzlich keine Gebäude erstellt werden (§§ 96 ff. PBG).", "Building lines limit construction towards streets (§§ 96 ff. PBG).")],
    [/Vorwirkung/i, t("Eine neue Planung ist festgesetzt, aber noch nicht rechtskräftig. Sie gilt bereits mit Vorwirkung: Bauvorhaben dürfen ihr nicht widersprechen. Für das Potenzial sind deshalb die neuen Regeln massgebend.", "A new plan applies in advance (pre-effect).")],
    [/Empfindlichkeit|Laerm/i, t("Lärmempfindlichkeitsstufe nach Lärmschutz-Verordnung (LSV): ES II für reine Wohnzonen (strengere Grenzwerte), ES III für gemischte Zonen, ES IV für Industrie. An lärmigen Lagen braucht jede Wohnung eine ruhige Seite.", "Noise sensitivity level under the Noise Abatement Ordinance (LSV).")],
    [/Arealüberbauung/i, t("Arealüberbauung zulässig: Ab einer Mindestfläche (BZO) sind Boni gegenüber der Regelbauweise möglich – bei besonders guter Gestaltung (§§ 69 ff. PBG).", "Special development permitted.")],
    [/Grundnutzung/i, t("Grundnutzung: Die Zone des Zonenplans. Welche Masse gelten (Dichte, Höhe, Abstände), regelt die Bau- und Zonenordnung (BZO) der Gemeinde.", "Basic zoning; rules set by the municipal code.")],
    [/ueberlagernd|überlagernd/i, t("Überlagernde Festlegung: ergänzt die Grundnutzung, z. B. Gestaltungsplan, Kernzonenplan, Aussichtsschutz oder Arealüberbauung.", "Overlay designation.")],
    [/Belastete/i, t("Belasteter Standort (Altlasten): Bei Bauvorhaben sind Abklärungen und allenfalls Sanierungen nötig.", "Contaminated site.")],
    [/Grundwasser/i, t("Grundwasserschutz: Einschränkungen für Untergeschosse, Bohrungen (Erdsonden) und gewisse Nutzungen.", "Groundwater protection.")],
    [/Gewaesser|Gewässer/i, t("Gewässerraum: Freihaltebereich entlang von Gewässern, in dem grundsätzlich nur standortgebundene Anlagen zulässig sind.", "Riparian zone.")],
    [/Wald/i, t("Waldabstand: Gegenüber Wald gilt in der Regel ein Abstand von 30 m (Waldabstandslinien).", "Forest distance.")]
  ];
  function infoOereb(e) { var x = INFO_OEREB.filter(function (r) { return r[0].test(e.code + " " + e.sub + " " + e.legende + " " + e.thema); })[0]; return x ? x[1] : ""; }
  function iKnopf(txt) { return txt ? '<button type="button" class="pz-i" aria-expanded="false" aria-label="' + t("Erklärung", "Explanation") + '">i</button><span class="pz-info" hidden>' + esc(txt) + "</span>" : ""; }
  root.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".pz-i"); if (!b) return;
    var inf = b.nextElementSibling && b.nextElementSibling.classList.contains("pz-info") ? b.nextElementSibling : (b.closest(".pz-kv") || b.parentNode).querySelector(".pz-info"), auf = b.getAttribute("aria-expanded") !== "true";
    if (!inf) return;
    b.setAttribute("aria-expanded", auf); inf.hidden = !auf;
  });

  /* ---------- Rechenweg und Annahmen (Nachvollziehbarkeit) ---------- */
  function rechenweg(a, k, v) {
    var z = a.zone || {}, g = a.gem || {}, A = a.re.LandRegistryArea, R = aktuellR, rows = [];
    var dat = a.datum ? new Date(a.datum).toLocaleDateString("de-CH") : "";
    rows.push([t("Grundstücksfläche", "Plot area"), zahl(A) + " m²", "amt", t("Grundbuchfläche gemäss ÖREB-Auszug", "Land register area (PLR extract)") + (dat ? " vom " + dat : "")]);
    rows.push([t("Zone", "Zone"), a.zoneTxt || "–", "amt", t("ÖREB-Kataster Kanton Zürich, Grundnutzung", "PLR cadastre, basic zoning")]);
    if (a.zone) rows.push([t("Zonenwerte", "Zoning values"), "BZO " + (g.name || "") + ((z.artikel || g.artikel) ? ", " + (z.artikel || g.artikel) : ""), "bzo", (g.stand || "") + " · " + (g.quelle || "")]);
    if (k.gf) {
      var f = z.az ? zahl(A) + " m² × AZ " + Math.round(z.az * 100) + " % = " + zahl(k.gf) + " m²"
        : z.bmz ? zahl(A) + " m² × BMZ " + z.bmz + " = " + zahl(k.bm) + " m³ ÷ " + GH + " m = " + zahl(k.gf) + " m²"
        : k.baufeldModus ? t("Baufeld ", "Envelope ") + zahl(k.bfA) + " m² × " + k.geschosse + " VG = " + zahl(k.gf) + " m² (" + t("Kernzone ohne Ziffer", "core zone without ratio") + ")"
        : zahl(A) + " m² × ÜZ " + Math.round(z.uez * 100) + " % × " + k.geschosse + " " + t("Geschosse", "storeys") + " = " + zahl(k.gf) + " m²";
      if (k.teilzonen) f = k.teilzonen.map(function (x) { return x.code + ": " + zahl(x.gf) + " m²"; }).join(" + ") + " = " + zahl(k.gf) + " m²";
      rows.push([t("Geschossfläche max.", "Max. floor area"), f, "calc", (k.teilzonen ? t("anteilig nach Zonenflächen (ÖREB); ", "weighted by zone areas; ") : "") + t("ohne Boni (Arealüberbauung, Gewerbe)", "without bonuses")]);
    }
    if (k.hoehe) rows.push([t("Geschosse im Modell", "Storeys in model"), "min(" + (z.vg ? z.vg + " VG" : "–") + (z.fh ? "; " + zahl(z.fh, 1) + " m ÷ " + GH + " m" : "") + ")", "calc", t("Vollgeschosse aus BZO, begrenzt durch die Fassadenhöhe", "full storeys limited by facade height")]);
    rows.push([t("Geschosshöhe", "Storey height"), GH.toFixed(1) + " m", "ann", t("Rohbau, für Höhe und Baumasse", "for height and volume")]);
    if (R) rows.push([t("Zulässiges Baufeld", "Permitted envelope"), "ca. " + zahl(R.flaeche) + " m²", "calc", t("Parzelle minus Grenzabstand ", "Plot minus boundary distance ") + (z.ga_k ? zahl(z.ga_k, 1) + " m" : "–") + (z.ga_g ? t(" / gross ", " / large ") + zahl(z.ga_g, 1) + t(" m vor südorientierten Grenzen", " m in front of south-facing boundaries") : "") + t(", Vorzone zur Strasse, hinter Baulinien (ÖREB)", ", forecourt to the street, behind building lines (PLR)")]);
    rows.push([t("Vorzone zur Strasse", "Street forecourt"), (z.vorzone != null ? z.vorzone : VORZONE) + " m", "ann", t("Abstand des Gebäudes zur Strassengrenze (Zugang, Vorplatz); Baulinien gehen vor", "building lines take precedence")]);
    rows.push([t("Gebäudetiefe", "Building depth"), TIEFE + " m · " + t("Punkthaus ", "point block ") + PUNKT + " × " + PUNKT + " m", "ann", t("Startwerte des Generators, im Entwurf veränderbar", "generator start values")]);
    rows.push([t("Dach-/Attikageschoss", "Attic storey"), "60 % (Attika) / 55 % (DG)", "ann", t("Anteil der Geschossfläche des darunterliegenden Geschosses", "share of the storey below")]);
    rows.push([t("Hauptnutzfläche", "Usable area"), "GF × " + Math.round(EFF * 100) + " %", "ann", t("Abzug für Wände, Erschliessung, Technik", "deduction for walls, circulation")]);
    var nw = NWF[standard];
    rows.push([t("Wohnungsgrössen", "Unit sizes"), "2.5: " + nw["2.5"] + " · 3.5: " + nw["3.5"] + " · 4.5: " + nw["4.5"] + " · 5.5: " + nw["5.5"] + " m²", "ann", t("Ausbaustandard ", "Standard ") + standard + t("; Mindestflächen gemäss WBS 2015 (BWO), Werte bis zur Kalibrierung mit apb-Studien vorläufig", "; minima per WBS 2015")]);
    rows.push([t("Wohnungsmix (Start)", "Unit mix (start)"), "30 / 40 / 25 / 5 %", "ann", t("einstellbar", "adjustable")]);
    if (v && v.bestandN) rows.push([t("Aufstockung", "Extension"), t("Bestand ca. ", "Existing approx. ") + zahl(v.gf - v.neuGF) + " m² + " + zahl(v.fuss) + " m² × (" + (v.n - v.bestandN) + (v.dg ? " + " + v.dg : "") + ") = " + zahl(v.gf) + " m²", "calc", t("Bestandesfläche aus GWR (Grundfläche × Geschosse); zulässige Zusatzgeschosse aus Vollgeschosszahl, Höhe und Ausnützung", "existing area from the federal register")]);
    else if (v) rows.push([t("Gewähltes Volumen", "Selected massing"), zahl(v.fuss) + " m² × (" + v.n + (v.dg ? " + " + v.dg : "") + ") = " + zahl(v.gf) + " m²", "calc", Math.round(v.aus * 100) + t(" % der zulässigen Geschossfläche", " % of permitted floor area")]);
    return rows;
  }
  var NICHT_BERUECKSICHTIGT = [
    t("Boni für Arealüberbauung oder Gewerbe (nur als Hinweis)", "Bonuses for special development or commercial use (note only)"),
    t("Mehrlängenzuschlag beim Grenzabstand, Näherbaurechte, Gebäudeabstände zu Nachbarbauten", "Extra-length surcharge, proximity rights, distances to neighbouring buildings"),
    t("Kernzonen, Zonen für öffentliche Bauten, Gestaltungs- und Sondernutzungspläne", "Core zones, public building zones, design plans"),
    t("Lärmgrenzwerte, Parkierung, Gewässer- und Waldabstand (nur als ÖREB-Hinweis)", "Noise limits, parking, water and forest distances (PLR note only)"),
    t("Gestaltungsvorschriften (Dachform, Materialien, Einordnung) und Ermessensentscheide der Baubehörde", "Design rules and discretionary decisions of the authority")
  ];
  function rechenwegHTML(a, k, v) {
    return '<details class="pz-rw"><summary>' + t("Rechenweg und Annahmen", "Calculation and assumptions") + "</summary>" +
      '<table class="pz-tab pz-rw-tab"><tbody>' + rechenweg(a, k, v).map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + " " + marke(r[2]) + "<small>" + esc(r[3]) + "</small></td></tr>"; }).join("") + "</tbody></table>" +
      '<p class="pz-rw-h">' + t("Nicht berücksichtigt", "Not considered") + "</p><ul class=\"pz-rw-l\">" + NICHT_BERUECKSICHTIGT.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></details>";
  }
  function rwAktualisieren(v) {
    var box = root.querySelector(".pz-rw-box"); if (!box || !aktuell) return;
    var offen = box.querySelector("details") && box.querySelector("details").open;
    box.innerHTML = rechenwegHTML(aktuell, aktuell.k, v); if (offen) box.querySelector("details").open = true;
  }
  function hinweisKasten() {
    return '<div class="pz-was"><b>' + t("Ersteinschätzung – keine Bewilligungsprüfung", "Initial assessment – not a permit review") + "</b><p>" +
      t("Das Werkzeug rechnet mit festen, offengelegten Regeln (keine KI-Schätzung): amtliche Daten live, Zonenwerte aus der BZO der Gemeinde, dazu klar markierte Annahmen. Es ersetzt weder die Prüfung durch die Architektin oder den Architekten noch eine Vorabklärung beim Bauamt.", "Fixed, disclosed rules (no AI estimate): official data live, zoning values from the municipal code and clearly marked assumptions. Not a substitute for an architect's review or a preliminary enquiry.") +
      '</p><p class="pz-legende-q">' + ["amt", "bzo", "calc", "ann"].map(marke).join(" ") + "</p></div>";
  }

  /* ---------- Darstellung ---------- */
  var QUELLE = { amt: [t("amtlich", "official"), t("Live aus amtlichen Daten (amtliche Vermessung / ÖREB-Kataster Kanton Zürich)", "Live official data")],
    bzo: [t("BZO-Tabelle", "BZO table"), t("Aus der Bau- und Zonenordnung der Gemeinde übertragen (Artikel und Stand siehe Quelle) – noch nicht unabhängig gegengeprüft", "Transcribed from the municipal building code – not yet independently verified")],
    ann: [t("Annahme", "assumption"), t("Vom Tool gesetzte Annahme – siehe «Rechenweg und Annahmen»", "Assumption set by the tool")],
    calc: [t("berechnet", "calculated"), t("Aus den obigen Werten berechnet – Formel siehe «Rechenweg und Annahmen»", "Calculated from the values above")] };
  function marke(src) { return src ? '<em class="pz-q pz-q-' + src + '" title="' + esc(QUELLE[src][1]) + '">' + esc(QUELLE[src][0]) + "</em>" : ""; }
  function zeile(l, v, q, inf, src) { var ik = iKnopf(inf), cut = ik.indexOf("<span"); if (src && v) v = v + " " + marke(src); return v == null || v === "" ? "" : '<div class="pz-kv"><span>' + esc(l) + (cut > 0 ? ik.slice(0, cut) : "") + "</span><b>" + v + "</b>" + (q ? "<small>" + q + "</small>" : "") + (cut > 0 ? ik.slice(cut) : "") + "</div>"; }
  function render(a, k) {
    var z = a.zone, g = a.gem, re = a.re;
    var res = root.querySelector(".pz-res");
    var kopf = '<div class="pz-kopf"><div><span class="eyebrow">' + t("Parzelle", "Plot") + " " + esc(re.Number) + " · " + esc(re.MunicipalityName) + '</span><h3>' + esc(a.zoneTxt || t("Zone unbekannt", "Zone unknown")) + "</h3>" +
      '<p class="muted small">EGRID ' + esc(re.EGRID) + " · " + zahl(re.LandRegistryArea) + " m² " + marke("amt") + ' · <a href="' + a.pdf + '" target="_blank" rel="noopener">' + t("offizieller ÖREB-Auszug (PDF)", "official PLR extract (PDF)") + " ↗</a></p></div>" +
      "</div>";
    var werte = "";
    if (z && k.keinWohnen) { werte += '<p class="pz-hint warn">' + esc(z.hinweis || t("In dieser Zone sind keine Wohnungen vorgesehen.", "No housing in this zone.")) + "</p>"; } else if (z) {
      werte += zeile(t("Dichte", "Density"), esc(k.dichte), (z.artikel || g.artikel) ? esc(g.name + ", BZO " + (z.artikel || g.artikel)) : "", (z.az ? INFO.az : z.bmz ? INFO.bmz : INFO.uez), "bzo");
      werte += zeile(t("Geschosse", "Storeys"), z.vg ? z.vg + " VG" + (z.dg != null ? " + " + z.dg + " DG" : "") + (z.attika ? " / Attika" : "") : (t("frei im Rahmen der Höhen", "free within height limits")), INFO.geschosse, "bzo");
      werte += zeile(t("Fassadenhöhe", "Facade height"), z.fh ? zahl(z.fh, 1) + " m" + (z.fh_giebel ? " · " + t("giebelseitig", "gable") + " " + zahl(z.fh_giebel, 1) + " m" : "") : (z.gh ? t("Gebäudehöhe ", "Building height ") + zahl(z.gh, 1) + " m" : ""), INFO.fh, "bzo");
      werte += zeile(t("Gebäudelänge", "Building length"), z.laenge ? "max. " + z.laenge + " m" : "", INFO.laenge, "bzo");
      werte += zeile(t("Grenzabstand", "Boundary distance"), (z.ga_k ? (z.ga_g ? t("klein ", "small ") : t("Grundabstand ", "basic ")) + zahl(z.ga_k, 1) + " m" + (z.ga_max ? " (max. " + zahl(z.ga_max, 1) + " m)" : "") : "") + (z.ga_g ? " · " + t("gross ", "large ") + zahl(z.ga_g, 1) + " m" : ""), g.grosser_abstand ? esc(g.grosser_abstand) : "", INFO.abstand, "bzo");
      werte += zeile(t("Grünflächenziffer", "Green space ratio"), z.gfz_gruen ? "min. " + Math.round(z.gfz_gruen * 100) + " %" : "", INFO.gruen, "bzo");
      werte += '<div class="pz-sep"></div>';
      werte += zeile(t("Geschossfläche max.", "Max. floor area"), k.gf ? "ca. " + zahl(k.gf) + " m²" : "", k.bm ? t("Baumasse ", "Building volume ") + zahl(k.bm) + " m³ ÷ " + GH + " m" : "", INFO.gf, "calc");
      werte += zeile(t("Baufeld", "Building envelope"), k.bfA ? "ca. " + zahl(k.bfA) + " m²" : t("nicht berechenbar", "not computable"), k.fuss && k.bfA ? (k.fuss <= k.bfA ? t("Fussabdruck ", "Footprint ") + zahl(k.fuss) + " m² " + t("passt", "fits") : t("Fussabdruck ", "Footprint ") + zahl(k.fuss) + " m² > " + t("Baufeld – Höhe/Länge begrenzt", "envelope – limited by height/length")) : "", INFO.baufeld, "calc");
      werte += zeile(t("Wohnungen", "Apartments"), k.whg ? "ca. " + k.whg : "", k.whg ? t("Ø ", "avg ") + zahl(k.schnitt) + " m² NWF · " + t("Ausbaustandard ", "standard ") + standard + " · HNF ≈ " + Math.round(EFF * 100) + " % GF" : "", INFO.whg, "ann");
      if (k.teilzonen) werte += '<p class="pz-hint warn">' + t("Die Parzelle liegt in mehreren Zonen: ", "The plot lies in several zones: ") + k.teilzonen.map(function (x) { return esc(x.code) + " " + zahl(x.anteil) + " m²" + (x.erfasst ? " → " + zahl(x.gf) + " m² GF" : t(" (nicht erfasst / keine Bauzone: 0)", " (not covered: 0)")); }).join(" · ") + t(". Geschossfläche anteilig gerechnet; Höhe, Geschosse und Abstände nach der Hauptzone ", ". Floor area weighted; height and distances per main zone ") + esc(a.zoneKey || "") + ".</p>";
      if (z.hinweis) werte += '<p class="pz-hint' + (z.wohnen === false ? " warn" : "") + '">' + esc(z.hinweis) + "</p>";
      if (k.baufeldModus) werte += '<p class="pz-hint">' + t("Ohne Dichteziffer rechnet das Tool die Kapazität aus Baufeld × zulässige Vollgeschosse. Die tatsächlich bewilligbare Fläche hängt in der Kernzone stark von Gestaltung, Kernzonenplan und Ermessen der Baubehörde ab.", "Without a density ratio the tool uses envelope × storeys; in core zones the authority's discretion matters.") + "</p>";
      if (z.az_bonus && g.gewerbe_bonus) werte += '<p class="pz-hint">' + esc(g.gewerbe_bonus) + "</p>";
      if (g.areal && (re.LandRegistryArea >= 2500 || a.eintraege.some(function (e) { return /Arealüberbauung zulässig/i.test(e.legende); }))) werte += '<p class="pz-hint">' + t("Arealüberbauung: ", "Special development: ") + esc(g.areal) + iKnopf(INFO.areal) + "</p>";
      if (/ENTWURF|OFFEN/.test(g.stand)) werte += '<p class="pz-hint warn">' + esc(g.stand) + "</p>";
      werte += '<p class="muted small">' + t("Quelle: ", "Source: ") + '<a href="' + esc(g.quelle) + '" target="_blank" rel="noopener">BZO ' + esc(g.name) + "</a> · " + esc(g.stand) + "</p>";
    } else {
      werte = '<p class="pz-hint warn">' + (a.gem ? t("Diese Zone ist noch nicht in unserer Tabelle (nur Wohnzonen erfasst). ", "This zone is not yet in our table (residential zones only). ")
        : t("Diese Gemeinde ist noch nicht in unserer Tabelle. Erfasst: Uster, Gossau, Volketswil, Greifensee, Schwerzenbach, Fällanden, Mönchaltorf, Egg, Maur, Wetzikon, Grüningen, Pfäffikon.", "This municipality is not yet in our table.")) +
        t(" Der ÖREB-Auszug rechts gilt trotzdem.", " The PLR extract still applies.") + "</p>";
    }
    var amp = a.eintraege.map(function (e) {
      var d = e.docs.filter(function (x) { return x.u; }).slice(0, 2).map(function (x) { return '<a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.t || "Dokument") + " ↗</a>"; }).join(" · ");
      return '<li class="a-' + e.farbe + '"><i aria-hidden="true"></i><div><b>' + esc(e.legende) + iKnopf(infoOereb(e)) + "</b><small>" + esc(e.thema) + (e.anteil && e.anteil < 100 ? " · " + e.anteil + " %" : "") + (e.laenge ? " · " + e.laenge + " m" : "") + "</small>" + (d ? "<small>" + d + "</small>" : "") + "</div></li>";
    }).join("");
    res.innerHTML = kopf + hinweisKasten() + '<div class="pz-grid"><div class="pz-werte"><h4>' + t("1 · Baurecht &amp; Kennwerte", "1 · Zoning &amp; key figures") + "</h4>" + werte + "</div>" +
      '<div class="pz-ampel"><h4>' + t("ÖREB-Kataster", "PLR cadastre") + " " + marke("amt") + "</h4><ul>" + amp + "</ul><p class=\"muted small\">" + a.nicht + t(" weitere Themen nicht betroffen (z. B. Gewässerraum, Wald, belastete Standorte).", " further topics not affected.") + "</p></div></div>" +
      '<div class="pz-rw-box"></div>';
    res.hidden = false;
    rwAktualisieren(null);
    aktuellR = null; letzteParzelle = null; letzte = null;
    zeichneParzelle(a, k);
    renderVolumen(a, k);
  }

  /* ---------- 3D (eingebettet, ganze Fläche rechts) ---------- */
  var V3 = null, C3 = null, ds = null, karteBereit = null, bodenH = 450, letzte = null, aktuellR = null, letzteParzelle = null, aktuellUmg = null, gwrHoehen = null, gwrAttr = null;
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
      ds.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(g), width: 3, material: weiss, clampToGround: true } })._pzArbeit = 1;
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
              ds.entities.add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])), material: orange.withAlpha(0.22), classificationType: C.ClassificationType.TERRAIN } })._pzArbeit = 1;
            }
          }
        }
        R.kanten.forEach(function (e) { if (e.strasse) ds.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(llArr([e.a, e.b])), width: 5, material: C.Color.fromCssColorString("#8fb7d6"), clampToGround: true } })._pzArbeit = 1; });
      } else if (k.bf) {
        var b = llArr(k.bf); b.push(b[0], b[1]);
        ds.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(b), width: 2, material: new C.PolylineDashMaterialProperty({ color: orange, dashLength: 10 }), clampToGround: true } });
      }
      a.eintraege.forEach(function (e) {
        if (!/Baulinie/i.test(e.code + e.legende) || !e.geo) return;
        e.geo.forEach(function (gg) { var l = gg.Line || gg.line; if (!l || !l.coordinates) return;
          ds.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(llArr(l.coordinates)), width: 2, material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString("#e5484d") }), clampToGround: true } })._pzArbeit = 1; });
      });
      var bb = (k.bf || k.ring).map(function (p) { return wgs(p[0], p[1]); });
      window.APB3D.ausblenden([Math.min.apply(null, bb.map(function (q) { return q[0]; })), Math.max.apply(null, bb.map(function (q) { return q[0]; })), Math.min.apply(null, bb.map(function (q) { return q[1]; })), Math.max.apply(null, bb.map(function (q) { return q[1]; }))]);
      window.APB3D.flyTo(cw[1], cw[0], Math.max(110, Math.min(520, Math.sqrt(a.re.LandRegistryArea) * 3.2)));
      window.APB3D.boden(cw[0], cw[1]).then(function (h) { bodenH = h; if (letzte) zeigeVolumen(letzte.v, letzte.mix, letzte.opt); });
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
        if (/Strasse|Trottoir|Verkehrsinsel/i.test(art)) s.push(r); else if (art === "Gebaeude") { r.egid = f.properties.GWR_EGID || ""; g.push(r); }
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
      if (strasse) d = Math.max(d, z.vorzone != null ? z.vorzone : VORZONE);   // Kern-/Zentrumszonen: an Strassenflucht bzw. Baulinie
      return { a: p, b: q, n: n, d: d, strasse: strasse, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
    });
    // Baulinien: verbotene Seite = Seite der Strasse
    var linien = [];
    a.eintraege.forEach(function (e) {
      if (!/Baulinie/i.test(e.code + e.legende) || !e.geo) return;
      e.geo.forEach(function (gg) { var l = gg.Line || gg.line; if (l && l.coordinates) linien.push(l.coordinates); });
    });
    function seite(l, p, nurVor) {          // Seite der Baulinie; mit nurVor nur im Bereich direkt vor/hinter der Linie (nicht über die Enden hinaus)
      var best = 1e9, sg = 0, inner = false;
      for (var i = 0; i + 1 < l.length; i++) {
        var a2 = l[i], b2 = l[i + 1], dx = b2[0] - a2[0], dy = b2[1] - a2[1], L2 = dx * dx + dy * dy || 1e-9, tt = ((p[0] - a2[0]) * dx + (p[1] - a2[1]) * dy) / L2, d = distSeg(p, a2, b2);
        if (d < best) { best = d; sg = dx * (p[1] - a2[1]) - dy * (p[0] - a2[0]) > 0 ? 1 : -1; inner = (i > 0 || tt >= 0) && (i + 2 < l.length || tt <= 1); }
      }
      return nurVor && !inner ? 0 : sg;
    }
    var verbot = linien.map(function (l) {
      // Verbotene Seite = kleinerer Teil der Parzelle (Streifen zwischen Baulinie und Strasse); nur im Bereich vor der Linie gezählt
      var plus = 0, minus = 0, xs2 = ring.map(function (q) { return q[0]; }), ys2 = ring.map(function (q) { return q[1]; });
      var x0 = Math.min.apply(null, xs2), x1 = Math.max.apply(null, xs2), y0 = Math.min.apply(null, ys2), y1 = Math.max.apply(null, ys2), st = Math.max(1, Math.sqrt((x1 - x0) * (y1 - y0)) / 60);
      for (var yy = y0; yy <= y1; yy += st) for (var xx = x0; xx <= x1; xx += st) { if (!innen(ring, xx, yy)) continue; var sg = seite(l, [xx, yy], true); if (sg > 0) plus++; else if (sg < 0) minus++; }
      if (!plus && !minus) return 0;
      return plus < minus ? 1 : -1;
    });
    var xs = ring.map(function (p) { return p[0]; }), ys = ring.map(function (p) { return p[1]; });
    var R = { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), h: 0.5 };
    R.nx = Math.ceil((Math.max.apply(null, xs) - R.x0) / R.h) + 1; R.ny = Math.ceil((Math.max.apply(null, ys) - R.y0) / R.h) + 1;
    var ohneLinien = false, anz = 0;
    function fuellen() {
      R.m = new Uint8Array(R.nx * R.ny); anz = 0;
    for (var j = 0; j < R.ny; j++) for (var i = 0; i < R.nx; i++) {
      var p = [R.x0 + i * R.h, R.y0 + j * R.h];
      if (!innen(ring, p[0], p[1])) continue;
      var ok = kanten.every(function (e) { return distSeg(p, e.a, e.b) >= e.d - 0.01; });
      if (ok && !ohneLinien) ok = linien.every(function (l, li) { return !verbot[li] || seite(l, p, true) !== verbot[li]; });
      if (ok && a.bauRinge) ok = a.bauRinge.some(function (rg) { return innen(rg, p[0], p[1]); });   // nur im Teil der Parzelle mit Wohnbauzone
      if (ok) { R.m[j * R.nx + i] = 1; anz++; }
    }
    }
    fuellen();
    if (anz * R.h * R.h < 80 && linien.length) { ohneLinien = true; fuellen(); R.baulinienIgnoriert = true; }   // Baulinien nicht eindeutig zuordenbar
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

  /* ---------- Bestand: Ersatzneubau oder Aufstockung ---------- */
  function obb(r) {                         // kleinstes umschliessendes Rechteck {c, L, T, ang}
    var best = null;
    for (var i = 0; i < r.length; i++) {
      var a = r[i], b = r[(i + 1) % r.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), u = [Math.cos(ang), Math.sin(ang)], v = [-u[1], u[0]];
      var su = r.map(function (q) { return q[0] * u[0] + q[1] * u[1]; }), sv = r.map(function (q) { return q[0] * v[0] + q[1] * v[1]; });
      var u0 = Math.min.apply(null, su), u1 = Math.max.apply(null, su), v0 = Math.min.apply(null, sv), v1 = Math.max.apply(null, sv), A = (u1 - u0) * (v1 - v0);
      if (!best || A < best.A) { var cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; best = { A: A, c: [u[0] * cu + v[0] * cv, u[1] * cu + v[1] * cv], L: u1 - u0, T: v1 - v0, ang: ang }; }
    }
    if (best && best.T > best.L) { var tmp = best.L; best.L = best.T; best.T = tmp; best.ang += Math.PI / 2; }
    return best;
  }
  var GKLAS = { 1110: t("Einfamilienhaus", "single-family house"), 1121: t("Zweifamilienhaus", "two-family house"), 1122: t("Mehrfamilienhaus", "apartment building"), 1130: t("Wohngebäude für Gemeinschaften", "communal residence"), 1211: t("Hotel", "hotel"), 1220: t("Bürogebäude", "office building"), 1230: t("Gross- und Einzelhandel", "retail"), 1251: t("Industriegebäude", "industrial building"), 1252: t("Lager", "warehouse"), 1242: t("Garage", "garage"), 1263: t("Schulgebäude", "school"), 1264: t("Spital", "hospital"), 1272: t("Kirche", "church") };
  function bestandListe(k, umg) {
    return (umg.gebaeude || []).map(function (r) {
      var m = r.reduce(function (s2, q) { return [s2[0] + q[0] / r.length, s2[1] + q[1] / r.length]; }, [0, 0]);
      if (!innen(k.ring, m[0], m[1])) return null;
      var at = (gwrAttr || {})[r.egid] || {}, fl = Math.abs(flaeche(r));
      if (fl < 25) return null;                // Kleinbauten (Garagen, Schöpfe) nicht als Bestand
      return { ring: r, egid: r.egid, flaeche: fl, geschosse: at.gastw || null, jahr: at.gbauj || null, klasse: at.gklas, wohnungen: at.ganzwhg || null, gf: at.gastw ? fl * at.gastw : null };
    }).filter(Boolean).sort(function (x, y) { return y.flaeche - x.flaeche; });
  }
  function aufstockungPruefen(a, k, R, b) {
    var z = a.zone || {}, h = b[0], nE = h.geschosse || 2, fp = h.flaeche, gfE = b.reduce(function (s2, x) { return s2 + (x.gf || x.flaeche * 2); }, 0);
    var vgZ = z.vg || Math.max(1, Math.floor((k.hoehe || 9) / GH)), grenzen = [], add = 99;
    var aV = vgZ - nE; if (aV < add) { add = aV; grenzen.push([aV, t("zulässige Vollgeschosse (", "permitted storeys (") + vgZ + t(") sind heute ", ") are today ") + (aV <= 0 ? t("bereits erreicht", "already reached") : t("zu ", "used to ") + nE + t(" ausgeschöpft", ""))]); }
    if (k.hoehe) { var aH = Math.floor((k.hoehe - nE * GH) / GH + 1e-6); if (aH < add) add = aH; if (aH <= 0) grenzen.push([aH, t("die Fassadenhöhe (max. ", "the facade height (max. ") + zahl(k.hoehe, 1) + t(" m) ist erreicht", " m) is reached")]); }
    if (!k.baufeldModus && k.gf) { var aG = Math.floor((k.gf - gfE) / fp + 1e-6); if (aG < add) add = aG; if (aG <= 0) grenzen.push([aG, t("die Ausnützung ist mit heute ca. ", "the density is used up with approx. ") + zahl(gfE) + t(" m² von ", " m² of ") + zahl(k.gf) + t(" m² ausgeschöpft", " m²")]); }
    add = Math.max(0, add);
    var teil = obb(h.ring), abstandOk = R ? R.passt(teil) : true;
    var dgA = (z.attika || z.dg) ? 0.6 : 0, nurDach = !add && dgA && (!k.gf || k.baufeldModus || k.gf - gfE >= fp * dgA);
    var res = { moeglich: add > 0 || nurDach, add: add, nurDach: nurDach, grenzen: grenzen.filter(function (g) { return g[0] <= 0; }).map(function (g) { return g[1]; }), gfE: gfE, abstandOk: abstandOk, h: h };
    if (res.moeglich) {
      var v = { typ: "aufstockung", name: nurDach ? t("Dachaufbau (Attika)", "Roof extension (attic)") : t("Aufstockung +", "Extension +") + add + t(" Geschoss" + (add > 1 ? "e" : ""), " storey" + (add > 1 ? "s" : "")),
        teile: [teil], bestandN: nE, n: nE + add, dach: dgA ? "attika" : "flach", fest: true, score: null };
      v.fuss = teil.L * teil.T; v.dg = (z.attika || z.dg) && (!k.gf || k.baufeldModus || k.gf - gfE - add * fp >= fp * dgA) ? dgA : 0;
      v.gf = gfE + v.fuss * (add + v.dg); v.neuGF = v.fuss * (add + v.dg); v.aus = k.gf && !k.baufeldModus ? Math.min(1.2, v.gf / k.gf) : 1;
      res.v = v;
    }
    return res;
  }
  function bestandHTML(a, k, b, vs) {
    if (!b.length) return "";
    var gfE = b.reduce(function (s2, x) { return s2 + (x.gf || 0); }, 0), whgE = b.reduce(function (s2, x) { return s2 + (x.wohnungen || 0); }, 0), best = vs && vs[0];
    var zeilen = b.slice(0, 4).map(function (x) {
      return "<li><b>" + esc(GKLAS[x.klasse] || t("Gebäude", "Building")) + "</b> · " + zahl(x.flaeche) + " m² " + t("Grundfläche", "footprint") + (x.geschosse ? " · " + x.geschosse + " " + t("Geschosse", "storeys") : "") + (x.jahr ? " · " + t("Baujahr ", "built ") + x.jahr : "") + (x.wohnungen ? " · " + x.wohnungen + " " + t("Wohnungen", "apartments") : "") + "</li>";
    }).join("");
    var vergleich = best && gfE ? '<p class="pz-best-vgl">' + t("Heute ca. ", "Today approx. ") + "<b>" + zahl(gfE) + " m²</b>" + (whgE ? " · " + whgE + " " + t("Whg.", "units") : "") + " → " + t("Ersatzneubau bis ca. ", "replacement up to approx. ") + "<b>" + zahl(best.gf) + " m²</b> (× " + (best.gf / gfE).toFixed(1).replace(".0", "") + ")</p>" : "";
    return '<div class="pz-bestand"><h5>' + t("Bestand auf der Parzelle", "Existing buildings") + " " + marke("amt") + "</h5><ul>" + zeilen + "</ul>" + vergleich +
      '<div class="pz-modus" role="group" aria-label="' + t("Vorgehen", "Approach") + '"><button type="button" data-m="ersatz" aria-pressed="true">' + t("Ersatzneubau", "Replacement") + '</button><button type="button" data-m="auf" aria-pressed="false">' + t("Aufstockung prüfen", "Check extension") + '</button></div><div class="pz-auf"></div></div>';
  }
  function aufstockungAnzeigen(a, k, R, b, box, ersatzZeigen) {
    var r = aufstockungPruefen(a, k, R, b); r.ersatzGF = (aufstockungAnzeigen.vs || [])[0] ? aufstockungAnzeigen.vs[0].gf : 0; var ziel = box.querySelector(".pz-auf"), liste = box.querySelector(".pz-var"), why = box.querySelector(".pz-why"), go = box.querySelector(".pz-go");
    if (!r.moeglich) {
      ziel.innerHTML = '<div class="pz-hint warn"><b>' + t("Aufstockung nicht möglich", "Extension not possible") + "</b><br>" + esc(r.grenzen.join("; ") || t("die Zonenvorschriften lassen kein weiteres Geschoss zu", "zoning allows no further storey")) + ".<br>" +
        (liste ? t("Sie können aber einen Ersatzneubau umsetzen – die Varianten oben zeigen bis zu ca. ", "A replacement building is possible – up to approx. ") + zahl(r.ersatzGF || k.gf || 0) + t(" m² Geschossfläche.", " m² floor area.") : t("Auch ein Ersatzneubau ist auf dieser Parzelle nur eingeschränkt möglich.", "Replacement is limited on this plot.")) +
        '</div><button type="button" class="btn ghost pz-zu-ersatz">' + t("Zum Ersatzneubau", "Show replacement") + "</button>";
      ziel.querySelector(".pz-zu-ersatz").addEventListener("click", ersatzZeigen);
      return;
    }
    var v = r.v;
    ziel.innerHTML = '<div class="pz-hint"><b>' + esc(v.name) + t(" möglich", " possible") + "</b><br>" + t("Bestand ", "Existing ") + v.bestandN + t(" Geschosse (grau) + neu ", " storeys (grey) + new ") + (v.n - v.bestandN) + (v.dg ? " + Attika" : "") + " · " + t("neue Geschossfläche ca. ", "new floor area approx. ") + zahl(v.neuGF) + " m² · " + t("total ca. ", "total approx. ") + zahl(v.gf) + " m²" +
      (r.abstandOk ? "" : '<br><span class="pz-warnung">' + t("Der Bestand liegt teilweise im Grenzabstand: Aufstockung nur mit Ausnahmebewilligung bzw. im Rahmen der Bestandesgarantie (§ 357 PBG).", "The building partly lies within the boundary distance: extension only with an exception (§ 357 PBG).") + "</span>") +
      '<br><small>' + t("Annahmen: Statik und Erschliessung erlauben die Aufstockung; Grundfläche vereinfacht als umschliessendes Rechteck; Geschosszahl gemäss Gebäuderegister.", "Assumptions: structure allows extension; simplified footprint; storeys from the federal register.") + "</small></div>" +
      '<button type="button" class="btn pz-auf-go">' + t("Weiter → Wohnungsmix der neuen Geschosse", "Next → unit mix of new storeys") + '<span class="arr"></span></button>';
    if (liste) liste.hidden = true; if (why) why.hidden = true; if (go) go.hidden = true;
    rwAktualisieren(v); zeigeVolumen(v, null);
    ziel.querySelector(".pz-auf-go").addEventListener("click", function () { renderMix(v); });
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
    v.score = Math.round(100 * (0.25 * Math.min(1, v.aus) + 0.12 * v.nord + 0.13 * v.ow + 0.16 * v.strasse + 0.14 * v.rand + 0.12 * v.sued + 0.08 * v.kompakt));
    if (!v.ok) v.score = Math.min(v.score, 20);
    return v;
  }
  function generieren(a, k, R) {
    var z = a.zone || {}; if (!R || !k.gf || R.flaeche < 80) return [];
    var Lmax = z.laenge || 40, gap = 2 * (z.ga_k || 5);
    var dach = z.dachform === "sattel" || /Giebeldächer|nur Giebel/i.test((a.gem || {}).dach || "") ? "sattel" : (z.attika || z.dg ? "attika" : "flach");
    var zellen = R.zellen(), kand = [], punktOk = !z.tiefe_max || z.tiefe_max >= PUNKT;
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
          if (punktOk && c[1] < r.c[1] && R.passt(p) && abstandTeile(r, p) >= gap) kand.push({ typ: "kombi", teile: [r, p] });
        });
      });
      // Punkthäuser: 1–3 mit Gebäudeabstand
      var punkte = punktOk ? zellen.map(function (c) { return { c: c, L: PUNKT, T: PUNKT, ang: ang }; }).filter(R.passt) : [];
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
  var PRAES_FARBE = { "2.5": "#a9bfcf", "3.5": "#b7c9a6", "4.5": "#e2c388", "5.5": "#d8a293", kern: "#8f8c85" };
  function zeigeVolumen(v, mix, opt) {
    opt = opt || {};
    letzte = { v: v, mix: mix, opt: opt };
    var P = !!opt.praes, X = opt.explo ? 2.8 : 0, PAL = P ? PRAES_FARBE : FARBE;
    karte().then(function () {
      var C = C3; ds.entities.values.filter(function (e) { return e._pzVol; }).forEach(function (e) { ds.entities.remove(e); });
      function add(o) { var e = ds.entities.add(o); e._pzVol = 1; return e; }
      var b0 = bodenH, R = aktuellR;
      function zOf(g) { return b0 + g * GH + g * X; }
      ds.entities.values.forEach(function (e) { if (e._pzArbeit) e.show = !P; });
      if (P && aktuell && aktuell.k && aktuell.k.ring) {      // Grundstück als helle Modellplatte mit feiner Kante
        var ring = aktuell.k.ring, rr = llArr(ring); rr.push(rr[0], rr[1]);
        add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(ring)), material: C.Color.WHITE, classificationType: C.ClassificationType.TERRAIN } });
        add({ polyline: { positions: C.Cartesian3.fromDegreesArray(rr), width: 1.5, material: C.Color.fromCssColorString("#2f2d29"), clampToGround: true } });
      }
      var BESTAND = C.Color.fromCssColorString("#b8b3aa"), WEISS = C.Color.fromCssColorString("#fbfaf7"), GLAS = C.Color.fromCssColorString("#3d4b57"), BAND = C.Color.fromCssColorString("#cfcac0"), DACH = C.Color.fromCssColorString("#b9b2a6"), ORANGE = C.Color.fromCssColorString("#f15d30");
      function quad(p1, p2, z1, z2, farbe, off, n) {          // senkrechte Fläche p1–p2 von z1 bis z2, um off nach aussen versetzt
        var o = n ? [n[0] * off, n[1] * off] : [0, 0];
        var a1 = [p1[0] + o[0], p1[1] + o[1]], a2 = [p2[0] + o[0], p2[1] + o[1]];
        add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArrayHeights(llArr([a1], z1).concat(llArr([a2], z1), llArr([a2], z2), llArr([a1], z2))), perPositionHeight: true, material: farbe } });
      }
      function flaecheH(pts, hs, farbe) { var arr = []; pts.forEach(function (p, i) { arr = arr.concat(llArr([p], hs[i])); }); add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArrayHeights(arr), perPositionHeight: true, material: farbe } }); }
      var strasseKanten = R ? R.kanten.filter(function (e) { return e.strasse; }) : [];
      if (!P && !v.bestandN) bestandUmriss(add, C);
      v.teile.forEach(function (p, ti) {
        var r = ecken(p), H = v.n * GH, cz = p.c;
        // Körper (oder Wohnungen geschossweise)
        if (mix && mix.teile[ti]) {
          mix.teile[ti].forEach(function (st) { st.felder.forEach(function (f) {
            add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(f.r)), height: zOf(st.g) + 0.12, extrudedHeight: zOf(st.g) + GH - 0.12, material: C.Color.fromCssColorString(PAL[f.typ]).withAlpha(P ? 1 : 0.96), outline: true, outlineColor: P ? C.Color.fromCssColorString("#2f2d29").withAlpha(0.75) : C.Color.WHITE.withAlpha(0.9) } });
          }); });
        } else add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(r)), height: b0 + (v.bestandN || 0) * GH, extrudedHeight: b0 + H, material: WEISS } });
        if (v.bestandN) add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(r)), height: b0, extrudedHeight: b0 + v.bestandN * GH - (P && X ? 0.1 : 0), material: BESTAND, outline: P, outlineColor: C.Color.fromCssColorString("#2f2d29").withAlpha(0.75) } });
        // Geschossbänder (in der Präsentation: nur Kanten)
        for (var g = 1; g <= (P ? 0 : v.n); g++) {
          var gr = r.map(function (q) { return [cz[0] + (q[0] - cz[0]) * 1.004, cz[1] + (q[1] - cz[1]) * 1.004]; });
          add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(gr)), height: b0 + g * GH - 0.28, extrudedHeight: b0 + g * GH, material: BAND } });
        }
        // Fassaden: Fenster, Balkone (Süd), Eingang (Strasse)
        var seiten = [[r[0], r[1]], [r[1], r[2]], [r[2], r[3]], [r[3], r[0]]];
        if (!P) seiten.forEach(function (sd) {
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
          if (!mix && !v.bestandN && isStrassenSeite(sd, n) && ti === 0) {
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
        var z0 = P ? zOf(v.n) : b0 + H;
        if (v.dach === "flach" || (v.dach === "attika" && !v.dg)) {
          add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(r)), height: z0, extrudedHeight: z0 + 0.5, material: WEISS } });
        } else if (v.dach === "attika") {
          var u0 = [Math.cos(p.ang), Math.sin(p.ang)], vv = [-u0[1], u0[0]], nordV = vv[1] >= 0 ? 1 : -1;
          var att = { c: [p.c[0] + vv[0] * nordV * p.T * 0.12, p.c[1] + vv[1] * nordV * p.T * 0.12], L: p.L * 0.82, T: p.T * 0.7, ang: p.ang };
          add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(ecken(att))), height: z0, extrudedHeight: z0 + GH, material: mix ? C.Color.fromCssColorString(PAL["4.5"]) : WEISS, outline: P, outlineColor: C.Color.fromCssColorString("#2f2d29").withAlpha(0.75) } });
          add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(ecken(att))), height: z0 + GH, extrudedHeight: z0 + GH + 0.35, material: BAND } });
          if (!P) r.forEach(function (q, i) { quad(q, r[(i + 1) % 4], z0, z0 + 1.0, C.Color.WHITE.withAlpha(0.5), 0, null); });   // Geländer
          var ae = ecken(att);
          if (!P) [[ae[0], ae[1]], [ae[2], ae[3]]].forEach(function (sd) { var n = aussenNormale(sd[0], sd[1], att.c); if (n[1] < -0.3) { var Ls = Math.hypot(sd[1][0] - sd[0][0], sd[1][1] - sd[0][1]); quad([sd[0][0] + (sd[1][0] - sd[0][0]) * 0.08, sd[0][1] + (sd[1][1] - sd[0][1]) * 0.08], [sd[0][0] + (sd[1][0] - sd[0][0]) * 0.92, sd[0][1] + (sd[1][1] - sd[0][1]) * 0.92], z0 + 0.1, z0 + 2.4, GLAS, 0.06, n); } });
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
  var aktuellBestand = [];
  function bestandUmriss(add, C) {               // abzubrechender Bestand: gestrichelter Umriss am Boden
    aktuellBestand.forEach(function (x) { var rr = llArr(x.ring); rr.push(rr[0], rr[1]);
      add({ polyline: { positions: C.Cartesian3.fromDegreesArray(rr), width: 2, material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString("#6f6a62"), dashLength: 8 }), clampToGround: true } }); });
  }
  function zeigeBestand() {                     // nur Bestand anzeigen (kein Neubau möglich)
    karte().then(function () {
      var C = C3; ds.entities.values.filter(function (e) { return e._pzVol; }).forEach(function (e) { ds.entities.remove(e); });
      aktuellBestand.forEach(function (x) { var e = ds.entities.add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(llArr(x.ring)), height: bodenH, extrudedHeight: bodenH + (x.geschosse || 2) * GH, material: C.Color.fromCssColorString("#b8b3aa") } }); e._pzVol = 1; });
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
      for (var g = v.bestandN || 0; g < v.n; g++) {
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
  /* ---------- Axo-Renderer: freigestelltes Modell als Architekturgrafik (Canvas) ---------- */
  // Eigene Darstellung statt 3D-Karte: runde Modellplatte, Strassen hellgrau, Nachbarn als weisse Kartonvolumen,
  // Projekt in Farben je Wohnungstyp, Licht aus Südwesten, Schlagschatten, feine Kanten. Wird auch fürs PDF verwendet.
  var SONNE = (function () { var v = [-0.82, -0.2, 0.6], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function ton(h, f) { var c = hexRgb(h); return "rgb(" + c.map(function (x) { return Math.round(Math.min(255, x * f)); }).join(",") + ")"; }
  function gwrLaden(umg) {
    if (gwrHoehen) return Promise.resolve(gwrHoehen);
    var xs = [], ys = []; umg.gebaeude.forEach(function (r) { r.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    if (!xs.length) return Promise.resolve({});
    var a = wgs(Math.min.apply(null, xs), Math.min.apply(null, ys)), b = wgs(Math.max.apply(null, xs), Math.max.apply(null, ys)), env = [a[0], a[1], b[0], b[1]].join(",");
    var u = "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryEnvelope&layers=all:ch.bfs.gebaeude_wohnungs_register&tolerance=0&sr=4326&returnGeometry=false&limit=200&imageDisplay=500,500,96&geometry=" + env + "&mapExtent=" + env;
    return json(u).then(function (r) { var h = {}, at2 = {}; (r.results || []).forEach(function (x) { var at = x.attributes || x.properties || {}; at2[String(at.egid)] = at; if (at.gastw) h[String(at.egid)] = at.gastw * 3 + 1; }); gwrHoehen = h; gwrAttr = at2; return h; }).catch(function () { gwrHoehen = {}; gwrAttr = {}; return {}; });
  }
  function szene(v, mix, explo, eng) {
    // Alles in lokalen Metern um die Parzellenmitte; Prismen {pts, z0, z1, farbe, kante} und Flächen {p3, farbe}
    var k = aktuell.k, ring = k.ring, c = ring.reduce(function (s2, q) { return [s2[0] + q[0] / ring.length, s2[1] + q[1] / ring.length]; }, [0, 0]);
    var L = function (p) { return [p[0] - c[0], p[1] - c[1]]; };
    var rad = Math.max.apply(null, ring.map(function (q) { return Math.hypot(q[0] - c[0], q[1] - c[1]); }));
    var R = eng ? Math.max(26, rad * 1.18 + 6) : Math.max(40, rad * 1.6 + 14), X = explo ? 2.8 : 0, prismen = [], flaechen = [];
    var umg = aktuellUmg || { gebaeude: [], strassen: [] }, hoehen = gwrHoehen || {};
    umg.gebaeude.forEach(function (r) {
      var m = r.reduce(function (s2, q) { return [s2[0] + q[0] / r.length, s2[1] + q[1] / r.length]; }, [0, 0]);
      if (Math.hypot(m[0] - c[0], m[1] - c[1]) > R - 4) return;
      if (innen(ring, m[0], m[1])) return;                          // Bestand auf der Parzelle entfällt
      prismen.push({ pts: r.map(L), z0: 0, z1: hoehen[r.egid] || 8, farbe: "#fbfaf7", kante: "rgba(60,58,54,.38)", kontext: true });
    });
    var PAL = PRAES_FARBE;
    v.teile.forEach(function (p, ti) {
      if (mix && mix.teile[ti]) mix.teile[ti].forEach(function (st) { st.felder.forEach(function (f) {
        prismen.push({ pts: f.r.map(L), z0: st.g * GH + st.g * X, z1: (st.g + 1) * GH + st.g * X - 0.05, farbe: PAL[f.typ], kante: "rgba(35,33,30,.8)", grp: ti, lvl: st.g, aussen: ecken(p).map(L) });
      }); });
      else prismen.push({ pts: ecken(p).map(L), z0: (v.bestandN || 0) * GH, z1: v.n * GH, farbe: "#fbfaf7", kante: "rgba(35,33,30,.8)", grp: ti, lvl: 0 });
      if (v.bestandN) prismen.push({ pts: ecken(p).map(L), z0: 0, z1: v.bestandN * GH - (X ? 0.05 : 0), farbe: "#b8b3aa", kante: "rgba(35,33,30,.8)", grp: ti, lvl: -1 });
      var z0 = v.n * GH + v.n * X;
      if (v.dach === "attika" && v.dg) {
        var u0 = [Math.cos(p.ang), Math.sin(p.ang)], vv = [-u0[1], u0[0]], nordV = vv[1] >= 0 ? 1 : -1;
        var att = { c: [p.c[0] + vv[0] * nordV * p.T * 0.12, p.c[1] + vv[1] * nordV * p.T * 0.12], L: p.L * 0.82, T: p.T * 0.7, ang: p.ang };
        prismen.push({ pts: ecken(att).map(L), z0: z0, z1: z0 + GH, farbe: mix ? PAL["4.5"] : "#fbfaf7", kante: "rgba(35,33,30,.8)", grp: ti, lvl: 999 });
      } else if (v.dach === "sattel" || v.dach === "walm") {
        var lang = p.L >= p.T, Lr = lang ? p.L : p.T, Tr = lang ? p.T : p.L, ang2 = lang ? p.ang : p.ang + Math.PI / 2;
        var u1 = [Math.cos(ang2), Math.sin(ang2)], v1 = [-u1[1], u1[0]], ue = 0.5, fh = Tr / 2 * Math.tan(NEIGUNG), walm = v.dach === "walm";
        var P = function (s2, t2, z) { var q = L([p.c[0] + u1[0] * s2 + v1[0] * t2, p.c[1] + u1[1] * s2 + v1[1] * t2]); return [q[0], q[1], z]; };
        var hl = Lr / 2 + ue, ht = Tr / 2 + ue, zt = z0 - ue * Math.tan(NEIGUNG), fA = walm ? Lr / 2 - Tr / 2 : hl, D = "#c9c2b6";
        flaechen.push({ p3: [P(-hl, -ht, zt), P(hl, -ht, zt), P(fA, 0, z0 + fh), P(-fA, 0, z0 + fh)], farbe: D, grp: ti });
        flaechen.push({ p3: [P(-hl, ht, zt), P(hl, ht, zt), P(fA, 0, z0 + fh), P(-fA, 0, z0 + fh)], farbe: D, grp: ti });
        if (walm) { flaechen.push({ p3: [P(-hl, -ht, zt), P(-hl, ht, zt), P(-fA, 0, z0 + fh)], farbe: D, grp: ti }); flaechen.push({ p3: [P(hl, -ht, zt), P(hl, ht, zt), P(fA, 0, z0 + fh)], farbe: D, grp: ti }); }
        else { flaechen.push({ p3: [P(-Lr / 2, -Tr / 2, z0), P(-Lr / 2, Tr / 2, z0), P(-Lr / 2, 0, z0 + fh)], farbe: "#fbfaf7", grp: ti }); flaechen.push({ p3: [P(Lr / 2, -Tr / 2, z0), P(Lr / 2, Tr / 2, z0), P(Lr / 2, 0, z0 + fh)], farbe: "#fbfaf7", grp: ti }); }
        if (v.lukarnen && v.dg) {
          var suedT = (v1[1] < 0 ? 1 : -1) * Tr / 2, anzL = Math.max(1, Math.floor(Lr / 3 / 2.6)), ab = Lr / (anzL + 1);
          for (var li = 1; li <= anzL; li++) {
            var s0 = -Lr / 2 + li * ab, tf = suedT * 0.55, zf = z0 + (Tr / 2 - Math.abs(tf)) * Math.tan(NEIGUNG);
            var b2 = [P(s0 - 1.1, tf, 0), P(s0 + 1.1, tf, 0), P(s0 + 1.1, suedT * 0.05, 0), P(s0 - 1.1, suedT * 0.05, 0)].map(function (q) { return [q[0], q[1]]; });
            prismen.push({ pts: b2, z0: zf - 0.2, z1: zf + 1.7, farbe: "#fbfaf7", kante: "rgba(35,33,30,.8)", ueber: true, grp: ti, lvl: 2000 });
          }
        }
      }
    });
    return { ring: ring.map(L), R: R, prismen: prismen, flaechen: flaechen, strassen: umg.strassen.map(function (r) { return r.map(L); }) };
  }
  function huelle2(pts) {
    pts = pts.slice().sort(function (a3, b3) { return a3[0] - b3[0] || a3[1] - b3[1]; });
    var kr = function (o, a3, b3) { return (a3[0] - o[0]) * (b3[1] - o[1]) - (a3[1] - o[1]) * (b3[0] - o[0]); }, lo = [], hi = [];
    pts.forEach(function (q) { while (lo.length >= 2 && kr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    pts.slice().reverse().forEach(function (q) { while (hi.length >= 2 && kr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); });
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  // Verdeckungsordnung: A vor B zeichnen, wenn A hinter B liegt (Trennachse im Grundriss oder unter/über)
  function hinter(A, B, away) {
    var achsen = [];
    [A.poly, B.poly].forEach(function (P) { for (var i = 0; i < P.length; i++) { var a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l > 1e-6) achsen.push([-dy / l, dx / l]); } });
    for (var k = 0; k < achsen.length; k++) {
      var n = achsen[k], pa = A.poly.map(function (q) { return q[0] * n[0] + q[1] * n[1]; }), pb = B.poly.map(function (q) { return q[0] * n[0] + q[1] * n[1]; });
      var aMin = Math.min.apply(null, pa), aMax = Math.max.apply(null, pa), bMin = Math.min.apply(null, pb), bMax = Math.max.apply(null, pb), dot = n[0] * away[0] + n[1] * away[1];
      if (aMax <= bMin + 0.02 && Math.abs(dot) > 0.02) return dot > 0 ? -1 : 1;   // A auf der kleinen Seite: hinten, wenn n zum Betrachter zeigt
      if (bMax <= aMin + 0.02 && Math.abs(dot) > 0.02) return dot > 0 ? 1 : -1;
    }
    if (A.z1 <= B.z + 0.02) return 1;          // A unter B -> zuerst
    if (B.z1 <= A.z + 0.02) return -1;
    return 0;
  }
  function ordnen(items, away) {
    var n = items.length, nach = items.map(function () { return []; }), grad = items.map(function () { return 0; });
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
      var A = items[i].bb, B = items[j].bb;
      if (A && B && (A[2] <= B[0] + 0.5 || B[2] <= A[0] + 0.5 || A[3] <= B[1] + 0.5 || B[3] <= A[1] + 0.5)) continue;
      var r = hinter(items[i], items[j], away);
      if (r === 1) { nach[i].push(j); grad[j]++; } else if (r === -1) { nach[j].push(i); grad[i]++; }
    }
    var frei = [], out = [];
    for (var k = 0; k < n; k++) if (!grad[k]) frei.push(k);
    var tf = function (x, y) { return (items[y].d - items[x].d) || (items[x].z - items[y].z); };
    while (out.length < n) {
      if (!frei.length) {                      // Zyklus: tiefsten verbleibenden Körper nehmen
        var rest = []; for (var q = 0; q < n; q++) if (grad[q] >= 0 && out.indexOf(items[q]) < 0 && rest.indexOf(q) < 0) rest.push(q);
        rest.sort(tf); frei.push(rest[0]); grad[rest[0]] = 0;
      }
      frei.sort(tf); var x = frei.shift(); if (grad[x] < 0) continue; grad[x] = -1; out.push(items[x]);
      nach[x].forEach(function (y) { if (grad[y] > 0) { grad[y]--; if (!grad[y]) frei.push(y); } });
    }
    return out;
  }
  function zeichneAxo(cv, v, mix, opt) {
    opt = opt || {};
    var S = szene(v, mix, opt.explo, opt.eng), ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
    var phi = (opt.blick != null ? opt.blick : 225) * Math.PI / 180, el = 30 * Math.PI / 180;
    var away = [-Math.sin(phi), -Math.cos(phi)], rechts = [away[1], -away[0]];
    var maxZ = S.prismen.reduce(function (m2, p) { return Math.max(m2, p.z1); }, 10);
    var sk = Math.min(W / (S.R * 2.25), H / (S.R * 2 * Math.sin(el) + maxZ * Math.cos(el) + S.R * 0.5)), cx = W / 2, cy = H / 2 + maxZ * Math.cos(el) * sk * 0.35;
    function pr(x, y, z) { var u = x * rechts[0] + y * rechts[1], w = x * away[0] + y * away[1]; return [cx + u * sk, cy - (w * Math.sin(el) + (z || 0) * Math.cos(el)) * sk]; }
    function tiefe(x, y, z) { var w = x * away[0] + y * away[1]; return w * Math.cos(el) - z * Math.sin(el); }
    function pfad(pts) { ctx.beginPath(); pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }
    // Hintergrund
    ctx.fillStyle = opt.hg || "#efece6"; ctx.fillRect(0, 0, W, H);
    // Modellplatte (Kreis) mit Kante
    var kreis = []; for (var i = 0; i < 96; i++) { var a2 = i / 96 * Math.PI * 2; kreis.push([Math.cos(a2) * S.R, Math.sin(a2) * S.R]); }
    var D = 1.6;
    ctx.fillStyle = "#d9d5cc"; ctx.beginPath();
    kreis.forEach(function (q, j) { var s2 = pr(q[0], q[1], -D); if (j) ctx.lineTo(s2[0], s2[1]); else ctx.moveTo(s2[0], s2[1]); }); ctx.closePath(); ctx.fill();
    for (var j = 0; j < kreis.length; j++) { var q1 = kreis[j], q2 = kreis[(j + 1) % kreis.length], nx = (q1[0] + q2[0]) / 2, ny = (q1[1] + q2[1]) / 2;
      if (nx * away[0] + ny * away[1] > 0) continue; var f = 0.78 + 0.22 * Math.max(0, (nx * SONNE[0] + ny * SONNE[1]) / S.R);
      pfad([pr(q1[0], q1[1], 0), pr(q2[0], q2[1], 0), pr(q2[0], q2[1], -D), pr(q1[0], q1[1], -D)]); ctx.fillStyle = ton("#e9e5dd", f); ctx.fill(); }
    pfad(kreis.map(function (q) { return pr(q[0], q[1], 0); })); ctx.fillStyle = "#f7f5f0"; ctx.fill();
    ctx.save(); pfad(kreis.map(function (q) { return pr(q[0], q[1], 0); })); ctx.clip();
    // Strassen
    ctx.fillStyle = "#dcd6ca"; S.strassen.forEach(function (r) { pfad(r.map(function (q) { return pr(q[0], q[1], 0); })); ctx.fill(); });
    // Parzelle
    pfad(S.ring.map(function (q) { return pr(q[0], q[1], 0); })); ctx.fillStyle = "#ffffff"; ctx.fill();
    ctx.setLineDash([6 * sk / 4, 4 * sk / 4]); ctx.lineWidth = Math.max(1, sk * 0.12); ctx.strokeStyle = "rgba(241,93,48,.9)"; ctx.stroke(); ctx.setLineDash([]);
    // Schlagschatten (Projektion entlang der Sonne auf z=0)
    ctx.fillStyle = "rgba(40,36,30,.16)"; ctx.beginPath();
    S.prismen.forEach(function (p) {
      var pts = []; p.pts.forEach(function (q) { pts.push([q[0], q[1]]); pts.push([q[0] - SONNE[0] / SONNE[2] * p.z1, q[1] - SONNE[1] / SONNE[2] * p.z1]); });
      pts.sort(function (a3, b3) { return a3[0] - b3[0] || a3[1] - b3[1]; });   // konvexe Hülle (immer gleicher Umlaufsinn -> Vereinigung)
      var kr = function (o, a3, b3) { return (a3[0] - o[0]) * (b3[1] - o[1]) - (a3[1] - o[1]) * (b3[0] - o[0]); }, lo = [], hi = [];
      pts.forEach(function (q) { while (lo.length >= 2 && kr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
      pts.slice().reverse().forEach(function (q) { while (hi.length >= 2 && kr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); });
      var hull = lo.slice(0, -1).concat(hi.slice(0, -1)).map(function (q) { return pr(q[0], q[1], 0); });
      hull.forEach(function (q, i3) { if (i3) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath();
    });
    ctx.fill("nonzero");
    ctx.restore();
    // Baukörper von hinten nach vorne (Mittelpunkt-Tiefe), Flächen eines Körpers zusammen zeichnen
    var items = [];
    S.prismen.forEach(function (p) {
      var pts = p.pts, n = pts.length, cxp = 0, cyp = 0; pts.forEach(function (q) { cxp += q[0] / n; cyp += q[1] / n; });
      var area = 0; for (var i2 = 0; i2 < n; i2++) area += pts[i2][0] * pts[(i2 + 1) % n][1] - pts[(i2 + 1) % n][0] * pts[i2][1];
      var ccw = area > 0, seiten = [];
      for (var e = 0; e < n; e++) {
        var a4 = pts[e], b4 = pts[(e + 1) % n], dx = b4[0] - a4[0], dy = b4[1] - a4[1], nn = ccw ? [dy, -dx] : [-dy, dx], ln = Math.hypot(nn[0], nn[1]) || 1; nn = [nn[0] / ln, nn[1] / ln];
        if (nn[0] * away[0] + nn[1] * away[1] >= 0) continue;              // Rückseite
        if (p.aussen && distRing([(a4[0] + b4[0]) / 2, (a4[1] + b4[1]) / 2], p.aussen) > 0.08) continue;   // Trennwand zwischen Wohnungen: unsichtbar
        var hell = 0.66 + 0.34 * Math.max(0, nn[0] * SONNE[0] + nn[1] * SONNE[1]);
        var mw = ((a4[0] + b4[0]) / 2) * away[0] + ((a4[1] + b4[1]) / 2) * away[1];
        seiten.push({ w: mw, p3: [[a4[0], a4[1], p.z0], [b4[0], b4[1], p.z0], [b4[0], b4[1], p.z1], [a4[0], a4[1], p.z1]], fill: ton(p.farbe, hell) });
      }
      seiten.sort(function (x, y) { return y.w - x.w; });
      seiten.push({ p3: pts.map(function (q) { return [q[0], q[1], p.z1]; }), fill: p.farbe });
      items.push({ d: tiefe(cxp, cyp, (p.z0 + p.z1) / 2) - (p.ueber ? 1.5 : 0), z: p.z0, z1: p.z1, poly: p.kontext ? huelle2(pts) : pts, faces: seiten, stroke: p.kante, grp: p.grp, lvl: p.lvl });
    });
    // Dachflächen je Baukörper als eigene Gruppe über dem obersten Geschoss
    var dachGruppen = {};
    S.flaechen.forEach(function (f) {
      var n = f.p3.length, m3 = [0, 0, 0]; f.p3.forEach(function (q) { m3[0] += q[0] / n; m3[1] += q[1] / n; m3[2] += q[2] / n; });
      var a5 = f.p3[0], b5 = f.p3[1], c5 = f.p3[2], u = [b5[0] - a5[0], b5[1] - a5[1], b5[2] - a5[2]], w2 = [c5[0] - a5[0], c5[1] - a5[1], c5[2] - a5[2]];
      var nn = [u[1] * w2[2] - u[2] * w2[1], u[2] * w2[0] - u[0] * w2[2], u[0] * w2[1] - u[1] * w2[0]], ln = Math.hypot(nn[0], nn[1], nn[2]) || 1; nn = nn.map(function (x) { return x / ln; }); if (nn[2] < 0) nn = nn.map(function (x) { return -x; });
      var hell = 0.7 + 0.3 * Math.max(0, nn[0] * SONNE[0] + nn[1] * SONNE[1] + nn[2] * SONNE[2]);
      var key = "d" + f.grp;
      var g = dachGruppen[key] || (dachGruppen[key] = { cx: m3[0], cy: m3[1], z: m3[2], faces: [], grp: f.grp });
      g.faces.push({ w: m3[0] * away[0] + m3[1] * away[1] - m3[2] * 0.01, p3: f.p3, fill: ton(f.farbe, hell) });
      g.punkte = (g.punkte || []).concat(f.p3); g.zmin = Math.min(g.zmin == null ? 1e9 : g.zmin, Math.min.apply(null, f.p3.map(function (q) { return q[2]; }))); g.zmax = Math.max(g.zmax || -1e9, Math.max.apply(null, f.p3.map(function (q) { return q[2]; })));
    });
    Object.keys(dachGruppen).forEach(function (kk) { var g = dachGruppen[kk]; g.faces.sort(function (x, y) { return y.w - x.w; }); items.push({ d: tiefe(g.cx, g.cy, g.z) - 0.5, z: g.zmin, z1: g.zmax, poly: huelle2(g.punkte.map(function (q) { return [q[0], q[1]]; })), faces: g.faces, stroke: "rgba(35,33,30,.8)", grp: g.grp, lvl: 1500 }); });
    items.forEach(function (it) {            // Bildschirm-Ausdehnung je Körper (nur überlappende Paare werden geordnet)
      var xs = [], ys = []; it.faces.forEach(function (f) { f.p3.forEach(function (q) { var sp = pr(q[0], q[1], q[2]); xs.push(sp[0]); ys.push(sp[1]); }); });
      it.bb = [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
    });
    var kontext = items.filter(function (it) { return it.grp == null; }), teile = {};
    items.forEach(function (it) { if (it.grp != null) (teile[it.grp] = teile[it.grp] || []).push(it); });
    Object.keys(teile).forEach(function (gk) {
      var lst = teile[gk], pts = [], z0 = 1e9, z1 = -1e9, xs = [], ys = [];
      lst.forEach(function (it) { it.poly.forEach(function (q) { pts.push(q); }); z0 = Math.min(z0, it.z); z1 = Math.max(z1, it.z1); xs.push(it.bb[0], it.bb[2]); ys.push(it.bb[1], it.bb[3]); });
      // innerhalb des Baukörpers: Geschoss für Geschoss von unten, im Geschoss nach Trennachsen, Attika/Dach/Lukarnen zuletzt
      var stufen = {}; lst.forEach(function (it) { (stufen[it.lvl] = stufen[it.lvl] || []).push(it); });
      var faces = [];
      Object.keys(stufen).map(Number).sort(function (a7, b7) { return a7 - b7; }).forEach(function (lv) {
        var wand = [], deckel = [];
        ordnen(stufen[lv], away).forEach(function (it) { it.faces.forEach(function (f) { var flach = f.p3.every(function (q) { return Math.abs(q[2] - f.p3[0][2]) < 1e-6; }); (flach && lv < 1500 ? deckel : wand).push({ f: f, stroke: it.stroke }); }); });
        faces.push.apply(faces, wand); faces.push.apply(faces, deckel);       // im Geschoss: erst alle Aussenwände, dann alle Deckel
      });
      kontext.push({ d: 0, z: z0, z1: z1, poly: huelle2(pts), bb: [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)], gruppe: faces });
    });
    items = ordnen(kontext, away);
    items.forEach(function (it) {
      (it.gruppe || it.faces.map(function (f) { return { f: f, stroke: it.stroke }; })).forEach(function (x) {
        pfad(x.f.p3.map(function (q) { return pr(q[0], q[1], q[2]); }));
        ctx.fillStyle = x.f.fill; ctx.fill(); ctx.lineJoin = "round"; ctx.lineWidth = Math.max(0.6, sk * 0.045); ctx.strokeStyle = x.stroke; ctx.stroke();
      });
    });
    // Nordpfeil
    var sc2 = W / 1400, np = [W - 64 * sc2, 64 * sc2], nr = 20 * sc2, ny1 = pr(0, 0, 0), ny2 = pr(0, 10, 0), dn = [ny2[0] - ny1[0], ny2[1] - ny1[1]], ldn = Math.hypot(dn[0], dn[1]) || 1; dn = [dn[0] / ldn, dn[1] / ldn];
    var qv = [-dn[1], dn[0]];
    ctx.lineWidth = Math.max(1, 1.2 * sc2); ctx.strokeStyle = "#2f2d29"; ctx.beginPath(); ctx.arc(np[0], np[1], nr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#2f2d29"; ctx.beginPath(); ctx.moveTo(np[0] + dn[0] * nr * 0.8, np[1] + dn[1] * nr * 0.8);
    ctx.lineTo(np[0] - dn[0] * nr * 0.55 + qv[0] * nr * 0.42, np[1] - dn[1] * nr * 0.55 + qv[1] * nr * 0.42);
    ctx.lineTo(np[0] - dn[0] * nr * 0.25, np[1] - dn[1] * nr * 0.25);
    ctx.lineTo(np[0] - dn[0] * nr * 0.55 - qv[0] * nr * 0.42, np[1] - dn[1] * nr * 0.55 - qv[1] * nr * 0.42); ctx.closePath(); ctx.fill();
    ctx.font = "600 " + Math.round(12 * sc2) + "px Inter, Helvetica, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("N", np[0] + dn[0] * nr * 1.55, np[1] + dn[1] * nr * 1.55);
  }
  var axoCv = null, axoZustand = null;
  function axoAnzeigen(v, m) {
    var host = document.querySelector("[data-pz-karte]");
    if (!axoCv) {
      axoCv = document.createElement("canvas"); axoCv.className = "pz-axo"; axoCv.setAttribute("role", "img"); axoCv.setAttribute("aria-label", t("Axonometrie des Volumens", "Axonometric view of the massing"));
      host.appendChild(axoCv);
      var zieh = null;
      axoCv.addEventListener("pointerdown", function (e) { zieh = { x: e.clientX, b: blick }; axoCv.setPointerCapture(e.pointerId); });
      var raf = 0;
      axoCv.addEventListener("pointermove", function (e) { if (!zieh) return; blick = ((zieh.b - (e.clientX - zieh.x) * 0.35) % 360 + 360) % 360; if (!raf) raf = requestAnimationFrame(function () { raf = 0; if (axoCv._malen) axoCv._malen(); }); });
      axoCv.addEventListener("pointerup", function () { zieh = null; var bb = document.querySelectorAll(".pz-blick button"); Array.prototype.forEach.call(bb, function (b2) { b2.setAttribute("aria-pressed", +b2.dataset.h === Math.round(blick)); }); });
      window.addEventListener("resize", function () { if (axoZustand) malen(); });
    }
    axoZustand = { v: v, m: m }; axoCv.hidden = false;
    function malen() {
      if (!axoZustand) return;
      var r = host.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      axoCv.width = Math.round(r.width * dpr); axoCv.height = Math.round(r.height * dpr);
      zeichneAxo(axoCv, axoZustand.v, axoZustand.m, { explo: explo, blick: blick });
    }
    axoCv._malen = malen; malen();
    gwrLaden(aktuellUmg || { gebaeude: [] }).then(function () { if (axoZustand) malen(); });
  }
  function axoAus() { axoZustand = null; if (axoCv) axoCv.hidden = true; }
  function axoBild(v, m, opt, w, h) { var cv = document.createElement("canvas"); cv.width = w; cv.height = h; zeichneAxo(cv, v, m, opt); return cv.toDataURL("image/png"); }

  /* ---------- Präsentation: Volumen freigestellt als Axonometrie ---------- */
  var praesAn = false, explo = false, blick = 225;
  function praesentation(an, v, m) {
    var host = document.querySelector("[data-pz-karte]"), leg = host.querySelector(".pz-legende");
    ["pz-res", "pz-vol", "pz-edit"].forEach(function (c) { var e = root.querySelector("." + c); if (e && e.innerHTML) e.hidden = an; });
    root.querySelector(".pz-such").hidden = an; var h2 = document.querySelector(".pz-side .pz-h2"); if (h2) h2.hidden = an;
    if (!an) { if (leg) leg.remove(); axoAus(); praesAn = false; return; }
    praesAn = true;
    var k = aktuell.k, ring = k.ring, c = ring.reduce(function (s2, q) { return [s2[0] + q[0] / ring.length, s2[1] + q[1] / ring.length]; }, [0, 0]), cw = wgs(c[0], c[1]);
    var rad = Math.max.apply(null, ring.map(function (q) { return Math.hypot(q[0] - c[0], q[1] - c[1]); }));
    axoAnzeigen(v, m);
    if (!leg) { leg = el('<div class="pz-legende" aria-live="polite"></div>'); host.appendChild(leg); }
    var nwf = NWF[standard];
    leg.innerHTML = '<span class="eyebrow">' + t("Potenzialstudie", "Potential study") + '</span><b>' + esc(aktuell.re.MunicipalityName) + " · " + t("Parzelle ", "Plot ") + esc(aktuell.re.Number) + "</b><small>" + esc(aktuell.zoneKey || aktuell.zoneTxt) + " · " + esc(v.name) + " · " + v.n + " " + t("Geschosse", "storeys") + (v.dg ? " + " + (v.dach === "attika" ? "Attika" : "DG") : "") + "</small>" +
      "<ul>" + Object.keys(m.zaehl).filter(function (x) { return m.zaehl[x]; }).map(function (x) { return '<li><i style="background:' + PRAES_FARBE[x] + '"></i>' + x + " Zi. <span>" + m.zaehl[x] + " × " + nwf[x] + " m²</span></li>"; }).join("") + '<li><i style="background:' + PRAES_FARBE.kern + '"></i>' + t("Erschliessung", "Circulation") + "</li>" + (v.bestandN ? '<li><i style="background:#b8b3aa"></i>' + t("Bestand", "Existing") + " <span>" + v.bestandN + " " + t("Geschosse", "storeys") + "</span></li>" : "") + "</ul>" +
      "<small>" + m.total + " " + t("Wohnungen", "apartments") + " · NWF " + zahl(m.nwf) + " m² · GF " + zahl(v.gf) + " m²</small>";
  }
  function renderMix(v) {
    var box = root.querySelector(".pz-mix"), m = mixRechnen(v), nwf = NWF[standard];
    var regler = Object.keys(mixAnteile).map(function (x) { return '<label><span><i style="background:' + PRAES_FARBE[x] + '"></i>' + x + ' Zi.</span><input type="range" min="0" max="100" step="5" value="' + mixAnteile[x] + '" data-typ="' + x + '" aria-label="' + t("Anteil ", "Share ") + x + ' Zi."><b>' + mixAnteile[x] + " %</b></label>"; }).join("");
    var zeilen = Object.keys(m.zaehl).map(function (x) { return m.zaehl[x] ? "<tr><td><i style=\"display:inline-block;width:10px;height:10px;border-radius:2px;background:" + PRAES_FARBE[x] + ";margin-right:6px\"></i>" + x + " Zi.</td><td>" + m.zaehl[x] + "</td><td>" + nwf[x] + " m²</td><td>" + zahl(m.zaehl[x] * nwf[x]) + " m²</td></tr>" : ""; }).join("");
    box.innerHTML = '<div class="pz-sek pz-praes"><h4>' + t("4 · Präsentation &amp; Wohnungsmix", "4 · Presentation &amp; unit mix") + '</h4>' +
      '<div class="pz-ansicht" role="group" aria-label="' + t("Ansicht", "View") + '">' +
      '<label class="pz-chkbox"><input type="checkbox" class="pz-explo"' + (explo ? " checked" : "") + "> " + t("Explosionsaxo (Geschosse auseinander)", "Exploded axonometric") + "</label>" +
      '<div class="pz-blick">' + [[225, "SW"], [135, "SO"], [315, "NW"], [45, "NO"]].map(function (b2) { return '<button type="button" data-h="' + b2[0] + '" aria-pressed="' + (blick === b2[0]) + '">' + t("von ", "from ") + b2[1] + "</button>"; }).join("") + "</div></div>" +
      '<p class="muted small">' + t("Anteile ergeben immer 100 % – die übrigen passen sich an.", "Shares always add up to 100 %.") + '</p><div class="pz-regler">' + regler + "</div>" +
      '<table class="pz-tab"><thead><tr><th>' + t("Typ", "Type") + "</th><th>" + t("Anz.", "No.") + "</th><th>Ø NWF</th><th>Total</th></tr></thead><tbody>" + zeilen + "</tbody><tfoot><tr><td>Total</td><td>" + m.total + "</td><td></td><td>" + zahl(m.nwf) + " m²</td></tr></tfoot></table>" +
      '<p class="muted small">' + t("Geschossfläche ", "Floor area ") + zahl(v.gf) + " m² · NWF/GF " + Math.round(m.nwf / v.gf * 100) + " % · " + t("Ausbaustandard ", "Standard ") + standard + ". " + t("Wohnungen durchgesteckt (Wohnen Süd, Schlafen Nord). Werte vorläufig – Kalibrierung mit apb-Studien folgt.", "Provisional values.") + "</p>" +
      '<div class="pz-anfrage-box"><b>' + t("Interesse geweckt?", "Interested?") + "</b><p>" + t("Senden Sie uns den Entwurf – wir prüfen ihn und besprechen mit Ihnen die nächsten Schritte.", "Send us the draft – we will review it and discuss the next steps.") + '</p><button type="button" class="btn pz-anfrage">' + t("Entwurf senden / Gespräch vereinbaren", "Send draft / arrange a meeting") + '<span class="arr"></span></button></div>' +
      '<div class="pz-knoepfe"><button type="button" class="btn ghost pz-pdf">' + t("Potenzialstudie als PDF", "Potential study as PDF") + '</button><button type="button" class="btn ghost pz-mix-aus">' + t("← Zurück zum Entwerfen", "← Back to design") + "</button></div></div>";
    box.hidden = false;
    Array.prototype.forEach.call(box.querySelectorAll("input[type=range]"), function (inp) {
      inp.addEventListener("input", function () {
        var typ = inp.dataset.typ, neu = Math.min(100, +inp.value), rest = 100 - neu, andere = Object.keys(mixAnteile).filter(function (x) { return x !== typ; });
        var summe = andere.reduce(function (s2, x) { return s2 + mixAnteile[x]; }, 0);
        mixAnteile[typ] = neu;
        andere.forEach(function (x) { mixAnteile[x] = summe ? Math.round(mixAnteile[x] / summe * rest / 5) * 5 : Math.round(rest / andere.length / 5) * 5; });
        var diff = 100 - Object.keys(mixAnteile).reduce(function (s2, x) { return s2 + mixAnteile[x]; }, 0);
        if (diff) { var gr = andere.sort(function (x, y) { return mixAnteile[y] - mixAnteile[x]; })[0]; mixAnteile[gr] = Math.max(0, mixAnteile[gr] + diff); }
        Array.prototype.forEach.call(box.querySelectorAll("input[type=range]"), function (i2) { i2.value = mixAnteile[i2.dataset.typ]; i2.nextElementSibling.textContent = mixAnteile[i2.dataset.typ] + " %"; });
      });
      inp.addEventListener("change", function () { renderMix(v); });
    });
    box.querySelector(".pz-explo").addEventListener("change", function (e) { explo = e.target.checked; if (axoCv && axoCv._malen) axoCv._malen(); });
    Array.prototype.forEach.call(box.querySelectorAll(".pz-blick button"), function (b2) { b2.addEventListener("click", function () { blick = +b2.dataset.h; Array.prototype.forEach.call(box.querySelectorAll(".pz-blick button"), function (x) { x.setAttribute("aria-pressed", x === b2); }); if (axoCv && axoCv._malen) axoCv._malen(); }); });
    box.querySelector(".pz-pdf").addEventListener("click", function (e) { pdfErstellen(v, m, e.currentTarget); });
    box.querySelector(".pz-anfrage").addEventListener("click", function () { anfrageDialog(v, m); });
    box.querySelector(".pz-mix-aus").addEventListener("click", function () { box.hidden = true; praesentation(false); zeigeVolumen(v, null); root.querySelector(".pz-edit").scrollIntoView({ block: "start" }); });
    praesentation(true, v, m);
    var sd = document.querySelector(".pz-side"); if (sd) sd.scrollTop = 0;
  }

  /* ---------- Anfrage an apb (statische Seite: E-Mail-Programm mit vorausgefüllter Nachricht + PDF) ---------- */
  function anfrageDialog(v, m) {
    var a = aktuell, d = document.createElement("div");
    d.className = "pz-dlg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "pz-dlg-t");
    d.innerHTML = '<form class="pz-dlg-in" novalidate><button type="button" class="pz-dlg-x" aria-label="' + t("Schliessen", "Close") + '">×</button>' +
      '<span class="eyebrow">' + t("Anfrage an apb architekten", "Enquiry to apb architekten") + '</span><h3 id="pz-dlg-t">' + esc(a.re.MunicipalityName) + " · " + t("Parzelle ", "Plot ") + esc(a.re.Number) + "</h3>" +
      '<p class="muted small">' + esc(v.name) + " · " + v.n + " " + t("Geschosse", "storeys") + " · GF " + zahl(v.gf) + " m² · " + m.total + " " + t("Wohnungen", "apartments") + "</p>" +
      '<fieldset class="pz-wahl"><legend>' + t("Ihr Anliegen", "Your request") + "</legend>" +
      [["gespraech", t("Gespräch vereinbaren", "Arrange a meeting")], ["rueckruf", t("Rückruf", "Call back")], ["pruefen", t("Entwurf prüfen lassen", "Have the draft reviewed")]].map(function (o, i) { return '<label><input type="radio" name="anliegen" value="' + o[1] + '"' + (i ? "" : " checked") + "> " + o[1] + "</label>"; }).join("") + "</fieldset>" +
      '<label class="pz-f"><span>' + t("Name", "Name") + ' *</span><input name="name" required autocomplete="name"></label>' +
      '<label class="pz-f"><span>' + t("E-Mail", "Email") + ' *</span><input name="mail" type="email" required autocomplete="email"></label>' +
      '<label class="pz-f"><span>' + t("Telefon", "Phone") + '</span><input name="tel" type="tel" autocomplete="tel"></label>' +
      '<label class="pz-f"><span>' + t("Rolle", "Role") + '</span><select name="rolle"><option>' + t("Eigentümer/in", "Owner") + "</option><option>" + t("Kaufinteressent/in", "Prospective buyer") + "</option><option>" + t("Investor/in, Entwickler/in", "Investor, developer") + "</option><option>" + t("Andere", "Other") + "</option></select></label>" +
      '<label class="pz-f"><span>' + t("Terminwunsch", "Preferred date") + '</span><input name="termin" placeholder="' + t("z. B. nächste Woche, vormittags", "e.g. next week, mornings") + '"></label>' +
      '<label class="pz-f"><span>' + t("Nachricht", "Message") + '</span><textarea name="msg" rows="3"></textarea></label>' +
      '<p class="pz-err" role="alert" hidden></p>' +
      '<button type="submit" class="btn">' + t("E-Mail vorbereiten", "Prepare email") + '<span class="arr"></span></button>' +
      '<p class="muted small">' + t("Ihr E-Mail-Programm öffnet sich mit allen Angaben an info@apb-architekten.ch. Gleichzeitig wird die Potenzialstudie als PDF heruntergeladen – bitte hängen Sie sie der E-Mail an. Lieber direkt? +41 44 944 60 80.", "Your email program opens with all details; the PDF is downloaded – please attach it.") + "</p></form>";
    document.body.appendChild(d);
    var f = d.querySelector("form"), zu = function () { d.remove(); document.removeEventListener("keydown", esc2); }, esc2 = function (e) { if (e.key === "Escape") zu(); };
    document.addEventListener("keydown", esc2);
    d.querySelector(".pz-dlg-x").addEventListener("click", zu);
    d.addEventListener("click", function (e) { if (e.target === d) zu(); });
    f.name.focus();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = f.querySelector(".pz-err");
      if (!f.name.value.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.mail.value.trim())) { err.textContent = t("Bitte Name und eine gültige E-Mail-Adresse angeben.", "Please enter your name and a valid email address."); err.hidden = false; return; }
      var anl = f.querySelector("input[name=anliegen]:checked").value, nwf = NWF[standard];
      var mixTxt = Object.keys(m.zaehl).filter(function (x) { return m.zaehl[x]; }).map(function (x) { return m.zaehl[x] + " × " + x + " Zi. (" + nwf[x] + " m²)"; }).join(", ");
      var body = [t("Guten Tag", "Hello"), "", t("Anliegen: ", "Request: ") + anl, "",
        t("Parzelle: ", "Plot: ") + a.re.MunicipalityName + " " + a.re.Number + " (EGRID " + a.re.EGRID + ")", t("Zone: ", "Zone: ") + (a.zoneTxt || ""), t("Grundstücksfläche: ", "Plot area: ") + zahl(a.re.LandRegistryArea) + " m²",
        t("Entwurf: ", "Draft: ") + v.name + ", " + v.n + " " + t("Geschosse", "storeys") + (v.dg ? " + " + (v.dach === "attika" ? "Attika" : "DG") : "") + ", GF " + zahl(v.gf) + " m² (" + Math.round(v.aus * 100) + " %)",
        t("Wohnungsmix (", "Unit mix (") + standard + "): " + mixTxt + " – " + m.total + " " + t("Wohnungen", "apartments"), "",
        f.msg.value.trim() ? t("Nachricht: ", "Message: ") + f.msg.value.trim() + "\n" : "",
        t("Terminwunsch: ", "Preferred date: ") + (f.termin.value.trim() || "–"),
        "", f.name.value.trim() + " (" + f.rolle.value + ")", f.mail.value.trim() + (f.tel.value.trim() ? " · " + f.tel.value.trim() : ""), "",
        t("(Potenzialstudie als PDF im Anhang)", "(Potential study PDF attached)")].join("\n");
      var subj = t("Potenzialstudie ", "Potential study ") + a.re.MunicipalityName + " " + a.re.Number + " – " + anl;
      var knopf = f.querySelector("button[type=submit]");
      pdfErstellen(v, m, knopf).then(function () {
        window.location.href = "mailto:info@apb-architekten.ch?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
        f.innerHTML = '<span class="eyebrow">' + t("Fast geschafft", "Almost done") + '</span><h3>' + t("Ihr E-Mail-Programm ist geöffnet.", "Your email program is open.") + "</h3><p>" + t("Bitte hängen Sie das soeben heruntergeladene PDF an und senden Sie die E-Mail ab. Wir melden uns in der Regel innerhalb von zwei Arbeitstagen.", "Please attach the downloaded PDF and send the email.") + '</p><button type="button" class="btn pz-dlg-ok">' + t("Schliessen", "Close") + "</button>";
        f.querySelector(".pz-dlg-ok").addEventListener("click", zu);
      });
    });
  }

  /* ---------- PDF-Bericht (jsPDF, lokal in assets/vendor/jspdf) ---------- */
  function ladeSkript(src) { return new Promise(function (res, rej) { if (window.jspdf) return res(); var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function bildDaten(url) { return fetch(url).then(function (r) { return r.blob(); }).then(function (b) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); }); }); }
  function groesse(u) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res([i.naturalWidth, i.naturalHeight]); }; i.onerror = function () { res([4, 3]); }; i.src = u; }); }
  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function pdfErstellen(v, m, knopf) {
    var alt = knopf.textContent; knopf.disabled = true; knopf.textContent = t("PDF wird erstellt …", "Creating PDF …");
    var a = aktuell, k = a.k, z = a.zone || {}, g = a.gem || {}, re = a.re, nwf = NWF[standard], bilder = {};
    var expoVorher = explo;
    return ladeSkript(ROOT + "assets/vendor/jspdf/jspdf.umd.min.js")
      .then(function () { return gwrLaden(aktuellUmg || { gebaeude: [] }); })
      .then(function () {
        bilder.axo = axoBild(v, m, { explo: false, blick: blick, hg: "#ffffff" }, 2400, 1900);
        bilder.explo = axoBild(v, m, { explo: true, blick: blick, hg: "#ffffff", eng: true }, 1800, 1800);
        return bildDaten(ROOT + "assets/img/logo-dark.png"); })
      .then(function (logo) { bilder.logo = logo; return Promise.all([groesse(bilder.axo), groesse(bilder.explo)]); })
      .then(function (gr) {
        var J = window.jspdf.jsPDF, doc = new J({ unit: "mm", format: "a4", orientation: "portrait" });
        var W = 210, Hs = 297, M = 16, ORANGE = [241, 93, 48], DUNKEL = [29, 28, 26], GRAU = [120, 116, 108], LINIE = [222, 218, 210];
        var datum = new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" });
        function fuss(nr) {
          doc.setDrawColor.apply(doc, LINIE); doc.setLineWidth(0.2); doc.line(M, Hs - 14, W - M, Hs - 14);
          doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRAU);
          doc.text("apb architekten ag · Seestrasse 110a · 8610 Uster · +41 44 944 60 80 · www.apb-architekten.ch", M, Hs - 9);
          doc.text(nr + " / 3", W - M, Hs - 9, { align: "right" });
        }
        function kopf(titel) {
          doc.addImage(bilder.logo, "PNG", M, 12, 46, 46 * 127 / 730);
          doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor.apply(doc, ORANGE); doc.text("///", W - M - doc.getTextWidth("/// " + titel.toUpperCase()), 17.5);
          doc.setTextColor.apply(doc, GRAU); doc.text(titel.toUpperCase(), W - M, 17.5, { align: "right" });
          doc.setFont("helvetica", "normal"); doc.text(datum, W - M, 22, { align: "right" });
        }
        function bild(u, gr2, x, y, w, hmax) { var h = w * gr2[1] / gr2[0]; if (h > hmax) { h = hmax; } doc.addImage(u, "PNG", x, y, w, h, undefined, "FAST"); return h; }
        function zeileKV(x, y, w, l, val) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor.apply(doc, GRAU); doc.text(String(l), x, y);
          doc.setTextColor.apply(doc, DUNKEL); var tx = doc.splitTextToSize(String(val), w * 0.58); doc.text(tx, x + w * 0.42, y);
          var h = Math.max(1, tx.length) * 3.9 + 2.2; doc.setDrawColor.apply(doc, LINIE); doc.line(x, y + h - 3.2, x + w, y + h - 3.2); return h;
        }
        function abschnitt(x, y, txt) { doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor.apply(doc, ORANGE); doc.text("///", x, y); doc.setTextColor.apply(doc, DUNKEL); doc.text(txt.toUpperCase(), x + 6, y); return y + 6; }
        function farbe(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }

        // ---------- Seite 1: Titel, Axonometrie, Kennzahlen
        kopf(t("Potenzialstudie", "Potential study"));
        doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor.apply(doc, DUNKEL);
        doc.text(re.MunicipalityName + " · " + t("Parzelle ", "Plot ") + re.Number, M, 42);
        doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor.apply(doc, GRAU);
        doc.text(doc.splitTextToSize((a.zoneTxt || "") + " · " + v.name + " · " + v.n + " " + t("Geschosse", "storeys") + (v.dg ? " + " + (v.dach === "attika" ? "Attika" : t("Dachgeschoss", "attic")) : ""), W - 2 * M), M, 49);
        var hb = bild(bilder.axo, gr[0], M, 56, W - 2 * M, 165);
        var y = 56 + hb + 8, kw = (W - 2 * M - 9) / 4;
        [[zahl(re.LandRegistryArea) + " m²", t("Grundstücksfläche", "Plot area")], [zahl(v.gf) + " m²", t("Geschossfläche", "Floor area")], [String(m.total), t("Wohnungen", "Apartments")], [Math.round(v.aus * 100) + " %", t("der zulässigen Ausnützung", "of permitted density")]].forEach(function (kz, i) {
          var x = M + i * (kw + 3);
          doc.setFillColor(246, 244, 240); doc.rect(x, y, kw, 22, "F");
          doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor.apply(doc, DUNKEL); doc.text(kz[0], x + 4, y + 10);
          doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRAU); doc.text(doc.splitTextToSize(kz[1], kw - 8), x + 4, y + 16);
        });
        y += 28;
        var hk = doc.splitTextToSize(t("Das Werkzeug rechnet mit festen, offengelegten Regeln (keine KI-Schätzung): amtliche Daten (amtliche Vermessung, ÖREB-Kataster Kanton Zürich) live abgefragt, Zonenwerte aus der Bau- und Zonenordnung der Gemeinde, dazu klar markierte Annahmen (Rechenweg auf Seite 3). Volumen, Flächen und Wohnungsmix sind schematisch. Die Studie ersetzt weder die Prüfung durch die Architektin oder den Architekten noch eine Vorabklärung beim Bauamt.", "Fixed, disclosed rules (no AI estimate). Not a substitute for an architect's review or a preliminary enquiry."), W - 2 * M - 10);
        doc.setFillColor(253, 240, 234); doc.rect(M, y, W - 2 * M, hk.length * 3.8 + 12, "F"); doc.setFillColor.apply(doc, ORANGE); doc.rect(M, y, 1.2, hk.length * 3.8 + 12, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor.apply(doc, DUNKEL); doc.text(t("Ersteinschätzung – keine Bewilligungsprüfung", "Initial assessment – not a permit review"), M + 5, y + 6);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(70, 66, 60); doc.text(hk, M + 5, y + 11);
        fuss(1);

        // ---------- Seite 2: Explosionsaxo, Mix, Baurecht, ÖREB, Volumen
        doc.addPage(); kopf(t("Potenzialstudie", "Potential study"));
        var L = M, B = (W - 2 * M - 8) / 2, Rx = M + B + 8, yl = 36, yr = 36;
        yl = abschnitt(L, yl, t("Baurecht", "Zoning"));
        [[t("Zone", "Zone"), a.zoneTxt || "–"], [t("Dichte", "Density"), k.dichte || "–"], [t("Geschosse", "Storeys"), z.vg ? z.vg + " VG" + (z.dg != null ? " + " + z.dg + " DG" : "") + (z.attika ? " / Attika" : "") : t("frei im Rahmen der Höhen", "free within height limits")],
         [t("Fassadenhöhe", "Facade height"), z.fh ? zahl(z.fh, 1) + " m" : (z.gh ? zahl(z.gh, 1) + " m (" + t("Gebäudehöhe", "building height") + ")" : "–")], [t("Gebäudelänge", "Building length"), z.laenge ? "max. " + z.laenge + " m" : "–"],
         [t("Grenzabstand", "Boundary distance"), (z.ga_k ? zahl(z.ga_k, 1) + " m" : "–") + (z.ga_g ? " / " + t("gross ", "large ") + zahl(z.ga_g, 1) + " m" : "")], [t("Geschossfläche max.", "Max. floor area"), k.gf ? "ca. " + zahl(k.gf) + " m²" : "–"],
         [t("Zulässiges Baufeld", "Permitted envelope"), aktuellR ? "ca. " + zahl(aktuellR.flaeche) + " m²" : "–"], [t("Grundlage", "Basis"), "BZO " + (g.name || "") + ((z.artikel || g.artikel) ? ", " + (z.artikel || g.artikel) : "") + " · " + (g.stand || "")]].forEach(function (r) { yl += zeileKV(L, yl, B, r[0], r[1]); });
        yl += 4; yl = abschnitt(L, yl, t("ÖREB-Kataster", "PLR cadastre"));
        var AMP = { gruen: [108, 192, 139], gelb: [226, 176, 74], rot: [229, 72, 77], info: [143, 183, 214] };
        a.eintraege.slice(0, 9).forEach(function (e) {
          doc.setFillColor.apply(doc, AMP[e.farbe] || AMP.info); doc.circle(L + 1.3, yl - 1.1, 1.1, "F");
          doc.setFont("helvetica", "normal"); doc.setFontSize(8.3); doc.setTextColor.apply(doc, DUNKEL);
          var tx = doc.splitTextToSize(e.legende, B - 6); doc.text(tx, L + 5, yl);
          var th = doc.splitTextToSize(e.thema, B - 6);
          doc.setFontSize(7); doc.setTextColor.apply(doc, GRAU); doc.text(th, L + 5, yl + tx.length * 3.6);
          yl += tx.length * 3.6 + th.length * 3.0 + 3.2;
        });
        doc.setFontSize(7); doc.setTextColor.apply(doc, GRAU); doc.text(a.nicht + t(" weitere Themen nicht betroffen.", " further topics not affected."), L, yl); yl += 8;
        yl = abschnitt(L, yl, t("Volumen", "Massing"));
        [[t("Typologie", "Typology"), v.name], [t("Geschosse", "Storeys"), v.n + (v.dg ? " + " + (v.dach === "attika" ? "Attika" : "DG") : "")], [t("Dachform", "Roof"), { attika: t("Flachdach mit Attika", "Flat roof with attic"), flach: t("Flachdach", "Flat roof"), sattel: t("Satteldach", "Pitched roof"), walm: t("Walmdach", "Hipped roof") }[v.dach] + (v.lukarnen ? t(", Lukarnen", ", dormers") : "")],
         [t("Geschossfläche", "Floor area"), zahl(v.gf) + " m² (" + Math.round(v.aus * 100) + " %)"]].concat(v.bestandN ? [[t("Bestand", "Existing"), v.bestandN + " " + t("Geschosse bleiben, neu ca. ", "storeys kept, new approx. ") + zahl(v.neuGF) + " m²"]] : [[t("Bewertung Setzung", "Siting score"), v.score + " / 100"]].concat(v.ersatz ? [[t("Bestand", "Existing"), t("Abbruch, Ersatzneubau", "demolition, replacement")]] : [])).forEach(function (r) { yl += zeileKV(L, yl, B, r[0], r[1]); });

        var he = bild(bilder.explo, gr[1], Rx, yr - 4, B, 120); yr += he + 2;
        doc.setFontSize(7); doc.setTextColor.apply(doc, GRAU); doc.text(t("Explosionsaxonometrie – Wohnungen pro Geschoss", "Exploded axonometric – apartments per floor"), Rx, yr); yr += 8;
        yr = abschnitt(Rx, yr, t("Wohnungsmix", "Unit mix") + " · " + t("Ausbaustandard ", "standard ") + standard);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRAU);
        doc.text(t("Typ", "Type"), Rx, yr); doc.text(t("Anzahl", "No."), Rx + B * 0.45, yr, { align: "right" }); doc.text("Ø NWF", Rx + B * 0.7, yr, { align: "right" }); doc.text("Total", Rx + B, yr, { align: "right" }); yr += 2;
        doc.setDrawColor.apply(doc, LINIE); doc.line(Rx, yr, Rx + B, yr); yr += 5;
        Object.keys(m.zaehl).filter(function (x) { return m.zaehl[x]; }).forEach(function (x) {
          doc.setFillColor.apply(doc, farbe(PRAES_FARBE[x])); doc.rect(Rx, yr - 2.8, 3.2, 3.2, "F");
          doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor.apply(doc, DUNKEL);
          doc.text(x + " Zi.", Rx + 5, yr); doc.text(String(m.zaehl[x]), Rx + B * 0.45, yr, { align: "right" }); doc.text(nwf[x] + " m²", Rx + B * 0.7, yr, { align: "right" }); doc.text(zahl(m.zaehl[x] * nwf[x]) + " m²", Rx + B, yr, { align: "right" });
          yr += 2; doc.line(Rx, yr, Rx + B, yr); yr += 5;
        });
        doc.setFont("helvetica", "bold"); doc.text("Total", Rx, yr); doc.text(String(m.total), Rx + B * 0.45, yr, { align: "right" }); doc.text(zahl(m.nwf) + " m²", Rx + B, yr, { align: "right" }); yr += 6;
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRAU);
        doc.text(doc.splitTextToSize("NWF/GF " + Math.round(m.nwf / v.gf * 100) + " % · " + t("Wohnungen durchgesteckt (Wohnen Süd, Schlafen Nord). Flächen nach Ausbaustandard, Mindestwerte gemäss WBS (BWO).", "Through-units; areas by standard, minima per WBS (BWO)."), B), Rx, yr); yr += 12;
        yr = abschnitt(Rx, yr, t("Setzung", "Siting"));
        var gr2 = [[v.strasse > 0.7, t("Adresse zur Strasse, Vorplatz und Zugang", "Address to the street, forecourt and access")], [v.nord > 0.55, t("Volumen im Norden, Aussenraum im Süden", "Building to the north, garden to the south")], [v.ow > 0.7, t("Hauptfassaden nach Süden", "Main facades facing south")], [v.rand > 0.5, t("Luft zu den Nachbarn über den Mindestabstand", "Space to neighbours beyond minimum")]];
        gr2.forEach(function (x) { doc.setFontSize(8.3); doc.setTextColor.apply(doc, x[0] ? [70, 140, 95] : [190, 140, 40]); doc.text(x[0] ? "+" : "–", Rx, yr); doc.setTextColor.apply(doc, DUNKEL); doc.text(doc.splitTextToSize(x[1], B - 5), Rx + 4, yr); yr += 5; });
        fuss(2);

        // ---------- Seite 3: Rechenweg, Annahmen, Quellen
        doc.addPage(); kopf(t("Potenzialstudie", "Potential study"));
        var y3 = abschnitt(M, 36, t("Rechenweg und Annahmen", "Calculation and assumptions"));
        var QF = { amt: [[108, 192, 139], t("amtlich", "official")], bzo: [[143, 183, 214], t("BZO-Tabelle", "BZO table")], calc: [[200, 196, 188], t("berechnet", "calculated")], ann: [[226, 176, 74], t("Annahme", "assumption")] };
        var lx = M; ["amt", "bzo", "calc", "ann"].forEach(function (q) { doc.setFillColor.apply(doc, QF[q][0]); doc.rect(lx, y3 - 2.6, 3, 3, "F"); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRAU); doc.text(QF[q][1], lx + 4.5, y3); lx += doc.getTextWidth(QF[q][1]) + 12; }); y3 += 7;
        rechenweg(a, k, v).forEach(function (r) {
          var wert = doc.splitTextToSize(r[1], 62), notiz = doc.splitTextToSize(r[3], 70), h = Math.max(wert.length * 3.8, notiz.length * 3.3) + 3;
          doc.setFillColor.apply(doc, QF[r[2]][0]); doc.rect(M, y3 - 2.6, 3, 3, "F");
          doc.setFont("helvetica", "normal"); doc.setFontSize(8.3); doc.setTextColor.apply(doc, GRAU); doc.text(r[0], M + 5, y3);
          doc.setTextColor.apply(doc, DUNKEL); doc.text(wert, M + 48, y3);
          doc.setFontSize(7.2); doc.setTextColor.apply(doc, GRAU); doc.text(notiz, M + 112, y3);
          y3 += h; doc.setDrawColor.apply(doc, LINIE); doc.line(M, y3 - 2.4, W - M, y3 - 2.4); y3 += 1.5;
        });
        y3 += 4; y3 = abschnitt(M, y3, t("Nicht berücksichtigt", "Not considered"));
        NICHT_BERUECKSICHTIGT.forEach(function (x) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.2); doc.setTextColor.apply(doc, DUNKEL); var tx = doc.splitTextToSize("– " + x, W - 2 * M); doc.text(tx, M, y3); y3 += tx.length * 3.8 + 1; });
        y3 += 5; y3 = abschnitt(M, y3, t("Quellen", "Sources"));
        [t("Amtliche Vermessung: geodienste.ch (AV-WFS), swisstopo / geo.admin.ch – live abgefragt", "Official survey: geodienste.ch, swisstopo – live"),
         t("ÖREB-Kataster Kanton Zürich: maps.zh.ch/oereb – Auszug vom ", "PLR cadastre Canton of Zurich – extract of ") + (a.datum ? new Date(a.datum).toLocaleDateString("de-CH") : "") + " (" + t("offizieller Auszug: ", "official extract: ") + a.pdf + ")",
         t("Bau- und Zonenordnung: ", "Building code: ") + (g.name || "") + ", " + (z.artikel || g.artikel || "") + " – " + (g.stand || "") + " – " + (g.quelle || ""),
         t("Gebäude- und Wohnungsregister (GWR, BFS) für Höhen der Nachbarbauten; swissALTI3D / swissBUILDINGS3D (swisstopo)", "Federal building register; swisstopo 3D data"),
         t("Wohnungsflächen: Wohnungs-Bewertungs-System WBS 2015, Bundesamt für Wohnungswesen (Mindestwerte)", "Unit sizes: WBS 2015, Federal Office for Housing")].forEach(function (x) {
          doc.setFontSize(7.8); doc.setTextColor(70, 66, 60); var tx = doc.splitTextToSize(x, W - 2 * M); doc.text(tx, M, y3); y3 += tx.length * 3.6 + 1.5; });
        fuss(3);
        doc.save("apb-Potenzialstudie-" + (re.MunicipalityName + "-" + re.Number).replace(/[^\w-]+/g, "-") + ".pdf");
      })
      .catch(function (e) { if (window.console) console.error(e); alert(t("Das PDF konnte nicht erstellt werden.", "The PDF could not be created.")); })
      .then(function () { knopf.disabled = false; knopf.textContent = alt; });
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
      rwAktualisieren(v);
      box.querySelector(".pz-edit-kz").textContent = "GF " + zahl(v.gf) + " m² · " + v.n + " " + t("Geschosse", "storeys") + " · Score " + v.score;
      zeigeVolumen(v, null);
    }
    function anliegend(p, q) { return abstandTeile(p, q) < 0.6; }
    // Jede Änderung muss baurechtlich zulässig bleiben – sonst wird sie zurückgenommen (mit Begründung)
    function zulaessig() {
      v.fest = true; bewerten(v, a, k, R);
      if (!v.teile.every(R.passt)) return t("Baufeldgrenze erreicht (Grenzabstand, Vorzone oder Baulinie).", "Envelope limit reached.");
      if (k.hoehe && v.n * GH > k.hoehe + 0.01) return t("Maximale Höhe der Zone erreicht.", "Maximum height reached.");
      if (!v.teile.every(function (p) { return Math.max(p.L, p.T) <= (z.laenge || 999) + 0.01; })) return t("Maximale Gebäudelänge der Zone erreicht.", "Maximum building length reached.");
      if (!v.teile.every(function (p, i) { return v.teile.every(function (q, j) { var d = abstandTeile(p, q); return i >= j || anliegend(p, q) || d >= 2 * (z.ga_k || 5); }); })) return t("Gebäudeabstand zwischen den Baukörpern zu klein.", "Distance between volumes too small.");
      if (v.aus > 1.001) return t("Ausnützung erschöpft.", "Permitted density used up.");
      return "";
    }
    function zulaessigGrund(e, x) {                    // Grund, weshalb der Zielwert nicht zulässig ist
      var alt = JSON.stringify({ t: v.teile, n: v.n }), p = v.teile[sel];
      if (e === "L") p.L = x; else if (e === "T") p.T = x; else p.ang = x * Math.PI / 180;
      var g = zulaessig(); var o = JSON.parse(alt); v.teile = o.t; v.n = o.n; bewerten(v, a, k, R); return g;
    }
    function aendern(fn) {
      var alt = JSON.stringify({ t: v.teile, n: v.n }), hinweis = box.querySelector(".pz-edit-hinweis");
      fn();
      var grund = zulaessig();
      if (grund && /Ausnützung|density/.test(grund)) { while (v.n > 1 && zulaessig() && /Ausnützung|density/.test(zulaessig())) v.n--; grund = zulaessig(); if (!grund) grund = "ok-n"; }
      if (grund && grund !== "ok-n") { var o = JSON.parse(alt); v.teile = o.t; v.n = o.n; bewerten(v, a, k, R); hinweis.textContent = grund; hinweis.hidden = false; }
      else { hinweis.textContent = grund === "ok-n" ? t("Geschosse automatisch reduziert, damit die Ausnützung eingehalten ist.", "Storeys reduced automatically to respect density.") : ""; hinweis.hidden = grund !== "ok-n"; }
      sync(); pruefen();
    }
    function sync() {
      var p = v.teile[sel];
      box.querySelector("[data-e=L]").value = Math.round(p.L); box.querySelector("[data-e=L] + b").textContent = Math.round(p.L) + " m";
      box.querySelector("[data-e=T]").value = Math.round(p.T); box.querySelector("[data-e=T] + b").textContent = Math.round(p.T) + " m";
      box.querySelector("[data-e=n]").value = v.n; box.querySelector("[data-e=n] + b").textContent = v.n;
      box.querySelector("[data-e=ang]").value = Math.round(p.ang * 180 / Math.PI); box.querySelector("[data-e=ang] + b").textContent = Math.round(p.ang * 180 / Math.PI) + "°";
    }
    var teilSel = v.teile.length > 1 ? '<label class="pz-f"><span>' + t("Baukörper", "Volume") + '</span><select class="pz-teil">' + v.teile.map(function (p, i) { return '<option value="' + i + '">' + (i + 1) + "</option>"; }).join("") + "</select></label>" : "";
    var luk = v.dach === "sattel" && (z.dg || 0) ? '<label class="pz-chkbox"><input type="checkbox" class="pz-luk"' + (v.lukarnen ? " checked" : "") + "> " + t("Lukarnen (Südseite, max. 1/3 Fassadenlänge)", "Dormers (south, max. 1/3 of facade)") + "</label>" : "";
    box.innerHTML = '<div class="pz-sek"><h4>' + t("3 · Entwerfen", "3 · Design") + '</h4><p class="muted small">' + t("Volumen weiterentwickeln – nur baurechtlich zulässige Änderungen werden übernommen.", "Refine the massing – only permissible changes are accepted.") + "</p>" + teilSel +
      '<div class="pz-regler">' +
      '<label><span>' + t("Länge", "Length") + '</span><input type="range" data-e="L" min="8" max="' + Math.max(20, (z.laenge || 40) + 10) + '" step="1"><b></b></label>' +
      '<label><span>' + t("Tiefe", "Depth") + '</span><input type="range" data-e="T" min="8" max="24" step="1"><b></b></label>' +
      '<label><span>' + t("Geschosse", "Storeys") + '</span><input type="range" data-e="n" min="1" max="' + v.nMax + '" step="1"><b></b></label>' +
      '<label><span>' + t("Drehung", "Rotation") + '</span><input type="range" data-e="ang" min="-180" max="180" step="5"><b></b></label></div>' +
      '<div class="pz-move" role="group" aria-label="' + t("Verschieben", "Move") + '"><button type="button" data-m="0,1">↑ N</button><button type="button" data-m="-1,0">← W</button><button type="button" data-m="1,0">O →</button><button type="button" data-m="0,-1">S ↓</button></div>' +
      '<label class="pz-f"><span>' + t("Dachform", "Roof form") + '</span><select class="pz-dach2"><option value="attika">' + t("Flachdach + Attika", "Flat roof + attic") + '</option><option value="flach">' + t("Flachdach", "Flat roof") + '</option><option value="sattel">' + t("Satteldach", "Pitched roof") + '</option><option value="walm">' + t("Walmdach", "Hipped roof") + "</option></select></label>" + luk +
      '<p class="pz-hint warn pz-edit-hinweis" role="status" hidden></p><p class="pz-edit-kz"></p><ul class="pz-gruende pz-chk"></ul><button type="button" class="btn pz-go2">' + t("Weiter → Wohnungsmix", "Next → unit mix") + '<span class="arr"></span></button></div>';
    box.hidden = false;
    box.querySelector(".pz-dach2").value = v.dach;
    sync(); pruefen();
    Array.prototype.forEach.call(box.querySelectorAll("input[type=range]"), function (inp) {
      inp.addEventListener("input", function () {
        var e = inp.dataset.e, p = v.teile[sel], ziel = +inp.value;
        function setze(x) { if (e === "L") p.L = x; else if (e === "T") p.T = x; else if (e === "n") v.n = x; else p.ang = x * Math.PI / 180; }
        function lies() { return e === "L" ? p.L : e === "T" ? p.T : e === "n" ? v.n : Math.round(p.ang * 180 / Math.PI); }
        // schrittweise bis zum Ziel bzw. bis zur letzten zulässigen Stellung (Länge/Tiefe/Geschosse/Drehung)
        var start = lies(), schritt = e === "ang" ? 5 : 1, dir = ziel > start ? 1 : -1, letzteOk = start;
        if (e === "n") { aendern(function () { setze(ziel); }); return; }
        for (var x = start + dir * schritt; dir > 0 ? x <= ziel : x >= ziel; x += dir * schritt) {
          var alt = JSON.stringify({ t: v.teile, n: v.n }); setze(x);
          if (zulaessig()) { var o = JSON.parse(alt); v.teile = o.t; v.n = o.n; p = v.teile[sel]; break; }
          letzteOk = x;
        }
        aendern(function () { setze(letzteOk); });
        if (letzteOk !== ziel) { var h = box.querySelector(".pz-edit-hinweis"); h.textContent = t("Bis zur Grenze angepasst: ", "Adjusted up to the limit: ") + (zulaessigGrund(e, ziel) || ""); h.hidden = false; }
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll(".pz-move button"), function (b) { b.addEventListener("click", function () { var d = b.dataset.m.split(","); aendern(function () { var p = v.teile[sel]; p.c = [p.c[0] + d[0] * 1, p.c[1] + d[1] * 1]; }); }); });
    var ts = box.querySelector(".pz-teil"); if (ts) ts.addEventListener("change", function () { sel = +ts.value; sync(); });
    box.querySelector(".pz-dach2").addEventListener("change", function (e) { v.dach = e.target.value; editor(v, a, k); });
    var lk = box.querySelector(".pz-luk"); if (lk) lk.addEventListener("change", function () { v.lukarnen = lk.checked; pruefen(); });
    box.querySelector(".pz-go2").addEventListener("click", function () { renderMix(v); root.querySelector(".pz-mix").scrollIntoView({ behavior: "smooth", block: "start" }); });
  }

  function renderVolumen(a, k) {
    var box = root.querySelector(".pz-vol"); root.querySelector(".pz-mix").hidden = true; root.querySelector(".pz-edit").hidden = true;
    box.innerHTML = '<div class="pz-sek"><h4>' + t("2 · Volumen", "2 · Massing") + '</h4><p class="muted small">' + t("Strassen, Nachbarbauten und Bestand werden geladen, Varianten werden gerechnet …", "Loading streets, neighbours and existing buildings, computing options …") + "</p></div>"; box.hidden = false;
    if (!k.ring) return;
    if (k.keinWohnen) { box.innerHTML = '<div class="pz-sek"><h4>' + t("2 · Volumen", "2 · Massing") + '</h4><p class="pz-hint warn">' + t("In dieser Zone sind keine Wohnungen vorgesehen – deshalb kein Wohnungs-Volumen. Für eine Umzonung oder Sondernutzung ist eine Abklärung mit der Gemeinde nötig.", "No housing in this zone.") + "</p></div>"; return; }
    umgebung(k.ring).then(function (umg) { return gwrLaden(umg).then(function () { return umg; }); }).then(function (umg) {
      var R = raster(a, k, umg); aktuellR = R; aktuellUmg = umg; rwAktualisieren(null);
      if (window.APB_DEBUG) window.APB_DEBUG.R = R;
      if (letzteParzelle) zeichneParzelle(a, k);          // mit Strassenseite neu zeichnen
      var vs = generieren(a, k, R), bestand = bestandListe(k, umg); aktuellBestand = bestand;
      vs.forEach(function (v) { if (bestand.length) v.ersatz = true; });
      var kopf = '<div class="pz-sek"><h4>' + t("2 · Volumen", "2 · Massing") + "</h4>" + bestandHTML(a, k, bestand, vs);
      var leer = '<p class="pz-hint warn">' + (R && R.flaeche < 260 ? t("Das zulässige Baufeld ist mit ca. ", "The permitted envelope of approx. ") + zahl(R.flaeche) + t(" m² zu klein für einen Neubau mit 13 m Tiefe und mind. 14 m Länge.", " m² is too small for a new building.") + (bestand.length ? t(" Prüfen Sie die Aufstockung des Bestands.", " Check extending the existing building.") : "") : t("Für diese Parzelle konnten keine Neubau-Volumen erzeugt werden (Baufeld zu schmal).", "No massing options could be generated for this plot.")) + "</p>";
      var sk = R.kanten.filter(function (e) { return e.strasse; }).length;
      var liste = vs.length ? '<div class="pz-ersatz"><p class="muted small">' + (bestand.length ? t("Ersatzneubau – der Bestand wird abgebrochen. ", "Replacement – existing buildings are demolished. ") : "") + t("Varianten nach Punktzahl der Setzung sortiert (0–100)", "Options sorted by siting score (0–100)") + iKnopf(INFO.score) + "</p><p class=\"muted small\">" + t("Zulässiges Baufeld ca. ", "Permitted envelope approx. ") + zahl(R.flaeche) + " m² · " + (sk ? t("Strassenseite erkannt – Vorzone ", "Street side detected – forecourt ") + ((a.zone || {}).vorzone != null ? a.zone.vorzone : VORZONE) + " m" : t("keine Strasse direkt angrenzend", "no adjacent street")) + '</p>' + (R.baulinienIgnoriert ? '<p class="pz-hint warn">' + t("Die Baulinien konnten nicht eindeutig einer Strassenseite zugeordnet werden – das Baufeld ist ohne sie gerechnet. Baulinien im ÖREB-Auszug prüfen.", "Building lines could not be assigned; envelope computed without them.") + "</p>" : "") + '<ul class="pz-var">' + vs.map(function (v, i) {
        return '<li><button type="button" data-i="' + i + '" aria-pressed="' + (i === 0) + '"><b>' + esc(v.name) + '</b><span class="sc">' + v.score + ' <i>' + t("Punkte", "points") + "</i></span><small>" + v.teile.length + " " + t("Baukörper", "volumes") + " · " + v.n + " " + t("Geschosse", "storeys") + (v.dg ? " + " + (v.dach === "attika" ? "Attika" : "DG") : "") + " · GF " + zahl(v.gf) + " m² · " + Math.round(v.aus * 100) + " %</small><span class=\"bar\"><i style=\"width:" + v.score + '%"></i></span></button></li>';
      }).join("") + '</ul><div class="pz-why"></div><button type="button" class="btn pz-go">' + t("Dieses Volumen entwerfen", "Refine this massing") + '<span class="arr"></span></button></div>' : leer;
      box.innerHTML = kopf + liste + "</div>";
      var gew = vs[0]; aufstockungAnzeigen.vs = vs;
      function waehleV(i) { gew = vs[i]; rwAktualisieren(gew); Array.prototype.forEach.call(box.querySelectorAll(".pz-var button"), function (b) { b.setAttribute("aria-pressed", +b.dataset.i === i); }); box.querySelector(".pz-why").innerHTML = gruende(gew); root.querySelector(".pz-mix").hidden = true; root.querySelector(".pz-edit").hidden = true; zeigeVolumen(gew, null); }
      Array.prototype.forEach.call(box.querySelectorAll(".pz-var button"), function (b) { b.addEventListener("click", function () { waehleV(+b.dataset.i); }); });
      var go = box.querySelector(".pz-go"); if (go) go.addEventListener("click", function () { var kopie = JSON.parse(JSON.stringify(gew)); editor(kopie, a, k); root.querySelector(".pz-edit").scrollIntoView({ behavior: "smooth", block: "start" }); });
      // Bestand: Umschalten Ersatzneubau / Aufstockung
      function ersatzZeigen() {
        Array.prototype.forEach.call(box.querySelectorAll(".pz-modus button"), function (x) { x.setAttribute("aria-pressed", x.dataset.m === "ersatz"); });
        var au = box.querySelector(".pz-auf"); if (au) au.innerHTML = "";
        var e = box.querySelector(".pz-ersatz"); if (e) { e.hidden = false; box.querySelector(".pz-var").hidden = false; box.querySelector(".pz-why").hidden = false; box.querySelector(".pz-go").hidden = false; }
        root.querySelector(".pz-mix").hidden = true; root.querySelector(".pz-edit").hidden = true;
        if (gew) { rwAktualisieren(gew); zeigeVolumen(gew, null); } else zeigeBestand();
      }
      Array.prototype.forEach.call(box.querySelectorAll(".pz-modus button"), function (bt) {
        bt.addEventListener("click", function () {
          if (bt.dataset.m === "ersatz") return ersatzZeigen();
          Array.prototype.forEach.call(box.querySelectorAll(".pz-modus button"), function (x) { x.setAttribute("aria-pressed", x === bt); });
          var e = box.querySelector(".pz-ersatz"); if (e) e.hidden = true;
          root.querySelector(".pz-mix").hidden = true; root.querySelector(".pz-edit").hidden = true;
          aufstockungAnzeigen(a, k, R, bestand, box, ersatzZeigen);
        });
      });
      if (vs.length) waehleV(0); else zeigeBestand();
    });
  }

  /* ---------- Ablauf ---------- */
  var status = root.querySelector(".pz-status");
  function meldung(m, fehler) { status.textContent = m || ""; status.classList.toggle("err", !!fehler); }
  function waehle(treffer) {
    root.querySelector(".pz-liste").innerHTML = "";
    root.querySelector(".pz-q").value = treffer.label;
    meldung(t("Parzelle und ÖREB-Kataster werden abgefragt …", "Querying plot and PLR cadastre …"));
    praesentation(false); gwrHoehen = null; gwrAttr = null; aktuellBestand = [];
    root.querySelector(".pz-res").hidden = true; root.querySelector(".pz-vol").hidden = true; root.querySelector(".pz-mix").hidden = true; root.querySelector(".pz-edit").hidden = true;
    parzelleAn(treffer.lat, treffer.lon).then(function (p) {
      if (!p.egris_egrid) throw new Error("ohne EGRID");
      return Promise.all([oereb(p.egris_egrid), bzo()]);
    }).then(function (r) {
      var a = auswerten(r[0], r[1]); aktuell = a; meldung("");
      a.k = kennwerte(a); render(a, a.k);
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
  root.querySelector(".pz-std").addEventListener("change", function (e) { standard = e.target.value; if (aktuell) { praesentation(false); aktuell.k = kennwerte(aktuell); render(aktuell, aktuell.k); } });
  // 3D starten, sobald eingeloggt
  if (document.documentElement.classList.contains("pz-on")) karte();
  document.addEventListener("pz-login", function () { karte(); });
})();
