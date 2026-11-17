'use strict';
const {pool}=require('../lib/db-pool');
const {paymentCredentials}=require('../lib/payment-secret');
const { authenticatedUser } = require('../lib/server-auth');
const { reconcilePayment } = require('../lib/billing');
const { createConfirmPaymentHandler } = require('../lib/confirm-payment');

module.exports = createConfirmPaymentHandler({
  enabled: () => process.env.SEVEN_WEBHOOK_ENABLED === '1' &&
    process.env.SEVEN_ACCOUNT_STATUS_ENABLED === '1',
  authenticate: authenticatedUser,
  pool,
  reconcilePayment,
  config:()=>paymentCredentials(),
});
