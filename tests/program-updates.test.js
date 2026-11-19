import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PROGRAMS, preferences, matches, countryCode } from '../src/services/programUpdates/catalog.js';
import { publicAddress, safeUrl, fetchPage, extractText, changes, discoverSchools } from '../src/services/programUpdates/fetch.js';
import { key, poolFor } from '../src/services/programUpdates/store.js';
import { checkSource, reviewChange, changeMessage } from '../src/services/programUpdates/service.js';
import { openProgramUpdates, handleProgramUpdates } from '../src/services/programUpdates/interface.js';
import command from '../src/commands/Community/programupdates.js';
import adminCommand from '../src/commands/Community/programupdatesadmin.js';
import { COUNTRIES, regionsFor } from '../src/services/programUpdates/locations.js';
import { renderBrowser, openProgramBrowser, handleProgramBrowser } from '../src/services/programUpdates/browser.js';
const filter = preferences({ program: 'nursing', country: 'CA', region: 'Ontario', school: 'Example University', topic: 'prerequisites', applicant: 'international' });
const source = { ...filter, id: 'abc123', url: 'https://example.edu/nursing', selector: '#requirements' };
const textA = 'Applicants require biology and chemistry. International applicants must provide official transcripts. Applications close March 15, 2027.';
const textB = 'Applicants require biology and mathematics. International applicants must provide official transcripts. Applications close April 15, 2027.';
const page = text => ({ body: `<html><nav>Menu changing daily</nav><main><section id="requirements"><p>${text}</p></section></main><script>random()</script></html>`, type: 'text/html' });
function database() {
    const data = new Map(), locks = new Set(), sent = [], nonces = new Map();
    let failSend = false;
    const channel = { guildId: '123', isTextBased: () => true, send: async payload => {
        if (failSend) throw new Error('Discord unavailable');
        if (payload.nonce && nonces.has(payload.nonce)) return nonces.get(payload.nonce);
        sent.push(payload); const result = { id: String(sent.length) }; if (payload.nonce) nonces.set(payload.nonce, result); return result;
    } };
    const db = { async query(sql, args = []) {
        if (sql.includes('pg_try_advisory_lock')) { const acquired = !locks.has(args[0]); if (acquired) locks.add(args[0]); return { rows: [{ acquired }] }; }
        if (sql.includes('pg_advisory_unlock')) { locks.delete(args[0]); return { rows: [] }; }
        if (sql.startsWith('SELECT value')) return { rows: data.has(args[0]) ? [{ value: structuredClone(data.get(args[0])) }] : [] };
        if (sql.startsWith('SELECT key')) {
            const pattern = new RegExp('^' + args[0].split('%').join('.*') + '$');
            return { rows: [...data].filter(([k]) => pattern.test(k)).sort(([a],[b]) => a.localeCompare(b)).map(([key,value]) => ({ key, value: structuredClone(value) })) };
        }
        if (sql.startsWith('INSERT')) { data.set(args[0], JSON.parse(args[1])); return { rows: [] }; }
        if (sql.startsWith('DELETE')) { data.delete(args[0]); return { rows: [] }; }
        assert.fail('Unexpected query: ' + sql);
    }, release() {} };
    data.set(key('123', 'config'), { channel: 'public', reviewChannel: 'review' });
    data.set(key('123', 'source', source.id), source);
    const client = { db: { pool: { connect: async () => db } }, channels: { fetch: async () => channel } };
    return { client, data, sent, locks, fail: value => { failSend = value; } };
}
const interaction = (client, action, strings = {}, manager = false) => {
    const replies = [];
    return { client, guildId: '123', user: { id: '456' }, replies,
        options: { getSubcommand: () => action, getString: name => strings[name] ?? null, getInteger: () => null },
        memberPermissions: { has: () => manager }, deferReply: async () => {}, editReply: async payload => { replies.push(payload); } };
};
test('all nine programmes support worldwide country and applicant filters', () => {
    assert.equal(PROGRAMS.length, 9);
    for (const country of ['US','CA','GB','AU','IN','ZA','BR','JP','DE']) assert.equal(countryCode(country.toLowerCase()), country);
    assert.throws(() => countryCode('Canada'));
    assert.ok(matches(source, filter));
    assert.ok(!matches({ ...source, country: 'US' }, filter));
    assert.ok(!matches({ ...source, applicant: 'domestic' }, filter));
    assert.ok(!matches({ ...source, region: 'Quebec' }, filter));
    assert.ok(matches({ ...source, region: '', applicant: 'all' }, filter));
});
test('HTML extraction removes navigation, preserves relevant text and detects additions/removals', () => {
    const a = extractText(page(textA), '#requirements'), b = extractText(page(textB), '#requirements');
    assert.ok(!a.text.includes('Menu')); assert.ok(!a.text.includes('random'));
    assert.notEqual(a.hash, b.hash);
    assert.match(changes(a.text,b.text).added.join(' '), /mathematics/);
    assert.match(changes(a.text,b.text).removed.join(' '), /chemistry/);
    assert.throws(() => extractText(page(textA), '#missing'), /not found/);
    assert.throws(() => extractText({ type: 'text/plain', body: 'blocked' }), /Not enough/);
});
test('RSS extraction reads item content without fabricating requirements', () => {
    const result = extractText({ type: 'application/rss+xml', body: `<rss><channel><title>Announcements</title><item><title>Admissions update</title><description>${textA}</description></item></channel></rss>` });
    assert.match(result.text, /biology/); assert.match(result.text, /Admissions update/);
});
test('public source URLs reject private networks, credentials, HTTP and custom ports', () => {
    for (const address of ['127.0.0.1','10.1.2.3','172.16.1.2','192.168.0.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1','2002:7f00:1::']) assert.equal(publicAddress(address), false, address);
    assert.equal(publicAddress('8.8.8.8'), true);
    assert.equal(publicAddress('2606:4700:4700::1111'), true);
    for (const url of ['http://example.edu','https://user:pass@example.edu','https://example.edu:8080','https://localhost']) assert.throws(() => safeUrl(url));
});
test('DNS resolution rejects mixed public/private addresses before any request', async () => {
    let called = false;
    await assert.rejects(fetchPage(source.url, { resolve: async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }], request: () => { called = true; } }), /non-public/);
    assert.equal(called, false);
});
function fakeRequest(status, headers, body) {
    return (_url, options, callback) => {
        const req = new EventEmitter(); req.end = () => {
            options.lookup('example.edu', {}, (err,address) => assert.equal(address, '8.8.8.8'));
            const res = new EventEmitter(); res.statusCode = status; res.headers = headers; res.destroy = () => {};
            callback(res); queueMicrotask(() => { res.emit('data', Buffer.from(body)); res.emit('end'); req.emit('close'); });
        }; req.destroy = error => { req.emit('error', error); req.emit('close'); }; return req;
    };
}
test('fetcher pins DNS, rejects error pages and validates redirect destinations', async () => {
    const resolve = async () => [{ address: '8.8.8.8', family: 4 }];
    const result = await fetchPage(source.url, { resolve, request: fakeRequest(200, { 'content-type': 'text/html' }, page(textA).body) });
    assert.match(result.body, /biology/);
    await assert.rejects(fetchPage(source.url, { resolve, request: fakeRequest(403, {}, 'blocked') }), /HTTP 403/);
    await assert.rejects(fetchPage(source.url, { resolve, request: fakeRequest(200, { 'content-type': 'application/pdf' }, 'PDF') }), /unsupported/);
    await assert.rejects(fetchPage(source.url, { resolve, request: fakeRequest(302, { location: 'http://127.0.0.1' }, '') }), /public HTTPS/);
});
test('first check establishes a baseline; unchanged content produces no messages', async () => {
    const d = database(), pageFetcher = async () => page(textA);
    assert.deepEqual(await checkSource(d.client,'123',source,{ pageFetcher }), { baseline: true });
    assert.deepEqual(await checkSource(d.client,'123',source,{ pageFetcher }), { unchanged: true });
    assert.equal(d.sent.length,0); assert.equal(d.locks.size,0);
});
test('changed source requires review, retries once, and duplicate approvals cannot republish', async () => {
    const d = database();
    await checkSource(d.client,'123',source,{ pageFetcher: async () => page(textA) });
    await checkSource(d.client,'123',source,{ pageFetcher: async () => page(textB) });
    const state = d.data.get(key('123','state',source.id));
    assert.equal(d.sent.length,1); assert.match(d.sent[0].embeds[0].toJSON().description,/Review required/);
    await checkSource(d.client,'123',source,{ pageFetcher: async () => { throw Error('Should not refetch pending'); } });
    assert.equal(d.sent.length,1);
    d.data.set(key('123','subscription','u:1'), { ...filter, userId: '789' });
    d.data.set(key('123','subscription','v:2'), { ...filter, country: 'US', userId: '999' });
    await reviewChange(d.client,'123',source.id,state.pending.id,true);
    assert.equal(d.sent.length,3);
    assert.deepEqual(d.sent[2].allowedMentions.users,['789']);
    await assert.rejects(reviewChange(d.client,'123',source.id,state.pending.id,true), /no longer pending/);
    assert.equal(d.sent.length,3);
});
test('failed review notification retries without losing baseline; reject advances snapshot silently', async () => {
    const d = database();
    await checkSource(d.client,'123',source,{ pageFetcher: async () => page(textA) });
    d.fail(true);
    await assert.rejects(checkSource(d.client,'123',source,{ pageFetcher: async () => page(textB) }), /Discord/);
    let state = d.data.get(key('123','state',source.id)); assert.match(state.text,/chemistry/); assert.ok(state.pending);
    d.fail(false); await checkSource(d.client,'123',source);
    state = d.data.get(key('123','state',source.id));
    await reviewChange(d.client,'123',source.id,state.pending.id,false);
    assert.equal(d.sent.length,1); assert.match(d.data.get(key('123','state',source.id)).text,/mathematics/);
});
test('failed fetch never changes saved baseline and a removed source stays removed', async () => {
    const d = database(); await checkSource(d.client,'123',source,{ pageFetcher: async () => page(textA) });
    const old = structuredClone(d.data.get(key('123','state',source.id)));
    await assert.rejects(checkSource(d.client,'123',source,{ pageFetcher: async () => { throw Error('timeout'); } }), /timeout/);
    assert.deepEqual(d.data.get(key('123','state',source.id)),old);
    d.data.delete(key('123','source',source.id));
    assert.deepEqual(await checkSource(d.client,'123',source),{ removed: true });
});
test('moderator review and source administration reject members without permission', async () => {
    const d = database(), i = interaction(d.client,'source-remove',{ id: source.id });
    await openProgramUpdates(i); assert.match(i.replies.at(-1).content,/Manage Server/);
    await handleProgramUpdates(i,d.client,['approve',source.id,'pending']); assert.match(i.replies.at(-1).content,/Manage Server/);
    assert.ok(d.data.has(key('123','source',source.id)));
});
test('subscriptions require owner confirmation, survive new interactions and filter by member', async () => {
    const d = database(), i = interaction(d.client,'subscribe', filter);
    await openProgramUpdates(i);
    const customId = i.replies[0].components[0].components[0].data.custom_id;
    const args = customId.split(':').slice(1);
    const other = interaction(d.client,'subscribe'); other.user.id = '999';
    await handleProgramUpdates(other,d.client,args); assert.match(other.replies.at(-1).content,/own preferences/);
    await handleProgramUpdates(i,d.client,args); assert.match(i.replies.at(-1),/Subscription saved/);
    const stored = [...d.data.keys()].find(name => name.startsWith(key('123','subscription')));
    assert.ok(stored.includes('456'));
    const view = interaction(d.client,'subscriptions'); await openProgramUpdates(view); assert.match(view.replies[0].content,/Example University/);
});
test('worldwide discovery is explicitly optional and results are candidates, not requirements', async () => {
    assert.deepEqual(await discoverSchools(filter,{ token: '' }),[]);
    const results = await discoverSchools(filter,{ token: 'test', fetcher: async () => ({ ok: true, json: async () => ({ web: { results: [{ title: 'University', url: source.url }] } }) }) });
    assert.deepEqual(results,[{ title: 'University', url: source.url }]);
});
test('Discord command schemas fit limits and expose search, compare, subscriptions and moderation', () => {
    const data = command.data.toJSON(); assert.ok(command.guildOnly);
    assert.deepEqual(data.options, []);
    const adminData = adminCommand.data.toJSON();
    assert.ok(adminData.options.some(option => option.name === 'add-source'));
    assert.ok(!JSON.stringify(adminData).includes('\"url\"'));
    for (const sub of adminData.options) {
        assert.ok(sub.options?.length <= 25 || !sub.options);
        let optional = false;
        for (const option of sub.options || []) { if (!option.required) optional = true; else assert.equal(optional,false,`${sub.name} required options first`); }
    }
    const p = { before: textA, after: textB, at: Date.now(), id: 'id' };
    const json = changeMessage(source,p).embeds[0].toJSON();
    assert.ok(JSON.stringify(json).length < 6000); assert.deepEqual(changeMessage(source,p).allowedMentions,{ parse: [] });
    assert.throws(() => poolFor({ db: { useFallback: true } }),/persistent database/);
});
test('notifications reach more than 50 matching subscribers without duplicate publication on retry', async () => {
    const d = database();
    await checkSource(d.client,'123',source,{ pageFetcher: async () => page(textA) });
    await checkSource(d.client,'123',source,{ pageFetcher: async () => page(textB) });
    for (let index = 0; index < 61; index++) d.data.set(key('123','subscription',`${index}:1`), { ...filter, userId: String(1000 + index) });
    const pending = d.data.get(key('123','state',source.id)).pending;
    await reviewChange(d.client,'123',source.id,pending.id,true);
    assert.equal(d.sent.length,4); // review, public update, two subscriber batches
    assert.equal(d.sent[2].allowedMentions.users.length,50);
    assert.equal(d.sent[3].allowedMentions.users.length,11);
});
test('publication resumes after a notification failure without repeating the public update', async () => {
    const d = database();
    await checkSource(d.client,'123',source,{ pageFetcher: async () => page(textA) });
    await checkSource(d.client,'123',source,{ pageFetcher: async () => page(textB) });
    d.data.set(key('123','subscription','u:1'),{ ...filter,userId:'789' });
    const pending = d.data.get(key('123','state',source.id)).pending;
    const originalFetch = d.client.channels.fetch;
    d.client.channels.fetch = async (...args) => {
        const channel = await originalFetch(...args), send = channel.send;
        return { ...channel, send: async payload => { if (payload.content) throw new Error('Notification unavailable'); return send(payload); } };
    };
    await assert.rejects(reviewChange(d.client,'123',source.id,pending.id,true),/Notification unavailable/);
    assert.equal(d.sent.length,2);
    await assert.rejects(reviewChange(d.client,'123',source.id,pending.id,false),/Publication already started/);
    d.client.channels.fetch = originalFetch;
    await reviewChange(d.client,'123',source.id,pending.id,true);
    assert.equal(d.sent.length,3);
    assert.equal(d.data.get(key('123','state',source.id)).pending,undefined);
});

test('dropdowns page every country and region within Discord limits', () => {
    assert.ok(COUNTRIES.length >= 240);
    for (const country of COUNTRIES) {
        const regions = regionsFor(country.countryShortCode);
        const pages = Math.max(1,Math.ceil(regions.length/24));
        for (let page=0;page<pages;page++) {
            const state={owner:'456',id:'session',revision:0,step:'region',page,mode:'subscribe',filter:{program:'nursing',country:country.countryShortCode}};
            const message=renderBrowser(state);
            assert.ok(message.components.length <= 5);
            const select=message.components[0].toJSON().components[0];
            assert.ok(select.options.length <= 25);
            assert.equal(select.options[0].value,'all');
        }
    }
});
function browserInteraction(client) {
    const i=interaction(client,'');
    i.followups=[];
    i.deferUpdate=async()=>{};
    i.reply=async value=>i.followups.push(value);
    i.followUp=async value=>i.followups.push(value);
    return i;
}
const control = (message, action='choose') => message.components.flatMap(row=>row.components).find(component=>component.data?.custom_id?.endsWith(':'+action)).data.custom_id.split(':').slice(1);
async function choose(i,value) {
    const args=control(i.replies.at(-1));i.values=[value];
    await handleProgramBrowser(i,i.client,args);
}
test('member completes programme, country, region and subscription entirely with dropdowns', async () => {
    const d=database(),i=browserInteraction(d.client);
    await openProgramBrowser(i);
    await choose(i,'subscribe');await choose(i,'nursing');await choose(i,'CA');
    const index=regionsFor('CA').findIndex(region=>region.name === 'Ontario');
    assert.ok(index >= 0);
    await choose(i,String(index));await choose(i,'prerequisites');await choose(i,'international');
    await choose(i,source.id);
    const args=control(i.replies.at(-1),'save');
    await handleProgramBrowser(i,i.client,args);
    assert.equal(i.followups.length,0);
    assert.match(i.replies.at(-1).embeds[0].data.fields[0].value,/Subscription saved/);
    const subscription=[...d.data.entries()].find(([key])=>key.startsWith('program-updates:123:subscription:'))[1];
    assert.equal(subscription.region,'Ontario');assert.equal(subscription.school,'Example University');
});
test('browser rejects another member, expired sessions and stale selections', async () => {
    const d=database(),i=browserInteraction(d.client);await openProgramBrowser(i);
    const args=control(i.replies.at(-1));
    const other=browserInteraction(d.client);other.user.id='999';
    await handleProgramBrowser(other,d.client,args);
    assert.match(other.followups[0].content,/own menu/);
    await choose(i,'subscribe');
    i.values=['find'];await handleProgramBrowser(i,d.client,args);
    assert.match(i.followups.at(-1).content,/menu changed/);
    const session=[...d.data].find(([key])=>key.includes(':browser:'));
    session[1].expiresAt=0;
    await handleProgramBrowser(i,d.client,control(i.replies.at(-1)));
    assert.match(i.followups.at(-1).content,/expired/);
});
test('source approval is a dropdown workflow, with no URL entry and checked moderator permissions', async () => {
    const d=database(),i=browserInteraction(d.client);
    await openProgramBrowser(i,'source');assert.match(i.replies.at(-1).content,/Manage Server/);
    i.memberPermissions={has:()=>true};await openProgramBrowser(i,'source');
    const session=[...d.data.values()].find(value=>value.step === 'program');
    session.step='confirm';session.filter={...filter};session.selected=[{school:'Example School',url:'https://example.edu/program'}];session.mode='source';
    const view=renderBrowser(session,true);
    assert.ok(view.components[0].components[0].data.custom_id.endsWith(':approve'));
    assert.match(view.embeds[0].data.fields[0].value,/https:\/\/example.edu\/program/);
    i.memberPermissions={has:()=>false};await handleProgramBrowser(i,d.client,control(view,'approve'));
    assert.match(i.followups.at(-1).content,/Manage Server/);
});
test('empty and paginated school menus remain valid for search, comparison and approval', () => {
    for (const mode of ['find','subscribe','compare','source','request']) {
        for (const count of [0,1,26]) {
            const s={owner:'456',id:'session',revision:0,step:'schools',page:0,mode,filter:{program:'nursing',country:'US'},schools:Array.from({length:count},(_,index)=>({id:String(index),school:'School '+index,url:'https://example.edu/'+index,tracked:false}))};
            const view=renderBrowser(s,true);
            assert.ok(view.components.length <= 5);
            for (const row of view.components) row.toJSON();
        }
    }
});
