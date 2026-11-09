import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { consumeQuizStart } from '../../services/study/usageLimit.js';
import { logger } from '../../utils/logger.js';
import { classMessage } from '../../services/study/interface.js';

export default {
    slashOnly: true,
    category: 'Community',
    data: new SlashCommandBuilder().setName('test').setDescription('Choose a class and topic, practice questions, and earn Merit Coins.'),
    async execute(interaction, guildConfig, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        let usage;
        try {
            usage = await consumeQuizStart(interaction, client || interaction.client);
        } catch (error) {
            logger.warn('Unable to check study usage limit', { error: error.message });
            return interaction.editReply({ content: 'Unable to check your quiz allowance right now. Please try again shortly.', embeds: [], components: [] });
        }
        if (!usage.allowed) {
            return interaction.editReply({
                content: `You can use /test **50 times per 24 hours**. Your next use is available <t:${Math.ceil(usage.resetAt / 1000)}:R>.\nSubscribers have unlimited uses.`,
                embeds: [], components: [], allowedMentions: { parse: [] },
            });
        }
        await interaction.editReply(classMessage(interaction.user.id));
    },
};
