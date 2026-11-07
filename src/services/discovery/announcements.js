import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { withCrateArtwork } from './artwork.js';
import { createOpenToken } from './store.js';
import { logger } from '../../utils/logger.js';

export function crateDropMessage(ownerId, token = createOpenToken()) {
    const payload = withCrateArtwork({ embeds: [], components: [] }, true);
    payload.embeds[0].setDescription(`<@${ownerId}> found a **Treasure Crate**! Everyone can see it, but only they can redeem it.\nAlready saved to their inventory. If the button expires, use /inventory.`);
    payload.components = [new ActionRowBuilder().addComponents(new ButtonBuilder()
        .setCustomId(`discovery:redeem:${ownerId}:${token}`).setLabel('Redeem Treasure Crate').setStyle(ButtonStyle.Success))];
    return { ...payload, flags: 0, allowedMentions: { parse: [] } };
}

// Retries of the same saved reward share one public announcement.
export async function announceCrateDrop(interaction, ownerId, reward) {
    if (!reward?.cacheDrop || reward.announcementId) return;
    if (reward.announcementPromise) return reward.announcementPromise;
    const operation = Promise.resolve().then(async () => {
        try {
            const message = await interaction.followUp(crateDropMessage(ownerId));
            reward.announcementId = message.id;
        } catch (error) {
            logger.warn(`Could not announce saved Treasure Crate: ${error.message}`);
        }
    });
    reward.announcementPromise = operation;
    try { await operation; }
    finally { delete reward.announcementPromise; }
}
