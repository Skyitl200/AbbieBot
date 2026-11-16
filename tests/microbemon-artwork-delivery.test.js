import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerMicrobemonArtwork } from '../src/services/microbemon/artworkDelivery.js';
import { SPECIES } from '../src/services/microbemon/catalog.js';
import { renderSession, healthBar } from '../src/services/microbemon/interface.js';
import { newProfile, ENCOUNTER_MS } from '../src/services/microbemon/engine.js';

test('every normal and shiny portrait is served as a real PNG; unknown files are rejected', async () => {
    const app = express(); registerMicrobemonArtwork(app);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const root = `http://127.0.0.1:${server.address().port}/microbemon/art/`;
    try {
        for (const s of SPECIES) for (const shiny of [false, true]) {
            const response = await fetch(`${root}${s.id}${shiny ? '-shiny' : ''}.png`);
            assert.equal(response.status, 200, s.id);
            assert.match(response.headers.get('content-type'), /image\/png/);
            const bytes = new Uint8Array(await response.arrayBuffer());
            assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
        }
        assert.equal((await fetch(`${root}not-a-species.png`)).status, 404);
        assert.equal((await fetch(`${root}manifest.json`)).status, 404);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('purple battles use hosted species art without uploading attachments', async () => {
    const p = newProfile();
    p.encounter = { id: 'encounter', speciesId: 'ecoli', shiny: true, level: 5, hp: 60, maxHp: 100,
        playerHp: 80, playerMaxHp: 100, attempts: 3, expiresAt: Date.now() + ENCOUNTER_MS };
    const card = await renderSession(p, 'owner', { hostedArtwork: true });
    const embed = card.embeds[0].toJSON();
    assert.equal(embed.color, 0x8b5cf6);
    assert.match(healthBar(50, 100), /^🟪/);
    assert.match(embed.image.url, /\/microbemon\/art\/ecoli-shiny\.png\?v=3$/);
    assert.deepEqual(card.files, []);
    for (const row of card.components) for (const component of row.toJSON().components) assert.notEqual(component.emoji?.id, '1571285873658437692');
});


test('full habitat scenes keep normal and shiny portraits separate without tight crops', async () => {
    const { PORTRAITS } = await import('../src/services/microbemon/portraits.js');
    for (const [id, entry] of Object.entries(PORTRAITS)) {
        assert.equal(entry.normal.x, entry.shiny.x, id);
        assert.ok(entry.shiny.y >= entry.normal.y + entry.normal.height, id);
        for (const r of [entry.normal, entry.shiny]) assert.ok(Math.abs(r.width - r.height) <= 1, id);
    }
});

