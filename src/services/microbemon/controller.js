import { announceCrateDrop } from '../discovery/announcements.js';
import { isSponsorForCatch } from './catchLimits.js';
import { MicrobemonError } from './errors.js';
import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { withProfile } from './store.js';
import { act } from './engine.js';
import { renderSession } from './interface.js';
import { logger } from '../../utils/logger.js';

// Discord rejects an entire card when a custom emoji is unavailable to the bot.
// Retry that display once without custom emoji; never repeat the saved action.
async function displaySession(interaction, message) {
    try {
        return await interaction.editReply(message);
    } catch (error) {
        const details = JSON.stringify(error.rawError?.errors || {});
        if (Number(error.code) !== 50035 || !/emoji/i.test(details)) throw error;
        const components = message.components.map(row => {
            const data = row.toJSON();
            return { ...data, components: data.components.map(component => {
                const result = { ...component };
                if (result.emoji?.id) delete result.emoji;
                if (result.options) result.options = result.options.map(option => { const next = { ...option }; if (next.emoji?.id) delete next.emoji; return next; });
                return result;
            }) };
        });
        logger.warn(`Microbemon display retry: custom emoji rejected by Discord (code ${error.code}).`);
        return interaction.editReply({ ...message, components, attachments: [] });
    }
}

async function presentSession(interaction, profile, owner, options) {
    try {
        await displaySession(interaction, await renderSession(profile, owner, { ...options, hostedArtwork: true }));
    } catch (error) {
        logFailure('Microbemon illustrated card failed:', 'display; retrying without artwork', error);
        const fallback = await renderSession(profile, owner, { ...options, artwork: false });
        fallback.components = fallback.components.map(row => {
            const data = row.toJSON();
            return { ...data, components: data.components.map(component => {
                const result = { ...component };
                delete result.emoji;
                return result;
            }) };
        });
        for (const embed of fallback.embeds) {
            const data = embed.toJSON();
            if (data.title) embed.setTitle(data.title.replace(/<a?:[^:>]+:\d+>/g, '').trim());
        }
        fallback.content = 'The artwork preview is temporarily unavailable. You can still play and open your Microbedeck.';
        await interaction.editReply(fallback);
    }
}

function logFailure(prefix, stage, error) {
    // Winston's console formatter drops a second string argument. Keep the
    // diagnostic in the message itself, without logging request bodies/tokens.
    logger.warn(`${prefix} [${stage}] ${error.name || 'Error'}${error.code ? ` (${error.code})` : ''}: ${error.message || 'No error message'}`);
}

export async function openMicrobemon(interaction, options = {}) {
    await interaction.deferReply();
    let stage = 'load collection';
    try {
        const { profile } = await withProfile(interaction.client, interaction.guildId, interaction.user.id, () => {});
        stage = 'render card';
        await presentSession(interaction, profile, interaction.user.id, { view: options.view || 'home', ownerName: interaction.member?.displayName || interaction.user.username });
    } catch (error) {
        logFailure('Microbemon could not open:', stage, error);
        const content = error instanceof MicrobemonError ? error.message : stage === 'load collection'
            ? 'Microbemon could not load your saved collection. Please try again. Your saved pets have not been reset.'
            : 'Your Microbemon collection loaded, but its game card could not be displayed. Your saved pets have not been reset. Please try /microbemon again.';
        await interaction.editReply({ content, embeds: [], attachments: [], components: [], allowedMentions: { parse: [] } });
    }
}
export async function handleMicrobemon(interaction, client, args, runAction = act) {
    const [owner, requestedAction, argument, revision, answer] = args;
    // Older public cards used the same route for both the deck button and pet details.
    const action = requestedAction === 'box' ? 'deck' : requestedAction === 'partybox' ? 'party' : requestedAction === 'collection' && interaction.component?.label?.includes('Microbedeck')
        ? 'deck' : requestedAction;
    const token = action === 'pet' || requestedAction === 'box' ? (interaction.values?.[0] || argument) : argument;
    if (owner !== interaction.user.id && ['deck', 'home'].includes(action)) return openMicrobemon(interaction, { view: action === 'deck' ? 'deck' : 'home' });
    if (owner !== interaction.user.id) return interaction.reply({ content: 'Open your own Microbemon game with /microbemon.', flags: MessageFlags.Ephemeral });
    if (action === 'rename') {
        const modal = new ModalBuilder().setCustomId(`microbemon:${owner}:nickname:${token}`).setTitle('Nickname your Microbemon')
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nickname').setLabel('Nickname').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(24).setRequired(true)));
        return interaction.showModal(modal);
    }
    await interaction.deferUpdate();
    try {
        const sponsor = action === 'catch' ? await isSponsorForCatch(interaction) : false;
        const { profile, value } = await withProfile(client, interaction.guildId, owner, profile => {
            if (action === 'party') {
                if (!profile.encounter || profile.encounter.id !== token || profile.encounter.revision !== Number(revision) || profile.encounter.expiresAt <= Date.now()) throw new MicrobemonError('This encounter has changed. Use the latest Microbemon game card.');
                return '';
            }
            if (['collection', 'guide', 'deck', 'home'].includes(action)) return '';
            if (action === 'pet') {
                if (!profile.pets.some(pet => pet.id === token)) throw new MicrobemonError('That pet is not in your Microbedeck.');
                return '';
            }
            return runAction(profile, action, { sponsor, encounterId: token, revision: Number(revision), answer: Number(answer), petId: action === 'switch' ? interaction.values?.[0] : token, confirmation: revision,
                nickname: action === 'nickname' ? interaction.fields.getTextInputValue('nickname') : undefined });
        });
        const caughtIndex = action === 'catch' ? profile.pets.findIndex(pet => pet.id === token) : -1;
        let view = action === 'guide' ? 'guide' : action === 'deck' ? 'deck' : action === 'party' ? 'party' : action === 'release_prompt' ? 'release' : action === 'release_confirm' ? 'deck' : 'home';
        let page = action === 'party' ? Number(requestedAction === 'partybox' ? interaction.values?.[0] : answer) || 0 : Number(token) || 0;
        if (caughtIndex >= 0) {
            await announceCrateDrop(interaction, owner, profile.pets[caughtIndex].catchReward);
            view = 'collection';
            page = caughtIndex;
        } else if (['collection', 'companion', 'nickname', 'pet', 'release_cancel'].includes(action)) {
            view = 'collection';
            if (action !== 'collection') page = profile.pets.findIndex(pet => pet.id === token);
        }
        await presentSession(interaction, profile, owner, { view, page, releasePetId: action === 'release_prompt' ? token : null, notice: value, ownerName: interaction.member?.displayName || interaction.user.username });
    } catch (error) {
        // Errors do not consume a capsule or lose a pet: the transaction rolls back.
        logFailure('Microbemon interaction failed:', action, error);
        const message = error instanceof MicrobemonError
            ? error.message : 'Could not save your game. Please try again; no catch has been confirmed.';
        await interaction.followUp({ content: message.slice(0, 1900), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
}

