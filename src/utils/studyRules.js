// Editable starting state for /embedbuilder template:study-rules.
// Return fresh objects so one moderator's edits cannot alter another preview.
export function createStudyRulesState() {
    return {
        title: '🩺 THE STUDY SANCTUARY',
        description: '**Learn together. Grow together.**\nWelcome to a community where curiosity is encouraged, effort matters, and everyone deserves a place to learn.\n\n✦ **Our community guidelines** ✦',
        color: '#2DD4BF',
        author: null,
        footer: { text: 'Stay curious. Be kind. Keep growing. 🌱 • Contact the moderation team for help or to report a concern.' },
        thumbnail: null,
        image: null,
        timestamp: false,
        fields: [
            {
                name: '🫀 01 · RESPECT YOUR FELLOW STUDENTS',
                value: 'Treat everyone with kindness and respect. Harassment, bullying, discrimination, personal attacks, and deliberately making others uncomfortable are not welcome here.',
                inline: false,
            },
            {
                name: '🦴 02 · EVERY QUESTION BELONGS',
                value: 'Everyone starts somewhere. Never ridicule someone for asking a question or getting an answer wrong.\n\n**Correct → Explain → Encourage**',
                inline: false,
            },
            {
                name: '🔬 03 · LEARN WITH INTEGRITY',
                value: 'Help others understand the material. Do not request or share leaked, stolen, or active proctored exam questions or answers.\n\n**Build understanding. Earn your progress.**',
                inline: false,
            },
            {
                name: '📚 04 · PROTECT THE STUDY SPACE',
                value: 'Keep study and voice channels welcoming and focused. Avoid shouting, disruptive audio, excessive interruptions, and intentional distractions. Give everyone room to participate.',
                inline: false,
            },
            {
                name: '🩺 05 · KEEP IT CLASSROOM-APPROPRIATE',
                value: 'NSFW, hateful, excessively graphic, or otherwise inappropriate content is prohibited. Relevant educational anatomy and medical content are welcome; use content warnings and spoiler tags when appropriate.',
                inline: false,
            },
            {
                name: '🤝 06 · HELP THE COMMUNITY THRIVE',
                value: 'Share useful resources, answer questions when you can, welcome new students, and celebrate each other’s progress.\n\n**We learn better when we support one another.**',
                inline: false,
            },
        ],
    };
}
