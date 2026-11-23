"""Sucht und prüft Websites der Beteiligten (content/fachplaner.py) -> content/fachplaner-web-roh.json (Rohtreffer; übernommen wird nur, was in content/fachplaner-web.json geprüft eingetragen ist)
Eine Adresse wird nur übernommen, wenn die Seite erreichbar ist, der Firmenname auf der Seite vorkommt
und es keine Domain-Parkseite ist. Manuelle Einträge in MANUELL haben Vorrang; KEINE schliesst Firmen aus.
Aufruf: python3 tools/fachplaner_web.py
"""
import json, os, re, sys, unicodedata, urllib.request, ssl, html
from concurrent.futures import ThreadPoolExecutor
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, os.path.join(R, 'content'))
from fachplaner import BETEILIGTE

MANUELL = {'sbb': 'https://www.sbb.ch', 'apb': None}
KEINE = set()
RECHTSFORM = {'ag', 'gmbh', 'sa', 'kg', 'klg', 'partner', 'und', 'plus', 'the'}
CTX = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or '/root/.ccr/ca-bundle.crt') if os.path.exists('/root/.ccr/ca-bundle.crt') else None

def ascii(t):
    t = t.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue')
    return unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()

def woerter(name):
    w = re.findall(r'[a-z0-9]+', ascii(name))
    return [x for x in w if x not in RECHTSFORM and len(x) > 1]

def kandidaten(name):
    w = woerter(name); w_all = re.findall(r'[a-z0-9]+', ascii(name))
    c = []
    for liste in (w[:1], w[:2], w[:3], w_all[:2], w_all[:3]):
        if not liste: continue
        c += [''.join(liste), '-'.join(liste)]
    seen = []
    for x in c:
        for tld in ('.ch', '.com'):
            d = x + tld
            if d not in seen and len(x) > 2: seen.append(d)
    return seen[:10]

def holen(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Linkpruefung Referenzliste)'})
        with urllib.request.urlopen(req, timeout=12, context=CTX) as r:
            return r.geturl(), r.read(400000).decode('utf-8', 'ignore')
    except Exception:
        return None, ''

PARK = re.compile(r'domain (is|ist) (for sale|zu verkaufen)|this domain|parked|sedo|domain kaufen|hostpoint.*platzhalter|under construction|coming soon', re.I)

def pruefen(eintrag):
    key, name, _, art = eintrag
    if art != 'firma' or key in KEINE: return key, None
    if key in MANUELL: return key, MANUELL[key]
    w = woerter(name)
    kern = w[0] if w else ''
    for d in kandidaten(name):
        final, body = holen('https://' + d)
        if not body: continue
        txt = ascii(html.unescape(re.sub(r'<[^>]+>', ' ', body)))[:20000]
        titel = ascii(html.unescape((re.search(r'<title[^>]*>(.*?)</title>', body, re.S | re.I) or [None, ''])[1]))
        if PARK.search(txt[:3000]): continue
        # Kernwort muss im Titel oder prominent im Text stehen, bei mehrteiligen Namen auch das zweite Wort im Text
        if kern and (kern in titel or txt.count(kern) >= 2) and (len(w) < 2 or w[1] in txt):
            return key, final.rstrip('/')
    return key, None

with ThreadPoolExecutor(12) as ex:
    res = dict(ex.map(pruefen, BETEILIGTE))
web = {k: v for k, v in res.items() if v}
json.dump(web, open(os.path.join(R, 'content/fachplaner-web-roh.json'), 'w'), ensure_ascii=False, indent=1, sort_keys=True)
print(len(web), 'Websites gefunden von', sum(1 for b in BETEILIGTE if b[3] == 'firma'), 'Firmen')
for k, v in sorted(web.items()): print(' ', k, v)
print('ohne Website:', ', '.join(sorted(k for k, v in res.items() if not v and dict((b[0], b[3]) for b in BETEILIGTE)[k] == 'firma')))
