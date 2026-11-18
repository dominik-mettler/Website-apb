"""Vektorisiert das Original-Logo (Rastergrafik) zu einer SVG-Datei.
Ablauf: hochskalieren + glätten -> Schwellwert -> Konturverfolgung (Marching Squares)
-> Vereinfachung (Ramer-Douglas-Peucker) -> geglättete Bézier-Kurven.
Aufruf: python3 tools/logo_vektor.py <quelle.png> <ziel.svg> [farbe]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
color = sys.argv[3] if len(sys.argv) > 3 else 'currentColor'
S = 8  # Hochskalierung

im = Image.open(src).convert('RGBA')
a = im.split()[3]
W0, H0 = a.size
big = a.resize((W0 * S, H0 * S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(S * 0.55))
g = np.asarray(big, dtype=np.float32) / 255.0
g = np.pad(g, 1)
B = (g > 0.5).astype(np.uint8)
H, W = B.shape

# Marching squares: Kanten zwischen Pixelmitten, Kodierung pro Zelle
tl, tr, br, bl = B[:-1, :-1], B[:-1, 1:], B[1:, 1:], B[1:, :-1]
code = tl * 8 + tr * 4 + br * 2 + bl
# Kantenpunkte: top(0) right(1) bottom(2) left(3); linear interpoliert
def pt(y, x, e):
    if e == 0:
        a_, b_ = g[y, x], g[y, x + 1]; t = (0.5 - a_) / (b_ - a_) if b_ != a_ else .5; return (x + t, y)
    if e == 1:
        a_, b_ = g[y, x + 1], g[y + 1, x + 1]; t = (0.5 - a_) / (b_ - a_) if b_ != a_ else .5; return (x + 1, y + t)
    if e == 2:
        a_, b_ = g[y + 1, x], g[y + 1, x + 1]; t = (0.5 - a_) / (b_ - a_) if b_ != a_ else .5; return (x + t, y + 1)
    a_, b_ = g[y, x], g[y + 1, x]; t = (0.5 - a_) / (b_ - a_) if b_ != a_ else .5; return (x, y + t)
# Segmente je Code (Richtung so, dass Füllung links liegt)
SEG = {1: [(3, 2)], 2: [(2, 1)], 3: [(3, 1)], 4: [(1, 0)], 5: [(3, 0), (1, 2)], 6: [(2, 0)], 7: [(3, 0)],
       8: [(0, 3)], 9: [(0, 2)], 10: [(0, 1), (2, 3)], 11: [(0, 1)], 12: [(1, 3)], 13: [(1, 2)], 14: [(2, 3)]}
def ekey(y, x, e):
    return ('h', y, x) if e == 0 else ('v', y, x + 1) if e == 1 else ('h', y + 1, x) if e == 2 else ('v', y, x)
ys, xs = np.nonzero((code > 0) & (code < 15))
adj = {}; P = {}
for y, x in zip(ys.tolist(), xs.tolist()):
    for e0, e1 in SEG[int(code[y, x])]:
        k0, k1 = ekey(y, x, e0), ekey(y, x, e1)
        P.setdefault(k0, pt(y, x, e0)); P.setdefault(k1, pt(y, x, e1))
        adj.setdefault(k0, []).append(k1); adj.setdefault(k1, []).append(k0)
seen = set(); loops = []
for start in adj:
    if start in seen: continue
    loop = [P[start]]; seen.add(start); prev = None; cur = start
    while True:
        nx = [n for n in adj[cur] if n != prev and n not in seen]
        if not nx: break
        prev, cur = cur, nx[0]; seen.add(cur); loop.append(P[cur])
    if len(loop) > 8: loops.append(loop)

def rdp(pts, eps):
    pts = np.asarray(pts)
    if len(pts) < 3: return pts
    st = [(0, len(pts) - 1)]; keep = np.zeros(len(pts), bool); keep[0] = keep[-1] = True
    while st:
        i, j = st.pop()
        if j <= i + 1: continue
        a_, b_ = pts[i], pts[j]; d = b_ - a_; n = np.hypot(*d) or 1e-9
        seg = pts[i + 1:j]
        dist = np.abs(d[0] * (a_[1] - seg[:, 1]) - d[1] * (a_[0] - seg[:, 0])) / n
        k = int(np.argmax(dist))
        if dist[k] > eps:
            m = i + 1 + k; keep[m] = True; st += [(i, m), (m, j)]
    return pts[keep]

def bezier_path(p):
    # geschlossene Catmull-Rom-Spline -> kubische Bézier
    n = len(p); out = []
    f = lambda q: f'{q[0] / S - 1 / S:.2f} {q[1] / S - 1 / S:.2f}'
    out.append('M' + f(p[0]))
    for i in range(n):
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
        c1 = p1 + (p2 - p0) / 6.0; c2 = p2 - (p3 - p1) / 6.0
        out.append('C' + f(c1) + ' ' + f(c2) + ' ' + f(p2))
    return ''.join(out) + 'Z'

paths = []
for lp in loops:
    arr = np.asarray(lp)
    area = 0.5 * np.sum(arr[:, 0] * np.roll(arr[:, 1], -1) - np.roll(arr[:, 0], -1) * arr[:, 1])
    if abs(area) < (S * S) * 1.2: continue          # Staubkörner verwerfen
    far = int(np.argmax(np.hypot(*(arr - arr[0]).T)))
    eps = 0.55 * S / 2
    simp = np.vstack([rdp(arr[:far + 1], eps)[:-1], rdp(np.vstack([arr[far:], arr[:1]]), eps)[:-1]])
    if len(simp) < 3: continue
    paths.append(bezier_path(simp))
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W0} {H0}" width="{W0}" height="{H0}">'
       f'<title>apb architekten ag</title><path fill="{color}" fill-rule="evenodd" d="{"".join(paths)}"/></svg>')
open(dst, 'w').write(svg)
print(dst, len(paths), 'Konturen', round(len(svg) / 1024), 'kB')
