import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed."});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return reply(503,{error:"Password recovery is not configured."});
 let b:Record<string,unknown>;try{b=await req.json()}catch{return reply(400,{error:"Invalid request."})}
 const identity=typeof b.identity==="string"?b.identity.trim().toLowerCase():"";
 if(!identity||identity.length>254)return reply(400,{error:"Enter your assigned username or account email."});
 let redirectTo="https://zakpollyqueens.github.io/Zakitech/reset-password.html";
 try{const requested=new URL(typeof b.redirectTo==="string"?b.redirectTo:"");const origin=req.headers.get("origin")||"";if(requested.protocol==="https:"&&requested.origin===origin&&requested.pathname.endsWith("/reset-password.html"))redirectTo=requested.href}catch{}
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 let email:string|null=null;
 if(identity.includes("@")&&/^\S+@\S+\.\S+$/.test(identity)){
  const {data}=await db.from("zt_profiles").select("email,status").ilike("email",identity).maybeSingle();
  if(data?.status==="active")email=data.email;
 }else{
  const {data}=await db.from("zt_profiles").select("email,status").ilike("username",identity).maybeSingle();
  if(data?.status==="active")email=data.email;
 }
 if(email){const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});if(error)console.error("Password recovery email could not be dispatched.");}
 return reply(200,{message:"If an active ZakiTech account matches those details, a password-recovery email has been requested. Check the inbox and spam folder for the email registered to that account."});
});