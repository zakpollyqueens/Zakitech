import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
type Role="owner"|"vice_admin"|"receptionist"|"web_developer"|"application_developer"|"engineer"|"staff"|"product_manager"|"project_manager"|"qa_tester"|"ui_ux_designer"|"devops_engineer"|"release_manager"|"notifications_manager"|"announcements_manager"|"support_officer"|"operations_officer"|"security_officer"|"finance_officer";
const roles:Role[]=["owner","vice_admin","receptionist","web_developer","application_developer","engineer","staff","product_manager","project_manager","qa_tester","ui_ux_designer","devops_engineer","release_manager","notifications_manager","announcements_manager","support_officer","operations_officer","security_officer","finance_officer"];
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
 const {data:actor,error:ae}=await admin.from("zt_profiles").select("user_id,role,status,full_access").eq("user_id",ud.user.id).maybeSingle();
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
 if(b.action==="create-staff-invite"||b.action==="list-staff-invites"||b.action==="revoke-staff-invite"){
  const mayManage=["owner","vice_admin","receptionist"].includes(actor.role)||actor.full_access===true;
  if(!mayManage)return reply(403,{error:"Only the CEO, Vice Administrator, or Receptionist can manage staff invitations."});
  if(b.action==="list-available-usernames"){
   await admin.from("zt_staff_invites").update({status:"expired"}).eq("status","pending").lt("expires_at",new Date().toISOString());
   const {data:released}=await admin.from("zt_username_pool").select("username,assigned_invite_id").eq("status","assigned").not("assigned_invite_id","is",null);
   for(const item of released||[]){const {data:iv}=await admin.from("zt_staff_invites").select("status").eq("id",item.assigned_invite_id).maybeSingle();if(iv&&["expired","revoked"].includes(iv.status))await admin.from("zt_username_pool").update({status:"available",assigned_invite_id:null,assigned_at:null}).eq("username",item.username).eq("status","assigned")}
   const {data,error}=await admin.from("zt_username_pool").select("username").eq("status","available").order("username").limit(500);
   if(error)return reply(500,{error:"Could not load available usernames."});
   return reply(200,{usernames:(data||[]).map((x:any)=>x.username)});
  }
  if(b.action==="add-usernames"){
   const raw=Array.isArray(b.usernames)?b.usernames:typeof b.usernames==="string"?b.usernames.split(/[\\s,;]+/):[];
   const usernames=[...new Set(raw.map((x:unknown)=>typeof x==="string"?x.trim().toLowerCase():"").filter(Boolean))];
   if(!usernames.length||usernames.length>300||usernames.some((x:string)=>!/^[a-z0-9._-]{3,32}$/.test(x)))return reply(400,{error:"Add between 1 and 300 valid usernames (3–32 letters, numbers, dots, underscores or hyphens)."});
   const {data:profiles,error:pe}=await admin.from("zt_profiles").select("username").in("username",usernames);
   if(pe)return reply(500,{error:"Could not check existing staff usernames."});
   const {data:invites,error:ie}=await admin.from("zt_staff_invites").select("username").in("username",usernames).in("status",["pending","claimed"]);
   if(ie)return reply(500,{error:"Could not check reserved usernames."});
   const {data:pool,error:qe}=await admin.from("zt_username_pool").select("username").in("username",usernames);
   if(qe)return reply(500,{error:"Could not check the username pool."});
   const used=new Set([...(profiles||[]).map((x:any)=>x.username),...(invites||[]).map((x:any)=>x.username),...(pool||[]).map((x:any)=>x.username)]);
   const available=usernames.filter((x:string)=>!used.has(x));
   if(!available.length)return reply(409,{error:"None of those usernames are available. Check existing accounts and the username pool."});
   const {error}=await admin.from("zt_username_pool").insert(available.map((username:string)=>({username,status:"available",created_by:ud.user.id})));
   if(error)return reply(500,{error:"Could not add usernames to the available pool."});
   await admin.from("zt_audit_events").insert({actor_user_id:ud.user.id,event_type:"staff_usernames_added_to_pool",details:{count:available.length,usernames:available}});
   return reply(201,{message:available.length+" username(s) added to the available pool.",added:available,skipped:usernames.filter((x:string)=>!available.includes(x))});
  }
  if(b.action==="list-staff-invites"){
   const {data,error}=await admin.from("zt_staff_invites").select("id,username,display_name,role,status,created_at,expires_at,created_by").order("created_at",{ascending:false}).limit(200);
   if(error)return reply(500,{error:"Could not load staff invitations."});
   return reply(200,{invites:data||[]});
  }
  if(b.action==="revoke-staff-invite"){
   const id=typeof b.id==="string"?b.id:"";
   const {data,error}=await admin.from("zt_staff_invites").update({status:"revoked"}).eq("id",id).eq("status","pending").select("id,username").maybeSingle();
   if(error||!data)return reply(404,{error:"Pending invitation not found."});
   await admin.from("zt_username_pool").update({status:"available",assigned_invite_id:null,assigned_at:null}).eq("username",data.username).eq("status","assigned");
   await admin.from("zt_audit_events").insert({actor_user_id:ud.user.id,event_type:"staff_invitation_revoked",details:{invite_id:id}});
   return reply(200,{message:"Invitation revoked."});
  }
  const username=typeof b.username==="string"?b.username.trim().toLowerCase():"";
  const display=typeof b.display_name==="string"?b.display_name.trim():"";
  const role=typeof b.role==="string"?b.role as Role:"staff";
  const fullAccess=b.full_access===true||b.full_access==="true";
  const workstations=Array.isArray(b.workstations)?[...new Set(b.workstations.map((x:unknown)=>typeof x==="string"?x:"").filter(Boolean))]:[];
  const productId=typeof b.product_id==="string"&&b.product_id.trim()?b.product_id.trim():null;
  const allowedWorkstations=["product_development","release_management","notifications","announcements","support_inbox","communication"];
  if(workstations.some((x:string)=>!allowedWorkstations.includes(x)))return reply(400,{error:"Choose only valid workstation areas."});
  if(workstations.some((x:string)=>["product_development","release_management"].includes(x))&&!productId)return reply(400,{error:"Choose a product for product-development or release-management access."});
  if(productId){const {data:product,error:productError}=await admin.from("zt_products").select("id").eq("id",productId).maybeSingle();if(productError||!product)return reply(400,{error:"The selected product does not exist."})}
  if(!/^[a-z0-9._-]{3,32}$/.test(username)||display.length<2||display.length>100||!roles.includes(role)||["owner","vice_admin"].includes(role))return reply(400,{error:"Provide a valid username, display name, and staff role."});
  if(role==="receptionist"&&actor.role!=="owner")return reply(403,{error:"Only the CEO can appoint a receptionist."});
  if(fullAccess&&actor.role!=="owner")return reply(403,{error:"Only the CEO can grant full workspace access."});
  const {data:poolName,error:poolNameError}=await admin.from("zt_username_pool").select("username,status").eq("username",username).maybeSingle();
  if(poolNameError)return reply(500,{error:"Could not verify the username pool."});
  if(!poolName||poolName.status!=="available")return reply(400,{error:"Choose a username from the available username pool first."});
  const {data:existingProfile,error:profileLookup}=await admin.from("zt_profiles").select("user_id").ilike("username",username).maybeSingle();
  const {data:existingInvite,error:inviteLookup}=await admin.from("zt_staff_invites").select("id").ilike("username",username).in("status",["pending","claimed"]).maybeSingle();
  if(profileLookup||inviteLookup)return reply(500,{error:"Could not verify username availability."});
  if(existingProfile||existingInvite)return reply(409,{error:"That username is already assigned or reserved by a pending invitation."});
  const bytes=new Uint8Array(18);crypto.getRandomValues(bytes);
  const voucher="ZTK-"+Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(voucher));
  const voucherHash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
  const {data:invite,error}=await admin.from("zt_staff_invites").insert({username,display_name:display,role,full_access:fullAccess,workstations,product_id:productId,voucher_hash:voucherHash,created_by:ud.user.id}).select("id,username,display_name,role,workstations,product_id,expires_at").single();
  if(error||!invite)return reply(500,{error:"Could not create the staff invitation."});
  const {error:poolUpdateError}=await admin.from("zt_username_pool").update({status:"assigned",assigned_invite_id:invite.id,assigned_at:new Date().toISOString()}).eq("username",username).eq("status","available");
  if(poolUpdateError){await admin.from("zt_staff_invites").delete().eq("id",invite.id);return reply(500,{error:"Invitation could not reserve the selected username."})}
  await admin.from("zt_audit_events").insert({actor_user_id:ud.user.id,event_type:"staff_invitation_created",details:{invite_id:invite.id,username,role,full_access:fullAccess}});
  return reply(201,{message:"Staff invitation created. Share the private onboarding link and voucher with the intended staff member.",invite,voucher});
 }
 if(b.action==="get-staff-details"){
  if(!["owner","vice_admin","receptionist"].includes(actor.role)&&actor.full_access!==true)return reply(403,{error:"You do not have permission to view staff details."});
  const id=typeof b.user_id==="string"?b.user_id:"";if(!id)return reply(400,{error:"Choose a staff account."});
  const {data:p,error}=await admin.from("zt_profiles").select("user_id,username,email,display_name,legal_name,phone,address,role,status,full_access,created_by,created_at,avatar_path,onboarding_completed_at,identity_document_number,identity_document_path").eq("user_id",id).maybeSingle();
  if(error||!p)return reply(404,{error:"Staff account not found."});
  let avatar_url=null;if(p.avatar_path){const {data:signed}=await admin.storage.from("zt-profile-avatars").createSignedUrl(p.avatar_path,3600);avatar_url=signed?.signedUrl||null}
  const {data:creator}=p.created_by?await admin.from("zt_profiles").select("username,display_name").eq("user_id",p.created_by).maybeSingle():{data:null};
  const canViewIdentity=["owner","vice_admin"].includes(actor.role)||actor.full_access===true;
  let identity_document_url=null;if(canViewIdentity&&p.identity_document_path){const {data:signed}=await admin.storage.from("zt-staff-documents").createSignedUrl(p.identity_document_path,300);identity_document_url=signed?.signedUrl||null}
  const details:any={user_id:p.user_id,username:p.username,email:p.email,display_name:p.display_name,legal_name:p.legal_name,phone:p.phone,address:p.address,role:p.role,status:p.status,full_access:p.full_access,created_at:p.created_at,onboarding_completed_at:p.onboarding_completed_at,avatar_url,created_by_name:creator?.display_name||creator?.username||"Original system setup"};
  if(canViewIdentity){details.identity_document_number=p.identity_document_number;details.identity_document_uploaded=!!p.identity_document_path;details.identity_document_url=identity_document_url}
  return reply(200,{staff:details});
 }
 if(!["owner","vice_admin"].includes(actor.role)&&actor.full_access!==true)return reply(403,{error:"You do not have permission to manage staff."});
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
  const {data,error}=await admin.from("zt_profiles").select("user_id,username,email,display_name,phone,avatar_path,role,status,full_access,must_change_password,created_at").order("created_at",{ascending:false});
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
  const username=typeof b.username==="string"?b.username.trim().toLowerCase():"",email=typeof b.email==="string"?b.email.trim().toLowerCase():"",display=typeof b.display_name==="string"?b.display_name.trim():"",role=typeof b.role==="string"?b.role as Role:"staff",fullAccess=b.full_access===true||b.full_access==="true";
  if(!/^[a-z0-9._-]{3,32}$/.test(username)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||display.length<2||display.length>100||!roles.includes(role))return reply(400,{error:"Provide a valid username, email, display name, and role."});
  if(role==="owner"||(role==="vice_admin"&&actor.role!=="owner"))return reply(403,{error:"Only the owner can appoint a Vice Administrator; owner roles cannot be assigned here."});
  if(fullAccess&&actor.role!=="owner")return reply(403,{error:"Only the CEO/owner can grant full workspace access."});
  const {data:byName}=await admin.from("zt_profiles").select("user_id").eq("username",username).maybeSingle();
  const {data:byEmail}=await admin.from("zt_profiles").select("user_id").ilike("email",email).maybeSingle();
  if(byName||byEmail)return reply(409,{error:"That username or email is already assigned."});
  const {data:invite,error:ie}=await admin.auth.admin.inviteUserByEmail(email,{data:{display_name:display,username}});
  if(ie||!invite.user)return reply(400,{error:ie?.message||"Could not send the account invitation."});
  const {error:pe}=await admin.from("zt_profiles").insert({user_id:invite.user.id,username,email,display_name:display,role,full_access:fullAccess,status:"active",must_change_password:false,created_by:ud.user.id});
  if(pe){await admin.auth.admin.deleteUser(invite.user.id);return reply(500,{error:"The account could not be saved. No staff account was created."})}
  await admin.from("zt_audit_events").insert({actor_user_id:ud.user.id,target_user_id:invite.user.id,event_type:"staff_created",details:{username,role,full_access:fullAccess}});
  return reply(201,{message:"Invitation sent. The staff member must use the email invitation to set their password.",username});
 }
 if(b.action==="set-full-access"){
  if(actor.role!=="owner")return reply(403,{error:"Only the CEO/owner can change full workspace access."});
  const id=typeof b.user_id==="string"?b.user_id:"",enabled=b.full_access===true;
  if(!id||id===ud.user.id)return reply(400,{error:"Choose another staff account to update."});
  const {data:target,error:targetError}=await admin.from("zt_profiles").select("user_id,role,username").eq("user_id",id).maybeSingle();
  if(targetError||!target)return reply(404,{error:"Staff account not found."});
  if(target.role==="owner"||target.role==="vice_admin")return reply(403,{error:"Full-access grants cannot replace or modify CEO/vice-administrator roles."});
  const {error}=await admin.from("zt_profiles").update({full_access:enabled,updated_at:new Date().toISOString()}).eq("user_id",id);
  if(error)return reply(500,{error:"Could not update full workspace access."});
  await admin.from("zt_audit_events").insert({actor_user_id:ud.user.id,target_user_id:id,event_type:enabled?"full_workspace_access_granted":"full_workspace_access_revoked",details:{full_access:enabled}});
  return reply(200,{message:enabled?"Full workspace access granted, including Governance Board access.":"Full workspace access revoked; explicit workstation assignments remain."});
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
