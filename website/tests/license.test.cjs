'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLicenseHandler } = require('../lib/license-routes');

function res(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(x){this.body=x;return this;}}}
const userId = 'bbde939e-b2c5-45f5-9dc0-6645f59d78cf';
const until='2026-12-01T00:00:00.000Z';
const now=()=>Date.parse('2026-11-13T00:00:00Z');
function handler({enabled=true,user=userId,entitlement={status:'trial',access_ends_at:until}}={}) {
  return createLicenseHandler({enabled:()=>enabled,authenticate:async()=>user,pool:()=>({}),
    getEntitlement:async()=>entitlement, now});
}
function req(method='GET'){return {method,headers:{authorization:'Bearer test'}}}

test('license check is disabled unless server-side launch flag is enabled',async()=>{
  const x=res(); await handler({enabled:false})(req(),x);
  assert.equal(x.code,503);
  assert.equal(x.headers['Cache-Control'],'no-store');
  assert.equal(x.headers['Vary'],'Authorization');
});
test('only authenticated verified accounts receive an access decision',async()=>{
  const a=res();await handler({user:null})(req(),a);assert.equal(a.code,401);
  const b=res();await handler({entitlement:null})(req(),b);assert.equal(b.code,403);
  assert.equal(b.body.allowed,false);
  const c=res();await handler()(req('POST'),c);assert.equal(c.code,405);
});
test('trial and paid only authorize until a future expiry',async()=>{
  for(const status of ['trial','paid']) {
    const a=res();await handler({entitlement:{status,access_ends_at:until}})(req(),a);
    assert.equal(a.code,200);assert.equal(a.body.allowed,true);assert.equal(a.body.accountId,userId);
  }
  for(const entitlement of [
    {status:'expired',access_ends_at:until},
    {status:'paid',access_ends_at:'2026-11-01T00:00:00.000Z'},
    {status:'trial',access_ends_at:'garbage'},
  ]) {
    const a=res();await handler({entitlement})(req(),a);assert.equal(a.code,403);assert.equal(a.body.allowed,false);
  }
});
