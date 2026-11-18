'use strict';

const {pool}=require('../lib/db-pool');
const {technicianCodeHash}=require('../lib/technicians');
const {tokenHash}=require('../lib/app-tokens');

const {allowedActivation}=require('../lib/activation-policy');
function createTechnicianClaimHandler({db=pool}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
    if(process.env.SEVEN_ACCOUNT_STATUS_ENABLED!=='1'||
       process.env.SEVEN_LICENSE_API_ENABLED!=='1')
      return res.status(503).json({error:'Validação indisponível'});
    const activation=req.body?.activationToken;
    const technician=req.body?.technicianCode;
    if(typeof activation!=='string'||!allowedActivation(activation) ||
       typeof technician!=='string'||!technicianCodeHash(technician))
      return res.status(400).json({error:'Informe os dois códigos válidos'});
    try{
      const result=await db().query(
        `UPDATE seven_desk_app_tokens a
            SET technician_verified=true
           FROM seven_desk_technicians t, seven_users u
          WHERE a.token_hash=$1 AND t.code_hash=$2
            AND t.user_id=a.user_id AND t.slot=a.slot
            AND u.id=a.user_id AND u."emailVerified" IS TRUE
          RETURNING a.user_id`,
        [tokenHash(activation),technicianCodeHash(technician)],
      );
      if(!result.rows.length)
        return res.status(401).json({error:'Códigos não correspondem ao mesmo técnico'});
      return res.status(200).json({verified:true});
    }catch{
      return res.status(503).json({error:'Não foi possível vincular o técnico'});
    }
  };
}
const handler=createTechnicianClaimHandler();
module.exports=handler;
module.exports.createTechnicianClaimHandler=createTechnicianClaimHandler;
