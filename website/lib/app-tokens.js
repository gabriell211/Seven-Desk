'use strict';

const { createHash, randomBytes } = require('node:crypto');
const {getMaxSlots, quotaSql}=require('./technicians');

const { allowedActivation, newTokenPrefix } = require('./activation-policy');
const DEVICE_RE = /^[0-9a-f]{64}$/;

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function appTokenUser(pool, header, bindDevice = false) {
  const credential = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  const parts = credential.split(':');
  if (parts.length !== (bindDevice ? 2 : 1)) return null;
  const [token, deviceHash] = parts;
  if (!allowedActivation(token)) return null;
  if (bindDevice && !DEVICE_RE.test(deviceHash || '')) return null;
  const result = bindDevice
    ? await pool.query(
      `UPDATE seven_desk_app_tokens t SET device_hash = COALESCE(t.device_hash, $2)
         FROM seven_users u WHERE t.token_hash = $1 AND u.id = t.user_id
          AND u."emailVerified" IS TRUE AND t.technician_verified IS TRUE
          AND t.slot BETWEEN 1 AND (${quotaSql("t.user_id")})
          AND (t.device_hash IS NULL OR t.device_hash = $2)
        RETURNING t.user_id`, [tokenHash(token), deviceHash])
    : await pool.query(
      `SELECT t.user_id FROM seven_desk_app_tokens t
         JOIN seven_users u ON u.id = t.user_id
        WHERE t.token_hash = $1 AND u."emailVerified" IS TRUE
          AND t.technician_verified IS TRUE
          AND t.slot BETWEEN 1 AND (${quotaSql("t.user_id")})`, [tokenHash(token)]);
  return result.rows[0]?.user_id || null;
}

function createAppTokenHandler({ enabled, authenticate, pool, random = randomBytes }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!enabled()) return res.status(503).json({ error: 'Ativação indisponível' });
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido' });
    try {
      const userId = await authenticate(req.headers?.authorization);
      if (!userId) return res.status(401).json({ error: 'Entre na sua conta' });
      const db = pool();
      const maxSlots=await getMaxSlots(db,userId);
      if(req.method==='GET'){
        const [machines,team]=await Promise.all([
          db.query('SELECT slot, label, technician_verified FROM seven_desk_app_tokens WHERE user_id = $1 ORDER BY slot',[userId]),
          db.query('SELECT slot, technician_name, technician_image FROM seven_desk_technicians WHERE user_id = $1 ORDER BY slot',[userId]),
        ]);
        const bySlot=new Map();
        for(const m of machines.rows)bySlot.set(Number(m.slot),{...m,activated:true});
        for(const t of team.rows){
          const key=Number(t.slot);
          bySlot.set(key,{...bySlot.get(key),...t,slot:key,activated:bySlot.has(key)});
        }
        return res.status(200).json({
          devices:[...bySlot.values()].sort((a,b)=>Number(a.slot)-Number(b.slot)),
          maxSlots,
        });
      }
      const slot = Number(req.body?.slot);
      if (!Number.isInteger(slot) || slot < 1 || slot > 32767 || (req.method !== 'DELETE' && slot > maxSlots)) return res.status(400).json({ error: 'Computador inválido' });
      if (req.method === 'DELETE') {
        await db.query('DELETE FROM seven_desk_app_tokens WHERE user_id = $1 AND slot = $2', [userId, slot]);
        return res.status(200).json({ active: false, slot });
      }
      const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
      if (!label || label.length > 60) return res.status(400).json({ error: 'Nome do computador inválido' });
      const token = newTokenPrefix() + random(32).toString('base64url');
      // Only a verified account with a registered technician may issue a key.
      // Existing paired keys remain unchanged; new keys already identify the slot.
      const result = await db.query(
        `INSERT INTO seven_desk_app_tokens (user_id, slot, label, token_hash, technician_verified)
         SELECT u.id, $2, $3, $4, true FROM seven_users u
         JOIN seven_desk_technicians t ON t.user_id = u.id AND t.slot = $2
         WHERE u.id = $1 AND u."emailVerified" IS TRUE
           AND t.slot BETWEEN 1 AND (${quotaSql("t.user_id")})
         ON CONFLICT (user_id, slot) DO UPDATE SET label = EXCLUDED.label,
           token_hash = EXCLUDED.token_hash, device_hash = NULL,
           technician_verified = true, created_at = now()
         RETURNING user_id`,
        [userId, slot, label, tokenHash(token)],
      );
      if (result.rows.length !== 1)
        return res.status(409).json({error:'Cadastre um técnico nesta vaga e confirme seu e-mail'});
      return res.status(200).json({ token });
    } catch {
      return res.status(503).json({ error: 'Não foi possível atualizar a ativação' });
    }
  };
}

module.exports = { appTokenUser, createAppTokenHandler, tokenHash };
