# Builds src/data/bdDistricts.json — simplified SVG paths for Bangladesh's
# 64 districts, used by the landing page's district map.
#
# Source: geoBoundaries BGD ADM2 (Bangladesh Bureau of Statistics; OCHA ROAP),
# licensed CC BY 3.0 IGO. Download the simplified GeoJSON first:
#   curl -L -o /tmp/bgd-adm2.geojson \
#     https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BGD/ADM2/geoBoundaries-BGD-ADM2_simplified.geojson
# Then:
#   python3 scripts/build-bd-districts.py /tmp/bgd-adm2.geojson src/data/divisionCities.json src/data/bdDistricts.json
import json, math, sys
src, divcities, out = sys.argv[1:4]
WIDTH = 600.0          # SVG width in user units
TOL = 1.2             # Douglas–Peucker tolerance (user units)
MIN_AREA = 3.0         # drop slivers/islets smaller than this (sq units)
RENAME = {'Barisal': 'Barishal', 'Bogra': 'Bogura', 'Brahamanbaria': 'Brahmanbaria', 'Nawabganj': 'Chapai Nawabganj',
          'Chittagong': 'Chattogram', 'Jessore': 'Jashore', 'Maulvibazar': 'Moulvibazar', 'Netrakona': 'Netrokona'}
BN = {
 'Dhaka': 'ঢাকা', 'Faridpur': 'ফরিদপুর', 'Gazipur': 'গাজীপুর', 'Gopalganj': 'গোপালগঞ্জ', 'Kishoreganj': 'কিশোরগঞ্জ',
 'Madaripur': 'মাদারীপুর', 'Manikganj': 'মানিকগঞ্জ', 'Munshiganj': 'মুন্সীগঞ্জ', 'Narayanganj': 'নারায়ণগঞ্জ', 'Narsingdi': 'নরসিংদী',
 'Rajbari': 'রাজবাড়ী', 'Shariatpur': 'শরীয়তপুর', 'Tangail': 'টাঙ্গাইল',
 'Bandarban': 'বান্দরবান', 'Brahmanbaria': 'ব্রাহ্মণবাড়িয়া', 'Chandpur': 'চাঁদপুর', 'Chattogram': 'চট্টগ্রাম', 'Comilla': 'কুমিল্লা',
 "Cox's Bazar": 'কক্সবাজার', 'Feni': 'ফেনী', 'Khagrachhari': 'খাগড়াছড়ি', 'Lakshmipur': 'লক্ষ্মীপুর', 'Noakhali': 'নোয়াখালী', 'Rangamati': 'রাঙ্গামাটি',
 'Bogura': 'বগুড়া', 'Chapai Nawabganj': 'চাঁপাইনবাবগঞ্জ', 'Joypurhat': 'জয়পুরহাট', 'Naogaon': 'নওগাঁ', 'Natore': 'নাটোর', 'Pabna': 'পাবনা',
 'Rajshahi': 'রাজশাহী', 'Sirajganj': 'সিরাজগঞ্জ',
 'Bagerhat': 'বাগেরহাট', 'Chuadanga': 'চুয়াডাঙ্গা', 'Jashore': 'যশোর', 'Jhenaidah': 'ঝিনাইদহ', 'Khulna': 'খুলনা', 'Kushtia': 'কুষ্টিয়া',
 'Magura': 'মাগুরা', 'Meherpur': 'মেহেরপুর', 'Narail': 'নড়াইল', 'Satkhira': 'সাতক্ষীরা',
 'Barguna': 'বরগুনা', 'Barishal': 'বরিশাল', 'Bhola': 'ভোলা', 'Jhalokati': 'ঝালকাঠি', 'Patuakhali': 'পটুয়াখালী', 'Pirojpur': 'পিরোজপুর',
 'Habiganj': 'হবিগঞ্জ', 'Moulvibazar': 'মৌলভীবাজার', 'Sunamganj': 'সুনামগঞ্জ', 'Sylhet': 'সিলেট',
 'Dinajpur': 'দিনাজপুর', 'Gaibandha': 'গাইবান্ধা', 'Kurigram': 'কুড়িগ্রাম', 'Lalmonirhat': 'লালমনিরহাট', 'Nilphamari': 'নীলফামারী',
 'Panchagarh': 'পঞ্চগড়', 'Rangpur': 'রংপুর', 'Thakurgaon': 'ঠাকুরগাঁও',
 'Jamalpur': 'জামালপুর', 'Mymensingh': 'ময়মনসিংহ', 'Netrokona': 'নেত্রকোণা', 'Sherpur': 'শেরপুর',
}
division_of = {c: d for d, cs in json.load(open(divcities)).items() for c in cs}

merc = lambda lat: math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))
feats = json.load(open(src))['features']
def rings(geom):
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    return [ring for poly in polys for ring in poly]
allpts = [p for f in feats for r in rings(f['geometry']) for p in r]
x0 = min(p[0] for p in allpts); x1 = max(p[0] for p in allpts)
y0 = max(merc(p[1]) for p in allpts); y1 = min(merc(p[1]) for p in allpts)
scale = WIDTH / (x1 - x0)
height = (y0 - y1) * scale
proj = lambda lng, lat: ((lng - x0) * scale, (y0 - merc(lat)) * scale)

def dp(pts, tol):
    if len(pts) < 3: return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1e-9
    i, dmax = 0, -1
    for k in range(1, len(pts) - 1):
        d = abs(dy * pts[k][0] - dx * pts[k][1] + bx * ay - by * ax) / L
        if d > dmax: i, dmax = k, d
    return dp(pts[:i + 1], tol)[:-1] + dp(pts[i:], tol) if dmax > tol else [pts[0], pts[-1]]
def dp_ring(pts, tol):
    # Closed ring: first == last, so split at the vertex farthest from the
    # start and simplify the two open halves separately.
    if len(pts) < 5: return pts
    far = max(range(len(pts)), key=lambda k: math.hypot(pts[k][0] - pts[0][0], pts[k][1] - pts[0][1]))
    return dp(pts[:far + 1], tol)[:-1] + dp(pts[far:], tol)
def area(r): return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2

districts = []
for f in feats:
    name = RENAME.get(f['properties']['shapeName'], f['properties']['shapeName'])
    parts, cx, cy, best = [], 0, 0, -1
    for ring in rings(f['geometry']):
        pts = [proj(*p) for p in ring]
        if area(pts) < MIN_AREA: continue
        s = dp_ring(pts, TOL)
        if len(s) < 4: continue
        a = area(s)
        if a > best:  # label point: centroid of the largest ring
            best = a; cx = sum(p[0] for p in s) / len(s); cy = sum(p[1] for p in s) / len(s)
        parts.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in s[:-1]) + 'Z')
    districts.append({'name': name, 'bn': BN[name], 'division': division_of[name], 'd': ''.join(parts), 'label': [round(cx, 1), round(cy, 1)]})
assert len(BN) == 64 and {d['name'] for d in districts} == set(BN), 'Bangla names must cover all 64 districts'
districts.sort(key=lambda d: d['name'])
json.dump({
    'source': 'geoBoundaries BGD ADM2 (Bangladesh Bureau of Statistics; OCHA ROAP), CC BY 3.0 IGO',
    'viewBox': f'0 0 {WIDTH:.0f} {height:.0f}',
    # Same projection in JS: x = (lng - x0) * scale; y = (y0 - mercDeg(lat)) * scale
    'projection': {'x0': round(x0, 6), 'y0': round(y0, 6), 'scale': round(scale, 6)},
    'districts': districts,
}, open(out, 'w'), separators=(',', ':'))
print(f"{len(districts)} districts, viewBox 0 0 {WIDTH:.0f} {height:.0f}")
