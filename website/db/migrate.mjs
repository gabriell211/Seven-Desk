import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getMigrations} from 'better-auth/db/migration';
import {Pool} from 'pg';
import {createRequire} from 'node:module';
import {auth} from '../lib/selfhost-auth.mjs';
const require=createRequire(import.meta.url);
const {options}=require('../lib/db-pool.js');
const scripts=['001_billing.sql','002_app_tokens.sql','003_technician_slots.sql','004_extra_slots.sql','005_technician_profiles.sql','006_account_identity.sql','007_technicians.sql','008_technician_claim.sql','009_expand_activation_slots.sql','010_professional_pricing.sql','011_team_workspace.sql','012_team_billing.sql','013_team_activation.sql','014_single_activation.sql','015_personal_plan.sql'];
const db=new Pool(options());
const directory=path.dirname(fileURLToPath(import.meta.url));
let client;
try{
  const migrations=await getMigrations(auth.options);
  await migrations.runMigrations();
  client=await db.connect();
  // Transaction-level advisory lock prevents concurrent billing schema migration.
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('seven_desk_billing_migration'))");
  await client.query('CREATE TABLE IF NOT EXISTS seven_schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for(const file of scripts){
    const result=await client.query('SELECT version FROM seven_schema_migrations WHERE version=$1',[file]);
    if(result.rowCount)continue;
    const sql=await fs.readFile(path.join(directory,file),'utf8');
    await client.query(sql);
    await client.query('INSERT INTO seven_schema_migrations(version) VALUES($1)',[file]);
  }
  // The web process uses a restricted, non-DDL PostgreSQL role.
  const appPasswordFile=process.env.SEVEN_RUNTIME_DB_PASSWORD_FILE;
  if(!appPasswordFile)throw new Error('Runtime DB password file missing');
  const appPassword=(await fs.readFile(appPasswordFile,'utf8')).trim();
  if(appPassword.length<24)throw new Error('Invalid runtime database password');
  const role=(await client.query("SELECT 1 FROM pg_roles WHERE rolname='sevendesk_app'")).rows;
  if(role.length===0)await client.query('CREATE ROLE sevendesk_app LOGIN');
  const quoted=(await client.query('SELECT quote_literal($1::text) AS literal',[appPassword])).rows[0].literal;
  await client.query('ALTER ROLE sevendesk_app PASSWORD '+quoted);
  await client.query('GRANT USAGE ON SCHEMA public TO sevendesk_app');
  await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sevendesk_app');
  await client.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sevendesk_app');
  await client.query('COMMIT');
  process.stdout.write('Seven Desk auth/billing schema ready\\n');
}catch(error){
  if(client)await client.query('ROLLBACK').catch(()=>{});
  process.stderr.write('Migration failed; inspect Postgres logs and retry before cutover\\n');
  process.exitCode=1;
}finally{client?.release();await db.end();}
