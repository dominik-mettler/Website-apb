# Englisch: Kenndaten, Rollen, Bildlegenden, Pläne (Regeln + Wörterbuch, siehe GLOSSAR.md)
import re

KAT = {'wohnen': 'Living', 'lernen': 'Learning', 'leiten': 'Public administration', 'glauben': 'Worship', 'pflegen': 'Care',
       'reisen': 'Travel', 'kaufen': 'Retail', 'arbeiten': 'Work', 'turnen': 'Sport', 'beleuchten': 'Lighting'}
STATUS = {'Realisiert': 'Completed', 'Nicht realisiert': 'Not built', 'In Planung': 'In planning', 'In Ausführung': 'Under construction',
          'Projekt': 'Project', 'Wettbewerb': 'Competition'}
VIDEO = {'Film der Baustellen-Webcam, 2016 – 2017': 'Construction site webcam film, 2016 – 2017'}

SCHLUESSEL = {'Status': 'Status', 'Bearbeitung': 'Scope of services', 'Bauherr': 'Client', 'Fertigstellung': 'Completion',
              'Bauzeit': 'Construction period', 'Adresse': 'Address', 'Kosten': 'Cost', 'Kenndaten': 'Key figures',
              'Verfahren': 'Procurement', 'Label': 'Label', '1. Etappe Neubau': 'Phase 1: new build',
              '2. Etappe Aufstockung': 'Phase 2: additional storey', 'Kennwerte': 'Cost benchmarks', 'Auszeichnung': 'Award'}

EXAKT = {
    'SIA-Phasen 2.1 Vorstudie bis 5.3 Inbetriebnahme': 'SIA stages 2.1 (preliminary study) to 5.3 (commissioning)',
    'SIA-Phasen 2.1 und 3.1 bis 5.3': 'SIA stages 2.1 and 3.1 to 5.3',
    'SIA-Phasen 3.1 Vorprojekt bis 5.3 Inbetriebnahme': 'SIA stages 3.1 (preliminary design) to 5.3 (commissioning)',
    'SIA-Phasen 3.2 Bauprojekt (überarb.) bis 5.3 Inbetriebnahme': 'SIA stages 3.2 (design development, revised) to 5.3 (commissioning)',
    'Vorprojekt': 'Preliminary design',
    'Vorprojekt bis Ausführung': 'Preliminary design to construction',
    'Vorprojekt bis Bauprojekt': 'Preliminary design to design development',
    'Direktauftrag': 'Direct commission',
    'Planerwahl 1. Rang': 'Consultant selection, 1st place',
    'Planerwahl. 1. Rang': 'Consultant selection, 1st place',
    'Wettbewerb 1. Rang': 'Design competition, 1st place',
    'Baupreis 03 Forum Architektur Zürcher Oberland': 'Building Award 03, Zurich Oberland Architecture Forum',
    'n.v.': 'n/a',
    'Februar – August 2026, 2 Etappen unter Betrieb': 'February – August 2026, 2 phases while in operation',
    '12.8 Mio. Fr. (BKP 1–9, inkl. MwSt., Arealentwicklung 1. + 2. Etappe)': 'CHF 12.8 million (BKP 1–9, incl. VAT, site development phases 1 + 2)',
    "ca. 18'300 m3 GV (SIA 416, Arealentwicklung 1. + 2. Etappe)": 'approx. 18,300 m³ building volume (SIA 416, site development phases 1 + 2)',
    'Realisiert': 'Completed', 'Nicht realisiert': 'Not built',
    'MINERGIE-P (ZH-769-P)': 'MINERGIE-P (ZH-769-P)',
    'Tot.: 2.6 Mio. Fr. (BKP 1-9) Erw.:1.5 Mio. Fr. (BKP 1-9)': 'Total: CHF 2.6 million (BKP 1–9), extension: CHF 1.5 million (BKP 1–9)',
    'Fassadenfläche ca. 8\'000 m2': 'Façade area approx. 8,000 m²',
    '1456 m3 (Bestand), 337 m3 (Neubau) (SIA 416)': '1,456 m³ existing, 337 m³ new build (SIA 416)',
    'Erweiterung 815 m3 (GV), 225 m2 (GF) (SIA 416)': 'Extension: 815 m³ building volume, 225 m² floor area (SIA 416)',
    'ca. 8\'700 m3 GV, ca. 2\'540 m2 GF (nach 2. Etappe)': 'approx. 8,700 m³ building volume, approx. 2,540 m² floor area (after phase 2)',
}

BAUHERR = {
    'Baugesellschaft Lediweg, Uster': 'Baugesellschaft Lediweg, Uster',
    'Baugesellschaft Seegarten, Uster': 'Baugesellschaft Seegarten, Uster',
    'Gemeinde Gossau, Liegenschaftsabteilung': 'Municipality of Gossau, property department',
    'Gemeinde Gossau, v. d. Liegenschaftsabteilung': 'Municipality of Gossau, represented by the property department',
    'Gemeinde Grüningen': 'Municipality of Grüningen',
    'Gemeinde Herrliberg, v. d. Liegenschaftsabteilung': 'Municipality of Herrliberg, represented by the property department',
    'Gemeinde Hombrechtikon, v. d. Liegenschaftsabteilung': 'Municipality of Hombrechtikon, represented by the property department',
    'Gemeinde Küsnacht': 'Municipality of Küsnacht',
    'Gemeinde Maur': 'Municipality of Maur',
    'Gemeinde Wald': 'Municipality of Wald',
    'Gemeinde Wald, v. d. Liegenschaftsabteilung': 'Municipality of Wald, represented by the property department',
    'Kat. Pfarrei Bruder Klaus, Volketswil': 'Catholic Parish of Bruder Klaus, Volketswil',
    'Konsortium «Teienstrasse», Feldmeilen': '“Teienstrasse” consortium, Feldmeilen',
    'Primarschule Uster, v. d. Liegenschaftsabteilung': 'Uster Primary School, represented by the property department',
    'Primarschulpflege Schwerzenbach': 'Schwerzenbach Primary School Board',
    'Private Bauherrschaft': 'Private client',
    'RAK AG Immobilien- und Baugesellschaft, Uster': 'RAK AG Immobilien- und Baugesellschaft, Uster',
    'Röm.-Kath. Kirchgemeinde Dübendorf': 'Roman Catholic Parish of Dübendorf',
    'Röm.-Kath. Kirchgemeinde Pfäiffikon ZH': 'Roman Catholic Parish of Pfäffikon ZH',
    'Römisch - Katholische Kirchgemeinde Dübendorf': 'Roman Catholic Parish of Dübendorf',
    'SBB AG': 'SBB AG (Swiss Federal Railways)',
    'SBB AG Zürich': 'SBB AG (Swiss Federal Railways), Zurich',
    'SBB AG, Bern': 'SBB AG (Swiss Federal Railways), Bern',
    'Schulpflege Hombrechtikon, Hombrechtikon': 'Hombrechtikon School Board',
    'Schulpflege Nänikon-Greifensee': 'Nänikon-Greifensee School Board',
    'Schulpflege Sekundarstufe Uster': 'Uster Secondary School Board',
    'Stadt Uster, Liegenschaftsabteilung': 'City of Uster, property department',
    'Stadt Uster, Primarschulpflege': 'City of Uster, Primary School Board',
    'Stadt Uster, v. d. Gesundheitsabteilung': 'City of Uster, represented by the health department',
    'Stadt Uster, v. d. Liegenschaftsabteilung': 'City of Uster, represented by the property department',
    'Stiftung Kinderhospiz Schweiz': 'Stiftung Kinderhospiz Schweiz (Swiss Children’s Hospice Foundation)',
}

MON = [('Januar', 'January'), ('Februar', 'February'), ('März', 'March'), ('April', 'April'), ('Mai', 'May'), ('Juni', 'June'),
       ('Juli', 'July'), ('August', 'August'), ('September', 'September'), ('Oktober', 'October'), ('November', 'November'),
       ('Dezember', 'December'), ('Aug.', 'Aug.'), ('Frühling', 'spring'), ('Herbst', 'autumn'), ('Anfang', 'early')]

def _zahl(m):  # 1'073'828 -> 1,073,828
    return m.group(0).replace("'", ',')

def wert(v):
    if v in EXAKT: return EXAKT[v]
    if v in BAUHERR: return BAUHERR[v]
    s = v
    # Kennwerte
    s = re.sub(r"([\d']+) Fr\./m3 \(BKP 2/m3 (?:GV|SIA 416)\), ([\d']+) Fr\./m2 \(BKP 2/m2 GF\)",
               r"CHF \1/m³ building volume, CHF \2/m² floor area (BKP 2)", s)
    # Beträge
    s = re.sub(r"(\d[\d.]*)\s*Mio\.?\s*Fr\.?", r"CHF \1 million", s)
    s = re.sub(r"(\d{1,3}(?:'\d{3})+)\s*Fr\.", r"CHF \1", s)
    s = re.sub(r"\(BKP-2\)", "(BKP 2)", s)
    s = s.replace('(BKP 1-9)', '(BKP 1–9)').replace('(BKP 1-5)', '(BKP 1–5)')
    s = s.replace(' (gemäss KV)', ' (per cost estimate)').replace('inkl. MwSt.', 'incl. VAT')
    # Flächen und Volumen
    s = re.sub(r"m3 \(GV\)|m3 GV", "m³ building volume", s)
    s = re.sub(r"m2 \(GF\)|m2 GF", "m² floor area", s)
    s = s.replace('m3', 'm³').replace('m2', 'm²')
    # Zeit
    for d, e in MON: s = re.sub(r'\b' + re.escape(d) + r'(?=[\s\-–,]|$)', e, s)
    s = re.sub(r'\bca\.\s*', 'approx. ', s)
    s = re.sub(r'(\d+) Monate\b', r'\1 months', s).replace('1 Monat', '1 month')
    s = s.replace('in mehreren Etappen', 'in several phases').replace('in Etappen', 'in phases').replace('in 3 Etappen', 'in 3 phases')
    s = s.replace('unter Betrieb', 'while in operation').replace('(Umgebung)', '(grounds)')
    s = s.replace('Wettbewerb ', 'Competition ').replace('Ausführung ', 'construction ')
    s = re.sub(r"\d{1,3}(?:'\d{3})+", _zahl, s)
    s = re.sub(r'(?<=\d)-(?=\d)|(?<=[a-z])-(?=[A-Z0-9])', '–', s)
    s = re.sub(r'\s+[-–]\s+', ' – ', s)
    s = re.sub(r'(\d{4})[-–]([A-Za-z])', r'\1 – \2', s)
    s = re.sub(r'\b(\d)(\d{3}) (m[²³])', r'\1,\2 \3', s)
    if s.startswith(('spring', 'autumn', 'early')): s = s[0].upper() + s[1:]
    return s

DEUTSCH = re.compile(r'\b(und|bis|der|die|das|mit|von|nach|für|Etappe|Monat\w*|Gemeinde|Stadt|Fr\.|Mio|ca\.|Bestand|Neubau|inkl)\b')

def gleich(v): return False

def fakt(a, b, fehlend, wo):
    k = SCHLUESSEL.get(a)
    if k is None: fehlend.setdefault(a, set()).add(wo + ' fakt-schluessel'); k = a
    if a == 'Adresse': return [k, b]
    if a == 'Bauherr' and b not in BAUHERR: fehlend.setdefault(b, set()).add(wo + ' bauherr')
    n = wert(b)
    if DEUTSCH.search(n) and b not in BAUHERR: fehlend.setdefault(b + '  →  ' + n, set()).add(wo + ' fakt')
    return [k, n]

ROLLEN = {
    'Akustik': 'Acoustics', 'Altlasten': 'Contaminated sites', 'Architekt': 'Architect', 'Architekt Ausführung': 'Architect (construction)',
    'Architekt Projektierung': 'Architect (design)', 'Architekt/Bauleitung': 'Architect / site supervision', 'Architektur / Bauleitung': 'Architecture / site supervision',
    'Architektur, Bauleitung': 'Architecture, site supervision', 'Architektur, Generalplaner': 'Architecture, general planner', 'Arztpraxis': 'Medical practice',
    'Bau- & Projektleiter': 'Construction & project manager', 'Baubiologie': 'Building biology', 'Bauherren-Vertretung': 'Client’s representative',
    'Bauherrenvertretung': 'Client’s representative', 'Bauingenieur': 'Structural engineer', 'Bauingenieur (Beton)': 'Structural engineer (concrete)',
    'Bauingenieur (Holz)': 'Structural engineer (timber)', 'Bauingenieur (Holzbau)': 'Structural engineer (timber)', 'Bauingenieur Stahlbeton': 'Structural engineer (reinforced concrete)',
    'Bauleiter': 'Site supervisor', 'Bauleitung': 'Site supervision', 'Bauphysik': 'Building physics', 'Bauphysik und Akustik': 'Building physics and acoustics',
    'Bewirtschaftung': 'Property management', 'Bodenuntersuchungen': 'Ground investigation', 'Elektro': 'Electrical', 'Elektroingenieur': 'Electrical engineer',
    'Energieberatung': 'Energy consultant', 'Entwässerung': 'Drainage', 'GP / Architektur, Bauleitung': 'General planning / architecture, site supervision',
    'Gastropl.': 'Catering planner', 'Gastroplaner': 'Catering planner', 'Gebäudeschadstoffe': 'Building pollutants', 'Generalplaner / Bauleitung': 'General planner / site supervision',
    'Generalplanung, Architektur, Bauleitung': 'General planning, architecture, site supervision', 'Generalplanung, Bauleitung': 'General planning, site supervision',
    'Generalunternehmer': 'General contractor', 'Geologe': 'Geologist', 'Geometer': 'Surveyor', 'Gest. Leitung': 'Design lead',
    'HL+PV Ingenieur': 'Heating, ventilation & PV engineer', 'HLK': 'HVAC', 'HLK Ingenieur': 'HVAC engineer', 'HLKKS': 'HVAC, refrigeration & plumbing',
    'HLKS': 'HVAC & plumbing', 'HLKS Ingenieur': 'HVAC & plumbing engineer', 'HLKS Koordination': 'HVAC & plumbing coordination', 'HLKS-Ingenieur': 'HVAC & plumbing engineer',
    'HLKS-Ingenieur, Bauphysik': 'HVAC & plumbing engineer, building physics', 'HLS': 'Heating, ventilation & plumbing', 'HLS Ingenieur': 'Heating, ventilation & plumbing engineer',
    'HLS-Ingenieur': 'Heating, ventilation & plumbing engineer', 'Haustechnik': 'Building services', 'Heizung': 'Heating', 'Heizung/Lüftung': 'Heating / ventilation',
    'Heizungingenieur': 'Heating engineer', 'Heizungs-/Sanitäringenieur': 'Heating / plumbing engineer', 'Holzbau': 'Timber construction', 'Holzbauingenieur': 'Timber engineer',
    'Holzbauingenieur, Brandschutz': 'Timber engineer, fire safety', 'Innenarch.': 'Interior architecture', 'Innenarchitekt/Lichtplanung': 'Interior architect / lighting design',
    'Innenarchitektur / Lichtplanung': 'Interior architecture / lighting design', 'Innenausbau': 'Interior fit-out', 'Kanalisation': 'Sewerage',
    'Klimaanlage': 'Air conditioning', 'L/K-Ingenieur': 'Ventilation / air-conditioning engineer', 'L/K/K': 'Ventilation, air conditioning & refrigeration',
    'Landschaftsarchitekt': 'Landscape architect', 'Landschaftsarchitektur': 'Landscape architecture', 'Lichtplaner': 'Lighting designer', 'Lichtplanung': 'Lighting design',
    'Lüftung': 'Ventilation', 'Lüftungsingenieur': 'Ventilation engineer', 'Projektleiter': 'Project manager', 'Projektleiterin': 'Project manager',
    'Projektleitung': 'Project management', 'Sanitär': 'Plumbing', 'Sanitär-/Lüftungingenieur': 'Plumbing / ventilation engineer', 'Sanitäringenieur': 'Plumbing engineer',
    'Shop': 'Shop', 'Stv': 'Deputy',
}
def rolle(a, fehlend, wo):
    if a in ROLLEN: return ROLLEN[a]
    fehlend.setdefault(a, set()).add(wo + ' rolle'); return a

CAP = {
    'Aufenthaltsraum mit Teeküche': 'Lounge with kitchenette', 'Aussenfoyer': 'Outdoor foyer', 'Aussenspielbereich': 'Outdoor play area', 'Bad': 'Bathroom',
    'Begegnungszone': 'Meeting area', 'Büro': 'Office', 'Dachterrasse': 'Roof terrace', 'Eingang': 'Entrance', 'Eingang mit Garderobe': 'Entrance with cloakroom',
    'Eingangsbereich': 'Entrance area', 'Einspielzimmer': 'Warm-up room', 'Empfang': 'Reception', 'Ensembleraum': 'Ensemble room', 'Familienzimmer': 'Family room',
    'Fenster vor der Sanierung': 'Windows before refurbishment', 'Garderobe': 'Cloakroom', 'Garderobe aus massiver Eiche': 'Cloakroom in solid oak',
    'Gemeinschaftsraum': 'Common room', 'Gruppenraum': 'Group room', 'Gruppenraum im Anbau': 'Group room in the extension', 'Gruppenraum im Dachgeschoss': 'Group room in the attic',
    'Halle': 'Hall', 'Haupteingang Hort': 'Main entrance of the after-school care centre', 'Hauswartwohnung – Korridor': 'Caretaker’s flat – corridor',
    'Hauswartwohnung – Küche': 'Caretaker’s flat – kitchen', 'Hauswartwohnung – Treppenhaus': 'Caretaker’s flat – staircase', 'Hauswartwohnung – Zimmer': 'Caretaker’s flat – room',
    'Holzfassade': 'Timber façade', 'Hort': 'After-school care', 'Hort – Eingang': 'After-school care – entrance', 'Hort – Korridor': 'After-school care – corridor',
    'Hort – Küche': 'After-school care – kitchen', 'Kaffeeküche': 'Kitchenette', 'Kindergartenraum': 'Kindergarten room', 'Kindergartenraum mit Küche': 'Kindergarten room with kitchen',
    'Klassenzimmer': 'Classroom', 'Klassenzimmer im Dachgeschoss': 'Classroom in the attic', 'Korridor': 'Corridor', 'Küche': 'Kitchen', 'Laufbahn': 'Running track',
    'Lehrerzimmer': 'Staff room', 'Lehrerzimmer im Dachgeschoss': 'Staff room in the attic', 'Lehrerzimmer mit Küche': 'Staff room with kitchen',
    'Lernlandschaft': 'Open learning area', 'Luftraum': 'Void', 'Mediathek': 'Media library', 'Mehrzweckraum': 'Multi-purpose room', 'Multifunktionsraum': 'Multi-purpose room',
    'Neue Fenster': 'New windows', 'Nordfassade vor der Sanierung': 'North façade before refurbishment', 'Oberlicht': 'Skylight', 'Pausenhalle': 'Covered break area',
    'Personalrestaurant': 'Staff restaurant', 'Pflegezimmer': 'Care room', 'Photovoltaikanlage': 'Photovoltaic system', 'Raum der Stille': 'Room of silence',
    'Saal': 'Hall', 'Sanitärraum': 'Washroom', 'Sekretariat': 'Office', 'Situationsplan': 'Site plan', 'Sitzungszimmer': 'Meeting room',
    'Sitzungszimmer Verwaltung': 'Administration meeting room', 'Snoezelen-Raum': 'Snoezelen (multi-sensory) room', 'Spielplatz': 'Playground', 'Studio': 'Studio',
    'Treppe': 'Stairs', 'Treppenhaus': 'Staircase', 'Unterrichtszimmer': 'Teaching room', 'Werkstatt': 'Workshop', 'Wettbewerbsmodell': 'Competition model',
    'Wohnen und Essen': 'Living and dining', 'Wohnung 201 – Essbereich': 'Apartment 201 – dining area', 'Wohnung 201 – Küche': 'Apartment 201 – kitchen',
    'Wohnung 201 – Wohnzimmer': 'Apartment 201 – living room', 'Wohnung 203 – Bad': 'Apartment 203 – bathroom', 'Wohnung 203 – Küche': 'Apartment 203 – kitchen',
    'Wohnung 203 – Wohnzimmer': 'Apartment 203 – living room', 'Wohnung 203 – Zimmer': 'Apartment 203 – bedroom', 'Wohnung 306 – Ausblick aus der Küche': 'Apartment 306 – view from the kitchen',
    'Wohnung 306 – Garderobe': 'Apartment 306 – cloakroom', 'Wärmepumpen': 'Heat pumps', 'Zimmer': 'Room',
}
def cap(v): return CAP.get(v)

PLAN = {
    'Ansicht Nordwest': 'North-west elevation', 'Ansicht Ost': 'East elevation', 'Ansicht Süd': 'South elevation', 'Ansicht Südost': 'South-east elevation',
    'Ansicht Südwest': 'South-west elevation', 'Ansicht West': 'West elevation', 'Grundriss 1. Obergeschoss': 'First-floor plan',
    'Grundriss 1. Obergeschoss (Aufstockung)': 'First-floor plan (additional storey)', 'Grundriss 2. Obergeschoss (Aufstockung)': 'Second-floor plan (additional storey)',
    'Grundriss 2. Obergeschoss – Veranstaltungsbereich mit Mehrzweckraum': 'Second-floor plan – event area with multi-purpose room',
    'Grundriss Dachgeschoss': 'Attic floor plan', 'Grundriss Erdgeschoss': 'Ground-floor plan', 'Grundriss Erdgeschoss – Pflegeabteilung': 'Ground-floor plan – care unit',
    'Grundriss Erdgeschoss – links neuer Trakt E, rechts bestehender Trakt D': 'Ground-floor plan – new wing E on the left, existing wing D on the right',
    'Längsschnitt': 'Longitudinal section', 'Querschnitt': 'Cross-section', 'Querschnitt durch das Treppenhaus': 'Cross-section through the staircase',
    'Schnitt': 'Section', 'Situation': 'Site plan',
}
def plan(v): return PLAN.get(v)

WETTBEWERB = {'Neubau Schulhaus Aussergass': 'New Aussergass School', 'Neubau MFH Siedlung': 'New housing development',
              'Neubau MFH': 'New apartment building', 'Anbau Pfarreizentrum Bruder Klaus': 'Extension to the Bruder Klaus parish centre',
              'Neubau Schulhaus Krämeracker': 'New Krämeracker School', 'Neubau INTEGRA-Werkstätten': 'New INTEGRA workshops',
              '1. Rang, Realisiert': '1st place, built'}
def wettbewerb(t, fehlend):
    teile = [x.strip() for x in t.split('///')]
    out = []
    for x in teile:
        if x in WETTBEWERB: out.append(WETTBEWERB[x])
        elif re.fullmatch(r'[A-ZÄÖÜ][\wäöü\- ]+', x) and ' ' not in x: out.append(x)   # Ortsname
        else: fehlend.setdefault(x, set()).add('wettbewerb'); out.append(x)
    return ' /// '.join(out)
