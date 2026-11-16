import json, os, re, html
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(os.path.dirname(os.path.abspath(__file__)), '')
jobs = json.load(open(S + 'jobs.json'))

NAV = [('projekte.html', 'Projekte'), ('leistungen.html', 'Leistungen'), ('buero.html', 'Büro'), ('chronik.html', '30 Jahre'), ('karriere.html', 'Karriere')]
MARK_OLD = '''<svg width="126" height="65" viewBox="0 0 252 130" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">  <path pathLength="1" style="--i:1" d="M6 90.5 Q20 89 30 90.2 M28 90 Q30 86.5 32 88 M37 90 Q55 89.6 74 90.4 M79 90.2 L82 90"/>  <path pathLength="1" style="--i:2" d="M84 15.5 Q140 13.5 196 13"/>  <path pathLength="1" style="--i:3" d="M93 5 Q91.5 60 92.5 121"/>  <path pathLength="1" style="--i:4" d="M191 2 Q189 60 191.5 124"/>  <path pathLength="1" style="--i:5" d="M83 118.5 Q140 116 197 116.5 L198 125"/>  <path pathLength="1" style="--i:6" d="M95 21 Q108 33 121.5 47"/>  <path pathLength="1" style="--i:7" d="M188 18 Q181 32 174 45"/>  <path pathLength="1" style="--i:8" d="M120 48.5 Q148 47.6 176 48"/>  <path pathLength="1" style="--i:9" d="M121 46 Q119.5 75 121 104"/>  <path pathLength="1" style="--i:10" d="M172 42 Q171 77 173 112"/>  <path pathLength="1" style="--i:11" d="M99 110 Q110 101 120.5 94"/>  <path pathLength="1" style="--i:12" d="M176 101 Q184 109 192 118"/>  <path pathLength="1" style="--i:13" d="M129 88.5 Q139 88 148 88.3 M137 95.5 Q152 95 168 95.4"/>  <path pathLength="1" style="--i:14" d="M155.5 69 L155.8 78" stroke-width="6.5"/><path pathLength="1" style="--i:15" d="M155.5 79 Q154.8 93 155.8 107"/>  <path pathLength="1" style="--i:16" d="M196 88.5 Q220 88 243 89.5"/></svg>'''

def header(cur):
    links = ''.join(f'<a href="{h}"{" aria-current=page" if h == cur else ""}>{t}</a>' for h, t in NAV)
    mlinks = ''.join(f'<li><a href="{h}">{t}</a></li>' for h, t in NAV + [('kontakt.html', 'Kontakt')])
    return f'''<a class="skip" href="#main">Zum Inhalt springen</a>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="index.html" aria-label="apb architekten ag – Startseite"><img class="logo-img" src="assets/img/logo-light.png" alt="apb architekten ag" width="729" height="126"></a>
    <nav class="nav" aria-label="Hauptnavigation">{links}<a class="nav-cta" href="kontakt.html"{" aria-current=page" if cur == "kontakt.html" else ""}>Kontakt</a></nav>
    <button class="menu-btn" type="button" aria-label="Menü" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>
  </div>
</header>
<div class="menu" id="menu">
  <ol>{mlinks}</ol>
  <div class="menu-foot"><a href="tel:+41449446080">+41 44 944 60 80</a><a href="mailto:info@apb-architekten.ch">info@apb-architekten.ch</a><span>Seestrasse 110a, 8610 Uster</span></div>
</div>
'''

FOOTER = '''<footer class="site-footer">
  <div class="wrap">
    <div class="top">
      <p class="claim">Präzision.<br>Flexibilität.<br>Professionalität.</p>
      <div class="col"><h4>Atelier</h4>apb architekten ag<br>Seestrasse 110a<br>8610 Uster</div>
      <div class="col"><h4>Kontakt</h4><a href="tel:+41449446080">+41 (0)44 944 60 80</a><br>Fax +41 (0)44 944 60 81<br><a href="mailto:info@apb-architekten.ch">info@apb-architekten.ch</a></div>
      <div class="col"><h4>Navigation</h4><a href="projekte.html">Projekte</a><br><a href="leistungen.html">Leistungen</a><br><a href="buero.html">Büro &amp; Team</a><br><a href="karriere.html">Karriere</a><br><a href="kontakt.html">Kontakt</a></div>
    </div>
    <div class="giant" aria-hidden="true"><img src="assets/img/logo-light.png" alt="" width="729" height="126" loading="lazy"></div>
    <div class="bottom"><span>© <span data-year>2026</span> apb architekten ag · Mitglied SIA · MINERGIE®-Fachpartner</span><span><a href="impressum.html">Impressum &amp; Datenschutz</a></span></div>
  </div>
</footer>
'''

_paths = re.findall(r'd="([^"]+)"', open(os.path.join(OUT,'assets/img/logo-mark.svg')).read())
def mark(mid):
    ps = ''.join(f'<path pathLength="1" style="--i:{i+1}" d="{d}"/>' for i, d in enumerate(_paths))
    return (f'<svg width="126" height="68" viewBox="0 0 252 135" aria-hidden="true"><defs><mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="252" height="135">'
            f'<g fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round">{ps}</g></mask></defs>'
            f'<image href="assets/img/logo-mark-light.png" width="252" height="135" mask="url(#{mid})"/></svg>')
MARK = mark('mk-pt')

INTRO_HEAD = "<script>try{if(!sessionStorage.getItem('apb-intro')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('intro')}catch(e){}</script>"
INTRO = '<div class="intro-ov" role="presentation" hidden><div class="intro-inner"><div class="intro-logo"><img class="intro-png" src="assets/img/logo-light.png" alt="" width="729" height="126"><div class="intro-mark">' + mark('mk-intro') + '</div></div><div class="intro-year"><b>1996</b> &nbsp;—&nbsp; 2026</div></div><button type="button" class="intro-skip">Überspringen</button></div>\n'

import hashlib
def V(path):
    return path + '?v=' + hashlib.md5(open(os.path.join(OUT, path), 'rb').read()).hexdigest()[:8]

def page(fn, cur, title, desc, body, pg, dark=False, leaflet=False, extra_head='', intro=False):
    lf = '<link rel="stylesheet" href="assets/vendor/leaflet/leaflet.css">' if leaflet else ''
    ls = '<script src="assets/vendor/leaflet/leaflet.js" defer></script>' if leaflet else ''
    doc = f'''<!doctype html>
<html lang="de-CH">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="theme-color" content="#0c0c0b">
<meta name="color-scheme" content="dark">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="assets/img/projects/319-sag/01.jpg">
<link rel="icon" href="assets/img/favicon.png" type="image/png">
<link rel="preload" href="assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
{lf}
<link rel="stylesheet" href="{V('assets/css/style.css')}">
{extra_head}
<script>try{{if(sessionStorage.getItem('apb-pt')){{document.documentElement.classList.add('pt-in');sessionStorage.removeItem('apb-pt')}}{'' if not intro else ''}}}catch(e){{}}</script>
{INTRO_HEAD if intro else ''}
</head>
<body data-page="{pg}"{' class="on-dark"' if dark else ''}>
{INTRO if intro else ''}<div class="pt" aria-hidden="true" hidden><div class="pt-mark">{MARK}</div></div>
{header(cur)}
<main id="main">
{body}
</main>
{FOOTER}
{ls}
<script src="{V('assets/js/data.js')}" defer></script>
<script src="{V('assets/js/main.js')}" defer></script>
<script src="{V('assets/js/experience.js')}" defer></script>
</body>
</html>
'''
    open(os.path.join(OUT, fn), 'w').write(doc)

def cta(title, label='Kontakt aufnehmen', stone=False):
    return f'''<section class="section{' stone' if stone else ''}">
  <div class="wrap cta">
    <h2 class="display" data-split>{title}</h2>
    <div class="cta-act rv">
      <a class="big-link" href="tel:+41449446080">+41 (0)44 944 60 80</a>
      <a class="big-link" href="mailto:info@apb-architekten.ch">info@apb-architekten.ch</a>
      <a class="btn" href="kontakt.html" style="margin-top:14px">{label}<span class="arr"></span></a>
    </div>
  </div>
</section>'''

ticks = lambda items: '<ul class="ticks">' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'

# ---------------------------------------------------------------- HOME
home = f'''
<section class="hero" data-slides="251-asch,319-sag,308-mzu,310-gws,313-gbw,320-ksp" aria-roledescription="Karussell" aria-label="Ausgewählte Projekte">
  <div class="hero-stage"></div>
  <div class="hero-content">
    <div class="wrap">
      <div class="hero-title" aria-live="polite"></div>
      <div class="hero-side">
        <span class="hero-count"></span>
        <div class="hero-ctrl"><button type="button" class="prev" aria-label="Vorheriges Projekt"><span class="arr"></span></button><button type="button" class="next" aria-label="Nächstes Projekt"><span class="arr"></span></button></div>
      </div>
    </div>
    <div class="wrap"><div class="hero-bars"></div></div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <span class="eyebrow rv">apb architekten ag · Uster · seit 1996</span>
    <p class="statement" style="margin-top:32px">Wir sind ein Dienstleistungs&shy;unternehmen für Architektur und Bau&shy;management – und verstehen unsere Tätigkeit als integralen, interdisziplinären Prozess auf der Suche nach der architektonisch anspruchsvollen und funktional sinnvollen Lösung.</p>
    <div class="stats">
      <div class="stat rv"><div class="num" data-count="1996">1996</div><p>gegründet von Peter Brader, seit 2011 im Besitz von Pia Kiebel und Thomas Schinkhof</p></div>
      <div class="stat rv" style="--d:.08s"><div class="num"><span data-count="100">100</span><small>+</small></div><p>realisierte Projekte aus dem öffentlichen und privaten Sektor</p></div>
      <div class="stat rv" style="--d:.16s"><div class="num"><span data-count="200">200</span><small>Mio. Fr.</small></div><p>geplante und beaufsichtigte Handwerkerleistungen</p></div>
      <div class="stat rv" style="--d:.24s"><div class="num"><span data-count="10">10</span><small>+</small></div><p>Schulhaus- und Kindergartenprojekte</p></div>
    </div>
  </div>
</section>


<section class="section dark" id="jubilaeum">
  <div class="wrap">
    <div class="jubi">
      <div class="jubi-num" aria-hidden="true">30</div>
      <div class="jubi-txt">
        <span class="eyebrow rv">1996 – 2026</span>
        <h2 class="h1" data-split style="margin-top:18px">30 Jahre<br>apb architekten</h2>
        <p class="rv">Von der Gründung in Uster bis zum ersten Kinderhospiz der Schweiz: drei Jahrzehnte Architektur im Zürcher Oberland und darüber hinaus.</p>
        <div class="rv" style="margin-top:28px"><a class="btn light" href="chronik.html">Zur Chronik<span class="arr"></span></a></div>
      </div>
    </div>
    <div class="bars" id="jubi-bars">
      <div class="bars-row"></div>
      <div class="bars-axis"><span>1996</span><span>2006</span><span>2016</span><span>2026</span></div>
      <div class="bars-legend"><span><i></i>Fertiggestellte Projekte pro Jahr</span><span><i class="r"></i>Meilenstein</span></div>
      <div class="bars-tip" aria-hidden="true"></div>
    </div>
  </div>
</section>
<section class="section tight" style="padding-top:0">
  <div class="wrap section-head">
    <div><span class="eyebrow rv">Projektauswahl</span><h2 class="h1" data-split style="margin-top:18px">Ausgewählte<br>Arbeiten</h2></div>
    <a class="link rv" href="projekte.html">Alle 39 Projekte<span class="arr"></span></a>
  </div>
  <div class="rail">
    <div class="rail-track" id="rail"></div>
    <div class="wrap rail-foot"><div class="rail-progress"><i></i></div><div class="rail-btns"><button type="button" class="round prev" aria-label="Zurück"><span class="arr"></span></button><button type="button" class="round next" aria-label="Weiter"><span class="arr"></span></button></div></div>
  </div>
</section>

<section class="section stone">
  <div class="wrap">
    <div class="section-head"><div><span class="eyebrow rv">Themen</span><h2 class="h1" data-split style="margin-top:18px">Wohnen, lernen,<br>glauben, reisen.</h2></div>
    <p class="muted rv" style="max-width:24em">Vom Terrassenhaus bis zur S-Bahnstation: Unsere Projekte nach Nutzung – fahren Sie über ein Thema.</p></div>
    <div class="themes">
      <nav class="themes-list rv" aria-label="Projekte nach Thema"></nav>
      <figure class="themes-view" style="margin:0" aria-hidden="true"></figure>
    </div>
  </div>
</section>

<section class="section dark">
  <div class="wrap">
    <div class="section-head"><div><span class="eyebrow rv">Leistungen</span><h2 class="h1" data-split style="margin-top:18px">Von der ersten Idee<br>bis zur Schlüsselübergabe.</h2></div></div>
    <div class="services">
      <div class="service rv"><span class="n">01</span><h3>Architektur</h3><p>Neubauten, Umbauten und Erweiterungen – für Wohnen, Bildung, Verwaltung, Pflege und die SBB.</p>
        <ul><li>Wohngebäude bis 50 Wohneinheiten</li><li>Schulen, Gemeinde- &amp; Kirchgemeindehäuser</li><li>Denkmalschutz-Objekte</li><li>MINERGIE und MINERGIE-P</li></ul>
        <a class="link" href="projekte.html">Projekte ansehen<span class="arr"></span></a></div>
      <div class="service rv" style="--d:.1s"><span class="n">02</span><h3>Planung</h3><p>Termin- und budgetgerechte Realisierung nach dem Leistungsmodell SIA 112 – nichts wird dem Zufall überlassen.</p>
        <ul><li>Strategische Planung &amp; Vorstudien</li><li>Projektierung &amp; Bewilligung</li><li>Ausschreibung &amp; Vergabe</li><li>Bauleitung &amp; Kostenkontrolle</li></ul>
        <a class="link" href="leistungen.html#planung">Zur Planung<span class="arr"></span></a></div>
      <div class="service rv" style="--d:.2s"><span class="n">03</span><h3>Beratung</h3><p>Fachkenntnis aus über 100 Projekten – für Bauherren, Investoren und Käufer von Stockwerkeigentum.</p>
        <ul><li>Bauherrenberatung</li><li>Käuferbetreuung</li><li>Liegenschaftsanalyse</li><li>Machbarkeitsstudien</li></ul>
        <a class="link" href="leistungen.html#beratung">Zur Beratung<span class="arr"></span></a></div>
    </div>
  </div>
</section>

<section class="section tight">
  <div class="wrap section-head"><div><span class="eyebrow rv">Im Kanton Zürich verwurzelt</span><h2 class="h1" data-split style="margin-top:18px">Projekte<br>auf der Karte</h2></div>
    <a class="link rv" href="projekte.html#ansicht=karte">Zur Kartenansicht<span class="arr"></span></a></div>
  <div class="wrap"><div class="map rv" id="home-map" aria-label="Karte der Projekte"><div class="map-legend"><span><i></i>Projekt</span><span><i class="o"></i>Atelier Uster</span></div></div></div>
</section>

<section class="section stone">
  <div class="wrap two-col" style="align-items:end">
    <div class="l"><div class="media rv-img" style="aspect-ratio:4/3"><img src="assets/img/atelier.jpg" alt="Atelier im Turicum-Gebäude in Uster" loading="lazy"></div></div>
    <div class="r">
      <span class="eyebrow rv">Karriere</span>
      <h2 class="h2" data-split style="margin-top:18px">Ambition.<br>Profession.<br>Begeisterung.</h2>
      <p class="rv" style="margin-top:24px;max-width:30em;color:var(--ink-2)">Wir suchen kontinuierlich Menschen, die sich genauso wie wir für Architektur und Baumanagement begeistern – in einem loftartigen Studio nahe dem Naturschutzgebiet Greifensee.</p>
      <div class="rv" style="margin-top:32px;display:flex;gap:12px;flex-wrap:wrap"><a class="btn" href="karriere.html">Stellen &amp; Lehrstelle<span class="arr"></span></a><a class="btn ghost" href="buero.html#team">Das Team</a></div>
    </div>
  </div>
</section>
''' + cta('Wir freuen uns<br>auf Ihr Projekt.')

page('index.html', '', 'apb architekten ag – Architektur, Planung und Beratung in Uster', 'apb architekten ag in Uster: Architektur, Planung, Bauleitung und Beratung für private und öffentliche Bauherren im Kanton Zürich – seit 1996.', home, 'home', dark=True, leaflet=True, intro=True)

# ---------------------------------------------------------------- PROJEKTE
icons = {
 'raster': '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="6" height="6"/><rect x="9" y="1" width="6" height="6"/><rect x="1" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/></svg>',
 'liste': '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="2" width="14" height="1.6"/><rect x="1" y="7.2" width="14" height="1.6"/><rect x="1" y="12.4" width="14" height="1.6"/></svg>',
 'karte': '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 15s5-4.6 5-8.5A5 5 0 0 0 3 6.5C3 10.4 8 15 8 15z"/><circle cx="8" cy="6.5" r="1.8"/></svg>',
 'zeitachse': '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="12" width="14" height="1.6"/><rect x="2" y="7" width="3" height="4"/><rect x="6.5" y="3" width="3" height="8"/><rect x="11" y="5" width="3" height="6"/></svg>'}
vbtns = ''.join(f'<button type="button" data-view="{k}" aria-pressed="false">{v}<span>{k.capitalize()}</span></button>' for k, v in icons.items())
proj = f'''
<section class="page-hero" style="padding-bottom:clamp(40px,5vw,72px)">
  <div class="wrap">
    <span class="eyebrow">Architektur</span>
    <h1 class="display" data-split>Projekte</h1>
    <div class="page-hero-grid">
      <p class="lead rv">Mehr als 100 realisierte Bauten seit 1996 – vom denkmalgeschützten Bahnhof bis zum ersten Kinderhospiz der Schweiz. Filtern Sie nach Thema, suchen Sie nach Ort oder Bauherr, oder entdecken Sie unsere Arbeiten auf Karte und Zeitachse.</p>
      <div class="aside rv"><a class="link" href="projekt.html?p=wettbewerbe">Wettbewerbe &amp; Auswahlverfahren<span class="arr"></span></a></div>
    </div>
  </div>
</section>
<div class="toolbar">
  <div class="wrap">
    <div class="chips" id="chips" role="group" aria-label="Nach Thema filtern"></div>
    <div class="tools-right">
      <label class="search"><span class="sr-only">Projekte durchsuchen</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="7" cy="7" r="5"/><path d="M11 11l4 4"/></svg><input id="q" type="search" placeholder="Ort, Bauherr, Stichwort …" autocomplete="off"></label>
      <div class="views" role="group" aria-label="Ansicht">{vbtns}</div>
    </div>
  </div>
</div>
<div class="wrap">
  <div class="result-line"><span id="count" aria-live="polite"></span><span class="small">Klicken für Details</span></div>
  <div id="v-raster"><div class="pgrid" id="pgrid"></div></div>
  <div id="v-liste" hidden>
    <table class="plist" id="plist">
      <thead><tr><th class="nr"><button type="button" data-sort="nr">Nr.</button></th><th><button type="button" data-sort="name">Projekt</button></th><th><button type="button" data-sort="ort">Ort</button></th><th class="cat">Thema</th><th class="st"><button type="button" data-sort="status">Status</button></th><th class="yr"><button type="button" data-sort="year">Jahr</button></th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
  <div id="v-karte" hidden><div class="map" id="pmap" aria-label="Projektkarte"><div class="map-legend"><span><i></i>Projekt</span><span><i class="o"></i>Atelier Uster</span></div></div></div>
  <div id="v-zeitachse" hidden>
    <div class="tl-wrap" style="margin:0 calc(-1 * var(--pad))"><div class="timeline" id="timeline"><div class="tl-inner"></div></div></div>
    <div class="tl-open" id="tl-open" hidden><h3 class="h3">Ohne Fertigstellungsjahr</h3><div class="pgrid"></div></div>
  </div>
  <p class="empty">Keine Projekte gefunden. <button type="button" class="link" onclick="document.getElementById('q').value='';document.getElementById('q').dispatchEvent(new Event('input'));document.querySelector('.chip').click()">Filter zurücksetzen</button></p>
  <div style="height:clamp(80px,10vw,160px)"></div>
</div>
<div class="hover-preview" aria-hidden="true"><img alt=""></div>
'''
page('projekte.html', 'projekte.html', 'Projekte – apb architekten ag', 'Projekte von apb architekten ag: Wohnbauten, Schulen, Gemeindehäuser, Kirchgemeindehäuser, Pflegezentren und SBB-Bahnhöfe im Kanton Zürich.', proj, 'projekte', leaflet=True)

# ---------------------------------------------------------------- PROJEKT
page('projekt.html', 'projekte.html', 'Projekt – apb architekten ag', 'Projekt von apb architekten ag, Uster.',
     '<div id="project"><noscript><div class="wrap page-hero"><p>Bitte aktivieren Sie JavaScript, um die Projektdetails zu sehen.</p></div></noscript></div>',
     'projekt', dark=True, leaflet=True)

# ---------------------------------------------------------------- LEISTUNGEN
leist = f'''
<section class="page-hero">
  <div class="wrap">
    <span class="eyebrow">Leistungen</span>
    <h1 class="display" data-split>Planen.<br>Bauen. Beraten.</h1>
    <div class="page-hero-grid">
      <p class="lead rv">Ob Neubau oder Umbau, ob Modernisierung oder Sanierung: Entscheidend für die termin- und budgetgerechte Realisierung eines architektonischen Vorhabens ist dessen sorgfältige Planung. Aus diesem Grund überlassen wir von apb architekten nichts dem Zufall.</p>
      <div class="aside rv anchor-nav"><a class="chip" href="#planung">Planung</a><a class="chip" href="#sia-112">SIA 112</a><a class="chip" href="#beratung">Bauherrenberatung</a><a class="chip" href="#kaeufer">Käuferbetreuung</a><a class="chip" href="#liegenschaft">Liegenschaftsanalyse</a></div>
    </div>
  </div>
</section>

<section class="section stone" id="planung">
  <div class="wrap two-col">
    <div class="l"><span class="eyebrow rv">Planung</span><h2 class="h1" data-split style="margin-top:18px">Alles.<br>Perfekt.<br>Bedacht.</h2></div>
    <div class="r prose rv">
      <h3 class="h3" style="margin-bottom:16px">Firmenphilosophie</h3>
      <p class="lead">Wir sind ein Dienstleistungsunternehmen im Bereich der Architektur und des Baumanagements und verstehen unsere Tätigkeit als integralen und interdisziplinären Prozess aller Beteiligten auf der Suche nach einer architektonisch anspruchsvollen und funktional sinnvollen Lösung.</p>
      <p style="margin-top:20px">Unser Auftrag ist es, Sie zu begeistern, indem wir aus der Vielfalt der Möglichkeiten zur bestmöglichen Lösung finden.</p>
    </div>
  </div>
  <div class="wrap" style="margin-top:clamp(64px,8vw,120px)">
    <h3 class="eyebrow rv" style="margin-bottom:24px">Was uns auszeichnet</h3>
    <div class="values">
      <div class="value rv"><span class="n">01</span><p>Vorausschauendes und ganzheitliches Denken</p></div>
      <div class="value rv" style="--d:.08s"><span class="n">02</span><p>Konstruktives und kritisches Hinterfragen</p></div>
      <div class="value rv" style="--d:.16s"><span class="n">03</span><p>Engagiertes und verantwortungsbewusstes Handeln</p></div>
      <div class="value rv" style="--d:.24s"><span class="n">04</span><p>Präzision, Flexibilität und Professionalität während des gesamten Projektbearbeitungszeitraumes</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="two-col">
      <div class="l"><span class="eyebrow rv">Highlights</span><h2 class="h2" data-split style="margin-top:18px">Über 100 Projekte.<br>Rund 200 Mio. Fr.</h2>
        <p class="rv" style="margin-top:24px;color:var(--ink-2);max-width:28em">Seit der Gründung im Jahr 1996 hat das Team von apb architekten mehr als 100 Projekte aus dem öffentlichen und privaten Sektor realisiert. Dabei wurden Handwerkerleistungen von ca. 200 Millionen Franken geplant und beaufsichtigt.</p></div>
      <div class="r rv">
        <div data-tabs>
          <div class="tabs" role="tablist" aria-label="Bauherren">
            <button type="button" role="tab" id="t-pr" aria-controls="p-pr">Private Bauherren &amp; Investoren</button>
            <button type="button" role="tab" id="t-oe" aria-controls="p-oe">Öffentliche Bauherren</button>
          </div>
          <div class="tab-panel" id="p-pr" role="tabpanel" aria-labelledby="t-pr">{ticks(["Bau von hochwertigen Einfamilienhäusern und Stadtvillen","Realisierung von Mehrfamilienhäusern mit bis zu 50 Wohneinheiten","Planung, Bauleitung, Käuferbetreuung aus einer Hand","Kenntnis regionaler Gegebenheiten und Bauhandwerksfirmen"])}</div>
          <div class="tab-panel" id="p-oe" role="tabpanel" aria-labelledby="t-oe">{ticks(["Versiert in der Planung und Bau von öffentlichen Projekten von 5 bis 20 Mio. Fr.","Erfahrung aus zahlreichen Gemeinde- oder Kirchgemeindehausprojekten","Erfahrung aus mehr als 10 Schulhaus- und Kindergartenprojekten","Hervorragende Referenzauskünfte zur Einhaltung von Kosten- und Terminvorgaben"])}</div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section dark" id="sia-112">
  <div class="wrap">
    <div class="two-col">
      <div class="l"><span class="eyebrow rv">Leistungsmodell</span><h2 class="h1" data-split style="margin-top:18px">SIA-Norm<br>112</h2></div>
      <div class="r prose rv"><p style="color:rgba(255,255,255,.75)">Getreu unserem Leitbild «Präzision. Flexibilität. Professionalität.» planen und handeln wir im ökonomisch und ökologisch nachhaltigen Sinne, um die Wünsche unserer Bauherren zielgerichtet, fachkompetent sowie termin- und kostengerecht umzusetzen. Als eingetragenes Firmenmitglied im Schweizerischen Ingenieur- und Architektenverein (SIA) arbeiten wir dabei nach dem Leistungsmodell SIA-Norm 112.</p></div>
    </div>
    <div class="sia" id="sia">
      <div class="sia-groups" aria-hidden="true"><span>1–2 Strategie &amp; Vorstudien</span><span>3 Projektierung</span><span>4 Ausschreibung</span><span>5 Realisierung</span></div>
      <div class="sia-bar" role="tablist" aria-label="SIA-Phasen"></div>
      <div class="sia-detail" aria-live="polite"></div>
      <div class="sia-ctrl"><button type="button" class="round sia-prev" style="box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.3)" aria-label="Vorherige Phase"><span class="arr" style="transform:scaleX(-1)"></span></button><button type="button" class="round sia-next" style="box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.3)" aria-label="Nächste Phase"><span class="arr"></span></button></div>
    </div>
  </div>
</section>

<section class="section" id="beratung">
  <div class="wrap two-col">
    <div class="l"><span class="eyebrow rv">Beratung</span><h2 class="h1" data-split style="margin-top:18px">Allumfassend.<br>Professionell.<br>Beraten.</h2></div>
    <div class="r prose rv"><p class="lead">Mit mehr als 100 erfolgreich realisierten Projekten aus dem öffentlichen und privaten Sektor verfügen wir über die erforderliche Fachkenntnis bei der Durchführung von Projekten sowie Erfahrung bei der Bewertung von Liegenschaften. Und davon profitieren sowohl Bauherren als auch potenzielle Käufer.</p></div>
  </div>
  <div class="wrap" style="margin-top:clamp(56px,7vw,110px)">
    <div class="acc" data-single>
      <div class="acc-item open" id="bauherren">
        <button type="button" class="acc-btn" aria-expanded="true"><span class="t">Bauherrenberatung<small>Massgeschneiderte Leistungen für öffentliche und private Auftraggeber</small></span><span class="pm" aria-hidden="true"></span></button>
        <div class="acc-panel"><div><div class="acc-inner">
          <div class="a"><p style="color:var(--ink-2);margin-bottom:28px;max-width:34em">Die Interessen und Anforderungen öffentlicher Auftraggeber unterscheiden sich von denen der privaten Bauherren und Investoren. apb architekten bietet beiden Gruppen massgeschneiderte Leistungen.</p>
            <div data-tabs><div class="tabs" role="tablist" aria-label="Bauherrenberatung"><button type="button" role="tab" id="tb-oe" aria-controls="pb-oe">Öffentliche Bauherren</button><button type="button" role="tab" id="tb-pr" aria-controls="pb-pr">Private Bauherren</button></div>
              <div class="tab-panel" id="pb-oe" role="tabpanel" aria-labelledby="tb-oe">{ticks(["Erstellung von Studienaufträgen und Kostenschätzungen für öffentliche Bauvorhaben","Beratung betreffend der baugesetzlichen Vorgaben","Erarbeiten von Projektablaufplänen","Erstellung von Projektierungs- und Baukreditgenehmigungs-Dossiers","Erstellen von Ausschreibungsunterlagen für allfällige weitere Planerwahlverfahren","Bewertung und Auswahl der Bewerber"])}</div>
              <div class="tab-panel" id="pb-pr" role="tabpanel" aria-labelledby="tb-pr">{ticks(["Hilfe bei der Suche geeigneter Grundstücke","Machbarkeitsstudien für Neubauten und Umbauten bestehender Liegenschaften","Analysen zum Gebäudezustand und Beratung zu energetischen Förderungen","Beratung betreffend der baugesetzlichen Vorgaben","Kostenschätzungen"])}</div></div></div>
          <div class="b"><div class="media" style="aspect-ratio:4/5"><img src="assets/img/projects/306-gzm/01-s.jpg" alt="Gemeindehaus Maur" loading="lazy"></div><p class="small muted" style="margin-top:10px">Gemeindehaus Maur – Planerwahl, 1. Rang</p></div>
        </div></div></div>
      </div>
      <div class="acc-item" id="kaeufer">
        <button type="button" class="acc-btn" aria-expanded="false"><span class="t">Käuferbetreuung<small>Schritt für Schritt begleitet – im Stockwerkeigentum</small></span><span class="pm" aria-hidden="true"></span></button>
        <div class="acc-panel"><div><div class="acc-inner">
          <div class="a"><p style="color:var(--ink-2);margin-bottom:28px;max-width:34em">Bauträger, die Projekte mit Stockwerkeigentum verkaufen möchten, delegieren in der Regel die Käuferbetreuung an den Architekten des Gebäudes. apb architekten bietet an, die potentiellen Käufer Schritt für Schritt für Sie zu begleiten.</p>
            <h3 class="eyebrow plain" style="margin-bottom:14px">Interessenten- &amp; Käufer-Betreuung</h3>
            <ol class="process" style="border-color:var(--ink)">{''.join(f'<li style="border-color:var(--line)">{x}</li>' for x in ["Besprechung von Käuferwünschen","Überprüfung der Machbarkeit","Beratung bei der Farb- und Materialwahl","Begleitung von Ausstellungsbesuchen","Ermittlung der Mehr- und/oder Minderkosten","Koordination mit Behörden, Fachplanern, Unternehmern und weiteren am Bau Beteiligten","Kontrolle der Bauausführung","Begleitung der Bauabnahme"])}</ol></div>
          <div class="b"><div class="media" style="aspect-ratio:4/5"><img src="assets/img/projects/292-mlw/01-s.jpg" alt="MFH Lediweg, Uster" loading="lazy"></div><p class="small muted" style="margin-top:10px">MFH Lediweg, Uster – 7 Eigentumswohnungen</p></div>
        </div></div></div>
      </div>
      <div class="acc-item" id="liegenschaft">
        <button type="button" class="acc-btn" aria-expanded="false"><span class="t">Liegenschaftsanalyse<small>Die Grundlage für langfristige Planungen und aktuelle Bauvorhaben</small></span><span class="pm" aria-hidden="true"></span></button>
        <div class="acc-panel"><div><div class="acc-inner">
          <div class="a"><p style="color:var(--ink-2);margin-bottom:28px;max-width:34em">Die Bestandsanalyse einer Liegenschaft bildet die Grundlage für langfristige Planungen und aktuelle Bauvorhaben. apb architekten bietet Ihnen an, alle erforderlichen Schritte rund um die Analyse Ihrer Liegenschaft für Sie durchzuführen.</p>
            <div data-tabs><div class="tabs" role="tablist" aria-label="Liegenschaftsanalyse"><button type="button" role="tab" id="tl-g" aria-controls="pl-g">Grundlagen</button><button type="button" role="tab" id="tl-z" aria-controls="pl-z">Zustandsanalyse</button></div>
              <div class="tab-panel" id="pl-g" role="tabpanel" aria-labelledby="tl-g">{ticks(["Bestandspläne (Grundrisse, Schnitte, Fassaden)","Grundbuchauszug","Letzte Schätzung der kantonalen Gebäudeversicherung"])}</div>
              <div class="tab-panel" id="pl-z" role="tabpanel" aria-labelledby="tl-z">{ticks(["Begehung vor Ort","Massaufnahmen vor Ort (sofern keine Bestandspläne vorhanden sind)","Übertragen und Darstellen von Plänen in CAD-System","Dokumentation und Einschätzung des Gebäudezustandes anhand von Einzelbauteilen","Einschätzung der kurz-, mittel- und langfristigen Massnahmen inkl. Abschätzen der nötigen Budgets","Massnahmenbericht","Koordination weitergehender Zustandsanalysen (Erdbebensicherheit, Schadstoffe, Bauphysik etc.)"])}</div></div></div>
          <div class="b"><div class="media" style="aspect-ratio:4/5"><img src="assets/img/projects/309-mpg/01-s.jpg" alt="MFH Pfisterhölzli, Greifensee" loading="lazy"></div><p class="small muted" style="margin-top:10px">MFH Pfisterhölzli, Greifensee – Fassadensanierung mit Photovoltaik</p></div>
        </div></div></div>
      </div>
    </div>
  </div>
</section>
''' + cta('Beratungstermin<br>vereinbaren.', 'Termin anfragen', stone=True)
page('leistungen.html', 'leistungen.html', 'Leistungen: Planung & Beratung – apb architekten ag', 'Planung nach SIA 112, Bauleitung, Bauherrenberatung, Käuferbetreuung und Liegenschaftsanalyse – apb architekten ag, Uster.', leist, 'leistungen')

# ---------------------------------------------------------------- BÜRO
team = [('pia-kiebel','Pia Kiebel','Dipl. Architektin TH SIA REG. A','Inhaberin – Planung, Bauleitung'),
('thomas-schinkhof','Thomas Schinkhof','Dipl. Architekt TH SIA REG. A','Inhaber – Planung, Bauleitung'),
('andrea-abegg','Andrea Abegg','Dipl. Architektin FH','Planung'),
('maike-brasse','Maike Brasse','Dipl. Architektin TH','Planung, Bauleitung'),
('daniel-dammann','Daniel Dammann','Hochbauzeichner','Planung, Bauleitung'),
('laura-keller','Laura Keller','Lernende Zeichnerin Architektur','Planung'),
('dominik-mettler','Dominik Mettler','Bachelor of Arts in Architektur','Planung'),
('claudia-wintsch','Claudia Wintsch','Dipl. Architektin FH','Planung')]
tm = ''.join(f'<article class="member rv" style="--d:{(i%4)*.06:.2f}s"><div class="media"><img src="assets/img/team/{s}.jpg" alt="Portrait {n}" loading="lazy" width="640" height="640"></div><h3>{n}</h3><p>{a}<br>{b}</p></article>' for i,(s,n,a,b) in enumerate(team))
tm += '<a class="member join rv" href="karriere.html" data-cursor="Bewerben"><div class="media"><span>Hier könnte<br>Ihr Name<br>stehen …</span></div><h3>Sie?</h3><p>Initiativbewerbungen sind jederzeit willkommen</p></a>'
buero = f'''
<section class="page-hero">
  <div class="wrap">
    <span class="eyebrow">Büro</span>
    <h1 class="display" data-split>Architekten.<br>Planer.<br>Bauleiter.</h1>
    <div class="page-hero-grid">
      <p class="lead rv">Bei apb architekten arbeitet ein jahrelang eingespieltes Team aus Architekten, Bauleitern und Zeichnern. Auf Basis unserer komplementären Kompetenzen und gemeinsam mit unseren Auftraggebern realisieren wir innovative Architekturlösungen, die durch Qualität, Funktionalität, Wirtschaftlichkeit und Nachhaltigkeit überzeugen.</p>
      <div class="aside rv anchor-nav"><a class="chip" href="#profil">Firmenprofil</a><a class="chip" href="#atelier">Atelier</a><a class="chip" href="#team">Team</a></div>
    </div>
  </div>
</section>

<section class="section stone" id="profil">
  <div class="wrap">
    <div class="section-head"><h2 class="h1" data-split>Firmenprofil</h2></div>
    <div class="history">
      <div class="rv"><div class="y">1996</div><p>apb architekten ag wird von Peter Brader gegründet.</p></div>
      <div class="rv" style="--d:.1s"><div class="y">2011</div><p>Durch Management-Buy-out vollständig an Pia Kiebel und Thomas Schinkhof übertragen.</p></div>
      <div class="rv" style="--d:.2s"><div class="y">Heute</div><p>Unser Büro gehört zu den ersten Adressen, wenn moderne Architektur und zuverlässiges Baumanagement gefragt sind.</p></div>
    </div>
    <div class="facts-grid" style="margin-top:clamp(64px,8vw,120px)">
      <div class="rv"><h3>Haupttätigkeitsbereiche</h3><ul><li>Architektur</li><li>Bauleitung / Baumanagement</li></ul></div>
      <div class="rv" style="--d:.06s"><h3>Kernkompetenzen</h3><ul><li>Beratung, Projektierung und Realisierung von Neubauten und Erweiterungen</li><li>Denkmalschutz-Objekte</li><li>MINERGIE- und MINERGIE-P-Gebäude</li><li>Gesamtleitung von Generalplanerteams</li></ul></div>
      <div class="rv" style="--d:.12s"><h3>Bauten</h3><ul><li><a href="projekte.html#thema=wohnen">Wohngebäude</a></li><li><a href="projekte.html#thema=lernen">Öffentliche Gebäude</a> (Schulen, Gemeindehäuser, Pflege- und Alterszentren)</li><li><a href="projekte.html#thema=reisen">Bauten der SBB</a> (Regionalbahnhöfe und Convenience-Shops)</li></ul></div>
      <div class="rv" style="--d:.18s"><h3>Mitgliedschaften</h3><ul>
        <li><a href="https://www.sia.ch/de/directory/member/73b232f9d3a4f1989a96beb27e08a3bd" target="_blank" rel="noopener">SIA – Schweizerischer Ingenieur- und Architektenverein ↗</a></li>
        <li>REG A – Register der Fachleute im Bereich Architektur</li>
        <li><a href="https://www.minergie.ch/de/partner/fachpartner-und-memberliste-details/?id=107354" target="_blank" rel="noopener">MINERGIE® – Fachpartner ↗</a></li>
        <li>Forum Energie Zürich</li><li>AFZO – Architekturforum Zürcher Oberland</li><li>AFZH – Architekturforum Zürich</li></ul></div>
    </div>
  </div>
</section>

<section class="section" id="atelier">
  <div class="wrap atelier">
    <div class="media rv-img"><img src="assets/img/atelier.jpg" alt="Atelier von apb architekten im Turicum-Gebäude, Uster" loading="lazy"></div>
    <div class="txt">
      <span class="eyebrow rv">Atelier</span>
      <h2 class="h2" data-split style="margin-top:18px">Turicum-Gebäude,<br>Uster</h2>
      <p class="rv" style="margin-top:20px;color:var(--ink-2)">Unser Atelier befindet sich im historischen «Turicum-Gebäude» an der Seestrasse 110a in Uster, wo wir sorgfältig und speditiv grosse Projekte für private und öffentliche Bauträger in die Tat umsetzen.</p>
      <div class="rv"><h3 class="eyebrow plain" style="margin-top:32px">Facts &amp; Figures</h3>{ticks(["Moderne Arbeitsplatz-Ausstattung auf Mac-Hardware-Basis","ArchiCAD mit BIM-Server-Technologie","Grossformat-Plotter und Scanner","3D-Drucker für Architekturmodellbau"])}</div>
    </div>
  </div>
</section>

<section class="section stone" id="team">
  <div class="wrap">
    <div class="section-head"><div><span class="eyebrow rv">Team</span><h2 class="h1" data-split style="margin-top:18px">Die Menschen<br>hinter apb.</h2></div>
      <p class="muted rv" style="max-width:26em">Unser Team setzt sich aus Spezialisten (und solchen, die es werden möchten) zusammen, die professionell, integral und interdisziplinär sämtliche Schritte von der Konzeption bis ins zu realisierende Detail umsetzen.</p></div>
    <div class="team">{tm}</div>
  </div>
</section>
''' + cta('Lernen Sie<br>uns kennen.', 'Besuch vereinbaren')
page('buero.html', 'buero.html', 'Büro & Team – apb architekten ag', 'Firmenprofil, Atelier im Turicum-Gebäude Uster und Team von apb architekten ag – Architekten, Planer und Bauleiter seit 1996.', buero, 'buero')


# ---------------------------------------------------------------- CHRONIK
chronik = '''
<section class="c-hero">
  <div class="wrap">
    <span class="eyebrow">Jubiläum · 1996 – 2026</span>
    <div class="big30" aria-hidden="true">30</div>
    <div class="c-hero-grid">
      <h1 class="h1" data-split>Jahre<br>apb architekten</h1>
      <p class="lead rv">Seit 1996 planen und bauen wir in Uster und im Kanton Zürich: Wohnhäuser, Schulen, Gemeinde- und Kirchgemeindehäuser, Bahnhöfe und Pflegeeinrichtungen. Scrollen Sie durch drei Jahrzehnte.</p>
    </div>
  </div>
  <p class="cap"></p>
</section>
<div class="wrap">
  <div class="chron">
    <aside class="chron-side" aria-hidden="true">
      <div>
        <div class="chron-year"></div>
        <div class="chron-meta"><span><b id="c-age">0</b>Jahre apb</span><span><b id="c-projects">0</b>Projekte in dieser Chronik</span></div>
      </div>
      <div><div class="scrub"></div><div class="scrub-axis"><span>1996</span><span>2006</span><span>2016</span><span>2026</span></div></div>
    </aside>
    <div class="chron-main">
      <div class="mob-year" aria-hidden="true"><b>1996</b><span class="track"><i></i></span><span class="small muted">2026</span></div>
      <div id="chron-main"></div>
      <div class="chron-end">
        <span class="eyebrow">Ausblick</span>
        <h2 class="display" data-split style="margin-top:24px">Und die nächsten<br>30 Jahre?</h2>
        <p class="lead rv" style="margin-top:28px;max-width:28em">Im August 2028 beginnt die nächste Lehrstelle als Zeichner/-in Fachrichtung Architektur – und wir freuen uns auf die Projekte, die noch kommen.</p>
        <div class="rv" style="margin-top:32px;display:flex;gap:12px;flex-wrap:wrap"><a class="btn" href="kontakt.html">Projekt besprechen<span class="arr"></span></a><a class="btn ghost" href="projekte.html">Alle Projekte</a></div>
      </div>
    </div>
  </div>
</div>
'''
page('chronik.html', 'chronik.html', '30 Jahre apb architekten – Chronik 1996–2026', 'Chronik der apb architekten ag von der Gründung 1996 bis zum 30-Jahr-Jubiläum 2026: Meilensteine und realisierte Projekte.', chronik, 'chronik')

# ---------------------------------------------------------------- KARRIERE
def para(lines):
    t = ' '.join(lines); t = re.sub(r'\s+', ' ', t)
    return t
def job_parts(slug):
    L = jobs[slug]
    title = L[0].replace(' /// ', ' / ')
    pensum = re.sub(r'(?i)arbeitspensum\s*', '', L[1]).strip()
    rest = L[2:]
    sub = None
    if not rest[0].lower().startswith('mit '):
        sub = rest[0]; rest = rest[1:]
    txt = ' '.join(rest)
    txt = re.sub(r'\s+', ' ', txt).replace('- und', '-und').replace('kosten-und', 'kosten- und')
    ref = re.search(r'(HP-[A-Z]+-\d+)', txt).group(1)
    s = re.split(r'(?=Wir sind keine Planfabrik)|(?=Wir bieten Ihnen)|(?=Fühlen Sie sich angesprochen\?)|(?=Gerne erwarten wir)', txt)
    s = [x.strip() for x in s if x.strip()]
    return title, pensum, sub, s, ref
order = [('projektleiter-in','Projektleiter/-in'),('junior-projektleiter-in','Junior Projektleiter/-in'),('architekt-in','Architekt/-in'),('bauleiter-in','Bauleiter/-in'),('techniker-in','Techniker/-in'),('zeichner-in','Zeichner/-in'),('administration','Administration')]
jitems = ''
for slug, label in order:
    title, pensum, sub, s, ref = job_parts(slug)
    first = s[0]
    profile = (sub + ' ' if sub else '') + first
    body = ''.join(f'<p>{x}</p>' for x in s[1:])
    mail = f'mailto:info@apb-architekten.ch?subject={html.escape("Bewerbung " + label + " – Ref. " + ref)}'
    jitems += f'''<div class="acc-item" id="{slug}">
  <button type="button" class="acc-btn" aria-expanded="false"><span class="t">{label}<span class="badge">Initiativbewerbung</span></span><span class="pm" aria-hidden="true"></span></button>
  <div class="acc-panel"><div><div class="acc-inner">
    <div class="a prose"><p class="notice">Leider sind wir zur Zeit nicht aktiv auf der Suche nach einer Besetzung für diese Stellenposition. Auf Ihre interessante Initiativ-Bewerbung melden wir uns jedoch gerne, sobald wir wieder diese Stelle zu besetzen haben.</p>
      <h3 class="h3" style="margin:8px 0 14px">{title}</h3><p>{html.escape(profile[0].upper() + profile[1:]) if not profile.lower().startswith('mit ') else 'Wir suchen eine Persönlichkeit ' + html.escape(profile)}</p>{body}</div>
    <div class="b"><dl class="job-meta"><div><dt>Pensum</dt><dd>{pensum}</dd></div><div><dt>Referenz</dt><dd>{ref}</dd></div><div><dt>Kontakt</dt><dd>Pia Kiebel</dd></div><div><dt>Bewerbung</dt><dd>Post oder PDF per Mail</dd></div></dl>
      <a class="btn" href="{mail}">Jetzt bewerben<span class="arr"></span></a></div>
  </div></div></div>
</div>
'''
lehre = jobs['lehrlinge']
karr = f'''
<section class="page-hero">
  <div class="wrap">
    <span class="eyebrow">Karriere</span>
    <h1 class="display" data-split>Ambition.<br>Profession.<br>Begeisterung.</h1>
    <div class="page-hero-grid">
      <p class="lead rv">Wir suchen kontinuierlich neue Mitarbeitende, die sich genauso wie wir für Architektur und Baumanagement begeistern. Wenn auch Sie zu unserem Team dazugehören möchten, dann bewerben Sie sich auf eines der unten aufgeführten Stellenprofile oder gerne auch initiativ.</p>
      <div class="aside rv"><a class="btn" href="mailto:info@apb-architekten.ch?subject=Initiativbewerbung">Initiativ bewerben<span class="arr"></span></a></div>
    </div>
  </div>
</section>

<section class="section stone tight">
  <div class="wrap">
    <div class="values">
      <div class="value rv"><span class="n">01</span><p>Keine Planfabrik – anspruchsvolle Bauprojekte vom Vorprojekt bis zur Realisierung</p></div>
      <div class="value rv" style="--d:.08s"><span class="n">02</span><p>Kleine Projektteams, integral und interdisziplinär</p></div>
      <div class="value rv" style="--d:.16s"><span class="n">03</span><p>Moderner, grosszügiger Arbeitsplatz im loftartigen Studio</p></div>
      <div class="value rv" style="--d:.24s"><span class="n">04</span><p>Direkt am Naturschutzgebiet Greifensee – Platz zum Entfalten und Experimentieren</p></div>
    </div>
  </div>
</section>

<section class="section" id="stellen">
  <div class="wrap">
    <div class="section-head"><div><span class="eyebrow rv">Stellenprofile</span><h2 class="h1" data-split style="margin-top:18px">Stellen</h2></div><p class="muted rv" style="max-width:24em">Aktuell besetzen wir keine Stelle aktiv – Initiativbewerbungen nehmen wir jederzeit gerne entgegen.</p></div>
    <div class="acc jobs" data-single>{jitems}</div>
  </div>
</section>

<section class="section dark" id="lehrstelle">
  <div class="wrap two-col">
    <div class="l"><span class="eyebrow rv">Lehrlingsausbildung</span><h2 class="h1" data-split style="margin-top:18px">Lehrstelle<br>ab August 2028</h2>
      <p class="rv" style="margin-top:24px;color:rgba(255,255,255,.75);max-width:30em">Im 2-jährigen Rhythmus bildet unser Büro Zeichner/-innen für die Fachrichtung Architektur mit eidgenössischem Fähigkeitszeugnis (EFZ) aus. Der Lehrbeginn für die nächste freie Stelle ist August 2028.</p>
      <div class="rv" style="margin-top:28px"><span class="badge lehre" style="background:rgba(255,255,255,.1);color:#fff">Zeichner/-in EFZ Fachrichtung Architektur</span></div></div>
    <div class="r rv">
      <h3 class="eyebrow plain" style="margin-bottom:14px">Bewerbungsunterlagen per Post</h3>
      <ol class="process" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <li>Anschreiben (zwingend handschriftlich)</li>
        <li>Lebenslauf (handschriftlich oder maschinengeschrieben) mit Foto, inkl. Angabe einer Referenzauskunft (z.B. Name des Klassenlehrers und Telefonnummer)</li>
        <li>Eignungstests wie z.B. Stellwerkstest, Multicheck oder ähnliches</li>
        <li>Alle Zeugnisse der letzten Schuljahre (Sek./Gymi.)</li>
        <li>Unterlagen aus Schnupperlehren/Zeichenunterricht etc. (nicht zwingend, nur sofern vorhanden)</li>
      </ol>
      <div class="prose" style="margin-top:28px;color:rgba(255,255,255,.75)"><p>Im Anschluss an ein mögliches Bewerbungsgespräch, welches im Zeitraum Juli/August/September 2027 stattfinden würde, laden wir zu einem Schnuppertag in unserem Büro ein. Vorgängig bieten wir jedoch keine Schnupperlehren an.</p>
      <p>Schüler, die sich angesprochen fühlen, würden wir gerne kennenlernen und erwarten die vollständigen Bewerbungsunterlagen per Post an: <br><strong style="color:#fff">apb architekten ag, Pia Kiebel, Seestrasse 110a, 8610 Uster</strong></p></div>
    </div>
  </div>
</section>
''' + cta('Fühlen Sie sich<br>angesprochen?', 'Kontakt aufnehmen', stone=True)
page('karriere.html', 'karriere.html', 'Karriere & Lehrstelle – apb architekten ag', 'Offene Stellen, Initiativbewerbungen und Lehrstelle Zeichner/-in EFZ Architektur bei apb architekten ag in Uster.', karr, 'karriere')

# ---------------------------------------------------------------- KONTAKT
kontakt = '''
<section class="page-hero">
  <div class="wrap">
    <span class="eyebrow">Kontakt</span>
    <h1 class="display" data-split>Anruf.<br>Postsendung.<br>Besuch.</h1>
    <div class="page-hero-grid"><p class="lead rv">Wir freuen uns auf Sie. Egal, welchen Weg Sie einschlagen.</p></div>
  </div>
</section>
<section class="section tight" style="padding-top:0">
  <div class="wrap contact-grid">
    <div class="info">
      <div class="c-block rv"><h3>Adresse</h3><p class="v">apb architekten ag<br>Seestrasse 110a<br>8610 Uster</p><p style="margin-top:14px"><a class="link" href="https://www.google.com/maps/dir/?api=1&amp;destination=47.348162,8.695723" target="_blank" rel="noopener">Route planen<span class="arr"></span></a></p></div>
      <div class="c-block rv"><h3>Telefon</h3><a class="v copy" href="tel:+41449446080" data-copy="+41 44 944 60 80">+41 (0)44 944 60 80<span class="hint">Kopieren</span></a><p class="muted small" style="margin-top:6px">Fax +41 (0)44 944 60 81</p></div>
      <div class="c-block rv"><h3>E-Mail</h3><a class="v copy" href="mailto:info@apb-architekten.ch" data-copy="info@apb-architekten.ch">info@apb-architekten.ch<span class="hint">Kopieren</span></a></div>
    </div>
    <div class="form rv">
      <form id="contact-form" novalidate>
        <h2 class="h3" style="margin-bottom:8px">Ihre Anfrage</h2>
        <p class="muted small">Worum geht es?</p>
        <div class="pills" role="radiogroup" aria-label="Anliegen">
          <label><input type="radio" name="anliegen" value="Neubau" checked><span>Neubau</span></label>
          <label><input type="radio" name="anliegen" value="Umbau / Sanierung"><span>Umbau / Sanierung</span></label>
          <label><input type="radio" name="anliegen" value="Bauherrenberatung"><span>Beratung</span></label>
          <label><input type="radio" name="anliegen" value="Liegenschaftsanalyse"><span>Liegenschaftsanalyse</span></label>
          <label><input type="radio" name="anliegen" value="Käuferbetreuung"><span>Käuferbetreuung</span></label>
          <label><input type="radio" name="anliegen" value="Bewerbung"><span>Bewerbung</span></label>
        </div>
        <div class="field"><input id="f-name" name="name" placeholder=" " autocomplete="name" required><label for="f-name">Name</label></div>
        <div class="field"><input id="f-mail" name="email" type="email" placeholder=" " autocomplete="email"><label for="f-mail">E-Mail</label></div>
        <div class="field"><input id="f-tel" name="telefon" type="tel" placeholder=" " autocomplete="tel"><label for="f-tel">Telefon</label></div>
        <div class="field"><textarea id="f-msg" name="nachricht" placeholder=" "></textarea><label for="f-msg">Nachricht</label></div>
        <button class="btn" type="submit">Nachricht senden<span class="arr"></span></button>
        <p class="form-note">Die Anfrage wird in Ihrem E-Mail-Programm vorbereitet. Ihre Angaben werden ausschliesslich zur Bearbeitung Ihrer Anfrage verwendet.</p>
      </form>
    </div>
  </div>
</section>
<section class="section tight" style="padding-top:0">
  <div class="wrap"><div class="map rv" id="contact-map" aria-label="Karte: Seestrasse 110a, Uster"></div></div>
</section>
'''
page('kontakt.html', 'kontakt.html', 'Kontakt – apb architekten ag, Uster', 'apb architekten ag, Seestrasse 110a, 8610 Uster. Telefon +41 (0)44 944 60 80, info@apb-architekten.ch', kontakt, 'kontakt', leaflet=True)

# ---------------------------------------------------------------- IMPRESSUM
imp = '''
<section class="page-hero"><div class="wrap"><span class="eyebrow">Rechtliches</span><h1 class="display" data-split>Impressum</h1></div></section>
<section class="section tight" style="padding-top:0"><div class="wrap"><div class="legal">
<p><strong>apb architekten ag</strong><br>Seestrasse 110a<br>8610 Uster<br><a href="mailto:info@apb-architekten.ch">info@apb-architekten.ch</a><br>www.apb-architekten.ch</p>
<h2>Haftungshinweis</h2>
<p>Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschliesslich deren Betreiber verantwortlich.</p>
<h2 id="datenschutz">Datenschutzerklärung</h2>
<p>Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.</p>
<p>Die Nutzung unserer Webseite ist in der Regel ohne Angabe personenbezogener Daten möglich. Soweit auf unseren Seiten personenbezogene Daten (beispielsweise Name, Anschrift oder E-Mail-Adressen) erhoben werden, erfolgt dies, soweit möglich, stets auf freiwilliger Basis. Diese Daten werden ohne Ihre ausdrückliche Zustimmung nicht an Dritte weitergegeben.</p>
<p>Wir weisen darauf hin, dass die Datenübertragung im Internet (z.B. bei der Kommunikation per E-Mail) Sicherheitslücken aufweisen kann. Ein lückenloser Schutz der Daten vor dem Zugriff durch Dritte ist nicht möglich.</p>
<h2>Kontaktformular</h2>
<p>Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben aus dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.</p>
<h2>Kartendienst</h2>
<p>Zur Darstellung von Karten verwenden wir den Geodienst des Bundesamts für Landestopografie swisstopo (wmts.geo.admin.ch). Beim Laden der Karte wird Ihre IP-Adresse an den Server von swisstopo übermittelt. Schriften und alle übrigen Inhalte werden direkt von unserem Server ausgeliefert.</p>
</div></div></section>
'''
page('impressum.html', '', 'Impressum & Datenschutz – apb architekten ag', 'Impressum und Datenschutzerklärung der apb architekten ag, Uster.', imp, 'impressum')

# 404
page('404.html', '', 'Seite nicht gefunden – apb architekten ag', 'Seite nicht gefunden.', '''
<section class="page-hero"><div class="wrap"><span class="eyebrow">404</span><h1 class="display" data-split>Diese Seite<br>gibt es nicht.</h1>
<div class="page-hero-grid"><p class="lead rv">Vielleicht finden Sie, was Sie suchen, in unseren Projekten.</p><div class="aside rv"><a class="btn" href="projekte.html">Zu den Projekten<span class="arr"></span></a></div></div></div></section>''', '404')
print('ok')
