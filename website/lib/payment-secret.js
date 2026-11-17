'use strict';
const fs=require('node:fs');
function paymentCredentials(env=process.env){
  const filename=env.INFINITEPAY_API_KEY_FILE;
  if(!filename)throw new Error('Payment credentials not available');
  const apiKey=fs.readFileSync(filename,'utf8').trim();
  if(apiKey.length<16)throw new Error('Payment credentials missing');
  return {apiKey,handle:env.INFINITEPAY_HANDLE,siteUrl:env.SEVEN_SITE_URL};
}
module.exports={paymentCredentials};
