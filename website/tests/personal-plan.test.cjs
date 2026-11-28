'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {personalEnabled,personalMembershipSql,enrollPersonal,revokePersonal,createPersonalHandler}=require('../lib/personal-plan');
const userId='11111111-1111-4111-8111-111111111111';
test('Personal requires all flags and never accepts arbitrary SQL references',()=>{
  const env={SEVEN_PERSONAL_ENABLED:'1',SEVEN_ACCOUNT_STATUS_ENABLED:'1',SEVEN_LICENSE_API_ENABLED:'1'};
  assert.equal(personalEnabled(env),true);
  for(const key of Object.keys(env))assert.equal(personalEnabled({...env,[key]:'0'}),false);
  assert.throws(()=>personalMembershipSql('user input'));
  assert.match(personalMembershipSql('t.user_id'),/pe.revoked_at IS NULL/);
});
test('enrollment and revocation only mutate the authenticated personal account',async()=>{
  const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:[{user_id:userId}]};}};
  assert.equal(await enrollPersonal(db,userId),true);await revokePersonal(db,userId);
  assert.deepEqual(calls[0].args,[userId,'personal-v1']);
  assert.match(calls[0].sql,/"accountType"='PF'/);assert.match(calls[0].sql,/"emailVerified" IS TRUE/);
  assert.deepEqual(calls[1].args,[userId]);
  assert.equal(await enrollPersonal({query:async()=>({rows:[]})},userId),false);
});
test('Personal activation requires explicit consent and authenticated session',async()=>{
  const calls=[];
  const handler=createPersonalHandler({enabled:()=>true,authenticate:async h=>h==='valid'?userId:null,pool:()=>({}),
    enroll:async(db,id)=>{calls.push(id);return true;},revoke:async(db,id)=>calls.push(id)});
  const run=async(method,body,authorization='valid')=>{const r={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({method,body,headers:{authorization}},r);return r;};
  assert.equal((await run('POST',{})).code,400);
  assert.equal((await run('POST',{acceptNonCommercial:true,termsVersion:'personal-v1'},'bad')).code,401);
  assert.equal((await run('POST',{acceptNonCommercial:true,termsVersion:'personal-v1',userId:'other'})).code,200);
  assert.equal((await run('DELETE',{})).code,200);
  assert.deepEqual(calls,[userId,userId]);
});
test('individual quota restricts Personal to one slot only after paid and trial access ends',async()=>{
  const keys=['SEVEN_PERSONAL_ENABLED','SEVEN_ACCOUNT_STATUS_ENABLED','SEVEN_LICENSE_API_ENABLED'];
  const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try{
    for(const key of keys)process.env[key]='1';
    const {quotaSql}=require('../lib/technicians');
    const sql=quotaSql('t.user_id');
    assert.match(sql,/THEN 1 ELSE 5/);assert.match(sql,/paid.paid_through>now\(\)/);
    assert.match(sql,/trial_user."createdAt" \+ interval '1 month'>now\(\)/);
    const {getEntitlement}=require('../lib/billing');
    await getEntitlement({query:async(q,args)=>{assert.match(q,/WHEN s.paid_through > now\(\) THEN 'paid'/);assert.match(q,/THEN 'personal' ELSE 'expired'/);assert.deepEqual(args,[userId]);return {rows:[]};}},userId);
  }finally{for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
