'use strict';
const {ready}=require('../lib/auth-handler');
module.exports=(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Método não permitido'});
  if(!ready())return res.status(503).json({error:'Serviço de conta indisponível'});
  return res.status(200).json({authUrl:new URL(process.env.SEVEN_SITE_URL).origin+'/api/auth'});
};
