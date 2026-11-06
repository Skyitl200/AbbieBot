import { MicrobemonError } from './errors.js';

export const DAILY_CATCH_LIMIT = 4;
export const CATCH_TIME_ZONE = 'America/New_York';
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: CATCH_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export const catchDay = now => dayFormatter.format(new Date(now));

export function dailyCatches(profile, now = Date.now()) {
    const day = catchDay(now);
    if (profile.dailyCatches?.day !== day) {
        // Seed old profiles from existing pets, then keep a durable counter so releases cannot reset it.
        const count = profile.pets.filter(pet => Number.isFinite(pet.caughtAt) && catchDay(pet.caughtAt) === day).length;
        profile.dailyCatches = { day, count };
    }
    return profile.dailyCatches;
}
export function checkCatchLimit(profile, sponsor, now) {
    const daily = dailyCatches(profile, now);
    if (!sponsor && daily.count >= DAILY_CATCH_LIMIT) throw new MicrobemonError('You have reached your 4 successful catches for today. Your allowance resets at midnight Eastern Time. Members with the Sponsor role have unlimited catches.');
    return daily;
}

export function memberHasSponsorRole(member, guild, configuredId = process.env.MICROBEMON_SPONSOR_ROLE_ID) {
    const roles = member?.roles?.cache;
    if (roles) return configuredId ? roles.has(configuredId) : [...roles.values()].some(role => role.name?.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase() === 'sponsor');
    const ids = Array.isArray(member?.roles) ? member.roles : [];
    if (configuredId) return ids.includes(configuredId);
    return ids.some(id => guild?.roles?.cache?.get(id)?.name?.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase() === 'sponsor');
}
export async function isSponsorForCatch(interaction) {
    // Refresh membership for catches, so role removal takes effect on the next attempt.
    let member = interaction.member;
    if (interaction.guild?.members?.fetch) {
        try {
            member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
            if (!process.env.MICROBEMON_SPONSOR_ROLE_ID && interaction.guild.roles?.fetch) await interaction.guild.roles.fetch();
        } catch { throw new MicrobemonError('Unable to verify your Sponsor role right now. Please try catching again in a moment.'); }
    }
    return memberHasSponsorRole(member, interaction.guild);
}
