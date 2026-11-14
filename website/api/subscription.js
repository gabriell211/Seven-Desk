'use strict';
const { Pool } = require('pg');
const { authenticatedUser } = require('../lib/server-auth');
const { getEntitlement } = require('../lib/billing');

let db;
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.SEVEN_ACCOUNT_STATUS_ENABLED !== '1') return res.status(503).json({ error: 'Conta indisponível' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const userId = await authenticatedUser(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Entre na sua conta' });
    if (!process.env.DATABASE_URL) throw new Error('Missing database configuration');
    if (!db) db = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 5000 });
    const subscription = await getEntitlement(db, userId);
    if (!subscription) return res.status(404).json({ error: 'Conta não encontrada' });
    return res.status(200).json({ status: subscription.status, trialEndsAt: subscription.trial_ends_at, accessEndsAt: subscription.access_ends_at });
  } catch { return res.status(503).json({ error: 'Não foi possível consultar a conta' }); }
};
