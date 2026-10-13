(()=>{"use strict";
for(const src of ["assets/js/workspace-preferences.js","assets/js/workspace-navigation.js"]){if(!document.querySelector('script[src="'+src+'"]')){const tag=document.createElement("script");tag.src=src;tag.async=false;document.head.append(tag)}}
const client=window.ZakiTechSupabase;if(!client)return;
const $=id=>document.getElementById(id);
let state={profile:null,is_admin:false,products:[],assignments:[],tasks:[],announcements:[],notifications:[],messages:[],builds:[],staff:[]};
const admin=()=>state.is_admin;
const assigned=(key,productId=null)=>admin()||state.assignments.some(a=>a.workstation===key&&(productId?a.product_id===productId:a.product_id==null));
const say=(id,message,kind="")=>{const el=$(id);if(el){el.textContent=message;el.className="inline-message "+kind}};
async function call(body){const {data,error}=await client.functions.invoke("zakitech-workspace",{body});if(error){let detail=error.message||"Request failed.";try{if(error.context&&typeof error.context.json==="function"){const b=await error.context.json();detail=b.error||detail}}catch(_){}throw Error(detail)}if(data?.error)throw Error(data.error);return data}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text instanceof Node)el.append(text);else if(text!==undefined)el.textContent=String(text);return el}
function button(label,fn,cls="small-action"){const b=node("button",cls,label);b.type="button";b.addEventListener("click",fn);return b}
function link(label,url){const a=node("a","small-action",label);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a}
function empty(container,message){container.replaceChildren(node("div","module-empty",message))}
function productName(id){return state.products.find(p=>p.id===id)?.name||"Company-wide"}
function staffName(id){const s=state.staff.find(p=>p.user_id===id);return s?.display_name||s?.username||"Staff member"}
function fillSelect(el,rows,placeholder,selected){if(!el)return;el.replaceChildren();if(placeholder!==null){const op=node("option","",placeholder);op.value="";el.append(op)}rows.forEach(row=>{const op=node("option","",row.label);op.value=row.value;if(row.value===selected)op.selected=true;el.append(op)})}
function productOptions(){return state.products.filter(p=>p.status!=="archived").map(p=>({value:p.id,label:p.name+" · "+p.status.replaceAll("_"," ")}))}
function assignedProducts(key){if(admin())return productOptions();const ids=new Set(state.assignments.filter(a=>a.workstation===key&&a.product_id).map(a=>a.product_id));return productOptions().filter(p=>ids.has(p.value))}
function safeDate(v){if(!v)return "No date";const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleString()}
function actionsForProduct(p){const actions=node("div","module-actions");const technicalAccess=admin()||assigned("product_development",p.id)||assigned("release_management",p.id);if(p.repository_url&&technicalAccess)actions.append(link("Open repository ↗",p.repository_url));if(p.website_url)actions.append(link("Open website ↗",p.website_url));if(p.admin_center_url&&technicalAccess)actions.append(link("Admin control center ↗",p.admin_center_url));if(admin())actions.append(button("Edit product",()=>editProduct(p)));return actions}
function renderProducts(){const grid=$("productGrid");grid.replaceChildren();if(!state.products.length){empty(grid,"No company products have been registered yet.");return}state.products.forEach(p=>{const card=node("article","module-card");const icon=node("span","tile-icon","◈");const kicker=node("div","module-kicker",p.slug==="zakichat"?"PRODUCT #1":"COMPANY PRODUCT");const title=node("h3","",p.name);const version=node("div","module-meta");version.append(node("strong","",p.current_version||"Version not set"),node("span","module-status",p.status.replaceAll("_"," ")));const desc=node("p","",p.description||"No product description yet.");const details=node("div","module-meta","Repository: "+(p.repository_url?"connected":"not configured")+" · Added "+safeDate(p.created_at));card.append(icon,kicker,title,version,desc,details,actionsForProduct(p));grid.append(card)})}
function editProduct(p){$("productId").value=p.id;$("productName").value=p.name;$("productSlug").value=p.slug;$("productDescription").value=p.description||"";$("productRepo").value=p.repository_url||"";$("productWebsite").value=p.website_url||"";$("productAdminUrl").value=p.admin_center_url||"";$("productVersion").value=p.current_version||"";$("productStatus").value=p.status;$("productEditorWrap").hidden=false;$("productEditorWrap").scrollIntoView({behavior:"smooth",block:"start"})}
function renderTasks(){const box=$("taskList");box.replaceChildren();if(!state.tasks.length){empty(box,"No tasks are assigned to this account yet.");return}state.tasks.forEach(t=>{const card=node("article","module-item");const title=node("h3","",t.title);const sender=node("div","task-sender");if(t.creator?.avatar_url){const img=node("img","task-sender-avatar");img.src=t.creator.avatar_url;img.alt="";img.loading="lazy";sender.append(img)}else sender.append(node("span","task-sender-avatar",String(t.creator?.display_name||"Z").trim().split(/\\s+/).slice(0,2).map(s=>s[0]||"").join("").toUpperCase()||"Z"));sender.append(node("span","", "Assigned by "+(t.creator?.display_name||t.creator?.username||"ZakiTech leadership")));const meta=node("div","module-meta");meta.append(node("span","module-status",t.status.replaceAll("_"," ")),node("span","module-status",t.priority+" priority"),node("span","",t.product?.name||productName(t.product_id)),node("span","", "Due: "+safeDate(t.due_at)));if(admin())meta.append(node("span","", "Assigned to "+staffName(t.assigned_to)));const desc=node("p","module-message",t.description||"No extra instructions.");card.append(sender,title,meta,desc);if(t.submission_note)card.append(node("p","module-message","Staff submission: "+t.submission_note));const controls=node("div","module-actions");if(admin()&&["assigned","in_progress","submitted"].includes(t.status))controls.append(button("Mark complete",async()=>{try{await call({action:"update-task",id:t.id,status:"completed"});await refresh()}catch(e){pageMessage(e.message,"error")}}));if(admin()&&t.status!=="cancelled"&&t.status!=="completed")controls.append(button("Cancel task",async()=>{try{await call({action:"update-task",id:t.id,status:"cancelled"});await refresh()}catch(e){pageMessage(e.message,"error")}}));if(!admin()&&t.assigned_to===state.profile.user_id&&["assigned","in_progress"].includes(t.status)){controls.append(button("Start / continue",async()=>{try{await call({action:"update-task",id:t.id,status:"in_progress"});await refresh()}catch(e){pageMessage(e.message,"error")}}));const note=node("textarea","review-note");note.placeholder="Describe your work before submitting…";note.value=t.submission_note||"";controls.append(note,button("Submit for review",async()=>{try{await call({action:"update-task",id:t.id,status:"submitted",submission_note:note.value});await refresh()}catch(e){pageMessage(e.message,"error")}}))}if(controls.childElementCount)card.append(controls);box.append(card)})}
function renderAnnouncements(){const box=$("announcementList");box.replaceChildren();if(!state.announcements.length){empty(box,"No announcements are available yet.");return}state.announcements.forEach(a=>{const card=node("article","module-item");card.append(node("div","module-kicker",a.audience.replaceAll("_"," ")),node("h3","",a.title),node("div","module-meta",node("span","module-status",a.status)),node("p","module-message",a.body),node("div","module-meta","Updated "+safeDate(a.updated_at||a.created_at)));if(assigned("announcements")){const controls=node("div","module-actions");controls.append(button("Edit",()=>{ $("announcementId").value=a.id;$("announcementTitle").value=a.title;$("announcementBody").value=a.body;$("announcementAudience").value=a.audience;$("announcementStatus").value=a.status;$("announcementForm").scrollIntoView({behavior:"smooth",block:"start"})}));if(a.status!=="archived")controls.append(button("Archive",async()=>{try{await call({action:"save-announcement",id:a.id,title:a.title,body:a.body,audience:a.audience,status:"archived"});await refresh()}catch(e){say("announcementMessage",e.message,"error")}}));card.append(controls)}box.append(card)})}
function renderNotifications(){const box=$("notificationList");box.replaceChildren();if(!state.notifications.length){empty(box,"No notifications are available yet.");return}state.notifications.forEach(n=>{const card=node("article","module-item");const meta=node("div","module-meta");meta.append(node("span","module-status",n.status),node("span","",n.audience.replaceAll("_"," ")));card.append(node("div","module-kicker",n.notification_type+" · "+(n.product?.name||productName(n.product_id))),node("h3","",n.title),meta,node("p","module-message",n.body),node("div","module-meta","Updated "+safeDate(n.updated_at||n.created_at)));if(assigned("notifications")){const controls=node("div","module-actions");controls.append(button("Edit",()=>{$("notificationId").value=n.id;$("notificationProduct").value=n.product_id||"";$("notificationType").value=n.notification_type;$("notificationAudience").value=n.audience;$("notificationTitle").value=n.title;$("notificationBody").value=n.body;$("notificationStatus").value=n.status;$("notificationForm").scrollIntoView({behavior:"smooth",block:"start"})}));if(n.status!=="archived")controls.append(button("Archive",async()=>{try{await call({action:"save-notification",id:n.id,product_id:n.product_id,title:n.title,body:n.body,notification_type:n.notification_type,audience:n.audience,status:"archived"});await refresh()}catch(e){say("notificationMessage",e.message,"error")}}));card.append(controls)}box.append(card)})}
function makeBuildCard(b,forQueue=false){const card=node("article","module-item");const product=b.product?.name||productName(b.product_id);const meta=node("div","module-meta");meta.append(node("span","module-status",b.status.replaceAll("_"," ")),node("span","",b.file_name),node("span","",Math.round((b.file_size||0)/1024)+" KB"),node("span","", "Submitted "+safeDate(b.submitted_at)));card.append(node("div","module-kicker",product+" · "+b.channel),node("h3","",b.version+" — "+b.title),meta);if(b.description)card.append(node("p","",b.description));if(b.release_notes)card.append(node("p","module-message","Release notes: "+b.release_notes));if(b.review_note)card.append(node("p","module-message","Review note: "+b.review_note));const controls=node("div","module-actions");if(b.status==="published"&&b.storage_path){const {data}=client.storage.from("zt-product-releases").getPublicUrl(b.storage_path);controls.append(link("Download published build ↗",data.publicUrl))}if(admin()&&forQueue&&b.status==="submitted"){const note=node("textarea","review-note");note.placeholder="Optional review feedback";controls.append(note,button("Approve",async()=>{try{await call({action:"review-build",id:b.id,decision:"approved",review_note:note.value});await refresh()}catch(e){pageMessage(e.message,"error")}}),button("Reject",async()=>{try{await call({action:"review-build",id:b.id,decision:"rejected",review_note:note.value});await refresh()}catch(e){pageMessage(e.message,"error")} }))}if(admin()&&forQueue&&b.status==="approved")controls.append(button("Publish public release",async()=>{if(!confirm("Publish "+b.version+" as a public download?"))return;try{await call({action:"review-build",id:b.id,decision:"published"});await refresh()}catch(e){pageMessage(e.message,"error")}}));if(controls.childElementCount)card.append(controls);return card}
function renderBuilds(){
 const dev=$("developmentBuildList"),queue=$("releaseBuildList");dev.replaceChildren();queue.replaceChildren();
 const visible=state.builds.filter(b=>b.status!=="archived");
 const stages=[
  {key:"submitted",title:"Awaiting review",note:"Submitted builds waiting for leadership"},
  {key:"approved",title:"Approved",note:"Verified builds awaiting publication"},
  {key:"published",title:"Published",note:"Public releases"},
  {key:"rejected",title:"Needs changes",note:"Builds requiring updates"}
 ];
 const board=node("div","build-board");
 let devCount=0,queueCount=0;
 const columns=new Map();
 stages.forEach(stage=>{
  const column=node("section","build-board-column build-stage-"+stage.key);
  const head=node("div","build-board-heading");
  head.append(node("div","build-board-stage-dot"),node("div","build-board-heading-copy"));
  head.lastChild.append(node("strong","",stage.title),node("small","",stage.note));
  const cards=node("div","build-board-cards");
  column.append(head,cards);board.append(column);columns.set(stage.key,cards);
 });
 visible.forEach(b=>{
  if(assigned("product_development",b.product_id)||admin()){
   const target=columns.get(b.status)||columns.get("submitted");
   target.append(makeBuildCard(b,false));devCount++;
  }
  if(admin()){queue.append(makeBuildCard(b,true));queueCount++}
 });
 stages.forEach(stage=>{
  const cards=columns.get(stage.key);
  if(!cards.childElementCount)cards.append(node("div","build-board-empty","No builds in this stage."));
 });
 if(devCount)dev.append(board);else empty(dev,"No builds are available for your assigned product workstations.");
 if(!admin()||!queueCount)empty(queue,"Release approval and publishing are reserved for the CEO and Vice Administrator.");
}
function renderMessages(){const box=$("messageList");box.replaceChildren();if(!state.messages.length){empty(box,"No product messages have arrived in this inbox yet.");return}state.messages.forEach(m=>{const card=node("article","module-item");const meta=node("div","module-meta");meta.append(node("strong","",m.sender_name),node("span","",m.sender_email||"Email not provided"),node("span","module-status",m.status),node("span","",safeDate(m.received_at)));card.append(node("div","module-kicker",(m.product?.name||productName(m.product_id))+" · "+m.source.replaceAll("_"," ")),node("h3","",m.subject),meta);card.append(node("p","module-message",m.message));const controls=node("div","module-actions");const status=node("select");["new","in_progress","resolved","closed"].forEach(v=>{const o=node("option","",v.replaceAll("_"," "));o.value=v;o.selected=v===m.status;status.append(o)});controls.append(status,button("Save status",async()=>{try{await call({action:"update-message",id:m.id,status:status.value});await refresh()}catch(e){say("inboxMessage",e.message,"error")}}));card.append(controls);box.append(card)})}
function renderWorkstations(){if(!admin())return;const staffSelect=$("workstationStaff");fillSelect(staffSelect,state.staff.filter(s=>s.status==="active").map(s=>({value:s.user_id,label:s.display_name+" (@"+s.username+")"})),"Choose staff member");fillSelect($("taskAssignee"),state.staff.filter(s=>s.status==="active").map(s=>({value:s.user_id,label:s.display_name+" (@"+s.username+")"})),"Choose staff member");const assignments=$("workstationAssignments");assignments.replaceChildren();if(!state.assignments.length){empty(assignments,"No staff workstations have been assigned yet.");return}const labels={product_development:"Product development",release_management:"Release management",notifications:"Notifications",announcements:"Announcements",support_inbox:"Product messages / support inbox"};state.assignments.forEach(a=>{const row=node("article","module-item");const meta=node("div","module-meta");meta.append(node("span","module-status",labels[a.workstation]||a.workstation),node("span","",a.product_id?productName(a.product_id):"Company-wide"));row.append(node("h3","",staffName(a.user_id)),meta,node("p","", "Access assigned "+safeDate(a.created_at)));const controls=node("div","module-actions");controls.append(button("Remove access",async()=>{if(!confirm("Remove this workstation assignment?"))return;try{await call({action:"remove-workstation",assignment_id:a.id});await refresh()}catch(e){say("workstationMessage",e.message,"error")}}));row.append(controls);assignments.append(row)})}

function renderDashboard(){
 const put=(id,value)=>{const el=$(id);if(el)el.textContent=String(value)};
 const openTasks=state.tasks.filter(t=>!["completed","cancelled"].includes(t.status));
 const pendingBuilds=state.builds.filter(b=>["submitted","approved"].includes(b.status));
 put("metricProducts",state.products.length);
 put("metricTasks",openTasks.length);
 put("metricStaff",state.staff.length|| (state.profile?1:0));
 put("metricBuilds",pendingBuilds.filter(b=>b.status==="submitted").length);
 put("metricProductNote",state.products.filter(p=>p.status==="launched").length+" launched · "+state.products.filter(p=>p.status==="in_development").length+" in development");
 put("metricTaskNote",openTasks.filter(t=>t.status==="in_progress").length+" in progress · "+openTasks.filter(t=>t.status==="submitted").length+" submitted");
 put("metricBuildNote",pendingBuilds.filter(b=>b.status==="approved").length+" approved · awaiting publication");
 put("bannerProductCount",String(state.products.length).padStart(2,"0"));
 const palette=["#b59aff","#ffb86b","#73e0b2","#7aa7ff","#ff8fa3","#d6a6ff"];
 const drawDonut=(chartId,totalId,legendId,rows)=>{
  const chart=$(chartId),totalEl=$(totalId),legend=$(legendId);if(!chart||!totalEl||!legend)return;
  const total=rows.reduce((sum,r)=>sum+r.value,0);totalEl.textContent=String(total);legend.replaceChildren();
  if(!total){chart.style.background="conic-gradient(rgba(181,195,229,.12) 0deg 360deg)";legend.append(node("div","analytics-empty","No records yet. This chart will update as company activity grows."));return}
  let angle=0;const segments=[];
  rows.forEach((r,i)=>{const span=r.value/total*360;segments.push(palette[i%palette.length]+" "+angle+"deg "+(angle+span)+"deg");angle+=span;const row=node("div","analytics-legend-row"),swatch=node("span","analytics-legend-swatch");swatch.style.background=palette[i%palette.length];const label=node("span","analytics-legend-name",r.label),value=node("strong","analytics-legend-count",String(r.value));row.append(swatch,label,value);legend.append(row)});
  chart.style.background="conic-gradient("+segments.join(",")+")";
 };
 const drawBars=(id,rows,emptyText="No records yet. Charts update as activity is recorded.")=>{
  const box=$(id);if(!box)return;box.replaceChildren();const max=Math.max(1,...rows.map(r=>r.value));
  if(!rows.length){box.append(node("div","analytics-empty",emptyText));return}
  rows.forEach((r,i)=>{const row=node("div","analytics-bar-row"),label=node("span","analytics-bar-label",r.label),track=node("div","analytics-bar-track"),fill=node("div","analytics-bar-fill"),value=node("span","analytics-bar-value",r.value);fill.style.width=(r.value?Math.max(3,r.value/max*100):2)+"%";fill.style.opacity=r.value?"1":".3";fill.style.background=palette[i%palette.length];fill.setAttribute("role","img");fill.setAttribute("aria-label",r.label+": "+r.value);track.append(fill);row.append(label,track,value);box.append(row)});if(!rows.some(r=>r.value))box.append(node("div","analytics-empty",emptyText));
 };
 const lifecycle=[
  {label:"Planned",value:state.products.filter(p=>String(p.status||"").toLowerCase()==="planned").length},
  {label:"In development",value:state.products.filter(p=>String(p.status||"").toLowerCase()==="in_development").length},
  {label:"Launched",value:state.products.filter(p=>["launched","published"].includes(String(p.status||"").toLowerCase())).length},
  {label:"Other stages",value:state.products.filter(p=>!["planned","in_development","launched","published"].includes(String(p.status||"").toLowerCase())).length}
 ];
 const taskStages=[
  {label:"Assigned / open",value:state.tasks.filter(t=>["assigned","open"].includes(String(t.status||"").toLowerCase())).length},
  {label:"In progress",value:state.tasks.filter(t=>String(t.status||"").toLowerCase()==="in_progress").length},
  {label:"Submitted",value:state.tasks.filter(t=>String(t.status||"").toLowerCase()==="submitted").length},
  {label:"Completed",value:state.tasks.filter(t=>String(t.status||"").toLowerCase()==="completed").length},
  {label:"Cancelled",value:state.tasks.filter(t=>String(t.status||"").toLowerCase()==="cancelled").length}
 ];
 drawDonut("portfolioDonut","portfolioTotal","portfolioAnalytics",lifecycle);drawDonut("taskDonut","taskTotal","taskAnalytics",taskStages);
 const chartOpenTasks=state.tasks.filter(t=>!["completed","cancelled"].includes(String(t.status||"").toLowerCase()));
 const workload=state.staff.map(person=>({label:person.display_name||person.username||"Staff member",value:chartOpenTasks.filter(t=>t.assigned_to===person.user_id).length})).filter(row=>row.value>0).sort((a,b)=>b.value-a.value).slice(0,6);
 drawBars("staffAnalytics",workload,"No open staff assignments are recorded yet.");
 const activityDays=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-i));return d});
 const activityRows=activityDays.map(day=>{const next=new Date(day);next.setDate(next.getDate()+1);const inRange=v=>{if(!v)return false;const d=new Date(v);return !Number.isNaN(d.getTime())&&d>=day&&d<next};const tasks=state.tasks.filter(t=>inRange(t.created_at)||inRange(t.updated_at)).length;const builds=state.builds.filter(b=>inRange(b.submitted_at)||inRange(b.created_at)).length;return {label:day.toLocaleDateString(undefined,{weekday:"short"}),value:tasks+builds}});

 drawBars("activityAnalytics",activityRows,"No tasks or builds recorded in the last 7 days.");
 const achievementRows=[
  {label:"Tasks completed",value:state.tasks.filter(t=>String(t.status||"").toLowerCase()==="completed").length},
  {label:"Products launched",value:state.products.filter(p=>["launched","published"].includes(String(p.status||"").toLowerCase())).length},
  {label:"Builds approved",value:state.builds.filter(b=>String(b.status||"").toLowerCase()==="approved").length},
  {label:"Active team members",value:state.staff.filter(p=>String(p.status||"active").toLowerCase()==="active").length}
 ];
 drawBars("achievementAnalytics",achievementRows,"Achievements will appear as tasks are completed and products are launched.");
 const completedByDay=activityDays.map(day=>{const next=new Date(day);next.setDate(next.getDate()+1);const inRange=v=>{if(!v)return false;const d=new Date(v);return !Number.isNaN(d.getTime())&&d>=day&&d<next};return {label:day.toLocaleDateString(undefined,{weekday:"short"}),value:state.tasks.filter(t=>String(t.status||"").toLowerCase()==="completed"&&inRange(t.updated_at||t.completed_at)).length}});
 drawBars("completionAnalytics",completedByDay,"No tasks were marked completed during the last 7 days.");


 const projects=$("dashboardProjects");projects.replaceChildren();
 if(!state.products.length){projects.append(node("div","dashboard-empty","No products have been added yet."))}
 state.products.slice(0,4).forEach(p=>{
  const row=node("div","dashboard-project-row"),icon=node("span","project-symbol",p.slug==="zakichat"?"Z":"◈"),main=node("div","project-row-main");
  main.append(node("strong","",p.name),node("small","",(p.current_version||"Version not set")+" · "+(p.status||"planned").replaceAll("_"," ")));
  const status=node("span","project-row-status",(p.status||"planned").replaceAll("_"," "));
  row.append(icon,main,status);projects.append(row);
 });
 if(state.products.length>4){const more=node("div","module-meta","+"+(state.products.length-4)+" more products in the portfolio");projects.append(more)}
 const taskBox=$("dashboardTasks");taskBox.replaceChildren();
 const myTasks=state.tasks.filter(t=>!["completed","cancelled"].includes(t.status)).slice(0,4);
 if(!myTasks.length)taskBox.append(node("div","dashboard-empty","You're all caught up. No open assignments."));
 myTasks.forEach(t=>{const row=node("div","dashboard-task-row"),mark=node("span","task-priority-mark "+(t.priority||"normal"),t.status==="submitted"?"↗":"");const main=node("div","task-row-main");main.append(node("strong","",t.title),node("small","",(t.product?.name||productName(t.product_id))+" · "+(t.due_at?"Due "+new Date(t.due_at).toLocaleDateString():"No due date")));row.append(mark,main,node("span","task-row-status",(t.status||"assigned").replaceAll("_"," ")));taskBox.append(row)});
 const activity=$("dashboardActivity");activity.replaceChildren();const items=[];
 state.announcements.filter(a=>a.status==="published").slice(0,3).forEach(a=>items.push({icon:"✧",title:a.title,detail:"Company announcement · "+safeDate(a.updated_at||a.created_at),date:new Date(a.updated_at||a.created_at||0).getTime()}));
 state.builds.slice(0,3).forEach(b=>items.push({icon:"↟",title:(b.product?.name||productName(b.product_id))+" build "+b.version,detail:"Build status: "+b.status.replaceAll("_"," ")+" · "+safeDate(b.submitted_at||b.created_at),date:new Date(b.submitted_at||b.created_at||0).getTime()}));
 state.tasks.slice(0,3).forEach(t=>items.push({icon:"☷",title:t.title,detail:"Assignment · "+t.status.replaceAll("_"," ")+" · "+safeDate(t.updated_at||t.created_at),date:new Date(t.updated_at||t.created_at||0).getTime()}));
 items.sort((a,b)=>b.date-a.date);
 if(!items.length)activity.append(node("div","dashboard-empty","Recent announcements, tasks, and product activity will appear here."));
 items.slice(0,4).forEach(item=>{const row=node("div","activity-row"),icon=node("span","activity-icon",item.icon),copy=node("div","activity-copy");copy.append(node("strong","",item.title),node("small","",item.detail));row.append(icon,copy);activity.append(row)});
 const team=$( "dashboardTeam" );team.replaceChildren();
 const members=state.staff.slice(0,5);
 if(!members.length){team.append(node("div","dashboard-empty",state.profile?"Team directory details will appear here when available.":"Team information is not available for this account."))}
 members.forEach(p=>{
  const row=node("div","dashboard-team-row"),avatar=node("span","dashboard-team-avatar");
  const initials=String(p.display_name||p.username||"ZT").trim().split(/\\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
  if(p.avatar_url){const img=node("img");img.src=p.avatar_url;img.alt="";img.loading="lazy";img.onerror=()=>{avatar.textContent=initials};avatar.append(img)}else avatar.textContent=initials||"ZT";
  const copy=node("div","dashboard-team-copy");copy.append(node("strong","",p.display_name||p.username||"Team member"),node("small","",p.username?"@"+p.username:"ZakiTech team"));
  const role=node("span","dashboard-team-role",String(p.role||"staff").replaceAll("_"," "));
  row.append(avatar,copy,role);team.append(row);
 });
 if(state.staff.length>5)team.append(node("div","module-meta","+"+(state.staff.length-5)+" more team members"));
 const messageBox=$( "dashboardMessages" );messageBox.replaceChildren();
 const canSeeMessages=admin()||assigned("support_inbox");
 const recentMessages=canSeeMessages?state.messages.slice(0,4):[];
 if(!canSeeMessages){messageBox.append(node("div","dashboard-empty","Your account does not have the product inbox assignment."))}
 else if(!recentMessages.length){messageBox.append(node("div","dashboard-empty","Recent product messages will appear here when received."))}
 recentMessages.forEach(msg=>{
  const row=node("div","dashboard-message-row"),icon=node("span","dashboard-message-icon","✉"),copy=node("div","dashboard-message-copy");
  copy.append(node("strong","",msg.subject||"Product message"),node("small","",(msg.sender_name||"Sender")+" · "+(msg.product?.name||productName(msg.product_id))+" · "+safeDate(msg.received_at)));
  row.append(icon,copy,node("span","dashboard-message-status",String(msg.status||"new").replaceAll("_"," ")));messageBox.append(row);
 });
}
function refreshSelects(){const products=productOptions();fillSelect($("workstationProduct"),products,"Choose product");fillSelect($("taskProduct"),products,"No product (company-wide)");fillSelect($("buildProduct"),assignedProducts("product_development"),"Choose assigned product");fillSelect($("notificationProduct"),products,"Company-wide / no product");fillSelect($("messageProduct"),products,"Choose product")}
function setAccessUi(){const dev=assigned("product_development"),notif=assigned("notifications"),ann=assigned("announcements"),inbox=assigned("support_inbox");$("navNotifications").hidden=false;$("navDevelopment").hidden=!dev;const pipelineButton=document.querySelector(".pipeline-button");if(pipelineButton)pipelineButton.hidden=!dev;$("navReleases").hidden=!admin();$("navInbox").hidden=!inbox;$("productEditorWrap").hidden=!admin();$("taskEditorWrap").hidden=!admin();$("announcementEditorWrap").hidden=!ann;$("notificationEditorWrap").hidden=!notif;$("announcementAccess").textContent=ann?"ANNOUNCEMENT MANAGER":"READ ACCESS";$("notificationAccess").textContent=notif?"NOTIFICATION MANAGER":"READ ACCESS";$("manualMessageForm").hidden=!inbox; if(admin()){const wrap=$("workstationProductWrap");wrap.hidden=false;$("workstationProduct").required=true}else{$("workstationForm").hidden=true;$("workstationAssignments").hidden=true}}
async function refresh(){const data=await call({action:"bootstrap"});state={...state,...data};refreshSelects();setAccessUi();renderProducts();renderDashboard();renderTasks();renderAnnouncements();renderNotifications();renderBuilds();renderMessages();renderWorkstations();if(admin()){$("productEditorWrap").hidden=false;$("taskEditorWrap").hidden=false}}
function pageMessage(message,kind=""){const el=$("pageMessage");el.textContent=message;el.className="page-message "+kind}
function bind(){document.querySelectorAll("[data-open-view]").forEach(button=>button.addEventListener("click",()=>document.querySelector('.nav-button[data-view="'+button.dataset.openView+'"]')?.click()));
 $("workstationForm").addEventListener("submit",async e=>{e.preventDefault();try{const type=$("workstationType").value,productId=["product_development","release_management"].includes(type)?$("workstationProduct").value:null;if(["product_development","release_management"].includes(type)&&!productId)throw Error("Choose a product for this workstation.");await call({action:"assign-workstation",user_id:$("workstationStaff").value,workstation:type,product_id:productId});say("workstationMessage","Workstation access granted.","good");await refresh()}catch(e){say("workstationMessage",e.message,"error")}});
 $("refreshWorkstations").addEventListener("click",refresh);$("workstationType").addEventListener("change",()=>{const wrap=$("workstationProductWrap");wrap.hidden=!["product_development","release_management"].includes($("workstationType").value);$("workstationProduct").required=!wrap.hidden});
 $("productForm").addEventListener("submit",async e=>{e.preventDefault();try{const id=$("productId").value;await call({action:id?"update-product":"create-product",id:id||undefined,name:$("productName").value,slug:$("productSlug").value,description:$("productDescription").value,repository_url:$("productRepo").value,website_url:$("productWebsite").value,admin_center_url:$("productAdminUrl").value,current_version:$("productVersion").value,status:$("productStatus").value});$("productForm").reset();$("productId").value="";pageMessage("Product saved.","good");await refresh()}catch(e){pageMessage(e.message,"error")}});
 $("cancelProductEdit").addEventListener("click",()=>{$("productForm").reset();$("productId").value=""});
 $("taskForm").addEventListener("submit",async e=>{e.preventDefault();try{const due=$("taskDue").value;await call({action:"create-task",title:$("taskTitle").value,description:$("taskDescription").value,assigned_to:$("taskAssignee").value,product_id:$("taskProduct").value||null,priority:$("taskPriority").value,due_at:due?new Date(due).toISOString():null});$("taskForm").reset();say("taskMessage","Task assigned successfully.","good");await refresh()}catch(e){say("taskMessage",e.message,"error")}});
 $("announcementForm").insertAdjacentHTML("afterbegin",'<input id="announcementId" type="hidden">');$("announcementStatus").insertAdjacentHTML("beforeend",'<option value="archived">Archive</option>');
 $("announcementForm").addEventListener("submit",async e=>{e.preventDefault();try{await call({action:"save-announcement",id:$("announcementId").value||undefined,title:$("announcementTitle").value,body:$("announcementBody").value,audience:$("announcementAudience").value,status:$("announcementStatus").value});$("announcementForm").reset();$("announcementId").value="";say("announcementMessage","Announcement saved.","good");await refresh()}catch(e){say("announcementMessage",e.message,"error")}});
 $("notificationForm").insertAdjacentHTML("afterbegin",'<input id="notificationId" type="hidden">');$("notificationStatus").insertAdjacentHTML("beforeend",'<option value="archived">Archive</option>');
 $("notificationForm").addEventListener("submit",async e=>{e.preventDefault();try{await call({action:"save-notification",id:$("notificationId").value||undefined,product_id:$("notificationProduct").value||null,notification_type:$("notificationType").value,audience:$("notificationAudience").value,title:$("notificationTitle").value,body:$("notificationBody").value,status:$("notificationStatus").value});$("notificationForm").reset();$("notificationId").value="";say("notificationMessage","Notification saved.","good");await refresh()}catch(e){say("notificationMessage",e.message,"error")}});
 $("buildForm").addEventListener("submit",async e=>{e.preventDefault();const btn=$("buildForm").querySelector('button[type="submit"]'),file=$("buildFile").files?.[0];btn.disabled=true;try{if(!file)throw Error("Choose a build package first.");if(file.size>100*1024*1024)throw Error("The package must be 100 MB or smaller.");if(!/\.(apk|aab|zip)$/i.test(file.name))throw Error("Only APK, AAB or ZIP files are accepted.");const metadata={product_id:$("buildProduct").value,version:$("buildVersion").value,title:$("buildTitle").value,description:$("buildDescription").value,release_notes:$("buildNotes").value,channel:$("buildChannel").value,file_name:file.name,file_size:file.size};say("buildMessage","Preparing a private upload…");const prepared=await call({action:"prepare-build",...metadata});say("buildMessage","Uploading build to private staging. Please keep this page open…");const {error}=await client.storage.from("zt-build-staging").uploadToSignedUrl(prepared.path,prepared.token,file,{contentType:file.type||"application/octet-stream",cacheControl:"3600"});if(error)throw error;say("buildMessage","Upload complete. Submitting build for leadership verification…");await call({action:"submit-build",...metadata,storage_path:prepared.path});$("buildForm").reset();say("buildMessage","Build submitted. It remains private until the CEO or Vice Administrator approves and publishes it.","good");await refresh()}catch(e){say("buildMessage",e.message||"Could not upload the build.","error")}finally{btn.disabled=false}});
 $("manualMessageForm").addEventListener("submit",async e=>{e.preventDefault();try{await call({action:"create-message",product_id:$("messageProduct").value,sender_name:$("messageSender").value,sender_email:$("messageEmail").value,subject:$("messageSubject").value,message:$("messageBody").value});$("manualMessageForm").reset();say("inboxMessage","Message added to the product inbox.","good");await refresh()}catch(e){say("inboxMessage",e.message,"error")}});
}
let liveRefreshTimer=null,liveRefreshPending=false;
function scheduleLiveRefresh(){
 window.__zakitechLiveRefreshHandled=true;
 if(document.hidden)return;
 const editing=document.querySelector("input:focus,textarea:focus,select:focus,[contenteditable=true]:focus");
 if(editing){liveRefreshPending=true;return}
 clearTimeout(liveRefreshTimer);
 liveRefreshTimer=setTimeout(async()=>{try{await refresh();pageMessage("Workspace synced with the latest company updates.","good")}catch(e){console.warn("Live workspace refresh failed:",e)}},350);
}
window.addEventListener("zakitech:live-change",scheduleLiveRefresh);
document.addEventListener("focusout",()=>{if(liveRefreshPending){liveRefreshPending=false;scheduleLiveRefresh()}},true);
async function init(){try{bind();await refresh();pageMessage("Workspace modules and assigned workstations loaded.","good")}catch(e){console.error("ZakiTech workspace modules:",e);pageMessage(e.message||"Some workspace modules could not load.","error")}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else void init();
})();