"""Projektgebäude als Volumen für die 3D-Ansicht (content/volumen.json).

Das swisstopo-Gebäudemodell (swissBUILDINGS3D) ist vielerorts auf dem Stand 2013/14 – neue Projekte fehlen.
Darum: aktueller Gebäudegrundriss aus der amtlichen Vermessung (geodienste.ch, WFS LCSF, Art = Gebaeude)
+ Höhe aus dem Gebäude- und Wohnungsregister (GWR: Volumen / Fläche, sonst Geschosse × 3.2 m).
Ausgewählt wird das Gebäude, das den Projektpunkt enthält (sonst das nächstgelegene, max. 35 m).
Private Wohnhäuser (gerundete Koordinaten) werden bewusst ausgelassen.
Manuell: content/volumen-auswahl.json {id: [EGID, ...]} legt fest, welche Gebäude zum Projekt gehören ([] = keines, z. B. noch nicht gebaut).
Aufruf: python3 tools/projekt_volumen.py [id ...]
"""
import json, math, os, ssl, sys, urllib.parse, urllib.request

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CTX = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or '/root/.ccr/ca-bundle.crt') if os.path.exists('/root/.ccr/ca-bundle.crt') else None
OUT = os.path.join(R, 'content/volumen.json')
WAHL = os.path.join(R, 'content/volumen-auswahl.json')

def get(u):
    return json.load(urllib.request.urlopen(u, context=CTX, timeout=60))

def av_gebaeude(lat, lon, d=0.0006):
    q = {'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature', 'TYPENAMES': 'ms:LCSF', 'SRSNAME': 'EPSG:4326',
         'BBOX': f'{lat - d},{lon - d},{lat + d},{lon + d},EPSG:4326', 'OUTPUTFORMAT': 'geojson', 'COUNT': '400'}
    j = get('https://geodienste.ch/db/av_0/deu?' + urllib.parse.urlencode(q))
    return [f for f in j['features'] if f['properties'].get('Art') == 'Gebaeude' and f['geometry']['type'] == 'Polygon']

def gwr(egid):
    if not egid: return {}
    u = 'https://api3.geo.admin.ch/rest/services/api/MapServer/find?' + urllib.parse.urlencode(
        {'layer': 'ch.bfs.gebaeude_wohnungs_register', 'searchText': egid, 'searchField': 'egid', 'returnGeometry': 'false', 'contains': 'false'})
    r = get(u)['results']
    return r[0]['attributes'] if r else {}

def innen(ring, x, y):
    c = False
    for i in range(len(ring)):
        x1, y1 = ring[i - 1][:2]; x2, y2 = ring[i][:2]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c

def abstand_m(ring, lon, lat):
    kx = 111320 * math.cos(math.radians(lat)); ky = 111320
    best = 1e9
    for i in range(len(ring)):
        ax, ay = (ring[i - 1][0] - lon) * kx, (ring[i - 1][1] - lat) * ky
        bx, by = (ring[i][0] - lon) * kx, (ring[i][1] - lat) * ky
        dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy or 1e-9
        t = max(0, min(1, -(ax * dx + ay * dy) / L))
        best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best

def hoehe(a):
    try:
        if a.get('gvol') and a.get('garea'):
            h = float(a['gvol']) / float(a['garea'])
            if 6 <= h <= 45: return round(h, 1)
    except (TypeError, ValueError): pass
    if a.get('gastw'): return round(float(a['gastw']) * 3.2, 1)
    return 9.0

def main(ids):
    s = open(os.path.join(R, 'assets/js/data.js')).read(); d = json.loads(s[s.index('{'):s.rindex('}') + 1])
    alt = json.load(open(OUT)) if os.path.exists(OUT) else {}
    wahl = json.load(open(WAHL)) if os.path.exists(WAHL) else {}
    for p in d['projects']:
        if ids and p['id'] not in ids: continue
        if not p.get('geoExakt', True) or not p.get('geo'): continue
        lat, lon = p['geo']
        try: feats = av_gebaeude(lat, lon)
        except Exception as e: print('!', p['id'], e); continue
        if p['id'] in wahl:
            sel = [f for f in feats if f['properties'].get('GWR_EGID') in wahl[p['id']]]
        else:
            ring = lambda f: f['geometry']['coordinates'][0]
            drin = [f for f in feats if innen(ring(f), lon, lat)]
            if drin: sel = drin[:1]
            else:
                nah = sorted(((abstand_m(ring(f), lon, lat), f) for f in feats), key=lambda x: x[0])
                sel = [nah[0][1]] if nah and nah[0][0] < 35 else []
        if not sel: print('–', p['id'], p['name'], 'kein Gebäude gefunden'); alt.pop(p['id'], None); continue
        teile = []
        for f in sel:
            a = gwr(f['properties'].get('GWR_EGID'))
            teile.append({'egid': f['properties'].get('GWR_EGID') or '', 'h': hoehe(a), 'jahr': a.get('gbauj'),
                          'ring': [[round(x, 7), round(y, 7)] for x, y in (pt[:2] for pt in f['geometry']['coordinates'][0])]})
        alt[p['id']] = teile
        print('✓', p['id'], p['name'], ' · '.join('EGID %s %.1f m (%s)' % (t['egid'], t['h'], t['jahr']) for t in teile))
    json.dump(alt, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main(sys.argv[1:])
