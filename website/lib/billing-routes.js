'use strict';
const { planFor } = require('./infinitepay');

// Keep the gate off until server-side remote-access authorization and refunds are ready.
function createBillingHandlers({ checkoutEnabled, webhookEnabled, authenticate, pool, createOrder, createCheckout, reconcilePayment, config }) {
  const send = (res, code, body) => res.status(code).json(body);
  return {
    async checkout(req, res) {
      res.setHeader('Cache-Control', 'no-store');
      if (!checkoutEnabled()) return send(res, 503, { error: 'Checkout indisponível' });
      if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });
      try {
        const userId = await authenticate(req.headers.authorization);
        if (!userId) return send(res, 401, { error: 'Entre na sua conta' });
        const plan = req.body?.plan;
        try { planFor(plan); } catch { return send(res, 400, { error: 'Plano inválido' }); }
        const settings = config();
        if (!settings.handle || !settings.apiKey || !settings.siteUrl) throw new Error('Billing configuration incomplete');
        const db = pool();
        const orderId = await createOrder(db, userId, plan);
        const url = await createCheckout({ handle: settings.handle, orderId, plan, siteUrl: settings.siteUrl }, { apiKey: settings.apiKey });
        await db.query('UPDATE seven_desk_payment_orders SET checkout_url = $1 WHERE order_id = $2 AND user_id = $3', [url, orderId, userId]);
        return send(res, 200, { url });
      } catch { return send(res, 503, { error: 'Não foi possível iniciar o pagamento' }); }
    },
    async webhook(req, res) {
      res.setHeader('Cache-Control', 'no-store');
      if (!webhookEnabled()) return send(res, 503, { error: 'Checkout indisponível' });
      if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });
      try {
        const event = { orderId: req.body?.order_nsu, transactionId: req.body?.transaction_nsu, slug: req.body?.invoice_slug };
        if (!Object.values(event).every(value => typeof value === 'string' && value.length > 0 && value.length <= 255)) return send(res, 400, { error: 'Notificação inválida' });
        const settings = config();
        if (!settings.handle || !settings.apiKey) throw new Error('Billing configuration incomplete');
        const verified = await reconcilePayment(pool(), event, { handle: settings.handle, apiKey: settings.apiKey });
        if (!verified) return send(res, 400, { error: 'Pagamento não confirmado' });
        return send(res, 200, { received: true });
      } catch { return send(res, 503, { error: 'Não foi possível verificar o pagamento' }); }
    },
  };
}
module.exports = { createBillingHandlers };
