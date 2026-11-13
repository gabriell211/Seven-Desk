'use strict';

// This endpoint is for a trusted remote-access server to query while the
// caller presents a fresh signed Neon Auth JWT. A desktop application must
// never be allowed to decide the authorization outcome itself.
function createLicenseHandler({ enabled, authenticate, pool, getEntitlement, now = () => Date.now() }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Authorization');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
    if (!enabled()) return res.status(503).json({ error: 'Licenciamento temporariamente indisponível' });
    try {
      const userId = await authenticate(req.headers?.authorization);
      if (!userId) return res.status(401).json({ error: 'Autenticação obrigatória' });
      const subscription = await getEntitlement(pool(), userId);
      if (!subscription) return res.status(403).json({ allowed: false, reason: 'account_unverified_or_missing' });
      const until = Date.parse(subscription.access_ends_at);
      const allowed = (subscription.status === 'trial' || subscription.status === 'paid') &&
        Number.isFinite(until) && until > now();
      return res.status(allowed ? 200 : 403).json({
        allowed,
        status: allowed ? subscription.status : 'expired',
        accountId: userId,
        accessEndsAt: Number.isFinite(until) ? new Date(until).toISOString() : null,
      });
    } catch {
      return res.status(503).json({ error: 'Não foi possível validar a assinatura' });
    }
  };
}

module.exports = { createLicenseHandler };
