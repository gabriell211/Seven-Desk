'use strict';

const {createHash, randomBytes}=require('node:crypto');

const TEAM_PLANS=Object.freeze({
  business:Object.freeze({amount:4990,seats:3}),
  enterprise:Object.freeze({amount:14990,seats:10}),
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE=/^sdi_[A-Za-z0-9_-]{43}$/;
const hash=token=>createHash('sha256').update(token).digest('hex');

function teamPlan(code){
  if(!Object.hasOwn(TEAM_PLANS,code))throw new Error('Invalid team plan');
  return TEAM_PLANS[code];
}
function normalizeEmail(value){
  if(typeof value!=='string')throw new Error('Invalid invitation email');
  const email=value.trim().toLowerCase();
  if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||email.split('@').length!==2)
    throw new Error('Invalid invitation email');
  return email;
}
function validId(value){return typeof value==='string'&&UUID.test(value);}

async function transaction(pool,work){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const value=await work(client);
    await client.query('COMMIT');
    return value;
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
}

// All mutations serialize on the team row. The caller obtains ownerId from
// a verified session; never from an untrusted body. The portal route is explicitly gated.
async function inviteTechnician(pool,{teamId,ownerId,email},random=randomBytes){
  if(!validId(teamId)||!validId(ownerId))throw new Error('Invalid team identity');
  const normalized=normalizeEmail(email);
  const token='sdi_'+random(32).toString('base64url');
  if(!INVITE.test(token))throw new Error('Invalid invitation generation');
  return transaction(pool,async db=>{
    const result=await db.query(
      `SELECT t.plan FROM seven_desk_teams t JOIN seven_users u ON u.id=t.owner_user_id
        WHERE t.id=$1 AND t.owner_user_id=$2 AND t.paid_through>now()
          AND u."emailVerified" IS TRUE FOR UPDATE OF t`,[teamId,ownerId]);
    if(!result.rows[0])throw new Error('Team unavailable');
    const {seats}=teamPlan(result.rows[0].plan);
    // Expired invitations do not permanently occupy seats.
    await db.query(`DELETE FROM seven_desk_team_seats WHERE team_id=$1 AND technician_user_id IS NULL AND invite_expires_at<=now()`,[teamId]);
    const inserted=await db.query(
      `INSERT INTO seven_desk_team_seats(team_id,seat,invited_email,invite_hash,invite_expires_at)
       SELECT $1, candidate.seat, $3, $4, LEAST(t.paid_through,now()+interval '7 days')
         FROM generate_series(1,$2::integer) AS candidate(seat)
         JOIN seven_desk_teams t ON t.id=$1
        WHERE NOT EXISTS (SELECT 1 FROM seven_desk_team_seats s WHERE s.team_id=$1 AND s.seat=candidate.seat)
          AND NOT EXISTS (SELECT 1 FROM seven_desk_team_seats s WHERE s.team_id=$1 AND s.invited_email=$3)
        ORDER BY candidate.seat LIMIT 1
       RETURNING seat,invite_expires_at`,[teamId,seats,normalized,hash(token)]);
    if(!inserted.rows[0])throw new Error('No seat available or invitation already exists');
    return {seat:inserted.rows[0].seat,expiresAt:inserted.rows[0].invite_expires_at,token};
  });
}

async function acceptTechnicianInvite(pool,{teamId,userId,token}){
  if(!validId(teamId)||!validId(userId)||typeof token!=='string'||!INVITE.test(token))return null;
  return transaction(pool,async db=>{
    const team=await db.query(
      'SELECT plan FROM seven_desk_teams WHERE id=$1 AND paid_through>now() FOR UPDATE',[teamId]);
    if(!team.rows[0])return null;
    const {seats}=teamPlan(team.rows[0].plan);
    const result=await db.query(
      `UPDATE seven_desk_team_seats s
          SET technician_user_id=u.id,accepted_at=now(),invite_hash=NULL,invite_expires_at=NULL
         FROM seven_users u
        WHERE s.team_id=$1 AND s.invite_hash=$2 AND s.invite_expires_at>now()
          AND s.technician_user_id IS NULL AND s.seat BETWEEN 1 AND $4
          AND u.id=$3 AND u."emailVerified" IS TRUE AND lower(trim(u.email))=s.invited_email
          AND NOT EXISTS (SELECT 1 FROM seven_desk_team_seats other WHERE other.team_id=$1 AND other.technician_user_id=$3)
        RETURNING s.seat`,[teamId,hash(token),userId,seats]);
    return result.rows[0]||null;
  });
}

async function revokeTechnician(pool,{teamId,ownerId,seat}){
  if(!validId(teamId)||!validId(ownerId)||!Number.isInteger(seat)||seat<1||seat>10)return false;
  return transaction(pool,async db=>{
    const team=await db.query(
      `SELECT t.id FROM seven_desk_teams t JOIN seven_users u ON u.id=t.owner_user_id
        WHERE t.id=$1 AND t.owner_user_id=$2 AND u."emailVerified" IS TRUE FOR UPDATE OF t`,[teamId,ownerId]);
    if(!team.rows[0])return false;
    const result=await db.query('DELETE FROM seven_desk_team_seats WHERE team_id=$1 AND seat=$2 RETURNING seat',[teamId,seat]);
    return result.rows.length===1;
  });
}

// Read-only membership policy, not an activation credential. Remote access
// must additionally authenticate and bind a device before this is exposed.
async function getTeamMembership(db,{teamId,userId}){
  if(!validId(teamId)||!validId(userId))return null;
  const result=await db.query(
    `SELECT t.id,t.plan,t.paid_through,s.seat FROM seven_desk_teams t
      JOIN seven_desk_team_seats s ON s.team_id=t.id
      JOIN seven_users u ON u.id=s.technician_user_id
      WHERE t.id=$1 AND s.technician_user_id=$2 AND u."emailVerified" IS TRUE
        AND t.paid_through>now() AND s.accepted_at IS NOT NULL
        AND s.seat BETWEEN 1 AND CASE t.plan WHEN 'business' THEN 3 WHEN 'enterprise' THEN 10 ELSE 0 END`,[teamId,userId]);
  return result.rows[0]||null;
}

async function listWorkspaces(db,userId){
  if(!validId(userId))return [];
  const result=await db.query(
    `SELECT t.id,t.plan,t.paid_through,t.owner_user_id=$1 AS is_owner,
       CASE WHEN t.owner_user_id=$1 THEN COALESCE((
         SELECT jsonb_agg(jsonb_build_object('seat',s.seat,'email',s.invited_email,
           'accepted',s.accepted_at IS NOT NULL,'expiresAt',s.invite_expires_at) ORDER BY s.seat)
         FROM seven_desk_team_seats s WHERE s.team_id=t.id
           AND (s.accepted_at IS NOT NULL OR s.invite_expires_at>now())
       ),'[]'::jsonb) ELSE '[]'::jsonb END AS technicians
       FROM seven_desk_teams t JOIN seven_users u ON u.id=$1 AND u."emailVerified" IS TRUE
       WHERE t.owner_user_id=$1 OR EXISTS (
          SELECT 1 FROM seven_desk_team_seats s WHERE s.team_id=t.id AND s.technician_user_id=$1
          AND s.accepted_at IS NOT NULL AND s.seat<=CASE t.plan WHEN 'business' THEN 3 WHEN 'enterprise' THEN 10 ELSE 0 END)
       ORDER BY t.created_at,t.id`,[userId]);
  return result.rows.map(row=>({id:row.id,plan:row.plan,paidThrough:row.paid_through,
    isOwner:row.is_owner,seatLimit:teamPlan(row.plan).seats,technicians:row.technicians}));
}

module.exports={listWorkspaces,TEAM_PLANS,teamPlan,normalizeEmail,inviteTechnician,acceptTechnicianInvite,revokeTechnician,getTeamMembership};
