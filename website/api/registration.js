'use strict';

const {registrationIdentity,documentHash}=require('../lib/registration');
const {ready}=require('../lib/auth-handler');

function createRegistrationHandler({signUp,hash=documentHash,enabled=()=>ready()&&
  process.env.SEVEN_REGISTRATION_ENABLED==='1'}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vary','Origin');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
    if(!enabled())return res.status(503).json({error:'Cadastro temporariamente indisponível'});
    const origin=req.headers?.origin;
    if(origin){
      let expected;
      try{expected=new URL(process.env.SEVEN_SITE_URL).origin}
      catch{return res.status(503).json({error:'Cadastro indisponível'});}
      if(origin!==expected)return res.status(403).json({error:'Origem inválida'});
    }
    const candidate=registrationIdentity(req.body);
    if(!candidate)return res.status(400).json({error:'Informe dados PF/PJ válidos e senha com 12 caracteres ou mais'});
    try {
      const taxIdHash=hash(candidate.accountType,candidate.document,process.env.SEVEN_AUTH_SECRET_FILE);
      const {name,email,password,accountType}=candidate;
      const result=await signUp({name,email,password,accountType,taxIdHash});
      return res.status(200).json({user:{emailVerified:result?.user?.emailVerified===true}});
    }catch(error){
      // Database unique index prevents concurrent CPF/CNPJ reuse.
      const message=String(error?.message||'');
      if(error?.code==='23505' || /unique|already exists|duplicate/i.test(message))
        return res.status(409).json({error:'Já existe cadastro com esses dados',code:'ALREADY_REGISTERED'});
      return res.status(503).json({error:'Não foi possível criar a conta'});
    }
  };
}
const handler=createRegistrationHandler({
  signUp:async body=>{
    const {auth}=await import('../lib/selfhost-auth.mjs');
    return auth.api.signUpEmail({body});
  },
});
module.exports=handler;
module.exports.createRegistrationHandler=createRegistrationHandler;
