import test from 'node:test';
import assert from 'node:assert/strict';
import { relevantBlocks, schoolLinks, schoolInformation, sameSchool } from '../src/services/programUpdates/information.js';
const filter={program:'nursing',topic:'deadlines',applicant:'domestic'};
const root='https://example.edu/';
const html=(url,body)=>({url,type:'text/html',body});
const criteria=html(root+'health/criteria',`<html><title>Health programmes</title><body><main>
<div class="card"><h3>Dental Hygiene</h3><p>APPLICATION PERIOD: February 1 to March 31.</p></div>
<div class="card"><h3>Nursing RN full-time · January 2027</h3><p>APPLICATION PERIODS: August 2026: March 28 to May 15.</p><p>January 2027: September 1 to November 23.</p><h4>Requirements</h4><p>Minimum GPA of 2.5 and biology are required.</p></div>
<div class="card"><h3>Nursing RN part-time · January 2027</h3><p>APPLICATION PERIOD: September 16 to November 23.</p></div>
</main></body></html>`);
test('shared pages isolate Nursing dates from another health programme and preserve intake years',()=>{
    const blocks=relevantBlocks(criteria,filter);const text=blocks.map(b=>b.text).join('\n');
    assert.match(text,/January 2027: September 1 to November 23/);
    assert.match(text,/part-time/);assert.match(text,/August 2026/);
    assert.ok(!text.includes('March 31'));assert.ok(!text.includes('Dental Hygiene'));
});
test('plain heading sections end at the next programme heading',()=>{
    const page=html(root+'health',`<main><h2>Nursing</h2><p>APPLICATION PERIOD: September 1 to November 23.</p><h2>Dental Hygiene</h2><p>APPLICATION PERIOD: February 1 to March 31.</p></main>`);
    const text=relevantBlocks(page,filter).map(b=>b.text).join('\n');assert.match(text,/November 23/);assert.ok(!text.includes('March 31'));
});
test('domestic requests do not relay explicitly international-only sections',()=>{
    const page=html(root+'nursing',`<main><h1>Nursing</h1><h2>International applicants</h2><p>International applicants: application deadline is May 1 for international students.</p></main>`);
    assert.equal(relevantBlocks(page,filter).length,0);
});
test('crawler follows relevant school links, skips external sites and relays evidence in Discord',async()=>{
    const requested=[];
    const pages={
        [root]:html(root,`<main><a href="/health">Health Sciences Admissions</a><a href="https://evil.example/nursing">Nursing deadlines</a></main>`),
        [root+'health']:html(root+'health',`<main><a href="/health/criteria">Admissions selection criteria</a></main>`),
        [root+'health/criteria']:criteria,
    };
    const result=await schoolInformation({school:'Example College',url:root},filter,{pageFetcher:async url=>{requested.push(url);if(!pages[url])throw Error('missing');return pages[url];}});
    assert.deepEqual(requested,[root,root+'health',root+'health/criteria']);
    assert.match(result.map(p=>p.description).join(' '),/November 23/);
    assert.ok(result.every(p=>p.fields.some(f=>f.name === 'Source reference' && f.value === criteria.url)));
    assert.ok(!JSON.stringify(result).includes('March 31'));
});
test('crawler limits scope, does not invent information when blocked, and labels empty results',async()=>{
    const result=await schoolInformation({school:'Example College',url:root},filter,{pageFetcher:async()=>{throw Error('HTTP 403');}});
    assert.match(result[0].description,/could not be retrieved/);assert.ok(!result[0].description.includes('November 23'));
    assert.match(result[0].fields.find(f=>f.name === 'Retrieval status').value,/403/);
    assert.equal(sameSchool('https://evil.example/nursing',root),false);
    assert.equal(sameSchool('https://catalog.example.edu/nursing',root),true);
    assert.equal(sameSchool('http://example.edu/nursing',root),false);
});
test('long requested information is paginated within Discord embed limits',async()=>{
    const paragraphs=Array.from({length:45},(_,i)=>`<p>Application deadline item ${i}: January 2027 requires a complete application and all supporting documentation before the published intake deadline.</p>`).join('');
    const page=html(root+'nursing',`<main><h1>Nursing admissions</h1>${paragraphs}</main>`);
    const result=await schoolInformation({school:'Example College',url:root+'nursing'},filter,{pageFetcher:async()=>page});
    assert.ok(result.length>1);assert.ok(result.map(p=>p.description).join(' ').includes('item 44'));
    for(const embed of result) {
        const length=(embed.title?.length||0)+(embed.description?.length||0)+(embed.footer?.text.length||0)+embed.fields.reduce((n,f)=>n+f.name.length+f.value.length,0);
        assert.ok(length<6000);assert.ok(embed.description.length<=4096);
    }
});
