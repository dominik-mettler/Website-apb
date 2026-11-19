"""Suchmaschinen-Optimierung (nach build.py und englisch.py ausführen):
- eigene, fertig gerenderte Projektseiten (DE + EN) mit Titel, Beschreibung, Inhalt, Bildern und strukturierten Daten
- Open Graph / Twitter-Vorschau, og:url, og:locale, Brotkrumen (JSON-LD) auf allen Seiten
- sitemap.xml (mit Sprachversionen) und robots.txt
Vorschau vs. Live: siehe PREVIEW / BASE_URL in tools/build.py (Umschalten mit APB_LIVE=1).
"""
import html, json, os, re, sys, datetime
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
LIVE = os.environ.get('APB_LIVE') == '1'
BASE = 'https://www.apb-architekten.ch/' if LIVE else 'https://dominik-mettler.github.io/Website-apb/'
E = html.escape
HEUTE = datetime.date.today().isoformat()

def lade(pfad):
    s = open(os.path.join(R, pfad), encoding='utf-8').read()
    return json.loads(s[s.index('{'):s.rindex('}') + 1])

DATEN = {'de': lade('assets/js/data.js'), 'en': lade('assets/js/data-en.js')}
SEITEN = ['index.html', 'projekte.html', 'aktuell.html', 'leistungen.html', 'buero.html', 'chronik.html', 'karriere.html', 'kontakt.html', 'impressum.html']
BROT = {  # Seite -> Name in der Brotkrumen-Navigation
    'de': {'index.html': 'Start', 'projekte.html': 'Projekte', 'aktuell.html': 'Aktuell', 'leistungen.html': 'Leistungen', 'buero.html': 'Büro & Team',
           'chronik.html': '30 Jahre', 'karriere.html': 'Karriere', 'kontakt.html': 'Kontakt', 'impressum.html': 'Impressum & Datenschutz'},
    'en': {'index.html': 'Home', 'projekte.html': 'Projects', 'aktuell.html': 'News', 'leistungen.html': 'Services', 'buero.html': 'Practice & Team',
           'chronik.html': '30 Years', 'karriere.html': 'Careers', 'kontakt.html': 'Contact', 'impressum.html': 'Legal notice & privacy'},
}
ORG = BASE + '#org'

def abs_url(lang, fn): return BASE + ('en/' if lang == 'en' else '') + fn
def bild(p, i=1, gross=True):
    b = p.get('base') or 'assets/img/projects/%s/' % p['id']
    b = b.replace('../', '')
    return BASE + b + '%02d.jpg' % i if gross else BASE + b + '%02d-s.webp' % i

from bs4 import BeautifulSoup

def kopf_meta(doc, lang, fn, titel=None, beschr=None, bildurl=None, typ='website'):
    """Ergänzt/ersetzt Meta-Angaben im <head> (unabhängig von der Attribut-Reihenfolge)."""
    soup = BeautifulSoup(doc, 'html.parser')
    head = soup.head
    def meta(attr, key, val):
        m = head.find('meta', attrs={attr: key})
        if m is None:
            m = soup.new_tag('meta'); m[attr] = key; head.append(m)
        m['content'] = val
    def link(rel, href, hreflang=None):
        q = {'rel': rel}
        if hreflang: q['hreflang'] = hreflang
        l = head.find('link', attrs=q)
        if l is None:
            l = soup.new_tag('link'); l['rel'] = rel
            if hreflang: l['hreflang'] = hreflang
            head.append(l)
        l['href'] = href
    if titel:
        head.title.string = titel; meta('property', 'og:title', titel)
    if beschr:
        meta('name', 'description', beschr); meta('property', 'og:description', beschr)
    if bildurl: meta('property', 'og:image', bildurl)
    meta('property', 'og:type', typ)
    meta('property', 'og:url', abs_url(lang, fn))
    meta('property', 'og:site_name', 'apb architekten ag')
    meta('property', 'og:locale', 'en_GB' if lang == 'en' else 'de_CH')
    meta('property', 'og:locale:alternate', 'de_CH' if lang == 'en' else 'en_GB')
    meta('name', 'twitter:card', 'summary_large_image')
    link('canonical', abs_url(lang, fn))
    link('alternate', abs_url('de', fn), 'de-CH'); link('alternate', abs_url('en', fn), 'en'); link('alternate', abs_url('de', fn), 'x-default')
    return str(soup)

def jsonld(obj): return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '</script>'

def brotkrumen(lang, kette):
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': u} for i, (n, u) in enumerate(kette)]}

def projektseite(lang, p, vorlage):
    fn = p['url']
    D = DATEN[lang]
    cat = {c[0]: c[1] for c in D['cats']}
    de = lang == 'de'
    titel = '%s, %s – apb architekten ag' % (p['name'], p['ort'])
    text = p.get('text') or p.get('sub') or ''
    beschr = (text if len(text) <= 158 else text[:155].rsplit(' ', 1)[0] + ' …')
    doc = kopf_meta(vorlage, lang, fn, titel, beschr, bild(p, 1), 'article')
    doc = re.sub(r'<body([^>]*)data-page="projekt"', lambda m: '<body%sdata-page="projekt" data-pid="%s"' % (m.group(1), p['id']), doc, count=1)
    # Sprachumschalter auf die gleiche Projektseite
    doc = re.sub(r'href="(en/|\.\./)projekt\.html"', lambda m: 'href="%s%s"' % (m.group(1), fn), doc)
    # Strukturierte Daten
    adr = next((b for a, b in p['facts'] if a in ('Adresse', 'Address')), None)
    ort = {'@type': 'Place', 'name': p['ort'], 'address': {'@type': 'PostalAddress', 'addressLocality': p['ort'], 'addressRegion': 'ZH', 'addressCountry': 'CH'}}
    if adr: ort['address']['streetAddress'] = adr.split(',')[0]
    if p.get('geoExakt') and p.get('geo'): ort['geo'] = {'@type': 'GeoCoordinates', 'latitude': p['geo'][0], 'longitude': p['geo'][1]}
    werk = {'@type': 'CreativeWork', '@id': abs_url(lang, fn) + '#projekt', 'name': p['name'] + ', ' + p['ort'], 'headline': p['name'],
            'description': text, 'url': abs_url(lang, fn), 'inLanguage': 'de-CH' if de else 'en',
            'image': [bild(p, i) for i in range(1, min(4, len(p['img'])) + 1)], 'creator': {'@id': ORG}, 'locationCreated': ort,
            'genre': 'Architecture', 'keywords': ', '.join(cat.get(c, c) for c in p['cats'])}
    if p.get('year'): werk['dateCreated'] = str(p['year'])
    b = BROT[lang]
    ld = {'@context': 'https://schema.org', '@graph': [
        brotkrumen(lang, [(b['index.html'], abs_url(lang, 'index.html')), (b['projekte.html'], abs_url(lang, 'projekte.html')), (p['name'], abs_url(lang, fn))]),
        werk, {'@type': 'Organization', '@id': ORG, 'name': 'apb architekten ag', 'url': BASE}]}
    doc = doc.replace('</head>', jsonld(ld) + '\n</head>', 1)
    # Vorab gerenderter Inhalt (wird von JavaScript durch die volle Ansicht ersetzt; Inhalt identisch)
    L = (lambda d, e: d if de else e)
    teile = ['<article class="seo-pre"><div class="wrap page-hero">',
             '<nav aria-label="%s"><a href="index.html">%s</a> / <a href="projekte.html">%s</a></nav>' % (L('Brotkrumen', 'Breadcrumb'), E(b['index.html']), E(b['projekte.html'])),
             '<p class="eyebrow">%s %s · %s</p>' % (L('Projekt', 'Project'), E(p['nr']), E(' · '.join(cat.get(c, c) for c in p['cats']))),
             '<h1>%s <span>%s</span></h1>' % (E(p['name']), E(p['ort'])), '<p class="lead">%s</p>' % E(p.get('sub', '')), '<p>%s</p>' % E(text),
             '<img src="%s" alt="%s" width="800" height="533" loading="lazy">' % (E(bild(p, 1, False).replace(BASE, ('../' if not de else ''))), E(p['name'] + ', ' + p['ort'])),
             '<dl>' + ''.join('<dt>%s</dt><dd>%s</dd>' % (E(a), E(v)) for a, v in p['facts']) + '</dl>']
    for t, x in p.get('desc') or []:
        teile.append(('<h2>%s</h2>' % E(t) if t else '') + '<p>%s</p>' % E(x))
    if p.get('team'):
        teile.append('<h2>%s</h2><dl>' % L('Projektteam', 'Project team') + ''.join('<dt>%s</dt><dd>%s</dd>' % (E(a), E(v)) for a, v in p['team']) + '</dl>')
    teile.append('</div></article>')
    doc, n = re.subn(r'<div id="project">.*?</noscript></div>', lambda m: '<div id="project">' + ''.join(teile) + '</div>', doc, count=1, flags=re.S)
    assert n == 1, 'Projekt-Container nicht gefunden: ' + lang + ' ' + fn
    ziel = os.path.join(R, 'en' if not de else '', fn)
    open(ziel, 'w', encoding='utf-8').write(doc)

def seiten_meta():
    for lang in ('de', 'en'):
        for fn in SEITEN:
            pfad = os.path.join(R, 'en' if lang == 'en' else '', fn)
            if not os.path.exists(pfad): continue
            doc = open(pfad, encoding='utf-8').read()
            doc = re.sub(r'<script type="application/ld\+json" data-seo>.*?</script>\n?', '', doc, flags=re.S)
            doc = kopf_meta(doc, lang, fn)
            if fn != 'index.html':
                b = BROT[lang]
                ld = {'@context': 'https://schema.org', **brotkrumen(lang, [(b['index.html'], abs_url(lang, 'index.html')), (b[fn], abs_url(lang, fn))])}
                doc = doc.replace('</head>', '<script type="application/ld+json" data-seo>' + json.dumps(ld, ensure_ascii=False, separators=(',', ':')) + '</script>\n</head>', 1)
            open(pfad, 'w', encoding='utf-8').write(doc)

def sitemap(alle):
    x = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for fn, prio in alle:
        for lang in ('de', 'en'):
            x.append('<url><loc>%s</loc><lastmod>%s</lastmod><priority>%s</priority>'
                     '<xhtml:link rel="alternate" hreflang="de-CH" href="%s"/><xhtml:link rel="alternate" hreflang="en" href="%s"/>'
                     '<xhtml:link rel="alternate" hreflang="x-default" href="%s"/></url>' % (abs_url(lang, fn), HEUTE, prio, abs_url('de', fn), abs_url('en', fn), abs_url('de', fn)))
    x.append('</urlset>')
    open(os.path.join(R, 'sitemap.xml'), 'w').write('\n'.join(x) + '\n')
    open(os.path.join(R, 'robots.txt'), 'w').write('User-agent: *\nAllow: /\n\nSitemap: %ssitemap.xml\n' % BASE)

# alte generierte Projektseiten entfernen (falls Projekte umbenannt wurden)
for d in (R, os.path.join(R, 'en')):
    for f in os.listdir(d):
        if re.match(r'projekt-[\d-]+-.*\.html$', f): os.remove(os.path.join(d, f))
seiten_meta()
for lang in ('de', 'en'):
    vorlage = open(os.path.join(R, 'en' if lang == 'en' else '', 'projekt.html'), encoding='utf-8').read()
    for p in DATEN[lang]['projects']:
        projektseite(lang, p, vorlage)
prio = {'index.html': '1.0', 'projekte.html': '0.9', 'leistungen.html': '0.8', 'kontakt.html': '0.8', 'buero.html': '0.7', 'aktuell.html': '0.7',
        'karriere.html': '0.6', 'chronik.html': '0.6', 'impressum.html': '0.2'}
sitemap([(f, prio[f]) for f in SEITEN] + [(p['url'], '0.7' if p.get('sel') else '0.6') for p in DATEN['de']['projects']])
print('SEO:', len(DATEN['de']['projects']), 'Projektseiten je Sprache, sitemap.xml mit', 2 * (len(SEITEN) + len(DATEN['de']['projects'])), 'Adressen, Basis', BASE)
