// Lab-model answers accept minor typos, punctuation differences and curated synonyms.
// Keep this separate from strict lecture grading and protect stage-defining numbers.
function normalize(value) {
    const numbers = { one: '1', two: '2', four: '4', eight: '8', sixteen: '16', thirty: '30' };
    return String(value).normalize('NFKC').toLowerCase()
        .replace(/\b(one|two|four|eight|sixteen|thirty)\b/g, word => numbers[word])
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/(\d)(\p{L})/gu, '$1 $2')
        .replace(/\b(?:the|a|an)\b/g, ' ')
        .replace(/\bcells\b/g, 'cell').replace(/\s+/g, ' ').trim();
}
function distance(a, b) {
    const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) rows[i][0] = i;
    for (let j = 0; j <= b.length; j++) rows[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
        rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
    return rows[a.length][b.length];
}
export function matchesLabAnswer(answer, accepted, competing = []) {
    if (typeof answer !== 'string' || answer.length > 300 || /\b(?:not|no|never|isn't|isnt|isn’t)\b/i.test(answer)) return false;
    const actual = normalize(answer);
    if (!actual) return false;
    const score = value => {
        const expected = normalize(value);
        if (!expected || (actual.match(/\d+/g) || []).join(',') !== (expected.match(/\d+/g) || []).join(',')) return Infinity;
        if (actual === expected) return 0;
        const length = Math.min(actual.length, expected.length);
        const allowance = length < 4 ? 0 : length <= 8 ? 1 : length <= 20 ? 2 : 3;
        if (Math.abs(actual.length - expected.length) > allowance) return Infinity;
        const difference = distance(actual, expected);
        return difference <= allowance ? difference : Infinity;
    };
    const best = Math.min(...accepted.map(score));
    // A typo must be closer to the correct term than to any other structure in the set.
    return Number.isFinite(best) && best < Math.min(...competing.map(score));
}
