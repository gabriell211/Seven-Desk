'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {teamPlan,normalizeEmail,inviteTechnician,acceptTechnicianInvite,revokeTechnician,getTeamMembership}=require('../lib/team-workspaces');
const teamId='11111111-1111-4111-8111-111111111111';
const ownerId='22222222-2222-4222-8222-222222222222';
const userId='33333333-3333-4333-8333-333333333333';
const token='sdi_'+Buffer.alloc(32,7).toString('base64url');
function fixture(handler){
  const calls=[];
  let released=false;
  const query=async(sql,args)=>{calls.push({sql,args});return handler(sql,args)||{rows:[]};};
  return {calls,query,connect:async()=>({query,release:()=>{released=true;}}),released:()=>released};
}
test('team plan contract is separate from individual device quota',()=>{
  assert.deepEqual(teamPlan('business'),{amount:4990,seats:3});
  assert.deepEqual(teamPlan('enterprise'),{amount:14990,seats:10});
  assert.throws(()=>teamPlan('monthly'));
  assert.throws(()=>teamPlan('__proto__'));
  assert.equal(normalizeEmail(' Tech@Example.com '),'tech@example.com');
  for(const value of [null,'a@@x.com','a b@x.com','abc'])assert.throws(()=>normalizeEmail(value));
});
test('invitation reserves a bounded seat under owner lock and stores only the hash',async()=>{
  const db=fixture((sql)=>sql.includes('FOR UPDATE OF t')?{rows:[{plan:'business'}]}:sql.includes('INSERT INTO')?{rows:[{seat:2,invite_expires_at:'2026-12-01'}]}:null);
  const result=await inviteTechnician(db,{teamId,ownerId,email:'Tech@Example.com'},()=>Buffer.alloc(32,7));
  assert.equal(result.token,token);
  assert.deepEqual(db.calls.find(c=>c.sql.includes('FOR UPDATE OF t')).args,[teamId,ownerId]);
  const insert=db.calls.find(c=>c.sql.includes('INSERT INTO'));
  assert.deepEqual(insert.args,[teamId,3,'tech@example.com',createHash('sha256').update(token).digest('hex')]);
  assert.match(insert.sql,/NOT EXISTS/);
  assert.equal(db.calls.at(-1).sql,'COMMIT');
  assert.equal(db.released(),true);
});
test('unauthorized owner or full team rolls back without assigning a seat',async()=>{
  const unauthorized=fixture(()=>null);
  await assert.rejects(inviteTechnician(unauthorized,{teamId,ownerId,email:'tech@example.com'}),/Team unavailable/);
  assert.equal(unauthorized.calls.at(-1).sql,'ROLLBACK');
  assert.equal(unauthorized.calls.some(c=>c.sql.includes('INSERT INTO')),false);
  const full=fixture(sql=>sql.includes('FOR UPDATE OF t')?{rows:[{plan:'enterprise'}]}:null);
  await assert.rejects(inviteTechnician(full,{teamId,ownerId,email:'tech@example.com'}),/No seat/);
  assert.equal(full.calls.find(c=>c.sql.includes('INSERT INTO')).args[1],10);
  assert.equal(full.calls.at(-1).sql,'ROLLBACK');
});
test('acceptance requires verified matching email, active team and single-use invitation',async()=>{
  const db=fixture(sql=>sql.includes('FOR UPDATE')?{rows:[{plan:'business'}]}:sql.includes('UPDATE seven_desk_team_seats')?{rows:[{seat:1}]}:null);
  assert.deepEqual(await acceptTechnicianInvite(db,{teamId,userId,token}),{seat:1});
  const update=db.calls.find(c=>c.sql.includes('UPDATE seven_desk_team_seats'));
  assert.match(update.sql,/"emailVerified" IS TRUE/);
  assert.match(update.sql,/lower\(trim\(u.email\)\)=s.invited_email/);
  assert.match(update.sql,/invite_hash=NULL/);
  assert.deepEqual(update.args,[teamId,createHash('sha256').update(token).digest('hex'),userId,3]);
  const expired=fixture(()=>null);
  assert.equal(await acceptTechnicianInvite(expired,{teamId,userId,token}),null);
  assert.equal(expired.calls.some(c=>c.sql.includes('UPDATE seven_desk_team_seats')),false);
});
test('revocation requires owner and membership query rechecks active plan and verified user',async()=>{
  const db=fixture(sql=>sql.includes('FOR UPDATE OF t')?{rows:[{id:teamId}]}:sql.includes('DELETE')?{rows:[{seat:1}]}:null);
  assert.equal(await revokeTechnician(db,{teamId,ownerId,seat:1}),true);
  assert.equal(await revokeTechnician(fixture(()=>null),{teamId,ownerId,seat:1}),false);
  const membership=fixture(()=>null);
  assert.equal(await getTeamMembership(membership,{teamId,userId}),null);
  assert.deepEqual(membership.calls[0].args,[teamId,userId]);
  assert.match(membership.calls[0].sql,/paid_through>now\(\)/);
  assert.match(membership.calls[0].sql,/WHEN 'business' THEN 3 WHEN 'enterprise' THEN 10/);
});
