(()=>{
"use strict";
const client=window.ZakiTechSupabase;
const msg=document.getElementById("pageMessage"),section=document.getElementById("staffSection"),list=document.getElementById("staffList"),form=document.getElementById("createStaffForm"),signout=document.getElementById("signOutButton");
const profileForm=document.getElementById("profileForm"),emailForm=document.getElementById("emailForm"),passwordForm=document.getElementById("passwordForm");
const profileMessage=document.getElementById("profileMessage"),emailMessage=document.getElementById("emailMessage"),passwordMessage=document.getElementById("passwordMessage");
const menuToggle=document.getElementById("menuToggle"),workspaceNav=document.getElementById("workspaceNav"),navScrim=document.getElementById("navScrim");
const avatarFile=document.getElementById("avatarFile"),avatarPreview=document.getElementById("avatarPreview"),avatarFallback=document.getElementById("avatarFallback"),directoryList=document.getElementById("directoryList");
let profile=null,currentUser=null,selectedAvatar=null,removeAvatarRequested=false;
document.getElementById("year").textContent=new Date().getFullYear();
const say=(s,k="")=>{msg.textContent=s;msg.className="page-message "+k};
const fieldSay=(el,s,k="")=>{el.textContent=s;el.className="inline-message "+k};
function closeNav(){workspaceNav.classList.remove("open");workspaceNav.inert=true;menuToggle.setAttribute("aria-expanded","false");menuToggle.setAttribute("aria-label","Open navigation");navScrim.hidden=true}
function openNav(){workspaceNav.inert=false;workspaceNav.classList.add("open");menuToggle.setAttribute("aria-expanded","true");menuToggle.setAttribute("aria-label","Close navigation");navScrim.hidden=false}
function showView(view){document.querySelectorAll(".workspace-view").forEach(panel=>{panel.hidden=panel.dataset.panel!==view});document.querySelectorAll(".nav-button[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===view));closeNav();window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}
menuToggle.addEventListener("click",()=>workspaceNav.classList.contains("open")?closeNav():openNav());navScrim.addEventListener("click",closeNav);document.querySelectorAll(".nav-button[data-view]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.view==="staffSection"&&section.hidden)return;showView(button.dataset.view)}));document.addEventListener("keydown",e=>{if(e.key==="Escape")closeNav()});
const roleName=r=>({owner:"Owner / CEO",vice_admin:"Vice Administrator",web_developer:"Web Developer",application_developer:"Application Developer",engineer:"Engineer",staff:"Staff Member"})[r]||r;
async function adminCall(body){
 const {data,error}=await client.functions.invoke("zakitech-staff-admin",{body});
 if(error){let detail=error.message||"Request failed.";try{if(error.context&&typeof error.context.json==="function"){const b=await error.context.json();detail=b.error||detail}}catch(_){}throw Error(detail)}
 if(data?.error)throw Error(data.error);return data;
}
function initials(name){return (String(name||"Z").trim().split(/\s+/).slice(0,2).map(s=>s[0]||"").join("")||"Z").toUpperCase()}
function setAvatar(url,name){
 if(url){avatarPreview.src=url;avatarPreview.hidden=false;avatarFallback.hidden=true;avatarPreview.onerror=()=>{avatarPreview.hidden=true;avatarFallback.hidden=false}}
 else{avatarPreview.removeAttribute("src");avatarPreview.hidden=true;avatarFallback.hidden=false;avatarFallback.textContent=initials(name)}
}
async function signedAvatar(path){
 if(!path)return null;
 const {data,error}=await client.storage.from("zt-profile-avatars").createSignedUrl(path,3600);
 if(error){console.warn("Could not load profile photo:",error.message);return null}
 return data?.signedUrl||null;
}
async function loadProfile(){
 const {data:{user},error:ue}=await client.auth.getUser();
 if(ue||!user)throw Error("Your secure session has expired. Please sign in again.");
 currentUser=user;
 const {data:p,error}=await client.from("zt_profiles").select("user_id,username,email,display_name,phone,avatar_path,role,status,must_change_password").eq("user_id",user.id).maybeSingle();
 if(error||!p||p.status!=="active")throw Error("Your account is not active. Contact the ZakiTech administrator.");
 profile=p;
 document.getElementById("displayName").textContent=p.display_name;
 document.getElementById("welcomeCopy").textContent="Signed in as "+p.username+". Your access is managed by your company role.";
 document.getElementById("roleBadge").textContent=roleName(p.role).toUpperCase();
 document.getElementById("profileDisplayName").value=p.display_name||"";
 document.getElementById("profilePhone").value=p.phone||"";
 document.getElementById("profileUsername").value=p.username||"";
 const usernameInput=document.getElementById("profileUsername");usernameInput.readOnly=!(["owner","vice_admin"].includes(p.role));document.getElementById("usernameHelp").textContent=usernameInput.readOnly?"Your login username is managed by the CEO or an authorized administrator.":"You can change your login username here. Use 3–32 letters, numbers, dots, underscores or hyphens.";
 document.getElementById("newEmail").value=p.email||user.email||"";
 setAvatar(await signedAvatar(p.avatar_path),p.display_name);
 say("Secure session verified.","good");
 if(["owner","vice_admin"].includes(p.role))document.getElementById("navStaffButton").hidden=false;
 if(p.must_change_password)say("Your account is active. Please set a personal password from Profile & security.", "good");
}
async function renderDirectory(){
 directoryList.textContent="Loading team members…";
 try{
  const data=await adminCall({action:"list-directory"});
  directoryList.replaceChildren();
  if(!data.staff?.length){directoryList.textContent="No active staff members found.";return}
  data.staff.forEach(p=>{
   const card=document.createElement("article");card.className="directory-person";
   const avatar=document.createElement("div");avatar.className="directory-avatar";
   if(p.avatar_url){const img=document.createElement("img");img.src=p.avatar_url;img.alt="";img.loading="lazy";img.onerror=()=>{avatar.textContent=initials(p.display_name)};avatar.append(img)}else avatar.textContent=initials(p.display_name);
   const info=document.createElement("div");info.className="directory-person-info";
   const name=document.createElement("strong");name.textContent=p.display_name||p.username;
   const role=document.createElement("span");role.className="directory-role";role.textContent=roleName(p.role);
   const username=document.createElement("span");username.textContent="@"+p.username;
   info.append(name,role,username);card.append(avatar,info);directoryList.append(card);
  });
 }catch(e){directoryList.textContent=e.message||"Could not load the team directory."}
}
async function loadStaff(){
 list.textContent="Loading staff…";
 try{
  const data=await adminCall({action:"list-staff"});list.replaceChildren();
  if(!data.staff?.length){list.textContent="No staff accounts have been created yet.";return}
  data.staff.forEach(p=>{
   const row=document.createElement("article");row.className="staff-row";
   const info=document.createElement("div");info.className="staff-person";
   const avatar=document.createElement("div");avatar.className="staff-avatar";
   if(p.avatar_url){const img=document.createElement("img");img.src=p.avatar_url;img.alt="";img.loading="lazy";img.onerror=()=>{avatar.textContent=initials(p.display_name)};avatar.append(img)}else avatar.textContent=initials(p.display_name);
   const details=document.createElement("div");details.className="staff-person-details";
   const name=document.createElement("strong");name.textContent=p.display_name;
   const detail=document.createElement("span");detail.textContent=p.username+" · "+p.email+(p.phone?" · "+p.phone:"");
   details.append(name,detail);info.append(avatar,details);
   const meta=document.createElement("div");meta.className="staff-meta";
   const role=document.createElement("span");role.className="staff-role";role.textContent=roleName(p.role);
   const status=document.createElement("span");status.className="status-pill"+(p.status==="suspended"?" suspended":"");status.textContent=p.status;
   meta.append(role,status);
   if(["owner","vice_admin"].includes(profile.role)&&p.user_id!==profile.user_id){
    const editUsername=document.createElement("button");editUsername.type="button";editUsername.className="small-action";editUsername.textContent="Edit username";editUsername.addEventListener("click",async()=>{const next=window.prompt("Set a new login username for "+(p.display_name||p.username)+":",p.username);if(next===null)return;editUsername.disabled=true;try{const result=await adminCall({action:"update-username",user_id:p.user_id,username:next});say(result.message||"Username updated. The new username can be used at the next sign-in.","good");await loadStaff();await renderDirectory()}catch(err){say(err.message||"Could not update username.","error");editUsername.disabled=false}});meta.append(editUsername);
   }
   if((profile.role==="owner"&&p.role!=="owner"&&p.user_id!==profile.user_id)||(profile.role==="vice_admin"&&p.role!=="owner"&&p.user_id!==profile.user_id)){
    const btn=document.createElement("button");btn.type="button";btn.className="small-action";btn.textContent=p.status==="suspended"?"Reactivate":"Suspend";
    btn.addEventListener("click",async()=>{btn.disabled=true;try{await adminCall({action:"set-status",user_id:p.user_id,status:p.status==="suspended"?"active":"suspended"});say("Staff account updated.","good");await loadStaff();await renderDirectory()}catch(e){say(e.message,"error");btn.disabled=false}});
    meta.append(btn);
   }
   row.append(info,meta);list.append(row);
  });
 }catch(e){list.textContent=e.message||"Could not load staff records."}
}
profileForm.addEventListener("submit",async e=>{
 e.preventDefault();fieldSay(profileMessage,"");const button=profileForm.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Saving profile…";
 let newPath=removeAvatarRequested?null:(profile.avatar_path||null),uploadedPath=null;
 try{
  if(selectedAvatar){
   const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp"})[selectedAvatar.type];
   if(!ext)throw Error("Choose a JPG, PNG or WebP image.");
   if(selectedAvatar.size>2*1024*1024)throw Error("Your profile photo must be 2 MB or smaller.");
   uploadedPath=currentUser.id+"/avatar."+ext;
   const {error}=await client.storage.from("zt-profile-avatars").upload(uploadedPath,selectedAvatar,{upsert:true,contentType:selectedAvatar.type,cacheControl:"3600"});
   if(error)throw error;
   newPath=uploadedPath;
  }
  const profilePayload={action:"update-profile",display_name:document.getElementById("profileDisplayName").value,phone:document.getElementById("profilePhone").value,avatar_path:newPath||""};if(["owner","vice_admin"].includes(profile.role))profilePayload.username=document.getElementById("profileUsername").value.trim();
  const result=await adminCall(profilePayload);
  profile.display_name=document.getElementById("profileDisplayName").value.trim();profile.phone=document.getElementById("profilePhone").value.trim();if(profilePayload.username)profile.username=profilePayload.username.toLowerCase();profile.avatar_path=newPath;removeAvatarRequested=false;
  document.getElementById("displayName").textContent=profile.display_name;
  document.getElementById("welcomeCopy").textContent="Signed in as "+profile.username+". Your access is managed by your company role.";
  selectedAvatar=null;avatarFile.value="";
  setAvatar(await signedAvatar(profile.avatar_path),profile.display_name);
  fieldSay(profileMessage,result.message||"Profile saved.","good");say("Your profile has been updated.","good");
  await renderDirectory();if(["owner","vice_admin"].includes(profile.role))await loadStaff();
 }catch(err){console.error("Profile update failed:",err);fieldSay(profileMessage,err.message||"Could not save your profile.","error")}
 finally{button.disabled=false;button.textContent="Save profile changes"}
});
avatarFile.addEventListener("change",()=>{
 const file=avatarFile.files?.[0];if(!file)return;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)){fieldSay(profileMessage,"Choose a JPG, PNG or WebP image.","error");avatarFile.value="";return}
 if(file.size>2*1024*1024){fieldSay(profileMessage,"Your profile photo must be 2 MB or smaller.","error");avatarFile.value="";return}
 selectedAvatar=file;removeAvatarRequested=false;const reader=new FileReader();reader.onload=()=>setAvatar(String(reader.result),document.getElementById("profileDisplayName").value);reader.readAsDataURL(file);
});
document.getElementById("removeAvatar").addEventListener("click",()=>{selectedAvatar=null;avatarFile.value="";removeAvatarRequested=true;setAvatar(null,document.getElementById("profileDisplayName").value)});
async function reauthenticate(password){
 const email=currentUser?.email||profile?.email;
 if(!email)throw Error("Your account email could not be verified. Sign in again.");
 const {error}=await client.auth.signInWithPassword({email,password});
 if(error)throw Error("Current password is incorrect. Please check it and try again.");
 const {data:{user},error:ue}=await client.auth.getUser();if(ue||!user)throw Error("Please sign in again before changing account security settings.");currentUser=user;
}
emailForm.addEventListener("submit",async e=>{
 e.preventDefault();fieldSay(emailMessage,"");const button=emailForm.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Requesting…";
 try{
  const next=document.getElementById("newEmail").value.trim().toLowerCase(),currentPassword=document.getElementById("emailCurrentPassword").value;
  if(!next||next===String(profile.email).toLowerCase())throw Error("Enter a different email address.");
  await reauthenticate(currentPassword);
  const {error}=await client.auth.updateUser({email:next});if(error)throw error;
  fieldSay(emailMessage,"Email-change request sent. Open the verification email to confirm the new address. Your company profile email updates after confirmation.","good");
  document.getElementById("emailCurrentPassword").value="";
 }catch(err){console.error("Email change request failed:",err);fieldSay(emailMessage,err.message||"Could not request an email change.","error")}
 finally{button.disabled=false;button.textContent="Request email change"}
});
passwordForm.addEventListener("submit",async e=>{
 e.preventDefault();fieldSay(passwordMessage,"");const button=passwordForm.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Updating password…";
 try{
  const current=document.getElementById("passwordCurrentPassword").value,next=document.getElementById("newPassword").value,confirm=document.getElementById("confirmNewPassword").value;
  if(next.length<10)throw Error("Use a password with at least 10 characters.");
  if(next!==confirm)throw Error("The new passwords do not match.");
  if(next===current)throw Error("Choose a password different from your current password.");
  await reauthenticate(current);
  const {error}=await client.auth.updateUser({password:next});if(error)throw error;
  passwordForm.reset();fieldSay(passwordMessage,"Password updated successfully. You can continue using ZakiTech with your new password.","good");
 }catch(err){console.error("Password change failed:",err);fieldSay(passwordMessage,err.message||"Could not update the password.","error")}
 finally{button.disabled=false;button.textContent="Update password"}
});
document.getElementById("sendResetEmail").addEventListener("click",async()=>{
 const button=document.getElementById("sendResetEmail");button.disabled=true;
 try{const {error}=await client.auth.resetPasswordForEmail(profile.email,{redirectTo:window.location.origin+"/reset-password.html"});if(error)throw error;fieldSay(passwordMessage,"If the email address is eligible, a password-reset link has been sent. Check your inbox and spam folder.","good")}
 catch(err){fieldSay(passwordMessage,err.message||"Could not send a password-reset email.","error")}
 finally{button.disabled=false}
});
document.getElementById("refreshDirectory").addEventListener("click",renderDirectory);
form.addEventListener("submit",async e=>{
 e.preventDefault();const btn=form.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Creating invitation…";const values=Object.fromEntries(new FormData(form).entries());
 try{const result=await adminCall({action:"create-staff",...values});say(result.message||"Staff invitation created.","good");form.reset();await loadStaff();await renderDirectory()}
 catch(e){say(e.message,"error")}
 finally{btn.disabled=false;btn.textContent="Create staff account ↗"}
});
document.getElementById("refreshStaff").addEventListener("click",loadStaff);
signout.addEventListener("click",async()=>{signout.disabled=true;try{await client.auth.signOut()}finally{location.replace("index.html")}});
async function start(){
 showView("dashboard");
 if(!client){say("Secure authentication is not configured.","error");return}
 const {data:{session}}=await client.auth.getSession();if(!session){location.replace("index.html");return}
 try{await loadProfile();await renderDirectory();if(["owner","vice_admin"].includes(profile.role)){section.hidden=false;if(profile.role!=="owner"){const o=document.querySelector('#staffRole option[value="vice_admin"]');if(o)o.remove()}await loadStaff()}}
 catch(e){console.error(e);say(e.message||"Could not verify your session. Please sign in again.","error");if(/not active|expired|sign in again/i.test(e.message||"")){await client.auth.signOut();location.replace("index.html")}}
}
void start();
})();