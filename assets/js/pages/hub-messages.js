/* HUB MESSAGES — navigation UX sans toucher aux routes Firebase */
(function(){
  function boot(){
    if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js', {scope:'./'}).catch(function(){}); }
    var db = FTS.initFirebase();
    var auth = firebase.auth();
    auth.onAuthStateChanged(async function(user){
      if(!user){ location.href='auth.html'; return; }
      try{
        var s = await db.ref('fts_users/' + user.uid).once('value');
        var me = s.val();
        if(!me || me.status !== 'active'){ await auth.signOut(); location.href='auth.html'; return; }
        var loading = document.getElementById('auth-loading');
        var content = document.getElementById('page-content');
        if(loading) loading.style.display = 'none';
        if(content) content.style.display = 'block';
        if(window.FTSNav) {
          window.FTSNav.updateNewsBadges(user.uid);
          var c = window.FTSNav.readNewsCount(user.uid);
          var h = document.getElementById('hub-news-count');
          if(h) h.textContent = c > 20 ? '20+' : String(c || 0);
        }
      }catch(e){
        console.warn('[FTS Hub Messages]', e);
        var box = document.getElementById('auth-loading');
        if(box) box.innerHTML = '<div class="auth-loading-logo">FAIS TON <span>SHOW</span></div><p style="color:#888;text-align:center;padding:1rem">Erreur chargement messages.<br><br><a style="color:#c9a84c" href="membres.html">Retour membres</a></p>';
      }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
