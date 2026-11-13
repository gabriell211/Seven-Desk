'use strict';
const { Pool } = require('pg');
const { authenticatedUser } = require('./server-auth');
const { createOrder, reconcilePayment } = require('./billing');
const { createCheckout } = require('./infinitepay');
const { createBillingHandlers } = require('./billing-routes');
let db;
module.exports = createBillingHandlers({
  checkoutEnabled: () => process.env.SEVEN_BILLING_ENABLED === '1',
  webhookEnabled: () => process.env.SEVEN_WEBHOOK_ENABLED === '1',
  authenticate: authenticatedUser,
  pool: () => {
    if (!process.env.DATABASE_URL) throw new Error('Missing database configuration');
    if (!db) db = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 5000 });
    return db;
  },
  createOrder, createCheckout, reconcilePayment,
  config: () => ({ handle: process.env.INFINITEPAY_HANDLE, apiKey: process.env.INFINITEPAY_API_KEY, siteUrl: process.env.SEVEN_SITE_URL }),
});
