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
    if p.get('files') and len(p['files']) >= i:
        f = p['files'][i - 1].replace('../', '')
        return BASE + f + ('.jpg' if gross else '-s.webp')
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
    werk['additionalProperty'] = [{'@type': 'PropertyValue', 'name': a, 'value': v} for a, v in p['facts'] if a not in ('Adresse', 'Address')]
    bh = dict(p['facts']).get('Bauherr') or dict(p['facts']).get('Client')
    if bh and 'rivat' not in bh: werk['funder'] = {'@type': 'Organization', 'name': bh}
    if p.get('quellen'): werk['subjectOf'] = [{'@type': 'WebPage', 'name': t, 'url': u} for t, u in p['quellen']]
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
             '<dl>' + ''.join('<dt>%s</dt><dd>%s</dd>' % (E(a), E(v)) for a, v in p['facts']) + '</dl>',
             ('<ul>' + ''.join('<li><a href="%s">%s</a></li>' % (E(u), E(t)) for t, u in p['quellen']) + '</ul>') if p.get('quellen') else '']
    for t, x in p.get('desc') or []:
        teile.append(('<h2>%s</h2>' % E(t) if t else '') + '<p>%s</p>' % E(x))
    if p.get('team'):
        teile.append('<h2>%s</h2><dl>' % L('Projektteam', 'Project team') + ''.join('<dt>%s</dt><dd>%s</dd>' % (E(t[0]), E(t[1])) for t in p['team']) + '</dl>')
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
    ki = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'Google-Extended', 'Bingbot', 'PerplexityBot', 'ClaudeBot', 'Claude-SearchBot', 'Applebot-Extended', 'CCBot']
    open(os.path.join(R, 'robots.txt'), 'w').write('# Suchmaschinen und KI-Assistenten sind ausdrücklich willkommen\n' + ''.join('User-agent: %s\nAllow: /\n\n' % b for b in ki) +
        'User-agent: *\nAllow: /\n\nSitemap: %ssitemap.xml\n# Kurzfassung für KI-Assistenten: %sllms.txt\n' % (BASE, BASE))


# ---------- KI- und Suchoptimierung (GEO): Themenseiten, llms.txt, Nachweise ----------
# Themenseiten fassen Projekte eines Gebiets mit überprüfbaren Fakten zusammen (Ort, Jahr, Verfahren, Bauherr, Kosten).
# Solche Listen übernehmen Suchmaschinen und KI-Assistenten direkt. Inhalt kommt nur aus den Projektdaten.
FK = {'Verfahren': 'Procurement', 'Bauherr': 'Client', 'Kosten': 'Cost', 'Fertigstellung': 'Completion', 'Kenndaten': 'Key figures',
      'Kosteneinhaltung': 'Cost compliance', 'Auszeichnung': 'Award'}
def fakt(p, k):
    d = dict(p['facts']); return d.get(k) or d.get(FK.get(k, k)) or ''
UMBAU = re.compile(r'umbau|sanierung|erweiterung|aufstockung|instandsetzung|renovation|refurbish|conversion|extension|renovat', re.I)
THEMEN = [
    {'fn': 'schulbau.html', 'cats': ['lernen'],
     'de': ('Schulbau', 'Schulbau im Zürcher Oberland und am Zürichsee', 'Schulhäuser und Kindergärten', 'Schul- und Kindergartenbauten'),
     'en': ('School buildings', 'School buildings in the Zurich Oberland and on Lake Zurich', 'schools and kindergartens', 'school and kindergarten buildings')},
    {'fn': 'wohnungsbau.html', 'cats': ['wohnen'],
     'de': ('Wohnungsbau', 'Wohnungsbau im Kanton Zürich', 'Mehrfamilienhäuser und Siedlungen', 'Wohnbauten'),
     'en': ('Housing', 'Housing in the Canton of Zurich', 'apartment buildings and estates', 'residential buildings')},
    {'fn': 'oeffentliche-bauten.html', 'cats': ['leiten', 'glauben', 'pflegen', 'turnen'],
     'de': ('Öffentliche Bauten', 'Öffentliche Bauten für Gemeinden', 'Verwaltung, Kirchen, Pflege und Sport', 'öffentliche Bauten'),
     'en': ('Public buildings', 'Public buildings for municipalities', 'administration, churches, care and sports', 'public buildings')},
    {'fn': 'umbau-sanierung.html', 'umbau': True,
     'de': ('Umbau und Sanierung', 'Umbau, Sanierung und Erweiterung', 'Umbauten, Sanierungen, Erweiterungen und Aufstockungen', 'Umbauten und Sanierungen'),
     'en': ('Conversion and refurbishment', 'Conversion, refurbishment and extension', 'conversions, refurbishments, extensions and storey additions', 'conversions and refurbishments')},
]
def themen_projekte(lang, th):
    out = []
    for p in DATEN[lang]['projects']:
        if p.get('status') not in ('Realisiert', 'Completed'): continue
        if th.get('umbau'):
            if not UMBAU.search(p['name'] + ' ' + p.get('sub', '') + ' ' + p.get('text', '')): continue
        elif not set(th['cats']) & set(p['cats']): continue
        out.append(p)
    return sorted(out, key=lambda p: (-(p.get('year') or 0), p['name']))
def rang1(p): return bool(re.search(r'1\.\s*rang|1st place', fakt(p, 'Verfahren'), re.I))
def themenseite(lang, th, vorlage):
    de = lang == 'de'; L = (lambda d, e: d if de else e)
    kurz, titel, was, art = th[lang]
    ps = themen_projekte(lang, th)
    if not ps: return None
    jahre = [p['year'] for p in ps if p.get('year')]
    orte = sorted(set(p['ort'] for p in ps))
    w = sum(1 for p in ps if rang1(p))
    def bhn(x): return re.sub(r'Römisch\s*-\s*Katholische', 'Röm.-Kath.', x.split(',')[0].strip())
    bauherren = sorted(set(bhn(fakt(p, 'Bauherr')) for p in ps if fakt(p, 'Bauherr') and 'rivat' not in fakt(p, 'Bauherr')))
    kern = L('apb architekten ag aus Uster hat seit %d %d %s realisiert – in %s.%s' % (min(jahre), len(ps), art, ', '.join(orte[:-1]) + (' und ' + orte[-1] if len(orte) > 1 else orte[0]),
             (' %d davon nach einem gewonnenen Wettbewerb oder einer Planerwahl (1. Rang).' % w) if w else ''),
             'apb architekten ag from Uster has completed %d %s since %d – in %s.%s' % (len(ps), art, min(jahre), ', '.join(orte[:-1]) + (' and ' + orte[-1] if len(orte) > 1 else orte[0]),
             (' %d of them after winning a competition or consultant selection (1st place).' % w) if w else ''))
    bh_txt = (L('Bauherrschaften: ', 'Clients: ') + '; '.join(bauherren[:14]) + ('…' if len(bauherren) > 14 else '') + '.') if bauherren else ''
    beschr = (kern if len(kern) <= 158 else kern[:155].rsplit(' ', 1)[0] + ' …')
    doc = re.sub(r'<script type="application/ld\+json" data-seo>.*?</script>\n?', '', vorlage, flags=re.S)
    doc = kopf_meta(doc, lang, th['fn'], titel + ' – apb architekten ag', beschr, bild(ps[0], 1), 'website')
    b = BROT[lang]
    zeilen = []
    for p in ps:
        dl = [(L('Fertigstellung', 'Completion'), str(p.get('year') or '')), (L('Verfahren', 'Procurement'), fakt(p, 'Verfahren')), (L('Bauherrschaft', 'Client'), fakt(p, 'Bauherr')),
              (L('Kosten', 'Cost'), fakt(p, 'Kosten')), (L('Kenndaten', 'Key figures'), fakt(p, 'Kenndaten')), (L('Kosteneinhaltung', 'Cost compliance'), fakt(p, 'Kosteneinhaltung')),
              (L('Auszeichnung', 'Award'), fakt(p, 'Auszeichnung'))]
        q = ''.join('<li><a href="%s" rel="noopener" target="_blank">%s</a></li>' % (E(u), E(t)) for t, u in p.get('quellen') or [])
        zeilen.append('<article class="thema-p"><a class="thema-img" href="%s"><img src="%s" alt="%s" loading="lazy" width="600" height="400"></a><div><h3><a href="%s">%s</a> <span>%s</span></h3><p>%s</p><dl>%s</dl>%s</div></article>' % (
            E(p['url']), E(bild(p, 1, False).replace(BASE, '' if de else '../')), E(p['name'] + ', ' + p['ort']), E(p['url']), E(p['name']), E(p['ort']), E(p.get('sub', '')),
            ''.join('<div><dt>%s</dt><dd>%s</dd></div>' % (E(a), E(v)) for a, v in dl if v),
            ('<ul class="thema-q"><li>%s</li>%s</ul>' % (L('Nachweise:', 'Sources:'), q)) if q else ''))
    andere = ''.join('<a class="chip" href="%s">%s</a>' % (t['fn'], E(t[lang][0])) for t in THEMEN if t is not th)
    main = ('<main id="main"><section class="page-hero"><div class="wrap"><span class="eyebrow">%s</span><h1 class="display">%s</h1>'
            '<div class="page-hero-grid"><div><p class="lead">%s</p><p class="muted thema-bh">%s</p></div><div class="aside anchor-nav">%s</div></div></div></section>'
            '<section class="section tight" style="padding-top:0"><div class="wrap"><div class="section-head"><h2 class="h2">%s</h2><span class="muted small">%s</span></div>'
            '<div class="thema-liste">%s</div><p class="muted small thema-fuss">%s <a href="kontakt.html">%s</a></p></div></section></main>') % (
        E(L('Schwerpunkt', 'Focus')), E(titel), E(kern), E(bh_txt), andere,
        E(L('%d realisierte %s' % (len(ps), art), '%d completed %s' % (len(ps), art))), E(L('Angaben gemäss Projektdatenblättern von apb', 'Data from apb project data sheets')),
        ''.join(zeilen), E(L('Fragen zu einem Projekt oder eine eigene Aufgabe?', 'Questions about a project or a task of your own?')), E(L('Kontakt aufnehmen', 'Get in touch')))
    doc, n = re.subn(r'<main id="main">.*?</main>', lambda m: main, doc, count=1, flags=re.S)
    assert n == 1
    doc = re.sub(r'(<a[^>]*)aria-current="page"([^>]*>)', r'\1\2', doc)
    ld = {'@context': 'https://schema.org', '@graph': [
        brotkrumen(lang, [(b['index.html'], abs_url(lang, 'index.html')), (b['leistungen.html'], abs_url(lang, 'leistungen.html')), (kurz, abs_url(lang, th['fn']))]),
        {'@type': 'CollectionPage', '@id': abs_url(lang, th['fn']), 'name': titel, 'description': (kern + ' ' + bh_txt).strip(), 'inLanguage': 'de-CH' if de else 'en', 'about': {'@id': ORG},
         'mainEntity': {'@type': 'ItemList', 'numberOfItems': len(ps), 'itemListElement': [
             {'@type': 'ListItem', 'position': i + 1, 'url': abs_url(lang, p['url']), 'name': p['name'] + ', ' + p['ort']} for i, p in enumerate(ps)]}}]}
    doc = doc.replace('</head>', jsonld(ld) + '\n</head>', 1)
    open(os.path.join(R, 'en' if not de else '', th['fn']), 'w', encoding='utf-8').write(doc)
    return {'fn': th['fn'], 'titel': titel, 'kern': (kern + ' ' + bh_txt).strip(), 'ps': ps}

def schwerpunkte_einfuegen(lang):
    """Leistungen-Seite: Links auf die Themenseiten (für Besucher und Suchmaschinen)."""
    pfad = os.path.join(R, 'en' if lang == 'en' else '', 'leistungen.html')
    doc = open(pfad, encoding='utf-8').read()
    doc = re.sub(r'<section class="section tight" id="schwerpunkte">.*?</section>', '', doc, flags=re.S)
    de = lang == 'de'
    karten = ''.join('<a class="thema-k" href="%s"><b>%s</b><span>%s</span></a>' % (t['fn'], E(t[lang][0]), E(t[lang][2])) for t in THEMEN)
    sek = ('<section class="section tight" id="schwerpunkte"><div class="wrap"><div class="section-head"><h2 class="h2">%s</h2><span class="muted small">%s</span></div><div class="thema-ks">%s</div></div></section>') % (
        'Schwerpunkte' if de else 'Focus areas', 'Realisierte Projekte mit Fakten' if de else 'Completed projects with facts', karten)
    if '<section class="section stone" id="planung">' in doc: doc = doc.replace('<section class="section stone" id="planung">', sek + '<section class="section stone" id="planung">', 1)
    else: doc = doc.replace('</main>', sek + '</main>', 1)
    open(pfad, 'w', encoding='utf-8').write(doc)

def llms_txt(themen):
    """llms.txt: Kurzfassung der Website in Markdown für KI-Assistenten (Vorschlag llmstxt.org)."""
    D = DATEN['de']; ps = [p for p in D['projects'] if p.get('status') == 'Realisiert']
    z = ['# apb architekten ag', '',
         '> Architekturbüro in Uster (Kanton Zürich), gegründet 1996. Architektur, Planung, Bauleitung und Bauherrenberatung für Gemeinden, '
         'Genossenschaften und private Bauherrschaften – Schwerpunkte Schulbau, Wohnungsbau, öffentliche Bauten sowie Umbau und Sanierung, vor allem im Zürcher Oberland.', '',
         'Adresse: Seestrasse 110a, 8610 Uster · Telefon +41 44 944 60 80 · info@apb-architekten.ch · Inhaber: Pia Kiebel, Thomas Schinkhof · Mitglied SIA', '',
         '## Schwerpunkte', '']
    for t in themen:
        z.append('- [%s](%s): %s' % (t['titel'], abs_url('de', t['fn']), t['kern']))
    z += ['', '## Realisierte Projekte', '']
    for p in sorted(ps, key=lambda p: -(p.get('year') or 0)):
        teile = [str(p.get('year') or ''), p.get('sub', '')]
        for k in ('Verfahren', 'Bauherr', 'Kosten', 'Kosteneinhaltung', 'Auszeichnung'):
            if fakt(p, k): teile.append('%s: %s' % (k, fakt(p, k)))
        z.append('- [%s, %s](%s): %s' % (p['name'], p['ort'], abs_url('de', p['url']), ' · '.join(x for x in teile if x)))
    z += ['', '## Weitere Seiten', '',
          '- [Leistungen](%s): Planung, SIA-Phasen, Bauherrenberatung, Käuferbetreuung, Liegenschaftsanalyse' % abs_url('de', 'leistungen.html'),
          '- [Büro & Team](%s)' % abs_url('de', 'buero.html'), '- [30 Jahre apb](%s)' % abs_url('de', 'chronik.html'),
          '- [Kontakt](%s)' % abs_url('de', 'kontakt.html'), '- [English version](%s)' % abs_url('en', 'index.html'), '']
    open(os.path.join(R, 'llms.txt'), 'w', encoding='utf-8').write('\n'.join(z))

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
themen = []
for lang in ('de', 'en'):
    vorlage_l = open(os.path.join(R, 'en' if lang == 'en' else '', 'leistungen.html'), encoding='utf-8').read()
    for th in THEMEN:
        r = themenseite(lang, th, vorlage_l)
        if r and lang == 'de': themen.append(r)
    schwerpunkte_einfuegen(lang)
llms_txt(themen)
sitemap([(f, prio[f]) for f in SEITEN] + [(t['fn'], '0.8') for t in themen] + [(p['url'], '0.7' if p.get('sel') else '0.6') for p in DATEN['de']['projects']])
print('SEO:', len(DATEN['de']['projects']), 'Projektseiten je Sprache, sitemap.xml mit', 2 * (len(SEITEN) + len(DATEN['de']['projects'])), 'Adressen, Basis', BASE)
