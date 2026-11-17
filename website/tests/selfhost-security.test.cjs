'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ready,allowed}=require('../lib/auth-handler');
const {safeAddress}=require('../lib/smtp-mail');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const base={SEVEN_ACCOUNT_STATUS_ENABLED:'1',SEVEN_SITE_URL:'https://www.sevendesk.tech',
 SEVEN_DB_HOST:'db',SEVEN_DB_NAME:'sevendesk',SEVEN_DB_USER:'sevendesk_app',
 SEVEN_DB_PASSWORD_FILE:'/run/secrets/app_db_password',
 SEVEN_AUTH_SECRET_FILE:'/run/secrets/auth_secret',
 SEVEN_SMTP_PASSWORD_FILE:'/run/secrets/smtp_password'};
test('selfhost authentication denies account access until all prerequisites are present',()=>{
  assert.equal(ready({}),false);
  assert.equal(ready(base),true);
  for(const name of Object.keys(base))assert.equal(ready({...base,[name]:''}),false,name);
  assert.equal(allowed('/api/auth/sign-up/email',base),false);
  // All public registrations must use /api/registration for PF/PJ identity checks.
  assert.equal(allowed('/api/auth/sign-up/email',{...base,SEVEN_REGISTRATION_ENABLED:'1'}),false);
  assert.equal(allowed('/api/auth/email-otp/request-password-reset',base),false);
  assert.equal(allowed('/api/auth/email-otp/request-password-reset',{...base,SEVEN_PASSWORD_RECOVERY_ENABLED:'1'}),true);
});
test('SMTP rejects header injection and non-email destinations',()=>{
  assert.equal(safeAddress('example+alias@example.com'),'example+alias@example.com');
  for(const email of ['','test@example.com\r\nBcc: attacker@example.com','admin@example.com\n','plain','root@localhost'])assert.throws(()=>safeAddress(email));
});
test('no runtime Neon Auth or Vercel is required for production backend',()=>{
  for(const file of ['conta.js','pagamento-retorno.js','lib/server-auth.js','lib/billing.js',
    'lib/app-tokens.js','lib/billing-readiness.js','api/auth-config.js']){
    assert.doesNotMatch(read(file),/neon_auth|@neon\/auth|NEON_AUTH_BASE_URL/i,file);
  }
  const src=read('server.js');
  assert.match(src,/pathname\.startsWith\('\/api\/auth\/'\)/);
  assert.match(src,/auth-handler/);
});
test('billing and licenses fail closed unless sales readiness was verified',()=>{
  const {isCheckoutReady}=require('../lib/billing-readiness');
  assert.equal(isCheckoutReady({}),false);
  assert.equal(isCheckoutReady({...base,SEVEN_BILLING_ENABLED:'1'}),false);
});
