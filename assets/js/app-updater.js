(()=>{"use strict";
/* The floating ZakiTech update panel has been removed from the interface. */
function removeFloatingUpdatePanel(){
 const widget=document.getElementById("ztAppUpdateWidget");
 if(widget)widget.remove();
 const injectedStyles=document.getElementById("ztUpdaterStyles");
 if(injectedStyles)injectedStyles.remove();
}
if(document.readyState==="loading"){
 document.addEventListener("DOMContentLoaded",removeFloatingUpdatePanel,{once:true});
}else{
 removeFloatingUpdatePanel();
}
})();