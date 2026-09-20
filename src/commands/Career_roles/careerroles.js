import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} from 'discord.js';

const CAREER_ROLES = [
    {
        name: 'Nursing Student',
        emojiName: 'Nursing',
        emojiId: '1551061136856584254',
        roleId: '1549970899959287951'
    },
    {
        name: 'Dental Hygienist Student',
        emojiName: 'DentalHygienist',
        emojiId: '1550400239263809647',
        roleId: '1549975135954403398'
    },
    {
        name: 'Dental Assistant Student',
        emojiName: 'DentalAssistant',
        emojiId: '1550398526356193371',
        roleId: '1549975552427954217'
    },
    {
        name: 'X-Ray Tech Student',
        emojiName: 'XrayTechStudent',
        emojiId: '1550389353740636191',
        roleId: '1549975582312501389'
    },
    {
        name: 'Ultrasound Tech Student',
        emojiName: 'UltrasoundTech',
        emojiId: '1550392240336150548',
        roleId: '1549975653837709323'
    },
    {
        name: 'Radiation Therapist Student',
        emojiName: 'RadiationTherapist',
        emojiId: '1550395958251225158',
        roleId: '1549975782758158376'
    },
    {
        name: 'Respiratory Therapist Student',
        emojiName: 'RespiratoryTherapist',
        emojiId: '1550377197326434324',
        roleId: '1549975848319328386'
    },
    {
        name: 'Physical Therapy Assistant Student',
        emojiName: 'PhysicalTherapyAssistant',
        emojiId: '1550379732598661201',
        roleId: '1549976038245793802'
    },
    {
        name: 'Medical Student',
        emojiName: 'MedicalStudent',
        emojiId: '1550385070064406628',
        roleId: '1550349138606956654'
    }
];

export default {
    data: new SlashCommandBuilder()
        .setName('careerroles')
        .setDescription('Set up the BiologyHQ healthcare career roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Post the BiologyHQ career role panel')

                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription(
                            'Channel where the career roles should be posted'
                        )
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand !== 'setup') return;

        await interaction.deferReply({
            ephemeral: true
        });

        const channel =
            interaction.options.getChannel('channel');

        const botMember =
            interaction.guild.members.me;

        // Make sure AbbieBot has Manage Roles.
        if (
            !botMember.permissions.has(
                PermissionFlagsBits.ManageRoles
            )
        ) {
            return interaction.editReply(
                '❌ AbbieBot needs the **Manage Roles** permission.'
            );
        }

        // Check that every BiologyHQ career role exists
        // and is below AbbieBot in the role hierarchy.
        const invalidRoles = [];

        for (const career of CAREER_ROLES) {
            const role =
                interaction.guild.roles.cache.get(
                    career.roleId
                ) ??
                await interaction.guild.roles
                    .fetch(career.roleId)
                    .catch(() => null);

            if (!role) {
                invalidRoles.push(
                    `${career.name} — role not found`
                );

                continue;
            }

            if (
                role.position >=
                botMember.roles.highest.position
            ) {
                invalidRoles.push(
                    `${career.name} — role is above AbbieBot in the role list`
                );
            }
        }

        if (invalidRoles.length > 0) {
            return interaction.editReply(
                `❌ I can't manage some career roles:\n\n` +
                `${invalidRoles.join('\n')}\n\n` +
                `Move **AbbieBot's role above all of the student roles** and try again.`
            );
        }

        // Build the BiologyHQ career-role display.
        const description = CAREER_ROLES
            .map(
                career =>
                    `<a:${career.emojiName}:${career.emojiId}>  ` +
                    `<@&${career.roleId}>`
            )
            .join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(
                '✧ HEALTHCARE CAREER PATH ROLES ✧'
            )
            .setDescription(
                `${description}\n\n` +
                `**Choose your career path below!**\n` +
                `React with the matching animated icon to receive your role.\n\n` +
                `Remove your reaction to remove the role.`
            )
            .setFooter({
                text: 'BiologyHQ • Career Roles'
            });

        // Send the panel.
        const message = await channel.send({
            embeds: [embed]
        });

        // Add all nine animated emojis as reactions.
        for (const career of CAREER_ROLES) {
            try {
                await message.react(
                    career.emojiId
                );
            } catch (error) {
                console.error(
                    `Could not add ${career.name} reaction:`,
                    error
                );
            }
        }

        // Save the official panel message.
        await interaction.client.db.set(
            `careerroles:${interaction.guild.id}`,
            {
                guildId: interaction.guild.id,
                channelId: channel.id,
                messageId: message.id,
                createdAt: new Date().toISOString()
            }
        );

        await interaction.editReply(
            `✅ Career role panel created in ${channel}.`
        );
    }
};

export { CAREER_ROLES };
