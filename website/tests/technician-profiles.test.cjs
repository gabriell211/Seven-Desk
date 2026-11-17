'use strict';

const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtemp,readFile,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {technicianCodeHash}=require('../lib/technicians');

const userId='bbde939e-b2c5-45f5-9dc0-6645f59d78cf';
const token='sd_'+'a'.repeat(43);
let person=null;
let avatarDirectory=null;
const db={
  async query(sql,params){
    if(sql.startsWith('SELECT 5 +'))return {rows:[{max_slots:5}]};
    if(sql.includes('INSERT INTO seven_desk_technicians')){
      if(params[0]!==userId||params[1]!==1)return {rows:[],rowCount:0};
      if(!person)person={slot:1,technician_name:params[2],technician_image:'',
        code_hash:params[3],label:'Notebook do suporte'};
      else person.technician_name=params[2];
      return {rows:[{...person}],rowCount:1};
    }
    if(sql.includes('UPDATE seven_desk_technicians t')){
      if(params[0]!==userId||params[1]!==1||!person)return {rows:[],rowCount:0};
      person.code_hash=params[2];
      return {rows:[{slot:1}],rowCount:1};
    }
    if(sql.startsWith('SELECT 1 FROM seven_desk_technicians t')){
      return {rows:person&&params[0]===userId&&params[1]===1?[{}]:[],
        rowCount:person&&params[0]===userId&&params[1]===1?1:0};
    }
    if(sql.startsWith('UPDATE seven_desk_technicians SET technician_image')){
      if(!person||params[0]!==userId||params[1]!==1)return {rows:[],rowCount:0};
      person.technician_image=params[2];
      return {rows:[{slot:1}],rowCount:1};
    }
    if(sql.startsWith('SELECT u.name AS account_name')){
      if(!person||params[0]!==userId||params[1]!=='hashed-device-token')
        return {rows:[]};
      return {rows:[{
        account_name:'Seven Suporte',account_image:'',
        technician_name:person.technician_name,
        technician_image:person.technician_image,
        device_label:person.label,
      }]};
    }
    throw new Error('Unexpected SQL in technician profile test: '+sql.slice(0,95));
  },
};
function mock(name,exports){
  const id=require.resolve(name);
  require.cache[id]={id,filename:id,loaded:true,exports};
}
mock('../lib/db-pool',{pool:()=>db});
mock('../lib/server-auth',{authenticatedUser:async auth=>
  auth==='Bearer signed-session'?userId:null});
mock('../lib/app-tokens',{
  appTokenUser:async (_db,authorization)=>authorization==='Bearer '+token?userId:null,
  tokenHash:()=> 'hashed-device-token',
});
const technician=require('../api/technician-profile');
const code=require('../api/technician-code');
const upload=require('../api/technician-photo');
const appProfile=require('../api/app-profile');
process.env.SEVEN_ACCOUNT_STATUS_ENABLED='1';
process.env.SEVEN_LICENSE_API_ENABLED='1';
process.env.SEVEN_SITE_URL='https://www.sevendesk.tech';

const response=()=>({headers:{},
  setHeader(k,v){this.headers[k]=v},
  status(value){this.code=value;return this},
  json(body){this.body=body;return this},
});
function request(method,auth='Bearer signed-session',extra={}){
  return {method,headers:{authorization:auth,'content-type':'application/json'},
    body:{slot:1,name:'Beatriz Lima'},...extra};
}
after(async()=>{if(avatarDirectory)await rm(avatarDirectory,{recursive:true,force:true})});

test('only a signed-in account can create a technician within its 5 free slots',async()=>{
  const rejected=response();
  await technician(request('POST',''),rejected);
  assert.equal(rejected.code,401);
  const invalid=response();
  await technician(request('POST',undefined,{body:{slot:1,name:'\\n'}}),invalid);
  assert.equal(invalid.code,400);
  const outside=response();
  await technician(request('POST',undefined,{body:{slot:6,name:'Invasor'}}),outside);
  assert.equal(outside.code,400);
  const created=response();
  await technician(request('POST'),created);
  assert.equal(created.code,200);
  assert.equal(created.body.name,'Beatriz Lima');
  assert.match(created.body.technicianCode,/^tec_[A-Za-z0-9_-]{32}$/);
  assert.notEqual(created.body.technicianCode,token);
  assert.equal(person.code_hash,technicianCodeHash(created.body.technicianCode));
});
test('editing a technician does not rotate or re-expose its one-time code',async()=>{
  const before=person.code_hash;
  const edited=response();
  await technician(request('POST',undefined,{body:{slot:1,name:'Maria Suporte'}}),edited);
  assert.equal(edited.code,200);
  assert.equal(edited.body.name,'Maria Suporte');
  assert.equal('technicianCode' in edited.body,false);
  assert.equal(person.code_hash,before);
});
test('owner can rotate technician code without altering device activation',async()=>{
  const previous=person.code_hash;
  const denied=response();
  await code(request('POST',''),denied);
  assert.equal(denied.code,401);
  const rotated=response();
  await code(request('POST'),rotated);
  assert.equal(rotated.code,200);
  assert.match(rotated.body.technicianCode,/^tec_[A-Za-z0-9_-]{32}$/);
  assert.notEqual(person.code_hash,previous);
  const missing=response();
  await code(request('POST',undefined,{body:{slot:2}}),missing);
  assert.equal(missing.code,404);
});
test('activation resolves the technician profile separately from the company',async()=>{
  const accepted=response();
  await appProfile(request('GET','Bearer '+token),accepted);
  assert.equal(accepted.code,200);
  assert.equal(accepted.body.name,'Maria Suporte');
  assert.equal(accepted.body.companyName,'Seven Suporte');
  assert.equal(accepted.body.deviceLabel,'Notebook do suporte');
  assert.equal('technicianCode' in accepted.body,false);
  const rejected=response();
  await appProfile(request('GET','Bearer another'),rejected);
  assert.equal(rejected.code,401);
});
test('technician photo requires ownership and accepts PNG without leaking code',async()=>{
  avatarDirectory=await mkdtemp(path.join(tmpdir(),'seven-technician-'));
  process.env.SEVEN_AVATAR_DIR=avatarDirectory;
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
  const options={headers:{authorization:'Bearer signed-session','content-type':'image/png'},query:{slot:'1'},body:png};
  const unauthorized=response();
  await upload(request('POST',undefined,{...options,headers:{...options.headers,authorization:''}}),unauthorized);
  assert.equal(unauthorized.code,401);
  const notOwned=response();
  await upload(request('POST',undefined,{...options,query:{slot:'2'}}),notOwned);
  assert.equal(notOwned.code,404);
  const malformed=response();
  await upload(request('POST',undefined,{...options,body:Buffer.alloc(15)}),malformed);
  assert.equal(malformed.code,400);
  const good=response();
  await upload(request('POST',undefined,options),good);
  assert.equal(good.code,200);
  assert.equal(good.body.url,
    `https://www.sevendesk.tech/avatars/${userId}/technician-1.png`);
  assert.deepEqual(await readFile(path.join(avatarDirectory,userId,'technician-1.png')),png);
  assert.equal(person.technician_image,good.body.url);
});
