'use strict';
const TERMS_VERSION='personal-v1';
function personalEnabled(env=process.env){
  return env.SEVEN_PERSONAL_ENABLED==='1'&&env.SEVEN_ACCOUNT_STATUS_ENABLED==='1'&&env.SEVEN_LICENSE_API_ENABLED==='1';
}
// Only trusted, fixed column references are accepted.
function personalMembershipSql(account){
  if(!['$1','u.id','t.user_id','a.user_id'].includes(account))throw new Error('Invalid personal account expression');
  return `EXISTS (SELECT 1 FROM seven_desk_personal_enrollments pe
    JOIN seven_users pu ON pu.id=pe.user_id
    WHERE pe.user_id=${account} AND pe.revoked_at IS NULL
      AND pe.terms_version='personal-v1' AND pu."emailVerified" IS TRUE
      AND pu."accountType"='PF' AND pu."taxIdHash" IS NOT NULL)`;
}
async function enrollPersonal(db,userId){
  const result=await db.query(
    `INSERT INTO seven_desk_personal_enrollments(user_id,terms_version)
     SELECT id,$2 FROM seven_users WHERE id=$1 AND "emailVerified" IS TRUE
       AND "accountType"='PF' AND "taxIdHash" IS NOT NULL
     ON CONFLICT(user_id) DO UPDATE SET terms_version=EXCLUDED.terms_version,
       accepted_at=CASE WHEN seven_desk_personal_enrollments.revoked_at IS NULL
         THEN seven_desk_personal_enrollments.accepted_at ELSE now() END,
       revoked_at=NULL
     RETURNING user_id`,[userId,TERMS_VERSION]);
  return result.rows.length===1;
}
async function revokePersonal(db,userId){
  await db.query(`UPDATE seven_desk_personal_enrollments SET revoked_at=now()
    WHERE user_id=$1 AND revoked_at IS NULL`,[userId]);
}
function createPersonalHandler({enabled,authenticate,pool,enroll=enrollPersonal,revoke=revokePersonal}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Authorization');
    if(!enabled())return res.status(503).json({error:'Personal indisponível'});
    if(!['POST','DELETE'].includes(req.method))return res.status(405).json({error:'Método não permitido'});
    try{
      const userId=await authenticate(req.headers?.authorization);
      if(!userId)return res.status(401).json({error:'Entre na sua conta'});
      if(req.method==='DELETE'){await revoke(pool(),userId);return res.status(200).json({enrolled:false});}
      if(req.body?.acceptNonCommercial!==true||req.body?.termsVersion!==TERMS_VERSION)
        return res.status(400).json({error:'Aceite as condições de uso pessoal'});
      const accepted=await enroll(pool(),userId);
      return accepted?res.status(200).json({enrolled:true}):res.status(403).json({error:'Conta pessoal verificada obrigatória'});
    }catch{return res.status(503).json({error:'Personal indisponível'});}
  };
}
module.exports={TERMS_VERSION,personalEnabled,personalMembershipSql,enrollPersonal,revokePersonal,createPersonalHandler};
