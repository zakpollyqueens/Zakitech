import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
type Role="owner"|"vice_admin"|"web_developer"|"application_developer"|"engineer"|"staff";
const roles:Role[]=["owner","vice_admin","web_developer","application_developer","engineer","staff"];
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed."});
 const h=req.headers.get("Authorization")||"",token=h.startsWith("Bearer ")?h.slice(7):"";
 if(!token)return reply(401,{error:"Sign in is required."});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return reply(503,{error:"Staff management is not configured."});
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:ud,error:ue}=await admin.auth.getUser(token);
 if(ue||!ud.user)return reply(401,{error:"Your session is invalid. Sign in again."});
 const {data:actor,error:ae}=await admin.from("zt_profiles").select("user_id,role,status").eq("user_id",ud.user.id).maybeSingle();
 if(ae||!actor||actor.status!=="active"||!["owner","vice_admin"].includes(actor.role))return reply(403,{error:"You do not have permission to manage staff."});
 let b:Record<string,unknown>;try{b=await req.json()}catch{return reply(400,{error:"Invalid request."})}
 if(b.action==="list-staff"){
  const {data,error}=await admin.from("zt_profiles").select("user_id,username,email,display_name,role,status,must_change_password,created_at").order("created_at",{ascending:false});
  if(error)return reply(500,{error:"Could not load staff records."});return reply(200,{staff:data||[]});
 }
 if(b.action==="create-staff"){
  const username=typeof b.username==="string"?b.username.trim().toLowerCase():"",email=typeof b.email==="string"?b.email.trim().toLowerCase():"",display=typeof b.display_name==="string"?b.display_name.trim():"",role=typeof b.role==="string"?b.role as Role:"staff";
  if(!/^[a-z0-9._-]{3,32}$/.test(username)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||display.length<2||display.length>100||!roles.includes(role))return reply(400,{error:"Provide a valid username, email, display name, and role."});
  if(role==="owner"||(role==="vice_admin"&&actor.role!=="owner"))return reply(403,{error:"Only the owner can appoint a Vice Administrator; owner roles cannot be assigned here."});
  const {data:byName}=await admin.from("zt_profiles").select("user_id").eq("username",username).maybeSingle();
  const {data:byEmail}=await admin.from("zt_profiles").select("user_id").ilike("email",email).maybeSingle();
  if(byName||byEmail)return reply(409,{error:"That username or email is already assigned."});
  const {data:invite,error:ie}=await admin.auth.admin.inviteUserByEmail(email,{data:{display_name:display,username}});
  if(ie||!invite.user)return reply(400,{error:ie?.message||"Could not send the account invitation."});
  const {error:pe}=await admin.from("zt_profiles").insert({user_id:invite.user.id,username,email,display_name:display,role,status:"active",must_change_password:false,created_by:ud.user.id});
  if(pe){await admin.auth.admin.deleteUser(invite.user.id);return reply(500,{error:"The account could not be saved. No staff account was created."})}
  await admin.from("zt_audit_events").insert({actor_user_id:ud.user.id,target_user_id:invite.user.id,event_type:"staff_created",details:{username,role}});
  return reply(201,{message:"Invitation sent. The staff member must use the email invitation to set their password.",username});
 }
 if(b.action==="set-status"){
  const id=typeof b.user_id==="string"?b.user_id:"",status=b.status;
  if(!id||!["active","suspended"].includes(String(status)))return reply(400,{error:"Provide a staff account and a valid status."});
  const {data:t}=await admin.from("zt_profiles").select("user_id,role,username").eq("user_id",id).maybeSingle();
  if(!t)return reply(404,{error:"Staff account not found."});
  if(t.role==="owner"||(t.role==="vice_admin"&&actor.role!=="owner")||t.user_id===actor.user_id)return reply(403,{error:"You cannot change this account's status."});
  const {error}=await admin.from("zt_profiles").update({status,updated_at:new Date().toISOString()}).eq("user_id",id);
  if(error)return reply(500,{error:"Could not update the account."});
  await admin.from("zt_audit_events").insert({actor_user_id:ud.user.id,target_user_id:id,event_type:"staff_status_changed",details:{status}});
  return reply(200,{message:"Staff account status updated."});
 }
 return reply(400,{error:"Unknown action."});
});
