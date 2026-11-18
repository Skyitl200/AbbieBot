import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { LAB_SETS, labModelsMessage, labQuestions, labModelImage } from '../src/services/study/labModels.js';
import { matchesLabAnswer } from '../src/services/study/answerMatching.js';
const manifest = JSON.parse(readFileSync(new URL('../study-data/lab-models/spinal-cord.json', import.meta.url)));
test('3D Spinal Cord exposes all 12 requested structures under Nervous System without replacing existing sets', () => {
 const set=LAB_SETS.find(s=>s.id==='spinal-cord');
 assert.equal(set.title,'3D Spinal Cord');assert.equal(set.category,'nervous');assert.equal(set.models.length,12);
 assert.deepEqual(set.models.map(m=>m.name),['Cervical enlargement','Cervical plexus','Lumbar enlargement','Conus medullaris','Cauda equina','Filum terminale','Femoral nerve','Sciatic nerve','Phrenic nerve','Brachial plexus (C5 - T1)','Sacral plexus (L4 - S4)','Lumbar plexus']);
 const options=labModelsMessage('u','nervous').components[0].toJSON().components[0].options;
 for(const id of ['spinal-cord','brain-left-sagittal','spinal-nerves'])assert.ok(options.some(o=>o.value===id));
});
test('all marked cards load in both modes, have four distinct choices and accept typed anatomical aliases',()=>{
 for(const mode of ['multiple_choice','typed']){
  const qs=labQuestions('spinal-cord',mode);assert.equal(qs.length,12);assert.equal(new Set(qs.map(q=>q.id)).size,12);
  for(const q of qs){
   const model=manifest.models.find(m=>m.id===q.labModelId);const image=labModelImage(q);assert.ok(image);
   assert.equal(createHash('sha256').update(readFileSync(image.path)).digest('hex'),model.imageSha256);
   if(mode==='multiple_choice'){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.equal(q.options[q.correct[0]],q.modelName);}
   else{assert.equal(q.type,'fill_blank');assert.ok(matchesLabAnswer(model.questions[0].typedAnswers[0],q.answers,q.competingAnswers));}
  }
 }
 const qs=labQuestions('spinal-cord','typed');
 const cervical=qs.find(q=>q.modelName==='Cervical enlargement');assert.equal(matchesLabAnswer('cervical plexus',cervical.answers,cervical.competingAnswers),false);
 const lumbar=qs.find(q=>q.modelName==='Lumbar enlargement');assert.ok(matchesLabAnswer('lumbosacral enlargement',lumbar.answers,lumbar.competingAnswers));
});
test('detail views preserve every source pixel outside the marker and keep each target in frame',()=>{
 const result=execFileSync('python',['-c',`
from PIL import Image,ImageChops
from pathlib import Path
import json,hashlib
root=Path.cwd();data=json.loads((root/'study-data/lab-models/spinal-cord.json').read_text());source=root/'study-assets/lab-models'/data['sourceImageFile']
assert hashlib.sha256(source.read_bytes()).hexdigest()==data['sourceImageSha256']
original=Image.open(source).convert('RGB')
for model in data['models']:
 a=model['annotation'];crop=model['view']['crop'];scale=model['view']['scale'];card=Image.open(root/'study-assets/lab-models'/model['expectedImageFile']).convert('RGB');base=original.crop(crop)
 assert card.size==(base.width*scale,base.height*scale)
 card=card.resize(base.size,Image.Resampling.NEAREST);box=ImageChops.difference(base,card).getbbox();assert box,model['name']
 b=a['bounds'];assert b[0]-crop[0]<=box[0]<box[2]<=b[2]-crop[0] and b[1]-crop[1]<=box[1]<box[3]<=b[3]-crop[1],model['name']
 assert crop[0]<=b[0]<b[2]<=crop[2] and crop[1]<=b[1]<b[3]<=crop[3],model['name']
print('12 original-photo detail views verified')
`],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.match(result,/12 original-photo detail views verified/);
});
