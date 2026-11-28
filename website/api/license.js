'use strict';
const {pool}=require('../lib/db-pool');
const { getEntitlement } = require('../lib/billing');
const { createLicenseHandler } = require('../lib/license-routes');
const { appTokenUser } = require('../lib/app-tokens');

const {teamLicenseEnabled,authorizeTeamDevice}=require('../lib/team-activation');

module.exports = createLicenseHandler({
  enabled: () => process.env.SEVEN_ACCOUNT_STATUS_ENABLED === '1' &&
    process.env.SEVEN_LICENSE_API_ENABLED === '1',
  authenticate: header => appTokenUser(pool(), header, true),
  pool,
  getEntitlement,
  teamAuthorize: (db,header)=>teamLicenseEnabled()?authorizeTeamDevice(db,header):null,
});
