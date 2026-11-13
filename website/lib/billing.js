'use strict';

const { randomUUID } = require('node:crypto');
const { planFor, verifyPayment } = require('./infinitepay');

// The caller must obtain userId from a verified server-side session, never a request body.
async function createOrder(pool, userId, plan) {
  const selected = planFor(plan);
  const orderId = randomUUID();
  await pool.query(
    `INSERT INTO seven_desk_payment_orders (order_id, user_id, plan, amount_cents)
     VALUES ($1, $2, $3, $4)`,
    [orderId, userId, plan, selected.amount],
  );
  return orderId;
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
    await client.query('SELECT id FROM neon_auth."user" WHERE id = $1 FOR UPDATE', [locked.user_id]);
    const interval = locked.plan === 'monthly' ? '1 month' : '1 year';
    await client.query(
      `INSERT INTO seven_desk_subscriptions (user_id, paid_through) VALUES ($1, now() + $2::interval)
       ON CONFLICT (user_id) DO UPDATE SET
         paid_through = GREATEST(seven_desk_subscriptions.paid_through, now()) + $2::interval,
         updated_at = now()`,
      [locked.user_id, interval],
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

module.exports = { createOrder, reconcilePayment };
