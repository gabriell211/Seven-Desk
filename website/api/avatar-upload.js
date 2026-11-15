'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { authenticatedUser } = require('../lib/server-auth');

const formats = {
  'image/jpeg': {ext:'jpg', valid: bytes => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))},
  'image/png': {ext:'png', valid: bytes => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))},
  'image/webp': {ext:'webp', valid: bytes => bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'},
};
let db;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});
  if (process.env.SEVEN_ACCOUNT_STATUS_ENABLED !== '1' || !process.env.SEVEN_AVATAR_DIR) {
    return res.status(503).json({error:'Fotos indisponíveis'});
  }
  const format = formats[req.headers['content-type']];
  if (!format || !Buffer.isBuffer(req.body) || req.body.length > 2 * 1024 * 1024 ||
      !format.valid(req.body)) return res.status(400).json({error:'Foto inválida'});
  try {
    const userId = await authenticatedUser(req.headers.authorization);
    if (!userId) return res.status(401).json({error:'Entre na sua conta'});
    if (!process.env.DATABASE_URL) throw new Error('Database unavailable');
    if (!db) db = new Pool({connectionString:process.env.DATABASE_URL, max:3, idleTimeoutMillis:5000});
    const verified = await db.query('SELECT 1 FROM neon_auth."user" WHERE id = $1 AND "emailVerified" IS TRUE', [userId]);
    if (!verified.rows.length) return res.status(403).json({error:'Confirme seu e-mail'});
    const directory = path.join(process.env.SEVEN_AVATAR_DIR, userId);
    await fs.mkdir(directory, {recursive:true, mode:0o750});
    const filename = `profile.${format.ext}`;
    const temporary = path.join(directory, `.${filename}.${process.pid}.tmp`);
    try {
      await fs.writeFile(temporary, req.body, {mode:0o640});
      await fs.rename(temporary, path.join(directory, filename));
    } finally {
      await fs.rm(temporary, {force:true});
    }
    for (const other of ['jpg', 'png', 'webp']) {
      if (other !== format.ext) await fs.rm(path.join(directory, `profile.${other}`), {force:true});
    }
    return res.status(200).json({url:`https://www.sevendesk.tech/avatars/${userId}/${filename}`});
  } catch {
    return res.status(503).json({error:'Não foi possível salvar a foto'});
  }
};
