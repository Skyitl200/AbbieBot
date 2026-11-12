import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMembershipPayment, isMembershipPlan, MEMBERSHIP_MS } from '../src/services/paypal/membershipPolicy.js';
import { processMembershipPayment, reconcileMemberships, ensureMembershipPlan } from '../src/services/paypal/membershipService.js';

const now = Date.parse('2026-11-12T12:00:00Z');
const userId = '123456789012345678';
const sale = (id = 'SALE-1', paidAt = now) => ({ id, state: 'completed', amount: { total: '14.87', currency: 'USD' }, billing_agreement_id: 'I-SUB', create_time: new Date(paidAt).toISOString() });
const subscription = { id: 'I-SUB', custom_id: userId, plan_id: 'P-NEW', status: 'CANCELLED' };
const options = (payment = sale()) => ({ now, getSale: async () => payment, getSubscription: async () => subscription, getPlan: async () => 'P-NEW' });
const event = (id = 'SALE-1') => ({ event_type: 'PAYMENT.SALE.COMPLETED', resource: { id } });
const logger = { warn() {} };
process.env.BIOLOGYHQ_GUILD_ID = 'guild';
process.env.SUBSCRIBER_ROLE_ID = 'subscriber';

function fixture() {
  let saved = new Map(), tail = Promise.resolve();
  let failRole = false;
  const roles = new Set();
  const operations = [];
  const pool = {
    async query() { return { rows: [...saved.keys()].filter(key => key.startsWith('paid-membership:')).map(key => ({ key })) }; },
    async connect() {
      let draft, unlock;
      return {
        async query(sql, params) {
          if (sql.includes('pg_advisory')) {
            const previous = tail; tail = new Promise(resolve => { unlock = resolve; }); await previous;
            draft = structuredClone(saved);
          }
          if (sql.startsWith('SELECT value')) return { rows: draft.has(params[0]) ? [{ value: structuredClone(draft.get(params[0])) }] : [] };
          if (sql.startsWith('INSERT')) draft.set(params[0], JSON.parse(params[1]));
          if (sql === 'COMMIT') saved = structuredClone(draft);
          return { rows: [] };
        }, release() { unlock?.(); }
      };
    }
  };
  const member = { roles: { cache: { has: id => roles.has(id) },
    async add(id) { if (failRole) throw new Error('Missing Permissions'); operations.push('add'); roles.add(id); },
    async remove(id) { if (failRole) throw new Error('Missing Permissions'); operations.push('remove'); roles.delete(id); }
  } };
  const guild = { members: { fetch: async () => member } };
  const client = { db: { pool }, isReady: () => true, guilds: { cache: new Map([['guild', guild]]) } };
  return { client, roles, operations, saved: () => saved, failRole: value => { failRole = value; } };
}

test('payment grants exactly 30 days and duplicate sale never extends access', () => {
  const first = applyMembershipPayment({ payments: {} }, sale(), now);
  assert.equal(first.expiresAt, now + MEMBERSHIP_MS);
  assert.equal(applyMembershipPayment(first, sale(), now + 1000).expiresAt, first.expiresAt);
  const renewed = applyMembershipPayment(first, sale('SALE-2', now + 20 * 86400000), now + 20 * 86400000);
  assert.equal(renewed.expiresAt, now + 2 * MEMBERSHIP_MS);
});

test('late renewal starts from payment time and out-of-order events agree', () => {
  const first = applyMembershipPayment({}, sale(), now);
  const late = now + 45 * 86400000;
  assert.equal(applyMembershipPayment(first, sale('LATE', late), late).expiresAt, late + MEMBERSHIP_MS);
  const newer = sale('NEW', now + 29 * 86400000);
  const oldFirst = applyMembershipPayment(applyMembershipPayment({}, sale(), now), newer, Date.parse(newer.create_time));
  const newFirst = applyMembershipPayment(applyMembershipPayment({}, newer, Date.parse(newer.create_time)), sale(), Date.parse(newer.create_time));
  assert.equal(newFirst.expiresAt, oldFirst.expiresAt);
});

test('rejects unpaid, wrong amount/currency and invalid timestamps', () => {
  for (const patch of [{ state: 'pending' }, { amount: { total: '10.00', currency: 'USD' } }, { amount: { total: '14.87', currency: 'EUR' } }, { create_time: 'bad' }]) {
    assert.throws(() => applyMembershipPayment({}, { ...sale(), ...patch }, now));
  }
});

test('completed payment grants role; activation and cancellation do not alter paid time', async () => {
  const f = fixture();
  assert.deepEqual(await processMembershipPayment(f.client, { event_type: 'BILLING.SUBSCRIPTION.ACTIVATED' }), { ignored: true });
  assert.equal(f.roles.size, 0);
  const result = await processMembershipPayment(f.client, event(), options());
  assert.equal(result.expiresAt, now + MEMBERSHIP_MS);
  assert.ok(f.roles.has('subscriber'));
  assert.deepEqual(await processMembershipPayment(f.client, { event_type: 'BILLING.SUBSCRIPTION.CANCELLED' }), { ignored: true });
  assert.ok(f.roles.has('subscriber'));
  await reconcileMemberships(f.client, logger, { now: now + MEMBERSHIP_MS - 1 });
  assert.ok(f.roles.has('subscriber'));
  await reconcileMemberships(f.client, logger, { now: now + MEMBERSHIP_MS });
  assert.equal(f.roles.size, 0);
});

test('concurrent duplicate webhooks save one payment and renewal survives expiry sweep', async () => {
  const f = fixture();
  await Promise.all([processMembershipPayment(f.client, event(), options()), processMembershipPayment(f.client, event(), options())]);
  const profile = [...f.saved().values()][0];
  assert.equal(Object.keys(profile.payments).length, 1);
  assert.equal(profile.expiresAt, now + MEMBERSHIP_MS);
  const next = sale('SALE-2', now + MEMBERSHIP_MS);
  await processMembershipPayment(f.client, event('SALE-2'), { ...options(next), now: now + MEMBERSHIP_MS });
  await reconcileMemberships(f.client, logger, { now: now + MEMBERSHIP_MS });
  assert.ok(f.roles.has('subscriber'));
  assert.equal([...f.saved().values()][0].expiresAt, now + 2 * MEMBERSHIP_MS);
});

test('Discord failure preserves payment for retry; restart sweep restores paid role', async () => {
  const f = fixture();
  f.failRole(true);
  await assert.rejects(processMembershipPayment(f.client, event(), options()), /Missing Permissions/);
  assert.equal(f.saved().size, 1);
  f.failRole(false);
  await processMembershipPayment(f.client, event(), options());
  f.roles.clear();
  await reconcileMemberships(f.client, logger, { now });
  assert.ok(f.roles.has('subscriber'));
});

test('rejects unrelated plan and fails closed without persistent storage', async () => {
  const f = fixture();
  assert.deepEqual(await processMembershipPayment(f.client, event(), { ...options(), getPlan: async () => 'OTHER' }), { ignored: true });
  assert.equal(f.roles.size, 0);
  f.client.db.useFallback = true;
  await assert.rejects(processMembershipPayment(f.client, event(), options()), /Persistent/);
});

test('plan validation requires USD 14.87 every 30 days with no trial/setup fee', () => {
  const plan = { status: 'ACTIVE', billing_cycles: [{ tenure_type: 'REGULAR', total_cycles: 0,
    frequency: { interval_unit: 'DAY', interval_count: 30 }, pricing_scheme: { fixed_price: { value: '14.87', currency_code: 'USD' } } }] };
  assert.ok(isMembershipPlan(plan));
  assert.equal(isMembershipPlan({ ...plan, billing_cycles: [{ ...plan.billing_cycles[0], frequency: { interval_unit: 'MONTH', interval_count: 1 } }] }), false);
  assert.equal(isMembershipPlan({ ...plan, payment_preferences: { setup_fee: { value: '1.00' } } }), false);
});

test('checkout creates and persists a separate correctly priced plan once', async () => {
  const f = fixture();
  const originalFetch = globalThis.fetch;
  process.env.PAYPAL_SUBSCRIPTION_PLAN_ID = 'P-OLD';
  process.env.PAYPAL_CLIENT_ID = 'test';
  process.env.PAYPAL_CLIENT_SECRET = 'test';
  process.env.PAYPAL_WEBHOOK_ID = 'WH-TEST';
  let creates = 0;
  const approved = { id: 'P-NEW', status: 'ACTIVE', billing_cycles: [{ tenure_type: 'REGULAR', total_cycles: 0,
    frequency: { interval_unit: 'DAY', interval_count: 30 }, pricing_scheme: { fixed_price: { value: '14.87', currency_code: 'USD' } } }] };
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/v1/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'test' }) };
    if (url.endsWith('/WH-TEST')) return { ok: true, json: async () => ({ url: new URL('/paypal/webhook', process.env.PUBLIC_BASE_URL || 'https://abbiebot-production-35d6.up.railway.app').href, event_types: [{ name: 'PAYMENT.SALE.COMPLETED' }] }) };
    if (url.endsWith('/P-OLD')) return { ok: true, json: async () => ({ id: 'P-OLD', product_id: 'PRODUCT' }) };
    if (init.method === 'POST') {
      creates++;
      const body = JSON.parse(init.body);
      assert.equal(body.billing_cycles[0].pricing_scheme.fixed_price.value, '14.87');
      assert.equal(body.billing_cycles[0].frequency.interval_count, 30);
    }
    return { ok: true, json: async () => approved };
  };
  try {
    assert.equal(await ensureMembershipPlan(f.client), 'P-NEW');
    assert.equal(await ensureMembershipPlan(f.client), 'P-NEW');
    assert.equal(creates, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('checkout enables completed-payment events without dropping existing webhook events', async () => {
  const f = fixture();
  const originalFetch = globalThis.fetch;
  let events = [{ name: 'BILLING.SUBSCRIPTION.CANCELLED' }], patches = 0;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/v1/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'test' }) };
    if (url.endsWith('/WH-TEST')) {
      if (init.method === 'PATCH') {
        patches++;
        events = JSON.parse(init.body)[0].value;
        return { ok: true, status: 204 };
      }
      return { ok: true, json: async () => ({ url: new URL('/paypal/webhook', process.env.PUBLIC_BASE_URL || 'https://abbiebot-production-35d6.up.railway.app').href, event_types: events }) };
    }
    return { ok: true, json: async () => ({ id: 'P-OLD', status: 'ACTIVE', billing_cycles: [{ tenure_type: 'REGULAR', total_cycles: 0,
      frequency: { interval_unit: 'DAY', interval_count: 30 }, pricing_scheme: { fixed_price: { value: '14.87', currency_code: 'USD' } } }] }) };
  };
  try {
    assert.equal(await ensureMembershipPlan(f.client), 'P-OLD');
    assert.equal(patches, 1);
    assert.deepEqual(events.map(event => event.name), ['BILLING.SUBSCRIPTION.CANCELLED', 'PAYMENT.SALE.COMPLETED']);
    assert.equal(await ensureMembershipPlan(f.client), 'P-OLD');
    assert.equal(patches, 1);
  } finally { globalThis.fetch = originalFetch; }
});
