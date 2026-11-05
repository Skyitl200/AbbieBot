import { openMicrobemon } from '../../services/microbemon/controller.js';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { classMessage } from '../../services/study/interface.js';
import legacyQuiz from '../../services/study/legacyQuiz.js';

export default {
    slashOnly: true,
    category: 'Community',
    data: new SlashCommandBuilder().setName('test').setDescription('Choose a class and topic, practice questions, and earn Merit Coins.')
        .addBooleanOption(option => option.setName('other-subjects').setDescription('Open the original quiz menu, including nursing, microbiology, and TEAS.'))
        .addBooleanOption(option => option.setName('microbemon').setDescription('Play Microbemon: explore, battle, catch, and collect companions.')),
    async execute(interaction) {
        if (interaction.options.getBoolean('microbemon')) return openMicrobemon(interaction);
        if (interaction.options.getBoolean('other-subjects')) return legacyQuiz.execute(interaction);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.editReply(classMessage(interaction.user.id));
    },
};
