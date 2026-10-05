import {
    ActionRowBuilder,
    StringSelectMenuBuilder
} from 'discord.js';

import { logger } from '../../../utils/logger.js';

import {
    pendingLfgDescriptions
} from '../../../handlers/lfgSelectMenus.js';

const LFG_DESCRIPTION_MODAL_PREFIX =
    'lfg_description:';

const LFG_CAPACITY_SELECT_PREFIX =
    'lfg_capacity:';

export default {
    name: 'lfg_description',

    async execute(
        interaction,
        client,
        args
    ) {
        try {

            /*
             * Get the LFG creator ID
             * and selected subject.
             *
             * Custom ID format:
             *
             * lfg_description:USER_ID:SUBJECT
             */
            const creatorId =
                args?.[0];

            const selectedSubject =
                args?.[1];

            /*
             * Validate the request.
             */
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
             * originally selected the subject.
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

            /*
             * Get the description entered
             * by the LFG creator.
             */
            const description =
                interaction.fields.getTextInputValue(
                    'lfg-description'
                );

            /*
             * Save the description temporarily.
             *
             * The capacity selection that comes
             * next will use this information to
             * finish creating the LFG.
             */
            pendingLfgDescriptions.set(
                interaction.user.id,
                {
                    selectedSubject,
                    description
                }
            );

            /*
             * Create the capacity selector.
             *
             * The creator can choose:
             *
             * 2 people
             * 3 people
             * 4 people
             * 5 people
             */
            const capacityMenu =
                new StringSelectMenuBuilder()
                    .setCustomId(
                        `${LFG_CAPACITY_SELECT_PREFIX}${interaction.user.id}`
                    )
                    .setPlaceholder(
                        '👥 Select maximum Study Room size'
                    )
                    .addOptions(
                        {
                            label:
                                '2 people',
                            description:
                                'Small study group',
                            value:
                                '2',
                            emoji:
                                '👤'
                        },
                        {
                            label:
                                '3 people',
                            description:
                                'Small study group',
                            value:
                                '3',
                            emoji:
                                '👥'
                        },
                        {
                            label:
                                '4 people',
                            description:
                                'Medium study group',
                            value:
                                '4',
                            emoji:
                                '👥'
                        },
                        {
                            label:
                                '5 people',
                            description:
                                'Larger study group',
                            value:
                                '5',
                            emoji:
                                '👥'
                        }
                    );

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        capacityMenu
                    );

            /*
             * Show the capacity selector
             * privately to the creator.
             */
            await interaction.reply({
                content:
                    '👥 **How many people should be allowed in your Study Room?**',
                components: [
                    row
                ],
                ephemeral: true
            });

        } catch (error) {

            logger.error(
                'LFG description modal error:',
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        '❌ Something went wrong while setting up your Study Room.',
                    ephemeral: true
                });
            }
        }
    }
};

export {
    LFG_DESCRIPTION_MODAL_PREFIX
};
