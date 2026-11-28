'use strict';
const {createHash,randomBytes}=require('node:crypto');
const {allowedActivation,newTokenPrefix}=require('./activation-policy');
const {technicianCodeHash}=require('./technicians');
const hash=value=>createHash('sha256').update(value).digest('hex');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&UUID.test(x);

function teamLicenseEnabled(env=process.env){
  return env.SEVEN_ACCOUNT_STATUS_ENABLED==='1' && env.SEVEN_LICENSE_API_ENABLED==='1' &&
    env.SEVEN_TEAM_WORKSPACES_ENABLED==='1' && env.SEVEN_TEAM_LICENSE_ENABLED==='1';
}
// Fixed SQL fragments, never derived from request data.
const activeMembership=`s.accepted_at IS NOT NULL AND t.paid_through>now()
 AND u."emailVerified" IS TRUE AND s.seat BETWEEN 1 AND CASE t.plan WHEN 'business' THEN 3 WHEN 'enterprise' THEN 10 ELSE 0 END`;
const joinedActivation=`a.team_id=s.team_id AND a.seat=s.seat
 AND t.id=s.team_id AND u.id=s.technician_user_id AND ${activeMembership}`;

async function issueTeamActivation(db,{teamId,userId},random=randomBytes){
  if(!validId(teamId)||!validId(userId))return null;
  const token=newTokenPrefix()+random(32).toString('base64url');
  if(!allowedActivation(token))throw new Error('Invalid generated credential');
  const result=await db.query(
    `WITH member AS (
      SELECT s.team_id,s.seat FROM seven_desk_team_seats s
      JOIN seven_desk_teams t ON t.id=s.team_id
      JOIN seven_users u ON u.id=s.technician_user_id
      WHERE s.team_id=$1 AND s.technician_user_id=$2 AND ${activeMembership}
      FOR UPDATE OF s
    )
    INSERT INTO seven_desk_team_activations (team_id,seat,token_hash,technician_hash,technician_verified)
    SELECT team_id,seat,$3,NULL,true FROM member
    ON CONFLICT (team_id,seat) DO UPDATE SET token_hash=EXCLUDED.token_hash,
      technician_hash=NULL,technician_verified=true,device_hash=NULL,created_at=now()
    RETURNING seat`,[teamId,userId,hash(token)]);
  return result.rows.length===1?{token}:null;
}

async function claimTeamDevice(db,token,code){
  if(!allowedActivation(token)||typeof code!=='string')return false;
  const digest=technicianCodeHash(code);
  if(!digest)return false;
  const result=await db.query(
    `UPDATE seven_desk_team_activations a SET technician_verified=true
      FROM seven_desk_team_seats s,seven_desk_teams t,seven_users u
      WHERE a.token_hash=$1 AND a.technician_hash=$2 AND ${joinedActivation}
      RETURNING a.seat`,[hash(token),digest]);
  return result.rows.length===1;
}

function parseBearer(header,deviceRequired){
  const parts=typeof header==='string'&&header.startsWith('Bearer ')?header.slice(7).split(':'):[];
  if(parts.length!==(deviceRequired?2:1)||!allowedActivation(parts[0]))return null;
  if(deviceRequired&&!/^[a-f0-9]{64}$/.test(parts[1]))return null;
  return parts;
}
async function authorizeTeamDevice(db,header){
  const parts=parseBearer(header,true);
  if(!parts)return null;
  const result=await db.query(
    `UPDATE seven_desk_team_activations a SET device_hash=COALESCE(a.device_hash,$2)
      FROM seven_desk_team_seats s,seven_desk_teams t,seven_users u
      WHERE a.token_hash=$1 AND a.technician_verified IS TRUE AND ${joinedActivation}
        AND (a.device_hash IS NULL OR a.device_hash=$2)
      RETURNING t.id AS team_id,u.id AS user_id,t.paid_through`,[hash(parts[0]),parts[1]]);
  return result.rows[0]||null;
}
async function getTeamDeviceProfile(db,header){
  const parts=parseBearer(header,false);
  if(!parts)return null;
  const result=await db.query(
    `SELECT u.name,u.image,owner.name AS company_name FROM seven_desk_team_activations a
     JOIN seven_desk_team_seats s ON a.team_id=s.team_id AND a.seat=s.seat
     JOIN seven_desk_teams t ON t.id=s.team_id
     JOIN seven_users u ON u.id=s.technician_user_id
     JOIN seven_users owner ON owner.id=t.owner_user_id
     WHERE a.token_hash=$1 AND a.technician_verified IS TRUE AND ${activeMembership}`,[hash(parts[0])]);
  const p=result.rows[0];
  return p?{name:p.name||'',image:p.image||'',companyName:p.company_name||'',deviceLabel:'Computador da equipe'}:null;
}
module.exports={teamLicenseEnabled,issueTeamActivation,claimTeamDevice,authorizeTeamDevice,getTeamDeviceProfile};
