import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { shinyAnimationPath, SHINY_FRAMES } from '../src/services/microbemon/shinyAnimation.js';
import { portraitPath } from '../src/services/microbemon/portraits.js';
import { hostedSpeciesArtwork, registerMicrobemonArtwork } from '../src/services/microbemon/artworkDelivery.js';

function imageBlocks(bytes) {
    let offset = 13 + ((bytes[10] & 128) ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
    const frames = [];
    function subBlocks() { const start = offset; while (bytes[offset]) offset += bytes[offset] + 1; offset++; return bytes.subarray(start, offset); }
    while (offset < bytes.length) {
        const type = bytes[offset++];
        if (type === 0x3b) break;
        if (type === 0x21) { offset++; subBlocks(); }
        else if (type === 0x2c) {
            const flags = bytes[offset + 8]; offset += 9;
            if (flags & 128) offset += 3 * 2 ** ((flags & 7) + 1);
            offset++; frames.push(subBlocks().toString('base64'));
        } else assert.fail(`Unexpected GIF block ${type}`);
    }
    return frames;
}

test('shiny animation has changing frames, loops, is cached, and leaves normal art intact', () => {
    const normal = readFileSync(portraitPath('solium'));
    const path = shinyAnimationPath('solium');
    const bytes = readFileSync(path);
    assert.match(bytes.subarray(0, 6).toString(), /^GIF8[79]a$/);
    assert.equal(imageBlocks(bytes).length, SHINY_FRAMES);
    assert.ok(new Set(imageBlocks(bytes)).size > 1, 'The glints must animate');
    assert.ok(bytes.includes(Buffer.from('NETSCAPE2.0')), 'Animation must loop');
    assert.equal(shinyAnimationPath('solium'), path);
    assert.deepEqual(readFileSync(portraitPath('solium')), normal);
    assert.equal(shinyAnimationPath('unknown'), null);
    assert.match(hostedSpeciesArtwork('solium', true).url, /solium-shiny\.gif\?v=4$/);
    assert.match(hostedSpeciesArtwork('solium', false).url, /solium\.png\?v=4$/);
});

test('public artwork endpoint serves animated shinies and rejects normal GIF requests', async () => {
    const app = express(); registerMicrobemonArtwork(app);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const root = `http://127.0.0.1:${server.address().port}/microbemon/art/`;
    try {
        const response = await fetch(`${root}solium-shiny.gif`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /image\/gif/);
        assert.equal(imageBlocks(Buffer.from(await response.arrayBuffer())).length, SHINY_FRAMES);
        assert.equal((await fetch(`${root}solium.gif`)).status, 404);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
