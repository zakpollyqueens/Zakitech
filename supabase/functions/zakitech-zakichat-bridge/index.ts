import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const CHAT_URL="https://xdpevlurgtvgduwzyoue.supabase.co";
const CHAT_PUBLIC_KEY="sb_publishable_aMRHrU5gtNmpsytQNaz61w_Yc-yh_Pk";
const clean=(v:unknown,max=10000)=>typeof v==="string"?v.trim().slice(0,max):"";

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed."});
 try{
  const body=await req.json();
  const token=clean(body.adminSessionToken,300);
  if(!token)return reply(401,{error:"A verified ZakiChat administrator session is required."});
  const verification=await fetch(CHAT_URL+"/functions/v1/two-step",{
   method:"POST",
   headers:{"Content-Type":"application/json","apikey":CHAT_PUBLIC_KEY},
   body:JSON.stringify({action:"admin-session-verify",adminSessionToken:token})
  });
  const session=await verification.json().catch(()=>({}));
  if(!verification.ok||!(session.success===true||session.valid===true)||!session.role)return reply(401,{error:"The ZakiChat administrator session is invalid or expired."});
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return reply(503,{error:"ZakiTech integration is not configured."});
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  if(clean(body.action,80)==="list-published-notifications"){
   const {data,error}=await db.from("zt_notifications").select("id,title,body,notification_type,audience,published_at,product:zt_products(name,slug)").eq("status","published").not("published_at","is",null).order("published_at",{ascending:false}).limit(30);
   if(error)return reply(500,{error:"Could not load published ZakiTech notifications."});
   return reply(200,{success:true,notifications:data||[]});
  }
  if(clean(body.action,80)==="sync-latest-release"){
   if(session.role!=="super_admin")return reply(403,{error:"A ZakiChat super-administrator session is required to publish an app release."});
   const {data:product,error:productError}=await db.from("zt_products").select("id,name").eq("slug","molan-chat").maybeSingle();
   if(productError||!product)return reply(500,{error:"Molan Chat is not registered in the ZakiTech Product Hub."});
   const {data:build,error:buildError}=await db.from("zt_product_builds").select("*").eq("product_id",product.id).eq("status","published").order("published_at",{ascending:false}).limit(1).maybeSingle();
   if(buildError||!build)return reply(404,{error:"No published ZakiTech build is available to import yet."});
   const contentType=/\.apk$/i.test(build.file_name)?"application/vnd.android.package-archive":/\.zip$/i.test(build.file_name)?"application/zip":"application/octet-stream";
   const callChat=async(action:string,payload:Record<string,unknown>)=>{
    const response=await fetch(CHAT_URL+"/functions/v1/release-management",{method:"POST",headers:{"Content-Type":"application/json","apikey":CHAT_PUBLIC_KEY,"Authorization":"Bearer "+CHAT_PUBLIC_KEY},body:JSON.stringify({action,adminSessionToken:token,...payload})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.success!==true)throw Object.assign(Error(result.error||"Molan Chat release service rejected the request."),{status:response.status});
    return result;
   };
   const existing=await callChat("admin-list",{});
   if((existing.releases||[]).some((r:any)=>r.version===build.version&&r.channel===build.channel)){
    return reply(200,{success:true,already_imported:true,version:build.version,message:"This version already exists in Molan Chat Release Management. Open its existing record instead of importing a duplicate."});
   }
   const publicUrl=db.storage.from("zt-product-releases").getPublicUrl(build.storage_path).data.publicUrl;
   const download=await fetch(publicUrl);
   if(!download.ok)return reply(502,{error:"The published ZakiTech package could not be downloaded for secure transfer."});
   const declared=Number(download.headers.get("content-length")||build.file_size||0);
   if(declared>104857600)return reply(413,{error:"The release package exceeds the 100 MB ZakiChat upload limit."});
   const bytes=new Uint8Array(await download.arrayBuffer());
   if(!bytes.length||bytes.length>104857600)return reply(413,{error:"The release package is empty or exceeds the 100 MB upload limit."});
   const upload=await callChat("admin-upload-url",{fileName:build.file_name,fileSize:bytes.length,contentType});
   const chatStorage=createClient(CHAT_URL,CHAT_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
   const {error:uploadError}=await chatStorage.storage.from("app-releases").uploadToSignedUrl(upload.path,upload.token,bytes,{contentType,upsert:false});
   if(uploadError)throw Error("The Molan Chat release upload failed: "+uploadError.message);
   await callChat("admin-save",{version:build.version,title:build.title,description:build.description||"Release published from the ZakiTech Product Hub.",channel:build.channel,releaseNotes:build.release_notes||"",fileName:build.file_name,downloadPath:upload.path,contentType,fileSize:bytes.length,status:"published"});
   await db.from("zt_audit_events").insert({event_type:"zakichat_release_synced",details:{product_id:product.id,build_id:build.id,version:build.version,channel:build.channel}});
   return reply(200,{success:true,version:build.version,message:"Published ZakiTech build "+build.version+" has been copied into Molan Chat Release Management and published."});
  }
  const externalId=clean(body.external_message_id,200),sender=clean(body.sender_name,120)||"Molan Chat user",email=clean(body.sender_email,254),subject=clean(body.subject,200)||"Molan Chat support request",message=clean(body.message,10000),received=clean(body.received_at,60);
  if(!externalId||message.length<1)return reply(400,{error:"A support request ID and message are required."});
  const {data:product,error:productError}=await db.from("zt_products").select("id").eq("slug","molan-chat").maybeSingle();
  if(productError||!product)return reply(500,{error:"Molan Chat is not registered in the ZakiTech Product Hub."});
  const values={product_id:product.id,external_message_id:externalId,sender_name:sender,sender_email:email||null,subject,message,source:"zaki_chat",status:"new",received_at:received&&Number.isFinite(Date.parse(received))?new Date(received).toISOString():new Date().toISOString(),updated_at:new Date().toISOString()};
  const {data:existing}=await db.from("zt_product_messages").select("id").eq("product_id",product.id).eq("external_message_id",externalId).maybeSingle();
  if(existing){
   return reply(200,{success:true,already_imported:true,message:"This support request is already available in ZakiTech."});
  }
  const {error}=await db.from("zt_product_messages").insert(values);
  if(error)return reply(500,{error:"Could not import the support request into ZakiTech."});
  await db.from("zt_audit_events").insert({event_type:"zakichat_support_imported",details:{product_id:product.id,external_message_id:externalId,source_role:session.role}});
  return reply(201,{success:true,message:"Molan Chat support request delivered to the ZakiTech Product Messages workstation."});
 }catch(e){return reply(400,{error:(e as Error).message||"Invalid integration request."})}
});