import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LAB_SETS,LAB_CATEGORIES,labModelsMessage,labModeMessage,labQuestions,labModelImage} from '../src/services/study/labModels.js';
import {matchesLabAnswer} from '../src/services/study/answerMatching.js';
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
test('44 prompts cover identification and supplied actions in both answer modes',()=>{
 for(const mode of ['multiple_choice','typed']){
  const qs=labQuestions('lower-extremities',mode);assert.equal(qs.length,44);assert.equal(new Set(qs.map(q=>q.id)).size,44);
  assert.equal(qs.filter(q=>q.targetType==='identification').length,23);assert.equal(qs.filter(q=>q.targetType==='action').length,21);
  for(const q of qs){
   const model=data.models.find(m=>m.id===q.labModelId),asset=labModelImage(q);assert.ok(asset);
   assert.equal(createHash('sha256').update(readFileSync(asset.path)).digest('hex'),model.imageSha256);
   if(mode==='multiple_choice'){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.correct[0]>=0&&q.correct[0]<4);}
   else{assert.equal(q.type,'fill_blank');assert.ok(matchesLabAnswer(q.answers[0],q.answers,q.competingAnswers),q.id);}
  }
 }
 for(const name of ['Iliacus','Psoas major'])assert.equal(data.models.find(m=>m.name===name).questions.length,1);
 const iliopsoas=data.models.find(m=>m.name==='Iliopsoas');assert.match(iliopsoas.questions[0].question,/collectively/);
});
test('shared correct action aliases are accepted across muscles without accepting an opposite action',()=>{
 const qs=labQuestions('lower-extremities','typed');
 for(const name of ['Pectineus','Adductor longus','Gracilis','Adductor magnus']){
  const q=qs.find(q=>q.modelName===name&&q.targetType==='action');assert.ok(matchesLabAnswer('adducts the thigh',q.answers,q.competingAnswers),name);
  assert.equal(matchesLabAnswer('hip abduction',q.answers,q.competingAnswers),false);
 }
 for(const name of ['Gastrocnemius','Soleus','Fibularis longus']){
  const q=qs.find(q=>q.modelName===name&&q.targetType==='action');assert.ok(matchesLabAnswer('plantar flexion',q.answers,q.competingAnswers),name);
  assert.equal(matchesLabAnswer('dorsiflexion',q.answers,q.competingAnswers),false);
 }
 const biceps=qs.find(q=>q.modelName==='Biceps femoris'&&q.targetType==='identification');assert.ok(matchesLabAnswer('bicep femoris',biceps.answers,biceps.competingAnswers));
 const iliacus=qs.find(q=>q.modelName==='Iliacus');assert.ok(matchesLabAnswer('illiacus',iliacus.answers,iliacus.competingAnswers));
});
test('supplied photographs remain byte-for-byte and all attachments stay below Discord upload limits',()=>{
 for(const model of data.models){
  const image=labModelImage({labModelId:model.id});const bytes=readFileSync(image.path);assert.ok(bytes.length<8*1024*1024);
  assert.equal(model.renderMethod,'user-provided-marked-photo-unmodified');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),model.imageSha256);
 }
});
