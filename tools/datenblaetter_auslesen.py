import subprocess, re, json, html, sys
F = sys.argv[1]
xml = subprocess.run(['pdftotext', '-bbox-layout', F, '-'], capture_output=True, text=True).stdout
pages = xml.split('<page ')[1:]

LABELS = ['Situation', 'Raumprogramm', 'Erscheinungsbild', 'Konstruktion', 'Materialisierung/Farbe', 'Materialisierung',
          'Energie/Haustechnik', 'Energie', 'Haustechnik', 'Technik', 'Besonderes', 'Nutzung', 'Nutzungen', 'Wohnungsspiegel',
          'Investorialisierung', 'Ausgangslage', 'Aufgabe', 'Projekt', 'Umbau', 'Sanierung', 'Erweiterung', 'Umgebung', 'Denkmalpflege',
          'Konstruktion/Materialisierung', 'Gestaltung', 'Betrieb', 'Bauablauf', 'Etappierung', 'Akustik', 'Brandschutz']
lab_re = re.compile(r'(?:(?<=\s)|^)(' + '|'.join(re.escape(l) for l in sorted(LABELS, key=len, reverse=True)) + r')(\s*\([^)]{0,40}\))?\s*:\s*')

def clean(t):
    t = re.sub(r'(?<=[a-zäöüß])- (?!(und|oder|bzw|sowie|resp)\b)(?=[a-zäöüß])', '', t)   # Trennstriche
    t = re.sub(r'\b(\w*?f[il]) (?=[a-zäöü]{2})', r'\1', t)                                    # fi/fl-Ligaturen
    t = t.replace('„', '«').replace('“', '»').replace('”', '»').replace('‘', "'").replace('’', "'")
    t = re.sub(r'\s+', ' ', t).strip()
    return t

out = []
for pi, pg in enumerate(pages, 1):
    lines = []
    for lm in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', pg, re.S):
        x0, y0, x1, y1 = map(float, lm.groups()[:4])
        t = html.unescape(' '.join(re.findall(r'>([^<]*)</word>', lm.group(5)))).strip()
        if t: lines.append([x0, y0, x1, y1, t])
    lines.sort(key=lambda l: (round(l[1]), l[0]))
    top = [l for l in lines if l[1] < 300 and 'apb' not in l[4]]
    title = sub = ''
    if top:
        tl = max(top, key=lambda l: l[3] - l[1])
        if tl[3] - tl[1] > 14:
            title = tl[4]
            cand = sorted([l for l in lines if l is not tl and tl[1] + 8 < l[1] < tl[3] + 22 and abs(l[0] - tl[0]) < 10 and not l[4].startswith('Projektinfo')], key=lambda l: l[1])
            if cand: sub = cand[0][4]
    pil = [l for l in lines if l[4].startswith('Projektinformationen')]
    paras = []
    if pil:
        y = pil[0][3]; x0 = pil[0][0]
        col = sorted([l for l in lines if l[1] >= y - 1 and abs(l[0] - x0) < 12 and l[2] < x0 + 330], key=lambda l: l[1])
        maxx = max([l[2] for l in col] or [0]); last = y; cur = []
        for l in col:
            if l[1] - last > 28: break
            if cur and l[1] - last > 6: paras.append(' '.join(cur)); cur = []
            cur.append(l[4]); last = l[3]
            if l[2] < maxx - 30: paras.append(' '.join(cur)); cur = []
        if cur: paras.append(' '.join(cur))
    text = clean(' ¶ '.join(paras))
    secs = []
    for para in [q.strip() for q in text.split('¶') if q.strip()]:
        parts = re.split(r'(?:(?<=[.!?»)])\s|^)([A-ZÄÖÜ][A-Za-zäöüÄÖÜ/\- ]{2,34}?(?: \([^)]{0,40}\))?)\s?:\s*', para)
        if parts[0].strip():
            if secs and secs[-1][0] == '' and len(secs[-1][1]) < 140 and not secs[-1][1].endswith('.'): secs[-1][1] += ' ' + parts[0].strip()
            else: secs.append(['', parts[0].strip()])
        for k in range(1, len(parts) - 1, 2):
            lab = re.sub(r'\s*\(.*\)', '', parts[k]).strip()
            lab = {'Energie/Haustechnik': 'Energie und Haustechnik', 'Materialisierung/Farbe': 'Materialisierung', 'Konstruktion/Materialisierung': 'Konstruktion und Materialisierung'}.get(lab, lab)
            secs.append([lab, parts[k + 1].strip()])
    kv = []
    for l in lines:
        m = re.match(r'^([A-ZÄÖÜ][^:]{1,60}?)\s*:\s*\.{3,}\s*(.*)$', l[4]) or (re.match(r'^([A-ZÄÖÜ][^:.]{1,40}?)\s*:\s*\.*\s*(.+)$', l[4]) if '.....' in l[4] else None)
        if m: kv.append([m.group(1).strip(), clean(m.group(2).strip(' .'))])
    ids = sorted(set('%s-%s' % (a, b.lower()) for a, b in re.findall(r'\b(\d{3})-([A-Za-z]{2,4})-', ' '.join(l[4] for l in lines))))
    out.append({'page': pi, 'title': clean(title), 'sub': clean(sub), 'secs': secs, 'kv': kv, 'ids': ids})
json.dump(out, open('pages2.json', 'w'), ensure_ascii=False, indent=1)
print(len(out))
