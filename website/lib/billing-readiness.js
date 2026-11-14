'use strict';

// Checkout is intentionally closed until the operator verifies the
// payment provider, production database and remote-access authorization.
function isCheckoutReady(env = process.env) {
  const keys = ['DATABASE_URL', 'NEON_AUTH_BASE_URL', 'INFINITEPAY_HANDLE', 'INFINITEPAY_API_KEY', 'SEVEN_SITE_URL'];
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

module.exports = { isCheckoutReady };
