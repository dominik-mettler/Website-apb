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
| `karriere.html` | Offene Stellen + Lehrstelle |
| `kontakt.html`, `impressum.html` | Kontakt, Impressum & Datenschutz |

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
