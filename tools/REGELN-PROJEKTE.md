# Regeln für neues Projektmaterial (Vorgaben von Dominik)

Gilt für jedes Projekt, das als Ordner (Fotos, Datenblatt, Pläne) geliefert wird.

## Fotos
- Pro Projekt **6–12 Fotos** auswählen.
- Wenn das Projekt schon auf der Website ist: möglichst die gleichen Motive in besserer Qualität;
  bei neuen oder schwach bebilderten Projekten (z. B. 333-kff Kinderhospiz Flamingo, Fällanden)
  selbst eine gute Auswahl treffen: 1–2 Aussenaufnahmen, dazu übersichtliche Innenaufnahmen.
- Jede Aufnahme bekommt eine **Bildunterschrift**:
  - Aussenaufnahmen brauchen keine Beschriftung.
  - Zeigt eine Innenaufnahme einen bestimmten Raum, wird er benannt (z. B. «Saal», «Klassenzimmer», «Treppenhaus»).
  - Die Dateinamen der Originale geben oft Hinweise auf den Raum.

## Datenblatt
- Wenn vorhanden: Informationen daraus übernehmen (Verfahren, Status, Fertigstellung, Bearbeitung,
  Bauherr, Kosten, Kenndaten, Bauzeit, Beschreibung) und auf der Projektseite schön darstellen.
- Nur übernehmen, was im Datenblatt steht – nichts ergänzen oder schätzen.

## Pläne
Wenn erstellt, immer in dieser Auswahl:
- **Situationsplan** (immer)
- 1–2 **Grundrisse**
- 1–2 **Schnitte**
- 1–2 **Ansichten**

## Formate
- Fotos einheitlich: Querformat **3:2** (2400×1600), Hochformat **4:5** (1600×2000) – keine weiteren Formate.
- Pläne einheitlich **3:2** (2400×1600), Zeichnung zentriert auf Weiss, **ohne Planbeschriftung**
  (Plannummer, Massstab, Format werden aus dem PDF-Text gelesen und entfernt).
- Skript: `tools/material_aufbereiten.py` (Auswahl + Bildunterschriften stehen im Skript).

## Startseite
- Erstes Startbild: **333-kff Kinderhospiz Flamingo** (statt Convenience Shop).

## Ablauf
- Material sammeln, sortieren und vorbereiten (Auswahl, Bildunterschriften, Daten).
- Die Website erst neu bauen, wenn Dominik das Signal gibt (es kommen noch viele weitere Projekte).

## Vorgemerkt: interaktive Pläne (Punkt 3)
- Grundrisse zoombar; beim Darüberfahren über einen Raum erscheint das passende Foto.
- **Vor der Umsetzung mit Dominik klären:** Zuordnung Raum ↔ Foto muss bestätigt werden
  (Dateinamen der Fotos und Raumbezeichnungen im Plan reichen allein nicht sicher).

## Datenblätter
- Sammlung: `_apb-Projektdaten-Allg-CC24-260612.pdf` → `tools/datenblaetter_auslesen.py` → `content/datenblaetter/seiten.json`
- Zuordnung Seite → Projekt und neue Projekte: `tools/datenblaetter.py`
- Nicht übernommen: Platzhalter (Lorem ipsum, XX), Kontakt-/Referenzpersonen, Telefonnummern, Namen privater Bauherrschaften
- Entwürfe ohne Inhalt (339 Pfungen, Rooswis, Doppel-EFH Fuchsgasse) noch nicht veröffentlicht

## Text in Grafiken (Logo usw.) – gilt immer
- Text nie aus Pixelbildern nachzeichnen. Zuerst die Schrift bestimmen und den Text mit der echten Schrift setzen (Konturen aus der Schriftdatei).
- Nur nicht-typografische Teile (z. B. der skizzierte Würfel im Logo) dürfen vektorisiert werden.
- Logo-Wortmarke «apb architekten ag»: Arial/Helvetica Bold → gesetzt mit Liberation Sans Bold (gleiche Masse wie Arial).
