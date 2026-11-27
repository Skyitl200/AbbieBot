import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LAB_SETS,labModelsMessage,labQuestions,labModelImage} from '../src/services/study/labModels.js';
import {gradeQuestion} from '../src/services/study/questions.js';
const data=JSON.parse(readFileSync(new URL('../study-data/lab-models/ear-model.json',import.meta.url)));
const names=['Helix','Auricle','Lobule','External auditory canal','Tympanic membrane','Malleus','Incus','Stapes','Oval window','Cochlea','Vestibule','Semicircular canals','Auditory tube','Vestibulocochlear nerve (CN VIII)'];
test('ear model includes all 14 structures in Special Senses alongside the separate inner ear set',()=>{
 const set=LAB_SETS.find(s=>s.id==='ear-model');assert.equal(set.category,'special-senses');assert.equal(set.title,'3D Model of the Ear');assert.deepEqual(set.models.map(m=>m.name),names);
 const opts=labModelsMessage('owner','special-senses').components[0].toJSON().components[0].options;assert.ok(opts.some(o=>o.value==='ear-model'));assert.ok(opts.some(o=>o.value==='inner-ear'));
});
test('all 14 images attach and both modes grade correct answers without swapping neighboring ear structures',()=>{
 for(const mode of ['typed','multiple_choice']){
  const qs=labQuestions('ear-model',mode);assert.equal(qs.length,14);assert.equal(new Set(qs.map(q=>q.id)).size,14);
  for(const q of qs){const m=data.models.find(m=>m.id===q.labModelId),asset=labModelImage(q);assert.ok(asset);const bytes=readFileSync(asset.path);assert.ok(bytes.length<8*1024*1024);assert.equal(createHash('sha256').update(bytes).digest('hex'),m.imageSha256);
   if(mode==='typed'){
    for(const a of m.questions[0].typedAnswers)assert.ok(gradeQuestion(q,a.toUpperCase()),a);
    for(const n of names.filter(n=>n!==m.name))assert.equal(gradeQuestion(q,n),false,`${m.name} rejects ${n}`);
   }else{assert.equal(new Set(q.options).size,4);assert.equal(q.options[q.correct[0]],m.name);assert.ok(gradeQuestion(q,q.correct));}
  }
 }
 const qs=labQuestions('ear-model','typed');assert.ok(gradeQuestion(qs.find(q=>q.modelName==='Tympanic membrane'),'tympanic membrne'));assert.ok(gradeQuestion(qs.find(q=>q.modelName==='Vestibulocochlear nerve (CN VIII)'),'CN 8'));assert.ok(gradeQuestion(qs.find(q=>q.modelName==='Auricle'),'PINNA'));
});
test('small ossicles and oval window retain distinct reference targets',()=>{
 const targets=names.slice(5,9).map(n=>data.models.find(m=>m.name===n).annotation.tip.join(','));assert.equal(new Set(targets).size,4);
});
