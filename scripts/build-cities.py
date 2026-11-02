"""Convert the GeoNames cities15000 export (CC BY 4.0) to bundled map labels.

Usage: python3 scripts/build-cities.py /path/to/cities15000.zip
Source: https://download.geonames.org/export/dump/
"""
import json
from pathlib import Path
import sys
from zipfile import ZipFile

with ZipFile(sys.argv[1]) as archive:
    rows = archive.read('cities15000.txt').decode('utf-8').splitlines()
cities = []
for row in rows:
    fields = row.split('\t')
    # Avoid districts, abandoned places, and historical settlement records.
    if fields[6] != 'P' or fields[7] in {'PPLX', 'PPLH', 'PPLQ', 'PPLW'}:
        continue
    cities.append([fields[1], round(float(fields[4]), 5), round(float(fields[5]), 5), int(fields[14] or 0)])
cities.sort(key=lambda city: (-city[3], city[0]))
target = Path(__file__).resolve().parents[1] / 'src' / 'cities.json'
target.write_text(json.dumps(cities, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'{len(cities)} places, {target.stat().st_size:,} bytes')
