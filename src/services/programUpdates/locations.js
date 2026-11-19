import { createRequire } from 'node:module';
const data = createRequire(import.meta.url)('country-region-data/data.json');
// A location catalogue is not a claim that schools in every location are tracked.
export const COUNTRIES = [...data].sort((a,b) => a.countryName.localeCompare(b.countryName));
export const regionsFor = code => COUNTRIES.find(country => country.countryShortCode === code)?.regions || [];
export function pageOf(items, page = 0, size = 24) {
    const pages = Math.max(1, Math.ceil(items.length / size));
    const current = Math.max(0, Math.min(Number(page) || 0, pages - 1));
    return { items: items.slice(current * size, (current + 1) * size), current, pages };
}
