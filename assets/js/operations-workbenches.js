(()=>{"use strict";
const client=window.ZakiTechSupabase,$=id=>document.getElementById(id),page=document.body.dataset.opsPage;
let state={profile:null,is_admin:false,products:[],assignments:[],tasks:[],announcements:[],notifications:[],messages:[],builds:[],staff:[],staff_messages:[]};
const el=(tag,cls="",txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
const link=(txt,href,primary=false)=>{const a=el("a",primary?"ops-inline-link primary":"ops-inline-link",txt);a.href=href;return a};
const human=x=>String(x||"not recorded").replaceAll("_"," ");
const slug=p=>String(p.slug||"").toLowerCase();
const isBusiness=p=>/molan.business|molan-business/.test(slug(p)+" "+String(p.name||"").toLowerCase());
const isChat=p=>/zakichat|molan.chat|molan-chat/.test(slug(p)+" "+String(p.name||"").toLowerCase());
const repo=p=>p.repository_url||(isChat(p)?"https://github.com/zakpollyqueens/ZakiChat-":isBusiness(p)?"https://github.com/zakpollyqueens/Molan-business-app-":"https://github.com/zakpollyqueens/Zakitech");
const site=p=>p.website_url||p.deployment_url||(isBusiness(p)?"https://zakpollyqueens.github.io/Molan-business-app-/":"");
function notice(msg,error=false){const n=$("opsNotice");n.hidden=!msg;n.textContent=msg||"";n.classList.toggle("error",error)}
function badge(txt,cls=""){return el("span","ops-badge "+cls,human(txt))}
function panel(title,eyebrow,cls=""){const p=el("section","ops-panel "+cls),head=el("div","ops-panel-head"),copy=el("div");copy.append(el("p","eyebrow",eyebrow),el("h2","",title));head.append(copy);p.append(head);return p}
function card(icon,title,status,description,actions=[],statusClass=""){const c=el("article","ops-card"),top=el("div","ops-card-top");top.append(el("span","ops-card-icon",icon),badge(status,statusClass));c.append(top,el("h3","",title),el("p","",description));const as=el("div","ops-card-actions");actions.forEach(x=>as.append(link(x[0],x[1],x[2])));c.append(as);return c}
function row(title,sub,actions=[]){const r=el("div","ops-row"),left=el("div");left.append(el("strong","",title),el("small","",sub));const right=el("div","ops-row-actions");actions.forEach(x=>right.append(link(x[0],x[1])));r.append(left,right);return r}
function metric(a,b,c){const m=el("article"),n=el("span","",a);m.append(n,el("strong","",b),el("small","",c));return m}
function productActionCards(products){const g=el("div","ops-cards");products.forEach(p=>{const business=isBusiness(p),chat=isChat(p);g.append(card(business?"MB":chat?"M":"◈",p.name||"Product",p.status||"untracked",p.description||(business?"Molan Business website, business service workflows and customer support.":chat?"Molan Chat messaging, releases and support integration.":"Product delivery and lifecycle management."),[["Workspace","product-hub.html"],["Upload build","development.html?product_id="+encodeURIComponent(p.id)],["Repository ↗",repo(p)],...(business?[["Business control","molan-business-control.html"],["Live website ↗",site(p)||"website-production.html"]]:[]),...(chat?[["Latest release ↗","https://github.com/zakpollyqueens/ZakiChat-/releases/latest"]]:[])].filter(a=>a[1])))});return g}
function renderWebsite(){const all=state.products||[],products=all.filter(p=>isBusiness(p)||isChat(p));$("opsMetrics").replaceChildren(metric("Product projects",String(products.length),"Molan Business & Molan Chat"),metric("Build records",String(state.builds.length),"Submitted and published builds"),metric("Open work items",String(state.tasks.filter(t=>!["completed","cancelled"].includes(t.status)).length),"Authorized tasks"));const a=panel("Product production pipelines","DELIVERY PORTFOLIO","full");a.append(el("p","","Select a product to open its development workflow, repository, release desk and deployment destination. Build uploads remain subject to existing role and product workstation permissions."));a.append(productActionCards(products));const live=panel("Live website orders","MOLAN BUSINESS · CONNECTED DELIVERY QUEUE","full");live.append(el("p","","Website requests are loaded from Molan Business. First-payment verification starts the AI build; the final payment is required before the live URL is published or released."));const host=el("div","ops-list");host.id="websiteOrdersHost";host.append(el("div","ops-empty","Loading live website orders from Molan Business…"));live.append(host);const b=panel("Website delivery checklist","FROM BRIEF TO VERIFIED LIVE SITE");const list=el("ul","ops-checklist");["Collect business name, publishable content, contact details, service list, location and approved brand assets.","Confirm the selected package and the server-approved 50% first payment.","Molano AI generates a responsive single-file website draft after payment verification.","The customer completes the remaining 50%; only then is the draft published and its URL released.","Verify the public HTTPS URL and record any follow-up maintenance or customer support work."].forEach(x=>list.append(el("li","",x)));b.append(list);const c=panel("Production shortcuts","TOOLS & OWNERSHIP");c.append(el("p","","Use these controls to review customer orders, retry failed builds, and recover publication when a final payment is verified. Build and publish actions are role-checked and audit logged."));const shortcuts=el("div","ops-card-actions");[["Product development","development.html"],["Molan Business Control","molan-business-control.html"],["Tasks & blockers","product-blockers.html"],["Release review","release-review.html"],["Support center","product-support.html"],["Ask Molano AI ↗","https://molanoai.zakpollyqueens.workers.dev/"]].forEach(x=>{const item=link(x[0],x[1]);if(x[1].startsWith("https://")){item.target="_blank";item.rel="noopener noreferrer"}shortcuts.append(item)});c.append(shortcuts);$("opsContent").replaceChildren(a,live,b,c);loadWebsiteOrders(host)}
async function loadWebsiteOrders(host){if(!host||!client)return;host.replaceChildren(el("div","ops-empty","Refreshing website orders…"));try{const {data,error}=await client.functions.invoke("molan-customer-support",{body:{action:"website_requests"}});if(error||data?.error)throw new Error(data?.error||error?.message||"The Molan website order bridge is unavailable.");const requests=Array.isArray(data?.requests)?data.requests:[];if(!requests.length){host.replaceChildren(el("div","ops-empty","No website orders have been submitted yet."));return}host.replaceChildren();requests.forEach(r=>{const card=el("article","ops-row"),copy=el("div","ops-row-copy"),business=r.public_business_name||r.business_name||"Website customer",title=business+" · "+human(r.package_code)+" package",pay=String(r.payment_status||"unpaid"),job=r.build_job||null;copy.append(el("strong","",title),el("small","",String(r.package_currency_code||"") +" "+Number(r.package_amount||0).toLocaleString()+" · Payment: "+human(pay)+" · Request: "+human(r.status)));copy.append(el("small","", "Request ID: "+r.id+" · Created "+(r.created_at?new Date(r.created_at).toLocaleString():"date unavailable")));if(r.business_brief)copy.append(el("p","",String(r.business_brief).slice(0,500)));if(job){copy.append(el("small","",human(job.status)+" · "+Number(job.progress_percent||0)+"% · "+(job.progress_message||"No progress note")));const track=el("div","ops-progress"),fill=el("span");fill.style.width=Math.max(0,Math.min(100,Number(job.progress_percent||0)))+"%";track.append(fill);copy.append(track)}else if(pay==="partially_paid")copy.append(el("small","","First payment verified · waiting for build queue status."));const right=el("div","ops-row-actions");if(pay==="partially_paid"&&(!job||job.status==="failed")){const retry=el("button","ops-inline-link primary",job?.status==="failed"?"Retry AI build ↻":"Start AI build");retry.type="button";retry.dataset.websiteAdminAction="build";retry.dataset.requestId=r.id;right.append(retry)}if(pay==="paid"&&!r.delivered_website_url){const publish=el("button","ops-inline-link primary","Retry publication ↻");publish.type="button";publish.dataset.websiteAdminAction="publish";publish.dataset.requestId=r.id;right.append(publish)}if(pay==="paid"&&r.delivered_website_url){const open=link("Open live website ↗",r.delivered_website_url,true);open.target="_blank";open.rel="noopener noreferrer";right.append(open)}card.append(copy,right);host.append(card)})}catch(error){host.replaceChildren(el("div","ops-empty",error?.message||"Could not load live website orders. Check the server-side Molan bridge secrets and staff permissions."))}}

function renderAI(){
  const root=el("div","ops-content ai-studio-layout");
  const intro=panel("Molano AI workspace","MOLANO AI · SECURE EARLY ACCESS","full");
  intro.append(el("p","","Molano AI is the company assistant for product support, staff coordination, approved workflows, website development and advertising. The assistant is not a superuser: confidential files are excluded by default, destructive controls are never exposed, and consequential actions require approval."));
  const statusGrid=el("div","ai-status-grid");
  [
    ["Security policy","ACTIVE BASELINE","safe"],
    ["AI model","AWAITING CONFIGURATION","pending"],
    ["Juma Pay","EXISTING INTEGRATION FOUND","safe"],
    ["External publishing","APPROVAL REQUIRED","pending"]
  ].forEach(([label,value,kind])=>{const c=el("article","ai-status-card");c.append(el("span","ai-status-label",label),el("strong","",value),el("small",kind,value==="ACTIVE BASELINE"?"Request policy committed to main":"Configure the approved model endpoint in server-side secrets"));statusGrid.append(c)});
  intro.append(statusGrid);
  const modelStatusCard=statusGrid.children[1];
  const modelStatusValue=modelStatusCard?.querySelector("strong");
  const modelStatusDetail=modelStatusCard?.querySelector("small");

  const assistant=panel("Ask Molano AI","SECURE ASSISTANT CONSOLE","full");
  const guard=el("div","ai-guardrail-banner");
  guard.append(el("span","ai-guardrail-icon","✦"),el("div"));
  guard.lastChild.append(el("strong","","Protected by company policy"),el("p","","The server checks your signed-in session and blocks prohibited requests. This interface will not claim an AI answer until a model provider is configured and the backend confirms a successful response."));
  assistant.append(guard);
  const chat=el("form","ai-chat-form");chat.id="ztAiChatForm";
  const label=el("label","ai-form-label","What do you need help with?");label.htmlFor="ztAiMessage";
  const textarea=el("textarea","ai-message-input");textarea.id="ztAiMessage";textarea.name="message";textarea.rows=3;textarea.maxLength=4000;textarea.required=true;textarea.placeholder="Ask about an approved product, draft a support response, plan a website, or prepare an advertising campaign…";
  const row=el("div","ai-chat-actions");
  const hint=el("small","ai-muted","Do not enter passwords, secret keys or confidential document contents.");
  const send=el("button","ops-button primary","Ask Molano AI");send.type="submit";
  row.append(hint,send);chat.append(label,textarea,row);
  const response=el("div","ai-response-box");response.id="ztAiResponse";response.hidden=true;response.setAttribute("role","status");response.setAttribute("aria-live","polite");
  assistant.append(chat,response);

  const ads=panel("Advertising Studio","CREATE · REVIEW · THEN PUBLISH","full");
  ads.append(el("p","","Prepare branded advertising briefs for ZakiTech products. In this first stage, drafts stay in this browser and are not published or sent to social platforms."));
  const adForm=el("form","ai-ad-form");adForm.id="ztAiAdForm";
  const productLabel=el("label","ai-form-label","Product or service");productLabel.htmlFor="ztAdProduct";
  const product=el("input","ai-text-input");product.id="ztAdProduct";product.name="product";product.required=true;product.maxLength=100;product.placeholder="e.g. Mola Business";
  const goalLabel=el("label","ai-form-label","Campaign goal");goalLabel.htmlFor="ztAdGoal";
  const goal=el("select","ai-text-input");goal.id="ztAdGoal";goal.name="goal";
  [["downloads","Get more app downloads"],["awareness","Introduce the product"],["leads","Generate customer enquiries"],["launch","Announce a new launch"],["sales","Promote a paid service"]].forEach(([v,t])=>{const o=el("option","",t);o.value=v;goal.append(o)});
  const detailsLabel=el("label","ai-form-label","Approved product details (no secrets)");detailsLabel.htmlFor="ztAdDetails";
  const details=el("textarea","ai-message-input");details.id="ztAdDetails";details.name="details";details.rows=3;details.maxLength=1200;details.placeholder="Describe the real benefits, official link and audience. Do not include private customer data.";
  const generate=el("button","ops-button primary","Prepare draft brief");generate.type="submit";
  adForm.append(productLabel,product,goalLabel,goal,detailsLabel,details,generate);
  const adResult=el("div","ai-response-box");adResult.id="ztAdDraft";adResult.hidden=true;adResult.setAttribute("aria-live","polite");
  ads.append(adForm,adResult);

  const rules=panel("What the assistant can and cannot do","PERMISSION BOUNDARIES");
  const ruleGrid=el("div","ai-rule-grid");
  [
    ["✓","Assist","Explain approved product information, prepare task plans, draft website content and advertisements."],
    ["✓","Scoped access","Read permitted project status through authenticated backend tools only."],
    ["Approval","Human review","Production deployments, payment reconciliation, external publication and advertising spend require authorized approval."],
    ["Blocked","Protected assets","No deleting, deactivating or archiving company apps, databases, repositories, records or confidential files."],
    ["Blocked","Secrets","No unrestricted confidential documents, passwords, API keys or service-role credentials in model context."]
  ].forEach(([icon,title,copy])=>{const c=el("article","ai-rule-card");c.append(el("span","ai-rule-icon",icon),el("strong","",title),el("p","",copy));ruleGrid.append(c)});
  rules.append(ruleGrid);
  const next=panel("Connection checklist","SAFE ACTIVATION");
  const checklist=el("ul","ops-checklist");
  [
    "Authenticated AI Edge Function deployed; confirm provider secrets and run a signed-in end-to-end test.",
    "Verify the existing Mola Business Juma Pay webhook and checkout implementation before reusing payment status.",
    "Configure AI_PROVIDER_BASE_URL, AI_PROVIDER_API_KEY and AI_MODEL as server-side secrets; never put provider keys in browser code.",
    "Add approved product documentation and role-scoped read tools before enabling business actions.",
    "Run policy, authentication, abuse, rate-limit and deployment tests before production activation."
  ].forEach(x=>checklist.append(el("li","pending",x)));
  next.append(checklist);
  const statusActions=el("div","ops-card-actions");
  const checkModel=el("button","ops-button secondary","Check model connection");
  checkModel.type="button";
  const statusNote=el("p","ai-muted","Connection checks require a signed-in, active company account.");
  statusActions.append(checkModel);
  next.append(statusActions,statusNote);
  root.append(intro,assistant,ads,rules,next);
  $("opsContent").replaceChildren(root);

  async function refreshModelStatus(){
    checkModel.disabled=true;
    checkModel.textContent="Checking securely…";
    if(modelStatusValue)modelStatusValue.textContent="CHECKING";
    if(modelStatusDetail)modelStatusDetail.textContent="Verifying authenticated backend readiness";
    try{
      if(!window.ZakiTechSupabase||typeof window.ZakiTechSupabase.functions?.invoke!=="function")throw new Error("Secure backend client is not ready. Sign in and reload.");
      const {data,error}=await window.ZakiTechSupabase.functions.invoke("zakitech-ai-assistant",{body:{action:"status"}});
      if(error)throw error;
      if(!data?.authenticated)throw new Error("Sign-in required.");
      if(data.providerConfigured){
        if(modelStatusValue)modelStatusValue.textContent="READY FOR TEST";
        if(modelStatusDetail)modelStatusDetail.textContent="Provider secrets are present; a signed-in chat test is still required.";
        statusNote.textContent="Provider configuration detected. Send a harmless test message to confirm the model endpoint responds.";
        statusNote.className="ai-muted";
      }else{
        if(modelStatusValue)modelStatusValue.textContent="AWAITING CONFIGURATION";
        if(modelStatusDetail)modelStatusDetail.textContent="Server-side model endpoint secrets are not all present.";
        statusNote.textContent="The security gateway is reachable, but AI_PROVIDER_BASE_URL, AI_PROVIDER_API_KEY and AI_MODEL still need server-side configuration.";
      }
    }catch(error){
      if(modelStatusValue)modelStatusValue.textContent="CHECK REQUIRED";
      if(modelStatusDetail)modelStatusDetail.textContent="Unable to verify the secure connection.";
      statusNote.textContent=String(error?.message||"Secure connection check failed.");
    }finally{
      checkModel.disabled=false;
      checkModel.textContent="Check model connection";
    }
  }
  checkModel.addEventListener("click",refreshModelStatus);
  refreshModelStatus();

  chat.addEventListener("submit",async event=>{
    event.preventDefault();
    const message=textarea.value.trim();if(!message)return;
    response.hidden=false;response.replaceChildren(el("strong","","Preparing secure request…"),el("p","","No external model will receive your message unless an approved provider is configured."));
    send.disabled=true;send.textContent="Checking…";
    try{
      if(!window.ZakiTechSupabase||typeof window.ZakiTechSupabase.functions?.invoke!=="function")throw new Error("Secure backend client is not ready. Please sign in again or reload the workspace.");
      const {data,error}=await window.ZakiTechSupabase.functions.invoke("zakitech-ai-assistant",{body:{message}});
      if(error){let msg=error.message||"The assistant endpoint is not available yet.";try{const ctx=error.context;if(ctx&&typeof ctx.json==="function"){const j=await ctx.json();if(j?.message)msg=j.message;}}catch(_){}throw new Error(msg);}
      response.replaceChildren(el("strong","",data?.blocked?"Request blocked by security policy":data?.providerConfigured?"Assistant response":"Molano AI is not configured"),el("p","",data?.message||data?.response||"The server returned no assistant response."));
    }catch(error){response.replaceChildren(el("strong","","Assistant is not ready yet"),el("p","",String(error?.message||"The secure AI service could not be reached.")),el("small","ai-muted","This is not a model-generated answer. Your message was not automatically sent to another AI provider."));}
    finally{send.disabled=false;send.textContent="Ask Molano AI";}
  });

  adForm.addEventListener("submit",event=>{
    event.preventDefault();
    const name=product.value.trim();if(!name)return;
    const goalText=goal.options[goal.selectedIndex]?.text||goal.value;
    const info=details.value.trim()||"Add only verified product features, the official landing/download link and approved brand assets before publication.";
    const draft=el("div","ai-draft-content");
    draft.append(el("p","eyebrow","DRAFT · NOT PUBLISHED"),el("h3","",name+" — campaign brief"),el("p","", "Goal: "+goalText),el("p","", "Brand: ZakiTech Solutions · Equipping minds with IT solutions."),el("p","", "Creative direction: premium technology visuals, cyan blue, deep navy and white; show the actual product UI and one clear call to action."),el("p","", "Verified product details: "+info),el("p","", "Next steps: confirm the official destination URL, create platform-specific creative sizes, review claims and branding, obtain authorized approval, then publish using an approved platform integration."));
    adResult.replaceChildren(draft);adResult.hidden=false;
  });
}
function renderSecurity(){const role=state.profile?.role||"unknown",assign=state.assignments||[],products=state.products||[];$("opsMetrics").replaceChildren(metric("Signed-in role",human(role),"Authenticated ZakiTech profile"),metric("Workstation assignments",String(assign.length),"Permissions currently visible"),metric("Tracked products",String(products.length),"Portfolio scope"));const panelA=panel("Account & access overview","IDENTITY AND PERMISSIONS");panelA.append(el("p","","Your signed-in role is "+human(role)+". Product workstations should be assigned explicitly; job titles do not automatically grant repository access or application-wide administration."));const rows=el("div","ops-list");rows.append(row("Account profile","View the current account, session and profile security settings.",[["Open profile","profile.html"]]));rows.append(row("Staff access control","Review staff accounts and role-based workspace access.",[["Staff management","staff-management.html"],["Workstation assignments","workstation-assignments.html"]]));rows.append(row("Release publishing","Builds require the existing server-side product workstation and reviewer permissions.",[["Release review","release-review.html"]]));panelA.append(rows);const b=panel("Integration readiness","CURRENT BRIDGE SAFEGUARDS");const checklist=el("ul","ops-checklist");["ZakiTech workspace data is loaded using the authenticated session and secure backend.","Molan Chat release synchronization requires a verified administrator session and server-side bridge configuration.","Molan Business support bridge requires its separate Supabase service credentials stored as server secrets.","AI provider integration is not connected; do not place provider keys in browser code.","Use least-privilege repository/team access and review audit events for sensitive actions."].forEach((x,i)=>checklist.append(el("li",i===1||i===2||i===3?"pending":"",x)));b.append(checklist);const c=panel("Visible assignments","ASSIGNED WORKSTATIONS","full");if(!assign.length)c.append(el("div","ops-empty","","No workstation assignments are visible for this account. Ask an authorized administrator to assign the specific product/workstation required for your role."));else{const list=el("div","ops-list");assign.forEach(a=>{const p=products.find(x=>x.id===a.product_id);list.append(row(human(a.workstation),p?p.name:"Company-wide workstation",""===null?[]: [["Manage assignments","workstation-assignments.html"]]))});c.append(list)}const d=panel("Security actions","QUICK LINKS");const links=el("div","ops-card-actions");[["My profile & security","profile.html"],["Staff management","staff-management.html"],["Workstation assignments","workstation-assignments.html"],["Product support","product-support.html"],["AI governance","ai-operations.html"]].forEach(x=>links.append(link(x[0],x[1])));d.append(links);$("opsContent").replaceChildren(panelA,b,c,d)}
function renderHelp(){const products=state.products||[];$("opsMetrics").replaceChildren(metric("Products supported",String(products.filter(p=>isBusiness(p)||isChat(p)).length),"Molan Business & Molan Chat"),metric("Build records",String(state.builds.length),"Release/update records visible"),metric("Support entry points","2","Customer support and internal delivery"));const a=panel("Choose what you need help with","PRODUCT SUPPORT");const g=el("div","ops-cards");g.append(card("MB","Molan Business","help","Website requests, business profile content, contact links, design feedback and deployment questions.",[["Business control center","molan-business-control.html"],["Website production","website-production.html"],["Contact support team","product-support.html"]],"good"),card("M","Molan Chat","help","Installation, sign-in, update downloads, release notes, account and messaging issues.",[["Latest release ↗","https://github.com/zakpollyqueens/ZakiChat-/releases/latest"],["Release review","release-review.html"],["Contact support team","product-support.html"]],"good"),card("⚑","Report a product blocker","internal","For a defect or dependency that prevents work or affects a published product.",[["Blocker desk","product-blockers.html"],["Tasks & assignments","tasks.html"]],"warn"),card("↟","Download or upgrade help","release","Review the approved version and release status before installing a new package.",[["Release desk","release-review.html"],["Product Operations Station","product-station.html"]],"good"));a.append(g);const b=panel("Self-service guidance","COMMON QUESTIONS");const rows=el("div","ops-list");rows.append(row("How do I install an app update?","Open the app's official release page, download the signed package for your device and follow the operating system's installation prompt.",[["Molan Chat releases","https://github.com/zakpollyqueens/ZakiChat-/releases/latest"]]));rows.append(row("How are website changes published?","Website code is deployed through the connected repository and hosting workflow; it is not installed as an APK.",[["Website production","website-production.html"]]));rows.append(row("Why can't I publish a build?","Build upload and release actions require the correct product workstation assignment and server-side reviewer permission.",[["Security & access","product-security.html"],["Release desk","release-review.html"]]));rows.append(row("Where do staff report blockers?","Use the blocker desk and task workflow. Keep releases under review until critical blockers are resolved.",[["Blocker desk","product-blockers.html"]]));b.append(rows);const c=panel("Support team workspace","AUTHORIZED STAFF");c.append(el("p","","The operational inbox is a staff-only workspace. It connects to the configured Molan Business support bridge and available Molan Chat support integration. A connection status or empty queue must not be interpreted as proof that every external integration is live."));const links=el("div","ops-card-actions");links.append(link("Open support inbox","product-support.html"),link("Product messages","messages.html"),link("AI operations status","ai-operations.html"));c.append(links);$("opsContent").replaceChildren(a,b,c)}
function renderBlockers(){const tasks=state.tasks||[],blockers=tasks.filter(t=>["blocked","blocked_by_dependency","on_hold","waiting_on_external"].includes(String(t.status||"").toLowerCase()));const open=tasks.filter(t=>!["completed","cancelled"].includes(t.status));$("opsMetrics").replaceChildren(metric("Explicit blockers",String(blockers.length),"Visible blocked/on-hold tasks"),metric("Open tasks",String(open.length),"Tasks not completed or cancelled"),metric("Products",String(state.products.length),"Accessible portfolio"));const a=panel("Blocker queue","NEEDS ATTENTION","full");a.append(el("p","","Only statuses explicitly recorded as blocked, on hold or waiting on an external dependency are counted as blockers. Other open tasks remain visible separately to avoid mislabeling normal work."));if(!blockers.length)a.append(el("div","ops-empty","","No explicitly blocked tasks are visible to your account. To register a blocker, open Tasks & Assignments and update the task using the authorized workflow; this desk will display blocker statuses recorded by the backend."));else{const list=el("div","ops-list");blockers.forEach(t=>list.append(row(t.title||"Untitled task",(t.product?.name||"Company-wide")+" · "+human(t.status)+" · "+(t.assignee?.display_name||"No assignee recorded"),[["Open tasks","tasks.html"],["Product Hub","product-hub.html"]])));a.append(list)}const b=panel("Delivery risk shortcuts","RESOLUTION WORKFLOW");const g=el("div","ops-cards");g.append(card("☷","Task assignments","active","Review owners, priorities, due dates and task progress.",[["Open tasks","tasks.html"]],"good"),card("⌘","Product development","active","Open the relevant development workflow and record the dependency.",[["Open development","development.html"]],"good"),card("↟","Release gate","active","If a blocker affects an update, keep the release under review until resolved.",[["Review releases","release-review.html"]],"good"),card("✉","Support escalations","active","Route customer-impacting issues to the authorized product support inbox.",[["Support center","product-support.html"]],"good"));b.append(g);const c=panel("Blocker escalation checklist","RESOLUTION STANDARD");const list=el("ul","ops-checklist");["Describe the exact failure and how to reproduce it.","Link the affected product, build or task.","Assign a responsible owner and priority.","Record the dependency, next action and expected resolution.","Verify the fix before resuming a blocked release."].forEach(x=>list.append(el("li","",x)));c.append(list);$("opsContent").replaceChildren(a,b,c)}
async function init(){if(!client){notice("Secure workspace client failed to load. Refresh and try again.",true);return}const {data:{session}}=await client.auth.getSession();if(!session){location.replace("index.html");return}const {data:{user}}=await client.auth.getUser();if(!user){location.replace("index.html");return}const {data,error}=await client.functions.invoke("zakitech-workspace",{body:{action:"bootstrap"}});if(error||data?.error){notice(data?.error||error?.message||"Could not load authorized workspace data.",true);return}state={...state,...data};$("pageUserLabel").textContent=state.profile?.display_name||state.profile?.username||"ZakiTech user";if(page==="website")renderWebsite();else if(page==="ai")renderAI();else if(page==="security")renderSecurity();else if(page==="blockers")renderBlockers();else if(page==="help")renderHelp();else notice("Unknown operations workbench.",true)}
document.addEventListener("click",async e=>{const button=e.target.closest("[data-website-admin-action]");if(!button)return;e.preventDefault();const action=button.dataset.websiteAdminAction,requestId=button.dataset.requestId;if(!action||!requestId||!client)return;const original=button.textContent;button.disabled=true;button.textContent=action==="build"?"Starting AI build…":"Publishing website…";try{const {data,error}=await client.functions.invoke("molan-customer-support",{body:{action:"website_build",request_id:requestId,build_action:action}});if(error||data?.error)throw new Error(data?.error||error?.message||"Website action could not be completed.");notice(data?.message||"Website workflow updated.");const host=$("websiteOrdersHost");if(host)await loadWebsiteOrders(host)}catch(err){notice(err?.message||"Website workflow action failed.",true)}finally{button.disabled=false;button.textContent=original}});
setInterval(()=>{if(page==="website"){const host=$("websiteOrdersHost");if(host)loadWebsiteOrders(host)}},15000);
$("pageSignOut").addEventListener("click",async()=>{if(!client)return;const {error}=await client.auth.signOut();if(error){notice(error.message,true);return}location.replace("index.html")});init().catch(e=>notice(e?.message||"The operations workbench failed to load.",true));
})();