"""Schneidet die Pläne pro Projekt einheitlich zu (content/projekte/<id>/plaene/NN.png -> plaene-zuschnitt/NN.png).

- Weissraum rund um die Zeichnung entfernen, Proportionen bleiben (kein Stauchen/Verzerren)
- Schnitte/Ansichten: grau schraffiertes Gelände unten auf einen schmalen Streifen kürzen
- ein Format (Seitenverhältnis) pro Projekt, abgeleitet aus den Plänen des Projekts;
  lieber etwas anschneiden als Weiss auffüllen – aber höchstens MAX_SCHNITT pro Richtung
- Situation: grösstes Rechteck im Projektformat, das ganz innerhalb des (genordeten, gedrehten) Plans liegt,
  zentriert auf das hervorgehobene Projektgebäude -> keine weissen Ecken
Das Format steht danach in auswahl.json als 'plan_format' (Breite/Höhe).
Aufruf: python3 tools/plaene_zuschneiden.py [projekt-id ...]
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
C = os.path.join(R, 'content/projekte')
MAX_SCHNITT = 0.0      # Zeichnungen nie anschneiden (nur Weiss auffüllen) – Wunsch: Gebäude nie zerschneiden
RAND = 0.025           # kleiner Rand um die Zeichnung (Anteil der längeren Seite)

def ink(a, t=200):
    return a < t

def bbox(mask):
    ys, xs = np.nonzero(mask)
    if not len(xs): return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def gelaende_kuerzen(a):
    """Unten liegende graue Geländefläche auf einen schmalen Streifen kürzen."""
    h, w = a.shape
    grau = (a > 170) & (a < 245)
    anteil = grau.mean(axis=1)
    zeilen = anteil > 0.45
    # zusammenhängender Geländeblock am unteren Rand der Zeichnung
    y = h - 1
    while y > 0 and not zeilen[y] and anteil[y] < 0.02: y -= 1     # Weiss unter dem Gelände
    unten = y
    while y > 0 and zeilen[y]: y -= 1
    oben = y + 1
    block = unten - oben + 1
    if block > h * 0.12:                                            # nur wenn das Gelände wirklich viel Platz nimmt
        behalten = max(int(h * 0.05), 30)
        a = a[:oben + behalten, :]
    # Breite am Gebäude ausrichten: dunkle Linien oberhalb des Geländes (Gebäude, Bäume, Figuren)
    hh = a.shape[0]; gt = min(oben, hh) - 6
    if gt > hh * 0.3:
        spalten = (a[:gt, :] < 140).sum(axis=0) > 3
        xs = np.nonzero(spalten)[0]
        if len(xs):
            x0, x1 = xs.min(), xs.max() + 1; rand = int((x1 - x0) * 0.06)
            a = a[:, max(0, x0 - rand):min(a.shape[1], x1 + rand)]
            ys = np.nonzero((a < 245).any(axis=1))[0]
            if len(ys): a = a[ys.min():ys.max() + 1, :]
    return a

def zuschnitt(a, ar):
    """Zeichnung auf Seitenverhältnis ar bringen: erst bis MAX_SCHNITT anschneiden, Rest mit Weiss auffüllen."""
    h, w = a.shape
    if w / h > ar:                       # zu breit -> seitlich anschneiden, dann oben/unten auffüllen
        neu_w = max(int(round(h * ar)), int(w * (1 - 2 * MAX_SCHNITT)))
        x0 = (w - neu_w) // 2; a = a[:, x0:x0 + neu_w]
        h, w = a.shape; ziel_h = int(round(w / ar))
        if ziel_h > h:
            pad = ziel_h - h; a = np.pad(a, ((pad // 2, pad - pad // 2), (0, 0)), constant_values=255)
    else:                                # zu hoch -> unten/oben anschneiden (unten zuerst), dann seitlich auffüllen
        neu_h = max(int(round(w / ar)), int(h * (1 - 2 * MAX_SCHNITT)))
        weg = h - neu_h; a = a[weg // 3: weg // 3 + neu_h, :]
        h, w = a.shape; ziel_w = int(round(h * ar))
        if ziel_w > w:
            pad = ziel_w - w; a = np.pad(a, ((0, 0), (pad // 2, pad - pad // 2)), constant_values=255)
    return a

def huelle(pts):
    pts = sorted(set(map(tuple, pts)))
    if len(pts) < 3: return pts
    def kreuz(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    unten, oben = [], []
    for p in pts:
        while len(unten) >= 2 and kreuz(unten[-2], unten[-1], p) <= 0: unten.pop()
        unten.append(p)
    for p in reversed(pts):
        while len(oben) >= 2 and kreuz(oben[-2], oben[-1], p) <= 0: oben.pop()
        oben.append(p)
    return unten[:-1] + oben[:-1]

def innen(poly, x, y):
    # konvexes Polygon: Punkt liegt innen, wenn er auf derselben Seite aller Kanten liegt (Umlaufsinn egal)
    pos = neg = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
        if c > 0: pos = True
        elif c < 0: neg = True
        if pos and neg: return False
    return True

def situation(a, ar):
    h, w = a.shape
    m = Image.fromarray((ink(a) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(31))
    ys, xs = np.nonzero(np.asarray(m) > 0)
    if not len(xs): return a
    step = max(1, len(xs) // 40000)
    poly = huelle(np.stack([xs[::step], ys[::step]], 1).tolist())
    # Projektgebäude = dunkel gefüllte Fläche (Linien verschwinden beim Weichzeichnen)
    weich = np.asarray(Image.fromarray(a).filter(ImageFilter.GaussianBlur(7)))
    dy, dx = np.nonzero(weich < 120)
    hx, hy = np.mean([p[0] for p in poly]), np.mean([p[1] for p in poly])
    fx, fy = (dx.mean(), dy.mean()) if len(dx) > 50 else (hx, hy)
    # Ausschnitt immer genau auf das Projektgebäude zentriert (Wunsch: Projekt sitzt mittig)
    cx, cy = fx, fy
    lo, hi = 10.0, float(max(w, h))
    while hi - lo > 2:
        hw = (lo + hi) / 2; hh = hw / ar
        ok = all(innen(poly, cx + sx * hw, cy + sy * hh) for sx in (-1, 1) for sy in (-1, 1))
        lo, hi = (hw, hi) if ok else (lo, hw)
    hw = max(lo, min(w, h * ar) * 0.32)          # nie zu eng: lieber etwas Weiss in einer Ecke als ein Briefmarken-Ausschnitt
    hh = hw / ar
    x0, y0, x1, y1 = [int(round(v)) for v in (cx - hw, cy - hh, cx + hw, cy + hh)]
    p = np.pad(a, ((max(0, -y0), max(0, y1 - h)), (max(0, -x0), max(0, x1 - w))), constant_values=255)
    ox, oy = max(0, -x0), max(0, -y0)
    return p[y0 + oy:y1 + oy, x0 + ox:x1 + ox]

def projekt(pid):
    d = os.path.join(C, pid); f = os.path.join(d, 'auswahl.json')
    if not os.path.exists(f): return
    sel = json.load(open(f))
    if not sel.get('plaene'): return
    os.makedirs(os.path.join(d, 'plaene-zuschnitt'), exist_ok=True)
    roh = []
    for pl in sel['plaene']:
        a = np.asarray(Image.open(os.path.join(d, pl['datei'])).convert('L'))
        b = bbox(ink(a, 245)); a = a[b[1]:b[3], b[0]:b[2]] if b else a
        sit = pl['unterschrift'].lower().startswith('situation')
        # Gelände nicht mehr kürzen: schnitt sonst Untergeschosse ab
        roh.append((pl, a, sit))
    asp = [x[1].shape[1] / x[1].shape[0] for x in roh if not x[2]]
    ar = float(np.clip(np.exp(np.mean(np.log(asp))) if asp else 1.5, 1.4, 1.9))
    ar = round(ar * 20) / 20                      # auf 0.05 runden
    for pl, a, sit in roh:
        a = situation(a, ar) if sit else zuschnitt(a, ar)
        if not sit:
            r = int(max(a.shape) * RAND); a = np.pad(a, ((r, r), (r, r)), constant_values=255)
        im = Image.fromarray(a.astype(np.uint8))
        # exakt auf das Projektformat bringen (minimale Rundungsdifferenzen), Proportionen erhalten
        W = 2400; H = int(round(W / ar))
        sc = min(W / im.width, H / im.height)                 # auf die Fläche skalieren (auch vergrössern)
        im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
        can = Image.new('L', (W, H), 255); can.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
        ziel = os.path.join(d, 'plaene-zuschnitt', os.path.basename(pl['datei']))
        can.save(ziel, optimize=True)
    sel['plan_format'] = ar
    json.dump(sel, open(f, 'w'), ensure_ascii=False, indent=1)
    print(pid, 'Format %.2f : 1' % ar, len(roh), 'Pläne')

for pid in (sys.argv[1:] or sorted(os.listdir(C))):
    projekt(pid)
