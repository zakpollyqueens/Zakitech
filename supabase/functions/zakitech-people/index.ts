import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:unknown,max=3000)=>typeof v==="string"?v.trim().slice(0,max):"";
const adminRoles=["owner","vice_admin"];
const financeRoles=["owner","vice_admin","finance_officer"];

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed."});
 const auth=req.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
 if(!token)return reply(401,{error:"Sign in is required."});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return reply(503,{error:"People & payroll backend is not configured."});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:authData,error:authError}=await db.auth.getUser(token);
 if(authError||!authData.user)return reply(401,{error:"Your session is invalid. Please sign in again."});
 const uid=authData.user.id;
 const {data:actor,error:profileError}=await db.from("zt_profiles").select("user_id,username,display_name,role,status").eq("user_id",uid).maybeSingle();
 if(profileError||!actor||actor.status!=="active")return reply(403,{error:"Your account is not active."});
 const isAdmin=adminRoles.includes(actor.role),canFinance=financeRoles.includes(actor.role);
 const requireAdmin=()=>{if(!isAdmin)throw Object.assign(Error("Only the owner or vice administrator can manage staff performance."),{status:403})};
 const requireFinance=()=>{if(!canFinance)throw Object.assign(Error("Finance permission is required for payroll actions."),{status:403})};
 let b:Record<string,unknown>;try{b=await req.json()}catch{return reply(400,{error:"Invalid request body."})}
 const action=clean(b.action,80);
 try{
  if(action==="search-staff"){
   if(!isAdmin)return reply(403,{error:"Staff search is restricted to administrators."});
   const term=clean(b.query,80).replace(/[,%()]/g,"");
   let q=db.from("zt_profiles").select("user_id,username,display_name,role,status,created_at").order("display_name").limit(50);
   if(term)q=q.or("username.ilike.%"+term+"%,display_name.ilike.%"+term+"%");
   const {data,error}=await q;if(error)throw Error("Could not search staff.");
   return reply(200,{staff:data||[]});
  }
  if(action==="staff-detail"){
   const target=clean(b.staff_user_id,80)||uid;
   if(target!==uid&&!isAdmin)return reply(403,{error:"You can only view your own staff profile."});
   const {data:staff,error:se}=await db.from("zt_profiles").select("user_id,username,display_name,role,status,created_at").eq("user_id",target).maybeSingle();
   if(se||!staff)return reply(404,{error:"Staff member not found."});
   let tq=db.from("zt_tasks").select("id,title,description,priority,status,due_at,submitted_at,completed_at,created_at,updated_at,product:zt_products(name)").eq("assigned_to",target).order("created_at",{ascending:false}).limit(100);
   const {data:tasks,error:te}=await tq;if(te)throw Error("Could not load task history.");
   const {data:events,error:ee}=await db.from("zt_performance_events").select("*").eq("staff_user_id",target).order("created_at",{ascending:false}).limit(100);
   if(ee)throw Error("Could not load performance records.");
   const all=tasks||[],done=all.filter((t:any)=>t.status==="completed"||t.completed_at),onTime=done.filter((t:any)=>t.due_at&&t.completed_at&&new Date(t.completed_at)<=new Date(t.due_at));
   const verified=(events||[]).filter((e:any)=>e.status==="verified");
   const ratings=verified.filter((e:any)=>e.rating!==null&&e.rating!==undefined);
   const deals=verified.filter((e:any)=>e.event_type==="deal");
   return reply(200,{staff,tasks:all,events:events||[],metrics:{assigned:all.length,completed:done.length,open:all.filter((t:any)=>!["completed","cancelled"].includes(t.status)).length,overdue:all.filter((t:any)=>t.due_at&&new Date(t.due_at)<new Date()&&!["completed","cancelled"].includes(t.status)).length,on_time_rate:done.length?Math.round(onTime.length/done.length*100):0,verified_events:verified.length,average_rating:ratings.length?Math.round(ratings.reduce((s:number,e:any)=>s+Number(e.rating),0)/ratings.length*100)/100:null,verified_deal_value:deals.reduce((s:number,e:any)=>s+Number(e.amount||0),0),verified_customers:verified.filter((e:any)=>e.event_type==="customer_acquisition").reduce((s:number,e:any)=>s+Number(e.quantity||0),0)}});
  }
  if(action==="assign-task"){
   requireAdmin();
   const target=clean(b.staff_user_id,80),title=clean(b.title,160),description=clean(b.description,3000),priority=clean(b.priority,20)||"normal",due=clean(b.due_at,60)||null,productId=clean(b.product_id,80)||null;
   if(!target||title.length<2||!["low","normal","high","urgent"].includes(priority))return reply(400,{error:"Provide a staff member, task title and valid priority."});
   const {data:targetProfile}=await db.from("zt_profiles").select("user_id").eq("user_id",target).eq("status","active").maybeSingle();
   if(!targetProfile)return reply(404,{error:"Active staff member not found."});
   if(productId){const {data:p}=await db.from("zt_products").select("id").eq("id",productId).maybeSingle();if(!p)return reply(404,{error:"Selected product not found."})}
   const {data:task,error}=await db.from("zt_tasks").insert({title,description,product_id:productId,assigned_to:target,created_by:uid,priority,status:"assigned",due_at:due}).select("*").single();
   if(error)throw Error("Could not assign task.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:target,event_type:"staff_task_assigned",details:{task_id:task.id,title,priority,due_at:due}});
   return reply(201,{message:"Task assigned.",task});
  }
  if(action==="record-performance"){
   requireAdmin();
   const target=clean(b.staff_user_id,80),type=clean(b.event_type,40),title=clean(b.title,160),description=clean(b.description,2000),quantity=Number(b.quantity??1),amount=Number(b.amount??0),rating=b.rating===""||b.rating===null||b.rating===undefined?null:Number(b.rating),evidence=clean(b.evidence_url,500)||null;
   if(!target||title.length<2||!["customer_rating","deal","customer_acquisition","quality_review","task_review","other"].includes(type)||!Number.isFinite(quantity)||quantity<0||!Number.isFinite(amount)||amount<0||(rating!==null&&(!Number.isFinite(rating)||rating<0||rating>5)))return reply(400,{error:"Check the event type, title, quantity, amount and 0–5 rating."});
   const {data:person}=await db.from("zt_profiles").select("user_id").eq("user_id",target).maybeSingle();if(!person)return reply(404,{error:"Staff member not found."});
   const {data:event,error}=await db.from("zt_performance_events").insert({staff_user_id:target,event_type:type,title,description,quantity,amount,rating,status:"pending",evidence_url:evidence,recorded_by:uid}).select("*").single();
   if(error)throw Error("Could not record performance item.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:target,event_type:"performance_record_created",details:{event_id:event.id,event_type:type}});
   return reply(201,{message:"Performance record saved and awaiting verification.",event});
  }
  if(action==="verify-performance"){
   requireAdmin();
   const id=clean(b.id,80),decision=clean(b.decision,20);
   if(!["verified","rejected"].includes(decision))return reply(400,{error:"Choose verify or reject."});
   const {data:event,error:lookup}=await db.from("zt_performance_events").select("id,staff_user_id,status").eq("id",id).maybeSingle();
   if(lookup||!event)return reply(404,{error:"Performance record not found."});
   if(event.status!=="pending")return reply(409,{error:"Only pending records can be reviewed."});
   const {error}=await db.from("zt_performance_events").update({status:decision,verified_by:uid,verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
   if(error)throw Error("Could not save verification decision.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:event.staff_user_id,event_type:"performance_record_"+decision,details:{event_id:id}});
   return reply(200,{message:"Performance record "+decision+"."});
  }
  if(action==="payroll-bootstrap"){
   if(!canFinance)return reply(403,{error:"Finance permission is required."});
   const [policies,periods,entries,staff]=await Promise.all([
    db.from("zt_compensation_policies").select("*").order("role_key"),
    db.from("zt_payroll_periods").select("*").order("starts_on",{ascending:false}).limit(30),
    db.from("zt_payroll_entries").select("*,staff:zt_profiles!zt_payroll_entries_staff_user_id_fkey(user_id,username,display_name,role),period:zt_payroll_periods(title,starts_on,ends_on,status)").order("created_at",{ascending:false}).limit(200),
    db.from("zt_profiles").select("user_id,username,display_name,role,status").eq("status","active").order("display_name")
   ]);
   if(policies.error||periods.error||entries.error||staff.error)throw Error("Could not load payroll records.");
   return reply(200,{policies:policies.data||[],periods:periods.data||[],entries:entries.data||[],staff:staff.data||[]});
  }
  if(action==="save-policy"){
   requireFinance();
   const role=clean(b.role_key,80)||"all",name=clean(b.name,120),currency=clean(b.currency,8).toUpperCase()||"UGX",base=Number(b.base_salary),rate=Number(b.commission_rate),bonus=Number(b.performance_bonus),minRating=Number(b.minimum_rating),frequency=clean(b.pay_frequency,20)||"monthly",active=b.active===true;
   if(name.length<2||! /^[A-Z]{3,8}$/.test(currency)||![base,rate,bonus,minRating].every(Number.isFinite)||base<0||rate<0||rate>100||bonus<0||minRating<0||minRating>5||!["weekly","biweekly","monthly","custom"].includes(frequency))return reply(400,{error:"Check the compensation policy values."});
   const {data,error}=await db.from("zt_compensation_policies").upsert({name,role_key:role,currency,base_salary:base,commission_rate:rate,performance_bonus:bonus,minimum_rating:minRating,pay_frequency:frequency,active,updated_by:uid,updated_at:new Date().toISOString()},{onConflict:"role_key"}).select("*").single();
   if(error)throw Error("Could not save compensation policy.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"compensation_policy_updated",details:{policy_id:data.id,role_key:role,active}});
   return reply(200,{message:"Compensation policy saved.",policy:data});
  }
  if(action==="create-period"){
   requireFinance();
   const title=clean(b.title,120),starts=clean(b.starts_on,20),ends=clean(b.ends_on,20),payDate=clean(b.pay_date,20)||null;
   if(title.length<2||!/^\d{4}-\d{2}-\d{2}$/.test(starts)||!/^\d{4}-\d{2}-\d{2}$/.test(ends)||ends<starts||(payDate&&!/^\d{4}-\d{2}-\d{2}$/.test(payDate)))return reply(400,{error:"Provide a valid payroll title and date range."});
   const {data:period,error}=await db.from("zt_payroll_periods").insert({title,starts_on:starts,ends_on:ends,pay_date:payDate,created_by:uid,status:"draft"}).select("*").single();
   if(error)throw Error("Could not create payroll period.");
   return reply(201,{message:"Payroll period created.",period});
  }
  if(action==="generate-payroll"){
   requireFinance();
   const periodId=clean(b.period_id,80);if(!periodId)return reply(400,{error:"Choose a payroll period."});
   const {data:period,error:pe}=await db.from("zt_payroll_periods").select("*").eq("id",periodId).maybeSingle();if(pe||!period)return reply(404,{error:"Payroll period not found."});
   if(!["draft","review"].includes(period.status))return reply(409,{error:"This payroll period has already moved beyond draft/review."});
   const {data:staff,error:se}=await db.from("zt_profiles").select("user_id,username,display_name,role").eq("status","active");if(se)throw Error("Could not load active staff.");
   const {data:policies,error:po}=await db.from("zt_compensation_policies").select("*").eq("active",true);if(po)throw Error("Could not load compensation policies.");
   const {data:events,error:ee}=await db.from("zt_performance_events").select("staff_user_id,event_type,amount,rating,quantity,created_at").eq("status","verified").gte("created_at",period.starts_on+"T00:00:00Z").lte("created_at",period.ends_on+"T23:59:59Z");if(ee)throw Error("Could not load verified performance.");
   const results=[];
   for(const person of staff||[]){
    const policy=(policies||[]).find((p:any)=>p.role_key===person.role)||(policies||[]).find((p:any)=>p.role_key==="all");
    if(!policy)continue;
    const pevents=(events||[]).filter((e:any)=>e.staff_user_id===person.user_id),dealValue=pevents.filter((e:any)=>e.event_type==="deal").reduce((s:number,e:any)=>s+Number(e.amount||0),0),ratings=pevents.filter((e:any)=>e.rating!==null&&e.rating!==undefined),avg=ratings.length?ratings.reduce((s:number,e:any)=>s+Number(e.rating),0)/ratings.length:null;
    const commission=Math.round(dealValue*Number(policy.commission_rate)/100*100)/100,bonus=avg!==null&&avg>=Number(policy.minimum_rating)?Number(policy.performance_bonus):0,base=Number(policy.base_salary),gross=base+commission+bonus,net=gross;
    const {data:entry,error}=await db.from("zt_payroll_entries").upsert({period_id:periodId,staff_user_id:person.user_id,currency:policy.currency,base_salary:base,commission_amount:commission,performance_bonus:bonus,adjustments:0,gross_amount:gross,deductions:0,net_amount:net,calculation_notes:"Policy: "+policy.name+". Verified deal value: "+dealValue.toFixed(2)+". Verified average rating: "+(avg===null?"not recorded":avg.toFixed(2))+". Review before approval.",status:"draft",updated_at:new Date().toISOString()},{onConflict:"period_id,staff_user_id"}).select("*").single();
    if(error)throw Error("Could not calculate payroll for "+person.username+".");
    results.push({entry,username:person.username});
   }
   await db.from("zt_payroll_periods").update({status:"review",updated_at:new Date().toISOString()}).eq("id",periodId);
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"payroll_generated",details:{period_id:periodId,entry_count:results.length}});
   return reply(200,{message:"Draft payroll calculated from active policies and verified records. Review every entry before approval.",results});
  }
  if(action==="payroll-entry-action"){
   requireFinance();
   const id=clean(b.id,80),decision=clean(b.decision,20),note=clean(b.note,500),reference=clean(b.payment_reference,180),provider=clean(b.payment_provider,80);
   const {data:entry,error:lookup}=await db.from("zt_payroll_entries").select("*,period:zt_payroll_periods(id,status)").eq("id",id).maybeSingle();
   if(lookup||!entry)return reply(404,{error:"Payroll entry not found."});
   const now=new Date().toISOString();let patch:Record<string,unknown>={updated_at:now};
   if(decision==="approve"&&entry.status==="draft"){patch={...patch,status:"approved",approved_by:uid,approved_at:now,calculation_notes:(entry.calculation_notes||"")+(note?"\nApproval note: "+note:"")}}
   else if(decision==="mark-paid"&&entry.status==="approved"&&reference.length>0){patch={...patch,status:"paid",paid_by:uid,paid_at:now,payment_reference:reference,payment_provider:provider||"manual",calculation_notes:entry.calculation_notes||""}}
   else return reply(409,{error:"Only draft entries can be approved; only approved entries can be marked paid with a payment reference."});
   const {error}=await db.from("zt_payroll_entries").update(patch).eq("id",id);if(error)throw Error("Could not update payroll entry.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:entry.staff_user_id,event_type:decision==="approve"?"payroll_entry_approved":"payroll_entry_marked_paid",details:{entry_id:id,period_id:entry.period_id,payment_reference:decision==="mark-paid"?reference:undefined}});
   return reply(200,{message:decision==="approve"?"Payroll entry approved.":"Payment marked paid and recorded."});
  }
  if(action==="my-payroll"){
   const {data:entries,error}=await db.from("zt_payroll_entries").select("*,period:zt_payroll_periods(title,starts_on,ends_on,pay_date,status)").eq("staff_user_id",uid).order("created_at",{ascending:false}).limit(100);
   if(error)throw Error("Could not load your payroll statements.");
   return reply(200,{entries:entries||[]});
  }
  return reply(400,{error:"Unknown people/payroll action."});
 }catch(e){const err=e as Error&{status?:number};return reply(err.status||500,{error:err.message||"People/payroll request failed."})}
});