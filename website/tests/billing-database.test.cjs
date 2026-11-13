'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createOrder, reconcilePayment, getEntitlement} = require('../lib/billing');

const userId='938add03-d4a9-4553-a2ca-0fb41a3403d8';
const orderId='17c12ec0-6ccd-46a8-b630-9999ac4153bf';

test('checkout only creates orders for email-verified identities', async()=>{
  const db={
    calls:[],
    async query(sql,args){
      this.calls.push([sql,args]);
      if(sql.startsWith('SELECT 1 FROM neon_auth')) return {rows:[]};
      return {rows:[]};
    },
  };
  await assert.rejects(createOrder(db,userId,'monthly'),/Verified account required/);
  assert.equal(db.calls.length,1);
  assert.match(db.calls[0][0],/"emailVerified" IS TRUE/);
  db.query=async function(sql,args){
    this.calls.push([sql,args]);
    if(sql.startsWith('SELECT 1 FROM neon_auth')) return {rows:[{'?column?':1}]};
    return {rows:[]};
  };
  const id=await createOrder(db,userId,'yearly');
  assert.match(id,/^[0-9a-f-]{36}$/);
  const last=db.calls.at(-1);
  assert.match(last[0],/INSERT INTO seven_desk_payment_orders/);
  assert.equal(last[1][1],userId);
  assert.equal(last[1][3],40000);
});

test('payment verification credits exactly once without locking read-only Neon Auth user rows',async()=>{
  const order={user_id:userId,plan:'monthly',amount_cents:3990,state:'pending',transaction_nsu:null,invoice_slug:null};
  const statements=[];
  let releaseCount=0;
  const db={
    async query(sql,args){statements.push(sql);
      if(sql.startsWith('SELECT user_id')) return {rows:[order]};
      throw new Error('Unexpected pool query');
    },
    async connect(){
      return {
        async query(sql,args){
          statements.push(sql);
          if(sql.startsWith('SELECT user_id')) return {rows:[order]};
          if(sql.startsWith('SELECT "createdAt"')) {
            assert.doesNotMatch(sql,/FOR UPDATE/i);
            assert.match(sql,/"emailVerified" IS TRUE/);
            return {rows:[{created_at:'2026-11-01T00:00:00Z'}]};
          }
          return {rows:[]};
        },
        release(){releaseCount++;}
      };
    }
  };
  const fakeFetch=async()=>({ok:true,json:async()=>({success:true,paid:true,amount:3990})});
  const credited=await reconcilePayment(db,{orderId,transactionId:'tx-123',slug:'inv-123'},{
    handle:'gabriel_1313',apiKey:'test',fetchImpl:fakeFetch,
  });
  assert.equal(credited,true);
  assert.equal(releaseCount,1);
  assert.equal(statements.filter(s=>s==='COMMIT').length,1);
  assert.equal(statements.some(s=>s.includes('INSERT INTO seven_desk_subscriptions')),true);
});

test('subscription status cannot be issued for an unverified email',async()=>{
  let sql;
  const db={query:async(query)=>{sql=query;return {rows:[]};}};
  assert.equal(await getEntitlement(db,userId),null);
  assert.match(sql,/"emailVerified" IS TRUE/);
});
