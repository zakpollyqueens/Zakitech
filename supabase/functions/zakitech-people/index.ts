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
 const {data:workspaceBoardGrant}=await db.from("zt_board_members").select("access_level").eq("user_id",uid).maybeSingle();
 const hasFullWorkspace=workspaceBoardGrant?.access_level==="full_workspace";
 const isAdmin=adminRoles.includes(actor.role)||hasFullWorkspace,canFinance=financeRoles.includes(actor.role)||hasFullWorkspace;
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
  if(action==="global-search"){
   if(!isAdmin)return reply(403,{error:"Global search is restricted to administrators."});
   const term=clean(b.query,100).replace(/[,%()]/g,"").trim();
   if(term.length<2)return reply(400,{error:"Enter at least two characters to search."});
   const pattern="%"+term+"%";
   const [staffResult,productResult,taskResult]=await Promise.all([
    db.from("zt_profiles").select("user_id,username,display_name,role,status").or("username.ilike."+pattern+",display_name.ilike."+pattern).order("display_name").limit(20),
    db.from("zt_products").select("id,name,slug,description,status,current_version").or("name.ilike."+pattern+",slug.ilike."+pattern+",description.ilike."+pattern).order("name").limit(20),
    db.from("zt_tasks").select("id,title,description,status,priority,assigned_to,product_id,created_at,product:zt_products(name)").or("title.ilike."+pattern+",description.ilike."+pattern).order("created_at",{ascending:false}).limit(20)
   ]);
   if(staffResult.error||productResult.error||taskResult.error)throw Error("Could not complete global search.");
   let appUsers:Record<string,unknown>[]=[];let appIntegration={connected:false,message:"ZakiChat user search is not connected. Configure ZAKICHAT_SUPABASE_URL and ZAKICHAT_SUPABASE_SERVICE_ROLE_KEY as server-side secrets."};
   const appUrl=Deno.env.get("ZAKICHAT_SUPABASE_URL"),appKey=Deno.env.get("ZAKICHAT_SUPABASE_SERVICE_ROLE_KEY");
   if(appUrl&&appKey){
    try{
     const appDb=createClient(appUrl,appKey,{auth:{persistSession:false,autoRefreshToken:false}});
     const {data,error}=await appDb.from("profiles").select("id,username,full_name,phone,created_at").or("username.ilike."+pattern+",full_name.ilike."+pattern+",phone.ilike."+pattern).order("created_at",{ascending:false}).limit(20);
     if(error)throw error;
     appUsers=(data||[]).map((u:any)=>({id:u.id,username:u.username,display_name:u.full_name,phone:u.phone,created_at:u.created_at,product:"ZakiChat"}));
     appIntegration={connected:true,message:"ZakiChat user search connected."};
    }catch(e){appIntegration={connected:false,message:"ZakiChat bridge is configured but the user lookup failed. Verify the service credentials and profiles schema."};}
   }
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"global_search_performed",details:{query_length:term.length,staff_results:(staffResult.data||[]).length,product_results:(productResult.data||[]).length,task_results:(taskResult.data||[]).length,zakichat_results:appUsers.length}});
   return reply(200,{staff:staffResult.data||[],products:productResult.data||[],tasks:taskResult.data||[],app_users:appUsers,app_integration:appIntegration});
  }
  if(action==="product-support-bootstrap"){
   const appUrl=Deno.env.get("ZAKICHAT_SUPABASE_URL"),appKey=Deno.env.get("ZAKICHAT_SUPABASE_SERVICE_ROLE_KEY");
   if(!appUrl||!appKey)return reply(503,{error:"ZakiChat moderation bridge is not configured. Set ZAKICHAT_SUPABASE_URL and ZAKICHAT_SUPABASE_SERVICE_ROLE_KEY as server-side secrets first."});
   const isSupportRole=["product_manager","support_officer"].includes(actor.role);
   const {data:zakichatProduct}=await db.from("zt_products").select("id").eq("slug","zakichat").maybeSingle();
   let supportAssigned=false;
   if(isSupportRole&&zakichatProduct?.id){
    const {data:grant}=await db.from("zt_workstation_assignments").select("id").eq("user_id",uid).eq("workstation","support_inbox").eq("product_id",zakichatProduct.id).limit(1).maybeSingle();
    supportAssigned=!!grant;
   }
   if(!isAdmin&&!supportAssigned)return reply(403,{error:"Product support is restricted to administrators and staff assigned to ZakiChat support."});
   const appDb=createClient(appUrl,appKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const [requests,profiles,authUsers]=await Promise.all([
    appDb.from("support_requests").select("id,user_id,category,subject,message,status,created_at,read_at,resolved_at").order("created_at",{ascending:false}).limit(300),
    appDb.from("profiles").select("id,username,full_name,phone").order("created_at",{ascending:false}).limit(1000),
    appDb.auth.admin.listUsers({page:1,perPage:1000})
   ]);
   if(requests.error||profiles.error||authUsers.error)throw Error("Could not load ZakiChat support and moderation records.");
   const profileMap=new Map((profiles.data||[]).map((p:any)=>[p.id,p]));
   const banned=new Map((authUsers.data.users||[]).filter((u:any)=>u.banned_until&&new Date(u.banned_until).getTime()>Date.now()).map((u:any)=>[u.id,u]));
   const users=(profiles.data||[]).map((p:any)=>({id:p.id,username:p.username,full_name:p.full_name,phone:p.phone,banned_until:banned.get(p.id)?.banned_until||null,account_status:banned.has(p.id)?"suspended":"active"}));
   const complaints=(requests.data||[]).map((q:any)=>({...q,user:profileMap.get(q.user_id)||null}));
   return reply(200,{users,complaints,integration:{connected:true,message:"ZakiChat support and moderation connected."}});
  }
  if(action==="product-support-update"){
   const appUrl=Deno.env.get("ZAKICHAT_SUPABASE_URL"),appKey=Deno.env.get("ZAKICHAT_SUPABASE_SERVICE_ROLE_KEY");
   if(!appUrl||!appKey)return reply(503,{error:"ZakiChat moderation bridge is not configured."});
   const isSupportRole=["product_manager","support_officer"].includes(actor.role);
   const {data:zakichatProduct}=await db.from("zt_products").select("id").eq("slug","zakichat").maybeSingle();
   let supportAssigned=false;
   if(isSupportRole&&zakichatProduct?.id){const {data:grant}=await db.from("zt_workstation_assignments").select("id").eq("user_id",uid).eq("workstation","support_inbox").eq("product_id",zakichatProduct.id).limit(1).maybeSingle();supportAssigned=!!grant}
   if(!isAdmin&&!supportAssigned)return reply(403,{error:"You are not assigned to ZakiChat support."});
   const id=clean(b.id,80),status=clean(b.status,20);
   if(!id||!["open","read","resolved"].includes(status))return reply(400,{error:"Choose a valid complaint and status."});
   const appDb=createClient(appUrl,appKey,{auth:{persistSession:false,autoRefreshToken:false}}),now=new Date().toISOString();
   const patch:Record<string,unknown>={status,read_at:status==="open"?null:now,resolved_at:status==="resolved"?now:null};
   const {data,error}=await appDb.from("support_requests").update(patch).eq("id",id).select("id,status").maybeSingle();
   if(error||!data)return reply(404,{error:"Support request not found or could not be updated."});
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"zakichat_support_request_updated",details:{request_id:id,status}});
   return reply(200,{message:"ZakiChat support request updated.",request:data});
  }
  if(action==="product-user-restore"){
   const appUrl=Deno.env.get("ZAKICHAT_SUPABASE_URL"),appKey=Deno.env.get("ZAKICHAT_SUPABASE_SERVICE_ROLE_KEY");
   if(!appUrl||!appKey)return reply(503,{error:"ZakiChat moderation bridge is not configured."});
   const isSupportRole=["product_manager","support_officer"].includes(actor.role);
   let supportAssigned=false;
   if(isSupportRole){const {data:grant}=await db.from("zt_workstation_assignments").select("id").eq("user_id",uid).eq("workstation","support_inbox").limit(1).maybeSingle();supportAssigned=!!grant}
   if(!isAdmin&&!supportAssigned)return reply(403,{error:"You are not assigned to product moderation."});
   const target=clean(b.user_id,80);
   if(!target)return reply(400,{error:"A ZakiChat user ID is required."});
   const appDb=createClient(appUrl,appKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:adminTarget,error:adminCheck}=await appDb.from("admin_users").select("user_id").eq("user_id",target).maybeSingle();
   if(adminCheck)throw Error("Could not verify whether the target is a ZakiChat administrator.");
   if(adminTarget)return reply(403,{error:"ZakiChat administrator accounts cannot be restored from this staff console."});
   const {data:updated,error}=await appDb.auth.admin.updateUserById(target,{ban_duration:"none"});
   if(error)throw Error("Could not restore the ZakiChat account.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:target,event_type:"zakichat_user_restored",details:{source:"product_support_console"}});
   return reply(200,{message:"ZakiChat account restored.",user_id:updated.user?.id||target});
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

  if(action==="chat-bootstrap"){
   const {data:staff,error:staffError}=await db.from("zt_profiles").select("user_id,username,display_name,role,status").eq("status","active").order("display_name");
   if(staffError)throw Error("Could not load the staff directory.");
   const {data:threads,error:threadError}=await db.from("zt_staff_direct_messages").select("id,sender_user_id,recipient_user_id,body,created_at,read_at").or("sender_user_id.eq."+uid+",recipient_user_id.eq."+uid).order("created_at",{ascending:true}).limit(1000);
   if(threadError)throw Error("Could not load private messages.");
   return reply(200,{staff:staff||[],messages:threads||[]});
  }
  if(action==="send-direct-message"){
   const target=clean(b.recipient_user_id,80),body=clean(b.body,4000);
   if(!target||target===uid||body.length<1)return reply(400,{error:"Choose another staff member and enter a message."});
   const {data:person,error:personError}=await db.from("zt_profiles").select("user_id,status").eq("user_id",target).maybeSingle();
   if(personError||!person||person.status!=="active")return reply(404,{error:"Active recipient not found."});
   const {data:message,error}=await db.from("zt_staff_direct_messages").insert({sender_user_id:uid,recipient_user_id:target,body}).select("id,sender_user_id,recipient_user_id,body,created_at,read_at").single();
   if(error)throw Error("Could not send your message.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:target,event_type:"staff_direct_message_sent",details:{message_id:message.id}});
   return reply(201,{message});
  }
  if(action==="mark-direct-read"){
   const sender=clean(b.sender_user_id,80);
   if(!sender)return reply(400,{error:"Sender is required."});
   const {error}=await db.from("zt_staff_direct_messages").update({read_at:new Date().toISOString()}).eq("sender_user_id",sender).eq("recipient_user_id",uid).is("read_at",null);
   if(error)throw Error("Could not update message read status.");
   return reply(200,{message:"Conversation marked as read."});
  }
  if(action==="meetings-bootstrap"){
   const isAdmin=adminRoles.includes(actor.role);
   const {data:boardMember}=await db.from("zt_board_members").select("id").eq("user_id",uid).maybeSingle();
   let q=db.from("zt_meetings").select("*,creator:zt_profiles!zt_meetings_created_by_fkey(username,display_name),rsvps:zt_meeting_rsvps(user_id,response,profile:zt_profiles(username,display_name))").order("starts_at",{ascending:true}).limit(200);
   if(!isAdmin)q=q.in("audience",boardMember?["all_staff","board"]:["all_staff"]);
   const {data:meetings,error}=await q;
   if(error)throw Error("Could not load company meetings.");
   return reply(200,{meetings:meetings||[],staff:isAdmin?(await db.from("zt_profiles").select("user_id,username,display_name,status").eq("status","active").order("display_name")).data||[]:[]});
  }
  if(action==="create-meeting"){
   requireAdmin();
   const title=clean(b.title,180),description=clean(b.description,3000),starts=clean(b.starts_at,80),ends=clean(b.ends_at,80),join=clean(b.join_url,500),provider=clean(b.provider,30)||"zoom",audience=clean(b.audience,30)||"all_staff";
   if(title.length<2||!starts||!ends||new Date(starts).toString()==="Invalid Date"||new Date(ends).toString()==="Invalid Date"||new Date(ends)<=new Date(starts))return reply(400,{error:"Provide a title and valid start/end times."});
   if(join){let parsed;try{parsed=new URL(join)}catch{return reply(400,{error:"Meeting link must be a valid HTTPS URL."})}if(parsed.protocol!=="https:"||!(parsed.hostname==="zoom.us"||parsed.hostname.endsWith(".zoom.us")||parsed.hostname==="meet.google.com"))return reply(400,{error:"Use a valid Zoom or Google Meet HTTPS link."})}
   const {data:meeting,error}=await db.from("zt_meetings").insert({title,description,starts_at:new Date(starts).toISOString(),ends_at:new Date(ends).toISOString(),join_url:join||null,provider,audience,status:"scheduled",created_by:uid}).select("*").single();
   if(error)throw Error("Could not schedule the meeting.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"company_meeting_scheduled",details:{meeting_id:meeting.id,title,provider}});
   return reply(201,{message:"Meeting scheduled. Add a Zoom meeting link, or configure Zoom API credentials to enable automatic meeting creation.",meeting});
  }
  if(action==="meeting-rsvp"){
   const id=clean(b.meeting_id,80),response=clean(b.response,20);
   if(!["attending","maybe","declined"].includes(response))return reply(400,{error:"Choose attending, maybe, or declined."});
   const {data:meeting,error:me}=await db.from("zt_meetings").select("id,status,audience").eq("id",id).maybeSingle();
   if(me||!meeting||meeting.status==="cancelled")return reply(404,{error:"Meeting not found or cancelled."});
   if(meeting.audience==="admins"&&!adminRoles.includes(actor.role))return reply(403,{error:"This meeting is restricted to administrators."});
   if(meeting.audience==="board"&&!adminRoles.includes(actor.role)){const {data:bm}=await db.from("zt_board_members").select("id").eq("user_id",uid).maybeSingle();if(!bm)return reply(403,{error:"This meeting is restricted to board members."})}
   const {error}=await db.from("zt_meeting_rsvps").upsert({meeting_id:id,user_id:uid,response,updated_at:new Date().toISOString()},{onConflict:"meeting_id,user_id"});
   if(error)throw Error("Could not save your RSVP.");
   return reply(200,{message:"Meeting response saved."});
  }
  if(action==="updates-feed"){
   const {data:items,error}=await db.from("zt_board_items").select("id,title,body,item_type,document_url,created_at,updated_at,creator:zt_profiles!zt_board_items_created_by_fkey(username,display_name)").eq("status","published").eq("staff_visible",true).order("created_at",{ascending:false}).limit(100);
   if(error)throw Error("Could not load company updates.");
   return reply(200,{updates:items||[]});
  }
  if(action==="board-bootstrap"){
   const isBoardAdmin=isAdmin;
   const {data:membership,error:membershipError}=await db.from("zt_board_members").select("id,user_id,board_title,access_level,created_at,profile:zt_profiles(username,display_name,role,status)").eq("user_id",uid).maybeSingle();
   if(membershipError)throw Error("Could not check board access.");
   if(!isBoardAdmin&&!membership)return reply(403,{error:"The Governance Board is restricted to administrators and explicitly authorized board members."});
   let q=db.from("zt_board_items").select("*,creator:zt_profiles!zt_board_items_created_by_fkey(username,display_name)").order("created_at",{ascending:false}).limit(200);
   if(!isBoardAdmin)q=q.eq("status","published");
   const {data:items,error}=await q;if(error)throw Error("Could not load board records.");
   const members=isBoardAdmin?(await db.from("zt_board_members").select("id,user_id,board_title,created_at,profile:zt_profiles(username,display_name,role,status)").order("created_at",{ascending:false})).data||[]:[];
   return reply(200,{items:items||[],members,is_admin:isBoardAdmin,is_board_member:!!membership});
  }
  if(action==="board-add-member"){
   requireAdmin();
   const username=clean(b.username,80).replace(/^@/,""),title=clean(b.board_title,100)||"Board Member",accessLevel=clean(b.access_level,30)||"board_only";
   if(!["board_only","full_workspace"].includes(accessLevel))return reply(400,{error:"Choose a valid board access level."});
   if(!username)return reply(400,{error:"Enter a staff username."});
   const {data:person,error:personError}=await db.from("zt_profiles").select("user_id,status").ilike("username",username).maybeSingle();
   if(personError||!person||person.status!=="active")return reply(404,{error:"No active account found for that username."});
   const {data:member,error}=await db.from("zt_board_members").upsert({user_id:person.user_id,board_title:title,access_level:accessLevel,added_by:uid},{onConflict:"user_id"}).select("*").single();
   if(error)throw Error("Could not authorize board member.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:person.user_id,event_type:"board_member_authorized",details:{board_title:title,access_level:accessLevel}});
   return reply(200,{message:"Board member access granted.",member});
  }
  if(action==="board-remove-member"){
   requireAdmin();
   const id=clean(b.id,80);
   const {data:member,error:lookup}=await db.from("zt_board_members").select("id,user_id").eq("id",id).maybeSingle();
   if(lookup||!member)return reply(404,{error:"Board member not found."});
   const {error}=await db.from("zt_board_members").delete().eq("id",id);if(error)throw Error("Could not remove board access.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:member.user_id,event_type:"board_member_access_removed",details:{membership_id:id}});
   return reply(200,{message:"Board access removed."});
  }
  if(action==="board-shares-bootstrap"){
   requireAdmin();
   const {data:rows,error}=await db.from("zt_board_share_register").select("*,member:zt_board_members(id,user_id,board_title,profile:zt_profiles(username,display_name))").order("created_at",{ascending:false}).limit(500);
   if(error)throw Error("Could not load the board share register.");
   return reply(200,{shares:rows||[],members:(await db.from("zt_board_members").select("id,user_id,board_title,profile:zt_profiles(username,display_name)").order("created_at",{ascending:false})).data||[]});
  }
  if(action==="board-share-save"){
   requireAdmin();
   const id=clean(b.id,80),memberId=clean(b.board_member_id,80),shareClass=clean(b.share_class,80)||"Ordinary",quantity=Number(b.share_quantity),price=Number(b.price_per_share),currency=clean(b.currency,10)||"UGX",status=clean(b.status,20)||"draft",notes=clean(b.notes,3000);
   if(!memberId||shareClass.length<2||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(price)||price<0||!["UGX","USD","KES","TZS"].includes(currency)||!["draft","offered","accepted","paid","issued","cancelled"].includes(status))return reply(400,{error:"Enter valid share details, price, currency and status."});
   const {data:member,error:memberError}=await db.from("zt_board_members").select("id,user_id").eq("id",memberId).maybeSingle();
   if(memberError||!member)return reply(404,{error:"Choose an authorized board member."});
   if(status==="issued"&&!/resolution\s*:/i.test(notes))return reply(400,{error:"Before marking shares as issued, add a formal board/company resolution reference in Notes using 'Resolution: …'."});
   const values={board_member_id:memberId,share_class:shareClass,share_quantity:quantity,price_per_share:price,currency,status,notes,updated_at:new Date().toISOString(),...(status==="issued"?{approved_by:uid}:{})};
   const result=id?await db.from("zt_board_share_register").update(values).eq("id",id).select("*,member:zt_board_members(id,user_id,board_title,profile:zt_profiles(username,display_name))").maybeSingle():await db.from("zt_board_share_register").insert({...values,created_by:uid}).select("*,member:zt_board_members(id,user_id,board_title,profile:zt_profiles(username,display_name))").single();
   if(result.error||!result.data)throw Error("Could not save the share register record.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:member.user_id,event_type:"board_share_register_saved",details:{share_record_id:result.data.id,status,quantity,currency,price_per_share:price,share_class:shareClass}});
   return reply(200,{message:"Share register record saved. Formal issuance remains subject to company approvals and applicable law.",share:result.data});
  }
  if(action==="board-save-item"){
   const isBoardAdmin=adminRoles.includes(actor.role);
   const {data:membership,error:me}=await db.from("zt_board_members").select("id").eq("user_id",uid).maybeSingle();
   if(me)throw Error("Could not verify board membership.");
   if(!isBoardAdmin&&!membership)return reply(403,{error:"Board access is required."});
   const id=clean(b.id,80),title=clean(b.title,180),body=clean(b.body,8000),kind=clean(b.item_type,30)||"update";
   if(title.length<2||body.length<2||!["update","agenda","resolution","minutes","document"].includes(kind))return reply(400,{error:"Provide a title, content, and valid board item type."});
   const documentUrl=clean(b.document_url,500)||null;if(documentUrl){let parsed;try{parsed=new URL(documentUrl)}catch{return reply(400,{error:"Document link must be a valid HTTPS URL."})}if(parsed.protocol!=="https:")return reply(400,{error:"Document link must use HTTPS."})}
   const status=isBoardAdmin&&b.status==="published"?"published":"draft";
   const record={title,body,item_type:kind,status,created_by:uid,updated_at:new Date().toISOString(),document_url:documentUrl,staff_visible:isBoardAdmin&&status==="published"&&kind==="update"&&b.share_with_staff===true};
   let result;
   if(id){let update=db.from("zt_board_items").update(record).eq("id",id);if(!isBoardAdmin)update=update.eq("created_by",uid).eq("status","draft");const {data,error}=await update.select("*").maybeSingle();if(error||!data)throw Error("Could not update board record. Board members may only edit their own drafts.");result=data}
   else{const {data,error}=await db.from("zt_board_items").insert(record).select("*").single();if(error)throw Error("Could not save board record.");result=data}
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"board_item_saved",details:{item_id:result.id,item_type:kind,status}});
   return reply(200,{message:status==="published"?"Board item published.":"Board item saved as a draft for administrator review.",item:result});
  }
  if(action==="my-payroll"){
   const {data:entries,error}=await db.from("zt_payroll_entries").select("*,period:zt_payroll_periods(title,starts_on,ends_on,pay_date,status)").eq("staff_user_id",uid).order("created_at",{ascending:false}).limit(100);
   if(error)throw Error("Could not load your payroll statements.");
   return reply(200,{entries:entries||[]});
  }
  return reply(400,{error:"Unknown people/payroll action."});
 }catch(e){const err=e as Error&{status?:number};return reply(err.status||500,{error:err.message||"People/payroll request failed."})}
});