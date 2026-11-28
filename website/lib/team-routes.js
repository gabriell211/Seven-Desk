'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&UUID.test(x);

function createTeamHandler({enabled,authenticate,pool,workspaces,activationEnabled=()=>false,issueActivation}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vary','Authorization');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(!enabled())return res.status(503).json({error:'Equipes indisponíveis'});
    if(!['GET','POST','DELETE'].includes(req.method))return res.status(405).json({error:'Método não permitido'});
    try{
      const userId=await authenticate(req.headers?.authorization);
      if(!validId(userId))return res.status(401).json({error:'Entre na sua conta'});
      const db=pool();
      if(req.method==='GET')return res.status(200).json({teams:await workspaces.listWorkspaces(db,userId),activationAvailable:activationEnabled()});
      const data=req.body;
      if(!data||!validId(data.teamId))return res.status(400).json({error:'Equipe inválida'});
      if(req.method==='DELETE'){
        if(!Number.isInteger(data.seat)||data.seat<1||data.seat>10)return res.status(400).json({error:'Vaga inválida'});
        const revoked=await workspaces.revokeTechnician(db,{teamId:data.teamId,ownerId:userId,seat:data.seat});
        return revoked?res.status(200).json({revoked:true}):res.status(404).json({error:'Vaga indisponível'});
      }
      if(data.action==='activate'){
        if(!activationEnabled())return res.status(503).json({error:'Ativação de equipes indisponível'});
        const pair=await issueActivation(db,{teamId:data.teamId,userId});
        return pair?res.status(201).json(pair):res.status(403).json({error:'Vaga ativa obrigatória'});
      }
      if(data.action==='invite'){
        let email;
        try{email=workspaces.normalizeEmail(data.email);}catch{return res.status(400).json({error:'E-mail inválido'});}
        const invite=await workspaces.inviteTechnician(db,{teamId:data.teamId,ownerId:userId,email});
        return res.status(201).json(invite);
      }
      if(data.action==='accept'){
        if(typeof data.token!=='string'||!/^sdi_[A-Za-z0-9_-]{43}$/.test(data.token))
          return res.status(400).json({error:'Convite inválido'});
        const accepted=await workspaces.acceptTechnicianInvite(db,{teamId:data.teamId,userId,token:data.token});
        return accepted?res.status(200).json({seat:accepted.seat}):res.status(404).json({error:'Convite indisponível'});
      }
      return res.status(400).json({error:'Ação inválida'});
    }catch(error){
      if(['Team unavailable','No seat available or invitation already exists'].includes(error?.message))
        return res.status(409).json({error:'Equipe ou vaga indisponível'});
      return res.status(503).json({error:'Não foi possível concluir a operação'});
    }
  };
}
module.exports={createTeamHandler};
