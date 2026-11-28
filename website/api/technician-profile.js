'use strict';

const {pool}=require('../lib/db-pool');
const {authenticatedUser}=require('../lib/server-auth');
const {getMaxSlots}=require('../lib/technicians');

function createTechnicianProfileHandler({authenticate=authenticatedUser,db=pool}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vary','Authorization');
    if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
    if(process.env.SEVEN_ACCOUNT_STATUS_ENABLED!=='1'||
       process.env.SEVEN_LICENSE_API_ENABLED!=='1')
      return res.status(503).json({error:'Perfil indisponível'});
    const slot=req.body?.slot;
    const name=typeof req.body?.name==='string'?req.body.name.trim():'';
    if(!Number.isInteger(slot)||slot<1||slot>32767||name.length<2||
       name.length>100||/[\x00-\x1f\x7f]/.test(name))
      return res.status(400).json({error:'Informe um nome válido de até 100 caracteres'});
    try{
      const userId=await authenticate(req.headers?.authorization);
      if(!userId)return res.status(401).json({error:'Entre na sua conta'});
      const connection=db();
      if(slot>await getMaxSlots(connection,userId))
        return res.status(400).json({error:'Vaga de técnico indisponível'});
      const result=await connection.query(
        `INSERT INTO seven_desk_technicians
          (user_id,slot,technician_name,code_hash)
         SELECT id,$2,$3,NULL FROM seven_users
          WHERE id=$1 AND "emailVerified" IS TRUE
         ON CONFLICT (user_id,slot) DO UPDATE SET
           technician_name=EXCLUDED.technician_name,updated_at=now()
         RETURNING technician_name,technician_image`,
        [userId,slot,name],
      );
      if(!result.rows.length)return res.status(403).json({error:'Confirme seu e-mail'});
      const row=result.rows[0];
      return res.status(200).json({
        name:row.technician_name,image:row.technician_image,
      });
    }catch{
      return res.status(503).json({error:'Não foi possível salvar o técnico'});
    }
  };
}
const handler=createTechnicianProfileHandler();
module.exports=handler;
module.exports.createTechnicianProfileHandler=createTechnicianProfileHandler;
