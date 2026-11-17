'use strict';
const {pool}=require('./db-pool');
const {paymentCredentials}=require('./payment-secret');
const {authenticatedUser}=require('./server-auth');
const {createOrder,reconcilePayment}=require('./billing');
const {createCheckout}=require('./infinitepay');
const {createBillingHandlers}=require('./billing-routes');
const {isCheckoutReady}=require('./billing-readiness');
module.exports=createBillingHandlers({
  checkoutEnabled:()=>isCheckoutReady(),
  webhookEnabled:()=>process.env.SEVEN_WEBHOOK_ENABLED==='1'&&isCheckoutReady(),
  authenticate:authenticatedUser,pool,createOrder,createCheckout,reconcilePayment,
  config:()=>paymentCredentials(),
});
