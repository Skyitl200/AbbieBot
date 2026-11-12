import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshStoreChannel, STORE_CHANNEL_ID } from '../src/services/storeChannelRefresh.js';

const logger = { info() {}, warn() {} };
function fixture() {
  const edits = [];
  const message = { id: 'post', author: { id: 'bot' }, content: '**BiologyHQ Store**',
    components: [{ type: 1, components: [
      { type: 2, style: 5, label: 'Online Tutoring — $20', url: 'https://example.com/online' },
      { type: 2, style: 5, label: 'In-Person Tutoring — $30', url: 'https://example.com/inperson' }
    ] }, { type: 1, components: [
      { type: 2, style: 5, label: 'Anatomy I', url: 'https://example.com/book' },
      { type: 2, style: 3, label: 'Subscribe — $10/month', custom_id: 'paypal_subscribe' },
      { type: 2, style: 1, label: 'Open Purchase Ticket', custom_id: 'create_ticket' }
    ] }], attachments: new Map([['old', { name: 'biologyhq-store.png' }]]),
    async edit(payload) { edits.push(payload); }
  };
  const messages = new Map([['post', message]]);
  const client = { user: { id: 'bot' }, channels: { async fetch(id) {
    assert.equal(id, STORE_CHANNEL_ID);
    return { isTextBased: () => true, messages: { fetch: async () => messages } };
  } } };
  return { edits, message, messages, client };
}

test('replaces existing image and price, retaining online/book URLs and ticket control', async () => {
  const { client, edits, message } = fixture();
  const original = structuredClone(message.components);
  assert.equal(await refreshStoreChannel(client, logger), 'updated');
  assert.equal(edits.length, 1);
  const payload = edits[0];
  const buttons = payload.components.flatMap(row => row.components);
  assert.deepEqual(buttons.filter(b => b.url).map(b => b.url), ['https://example.com/online', 'https://example.com/book']);
  assert.equal(buttons.find(b => b.custom_id === 'paypal_subscribe').label, 'Subscribe — $14.87/month');
  assert.ok(buttons.some(b => b.custom_id === 'create_ticket'));
  assert.equal(payload.content, '**HealthScienceGuild Store**');
  assert.equal(payload.files[0].name, 'healthscienceguild-store-horizontal.png');
  assert.deepEqual(payload.attachments, []);
  assert.deepEqual(message.components, original);
  message.content = payload.content;
  message.components = payload.components;
  message.attachments = new Map([['new', { name: payload.files[0].name }]]);
  assert.equal(await refreshStoreChannel(client, logger), 'unchanged');
  assert.equal(edits.length, 1);
});

test('does not edit another author or create a new post', async () => {
  const { client, edits, message } = fixture();
  message.author.id = 'other';
  assert.equal(await refreshStoreChannel(client, logger), 'not_found');
  assert.equal(edits.length, 0);
});

test('continues startup when access fails', async () => {
  const client = { channels: { fetch: async () => { throw new Error('Missing Access'); } } };
  assert.equal(await refreshStoreChannel(client, logger), 'failed');
});

test('replaces portrait artwork even when pricing and branding are already current', async () => {
  const { client, edits, message } = fixture();
  message.content = '**HealthScienceGuild Store**';
  message.components[0].components.pop();
  message.components[1].components.find(b => b.custom_id === 'paypal_subscribe').label = 'Subscribe — $14.87/month';
  message.attachments = new Map([['portrait', { name: 'healthscienceguild-store.png' }]]);
  assert.equal(await refreshStoreChannel(client, logger), 'updated');
  assert.equal(edits[0].files[0].name, 'healthscienceguild-store-horizontal.png');
});

test('combines separate anatomy buttons while preserving the Anatomy I checkout', async () => {
  const { client, edits, message } = fixture();
  message.components[1].components.splice(1, 0, { type: 2, style: 5, label: 'Anatomy II — $25', url: 'https://example.com/anatomy2', emoji: { name: 'heart' } });
  message.components[1].components[0].emoji = { name: 'brain' };
  await refreshStoreChannel(client, logger);
  const anatomy = edits[0].components.flatMap(row => row.components).filter(b => /^Anatomy/.test(b.label));
  assert.equal(anatomy.length, 1);
  assert.equal(anatomy[0].label, 'Anatomy 1 & 2 — $25');
  assert.equal(anatomy[0].url, 'https://example.com/book');
  assert.equal(anatomy[0].emoji, undefined);
});
