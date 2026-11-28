'use strict';

// Checkout is intentionally closed until the operator verifies the
// payment provider, production database and remote-access authorization.
function isCheckoutReady(env = process.env) {
  const keys = ['SEVEN_DB_HOST','SEVEN_DB_NAME','SEVEN_DB_USER','SEVEN_DB_PASSWORD_FILE','SEVEN_AUTH_SECRET_FILE','SEVEN_SMTP_PASSWORD_FILE','INFINITEPAY_HANDLE','INFINITEPAY_API_KEY_FILE','SEVEN_SITE_URL'];
  if (env.SEVEN_BILLING_ENABLED !== '1' ||
      env.SEVEN_WEBHOOK_ENABLED !== '1' ||
      env.SEVEN_ACCOUNT_STATUS_ENABLED !== '1' ||
      env.SEVEN_LICENSE_API_ENABLED !== '1' ||
      env.SEVEN_SALES_LAUNCH_APPROVED !== '1' ||
      !keys.every(key => typeof env[key] === 'string' && env[key].trim().length > 0)) return false;
  try {
    const url = new URL(env.SEVEN_SITE_URL);
    return url.protocol === 'https:' && !url.username && !url.password &&
      url.pathname === '/' && !url.search && !url.hash;
  } catch {
    return false;
  }
}

// Separate explicit approval: enabling individual checkout never opens team sales.
function isTeamCheckoutReady(env=process.env){
  return isCheckoutReady(env) && env.SEVEN_TEAM_WORKSPACES_ENABLED==='1' &&
    env.SEVEN_TEAM_REMOTE_ACCESS_HOMOLOGATED==='1' && env.SEVEN_TEAM_SALES_APPROVED==='1';
}
module.exports = { isCheckoutReady, isTeamCheckoutReady };
