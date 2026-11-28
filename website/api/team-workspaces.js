'use strict';
const {pool}=require('../lib/db-pool');
const {authenticatedUser}=require('../lib/server-auth');
const workspaces=require('../lib/team-workspaces');
const {createTeamHandler}=require('../lib/team-routes');
module.exports=createTeamHandler({
  enabled:()=>process.env.SEVEN_TEAM_WORKSPACES_ENABLED==='1'&&process.env.SEVEN_ACCOUNT_STATUS_ENABLED==='1',
  authenticate:authenticatedUser,pool,workspaces,
});
