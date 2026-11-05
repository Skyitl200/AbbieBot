import { MicrobemonError } from './errors.js';
import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { withProfile } from './store.js';
import { act } from './engine.js';
import { renderGame } from './interface.js';
import { logger } from '../../utils/logger.js';

export async function openMicrobemon(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const { profile } = await withProfile(interaction.client, interaction.guildId, interaction.user.id, () => {});
        await interaction.editReply(renderGame(profile, interaction.user.id));
    } catch (error) {
        logger.warn('Microbemon could not open:', error.message);
        await interaction.editReply({ content: 'Microbemon could not open its saved collection. Make sure the persistent database is available and play inside a server.', components: [] });
    }
}
export async function handleMicrobemon(interaction, client, args) {
    const [owner, action, token, revision, answer] = args;
    if (owner !== interaction.user.id) return interaction.reply({ content: 'Open your own Microbemon game with /test microbemon:true.', flags: MessageFlags.Ephemeral });
    if (action === 'rename') {
        const modal = new ModalBuilder().setCustomId(`microbemon:${owner}:nickname:${token}`).setTitle('Nickname your Microbemon')
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nickname').setLabel('Nickname').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(24).setRequired(true)));
        return interaction.showModal(modal);
    }
    await interaction.deferUpdate();
    try {
        const { profile, value } = await withProfile(client, interaction.guildId, owner, profile => {
            if (action === 'collection' || action === 'guide') return '';
            return act(profile, action, { encounterId: token, revision: Number(revision), answer: Number(answer), petId: token,
                nickname: action === 'nickname' ? interaction.fields.getTextInputValue('nickname') : undefined });
        });
        const view = ['collection', 'companion', 'nickname'].includes(action) ? 'collection' : action === 'guide' ? 'guide' : 'home';
        const page = ['companion', 'nickname'].includes(action) ? profile.pets.findIndex(p => p.id === token) : Number(token) || 0;
        await interaction.editReply(renderGame(profile, owner, { view, page, notice: value }));
    } catch (error) {
        // Errors do not consume a capsule or lose a pet: the transaction rolls back.
        logger.warn('Microbemon interaction failed:', error.message);
        const message = error instanceof MicrobemonError
            ? error.message : 'Could not save your game. Please try again; no catch has been confirmed.';
        await interaction.followUp({ content: message.slice(0, 1900), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
}
