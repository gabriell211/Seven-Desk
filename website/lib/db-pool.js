'use strict';
const fs=require('node:fs');
const {Pool}=require('pg');
let database;
function options(env=process.env){
  const required=['SEVEN_DB_HOST','SEVEN_DB_NAME','SEVEN_DB_USER','SEVEN_DB_PASSWORD_FILE'];
  if(required.some(key=>!env[key]))throw new Error('PostgreSQL local não configurado');
  const password=fs.readFileSync(env.SEVEN_DB_PASSWORD_FILE,'utf8').trim();
  if(password.length<24)throw new Error('Senha do banco inválida');
  return {host:env.SEVEN_DB_HOST,port:Number(env.SEVEN_DB_PORT||5432),
    database:env.SEVEN_DB_NAME,user:env.SEVEN_DB_USER,password,
    max:8,connectionTimeoutMillis:5000,idleTimeoutMillis:10000};
}
function pool(){if(!database)database=new Pool(options());return database;}
module.exports={pool,options};
