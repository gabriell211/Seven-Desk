'use strict';

const fs=require('node:fs');
const {createHmac}=require('node:crypto');

function normalizeDocument(value){
  if(typeof value!=='string'||value.length>40)return '';
  return value.toUpperCase().replace(/[.\-/\s]/g,'');
}
function isValidCPF(document){
  if(!/^\d{11}$/.test(document)||/^(\d)\1{10}$/.test(document))return false;
  const digit=(length)=>{
    let sum=0;
    for(let i=0;i<length;i++)sum+=Number(document[i])*(length+1-i);
    const remainder=(sum*10)%11;
    return remainder===10?0:remainder;
  };
  return digit(9)===Number(document[9])&&digit(10)===Number(document[10]);
}
function isValidCNPJ(document){
  // As of July 2026, Receita Federal issues alphanumeric CNPJs as well.
  if(!/^[0-9A-Z]{12}[0-9]{2}$/.test(document) ||
     /^(.)\1{13}$/.test(document)) return false;
  const values=[...document].map(ch=>ch.charCodeAt(0)-48);
  const check=(length,weights)=>{
    const sum=values.slice(0,length).reduce((acc,n,i)=>acc+n*weights[i],0);
    const r=sum%11;
    return r<2?0:11-r;
  };
  return check(12,[5,4,3,2,9,8,7,6,5,4,3,2])===values[12] &&
    check(13,[6,5,4,3,2,9,8,7,6,5,4,3,2])===values[13];
}
function registrationIdentity(data){
  if(!data||!['PF','PJ'].includes(data.accountType))return null;
  const document=normalizeDocument(data.document);
  if(!(data.accountType==='PF'?isValidCPF(document):isValidCNPJ(document)))return null;
  const name=typeof data.name==='string'?data.name.trim():'';
  const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
  if(name.length<2||name.length>100||/[\x00-\x1f\x7f]/.test(name)||
     email.length>254||!/^\S+@\S+\.\S+$/.test(email)||
     typeof data.password!=='string'||data.password.length<12||data.password.length>128)
    return null;
  return {name,email,password:data.password,accountType:data.accountType,document};
}
function documentHash(accountType,document,keyFile){
  const secret=fs.readFileSync(keyFile);
  if(secret.length<32)throw new Error('Identity protection key unavailable');
  return createHmac('sha256',secret)
    .update('seven-desk-tax-id-v1\0'+accountType+'\0'+document)
    .digest('hex');
}
module.exports={registrationIdentity,isValidCPF,isValidCNPJ,normalizeDocument,documentHash};
