const PAYPAL_MODE = process.env.PAYPAL_MODE || 'live';

const PAYPAL_BASE_URL =
  PAYPAL_MODE === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

/**
 * Get an OAuth access token from PayPal.
 */
export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET');
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString('base64');

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `PayPal authentication failed (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Verify that an incoming webhook really came from PayPal.
 */
export async function verifyPayPalWebhook(headers, event) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    throw new Error('Missing PAYPAL_WEBHOOK_ID');
  }

  const accessToken = await getPayPalAccessToken();

  const verificationPayload = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: event,
  };

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verificationPayload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `PayPal webhook verification failed (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();

  return result.verification_status === 'SUCCESS';
}

/**
 * Retrieve a subscription directly from PayPal.
 */
export async function getPayPalSubscription(subscriptionId) {
  if (!subscriptionId) {
    throw new Error('Subscription ID is required');
  }

  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Unable to retrieve PayPal subscription (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

/**
 * Check whether a subscription belongs to the BiologyHQ plan
 * and is currently active.
 */
export function isBiologyHQSubscriptionActive(subscription) {
  const expectedPlanId = process.env.PAYPAL_SUBSCRIPTION_PLAN_ID;

  if (!expectedPlanId) {
    throw new Error('Missing PAYPAL_SUBSCRIPTION_PLAN_ID');
  }

  return (
    subscription?.plan_id === expectedPlanId &&
    subscription?.status === 'ACTIVE'
  );
}