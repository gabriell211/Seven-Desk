'use strict';
// Legacy claims remain accepted for previously issued pairs. No new secondary
// technician credential may be issued or rotated.
const {authenticatedUser}=require('../lib/server-auth');
function createTechnicianCodeHandler({authenticate=authenticatedUser}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vary','Authorization');
    if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
    try{
      if(!await authenticate(req.headers?.authorization))return res.status(401).json({error:'Entre na sua conta'});
      return res.status(410).json({error:'Gere uma chave única de ativação na Visão geral.'});
    }catch{return res.status(503).json({error:'Serviço indisponível'});}
  };
}
module.exports=createTechnicianCodeHandler();
module.exports.createTechnicianCodeHandler=createTechnicianCodeHandler;
