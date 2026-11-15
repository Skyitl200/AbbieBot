import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, TIERS } from '../src/services/microbemon/catalog.js';
import { questionsForSpecies } from '../src/services/microbemon/questions.js';
import { rollEncounter } from '../src/services/microbemon/engine.js';
import { PORTRAITS } from '../src/services/microbemon/portraits.js';

test('expanded roster retains all saved species IDs and has one approved portrait pair each', () => {
    for (const id of ['amoeba', 'paramecium', 'enterobius', 'ascaris', 'stentor', 'vorticella', 'giardia', 'necator', 'solium', 'saginata', 'entamoeba', 'balantidium', 'fasciola', 'fasciolopsis', 'paragonimus', 'trypanosoma', 'toxoplasma', 'plasmodium', 'schistosoma']) assert.ok(SPECIES.some(s => s.id === id), id);
    assert.equal(SPECIES.length, 54);
    assert.deepEqual(Object.keys(PORTRAITS).sort(), SPECIES.map(s => s.id).sort());
    const counts = group => SPECIES.filter(s => s.group === group).length;
    assert.equal(counts('Bacterium'), 21);
    assert.equal(counts('Fungus'), 10);
    assert.equal(counts('Virus'), 2);
});

test('every added species can spawn with the existing weighted encounter algorithm', () => {
    let offset = 0;
    for (const tier of TIERS) {
        const pool = SPECIES.filter(s => s.tier === tier.name);
        for (let index = 0; index < pool.length; index++) {
            const values = [offset, index, 1, 0];
            const encounter = rollEncounter(max => { const value = values.shift() ?? 0; assert.ok(value < max); return value; }, Date.now());
            assert.equal(encounter.speciesId, pool[index].id);
        }
        offset += tier.weight;
    }
});

test('new battle pools have valid choices and do not inherit protozoan biology', () => {
    for (const species of SPECIES) {
        const pool = questionsForSpecies(species.id);
        assert.ok(pool.length >= 7, species.id);
        for (const q of pool) {
            assert.equal(new Set(q.answers).size, 3, q.id);
            assert.ok(q.correct >= 0 && q.correct < 3, q.id);
        }
        if (['Bacterium', 'Fungus', 'Virus'].includes(species.group)) assert.ok(pool.every(q => !q.id.startsWith('proto-')), species.id);
    }
    assert.ok(!questionsForSpecies('pisiformis').some(q => q.id === 'tape-meat'));
});
