import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LAB_SETS,labModelsMessage,labQuestions,labModelImage} from '../src/services/study/labModels.js';
import {gradeQuestion} from '../src/services/study/questions.js';
const data=JSON.parse(readFileSync(new URL('../study-data/lab-models/brain-ventricles.json',import.meta.url)));
const names=['Lateral ventricle','Septum pellucidum','Third ventricle','Fourth ventricle','Cerebral aqueduct','Anterior horn','Interventricular foramen','Central canal'];
test('brain ventricles includes eight requested terms in the nervous-system lab',()=>{
 const set=LAB_SETS.find(s=>s.id==='brain-ventricles');assert.equal(set.category,'nervous');assert.deepEqual(set.models.map(m=>m.name),names);assert.ok(labModelsMessage('u','nervous').components[0].toJSON().components[0].options.some(o=>o.value==='brain-ventricles'));
});
test('both modes attach marked gray-wall views and grade aliases without confusing neighboring structures',()=>{
 for(const mode of ['typed','multiple_choice']){
 const qs=labQuestions('brain-ventricles',mode);assert.equal(qs.length,8);
 for(const q of qs){const m=data.models.find(m=>m.id===q.labModelId),asset=labModelImage(q);assert.ok(asset);const bytes=readFileSync(asset.path);assert.ok(bytes.length<8*1024*1024);assert.equal(createHash('sha256').update(bytes).digest('hex'),m.imageSha256);assert.match(m.sourceImageFile,/gray/);
 if(mode==='typed'){for(const a of m.questions[0].typedAnswers)assert.ok(gradeQuestion(q,a.toUpperCase()),a);for(const n of names.filter(n=>n!==m.name))assert.equal(gradeQuestion(q,n),false,`${m.name} rejects ${n}`);}
 else{assert.equal(new Set(q.options).size,4);assert.equal(q.options[q.correct[0]],m.name);assert.ok(gradeQuestion(q,q.correct));}}
 }
 const qs=labQuestions('brain-ventricles','typed');assert.ok(gradeQuestion(qs.find(q=>q.modelName==='Third ventricle'),'thid ventricle'));assert.ok(gradeQuestion(qs.find(q=>q.modelName==='Interventricular foramen'),'interventricular foamen'));
});
test('septum question explicitly asks for an absent membrane’s normal position rather than falsely labeling cast tissue',()=>{
 const m=data.models.find(m=>m.name==='Septum pellucidum');assert.equal(m.targetType,'normal-anatomical-position');assert.match(m.questions[0].question,/membrane itself is not shown/);assert.equal(data.models.find(m=>m.name==='Cerebral aqueduct').targetType,'model-structure');
});
