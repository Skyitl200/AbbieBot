import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { REST } from '@discordjs/rest';
import express from 'express';
import crypto from 'crypto';
import cron from 'node-cron';

import config from './config/application.js';
import { initializeDatabase } from './utils/database.js';
import { getGuildConfig } from './services/config/guildConfig.js';
import { getServerCounters, saveServerCounters, updateCounter } from './services/serverstatsService.js';
import { logger, startupLog, shutdownLog } from './utils/logger.js';
import { checkBirthdays } from './services/birthdayService.js';
import { checkGiveaways } from './services/giveawayService.js';
import { loadCommands, registerCommands as registerSlashCommands } from './handlers/loaders/commandLoader.js';
import { runSafeTask, handleTaskError, ErrorCodes } from './utils/errorHandler.js';
import { initializeMusic } from './services/music/riffySetup.js';
import { shutdownMusic } from './services/music/playerHandler.js';
import pkg from '../package.json' with { type: 'json' };
import { EXPECTED_SCHEMA_VERSION, EXPECTED_SCHEMA_LABEL } from './config/database/schemaVersion.js';
import {
  verifyPayPalWebhook,
  getPayPalSubscription
} from './services/paypal/paypalService.js';
class TitanBot extends Client {
  constructor() {
    super({
      intents: [
        
        GatewayIntentBits.Guilds,                        
        GatewayIntentBits.GuildMembers,                 

        GatewayIntentBits.GuildMessages,                
        GatewayIntentBits.GuildMessageReactions,        
        GatewayIntentBits.MessageContent,               
        GatewayIntentBits.DirectMessages,

        GatewayIntentBits.GuildVoiceStates,             

                GatewayIntentBits.GuildBans,                    
      ],

      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
      ],
    });

    this.config = config;
    this.commands = new Collection();
    this.events = new Collection();
    this.buttons = new Collection();
    this.selectMenus = new Collection();
    this.modals = new Collection();
    this.cooldowns = new Collection();
    this.db = null;
    this.rest = new REST({ version: '10' }).setToken(config.bot.token);
  }

  async start() {
    try {
      startupLog('Starting TitanBot...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      startupLog('Initializing database...');
      const dbInstance = await initializeDatabase();
      this.db = dbInstance.db;

      // Check database status and report
      const dbStatus = this.db.getStatus();
      if (dbStatus.isDegraded) {
        logger.warn('');
        logger.warn('╔═══════════════════════════════════════════════════════╗');
        logger.warn('║ ⚠️  DATABASE RUNNING IN DEGRADED MODE                 ║');
        logger.warn('║                                                       ║');
        logger.warn('║ Connection: In-Memory Storage (PostgreSQL unavailable)║');
        logger.warn('║ Data Persistence: DISABLED - data lost on restart    ║');
        logger.warn('║ Action Required: Fix PostgreSQL and restart bot      ║');
        logger.warn('╚═══════════════════════════════════════════════════════╝');
        logger.warn('');
      } else {
        startupLog(`✅ Database Status: ${dbStatus.connectionType} (fully operational)`);
      }
      
      startupLog('Starting web server...');
      this.startWebServer();
      
      startupLog('Loading commands...');
      await loadCommands(this);
      startupLog(`Commands loaded: ${this.commands.size}`);
      
      startupLog('Loading handlers...');
      await this.loadHandlers();
      startupLog('Handlers loaded');

      initializeMusic(this);
      
      startupLog('Logging into Discord...');
      await this.login(this.config.bot.token);
      startupLog('Discord login successful');
      
      startupLog('Registering slash commands globally...');
      await this.registerCommands();
      startupLog('Slash commands registration complete');
      
      const databaseMode = dbStatus.isDegraded
        ? 'Optional in-memory mode (data resets after restart)'
        : 'Connected (persistent data enabled)';
      const handlerSummary = `${this.buttons.size} buttons, ${this.selectMenus.size} menus, ${this.modals.size} modals`;
      startupLog(
        `ONLINE ✅ | ${this.commands.size} commands loaded | ${handlerSummary} | Database: ${databaseMode}`
      );
      
      this.setupCronJobs();
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  startWebServer() {
  const app = express();

    const configuredPort = Number(this.config.api?.port || process.env.PORT || 3000);
    const maxPortRetryAttempts = Number(process.env.PORT_RETRY_ATTEMPTS || 5);
    const host = process.env.WEB_HOST || '0.0.0.0';
    const corsOrigin = this.config.api?.cors?.origin || '*';
    
    app.use((req, res, next) => {
      const allowedOrigins = Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin];
      const origin = req.headers.origin;
      
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
      }
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    const requestCounts = new Map();
    const windowMs = this.config.api?.rateLimit?.windowMs || 60000;
    const maxRequests = this.config.api?.rateLimit?.max || 100;
    
    app.use((req, res, next) => {
      const ip = req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!requestCounts.has(ip)) {
        requestCounts.set(ip, []);
      }
      
      const times = requestCounts.get(ip).filter(t => t > windowStart);
      
      if (times.length >= maxRequests) {
        return res.status(429).json({ error: 'Too many requests' });
      }
      
      times.push(now);
      requestCounts.set(ip, times);
      next();
    });
app.post('/paypal/webhook', express.json(), async (req, res) => {
  try {
    const event = req.body;

    // 1. Verify that this webhook really came from PayPal.
    const isVerified = await verifyPayPalWebhook(req.headers, event);

    if (!isVerified) {
      logger.warn('Rejected unverified PayPal webhook');
      return res.status(400).json({
        error: 'Invalid PayPal webhook signature'
      });
    }

    const eventType = event?.event_type;
    const subscriptionId = event?.resource?.id;

    logger.info(`Verified PayPal webhook: ${eventType}`, {
      eventId: event?.id,
      subscriptionId,
    });

    // Only process subscription events that affect the Subscriber role.
    const activateEvents = new Set([
      'BILLING.SUBSCRIPTION.ACTIVATED',
      'BILLING.SUBSCRIPTION.RE-ACTIVATED',
    ]);

    const removeEvents = new Set([
      'BILLING.SUBSCRIPTION.CANCELLED',
      'BILLING.SUBSCRIPTION.EXPIRED',
      'BILLING.SUBSCRIPTION.SUSPENDED',
    ]);

    if (!activateEvents.has(eventType) && !removeEvents.has(eventType)) {
      return res.status(200).json({
        received: true,
        ignored: true
      });
    }

    if (!subscriptionId) {
      logger.warn('PayPal subscription webhook had no subscription ID', {
        eventId: event?.id,
        eventType,
      });

      return res.status(200).json({
        received: true,
        ignored: true
      });
    }

    // 2. Retrieve the subscription directly from PayPal instead of
    // trusting subscription details supplied only by the webhook.
    const subscription = await getPayPalSubscription(subscriptionId);

    const expectedPlanId = process.env.PAYPAL_SUBSCRIPTION_PLAN_ID;

    if (!expectedPlanId || subscription?.plan_id !== expectedPlanId) {
      logger.warn('Ignoring PayPal subscription for an unexpected plan', {
        eventId: event?.id,
        subscriptionId,
        planId: subscription?.plan_id,
      });

      return res.status(200).json({
        received: true,
        ignored: true
      });
    }

    // custom_id was set to the Discord user ID by our checkout page.
    const discordUserId = String(subscription?.custom_id || '');

    if (!/^\d+$/.test(discordUserId)) {
      logger.warn('PayPal subscription has no valid Discord custom_id', {
        eventId: event?.id,
        subscriptionId,
      });

      return res.status(200).json({
        received: true,
        ignored: true
      });
    }

    const guildId = process.env.BIOLOGYHQ_GUILD_ID;
    const subscriberRoleId = process.env.SUBSCRIBER_ROLE_ID;

    if (!guildId || !subscriberRoleId) {
      throw new Error(
        'Missing BIOLOGYHQ_GUILD_ID or SUBSCRIBER_ROLE_ID'
      );
    }
// Make sure AbbieBot is connected to Discord before changing roles.
// Returning 503 tells PayPal this was a temporary failure so it can retry.
if (!this.isReady()) {
  logger.warn('PayPal webhook received before Discord client was ready', {
    eventId: event?.id,
    subscriptionId,
  });

  return res.status(503).json({
    error: 'Discord client is temporarily unavailable'
  });
}
    // 3. Find BiologyHQ and the Discord member.
    const guild =
      this.guilds.cache.get(guildId) ||
      await this.guilds.fetch(guildId);

    let member;

try {
  member = await guild.members.fetch(discordUserId);
} catch (error) {
  logger.warn('PayPal subscriber is not currently in the BiologyHQ server', {
    userId: discordUserId,
    subscriptionId,
  });

  return res.status(200).json({
    received: true,
    processed: false,
    reason: 'Discord member not found'
  });
}

    // 4. Add or remove Subscriber.
    if (activateEvents.has(eventType)) {
      if (subscription.status !== 'ACTIVE') {
        logger.warn('Activation webhook received but subscription is not ACTIVE', {
          subscriptionId,
          status: subscription.status,
        });

        return res.status(200).json({
          received: true,
          ignored: true
        });
      }

      if (!member.roles.cache.has(subscriberRoleId)) {
        await member.roles.add(
          subscriberRoleId,
          'Active BiologyHQ PayPal subscription'
        );
      }

      logger.info('BiologyHQ Subscriber role granted', {
        userId: discordUserId,
        subscriptionId,
      });
    }

    if (removeEvents.has(eventType)) {
      if (member.roles.cache.has(subscriberRoleId)) {
        await member.roles.remove(
          subscriberRoleId,
          `PayPal subscription ${eventType}`
        );
      }

      logger.info('BiologyHQ Subscriber role removed', {
        userId: discordUserId,
        subscriptionId,
        eventType,
      });
    }

    return res.status(200).json({
      received: true,
      processed: true
    });
  } catch (error) {
    logger.error('PayPal webhook processing failed:', error);

    return res.status(500).json({
      error: 'Webhook processing failed'
    });
  }
});

app.get('/subscribe', (req, res) => {
  try {
    const token = String(req.query.token || '');
    const secret = process.env.SUBSCRIPTION_LINK_SECRET;
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const planId = process.env.PAYPAL_SUBSCRIPTION_PLAN_ID;

    if (!secret || !clientId || !planId) {
      return res.status(500).send('Membership checkout is not configured.');
    }

    const separatorIndex = token.indexOf('.');

    if (separatorIndex === -1) {
      return res.status(400).send('Invalid subscription link.');
    }

    const discordUserId = token.slice(0, separatorIndex);
    const suppliedSignature = token.slice(separatorIndex + 1);

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(discordUserId)
      .digest('hex');

    const suppliedBuffer = Buffer.from(suppliedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      !/^\d+$/.test(discordUserId) ||
      suppliedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      return res.status(400).send('Invalid or altered subscription link.');
    }

    const safePlanId = JSON.stringify(planId);
    const safeDiscordUserId = JSON.stringify(discordUserId);

    res.type('html').send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>BiologyHQ Membership</title>
        </head>

        <body style="font-family: Arial, sans-serif; max-width: 520px; margin: 60px auto; padding: 20px; text-align: center;">
          <h1>BiologyHQ Membership</h1>
          <h2>$10/month</h2>

          <p>
            Subscribe securely with PayPal to activate your
            BiologyHQ Subscriber membership.
          </p>

          <div id="paypal-button-container"></div>

          <p id="status"></p>

          <script
            src="https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription">
          </script>

          <script>
            const PLAN_ID = ${safePlanId};
            const DISCORD_USER_ID = ${safeDiscordUserId};

            paypal.Buttons({
              style: {
                shape: 'rect',
                color: 'gold',
                layout: 'vertical',
                label: 'subscribe'
              },

              createSubscription: function(data, actions) {
                return actions.subscription.create({
                  plan_id: PLAN_ID,
                  custom_id: DISCORD_USER_ID
                });
              },

              onApprove: function(data) {
                document.getElementById('status').textContent =
                  'Subscription approved! BiologyHQ is processing your Subscriber role.';
              },

              onError: function(err) {
                console.error(err);

                document.getElementById('status').textContent =
                  'PayPal checkout encountered an error. Please try again.';
              }
            }).render('#paypal-button-container');
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('Failed to render PayPal subscription page:', error);
    return res.status(500).send('Unable to load membership checkout.');
  }
});