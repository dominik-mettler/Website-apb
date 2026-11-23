"""Erzeugt die englische Website unter en/ aus den deutschen Seiten.

- Wörterbuch: content/en/seiten.py (SEITEN: {deutsch: englisch}) – Schlüssel sind ganze Textblöcke
  (inkl. Inline-Markup wie <a>, <b>, <br>) oder einzelne Textstücke bzw. Attributwerte.
- Projektdaten: content/en/projekte.py + content/en/fakten.py -> assets/js/data-en.js
- Laufzeit (Texte, die JavaScript erzeugt): assets/js/i18n-en.js liest dasselbe Wörterbuch (UI-Teil).
- Alles, was nicht übersetzt ist, landet in content/en/fehlend.txt (Build bricht nicht ab).
Aufruf: python3 tools/englisch.py   (nach tools/build.py)
"""
import json, os, re, sys, importlib.util
from bs4 import BeautifulSoup, NavigableString, Comment, Tag

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
EN = os.path.join(R, 'en'); os.makedirs(EN, exist_ok=True)

def lade(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(R, 'content/en', name + '.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

S = lade('seiten')
norm = lambda s: re.sub(r'\s+', ' ', s.replace('<br/>', '<br>')).strip()
T = {norm(k): v for k, v in S.SEITEN.items()}
UI = {norm(k): v for k, v in getattr(S, 'UI', {}).items()}
ALLE = dict(T); ALLE.update(UI)
MUSTER = [(re.compile(a), b) for a, b in getattr(S, 'MUSTER', [])]
IGNOR = set(getattr(S, 'IGNOR', []))
fehlend = {}

def tr(txt, wo):
    """Text übersetzen; None, wenn nicht nötig/gefunden (dann fehlend vermerken)."""
    k = norm(txt)
    if not k or not re.search(r'[A-Za-zÄÖÜäöü]', k): return None
    if k in ALLE: return ALLE[k]
    for rx, rep in MUSTER:
        if rx.fullmatch(k): return rx.sub(rep, k)
    if k in IGNOR: return None
    fehlend.setdefault(k, set()).add(wo)
    return None

INLINE = {'a', 'b', 'strong', 'em', 'i', 'span', 'br', 'small', 'sup', 'sub', 'abbr', 'time', 'u', 'mark', 's', 'wbr', 'code', 'kbd'}
OPAK = {'svg', 'img'}
SKIP = {'script', 'style', 'svg', 'noscript', 'template', 'code'}
ATTR = ['alt', 'title', 'aria-label', 'placeholder', 'aria-roledescription', 'data-label', 'data-title', 'data-text', 'data-cursor', 'value']

def ist_einheit(el):
    if not any(isinstance(c, NavigableString) and not isinstance(c, Comment) and c.strip() for c in el.descendants
               if not (isinstance(c.parent, Tag) and c.parent.name in SKIP)):
        return False
    for c in el.descendants:
        if isinstance(c, Tag) and c.name not in INLINE and c.name not in OPAK:
            # Tags innerhalb von SVG ignorieren
            if any(p.name == 'svg' for p in c.parents if isinstance(p, Tag)): continue
            return False
    return True

def inner_key(el):
    """innerHTML mit Platzhaltern für SVG/IMG, damit Schlüssel lesbar bleiben."""
    opak = []
    parts = []
    for c in el.children:
        if isinstance(c, Tag) and c.name in OPAK:
            parts.append('⟦%d⟧' % len(opak)); opak.append(c)
        else:
            parts.append(str(c))
    return norm(''.join(parts)), opak

def setze_inner(el, neu, opak):
    for i, o in enumerate(opak):
        neu = neu.replace('⟦%d⟧' % i, str(o))
    frag = BeautifulSoup(neu, 'html.parser')
    el.clear()
    for c in list(frag.contents):
        el.append(c.extract())
    return el

def uebersetze(el, wo):
    for c in list(el.children):
        if isinstance(c, Comment): continue
        if isinstance(c, NavigableString):
            n = tr(str(c), wo)
            if n is not None:
                pre = ' ' if str(c)[:1].isspace() else ''; post = ' ' if str(c)[-1:].isspace() else ''
                c.replace_with(NavigableString(pre + n + post))
            continue
        if not isinstance(c, Tag) or c.name in SKIP: continue
        attrs(c, wo)
        if c.name not in INLINE and ist_einheit(c):
            k, opak = inner_key(c)
            if k in T:
                c = setze_inner(c, T[k], opak)
                for d in c.find_all(True): attrs(d, wo)
                continue
        uebersetze(c, wo)

def attrs(el, wo):
    for a in ATTR:
        v = el.get(a)
        if isinstance(v, str) and v.strip():
            if a == 'value' and el.name not in ('button',) and el.get('type') not in ('submit', 'button'): continue
            n = tr(v, wo + ' @' + a)
            if n is not None: el[a] = n

def pfad(v):
    if v.startswith('assets/'): return '../' + v
    return v

def seite(fn):
    src = open(os.path.join(R, fn), encoding='utf-8').read()
    soup = BeautifulSoup(src, 'html.parser')
    soup.html['lang'] = 'en'
    wo = fn
    t = soup.title
    if t and t.string:
        n = tr(t.string, wo + ' <title>')
        if n: t.string = n
    for m in soup.find_all('meta'):
        if m.get('name') == 'description' or (m.get('property') or '').startswith('og:') and m.get('property') in ('og:title', 'og:description'):
            n = tr(m.get('content', ''), wo + ' meta')
            if n: m['content'] = n
    for ld in soup.find_all('script', type='application/ld+json'):
        try:
            d = json.loads(ld.string)
            def w(o):
                if isinstance(o, dict): return {k: (w(v) if k not in ('name', 'url', 'email', 'telephone', 'faxNumber', '@type', '@context') else v) for k, v in o.items()}
                if isinstance(o, list): return [w(x) for x in o]
                if isinstance(o, str):
                    if o.startswith('http') or o in ('CHF',): return o
                    n = tr(o, wo + ' json-ld'); return n if n else o
                return o
            ld.string = json.dumps(w(d), ensure_ascii=False)
        except Exception: pass
    uebersetze(soup.body, wo)
    # Pfade auf Assets (eine Ebene höher)
    for el in soup.find_all(True):
        for a in ('src', 'href', 'poster', 'data-src'):
            v = el.get(a)
            if isinstance(v, str): el[a] = pfad(v)
        if el.get('srcset'):
            el['srcset'] = ', '.join(pfad(x.strip()) for x in el['srcset'].split(','))
        st = el.get('style')
        if st and 'assets/' in st: el['style'] = st.replace("url('assets/", "url('../assets/").replace('url(assets/', 'url(../assets/').replace('url("assets/', 'url("../assets/')
    for el in soup.find_all('image'):
        if el.get('href', '').startswith('assets/'): el['href'] = '../' + el['href']
    # Sprachumschalter, hreflang, Skripte
    for a in soup.select('a.lang'):
        a['href'] = '../' + fn; a['hreflang'] = 'de'; a['lang'] = 'de'; a.string = 'DE'
        a['aria-label'] = 'Deutsche Version'
    for l in soup.find_all('link', rel='canonical'):
        l['href'] = l['href'].replace('/Website-apb/', '/Website-apb/en/')
    for s in soup.find_all('script'):
        if s.get('src', '').startswith('../assets/js/data.js'):
            s['src'] = s['src'].replace('data.js', 'data-en.js').split('?')[0] + '?v=' + DATA_V
            pre = soup.new_tag('script'); pre.string = 'window.APB_ROOT="../";window.APB_LANG="en";'
            s.insert_before(pre)
            i18 = soup.new_tag('script', src='../assets/js/i18n-en.js?v=' + I18N_V, defer=True)
            s.insert_after(i18)
        elif s.string and 'window.APB_3D="assets/' in s.string:
            s.string = s.string.replace('window.APB_3D="assets/', 'window.APB_3D="../assets/')
    out = str(soup)
    open(os.path.join(EN, fn), 'w', encoding='utf-8').write(out)

# ---------------------------------------------------------------- Projektdaten
def daten():
    P = lade('projekte'); F = lade('fakten')
    s = open(os.path.join(R, 'assets/js/data.js'), encoding='utf-8').read()
    D = json.loads(s[s.index('{'):s.rindex('}') + 1])
    for p in D['projects']:
        e = P.PROJEKTE.get(p['id'], {})
        wo = 'projekt ' + p['id']
        if p.get('areal'): p['areal'] = P.AREAL.get(p['areal'], p['areal']) if p['areal'] in P.AREAL else fehlend.setdefault(p['areal'], set()).add(wo + ' areal') or p['areal']
        for k in ('name', 'sub', 'text'):
            if e.get(k): p[k] = e[k]
            elif p.get(k): fehlend.setdefault(norm(p[k]), set()).add(wo + ' ' + k) if not F.gleich(p[k]) else None
        if p.get('desc'):
            if e.get('desc') and len(e['desc']) == len(p['desc']): p['desc'] = e['desc']
            else: fehlend.setdefault('DESC ' + p['id'], set()).add(wo)
        if p.get('cap'):
            ec = e.get('cap', {})
            for k, v in list(p['cap'].items()):
                n = ec.get(k) or F.cap(v)
                if n: p['cap'][k] = n
                else: fehlend.setdefault(v, set()).add(wo + ' cap')
        if p.get('plans'):
            p['plans'] = [F.plan(x) or fehlend.setdefault(x, set()).add(wo + ' plan') or x for x in p['plans']]
        p['facts'] = [F.fakt(a, b, fehlend, wo) for a, b in p['facts']]
        if p.get('team'):
            p['team'] = [[F.rolle(t[0], fehlend, wo), F.wert(t[1])] + t[2:] for t in p['team']]
        if p.get('status'): p['status'] = F.STATUS.get(p['status'], p['status'])
        if p.get('video') and p['video'].get('text'): p['video']['text'] = e.get('video', F.VIDEO.get(p['video']['text'], p['video']['text']))
    D['cats'] = [[c, F.KAT[c]] for c, _ in D['cats']]
    for c in D.get('competitions', []):
        c['t'] = F.wettbewerb(c['t'], fehlend)
    def pf(o):
        if isinstance(o, str): return '../' + o if o.startswith('assets/') else o
        if isinstance(o, list): return [pf(x) for x in o]
        if isinstance(o, dict): return {k: pf(v) for k, v in o.items()}
        return o
    D = pf(D)
    D['lang'] = 'en'
    open(os.path.join(R, 'assets/js/data-en.js'), 'w', encoding='utf-8').write(
        '/* Projektdaten englisch – generiert von tools/englisch.py */\nwindow.APB = ' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n')

def i18n():
    js = ('/* Laufzeit-Übersetzung für Texte, die JavaScript erzeugt – generiert von tools/englisch.py */\n'
          '(function(){var T=' + json.dumps(ALLE, ensure_ascii=False, separators=(',', ':')) + ';\n'
          'var M=' + json.dumps([[a.pattern, re.sub(r'\\(\d)', r'$\1', b)] for a, b in MUSTER], ensure_ascii=False) + '.map(function(x){return [new RegExp("^(?:"+x[0]+")$"),x[1]]});\n'
          + open(os.path.join(R, 'tools/i18n-laufzeit.js'), encoding='utf-8').read() + '})();\n')
    open(os.path.join(R, 'assets/js/i18n-en.js'), 'w', encoding='utf-8').write(js)

import hashlib
daten(); i18n()
DATA_V = hashlib.md5(open(os.path.join(R, 'assets/js/data-en.js'), 'rb').read()).hexdigest()[:8]
I18N_V = hashlib.md5(open(os.path.join(R, 'assets/js/i18n-en.js'), 'rb').read()).hexdigest()[:8]
AUSNAHMEN = {'praesentation.html'}   # interne Präsentation bleibt deutsch
for fn in sorted(os.listdir(R)):
    if not fn.endswith('.html') or fn in AUSNAHMEN or re.match(r'projekt-[\d-]+-', fn): continue   # Projektseiten macht tools/seo.py
    if 'http-equiv="refresh"' in open(os.path.join(R, fn), encoding='utf-8').read(): continue
    seite(fn)
with open(os.path.join(R, 'content/en/fehlend.txt'), 'w', encoding='utf-8') as f:
    for k, v in sorted(fehlend.items()):
        f.write(repr(k) + '  # ' + ', '.join(sorted(v))[:120] + '\n')
with open(os.path.join(R, 'content/en/fehlend-reihenfolge.txt'), 'w', encoding='utf-8') as f:
    seite_alt = None
    for k, v in fehlend.items():
        erst = sorted(v)[0].split(' ')[0]
        f.write(('\n## ' + erst + '\n' if erst != seite_alt else '') + repr(k) + '\n'); seite_alt = erst
print('EN-Seiten geschrieben, fehlende Übersetzungen:', len(fehlend))
