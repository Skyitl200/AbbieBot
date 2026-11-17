export const ZONE = 'America/New_York';
export const SOURCES = ['voice', 'microbemon', 'test', 'links'];
export const CREDIT_MS = { microbemon: 30_000, test: 30_000, links: 20_000 };
export const VOICE_LEASE_MS = 120_000;
const monthFormatter = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit' });
export function monthKey(at = Date.now()) {
    const parts = Object.fromEntries(monthFormatter.formatToParts(at).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}`;
}
export const dayKey = (at = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
export const emptyTotals = () => Object.fromEntries(SOURCES.map(s => [s, 0]));
export const newRecord = () => ({ version: 1, totals: emptyTotals(), months: {}, voice: null });
export function addCredit(record, source, ms, at) {
    if (!SOURCES.includes(source) || !Number.isSafeInteger(ms) || ms < 0) throw new Error('Invalid study credit');
    const month = monthKey(at);
    record.months[month] ||= emptyTotals();
    record.totals[source] = (record.totals[source] || 0) + ms;
    record.months[month][source] = (record.months[month][source] || 0) + ms;
}
// Split real voice intervals at Eastern calendar-month boundaries (including DST).
export function addVoiceInterval(record, start, end) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    let cursor = start;
    while (cursor < end) {
        let boundary = end;
        if (monthKey(cursor) !== monthKey(end - 1)) {
            let lo = cursor + 1, hi = end;
            const current = monthKey(cursor);
            while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (monthKey(mid) === current) lo = mid + 1; else hi = mid; }
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
    return { ...emptyTotals(), ...(period === 'all' ? copy.totals : copy.months[monthKey(at)]) };
}
export const sumTotals = totals => SOURCES.reduce((sum, s) => sum + (totals[s] || 0), 0);
export function duration(ms) {
    const seconds = Math.floor(ms / 1000), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
    return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}
export const TIERS = [
    ['Fresh Scholar', 0], ['Budding Bookworm', 1], ['Page Turner', 3], ['Focus Pro', 6], ['Knowledge Builder', 10],
    ['Exam Expert', 20], ['A+ Scholar', 40], ['Master', 60], ['Grandmaster', 80], ['Study Dynamo', 140], ['Mythic Mind', 200],
].map(([name, hours]) => ({ name, ms: hours * 3600000 }));
export function tierFor(ms) {
    const index = TIERS.findLastIndex(t => ms >= t.ms);
    return { current: TIERS[index], next: TIERS[index + 1], rank: index + 1, count: TIERS.length };
}
