export const MEMBERSHIP_PRICE = '14.87';
export const MEMBERSHIP_DAYS = 30;
export const MEMBERSHIP_MS = MEMBERSHIP_DAYS * 86400000;

export function isMembershipPlan(plan) {
  const cycles = plan?.billing_cycles || [];
  const cycle = cycles[0];
  return plan?.status === 'ACTIVE' && cycles.length === 1 &&
    cycle.tenure_type === 'REGULAR' && cycle.total_cycles === 0 &&
    cycle.frequency?.interval_unit === 'DAY' && cycle.frequency.interval_count === 30 &&
    cycle.pricing_scheme?.fixed_price?.currency_code === 'USD' &&
    Number(cycle.pricing_scheme.fixed_price.value) === 14.87 &&
    Number(plan.payment_preferences?.setup_fee?.value || 0) === 0 &&
    Number(plan.taxes?.percentage || 0) === 0;
}

export function applyMembershipPayment(profile, sale, now = Date.now()) {
  if (sale?.state !== 'completed' || sale.amount?.currency !== 'USD' ||
      !/^14\.87(?:0*)$/.test(String(sale.amount?.total)) || !sale.id || !sale.billing_agreement_id) {
    throw new Error('Membership requires a completed USD 14.87 subscription payment');
  }
  const paidAt = Date.parse(sale.create_time);
  if (!Number.isFinite(paidAt) || paidAt > now + 300000) throw new Error('Invalid payment timestamp');
  const payments = { ...profile.payments };
  if (payments[sale.id]) return { ...profile, repeated: true };
  payments[sale.id] = { paidAt, subscriptionId: sale.billing_agreement_id };
  // Recompute in payment-time order so delayed/out-of-order webhooks have the same result.
  const expiresAt = Object.values(payments).sort((a, b) => a.paidAt - b.paidAt)
    .reduce((expiry, payment) => Math.max(expiry, payment.paidAt) + MEMBERSHIP_MS, 0);
  return { ...profile, payments, expiresAt, repeated: false };
}
