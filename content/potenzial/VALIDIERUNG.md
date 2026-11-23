# Potenzial-Tool: Abgleich mit gebauten apb-Projekten (23.11.2026)

Methode: Für jedes apb-Projekt mit bekanntem Gebäude rechnet ein Skript dasselbe wie das Tool. Das Skript liegt nicht im Repository.
1. Parzelle unter dem Gebäudegrundriss: amtliche Vermessung
2. Zone und Fläche: ÖREB-Kataster Kanton Zürich (live)
3. Zonenwerte: `assets/data/bzo.json`
4. Maximale Geschossfläche: Fläche × AZ bzw. Fläche × BMZ ÷ 3.0 m

Verglichen wird mit der gebauten Geschossfläche. Quelle ist das Datenblatt (SIA 416) oder das eidgenössische Gebäude- und Wohnungsregister (GWR): Grundfläche × Geschosse.

## Vergleichbare Projekte (Zone in der Tabelle erfasst)
| Projekt | Gemeinde, Parzelle | Zone | Tool: GF max. | Gebaut | Verhältnis | Beurteilung |
|---|---|---|---|---|---|---|
| MFH Wilstrasse (2002) | Uster | W4/70G, AZ 70 % | 983 m² | 987 m² (GWR) | 100 % | ✓ deckt sich |
| MFH Lorenallee (2004) | Uster | W4/70G, AZ 70 % | 1'886 m² | 1'692 m² (GWR) | 90 % | ✓ plausibel (Reserve) |
| Kindergarten Böschacher | Gossau ZH, Grüt | W 1.3, BMZ 1.3 | 800 m² | 812 m² (GWR) | 101 % | ✓ deckt sich (Bestandsbau) |
| MFH Lediweg (2011) | Uster | L2/30, AZ 30 % | 667 m² | 2'604 m² (GWR) | 391 % | ✕ nicht erklärbar mit der Regelbauweise: Parzelle liegt in einem **Quartierplan** (überlagernd) und das GWR zählt alle Geschosse inkl. UG/DG. Projektunterlagen nötig |

## Nicht vergleichbar (noch nicht im Tool)
- Zonen für öffentliche Bauten (Schulen, Kindergärten, Gemeindehäuser): 18 Projekte
- Kern- und Zentrumszonen (Uster Kirchuster, Fällanden, Grüningen u. a.): 10 Projekte
- Gemeinden ausserhalb des Einzugsgebiets (Meilen, Bonstetten, Dübendorf, Schlieren, Zürich u. a.)

## Erkenntnisse und Korrekturen
- **Fehler behoben:** Manche Gemeinden liefern im ÖREB statt eines Zonencodes einen Erklärungssatz (z. B. Meilen). Das Tool nahm den ersten Eintrag. Neu bevorzugt es Einträge mit Zonencode in Klammern und dem grössten Flächenanteil und sucht sonst einen Code im Text.
- **Adresspunkt vs. Gebäude:** Der Adresspunkt liegt teils auf der Nachbarparzelle. Im Tool wählt man die Parzelle selbst (Suche oder Klick), daher betrifft das nur den Abgleich.
- **Überlagernde Festlegungen** (Quartierplan, Gestaltungsplan, Arealüberbauung, Terrassenhaus) können die Regelbauweise stark verändern. Das Tool zeigt sie als Hinweis im ÖREB-Teil, rechnet sie aber nicht ein.
- **GWR-Geschosse** zählen Unter- und Dachgeschosse mit. Für einen strengen Vergleich braucht es die anrechenbaren Geschossflächen aus den Projektunterlagen.

## Nächste Schritte
- Kern- und Zentrumszonen sowie Zonen für öffentliche Bauten in die Tabelle aufnehmen. Dann werden rund 28 weitere apb-Projekte vergleichbar.
- Mit den Machbarkeitsstudien von apb (pendent) die anrechenbaren Flächen statt GWR-Werte vergleichen.
