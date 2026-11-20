"""Erzeugt die Referenzblätter (Original-Datenblätter A3) pro Projekt als PDF in assets/ref/.
- Quelle: Sammel-PDF der Projektdatenblätter, Seitenzuordnung aus tools/datenblaetter.py
- Blätter mit Platzhaltern (Lorem ipsum, XX ...) werden nicht veröffentlicht («in Bearbeitung»)
- Datenschutz: Zeilen mit Referenz-/Kontaktpersonen, Präsidien und Telefonnummern werden geschwärzt
  (weiss abgedeckt und als Bild neu aufgebaut, damit der Text auch nicht mehr kopierbar ist);
  bei privaten Bauherrschaften zusätzlich Bauherrschaft und Adresse.
Aufruf: python3 tools/referenzblaetter.py <sammel.pdf>
Einzelblatt (z. B. aus einer Bewerbung): python3 tools/referenzblaetter.py --einzel <projekt-id> <blatt.pdf> ["Regex zum Abdecken" ...]
  Die Rohdatei bleibt ausserhalb des Repositorys; veröffentlicht wird nur die bereinigte Fassung.
  Einzelblätter stehen in content/referenzblaetter-einzel.json und werden vom Sammel-Lauf nicht überschrieben.
"""
import html, json, os, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from datenblaetter import SEITENZUORDNUNG, NEU

EINZEL_JSON = None  # wird unten gesetzt
SRC = sys.argv[1] if sys.argv[1] != '--einzel' else sys.argv[3]
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets/ref'); os.makedirs(OUT, exist_ok=True)
DPI = 200
PLATZ = re.compile(r'Lorem|ipsum|\bXX\b|XYZ|_{3,}|PLZ Ort')
PERSON = re.compile(r'^(Referenz|Kontakt|Ansprechpartner|Schlüsselperson|Miteigentümer|Gemeindeschreiber|Baukommission|[\w-]*präsident|Vorstand)', re.I)
TEL = re.compile(r'(\+41|\b0\d{2})[\s/.-]?\d{3}[\s.]?\d{2}[\s.]?\d{2}')
PRIVAT_ZEILE = re.compile(r'^(Bauherrschaft|Bauherr|Adresse)', re.I)

def zeilen(n, src=None):
    x = subprocess.run(['pdftotext', '-f', str(n), '-l', str(n), '-bbox-layout', src or SRC, '-'], capture_output=True, text=True).stdout
    out = []
    for m in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', x, re.S):
        t = ' '.join(html.unescape(w) for w in re.findall(r'>([^<]*)</word>', m.group(5)))
        out.append(([float(v) for v in m.groups()[:4]], t))
    return out

EINZEL_JSON = os.path.join(ROOT, 'content/referenzblaetter-einzel.json')
EINZEL = json.load(open(EINZEL_JSON)) if os.path.exists(EINZEL_JSON) else {}

def rendern(src, n, weg, ziel):
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(['pdftoppm', '-r', str(DPI), '-f', str(n), '-l', str(n), '-png', src, os.path.join(td, 's')], check=True)
        im = Image.open(os.path.join(td, os.listdir(td)[0])).convert('RGB')
    k = DPI / 72.0; d = ImageDraw.Draw(im)
    for (x0, y0, x1, y1), _ in weg:
        d.rectangle([x0 * k - 3, y0 * k - 2, x1 * k + 3, y1 * k + 2], fill='white')
    im.save(ziel, 'PDF', resolution=DPI, quality=84)

if sys.argv[1] == '--einzel':
    pid, src, extra = sys.argv[2], sys.argv[3], [re.compile(r) for r in sys.argv[4:]]
    z = zeilen(1, src)
    if PLATZ.search(' '.join(t for _, t in z)): raise SystemExit('Blatt enthält Platzhaltertext – nicht veröffentlicht')
    privat = NEU.get(pid, {}).get('privat')
    weg = [(b, t) for b, t in z if PERSON.search(t) or TEL.search(t) or (privat and PRIVAT_ZEILE.search(t)) or any(r.search(t) for r in extra)]
    ziel = os.path.join(OUT, pid + '.pdf'); rendern(src, 1, weg, ziel)
    EINZEL[pid] = {'quelle': os.path.basename(src), 'abgedeckt': [t for _, t in weg], 'kb': os.path.getsize(ziel) // 1024}
    json.dump(EINZEL, open(EINZEL_JSON, 'w'), ensure_ascii=False, indent=1)
    print(pid, EINZEL[pid]); raise SystemExit(0)

# Blätter mit veralteten Angaben (bis eine aktuelle Fassung vorliegt)
VERALTET = {'333-kff': 'altes Blatt: ca. 16 Mio., Ausführung bis Dez. 2026 – aktuell 18 Mio., fertig Okt. 2025'}
bericht = {}
for pid, seiten in SEITENZUORDNUNG.items():
    if pid in EINZEL:
        bericht[pid] = 'Einzelblatt: ' + EINZEL[pid]['quelle']; continue
    if pid in VERALTET:
        z = os.path.join(OUT, pid + '.pdf')
        if os.path.exists(z): os.remove(z)
        bericht[pid] = 'in Bearbeitung (veraltet: ' + VERALTET[pid] + ')'; continue
    privat = NEU.get(pid, {}).get('privat')
    wahl = None
    for n in seiten:
        z = zeilen(n)
        if not PLATZ.search(' '.join(t for _, t in z)):
            wahl = (n, z); break
    ziel = os.path.join(OUT, pid + '.pdf')
    if not wahl:
        if os.path.exists(ziel): os.remove(ziel)
        bericht[pid] = 'in Bearbeitung'; continue
    n, z = wahl
    weg = [(b, t) for b, t in z if PERSON.search(t) or TEL.search(t) or (privat and PRIVAT_ZEILE.search(t))]
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(['pdftoppm', '-r', str(DPI), '-f', str(n), '-l', str(n), '-png', SRC, os.path.join(td, 's')], check=True)
        im = Image.open(os.path.join(td, os.listdir(td)[0])).convert('RGB')
    k = DPI / 72.0; d = ImageDraw.Draw(im)
    for (x0, y0, x1, y1), _ in weg:
        d.rectangle([x0 * k - 3, y0 * k - 2, x1 * k + 3, y1 * k + 2], fill='white')
    im.save(ziel, 'PDF', resolution=DPI, quality=84)
    bericht[pid] = {'seite': n, 'geschwaerzt': [t for _, t in weg], 'kb': os.path.getsize(ziel) // 1024}
json.dump(bericht, open(os.path.join(ROOT, 'content/referenzblaetter.json'), 'w'), ensure_ascii=False, indent=1)
for k, v in bericht.items(): print(k, v)
