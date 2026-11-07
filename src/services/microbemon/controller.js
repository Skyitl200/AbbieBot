import { announceCrateDrop } from '../discovery/announcements.js';
import { isSponsorForCatch } from './catchLimits.js';
import { MicrobemonError } from './errors.js';
import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { withProfile } from './store.js';
import { act } from './engine.js';
import { renderSession } from './interface.js';
import { logger } from '../../utils/logger.js';

export async function openMicrobemon(interaction, options = {}) {
    await interaction.deferReply();
    try {
        const { profile } = await withProfile(interaction.client, interaction.guildId, interaction.user.id, () => {});
        await interaction.editReply(await renderSession(profile, interaction.user.id, { view: options.view || 'home', ownerName: interaction.member?.displayName || interaction.user.username }));
    } catch (error) {
        logger.warn('Microbemon could not open:', error.message);
        await interaction.editReply({ content: 'Microbemon could not open its saved collection. Make sure the persistent database is available and play inside a server.', components: [] });
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
        await interaction.editReply(await renderSession(profile, owner, { view, page, releasePetId: action === 'release_prompt' ? token : null, notice: value, ownerName: interaction.member?.displayName || interaction.user.username }));
    } catch (error) {
        // Errors do not consume a capsule or lose a pet: the transaction rolls back.
        logger.warn('Microbemon interaction failed:', error.message);
        const message = error instanceof MicrobemonError
            ? error.message : 'Could not save your game. Please try again; no catch has been confirmed.';
        await interaction.followUp({ content: message.slice(0, 1900), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
}
