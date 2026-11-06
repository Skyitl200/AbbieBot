import { MAX_HP, MAX_PETS, MAX_BOXES, hpForLevel, xpToNextLevel } from './constants.js';
import { logger } from '../../utils/logger.js';
import { deckPage, renderDeckGrid } from './deck.js';
import { microbeBasics } from './questions.js';
import { ARTWORK, speciesArtwork } from './artwork.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, escapeMarkdown } from 'discord.js';
import { existsSync } from 'node:fs';
import { speciesById, SPECIES } from './catalog.js';
import { captureChance, activePet, petBattleHp } from './engine.js';

const button = (user, action, label, extra = [], style = ButtonStyle.Secondary) => new ButtonBuilder()
    .setCustomId(['microbemon', user, action, ...extra].join(':')).setLabel(label).setStyle(style);
export const healthBar = (hp, maxHp = MAX_HP) => '🟩'.repeat(Math.max(0, Math.min(10, Math.ceil(hp / maxHp * 10)))) + '⬛'.repeat(10 - Math.max(0, Math.min(10, Math.ceil(hp / maxHp * 10))));
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);
const petName = pet => `${pet.shiny ? '✨ ' : ''}${escapeMarkdown(pet.nickname || speciesById(pet.speciesId).name)}`;
export function renderGame(profile, user, { view = 'home', page = 0, notice = '', ownerName = '', releasePetId = null } = {}) {
    const e = profile.encounter?.expiresAt > Date.now() ? profile.encounter : null;
    const embed = { color: 0x2dd4bf, title: '🧬 Microbemon',
        description: 'Explore, answer study questions, catch creatures, and collect companions.',
        footer: { text: 'Only the player controls this session. Game rarity is fictional. Shiny roll: 1 in 1,000.' } };
    if (ownerName) embed.author = { name: `${ownerName}'s Microbemon`.slice(0, 256) };
    let portrait = null;
    let allyPortrait = null;
    const components = [];
    if (view === 'release') {
        const pet = profile.pets.find(pet => pet.id === releasePetId);
        const pending = profile.pendingRelease;
        embed.title = '⚠️ Release this Microbemon?';
        if (pet && pending?.petId === pet.id) {
            portrait = speciesArtwork(pet.speciesId, pet.shiny);
            embed.description = `**${petName(pet)}** · Level ${pet.level}\n*${speciesById(pet.speciesId).name}*\n\nThis permanently removes this pet and its XP from your Microbedeck. It cannot be undone. Confirmation expires <t:${Math.floor(pending.expiresAt / 1000)}:R>.`;
            components.push(row(button(user, 'release_confirm', 'Release permanently', [pet.id, pending.token], ButtonStyle.Danger),
                button(user, 'release_cancel', 'Keep this pet', [pet.id], ButtonStyle.Success)));
        } else embed.description = 'Select a pet in your Microbedeck to request a new release confirmation.';
    } else if (view === 'deck' || view === 'party') {
        const box = deckPage(profile, page);
        const selecting = view === 'party' && e;
        embed.title = selecting ? '⚔️ Choose your battling Microbemon' : '📦 Your Microbedeck';
        embed.description = `**${profile.pets.length} owned pets / ${MAX_PETS} slots** · **${new Set(profile.pets.map(pet => pet.speciesId)).size}/${SPECIES.length} species** · **${profile.pets.filter(pet => pet.shiny).length} shiny**\nBox **${box.page + 1}/${box.pages}** · ${selecting ? 'Select a healthy owned pet to send into battle.' : 'Select an owned pet below to view its details.'}`;
        if (!box.pets.length) embed.description += '\n\nNo microbes caught yet. Choose Explore, then Catch to save your first pet.';
        for (let column = 0; column < 3; column++) {
            const subset = box.pets.slice(column * 4, (column + 1) * 4);
            if (subset.length) embed.fields = [...(embed.fields || []), { name: 'Owned Microbemon', inline: true,
                value: subset.map((pet, offset) => `**${box.start + column * 4 + offset + 1}.** ${petName(pet)} · Lv. ${pet.level}${profile.companion === pet.id ? ' 💚' : ''}${selecting ? ` · ${petBattleHp(e, pet.id)}/${e.petMaxHp?.[pet.id] || hpForLevel(pet.level)} HP` : ''}\n*${speciesById(pet.speciesId).name}*`).join('\n\n') }];
        }
        const eligible = selecting ? box.pets.filter(pet => petBattleHp(e, pet.id) > 0) : box.pets;
        if (eligible.length) components.push(row(new StringSelectMenuBuilder()
            .setCustomId(selecting ? `microbemon:${user}:switch:${e.id}:${e.revision}` : `microbemon:${user}:pet`)
            .setPlaceholder(selecting ? 'Send one of your Microbemon into battle' : 'Choose one of your owned microbes')
            .addOptions(eligible.map(pet => ({
                label: `${box.start + box.pets.indexOf(pet) + 1}. ${pet.nickname || speciesById(pet.speciesId).name}`.slice(0, 100),
                description: `${pet.shiny ? 'Shiny · ' : ''}${speciesById(pet.speciesId).common} · Level ${pet.level}${selecting ? ` · HP ${petBattleHp(e, pet.id)}/${e.petMaxHp?.[pet.id] || hpForLevel(pet.level)}` : ''}`.slice(0, 100),
                value: pet.id, emoji: pet.shiny ? '✨' : '🧬'
            })))));
        const boxButton = (label, target) => selecting
            ? button(user, 'party', label, [e.id, e.revision, target]) : button(user, 'deck', label, [target]);
        components.push(row(new StringSelectMenuBuilder()
            .setCustomId(selecting ? `microbemon:${user}:partybox:${e.id}:${e.revision}` : `microbemon:${user}:box`)
            .setPlaceholder('Jump to a storage box')
            .addOptions(Array.from({ length: Math.min(MAX_BOXES, box.pages) }, (_, i) => ({ label: `Box ${i + 1}`, value: String(i), default: i === box.page })))));
        components.push(row(boxButton('Previous Box', box.page - 1).setDisabled(box.page === 0),
            boxButton('Next Box', box.page + 1).setDisabled(box.page + 1 >= box.pages)));
        if (selecting && box.pets.length && !eligible.length) embed.description += '\n\nThese pets have fainted. Choose a different box.';
    } else if (view === 'collection') {
        page = Math.max(0, Math.min(Math.floor(page) || 0, profile.pets.length - 1));
        const pet = profile.pets[page];
        embed.title = '📚 Your Microbedeck';
        if (pet) {
            const species = speciesById(pet.speciesId);
            portrait = speciesArtwork(pet.speciesId, pet.shiny);
            embed.description = `**${petName(pet)}**\n*${species.name}* — ${species.common}\n${species.tier.toUpperCase()} · Level ${pet.level} · ${pet.shiny ? '✨ Shiny' : 'Normal'} · Max HP ${hpForLevel(pet.level)}\n${profile.companion === pet.id ? '💚 Your companion\n' : ''}\n${species.fact}`;
            embed.fields = [{ name: 'XP / next level', value: xpToNextLevel(pet.level) === null ? 'MAX LEVEL' : `${pet.xp || 0} / ${xpToNextLevel(pet.level)} XP` },
                { name: 'Caught', value: `<t:${Math.floor(pet.caughtAt / 1000)}:f>` },
                { name: 'Microbedeck', value: `${page + 1} / ${profile.pets.length}` },
                { name: 'Habitat / life-cycle setting', value: `${ARTWORK[pet.speciesId].habitat}\n${ARTWORK[pet.speciesId].context}` },
                { name: '🔬 Know your Microbemon', value: microbeBasics(pet.speciesId).map(fact => `• ${fact}`).join('\n').slice(0, 1024) }];
            components.push(row(button(user, 'collection', 'Previous', [Math.max(0, page - 1)]).setDisabled(page === 0),
                button(user, 'collection', 'Next', [page + 1]).setDisabled(page + 1 >= profile.pets.length),
                button(user, 'companion', 'Set Companion', [pet.id]), button(user, 'rename', 'Nickname', [pet.id]), button(user, 'release_prompt', 'Release', [pet.id], ButtonStyle.Danger)));
        } else embed.description = 'No pets yet. Explore and catch your first Microbemon!';
    } else if (view === 'guide') {
        embed.title = '🔬 How to play Microbemon';
        embed.description = '**Explore:** Find a creature every 30 seconds. An active encounter lasts 15 minutes.\n\n**Battle:** Varied questions about movement, nutrition, transmission, host cells, and life cycles. Use Switch Microbemon to choose an owned pet for this encounter. HP starts at 100 at level 1 and gains 10 per level. Attack strength also scales with level. Correct answers earn your battling pet 20 XP; successful catches earn it 40 XP. Switching preserves each pet’s remaining HP. Easy questions lower the creature’s HP when correct. Wrong answers lower your HP. If your active pet faints, switch to another healthy pet. If none remain, the encounter ends. A wild Microbemon at zero HP can still be caught. Each new encounter restores your team to full HP.\n\n**Catch:** Each encounter has three free capsule attempts. Chance rises from 35% to 90% as you lower its HP. A shiny is cosmetic, with the same catch rules.\n\n**Collect:** Store up to 240 pets in 20 boxes of 12. Use Release on a pet’s detail card to remove it after confirming. Pets and your companion are saved. Nickname them from Microbedeck.\n\n**Rarity:** Common 55%, uncommon 30%, rare 12%, epic 3%; shared among species in each tier. Every encounter independently rolls shiny at 1/1,000.\n\nEach successful catch earns 5–30 Merit Coins, with higher amounts more likely, and shows your new balance. Your Merit Coins are not spent by this game.';
        embed.fields = [{ name: 'Organisms', value: `${SPECIES.length} from your lab notes, with corrected names and life-cycle facts.` }];
    } else if (e) {
        const species = speciesById(e.speciesId);
        portrait = speciesArtwork(e.speciesId, e.shiny);
        embed.title = `${e.shiny ? '✨ SHINY' : '🌿 Wild'} ${species.name}`;
        embed.color = e.shiny ? 0xf1c40f : 0x2dd4bf;
        embed.fields = [{ name: 'Habitat / life-cycle setting', value: `${ARTWORK[e.speciesId].habitat}\n${ARTWORK[e.speciesId].context}` }];
        const ally = activePet(profile);
        const allyLabel = ally ? `${petName(ally)} · Lv. ${ally.level}` : 'Researcher (catch your first pet)';
        embed.description = `**${species.common}**\n${species.tier.toUpperCase()} · Level ${e.level} · ${species.group}\n\n❤️ Wild HP: **${e.hp}/${e.maxHp || MAX_HP}**\n${healthBar(e.hp, e.maxHp || MAX_HP)}\n\n⚔️ **${allyLabel}**\n💚 HP: **${e.playerHp}/${e.playerMaxHp || MAX_HP}**\n${healthBar(e.playerHp, e.playerMaxHp || MAX_HP)}${ally ? `\nXP: ${xpToNextLevel(ally.level) === null ? 'MAX LEVEL' : `${ally.xp || 0}/${xpToNextLevel(ally.level)}`}` : ''}\n\n🧪 Catch chance: **${captureChance(e)}%** · Attempts: **${e.attempts}**\nEncounter ends <t:${Math.floor(e.expiresAt / 1000)}:R>.`;
        if (ally) allyPortrait = speciesArtwork(ally.speciesId, ally.shiny);
        const token = [e.id, e.revision];
        if (e.question) {
            embed.fields.push({ name: `⚔️ Study Battle · ${e.question.topic || 'Review'}`, value: e.question.text }, ...e.question.answers.map((answer, i) => ({ name: String.fromCharCode(65 + i), value: answer, inline: true })));
            components.push(row(...e.question.answers.map((_, i) => button(user, 'answer', String.fromCharCode(65 + i), [...token, i], ButtonStyle.Primary))));
        } else {
            components.push(row(button(user, 'inspect', '🔬 Inspect', token), button(user, 'battle', '⚔️ Battle', token, ButtonStyle.Primary).setDisabled(e.hp === 0 || e.playerHp === 0),
                button(user, 'catch', '🧪 Catch', token, ButtonStyle.Success).setDisabled(e.playerHp === 0 || profile.pets.length >= MAX_PETS), button(user, 'leave', 'Leave', token)));
        }
        if (profile.pets.length) {
            components.push(row(button(user, 'party', '🔄 Switch Microbemon', [...token, 0], ButtonStyle.Primary)));
        }
    } else {
        const companion = profile.pets.find(p => p.id === profile.companion);
        if (companion) portrait = speciesArtwork(companion.speciesId, companion.shiny);
        embed.fields = [{ name: 'Your Microbedeck', value: `${profile.pets.length} pets · ${profile.pets.filter(p => p.shiny).length} shiny` },
            { name: 'Companion', value: companion ? petName(companion) : 'Catch a pet to get started!' }];
    }
    if (notice) embed.description += `\n\n${notice.slice(0, 1100)}`;
    components.push(row(button(user, 'explore', e ? 'Resume Encounter' : '🌿 Explore', [], ButtonStyle.Success),
        button(user, 'deck', '📦 Microbedeck', [0]), button(user, 'home', '🧬 Microbemon'), button(user, 'guide', 'How to Play')));
    // Encounters and collection entries always use the exact species and variant.
    // Missing art never falls back to an unrelated group scene.
    const selectedArt = portrait;
    const files = selectedArt && existsSync(selectedArt.path)
        ? [{ attachment: selectedArt.path, name: selectedArt.name }] : [];
    if (allyPortrait && existsSync(allyPortrait.path)) {
        if (!files.some(file => file.name === allyPortrait.name)) files.push({ attachment: allyPortrait.path, name: allyPortrait.name });
        embed.thumbnail = { url: `attachment://${allyPortrait.name}` };
    }
    if (selectedArt && files.some(file => file.name === selectedArt.name)) embed.image = { url: `attachment://${selectedArt.name}` };
    return { embeds: [new EmbedBuilder(embed)], components, attachments: [],
        files, allowedMentions: { parse: [] } };
}

export async function renderSession(profile, user, options = {}) {
    const message = renderGame(profile, user, options);
    if (['deck', 'party'].includes(options.view)) {
        const box = deckPage(profile, options.page);
        const name = `microbedeck-box-${box.page + 1}.png`;
        try {
            message.files = [{ attachment: await renderDeckGrid(profile, box.page), name }];
            message.embeds[0].setImage(`attachment://${name}`);
        } catch (error) {
            logger.warn('Microbedeck portrait grid unavailable:', error.message);
            // Keep the owned-pet list and selection working if artwork is unavailable.
            message.embeds[0].addFields({ name: 'Portrait preview', value: 'The picture preview is unavailable. Your owned microbes are listed above.' });
        }
    }
    return message;
}
