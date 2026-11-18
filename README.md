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
