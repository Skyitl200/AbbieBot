import test from 'node:test';
import assert from 'node:assert/strict';
import { getQuestionPreferences, setQuestionEnabled, enabledQuestions } from '../src/services/study/questionPreferences.js';
import { createQuestionSelection, getQuestionSelection, selectionMessage } from '../src/services/study/questionSelection.js';
import { handleStudyInteraction, countMessage, questionMessage } from '../src/services/study/interface.js';
import { labModeMessage, labQuestions } from '../src/services/study/labModels.js';
import { createStudySession, getStudySession } from '../src/services/study/sessions.js';
import { loadClassQuestions, loadClassQuestionPool } from '../src/services/study/catalog.js';

function storage() {
  let saved=new Map(),tail=Promise.resolve(),fail=false;
  const queries=[];
  const pool={
    async query(sql,params){queries.push([sql,params]);return {rows:saved.has(params[0])?[{value:structuredClone(saved.get(params[0]))}]:[]};},
    async connect(){
      let draft,unlock;
      return {async query(sql,params){
        if(sql.includes('pg_advisory')){const previous=tail;tail=new Promise(resolve=>{unlock=resolve;});await previous;draft=structuredClone(saved);}
        if(sql.startsWith('SELECT value'))return {rows:draft.has(params[0])?[{value:structuredClone(draft.get(params[0]))}]:[]};
        if(sql.startsWith('INSERT')){if(fail)throw new Error('write failed');draft.set(params[0],JSON.parse(params[1]));assert.match(sql,/NULL/);}
        if(sql==='COMMIT')saved=structuredClone(draft);
        return {rows:[]};
      },release(){unlock?.();}};
    }
  };
  return {client:{db:{pool}},queries,fail:()=>{fail=true;},fresh:()=>({db:{pool}})};
}
const q=(id)=>({id,question:`Question ${id}?`,type:'multiple_choice',options:['a','b','c','d'],correct:[0],explanation:'Explanation.',difficulty:'easy'});
function interaction(extras={}){
  const calls=[];
  return {guildId:'g',user:{id:'u'},calls,
    async deferReply(payload){this.deferred=true;calls.push(['deferReply',payload]);},
    async deferUpdate(){this.deferred=true;},
    async editReply(payload){calls.push(['editReply',payload]);},
    async reply(payload){this.replied=true;calls.push(['reply',payload]);},
    async followUp(payload){calls.push(['followUp',payload]);return {id:'public-question'};},...extras};
}

test('preferences persist across clients and stay isolated by member and server',async()=>{
  const s=storage();
  await setQuestionEnabled(s.client,'g','u',q('one'),false);
  assert.ok((await getQuestionPreferences(s.fresh(),'g','u')).one);
  assert.deepEqual(await getQuestionPreferences(s.client,'g','other'),{});
  assert.deepEqual(await getQuestionPreferences(s.client,'other','u'),{});
  await setQuestionEnabled(s.client,'g','u',q('one'),true);
  assert.deepEqual(await getQuestionPreferences(s.fresh(),'g','u'),{});
});

test('concurrent changes preserve every question and repeated OFF never switches ON',async()=>{
  const s=storage();
  await Promise.all(Array.from({length:12},(_,i)=>setQuestionEnabled(s.client,'g','u',q(`q-${i}`),false)));
  await setQuestionEnabled(s.client,'g','u',q('q-0'),false);
  const disabled=await getQuestionPreferences(s.client,'g','u');
  assert.equal(Object.keys(disabled).length,12);
  assert.ok(disabled['q-0']);
});

test('failed saves roll back and degraded storage never silently forgets preferences',async()=>{
  const s=storage();
  await setQuestionEnabled(s.client,'g','u',q('one'),false);
  s.fail();
  await assert.rejects(setQuestionEnabled(s.client,'g','u',q('two'),false),/write failed/);
  assert.deepEqual(Object.keys(await getQuestionPreferences(s.client,'g','u')),['one']);
  s.client.db.useFallback=true;
  await assert.rejects(getQuestionPreferences(s.client,'g','u'),/unavailable/);
});

test('setup controls are present for lecture, saved classes, empty sets, and labs',()=>{
  assert.ok(countMessage('u','Lecture',50,'study:count:u:urinary').components.flatMap(r=>r.toJSON().components).some(b=>b.custom_id==='study:configurelecture:u:urinary'));
  assert.ok(countMessage('u','Chemistry',5,'study:coursecount:u:chem_lecture:random').components.flatMap(r=>r.toJSON().components).some(b=>b.custom_id==='study:configurecourse:u:chem_lecture:random'));
  assert.ok(countMessage('u','Empty',0,'study:count:u:urinary').components.flatMap(r=>r.toJSON().components).some(b=>b.label==='Choose questions'));
  assert.ok(labModeMessage('u','spinal-nerves').components.flatMap(r=>r.toJSON().components).some(b=>b.custom_id==='study:configurelab:u:spinal-nerves'));
});

test('question picker paginates all questions and shows exact ON/OFF target states',()=>{
  const questions=Array.from({length:30},(_,i)=>q(`q-${i}`));
  const context=createQuestionSelection('g','u',questions,{title:'Test set'});
  const payload=selectionMessage(context,{'q-0':{id:'q-0'}},0);
  const options=payload.components[0].toJSON().components[0].options;
  assert.equal(options.length,10);
  assert.equal(options[0].value,'on|q-0');
  assert.equal(options[1].value,'off|q-1');
  assert.equal(selectionMessage(context,{},2).components[0].toJSON().components[0].options.length,10);
  assert.equal(payload.embeds[0].toJSON().fields.length,10);
  assert.throws(()=>getQuestionSelection(context.id,'g','other'),/expired/);
  assert.throws(()=>getQuestionSelection(context.id,'other','u'),/expired/);
});

test('before-set choices filter both lab modes and can be restored in a later visit',async()=>{
  const s=storage();
  const open=interaction();
  await handleStudyInteraction(open,s.client,['configurelab','u','spinal-nerves']);
  const payload=open.calls.at(-1)[1];
  const menu=payload.components[0].toJSON().components[0];
  assert.equal(menu.options.length,10);
  const [, , , token]=menu.custom_id.split(':');
  const offValue=menu.options[0].value;
  const id=offValue.slice(offValue.indexOf('|')+1);
  const change=interaction({values:[offValue]});
  await handleStudyInteraction(change,s.client,['configselect','u',token,'0']);
  assert.match(change.calls.at(-1)[1].content,/saved/);
  // Simulate a retry of the same select delivery; the target stays OFF.
  await handleStudyInteraction(interaction({values:[offValue]}),s.client,['configselect','u',token,'0']);
  for(const mode of ['multiple_choice','typed']){
    const start=interaction({values:[mode]});
    await handleStudyInteraction(start,s.fresh(),['labmode','u','spinal-nerves']);
    const published=start.calls.find(([type])=>type==='followUp')[1];
    const control=published.components[0].toJSON().components[0].custom_id.split(':');
    const session=getStudySession('g','u',control[3]);
    assert.equal(session.questions.length,16);
    assert.equal(session.questions.some(question=>question.id===id),false);
  }
  await handleStudyInteraction(interaction({values:[`on|${id}`]}),s.client,['configselect','u',token,'0']);
  assert.deepEqual(await getQuestionPreferences(s.fresh(),'g','u'),{});
  assert.equal(enabledQuestions(labQuestions('spinal-nerves','typed'),{}).length,17);
});

test('foreign controls cannot change saved settings or view another member picker',async()=>{
  const s=storage();
  const context=createQuestionSelection('g','u',[q('one')],{title:'Set'});
  const foreign=interaction({user:{id:'other'},values:['off|one']});
  await handleStudyInteraction(foreign,s.client,['configselect','u',context.id,'0']);
  assert.match(foreign.calls[0][1].content,/another student/);
  assert.deepEqual(await getQuestionPreferences(s.client,'g','u'),{});
});

test('during-test button saves choice without scoring, skipping, or affecting another user',async()=>{
  const s=storage();
  const session=createStudySession('g','u',[q('one')],'random');
  session.classId='ap_lecture';
  assert.ok(questionMessage(session).components.flatMap(r=>r.toJSON().components).some(b=>b.label==='Toggle this question off'));
  await handleStudyInteraction(interaction(),s.client,['prefquestion','u',session.id,'0','0','off']);
  assert.equal(session.score,0);
  assert.equal(session.answered,false);
  assert.equal(session.index,0);
  assert.ok((await getQuestionPreferences(s.client,'g','u')).one);
  assert.deepEqual(await getQuestionPreferences(s.client,'g','other'),{});
});

test('all questions OFF leaves a setup recovery button instead of an empty session',async()=>{
  const s=storage();
  for(const question of labQuestions('spinal-nerves','multiple_choice'))await setQuestionEnabled(s.client,'g','u',question,false);
  const start=interaction({values:['typed']});
  await handleStudyInteraction(start,s.client,['labmode','u','spinal-nerves']);
  assert.equal(start.calls.some(([type])=>type==='followUp'),false);
  const payload=start.calls.at(-1)[1];
  assert.match(payload.embeds[0].toJSON().description,/No enabled questions/);
  assert.ok(payload.components.flatMap(r=>r.toJSON().components).some(b=>b.custom_id==='study:configurelab:u:spinal-nerves'));
});

test('saved-bank SQL excludes disabled IDs before random LIMIT; picker loads full pool',async()=>{
  const calls=[];
  const raw={id:42,question:'Question?',option_a:'a',option_b:'b',option_c:'c',option_d:'d',correct_answer:'A'};
  const client={db:{pool:{async query(sql,params){calls.push([sql,params]);return {rows:sql.startsWith('SELECT *')?[raw]:[{category:'Topic',count:1}]};}}}};
  await loadClassQuestions(client,'chem_lecture','random',5,{excludedIds:['saved-7','saved-9']});
  const [sql,params]=calls.at(-1);
  assert.match(sql,/NOT \('saved-' \|\| id::text = ANY\(\$2::text\[\]\)\).*ORDER BY RANDOM\(\) LIMIT \$3/);
  assert.deepEqual(params[1],['saved-7','saved-9']);
  assert.equal(params[2],5);
  const questions=await loadClassQuestionPool(client,'chem_lecture','random');
  assert.equal(questions[0].id,'saved-42');
  assert.doesNotMatch(calls.at(-1)[0],/LIMIT|NOT/);
});
