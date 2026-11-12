#!/usr/bin/env python3
"""Build a reviewable lecture image refresh, using figure content rather than slide proximity.

Default is a dry run. --apply downloads selected CC BY figures and writes the index.
No original lecture assets are deleted. Low-evidence matches retain their existing image
and are explicitly listed for review; automated matching is not anatomical verification.
"""
import argparse, collections, concurrent.futures, hashlib, io, json, math, re
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REVISION = '9af501aa6e13a75d85003fed4ed1051e9d07b7dc'
BASE = f'https://raw.githubusercontent.com/openstax/osbooks-anatomy-physiology/{REVISION}/media/'
STOP = set('a an and are as at be been by can correct describe describes description do does each example figure following for from has have how in into is it its matches means most of on only or question shown that the their these this those to term than through what when where which with would best primarily main human body system physiology anatomical structure structures'.split())
SYNONYMS = {'erythrocyte':'rbc', 'erythrocytes':'rbc', 'leukocyte':'wbc', 'leukocytes':'wbc', 'oesophagus':'esophagus', 'oestrogen':'estrogen', 'adrenaline':'epinephrine', 'noradrenaline':'norepinephrine'}
CONCEPTS = {'pulmonary ventilation':'Inspiration and Expiration', 'extensibility':'The Sliding Filament Model of Muscle Contraction', 'elasticity':'The Sliding Filament Model of Muscle Contraction', 'excitability':'Stages of an Action Potential', 'denaturation':'The Shape of Proteins', 'serca':'Relaxation of a Muscle Fiber', 'smooth er':'The Endoplasmic Reticulum', 'polyuria':'Urine Formation', 'recoil':'Inspiration and Expiration', 'central nervous system':'Central and Peripheral Nervous System', 'integumentary system':'Layers of the Skin', 'alimentary canal':'Components of the Digestive System', 'matter':'Elements of the Human Body', 'intracellular fluid':'Fluid Compartments in the Human Body'}
CHAPTERS = {'anatomical_directions':{1}, 'basic_chemistry':{2}, 'living_cells':{3}, 'tissues':{4}, 'integumentary':{5}, 'skeletal':{6,7,8}, 'joints':{9}, 'muscular':{10,11}, 'nervous_tissue':{12}, 'central_nervous':{13,14}, 'autonomic_nervous':{15}, 'special_senses':{14,16}, 'endocrine':{18}, 'blood_cells':{19}, 'circulatory':{20}, 'blood_vessels':{21}, 'lymphatic':{22}, 'immune':{22}, 'respiratory':{23}, 'digestive':{24,25}, 'urinary':{26}, 'fluid_balance':{27}, 'reproductive':{28,29}}

def words(text):
    result = set()
    for word in re.findall(r'[a-z]+', text.lower()):
        if word in STOP or len(word) < 3: continue
        word = SYNONYMS.get(word, word)
        if word.endswith('ies'): word = word[:-3] + 'y'
        elif word.endswith('s') and not word.endswith(('ss','us','is')): word = word[:-1]
        result.add(word)
    return result

def chapter(figure):
    explicit = re.match(r'Figure_(\d+)_', figure['file'])
    if explicit: return int(explicit[1])
    match = re.search(r'(?:Figure_)?(\d+)', figure['file'])
    if not match: return 0
    value = match[1]
    return int(value[:2]) if len(value) >= 4 else int(value[0])

def answer(question):
    return ' '.join(question.get('answers', [])[:1]) if question['type'] == 'fill_blank' else ' '.join(question['options'][i] for i in question['correct'])

def build():
    index = json.loads((ROOT/'study-data/images.json').read_text())
    catalog = json.loads((ROOT/'scripts/data/openstax-anatomy-figures.json').read_text())
    # Third-party photos/micrographs need separate rights review. Use original diagrams here.
    catalog = [f for f in catalog if not re.search(r'credit:|modification|micrograph|photograph|photo of|photo by|wikimedia|©|this table|tables describe', ' '.join(f[k] for k in ('caption','alt','title')), re.I)]
    candidates = []
    for f in catalog:
        candidates.append({'key':f['file'], 'figure':f, 'title':words(f['title']), 'visual':words(f['title']+' '+f['caption']+' '+f['alt']), 'chapter':chapter(f)})
    local = ROOT/'.local/study-image-candidates'
    ocr = json.loads((local/'ocr.json').read_text()) if (local/'ocr.json').exists() else {}
    for key, asset in index['assets'].items():
        if asset.get('provider') == 'openstax' and not asset.get('occurrences'): continue
        for occurrence in asset.get('occurrences',[]):
            candidates.append({'key':key, 'occurrence':occurrence, 'title':words(occurrence.get('alt','')), 'visual':words(occurrence.get('alt','')+' '+ocr.get(key,'')), 'source':occurrence['source']})
    counts = collections.Counter(t for c in candidates for t in c['visual'])
    weights = {t:math.log(1+len(candidates)/(1+n)) for t,n in counts.items()}
    def weight(terms): return sum(weights.get(t, 0) for t in terms)
    usage = collections.Counter()
    decisions = []
    selected = {}
    for path in sorted((ROOT/'study-data').glob('*.json')):
        bank = json.loads(path.read_text())
        if not isinstance(bank,list): continue
        pool = [c for c in candidates if c.get('chapter') in CHAPTERS.get(path.stem,set()) or c.get('source') == bank[0]['source']['file']]
        for q in bank:
            concept = re.split(r'—|–| - ', answer(q).lower())[0].strip()
            preferred = CONCEPTS.get(concept)
            focus = words(answer(q))
            query = words(q['question']+' '+q['explanation'])
            ranked = []
            for c in pool:
                common = focus & c['visual']
                context = query & c['visual']
                # A nearby slide or a shared generic organ name alone is insufficient.
                evidence = weight(common)
                if not common or (evidence < 3 and len(context) < 3): continue
                coverage = evidence/max(weight(focus),1)
                score = 5*evidence + 3*weight(focus & c['title']) + weight(context) + 10*coverage
                score /= 1 + .003*len(c['visual'])
                ranked.append((score,c,sorted(common),coverage))
            ranked.sort(key=lambda item:(-item[0],item[1]['key']))
            # Preserve explicitly authored visual-identification slide references.
            locked = q.get('figure_slide') is not None or bool(q.get('figure_source'))
            if (not ranked and not preferred) or locked:
                decisions.append({'id':q['id'],'status':'authored' if locked else 'needs-review','answer':answer(q)})
                continue
            preferred_candidate = next((c for c in candidates if c.get('figure',{}).get('title') == preferred), None) if preferred else None
            if preferred_candidate and not locked:
                selected[q['id']] = preferred_candidate
                usage[preferred_candidate['key']] += 1
                decisions.append({'id':q['id'],'status':'curated-concept','answer':answer(q),'figure':preferred_candidate['key']})
                continue
            if not ranked:
                decisions.append({'id':q['id'],'status':'needs-review','answer':answer(q)})
                continue
            best = ranked[0]
            # Variety is only a tie-breaker between equally relevant figures.
            tied = [r for r in ranked if r[0] >= best[0]*.98 and r[3] >= best[3]-.01]
            best = min(tied,key=lambda r:(usage[r[1]['key']],-r[0],r[1]['key']))
            score,c,terms,coverage = best
            if coverage < .35:
                decisions.append({'id':q['id'],'status':'needs-review','answer':answer(q),'candidate':c['key'],'coverage':round(coverage,3)})
                continue
            selected[q['id']] = c
            usage[c['key']] += 1
            decisions.append({'id':q['id'],'status':'matched','answer':answer(q),'figure':c['key'],'terms':terms,'coverage':round(coverage,3),'score':round(score,2)})
    return index,selected,decisions

def download(figure):
    url = BASE+quote(figure['file'])
    cache = ROOT/'.local/openstax-lecture-figures'/figure['file']
    cache.parent.mkdir(parents=True,exist_ok=True)
    if cache.exists(): raw = cache.read_bytes()
    else:
        with urlopen(url,timeout=90) as response: raw = response.read()
        cache.write_bytes(raw)
    # Keep the original bytes and labels. Reject unsupported/oversized media.
    with Image.open(io.BytesIO(raw)) as image:
        image.verify()
    with Image.open(io.BytesIO(raw)) as image:
        width,height = image.size
        extension = {'JPEG':'jpg','PNG':'png','GIF':'gif'}[image.format]
    if len(raw)>7_500_000: raise ValueError(f'Figure too large: {url}')
    digest = hashlib.sha256(raw).hexdigest()
    key = digest[:20]
    name = f'{key}.{extension}'
    (ROOT/'study-assets'/name).write_bytes(raw)
    return figure['file'],key,{'file':name,'sha256':digest,'bytes':len(raw),'width':width,'height':height,'provider':'openstax','title':figure['title'],'caption':figure['caption'],'alt':figure['alt'],'url':url,'revision':REVISION,'license':'https://creativecommons.org/licenses/by/4.0/','credit':'OpenStax, Anatomy and Physiology (release 1rc), CC BY 4.0.','occurrences':[]}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    args = parser.parse_args()
    index,selected,decisions = build()
    report = {'note':'Automated content-based matching, not manual semantic verification. Uncertain matches retain prior images.','counts':dict(collections.Counter(d['status'] for d in decisions)),'figures':len({c['key'] for c in selected.values()}),'decisions':decisions}
    report_path = ROOT/'.local/lecture-image-review.json'
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='decisions'}),flush=True)
    if args.apply:
        figures = {c['key']:c['figure'] for c in selected.values() if 'figure' in c}
        downloaded = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            for name,key,asset in executor.map(download,figures.values()):
                downloaded[name] = key
                # Identical image bytes may already occur in uploaded lecture slides.
                # Keep those occurrences so both citation types remain valid.
                asset['occurrences'] = index['assets'].get(key,{}).get('occurrences',[])
                index['assets'][key] = asset
        for qid,c in selected.items():
            if 'figure' in c:
                key = downloaded[c['key']]
                index['questions'][qid] = {'asset':key,'source':{'kind':'open-textbook','url':index['assets'][key]['url']},'match':'figure-content'}
            else:
                o = c['occurrence']
                index['questions'][qid] = {'asset':c['key'],'source':{'file':o['source'],'slide':o['slide']},'match':'figure-content'}
        index['matching'] = report['note']
        (ROOT/'study-data/images.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
        print(f'Wrote image index; downloaded {len(downloaded)} textbook figures.',flush=True)
