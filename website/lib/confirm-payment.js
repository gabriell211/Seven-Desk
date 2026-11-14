'use strict';

// The redirect URL is untrusted input. Confirmation is always tied to the
// authenticated user and checked against the provider before access is credited.
function createConfirmPaymentHandler({ enabled, authenticate, pool, reconcilePayment, config }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    if (!enabled()) return res.status(503).json({ error: 'Confirmação temporariamente indisponível' });

    try {
      const userId = await authenticate(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Entre na sua conta' });
      const { order_nsu: orderId, transaction_nsu: transactionId, slug, invoice_slug: invoiceSlug } = req.body || {};
      const invoice = slug ?? invoiceSlug;
      if (typeof orderId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId) ||
          ![transactionId, invoice].every(v => typeof v === 'string' && v.length > 0 && v.length <= 255)) {
        return res.status(400).json({ error: 'Dados do pagamento inválidos' });
      }
      const db = pool();
      const order = await db.query('SELECT order_id FROM seven_desk_payment_orders WHERE order_id = $1 AND user_id = $2', [orderId, userId]);
      if (order.rows.length !== 1) return res.status(404).json({ error: 'Pagamento não encontrado' });
      const { handle, apiKey } = config();
      if (!handle || !apiKey) return res.status(503).json({ error: 'Confirmação temporariamente indisponível' });
      const confirmed = await reconcilePayment(db, { orderId, transactionId, slug: invoice }, { handle, apiKey });
      return confirmed
        ? res.status(200).json({ confirmed: true })
        : res.status(409).json({ confirmed: false, message: 'Pagamento ainda não confirmado' });
    } catch {
      return res.status(503).json({ error: 'Não foi possível consultar o pagamento' });
    }
  };
}

module.exports = { createConfirmPaymentHandler };
