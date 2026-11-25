import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LAB_SETS,labModelsMessage,labQuestions,labModelImage} from '../src/services/study/labModels.js';
import {gradeQuestion} from '../src/services/study/questions.js';
const data=JSON.parse(readFileSync(new URL('../study-data/lab-models/meninge-protection.json',import.meta.url)));
const names=['Periosteum','Skin of scalp','Bone of skull','Periosteal','Meningeal','Dura mater','Arachnoid mater','Pia mater','Blood vessels','Vein','Arachnoid villus','Subarachnoid space'];
test('meninge protection has the exact 12 requested structures and nervous-system menu entry',()=>{
 const set=LAB_SETS.find(s=>s.id==='meninge-protection');assert.equal(set.category,'nervous');assert.equal(set.title,'3D Meninge Protection of the Brain');assert.deepEqual(set.models.map(m=>m.name),names);
 assert.ok(labModelsMessage('u','nervous').components[0].toJSON().components[0].options.some(o=>o.value==='meninge-protection'));
});
test('both modes attach all images and typed aliases ignore case without confusing neighboring layers',()=>{
 for(const mode of ['typed','multiple_choice']){
 const qs=labQuestions('meninge-protection',mode);assert.equal(qs.length,12);assert.equal(new Set(qs.map(q=>q.id)).size,12);
 for(const q of qs){const m=data.models.find(m=>m.id===q.labModelId),asset=labModelImage(q);assert.ok(asset);const bytes=readFileSync(asset.path);assert.ok(bytes.length<8*1024*1024);assert.equal(createHash('sha256').update(bytes).digest('hex'),m.imageSha256);
 if(mode==='typed'){for(const a of m.questions[0].typedAnswers)assert.ok(gradeQuestion(q,a.toUpperCase()),a);for(const a of names.filter(n=>n!==m.name))assert.equal(gradeQuestion(q,a),false,`${m.name} rejects ${a}`);}
 else{assert.equal(new Set(q.options).size,4);assert.equal(q.options[q.correct[0]],m.name);assert.ok(gradeQuestion(q,q.correct));}}
 }
 const qs=labQuestions('meninge-protection','typed');assert.ok(gradeQuestion(qs.find(q=>q.modelName==='Arachnoid mater'),'arachniod mater'));assert.ok(gradeQuestion(qs.find(q=>q.modelName==='Subarachnoid space'),'subarachnoid spce'));
});
test('dura is bracketed while outer periosteum, dural layers and the subarachnoid space have distinct pointers',()=>{
 const m=n=>data.models.find(m=>m.name===n);assert.equal(m('Dura mater').annotation.kind,'bracket');
 assert.notDeepEqual(m('Periosteum').annotation.tip,m('Periosteal').annotation.tip);assert.notDeepEqual(m('Periosteal').annotation.tip,m('Meningeal').annotation.tip);assert.notDeepEqual(m('Arachnoid mater').annotation.tip,m('Subarachnoid space').annotation.tip);
});
