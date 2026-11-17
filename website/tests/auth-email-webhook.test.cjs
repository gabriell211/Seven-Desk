'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { renderOtpEmail } = require('../lib/auth-email-template');
const { createWebhookHandler, verifySignedEvent, sendHostingerEmail } = require('../lib/neon-email-webhook');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const jwk = { ...publicKey.export({format:'jwk'}), kid:'test-key', use:'sig', alg:'EdDSA' };
const timestamp = '1794870000000';
const stubEnv = {
  SEVEN_AUTH_MAIL_WEBHOOK_ENABLED:'1',
  NEON_AUTH_BASE_URL:'https://auth.example.test',
  SEVEN_SMTP_HOST:'smtp.hostinger.com',
  SEVEN_SMTP_USER:'sevendesk@sevendesk.tech',
  SEVEN_SMTP_PASSWORD:'test-secret-not-used',
  SEVEN_SMTP_FROM:'Seven Desk <sevendesk@sevendesk.tech>',
};
const webhook = {
  event_id: 'test-event', event_type: 'send.otp',
  user: {email:'pessoa@example.com', name:'João <script>alert(1)</script>'},
  event_data: {otp_code:'123456', otp_type:'email-verification'},
};
const mockFetch = async () => ({ok:true,json:async () => ({keys:[jwk]})});
function signed(event = webhook, opts = {}) {
  const raw = JSON.stringify(event);
  const when = opts.timestamp || timestamp;
  const header = Buffer.from(JSON.stringify({alg:'EdDSA',kid:'test-key'})).toString('base64url');
  const input = header + '.' + Buffer.from(when + '.' + Buffer.from(raw).toString('base64url')).toString('base64url');
  const signature = crypto.sign(null, Buffer.from(input), privateKey).toString('base64url');
  return {
    raw,
    headers: {
      'x-neon-signature': header + '..' + (opts.signature || signature),
      'x-neon-signature-kid':'test-key',
      'x-neon-timestamp': when,
    },
  };
}
function response() {
  return {
    code:200, data:null, headers:{},
    setHeader(k,v){this.headers[k]=v;return this},
    status(n){this.code=n;return this},
    json(obj){this.data=obj;return this},
  };
}
async function call(handler, signedEvent, method = 'POST') {
  const req = Readable.from([Buffer.from(signedEvent.raw)]);
  req.headers = signedEvent.headers;
  req.method = method;
  const res = response();
  await handler(req,res);
  return res;
}

test('renders professional pt-BR emails for verification, recovery and sign-in', () => {
  for (const type of ['email-verification','forget-password','sign-in']) {
    const email = renderOtpEmail({type,code:'456789',name:'Maria Silva'});
    assert.match(email.subject,/Seven Desk/);
    assert.match(email.html,/<html lang="pt-BR">/);
    assert.match(email.html, /456789/);
    assert.match(email.html, /www.sevendesk.tech/);
    assert.match(email.text,/Nunca compartilhe/);
  }
});

test('escapes untrusted names and rejects invalid codes and unsupported types', () => {
  const email = renderOtpEmail({type:'email-verification', code:'123456',name:'<script>alert(1)</script>'});
  assert.doesNotMatch(email.html,/<script>/);
  assert.match(email.html,/&lt;script&gt;/);
  assert.throws(() => renderOtpEmail({type:'email-verification',code:'1234567'}));
  assert.throws(() => renderOtpEmail({type:'email-verification',code:'1'}));
  assert.throws(() => renderOtpEmail({type:'password',code:'123456'}));
});

test('validates detached Ed25519 signatures with exact raw body', async () => {
  const payload = signed();
  assert.deepEqual(await verifySignedEvent(payload.raw,payload.headers,{
    authBaseUrl:stubEnv.NEON_AUTH_BASE_URL, fetchFn:mockFetch, now:()=>Number(timestamp),
  }),webhook);
  await assert.rejects(verifySignedEvent(payload.raw+' ',payload.headers,{
    authBaseUrl:stubEnv.NEON_AUTH_BASE_URL, fetchFn:mockFetch,now:()=>Number(timestamp),
  }),/Invalid webhook signature/);
});

test('blocks expired, future and wrong-key events', async () => {
  const payload = signed();
  const opts = {authBaseUrl:stubEnv.NEON_AUTH_BASE_URL,fetchFn:mockFetch};
  await assert.rejects(verifySignedEvent(payload.raw,payload.headers,{...opts,now:()=>Number(timestamp)+300001}),/Expired/);
  await assert.rejects(verifySignedEvent(payload.raw,payload.headers,{...opts,now:()=>Number(timestamp)-300001}),/Expired/);
  const forged = {...payload.headers,'x-neon-signature-kid':'not-the-key'};
  await assert.rejects(verifySignedEvent(payload.raw,forged,{...opts,now:()=>Number(timestamp)}),/Invalid signature header/);
});

test('refuses disabled and incomplete SMTP configuration without reading the body', async () => {
  let sent=0;
  const handler=createWebhookHandler({env:{...stubEnv,SEVEN_AUTH_MAIL_WEBHOOK_ENABLED:'0'},
    fetchFn:mockFetch,now:()=>Number(timestamp), sendEmail:async()=>sent++});
  const res=await call(handler,signed());
  assert.equal(res.code,503);
  assert.equal(sent,0);
  const missing = createWebhookHandler({env:{...stubEnv,SEVEN_SMTP_PASSWORD:''},
    fetchFn:mockFetch,now:()=>Number(timestamp),sendEmail:async()=>sent++});
  assert.equal((await call(missing,signed())).code,503);
  assert.equal(sent,0);
});

test('rejects invalid signature, oversize payloads, and unsupported event types', async () => {
  const sent=[];
  const handler=createWebhookHandler({env:stubEnv,fetchFn:mockFetch,now:()=>Number(timestamp),
    sendEmail:async data=>sent.push(data)});
  const bad=signed();bad.headers['x-neon-signature']='tampered';
  assert.equal((await call(handler,bad)).code,401);
  const oversize = signed({...webhook, filler:'x'.repeat(20000)});
  assert.equal((await call(handler,oversize)).code,413);
  assert.equal((await call(handler,signed({...webhook,event_type:'user.created'}))).code,400);
  assert.equal((await call(handler,signed({...webhook,user:{email:'invalid'}}))).code,400);
  assert.equal((await call(handler,signed({...webhook,event_data:{otp_type:'sign-in',otp_code:'abcdef'}}))).code,400);
  assert.equal(sent.length,0);
});

test('sends a verified code exactly once through injectable SMTP transport', async () => {
  const sent=[];
  const handler=createWebhookHandler({env:stubEnv,fetchFn:mockFetch,now:()=>Number(timestamp),
    sendEmail:async (message,env) => {sent.push(message);assert.equal(env.SEVEN_SMTP_HOST,'smtp.hostinger.com')}});
  const result=await call(handler,signed());
  assert.equal(result.code,200);
  assert.deepEqual(result.data,{received:true});
  assert.equal(sent.length,1);
  assert.equal(sent[0].to,'pessoa@example.com');
  assert.equal(sent[0].html.includes('123456'),true);
  assert.equal((await call(handler,signed(),'GET')).code,405);
});

test('mail service errors do not reveal credentials or verification codes', async () => {
  const handler=createWebhookHandler({env:stubEnv,fetchFn:mockFetch,now:()=>Number(timestamp),
    sendEmail:async () => {throw new Error('SMTP failed: 123456 test-secret-not-used')}});
  const result=await call(handler,signed());
  assert.equal(result.code,503);
  assert.doesNotMatch(JSON.stringify(result.data),/123456|test-secret-not-used/);
});

test('SMTP configuration is limited to professional sender and secure Hostinger relay', async () => {
  await assert.rejects(sendHostingerEmail({to:'x@example.com',subject:'x',text:'x'}, {...stubEnv,SEVEN_SMTP_HOST:'evil.test'}),/SMTP is not configured/);
  await assert.rejects(sendHostingerEmail({to:'x@example.com',subject:'x',text:'x'}, {...stubEnv,SEVEN_SMTP_FROM:'X <evil@example.com>'}),/Invalid sender/);
});
