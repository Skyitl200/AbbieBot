export const ZONE = 'America/New_York';
export const SOURCES = ['voice', 'microbemon', 'test', 'links'];
export const CREDIT_MS = { microbemon: 30_000, test: 30_000, links: 20_000 };
export const VOICE_LEASE_MS = 120_000;
const monthFormatter = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit' });
export function monthKey(at = Date.now()) {
    const parts = Object.fromEntries(monthFormatter.formatToParts(at).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}`;
}
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export function dayKey(at = Date.now()) {
    const parts = Object.fromEntries(dayFormatter.formatToParts(at).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
export const emptyTotals = () => Object.fromEntries(SOURCES.map(s => [s, 0]));
export const newRecord = () => ({ version: 1, totals: emptyTotals(), months: {}, days: {}, voice: null });
export function addCredit(record, source, ms, at) {
    if (!SOURCES.includes(source) || !Number.isSafeInteger(ms) || ms < 0) throw new Error('Invalid study credit');
    const month = monthKey(at);
    record.days ||= {};
    const day = dayKey(at);
    record.days[day] ||= emptyTotals();
    record.days[day][source] = (record.days[day][source] || 0) + ms;
    record.months[month] ||= emptyTotals();
    record.totals[source] = (record.totals[source] || 0) + ms;
    record.months[month][source] = (record.months[month][source] || 0) + ms;
}
// Split real voice intervals at Eastern calendar-day boundaries (including DST).
export function addVoiceInterval(record, start, end) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    let cursor = start;
    while (cursor < end) {
        let boundary = end;
        if (dayKey(cursor) !== dayKey(end - 1)) {
            let lo = cursor + 1, hi = end;
            const current = dayKey(cursor);
            while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (dayKey(mid) === current) lo = mid + 1; else hi = mid; }
            boundary = lo;
        }
        addCredit(record, 'voice', boundary - cursor, cursor);
        cursor = boundary;
    }
}
export function checkpointVoice(record, channelId, at = Date.now()) {
    const previous = record.voice;
    if (previous && at < previous.at) return;
    if (previous) addVoiceInterval(record, previous.at, Math.min(at, previous.at + VOICE_LEASE_MS));
    record.voice = channelId ? { channelId, at } : null;
}
export function totalsFor(record, period = 'month', at = Date.now()) {
    const copy = structuredClone(record || newRecord());
    if (copy.voice) addVoiceInterval(copy, copy.voice.at, Math.min(at, copy.voice.at + VOICE_LEASE_MS));
    if (period === 'day') return { ...emptyTotals(), ...copy.days?.[dayKey(at)] };
    if (period === 'week') {
        const today = dayKey(at), date = new Date(`${today}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
        const start = date.toISOString().slice(0, 10), totals = emptyTotals();
        for (const [day, values] of Object.entries(copy.days || {})) if (day >= start && day <= today) for (const source of SOURCES) totals[source] += values[source] || 0;
        return totals;
    }
    return { ...emptyTotals(), ...(period === 'all' ? copy.totals : copy.months[monthKey(at)]) };
}
export const sumTotals = totals => SOURCES.reduce((sum, s) => sum + (totals[s] || 0), 0);
export function duration(ms) {
    const seconds = Math.floor(ms / 1000), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
    return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}
export const TIERS = [
    ['Fresh Scholar', 0], ['Budding Bookworm', 1], ['Page Turner', 3], ['Focus Pro', 6], ['Knowledge Builder', 10],
    ['Exam Expert', 20], ['A+ Scholar', 40], ['Master', 60], ['Grandmaster', 80], ['Study Sage', 140], ['Mythic Mind', 200],
].map(([name, hours]) => ({ name, ms: hours * 3600000 }));
export function tierFor(ms) {
    const index = TIERS.findLastIndex(t => ms >= t.ms);
    return { current: TIERS[index], next: TIERS[index + 1], rank: index + 1, count: TIERS.length };
}

export function studyStreaks(record, at = Date.now()) {
    const active = Object.entries(record?.days || {}).filter(([day, totals]) => day <= dayKey(at) && sumTotals(totals) > 0).map(([day]) => day).sort();
    let longest = 0, run = 0, previous;
    for (const day of active) { const date = Date.parse(`${day}T12:00:00Z`); run = previous === date - 86400000 ? run + 1 : 1; longest = Math.max(longest, run); previous = date; }
    const today = dayKey(at), todayDate = Date.parse(`${today}T12:00:00Z`);
    let cursor = active.includes(today) ? todayDate : todayDate - 86400000, current = 0;
    const days = new Set(active);
    while (days.has(new Date(cursor).toISOString().slice(0, 10))) { current++; cursor -= 86400000; }
    return { current, longest };
}
