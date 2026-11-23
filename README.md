# apb architekten ag – Website (Redesign 2026)

Statische Website ohne Build-Schritt. Alle Inhalte stammen von der bisherigen Seite apb-architekten.ch.

## Seiten
| Datei | Inhalt (alte Seite) |
|---|---|
| `index.html` | Startseite (Slider, Projektauswahl, Themen, Karte) |
| `projekte.html` | Architektur / Projektliste – Raster, Liste, Karte, Zeitachse, Filter, Suche |
| `projekt.html?p=<id>` | Projektdetail (z. B. `?p=319-sag`), `?p=wettbewerbe` für Wettbewerbe |
| `leistungen.html` | Planung + Beratung (interaktive SIA-112-Phasen) |
| `buero.html` | Information: Firmenprofil, Atelier, Team |
| `chronik.html` | 30 Jahre apb – Chronik 1996–2026 (neu) |
| `karriere.html` | Offene Stellen + Lehrstelle |
| `praesentation.html` | Vorschlag für die Geschäftsleitung (nicht verlinkt) |
| `kontakt.html`, `impressum.html` | Kontakt, Impressum & Datenschutz |

## Seiten bearbeiten
Die HTML-Seiten werden mit `python3 tools/build.py` aus den Texten in `tools/build.py` erzeugt (Kopf, Navigation und Fusszeile für alle Seiten gleich).

## Alles neu bauen (Reihenfolge)
```
python3 tools/projekte_einbauen.py     # Projektdaten -> assets/js/data.js
HOME_VARIANT=A python3 tools/build.py  # deutsche Seiten, Weiterleitungen, .htaccess
python3 tools/englisch.py              # englische Seiten unter en/ (meldet Lücken in content/en/fehlend.txt)
python3 tools/seo.py                   # Projektseiten DE/EN, Meta-Angaben, sitemap.xml, robots.txt
```
Englische Texte: `content/en/seiten.py` (Seiten und Bedienelemente), `content/en/projekte.py` (Projekttexte),
`content/en/fakten.py` (Kenndaten, Rollen, Legenden, Pläne). Fachbegriffe: `content/en/GLOSSAR.md`.

## Go-live (Google)
Die Vorschau auf GitHub Pages ist für Google gesperrt (`noindex`), damit sie der echten Website keine Konkurrenz macht.
Für den Wechsel auf www.apb-architekten.ch alles mit `APB_LIVE=1` bauen (z. B. `APB_LIVE=1 python3 tools/build.py` usw.):
Dann sind Indexierung, Sitemap, Canonical-Adressen und strukturierte Daten auf die echte Domain gestellt, und die
`.htaccess` leitet alle alten Adressen dauerhaft (301) auf die neuen Seiten um. Danach die Sitemap in der Google Search Console einreichen.

## Startseiten-Varianten
`HOME_VARIANT=A python3 tools/build.py` (A = Kino/Slider, B = Index/Projektliste, C = Mosaik/Bildraster). Ohne Angabe wird A gebaut.

## Alte Adressen
`tools/build.py` erzeugt Weiterleitungen für alle Adressen der bisherigen Website (z. B. `/architektur/projekte/319-sag/`, `/planung/`, `/offene-stellen/...`).

## Projekte pflegen
Alle Projektdaten liegen in `assets/js/data.js` (Name, Ort, Kenndaten, Themen, Koordinaten, Bildmasse).
Bilder: `assets/img/projects/<id>/01.jpg` (gross, 1600 px) und `01-s.jpg` (klein, 800 px); `01` ist das Titelbild. Für Titel- und Vorschaubilder zusätzlich `.webp` (wird auf der Seite verwendet).

## Lokal ansehen
```
python3 -m http.server 8000   # dann http://localhost:8000
```

## Technik
- Schrift Inter (selbst gehostet), Leaflet (lokal) mit swisstopo-Karten (kein API-Key nötig)
- Keine Cookies, kein Tracking, keine externen CDNs

## Versionen
Jede freigegebene Version steht in `versions.txt` (Name + Commit) und bleibt dauerhaft online:

| Version | Link |
|---|---|
| neuester Stand | https://dominik-mettler.github.io/Website-apb/ |
| v1 – erstes Redesign | https://dominik-mettler.github.io/Website-apb/v1/ |
| v2 – Schwarz, Orange, Intro, 30 Jahre | https://dominik-mettler.github.io/Website-apb/v2/ |
| v3 – Intro mit Original-Logo | https://dominik-mettler.github.io/Website-apb/v3/ |
| v4 – 30 füllt sich sauber | https://dominik-mettler.github.io/Website-apb/v4/ |
| v5 – Variante A «Kino» | https://dominik-mettler.github.io/Website-apb/v5/ |
| v6 – Variante B «Index» | https://dominik-mettler.github.io/Website-apb/v6/ |
| v7 – Variante C «Mosaik» | https://dominik-mettler.github.io/Website-apb/v7/ |
| v8 – Variante A + Präsentation, Weiterleitungen, Tempo | https://dominik-mettler.github.io/Website-apb/v8/ |
| v9 – Variante B + Präsentation, Weiterleitungen, Tempo | https://dominik-mettler.github.io/Website-apb/v9/ |
| v10 – Variante C + Präsentation, Weiterleitungen, Tempo | https://dominik-mettler.github.io/Website-apb/v10/ |
| v11 – neue Fotos, Pläne, Projektdaten | https://dominik-mettler.github.io/Website-apb/v11/ |
| v12 – überarbeitete Abstände | https://dominik-mettler.github.io/Website-apb/v12/ |
| v13 – Datenblätter, Karte, Filter, Aktuell, Zeitraffer | https://dominik-mettler.github.io/Website-apb/v13/ |
| v14 – SVG-Logo, Vermessung S/W, 3D-Ansicht | https://dominik-mettler.github.io/Website-apb/v14/ |
| v15 – Logo-Schrift sauber gesetzt | https://dominik-mettler.github.io/Website-apb/v15/ |
| v16 – Karte = Vermessung S/W, Luftbild, 3D | https://dominik-mettler.github.io/Website-apb/v16/ |
| v17 – neues Referenzblatt (A4, 2 Seiten) | https://dominik-mettler.github.io/Website-apb/v17/ |
| v18 – Original-Referenzblätter (A3, PDF) | https://dominik-mettler.github.io/Website-apb/v18/ |
| v19 – englische Version, Google, Barrierefreiheit | https://dominik-mettler.github.io/Website-apb/v19/ |
| v20 – Hegger-Adresse, ohne Idealalter | https://dominik-mettler.github.io/Website-apb/v20/ |
| v21 – Gewerbebau Tolackerstrasse: Referenzblatt, Beschrieb | https://dominik-mettler.github.io/Website-apb/v21/ |
| v22 – Zeitachse: Pfäffikon 2022, Küsnacht 2020 | https://dominik-mettler.github.io/Website-apb/v22/ |
| v23 – Arealentwicklung Zürcherstrasse verlinkt | https://dominik-mettler.github.io/Website-apb/v23/ |
| v25 – Beteiligte klickbar und durchsuchbar | https://dominik-mettler.github.io/Website-apb/v25/ |
| v26 – Fachplaner-Websites bestätigt, Schulhaus Pünt Datenblatt | https://dominik-mettler.github.io/Website-apb/v26/ |
| v27 – Karten dunkel und modern, apb-Würfel als Markierung | https://dominik-mettler.github.io/Website-apb/v27/ |
| v28 – Pläne zugeschnitten, Kartenpunkte korrigiert | https://dominik-mettler.github.io/Website-apb/v28/ |
