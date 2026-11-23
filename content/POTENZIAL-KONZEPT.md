# «Potenzial»: Konzept Machbarkeits-Tool (Recherche 23.11.2026)

Ziel: Eine Parzelle eingeben (Adresse, Parzellennummer oder Klick auf die Karte). Das Tool prüft das Baurecht, schlägt 1–5 Volumen vor, erstellt nach der Wahl einen Wohnungsmix und zeigt alles farbig im 3D-Modell.
Abgrenzung zu portrealestate.ch/de/bewertung: dort steht der Marktwert im Vordergrund («Immobilien-Vibe»). Bei uns zählen das Baurecht und die architektonische Antwort.

## 1. Datenquellen (alle offen, Kanton Zürich)
| Was | Quelle | Status |
|---|---|---|
| Adresse → Koordinate | api3.geo.admin.ch SearchServer | im Einsatz |
| Koordinate → Grundstück (EGRID, Nummer, Fläche, Geometrie) | ÖREB GetEGRID; geodienste.ch AV-WFS (Liegenschaften) | AV-WFS bereits genutzt (tools/projekt_volumen.py) |
| ÖREB-Auszug (Zonen, überlagernde Festlegungen, Abstandslinien, Gewässerraum, belastete Standorte, Grundwasserschutz) | `https://maps.zh.ch/oereb/v2/extract/json/?EGRID=…` (JSON), PDF unter `/extract/pdf` | testen; JSON-Schema schemas.geo.admin.ch/V_D/OeREB/2.0 |
| Zonen, Abstandslinien als Geometrie | WFS «ÖREB-Kataster ZH» (opendata.swiss); WMS für die Kartenanzeige | prüfen |
| BZO-Werte (Ausnützungs-/Baumassenziffer, Vollgeschosse, Gebäude-/Fassadenhöhe, Grenzabstände, Dachgeschosse) | **keine** maschinenlesbare Quelle; steht in den BZO-PDFs der Gemeinden | eigene Tabelle pro Gemeinde und Zone aufbauen (Start: Uster, Volketswil, Gossau, Greifensee …) |
| Kantonale Regeln (PBG/ABV: Grenzabstand, Mehrlängenzuschlag, Dachgeschoss, Abgrabungen) | PBG ZH, ABV | als Regeln im Code |
| Bestand (Gebäude, Wohnungen, Baujahr, Volumen) | GWR (ch.bfs.gebaeude_wohnungs_register), AV-Bodenbedeckung | im Einsatz |
| Gelände, Nachbarbauten, Bäume | swissALTI3D, swissBUILDINGS3D, Vegetation 3D | im Einsatz (3D-Ansicht) |
| Lärm, Naturgefahren, Denkmalschutz/Inventare | geo.admin-Layer (Strassenlärm, Gefahrenkarte), kantonales Inventar | Hinweise |

## 2. Ablauf im Tool
1. **Parzelle**: Suche oder Klick. Die Grenze erscheint im 3D, dazu Kennwerte: Fläche, Zone, Bestand.
2. **Baurecht-Check**: der ÖREB-Auszug als verständliche Ampel (Zone, Ausnützung, Höhen, Abstände, Abstandslinien, Gewässer, Lärm, Gefahren, Schutz). Jede Zeile verlinkt auf die Rechtsgrundlage.
3. **Baufeld**: Parzelle minus Grenzabstände, Abstandslinien, Gewässerraum und Waldabstand → mögliche Fläche (Polygon-Offset, z. B. Turf.js / Clipper).
4. **Volumen 1–5**: regelbasierter Generator, je eine Typologie: Zeile, Punkt, Winkel, Hof und Kombination (ein Volumen pro Typologie). Variiert werden Geschosszahl, Dachform (Flachdach mit Attika, Sattel- und Walmdach nach Zonenregel) und Ausrichtung nach Sonne. Bewertet wird nach Ausnützung, Kompaktheit (A/V) und Besonnung.
5. **Wohnungsmix**: Nach der Wahl eines Volumens wird jedes Geschoss in Wohnungen aufgeteilt (2.5 / 3.5 / 4.5 Zi., Zielmix per Schieberegler, Raster + Kern/Treppenhaus). Die Wohnungen erscheinen im 3D farbig nach Typ, mit Kennzahlen: HNF, GF, Anzahl Wohnungen, Effizienz.
6. **Bericht**: PDF «Potenzialanalyse» im apb-Layout (Parzelle, Baurecht, Varianten, Mix, Kennzahlen, Vorbehalt «ersetzt keine Vorabklärung beim Bauamt»).

## 3. Technik
- Front-End: bestehende Cesium-3D-Ansicht. Volumen und Wohnungen als extrudierte Polygone, wie bereits beim Projektvolumen.
- Rechenteil im Browser (JS): Offset/Clipping, Generator, Mix. Kein Server nötig, solange die BZO-Tabelle statisch bleibt.
- Für den echten Login und die gespeicherten Studien braucht es später einen kleinen Server (z. B. Cloudflare Worker / Supabase). Der heutige Login ist nur eine Sichtsperre.
- CSP: maps.zh.ch und geodienste.ch in `connect-src` aufnehmen.

## 4. Etappen
1. Parzelle + ÖREB-Ampel (1–2 Tage)
2. Baufeld + 1 Volumen aus der BZO-Tabelle für 2–3 Gemeinden (2–3 Tage)
3. 1–5 Varianten + Dachformen (2 Tage)
4. Wohnungsmix + farbige 3D-Darstellung (2–3 Tage)
5. PDF-Bericht, Login serverseitig (2 Tage)

## 5. Risiken
- BZO-Werte sind nicht digital → Pflegeaufwand pro Gemeinde. Darum mit dem eigenen Einzugsgebiet starten.
- Rechtliche Verbindlichkeit: klar als Ersteinschätzung kennzeichnen.
- Sonderregeln (Arealüberbauung, Gestaltungsplan) nur als Hinweis anzeigen, nicht rechnen.

Quellen: zh.ch ÖREB-Auszug-Anleitung; geolion.zh.ch Geodatensatz 3153; opendata.swiss WFS ÖREB-Kataster ZH; HSLU-Bachelorarbeiten (automatisierte Volumenstudien); portrealestate.ch.
