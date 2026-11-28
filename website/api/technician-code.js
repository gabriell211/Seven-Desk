'use strict';
const {pool}=require('../lib/db-pool');
const {authenticatedUser}=require('../lib/server-auth');
const {makeTechnicianCode,technicianCodeHash,quotaSql}=require('../lib/technicians');

function createTechnicianCodeHandler({authenticate=authenticatedUser,db=pool,randomCode=makeTechnicianCode}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vary','Authorization');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
    if(process.env.SEVEN_ACCOUNT_STATUS_ENABLED!=='1'||
       process.env.SEVEN_LICENSE_API_ENABLED!=='1')
      return res.status(503).json({error:'Código indisponível'});
    const slot=req.body?.slot;
    if(!Number.isInteger(slot)||slot<1||slot>32767)
      return res.status(400).json({error:'Técnico inválido'});
    try{
      const userId=await authenticate(req.headers?.authorization);
      if(!userId)return res.status(401).json({error:'Entre na sua conta'});
      const technicianCode=randomCode();
      const hash=technicianCodeHash(technicianCode);
      if(!hash)throw new Error('Code generation');
      const result=await db().query(
        `WITH updated AS (
            UPDATE seven_desk_technicians t
              SET code_hash=$3,updated_at=now()
              FROM seven_users u
             WHERE t.user_id=$1 AND t.slot=$2 AND u.id=t.user_id
               AND u."emailVerified" IS TRUE
               AND t.slot BETWEEN 1 AND (${quotaSql("t.user_id")})
             RETURNING t.user_id,t.slot
          ), invalidated AS (
            UPDATE seven_desk_app_tokens a SET technician_verified=false
              FROM updated t
             WHERE a.user_id=t.user_id AND a.slot=t.slot
             RETURNING a.slot
          )
          SELECT slot FROM updated`,[userId,slot,hash],
      );
      if(!result.rows.length)return res.status(404).json({error:'Técnico não cadastrado'});
      return res.status(200).json({technicianCode});
    }catch{
      return res.status(503).json({error:'Não foi possível gerar o código'});
    }
  };
}
const handler=createTechnicianCodeHandler();
module.exports=handler;
module.exports.createTechnicianCodeHandler=createTechnicianCodeHandler;
