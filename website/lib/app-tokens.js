'use strict';

const { createHash, randomBytes } = require('node:crypto');

const TOKEN_RE = /^sd_[A-Za-z0-9_-]{43}$/;
const DEVICE_RE = /^[0-9a-f]{64}$/;

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function appTokenUser(pool, header, bindDevice = false) {
  const credential = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  const [rawToken, deviceHash, extra] = credential.split(':');
  const token = TOKEN_RE.test(rawToken) && !extra ? rawToken : null;
  if (!token) return null;
  if (bindDevice && !DEVICE_RE.test(deviceHash || '')) return null;
  if (!bindDevice && deviceHash !== undefined) return null;
  const result = bindDevice
    ? await pool.query(
      `UPDATE seven_desk_app_tokens t SET device_hash = COALESCE(t.device_hash, $2)
         FROM neon_auth."user" u WHERE t.token_hash = $1 AND u.id = t.user_id
          AND u."emailVerified" IS TRUE AND (t.device_hash IS NULL OR t.device_hash = $2)
        RETURNING t.user_id`, [tokenHash(token), deviceHash])
    : await pool.query(
      `SELECT t.user_id FROM seven_desk_app_tokens t
         JOIN neon_auth."user" u ON u.id = t.user_id
        WHERE t.token_hash = $1 AND u."emailVerified" IS TRUE`, [tokenHash(token)]);
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
      if (req.method === 'GET') {
        const result = await db.query(
          'SELECT slot, label FROM seven_desk_app_tokens WHERE user_id = $1 ORDER BY slot',
          [userId],
        );
        return res.status(200).json({ devices: result.rows });
      }
      const slot = Number(req.body?.slot);
      if (!Number.isInteger(slot) || slot < 1 || slot > 5) return res.status(400).json({ error: 'Computador inválido' });
      if (req.method === 'DELETE') {
        await db.query('DELETE FROM seven_desk_app_tokens WHERE user_id = $1 AND slot = $2', [userId, slot]);
        return res.status(200).json({ active: false, slot });
      }
      const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
      if (!label || label.length > 60) return res.status(400).json({ error: 'Nome do computador inválido' });
      const token = 'sd_' + random(32).toString('base64url');
      const result = await db.query(
        `INSERT INTO seven_desk_app_tokens (user_id, slot, label, token_hash)
         SELECT id, $2, $3, $4 FROM neon_auth."user" WHERE id = $1 AND "emailVerified" IS TRUE
         ON CONFLICT (user_id, slot) DO UPDATE SET label = EXCLUDED.label,
           token_hash = EXCLUDED.token_hash, device_hash = NULL, created_at = now()
         RETURNING user_id`,
        [userId, slot, label, tokenHash(token)],
      );
      if (result.rows.length !== 1) return res.status(403).json({ error: 'Confirme seu e-mail' });
      return res.status(200).json({ token });
    } catch {
      return res.status(503).json({ error: 'Não foi possível atualizar a ativação' });
    }
  };
}

module.exports = { appTokenUser, createAppTokenHandler };
