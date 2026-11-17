# Präsentationsseite für die Geschäftsleitung (nicht in der Navigation verlinkt).
# Wird von tools/build.py eingebunden. Alle Zahlen: Messung vom 17.11.2026 (siehe Kommentar unten).

PR_V = 'https://dominik-mettler.github.io/Website-apb/'

def _cmp(alt, neu, label, ratio='16/10'):
    return f'''<figure class="pr-cmp rv" style="--r:{ratio}" data-cmp>
  <img src="assets/img/praesentation/{neu}.webp" alt="Neue Website: {label}" loading="lazy">
  <div class="pr-old"><img src="assets/img/praesentation/{alt}.webp" alt="Bisherige Website: {label}" loading="lazy"></div>
  <span class="pr-lbl l">Bisher</span><span class="pr-lbl r">Neu</span>
  <input type="range" min="0" max="100" value="50" aria-label="Vergleich bisher und neu: {label}">
  <span class="pr-handle" aria-hidden="true"></span>
</figure>'''

# Messwerte (Playwright, Chromium, 17.11.2026, Startseite nach vollständigem Laden):
# alt  Desktop: 32 Anfragen, 1022 kB, Hosts: apb + fonts.googleapis/gstatic, google-analytics, googletagmanager, doubleclick; Cookies: CONCRETE5, _ga, _gid, _gat, _ga_*
# alt  Handy:   30 Anfragen,  892 kB
# neu  Desktop: 17 Anfragen,  861 kB, nur eigener Server, keine Cookies
# neu  Handy:   16 Anfragen,  620 kB
# alt Kontakt lädt zusätzlich Google Maps (maps.googleapis.com, maps.gstatic.com); neu: Kartenkacheln swisstopo (admin.ch)

PRAES = f'''
<section class="page-hero">
  <div class="wrap">
    <span class="eyebrow">Vorschlag · Neue Website · November 2026</span>
    <h1 class="display" data-split>apb architekten<br>neu gedacht.</h1>
    <div class="page-hero-grid">
      <p class="lead rv">Alle Inhalte der heutigen Website – 39 Projekte, Leistungen, Team, Stellen – neu gestaltet: im apb-Schwarz und -Orange, mit dem Original-Logo, schneller, ohne Tracking und für das Handy gemacht. Zur Auswahl stehen drei Startseiten.</p>
      <div class="aside rv anchor-nav"><a class="chip" href="#vergleich">Vorher / Nachher</a><a class="chip" href="#varianten">Varianten</a><a class="chip" href="#neu">Was neu ist</a><a class="chip" href="#fakten">Fakten</a><a class="chip" href="#schritte">Nächste Schritte</a></div>
    </div>
  </div>
</section>

<section class="section tight" id="vergleich" style="padding-top:0">
  <div class="wrap">
    <div class="section-head"><div><span class="eyebrow rv">Vorher / Nachher</span><h2 class="h1" data-split style="margin-top:18px">Ziehen Sie<br>den Regler.</h2></div>
      <p class="muted rv" style="max-width:26em">Links die heutige Website, rechts der Vorschlag – gleiche Bildschirmgrösse, gleiche Seite.</p></div>
    <h3 class="pr-sub rv">Startseite · Desktop</h3>
    {_cmp('alt-start-desktop', 'neu-start-desktop', 'Startseite Desktop')}
    <h3 class="pr-sub rv">Projektseite «Schulhaus Aussergass» · Desktop</h3>
    {_cmp('alt-projekt-desktop', 'neu-projekt-desktop', 'Projektseite Desktop')}
    <h3 class="pr-sub rv">Startseite · Handy</h3>
    <div class="pr-phones rv">
      <figure><img src="assets/img/praesentation/alt-start-handy.webp" alt="Bisherige Website auf dem Handy" loading="lazy"><figcaption>Bisher</figcaption></figure>
      <figure><img src="assets/img/praesentation/neu-start-handy.webp" alt="Neue Website auf dem Handy" loading="lazy"><figcaption>Neu</figcaption></figure>
    </div>
  </div>
</section>

<section class="section stone" id="varianten">
  <div class="wrap">
    <div class="section-head"><div><span class="eyebrow rv">Zur Auswahl</span><h2 class="h1" data-split style="margin-top:18px">Drei Startseiten.<br>Ein Inhalt.</h2></div>
      <p class="muted rv" style="max-width:26em">Alle Unterseiten sind identisch – nur der erste Eindruck unterscheidet sich. Jede Variante ist vollständig anklickbar.</p></div>
    <div class="pr-vars">
      <a class="pr-var rv" href="{PR_V}v8/" target="_blank" rel="noopener"><div class="media"><img src="assets/img/praesentation/variante-a.webp" alt="Variante A Kino" loading="lazy"></div>
        <div class="pr-var-t"><b>A · «Kino»</b><span>Vollbild-Slider mit den grossen Projektfotos. Wirkt am emotionalsten – profitiert am meisten von hochaufgelösten Bildern.</span><em>Variante A ansehen ↗</em></div></a>
      <a class="pr-var rv" href="{PR_V}v9/" target="_blank" rel="noopener"><div class="media"><img src="assets/img/praesentation/variante-b.webp" alt="Variante B Index" loading="lazy"></div>
        <div class="pr-var-t"><b>B · «Index»</b><span>Grosse typografische Projektliste, das Bild erscheint beim Darüberfahren. Zeigt auf einen Blick, wie viel gebaut wurde.</span><em>Variante B ansehen ↗</em></div></a>
      <a class="pr-var rv" href="{PR_V}v10/" target="_blank" rel="noopener"><div class="media"><img src="assets/img/praesentation/variante-c.webp" alt="Variante C Mosaik" loading="lazy"></div>
        <div class="pr-var-t"><b>C · «Mosaik»</b><span>Bildschirmfüllendes Raster aus Projektbildern, die einzeln wechseln. Logo und Claim im Zentrum.</span><em>Variante C ansehen ↗</em></div></a>
    </div>
  </div>
</section>

<section class="section" id="neu">
  <div class="wrap">
    <div class="section-head"><div><span class="eyebrow rv">Was neu ist</span><h2 class="h1" data-split style="margin-top:18px">Mehr als<br>ein neuer Anstrich.</h2></div></div>
    <div class="pr-feats">
      <div class="pr-feat rv"><img src="assets/img/praesentation/suche.webp" alt="" loading="lazy"><h3>Suche über alles</h3><p>Projekte, Orte, Bauherren, Leistungen, Stellen und Team – über die Lupe oder die Taste «/».</p></div>
      <div class="pr-feat rv"><img src="assets/img/praesentation/leistungsfinder.webp" alt="" loading="lazy"><h3>Leistungsfinder</h3><p>Zwei, drei Klicks zur passenden Leistung, mit Referenzprojekt und bereits ausgefülltem Kontaktformular.</p></div>
      <div class="pr-feat rv"><img src="assets/img/praesentation/referenzblatt.webp" alt="" loading="lazy"><h3>Referenzblatt als PDF</h3><p>Jedes Projekt als druckfertiges A4-Blatt mit Logo, Bild und Kenndaten – für Bewerbungen und Wettbewerbe.</p></div>
      <div class="pr-feat rv"><img src="assets/img/praesentation/chronik.webp" alt="" loading="lazy"><h3>30 Jahre apb</h3><p>Chronik 1996–2026 mit Meilensteinen und allen fertiggestellten Projekten pro Jahr.</p></div>
    </div>
    <ul class="pr-list rv">
      <li><b>Projektübersicht</b> mit Filter nach Thema, Suche und vier Ansichten: Raster, Liste, Karte (swisstopo), Zeitachse</li>
      <li><b>Projektseiten</b> mit Bildergalerie im Vollbild, Kenndaten, Standortkarte und verwandten Projekten</li>
      <li><b>SIA-112-Phasen</b> interaktiv, inklusive Kostengenauigkeit ±20 % → ±10 %</li>
      <li><b>Karriere</b> mit allen Stellenprofilen, Bewerbungsknopf mit Referenznummer und Lehrstelle 2028</li>
      <li><b>Intro</b> mit dem Original-Logo, das sich Strich für Strich zeichnet; fliessende Seitenübergänge</li>
      <li><b>Pflege</b>: neue Projekte werden in einer einzigen Datei ergänzt – Bilder in einen Ordner, fertig</li>
    </ul>
  </div>
</section>

<section class="section dark" id="fakten">
  <div class="wrap">
    <div class="section-head"><div><span class="eyebrow rv">Gemessen</span><h2 class="h1" data-split style="margin-top:18px">Die Fakten.</h2></div>
      <p class="muted rv" style="max-width:26em">Messung am 17.11.2026 mit Chromium, Startseite nach vollständigem Laden.</p></div>
    <div class="pr-table rv" role="table" aria-label="Vergleich bisher und neu">
      <div class="pr-row pr-h" role="row"><span role="columnheader"></span><span role="columnheader">Bisher</span><span role="columnheader">Neu</span></div>
      <div class="pr-row" role="row"><span role="rowheader">Anfragen an Server · Desktop</span><span role="cell">32</span><span role="cell" class="good">17</span></div>
      <div class="pr-row" role="row"><span role="rowheader">Datenmenge · Desktop</span><span role="cell">1’022 kB</span><span role="cell" class="good">861 kB</span></div>
      <div class="pr-row" role="row"><span role="rowheader">Datenmenge · Handy</span><span role="cell">892 kB</span><span role="cell" class="good">620 kB</span></div>
      <div class="pr-row" role="row"><span role="rowheader">Externe Dienste beim Laden</span><span role="cell">5 Server von Google (Fonts, Analytics, Tag Manager, DoubleClick)</span><span role="cell" class="good">keine</span></div>
      <div class="pr-row" role="row"><span role="rowheader">Cookies</span><span role="cell">5, davon 4 von Google Analytics</span><span role="cell" class="good">keine</span></div>
      <div class="pr-row" role="row"><span role="rowheader">Karte auf der Kontaktseite</span><span role="cell">Google Maps</span><span role="cell" class="good">swisstopo (Bund)</span></div>
      <div class="pr-row" role="row"><span role="rowheader">Inhalte übernommen</span><span role="cell">–</span><span role="cell" class="good">39 Projekte · 386 Bilder · 8 Teammitglieder · 7 Stellenprofile · Lehrstelle</span></div>
      <div class="pr-row" role="row"><span role="rowheader">Alte Adressen (z.&nbsp;B. Google-Treffer)</span><span role="cell">–</span><span role="cell" class="good">67 Weiterleitungen auf die neuen Seiten</span></div>
      <div class="pr-row" role="row"><span role="rowheader">Hosting</span><span role="cell">Webserver mit CMS</span><span role="cell" class="good">statische Dateien – kostenlos über GitHub Pages oder beim bisherigen Hoster</span></div>
    </div>
  </div>
</section>

<section class="section" id="schritte">
  <div class="wrap two-col">
    <div class="l"><span class="eyebrow rv">Bis zum Go-live</span><h2 class="h1" data-split style="margin-top:18px">Nächste<br>Schritte.</h2></div>
    <div class="r rv">
      <ol class="process" style="grid-template-columns:repeat(2,minmax(0,1fr));border-color:var(--ink)">
        <li style="border-color:var(--line)">Variante wählen (A, B oder C)</li>
        <li style="border-color:var(--line)">Projektbilder in Originalauflösung und Logo als Vektordatei</li>
        <li style="border-color:var(--line)">Team-Fotos und aktuelles Firmenprofil als PDF</li>
        <li style="border-color:var(--line)">Impressum und Datenschutz rechtlich prüfen</li>
        <li style="border-color:var(--line)">Domain umstellen – E-Mail bleibt unberührt</li>
        <li style="border-color:var(--line)">Seite für Google freischalten und neu einreichen</li>
      </ol>
    </div>
  </div>
</section>
'''
