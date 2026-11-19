import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { LAB_SETS, labModelsMessage, labQuestions, labModelImage } from '../src/services/study/labModels.js';
import { matchesLabAnswer } from '../src/services/study/answerMatching.js';
const manifest=JSON.parse(readFileSync(new URL('../study-data/lab-models/neuron.json',import.meta.url)));
test('3D Neuron Model contains all 14 requested entries, including two distinct axon views',()=>{
 const set=LAB_SETS.find(s=>s.id==='neuron');assert.equal(set.title,'3D Neuron Model');assert.equal(set.category,'nervous');assert.equal(set.models.length,14);
 assert.deepEqual(set.models.map(m=>m.name),['Soma','Nissl bodies','Dendrite','Synaptic knob','Axon hillock','Initial segment','Axon','Axon','Schwann cell nucleus','Neurolemma','Endoneurium','Node of Ranvier','Schwann cell','Myelin sheath']);
 assert.equal(new Set(set.models.map(m=>m.id)).size,14);assert.equal(new Set(set.models.map(m=>m.expectedImageFile)).size,14);
 const axons=set.models.filter(m=>m.name==='Axon');assert.notEqual(axons[0].viewLabel,axons[1].viewLabel);
 const ids=labModelsMessage('u','nervous').components[0].toJSON().components[0].options.map(o=>o.value);
 assert.ok(ids.includes('neuron'));assert.ok(ids.includes('brain-left-sagittal'));assert.ok(ids.includes('spinal-nerves'));assert.ok(!ids.includes('spinal-cord'));
});
test('both answer modes use the marked full photo and accept anatomical aliases without duplicate axon choices',()=>{
 for(const mode of ['multiple_choice','typed']){
  const qs=labQuestions('neuron',mode);assert.equal(qs.length,14);
  for(const q of qs){const model=manifest.models.find(m=>m.id===q.labModelId),image=labModelImage(q);assert.ok(image);
   assert.equal(createHash('sha256').update(readFileSync(image.path)).digest('hex'),model.imageSha256);
   if(mode==='multiple_choice'){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.equal(q.options[q.correct[0]],q.modelName);}
   else{assert.equal(q.type,'fill_blank');assert.ok(matchesLabAnswer(model.questions[0].typedAnswers[0],q.answers,q.competingAnswers));}
  }
 }
 const qs=labQuestions('neuron','typed'),neurolemma=qs.find(q=>q.modelName==='Neurolemma');
 assert.ok(matchesLabAnswer('neurilemma',neurolemma.answers,neurolemma.competingAnswers));
 assert.equal(matchesLabAnswer('myelin sheath',neurolemma.answers,neurolemma.competingAnswers),false);
 for(const q of qs.filter(q=>q.modelName==='Axon'))assert.ok(matchesLabAnswer('axon',q.answers,q.competingAnswers));
});
test('all cards retain the full native-resolution photo without any crop or enlargement',()=>{
 const result=execFileSync('python',['-c',`
from PIL import Image,ImageChops
from pathlib import Path
import json,hashlib
root=Path.cwd();data=json.loads((root/'study-data/lab-models/neuron.json').read_text());source=root/'study-assets/lab-models'/data['sourceImageFile']
assert hashlib.sha256(source.read_bytes()).hexdigest()==data['sourceImageSha256']
original=Image.open(source).convert('RGB');assert original.size==(646,1024)
for model in data['models']:
 assert model['view']=={'crop':[0,0,646,1024],'scale':1}
 card=Image.open(root/'study-assets/lab-models'/model['expectedImageFile']).convert('RGB');assert card.size==original.size
 box=ImageChops.difference(original,card).getbbox();assert box
 b=model['annotation']['bounds'];assert b[0]<=box[0]<box[2]<=b[2] and b[1]<=box[1]<box[3]<=b[3],model['name']
print('14 complete, unscaled, pixel-preserving model photos verified')
`],{cwd:new URL('..',import.meta.url),encoding:'utf8'});assert.match(result,/14 complete, unscaled/);
});
