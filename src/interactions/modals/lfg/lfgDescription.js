import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

import { logger } from '../../../utils/logger.js';
import { SUBJECTS } from '../../../handlers/lfgSelectMenus.js';

import {
    createLfgVoiceChannel
} from '../../../services/lfg/lfgService.js';

const LFG_DESCRIPTION_MODAL_PREFIX =
    'lfg_description:';

const SUBJECT_EMOJIS = {
    anatomy_1: '🦴',
    anatomy_2: '🫀',
    microbiology: '🦠',
    teas: '📚',
    program: '🎓',
    chemistry: '🧪',
    physics: '⚛️',
    math: '📐'
};

export default {
    name: 'lfg_description',

    async execute(
        interaction,
        client,
        args
    ) {
        try {
            const creatorId =
                args?.[0];

            const selectedSubject =
                args?.[1];

            if (
                !creatorId ||
                !selectedSubject
            ) {
                return interaction.reply({
                    content:
                        '❌ Invalid LFG request.',
                    ephemeral: true
                });
            }

            /*
             * Make sure the person submitting
             * the modal is the person who
             * created the LFG.
             */
            if (
                creatorId !==
                interaction.user.id
            ) {
                return interaction.reply({
                    content:
                        '❌ This LFG form belongs to someone else.',
                    ephemeral: true
                });
            }

            const subject =
                SUBJECTS[selectedSubject];

            if (!subject) {
                return interaction.reply({
                    content:
                        '❌ Invalid LFG subject.',
                    ephemeral: true
                });
            }

            /*
             * Get the description.
             */
            const description =
                interaction.fields.getTextInputValue(
                    'lfg-description'
                );

            /*
             * Use the Study Room the creator
             * is already inside.
             */
            const result =
                await createLfgVoiceChannel(
                    interaction,
                    subject.label
                );

            if (!result.success) {
                return interaction.reply({
                    content:
                        result.error ||
                        '❌ I could not create your LFG.',
                    ephemeral: true
                });
            }

            const channel =
                result.channel;

            /*
             * Subject emoji.
             */
            const subjectEmoji =
                SUBJECT_EMOJIS[selectedSubject] ||
                '📚';

            /*
             * Public LFG announcement.
             */
            const lfgEmbed =
                new EmbedBuilder()
                    .setTitle(
                        '🔎 LFG Created!'
                    )
                    .setDescription(
                        `${subjectEmoji} **${subject.label}**\n\n` +
                        `📝 **Description:** ${description}\n\n` +
                        `🔊 **Study Room:** <#${channel.id}>\n` +
                        `👥 **Maximum:** ${channel.userLimit || 4} people`
                    );

            /*
             * Join Study Room button.
             *
             * The channel ID is stored in
             * the button custom ID so the
             * button knows which VC to join.
             */
            const joinButton =
                new ButtonBuilder()
                    .setCustomId(
                        `lfg_join:${channel.id}`
                    )
                    .setLabel(
                        'Join Study Room'
                    )
                    .setEmoji('🔊')
                    .setStyle(
                        ButtonStyle.Primary
                    );

            const buttonRow =
                new ActionRowBuilder()
                    .addComponents(
                        joinButton
                    );

            /*
             * PUBLIC message.
             */
            await interaction.channel.send({
                embeds: [
                    lfgEmbed
                ],
                components: [
                    buttonRow
                ]
            });

            /*
             * PRIVATE confirmation.
             */
            await interaction.reply({
                content:
                    `✅ Your **${subject.label}** LFG has been posted!\n\n` +
                    `🔊 Study Room: <#${channel.id}>`,
                ephemeral: true
            });

        } catch (error) {
            logger.error(
                'LFG description modal error:',
                error
            );

            if (!interaction.replied) {
                await interaction.reply({
                    content:
                        '❌ Something went wrong while creating your LFG.',
                    ephemeral: true
                });
            }
        }
    }
};

export {
    LFG_DESCRIPTION_MODAL_PREFIX
};
