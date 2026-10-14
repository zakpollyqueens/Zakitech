import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply = (status:number, body:Record<string,unknown>) => new Response(JSON.stringify(body), {status,headers:cors});
type Workstation = "product_development"|"release_management"|"notifications"|"announcements"|"support_inbox"|"communication";
const workstationNames:Workstation[]=["product_development","release_management","notifications","announcements","support_inbox","communication"];
const adminRoles=["owner","vice_admin"];
const clean=(v:unknown,max=5000)=>typeof v==="string"?v.trim().slice(0,max):"";

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply(405,{error:"Method not allowed."});
 const auth=req.headers.get("Authorization")||"";
 const token=auth.startsWith("Bearer ")?auth.slice(7):"";
 if(!token) return reply(401,{error:"Sign in is required."});
 const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key) return reply(503,{error:"ZakiTech workspace backend is not configured."});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:authData,error:authError}=await db.auth.getUser(token);
 if(authError||!authData.user) return reply(401,{error:"Your session is invalid. Please sign in again."});
 const uid=authData.user.id;
 const {data:actor,error:profileError}=await db.from("zt_profiles").select("user_id,username,email,display_name,role,status,full_access,avatar_path,phone,address,legal_name,onboarding_completed_at").eq("user_id",uid).maybeSingle();
 if(profileError||!actor||actor.status!=="active") return reply(403,{error:"Your ZakiTech account is not active."});
 let actorAvatarUrl=null;if(actor.avatar_path){const {data:signed}=await db.storage.from("zt-profile-avatars").createSignedUrl(actor.avatar_path,3600);actorAvatarUrl=signed?.signedUrl||null}
 const actorProfile={...actor,avatar_url:actorAvatarUrl};
 const {data:workspaceBoardGrant}=await db.from("zt_board_members").select("access_level").eq("user_id",uid).maybeSingle();
 const hasFullWorkspace=workspaceBoardGrant?.access_level==="full_workspace";
 const isAdmin=adminRoles.includes(actor.role)||hasFullWorkspace||actor.full_access===true;
 let b:Record<string,unknown>;
 try{b=await req.json()}catch{return reply(400,{error:"Invalid request body."})}
 const action=clean(b.action,80);
 const hasAccess=async(workstation:Workstation, productId?:string|null)=>{
   if(isAdmin) return true;
   let q=db.from("zt_workstation_assignments").select("id").eq("user_id",uid).eq("workstation",workstation);
   q=productId?q.eq("product_id",productId):q.is("product_id",null);
   const {data,error}=await q.limit(1);
   if(error) throw Error("Could not verify workstation access.");
   return !!data?.length;
 };
 const requireAdmin=()=>{if(!isAdmin) throw Object.assign(Error("Only the CEO or Vice Administrator can perform this action."),{status:403})};
 const requireWorkstation=async(w:Workstation,pid?:string|null)=>{if(!await hasAccess(w,pid))throw Object.assign(Error("This workstation has not been assigned to your account."),{status:403})};
 const productExists=async(id:string)=>{const {data,error}=await db.from("zt_products").select("id").eq("id",id).maybeSingle();if(error||!data)throw Object.assign(Error("Product not found."),{status:404})};
 try{
  if(action==="bootstrap"){
   const {data:products,error:pe}=await db.from("zt_products").select("*").neq("status","archived").order("created_at",{ascending:true});
   if(pe)throw Error("Could not load the Product Hub.");
   let assignmentsQuery=db.from("zt_workstation_assignments").select("id,user_id,workstation,product_id,created_at").order("created_at",{ascending:false});
   if(!isAdmin&&actor.role!=="receptionist")assignmentsQuery=assignmentsQuery.eq("user_id",uid);
   const {data:assignments,error:ae}=await assignmentsQuery;
   if(ae)throw Error("Could not load your workstation assignments.");
   let tasksQuery=db.from("zt_tasks").select("*,product:zt_products(id,name,slug),assignee:zt_profiles!zt_tasks_assigned_to_exit_fkey(user_id,username,display_name)").order("created_at",{ascending:false}).limit(100);
   if(!isAdmin)tasksQuery=tasksQuery.eq("assigned_to",uid);
   const {data:tasks,error:te}=await tasksQuery;if(te)throw Error("Could not load tasks and assignments.");
   const taskRows=tasks||[];
   const creatorIds=[...new Set(taskRows.map((t:any)=>t.created_by).filter(Boolean))];
   const creatorMap=new Map<string,any>();
   if(creatorIds.length){
    const {data:creators}=await db.from("zt_profiles").select("user_id,username,display_name,avatar_path").in("user_id",creatorIds);
    for(const creator of creators||[]){
     let avatar_url=null;
     if(creator.avatar_path){const {data:signed}=await db.storage.from("zt-profile-avatars").createSignedUrl(creator.avatar_path,3600);avatar_url=signed?.signedUrl||null}
     creatorMap.set(creator.user_id,{user_id:creator.user_id,username:creator.username,display_name:creator.display_name,avatar_url});
    }
   }
   const tasksWithCreators=taskRows.map((t:any)=>({...t,creator:creatorMap.get(t.created_by)||null}));
   const canAnnouncements=isAdmin||await hasAccess("announcements");
   let announcementsQuery=db.from("zt_announcements").select("*").order("created_at",{ascending:false}).limit(100);
   if(!canAnnouncements)announcementsQuery=announcementsQuery.eq("status","published");
   const {data:announcements,error:ane}=await announcementsQuery;if(ane)throw Error("Could not load announcements.");
   const canNotifications=isAdmin||await hasAccess("notifications");
   let notificationsQuery=db.from("zt_notifications").select("*,product:zt_products(id,name,slug)").order("created_at",{ascending:false}).limit(100);
   if(!canNotifications)notificationsQuery=notificationsQuery.eq("status","published");
   const {data:notifications,error:ne}=await notificationsQuery;if(ne)throw Error("Could not load notifications.");
   const canSupport=isAdmin||await hasAccess("support_inbox");
   let messagesQuery=db.from("zt_product_messages").select("*,product:zt_products(id,name,slug),assignee:zt_profiles!zt_product_messages_assigned_to_fkey(user_id,username,display_name)").order("received_at",{ascending:false}).limit(100);
   if(!canSupport)messagesQuery=messagesQuery.or("assigned_to.eq."+uid+",assigned_to.is.null");
   const {data:messages,error:me}=canSupport?await messagesQuery:{data:[],error:null};if(me)throw Error("Could not load product messages.");
   let buildsQuery=db.from("zt_product_builds").select("*,product:zt_products(id,name,slug)").order("created_at",{ascending:false}).limit(100);
   if(!isAdmin){
    const allowedIds=(assignments||[]).filter(a=>a.workstation==="product_development"||a.workstation==="release_management").map(a=>a.product_id).filter(Boolean);
    buildsQuery=buildsQuery.or("status.eq.published"+(allowedIds.length?","+allowedIds.map(id=>"product_id.eq."+id).join(","):""));
   }
   const {data:builds,error:be}=await buildsQuery;if(be)throw Error("Could not load product builds.");
   let staff:any[]=[];
   if(isAdmin||actor.role==="receptionist"){
    const {data:s,error:se}=await db.from("zt_profiles").select("user_id,username,display_name,email,role,status,full_access,created_by,created_at,phone,avatar_path,onboarding_completed_at").order("display_name");
    if(se)throw Error("Could not load staff list.");
    const creatorIds=[...new Set((s||[]).map((p:any)=>p.created_by).filter(Boolean))];
    const creators=new Map<string,any>();
    if(creatorIds.length){const {data:rows}=await db.from("zt_profiles").select("user_id,username,display_name").in("user_id",creatorIds);for(const row of rows||[])creators.set(row.user_id,row)}
    staff=await Promise.all((s||[]).map(async(p:any)=>{let avatar_url=null;if(p.avatar_path){const {data:signed}=await db.storage.from("zt-profile-avatars").createSignedUrl(p.avatar_path,3600);avatar_url=signed?.signedUrl||null}const creator=creators.get(p.created_by);return {...p,avatar_url,creator_username:creator?.username||null,creator_display_name:creator?.display_name||null}}));
   }
   const communicationAccess=isAdmin||(assignments||[]).some((a:any)=>a.workstation==="communication"&&!a.product_id);
   let staffMessages:any[]=[];
   if(communicationAccess){const {data:sm,error:sme}=await db.from("zt_staff_messages").select("*,sender:zt_profiles!zt_staff_messages_sender_id_exit_fkey(user_id,username,display_name,role)").order("created_at",{ascending:false}).limit(150);if(sme)throw Error("Could not load staff communications.");staffMessages=sm||[];}
   return reply(200,{profile:actorProfile,is_admin:isAdmin,products:products||[],assignments:assignments||[],tasks:tasksWithCreators,announcements:announcements||[],notifications:notifications||[],messages:messages||[],builds:builds||[],staff,staff_messages:staffMessages});
  }
  if(action==="assign-workstation"){
   requireAdmin();
   const userId=clean(b.user_id,80), workstation=clean(b.workstation,80) as Workstation, productId=clean(b.product_id,80)||null;
   if(!userId||!workstationNames.includes(workstation))return reply(400,{error:"Choose a staff member and a valid workstation."});
   const {data:target,error:targetError}=await db.from("zt_profiles").select("user_id,status").eq("user_id",userId).maybeSingle();
   if(targetError||!target||target.status!=="active")return reply(404,{error:"Active staff account not found."});
   if(["product_development","release_management"].includes(workstation)&&!productId)return reply(400,{error:"Choose the product this workstation will manage."});
   if(!["product_development","release_management"].includes(workstation)&&productId)return reply(400,{error:"This workstation is company-wide; no product should be selected."});
   if(productId)await productExists(productId);
   const lookup=db.from("zt_workstation_assignments").select("*").eq("user_id",userId).eq("workstation",workstation);
   const {data:existing}=productId?await lookup.eq("product_id",productId).maybeSingle():await lookup.is("product_id",null).maybeSingle();
   if(existing)return reply(200,{message:"Workstation access already exists.",assignment:existing});
   const {data,error}=await db.from("zt_workstation_assignments").insert({user_id:userId,workstation,product_id:productId,assigned_by:uid}).select().single();
   if(error)throw Error("Could not assign this workstation.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:userId,event_type:"workstation_assigned",details:{workstation,product_id:productId}});
   return reply(200,{message:"Workstation assigned. It will appear when the staff member signs in or refreshes.",assignment:data});
  }
  if(action==="remove-workstation"){
   requireAdmin();
   const id=clean(b.assignment_id,80);if(!id)return reply(400,{error:"Assignment ID is required."});
   const {data:row}=await db.from("zt_workstation_assignments").select("user_id,workstation,product_id").eq("id",id).maybeSingle();
   if(!row)return reply(404,{error:"Workstation assignment not found."});
   const {error}=await db.from("zt_workstation_assignments").delete().eq("id",id);if(error)throw Error("Could not remove workstation access.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:row.user_id,event_type:"workstation_removed",details:{workstation:row.workstation,product_id:row.product_id}});
   return reply(200,{message:"Workstation access removed."});
  }
  if(action==="create-product"||action==="update-product"){
   requireAdmin();
   const id=clean(b.id,80),name=clean(b.name,120),slug=clean(b.slug,80).toLowerCase(),description=clean(b.description,3000),repo=clean(b.repository_url,500),website=clean(b.website_url,500),adminUrl=clean(b.admin_center_url,500),version=clean(b.current_version,40),status=clean(b.status,40)||"planned";
   if(name.length<2||!/^[a-z0-9-]{2,80}$/.test(slug)||!["planned","in_development","in_review","launched","paused","archived"].includes(status))return reply(400,{error:"Provide a valid product name, slug and status."});
   const values={name,slug,description,repository_url:repo||null,website_url:website||null,admin_center_url:adminUrl||null,current_version:version||null,status,updated_at:new Date().toISOString()};
   const previous=action==="update-product"?await db.from("zt_products").select("id,name,status,current_version").eq("id",id).maybeSingle():{data:null,error:null};
   if(action==="update-product"&&(!previous.data||previous.error))return reply(404,{error:"Product not found."});
   const result=action==="create-product"?await db.from("zt_products").insert({...values,created_by:uid}).select().single():await db.from("zt_products").update(values).eq("id",id).select().single();
   if(result.error||!result.data)throw Error("Could not save product. Check that its slug is unique.");
   if(action==="create-product"){
    const body="🆕 PRODUCT CREATED\n"+result.data.name+" has been registered in the ZakiTech Product Hub.\nLifecycle: "+status.replaceAll("_"," ")+"\n"+(version?"Version: "+version+"\n":"")+"The team can now follow its assignments and progress in the Product Hub.";
    const {error:postError}=await db.from("zt_staff_messages").insert({sender_id:uid,message_type:"chat",title:null,body,priority:"normal",due_at:null,status:"open"});
    if(postError)throw Error("Product was saved, but the creation announcement could not be posted.");
    await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"product_created_and_announced",details:{product_id:result.data.id,product_name:name,status}});
   }else if(previous.data.status!==status){
    const body="📣 PRODUCT STATUS UPDATE\n"+result.data.name+"\nPrevious status: "+previous.data.status.replaceAll("_"," ")+"\nNew status: "+status.replaceAll("_"," ")+"\n"+(version?"Version: "+version+"\n":"")+"This lifecycle change was recorded by ZakiTech leadership in the Product Hub.";
    const {error:postError}=await db.from("zt_staff_messages").insert({sender_id:uid,message_type:"chat",title:null,body,priority:"normal",due_at:null,status:"open"});
    if(postError)throw Error("Product status was saved, but its group announcement could not be posted.");
    await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"product_status_changed_and_announced",details:{product_id:result.data.id,product_name:name,previous_status:previous.data.status,new_status:status}});
   }
   return reply(200,{message:action==="create-product"?"Product created and announced to the staff group.":"Product saved.",product:result.data});
  }
  if(action==="create-task"){
   requireAdmin();
   const title=clean(b.title,160),description=clean(b.description,5000),assignedTo=clean(b.assigned_to,80),productId=clean(b.product_id,80)||null,priority=clean(b.priority,20)||"normal",due=clean(b.due_at,60)||null;
   if(title.length<2||!assignedTo||!["low","normal","high","urgent"].includes(priority))return reply(400,{error:"Provide a task title, assignee and valid priority."});
   const {data:target}=await db.from("zt_profiles").select("user_id,status").eq("user_id",assignedTo).maybeSingle();if(!target||target.status!=="active")return reply(400,{error:"Choose an active staff member."});
   if(productId)await productExists(productId);
   const {data,error}=await db.from("zt_tasks").insert({title,description,assigned_to:assignedTo,created_by:uid,product_id:productId,priority,due_at:due, status:"assigned"}).select().single();
   if(error)throw Error("Could not create the task assignment.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:assignedTo,event_type:"task_assigned",details:{task_id:data.id,title,product_id:productId}});
   return reply(201,{message:"Task assigned.",task:data});
  }
  if(action==="update-task"){
   const id=clean(b.id,80),status=clean(b.status,40),note=clean(b.submission_note,5000);
   const {data:task,error:te}=await db.from("zt_tasks").select("id,assigned_to,status").eq("id",id).maybeSingle();
   if(te||!task)return reply(404,{error:"Task not found."});
   if(isAdmin){
    if(!["assigned","in_progress","submitted","completed","cancelled"].includes(status))return reply(400,{error:"Invalid task status."});
    const updates:any={status,updated_at:new Date().toISOString()};
    if(status==="completed")updates.completed_at=new Date().toISOString();
    const {error}=await db.from("zt_tasks").update(updates).eq("id",id);if(error)throw Error("Could not update task.");
   }else{
    if(task.assigned_to!==uid)return reply(403,{error:"You can only update tasks assigned to you."});
    if(!["in_progress","submitted"].includes(status))return reply(403,{error:"Staff can mark their task in progress or submit it for review."});
    const updates:any={status,submission_note:note,updated_at:new Date().toISOString()};
    if(status==="submitted")updates.submitted_at=new Date().toISOString();
    const {error}=await db.from("zt_tasks").update(updates).eq("id",id);if(error)throw Error("Could not update task.");
   }
   return reply(200,{message:"Task updated."});
  }
  if(action==="save-announcement"){
   await requireWorkstation("announcements");
   const id=clean(b.id,80),title=clean(b.title,160),body=clean(b.body,8000),audience=clean(b.audience,30)||"staff",status=clean(b.status,30)||"draft";
   if(title.length<2||body.length<2||!["staff","all_company"].includes(audience)||!["draft","published","archived"].includes(status))return reply(400,{error:"Enter a valid announcement title, message, audience and status."});
   const values:any={title,body,audience,status,updated_at:new Date().toISOString()};
   if(status==="published"){values.published_by=uid;values.published_at=new Date().toISOString();}
   const result=id?await db.from("zt_announcements").update(values).eq("id",id).select().single():await db.from("zt_announcements").insert({...values,created_by:uid}).select().single();
   if(result.error)throw Error("Could not save announcement.");
   return reply(200,{message:status==="published"?"Announcement published.":"Announcement saved.",announcement:result.data});
  }
  if(action==="save-notification"){
   const id=clean(b.id,80),productId=clean(b.product_id,80)||null,title=clean(b.title,160),body=clean(b.body,5000),type=clean(b.notification_type,40)||"general",audience=clean(b.audience,40)||"product_users",status=clean(b.status,30)||"draft";
   await requireWorkstation("notifications");
   if(title.length<2||body.length<2||!["general","update","maintenance","security","announcement"].includes(type)||!["product_users","staff","all_company"].includes(audience)||!["draft","published","archived"].includes(status))return reply(400,{error:"Enter a valid notification title, message, type, audience and status."});
   if(productId)await productExists(productId);
   const values:any={product_id:productId,title,body,notification_type:type,audience,status,updated_at:new Date().toISOString()};
   if(status==="published")values.published_at=new Date().toISOString();
   const result=id?await db.from("zt_notifications").update(values).eq("id",id).select().single():await db.from("zt_notifications").insert({...values,created_by:uid}).select().single();
   if(result.error)throw Error("Could not save notification.");
   return reply(200,{message:status==="published"?"Notification published.":"Notification saved.",notification:result.data});
  }
  if(action==="prepare-build"){
   const productId=clean(b.product_id,80),version=clean(b.version,40),title=clean(b.title,140),description=clean(b.description,1500),notes=clean(b.release_notes,3000),channel=clean(b.channel,20)||"stable",fileName=clean(b.file_name,180),fileSize=Number(b.file_size||0);
   await requireWorkstation("product_development",productId);
   await productExists(productId);
   if(!/^[a-zA-Z0-9._-]{1,40}$/.test(version)||title.length<2||!fileName||fileSize<1||fileSize>104857600||!["stable","beta","testing"].includes(channel)||!/\.(apk|aab|zip)$/i.test(fileName))return reply(400,{error:"Provide a valid version, title and APK/AAB/ZIP package up to 100 MB."});
   const path=productId+"/"+crypto.randomUUID()+"/"+fileName.replace(/[^a-zA-Z0-9._-]/g,"_");
   const {data,error}=await db.storage.from("zt-build-staging").createSignedUploadUrl(path);
   if(error||!data)throw Error("Could not prepare a secure upload.");
   return reply(200,{path,token:data.token,signed_url:data.signedUrl,metadata:{product_id:productId,version,title,description,release_notes:notes,channel,file_name:fileName,file_size:fileSize}});
  }
  if(action==="submit-build"){
   const productId=clean(b.product_id,80),version=clean(b.version,40),title=clean(b.title,140),description=clean(b.description,1500),notes=clean(b.release_notes,3000),channel=clean(b.channel,20)||"stable",path=clean(b.storage_path,500),fileName=clean(b.file_name,180),fileSize=Number(b.file_size||0);
   await requireWorkstation("product_development",productId);
   if(!path.startsWith(productId+"/")||path.includes("..")||fileSize<1||fileSize>104857600)return reply(400,{error:"Invalid uploaded build metadata."});
   const {data:object,error:oe}=await db.storage.from("zt-build-staging").list(path.split("/").slice(0,2).join("/"),{search:path.split("/").pop(),limit:10});
   if(oe||!object?.some(x=>x.name===path.split("/").pop()))return reply(400,{error:"The uploaded build could not be verified in private staging."});
   const {data,error}=await db.from("zt_product_builds").insert({product_id:productId,version,title,description,release_notes:notes,channel,storage_path:path,file_name:fileName,file_size:fileSize,status:"submitted",submitted_by:uid}).select().single();
   if(error)throw Error("Could not submit this build. Check whether this version and channel already exist.");
   await db.from("zt_products").update({status:"in_review",updated_at:new Date().toISOString()}).eq("id",productId);
   return reply(201,{message:"Build submitted for CEO/Vice Administrator verification. It is not publicly downloadable until approved and published.",build:data});
  }
  if(action==="review-build"){
   requireAdmin();
   const id=clean(b.id,80),decision=clean(b.decision,30),note=clean(b.review_note,1000);
   if(!["approved","rejected","published"].includes(decision))return reply(400,{error:"Choose approve, reject or publish."});
   const {data:build,error:be}=await db.from("zt_product_builds").select("*").eq("id",id).maybeSingle();if(be||!build)return reply(404,{error:"Build not found."});
   if(decision==="published"){
    if(build.status!=="approved")return reply(409,{error:"Only an approved build can be published."});
    const destination=build.product_id+"/"+build.version+"/"+build.file_name;
    const {error:copyError}=await db.storage.from("zt-build-staging").copy(build.storage_path,destination,{destinationBucket:"zt-product-releases"});
    if(copyError){
      const {data:existing}=await db.storage.from("zt-product-releases").list(build.product_id+"/"+build.version,{search:build.file_name,limit:5});
      if(!existing?.some(x=>x.name===build.file_name))throw Error("Could not publish the package to public downloads. "+copyError.message);
    }
    const {data:pub}=db.storage.from("zt-product-releases").getPublicUrl(destination);
    const {error:upError}=await db.from("zt_product_builds").update({status:"published",storage_path:destination,reviewed_by:uid,review_note:note||build.review_note,reviewed_at:new Date().toISOString(),published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
    if(upError)throw Error("Package uploaded, but release metadata could not be published. Contact the administrator.");
    await db.from("zt_products").update({current_version:build.version,status:"launched",updated_at:new Date().toISOString()}).eq("id",build.product_id);
    await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"product_release_published",details:{product_id:build.product_id,build_id:id,version:build.version,download_url:pub.publicUrl}});
    return reply(200,{message:"Release published and available for download.",download_url:pub.publicUrl});
   }
   if(decision==="approved"&&build.status!=="submitted")return reply(409,{error:"Only submitted builds can be approved."});
   if(decision==="rejected"&&build.status!=="submitted")return reply(409,{error:"Only submitted builds can be rejected."});
   const {error}=await db.from("zt_product_builds").update({status:decision,reviewed_by:uid,review_note:note||null,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
   if(error)throw Error("Could not save review decision.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"product_build_reviewed",details:{build_id:id,decision,review_note:note}});
   return reply(200,{message:decision==="approved"?"Build approved. The CEO/Vice Administrator can now publish it.": "Build rejected with review feedback."});
  }
  if(action==="update-message"){
   await requireWorkstation("support_inbox");
   const id=clean(b.id,80),status=clean(b.status,30),assignee=clean(b.assigned_to,80)||uid;
   if(!["new","in_progress","resolved","closed"].includes(status))return reply(400,{error:"Invalid message status."});
   const {error}=await db.from("zt_product_messages").update({status,assigned_to:assignee,updated_at:new Date().toISOString()}).eq("id",id);
   if(error)throw Error("Could not update message.");
   return reply(200,{message:"Product message updated."});
  }
  if(action==="create-message"){
   if(!isAdmin)await requireWorkstation("support_inbox");
   const productId=clean(b.product_id,80),sender=clean(b.sender_name,120)||"ZakiChat user",email=clean(b.sender_email,254),subject=clean(b.subject,200)||"Product feedback",message=clean(b.message,10000);
   if(!productId||message.length<1)return reply(400,{error:"Choose a product and enter the message."});
   await productExists(productId);
   const {data,error}=await db.from("zt_product_messages").insert({product_id:productId,sender_name:sender,sender_email:email||null,subject,message,source:"manual",status:"new"}).select().single();
   if(error)throw Error("Could not save the message.");
   return reply(201,{message:"Product message added to the inbox.",record:data});
  }
  if(action==="send-staff-message"){
   if(!isAdmin)await requireWorkstation("communication");
   const type=clean(b.message_type,20)||"chat",title=clean(b.title,160),body=clean(b.body,8000),priority=clean(b.priority,20)||"normal",due=clean(b.due_at,60)||null;
   if(!["chat","task"].includes(type)||body.length<1)return reply(400,{error:"Enter a message or task description."});
   if(type==="task"){requireAdmin();if(title.length<2||!["low","normal","high","urgent"].includes(priority))return reply(400,{error:"Company-wide tasks need a title and valid priority."});}
   const {data,error}=await db.from("zt_staff_messages").insert({sender_id:uid,message_type:type,title:type==="task"?title:null,body,priority:type==="task"?priority:"normal",due_at:type==="task"?due:null,status:"open"}).select("*,sender:zt_profiles!zt_staff_messages_sender_id_exit_fkey(user_id,username,display_name,role)").single();
   if(error)throw Error("Could not post to staff communications.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:type==="task"?"staff_broadcast_task_created":"staff_chat_message_sent",details:{message_id:data.id,message_type:type,title:type==="task"?title:null}});
   return reply(201,{message:type==="task"?"Company-wide task posted to the staff group.":"Message sent to the staff group.",record:data});
  }
  if(action==="set-product-lifecycle"){
   requireAdmin();
   const id=clean(b.id,80),status=clean(b.status,40),deploymentUrl=clean(b.deployment_url,500),version=clean(b.current_version,40);
   if(!id||!["planned","in_development","in_review","paused","launched"].includes(status))return reply(400,{error:"Choose a valid product and lifecycle status."});
   if(status==="launched"&&(!deploymentUrl||!/^https?:\/\//i.test(deploymentUrl)))return reply(400,{error:"To record deployment, provide the live deployment URL (https://...)."});
   const {data:old,error:oldError}=await db.from("zt_products").select("id,name,status,current_version,website_url").eq("id",id).maybeSingle();
   if(oldError||!old)return reply(404,{error:"Product not found."});
   const changes:any={status,updated_at:new Date().toISOString()};
   if(version)changes.current_version=version;
   if(status==="launched")changes.website_url=deploymentUrl;
   const {data:product,error}=await db.from("zt_products").update(changes).eq("id",id).select().single();
   if(error||!product)throw Error("Could not record product lifecycle change.");
   const isDeploy=status==="launched";
   const body=isDeploy
    ?"🚀 PRODUCT DEPLOYMENT RECORDED\n"+product.name+" has been marked deployed by ZakiTech leadership.\nLive URL: "+deploymentUrl+"\nVersion: "+(product.current_version||"not provided")+"\nThis is the deployment record submitted by the authorized administrator."
    :"📣 PRODUCT STATUS UPDATE\n"+product.name+"\nPrevious status: "+old.status.replaceAll("_"," ")+"\nNew status: "+status.replaceAll("_"," ")+"\nThis lifecycle change was recorded in the Product Hub.";
   const {data:post,error:postError}=await db.from("zt_staff_messages").insert({sender_id:uid,message_type:"chat",title:null,body,priority:"normal",due_at:null,status:"open"}).select("id").single();
   if(postError)throw Error("Lifecycle was saved, but the staff group announcement failed. Please retry posting the announcement.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:isDeploy?"product_deployment_recorded":"product_lifecycle_updated",details:{product_id:product.id,product_name:product.name,previous_status:old.status,new_status:status,deployment_url:isDeploy?deploymentUrl:null,version:product.current_version,staff_message_id:post.id}});
   return reply(200,{message:isDeploy?"Deployment record saved and announced to the ZakiTech Group Chat.":"Product lifecycle updated and announced to the ZakiTech Group Chat.",product});
  }
  if(action==="post-product-review"){
   requireAdmin();
   const productId=clean(b.product_id,80),title=clean(b.title,180),body=clean(b.body,5000),recognition=clean(b.recognition,2000),staffIds=Array.isArray(b.staff_ids)?[...new Set(b.staff_ids.map((x:unknown)=>clean(x,80)).filter(Boolean))].slice(0,30):[];
   if(!productId||title.length<3||body.length<5)return reply(400,{error:"Choose a product and provide a review heading and review."});
   const {data:product,error:productError}=await db.from("zt_products").select("id,name,status,current_version").eq("id",productId).maybeSingle();
   if(productError||!product)return reply(404,{error:"Product not found."});
   let responsible:string[]=[];
   if(staffIds.length){const {data:people,error:peopleError}=await db.from("zt_profiles").select("user_id,display_name,username,status").in("user_id",staffIds);if(peopleError||!people||people.length!==staffIds.length||people.some((p:any)=>p.status!=="active"))return reply(400,{error:"Choose only active staff members that exist in the company directory."});responsible=people.map((p:any)=>(p.display_name||p.username)+" (@"+p.username+")");}
   const reviewBody="[PRODUCT_REVIEW]\n🏆 "+product.name+" — "+title+"\nStatus: "+product.status.replaceAll("_"," ")+" · Version: "+(product.current_version||"not set")+"\n"+(responsible.length?"Recognized staff: "+responsible.join(", ")+"\n":"")+"\nReview: "+body+(recognition?"\n\n🎉 Team congratulations: "+recognition:"");
   const {data,error}=await db.from("zt_staff_messages").insert({sender_id:uid,message_type:"chat",title:null,body:reviewBody,priority:"normal",due_at:null,status:"open"}).select("*,sender:zt_profiles!zt_staff_messages_sender_id_exit_fkey(user_id,username,display_name,role)").single();
   if(error)throw Error("Could not publish the product review to the staff group.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"product_review_published",details:{product_id:product.id,product_name:product.name,title,recognition:!!recognition,message_id:data.id}});
   return reply(201,{message:"Product review posted to the staff group.",record:data});
  }
  if(action==="update-staff-task"){
   requireAdmin();
   const id=clean(b.id,80),status=clean(b.status,20);
   if(!["completed","open","cancelled"].includes(status))return reply(400,{error:"Choose a valid task status."});
   const {data:row,error:lookupError}=await db.from("zt_staff_messages").select("id,message_type").eq("id",id).maybeSingle();
   if(lookupError||!row||row.message_type!=="task")return reply(404,{error:"Company-wide task not found."});
   const now=new Date().toISOString();
   const {error}=await db.from("zt_staff_messages").update({status,updated_at:now,completed_by:status==="completed"?uid:null,completed_at:status==="completed"?now:null}).eq("id",id);
   if(error)throw Error("Could not update company-wide task.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,event_type:"staff_broadcast_task_updated",details:{message_id:id,status}});
   return reply(200,{message:"Company-wide task updated."});
  }
  if(action==="my-attendance"){
   const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Kampala",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
   const date=parts.find(x=>x.type==="year")!.value+"-"+parts.find(x=>x.type==="month")!.value+"-"+parts.find(x=>x.type==="day")!.value;
   const {data,error}=await db.from("zt_attendance").select("*").eq("user_id",uid).eq("work_date",date).maybeSingle();
   if(error)throw Error("Could not load your attendance record.");
   return reply(200,{date,attendance:data||null});
  }
  if(action==="check-in"||action==="check-out"){
   const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Kampala",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
   const date=parts.find(x=>x.type==="year")!.value+"-"+parts.find(x=>x.type==="month")!.value+"-"+parts.find(x=>x.type==="day")!.value;
   const note=clean(b.note,500);
   if(action==="check-in"){
    const {data:existing,error:lookupError}=await db.from("zt_attendance").select("id,status").eq("user_id",uid).eq("work_date",date).maybeSingle();
    if(lookupError)throw Error("Could not check your attendance status.");
    if(existing)return reply(409,{error:existing.status==="checked_in"?"You have already checked in today.":"Today's attendance has already been completed."});
    const {data,error}=await db.from("zt_attendance").insert({user_id:uid,work_date:date,checkin_note:note||null,status:"checked_in"}).select().single();
    if(error)throw Error("Could not record check-in. If you already checked in, refresh the page.");
    await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:uid,event_type:"staff_checked_in",details:{attendance_id:data.id,work_date:date}});
    return reply(201,{message:"Check-in recorded.",attendance:data});
   }
   const targetId=clean(b.user_id,80)||uid;
   if(targetId!==uid&&!isAdmin&&actor.role!=="receptionist")return reply(403,{error:"You can only check out your own account."});
   const {data:existing,error:lookupError}=await db.from("zt_attendance").select("*").eq("user_id",targetId).eq("work_date",date).maybeSingle();
   if(lookupError||!existing)return reply(404,{error:"No check-in record was found for today."});
   if(existing.status==="checked_out")return reply(409,{error:"This attendance record is already checked out."});
   const {data,error}=await db.from("zt_attendance").update({checked_out_at:new Date().toISOString(),checkout_note:note||null,status:"checked_out",updated_at:new Date().toISOString()}).eq("id",existing.id).eq("status","checked_in").select().single();
   if(error||!data)throw Error("Could not record check-out.");
   await db.from("zt_audit_events").insert({actor_user_id:uid,target_user_id:targetId,event_type:"staff_checked_out",details:{attendance_id:data.id,work_date:date}});
   return reply(200,{message:"Check-out recorded.",attendance:data});
  }
  if(action==="list-attendance"){
   if(!isAdmin&&actor.role!=="receptionist")return reply(403,{error:"Attendance reports are available to the CEO, Vice Administrator, and Receptionist."});
   const date=clean(b.date,10);
   let query=db.from("zt_attendance").select("*,staff:zt_profiles!zt_attendance_user_id_fkey(user_id,username,display_name,role,avatar_path)").order("checked_in_at",{ascending:false}).limit(200);
   if(date&&/^\\d{4}-\\d{2}-\\d{2}$/.test(date))query=query.eq("work_date",date);
   const {data,error}=await query;if(error)throw Error("Could not load staff attendance.");
   const records=await Promise.all((data||[]).map(async(row:any)=>{let avatar_url=null;if(row.staff?.avatar_path){const {data:signed}=await db.storage.from("zt-profile-avatars").createSignedUrl(row.staff.avatar_path,3600);avatar_url=signed?.signedUrl||null}return {...row,staff:row.staff?{...row.staff,avatar_url}:null}}));
   return reply(200,{records});
  }
  return reply(400,{error:"Unknown workspace action."});
 }catch(e){
  const err=e as Error & {status?:number};
  return reply(err.status||500,{error:err.message||"Workspace action failed."});
 }
});
