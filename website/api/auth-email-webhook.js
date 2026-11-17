'use strict';

const { createWebhookHandler } = require('../lib/neon-email-webhook');

module.exports = createWebhookHandler();
module.exports.config = { api: { bodyParser: false } };
