(()=>{"use strict";
const RELEASE_API="https://api.github.com/repos/zakpollyqueens/Zakitech/releases/latest";
const CURRENT_VERSION=window.ZAKITECH_BUILD_VERSION||"__ZAKITECH_BUILD_VERSION__";
let readyDownloadUrl="",checking=false;
const $=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
function mount(){
 if(document.getElementById("ztAppUpdateWidget"))return;
 if(!document.getElementById("ztUpdaterStyles")){
  const style=$("style");style.id="ztUpdaterStyles";style.textContent=".zt-update-widget{position:fixed;z-index:9998;right:14px;bottom:14px;width:min(390px,calc(100vw - 28px));box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:13px 14px;border:1px solid #4de3f477;border-radius:17px;background:linear-gradient(130deg,#08182bfa,#102d43fa 68%,#103e4afa);color:#eefaff;box-shadow:0 14px 42px #0008,0 0 26px #00d9f21c;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);font-family:inherit}.zt-update-copy{min-width:0;flex:1}.zt-update-head{display:flex;align-items:center;gap:7px;margin-bottom:5px}.zt-update-title{font-size:10px;letter-spacing:.13em;color:#8cefff}.zt-update-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:#56e4f5;box-shadow:0 0 10px #56e4f5}.zt-update-message{display:block;font-size:11px;line-height:1.45;color:#d0e5f2}.zt-update-button{flex:0 0 auto;max-width:46%;border:1px solid #6be9f5;border-radius:11px;padding:10px 11px;background:linear-gradient(135deg,#85f3ff,#3ac7e2);color:#062139;font-weight:800;font-size:11px;line-height:1.25;cursor:pointer;box-shadow:0 5px 16px #00d7ed2b}.zt-update-button:disabled{opacity:.7;cursor:wait}.zt-update-button.zt-update-current{background:#123c43;color:#a7f5dc;border-color:#57d9bd}.zt-update-button.zt-update-ready{background:linear-gradient(135deg,#a2fbd8,#4cdab8);border-color:#a2fbd8}@media(max-width:520px){.zt-update-widget{right:10px;bottom:10px;width:calc(100vw - 20px);padding:11px}.zt-update-button{max-width:43%;font-size:10px;padding:9px}}@media(prefers-reduced-motion:reduce){.zt-update-widget *{scroll-behavior:auto!important}}";document.head.append(style)
 }
 const wrap=$("section","zt-update-widget");wrap.id="ztAppUpdateWidget";wrap.setAttribute("aria-label","ZakiTech app update center");
 const btn=$("button","zt-update-button","↻ Check for updates");btn.type="button";
 const msg=$("span","zt-update-message","Checking the latest published ZakiTech release…");msg.setAttribute("aria-live","polite");
 const dot=$("span","zt-update-dot","");dot.setAttribute("aria-hidden","true");
 const title=$("strong","zt-update-title","ZAK UPDATE CENTER");
 const head=$("div","zt-update-head");head.append(dot,title);
 const textBox=$("div","zt-update-copy");textBox.append(head,msg);wrap.append(textBox,btn);document.body.append(wrap);
 btn.addEventListener("click",async()=>{if(btn.disabled)return;if(readyDownloadUrl){msg.textContent="Opening the latest APK download. When it finishes, tap the APK and approve Android’s install prompt.";btn.textContent="Opening download…";window.location.href=readyDownloadUrl;return}await checkForUpdates(true)});
 void checkForUpdates(false);
}
async function checkForUpdates(manual){
 if(checking)return;checking=true;
 const btn=document.querySelector("#ztAppUpdateWidget .zt-update-button"),msg=document.querySelector("#ztAppUpdateWidget .zt-update-message");
 if(!btn||!msg){checking=false;return}
 btn.disabled=true;btn.textContent="Checking…";msg.textContent="Checking the official ZakiTech releases for the newest APK.";
 try{
  if(!navigator.onLine)throw Error("You’re offline. Connect to the internet and try again.");
  const response=await fetch(RELEASE_API,{headers:{"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},cache:"no-store"});
  if(!response.ok)throw Error("The release service is unavailable right now (HTTP "+response.status+").");
  const release=await response.json();
  const apk=(release.assets||[]).find(a=>a.name==="ZakiTech.apk")||(release.assets||[]).find(a=>/\.apk$/i.test(a.name));
  if(!apk||!/^https:\/\/github\.com\/zakpollyqueens\/Zakitech\/releases\/download\/[A-Za-z0-9._-]+\/[^/]+\.apk$/i.test(apk.browser_download_url||""))throw Error("The latest release does not contain a trusted APK download yet.");
  const latest=String(release.tag_name||"").replace(/^v/i,""),current=String(CURRENT_VERSION).replace(/^v/i,"");
  readyDownloadUrl=apk.browser_download_url;
  if(latest&&current!=="__ZAKITECH_BUILD_VERSION__"&&current!=="web"&&latest===current){
   msg.textContent="You have the latest published version ("+release.tag_name+").";btn.textContent="✓ App is up to date";btn.classList.add("zt-update-current");btn.classList.remove("zt-update-ready");readyDownloadUrl="";return;
  }
  msg.textContent="Update available: "+(release.tag_name||"latest release")+". Tap Download update to download the APK.";
  btn.textContent="⬇ Download update";btn.classList.add("zt-update-ready");btn.classList.remove("zt-update-current");btn.setAttribute("aria-label","Download the latest ZakiTech Android APK");
 }catch(error){
  readyDownloadUrl="";msg.textContent=error?.message||"Could not check for updates. Try again when online.";btn.textContent=manual?"↻ Try again":"↻ Check for updates";btn.classList.remove("zt-update-ready","zt-update-current");
 }finally{checking=false;btn.disabled=false}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();