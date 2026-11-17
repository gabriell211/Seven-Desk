'use strict';

const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {mkdtemp, readFile, rm} = require('node:fs/promises');
const {tmpdir} = require('node:os');
const path = require('node:path');

const userId = 'bbde939e-b2c5-45f5-9dc0-6645f59d78cf';
const token = 'sd_' + 'a'.repeat(43);
let saved = {slot:1, label:'Notebook do suporte',
  technician_name:'Ana Oliveira',technician_image:''};
let avatarDirectory;

const db = {
  async query(sql, params) {
    if (sql.startsWith('UPDATE seven_desk_app_tokens SET technician_name')) {
      if (params[0] !== userId || params[1] !== 1) return {rowCount:0,rows:[]};
      saved.technician_name = params[2];
      return {rowCount:1,rows:[saved]};
    }
    if (sql.startsWith('UPDATE seven_desk_app_tokens SET technician_image')) {
      if (params[0] !== userId || params[1] !== 1) return {rowCount:0,rows:[]};
      saved.technician_image = params[2];
      return {rowCount:1,rows:[saved]};
    }
    if (sql.startsWith('SELECT 1 FROM seven_desk_app_tokens t')) {
      return {rowCount:params[0] === userId && params[1] === 1 ? 1 : 0, rows:[{}]};
    }
    if (sql.startsWith('SELECT u.name AS account_name')) {
      if (params[0] !== userId || params[1] !== 'hashed-device-token')
        return {rows:[]};
      return {rows:[{account_name:'Seven Suporte',account_image:'',
        technician_name:saved.technician_name,technician_image:saved.technician_image,
        device_label:saved.label}]};
    }
    throw new Error('Unexpected SQL query in technician profile test');
  },
};
const mock = (filename,exports) => {
  const id = require.resolve(filename);
  require.cache[id] = {id,filename:id,loaded:true,exports};
};
mock('../lib/db-pool',{pool:()=>db});
mock('../lib/server-auth',{
  authenticatedUser:async authorization =>
    authorization === 'Bearer signed-session' ? userId : null,
});
mock('../lib/app-tokens',{
  appTokenUser:async (_db,authorization) =>
    authorization === 'Bearer '+token ? userId : null,
  tokenHash:()=> 'hashed-device-token',
});

const technician = require('../api/technician-profile');
const upload = require('../api/technician-photo');
const appProfile = require('../api/app-profile');

function response() {
  return {
    headers:{},setHeader(k,v){this.headers[k]=v;},
    status(code){this.code=code;return this;},
    json(body){this.body=body;return this;},
  };
}
function request(method, auth = 'Bearer signed-session', extra = {}) {
  return {method,headers:{authorization:auth,'content-type':'application/json'},body:{slot:1,name:'Beatriz Lima'},...extra};
}
process.env.SEVEN_ACCOUNT_STATUS_ENABLED='1';
process.env.SEVEN_LICENSE_API_ENABLED='1';
process.env.SEVEN_SITE_URL='https://www.sevendesk.tech';
after(async()=>{if(avatarDirectory)await rm(avatarDirectory,{recursive:true,force:true});});

test('only the authenticated account can edit a technician name',async()=>{
  const invalid=response();
  await technician(request('POST','',{body:{slot:1,name:'Invasor'}}),invalid);
  assert.equal(invalid.code,401);
  const malformed=response();
  await technician(request('POST',undefined,{body:{slot:1,name:'\n'}}),malformed);
  assert.equal(malformed.code,400);
  const wrongDevice=response();
  await technician(request('POST',undefined,{body:{slot:5,name:'Beatriz'}}),wrongDevice);
  assert.equal(wrongDevice.code,404);
  const success=response();
  await technician(request('POST'),success);
  assert.equal(success.code,200);
  assert.equal(success.body.name,'Beatriz Lima');
});

test('app activation resolves the matching technician, not the company avatar',async()=>{
  const accepted=response();
  await appProfile(request('GET','Bearer '+token),accepted);
  assert.equal(accepted.code,200);
  assert.equal(accepted.body.name,'Beatriz Lima');
  assert.equal(accepted.body.companyName,'Seven Suporte');
  assert.equal(accepted.body.deviceLabel,'Notebook do suporte');
  const rejected=response();
  await appProfile(request('GET','Bearer another'),rejected);
  assert.equal(rejected.code,401);
});

test('photo upload validates ownership and format then updates the VPS profile',async()=>{
  avatarDirectory=await mkdtemp(path.join(tmpdir(),'seven-technician-'));
  process.env.SEVEN_AVATAR_DIR=avatarDirectory;
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
  const options={headers:{authorization:'Bearer signed-session','content-type':'image/png'},
    query:{slot:'1'},body:png};
  const bad=response();
  await upload(request('POST','',options),bad);
  assert.equal(bad.code,401);
  const notOwned=response();
  await upload(request('POST',undefined,{...options,query:{slot:'2'}}),notOwned);
  assert.equal(notOwned.code,404);
  const format=response();
  await upload(request('POST',undefined,{...options,body:Buffer.alloc(15)}),format);
  assert.equal(format.code,400);
  const ok=response();
  await upload(request('POST',undefined,options),ok);
  assert.equal(ok.code,200);
  assert.equal(ok.body.url,
    `https://www.sevendesk.tech/avatars/${userId}/technician-1.png`);
  assert.deepEqual(await readFile(path.join(avatarDirectory,userId,'technician-1.png')),png);
  assert.equal(saved.technician_image,ok.body.url);
});
