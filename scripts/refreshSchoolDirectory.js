// Maintainer utility: refresh the free bundled data, then review/commit it.
// Not run at bot startup; school dropdowns must work during upstream outages.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const endpoint = 'https://api.github.com/repos/Hipo/university-domains-list/commits?path=world_universities_and_domains.json&per_page=1';
const headers = { 'User-Agent': 'StudyBot-SchoolDirectory', Accept: 'application/vnd.github+json' };
async function json(url, limit) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Directory refresh failed: HTTP ${response.status}`);
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw new Error('Directory response exceeds size limit.'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const commits = await json(endpoint, 100000);
const revision = commits[0]?.sha;
if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('Invalid upstream revision.');
const data = await json(`https://raw.githubusercontent.com/Hipo/university-domains-list/${revision}/world_universities_and_domains.json`, 8_000_000);
if (!Array.isArray(data) || data.length < 5000 || !data.every(school => typeof school.name === 'string' && /^[A-Z]{2}$/.test(school.alpha_two_code) && Array.isArray(school.web_pages))) throw new Error('Directory validation failed. Existing snapshot was not replaced.');
const manifest = { revision, bundledOn: new Date().toISOString().slice(0,10), institutions:data.length, countries:new Set(data.map(s=>s.alpha_two_code)).size };
await writeFile(fileURLToPath(new URL('../src/assets/program-updates/universities.json',import.meta.url)),JSON.stringify(data));
await writeFile(fileURLToPath(new URL('../src/assets/program-updates/directory-manifest.json',import.meta.url)),JSON.stringify(manifest,null,2)+'\n');
console.log(`Refreshed ${manifest.institutions} institution records across ${manifest.countries} countries. Review and commit the data and manifest before deploying.`);
