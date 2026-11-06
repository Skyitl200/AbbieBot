import { checkCatchLimit } from './catchLimits.js';
import { MAX_HP, MAX_PETS, MAX_LEVEL, hpForLevel, attackForLevel, wildAttackForLevel, xpToNextLevel } from './constants.js';
import { questionsForSpecies, microbeBasics } from './questions.js';
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
    const speciesId = pool[rng(pool.length)].id;
    const shiny = rng(1000) === 0;
    const level = 3 + rng(8);
    return { id: randomUUID(), speciesId, shiny,
        level, combatVersion: 3, maxHp: hpForLevel(level), hp: hpForLevel(level), playerMaxHp: MAX_HP,
        playerHp: MAX_HP, activePetId: null, petHp: {}, petMaxHp: {}, attempts: 3, revision: 0,
        expiresAt: now + ENCOUNTER_MS, question: null, usedQuestionIds: [] };
}
export function captureChance(encounter) { return Math.min(90, Math.max(35, 35 + Math.floor(((encounter.maxHp || 40) - encounter.hp) / (encounter.maxHp || 40) * 55))); }
export function normalizeProfile(profile) {
    for (const pet of profile.pets) {
        pet.level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(pet.level) || 1)));
        pet.xp = Math.max(0, Math.floor(Number(pet.xp) || 0));
    }
    const e = profile.encounter;
    if (!e) return profile;
    if (e.combatVersion !== 3) {
        const oldMax = e.maxHp || 40;
        const oldPlayerMax = e.playerMaxHp || (e.combatVersion === 2 ? MAX_HP : 60);
        e.maxHp = hpForLevel(e.level);
        e.hp = Math.max(0, Math.min(e.maxHp, Math.round(e.hp / oldMax * e.maxHp)));
        e.activePetId = profile.pets.find(pet => pet.id === e.activePetId)?.id
            || profile.pets.find(pet => pet.id === profile.companion)?.id || profile.pets[0]?.id || null;
        e.petMaxHp = Object.fromEntries(profile.pets.map(pet => [pet.id, hpForLevel(pet.level)]));
        e.playerMaxHp = e.petMaxHp[e.activePetId] || MAX_HP;
        e.playerHp = Math.max(0, Math.min(e.playerMaxHp, Math.round(e.playerHp / oldPlayerMax * e.playerMaxHp)));
        e.petHp = e.activePetId ? { [e.activePetId]: e.playerHp } : {};
        e.combatVersion = 3;
    }
    e.petHp ||= {};
    e.petMaxHp ||= {};
    return profile;
}
export function petBattleHp(encounter, petId) { return encounter.petHp?.[petId] ?? encounter.petMaxHp?.[petId] ?? MAX_HP; }
export function activePet(profile) { return profile.pets.find(pet => pet.id === profile.encounter?.activePetId) || null; }
function gainXp(profile, pet, amount, e) {
    if (!pet || pet.level >= MAX_LEVEL) return '';
    const oldLevel = pet.level;
    pet.xp += amount;
    while (pet.level < MAX_LEVEL && pet.xp >= xpToNextLevel(pet.level)) {
        pet.xp -= xpToNextLevel(pet.level); pet.level++;
    }
    if (pet.level >= MAX_LEVEL) pet.xp = 0;
    if (e && pet.level !== oldLevel) {
        const increase = hpForLevel(pet.level) - hpForLevel(oldLevel);
        e.petMaxHp[pet.id] = hpForLevel(pet.level);
        e.petHp[pet.id] = Math.min(e.petMaxHp[pet.id], petBattleHp(e, pet.id) + increase);
        if (e.activePetId === pet.id) { e.playerMaxHp = e.petMaxHp[pet.id]; e.playerHp = e.petHp[pet.id]; }
    }
    return ` Your battling Microbemon earned ${amount} XP.${pet.level > oldLevel ? ` Level up! Now level ${pet.level}.` : ''}`;
}
export function prepareQuestion(encounter, rng = randomInt) {
    const pool = questionsForSpecies(encounter.speciesId);
    const used = encounter.usedQuestionIds || [];
    let available = pool.filter(question => !used.includes(question.id));
    if (!available.length) { available = pool; encounter.usedQuestionIds = []; }
    const selected = available[rng(available.length)];
    const answers = [...selected.answers];
    const correctText = answers[selected.correct];
    for (let i = answers.length - 1; i > 0; i--) {
        const j = rng(i + 1); [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    encounter.usedQuestionIds = [...(encounter.usedQuestionIds || []), selected.id];
    encounter.question = { id: selected.id, topic: selected.topic, text: selected.text,
        answers, correct: answers.indexOf(correctText), explanation: selected.explanation, source: selected.source };
}
export function act(profile, action, { encounterId, revision, answer, petId, nickname, confirmation, sponsor = false, now = Date.now(), rng = randomInt } = {}) {
    normalizeProfile(profile);
    if (action === 'explore') {
        if (profile.encounter && profile.encounter.expiresAt > now) return 'Your current encounter is waiting.';
        const remaining = COOLDOWN_MS - (now - profile.lastEncounter);
        if (remaining > 0) throw new MicrobemonError(`Explore again in ${Math.ceil(remaining / 1000)} seconds.`);
        profile.encounter = rollEncounter(rng, now); profile.lastEncounter = now;
        profile.encounter.activePetId = profile.pets.find(pet => pet.id === profile.companion)?.id || profile.pets[0]?.id || null;
        const e = profile.encounter;
        e.petMaxHp = Object.fromEntries(profile.pets.map(pet => [pet.id, hpForLevel(pet.level)]));
        e.playerMaxHp = e.petMaxHp[e.activePetId] || MAX_HP;
        e.playerHp = e.playerMaxHp;
        if (e.activePetId) e.petHp[e.activePetId] = e.playerHp;
        return 'A wild Microbemon appeared!';
    }
    if (['release_prompt', 'release_confirm', 'release_cancel'].includes(action)) {
        const pet = profile.pets.find(pet => pet.id === petId);
        if (!pet) throw new MicrobemonError('That pet is not in your Microbedeck.');
        if (action === 'release_cancel') { profile.pendingRelease = null; return 'Release cancelled.'; }
        if (profile.encounter?.expiresAt > now && profile.encounter.activePetId === petId) throw new MicrobemonError('Switch away from this pet before releasing it.');
        if (action === 'release_prompt') {
            profile.pendingRelease = { petId, token: randomUUID().slice(0, 8), expiresAt: now + 60_000 };
            return '';
        }
        const pending = profile.pendingRelease;
        if (!pending || pending.petId !== petId || pending.token !== confirmation || pending.expiresAt <= now) throw new MicrobemonError('Release confirmation expired. Select the pet and choose Release again.');
        profile.pets = profile.pets.filter(pet => pet.id !== petId);
        if (profile.companion === petId) profile.companion = profile.pets[0]?.id || null;
        if (profile.encounter) { delete profile.encounter.petHp[petId]; delete profile.encounter.petMaxHp[petId]; }
        profile.pendingRelease = null;
        return 'Pet released from your Microbedeck.';
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
    if (action === 'switch') {
        const pet = profile.pets.find(pet => pet.id === petId);
        if (!pet) throw new MicrobemonError('Choose a Microbemon you own.');
        if (petBattleHp(e, petId) <= 0) throw new MicrobemonError('That Microbemon has fainted in this encounter.');
        e.activePetId = petId;
        e.playerMaxHp = e.petMaxHp[petId] || hpForLevel(pet.level);
        e.playerHp = petBattleHp(e, petId);
        e.petHp[petId] = e.playerHp;
        e.revision++;
        return 'Your selected Microbemon entered the battle!';
    }
    if (['battle', 'answer', 'catch'].includes(action) && e.playerHp <= 0) throw new MicrobemonError('Switch to a healthy Microbemon before continuing.');
    if (action === 'inspect') return [speciesById(e.speciesId).fact, ...microbeBasics(e.speciesId)].join('\n');
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
        const explanation = e.question.explanation || speciesById(e.speciesId).fact;
        e.question = null; e.revision++;
        const ally = activePet(profile);
        const damage = attackForLevel(ally?.level || 1);
        const incoming = wildAttackForLevel(e.level);
        if (correct) e.hp = Math.max(0, e.hp - damage); else e.playerHp = Math.max(0, e.playerHp - incoming);
        if (e.activePetId) e.petHp[e.activePetId] = e.playerHp;
        const xpMessage = correct ? gainXp(profile, ally, 20, e) : '';
        const canSwitch = profile.pets.some(pet => pet.id !== e.activePetId && petBattleHp(e, pet.id) > 0);
        if (!e.playerHp && !canSwitch) profile.encounter = null;
        return `${correct ? `Correct! ${ally ? 'Your Microbemon' : 'You'} dealt ${damage} damage.` : `The answer is ${correctText}. Your side lost ${incoming} HP.`} ${explanation}${xpMessage}${!e.playerHp ? (canSwitch ? ' Your Microbemon fainted. Switch to another owned pet!' : ' Your encounter ended.') : ''}`;
    }
    if (action === 'catch') {
        if (profile.pets.length >= MAX_PETS) throw new MicrobemonError('Your 20 storage boxes are full (240 pets).');
        if (e.question) throw new MicrobemonError('Answer the current battle question before catching.');
        const daily = checkCatchLimit(profile, sponsor, now);
        const caught = rng(100) < captureChance(e);
        e.attempts--; e.revision++;
        if (caught) {
            if (profile.pets.length >= MAX_PETS) throw new MicrobemonError('Your collection is full.');
            daily.count++;
            const xpMessage = gainXp(profile, activePet(profile), 40, e);
            const pet = { id: e.id, speciesId: e.speciesId, shiny: e.shiny, level: e.level, xp: 0, nickname: '', caughtAt: now };
            profile.pets.push(pet); if (!profile.companion) profile.companion = pet.id;
            profile.encounter = null;
            return `Caught ${e.shiny ? 'a shiny ' : ''}${speciesById(e.speciesId).name}! Added to your Microbedeck.${xpMessage}\n${sponsor ? `Sponsor: unlimited catches (${daily.count} today).` : `Daily catches: ${daily.count}/4. Resets at midnight Eastern Time.`}`;
        }
        if (!e.attempts) profile.encounter = null;
        return e.attempts ? `It broke free! ${e.attempts} capsule attempts remain.` : 'It escaped after three catch attempts. Try another encounter!';
    }
    throw new MicrobemonError('Unknown Microbemon action.');
}
