#!/usr/bin/env python3
"""Match lecture figures to authored questions; retain original source attribution.
Run extractStudyImages.py first. Matching is automatic; figures are optional study
references, not image-identification questions or independently reviewed answers.
"""
import collections, hashlib, json, math, re, shutil, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
local=ROOT/'.local/study-image-candidates'
data=json.loads((local/'candidates.json').read_text())
ocr=json.loads((local/'ocr.json').read_text()) if (local/'ocr.json').exists() else {}
registered={s['file']:s for s in json.loads((ROOT/'study-data/source-manifest.json').read_text())['sources']}
for source,meta in data['sources'].items():
    assert registered[source]['sha256']==meta['sha256'], f'Source changed: {source}'
stop=set('the a an of and or to in for is are which what how with from by this that these those does do can has have its it into on at as following first next term means describes correct order blank most also known than when would will each through during their all not'.split())
def tokens(text):
    words=re.findall(r'[a-z]{3,}',text.lower())
    return {w[:-1] if w.endswith('s') and len(w)>4 else w for w in words if w not in stop}
excluded={'821f69c199e1ec84f7ac'}
figures=[]
for asset,meta in sorted(data['assets'].items()):
    if asset in excluded: continue
    for occ in meta['occurrences']:
        figures.append((asset,occ,tokens(occ['alt']+' '+ocr.get(asset,'')),tokens(occ['slide_text'])))
df=collections.Counter(t for _,_,a,b in figures for t in a|b)
idf={t:math.log(1+len(figures)/(1+n)) for t,n in df.items()}
assets={};questions={};matches=collections.Counter()
previous=json.loads((ROOT/'study-data/images.json').read_text()) if '--extend' in sys.argv else {'questions':{}}
if '--extend' in sys.argv: assets.update(previous.get('assets',{}))
out=ROOT/'study-assets';out.mkdir(exist_ok=True)
for path in sorted((ROOT/'study-data').glob('*.json')):
    bank=json.loads(path.read_text())
    if not isinstance(bank,list):continue
    for q in bank:
        answer=' '.join(q.get('answers',[])[:1]) if q['type']=='fill_blank' else ' '.join(q['options'][i] for i in q['correct'])
        query=tokens(q['question']+' '+answer+' '+q['explanation']);focus=tokens(answer)
        candidates=[]
        allowed={q['source']['file']}
        if q.get('figure_source'):
            if q['figure_source'] not in registered: raise ValueError(f"Unknown lecture figure source: {q['id']}")
            allowed.add(q['figure_source'])
        if 'Automatic Nervous' in q['source']['file']:
            terms=' '.join(query)
            if query & {'sweat','eccrine','sudomotor','pilomotor','piloerection'}: allowed={'Integumentary System Chapter 5.pptx'}
            elif query & {'synapse','synaptic','reuptake','norepinephrine','acetylcholine','neurotransmitter','ganglion','preganglionic','postganglionic'}: allowed.add('Nervous System and Nervous Tissue Chapter 12.pptx')
            elif query & {'cardiac','heart','pacemaker'}: allowed.add('Circulatory System Chapter 19.pptx')
            elif query & {'adrenal','medulla','epinephrine'}: allowed.add('Endocrine System Chapter 16.pptx')
        for asset,occ,visual,slide in figures:
            if occ['source'] not in allowed: continue
            if allowed=={'Integumentary System Chapter 5.pptx'} and not (tokens(occ['alt']) & {'sweat','eccrine','hair'}): continue
            overlap=sum(idf[t] for t in query & visual)
            slide_overlap=sum(idf[t] for t in query & slide)
            same=occ['source']==q['source']['file'];cited=same and occ['slide'] in q['source']['slides']
            # Actual figure labels/alt text carry more weight than surrounding slide text.
            score=overlap*2+slide_overlap*.3+sum(idf[t] for t in focus&visual)*1.5
            score+=12 if cited else 4 if same else 0
            if not same:score-=7
            candidates.append((score,asset,occ,cited,same))
        if q.get('figure_slide') is not None:
            selected=[candidate for candidate in candidates if candidate[2]['source']==q.get('figure_source',q['source']['file']) and candidate[2]['slide']==q['figure_slide']]
            if not selected: raise ValueError(f"No figure on requested source slide: {q['id']}")
            _,asset,occ,cited,same=max(selected,key=lambda x:x[0])
        elif q['id'] in previous['questions']:
            prior=previous['questions'][q['id']]
            asset=prior['asset']
            occ=next(o for o in data['assets'][asset]['occurrences'] if o['source']==prior['source']['file'] and o['slide']==prior['source']['slide'])
            cited=prior['match']=='cited-slide';same=prior['match']!='related-lecture'
        else:
            cited_candidates=[candidate for candidate in candidates if candidate[3]]
            _,asset,occ,cited,same=max(cited_candidates or candidates,key=lambda x:x[0])
        match='cited-slide' if cited else 'related-slide' if same else 'related-lecture'
        matches[match]+=1
        questions[q['id']]={'asset':asset,'source':{'file':occ['source'],'slide':occ['slide']},'match':match}
        if asset not in assets:
            meta=data['assets'][asset]
            shutil.copyfile(local/meta['file'],out/meta['file'])
            assets[asset]={k:v for k,v in meta.items() if k!='occurrences'}
            assets[asset]['sha256']=hashlib.sha256((out/meta['file']).read_bytes()).hexdigest()
            assets[asset]['occurrences']=meta['occurrences']
for path in out.iterdir():
    if path.suffix in {'.jpg','.png','.gif'} and path.name not in {a['file'] for a in assets.values()}:path.unlink()
manifest={'version':1,'credit':data['default_credit'],'matching':'Automatically matched lecture reference figures; related figures may illustrate broader context. Labels may reveal answers. Original slide text and attribution are retained below.','assets':assets,'questions':questions}
(ROOT/'study-data/images.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'{len(questions)} question references; {len(assets)} images; {sum(a["bytes"] for a in assets.values())/1e6:.1f} MB; {dict(matches)}')
