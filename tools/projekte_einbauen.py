"""Übernimmt aufbereitetes Projektmaterial (content/projekte/<id>/) in die Website.

- Bilder -> assets/img/p2/<id>/  (NN.jpg 1600px, NN-s.jpg/-s.webp 800px, 01.webp)
- Pläne  -> assets/img/p2/<id>/plan-NN.webp (2400px) und plan-NN-s.webp (1200px)
- assets/js/data.js: Bildliste, Bildunterschriften, Pläne, Beschrieb, Beteiligte, Kenndaten
Projekte, die noch nicht auf der Website sind, werden übersprungen (Name/Ort fehlen).
Aufruf: python3 tools/projekte_einbauen.py
"""
import os, json, re
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(R, 'content', 'projekte')
ns = {}; exec(open(os.path.join(C, 'daten.py')).read(), ns); DATEN = ns['DATEN']

dpath = os.path.join(R, 'assets/js/data.js')
raw = open(dpath).read()
head, js = raw.split('window.APB = ', 1)
D = json.loads(js.rstrip().rstrip(';'))
byid = {p['id']: p for p in D['projects']}

def save(im, path, w, fmt='JPEG', q=80):
    im = im.copy(); im.thumbnail((w, w), Image.LANCZOS)
    if fmt == 'WEBP': im.save(path, 'WEBP', quality=q, method=6)
    else: im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
    return im.size

for pid in sorted(os.listdir(C)):
    src = os.path.join(C, pid)
    if not os.path.isdir(src): continue
    if pid not in byid:
        print('übersprungen (noch nicht auf der Website):', pid); continue
    sel = json.load(open(os.path.join(src, 'auswahl.json')))
    out = os.path.join(R, 'assets/img/p2', pid); os.makedirs(out, exist_ok=True)
    dims, cap = [], {}
    for i, f in enumerate(sel['fotos'], 1):
        im = Image.open(os.path.join(src, f['datei'])).convert('RGB')
        n = '%02d' % i
        dims.append(list(save(im, f'{out}/{n}.jpg', 1600, q=80)))
        save(im, f'{out}/{n}-s.jpg', 800, q=76)
        save(im, f'{out}/{n}-s.webp', 800, 'WEBP', 76)
        if i == 1: save(im, f'{out}/{n}.webp', 1600, 'WEBP', 78)
        if f['unterschrift']: cap[str(i)] = f['unterschrift']
    plans = []
    for k, f in enumerate(sel['plaene'], 1):
        im = Image.open(os.path.join(src, f['datei'])).convert('L')
        save(im, f'{out}/plan-%02d.webp' % k, 2400, 'WEBP', 90)
        save(im, f'{out}/plan-%02d-s.webp' % k, 1200, 'WEBP', 88)
        plans.append(f['unterschrift'])
    p = byid[pid]
    p['base'] = f'assets/img/p2/{pid}/'
    p['img'] = dims; p['cap'] = cap; p['plans'] = plans
    d = DATEN.get(pid)
    if d:
        facts = [f for f in p['facts'] if f[0] not in d.get('drop', [])]
        keys = [f[0] for f in facts]
        for k, v in d['facts']:
            if k in keys: facts[keys.index(k)][1] = v
            else: facts.append([k, v]); keys.append(k)
        p['facts'] = facts
        p['desc'] = [list(x) for x in d['text']]
        p['team'] = [list(x) for x in d['team']]
        if 'status' in d: p['status'] = d['status']
        if 'year' in d: p['year'] = d['year']
        else:
            fz = dict(facts).get('Fertigstellung', '')
            m = re.findall(r'(\d{4})', fz)
            if m: p['year'] = int(m[-1])
    print(pid, len(dims), 'Fotos', len(plans), 'Pläne', 'Datenblatt' if d else '')

open(dpath, 'w').write(head + 'window.APB = ' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n')
