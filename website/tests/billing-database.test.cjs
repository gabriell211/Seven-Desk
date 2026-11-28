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
      if(sql.startsWith('SELECT 1 FROM seven_users')) return {rows:[]};
      return {rows:[]};
    },
  };
  await assert.rejects(createOrder(db,userId,'monthly'),/Verified account required/);
  assert.equal(db.calls.length,1);
  assert.match(db.calls[0][0],/"emailVerified" IS TRUE/);
  db.query=async function(sql,args){
    this.calls.push([sql,args]);
    if(sql.startsWith('SELECT 1 FROM seven_users')) return {rows:[{'?column?':1}]};
    return {rows:[]};
  };
  const id=await createOrder(db,userId,'yearly');
  assert.match(id,/^[0-9a-f-]{36}$/);
  const last=db.calls.at(-1);
  assert.match(last[0],/INSERT INTO seven_desk_payment_orders/);
  assert.equal(last[1][1],userId);
  assert.equal(last[1][3],19990);
});

test('payment verification credits exactly once without locking restricted Better Auth user rows',async()=>{
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

test('trial is one calendar month tied to the same account and includes five slots',async()=>{
  const {getMaxSlots}=require('../lib/technicians');
  let queries=[];
  const db={
    async query(sql,args){
      queries.push(sql);
      if(sql.includes('seven_users u LEFT JOIN'))return {rows:[{
        trial_ends_at:'2026-12-17T12:00:00Z',
        access_ends_at:'2026-12-17T12:00:00Z',
        extra_slots:0,status:'trial',
      }]};
      if(sql.startsWith('SELECT 5 +'))return {rows:[{max_slots:5}]};
      throw new Error('Unexpected SQL');
    },
  };
  const first=await getEntitlement(db,userId);
  const second=await getEntitlement(db,userId);
  assert.equal(first.status,'trial');
  assert.equal(first.trial_ends_at,second.trial_ends_at);
  assert.equal(await getMaxSlots(db,userId),5);
  assert.equal(queries.filter(q=>q.includes("interval '1 month'")).length,2);
});

test('confirmed team payment provisions or renews only its own workspace once',async()=>{
  for(const [plan,amount] of [['business',4990],['enterprise',14990]]){
    const teamId='23dca358-ffb9-42b2-9d43-4df7631ec761';
    const order={user_id:userId,plan,amount_cents:amount,state:'pending',transaction_nsu:null,invoice_slug:null};
    const calls=[];
    const query=async(sql,args)=>{
      calls.push({sql,args});
      if(sql.startsWith('SELECT user_id'))return {rows:[order]};
      if(sql.startsWith('SELECT "createdAt"'))return {rows:[{created_at:'2026-11-01T00:00:00Z'}]};
      if(sql.includes('INSERT INTO seven_desk_teams'))return {rows:[{id:teamId}]};
      if(sql.includes("SET state = 'paid'")){order.state='paid';order.transaction_nsu=args[1];order.invoice_slug=args[2];}
      return {rows:[]};
    };
    const db={query,connect:async()=>({query,release(){}})};
    const event={orderId,transactionId:'tx-1',slug:'invoice-1'};
    const options={handle:'merchant',apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>({success:true,paid:true,amount})})};
    assert.equal(await reconcilePayment(db,event,options),true);
    assert.equal(await reconcilePayment(db,event,options),true);
    const credit=calls.filter(c=>c.sql.includes('INSERT INTO seven_desk_teams'));
    assert.equal(credit.length,1);
    assert.deepEqual(credit[0].args.slice(1),[userId,plan]);
    assert.match(credit[0].sql,/ON CONFLICT \(owner_user_id, plan\)/);
    assert.match(credit[0].sql,/GREATEST\(seven_desk_teams.paid_through, now\(\)\)/);
    assert.deepEqual(calls.find(c=>c.sql.includes('SET team_id')).args,[orderId,teamId]);
    assert.equal(calls.some(c=>c.sql.includes('INSERT INTO seven_desk_subscriptions')),false);
    assert.equal(calls.filter(c=>c.sql==='COMMIT').length,1);
  }
});
