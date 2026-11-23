"""Baut assets/js/data.js aus allen Quellen zusammen (immer vom Originalstand content/basis.json aus):

1. content/basis.json            – Projekte der bisherigen Website
2. tools/datenblaetter.py         – Kenndaten, Beschrieb, Beteiligte aus der Datenblatt-Sammlung; neue Projekte
3. content/geo.json               – genaue Koordinaten (tools/geokodieren.py)
4. content/projekte/<id>/         – ausgewählte Fotos (Bildunterschriften) und Pläne
5. content/projekte/daten.py      – manuell geprüfte Angaben (haben Vorrang)
6. Merkmale für den Filter (Kosten in Mio., MINERGIE, Denkmalschutz, Wettbewerb, Holzbau)

Aufruf: python3 tools/projekte_einbauen.py   (danach: HOME_VARIANT=A python3 tools/build.py)
"""
import numpy as np
import os, json, re, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import datenblaetter as DB

R = DB.R
C = os.path.join(R, 'content', 'projekte')
ns = {}; exec(open(os.path.join(C, 'daten.py')).read(), ns); DATEN = ns['DATEN']
D = json.load(open(os.path.join(R, 'content/basis.json')))
byid = {p['id']: p for p in D['projects']}
GEO = json.load(open(os.path.join(R, 'content/geo.json')))
ORDER = ['Verfahren', 'Status', 'Fertigstellung', 'Bearbeitung', 'Bauherr', 'Kosten', 'Kenndaten', 'Kennwerte', 'Bauzeit',
         '1. Etappe Neubau', '2. Etappe Aufstockung', 'Auszeichnung', 'Label', 'Adresse']

def jahr(t):
    j = re.findall(r'(?:19|20)\d\d', t or '')
    return int(j[-1]) if j else None

def first_sentences(t, n=220):
    s = re.split(r'(?<=[.!?])\s+', t or '')
    out = ''
    for x in s:
        if len(out) + len(x) > n and out: break
        out = (out + ' ' + x).strip()
    return out

# 1+2: Datenblätter
for pid in DB.SEITENZUORDNUNG:
    d = DB.zusammenstellen(pid)
    if not d: continue
    if pid not in byid:
        n = d['neu']
        if not n: continue
        fz = dict(d['facts']).get('Bauzeit', '')
        p = {'id': pid, 'nr': pid.split('-')[0], 'name': n['name'], 'ort': n['ort'], 'sub': n['sub'],
             'text': first_sentences(d['secs'][0][1]) if d['secs'] else n['sub'] + '.',
             'facts': [['Status', 'Realisiert']], 'year': jahr(fz), 'status': 'Realisiert', 'cats': n['cats'],
             'img': [], 'cap': {}, 'geo': [47.35, 8.7], 'sel': False, 'neu': True}
        if p['year']: p['facts'].append(['Fertigstellung', str(p['year'])])
        D['projects'].append(p); byid[pid] = p
    p = byid[pid]
    facts = {k: v for k, v in p['facts']}
    for k, v in d['facts']:
        if k == 'Bauherr' and facts.get('Bauherr') == 'Private Bauherrschaft': continue
        facts[k] = v
    if 'Bauzeit' in facts and 'Fertigstellung' not in facts and jahr(facts['Bauzeit']):
        facts['Fertigstellung'] = str(jahr(facts['Bauzeit']))
    p['facts'] = [[k, facts[k]] for k in ORDER if k in facts] + [[k, v] for k, v in facts.items() if k not in ORDER]
    if d['secs']: p['desc'] = [list(x) for x in d['secs']]
    if d['team']: p['team'] = [list(x) for x in d['team']]

# 3: Koordinaten (private Wohnhäuser gerundet)
for pid, p in byid.items():
    if pid in GEO:
        lat, lon = GEO[pid][0], GEO[pid][1]
        privat = dict(p['facts']).get('Bauherr') == 'Private Bauherrschaft' and ('EFH' in p['name'] or DB.NEU.get(pid, {}).get('privat'))
        p['geo'] = [round(lat, 3), round(lon, 3)] if privat else [lat, lon]
        p['geoExakt'] = not privat

# 3b: Projektgebäude für die 3D-Ansicht (tools/projekt_volumen.py)
VOL = json.load(open(os.path.join(R, 'content/volumen.json'))) if os.path.exists(os.path.join(R, 'content/volumen.json')) else {}
for pid, p in byid.items():
    if pid in VOL and p.get('geoExakt'): p['vol'] = [[t['ring'], t['h'], t.get('jahr') or 0] for t in VOL[pid]]
    if os.path.exists(os.path.join(R, 'assets/data/umgebung-%s.json' % pid)): p['umg'] = 'assets/data/umgebung-%s.json' % pid   # Lücke swissBUILDINGS3D

# 4: Fotos und Pläne
def save(im, path, w, fmt='JPEG', q=80):
    im = im.copy(); im.thumbnail((w, w), Image.LANCZOS)
    if fmt == 'WEBP': im.save(path, 'WEBP', quality=q, method=6)
    else: im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
    return im.size
for pid in sorted(os.listdir(C)):
    src = os.path.join(C, pid)
    if not os.path.isdir(src) or pid not in byid: continue
    sel = json.load(open(os.path.join(src, 'auswahl.json')))
    out = os.path.join(R, 'assets/img/p2', pid); os.makedirs(out, exist_ok=True)
    dims, cap = [], {}
    for i, f in enumerate(sel['fotos'], 1):
        n = '%02d' % i; target = f'{out}/{n}.jpg'
        srcf = os.path.join(src, f['datei'])
        if not os.path.exists(target) or os.path.getmtime(target) < os.path.getmtime(srcf):
            im = Image.open(srcf).convert('RGB')
            save(im, target, 1600, q=80); save(im, f'{out}/{n}-s.jpg', 800, q=76); save(im, f'{out}/{n}-s.webp', 800, 'WEBP', 76)
            if i == 1: save(im, f'{out}/{n}.webp', 1600, 'WEBP', 78)
        dims.append(list(Image.open(target).size))
        if f['unterschrift']: cap[str(i)] = f['unterschrift']
    plans = []
    for k, f in enumerate(sel['plaene'], 1):
        target = f'{out}/plan-%02d.webp' % k; orig = os.path.join(src, f['datei'])
        # Pläne werden nie zugeschnitten: Original 1:1, die einheitliche Darstellung regelt das Layout (CSS)
        if not os.path.exists(target) or os.path.getmtime(target) < os.path.getmtime(orig) or os.path.getmtime(target) < os.path.getmtime(__file__):
            im = Image.open(orig).convert('L')
            save(im, target, 2400, 'WEBP', 90); save(im, f'{out}/plan-%02d-s.webp' % k, 1200, 'WEBP', 88)
        plans.append(f['unterschrift'])
    p = byid[pid]
    p['base'] = f'assets/img/p2/{pid}/'; p['img'] = dims; p['cap'] = cap; p['plans'] = plans
    # Versionskennung der Planbilder: neue Fassung -> neue Adresse (sonst zeigt der Browser alte Bilder aus dem Cache)
    import hashlib
    _h = hashlib.md5()
    for k in range(1, len(plans) + 1):
        for suf in ('', '-s'):
            fp = f'{out}/plan-%02d{suf}.webp' % k
            if os.path.exists(fp): _h.update(open(fp, 'rb').read())
    if plans: p['pv'] = _h.hexdigest()[:8]
    _f = hashlib.md5()
    for i in range(1, len(dims) + 1):
        for suf in ('.jpg', '.webp', '-s.webp'):
            fp = f'{out}/%02d{suf}' % i
            if os.path.exists(fp): _f.update(str(os.path.getsize(fp)).encode() + open(fp, 'rb').read(4096))
    p['fv'] = _f.hexdigest()[:8]

# 5: manuell geprüfte Angaben
for pid, d in DATEN.items():
    p = byid.get(pid)
    if not p: continue
    facts = {k: v for k, v in p['facts'] if k not in d.get('drop', [])}
    for k, v in d.get('facts', []): facts[k] = v
    p['facts'] = [[k, facts[k]] for k in ORDER if k in facts] + [[k, v] for k, v in facts.items() if k not in ORDER]
    if 'text' in d: p['desc'] = [list(x) for x in d['text']]
    if 'team' in d: p['team'] = [list(x) for x in d['team']]
    if 'status' in d: p['status'] = d['status']
    if 'sub' in d: p['sub'] = d['sub']
    if 'areal' in d: p['areal'] = d['areal']   # gleiche Arealentwicklung -> gegenseitig verlinkt
    if 'zeitachse' in d: p['tlYear'] = d['zeitachse']   # nur Einordnung in der Zeitachse, nicht auf der Projektseite
    if 'kurz' in d: p['text'] = d['kurz']
    p['year'] = d.get('year') or jahr(facts.get('Fertigstellung')) or p.get('year')

# 5b: Zeitraffer-Videos
VIDEO = {'310-gws': {'src': 'assets/video/310-gws-bauablauf.mp4', 'poster': 'assets/video/310-gws-poster.jpg', 'strip': 'assets/video/310-gws-strip.jpg',
                     'text': 'Film der Baustellen-Webcam, 2016 – 2017'}}
for pid, v in VIDEO.items():
    if pid in byid: byid[pid]['video'] = v

# 6: Merkmale
def mio(p):
    k = dict(p['facts']).get('Kosten', '')
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*Mio\.?\s*Fr\.?\s*\(BKP 1[-–]9", k) or re.search(r"(?:Tot\.?:\s*)(\d+(?:[.,]\d+)?)\s*Mio", k)
    if m: return float(m.group(1).replace(',', '.'))
    m = re.search(r"([\d']{6,})\s*Fr\.?\s*\(BKP 1[-–]9", k) or re.search(r"([\d']{6,})\s*Fr", k)
    if m: return round(int(m.group(1).replace("'", '')) / 1e6, 2)
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*Mio", k)
    return float(m.group(1).replace(',', '.')) if m else None
for p in D['projects']:
    corpus = ' '.join([p['name'], p.get('sub', ''), p.get('text', '')] + [x[1] for x in p.get('desc', [])] + [v for k, v in p['facts']]).lower()
    tags = []
    if 'minergie' in corpus: tags.append('minergie')
    if re.search(r'denkmal|inventar|ortsbildschutz|schützenswert|kommunal geschützt|kantonal geschützt|geschützten? (?:schul|gebäude|bau|bahn|ortsbild)|unter schutz', corpus): tags.append('denkmal')
    if re.search(r'1\.\s*rang', dict(p['facts']).get('Verfahren', '').lower()): tags.append('wettbewerb')
    if re.search(r'holzbau|holzelement|holz-beton|holzbauweise|holz-hybrid|beton-holz', corpus): tags.append('holzbau')
    tags = [t for t in tags if t not in DATEN.get(p['id'], {}).get('ohne_tags', [])]   # manuell ausgeschlossen
    p['tags'] = tags
    v = mio(p)
    if v: p['mio'] = v
    if p.get('year') is None: p['year'] = jahr(dict(p['facts']).get('Fertigstellung'))

for p in D['projects']:   # Original-Referenzblatt (tools/referenzblaetter.py)
    if os.path.exists(os.path.join(R, 'assets/ref', p['id'] + '.pdf')): p['ref'] = 'assets/ref/' + p['id'] + '.pdf'
def _slug(t):
    t = t.lower()
    for a, b in (('ä', 'ae'), ('ö', 'oe'), ('ü', 'ue'), ('ß', 'ss'), ('é', 'e'), ('è', 'e'), ('à', 'a')):
        t = t.replace(a, b)
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')
for p in D['projects']:   # eigene, für Google lesbare Projektseite (tools/seo.py)
    p['url'] = 'projekt-' + re.match(r'[\d-]+', p['id']).group(0).strip('-') + '-' + _slug(p['name'] + ' ' + p['ort']) + '.html'
D['projects'].sort(key=lambda p: p['id'], reverse=True)
D['projects'] = [p for p in D['projects'] if p.get('img')]   # ohne Bilder nicht veröffentlichen

# Beteiligte: Schreibweisen zu Firmen/Personen zusammenfassen (content/fachplaner.py), klickbar ab 2 gemeinsamen Projekten
sys.path.insert(0, os.path.join(R, 'content'))
from fachplaner import BETEILIGTE
WEB = {k: v for k, v in json.load(open(os.path.join(R, 'content/fachplaner-web.json'))).items() if not k.startswith('_')}
def _bet_keys(v):
    m = [b[0] for b in BETEILIGTE if re.search(b[2], v, re.I)]
    if len(m) == 1: return m
    teile = [[b[0] for b in BETEILIGTE if re.search(b[2], t.strip(), re.I)] for t in v.split(',')]
    return [x[0] for x in teile if len(x) == 1] or m
_zahl, _neu = {}, set()
def _jahr(p):
    try: return int(str(p.get('year') or p.get('tlYear'))[:4])
    except (TypeError, ValueError): return 0
for p in D['projects']:
    for t in p.get('team') or []:
        del t[2:]
        # Projektleitung (apb-Personen) wird nicht verlinkt
        t.append([] if t[0].lower().startswith('projektleitung') else _bet_keys(t[1]))
        for k in set(t[2]):
            _zahl.setdefault(k, set()).add(p['id'])
            if _jahr(p) >= 2018: _neu.add(k)
# klickbar: ab 2 gemeinsamen Projekten oder bei Projekten ab 2018 (auch nur 1 Projekt)
D['beteiligte'] = {b[0]: {'n': b[1], 'a': b[3], 'c': len(_zahl[b[0]]), **({'w': WEB[b[0]]} if b[0] in WEB else {})}
                   for b in BETEILIGTE if b[3] and (len(_zahl.get(b[0], ())) >= 2 or b[0] in _neu)}
head = '/* Projektdaten – generiert von tools/projekte_einbauen.py */\n'
# Trennstriche aus dem Zeilenumbruch der alten Website entfernen (bewusst explizite Liste)
TRENN = ['drin-genden', 'Aussen-hülle', 'über-hohen', 'wel-ches', 'unter-streicht', 'unter-irdische', 'son-dern',
         'hochrecht-eckigen', 'grundle-gend', 'be-stückt', 'Strassen-fassade', 'Photovoltaikan-lage', 'Naturschutzge-biet',
         'Morä-nenwalls', 'Massiv-bau', 'Lochble-che', 'Lehrer-zimmers', 'Fassa-denkonstruktion', 'Far-bimpulse',
         'Beleuchtungsstär-ke', 'Bau-körper', 'Bastel-raum', 'Aluminiumpa-neel']
def _ent(o):
    if isinstance(o, str):
        for w in TRENN: o = o.replace(w, w.replace('-', ''))
        return o
    if isinstance(o, list): return [_ent(x) for x in o]
    if isinstance(o, dict): return {k: _ent(v) for k, v in o.items()}
    return o
D = _ent(D)
open(os.path.join(R, 'assets/js/data.js'), 'w').write(head + 'window.APB = ' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(D['projects']), 'Projekte |', sum(1 for p in D['projects'] if p.get('desc')), 'mit Beschrieb |',
      sum(1 for p in D['projects'] if p.get('mio')), 'mit Kosten |', sum(1 for p in D['projects'] if p.get('neu')), 'neu')
for p in D['projects']:
    print(' ', p['id'], p['name'], p.get('year'), p.get('mio'), p['tags'], 'desc' if p.get('desc') else '', 'plans' if p.get('plans') else '')
