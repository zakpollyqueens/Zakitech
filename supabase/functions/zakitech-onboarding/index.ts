import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:unknown,max=1000)=>typeof v==="string"?v.trim().slice(0,max):"";
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,"0")).join("");
function decodeDataUrl(value:string,allowed:string[],maxBytes:number){
 const m=value.match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$/);
 if(!m||!allowed.includes(m[1]))throw Error("Choose a supported file type.");
 const raw=atob(m[2]);if(raw.length>maxBytes)throw Error("The uploaded file is too large.");
 const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 const ext:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"};
 return {bytes,mime:m[1],ext:ext[m[1]]};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed."});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return reply(503,{error:"Onboarding is not configured."});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 let b:Record<string,unknown>;try{b=await req.json()}catch{return reply(400,{error:"Invalid request."})}
 const action=clean(b.action,40),voucher=clean(b.voucher,100).toUpperCase();
 if(!/^ZTK-[A-F0-9]{36}$/.test(voucher))return reply(400,{error:"Enter the complete invitation voucher from ZakiTech."});
 const voucherHash=await hash(voucher);
 const {data:invite,error:inviteError}=await db.from("zt_staff_invites").select("id,username,display_name,role,full_access,status,expires_at,created_by").eq("voucher_hash",voucherHash).maybeSingle();
 if(inviteError)return reply(500,{error:"Could not verify this invitation."});
 if(!invite||invite.status!=="pending")return reply(404,{error:"This invitation is invalid, already used, or has been revoked."});
 if(new Date(invite.expires_at).getTime()<Date.now()){
  await db.from("zt_staff_invites").update({status:"expired"}).eq("id",invite.id).eq("status","pending");
  return reply(410,{error:"This invitation has expired. Ask the ZakiTech receptionist or administrator for a new one."});
 }
 if(action==="inspect-invite")return reply(200,{invite:{username:invite.username,display_name:invite.display_name,role:invite.role,expires_at:invite.expires_at}});
 if(action!=="complete-onboarding")return reply(400,{error:"Unknown onboarding action."});
 const legalName=clean(b.legal_name,120),email=clean(b.email,254).toLowerCase(),phone=clean(b.phone,30),address=clean(b.address,500),identityNumber=clean(b.identity_document_number,100),password=typeof b.password==="string"?b.password:"",confirm=typeof b.confirm_password==="string"?b.confirm_password:"";
 if(legalName.length<2||!/^\S+@\S+\.\S+$/.test(email)||address.length<5||password.length<10||password!==confirm)return reply(400,{error:"Complete the required details. Your password must be at least 10 characters and both password fields must match."});
 if(phone&&!/^[+0-9() .-]{6,30}$/.test(phone))return reply(400,{error:"Enter a valid phone number."});
 const avatarData=clean(b.avatar_data_url,5_000_000),documentData=clean(b.document_data_url,8_000_000),documentName=clean(b.document_name,120);
 if(!avatarData)return reply(400,{error:"Upload a profile photo to continue."});
 if(!identityNumber&&!documentData)return reply(400,{error:"Enter an identity document number or upload a passport/identity document."});
 let avatar:{bytes:Uint8Array;mime:string;ext:string},doc:{bytes:Uint8Array;mime:string;ext:string}|null=null;
 try{avatar=decodeDataUrl(avatarData,["image/jpeg","image/png","image/webp"],3*1024*1024);if(documentData)doc=decodeDataUrl(documentData,["application/pdf","image/jpeg","image/png","image/webp"],5*1024*1024)}catch(e){return reply(400,{error:(e as Error).message})}
 const {data:existingEmail,error:emailError}=await db.from("zt_profiles").select("user_id").ilike("email",email).maybeSingle();
 if(emailError)return reply(500,{error:"Could not verify the email address."});
 if(existingEmail)return reply(409,{error:"That email address is already connected to a ZakiTech account."});
 const {data:claim,error:claimError}=await db.from("zt_staff_invites").update({status:"claimed",claimed_at:new Date().toISOString()}).eq("id",invite.id).eq("status","pending").select("id").maybeSingle();
 if(claimError||!claim)return reply(409,{error:"This invitation is already being used or is no longer available."});
 let userId:string|null=null,profileSaved=false;
 try{
  const {data:created,error:createError}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username:invite.username,display_name:legalName,company:"ZakiTech"}});
  if(createError||!created.user)throw Error(createError?.message||"Could not create your secure account.");
  userId=created.user.id;
  const avatarPath=userId+"/avatar."+avatar.ext;
  const {error:avatarError}=await db.storage.from("zt-profile-avatars").upload(avatarPath,avatar.bytes,{contentType:avatar.mime,upsert:true});
  if(avatarError)throw Error("Your profile photo could not be saved. Please try again.");
  let documentPath:string|null=null;
  if(doc){
   documentPath=userId+"/identity."+doc.ext;
   const {error:documentError}=await db.storage.from("zt-staff-documents").upload(documentPath,doc.bytes,{contentType:doc.mime,upsert:true});
   if(documentError)throw Error("Your identity document could not be stored securely. Please try again.");
  }
  const {error:profileError}=await db.from("zt_profiles").insert({
   user_id:userId,username:invite.username,email,display_name:legalName,legal_name:legalName,phone:phone||null,address,
   identity_document_number:identityNumber||null,identity_document_path:documentPath,avatar_path:avatarPath,
   role:invite.role,full_access:invite.full_access,status:"active",must_change_password:false,created_by:invite.created_by,onboarding_completed_at:new Date().toISOString()
  });
  if(profileError)throw Error("Your account profile could not be saved. Please contact ZakiTech support.");
  profileSaved=true;
  await db.from("zt_staff_invites").update({claimed_user_id:userId}).eq("id",invite.id);
  await db.from("zt_audit_events").insert({actor_user_id:invite.created_by,target_user_id:userId,event_type:"staff_onboarding_completed",details:{invite_id:invite.id,username:invite.username,role:invite.role,identity_document_uploaded:!!doc,identity_number_provided:!!identityNumber,document_name:documentName||null}});
  const {data:sessionData,error:sessionError}=await db.auth.signInWithPassword({email,password});
  if(sessionError||!sessionData.session)throw Error("Your account was created. Please sign in with your assigned username and password.");
  return reply(201,{message:"Welcome to ZakiTech. Your profile and assigned workspace are ready.",session:sessionData.session,profile:{username:invite.username,display_name:legalName,role:invite.role}});
 }catch(e){
  if(userId&&!profileSaved){await db.storage.from("zt-profile-avatars").remove([userId+"/avatar.jpg",userId+"/avatar.png",userId+"/avatar.webp"]);await db.storage.from("zt-staff-documents").remove([userId+"/identity.pdf",userId+"/identity.jpg",userId+"/identity.png",userId+"/identity.webp"]);await db.auth.admin.deleteUser(userId);}
  if(!profileSaved)await db.from("zt_staff_invites").update({status:"pending",claimed_at:null,claimed_user_id:null}).eq("id",invite.id).eq("status","claimed");
  return reply(400,{error:(e as Error).message||"Could not finish onboarding."});
 }
});