import pgConfig from '../../config/database/postgres.js';
import { getPayPalAccessToken, getPayPalSubscription } from './paypalService.js';
import { applyMembershipPayment, isMembershipPlan } from './membershipPolicy.js';

const baseUrl = () => process.env.PAYPAL_MODE === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
const planKey = () => `membership-plan:v1:${process.env.PAYPAL_MODE || 'live'}:${process.env.BIOLOGYHQ_GUILD_ID}`;
function poolOf(client) {
  const pool = client.db?.db?.pool || client.db?.pool;
  if (!pool?.connect || client.db?.useFallback || client.db?.getStatus?.().isDegraded) {
    throw new Error('Persistent membership database unavailable');
  }
  return pool;
}

async function request(path, { method = 'GET', body, requestId } = {}) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${baseUrl()}${path}`, {
    method, signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) throw new Error(`PayPal membership request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}

async function ensurePaymentWebhook() {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error('Missing PAYPAL_WEBHOOK_ID');
  const path = `/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`;
  const webhook = await request(path);
  const expectedUrl = new URL('/paypal/webhook', process.env.PUBLIC_BASE_URL || 'https://abbiebot-production-35d6.up.railway.app').href;
  if (webhook.url !== expectedUrl) throw new Error('PayPal webhook URL does not match this bot');
  const events = webhook.event_types || [];
  if (!events.some(event => ['*', 'PAYMENT.SALE.COMPLETED'].includes(event.name))) {
    await request(path, { method: 'PATCH', body: [{ op: 'replace', path: '/event_types',
      value: [...events.map(event => ({ name: event.name })), { name: 'PAYMENT.SALE.COMPLETED' }] }] });
    const updated = await request(path);
    if (!updated.event_types?.some(event => ['*', 'PAYMENT.SALE.COMPLETED'].includes(event.name))) {
      throw new Error('PayPal completed-payment webhook is not enabled');
    }
  }
}

async function locked(client, key, operation) {
  const connection = await poolOf(client).connect();
  try {
    await connection.query('BEGIN');
    await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    const result = await connection.query(`SELECT value FROM ${pgConfig.tables.temp_data} WHERE key = $1`, [key]);
    const save = value => connection.query(`INSERT INTO ${pgConfig.tables.temp_data} (key, value, expires_at)
      VALUES ($1, $2::jsonb, NULL) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = NULL`, [key, JSON.stringify(value)]);
    const value = await operation(result.rows[0]?.value, save);
    await connection.query('COMMIT');
    return value;
  } catch (error) {
    await connection.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { connection.release(); }
}

// Reuse a correctly priced plan, or create a separate new plan on the existing product.
// Never reprice existing subscribers. Persist the new ID; checkout and webhook use it together.
export async function ensureMembershipPlan(client) {
  const configuredId = process.env.PAYPAL_SUBSCRIPTION_PLAN_ID;
  if (!configuredId || !process.env.BIOLOGYHQ_GUILD_ID || !process.env.SUBSCRIBER_ROLE_ID) {
    throw new Error('Membership plan, guild and Subscriber role must be configured');
  }
  await ensurePaymentWebhook();
  return locked(client, planKey(), async (saved, save) => {
    const plan = await request(`/v1/billing/plans/${encodeURIComponent(saved?.id || configuredId)}`);
    if (isMembershipPlan(plan)) {
      if (!saved) await save({ id: plan.id });
      return plan.id;
    }
    if (saved) throw new Error('Saved membership plan no longer matches USD 14.87 every 30 days');
    if (!plan.product_id) throw new Error('PayPal membership product is missing');
    const created = await request('/v1/billing/plans', {
      method: 'POST', requestId: `hsg-1487-30d-${process.env.BIOLOGYHQ_GUILD_ID}`,
      body: {
        product_id: plan.product_id, name: 'HealthScienceGuild — 30-day membership', status: 'ACTIVE',
        billing_cycles: [{ frequency: { interval_unit: 'DAY', interval_count: 30 },
          tenure_type: 'REGULAR', sequence: 1, total_cycles: 0,
          pricing_scheme: { fixed_price: { value: '14.87', currency_code: 'USD' } } }],
        payment_preferences: { auto_bill_outstanding: false, payment_failure_threshold: 1 }
      }
    });
    const verified = await request(`/v1/billing/plans/${encodeURIComponent(created.id)}`);
    if (!isMembershipPlan(verified)) throw new Error('Created membership plan failed price verification');
    await save({ id: verified.id });
    return verified.id;
  });
}

async function syncRole(client, profile, now) {
  if (!client.isReady()) throw new Error('Discord client unavailable');
  const guild = client.guilds.cache.get(profile.guildId) || await client.guilds.fetch(profile.guildId);
  let member;
  try { member = await guild.members.fetch({ user: profile.userId, force: true }); }
  catch (error) { if (error.code === 10007) return; throw error; }
  const hasRole = member.roles.cache.has(profile.roleId);
  if (profile.expiresAt > now && !hasRole) await member.roles.add(profile.roleId, 'Paid HealthScienceGuild 30-day membership');
  if (profile.expiresAt <= now && hasRole) await member.roles.remove(profile.roleId, 'HealthScienceGuild paid membership expired');
}

export async function processMembershipPayment(client, event, { now = Date.now(), getSale = id => request(`/v1/payments/sale/${encodeURIComponent(id)}`), getSubscription = getPayPalSubscription, getPlan = ensureMembershipPlan } = {}) {
  if (event.event_type !== 'PAYMENT.SALE.COMPLETED') return { ignored: true };
  const saleId = event.resource?.id;
  if (!saleId) throw new Error('Payment event missing sale ID');
  // Fetch independently: never trust user-supplied IDs, amounts, or activation status as proof of payment.
  const sale = await getSale(saleId);
  if (sale.id !== saleId || !sale.billing_agreement_id) return { ignored: true };
  const subscription = await getSubscription(sale.billing_agreement_id);
  const planId = await getPlan(client);
  if (subscription.id !== sale.billing_agreement_id || subscription.plan_id !== planId) return { ignored: true };
  const userId = String(subscription.custom_id || '');
  if (!/^\d{17,20}$/.test(userId)) throw new Error('Subscription missing valid Discord user binding');
  const guildId = process.env.BIOLOGYHQ_GUILD_ID;
  const roleId = process.env.SUBSCRIBER_ROLE_ID;
  if (!guildId || !roleId) throw new Error('Membership guild or Subscriber role missing');
  const key = `paid-membership:${guildId}:${userId}`;
  const result = await locked(client, key, async (saved, save) => {
    const profile = applyMembershipPayment(saved || { guildId, roleId, userId, payments: {} }, sale, now);
    await save(profile);
    return { processed: true, expiresAt: profile.expiresAt, repeated: profile.repeated };
  });
  // Commit paid access before touching Discord. If Discord fails, the durable ledger
  // allows both PayPal retries and the minute/startup sweep to finish role delivery.
  await locked(client, key, async profile => {
    if (profile) await syncRole(client, profile, now);
  });
  return result;
}

export async function reconcileMemberships(client, logger, { now = Date.now() } = {}) {
  try {
    if (!client.isReady()) return;
    const pool = poolOf(client);
    const result = await pool.query(`SELECT key FROM ${pgConfig.tables.temp_data} WHERE key LIKE $1`, ['paid-membership:%']);
    for (const row of result.rows) {
      try {
        await locked(client, row.key, async profile => {
          if (profile) await syncRole(client, profile, now);
        });
      } catch (error) { logger.warn('Membership role reconciliation failed', { key: row.key, error: error.message }); }
    }
  } catch (error) { logger.warn('Membership expiry check unavailable', { error: error.message }); }
}
