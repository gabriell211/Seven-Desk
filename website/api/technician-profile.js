'use strict';

const {pool} = require('../lib/db-pool');
const {authenticatedUser} = require('../lib/server-auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});
  if (process.env.SEVEN_ACCOUNT_STATUS_ENABLED !== '1' ||
      process.env.SEVEN_LICENSE_API_ENABLED !== '1') {
    return res.status(503).json({error:'Perfil indisponível'});
  }
  const slot = req.body?.slot;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!Number.isInteger(slot) || slot < 1 || slot > 32767 ||
      name.length < 2 || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) {
    return res.status(400).json({error:'Informe um nome válido de até 100 caracteres'});
  }
  try {
    const userId = await authenticatedUser(req.headers.authorization);
    if (!userId) return res.status(401).json({error:'Entre na sua conta'});
    const result = await pool().query(
      'UPDATE seven_desk_app_tokens SET technician_name = $3 WHERE user_id = $1 AND slot = $2 RETURNING technician_name, technician_image',
      [userId, slot, name],
    );
    if (!result.rowCount) return res.status(404).json({error:'Ative o computador antes de configurar o técnico'});
    return res.status(200).json({
      name:result.rows[0].technician_name,
      image:result.rows[0].technician_image,
    });
  } catch {
    return res.status(503).json({error:'Não foi possível salvar os dados do técnico'});
  }
};
