'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/auth-config');
const names=['SEVEN_SITE_URL','SEVEN_DB_HOST','SEVEN_DB_NAME','SEVEN_DB_USER','SEVEN_DB_PASSWORD_FILE','SEVEN_AUTH_SECRET_FILE','SEVEN_SMTP_PASSWORD_FILE','SEVEN_ACCOUNT_STATUS_ENABLED'];
const ready=Object.fromEntries(names.map(k=>[k,k==='SEVEN_ACCOUNT_STATUS_ENABLED'?'1':'present']));
ready.SEVEN_SITE_URL='https://www.sevendesk.tech';
function invoke(env,method='GET'){
  const old=Object.fromEntries(names.map(k=>[k,process.env[k]]));
  for(const k of names){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}
  const res={headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(x){this.body=x;return this}};
  try{handler({method},res)}finally{for(const k of names){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
  return res;
}
test('only the local Seven Desk auth endpoint is exposed when configured',()=>{
  const ok=invoke(ready);
  assert.equal(ok.code,200);
  assert.deepEqual(ok.body,{authUrl:'https://www.sevendesk.tech/api/auth'});
  assert.equal(ok.headers['Cache-Control'],'no-store');
  assert.equal(invoke({...ready,SEVEN_ACCOUNT_STATUS_ENABLED:'0'}).code,503);
  assert.equal(invoke({...ready,SEVEN_SMTP_PASSWORD_FILE:''}).code,503);
  assert.equal(invoke(ready,'POST').code,405);
});
