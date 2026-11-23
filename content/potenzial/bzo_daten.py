"""Bauvorschriften Wohnzonen im Einzugsgebiet (aus den BZO-PDFs der Gemeinden, Stand Recherche 23.11.2026).
Werte nur für Regelbauweise der Wohnzonen. Masse in m, Ziffern: az = Ausnützungsziffer (Anteil), bmz = Baumassenziffer (m3/m2),
uez = Überbauungsziffer, gfz_gruen = Grünflächenziffer min. vg/dg/ug = Voll-/Dach-/anrechenbare Untergeschosse max.
fh = Fassadenhöhe traufseitig max., fh_giebel = giebelseitig max., fh_attika = fassadenbündig bei Attika, gh = Gebäudehöhe (alt, vor IVHB),
laenge = Gebäude-/Gesamtlänge max., ga_k / ga_g = kleiner / grosser Grundabstand min., mlz = Mehrlängenzuschlag (Anteil, ab Länge).
Ausgabe: python3 content/potenzial/bzo_daten.py -> content/potenzial/bzo.json + assets/data/bzo.json
"""
import json, os
G = {}
G['uster'] = {'name': 'Uster', 'stand': 'Teilrevision Nutzungsplanung, festgesetzt 13.4.2026 (IVHB; gilt mit Vorwirkung, Genehmigung ausstehend)', 'quelle': 'https://oerebdocs.zh.ch/getDoc?docid=17301', 'artikel': 'Art. 29 + 33',
  'grosser_abstand': 'kein grosser/kleiner Abstand: Grundabstand + Mehrlängenzuschlag 1/3 bis Höchstmass',
  'areal': 'Art. 40–41: ab 4000 m²; W3/W4 +2 Vollgeschosse (W2 nicht), Gebäudelänge frei, Abstände arealintern nach kantonalem Recht',
  'gewerbe_bonus': 'Zonen …G (Art. 33): Ausnützung +1/5, sofern die Mehrfläche dauernd gewerblich genutzt wird',
  'zonen': {}}
_u = {'L2/30': (.30, 2, 1, 30, 5, 9, 8.1), 'W2/30': (.30, 2, 1, 30, 5, 9, 8.1), 'W2/40': (.40, 2, 1, 30, 5, 9, 8.1),
      'W2/50': (.50, 2, 1, 40, 4, 9, 8.1), 'W3/50': (.50, 3, 2, 40, 5, 10, 11.4), 'W3/70': (.70, 3, 1, 60, 4, 10, 11.4), 'W4/70': (.70, 4, 2, 60, 5, 12, 14.7)}
for _k, (_az, _vg, _dg, _l, _ga, _gmax, _fh) in _u.items():
    _z = {'az': _az, 'vg': _vg, 'dg': _dg, 'attika': 1, 'ug': 1, 'laenge': _l, 'ga_k': _ga, 'ga_max': _gmax, 'mlz': [1/3, None], 'fh': _fh, 'fh_flach': round(_fh + 1, 1)}
    G['uster']['zonen'][_k] = _z
    if _k != 'L2/30':
        G['uster']['zonen'][_k + 'G'] = dict(_z, gewerbe=True, az_bonus=1/5)
G['gossau'] = {'name': 'Gossau ZH', 'stand': 'BZO Teilrevision 17.11.2025, in Kraft 1.9.2026 (IVHB)', 'quelle': 'https://oerebdocs.zh.ch/getDoc?docid=6888', 'artikel': 'Art. 10',
  'areal': 'Art. 20–22: W/WG 1.7 ab 4000 m², W/WG 2.4 ab 6000 m²; BMZ +0.7, FH +3.3 m, +1 Vollgeschoss, Länge bis 2×',
  'zonen': {
    'W 1.3': {'bmz': 1.3, 'laenge': 24, 'fh': 4.8, 'fh_giebel': 9.3, 'fh_attika': 8.1, 'ga_k': 6, 'ga_g': 12},
    'W 1.7': {'bmz': 1.7, 'laenge': 32, 'fh': 8.1, 'fh_giebel': 15.1, 'fh_attika': 11.4, 'ga_k': 5, 'ga_g': 10},
    'WG 1.7': {'bmz': 1.7, 'laenge': 32, 'fh': 8.1, 'fh_giebel': 15.1, 'fh_attika': 11.4, 'ga_k': 5, 'ga_g': 10, 'gewerbe': True},
    'W 2.4': {'bmz': 2.4, 'laenge': 40, 'fh': 11.4, 'fh_giebel': 18.4, 'fh_attika': 14.8, 'ga_k': 6, 'ga_g': 12},
    'WG 2.4': {'bmz': 2.4, 'laenge': 40, 'fh': 11.4, 'fh_giebel': 18.4, 'fh_attika': 14.8, 'ga_k': 6, 'ga_g': 12, 'gewerbe': True}}}
G['volketswil'] = {'name': 'Volketswil', 'stand': 'BZO konsolidiert (inkl. Parkplatzverordnung), IVHB-Teilrevision genehmigt 19.3.2024', 'quelle': 'https://www.volketswil.ch/public/upload/assets/11757/70.1%2B70.2%20BZO%20Bau-%20und%20Zonenordnung%20inkl.%20Parkplatzverordnung.pdf?fp=2', 'artikel': 'Art. 18',
  'zonen': {
    'W1/30': {'az': .30, 'vg': 1, 'dg': 1, 'ug': 1, 'ga_k': 4, 'ga_g': 8, 'laenge': 20, 'fh': 5.0, 'mlz': [1/4, 20], 'mlz_max': 5},
    'W2/30': {'az': .30, 'vg': 2, 'dg': 1, 'ga_k': 4, 'ga_g': 8, 'laenge': 20, 'fh': 7.5, 'mlz': [1/4, 20], 'mlz_max': 5},
    'W2/35': {'az': .35, 'vg': 2, 'dg': 1, 'ga_k': 4.5, 'ga_g': 9, 'laenge': 32, 'fh': 7.5, 'mlz': [1/4, 20], 'mlz_max': 5},
    'W2/45': {'az': .45, 'vg': 2, 'dg': 2, 'ga_k': 5, 'ga_g': 10, 'laenge': 35, 'fh': 7.8, 'mlz': [1/4, 18], 'mlz_max': 5},
    'W3/55': {'az': .55, 'vg': 3, 'dg': 2, 'ga_k': 6, 'ga_g': 12, 'laenge': 40, 'fh': 11.0, 'mlz': [1/4, 16], 'mlz_max': 5}}}
G['greifensee'] = {'name': 'Greifensee', 'stand': 'BZO vom 26.11.2025 (IVHB)', 'quelle': 'https://oerebdocs.zh.ch/getDoc?docid=4793', 'artikel': 'Art. 25–27',
  'grosser_abstand': 'für die beiden am meisten gegen Süden gerichteten Gebäudeseiten (Art. 26)',
  'zonen': {
    'W1': {'uez': .20, 'vg': 1, 'dg': 1, 'fh': 4.5, 'gesamthoehe': 8.5, 'ga_g': 8, 'ga_k': 3.5, 'mlz': [1/5, 12], 'mlz_g': [1/5, 18], 'mlz_max': 5},
    'W2': {'az': .40, 'vg': 2, 'dg': 1, 'fh': 7.5, 'gesamthoehe': 12, 'ga_g': 10, 'ga_k': 4, 'mlz': [1/5, 12], 'mlz_g': [1/5, 18], 'mlz_max': 5},
    'W3': {'az': .55, 'vg': 3, 'dg': 1, 'fh': 10.5, 'gesamthoehe': 17, 'ga_g': 10, 'ga_k': 4, 'mlz': [1/5, 12], 'mlz_g': [1/5, 18], 'mlz_max': 5},
    'W4': {'az': .65, 'vg': 4, 'dg': 1, 'fh': 13.5, 'gesamthoehe': 18.5, 'ga_g': 12, 'ga_k': 5, 'mlz': [1/5, 12], 'mlz_g': [1/5, 18], 'mlz_max': 5}}}
G['schwerzenbach'] = {'name': 'Schwerzenbach', 'stand': 'BZO gemäss Rechtssammlung (vor IVHB: Gebäudehöhe/Firsthöhe); Revision 2025 in Arbeit', 'quelle': 'https://www.schwerzenbach.ch/fileadmin/user_upload/Rechtssammlung/7_Bauen__Ver-_und_Entsorgen/Bau-_und_Zonenordnung.pdf', 'artikel': 'Art. 15',
  'zonen': {
    'W1L': {'bmz': 1.1, 'vg': 2, 'dg': 1, 'laenge': 20, 'gh': 7.5, 'firsthoehe': 5, 'ga_g': 10, 'ga_k': 4.5},
    'W1D': {'bmz': 1.5, 'vg': 2, 'dg': 1, 'ug': 1, 'laenge': 20, 'gh': 7.5, 'firsthoehe': 5, 'ga_g': 10, 'ga_k': 4.5},
    'W2': {'bmz': 1.8, 'vg': 2, 'dg': 1, 'ug': 1, 'laenge': 24, 'gh': 7.5, 'firsthoehe': 5, 'ga_g': 10, 'ga_k': 4.5},
    'W3': {'bmz': 2.5, 'vg': 3, 'dg': 1, 'ug': 1, 'laenge': 40, 'gh': 10.5, 'firsthoehe': 6, 'ga_g': 12, 'ga_k': 4.5},
    'W4': {'bmz': 3.1, 'vg': 4, 'dg': 1, 'laenge': 50, 'gh': 13.5, 'firsthoehe': 6, 'ga_g': 14, 'ga_k': 4.5}}}
G['faellanden'] = {'name': 'Fällanden', 'stand': 'BZO 1994, Teilrevisionen bis 2023 (IVHB)', 'quelle': 'https://oerebdocs.zh.ch/getDoc?docid=1964', 'artikel': 'Art. 14',
  'zonen': {
    'W1': {'bmz': 1.2, 'vg': 1, 'dg': 1, 'ug': 1, 'laenge': 30, 'fh': 4.5, 'fh_giebel': 9.5, 'ga_g': 9, 'ga_k': 5},
    'W2L': {'bmz': 1.5, 'vg': 2, 'dg': 1, 'ug': 1, 'laenge': 30, 'fh': 7.5, 'fh_giebel': 12.5, 'ga_g': 9, 'ga_k': 5},
    'W2D': {'bmz': 1.8, 'vg': 2, 'dg': 1, 'ug': 1, 'laenge': 30, 'fh': 7.5, 'fh_giebel': 12.5, 'ga_g': 9, 'ga_k': 5},
    'W3L': {'bmz': 2.1, 'vg': 3, 'dg': 1, 'laenge': 40, 'fh': 10.5, 'fh_giebel': 17.5, 'ga_g': 10, 'ga_k': 5},
    'W3D': {'bmz': 2.5, 'vg': 3, 'dg': 1, 'laenge': 40, 'fh': 10.5, 'fh_giebel': 17.5, 'ga_g': 10, 'ga_k': 5}}}
G['moenchaltorf'] = {'name': 'Mönchaltorf', 'stand': 'BZO 2026 (IVHB)', 'quelle': 'https://oerebdocs.zh.ch/getDoc?docid=5981', 'artikel': 'Art. 35–37',
  'grosser_abstand': 'für die stärker gegen Süden gerichtete längere Gebäudeseite (Art. 36); Mehrlängenzuschlag ab 16 m (Art. 37)',
  'zonen': {
    'W2E/30': {'az': .30, 'vg': 2, 'dg': 0, 'ug': 0, 'fh': 6.0, 'fh_giebel': 9.0, 'laenge': 25, 'ga_k': 5, 'ga_g': 10},
    'W2/30': {'az': .30, 'vg': 2, 'dg': 1, 'ug': 0, 'fh': 7.5, 'fh_giebel': 12.5, 'fh_attika': 10.5, 'laenge': 25, 'ga_k': 5, 'ga_g': 10},
    'W3/50': {'az': .50, 'vg': 3, 'dg': 1, 'ug': 0, 'fh': 10.5, 'fh_giebel': 15.5, 'fh_attika': 13.5, 'laenge': 30, 'ga_k': 5, 'ga_g': 10},
    'WG3/50': {'az': .50, 'vg': 3, 'dg': 1, 'ug': 0, 'fh': 10.5, 'fh_giebel': 15.5, 'fh_attika': 13.5, 'laenge': 30, 'ga_k': 5, 'ga_g': 10, 'gewerbe': True}}}
G['egg'] = {'name': 'Egg', 'stand': 'BZO vom 2.9.2024 (IVHB)', 'quelle': 'https://oerebdocs.zh.ch/getDoc?docid=8223', 'artikel': 'Art. 19bis–20',
  'dach': 'Steildächer 25°–40° und Flachdächer zulässig',
  'zonen': {
    'W30': {'az': .30, 'vg': 1, 'dg': 2, 'attika': 1, 'ug': 1, 'laenge': 35, 'fh': 4.8, 'fh_giebel': 11.8, 'fh_attika': 8.1, 'ga_k': 5, 'ga_g': 10},
    'W40': {'az': .40, 'vg': 2, 'dg': 2, 'attika': 1, 'laenge': 35, 'fh': 8.1, 'fh_giebel': 15.1, 'fh_attika': 11.4, 'ga_k': 5, 'ga_g': 8},
    'W60': {'az': .60, 'vg': 3, 'dg': 2, 'attika': 1, 'laenge': 40, 'fh': 10.5, 'fh_giebel': 17.5, 'fh_attika': 13.8, 'ga_k': 5, 'ga_g': 10},
    'WG40': {'az': .40, 'vg': 2, 'dg': 2, 'attika': 1, 'laenge': 45, 'fh': 8.1, 'fh_giebel': 15.1, 'fh_attika': 11.4, 'ga_k': 6, 'ga_g': 12, 'gewerbe': True},
    'WG60': {'az': .60, 'vg': 3, 'dg': 2, 'attika': 1, 'laenge': 45, 'fh': 10.5, 'fh_giebel': 17.5, 'fh_attika': 13.8, 'ga_k': 6, 'ga_g': 12, 'gewerbe': True}}}
G['maur'] = {'name': 'Maur', 'stand': 'BZO festgesetzt 20.9.2022 (IVHB), teilweise genehmigt', 'quelle': 'https://www.maur.ch/public/upload/assets/7271/Bau-%20und%20Zonenordnung%20%28BZO%29.pdf', 'artikel': 'Art. 13',
  'dach': 'Schrägdach: FH + Mass aus 45° Dachneigung, max. +5 m; Attika: fassadenbündig max. +3.3 m',
  'zonen': {
    'W1/25': {'az': .25, 'gfz_gruen': .40, 'vg': 1, 'dg': 1, 'ug': 1, 'laenge': 25, 'fh': 5.4, 'ga_g': 10, 'ga_k': 6},
    'W2/35': {'az': .35, 'gfz_gruen': .40, 'vg': 2, 'dg': 1, 'ug': 1, 'laenge': 25, 'fh': 7.5, 'ga_g': 10, 'ga_k': 6},
    'W2/45': {'az': .45, 'gfz_gruen': .40, 'vg': 2, 'dg': 2, 'ug': 1, 'laenge': 30, 'fh': 7.5, 'ga_g': 8, 'ga_k': 4},
    'W3/60': {'az': .60, 'gfz_gruen': .40, 'vg': 3, 'dg': 2, 'ug': 1, 'laenge': 40, 'fh': 10.5, 'ga_g': 10, 'ga_k': 6}}}
G['wetzikon'] = {'name': 'Wetzikon', 'stand': 'ENTWURF Teilrevision 2024 (öffentliche Auflage 16.1.2025) – noch nicht rechtskräftig, geltende BZO prüfen', 'quelle': 'https://wetzikon.ch/wAssets/docs/Amtliche-Publikationen/Teilrevision-BZO-zur-IVHB-neue-BZO.pdf', 'artikel': 'Art. 8',
  'zonen': {
    'W1.3 A': {'bmz': 1.3, 'fh': 4.8, 'fh_giebel': 9.8, 'fh_flach': 7.5, 'laenge': 25, 'ga_k': 5, 'ga_g': 8},
    'W1.3 B': {'bmz': 1.3, 'fh': 8.1, 'fh_giebel': 13.1, 'fh_flach': 10.5, 'laenge': 30, 'ga_k': 5, 'ga_g': 8},
    'W1.6': {'bmz': 1.6, 'fh': 8.1, 'fh_giebel': 13.1, 'fh_flach': 11.4, 'laenge': 40, 'ga_k': 5, 'ga_g': 8},
    'W2.4': {'bmz': 2.4, 'fh': 11.4, 'fh_giebel': 18.4, 'fh_flach': 14.7, 'laenge': 40, 'ga_k': 5, 'ga_g': 8},
    'WG2.4': {'bmz': 2.4, 'fh': 11.4, 'fh_giebel': 11.4, 'fh_flach': 11.4, 'laenge': 40, 'ga_k': 5, 'ga_g': 8, 'gewerbe': True},
    'WG2.9': {'bmz': 2.9, 'fh': 11.4, 'fh_giebel': 18.4, 'fh_flach': 14.7, 'laenge': 50, 'ga_k': 5, 'ga_g': 8, 'gewerbe': True},
    'W2.8': {'bmz': 2.8, 'fh': 14.7, 'fh_giebel': 21.7, 'fh_flach': 18.0, 'laenge': 40, 'ga_k': 5, 'ga_g': 8},
    'WG3.3': {'bmz': 3.3, 'fh': 14.7, 'fh_giebel': 21.7, 'fh_flach': 18.0, 'laenge': 50, 'ga_k': 5, 'ga_g': 8, 'gewerbe': True}}}
G['grueningen'] = {'name': 'Grüningen', 'stand': 'BZO Teilrevision 14.6.2022 (IVHB)', 'quelle': 'https://oerebdocs.zh.ch/getDoc?docid=7582', 'artikel': 'Art. 33',
  'grosser_abstand': 'für die wahlweise stärker nach Süden oder Westen orientierte Längsseite',
  'dach': 'nur Giebeldächer; Attikageschosse nicht zulässig; FH giebelseitig + Mass aus 45°, max. +5 m (W1) / +6 m',
  'areal': 'ab 3000 m²; AZ +1/10, ökologisch nochmals +1/10',
  'zonen': {
    'W1/25': {'az': .25, 'gfz_gruen': .40, 'vg': 1, 'dg': 1, 'ug': 1, 'fh': 4.8, 'laenge': 30, 'ga_g': 10, 'ga_k': 5},
    'W2/50': {'az': .50, 'gfz_gruen': .40, 'vg': 2, 'dg': 2, 'fh': 8.1, 'laenge': 30, 'ga_g': 10, 'ga_k': 5},
    'W3/65': {'az': .65, 'gfz_gruen': .40, 'vg': 3, 'dg': 2, 'fh': 11.4, 'laenge': 40, 'ga_g': 10, 'ga_k': 5}}}
G['pfaeffikon'] = {'name': 'Pfäffikon ZH', 'stand': 'BZO festgesetzt 16.9.2024 (IVHB), teilweise nicht genehmigt', 'quelle': 'https://oerebdocs.zh.ch/getDoc?docid=8899', 'artikel': 'Art. 27',
  'grosser_abstand': 'für die am meisten Richtung Südost bis Südwest gerichtete Hauptwohnseite; Geschosszahl frei im Rahmen der Höhen',
  'zonen': {
    'W1.25': {'bmz': 1.25, 'fh': 8.5, 'gesamthoehe': 12.5, 'ga_k': 5, 'ga_g': 9},
    'W1.45': {'bmz': 1.45, 'fh': 8.5, 'gesamthoehe': 12.5, 'ga_k': 5, 'ga_g': 9},
    'W1.7': {'bmz': 1.7, 'fh': 8.5, 'gesamthoehe': 12.5, 'ga_k': 5, 'ga_g': 9},
    'W2.2': {'bmz': 2.2, 'fh': 9.0, 'gesamthoehe': 13, 'ga_k': 5, 'ga_g': 10},
    'W2.7': {'bmz': 2.7, 'fh': 12.0, 'gesamthoehe': 18, 'ga_k': 5, 'ga_g': 10}}}
G['seegraeben'] = {'name': 'Seegräben', 'stand': 'OFFEN – BZO-PDF auf seegraeben.ch nicht abrufbar (404); nachtragen', 'quelle': 'https://seegraeben.ch', 'zonen': {}}
if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bzo.json')
    json.dump(G, open(out, 'w'), ensure_ascii=False, indent=1)
    web = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'data', 'bzo.json')   # für das Tool im Browser
    json.dump(G, open(web, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(G), 'Gemeinden,', sum(len(g['zonen']) for g in G.values()), 'Wohnzonen')
