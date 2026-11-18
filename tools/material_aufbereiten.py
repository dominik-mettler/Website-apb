"""Bereitet geliefertes Projektmaterial für die Website vor (Auswahl, Bildunterschriften, Pläne, Daten).
Aufruf: python3 -I prep.py <material/Projekte> <repo>/content/projekte
"""
import sys, os, json, glob, subprocess
from PIL import Image, ImageOps, ImageChops

SRC, DST = sys.argv[1], sys.argv[2]

def find(proj, name):
    hits = glob.glob(os.path.join(SRC, proj, '**', name), recursive=True)
    assert hits, (proj, name)
    return hits[0]

# (Datei, Bildunterschrift) – Aussenaufnahmen ohne Unterschrift
SEL = {
 '333-kff': ('333-KFF', [
   ('333-KFF-Aussen-DSC10315.jpg', ''),
   ('333-KFF-Aussen-Pos3-DSC11240.jpg', ''),
   ('333-KFF-Innen-0-EG-Empfang-Pos6-DSC10906.jpg', 'Empfang'),
   ('333-KFF-Innen-0-EG-Gemeinschaftsraum-Pos6-DSC10352.jpg', 'Gemeinschaftsraum'),
   ('333-KFF-Innen-0-EG-Vorzone-Pos6-DSC10441.jpg', 'Begegnungszone'),
   ('333-KFF-Innen-0-EG-Pflegezimmer-Raum-Pos3-DSC10371.jpg', 'Pflegezimmer'),
   ('333-KFF-Innen-1-OG-Familienzimmer-Pos8-DSC10538.jpg', 'Familienzimmer'),
   ('333-KFF-Innen-1-OG-TH-Pos1-DSC10808.jpg', 'Treppenhaus'),
   ('333-KFF-Innen-1-OG-Teekueche-Pos3-DSC10476.jpg', 'Aufenthaltsraum mit Teeküche'),
   ('333-KFF-Innen-2-OG-Multifunktionsraum-Pos6-DSC10609.jpg', 'Multifunktionsraum'),
   ('333-KFF-Innen-2-OG-Raum-der-Stille-Pos3-DSC10786.jpg', 'Raum der Stille'),
   ('333-KFF-Innen-UG-Snoezelen-Pos2-DSC11072.jpg', 'Snoezelen-Raum'),
 ], [
   ('333-KFF-Situation.pdf', 'Situation'),
   ('333-KFF-GR-EG.pdf', 'Grundriss Erdgeschoss – Pflegeabteilung'),
   ('333-KFF-GR-OG.pdf', 'Grundriss 2. Obergeschoss – Veranstaltungsbereich mit Mehrzweckraum'),
   ('333-KFF-QS02.pdf', 'Schnitt'),
   ('333-KFF-QS04.pdf', 'Schnitt'),
   ('333-KFF-FA-Sued-Ost.pdf', 'Ansicht Südost'),
 ]),
 '329-sam': ('329-SAM', [
   ('329-SAM-00-Aussen-DSC03787b.jpg', ''),
   ('329-SAM-00-Aussen-NO-Sonne-StorenAuf-DSC03790.jpg', ''),
   ('329-SAM-00-Aussen-Spielplatz-DSC04058b.jpg', 'Aussenspielbereich'),
   ('329-SAM-01-Treppenhaus-DSC03880b-2.jpg', 'Treppenhaus'),
   ('329-SAM-12-Garderobe-DSC04055b.jpg', 'Garderobe aus massiver Eiche'),
   ('329-SAM-15-Schulzimmer1-DSC03940b-2.jpg', 'Klassenzimmer'),
   ('329-SAM-15-Schulzimmer3-DSC04000b-2.jpg', 'Klassenzimmer'),
   ('329-SAM-05-Schulzimmer1-leer-Sonne-StorenAuf-LichtAn1-DSC03830.jpg', 'Klassenzimmer'),
   ('329-SAM-16-Gruppenraum-DSC04010b-2.jpg', 'Gruppenraum'),
 ], [
   ('329-SAM-Situation.pdf', 'Situation'),
   ('329-SAM-GR-EG.pdf', 'Grundriss Erdgeschoss – links neuer Trakt E, rechts bestehender Trakt D'),
   ('329-SAM-QS01.pdf', 'Querschnitt durch das Treppenhaus'),
   ('329-SAM-LS02.pdf', 'Längsschnitt'),
   ('329-SAM-Fassade-Ost.pdf', 'Ansicht Ost'),
   ('329-SAM-Fassade-Sued.pdf', 'Ansicht Süd'),
 ]),
 '334-sbg': ('334-SBG', [
   ('334-SBG-Fassade-241015-IMG_3492.jpg', ''),
   ('334-SBG-Luftbild-250615-DJI_20250615091841_0023_D.jpg', ''),
   ('334-SBG-Innen-Lernlandschaft-DSC01486.jpg', 'Lernlandschaft'),
   ('334-SBG-Innen-Lernlandschaft-DSC01527.jpg', 'Lernlandschaft'),
   ('334-SBG-Innen-Lernlandschaft-DSC01547.jpg', 'Lernlandschaft'),
   ('334-SBG-Innen-Lernlandschaft-DSC01572.jpg', 'Lernlandschaft'),
   ('334-SBG-Laufbahn-250519-IMG_6108.jpg', 'Laufbahn'),
   ('334-SBG-PV-Anlage-241015-IMG_3504.jpg', 'Photovoltaikanlage'),
   ('334-SBG-Waermepumpe-IMG_7934.jpg', 'Wärmepumpen'),
 ], [('334-SBG-Situation.pdf', 'Situation')]),
 '341-spu': ('341-SPU', [
   ('250826-DSC00066.jpg', ''),
   ('341-SPU-Aussen-0-UG-Haupteingang-260815-IMG_3351.jpg', 'Haupteingang Hort'),
   ('341-SPU-Innen-0-UG-Korridor-260815-IMG_3322.jpg', 'Hort – Korridor'),
   ('341-SPU-Innen-0-UG-Eingang-260815-IMG_3335.jpg', 'Hort – Eingang'),
   ('341-SPU-Innen-0-UG-Kueche-260815-IMG_3308.jpg', 'Hort – Küche'),
   ('250826-DSC00067.jpg', 'Hauswartwohnung – Treppenhaus'),
   ('250826-DSC00071.jpg', 'Hauswartwohnung – Korridor'),
   ('250826-DSC00098.jpg', 'Hauswartwohnung – Küche'),
   ('250826-DSC00108.jpg', 'Hauswartwohnung – Zimmer'),
 ], [('341-SPU-Situation.pdf', 'Situation')]),
 '344-miu': ('344-MIU', [
   ('344-MIU-Aussen-8-2.jpg', ''),
   ('344-MIU-Whg-203-5-Wohnzimmer-2.jpg', 'Wohnung 203 – Wohnzimmer'),
   ('344-MIU-Whg-203-3-K*che-2.jpg', 'Wohnung 203 – Küche'),
   ('344-MIU-Whg-203-6-Zimmer1.jpg', 'Wohnung 203 – Zimmer'),
   ('344-MIU-Whg-203-2-Bad-2.jpg', 'Wohnung 203 – Bad'),
   ('344-MIU-Whg-201-4-Wohnzimmer-1.jpg', 'Wohnung 201 – Wohnzimmer'),
   ('344-MIU-Whg-201-7-Kueche-1.jpg', 'Wohnung 201 – Küche'),
   ('344-MIU-Whg-201-8-Essen.jpg', 'Wohnung 201 – Essbereich'),
   ('344-MIU-Whg-306-1-Garderobe.jpg', 'Wohnung 306 – Garderobe'),
   ('344-MIU-Whg-306-8-Kuechenausblick.jpg', 'Wohnung 306 – Ausblick aus der Küche'),
 ], [('344-MIU-Situation.pdf', 'Situation')]),
 '347-gtv': ('347-GTV', [
   ('347-GTV-Aussen-260611-IMG_3598.jpg', ''),
   ('347-GTV-Aussen-260611-IMG_3601.jpg', ''),
   ('347-GTV-Aussen-IMG_6892-2.jpg', ''),
   ('347-GTV-Innen-0-EG-Werkstatt-IMG_7298.jpg', 'Werkstatt'),
   ('347-GTV-Innen-0-EG-Werkstatt-IMG_7334.jpg', 'Werkstatt'),
   ('347-GTV-Innen-0-EG-Treppe-IMG_7310.jpg', 'Treppe'),
   ('347-GTV-Innen-1-OG-B*ro-IMG_7303.jpg', 'Büro'),
   ('347-GTV-Innen-1-OG-B*ro-IMG_7315.jpg', 'Büro'),
   ('347-GTV-Innen-1-OG-B*ro-IMG_7332.jpg', 'Büro'),
 ], [('347-GTV-Situation.pdf', 'Situation')]),
}

def trim(im, pad=30):
    g = im.convert('L')
    bg = Image.new('L', g.size, 255)
    bbox = ImageChops.difference(g, bg).point(lambda v: 255 if v > 12 else 0).getbbox()
    if not bbox: return im
    x0, y0, x1, y1 = bbox
    return im.crop((max(0, x0-pad), max(0, y0-pad), min(im.width, x1+pad), min(im.height, y1+pad)))

for pid, (folder, photos, plans) in SEL.items():
    out = os.path.join(DST, pid); os.makedirs(out + '/fotos', exist_ok=True); os.makedirs(out + '/plaene', exist_ok=True)
    meta = {'id': pid, 'fotos': [], 'plaene': []}
    for i, (name, cap) in enumerate(photos, 1):
        f = find(folder, name)
        im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
        # Einheitliche Formate: Querformat 3:2, Hochformat 4:5
        size = (2400, 1600) if im.width >= im.height else (1600, 2000)
        im = ImageOps.fit(im, size, Image.LANCZOS, centering=(0.5, 0.5))
        fn = '%02d.jpg' % i
        im.save(os.path.join(out, 'fotos', fn), quality=84, optimize=True, progressive=True)
        meta['fotos'].append({'datei': 'fotos/' + fn, 'unterschrift': cap, 'original': os.path.basename(f), 'groesse': im.size})
    for i, (name, cap) in enumerate(plans, 1):
        f = find(folder, name)
        base = os.path.join(out, 'plaene', '%02d' % i)
        DPI = 400
        subprocess.run(['pdftoppm', '-r', str(DPI), '-png', '-singlefile', '-gray', f, base], check=True)
        im = Image.open(base + '.png').convert('L')
        # Planbeschriftung (Plannummer, Massstab, Format) aus dem PDF-Text lesen und weissen
        txt = subprocess.run(['pdftotext', '-bbox', f, '-'], capture_output=True, text=True).stdout
        from PIL import ImageDraw
        dr = ImageDraw.Draw(im); k = DPI / 72.0
        import re as _re
        for m in _re.finditer(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"', txt):
            x0, y0, x1, y1 = [float(v) * k for v in m.groups()]
            dr.rectangle((x0 - 6, y0 - 6, x1 + 6, y1 + 6), fill=255)
        im = trim(im, pad=0)
        # Einheitliches Format 3:2, Zeichnung zentriert mit Rand
        CW, CH = 2400, 1600; inner = (int(CW * 0.9), int(CH * 0.88))
        sc = min(inner[0] / im.width, inner[1] / im.height)
        im = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
        canvas = Image.new('L', (CW, CH), 255)
        canvas.paste(im, ((CW - im.width) // 2, (CH - im.height) // 2))
        im = canvas
        im.save(base + '.png', optimize=True)
        meta['plaene'].append({'datei': 'plaene/%02d.png' % i, 'unterschrift': cap, 'original': os.path.basename(f), 'groesse': im.size})
    json.dump(meta, open(os.path.join(out, 'auswahl.json'), 'w'), ensure_ascii=False, indent=1)
    print(pid, len(meta['fotos']), 'Fotos', len(meta['plaene']), 'Pläne')
