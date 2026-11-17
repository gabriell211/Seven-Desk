'use strict';

const {pool}=require('../lib/db-pool');
const { authenticatedUser } = require('../lib/server-auth');
const { createAppTokenHandler } = require('../lib/app-tokens');

module.exports = createAppTokenHandler({
  enabled: () => process.env.SEVEN_ACCOUNT_STATUS_ENABLED === '1' &&
    process.env.SEVEN_LICENSE_API_ENABLED === '1',
  authenticate: authenticatedUser,
  pool,
});
