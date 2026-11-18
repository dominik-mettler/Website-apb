"""Baut das apb-Logo als SVG:
- Würfel-Skizze: vektorisiert aus dem Original (assets/img/logo-light.svg, Konturen links)
- Wortmarke «apb architekten ag»: mit echter Schrift gesetzt (Liberation Sans Bold = Arial-Masse),
  Grösse, Laufweite und Lage automatisch an das Original-Logo angepasst.
Aufruf: python3 tools/logo_bauen.py <original.png>
"""
import re, sys, os
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from schrift_konturen import glyphen, kontur_pfad, flach

FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
TEXT = 'apb architekten ag'
XTEXT = 270  # alles rechts davon ist Schrift
ROOT = os.path.join(os.path.dirname(__file__), '..')

orig = np.asarray(Image.open(sys.argv[1]).convert('RGBA'))[:, :, 3] > 128
H, W = orig.shape
upem, gl = glyphen(FONT, TEXT)
ziel = orig[:, XTEXT:]

def layout(s, tr, x0, base):
    """Liefert pro Kontur eine Transformationsfunktion-Liste."""
    out = []; x = x0
    for adv, ks in gl:
        for k in ks:
            out.append((k, (lambda gx: (lambda X, Y: (gx + X * s, base - Y * s)))(x)))
        x += adv * s + tr
    return out

def raster(params, SS=4):
    s, tr, x0, base = params
    im = Image.new('1', (W * SS, H * SS), 0); acc = np.zeros((H * SS, W * SS), bool)
    for k, tf in layout(s, tr, x0, base):
        m = Image.new('1', (W * SS, H * SS), 0)
        ImageDraw.Draw(m).polygon([(a * SS, b * SS) for a, b in flach(k, tf)], fill=1)
        acc ^= np.asarray(m)
    small = Image.fromarray((acc * 255).astype(np.uint8)).resize((W, H), Image.BOX)
    return np.asarray(small) > 127

def score(p):
    r = raster(p, 2)[:, XTEXT:]
    return (r & ziel).sum() / max(1, (r | ziel).sum())

# Startwerte aus den Massen des Originals
ys, xs = np.nonzero(ziel)
top, bot = ys.min(), ys.max() + 1
xl = xs.min() + XTEXT
# Ober-/Unterlänge aus der Schrift: 'b' (Index 2) oben, 'p' (Index 1) unten
yb = max(y for k in gl[2][1] for _, y, _ in k); yp = min(y for k in gl[1][1] for _, y, _ in k)
s = (bot - top) / (yb - yp)
p = [s, 0.0, xl - 0.0, top + yb * s]
best = score(p)
steps = [s * 0.02, 0.4, 0.5, 0.5]
for runde in range(6):
    besser = True
    while besser:
        besser = False
        for i in range(4):
            for sg in (1, -1):
                q = list(p); q[i] += sg * steps[i]
                sc = score(q)
                if sc > best + 1e-5:
                    best, p, besser = sc, q, True
    steps = [v / 2 for v in steps]
print('Passung (IoU) %.3f  Grösse %.4f px/Einheit  Laufweite %.2f px  x %.2f  Grundlinie %.2f' % (best, *p))

# Würfel aus bestehender SVG übernehmen
alt = open(os.path.join(ROOT, 'assets/img/logo-light.svg')).read()
ds = re.findall(r' d="([^"]+)"', alt)
if len(ds) > 1:          # bereits gebaut: erster Pfad = Würfel
    wuerfel = [ds[0]]
else:                    # alte, ganz nachgezeichnete SVG: Würfel-Konturen links herauslösen
    teile = re.findall(r'M[^M]+', ds[0])
    wuerfel = [t for t in teile if float(re.match(r'M\s*([-\d.]+)', t).group(1)) < XTEXT]
text = ''.join(kontur_pfad(k, tf) for k, tf in layout(*p))
vb = re.search(r'viewBox="([^"]+)"', alt).group(1)
for name, col in (('logo-light.svg', '#ffffff'), ('logo-dark.svg', '#141414')):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">'
           f'<title>apb architekten ag</title>'
           f'<path fill="{col}" fill-rule="evenodd" d="{"".join(wuerfel)}"/>'
           f'<path fill="{col}" stroke="{col}" stroke-width=".35" stroke-linejoin="round" d="{text}"/></svg>')
    open(os.path.join(ROOT, 'assets/img', name), 'w').write(svg)
print('geschrieben, Würfel-Konturen:', len(wuerfel), ' Schrift-Konturen:', sum(len(k) for _, k in gl))
