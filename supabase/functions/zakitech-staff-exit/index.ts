import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const admins=["owner","vice_admin"];
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed."});
 const auth=req.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
 if(!token)return reply(401,{error:"Sign in is required."});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return reply(503,{error:"Staff exit requests are not configured."});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:authData,error:authError}=await db.auth.getUser(token);
 if(authError||!authData.user)return reply(401,{error:"Your session is invalid. Sign in again."});
 const actorId=authData.user.id;
 const {data:actor,error:actorError}=await db.from("zt_profiles").select("user_id,username,display_name,role,status,full_access").eq("user_id",actorId).maybeSingle();
 if(actorError||!actor||actor.status!=="active")return reply(403,{error:"Your account is not active."});
 let body:Record<string,unknown>;try{body=await req.json()}catch{return reply(400,{error:"Invalid request."})}
 const isAdmin=admins.includes(actor.role);
 if(body.action==="my-requests"){
  const {data,error}=await db.from("zt_staff_exit_requests").select("id,requester_username,requester_display_name,letter,status,admin_response,reviewed_at,created_at,updated_at").eq("requester_user_id",actorId).order("created_at",{ascending:false}).limit(20);
  if(error)return reply(500,{error:"Could not load your exit requests."});
  return reply(200,{requests:data||[]});
 }
 if(body.action==="submit"){
  if(isAdmin||actor.role==="owner"||actor.role==="vice_admin")return reply(403,{error:"Administrator departure must be handled directly by the company owner."});
  const letter=typeof body.letter==="string"?body.letter.trim():"";
  if(letter.length<30||letter.length>12000)return reply(400,{error:"Please write a letter of at least 30 characters and no more than 12,000 characters."});
  const {data:existing,error:existingError}=await db.from("zt_staff_exit_requests").select("id").eq("requester_user_id",actorId).eq("status","pending").maybeSingle();
  if(existingError)return reply(500,{error:"Could not check your existing request."});
  if(existing)return reply(409,{error:"You already have a pending request. You can review its status below."});
  const {data:request,error}=await db.from("zt_staff_exit_requests").insert({requester_user_id:actorId,requester_username:actor.username,requester_display_name:actor.display_name,requester_role:actor.role,letter,status:"pending"}).select("id,status,created_at").single();
  if(error)return reply(500,{error:"Could not submit your letter. Please try again."});
  await db.from("zt_audit_events").insert({actor_user_id:actorId,target_user_id:actorId,event_type:"staff_exit_requested",details:{request_id:request.id}});
  return reply(201,{message:"Your letter has been submitted. Your account remains active while the administrator reviews it.",request});
 }
 if(body.action==="list-pending"||body.action==="list-all"){
  if(!isAdmin)return reply(403,{error:"Only the CEO or Vice Administrator can review staff departure requests."});
  let query=db.from("zt_staff_exit_requests").select("id,requester_user_id,requester_username,requester_display_name,requester_role,letter,status,admin_response,reviewed_by,reviewed_at,created_at").order("created_at",{ascending:false}).limit(200);
  if(body.action==="list-pending")query=query.eq("status","pending");
  const {data,error}=await query;
  if(error)return reply(500,{error:"Could not load staff departure requests."});
  return reply(200,{requests:data||[]});
 }
 if(body.action==="review"){
  if(!isAdmin)return reply(403,{error:"Only the CEO or Vice Administrator can review staff departure requests."});
  const id=typeof body.request_id==="string"?body.request_id:"",decision=body.decision;
  const response=typeof body.admin_response==="string"?body.admin_response.trim().slice(0,4000):"";
  if(!id||!["approved","rejected"].includes(String(decision)))return reply(400,{error:"Choose a request and approve or reject it."});
  if(decision==="rejected"&&response.length<3)return reply(400,{error:"Please provide a short response explaining the decision."});
  const {data:reqRow,error:reqError}=await db.from("zt_staff_exit_requests").select("*").eq("id",id).maybeSingle();
  if(reqError||!reqRow)return reply(404,{error:"Departure request not found."});
  if(reqRow.status!=="pending")return reply(409,{error:"This request has already been reviewed."});
  if(!reqRow.requester_user_id)return reply(409,{error:"The staff account is already unavailable; this request needs manual review."});
  if(decision==="rejected"){
   const {data:rejectedRow,error}=await db.from("zt_staff_exit_requests").update({status:"rejected",admin_response:response,reviewed_by:actorId,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("status","pending").select("id").maybeSingle();
   if(error)return reply(500,{error:"Could not record the decision."});
   if(!rejectedRow)return reply(409,{error:"Another administrator has already started reviewing this request."});
   await db.from("zt_audit_events").insert({actor_user_id:actorId,target_user_id:reqRow.requester_user_id,event_type:"staff_exit_rejected",details:{request_id:id,admin_response:response}});
   return reply(200,{message:"Request rejected. The staff account remains active and can continue using the workspace.",status:"rejected"});
  }
  if(reqRow.requester_user_id===actorId)return reply(403,{error:"You cannot approve a request to remove your own account."});
  const targetId=reqRow.requester_user_id;
  const {data:target,error:targetError}=await db.from("zt_profiles").select("user_id,role,status").eq("user_id",targetId).maybeSingle();
  if(targetError||!target)return reply(409,{error:"The staff profile no longer exists. This request needs manual review."});
  if(admins.includes(target.role))return reply(403,{error:"Administrator accounts cannot be removed through the staff departure workflow."});
  if(target.status!=="active")return reply(409,{error:"The staff account is not active; resolve its status before approving departure."});
  const {data:claimed,error:claimError}=await db.from("zt_staff_exit_requests").update({status:"processing",updated_at:new Date().toISOString()}).eq("id",id).eq("status","pending").select("id").maybeSingle();
  if(claimError)return reply(500,{error:"Could not claim this departure request for review."});
  if(!claimed)return reply(409,{error:"Another administrator has already started reviewing this request."});
  const now=new Date().toISOString();
  const {data:locked,error:lockError}=await db.from("zt_profiles").update({status:"suspended",updated_at:now}).eq("user_id",targetId).eq("status","active").select("user_id").maybeSingle();
  if(lockError||!locked){await db.from("zt_staff_exit_requests").update({status:"pending",updated_at:new Date().toISOString()}).eq("id",id).eq("status","processing");return reply(500,{error:"Could not disable the account before departure."});}
  const {error:auditError}=await db.from("zt_audit_events").insert({actor_user_id:actorId,target_user_id:targetId,event_type:"staff_exit_approved",details:{request_id:id,requester_username:reqRow.requester_username,admin_response:response}});
  if(auditError){await db.from("zt_profiles").update({status:"active",updated_at:new Date().toISOString()}).eq("user_id",targetId);await db.from("zt_staff_exit_requests").update({status:"pending",updated_at:new Date().toISOString()}).eq("id",id).eq("status","processing");return reply(500,{error:"Could not record the approval audit event; account was not deleted."})}
  // The target profile is suspended before deletion, so profile-gated server endpoints deny any still-valid access token during teardown.
  const {error:deleteError}=await db.auth.admin.deleteUser(targetId);
  if(deleteError){
   await db.from("zt_profiles").update({status:"active",updated_at:new Date().toISOString()}).eq("user_id",targetId);
   await db.from("zt_staff_exit_requests").update({status:"pending",updated_at:new Date().toISOString()}).eq("id",id).eq("status","processing");
   await db.from("zt_audit_events").insert({actor_user_id:actorId,target_user_id:targetId,event_type:"staff_exit_deletion_failed",details:{request_id:id,error:deleteError.message}});
   return reply(500,{error:"Account deletion failed. The account has been restored and the request returned to pending; please retry or contact support."});
  }
  const {error:finishError}=await db.from("zt_staff_exit_requests").update({requester_user_id:null,status:"approved",admin_response:response||"Approved by company administrator.",reviewed_by:actorId,reviewed_at:now,updated_at:now}).eq("id",id).eq("status","processing");
  if(finishError)return reply(500,{error:"The account was deleted, but the request record could not be finalized. Contact the system owner with request ID "+id+"."});
  return reply(200,{message:"Departure approved. The staff account and authentication identity have been deleted; the person can no longer sign in with that account.",status:"approved"});
 }
 return reply(400,{error:"Unknown action."});
});
