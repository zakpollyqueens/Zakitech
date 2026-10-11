import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const encoder=new TextEncoder();
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const unb64=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function derive(passcode:string,salt:Uint8Array){const key=await crypto.subtle.importKey("raw",encoder.encode(passcode),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},key,256);return new Uint8Array(bits)}
function equal(a:Uint8Array,b:Uint8Array){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed."});
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return reply(401,{error:"Sign in to your ZakiTech account first."});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return reply(503,{error:"Workstation security is not configured."});
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await admin.auth.getUser(token);
 if(authError||!auth.user)return reply(401,{error:"Your session is invalid. Sign in again."});
 const {data:profile,error:profileError}=await admin.from("zt_profiles").select("status").eq("user_id",auth.user.id).maybeSingle();
 if(profileError||!profile||profile.status!=="active")return reply(403,{error:"Your company account is not active."});
 let body:Record<string,unknown>;try{body=await req.json()}catch{return reply(400,{error:"Invalid request."})}
 const action=body.action;
 const {data:record,error:readError}=await admin.from("zt_workstation_credentials").select("credential_type,passcode_salt,passcode_hash,failed_attempts,locked_until").eq("user_id",auth.user.id).maybeSingle();
 if(readError)return reply(500,{error:"Could not check workstation security."});
 if(action==="status")return reply(200,{configured:!!record,credentialType:record?.credential_type||null});
 if(action==="setup"){
  const passcode=typeof body.passcode==="string"?body.passcode:"";
  const credentialType=body.credentialType==="password"?"password":"pin";
  const validFormat=credentialType==="pin"?/^\d{4}$/.test(passcode):passcode.length>=8&&passcode.length<=128;
  if(!validFormat)return reply(400,{error:credentialType==="pin"?"Choose exactly four digits.":"Choose a password between 8 and 128 characters."});
  if(record)return reply(409,{error:"A workstation credential is already configured. Use the secure reset process to replace it."});
  const salt=crypto.getRandomValues(new Uint8Array(16)),hash=await derive(passcode,salt);
  const {error}=await admin.from("zt_workstation_credentials").insert({user_id:auth.user.id,credential_type:credentialType,passcode_salt:b64(salt),passcode_hash:b64(hash),failed_attempts:0,locked_until:null});
  if(error)return reply(500,{error:"Could not save the workstation credential. Please try again."});
  await admin.from("zt_audit_events").insert({actor_user_id:auth.user.id,target_user_id:auth.user.id,event_type:"workstation_credential_created",details:{credential_type:credentialType}});
  return reply(200,{message:"Workstation credential created.",credentialType});
 }
 if(action==="verify"){
  const passcode=typeof body.passcode==="string"?body.passcode:"";
  if(!record)return reply(409,{error:"Set up a workstation credential in Settings before locking your workstation."});
  const validFormat=record.credential_type==="password"?passcode.length>=1&&passcode.length<=128:/^\d{4}$/.test(passcode);
  if(!validFormat)return reply(400,{error:record.credential_type==="password"?"Enter your workstation password.":"Enter your four-digit PIN."});
  if(record.locked_until&&new Date(record.locked_until).getTime()>Date.now())return reply(429,{error:"Too many incorrect attempts. Please wait before trying again.",locked_until:record.locked_until});
  const valid=equal(await derive(passcode,unb64(record.passcode_salt)),unb64(record.passcode_hash));
  if(!valid){
   const attempts=Number(record.failed_attempts||0)+1,locked=attempts>=5?new Date(Date.now()+15*60*1000).toISOString():null;
   await admin.from("zt_workstation_credentials").update({failed_attempts:locked?0:attempts,locked_until:locked,updated_at:new Date().toISOString()}).eq("user_id",auth.user.id);
   return reply(401,{error:locked?"Too many incorrect attempts. Workstation access is temporarily locked for 15 minutes.":"Incorrect passcode. Try again."});
  }
  await admin.from("zt_workstation_credentials").update({failed_attempts:0,locked_until:null,updated_at:new Date().toISOString()}).eq("user_id",auth.user.id);
  await admin.from("zt_audit_events").insert({actor_user_id:auth.user.id,target_user_id:auth.user.id,event_type:"workstation_passcode_verified",details:{}});
  return reply(200,{verified:true,message:"Workstation unlocked."});
 }
 return reply(400,{error:"Unsupported workstation security action."});
});
