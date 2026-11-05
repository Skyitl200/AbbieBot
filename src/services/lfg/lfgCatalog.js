import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

/*
 * LFG subjects.
 */
export const SUBJECTS = {

    anatomy_1: {
        label: 'Anatomy and Physiology I',
        emoji: '<:AP1:1557576078518648842>',
        image: 'anatomy_1.png',
    },

    anatomy_2: {
        label: 'Anatomy and Physiology II',
        emoji: '<:AP2:1557576103256784896>',
        image: 'anatomy_2.png',
    },

    microbiology: {
        label: 'Microbiology',
        emoji: '<:Microbiology:1557576299365671013>',
        image: 'microbiology.png',
    },

    teas: {
        label: 'TEAS',
        emoji: '<:TEAS:1557576611115565076>',
        image: 'teas.png',
    },

    program: {
        label: 'Program',
        emoji: '🎓'
    },

    chemistry: {
        label: 'Chemistry',
        emoji: '<:Chemistry:1557576122500120587>',
        image: 'chemistry.png',
    },

    physics: {
        label: 'Physics',
        emoji: '<:Physics:1557576410917507082>',
        image: 'physics.png',
    },

    math: {
        label: 'Math',
        emoji: '<:Math:1558128316253470861>',
        image: 'math.png',
    }

};
/*
 * Healthcare programs.
 */
export const PROGRAMS = {
    nursing: {
        label: 'Nursing School (RN)',
        emoji: '🩺',
        image: 'nursing.png',
    },

    dental_hygienist: {
        label: 'Dental Hygienist School',
        emoji: '🦷',
        image: 'dental_hygienist.png',
    },

    dental_assistant: {
        label: 'Dental Assistant School',
        emoji: '🦷',
        image: 'dental_assistant.png',
    },

    radiologic_technologist: {
        label: 'X-Ray Technician School (Radiologic Technology)',
        emoji: '🩻',
        image: 'radiologic_technologist.png',
    },

    diagnostic_medical_sonography: {
        label: 'Diagnostic Medical Sonography (DMS)',
        emoji: '🔊',
        image: 'diagnostic_medical_sonography.png',
    },

    respiratory_therapist: {
        label: 'Respiratory Therapist School',
        emoji: '🫁',
        image: 'respiratory_therapist.png',
    },

    physical_therapy_assistant: {
        label: 'Physical Therapy Assistant School (PTA)',
        emoji: '🏃',
        image: 'physical_therapy_assistant.png',
    },

    physician_assistant: {
        label: 'Physician Assistant School (PA)',
        emoji: '🩺',
        image: 'physician_assistant.png',
    },

    medical_school: {
        label: 'Medical School',
        emoji: '🧑‍⚕️',
        image: 'medical_school.png',
    }
};

export function lfgOptions(catalog) {
    return Object.entries(catalog)
        .filter(([value]) => value !== 'program')
        .map(([value, entry]) => ({ label: entry.label, value, emoji: entry.emoji }));
}

export function buildLfgMenus(userId) {
    return [
        new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId('lfg_subject')
            .setPlaceholder('Choose a subject')
            .addOptions(lfgOptions(SUBJECTS))),
        new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId(`lfg_program:${userId}`)
            .setPlaceholder('Or choose a healthcare program')
            .addOptions(lfgOptions(PROGRAMS)))
    ];
}
