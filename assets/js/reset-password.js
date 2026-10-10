(() => {
"use strict";
const form=document.getElementById("resetForm"),password=document.getElementById("newPassword"),confirmPassword=document.getElementById("confirmPassword"),message=document.getElementById("resetMessage"),button=document.getElementById("savePassword");
const client=()=>window.ZakiTechSupabase;
function say(text,good=false){message.textContent=text;message.style.color=good?"#75e7c3":""}
let recoveryReady=false;
async function init(){
 const c=client();if(!c){say("Secure password setup could not load. Refresh this page and try again.");return}
 try{
  const {data:{session}}=await c.auth.getSession();
  recoveryReady=!!session;
  if(!recoveryReady){
   say("This reset link is missing, expired, or already used. Return to sign in and request a new password-reset email.");
   button.disabled=true;
  }
  c.auth.onAuthStateChange((event,sessionNow)=>{if(event==="PASSWORD_RECOVERY"&&sessionNow){recoveryReady=true;button.disabled=false;say("Verified. You can now choose your new password.",true)}});
 }catch(e){say("We couldn't verify the reset link. Request a new one from the sign-in page.");button.disabled=true}
}
form.addEventListener("submit",async e=>{
 e.preventDefault();say("");
 if(!recoveryReady){say("Open this page using the latest password-reset link from your email.");return}
 if(password.value.length<10){say("Choose a password with at least 10 characters.");password.focus();return}
 if(password.value!==confirmPassword.value){say("The passwords do not match.");confirmPassword.focus();return}
 button.disabled=true;button.textContent="Saving password…";
 try{
  const {error}=await client().auth.updateUser({password:password.value});
  if(error)throw error;
  await client().auth.signOut();
  say("Your password has been created successfully. Return to sign in and use your email and new password.",true);
  form.reset();recoveryReady=false;
 }catch(err){console.error("Password update failed:",err);say(err.message||"We couldn't save your password. Request a fresh reset link and try again.");}
 finally{button.disabled=false;button.textContent="Save password"}
});
void init();
})();