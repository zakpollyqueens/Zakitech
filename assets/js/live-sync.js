(()=> {
  "use strict";
  const client=window.ZakiTechSupabase;
  if(!client||window.__zakitechLiveSyncInstalled)return;
  window.__zakitechLiveSyncInstalled=true;

  const tables=[
    "zt_profiles","zt_products","zt_workstation_assignments","zt_product_builds",
    "zt_announcements","zt_notifications","zt_product_messages","zt_tasks",
    "zt_staff_messages","zt_staff_direct_messages","zt_meetings","zt_meeting_rsvps",
    "zt_board_items","zt_performance_events","zt_staff_exit_requests"
  ];
  let channel=null,activeUser=null,statusNode=null,retryTimer=null;
  const setStatus=(state,label)=>{
    if(!statusNode){
      statusNode=document.createElement("span");
      statusNode.className="zakitech-live-sync";
      statusNode.setAttribute("role","status");
      statusNode.setAttribute("aria-live","polite");
      statusNode.innerHTML='<i aria-hidden="true"></i><span></span>';
      const host=document.querySelector(".page-top-actions,.top-actions,.topbar");
      if(host)host.append(statusNode);
      const style=document.createElement("style");
      style.textContent=".zakitech-live-sync{display:inline-flex;align-items:center;gap:7px;margin-inline:8px;color:#a9c7d9;font:600 10px/1.3 system-ui,sans-serif;white-space:nowrap}.zakitech-live-sync i{width:7px;height:7px;border-radius:50%;background:#7b91a8;box-shadow:0 0 0 3px rgba(123,145,168,.12)}.zakitech-live-sync[data-state=live] i{background:#58e0b6;box-shadow:0 0 10px rgba(88,224,182,.5)}.zakitech-live-sync[data-state=offline] i{background:#f0b85a}.zakitech-live-sync[data-state=error] i{background:#ff8b91}@media(max-width:520px){.zakitech-live-sync{font-size:0;gap:0}.zakitech-live-sync i{width:8px;height:8px}}";
      document.head.append(style);
    }
    statusNode.dataset.state=state;
    statusNode.querySelector("span").textContent=label;
    statusNode.title=label;
  };
  const requestRefresh=(detail={reason:"realtime"})=>{
    window.dispatchEvent(new CustomEvent("zakitech:live-change",{detail}));
  };
  const stop=async()=>{
    if(retryTimer){clearTimeout(retryTimer);retryTimer=null}
    if(channel){const old=channel;channel=null;try{await client.removeChannel(old)}catch(_){}}
    activeUser=null;
  };
  const connect=async(userId)=>{
    if(!userId)return;
    if(activeUser===userId&&channel)return;
    await stop();
    activeUser=userId;
    setStatus("connecting","Connecting live updates…");
    let next=client.channel("zakitech-live-workspace-"+userId);
    for(const table of tables){
      next=next.on("postgres_changes",{event:"*",schema:"public",table},payload=>{
        requestRefresh({reason:"realtime",table,eventType:payload.eventType||"UPDATE"});
      });
    }
    channel=next;
    channel.subscribe(state=>{
      if(state==="SUBSCRIBED")setStatus("live","Live updates on");
      else if(state==="CHANNEL_ERROR"||state==="TIMED_OUT"){
        setStatus("error","Live updates reconnecting…");
      }else if(state==="CLOSED"){
        setStatus("offline","Live updates disconnected");
      }
    });
  };
  const syncSession=async()=>{
    if(!navigator.onLine){setStatus("offline","Offline · waiting to sync");return}
    try{
      const {data:{session}}=await client.auth.getSession();
      if(session?.user?.id)await connect(session.user.id);
      else{await stop();setStatus("offline","Sign in for live updates")}
    }catch(error){
      console.warn("ZakiTech live-sync session check failed:",error);
      setStatus("error","Live updates unavailable");
    }
  };
  client.auth.onAuthStateChange((event,session)=>{
    if(session?.user?.id)void connect(session.user.id);
    else if(event==="SIGNED_OUT")void stop();
  });
  window.addEventListener("online",()=>{setStatus("connecting","Connection restored · syncing…");void syncSession();requestRefresh({reason:"online"})});
  window.addEventListener("offline",()=>setStatus("offline","Offline · waiting to sync"));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){void syncSession();requestRefresh({reason:"resume"})}});
  void syncSession();
})();