'use strict';
const tls=require('node:tls');
const fs=require('node:fs');
function safeAddress(s){
  if(typeof s!=='string'||s.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(s)||/[\r\n]/.test(s))throw new Error('Invalid destination');
  return s;
}
async function sendOtpMail({to,subject,text,html},env=process.env){
  safeAddress(to);
  if(typeof subject!=='string'||typeof text!=='string'||typeof html!=='string'||[subject,text,html].some(s=>s.length>30000)||/[\r\n]/.test(subject))throw new Error('Invalid mail data');
  const user='sevendesk@sevendesk.tech';
  const secretPath=env.SEVEN_SMTP_PASSWORD_FILE;
  if(!secretPath)throw new Error('SMTP secret absent');
  const pass=fs.readFileSync(secretPath,'utf8').trim();
  if(!pass)throw new Error('SMTP secret empty');
  const host='smtp.hostinger.com';
  const socket=tls.connect({host,port:465,servername:host,rejectUnauthorized:true,minVersion:'TLSv1.2',timeout:15000});
  let buffer='',replyLines=[],messages=[],pending=null,ended=false;
  const flush=()=>{
    if(!pending||!messages.length)return;
    const response=messages.shift(),next=pending;pending=null;
    if(response.code>=400)next.reject(new Error('SMTP server rejected a command'));
    else next.resolve(response);
  };
  socket.on('data',data=>{
    buffer+=data.toString('utf8');
    if(buffer.length>32000){socket.destroy(new Error('SMTP response too large'));return;}
    let end;
    while((end=buffer.indexOf('\n'))>=0){
      const line=buffer.slice(0,end).replace(/\r$/,'');buffer=buffer.slice(end+1);
      const match=/^(\d{3})([ -])(.*)$/.exec(line);
      if(!match){socket.destroy(new Error('Malformed SMTP response'));return;}
      replyLines.push(line);
      if(match[2]===' '){messages.push({code:Number(match[1]),lines:replyLines});replyLines=[];flush();}
    }
  });
  const errorPromise=new Promise((_,reject)=>{
    socket.on('error',reject);
    socket.on('timeout',()=>{socket.destroy(new Error('SMTP timeout'));});
    socket.on('close',()=>{if(!ended)reject(new Error('SMTP connection closed'));});
  });
  const read=()=>new Promise((resolve,reject)=>{pending={resolve,reject};flush();});
  const expect=async(want,cmd)=>{
    if(cmd!==undefined){if(!socket.writable)throw new Error('SMTP disconnected');socket.write(cmd+'\r\n');}
    const result=await Promise.race([read(),errorPromise]);
    if(!want.includes(result.code))throw new Error('SMTP unexpected response');
    return result;
  };
  try{
    await expect([220]);
    await expect([250],'EHLO sevendesk.tech');
    const credential=Buffer.from('\0'+user+'\0'+pass).toString('base64');
    await expect([235],'AUTH PLAIN '+credential);
    await expect([250],'MAIL FROM:<'+user+'>');
    await expect([250,251],'RCPT TO:<'+to+'>');
    await expect([354],'DATA');
    const boundary='seven-'+require('node:crypto').randomBytes(12).toString('hex');
    const header=[
      'From: Seven Desk <'+user+'>','To: <'+to+'>',
      'Subject: =?UTF-8?B?'+Buffer.from(subject).toString('base64')+'?=',
      'MIME-Version: 1.0','Content-Type: multipart/alternative; boundary="'+boundary+'"',
      'Date: '+new Date().toUTCString(),'Auto-Submitted: auto-generated','',
    ].join('\r\n');
    const sections=[
      '--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',
      Buffer.from(text).toString('base64'),
      '--'+boundary,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',
      Buffer.from(html).toString('base64'),'--'+boundary+'--','',
    ].join('\r\n');
    const message=(header+sections).split('\r\n').map(line=>line.startsWith('.')?'.'+line:line).join('\r\n');
    socket.write(message+'\r\n.\r\n');
    await expect([250]);
    ended=true;
    socket.write('QUIT\r\n');
    socket.end();
  }finally{socket.destroy();}
}
module.exports={sendOtpMail,safeAddress};
