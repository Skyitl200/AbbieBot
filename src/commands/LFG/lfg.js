import {
    SlashCommandBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder
} from 'discord.js';

import {
    getFromDb,
    setInDb
} from '../../utils/database.js';

const SUBSCRIBER_ROLE_ID = '1552123365760831488';

const FREE_LFG_LIMIT = 3;

const LFG_WINDOW_MS =
    24 * 60 * 60 * 1000;

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('lfg')
        .setDescription('Create a Looking For Group post'),

    category: 'LFG',

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content:
                    '❌ This command can only be used inside BiologyHQ.',
                ephemeral: true
            });
        }

        const member = interaction.member;

        const isSubscriber =
            member.roles.cache.has(
                SUBSCRIBER_ROLE_ID
            );

        /*
         * Subscribers have unlimited LFG posts.
         */
        if (!isSubscriber) {
            const key =
                `lfg:usage:${interaction.guild.id}:${interaction.user.id}`;

            const now = Date.now();

            const storedUsage =
                await getFromDb(key, []);

            const usage =
                Array.isArray(storedUsage)
                    ? storedUsage
                    : [];

            /*
             * Only keep posts made during the
             * previous 24 hours.
             */
            const recentPosts =
                usage.filter(
                    timestamp =>
                        now - Number(timestamp) <
                        LFG_WINDOW_MS
                );

            if (
                recentPosts.length >=
                FREE_LFG_LIMIT
            ) {
                const oldestPost =
                    Math.min(...recentPosts);

                const resetTime =
                    oldestPost +
                    LFG_WINDOW_MS;

                const discordTimestamp =
                    Math.ceil(resetTime / 1000);

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                '⏳ LFG Post Limit Reached'
                            )
                            .setDescription(
                                `You can create **3 LFG posts every 24 hours**.\n\n` +
                                `Your next LFG post will become available <t:${discordTimestamp}:R>.\n\n` +
                                `⭐ **Subscribers get unlimited LFG posts.**`
                            )
                    ],
                    ephemeral: true
                });
            }

            /*
             * TEMPORARY:
             * For now this records the use here.
             *
             * Once we build the actual LFG post
             * form, we'll move this so it only
             * counts after an LFG post is
             * successfully submitted.
             */
            recentPosts.push(now);

            await setInDb(
                key,
                recentPosts
            );
        }

        const remainingText =
            isSubscriber
                ? '⭐ Subscriber — Unlimited'
                : 'LFG post started.';
        const subjectMenu =
    new StringSelectMenuBuilder()
        .setCustomId(
            `lfg_subject:${interaction.user.id}`
        )
        .setPlaceholder(
            'Select a subject or course'
        )
        .addOptions(
            {
                label: 'Anatomy & Physiology I',
                value: 'anatomy_1',
                emoji: '🦴'
            },
            {
                label: 'Anatomy & Physiology II',
                value: 'anatomy_2',
                emoji: '🫀'
            },
            {
                label: 'Microbiology',
                value: 'microbiology',
                emoji: '🦠'
            },
            {
                label: 'TEAS',
                value: 'teas',
                emoji: '📚'
            },
             {
    label: 'Program',
    value: 'program',
    emoji: '🎓'
}
        );
            {
                label: 'Chemistry',
                value: 'chemistry',
                emoji: '🧪'
            },
            {
    label: 'Physics',
    value: 'physics',
    emoji: '⚛️'
},
            {
                label: 'Math',
                value: 'math',
                emoji: '📐'
            },
           

const subjectRow =
    new ActionRowBuilder()
        .addComponents(subjectMenu);

        return interaction.reply({
    embeds: [
        new EmbedBuilder()
            .setTitle(
                '🔎 Looking For Group'
            )
            .setDescription(
                `${remainingText}\n\n` +
                `**Step 1:** Select the subject or course you want to study.`
            )
    ],
    components: [
        subjectRow
    ],
    ephemeral: true
});
    }
};
