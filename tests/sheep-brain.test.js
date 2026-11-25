import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LAB_SETS,labModelsMessage,labQuestions,labModelImage} from '../src/services/study/labModels.js';
import {gradeQuestion} from '../src/services/study/questions.js';
const data=JSON.parse(readFileSync(new URL('../study-data/lab-models/sheep-brain.json',import.meta.url)));
const names=['Mammillary body','Thalamus','Hypothalamus','Optic chiasma','Septum pellucidum','Cerebrum','Corpus callosum','Fornix','Pineal gland','Superior colliculus','Pituitary gland','Cerebellum','Arbor vitae','Spinal cord','Medulla oblongata','Pons','Cerebral aqueduct','Inferior colliculus'];
test('sheep brain contains exactly the requested 18 structures in the nervous-system menu',()=>{
 const set=LAB_SETS.find(s=>s.id==='sheep-brain');assert.equal(set.category,'nervous');assert.equal(set.title,"3D Sheep's Brain Structures");assert.deepEqual(set.models.map(m=>m.name),names);
 assert.ok(labModelsMessage('owner','nervous').components[0].toJSON().components[0].options.some(o=>o.value==='sheep-brain'));
});
test('all sheep brain pictures attach in both modes and answers tolerate case and spelling without swapping structures',()=>{
 for(const mode of ['typed','multiple_choice']){
 const qs=labQuestions('sheep-brain',mode);assert.equal(qs.length,18);assert.equal(new Set(qs.map(q=>q.id)).size,18);
 for(const q of qs){
  const model=data.models.find(m=>m.id===q.labModelId),asset=labModelImage(q);assert.ok(asset);const bytes=readFileSync(asset.path);assert.ok(bytes.length<8*1024*1024);assert.equal(createHash('sha256').update(bytes).digest('hex'),model.imageSha256);
  if(mode==='typed'){
   for(const a of model.questions[0].typedAnswers)assert.ok(gradeQuestion(q,a.toUpperCase()),a);
   for(const a of names.filter(n=>n!==model.name))assert.equal(gradeQuestion(q,a),false,`${model.name} rejects ${a}`);
  }else{assert.equal(new Set(q.options).size,4);assert.equal(q.options[q.correct[0]],model.name);assert.ok(gradeQuestion(q,q.correct));}
 }
 }
 const qs=labQuestions('sheep-brain','typed');assert.ok(gradeQuestion(qs.find(q=>q.modelName==='Corpus callosum'),'corpus calosum'));assert.ok(gradeQuestion(qs.find(q=>q.modelName==='Mammillary body'),'mamillary body'));
});
test('colliculi have distinct targets and arbor vitae marks branching separately from outer cerebellum',()=>{
 const byName=n=>data.models.find(m=>m.name===n).annotation;
 assert.ok(byName('Superior colliculus').tip[1]<byName('Inferior colliculus').tip[1]);
 assert.equal(byName('Arbor vitae').kind,'line');assert.notDeepEqual(byName('Arbor vitae').points[0],byName('Cerebellum').tip);
});
