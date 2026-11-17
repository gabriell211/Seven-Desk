'use strict';
let verifier;
async function authenticatedUser(header){
  if(typeof header!=='string'||!/^Bearer [^\s]+$/.test(header))return null;
  const url=new URL(process.env.SEVEN_SITE_URL);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Invalid site origin');
  if(!verifier){
    const {createRemoteJWKSet,jwtVerify}=await import('jose');
    const jwks=createRemoteJWKSet(new URL('/api/auth/jwks',url));
    const issuer=url.origin;
    verifier=async token=>jwtVerify(token,jwks,{
      issuer,audience:issuer,algorithms:['EdDSA','ES256'],requiredClaims:['sub','exp','iat']
    });
  }
  try{
    const {payload}=await verifier(header.slice(7));
    return typeof payload.sub==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)?payload.sub:null;
  }catch{return null;}
}
module.exports={authenticatedUser};
