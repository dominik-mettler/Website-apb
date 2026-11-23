"""Ersatz-Umgebung für die 3D-Ansicht, wo swissBUILDINGS3D keine Gebäude hat (Lücke im swisstopo-Datensatz).

Grundrisse: amtliche Vermessung (geodienste.ch, LCSF Art = Gebaeude), Höhe: GWR-Geschosse × 3.0 m + 1 m (sonst 7 m).
Ergebnis: assets/data/umgebung-<id>.json  [[ring, höhe, egid], ...]  (wird von map3d.js nur bei Bedarf geladen)
Aufruf: python3 tools/umgebung_luecke.py 334-sbg 324-kbg
"""
import json, os, ssl, sys, urllib.parse, urllib.request

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CTX = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt') if os.path.exists('/root/.ccr/ca-bundle.crt') else None
D = 0.0045   # halbe Ausschnittsgrösse in Grad (ca. 500 m N–S, 340 m O–W)

def get(u): return json.load(urllib.request.urlopen(u, context=CTX, timeout=90))

def av(lat, lon):
    out = []
    q = {'SERVICE': 'WFS', 'VERSION': '2.0.0', 'REQUEST': 'GetFeature', 'TYPENAMES': 'ms:LCSF', 'SRSNAME': 'EPSG:4326',
         'BBOX': f'{lat - D},{lon - D * 1.5},{lat + D},{lon + D * 1.5},EPSG:4326', 'OUTPUTFORMAT': 'geojson', 'COUNT': '5000'}
    for f in get('https://geodienste.ch/db/av_0/deu?' + urllib.parse.urlencode(q))['features']:
        if f['properties'].get('Art') == 'Gebaeude' and f['geometry']['type'] == 'Polygon': out.append(f)
    return out

def geschosse(lat, lon):
    g = {}
    n = 4; s = 2 * D / n; t = 3 * D / n
    for i in range(n):
        for j in range(n):
            y0 = lat - D + i * s; x0 = lon - 1.5 * D + j * t
            env = f'{x0},{y0},{x0 + t},{y0 + s}'
            u = 'https://api3.geo.admin.ch/rest/services/api/MapServer/identify?' + urllib.parse.urlencode({
                'geometry': env, 'geometryType': 'esriGeometryEnvelope', 'layers': 'all:ch.bfs.gebaeude_wohnungs_register',
                'mapExtent': env, 'imageDisplay': '500,500,96', 'tolerance': '0', 'sr': '4326', 'returnGeometry': 'false', 'limit': '200'})
            for r in get(u)['results']:
                a = r['attributes']
                if a.get('gastw'): g[str(a['egid'])] = int(a['gastw'])
    return g

def main(ids):
    s = open(os.path.join(R, 'assets/js/data.js')).read(); d = json.loads(s[s.index('{'):s.rindex('}') + 1])
    os.makedirs(os.path.join(R, 'assets/data'), exist_ok=True)
    for p in d['projects']:
        if p['id'] not in ids: continue
        lat, lon = p['geo']
        geb = av(lat, lon); gs = geschosse(lat, lon)
        res = []
        for f in geb:
            e = f['properties'].get('GWR_EGID') or ''
            h = gs[e] * 3.0 + 1.0 if e in gs else 7.0
            res.append([[[round(x, 7), round(y, 7)] for x, y in (pt[:2] for pt in f['geometry']['coordinates'][0])], h, e])
        json.dump(res, open(os.path.join(R, 'assets/data/umgebung-%s.json' % p['id']), 'w'), separators=(',', ':'))
        print(p['id'], len(res), 'Gebäude,', sum(1 for r in res if r[2] in gs), 'mit Geschosszahl')

if __name__ == '__main__':
    main(sys.argv[1:])
