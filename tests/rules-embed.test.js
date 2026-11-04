import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import command from '../src/commands/Tools/embedbuilder.js';

function fixture(template) {
    const previews = [], collectors = [], sent = [], replies = [];
    const target = {
        permissionsFor: () => ({ has: () => true }),
        async send(payload) { sent.push(payload); },
        toString: () => '#rules',
    };
    const interaction = {
        id: 'rules-preview', user: { id: 'moderator' },
        options: { getString: () => template },
        guild: { members: { me: { id: 'bot' } } },
        channel: {
            createMessageComponentCollector(options) {
                const collector = { options, handlers: {}, on(event, handler) { this.handlers[event] = handler; return this; } };
                collectors.push(collector);
                return collector;
            },
        },
        async deferReply(payload) { replies.push(payload); this.deferred = true; },
        async editReply(payload) { previews.push(payload); },
    };
    return { interaction, previews, collectors, sent, replies, target };
}

test('study-rules opens an editable private six-rule teal preview without publishing', async () => {
    const f = fixture('study-rules');
    await command.execute(f.interaction);
    assert.equal(f.replies[0].flags, MessageFlags.Ephemeral);
    assert.equal(f.sent.length, 0);
    const preview = f.previews[0].embeds[0].toJSON();
    assert.equal(preview.title, '🩺 THE STUDY SANCTUARY');
    assert.equal(preview.color, 0x2dd4bf);
    assert.equal(preview.fields.length, 6);
    assert.match(preview.fields[0].name, /🫀/);
    assert.match(preview.footer.text, /Contact the moderation team/);
    assert.ok(preview.fields.every(field => !field.inline && field.value.length <= 1024));
    assert.match(preview.fields[1].value, /Correct → Explain → Encourage/);
    assert.match(preview.fields[2].value, /active proctored exam/);
    assert.match(preview.fields[4].value, /educational anatomy and medical content/);
    const textLength = f.previews[0].embeds.reduce((total, embed) => {
        const data = embed.toJSON();
        return total + (data.title?.length || 0) + (data.description?.length || 0) +
            (data.footer?.text?.length || 0) + (data.fields || []).reduce((n, field) => n + field.name.length + field.value.length, 0);
    }, 0);
    assert.ok(textLength <= 6000);
    assert.equal(f.collectors[0].options.filter({ user: { id: 'someone-else' }, customId: 'eb_main_post_embed' }), false);
    const schema = command.data.toJSON();
    assert.equal(schema.default_member_permissions, String(PermissionFlagsBits.ManageMessages));
    assert.equal(schema.options.find(option => option.name === 'template').choices[0].value, 'study-rules');
});

test('rules publish only after Post Embed and explicit channel selection', async () => {
    const f = fixture('study-rules');
    await command.execute(f.interaction);
    const button = { customId: 'eb_main_post_embed', user: f.interaction.user,
        async deferUpdate() { this.deferred = true; }, async followUp() {} };
    await f.collectors[0].handlers.collect(button);
    assert.equal(f.sent.length, 0);
    const choice = { customId: 'eb_post_channel', user: f.interaction.user,
        channels: { first: () => f.target }, async deferUpdate() { this.deferred = true; }, async followUp() {} };
    assert.equal(f.collectors[1].options.filter(choice), true);
    await f.collectors[1].handlers.collect(choice);
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].embeds[0].toJSON().fields.length, 6);
    assert.equal(f.sent[0].content, undefined);
});

test('embedbuilder remains blank when no template is selected', async () => {
    const f = fixture(null);
    await command.execute(f.interaction);
    const preview = f.previews[0].embeds[0].toJSON();
    assert.equal(preview.fields, undefined);
    assert.match(preview.description, /Empty/);
    assert.equal(f.sent.length, 0);
});
