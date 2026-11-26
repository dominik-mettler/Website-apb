"""Englisch für Inhalte aus dem CMS automatisch erzeugen (läuft beim Veröffentlichen auf GitHub, vor dem Bau).

- Liest assets/data/cms.json, übersetzt deutsche Felder, die im CMS geändert oder neu angelegt wurden, mit DeepL
  ins britische Englisch und schreibt sie als «en» zurück in cms.json (so sieht man sie danach im CMS und kann sie anpassen).
- Übersetzt wird nur, was noch fehlt oder dessen deutscher Text sich seit der letzten Übersetzung geändert hat
  (en._quelle merkt sich den deutschen Stand). Von Hand korrigiertes Englisch bleibt so erhalten.
- Fachbegriffe kommen aus content/en/GLOSSAR.md (als DeepL-Glossar).
- Ohne Schlüssel (Umgebungsvariable DEEPL_KEY, auf GitHub als Secret) passiert nichts: die englische Seite zeigt dann Deutsch.
Ausgabe: «geändert» wenn cms.json neu geschrieben wurde.
"""
import json, os, re, sys, urllib.request, urllib.parse
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PFAD = os.path.join(R, 'assets/data/cms.json')
KEY = os.environ.get('DEEPL_KEY', '').strip()
API = os.environ.get('DEEPL_URL') or ('https://api-free.deepl.com/v2/' if KEY.endswith(':fx') else 'https://api.deepl.com/v2/')
FELDER = ('name', 'sub', 'text')

def anfrage(pfad, daten=None, methode='POST'):
    req = urllib.request.Request(API + pfad, data=json.dumps(daten).encode() if daten is not None else None, method=methode,
                                 headers={'Authorization': 'DeepL-Auth-Key ' + KEY, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        t = r.read().decode()
        return json.loads(t) if t else {}

def glossar():
    """Glossar-Tabelle (Deutsch | Englisch) -> DeepL-Glossar; nur eindeutige, kurze Einträge."""
    paare = {}
    for z in open(os.path.join(R, 'content/en/GLOSSAR.md'), encoding='utf-8'):
        m = re.match(r'\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|', z)
        if not m or m.group(1) in ('Deutsch', '---') or set(m.group(1)) <= set('-'): continue
        de, en = [x.strip() for x in m.group(1).split(',')], m.group(2).strip()
        if '/' in en or '(' in en or len(en) > 60: en = en.split('/')[0].split('(')[0].strip()
        for d in de:
            if '/' in d or '«' in d or not d or not en: continue
            paare.setdefault(d, en)
    if not paare: return None
    try:
        g = anfrage('glossaries', {'name': 'apb-website', 'source_lang': 'de', 'target_lang': 'en', 'entries_format': 'tsv',
                                   'entries': '\n'.join('%s\t%s' % (k.replace('\t', ' '), v.replace('\t', ' ')) for k, v in paare.items())})
        return g.get('glossary_id')
    except Exception as e:
        print('Glossar nicht verfügbar:', e); return None

def uebersetzen(texte, gid):
    out = []
    for i in range(0, len(texte), 40):
        teil = texte[i:i + 40]
        d = {'text': teil, 'source_lang': 'DE', 'target_lang': 'EN-GB', 'preserve_formatting': True}
        if gid: d['glossary_id'] = gid
        r = anfrage('translate', d)
        out += [t['text'] for t in r['translations']]
    return out

import importlib.util
def _modul(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(R, 'content/en', name + '.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
F = _modul('fakten')
def fakt_geprueft(a, b):
    """(Schlüssel geprüft?, Wert geprüft?) – gibt es dafür schon eine geprüfte Übersetzung in content/en/fakten.py?"""
    f = {}; F.fakt(a, b, f, '')
    unveraendert = a != 'Adresse' and F.wert(b) == b and bool(re.search(r'[A-Za-zÄÖÜäöü]{4,}', b)) and b not in getattr(F, 'BAUHERR', {})
    return a in F.SCHLUESSEL, not unveraendert and not any(k == b or k.startswith(b + '  →') for k in f)

def main():
    if not os.path.exists(PFAD): return
    cms = json.load(open(PFAD, encoding='utf-8'))
    auftraege = []   # (eintrag, feld, index, deutsch)
    for gruppe in ('projekte', 'neu'):
        for pid, c in (cms.get(gruppe) or {}).items():
            en = c.setdefault('en', {}); q = en.setdefault('_quelle', {})
            def braucht(schluessel, de):
                return bool(de) and (not en.get(schluessel) or q.get(schluessel) != de)
            for f in FELDER:
                if f in c and braucht(f, c[f]): auftraege.append((en, f, None, c[f]))
            orig = {t for z in (c.get('_desc_orig') or []) for t in z if t}   # unveränderte Abschnitte haben schon geprüftes Englisch
            for k, z in enumerate(c.get('desc') or []):
                for j in (0, 1):
                    sl = 'desc.%d.%d' % (k, j)
                    if z[j] and z[j] not in orig and braucht(sl, z[j]): auftraege.append((en, sl, None, z[j]))
            for k, z in enumerate(c.get('facts') or []):
                ok = fakt_geprueft(z[0], z[1]) if z[0] and z[1] else (True, True)
                for j in (0, 1):
                    sl = 'facts.%d.%d' % (k, j)
                    if z[j] and not ok[j] and braucht(sl, z[j]): auftraege.append((en, sl, None, z[j]))
            for k, b in enumerate(c.get('bilder') or []):
                sl = 'cap.%d' % k
                if b.get('cap') and not F.cap(b['cap']) and braucht(sl, b['cap']): auftraege.append((en, sl, None, b['cap']))
    if not auftraege:
        print('Englisch: nichts zu übersetzen'); return
    if not KEY:
        print('Englisch: %d Texte ohne Übersetzung – kein DEEPL_KEY hinterlegt (englische Seite zeigt Deutsch)' % len(auftraege)); return
    gid = glossar()
    try:
        ergebnis = uebersetzen([a[3] for a in auftraege], gid)
    finally:
        if gid:
            try: anfrage('glossaries/' + gid, None, 'DELETE')
            except Exception: pass
    for (en, s, _, de), t in zip(auftraege, ergebnis):
        en[s] = t; en['_quelle'][s] = de
    json.dump(cms, open(PFAD, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('Englisch: %d Texte übersetzt' % len(auftraege)); print('geändert')

if __name__ == '__main__':
    main()
