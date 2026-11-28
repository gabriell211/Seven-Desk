'use strict';
const {pool}=require('../lib/db-pool');
const {authenticatedUser}=require('../lib/server-auth');
const {personalEnabled,createPersonalHandler}=require('../lib/personal-plan');
module.exports=createPersonalHandler({enabled:()=>personalEnabled(),authenticate:authenticatedUser,pool});
