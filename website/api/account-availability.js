'use strict';

// Public readiness only. Never return credentials or infer readiness from client state.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  const accountReady = process.env.SEVEN_ACCOUNT_STATUS_ENABLED === '1' &&
    typeof process.env.NEON_AUTH_BASE_URL === 'string' &&
    process.env.NEON_AUTH_BASE_URL.startsWith('https://');
  return res.status(200).json({
    loginEnabled: accountReady,
    registrationEnabled: accountReady && process.env.SEVEN_REGISTRATION_ENABLED === '1',
    recoveryEnabled: accountReady && process.env.SEVEN_PASSWORD_RECOVERY_ENABLED === '1',
  });
};
