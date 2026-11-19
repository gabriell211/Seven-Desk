'use strict';
const {pool}=require('../lib/db-pool');
const { authenticatedUser } = require('../lib/server-auth');
const { getEntitlement } = require('../lib/billing');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.SEVEN_ACCOUNT_STATUS_ENABLED !== '1') return res.status(503).json({ error: 'Conta indisponível' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const userId = await authenticatedUser(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Entre na sua conta' });
    const subscription = await getEntitlement(pool(), userId);
    if (!subscription) return res.status(404).json({ error: 'Conta não encontrada' });
    return res.status(200).json({
      status: subscription.status,
      trialStartedAt: subscription.trial_started_at,
      trialEndsAt: subscription.trial_ends_at,
      accessEndsAt: subscription.access_ends_at,
      paidThrough: subscription.paid_through ?? null,
      paidPlan: subscription.paid_plan ?? null,
      lastPaymentAt: subscription.last_paid_at ?? null,
      lastPaymentAmountCents: subscription.last_paid_amount_cents ?? null,
      extraSlots: Number(subscription.extra_slots) || 0,
    });
  } catch { return res.status(503).json({ error: 'Não foi possível consultar a conta' }); }
};
