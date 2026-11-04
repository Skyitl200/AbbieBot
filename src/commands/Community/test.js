import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { loadQuestionBanks } from '../../services/study/questions.js';
import { topicMessage } from '../../services/study/interface.js';
import legacyQuiz from '../../services/study/legacyQuiz.js';

export default {
    slashOnly: true,
    category: 'Community',
    data: new SlashCommandBuilder().setName('test').setDescription('Study anatomy and physiology by topic with mixed question types.')
        .addBooleanOption(option => option.setName('other-subjects').setDescription('Open the original quiz menu, including nursing, microbiology, and TEAS.')),
    async execute(interaction) {
        if (interaction.options.getBoolean('other-subjects')) return legacyQuiz.execute(interaction);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const banks = await loadQuestionBanks();
        await interaction.editReply(topicMessage(interaction.user.id, banks));
    },
};
