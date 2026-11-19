import { createRequire } from 'node:module';
import { isIP } from 'node:net';
import { regionsFor } from './locations.js';
const require = createRequire(import.meta.url);
export const UNIVERSITIES = require('../../assets/program-updates/universities.json');
export const DIRECTORY_INFO = Object.freeze({
    name: 'Hipo university-domains-list',
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
            const url = new URL(raw);
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
    const results = [];
    for (const school of directory) {
        if (school.alpha_two_code !== code || !school.name || (schoolSearch && !normalized(school.name).includes(schoolSearch))) continue;
        const location = school['state-province'];
        if (region && location && regionName(location,code) !== region) continue;
        const url = listedWebsite(school);
        if (!url) continue;
        results.push({ title: school.name.slice(0,150), url, provider: 'directory', countryCode: code,
            region: location || '', regionVerified: Boolean(location), programVerified: false, directorySource: DIRECTORY_INFO.source });
    }
    const seen = new Set();
    return results.sort((a,b) => Number(b.regionVerified)-Number(a.regionVerified) || a.title.localeCompare(b.title))
        .filter(school => { const name = normalized(school.title); if (seen.has(name)) return false; seen.add(name); return true; });
}
