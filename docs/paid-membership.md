# HealthScienceGuild paid membership

New checkouts charge **USD 14.87 every 30 days**, renewing automatically until
cancelled. There is no trial or setup fee. The checkout validates the configured
PayPal plan. If it has a different price/cadence, the bot creates a separate
correctly priced plan on that plan's existing product and saves its ID in
PostgreSQL. It never reprices existing subscriptions. No new database table is
required; membership/plan records use non-expiring `temp_data` rows.

## Required host and PayPal settings

Keep `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`,
`PAYPAL_SUBSCRIPTION_PLAN_ID`, `SUBSCRIPTION_LINK_SECRET`, `PUBLIC_BASE_URL`,
`BIOLOGYHQ_GUILD_ID`, and `SUBSCRIBER_ROLE_ID` configured. The existing guild
variable name is retained for compatibility. Use persistent PostgreSQL.

In the PayPal app matching these credentials, the webhook URL must be
`PUBLIC_BASE_URL/paypal/webhook`, and its event subscriptions must include
**Payment sale completed (`PAYMENT.SALE.COMPLETED`)**. This is required for the
initial payment AND recurring payments. Enable it in the same live/sandbox mode
as `PAYPAL_MODE`. Keep this existing webhook registration available to the bot.
Before checkout, the bot verifies the configured webhook URL matches this bot,
and enables `PAYMENT.SALE.COMPLETED` while preserving other subscribed events.
If PayPal refuses this update, checkout fails rather than accepting an untracked
membership payment. The Discord bot needs Manage Roles and a role above
Subscriber in the hierarchy.

## Access lifecycle

The existing store button generates a signed checkout bound to the Discord ID.
An approved/active subscription alone does not grant access. Only a signed
PayPal webhook plus independently retrieved completed sale, subscription binding,
plan ID, and exact USD 14.87 amount grants 30 days. Duplicate sale IDs cannot
extend access. Early renewals add 30 days to the paid-through date; late renewals
start at payment time. Out-of-order payments produce the same paid-through date.

Payment records commit before role delivery. Failed role changes return an error
for PayPal retries and are repaired by reconciliation. Each minute and on startup,
the bot restores missing paid roles and removes expired tracked Subscriber roles.
Expiry is enforced on the next successful check (normally within one minute).
Cancelling/suspending renewal does not end already-paid access; failed payment
does not extend it. Do not use browser `onApprove` as proof of payment.

Existing subscriptions/manual Subscriber roles without a payment ledger are not
automatically migrated or repriced. Their paid-through dates cannot be inferred
from a Discord role; reconcile them from verified PayPal payment history before
relying on automatic expiry for those pre-existing members. Refund/reversal
automation is outside this change; resolve those disputes in PayPal and Discord.

Run `node --test tests/membership.test.js`. Tests use simulated PayPal/Discord
and transactional persistence, not live credentials. Before taking payments,
verify a checkout and completed-payment webhook in PayPal sandbox, including
role permissions. Production delivery is not established by these unit tests.
