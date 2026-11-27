import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {LAB_SETS,labQuestions,labModelImage} from '../src/services/study/labModels.js';
const manifest=JSON.parse(readFileSync(new URL('../study-data/lab-models/nerves.json',import.meta.url)));
test('nerve set has the ten marked structures including the reference-matched coccygeal region',()=>{
    const set=LAB_SETS.find(s=>s.id==='nerves');assert.equal(set.title,'3D Model of the Nerves');assert.equal(set.category,'nervous');
    assert.equal(set.models.length,10);assert.deepEqual(set.pendingStructures,[]);
    assert.deepEqual(set.models.map(m=>m.name),['Thoracic nerves','Sciatic nerve','Tibial nerve','Common fibular nerve','Femoral nerve','Radial nerve','Median nerve','Ulnar nerve','Axillary nerve','Coccygeal nerve']);
    for(const mode of ['multiple_choice','typed']) {
        const questions=labQuestions('nerves',mode);assert.equal(questions.length,10);
        for(const q of questions){assert.ok(labModelImage(q));if(mode==='multiple_choice'){assert.equal(q.options[q.correct[0]],q.modelName);assert.equal(new Set(q.options).size,4);}else assert.ok(q.answers.length);}
    }
});
test('original images and generated cards match the manifest hashes',()=>{
    for(const source of Object.values(manifest.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../study-assets/lab-models/'+source.file,import.meta.url))).digest('hex'),source.sha256);
    for(const model of manifest.models.filter(m=>m.verificationStatus==='ready'))assert.equal(createHash('sha256').update(readFileSync(new URL('../study-assets/lab-models/'+model.expectedImageFile,import.meta.url))).digest('hex'),model.imageSha256);
});
test('each card preserves the complete native photo except for its pointer overlay',()=>{
    execFileSync('python',['-c',`
import json
from PIL import Image,ImageChops
from pathlib import Path
root=Path.cwd();data=json.loads((root/'study-data/lab-models/nerves.json').read_text())
for model in data['models']:
 if model['verificationStatus']=='pending':continue
 original=Image.open(root/'study-assets/lab-models'/data['sources'][model['sourceKey']]['file']).convert('RGB')
 card=Image.open(root/'study-assets/lab-models'/model['expectedImageFile']).convert('RGB')
 assert original.size==card.size
 assert model['view']=={'crop':[0,0,*original.size],'scale':1}
 bounds=ImageChops.difference(original,card).getbbox();assert bounds
 a=model['annotation']
 if a['kind']=='region':
  x,y=a['target'];r=a['radius'];points=[[x-r,y-r],[x+r,y+r]]
 else:points=[a['target'],a['tail']]
 assert min(p[0] for p in points)-12<=bounds[0] and max(p[0] for p in points)+12>=bounds[2]
 assert min(p[1] for p in points)-12<=bounds[1] and max(p[1] for p in points)+12>=bounds[3]
`],{cwd:new URL('..',import.meta.url)});
});
