'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createTeamHandler}=require('../lib/team-routes');
const {normalizeEmail,listWorkspaces}=require('../lib/team-workspaces');
const id='11111111-1111-4111-8111-111111111111';
const team='22222222-2222-4222-8222-222222222222';
const token='sdi_'+'a'.repeat(43);
function setup({enabled=true,authenticated=id}={}){
  const calls=[];
  const workspaces={normalizeEmail,
    listWorkspaces:async(db,userId)=>{calls.push(['list',userId]);return [];},
    inviteTechnician:async(db,body)=>{calls.push(['invite',body]);return {seat:1,token};},
    acceptTechnicianInvite:async(db,body)=>{calls.push(['accept',body]);return null;},
    revokeTechnician:async(db,body)=>{calls.push(['revoke',body]);return true;}
  };
  const handler=createTeamHandler({enabled:()=>enabled,authenticate:async()=>authenticated,pool:()=>({}),workspaces});
  return {calls,run:async(method,body)=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(x){this.body=x;return this;}};await handler({method,body,headers:{}},res);return res;}};
}
test('team operations are gated, authenticated and not cached',async()=>{
  const off=setup({enabled:false});assert.equal((await off.run('GET')).code,503);assert.deepEqual(off.calls,[]);
  const anonymous=setup({authenticated:null});assert.equal((await anonymous.run('GET')).code,401);
  const live=setup();const response=await live.run('GET');assert.equal(response.headers['Cache-Control'],'no-store');assert.deepEqual(live.calls,[['list',id]]);
});
test('owner identity comes only from the session, never from the request',async()=>{
  const f=setup();
  assert.equal((await f.run('POST',{action:'invite',teamId:team,email:' A@Example.com ',ownerId:team})).code,201);
  assert.deepEqual(f.calls[0],['invite',{teamId:team,ownerId:id,email:'a@example.com'}]);
  assert.equal((await f.run('DELETE',{teamId:team,seat:1,ownerId:team})).code,200);
  assert.deepEqual(f.calls[1],['revoke',{teamId:team,ownerId:id,seat:1}]);
});
test('invalid or unavailable invitations cannot succeed',async()=>{
  const f=setup();
  assert.equal((await f.run('POST',{action:'accept',teamId:team,token:'bad'})).code,400);
  assert.equal((await f.run('POST',{action:'accept',teamId:team,token})).code,404);
  assert.deepEqual(f.calls,[['accept',{teamId:team,userId:id,token}]]);
});
test('workspace list scopes the query to owner or member and redacts team roster for members',async()=>{
  const db={query:async(sql,args)=>{assert.deepEqual(args,[id]);assert.match(sql,/t.owner_user_id=\$1 OR EXISTS/);assert.match(sql,/s.technician_user_id=\$1/);assert.match(sql,/CASE WHEN t.owner_user_id=\$1/);assert.doesNotMatch(sql,/invite_hash/);return {rows:[]};}};
  assert.deepEqual(await listWorkspaces(db,id),[]);
});
