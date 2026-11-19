import { directorySchools } from './directory.js';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP, BlockList } from 'node:net';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
const nonPublic = new BlockList();
for (const [address, prefix] of [
    ['0.0.0.0',8], ['10.0.0.0',8], ['100.64.0.0',10], ['127.0.0.0',8],
    ['169.254.0.0',16], ['172.16.0.0',12], ['192.0.0.0',24], ['192.0.2.0',24],
    ['192.168.0.0',16], ['198.18.0.0',15], ['198.51.100.0',24], ['203.0.113.0',24],
    ['224.0.0.0',4], ['240.0.0.0',4],
]) nonPublic.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [['2001::',23], ['2001:db8::',32], ['2002::',16], ['3fff::',20]]) nonPublic.addSubnet(address,prefix,'ipv6');
export function publicAddress(address) {
    if (isIP(address) === 4) return !nonPublic.check(address, 'ipv4');
    return isIP(address) === 6 && /^[23]/i.test(address) && !nonPublic.check(address, 'ipv6');
}
export function safeUrl(raw) {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
        || url.hostname === 'localhost' || !url.hostname.includes('.') || url.href.length > 1000) throw new Error('Use a public HTTPS official-source URL on port 443.');
    url.hash = '';
    return url;
}
export async function fetchPage(raw, { resolve = lookup, request = https.request, redirects = 0 } = {}) {
    const url = safeUrl(raw);
    let dnsTimer;
    let addresses;
    try {
        addresses = await Promise.race([
            resolve(url.hostname, { all: true, verbatim: true }),
            new Promise((_resolve, reject) => { dnsTimer = setTimeout(() => reject(new Error('Source DNS lookup timed out.')), 8000); }),
        ]);
    } finally { clearTimeout(dnsTimer); }
    if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('Source resolves to a non-public address.');
    const pinned = addresses[0];
    const response = await new Promise((resolveResponse, reject) => {
        const req = request(url, { method: 'GET', headers: { 'User-Agent': 'StudyBot-ProgramUpdates/1.0', Accept: 'text/html,application/rss+xml,application/atom+xml,text/plain', 'Accept-Encoding': 'identity' },
            lookup: (_host, options, cb) => options?.all ? cb(null, [pinned]) : cb(null, pinned.address, pinned.family) }, res => {
            const chunks = []; let size = 0;
            res.on('error', reject);
            res.on('data', chunk => { size += chunk.length; if (size > 2_000_000) { res.destroy(); reject(new Error('Source exceeds the 2 MB limit.')); } else chunks.push(chunk); });
            res.on('end', () => resolveResponse({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
        });
        const timer = setTimeout(() => req.destroy(new Error('Source request timed out.')), 15000);
        req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end();
    });
    if ([301,302,303,307,308].includes(response.status)) {
        if (redirects >= 3 || !response.headers.location) throw new Error('Too many source redirects.');
        return fetchPage(new URL(response.headers.location, url).href, { resolve, request, redirects: redirects + 1 });
    }
    if (response.status !== 200) throw new Error(`Source returned HTTP ${response.status}.`);
    const type = response.headers['content-type'] || '';
    if (!/text\/(html|plain)|application\/(rss\+xml|atom\+xml|xhtml\+xml|xml)|text\/xml/i.test(type)) throw new Error('This source format is unsupported. Use an HTML page, RSS/Atom feed, or text page. PDF and JavaScript-only sources need another source page.');
    return { ...response, url: url.href, type };
}
export function extractText(page, selector = '') {
    let text;
    if (/text\/plain/i.test(page.type)) text = page.body;
    else {
        const xml = /(?:rss|atom|xml)/i.test(page.type) && !/xhtml/i.test(page.type);
        const $ = load(page.body, { xmlMode: xml });
        $('script,style,noscript,nav,footer,header,form,svg').remove();
        let selected = selector ? $(selector) : xml ? $('item,entry') : $('main,article,[role="main"]').first();
        if (!selected.length && !selector) selected = $('body');
        if (!selected.length) throw new Error('The configured content section was not found.');
        selected.find('br,p,div,li,h1,h2,h3,h4,tr,title,description,summary').each((_i, el) => { $(el).prepend('\n').append('\n'); });
        text = selected.text();
    }
    text = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
    if (text.length < 80) throw new Error('Not enough readable source text; this page may require JavaScript or block automated access.');
    if (text.length > 120000) throw new Error('Source section is too large; configure a narrower CSS selector.');
    return { text, hash: createHash('sha256').update(text).digest('hex') };
}
export function changes(before, after) {
    const oldLines = new Set(before.split('\n')), newLines = new Set(after.split('\n'));
    return { added: [...newLines].filter(line => !oldLines.has(line)).slice(0, 8), removed: [...oldLines].filter(line => !newLines.has(line)).slice(0, 8) };
}
// Free, bundled worldwide directory. Institutions are candidates, not proof of
// a programme offering or verified admission requirements. No API key is used.
export async function discoverSchools(filter, options = {}) {
    return directorySchools(filter, options);
}
