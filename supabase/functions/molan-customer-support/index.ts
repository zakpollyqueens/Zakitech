import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:unknown,n=12000)=>typeof v==="string"?v.trim().slice(0,n):"";
const allowedStatus=["new","open","in_progress","awaiting_customer","escalated","resolved","closed"];
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed."});
 const auth=req.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
 if(!token)return reply(401,{error:"Sign in is required."});
 const zUrl=Deno.env.get("SUPABASE_URL"),zKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const mUrl=Deno.env.get("MOLAN_SUPABASE_URL"),mKey=Deno.env.get("MOLAN_SUPABASE_SERVICE_ROLE_KEY");
 if(!zUrl||!zKey)return reply(503,{error:"ZakiTech support service is not configured."});
 if(!mUrl||!mKey)return reply(503,{error:"Molan support bridge is not configured. Set MOLAN_SUPABASE_URL and MOLAN_SUPABASE_SERVICE_ROLE_KEY as secrets for this Edge Function."});
 const zdb=createClient(zUrl,zKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const au=await zdb.auth.getUser(token);
 if(au.error||!au.data.user)return reply(401,{error:"Your ZakiTech session is invalid. Sign in again."});
 const uid=au.data.user.id,p=await zdb.from("zt_profiles").select("user_id,username,display_name,role,status").eq("user_id",uid).maybeSingle();
 if(p.error||!p.data||p.data.status!=="active")return reply(403,{error:"Your ZakiTech account is not active."});
 const actor=p.data,admin=["owner","vice_admin"].includes(actor.role);
 const a=await zdb.from("zt_workstation_assignments").select("id").eq("user_id",uid).eq("workstation","support_inbox").limit(1);
 if(!admin&&actor.role!=="support_officer"&&!a.data?.length)return reply(403,{error:"You need an authorized Support Inbox assignment to access Molan customer conversations."});
 let b:Record<string,unknown>;try{b=await req.json()}catch{return reply(400,{error:"Invalid request body."})}
 const action=clean(b.action,40),ticketId=clean(b.ticket_id,80),actorName=clean(actor.display_name||actor.username||"ZakiTech support",160);
 const mol=createClient(mUrl,mKey,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  if(action==="bootstrap"){
   const q=await mol.from("support_tickets").select("id,ticket_number,customer_user_id,customer_name,customer_email,company_name,subject,category,priority,status,assigned_staff_id,assigned_staff_name,created_at,updated_at,resolved_at,initial_message").order("updated_at",{ascending:false}).limit(150);
   if(q.error)throw q.error;const ts=q.data||[],ids=ts.map((t:any)=>t.id);let ms:any[]=[];
   if(ids.length){const r=await mol.from("support_messages").select("id,ticket_id,sender_role,sender_name,body,created_at,customer_read_at,staff_read_at").in("ticket_id",ids).order("created_at",{ascending:false}).limit(500);if(r.error)throw r.error;ms=r.data||[]}
   const last=new Map<string,any>(),unread=new Map<string,number>();
   for(const m of ms){if(!last.has(m.ticket_id))last.set(m.ticket_id,m);if(m.sender_role==="customer"&&!m.staff_read_at)unread.set(m.ticket_id,(unread.get(m.ticket_id)||0)+1)}
   return reply(200,{tickets:ts.map((t:any)=>({...t,last_message:last.get(t.id)||null,unread_customer_messages:unread.get(t.id)||0})),actor:{id:uid,name:actorName,role:actor.role},can_assign_others:admin});
  }
  if(!ticketId)return reply(400,{error:"A support ticket ID is required."});
  const t=await mol.from("support_tickets").select("*").eq("id",ticketId).maybeSingle();
  if(t.error||!t.data)return reply(404,{error:"Support ticket not found."});
  if(action==="messages"){
   await mol.from("support_messages").update({staff_read_at:new Date().toISOString()}).eq("ticket_id",ticketId).eq("sender_role","customer").is("staff_read_at",null);
   const m=await mol.from("support_messages").select("id,ticket_id,sender_role,sender_name,body,created_at,customer_read_at,staff_read_at").eq("ticket_id",ticketId).order("created_at",{ascending:true});if(m.error)throw m.error;
   const e=await mol.from("support_ticket_events").select("id,actor_name,event_type,event_details,created_at").eq("ticket_id",ticketId).order("created_at",{ascending:true});
   return reply(200,{ticket:t.data,messages:m.data||[],events:e.error?[]:e.data||[],actor:{id:uid,name:actorName,role:actor.role}});
  }
  if(action==="reply"){
   const message=clean(b.message);if(!message)return reply(400,{error:"Write a reply before sending."});
   // Separate blank-line paragraphs become individual chat bubbles and each contributes one unread badge count.
   const paragraphs=message.split(/\\n\\s*\\n+/).map((part:string)=>part.trim()).filter(Boolean);
   const ins=await mol.from("support_messages").insert(paragraphs.map((body:string)=>({ticket_id:ticketId,sender_user_id:null,sender_role:"support",sender_name:actorName,body}))).select("id,ticket_id,sender_role,sender_name,body,created_at");if(ins.error)throw ins.error;
   const next=["resolved","closed"].includes(t.data.status)?t.data.status:"awaiting_customer";
   const up=await mol.from("support_tickets").update({status:next}).eq("id",ticketId);if(up.error)throw up.error;
   await mol.from("support_ticket_events").insert({ticket_id:ticketId,actor_user_id:uid,actor_name:actorName,event_type:"support_reply",event_details:{message_ids:(ins.data||[]).map((m:any)=>m.id),paragraph_count:(ins.data||[]).length}});
   return reply(200,{messages:ins.data||[],status:next});
  }
  if(action==="assign"){
   let assigneeId=uid,assigneeName=actorName;
   if(admin&&b.assigned_staff_id){assigneeId=clean(b.assigned_staff_id,80);const target=await zdb.from("zt_profiles").select("user_id,display_name,username,status").eq("user_id",assigneeId).maybeSingle();if(!target.data||target.data.status!=="active")return reply(400,{error:"Choose an active ZakiTech staff member."});assigneeName=clean(target.data.display_name||target.data.username||"Support staff",160)}
   const up=await mol.from("support_tickets").update({assigned_staff_id:assigneeId,assigned_staff_name:assigneeName,status:t.data.status==="new"?"open":t.data.status}).eq("id",ticketId).select("id,assigned_staff_id,assigned_staff_name,status").single();if(up.error)throw up.error;
   await mol.from("support_ticket_events").insert({ticket_id:ticketId,actor_user_id:uid,actor_name:actorName,event_type:"assigned",event_details:{assigned_staff_id:assigneeId,assigned_staff_name:assigneeName}});
   return reply(200,{ticket:up.data});
  }
  if(action==="status"){
   const next=clean(b.status,40);if(!allowedStatus.includes(next))return reply(400,{error:"Choose a valid ticket status."});
   if(!admin&&t.data.assigned_staff_id&&t.data.assigned_staff_id!==uid)return reply(403,{error:"Only the assigned staff member or leadership can change this ticket."});
   const up=await mol.from("support_tickets").update({status:next,resolved_at:next==="resolved"||next==="closed"?new Date().toISOString():null}).eq("id",ticketId).select("id,status,resolved_at").single();if(up.error)throw up.error;
   await mol.from("support_ticket_events").insert({ticket_id:ticketId,actor_user_id:uid,actor_name:actorName,event_type:"status_changed",event_details:{status:next}});
   return reply(200,{ticket:up.data});
  }
  return reply(400,{error:"Unsupported support action."});
 }catch(e){console.error("molan-customer-support:",e);return reply(500,{error:"The support request could not be completed. Check the support database configuration and try again."})}
});