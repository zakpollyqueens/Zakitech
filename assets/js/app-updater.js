(()=>{"use strict";
const RELEASE_API="https://api.github.com/repos/zakpollyqueens/Zakitech/releases/latest";
const FALLBACK_APK="https://github.com/zakpollyqueens/Zakitech/releases/latest/download/ZakiTech.apk";
const CURRENT_VERSION=window.ZAKITECH_BUILD_VERSION||"__ZAKITECH_BUILD_VERSION__";\nlet readyDownloadUrl="";
const $=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el};
function mount(){
 if(document.getElementById("ztAppUpdateWidget"))return;
 const wrap=$("section","zt-update-widget");wrap.id="ztAppUpdateWidget";
 const btn=$("button","zt-update-button","↻  Check for updates");btn.type="button";
 const msg=$("span","zt-update-message","Keep your ZakiTech app up to date.");
 const dot=$("span","zt-update-dot","");dot.setAttribute("aria-hidden","true");
 const title=$("strong","zt-update-title","ZAK UPDATE CENTER");
 const head=$("div","zt-update-head");head.append(dot,title);
 const textBox=$("div","zt-update-copy");textBox.append(head,msg);
 wrap.append(textBox,btn);document.body.append(wrap);
 btn.addEventListener("click",async()=>{
  if(btn.disabled)return;if(readyDownloadUrl){msg.textContent="Opening the update download. After it finishes, open the APK and confirm Install in Android.";window.location.href=readyDownloadUrl;return}btn.disabled=true;btn.textContent="Checking…";msg.textContent="Checking the latest approved ZakiTech release.";
  try{
   const response=await fetch(RELEASE_API,{headers:{"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},cache:"no-store"});
   if(!response.ok)throw Error("The release service is temporarily unavailable.");
   const release=await response.json();
   const apk=(release.assets||[]).find(a=>a.name==="ZakiTech.apk")||(release.assets||[]).find(a=>/\.apk$/i.test(a.name));
   if(!apk)throw Error("No downloadable APK is attached to the latest release yet.");
   const latest=String(release.tag_name||"").replace(/^v/,"");
   const current=String(CURRENT_VERSION).replace(/^v/,"");
   if(latest&&latest===current){msg.textContent="You're using the latest published version ("+release.tag_name+").";btn.textContent="✓ App is up to date";btn.classList.add("zt-update-current");return}
   msg.textContent="Update available: "+(release.tag_name||"new version")+". Tap Download update to get it.";
   btn.textContent="⬇  Download update";btn.classList.add("zt-update-ready");
   readyDownloadUrl=apk.browser_download_url||FALLBACK_APK;
   btn.setAttribute("aria-label","Download the latest ZakiTech Android update");
  }catch(e){msg.textContent=(e&&e.message)||"Could not check for updates. Try again when online.";btn.textContent="↻  Try again"}
  finally{btn.disabled=false}
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();