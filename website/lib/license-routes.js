'use strict';

// The remote-access server checks the bearer token against the account's
// current entitlement. The desktop application cannot decide authorization.
function createLicenseHandler({ enabled, authenticate, pool, getEntitlement, teamAuthorize = async()=>null, now = () => Date.now() }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Authorization');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
    if (!enabled()) return res.status(503).json({ error: 'Licenciamento temporariamente indisponível' });
    try {
      const userId = await authenticate(req.headers?.authorization);
      if (!userId) {
        const team=await teamAuthorize(pool(),req.headers?.authorization);
        const until=Date.parse(team?.paid_through);
        if(!team||!Number.isFinite(until)||until<=now())
          return res.status(401).json({error:'Autenticação obrigatória'});
        return res.status(200).json({allowed:true,status:'paid',accountId:team.user_id,
          teamId:team.team_id,accessEndsAt:new Date(until).toISOString()});
      }
      const subscription = await getEntitlement(pool(), userId);
      if (!subscription) return res.status(403).json({ allowed: false, reason: 'account_unverified_or_missing' });
      if(subscription.status==='personal' && subscription.personal_enrolled===true)
        return res.status(200).json({allowed:true,status:'personal',accountId:userId,accessEndsAt:null});
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
