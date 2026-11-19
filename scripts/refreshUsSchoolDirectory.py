"""Build the bundled US directory from official NCES IPEDS HD and completions files."""
import argparse
import collections
import csv
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--year', type=int, default=2024)
args = parser.parse_args()
if not 2020 <= args.year <= 2100:
    parser.error('Use a valid IPEDS dataset year.')
base = 'https://nces.ed.gov/ipeds/datacenter/data/'

def download(name):
    url = base + name + '.zip'
    with urllib.request.urlopen(url, timeout=30) as response:
        raw = response.read(12_000_001)
    if len(raw) > 12_000_000:
        raise ValueError('NCES archive exceeds the download limit.')
    archive = zipfile.ZipFile(io.BytesIO(raw))
    csv_name = next(name for name in archive.namelist() if name.lower().endswith('.csv'))
    if archive.getinfo(csv_name).file_size > 150_000_000:
        raise ValueError('NCES CSV exceeds the extraction limit.')
    return archive, csv_name, {'url': url, 'sha256': hashlib.sha256(raw).hexdigest()}

hd, hd_name, hd_source = download(f'HD{args.year}')
completions, c_name, c_source = download(f'C{args.year}_A')
programs = collections.defaultdict(set)
cip_programs = {'51.0601':'dental-assisting','51.0602':'dental-hygiene','51.0911':'radiography',
    '51.0910':'sonography','51.0908':'respiratory','51.0806':'pta','51.0912':'pa',
    '51.1201':'medicine','51.1901':'medicine'}
with completions.open(c_name) as raw:
    for row in csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig')):
        cip = row['CIPCODE'].strip()
        program = 'nursing' if cip.startswith(('51.38','51.39')) else cip_programs.get(cip)
        if program:
            programs[row['UNITID'].strip()].add(program)
rows = []
with hd.open(hd_name) as raw:
    for r in csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig')):
        if r['ACT'].strip() != 'A' or r['CYACTIVE'].strip() != '1' or r['ICLEVEL'].strip() not in ['1','2','3']:
            continue
        unit_id = r['UNITID'].strip()
        rows.append({'name': r['INSTNM'].strip(), 'alpha_two_code':'US', 'state-province':r['STABBR'].strip(),
            'county':r['COUNTYNM'].strip(), 'city':r['CITY'].strip(), 'unitId':unit_id,
            'web_pages':[r['WEBADDR'].strip()] if r['WEBADDR'].strip() else [],
            'admissionsUrl':r['ADMINURL'].strip(), 'applicationUrl':r['APPLURL'].strip(), 'programs':sorted(programs[unit_id])})
if len(rows) < 4000:
    raise ValueError('Unexpected institution count. Existing directory was not replaced.')
manifest = {'year':args.year, 'institutions':len(rows), 'sources':[hd_source,c_source]}
root = Path(__file__).resolve().parents[1] / 'src/assets/program-updates'
(root/'us-ipeds.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(root/'us-ipeds-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(f'Built {len(rows)} active institution records. Review changes and rerun tests before deploying.')
