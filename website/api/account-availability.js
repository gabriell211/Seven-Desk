'use strict';
const {ready}=require('../lib/auth-handler');
module.exports=(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Método não permitido'});
  const enabled=ready();
  return res.status(200).json({loginEnabled:enabled,
    registrationEnabled:enabled&&process.env.SEVEN_REGISTRATION_ENABLED==='1',
    recoveryEnabled:enabled&&process.env.SEVEN_PASSWORD_RECOVERY_ENABLED==='1'});
};
