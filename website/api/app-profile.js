'use strict';

const {pool}=require('../lib/db-pool');
const { appTokenUser, tokenHash } = require('../lib/app-tokens');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (process.env.SEVEN_ACCOUNT_STATUS_ENABLED !== '1' || process.env.SEVEN_LICENSE_API_ENABLED !== '1') {
    return res.status(503).json({ error: 'Perfil indisponível' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const userId = await appTokenUser(pool(), req.headers?.authorization);
    if (!userId) return res.status(401).json({ error: 'Ativação inválida' });
    const bearer = req.headers.authorization.slice(7);
    const result = await pool().query(
      'SELECT u.name AS account_name, u.image AS account_image, t.technician_name, t.technician_image, t.label AS device_label FROM seven_desk_app_tokens t JOIN seven_users u ON u.id = t.user_id WHERE t.user_id = $1 AND t.token_hash = $2 AND u."emailVerified" IS TRUE',
      [userId, tokenHash(bearer)],
    );
    const profile = result.rows[0];
    if (!profile) return res.status(401).json({ error: 'Ativação inválida' });
    return res.status(200).json({
      name:profile.technician_name || profile.account_name || '',
      image:profile.technician_image || profile.account_image || '',
      companyName:profile.account_name || '',
      deviceLabel:profile.device_label || '',
    });
  } catch {
    return res.status(503).json({ error: 'Perfil indisponível' });
  }
};
