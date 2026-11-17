'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createRegistrationHandler}=require('../api/registration');
const {registrationIdentity,isValidCPF,isValidCNPJ}=require('../lib/registration');
process.env.SEVEN_SITE_URL='https://www.sevendesk.tech';
function response(){return {setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}}
const request=(data,origin='https://www.sevendesk.tech')=>({
  method:'POST',headers:{origin},body:{
    name:'Maria Teste',email:'maria@example.com',password:'senha-forte-123',
    accountType:'PF',document:'529.982.247-25',...data,
  },
});
test('PF validates check digits and does not accept repeated CPF digits',()=>{
  assert.equal(isValidCPF('52998224725'),true);
  assert.equal(isValidCPF('52998224726'),false);
  assert.equal(isValidCPF('11111111111'),false);
});
test('PJ validates both legacy numeric and 2026 alphanumeric CNPJ',()=>{
  assert.equal(isValidCNPJ('11222333000181'),true);
  assert.equal(isValidCNPJ('00000000000000'),false);
  // Generate two check digits independently for an alphanumeric example.
  const prefix='12ABC34501DE';
  const values=[...prefix].map(char=>char.charCodeAt(0)-48);
  const digit=(weights)=>{
    const sum=values.reduce((acc,n,i)=>acc+n*weights[i],0);
    const r=sum%11;return r<2?0:11-r;
  };
  values.push(digit([5,4,3,2,9,8,7,6,5,4,3,2]));
  values.push(digit([6,5,4,3,2,9,8,7,6,5,4,3,2]));
  assert.equal(isValidCNPJ(prefix+values.slice(12).join('')),true);
});
test('registration rejects malformed, cross-origin and expired signup gates',async()=>{
  let calls=0;
  const handler=createRegistrationHandler({enabled:()=>true,hash:()=> 'a'.repeat(64),signUp:async()=>{calls++;return {user:{emailVerified:false}}}});
  for(const data of [{document:'123'},{accountType:'PJ'},{password:'short'}]){
    const res=response();await handler(request(data),res);assert.equal(res.code,400);
  }
  const cross=response();await handler(request({},'https://evil.test'),cross);assert.equal(cross.code,403);
  assert.equal(calls,0);
  const unavailable=response();await createRegistrationHandler({enabled:()=>false})(request(),unavailable);
  assert.equal(unavailable.code,503);
});
test('sign-up persists only protected document digest, not raw CPF',async()=>{
  let seen;
  const handler=createRegistrationHandler({enabled:()=>true,hash:()=> 'b'.repeat(64),
    signUp:async body=>{seen=body;return {user:{emailVerified:false}}},
  });
  const res=response();await handler(request(),res);
  assert.equal(res.code,200);
  assert.equal(seen.accountType,'PF');
  assert.equal(seen.taxIdHash,'b'.repeat(64));
  assert.equal('document' in seen,false);
  assert.equal('taxIdHash' in res.body,false);
  assert.equal(registrationIdentity(request().body).document,'52998224725');
});
test('duplicate identity returns conflict without creating another trial',async()=>{
  const handler=createRegistrationHandler({enabled:()=>true,hash:()=> 'c'.repeat(64),
    signUp:async()=>{const e=new Error('duplicate key');e.code='23505';throw e},
  });
  const res=response();await handler(request(),res);assert.equal(res.code,409);
});
