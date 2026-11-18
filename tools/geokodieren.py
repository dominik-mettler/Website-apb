"""Ermittelt Koordinaten aus den Projektadressen (geo.admin.ch, amtliches Gebäudeadressverzeichnis).
Ergebnis: content/geo.json  {id: [lat, lon, "Treffer"]}. Private Wohnhäuser werden später auf ca. 100 m gerundet.
Aufruf: python3 tools/geokodieren.py
"""
import json, os, re, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import datenblaetter as DB
R = DB.R
out_p = os.path.join(R, 'content/geo.json')
geo = json.load(open(out_p)) if os.path.exists(out_p) else {}
def query(q):
    u = 'https://api3.geo.admin.ch/rest/services/api/SearchServer?' + urllib.parse.urlencode({'searchText': q, 'type': 'locations', 'origins': 'address', 'limit': 1})
    with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'website-build'}), timeout=20) as r:
        res = json.load(r).get('results', [])
    return res[0]['attrs'] if res else None
for pid in DB.SEITENZUORDNUNG:
    if pid in geo: continue
    adr = DB.zusammenstellen(pid)['adresse_roh']
    if not adr: continue
    parts = [x.strip() for x in re.split(r',', adr)]
    ort = re.sub(r'\b\d{4}\s*', '', parts[-1]).replace(' ZH', '').strip()
    street = next((x for x in parts if re.search(r'[A-Za-zäöü]+\s*\d', x)), parts[0])
    street = re.split(r'\s*[+/]\s*|\s+und\s+', street)[0]
    street = re.sub(r'(\d+)[-–]\d+', r'\1', street)
    for q in [f'{street} {ort}', street]:
        a = query(q); time.sleep(0.3)
        if a:
            geo[pid] = [round(a['lat'], 6), round(a['lon'], 6), re.sub('<[^>]+>', '', a['label'])]; break
    print(pid, '|', adr, '->', geo.get(pid))
json.dump(geo, open(out_p, 'w'), ensure_ascii=False, indent=1)
