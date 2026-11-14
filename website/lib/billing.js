'use strict';

const { randomUUID } = require('node:crypto');
const { planFor, verifyPayment } = require('./infinitepay');

// The caller must obtain userId from a verified server-side session, never a request body.
async function createOrder(pool, userId, plan) {
  const selected = planFor(plan);
  const orderId = randomUUID();
  const verified = await pool.query('SELECT 1 FROM neon_auth."user" WHERE id = $1 AND "emailVerified" IS TRUE', [userId]);
  if (verified.rows.length !== 1) throw new Error('Verified account required');
  await pool.query(
    `INSERT INTO seven_desk_payment_orders (order_id, user_id, plan, amount_cents)
     VALUES ($1, $2, $3, $4)`,
    [orderId, userId, plan, selected.amount],
  );
  return orderId;
}

// Trial starts when the identity is created, even if the user never signs in.
// No write is needed, so logging in repeatedly cannot restart the free month.
async function getEntitlement(pool, userId) {
  const result = await pool.query(
    `SELECT u."createdAt" + interval '1 month' AS trial_ends_at,
            GREATEST(u."createdAt" + interval '1 month', COALESCE(s.paid_through, u."createdAt" + interval '1 month')) AS access_ends_at,
            CASE WHEN now() < u."createdAt" + interval '1 month' THEN 'trial'
                 WHEN s.paid_through > now() THEN 'paid' ELSE 'expired' END AS status
       FROM neon_auth."user" u LEFT JOIN seven_desk_subscriptions s ON s.user_id = u.id
      WHERE u.id = $1 AND u."emailVerified" IS TRUE`, [userId],
  );
  return result.rows[0] || null;
}

// A webhook is only a notification. Credit access after confirmation with InfinitePay.
async function reconcilePayment(pool, event, { handle, apiKey, fetchImpl } = {}) {
  const { orderId, transactionId, slug } = event;
  if (![orderId, transactionId, slug].every(v => typeof v === 'string' && v.length > 0 && v.length <= 255) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return false;
  const initial = await pool.query(
    'SELECT user_id, plan, amount_cents, state, transaction_nsu, invoice_slug FROM seven_desk_payment_orders WHERE order_id = $1',
    [orderId],
  );
  const order = initial.rows[0];
  if (!order || planFor(order.plan).amount !== order.amount_cents) return false;
  if (order.state === 'paid') return order.transaction_nsu === transactionId && order.invoice_slug === slug;
  if (!await verifyPayment({ handle, orderId, transactionId, slug, plan: order.plan }, { apiKey, fetchImpl })) return false;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lockedResult = await client.query(
      'SELECT user_id, plan, amount_cents, state, transaction_nsu, invoice_slug FROM seven_desk_payment_orders WHERE order_id = $1 FOR UPDATE',
      [orderId],
    );
    const locked = lockedResult.rows[0];
    if (!locked || locked.user_id !== order.user_id || locked.plan !== order.plan || locked.amount_cents !== order.amount_cents) {
      await client.query('ROLLBACK');
      return false;
    }
    if (locked.state === 'paid') {
      await client.query('ROLLBACK');
      return locked.transaction_nsu === transactionId && locked.invoice_slug === slug;
    }
    const account = await client.query('SELECT "createdAt" AS created_at FROM neon_auth."user" WHERE id = $1 AND "emailVerified" IS TRUE', [locked.user_id]);
    if (!account.rows[0]) throw new Error('Account unavailable');
    const interval = locked.plan === 'monthly' ? '1 month' : '1 year';
    await client.query(
      `INSERT INTO seven_desk_subscriptions (user_id, paid_through)
       VALUES ($1, GREATEST(now(), $3::timestamptz + interval '1 month') + $2::interval)
       ON CONFLICT (user_id) DO UPDATE SET
         paid_through = GREATEST(seven_desk_subscriptions.paid_through, now(), $3::timestamptz + interval '1 month') + $2::interval,
         updated_at = now()`,
      [locked.user_id, interval, account.rows[0].created_at],
    );
    await client.query(
      `UPDATE seven_desk_payment_orders SET state = 'paid', transaction_nsu = $2,
       invoice_slug = $3, paid_at = now() WHERE order_id = $1`,
      [orderId, transactionId, slug],
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return false;
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createOrder, reconcilePayment, getEntitlement };
