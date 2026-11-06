import { microbeBasics } from './questions.js';
import { ARTWORK, speciesArtwork } from './artwork.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } from 'discord.js';
import { existsSync } from 'node:fs';
import { speciesById, SPECIES } from './catalog.js';
import { captureChance } from './engine.js';

const button = (user, action, label, extra = [], style = ButtonStyle.Secondary) => new ButtonBuilder()
    .setCustomId(['microbemon', user, action, ...extra].join(':')).setLabel(label).setStyle(style);
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);
const petName = pet => `${pet.shiny ? '✨ ' : ''}${escapeMarkdown(pet.nickname || speciesById(pet.speciesId).name)}`;
export function renderGame(profile, user, { view = 'home', page = 0, notice = '', ownerName = '' } = {}) {
    const e = profile.encounter?.expiresAt > Date.now() ? profile.encounter : null;
    const embed = { color: 0x2dd4bf, title: '🧬 Microbemon',
        description: 'Explore, answer study questions, catch creatures, and collect companions.',
        footer: { text: 'Only the player controls this session. Game rarity is fictional. Shiny roll: 1 in 1,000.' } };
    if (ownerName) embed.author = { name: `${ownerName}'s Microbemon`.slice(0, 256) };
    let portrait = null;
    const components = [];
    if (view === 'collection') {
        page = Math.max(0, Math.min(Math.floor(page) || 0, profile.pets.length - 1));
        const pet = profile.pets[page];
        embed.title = '📚 Your Microbedeck';
        if (pet) {
            const species = speciesById(pet.speciesId);
            portrait = speciesArtwork(pet.speciesId, pet.shiny);
            embed.description = `**${petName(pet)}**\n*${species.name}* — ${species.common}\n${species.tier.toUpperCase()} · Level ${pet.level} · ${pet.shiny ? '✨ Shiny' : 'Normal'}\n${profile.companion === pet.id ? '💚 Your companion\n' : ''}\n${species.fact}`;
            embed.fields = [{ name: 'Caught', value: `<t:${Math.floor(pet.caughtAt / 1000)}:f>` },
                { name: 'Microbedeck', value: `${page + 1} / ${profile.pets.length}` },
                { name: 'Habitat / life-cycle setting', value: `${ARTWORK[pet.speciesId].habitat}\n${ARTWORK[pet.speciesId].context}` },
                { name: '🔬 Know your Microbemon', value: microbeBasics(pet.speciesId).map(fact => `• ${fact}`).join('\n').slice(0, 1024) }];
            components.push(row(button(user, 'collection', 'Previous', [Math.max(0, page - 1)]).setDisabled(page === 0),
                button(user, 'collection', 'Next', [page + 1]).setDisabled(page + 1 >= profile.pets.length),
                button(user, 'companion', 'Set Companion', [pet.id]), button(user, 'rename', 'Nickname', [pet.id])));
        } else embed.description = 'No pets yet. Explore and catch your first Microbemon!';
    } else if (view === 'guide') {
        embed.title = '🔬 How to play Microbemon';
        embed.description = '**Explore:** Find a creature every 30 seconds. An active encounter lasts 15 minutes.\n\n**Battle:** Varied questions about movement, nutrition, transmission, host cells, and life cycles. Easy questions lower the creature’s HP when correct. Wrong answers lower your HP. At zero HP, an encounter ends. The creature at zero HP can still be caught.\n\n**Catch:** Each encounter has three free capsule attempts. Chance rises from 35% to 90% as you lower its HP. A shiny is cosmetic, with the same catch rules.\n\n**Collect:** Pets and your companion are saved. Nickname them from Microbedeck.\n\n**Rarity:** Common 55%, uncommon 30%, rare 12%, epic 3%; shared among species in each tier. Every encounter independently rolls shiny at 1/1,000.\n\nYour Merit Coins are not spent by this game.';
        embed.fields = [{ name: 'Organisms', value: `${SPECIES.length} from your lab notes, with corrected names and life-cycle facts.` }];
    } else if (e) {
        const species = speciesById(e.speciesId);
        portrait = speciesArtwork(e.speciesId, e.shiny);
        embed.title = `${e.shiny ? '✨ SHINY' : '🌿 Wild'} ${species.name}`;
        embed.color = e.shiny ? 0xf1c40f : 0x2dd4bf;
        embed.description = `**${species.common}**\n${species.tier.toUpperCase()} · Level ${e.level} · ${species.group}\n\n❤️ Creature HP: **${e.hp}/40**\n💚 Your HP: **${e.playerHp}/60**\n🧪 Catch chance: **${captureChance(e)}%** · Attempts: **${e.attempts}**\nEncounter ends <t:${Math.floor(e.expiresAt / 1000)}:R>.`;
        embed.fields = [{ name: 'Habitat / life-cycle setting', value: `${ARTWORK[e.speciesId].habitat}\n${ARTWORK[e.speciesId].context}` }];
        const token = [e.id, e.revision];
        if (e.question) {
            embed.fields.push({ name: `⚔️ Study Battle · ${e.question.topic || 'Review'}`, value: e.question.text }, ...e.question.answers.map((answer, i) => ({ name: String.fromCharCode(65 + i), value: answer, inline: true })));
            components.push(row(...e.question.answers.map((_, i) => button(user, 'answer', String.fromCharCode(65 + i), [...token, i], ButtonStyle.Primary))));
        } else {
            components.push(row(button(user, 'inspect', '🔬 Inspect', token), button(user, 'battle', '⚔️ Battle', token, ButtonStyle.Primary).setDisabled(e.hp === 0),
                button(user, 'catch', '🧪 Catch', token, ButtonStyle.Success), button(user, 'leave', 'Leave', token)));
        }
    } else {
        const companion = profile.pets.find(p => p.id === profile.companion);
        if (companion) portrait = speciesArtwork(companion.speciesId, companion.shiny);
        embed.fields = [{ name: 'Your Microbedeck', value: `${profile.pets.length} pets · ${profile.pets.filter(p => p.shiny).length} shiny` },
            { name: 'Companion', value: companion ? petName(companion) : 'Catch a pet to get started!' }];
    }
    if (notice) embed.description += `\n\n${notice.slice(0, 1100)}`;
    components.push(row(button(user, 'explore', e ? 'Resume Encounter' : '🌿 Explore', [], ButtonStyle.Success),
        button(user, 'collection', '📚 Microbedeck', [0]), button(user, 'guide', 'How to Play')));
    // Encounters and collection entries always use the exact species and variant.
    // Missing art never falls back to an unrelated group scene.
    const selectedArt = portrait;
    const files = selectedArt && existsSync(selectedArt.path)
        ? [{ attachment: selectedArt.path, name: selectedArt.name }] : [];
    if (files.length) embed.image = { url: `attachment://${selectedArt.name}` };
    return { embeds: [new EmbedBuilder(embed)], components, attachments: [],
        files: embed.image ? files : [], allowedMentions: { parse: [] } };
}
