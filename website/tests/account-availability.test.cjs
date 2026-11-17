'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const route=require('../api/account-availability');
const keys=['SEVEN_ACCOUNT_STATUS_ENABLED','SEVEN_REGISTRATION_ENABLED','SEVEN_PASSWORD_RECOVERY_ENABLED',
 'SEVEN_SITE_URL','SEVEN_DB_HOST','SEVEN_DB_NAME','SEVEN_DB_USER','SEVEN_DB_PASSWORD_FILE','SEVEN_AUTH_SECRET_FILE','SEVEN_SMTP_PASSWORD_FILE'];
function invoke(env,method='GET'){
  const prev=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}
  const res={headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(data){this.data=data;return this}};
  try{route({method},res)}finally{for(const k of keys){if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k];}}
  return res;
}
const ready=Object.fromEntries(keys.map(k=>[k,k==='SEVEN_SITE_URL'?'https://www.sevendesk.tech':'present']));
ready.SEVEN_ACCOUNT_STATUS_ENABLED='1';
test('selfhosted account requires explicit opt-in and configured backend',()=>{
  assert.deepEqual(invoke({}).data,{loginEnabled:false,registrationEnabled:false,recoveryEnabled:false});
  assert.deepEqual(invoke(ready).data,{loginEnabled:true,registrationEnabled:false,recoveryEnabled:false});
  assert.deepEqual(invoke({...ready,SEVEN_REGISTRATION_ENABLED:'1',SEVEN_PASSWORD_RECOVERY_ENABLED:'1'}).data,{loginEnabled:true,registrationEnabled:true,recoveryEnabled:true});
  assert.equal(invoke({...ready,SEVEN_ACCOUNT_STATUS_ENABLED:'0',SEVEN_REGISTRATION_ENABLED:'1'}).data.loginEnabled,false);
  assert.equal(invoke(ready,'POST').code,405);
});
