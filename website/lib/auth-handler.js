'use strict';
let handlerPromise;
const allowedMethods=new Set(['GET','POST']);
function ready(env=process.env){
  return env.SEVEN_ACCOUNT_STATUS_ENABLED==='1'&&
    ['SEVEN_SITE_URL','SEVEN_DB_HOST','SEVEN_DB_NAME','SEVEN_DB_USER',
     'SEVEN_DB_PASSWORD_FILE','SEVEN_AUTH_SECRET_FILE','SEVEN_SMTP_PASSWORD_FILE'].every(k=>Boolean(env[k]));
}
function allowed(pathname,env=process.env){
  if(!ready(env))return false;
  if(pathname==='/api/auth/sign-up/email'&&env.SEVEN_REGISTRATION_ENABLED!=='1')return false;
  if(/^\/api\/auth\/email-otp\/(?:request-password-reset|reset-password)$/.test(pathname)&&env.SEVEN_PASSWORD_RECOVERY_ENABLED!=='1')return false;
  if(pathname==='/api/auth/email-otp/send-verification-otp'&&env.SEVEN_REGISTRATION_ENABLED!=='1')return false;
  return true;
}
async function handler(req,res,pathname){
  res.setHeader('Cache-Control','no-store');
  if(!allowedMethods.has(req.method))return res.status(405).json({error:'Método não permitido'});
  if(!allowed(pathname))return res.status(503).json({error:'Serviço de conta indisponível'});
  try{
    if(!handlerPromise)handlerPromise=(async()=>{
      const [{toNodeHandler},{auth}]=await Promise.all([
        import('better-auth/node'),import('./selfhost-auth.mjs')
      ]);
      return toNodeHandler(auth);
    })().catch(err=>{handlerPromise=null;throw err});
    return await(await handlerPromise)(req,res);
  }catch{
    if(!res.headersSent)return res.status(503).json({error:'Serviço de conta indisponível'});
    res.destroy();
  }
}
module.exports={handler,ready,allowed};
