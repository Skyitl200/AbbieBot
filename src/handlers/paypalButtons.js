import crypto from 'crypto';
import { ButtonStyle, ActionRowBuilder, ButtonBuilder, MessageFlags } from 'discord.js';
import { logger } from '../utils/logger.js';

function createSubscriptionToken(userId) {
  const secret = process.env.SUBSCRIPTION_LINK_SECRET;

  if (!secret) {
    throw new Error('Missing SUBSCRIPTION_LINK_SECRET');
  }

  const signature = crypto
    .createHmac('sha256', secret)
    .update(userId)
    .digest('hex');

  return `${userId}.${signature}`;
}

export const paypalSubscribeHandler = {
  name: 'paypal_subscribe',

  async execute(interaction) {
    try {
      const token = createSubscriptionToken(interaction.user.id);

      const baseUrl =
        process.env.PUBLIC_BASE_URL ||
        'https://abbiebot-production-35d6.up.railway.app';

      const subscriptionUrl =
        `${baseUrl}/subscribe?token=${encodeURIComponent(token)}`;

      const button = new ButtonBuilder()
        .setLabel('Continue to PayPal')
        .setStyle(ButtonStyle.Link)
        .setURL(subscriptionUrl);

      const row = new ActionRowBuilder().addComponents(button);

      await interaction.reply({
        content:
          '**BiologyHQ Membership — $10/month**\n\n' +
          'Click below to continue securely to PayPal. ' +
          'This checkout link is connected to your Discord account.',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });

      logger.info('PayPal subscription link created', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    } catch (error) {
      logger.error('Failed to create PayPal subscription link:', error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            'I could not create your subscription link. Please try again.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};