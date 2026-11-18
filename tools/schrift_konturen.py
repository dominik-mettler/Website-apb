"""Liest Glyphen-Konturen direkt aus einer TrueType-Datei (ohne Zusatzpakete).
glyphen(pfad, text) -> (unitsPerEm, [(advance, [kontur, ...]), ...])
kontur = Liste von (x, y, on_curve) in Font-Einheiten (y nach oben).
"""
import struct


class TTF:
    def __init__(self, path):
        self.d = d = open(path, 'rb').read()
        n = struct.unpack('>H', d[4:6])[0]
        self.t = {}
        for i in range(n):
            tag, _, off, ln = struct.unpack('>4sIII', d[12 + 16 * i:28 + 16 * i])
            self.t[tag.decode()] = (off, ln)
        h = self.t['head'][0]
        self.upem = struct.unpack('>H', d[h + 18:h + 20])[0]
        self.locfmt = struct.unpack('>h', d[h + 50:h + 52])[0]
        self.nglyph = struct.unpack('>H', d[self.t['maxp'][0] + 4:self.t['maxp'][0] + 6])[0]
        self.nhm = struct.unpack('>H', d[self.t['hhea'][0] + 34:self.t['hhea'][0] + 36])[0]
        self._cmap()

    def _cmap(self):
        d = self.d; c = self.t['cmap'][0]
        n = struct.unpack('>H', d[c + 2:c + 4])[0]
        self.map = {}
        for i in range(n):
            pid, eid, off = struct.unpack('>HHI', d[c + 4 + 8 * i:c + 12 + 8 * i])
            s = c + off
            if struct.unpack('>H', d[s:s + 2])[0] != 4 or not (pid == 3 and eid == 1 or pid == 0):
                continue
            seg = struct.unpack('>H', d[s + 6:s + 8])[0] // 2
            ends = struct.unpack('>%dH' % seg, d[s + 14:s + 14 + 2 * seg])
            p = s + 16 + 2 * seg
            starts = struct.unpack('>%dH' % seg, d[p:p + 2 * seg]); p += 2 * seg
            deltas = struct.unpack('>%dh' % seg, d[p:p + 2 * seg]); p += 2 * seg
            ro_pos = p
            ros = struct.unpack('>%dH' % seg, d[p:p + 2 * seg])
            for k in range(seg):
                for ch in range(starts[k], ends[k] + 1):
                    if ch == 0xFFFF: continue
                    if ros[k] == 0:
                        g = (ch + deltas[k]) & 0xFFFF
                    else:
                        a = ro_pos + 2 * k + ros[k] + 2 * (ch - starts[k])
                        g = struct.unpack('>H', d[a:a + 2])[0]
                        if g: g = (g + deltas[k]) & 0xFFFF
                    self.map[ch] = g
            return

    def adv(self, g):
        h = self.t['hmtx'][0]; i = min(g, self.nhm - 1)
        return struct.unpack('>H', self.d[h + 4 * i:h + 4 * i + 2])[0]

    def _loc(self, g):
        l = self.t['loca'][0]; d = self.d
        if self.locfmt == 0:
            a, b = struct.unpack('>HH', d[l + 2 * g:l + 2 * g + 4]); return 2 * a, 2 * b
        return struct.unpack('>II', d[l + 4 * g:l + 4 * g + 8])

    def contours(self, g):
        d = self.d; a, b = self._loc(g)
        if a == b: return []
        s = self.t['glyf'][0] + a
        nc = struct.unpack('>h', d[s:s + 2])[0]
        if nc < 0:
            raise ValueError('zusammengesetzte Glyphe nicht unterstützt')
        p = s + 10
        ends = struct.unpack('>%dH' % nc, d[p:p + 2 * nc]); p += 2 * nc
        il = struct.unpack('>H', d[p:p + 2])[0]; p += 2 + il
        npt = ends[-1] + 1
        flags = []
        while len(flags) < npt:
            f = d[p]; p += 1; flags.append(f)
            if f & 8:
                r = d[p]; p += 1; flags += [f] * r
        def coords(short, same):
            nonlocal p
            v = 0; out = []
            for f in flags:
                if f & short:
                    dv = d[p]; p += 1; v += dv if f & same else -dv
                elif not f & same:
                    v += struct.unpack('>h', d[p:p + 2])[0]; p += 2
                out.append(v)
            return out
        xs = coords(2, 16); ys = coords(4, 32)
        res = []; st = 0
        for e in ends:
            res.append([(xs[i], ys[i], bool(flags[i] & 1)) for i in range(st, e + 1)]); st = e + 1
        return res


def glyphen(path, text):
    f = TTF(path)
    return f.upem, [(f.adv(f.map[ord(c)]), f.contours(f.map[ord(c)])) for c in text]


def kontur_pfad(k, tf):
    """Quadratische TrueType-Kontur -> SVG-Pfad; tf(x, y) -> (X, Y)."""
    pts = list(k)
    if not pts[0][2]:
        # Start auf einem On-Curve-Punkt (oder Mittelpunkt) wählen
        i = next((i for i, q in enumerate(pts) if q[2]), None)
        if i is None:
            m = ((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, True); pts = [m] + pts[1:] + [pts[0]]
        else:
            pts = pts[i:] + pts[:i]
    f = lambda x, y: '%.2f %.2f' % tf(x, y)
    out = ['M' + f(pts[0][0], pts[0][1])]
    n = len(pts); i = 1; ctrl = None
    seq = pts[1:] + [pts[0]]
    for q in seq:
        if q[2]:
            out.append(('Q' + f(*ctrl) + ' ' if ctrl else 'L') + f(q[0], q[1])); ctrl = None
        else:
            if ctrl:
                mx, my = (ctrl[0] + q[0]) / 2, (ctrl[1] + q[1]) / 2
                out.append('Q' + f(*ctrl) + ' ' + f(mx, my))
            ctrl = (q[0], q[1])
    return ''.join(out) + 'Z'


def flach(k, tf, steps=8):
    """Kontur als Polygon (für Rasterung/Vergleich)."""
    pts = list(k)
    if not pts[0][2]:
        i = next((i for i, q in enumerate(pts) if q[2]), 0); pts = pts[i:] + pts[:i]
    poly = [tf(pts[0][0], pts[0][1])]; ctrl = None; cur = (pts[0][0], pts[0][1])
    def quad(a, c, b):
        for s in range(1, steps + 1):
            t = s / steps
            x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0]
            y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]
            poly.append(tf(x, y))
    for q in pts[1:] + [pts[0]]:
        if q[2]:
            if ctrl: quad(cur, ctrl, q[:2])
            else: poly.append(tf(q[0], q[1]))
            cur = q[:2]; ctrl = None
        else:
            if ctrl:
                m = ((ctrl[0] + q[0]) / 2, (ctrl[1] + q[1]) / 2); quad(cur, ctrl, m); cur = m
            ctrl = q[:2]
    return poly
