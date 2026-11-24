# Potenzial-Tool: Setzung, Wohnungsstandards, Baurecht (Deep-Dive 23.11.2026)

> Erinnerung: **Dominik liefert noch 2–3 Machbarkeitsstudien von apb (PDF)** zur Kalibrierung.

Kennzeichnung: **[Q]** = mit Quelle belegt (Liste unten) · **[F]** = gängige Entwurfspraxis/Fachwissen, noch mit apb-Studien abzugleichen · **[A]** = Annahme für den Start, im Tool einstellbar.

---

## 1. Baurecht: was das Tool rechnet
Datentabelle: `content/potenzial/bzo.json` (erzeugt aus `bzo_daten.py`): 13 Gemeinden, 60 Wohnzonen, mit Quelle, Artikel und Stand.

- **Dichte**: Je nach Gemeinde gilt die Ausnützungsziffer (AZ, Uster, Volketswil, Greifensee, Maur, Egg, Grüningen, Mönchaltorf) oder die Baumassenziffer (BMZ m³/m², Gossau, Schwerzenbach, Fällanden, Wetzikon, Pfäffikon). Das Tool rechnet beide:
  - AZ: anrechenbare Geschossfläche (Vollgeschosse + anrechenbare Dach-/Untergeschosse) ≤ AZ × Grundstücksfläche **[Q]**
  - BMZ: oberirdisches Bauvolumen ≤ BMZ × Grundstücksfläche **[Q]**
- **Höhe**: IVHB-Gemeinden mit Fassadenhöhe (trauf-/giebelseitig, Attika fassadenbündig), ältere BZO mit Vollgeschossen bzw. Gebäudehöhe. Uster und Schwerzenbach haben noch Vollgeschosse/Gebäudehöhe. Annahme Geschosshöhe 3.0 m **[A]**.
- **Grenzabstände**: kleiner/grosser Grundabstand aus der Tabelle, dazu der Mehrlängenzuschlag (Anteil der Mehrlänge ab zuschlagsfreier Länge, mit Maximum). In mehreren Gemeinden gilt der **grosse Abstand vor der Südseite bzw. Hauptwohnseite** (Greifensee, Mönchaltorf, Grüningen, Pfäffikon) **[Q]**. Das passt zur Regel «Volumen nach Norden» (Abschnitt 2).
- **Kantonal (PBG/ABV ZH)**: Grenzabstand § 260 ff. PBG; Mehrlängenzuschlag in § 21 ff. ABV, Anwendung durch die Gemeinde **[Q]**; Strassen- und Baulinien aus dem ÖREB; Waldabstand 30 m und Gewässerraum aus dem ÖREB **[F]**.
- **Arealüberbauung**: Nur als Hinweis mit Bonus, sobald die Fläche die Schwelle erreicht. Beispiele: Uster ab 4000 m² mit +2 Vollgeschossen in W3/W4; Gossau +0.7 BMZ und +1 Geschoss; Grüningen ab 3000 m² mit AZ +1/10 (+1/10 ökologisch) **[Q]**.
- **Lärm (LSV)**: An lärmbelasteten Lagen braucht jede Wohnung eine ruhige Seite. Ausnahmen gelten nur, wenn höchstens ⅓ der Zimmer betroffen ist. Gemessen wird am offenen Fenster, Komfortlüftung zählt im Kanton Zürich nicht als Massnahme **[Q]**.

## 2. Setzung auf dem Grundstück: Regeln für den Generator
Jede Variante wird als Punktzahl bewertet (0–100). Muss-Regeln schliessen Varianten aus, Soll-Regeln geben Punkte.

**Muss (Ausschluss)**
1. Volumen vollständig im Baufeld (Grundstück minus Grenzabstände, Strassen-/Baulinien, Gewässerraum, Waldabstand).
2. Dichte, Höhe und Länge innerhalb der Zonenwerte (inkl. Mehrlängenzuschlag).
3. Gebäudetiefe Wohnen 10–16 m (zweiseitig belichtet max. ~14 m; tiefer nur mit innenliegender Mitte) **[Q/F]**.

**Soll (Gewichtung in Klammern)**
4. **Volumen nach Norden (20)**: Volumen möglichst an die Nordgrenze rücken; der zusammenhängende, besonnte Aussenraum liegt im Süden/Westen. Bei EFH und kleinen MFH besonders stark gewichtet **[F]**. Wo die BZO den grossen Abstand an die Südseite legt, ergibt sich das schon aus dem Baurecht **[Q]**.
5. **Erschliessung von Norden (10)**: Zugang, Treppenhaus und Nebenräume an die Nordseite; Wohnen, Essen und Balkone nach Süden/Westen **[F]**.
6. **Ausrichtung nach Typologie (15)** **[F/Q]**:
   - Riegel/Zeile: Längsachse Ost–West, Hauptfassade nach Süden. Bei Tiefe über ~12 m durchgesteckte Wohnungen (Wohnen Süd, Schlafen Nord) **[F]**.
   - Riegel Nord–Süd: Ost-West-Wohnungen (Schlafen Ost, Wohnen West) sind zulässig und bei grosser Tiefe sinnvoll **[Q]**.
   - Punkthaus: richtungsneutral, 2–4 Wohnungen pro Geschoss um einen Kern, Tiefe 10–14 m **[Q]**.
   - Winkel/Hof: Öffnung nach Süden/Südwesten, der Hof als gemeinsamer Aussenraum.
7. **Besonnung (15)**: Besonnte Fassadenfläche nach Süden ±45° maximieren; Schattenwurf auf den eigenen Aussenraum und die Nachbarn minimieren. Berechnet wird mit dem Sonnenstand am 21.3./21.9. und 8./21.12. **[F]**.
8. **Lärm (15)**: Liegt die Parzelle an einer Lärmquelle (Strassenlärm-Kataster), kommen Erschliessung und Nebenräume auf die Lärmseite und Wohnräume sowie Aussenräume auf die ruhige Seite. Das Volumen soll den Aussenraum abschirmen. Abrücken von der Lärmquelle bringt wenig **[Q]**.
9. **Strassenbezug/Adresse (10)**: Hauseingang sichtbar von der Strasse, Volumen parallel oder senkrecht zur Strasse, Vorzone 3–6 m **[F]**.
10. **Topografie (5)**: Längsachse parallel zu den Höhenlinien; Abgrabungen minimal (Uster Dorfzone: max. 1.0 m) **[Q/F]**.
11. **Bestand und Bäume (5)**: Grosse Bäume (swissTLM3D-Vegetation) und schützenswerte Bauten (Inventar) meiden **[F]**.
12. **Kompaktheit (5)**: Verhältnis Hüllfläche zu Volumen gering (Energie, Kosten); Fassade/Grundfläche bei Tiefe 14–18 m kostengünstig **[Q/F]**.
13. **Parkierung**: Tiefgaragenrampe möglichst kurz zur Strasse; ab etwa 8–10 Wohnungen Tiefgarage statt Aussenparkplätzen **[A]**.

**Varianten 1–5 (Generator)**: Zeile · Punkt(e) · Winkel · Hof/U · Kombination Zeile + Punkt. Jede Variante wird in 15°-Schritten gedreht und entlang der Nordgrenze verschoben; je Typ kommt die beste in die Auswahl.

**Dachformen**: Flachdach mit Attika (Attika auf der Nordseite zurückversetzt, Terrasse nach Süden), Satteldach (First parallel zur Längsfassade, Pflicht z. B. in Uster-Kernzonen und Grüningen), Walmdach. Was erlaubt ist, bestimmen BZO bzw. Zone (z. B. Grüningen: nur Giebeldächer, keine Attika; Egg: Steildach 25°–40°) **[Q]**.

## 3. Wohnungsstandards (Wohnungsmix)
Minimum nach **WBS 2015 (BWO), Grundausstattung**: Nettowohnfläche 1 Zi. 30 m², 2 Zi. 45, 3 Zi. 60, 4 Zi. 80, 5 Zi. 100, 6 Zi. 120. Erstes Zimmer ≥ 14 m², weitere ≥ 10 m²; mindestens die Hälfte der Zimmer 2.60 m hoch; ein Zimmer ≥ 3.50 m breit **[Q]**. (WBS zählt ganze Zimmer; «3.5 Zi.» entspricht 3 Zimmern plus Wohn-/Essbereich.)

Im Tool als **Auswahl Ausbaustandard** (Nettowohnfläche m², Startwerte **[A]**, mit apb-Studien kalibrieren):

| Typ | einfach | **mittel (Standard)** | gehoben |
|---|---|---|---|
| 1.5 Zi. | 35 | 40 | 50 |
| 2.5 Zi. | 50 | 60 | 75 |
| 3.5 Zi. | 70 | 82 | 100 |
| 4.5 Zi. | 90 | 105 | 130 |
| 5.5 Zi. | 110 | 125 | 155 |

- **Mix (Start)** **[A]**: 2.5 Zi. 30 % · 3.5 Zi. 40 % · 4.5 Zi. 25 % · 5.5 Zi. 5 % (Mietwohnungsbau Agglomeration). Im Tool per Schieberegler.
- **Kennwerte** **[A/F]**: Geschossfläche → Hauptnutzfläche ~ 0.75–0.80 (Spänner), 0.70–0.75 (Laubengang), 0.72–0.78 (Punkthaus); Aussenbereich min. 3–6 m² nach WBS **[Q]**, Standard mittel 8–12 m² Balkon.
- **Darstellung**: Jede Wohnung wird als farbiger Teilkörper im Volumen gezeigt (Farbe nach Typ). Die Wohnungen liegen entlang der Südfassade, Kern und Erschliessung an der Nordseite.

## 3a. Bebaute Parzellen: Ersatzneubau oder Aufstockung
Steht auf der Parzelle schon ein Gebäude (amtliche Vermessung, Grundfläche ≥ 25 m²), zeigt das Tool den Bestand mit Daten aus dem eidg. Gebäude- und Wohnungsregister (GWR): Gebäudeart, Grundfläche, Geschosse, Baujahr, Wohnungen **[Q]**. Dann gibt es zwei Wege:

- **Ersatzneubau** (Standard): Der Bestand wird abgebrochen (gestrichelter Umriss in der 3D-Ansicht), der Generator setzt den Neubau frei ins Baufeld. Vergleich «heute ca. X m² → Ersatzneubau bis ca. Y m²».
- **Aufstockung prüfen**: Zusätzliche Geschosse = Minimum aus
  1. zulässige Vollgeschosse minus bestehende Geschosse,
  2. (Höhe − Bestand × 3.0 m) ÷ 3.0 m,
  3. (zulässige Geschossfläche − Bestandesfläche) ÷ Grundfläche (entfällt in Zonen mit Baufeld statt Ziffer).

  Reicht es für kein Vollgeschoss, aber ist ein Attikageschoss zulässig, wird ein Dachaufbau geprüft. Geht beides nicht, erscheint der Hinweis «Aufstockung nicht möglich – Ersatzneubau möglich» mit dem Grund **[Q/A]**.
- Liegt der Bestand im heutigen Grenzabstand, ist eine Aufstockung nur im Rahmen der Bestandesgarantie bzw. mit Ausnahmebewilligung möglich (§ 357 PBG) – das Tool warnt **[Q]**.
- Annahmen **[A]**: Grundfläche als umschliessendes Rechteck; Geschosszahl aus GWR (zählt teils Dach-/Untergeschosse mit); Statik, Erdbeben, Erschliessung (Lift) und Brandschutz nicht geprüft.

## 4. Offene Punkte
- Seegräben: BZO-PDF nicht abrufbar → nachtragen.
- Wetzikon: nur der Entwurf 2025 ist erfasst → geltende BZO prüfen.
- Uster: erledigt – Teilrevision 13.4.2026 (IVHB, Vorwirkung) erfasst, inkl. G-Zonen (+1/5 Ausnützung).
- ÖREB-JSON (maps.zh.ch) und WFS-Geometrien (Zonen, Abstandslinien) testen.
- Flächenwerte «mittel/gehoben» mit Marktdaten (Wüest Partner) bzw. apb-Studien belegen.

## Quellen
- BWO, WBS Grundausstattung: https://www.bwo.admin.ch/dam/de/sd-web/x7O0JpIXvzYi/wbs_grundausstattung_de_web.pdf
- BWO, K15 Nettowohnfläche: https://www.bwo.admin.ch/de/k15nettowohnflaeche
- A. Kohne, Bautiefe Wohnen (ETH Jahrbuch 2013): https://www.andreaskohne.ch/texte/bautiefe-wohnen/
- TU Graz, Entwicklung des Wohnungsgrundrisses: https://www.iw.tugraz.at/iw/tl_files/I_W/Mediathek/wohnbautetris/wbvo_sos11_nograsek_wohnungsgrundriss.pdf
- Kt. ZH Fachstelle Lärmschutz, Wohnqualität und Lärm: https://sia-schaffhausen.ch/media/download/sia-sh-mai15-gastberger-wohnqualitaet-laerm-handout.pdf
- bauen-im-laerm.ch, Beispiel Werdstrasse Dietikon: https://www.bauen-im-laerm.ch/grundriss-ausrichtung/beispiele-grundriss-und-ausrichtung/werdstrasse-dietikon/
- Kt. ZH FALS, Massnahmenoptimierung: https://www.bauen-im-laerm.ch/wp-content/uploads/2022/03/Info-bauenimlaerm_massnahmenoptimierung.pdf
- Kt. ZH Leitfaden Siedlungsentwicklung nach innen (2015): https://internet.zh.ch/content/dam/zhweb/bilder-dokumente/themen/planen-bauen/raumplanung/merkblaetter/2015_04_Leitfaden_Siedlungsentwicklung.pdf
- PBG/ABV ZH (Mehrlängenzuschlag § 21 ff. ABV): https://www.lexfind.ch/tolv/207773/de
- BZO-Quellen je Gemeinde: siehe `bzo.json` (Feld `quelle`).
