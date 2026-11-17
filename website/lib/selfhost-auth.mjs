import fs from 'node:fs';
import {betterAuth} from 'better-auth';
import {APIError} from 'better-auth/api';
import {emailOTP,jwt} from 'better-auth/plugins';
import {Pool} from 'pg';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {options}=require('./db-pool.js');
const {renderOtpEmail}=require('./auth-email-template.js');
const {sendOtpMail}=require('./smtp-mail.js');
function secret(variable){
  const file=process.env[variable];
  if(!file)throw new Error('Protected auth configuration missing');
  const value=fs.readFileSync(file,'utf8').trim();
  if(value.length<32)throw new Error('Invalid auth secret');
  return value;
}
const origin=new URL(process.env.SEVEN_SITE_URL||'https://invalid.example');
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('Invalid auth origin');
const auth=betterAuth({
  appName:'Seven Desk',baseURL:origin.origin,basePath:'/api/auth',
  secret:secret('SEVEN_AUTH_SECRET_FILE'),
  trustedOrigins:[origin.origin],
  database:new Pool(options()),
  user:{
    modelName:'seven_users',
    additionalFields:{
      accountType:{type:'string',required:false,input:true,returned:true},
      // The document itself is never stored or included in a user/session payload.
      taxIdHash:{type:'string',required:false,input:true,returned:false},
    },
  },
  databaseHooks:{
    user:{
      create:{
        before:async user=>{
          if(!['PF','PJ'].includes(user.accountType) ||
             !/^[a-f0-9]{64}$/.test(user.taxIdHash||'')){
            throw new APIError('BAD_REQUEST',{message:'Cadastro PF/PJ obrigatório'});
          }
          return {data:user};
        },
      },
      update:{
        before:async data=>{
          // Identity and its one-month trial cannot be reassigned by /update-user.
          const {accountType:ignoredType,taxIdHash:ignoredHash,...safe}=data;
          return {data:safe};
        },
      },
    },
  },
  session:{modelName:'seven_sessions',expiresIn:604800,updateAge:86400},
  account:{modelName:'seven_accounts'},
  verification:{modelName:'seven_verifications'},
  emailAndPassword:{
    enabled:true,requireEmailVerification:true,autoSignIn:false,
    disableSignUp:process.env.SEVEN_REGISTRATION_ENABLED!=='1',
    minPasswordLength:12,maxPasswordLength:128,revokeSessionsOnPasswordReset:true,
  },
  plugins:[
    emailOTP({
      otpLength:6,expiresIn:900,allowedAttempts:5,storeOTP:'hashed',
      sendVerificationOnSignUp:true,disableSignUp:true,
      async sendVerificationOTP({email,otp,type}){
        const message=renderOtpEmail({type,code:otp});
        await sendOtpMail({...message,to:email});
      },
    }),
    jwt({jwt:{issuer:origin.origin,audience:origin.origin,expirationTime:'5m'}}),
  ],
  rateLimit:{enabled:true,storage:'database',window:60,max:60,
    customRules:{
      '/sign-up/email':{window:60,max:3},'/sign-in/email':{window:60,max:8},
      '/email-otp/send-verification-otp':{window:60,max:4},
      '/email-otp/request-password-reset':{window:60,max:4},
      '/email-otp/verify-email':{window:60,max:8},
      '/email-otp/reset-password':{window:60,max:8},
    },
  },
  advanced:{cookiePrefix:'seven-desk',useSecureCookies:true,
    database:{generateId:'uuid',joins:true,validateSchema:true}},
});
export {auth};
