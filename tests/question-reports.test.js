import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudySession, submitStudyAnswer, nextStudyQuestion } from '../src/services/study/sessions.js';
import { resultMessage, handleStudyInteraction } from '../src/services/study/interface.js';
import { questionReportModal, submitQuestionReport, QUESTION_REPORT_CHANNEL_ID } from '../src/services/study/reports.js';
import { labQuestions } from '../src/services/study/labModels.js';

const q = { id: 'original-q', type: 'multiple_choice', question: 'Which structure is marked?', options: ['First structure','Second structure'], correct: [0], explanation: 'First is correct.', difficulty: 'easy' };
const fixture = (questions = [structuredClone(q), { ...structuredClone(q), id: 'next-q', question: 'A different question?' }]) => {
    const session = createStudySession('1540000000000000000', `report-user-${Math.random()}`, questions, 'random');
    session.classId = 'ap_lab'; session.topicLabel = 'Test model'; session.publicQuestionId = '1540000000000000002';
    if (questions[0].options) session.displayOrder = questions[0].options.map((_, i) => i).reverse();
    submitStudyAnswer(session, questions[0].type === 'fill_blank' ? questions[0].answers[0] : questions[0].correct);
    session.reward = { status: 'saved', amount: 10, balance: 110 };
    const interaction = { guildId: session.guildId, channelId: '1540000000000000001', user: { id: session.userId } };
    return { session, interaction };
};
const tokenOf = modal => modal.toJSON().custom_id.split(':').at(-1);
function submission(interaction, issue = 'The image pointer appears to be on the wrong structure. @everyone') {
    const replies = [];
    return { ...interaction, replies, fields: { getTextInputValue: name => { assert.equal(name, 'issue'); return issue; } },
        async deferReply(payload) { assert.equal(payload.flags, 64); }, async editReply(payload) { replies.push(payload); } };
}
function delivery(send = async () => ({ id: 'moderator-report' })) {
    const messages = [];
    return { messages, client: { channels: { async fetch(id) { assert.equal(id, QUESTION_REPORT_CHANNEL_ID); return { isTextBased: () => true, async send(payload) { messages.push(payload); return send(payload); } }; } } } };
}

test('every result has Report beside Next, and final results and coin retries also retain Report', () => {
    const { session } = fixture();
    let buttons = resultMessage(session, true).components[0].toJSON().components;
    assert.deepEqual(buttons.map(b=>b.label), ['➡️ Next Question','Report']);
    assert.ok(buttons.every(b=>b.custom_id.length<=100));
    assert.ok(resultMessage(session,false).components[0].toJSON().components.some(b=>b.label==='Report'));
    session.reward.status='failed';
    buttons=resultMessage(session,true).components[0].toJSON().components;
    assert.deepEqual(buttons.map(b=>b.label), ['🪙 Retry coins','Report']);
    const final=fixture([structuredClone(q)]).session;
    assert.deepEqual(resultMessage(final,true).components[0].toJSON().components.map(b=>b.label), ['📚 Choose another class','Report']);
});

test('reports are owner-only and reject future unanswered questions', async () => {
    const { session, interaction }=fixture();
    let rejection;
    await handleStudyInteraction({ ...interaction, user:{id:'spectator'}, async reply(payload) { rejection=payload; } },{},['report',session.userId,session.id,'0',String(session.revision)]);
    assert.equal(rejection.flags,64);
    assert.match(rejection.content,/another student/);
    assert.throws(()=>questionReportModal(session,1,interaction),/answered/);
    let modal;
    await handleStudyInteraction({ ...interaction, async showModal(payload) { modal=payload; } },{},['report',session.userId,session.id,'0',String(session.revision)]);
    const form=modal.toJSON();
    assert.match(form.title,/Report/);
    assert.equal(form.components[0].components[0].style,2);
    assert.equal(form.components[0].components[0].required,true);
    const attacker=submission({...interaction,user:{id:'spectator'}});
    await assert.rejects(submitQuestionReport(attacker,{},tokenOf(modal)),/another student/);
});

test('a modal snapshots the exact question and can be submitted after Next or a new quiz without changing the score', async () => {
    const { session,interaction }=fixture();
    const shown=session.displayOrder.map((option,i)=>`${String.fromCharCode(65+i)}. ${q.options[option]}`).join('\n');
    nextStudyQuestion(session);
    // An earlier answered card remains reportable with its original link and choice order.
    const modal=questionReportModal(session,0,interaction);
    const score=session.score;
    // The open form must still work after the original session is replaced.
    createStudySession(session.guildId,session.userId,[{...q,id:'replacement'}],'random');
    const sink=delivery();const submitted=submission(interaction);
    await handleStudyInteraction(submitted,sink.client,['report_submit',session.userId,tokenOf(modal)]);
    assert.equal(sink.messages.length,1);
    const payload=sink.messages[0], embed=payload.embeds[0].toJSON();
    assert.ok(embed.fields.some(f=>f.name==='Question ID'&&f.value==='original-q'));
    assert.ok(embed.fields.some(f=>f.name==='Question'&&f.value===q.question));
    assert.ok(embed.fields.some(f=>f.name==='Expected answer'&&f.value.includes('First structure')));
    assert.equal(embed.fields.find(f=>f.name==='Answer choices (as shown)').value,shown);
    assert.ok(embed.fields.some(f=>f.name==='Original question'&&f.value.endsWith('/1540000000000000002')));
    assert.match(embed.description,/wrong structure/);
    assert.deepEqual(payload.allowedMentions,{parse:[]});
    assert.equal(payload.enforceNonce,true);
    assert.ok(payload.nonce.length<=25);
    assert.equal(session.score,score);
    assert.doesNotMatch(JSON.stringify(payload),/wallet|New Balance|moneyEarned/);
    assert.match(submitted.replies[0].content,/sent to the moderators/);
});

test('image reports attach the original model image and fit Discord embed limits', async () => {
    const model=labQuestions('upper-gi','multiple_choice').find(q=>q.modelName==='Hard palate');
    const {session,interaction}=fixture([model]);
    const modal=questionReportModal(session,0,interaction);const sink=delivery();
    await submitQuestionReport(submission(interaction,'x'.repeat(1500)),sink.client,tokenOf(modal));
    const payload=sink.messages[0],embed=payload.embeds[0].toJSON();
    assert.equal(payload.files.length,1);
    assert.ok(payload.files[0].attachment.endsWith('gi-01.png'));
    assert.match(embed.image.url,/attachment:\/\/reported-question.png/);
    const length=(embed.title?.length||0)+(embed.description?.length||0)+embed.fields.reduce((sum,f)=>sum+f.name.length+f.value.length,0);
    assert.ok(length<=6000);
    assert.ok(embed.fields.every(f=>f.value.length<=1024));
});

test('duplicate submissions send once; failed sends preserve the issue for retry and reuse a stable nonce', async () => {
    const {session,interaction}=fixture();const modal=questionReportModal(session,0,interaction);const token=tokenOf(modal);const sink=delivery();
    await Promise.all([submitQuestionReport(submission(interaction),sink.client,token),submitQuestionReport(submission(interaction),sink.client,token)]);
    assert.equal(sink.messages.length,1);
    await submitQuestionReport(submission(interaction),sink.client,token);
    assert.equal(sink.messages.length,1);
    assert.throws(()=>questionReportModal(session,0,interaction),/already been reported/);
    const retry=fixture();const retryToken=tokenOf(questionReportModal(retry.session,0,retry.interaction));let fails=true;
    const recovering=delivery(async()=>{if(fails)throw new Error('Missing Send Messages permission');return{id:'sent'};});
    const first=submission(retry.interaction,'The marked opening seems incorrect.');
    await submitQuestionReport(first,recovering.client,retryToken);
    assert.match(first.replies[0].content,/could not be sent/);
    const reopened=questionReportModal(retry.session,0,retry.interaction).toJSON();
    assert.equal(reopened.components[0].components[0].value,'The marked opening seems incorrect.');
    fails=false;
    await submitQuestionReport(submission(retry.interaction,'The marked opening seems incorrect.'),recovering.client,retryToken);
    assert.equal(recovering.messages[0].nonce,recovering.messages[1].nonce);
});

test('expired forms and cross-server submissions cannot send reports', async () => {
    const {session,interaction}=fixture();const now=Date.now();const token=tokenOf(questionReportModal(session,0,interaction,now));
    await assert.rejects(submitQuestionReport(submission({...interaction,guildId:'other-guild'}),{},token,now),/another student/);
    await assert.rejects(submitQuestionReport(submission(interaction),{},token,now+31*60_000),/expired/);
});


test('typed and ordering reports retain their correct answer formats', async () => {
    const cases=[
        { ...q,id:'typed-report',type:'fill_blank',options:undefined,correct:undefined,answers:['fundus'] },
        { ...q,id:'ordered-report',type:'ordering',options:['Mouth','Stomach','Esophagus'],correct:[0,2,1] },
    ];
    for (const question of cases) {
        const {session,interaction}=fixture([question]);const token=tokenOf(questionReportModal(session,0,interaction));const sink=delivery();
        await submitQuestionReport(submission(interaction),sink.client,token);
        const fields=sink.messages[0].embeds[0].toJSON().fields;
        const answer=fields.find(f=>f.name==='Expected answer').value;
        if (question.type==='fill_blank') {
            assert.equal(answer,'fundus');
            assert.ok(!fields.some(f=>f.name==='Answer choices (as shown)'));
        } else {
            assert.ok(answer.indexOf('Mouth')<answer.indexOf('Esophagus'));
            assert.ok(answer.indexOf('Esophagus')<answer.indexOf('Stomach'));
        }
    }
});

test('lecture questions can be reported before answering, retaining their displayed options and image', async () => {
    const { loadQuestionBanks } = await import('../src/services/study/questions.js');
    const { questionMessage } = await import('../src/services/study/interface.js');
    const { imageForQuestion } = await import('../src/services/study/images.js');
    const question = (await loadQuestionBanks()).get('circulatory')[0];
    const session = createStudySession('1540000000000000000', `lecture-report-${Math.random()}`, [question, q], 'circulatory');
    session.classId = 'ap_lecture';
    session.publicQuestionId = '1540000000000000002';
    const interaction = { guildId: session.guildId, channelId: '1540000000000000001', user: { id: session.userId } };
    const buttons = questionMessage(session).components.at(-1).toJSON().components;
    assert.ok(buttons.some(b => b.label === 'Report'));
    let modal;
    await handleStudyInteraction({ ...interaction, async showModal(m) { modal = m; } }, {}, ['report', session.userId, session.id, '0', '0']);
    assert.ok(modal);
    assert.equal(session.answered, false);
    assert.equal(session.score, 0);
    const shown = session.displayOrder.map((option,i) => `${String.fromCharCode(65+i)}. ${question.options[option]}`).join('\n');
    const sink = delivery();
    assert.equal(QUESTION_REPORT_CHANNEL_ID, '1549474402062704675');
    await submitQuestionReport(submission(interaction, 'The picture does not illustrate this question.'), sink.client, tokenOf(modal));
    assert.equal(sink.messages.length, 1);
    const payload = sink.messages[0];
    const fields = payload.embeds[0].toJSON().fields;
    assert.equal(fields.find(f => f.name === 'Question ID').value, question.id);
    assert.equal(fields.find(f => f.name === 'Answer choices (as shown)').value, shown);
    assert.equal(payload.files[0].attachment, imageForQuestion(question).path);
    assert.equal(session.answered, false);
    assert.equal(session.reward, null);
    assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test('unanswered reports reject stale controls and future questions', async () => {
    const session = createStudySession('report-stale-guild', 'report-stale-user', [q, q], 'random');
    let modal, error;
    const interaction = { guildId: session.guildId, user: { id: session.userId }, async showModal(m) { modal = m; }, async reply(p) { error = p; } };
    session.revision++;
    await handleStudyInteraction(interaction, {}, ['report', session.userId, session.id, '0', '0']);
    assert.equal(modal, undefined);
    assert.match(error.content, /expired/);
    assert.throws(() => questionReportModal(session, 1, interaction), /current|answered/);
});
