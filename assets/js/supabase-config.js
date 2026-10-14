/* Public browser configuration only. Never place service-role or secret keys here. */
window.ZAKITECH_CONFIG=Object.freeze({supabaseUrl:"https://mmozesoarwkimhyloivu.supabase.co",publishableKey:"sb_publishable_Y3fCt1ZguDDK7iO5tN865g_JuFMrQkn"});
window.ZakiTechSupabase=window.supabase?.createClient(window.ZAKITECH_CONFIG.supabaseUrl,window.ZAKITECH_CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"zakitech-auth-v1"}});

// Load the update center across the public entry screen and signed-in workspace pages.
if (!document.querySelector('script[data-zakitech-updater="true"]')) { const updater = document.createElement("script"); updater.src = "assets/js/app-updater.js?v=20261014-fix1"; updater.dataset.zakitechUpdater = "true"; updater.defer = true; document.head.append(updater); }
