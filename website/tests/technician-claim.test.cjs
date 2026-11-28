'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createTechnicianClaimHandler}=require('../api/technician-claim');
const {technicianCodeHash}=require('../lib/technicians');
const {tokenHash,appTokenUser}=require('../lib/app-tokens');

const device='sd_'+'a'.repeat(43);
const technician='tec_'+'b'.repeat(32);
const userId='bbde939e-b2c5-45f5-9dc0-6645f59d78cf';
const makeResponse=()=>({setHeader(){},status(code){this.code=code;return this},
  json(body){this.body=body;return this}});
const request=(activationToken=device,technicianCode=technician)=>({
  method:'POST',body:{activationToken,technicianCode},
});
process.env.SEVEN_ACCOUNT_STATUS_ENABLED='1';
process.env.SEVEN_LICENSE_API_ENABLED='1';

test('a technician can pair only with device activation from matching account and slot',async()=>{
  const calls=[];
  const db={query:async(sql,params)=>{
    calls.push({sql,params});
    return params[0]===tokenHash(device)&&
      params[1]===technicianCodeHash(technician)
      ?{rows:[{user_id:userId}]}:{rows:[]};
  }};
  const handler=createTechnicianClaimHandler({db:()=>db});
  const ok=makeResponse();
  await handler(request(),ok);
  assert.equal(ok.code,200);
  assert.deepEqual(ok.body,{verified:true});
  assert.match(calls[0].sql,/t\.slot=a\.slot/);
  assert.ok(calls[0].sql.includes('a.slot BETWEEN 1 AND (5 + COALESCE'));
  assert.ok(calls[0].sql.includes('WHERE user_id = a.user_id'));
  assert.match(calls[0].sql,/t\.user_id=a\.user_id/);
  assert.match(calls[0].sql,/"emailVerified" IS TRUE/);
  assert.equal(calls[0].params[0],tokenHash(device));
  assert.equal(calls[0].params[1],technicianCodeHash(technician));
  assert.equal(JSON.stringify(calls).includes(device),false);
  assert.equal(JSON.stringify(calls).includes(technician),false);
});

test('generation-two account requires new activation, legacy claim is rejected before DB query',async()=>{
  const old=process.env.SEVEN_ACTIVATION_GENERATION;
  let updates=0;
  try{
    process.env.SEVEN_ACTIVATION_GENERATION='2';
    const latest='sd2_'+'x'.repeat(43);
    const handler=createTechnicianClaimHandler({db:()=>({query:async()=>{
      updates++;return {rows:[{user_id:userId}]};
    }})});
    const rejected=makeResponse();await handler(request(device,technician),rejected);
    assert.equal(rejected.code,400);
    assert.equal(updates,0);
    const accepted=makeResponse();await handler(request(latest,technician),accepted);
    assert.equal(accepted.code,200);
    assert.equal(updates,1);
  }finally{
    if(old===undefined)delete process.env.SEVEN_ACTIVATION_GENERATION;
    else process.env.SEVEN_ACTIVATION_GENERATION=old;
  }
});

test('malformed and nonmatching technician codes never verify a device',async()=>{
  let updates=0;
  const handler=createTechnicianClaimHandler({db:()=>({
    query:async()=>{updates++;return {rows:[]}},
  })});
  for(const body of [
    request('invalid',technician),
    request(device,'tec_wrong'),
    request(device,device),
  ]){
    const res=makeResponse();await handler(body,res);
    assert.equal(res.code,400);
  }
  assert.equal(updates,0);
  const bad=makeResponse();await handler(request(),bad);
  assert.equal(bad.code,401);
});

test('license and profile lookups require prior technician verification',async()=>{
  let queries=0;
  const db={query:async(sql)=>{
    queries++;
    assert.match(sql,/t\.technician_verified IS TRUE/);
    return {rows:[]};
  }};
  assert.equal(await appTokenUser(db,'Bearer '+device),null);
  assert.equal(await appTokenUser(db,'Bearer '+device+':'+'a'.repeat(64),true),null);
  assert.equal(queries,2);
});

test('new keys rotate device binding and secondary code issuance is retired',async()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const tokens=fs.readFileSync(path.join(__dirname,'..','lib','app-tokens.js'),'utf8');
  const code=fs.readFileSync(path.join(__dirname,'..','api','technician-code.js'),'utf8');
  const migration=fs.readFileSync(path.join(__dirname,'..','db','008_technician_claim.sql'),'utf8');
  assert.match(tokens,/technician_verified = true/);
  assert.match(tokens,/device_hash = NULL/);
  assert.match(code,/status\(410\)/);
  assert.match(migration,/technician_verified boolean NOT NULL DEFAULT false/);
});
