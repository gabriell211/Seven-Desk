'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const root=resolve(__dirname,'../..');
const read=p=>readFileSync(resolve(root,p),'utf8');
test('Docker staging keeps PostgreSQL private and remote ports off until cutover',()=>{
  const compose=read('deploy/vps/compose.yml');
  assert.match(compose,/internal: true/);
  assert.doesNotMatch(compose,/['"]?5432:5432/);
  for(const profile of ['setup','cutover','signaling'])assert.match(compose,new RegExp('profiles: \\['+profile+'\\]'));
  for(const item of ['pg_password','app_db_password','auth_secret','smtp_password','infinitepay_api_key'])assert.match(compose,new RegExp('  '+item+':'));
  assert.match(compose,/SEVEN_BILLING_ENABLED: '0'/);
  assert.match(compose,/SEVEN_LICENSE_API_ENABLED: '0'/);
});
test('Dockerfile never copies the application secret store to its image',()=>{
  const docker=read('deploy/vps/Dockerfile.site');
  assert.match(docker,/USER node/);
  assert.match(docker,/COPY website\/db \.\/db/);
  const ignore=read('deploy/vps/Dockerfile.site.dockerignore');
  assert.match(ignore,/website\/\.env/);
  assert.match(ignore,/website\/secrets\//);
});
