import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed."});
 let body:{identity?:unknown;password?:unknown};try{body=await req.json()}catch{return reply(400,{error:"Invalid request."})}
 const identity=typeof body.identity==="string"?body.identity.trim().toLowerCase():"";
 const password=typeof body.password==="string"?body.password:"";
 if(!identity||identity.length>254||!password||password.length>1024)return reply(400,{error:"Enter your assigned username/email and password."});
 const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anonKey=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!serviceKey||!anonKey)return reply(503,{error:"The sign-in service is not configured yet."});
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const col=identity.includes("@")?"email":"username";
 const {data:p,error:pe}=await admin.from("zt_profiles").select("user_id,email,status").eq(col,identity).maybeSingle();
 if(pe||!p||p.status!=="active")return reply(401,{error:"The sign-in details are incorrect or this account is not active."});
 const {data,error}=await auth.auth.signInWithPassword({email:p.email,password});
 if(error||!data.session||data.user.id!==p.user_id)return reply(401,{error:"The sign-in details are incorrect or this account is not active."});
 return reply(200,{session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_in:data.session.expires_in,expires_at:data.session.expires_at,token_type:data.session.token_type}});
});
