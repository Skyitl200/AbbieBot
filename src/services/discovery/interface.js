import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { shopItems } from '../../config/shop/items.js';
import { CACHE_ID, CACHE_NAME, CACHE_REWARDS, DISCOVERY_ITEMS } from './catalog.js';
import { createOpenToken, openDiscoveryCache, DiscoveryCacheError } from './store.js';

const knownItems = new Map([...shopItems, ...DISCOVERY_ITEMS].map(item => [item.id, item]));
export function inventoryMessage(inventory, user, notice = '') {
    const lines = Object.entries(inventory).filter(([, quantity]) => Number(quantity) > 0).map(([id, quantity]) => `**${knownItems.get(id)?.name || id}:** ${quantity}x`);
    const description = (notice ? `${notice}\n\n` : '') + (lines.join('\n') || 'Your inventory is currently empty.');
    const embed = new EmbedBuilder({ title: `${user.username || 'Your'} Inventory`, description: description.slice(0, 4096), color: 0x2dd4bf });
    if (user.displayAvatarURL) embed.setThumbnail(user.displayAvatarURL());
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`discovery:open:${user.id}:${createOpenToken()}`).setLabel(`Open ${CACHE_NAME}`).setStyle(ButtonStyle.Success).setDisabled(!(Number(inventory[CACHE_ID]) > 0)),
        new ButtonBuilder().setCustomId(`discovery:rewards:${user.id}`).setLabel('Possible Cache Rewards').setStyle(ButtonStyle.Secondary),
    )] };
}
export function cacheRewardsMessage() {
    return { embeds: [new EmbedBuilder({ title: `${CACHE_NAME} · Reward List`, color: 0x2dd4bf,
        description: 'Each correct /test answer or successful Microbemon catch independently has a **1-in-300** chance to drop a cache. Open one from /inventory to receive **one** reward. Collectibles stay in your inventory permanently; they are cosmetic items, with no server role or pet bonuses.',
        fields: CACHE_REWARDS.map(item => ({ name: `${item.name} · ${item.rarity} · ${item.weight}%`, value: item.description })),
    })], components: [] };
}
export async function handleDiscoveryInteraction(interaction, client, args) {
    const [action, ownerId, token] = args;
    if (interaction.user.id !== ownerId) return interaction.reply({ content: 'Use /inventory to open your own Discovery Caches.', flags: MessageFlags.Ephemeral });
    if (action === 'rewards') return interaction.reply({ ...cacheRewardsMessage(), flags: MessageFlags.Ephemeral });
    if (action !== 'open') return interaction.reply({ content: 'Open /inventory to use the latest cache buttons.', flags: MessageFlags.Ephemeral });
    await interaction.deferUpdate();
    let result;
    try {
        result = await openDiscoveryCache(client, interaction.guildId, ownerId, token);
    } catch (error) {
        const message = error instanceof DiscoveryCacheError ? error.message : 'Could not confirm your cache opening. Please try the same button again; an already-saved reward will not be awarded twice.';
        return interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
    }
    const reward = result.reward;
    const notice = reward.id === 'merit_coins'
        ? `Opened a **${CACHE_NAME}**! You received **+${reward.amount} Merit Coins**.\nNew Balance: **${result.balance.toLocaleString()} Merit Coins**`
        : `Opened a **${CACHE_NAME}**! You received **${reward.name}** (${reward.rarity}). Saved permanently to your inventory.`;
    try {
        await interaction.editReply(inventoryMessage(result.inventory, interaction.user, notice));
    } catch {
        await interaction.followUp({ content: `${notice}\nUse /inventory to refresh your saved items.`, flags: MessageFlags.Ephemeral });
    }
}
