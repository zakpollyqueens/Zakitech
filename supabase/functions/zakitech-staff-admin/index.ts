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
 if(ae||!actor||actor.status!=="active")return reply(403,{error:"Your account is not active."});
 let b:Record<string,unknown>;try{b=await req.json()}catch{return reply(400,{error:"Invalid request."})}
 if(b.action==="update-profile"){
  const display=typeof b.display_name==="string"?b.display_name.trim():"";
  const phone=typeof b.phone==="string"?b.phone.trim():"";
  const avatarPath=typeof b.avatar_path==="string"?b.avatar_path.trim():"";
  if(display.length<2||display.length>100)return reply(400,{error:"Display name must be between 2 and 100 characters."});
  if(phone.length>30|| (phone && !/^[+0-9() .-]{6,30}$/.test(phone)))return reply(400,{error:"Enter a valid phone number."});
  if(avatarPath && (!avatarPath.startsWith(ud.user.id+"/") || avatarPath.includes("..") || avatarPath.length>300))return reply(400,{error:"Invalid profile image path."});
  const updates:{display_name:string;phone:string|null;updated_at:string;avatar_path?:string|null;username?:string}={display_name:display,phone:phone||null,updated_at:new Date().toISOString()};
  if(Object.prototype.hasOwnProperty.call(b,"avatar_path"))updates.avatar_path=avatarPath||null;
  if(Object.prototype.hasOwnProperty.call(b,"username")){
   if(!["owner","vice_admin"].includes(actor.role))return reply(403,{error:"Only the CEO or an authorized administrator can change a login username."});
   const username=typeof b.username==="string"?b.username.trim().toLowerCase():"";
   if(!/^[a-z0-9._-]{3,32}$/.test(username))return reply(400,{error:"Username must be 3–32 characters using letters, numbers, dots, underscores or hyphens."});
   const {data:existing,error:lookupError}=await admin.from("zt_profiles").select("user_id").ilike("username",username).neq("user_id",ud.user.id).maybeSingle();
   if(lookupError)return reply(500,{error:"Could not verify username availability."});
   if(existing)return reply(409,{error:"That username is already assigned. Choose another one."});
   updates.username=username;
  }
  const {error}=await admin.from("zt_profiles").update(updates).eq("user_id",ud.user.id);
  if(error)return reply(400,{error:"Could not save your profile changes."});
  if(updates.username){await admin.from("zt_audit_events").insert({actor_user_id:ud.user.id,target_user_id:ud.user.id,event_type:"username_changed",details:{username:updates.username}})}
  return reply(200,{message:updates.username?"Profile and login username updated successfully.":"Profile updated successfully."});
 }
 if(b.action==="list-directory"){
  const {data,error}=await admin.from("zt_profiles").select("user_id,username,display_name,role,avatar_path").eq("status","active").order("display_name",{ascending:true});
  if(error)return reply(500,{error:"Could not load the team directory."});
  const staff=[];
  for(const p of data||[]){
   let avatar_url=null;
   if(p.avatar_path){const {data:signed}=await admin.storage.from("zt-profile-avatars").createSignedUrl(p.avatar_path,3600);avatar_url=signed?.signedUrl||null}
   staff.push({user_id:p.user_id,username:p.username,display_name:p.display_name,role:p.role,avatar_url});
  }
  return reply(200,{staff});
 }
 if(!["owner","vice_admin"].includes(actor.role))return reply(403,{error:"You do not have permission to manage staff."});
 if(b.action==="update-username"){
  const id=typeof b.user_id==="string"?b.user_id:ud.user.id;
  const username=typeof b.username==="string"?b.username.trim().toLowerCase():"";
  if(!/^[a-z0-9._-]{3,32}$/.test(username))return reply(400,{error:"Username must be 3–32 characters using letters, numbers, dots, underscores or hyphens."});
  const {data:target,error:targetError}=await admin.from("zt_profiles").select("user_id,role").eq("user_id",id).maybeSingle();
  if(targetError||!target)return reply(404,{error:"Staff account not found."});
  const {data:existing,error:lookupError}=await admin.from("zt_profiles").select("user_id").ilike("username",username).neq("user_id",id).maybeSingle();
  if(lookupError)return reply(500,{error:"Could not verify username availability."});
  if(existing)return reply(409,{error:"That username is already assigned. Choose another one."});
  const {error}=await admin.from("zt_profiles").update({username,updated_at:new Date().toISOString()}).eq("user_id",id);
  if(error)return reply(400,{error:"Could not update the login username."});
  await admin.from("zt_audit_events").insert({actor_user_id:ud.user.id,target_user_id:id,event_type:"username_changed",details:{username}});
  return reply(200,{message:"Login username updated. The account can use the new username at the next sign-in.",username});
 }
 if(b.action==="list-staff"){
  const {data,error}=await admin.from("zt_profiles").select("user_id,username,email,display_name,phone,avatar_path,role,status,must_change_password,created_at").order("created_at",{ascending:false});
  if(error)return reply(500,{error:"Could not load staff records."});
  const staff=[];
  for(const p of data||[]){
   let avatar_url=null;
   if(p.avatar_path){const {data:signed}=await admin.storage.from("zt-profile-avatars").createSignedUrl(p.avatar_path,3600);avatar_url=signed?.signedUrl||null}
   staff.push({...p,avatar_url});
  }
  return reply(200,{staff});
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
