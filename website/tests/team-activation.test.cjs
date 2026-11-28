'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {teamLicenseEnabled,issueTeamActivation,claimTeamDevice,authorizeTeamDevice,getTeamDeviceProfile}=require('../lib/team-activation');
const {createLicenseHandler}=require('../lib/license-routes');
const userId='11111111-1111-4111-8111-111111111111',teamId='22222222-2222-4222-8222-222222222222';
const token='sd_'+Buffer.alloc(32,1).toString('base64url'),code='tec_'+'a'.repeat(32),device='b'.repeat(64);
const hash=x=>createHash('sha256').update(x).digest('hex');
function fixture(rows=[]){
  const calls=[];
  return {calls,query:async(sql,args)=>{calls.push({sql,args});return {rows};}};
}
test('team license is disabled unless every required flag is enabled',()=>{
  const env={SEVEN_ACCOUNT_STATUS_ENABLED:'1',SEVEN_LICENSE_API_ENABLED:'1',SEVEN_TEAM_WORKSPACES_ENABLED:'1',SEVEN_TEAM_LICENSE_ENABLED:'1'};
  assert.equal(teamLicenseEnabled(env),true);
  for(const k of Object.keys(env))assert.equal(teamLicenseEnabled({...env,[k]:'0'}),false);
});
test('only accepted verified member can rotate one device credential; raw secrets are never stored',async()=>{
  const db=fixture([{seat:1}]);
  const pair=await issueTeamActivation(db,{teamId,userId},()=>Buffer.alloc(32,1),()=>code);
  assert.deepEqual(pair,{token,technicianCode:code});
  const {sql,args}=db.calls[0];
  assert.deepEqual(args,[teamId,userId,hash(token),hash(code)]);
  assert.match(sql,/s.technician_user_id=\$2/);
  assert.match(sql,/FOR UPDATE OF s/);
  assert.match(sql,/ON CONFLICT \(team_id,seat\)/);
  assert.match(sql,/device_hash=NULL/);
  assert.equal(await issueTeamActivation(fixture(),{teamId,userId},()=>Buffer.alloc(32,1),()=>code),null);
});
test('claim and license enforce active verified seat and device binding',async()=>{
  const db=fixture([{team_id:teamId,user_id:userId,paid_through:'2026-12-28T00:00:00Z'}]);
  assert.equal(await claimTeamDevice(db,token,code),true);
  assert.deepEqual(db.calls[0].args,[hash(token),hash(code)]);
  assert.equal((await authorizeTeamDevice(db,'Bearer '+token+':'+device)).team_id,teamId);
  assert.deepEqual(db.calls[1].args,[hash(token),device]);
  assert.match(db.calls[1].sql,/a.technician_verified IS TRUE/);
  assert.match(db.calls[1].sql,/a.device_hash IS NULL OR a.device_hash=\$2/);
  for(const c of db.calls){assert.match(c.sql,/t.paid_through>now\(\)/);assert.match(c.sql,/"emailVerified" IS TRUE/);assert.match(c.sql,/WHEN 'business' THEN 3 WHEN 'enterprise' THEN 10/);}
  assert.equal(await authorizeTeamDevice(db,'Bearer '+token),null);
  assert.equal(await authorizeTeamDevice(fixture(),'Bearer '+token+':'+device),null);
  assert.equal(await claimTeamDevice(fixture(),token,code),false);
});
test('team profile does not disclose credentials and requires an active verified seat',async()=>{
  const db=fixture([{name:'Técnico',image:'',company_name:'Empresa'}]);
  assert.deepEqual(await getTeamDeviceProfile(db,'Bearer '+token),{name:'Técnico',image:'',companyName:'Empresa',deviceLabel:'Computador da equipe'});
  assert.match(db.calls[0].sql,/a.technician_verified IS TRUE/);
  assert.match(db.calls[0].sql,/t.paid_through>now\(\)/);
});
test('existing license endpoint accepts team credentials only when verified and unexpired',async()=>{
  const run=async team=>{
    const h=createLicenseHandler({enabled:()=>true,authenticate:async()=>null,pool:()=>({}),getEntitlement:async()=>{throw Error('individual lookup not expected');},teamAuthorize:async()=>team,now:()=>Date.parse('2026-11-28T00:00:00Z')});
    const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await h({method:'GET',headers:{authorization:'Bearer '+token+':'+device}},res);return res;
  };
  const ok=await run({team_id:teamId,user_id:userId,paid_through:'2026-12-28T00:00:00Z'});
  assert.equal(ok.code,200);assert.equal(ok.body.allowed,true);assert.equal(ok.body.teamId,teamId);
  assert.equal((await run(null)).code,401);
  assert.equal((await run({team_id:teamId,user_id:userId,paid_through:'2026-11-01T00:00:00Z'})).code,401);
});
