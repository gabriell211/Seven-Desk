'use strict';

const crypto = require('node:crypto');
const { renderOtpEmail } = require('./auth-email-template');

const MAX_BYTES = 16 * 1024;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function authJwksUrl(baseUrl) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid Neon Auth endpoint');
  }
  return new URL(url.href.replace(/\/$/, '') + '/.well-known/jwks.json');
}

function decodeJson(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error('Malformed signed event');
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

async function verifySignedEvent(rawBody, headers, { authBaseUrl, fetchFn = fetch, now = Date.now }) {
  const signature = headers['x-neon-signature'];
  const kid = headers['x-neon-signature-kid'];
  const timestamp = headers['x-neon-timestamp'];
  if (typeof signature !== 'string' || typeof kid !== 'string' || !kid ||
      typeof timestamp !== 'string' || !/^\d{13}$/.test(timestamp)) throw new Error('Missing signature');
  if (Math.abs(now() - Number(timestamp)) > MAX_CLOCK_SKEW_MS) throw new Error('Expired signed event');
  const parts = signature.split('.');
  if (parts.length !== 3 || parts[1] !== '' || !/^[A-Za-z0-9_-]+$/.test(parts[2])) throw new Error('Malformed signature');
  const header = decodeJson(parts[0]);
  if (header.alg !== 'EdDSA' || header.kid !== kid) throw new Error('Invalid signature header');

  const jwksResponse = await fetchFn(authJwksUrl(authBaseUrl), {signal: AbortSignal.timeout(4000)});
  if (!jwksResponse.ok) throw new Error('Unable to validate sender');
  const jwks = await jwksResponse.json();
  const key = jwks?.keys?.find(value => value.kid === kid && value.kty === 'OKP' &&
    value.crv === 'Ed25519' && (value.use === undefined || value.use === 'sig'));
  if (!key) throw new Error('Unknown signing key');
  const verified = crypto.verify(null,
    Buffer.from(parts[0] + '.' + Buffer.from(timestamp + '.' + Buffer.from(rawBody).toString('base64url')).toString('base64url')),
    crypto.createPublicKey({key, format:'jwk'}), Buffer.from(parts[2], 'base64url'));
  if (!verified) throw new Error('Invalid webhook signature');
  return JSON.parse(rawBody);
}

async function readRawBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const part = Buffer.from(chunk);
    size += part.length;
    if (size > MAX_BYTES) throw new RangeError('Payload too large');
    chunks.push(part);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function sendHostingerEmail({to, subject, text, html}, env) {
  if (env.SEVEN_SMTP_HOST !== 'smtp.hostinger.com' ||
      env.SEVEN_SMTP_USER !== 'sevendesk@sevendesk.tech' ||
      !env.SEVEN_SMTP_PASSWORD || !env.SEVEN_SMTP_FROM) throw new Error('SMTP is not configured');
  const from = env.SEVEN_SMTP_FROM;
  if (!/^Seven Desk <sevendesk@sevendesk\.tech>$/.test(from)) throw new Error('Invalid sender');
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: env.SEVEN_SMTP_HOST, port: 465, secure: true,
    auth: {user: env.SEVEN_SMTP_USER, pass: env.SEVEN_SMTP_PASSWORD},
    tls: {minVersion:'TLSv1.2'},
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    await transporter.sendMail({from, to, subject, text, html});
  } finally {
    transporter.close();
  }
}

function createWebhookHandler({env = process.env, fetchFn = fetch, now = Date.now, sendEmail = sendHostingerEmail} = {}) {
  return async function neonEmailWebhook(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'});
    if (env.SEVEN_AUTH_MAIL_WEBHOOK_ENABLED !== '1' || !env.NEON_AUTH_BASE_URL ||
        !env.SEVEN_SMTP_PASSWORD || !env.SEVEN_SMTP_USER || !env.SEVEN_SMTP_FROM ||
        env.SEVEN_SMTP_HOST !== 'smtp.hostinger.com') {
      return res.status(503).json({error:'Envio personalizado indisponível'});
    }
    let event;
    try {
      const rawBody = await readRawBody(req);
      event = await verifySignedEvent(rawBody, req.headers, {
        authBaseUrl: env.NEON_AUTH_BASE_URL, fetchFn, now,
      });
    } catch (error) {
      return res.status(error instanceof RangeError ? 413 : 401).json({error:'Evento não autorizado'});
    }
    if (event?.event_type !== 'send.otp' ||
        typeof event?.user?.email !== 'string' || event.user.email.length > 254 ||
        !EMAIL_PATTERN.test(event.user.email)) {
      return res.status(400).json({error:'Evento inválido'});
    }
    let email;
    try {
      email = renderOtpEmail({
        type: event?.event_data?.otp_type,
        code: event?.event_data?.otp_code,
        name: event?.user?.name,
      });
    } catch {
      return res.status(400).json({error:'Evento inválido'});
    }
    try {
      await sendEmail({to:event.user.email, ...email}, env);
      return res.status(200).json({received:true});
    } catch {
      return res.status(503).json({error:'Falha temporária no envio'});
    }
  };
}

module.exports = { createWebhookHandler, verifySignedEvent, sendHostingerEmail };
