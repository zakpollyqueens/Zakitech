(()=>{"use strict";
const root=document.getElementById("pageContent");if(!root)return;
const palette=[["#63e5f4","99,229,244"],["#9b8cff","155,140,255"],["#66dfbd","102,223,189"],["#ffbd78","255,189,120"],["#77a9ff","119,169,255"],["#f29acb","242,154,203"]];
function enhance(){const cards=Array.from(root.querySelectorAll(":scope > .page-card"));if(!cards.length)return;
const portfolio=cards.find(c=>/company product portfolio/i.test(c.querySelector(".page-card-head h2")?.textContent||""));
if(portfolio){portfolio.classList.add("hub-portfolio-card");const list=portfolio.querySelector(":scope > .page-list");if(list&&!list.classList.contains("hub-product-grid")){list.classList.add("hub-product-grid");Array.from(list.children).forEach((item,index)=>{if(!item.classList.contains("page-row")||item.classList.contains("hub-product-card"))return;item.classList.add("hub-product-card");const [accent,rgb]=palette[index%palette.length];item.style.setProperty("--hub-accent",accent);item.style.setProperty("--hub-accent-rgb",rgb);
const main=item.querySelector(".page-row-main"),copy=item.querySelector(".page-row-copy"),heading=copy?.querySelector("h3");if(main&&copy&&heading&&!main.querySelector(".hub-product-art")){const art=document.createElement("div");art.className="hub-product-art";const words=(heading.textContent||"Z").trim().split(/\s+/);art.textContent=words.length>1?words.slice(0,2).map(w=>w[0]).join("").toUpperCase():words[0].slice(0,2).toUpperCase();art.setAttribute("aria-hidden","true");main.insertBefore(art,copy);copy.classList.add("hub-product-identity");const kicker=document.createElement("span");kicker.className="hub-product-kicker";kicker.textContent="ZAKITECH PRODUCT";copy.insertBefore(kicker,heading);}
const actions=item.querySelector(":scope > .page-actions");if(actions){actions.classList.add("hub-product-actions");const first=actions.querySelector(".page-link-button");if(first)first.setAttribute("aria-label","Open "+(heading?.textContent||"product")+" workspace");}
});}
}
cards.forEach(c=>{const h=c.querySelector(".page-card-head h2")?.textContent?.toLowerCase()||"";if(h.includes("connected admin center"))c.classList.add("hub-admin-bridge");if(h.includes("register a product"))c.classList.add("hub-register-card");});
}
const observer=new MutationObserver(()=>{if(!root.dataset.hubEnhanced){enhance();root.dataset.hubEnhanced="true"}else enhance()});observer.observe(root,{childList:true,subtree:true});enhance();
})();