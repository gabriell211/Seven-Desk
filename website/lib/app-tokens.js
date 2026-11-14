'use strict';

const { createHash, randomBytes } = require('node:crypto');

const TOKEN_RE = /^sd_[A-Za-z0-9_-]{43}$/;

function bearerAppToken(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  return TOKEN_RE.test(token) ? token : null;
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function appTokenUser(pool, header) {
  const token = bearerAppToken(header);
  if (!token) return null;
  const result = await pool.query(
    `SELECT t.user_id FROM seven_desk_app_tokens t
       JOIN neon_auth."user" u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND u."emailVerified" IS TRUE`,
    [tokenHash(token)],
  );
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
          'SELECT 1 FROM seven_desk_app_tokens WHERE user_id = $1',
          [userId],
        );
        return res.status(200).json({ active: result.rows.length === 1 });
      }
      if (req.method === 'DELETE') {
        await db.query('DELETE FROM seven_desk_app_tokens WHERE user_id = $1', [userId]);
        return res.status(200).json({ active: false });
      }
      const token = 'sd_' + random(32).toString('base64url');
      const result = await db.query(
        `INSERT INTO seven_desk_app_tokens (user_id, token_hash)
         SELECT id, $2 FROM neon_auth."user" WHERE id = $1 AND "emailVerified" IS TRUE
         ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_at = now()
         RETURNING user_id`,
        [userId, tokenHash(token)],
      );
      if (result.rows.length !== 1) return res.status(403).json({ error: 'Confirme seu e-mail' });
      return res.status(200).json({ token });
    } catch {
      return res.status(503).json({ error: 'Não foi possível atualizar a ativação' });
    }
  };
}

module.exports = { bearerAppToken, appTokenUser, createAppTokenHandler };
