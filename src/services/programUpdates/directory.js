import { createRequire } from 'node:module';
import { isIP } from 'node:net';
import { regionsFor } from './locations.js';
import { PROGRAMS } from './catalog.js';
const require = createRequire(import.meta.url);
export const US_DIRECTORY_INFO = require('../../assets/program-updates/us-ipeds-manifest.json');
export const US_INSTITUTIONS = require('../../assets/program-updates/us-ipeds.json');
const international = require('../../assets/program-updates/universities.json').filter(school => school.alpha_two_code !== 'US');
export const UNIVERSITIES = [...international,...US_INSTITUTIONS];
export const DIRECTORY_INFO = Object.freeze({
    name: 'NCES IPEDS (US) + Hipo university-domains-list (international)',
    usSource: US_DIRECTORY_INFO.sources[0].url,
    usProgramsSource: US_DIRECTORY_INFO.sources[1].url,
    usYear: US_DIRECTORY_INFO.year,
    source: 'https://github.com/Hipo/university-domains-list',
    ...require('../../assets/program-updates/directory-manifest.json'),
    institutions: UNIVERSITIES.length,
    countries: new Set(UNIVERSITIES.map(school => school.alpha_two_code)).size,
});
const normalized = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function regionName(value, country) {
    const region = regionsFor(country).find(r => normalized(r.name) === normalized(value) || normalized(r.shortCode) === normalized(value));
    return normalized(region?.name || value);
}
function listedWebsite(school) {
    for (const raw of school.web_pages || []) {
        try {
            const url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
            // Use the listed website, never fabricate an admissions/program path.
            // HTTPS availability is checked when approving a monitored source.
            if (url.protocol === 'http:') url.protocol = 'https:';
            if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') || isIP(url.hostname) || url.href.length > 1000) continue;
            url.hash = '';
            return url.href;
        } catch { /* Ignore malformed entries. */ }
    }
    return null;
}
export function directorySchools(filter, { directory = UNIVERSITIES } = {}) {
    const code = String(filter.countryCode || filter.country || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) throw new Error('School discovery needs the selected country code.');
    const region = regionName(filter.region, code), schoolSearch = normalized(filter.school);
    const selectedProgram = PROGRAMS.find(item => normalized(item.id) === normalized(filter.program) || normalized(item.name) === normalized(filter.program))?.id;
    const county = normalized(filter.county);
    const results = [];
    for (const school of directory) {
        if (school.alpha_two_code !== code || !school.name || (schoolSearch && !normalized(school.name).includes(schoolSearch))) continue;
        if (county && normalized(school.county) !== county) continue;
        if (code === 'US' && selectedProgram && Array.isArray(school.programs) && !school.programs.includes(selectedProgram)) continue;
        const location = school['state-province'];
        if (region && location && regionName(location,code) !== region) continue;
        const url = listedWebsite(school);
        if (!url) continue;
        results.push({ title: school.name.slice(0,150), url, provider: 'directory', countryCode: code,
            region: location || '', county: school.county || '', regionVerified: Boolean(location), programVerified: false,
            programReportedYear: selectedProgram && school.programs?.includes(selectedProgram) ? US_DIRECTORY_INFO.year : null,
            directorySource: school.unitId ? DIRECTORY_INFO.usSource : DIRECTORY_INFO.source });
    }
    const seen = new Set();
    return results.sort((a,b) => Number(b.regionVerified)-Number(a.regionVerified) || a.title.localeCompare(b.title))
        .filter(school => { const name = normalized(school.title); if (seen.has(name)) return false; seen.add(name); return true; });
}

export function countiesForUS(region, selectedProgram = '') {
    const location = regionName(region,'US');
    return [...new Set(US_INSTITUTIONS.filter(school => regionName(school['state-province'],'US') === location
        && (!selectedProgram || school.programs.includes(selectedProgram))).map(school=>school.county).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}
