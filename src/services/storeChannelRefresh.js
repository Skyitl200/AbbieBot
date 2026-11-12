import { fileURLToPath } from 'node:url';

export const STORE_CHANNEL_ID = '1551091551726342144';
const imageName = 'healthscienceguild-store-horizontal.png';
const imagePath = fileURLToPath(new URL('../assets/store/healthscienceguild-store-horizontal.png', import.meta.url));

const rowsOf = message => message.components.map(row => row.toJSON ? row.toJSON() : row);
const isSubscription = button => button.custom_id === 'paypal_subscribe';
const anatomyPart = button => /^Anatomy\s+(II|2)(?:\s|—|$)/i.test(button.label || '') ? 2
  : /^Anatomy\s+(I|1)(?:\s|—|$)/i.test(button.label || '') && !/&/.test(button.label || '') ? 1 : 0;
const isInPerson = button => /in[\s-]*person\s+tutoring/i.test(button.label || '');

// Update only the owner's specified channel and an existing store post by this bot.
// Never create a duplicate or touch other members' posts. Failures don't stop startup.
export async function refreshStoreChannel(client, logger) {
  try {
    const channel = await client.channels.fetch(STORE_CHANNEL_ID);
    if (!channel?.isTextBased() || !channel.messages) return 'unavailable';

    let before;
    for (let page = 0; page < 10; page += 1) {
      const messages = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      const message = [...messages.values()].find(candidate =>
        candidate.author.id === client.user.id &&
        /store/i.test(candidate.content || '') &&
        rowsOf(candidate).some(row => row.components.some(isSubscription))
      );
      if (message) {
        const oldRows = rowsOf(message);
        const hasAnatomyOne = oldRows.some(row => row.components.some(button => anatomyPart(button) === 1));
        const components = oldRows.map(row => ({
          ...row,
          components: row.components.filter(button => !isInPerson(button) && !(hasAnatomyOne && anatomyPart(button) === 2)).map(button => {
            if (isSubscription(button)) return { ...button, label: 'Subscribe — $14.87/month' };
            if (anatomyPart(button) === 1) {
              const { emoji, ...combined } = button;
              return { ...combined, label: 'Anatomy 1 & 2 — $25' };
            }
            return button;
          })
        })).filter(row => row.components.length);
        const content = message.content.replace(/BiologyHQ/g, 'HealthScienceGuild');
        const current = [...message.attachments.values()].some(file => file.name === imageName) &&
          JSON.stringify(oldRows) === JSON.stringify(components) && content === message.content;
        if (current) return 'unchanged';

        await message.edit({
          content,
          components,
          attachments: [],
          files: [{ attachment: imagePath, name: imageName }]
        });
        logger.info('HealthScienceGuild store channel refreshed', {
          channelId: STORE_CHANNEL_ID, messageId: message.id
        });
        return 'updated';
      }
      if (messages.size < 100) break;
      before = messages.last().id;
    }
    logger.warn('Existing store post not found; no duplicate was created', { channelId: STORE_CHANNEL_ID });
    return 'not_found';
  } catch (error) {
    logger.warn('Could not refresh HealthScienceGuild store channel', {
      channelId: STORE_CHANNEL_ID, error: error.message
    });
    return 'failed';
  }
}
