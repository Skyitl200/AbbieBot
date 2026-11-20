import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LAB_SETS,LAB_CATEGORIES,labModelsMessage,labModeMessage,labQuestions,labModelImage} from '../src/services/study/labModels.js';
import {matchesLabAnswer} from '../src/services/study/answerMatching.js';
import {gradeQuestion} from '../src/services/study/questions.js';
const data=JSON.parse(readFileSync(new URL('../study-data/lab-models/lower-extremities.json',import.meta.url)));
test('lower extremities set includes all 23 requested muscles and marked photos',()=>{
 const set=LAB_SETS.find(s=>s.id==='lower-extremities');assert.ok(set);assert.equal(set.category,'muscular');
 assert.equal(data.requestedTerms.length,23);assert.equal(data.models.length,23);
 assert.deepEqual(data.pendingStructures,[]);
 assert.deepEqual(new Set(data.models.map(m=>m.name)),new Set(data.requestedTerms));
 assert.ok(!data.models.some(m=>data.pendingStructures.includes(m.name)));
 assert.ok(LAB_CATEGORIES.some(c=>c.id==='muscular'&&c.title==='Muscles'));
 const options=labModelsMessage('u','muscular').components[0].toJSON().components[0].options;
 assert.ok(options.some(o=>o.value==='lower-extremities'));assert.ok(options.some(o=>o.value==='sarcomere'));
 const mode=labModeMessage('u','lower-extremities').embeds[0].toJSON();assert.doesNotMatch(mode.description,/Missing photos/);
 assert.ok(mode.description.length<=4096);
});
test('23 combined prompts cover identification and actions in both answer modes',()=>{
 for(const mode of ['multiple_choice','typed']){
  const qs=labQuestions('lower-extremities',mode);assert.equal(qs.length,23);assert.equal(new Set(qs.map(q=>q.id)).size,23);
  assert.equal(qs.filter(q=>q.targetType==='identity_action').length,23);
  for(const q of qs){
   const model=data.models.find(m=>m.id===q.labModelId),asset=labModelImage(q);assert.ok(asset);
   assert.equal(createHash('sha256').update(readFileSync(asset.path)).digest('hex'),model.imageSha256);
   if(mode==='multiple_choice'){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.correct[0]>=0&&q.correct[0]<4);}
   else{assert.equal(q.type,'fill_blank');assert.ok(gradeQuestion(q,q.answers[0]),q.id);
    const original=model.questions[0];for(let i=0;i<original.options.length;i++)if(i!==original.correct[0])assert.equal(gradeQuestion(q,original.options[i]),false,q.id);}
  }
 }
 for(const name of ['Iliacus','Psoas major'])assert.equal(data.models.find(m=>m.name===name).questions.length,1);
 const iliopsoas=data.models.find(m=>m.name==='Iliopsoas');assert.match(iliopsoas.questions[0].question,/collectively/);
});
test('combined answers ignore case, tolerate typos, and require the correct muscle and action',()=>{
 const qs=labQuestions('lower-extremities','typed');
 for(const q of qs){assert.ok(gradeQuestion(q,q.answers[0].toUpperCase()),q.id);assert.equal(gradeQuestion(q,q.modelName),false);}
 const q=qs.find(q=>q.modelName==='Adductor longus');
 assert.ok(gradeQuestion(q,'ADDUCTOR LONGUS, hip adduction'));
 assert.ok(gradeQuestion(q,'aductor longus — adducts the thigh'));
 assert.equal(gradeQuestion(q,'adductor longus — hip abduction'),false);
 assert.equal(gradeQuestion(q,'gracilis — adducts the thigh'),false);
 const biceps=qs.find(q=>q.modelName==='Biceps femoris');
 assert.ok(gradeQuestion(biceps,'bicep femoris - extends thigh'));
 assert.equal(gradeQuestion(biceps,'biceps femoris - flexes thigh'),false);
 const iliacus=qs.find(q=>q.modelName==='Iliacus');assert.ok(gradeQuestion(iliacus,'ILLIACUS — hip flexion'));
});
test('all lab sets accept uppercase and nearby spelling without confusing structures',()=>{
 for(const set of LAB_SETS)for(const q of labQuestions(set.id,'typed')){
  assert.ok(gradeQuestion(q,q.answers[0].toUpperCase()),q.id);
 }
 assert.ok(matchesLabAnswer('CEREBELUM',['cerebellum'],['cerebrum']));
 assert.equal(matchesLabAnswer('cerebrum',['cerebellum'],['cerebrum']),false);
});
test('supplied photographs remain byte-for-byte and all attachments stay below Discord upload limits',()=>{
 for(const model of data.models){
  const image=labModelImage({labModelId:model.id});const bytes=readFileSync(image.path);assert.ok(bytes.length<8*1024*1024);
  assert.equal(model.renderMethod,'user-provided-marked-photo-unmodified');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),model.imageSha256);
 }
});
