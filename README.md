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
| `kontakt.html`, `impressum.html` | Kontakt, Impressum & Datenschutz |

## Seiten bearbeiten
Die HTML-Seiten werden mit `python3 tools/build.py` aus den Texten in `tools/build.py` erzeugt (Kopf, Navigation und Fusszeile für alle Seiten gleich).

## Projekte pflegen
Alle Projektdaten liegen in `assets/js/data.js` (Name, Ort, Kenndaten, Themen, Koordinaten, Bildmasse).
Bilder: `assets/img/projects/<id>/01.jpg` (gross, 1600 px) und `01-s.jpg` (klein, 800 px); `01` ist das Titelbild.

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
