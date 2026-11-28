'use strict';

const {createHash,randomBytes}=require('node:crypto');
const TECH_CODE_RE=/^tec_[A-Za-z0-9_-]{32}$/;

function makeTechnicianCode(random=randomBytes){
  const code='tec_'+random(24).toString('base64url');
  if(!TECH_CODE_RE.test(code))throw new Error('Invalid technician code generation');
  return code;
}
function technicianCodeHash(code){
  if(!TECH_CODE_RE.test(code))return null;
  return createHash('sha256').update(code).digest('hex');
}
// All callers use the same SQL quota, including previously issued credentials.
function quotaSql(accountExpression) {
  // Only hard-coded SQL expressions from server modules may be passed here.
  if (!['$1', 't.user_id', 'a.user_id'].includes(accountExpression)) {
    throw new Error('Invalid quota expression');
  }
  return `5 + COALESCE((SELECT extra_slots FROM seven_desk_subscriptions WHERE user_id = ${accountExpression}),0)`;
}
async function getMaxSlots(db,userId){
  const result=await db.query(
    `SELECT ${quotaSql('$1')} AS max_slots`,
    [userId],
  );
  const slots=Number(result.rows[0]?.max_slots);
  if(!Number.isSafeInteger(slots)||slots<5||slots>32767)
    throw new Error('Invalid entitlement quota');
  return slots;
}
module.exports={TECH_CODE_RE,makeTechnicianCode,technicianCodeHash,getMaxSlots,quotaSql};
