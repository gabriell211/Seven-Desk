'use strict';

const {pool}=require('../lib/db-pool');
const { appTokenUser } = require('../lib/app-tokens');

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
    const result = await pool().query('SELECT name, image FROM seven_users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Conta indisponível' });
    return res.status(200).json({ name:user.name || '', image:user.image || '' });
  } catch {
    return res.status(503).json({ error: 'Perfil indisponível' });
  }
};
