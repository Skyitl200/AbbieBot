import { MicrobemonError } from './errors.js';
import { randomInt, randomUUID } from 'node:crypto';
import { SPECIES, TIERS, speciesById } from './catalog.js';
export const COOLDOWN_MS = 30_000;
export const ENCOUNTER_MS = 15 * 60_000;
export const newProfile = () => ({ version: 1, pets: [], companion: null, encounter: null, lastEncounter: 0 });

export function rollEncounter(rng = randomInt, now = Date.now()) {
    let roll = rng(100);
    const tier = TIERS.find(t => { roll -= t.weight; return roll < 0; }).name;
    const pool = SPECIES.filter(species => species.tier === tier);
    return { id: randomUUID(), speciesId: pool[rng(pool.length)].id, shiny: rng(1000) === 0,
        level: 3 + rng(8), hp: 40, playerHp: 60, attempts: 3, revision: 0, expiresAt: now + ENCOUNTER_MS, question: null };
}
export function captureChance(encounter) { return Math.min(90, 35 + Math.floor((40 - encounter.hp) / 40 * 55)); }
export function prepareQuestion(encounter, rng = randomInt) {
    const species = speciesById(encounter.speciesId);
    // Two accessible question types per organism; shuffle choices every time.
    const classification = rng(2) === 1;
    const otherGroups = [...new Set(SPECIES.map(s => s.group))].filter(group => group !== species.group);
    const answers = classification
        ? [species.group, ...otherGroups.slice(0, 2)] : [...species.answers];
    const correctText = answers[classification ? 0 : species.correct];
    for (let i = answers.length - 1; i > 0; i--) {
        const j = rng(i + 1); [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    encounter.question = { text: classification ? `Which group does ${species.name} belong to?` : species.question,
        answers, correct: answers.indexOf(correctText) };
}
export function act(profile, action, { encounterId, revision, answer, petId, nickname, now = Date.now(), rng = randomInt } = {}) {
    if (action === 'explore') {
        if (profile.encounter && profile.encounter.expiresAt > now) return 'Your current encounter is waiting.';
        if (profile.pets.length >= 1000) throw new MicrobemonError('Your collection is full (1,000 pets).');
        const remaining = COOLDOWN_MS - (now - profile.lastEncounter);
        if (remaining > 0) throw new MicrobemonError(`Explore again in ${Math.ceil(remaining / 1000)} seconds.`);
        profile.encounter = rollEncounter(rng, now); profile.lastEncounter = now;
        return 'A wild Microbemon appeared!';
    }
    if (action === 'companion' || action === 'nickname') {
        const pet = profile.pets.find(p => p.id === petId);
        if (!pet) throw new MicrobemonError('That pet is not in your collection.');
        if (action === 'companion') { profile.companion = pet.id; return 'Companion selected!'; }
        pet.nickname = String(nickname || '').trim().slice(0, 24);
        if (!pet.nickname) throw new MicrobemonError('Enter a nickname of 1–24 characters.');
        return 'Nickname saved!';
    }
    const e = profile.encounter;
    if (!e || e.id !== encounterId || e.expiresAt <= now) throw new MicrobemonError('This encounter has ended. Choose Explore for another.');
    if (e.revision !== revision) throw new MicrobemonError('That button is from an earlier turn. Use the latest encounter message.');
    if (action === 'inspect') return speciesById(e.speciesId).fact;
    if (action === 'leave') { profile.encounter = null; return 'You left the encounter.'; }
    if (action === 'battle') {
        if (e.hp <= 0) throw new MicrobemonError('It is ready to catch—choose Catch!');
        if (!e.question) { prepareQuestion(e, rng); e.revision++; }
        return 'Answer correctly to lower its HP and improve your catch chance.';
    }
    if (action === 'answer') {
        if (!e.question || !Number.isInteger(answer) || answer < 0 || answer >= e.question.answers.length) throw new MicrobemonError('Choose an answer from the current question.');
        const correct = answer === e.question.correct;
        const correctText = e.question.answers[e.question.correct];
        e.question = null; e.revision++;
        if (correct) e.hp = Math.max(0, e.hp - 15); else e.playerHp = Math.max(0, e.playerHp - 15);
        if (!e.playerHp) profile.encounter = null;
        return `${correct ? 'Correct! You dealt 15 damage.' : `The answer is ${correctText}. You lost 15 HP.`} ${speciesById(e.speciesId).fact}${!e.playerHp ? ' Your encounter ended.' : ''}`;
    }
    if (action === 'catch') {
        if (e.question) throw new MicrobemonError('Answer the current battle question before catching.');
        const caught = rng(100) < captureChance(e);
        e.attempts--; e.revision++;
        if (caught) {
            if (profile.pets.length >= 1000) throw new MicrobemonError('Your collection is full.');
            const pet = { id: e.id, speciesId: e.speciesId, shiny: e.shiny, level: e.level, nickname: '', caughtAt: now };
            profile.pets.push(pet); if (!profile.companion) profile.companion = pet.id;
            profile.encounter = null;
            return `Caught ${e.shiny ? 'a shiny ' : ''}${speciesById(e.speciesId).name}! Saved to your collection.`;
        }
        if (!e.attempts) profile.encounter = null;
        return e.attempts ? `It broke free! ${e.attempts} capsule attempts remain.` : 'It escaped after three catch attempts. Try another encounter!';
    }
    throw new MicrobemonError('Unknown Microbemon action.');
}
