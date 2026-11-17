'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {pool} = require('../lib/db-pool');
const {authenticatedUser} = require('../lib/server-auth');

const formats = Object.freeze({
  'image/jpeg': {ext:'jpg', valid:b=>b.length >= 3 && b.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))},
  'image/png': {ext:'png', valid:b=>b.length >= 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))},
  'image/webp': {ext:'webp', valid:b=>b.length >= 12 && b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP'},
});
const MAX_BYTES = 2 * 1024 * 1024;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});
  if (process.env.SEVEN_ACCOUNT_STATUS_ENABLED !== '1' ||
      !process.env.SEVEN_AVATAR_DIR) return res.status(503).json({error:'Fotos indisponíveis'});
  const slot = Number(req.query?.slot);
  const format = formats[req.headers['content-type']];
  if (!Number.isInteger(slot) || slot < 1 || slot > 32767 ||
      !format || !Buffer.isBuffer(req.body) || req.body.length < 12 ||
      req.body.length > MAX_BYTES || !format.valid(req.body)) {
    return res.status(400).json({error:'Informe uma foto JPG, PNG ou WebP de até 2 MB'});
  }
  try {
    const userId = await authenticatedUser(req.headers.authorization);
    if (!userId) return res.status(401).json({error:'Entre na sua conta'});
    const db = pool();
    const exists = await db.query(
      'SELECT 1 FROM seven_desk_app_tokens t JOIN seven_users u ON u.id = t.user_id WHERE t.user_id = $1 AND t.slot = $2 AND u."emailVerified" IS TRUE',
      [userId, slot],
    );
    if (!exists.rowCount) return res.status(404).json({error:'Computador não encontrado'});
    const directory = path.join(process.env.SEVEN_AVATAR_DIR, userId);
    await fs.mkdir(directory, {recursive:true, mode:0o750});
    const filename = `technician-${slot}.${format.ext}`;
    const destination = path.join(directory, filename);
    const temporary = path.join(directory, `.${filename}.${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, req.body, {mode:0o640, flag:'wx'});
      await fs.rename(temporary, destination);
    } finally {
      await fs.rm(temporary, {force:true});
    }
    const origin = new URL(process.env.SEVEN_SITE_URL);
    if (origin.protocol !== 'https:') throw new Error('Invalid site URL');
    const url = `${origin.origin}/avatars/${userId}/${filename}`;
    const updated = await db.query(
      'UPDATE seven_desk_app_tokens SET technician_image = $3 WHERE user_id = $1 AND slot = $2 RETURNING slot',
      [userId, slot, url],
    );
    if (!updated.rowCount) return res.status(404).json({error:'Computador não encontrado'});
    for (const extension of ['jpg','png','webp']) {
      if (extension !== format.ext) {
        await fs.rm(path.join(directory, `technician-${slot}.${extension}`), {force:true});
      }
    }
    return res.status(200).json({url});
  } catch {
    return res.status(503).json({error:'Não foi possível salvar a foto do técnico'});
  }
};
