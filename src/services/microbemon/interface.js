import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } from 'discord.js';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { speciesById, SPECIES } from './catalog.js';
import { captureChance } from './engine.js';

const artPath = shiny => fileURLToPath(new URL(`../../assets/microbemon/${shiny ? 'shiny-habitat' : 'habitat'}.png`, import.meta.url));
const button = (user, action, label, extra = [], style = ButtonStyle.Secondary) => new ButtonBuilder()
    .setCustomId(['microbemon', user, action, ...extra].join(':')).setLabel(label).setStyle(style);
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);
const petName = pet => `${pet.shiny ? '✨ ' : ''}${escapeMarkdown(pet.nickname || speciesById(pet.speciesId).name)}`;
export function renderGame(profile, user, { view = 'home', page = 0, notice = '' } = {}) {
    const e = profile.encounter?.expiresAt > Date.now() ? profile.encounter : null;
    const embed = { color: 0x2dd4bf, title: '🧬 Microbemon',
        description: 'Explore, answer study questions, catch creatures, and collect companions.',
        footer: { text: 'Game rarity does not represent real-world prevalence. Shiny roll: 1 in 1,000 per encounter.' } };
    const components = [];
    if (view === 'collection') {
        page = Math.max(0, Math.min(Math.floor(page) || 0, profile.pets.length - 1));
        const pet = profile.pets[page];
        embed.title = '📚 Your Microbemon Collection';
        if (pet) {
            const species = speciesById(pet.speciesId);
            embed.description = `**${petName(pet)}**\n*${species.name}* — ${species.common}\n${species.tier.toUpperCase()} · Level ${pet.level} · ${pet.shiny ? '✨ Shiny' : 'Normal'}\n${profile.companion === pet.id ? '💚 Your companion\n' : ''}\n${species.fact}`;
            embed.fields = [{ name: 'Caught', value: `<t:${Math.floor(pet.caughtAt / 1000)}:f>` },
                { name: 'Collection', value: `${page + 1} / ${profile.pets.length}` }];
            components.push(row(button(user, 'collection', 'Previous', [Math.max(0, page - 1)]).setDisabled(page === 0),
                button(user, 'collection', 'Next', [page + 1]).setDisabled(page + 1 >= profile.pets.length),
                button(user, 'companion', 'Set Companion', [pet.id]), button(user, 'rename', 'Nickname', [pet.id])));
        } else embed.description = 'No pets yet. Explore and catch your first Microbemon!';
    } else if (view === 'guide') {
        embed.title = '🔬 How to play Microbemon';
        embed.description = '**Explore:** Find a creature every 30 seconds. An active encounter lasts 15 minutes.\n\n**Battle:** Easy questions lower the creature’s HP when correct. Wrong answers lower your HP. At zero HP, an encounter ends. The creature at zero HP can still be caught.\n\n**Catch:** Each encounter has three free capsule attempts. Chance rises from 35% to 90% as you lower its HP. A shiny is cosmetic, with the same catch rules.\n\n**Collect:** Pets and your companion are saved. Nickname them from Collection.\n\n**Rarity:** Common 55%, uncommon 30%, rare 12%, epic 3%; shared among species in each tier. Every encounter independently rolls shiny at 1/1,000.\n\nYour Merit Coins are not spent by this game.';
        embed.fields = [{ name: 'Organisms', value: `${SPECIES.length} from your lab notes, with corrected names and life-cycle facts.` }];
    } else if (e) {
        const species = speciesById(e.speciesId);
        embed.title = `${e.shiny ? '✨ SHINY' : '🌿 Wild'} ${species.name}`;
        embed.color = e.shiny ? 0xf1c40f : 0x2dd4bf;
        embed.description = `**${species.common}**\n${species.tier.toUpperCase()} · Level ${e.level} · ${species.group}\n\n❤️ Creature HP: **${e.hp}/40**\n💚 Your HP: **${e.playerHp}/60**\n🧪 Catch chance: **${captureChance(e)}%** · Attempts: **${e.attempts}**\nEncounter ends <t:${Math.floor(e.expiresAt / 1000)}:R>.`;
        const token = [e.id, e.revision];
        if (e.question) {
            embed.fields = [{ name: '⚔️ Study Battle', value: e.question.text }, ...e.question.answers.map((answer, i) => ({ name: String.fromCharCode(65 + i), value: answer, inline: true }))];
            components.push(row(...e.question.answers.map((_, i) => button(user, 'answer', String.fromCharCode(65 + i), [...token, i], ButtonStyle.Primary))));
        } else {
            components.push(row(button(user, 'inspect', '🔬 Inspect', token), button(user, 'battle', '⚔️ Battle', token, ButtonStyle.Primary).setDisabled(e.hp === 0),
                button(user, 'catch', '🧪 Catch', token, ButtonStyle.Success), button(user, 'leave', 'Leave', token)));
        }
    } else {
        const companion = profile.pets.find(p => p.id === profile.companion);
        embed.fields = [{ name: 'Your Collection', value: `${profile.pets.length} pets · ${profile.pets.filter(p => p.shiny).length} shiny` },
            { name: 'Companion', value: companion ? petName(companion) : 'Catch a pet to get started!' }];
    }
    if (notice) embed.description += `\n\n${notice.slice(0, 1100)}`;
    components.push(row(button(user, 'explore', e ? 'Resume Encounter' : '🌿 Explore', [], ButtonStyle.Success),
        button(user, 'collection', '📚 Collection', [0]), button(user, 'guide', 'How to Play')));
    const art = artPath(Boolean(e?.shiny));
    const files = existsSync(art) ? [{ attachment: art, name: 'habitat.png' }] : [];
    if (files.length && view !== 'collection' && view !== 'guide') embed.image = { url: 'attachment://habitat.png' };
    // The habitat is shared concept scenery, not a species-identification diagram.
    return { embeds: [new EmbedBuilder(embed)], components, attachments: [],
        files: embed.image ? files : [], allowedMentions: { parse: [] } };
}
