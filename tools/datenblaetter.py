"""Ordnet die Seiten der Datenblatt-Sammlung (content/datenblaetter/seiten.json) den Projekten zu
und bereitet Kenndaten, Beschrieb und Beteiligte auf. Wird von tools/projekte_einbauen.py verwendet.

Datenschutz: Kontakt- und Referenzpersonen, Telefonnummern und Namen privater Bauherrschaften
werden nicht übernommen. Platzhalter (Lorem ipsum, XX, XYZ, 20YY) werden verworfen.
"""
import json, os, re

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEITEN = json.load(open(os.path.join(R, 'content/datenblaetter/seiten.json')))

# Projekt -> Seiten (erste Seite mit Text liefert den Beschrieb; Kenndaten aus allen Seiten)
SEITENZUORDNUNG = {
    '180-mwu': [1], '198-psu': [5, 3], '200-pks': [8, 6], '206-rbl': [9], '218-mfl': [11], '235-bsw': [13], '241-mrn': [14],
    '251-asch': [17, 16], '254-mad': [19], '258-bpa': [21, 22], '261-swn': [23], '261-10-swn': [25], '263-piu': [28, 26],
    '266-sku': [29], '270-bsb': [33], '278-seh': [35], '281-mzv': [39, 38], '289-mtf': [41], '292-mlw': [42], '300-bswae': [46],
    '304-sth': [52, 47], '306-gzm': [53, 54], '308-mzu': [63, 59], '309-mpg': [67], '310-gws': [69], '311-sbh': [77, 70],
    '313-gbw': [79], '318-epu': [81], '319-sag': [90], '321-pbv': [92], '324-kbg': [95], '325-kjw': [99], '326-shu': [104],
    '327-sdu': [105], '329-sam': [110], '333-kff': [114], '334-sbg': [116], '338-ebw': [117], '341-spu': [120, 121],
    '344-miu': [122], '347-gtv': [123],
}

# Neue Projekte (noch nicht auf der bisherigen Website)
NEU = {
    '198-psu': {'name': 'Primarschulhaus Oberuster', 'ort': 'Uster', 'sub': 'Umbau des denkmalgeschützten Primarschulhauses', 'cats': ['lernen']},
    '200-pks': {'name': 'Kindergarten Hegger', 'ort': 'Schwerzenbach', 'sub': 'Umbau des Kindergartens', 'cats': ['lernen']},
    '206-rbl': {'name': 'Personalrestaurant SBB', 'ort': 'Dietikon', 'sub': 'Neubau Personalrestaurant und Seminarräume mit Generalplanerauftrag', 'cats': ['arbeiten', 'reisen']},
    '266-sku': {'name': 'Schulhaus Krämeracker', 'ort': 'Uster', 'sub': 'Umbau und Sanierung des Schulhauses', 'cats': ['lernen']},
    '338-ebw': {'name': 'EFH Binzholzstrasse', 'ort': 'Wald', 'sub': 'Energetische Sanierung eines Einfamilienhauses', 'cats': ['wohnen'], 'privat': True},
    '341-spu': {'name': 'Schulhaus Pünt', 'ort': 'Uster', 'sub': 'Umbau und Sanierung von Hort und Hauswartwohnung', 'cats': ['lernen']},
    '344-miu': {'name': 'MFH Industriestrasse', 'ort': 'Uster', 'sub': 'Sanierung eines Mehrfamilienhauses', 'cats': ['wohnen']},
    '347-gtv': {'name': 'Gewerbebau Tolackerstrasse', 'ort': 'Volketswil', 'sub': 'Neubau eines Gewerbebaus mit Werkstatt und Büros', 'cats': ['arbeiten'], 'privat': True},
}

PLATZHALTER = re.compile(r'Lorem|ipsum|\bXX|XYZ|YY\b|ZZ\b|___|PLZ Ort')
PERSONEN = re.compile(r'Referenz|Miteigentümer|präsident|Präsident|Vorstand|Kontakt|Ansprechpartner|Baukommission|Gemeindeschreiber|Schlüsselperson', re.I)
VERTRETUNG = re.compile(r'Bauherren.?vertretung|Bewirtschaftung|Bauherrenberat', re.I)
FIRMA = re.compile(r'\b(AG|GmbH|SA|Sàrl|Genossenschaft|Gemeinde|Stadt|Kanton|Stiftung|Kirchgemeinde|Schul|Primarschul|Oberstufen|SBB|Baugesellschaft|Konsortium|Verein|Bund|Immobilien|Liegenschaft|Pfarrei|Kirch|ag\b|gmbh\b)', re.I)

def _jahr(t):
    j = re.findall(r'(?:19|20)\d\d', t or '')
    return int(j[-1]) if j else None

def _ort(v):  # «8050 Zürich» -> «Zürich», Doppelangaben bereinigen
    v = re.sub(r'\b\d{4}\s+', '', v)
    return re.sub(r',\s*,', ',', v).strip(' ,')

def zusammenstellen(pid):
    seiten = [SEITEN[n - 1] for n in SEITENZUORDNUNG.get(pid, [])]
    if not seiten: return None
    secs = []
    for s in seiten:
        txt = ' '.join(x[1] for x in s['secs'])
        if s['secs'] and not PLATZHALTER.search(txt):
            secs = s['secs']; break
    kv = {}
    for s in seiten:
        for k, v in s['kv']:
            if k not in kv: kv[k] = v
    neu = NEU.get(pid, {})
    facts, team = [], []
    seen = set()
    for k, v in kv.items():
        if not v or PLATZHALTER.search(v) or PERSONEN.search(k): continue
        v = re.sub(r'\(?\b0\d{2}[\s\d]{7,}\)?', '', v)                  # Telefonnummern
        v = re.sub(r'\s\d{3}-[A-Za-z]{2,4}-\S*', '', v)                    # Plancodes
        v = v.replace(' ,', ',').strip(' ,')
        if VERTRETUNG.search(k):
            first = v.split(',')[0].strip()
            if not FIRMA.search(first): continue
            v = first + ('' if 'SBB' in first else '')
        if k.startswith('SIA-LHP'): k = 'SIA-Leistungsphasen'
        if k.startswith('Fassadenfläche'): k = 'Gebäudegrösse'; v = 'Fassadenfläche ' + v
        if k in seen: continue
        seen.add(k)
        kl = k.lower()
        if kl.startswith('adresse'):
            if not neu.get('privat'): facts.append(['Adresse', _ort(v)])
        elif kl.startswith('bauherrschaft'):
            facts.append(['Bauherr', ', '.join(x.strip() for x in _ort(v).split(',') if not re.search(r'\d', x)) if FIRMA.search(v) else 'Private Bauherrschaft'])
        elif kl.startswith('gebäudegrösse') or kl.startswith('gebaeudegroesse') or kl.startswith('gebäudegrösse nach'):
            facts.append(['Kenndaten', re.sub(r'(\d)m([23])', r'\1 m\2', v) + ('' if 'Fassaden' in v else ' (SIA 416)')])
        elif kl.startswith('kosten'):
            facts.append(['Kosten', v + (' (gemäss KV)' if 'gemäss KV' in k else '')])
        elif kl.startswith('kenndaten'):
            facts.append(['Kennwerte', v])
        elif kl.startswith('termine'):
            facts.append(['Bauzeit' if kl == 'termine' else k, re.sub(r'^Ausführung\s*', '', v)])
        elif kl.startswith('sia-leistungsphasen'):
            facts.append(['Bearbeitung', 'SIA-Phasen ' + v])
        elif kl.startswith('auszeichnung'):
            facts.append(['Auszeichnung', v])
        else:
            if 'apb' in v.lower() and 'peter brader' in v.lower(): v = 'apb architekten ag, Uster'
            v = re.sub(r',\s*[A-ZÄÖÜ][a-zäöü]+ [A-ZÄÖÜ][a-zäöü]+(,\s*Ruhestand)?$', '', v) if FIRMA.search(v.split(',')[0]) else v
            team.append([k.replace('H/L/K/K/S', 'HLKKS').replace('H/L/K/S', 'HLKS').replace('H/L/K', 'HLK').replace('H/L/S', 'HLS'), _ort(v).rstrip(',')])
    uniq, names = [], set()
    for f in facts:
        if f[0] in names: continue
        names.add(f[0]); uniq.append(f)
    adr = next((v for k, v in kv.items() if k.lower().startswith('adresse') and not PLATZHALTER.search(v)), '')
    return {'secs': [s for s in secs if s[1]], 'facts': uniq, 'team': team, 'neu': neu, 'adresse_roh': adr}

if __name__ == '__main__':
    for pid in SEITENZUORDNUNG:
        d = zusammenstellen(pid)
        print('==', pid, len(d['secs']), 'Abschnitte |', ' | '.join(f'{k}: {v}' for k, v in d['facts']))
        print('   Team:', '; '.join(f'{k}: {v}' for k, v in d['team']))
