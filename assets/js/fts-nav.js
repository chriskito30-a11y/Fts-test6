/* FTS-NAV.JS — petits compteurs navigation sans écriture Firebase */
(function(){
  function fmt(n){ n = Number(n || 0) || 0; return n > 20 ? '20+' : String(n); }
  function showBadge(id, count){
    var el = document.getElementById(id);
    if(!el) return;
    count = Number(count || 0) || 0;
    if(count > 0){ el.textContent = fmt(count); el.style.display = 'inline-block'; }
    else { el.style.display = 'none'; }
  }
  function readNewsCount(uid){
    if(!uid) return 0;
    try { return Number(localStorage.getItem('fts_member_news_count_' + uid) || 0) || 0; }
    catch(e){ return 0; }
  }
  function updateNewsBadges(uid){ showBadge('news-badge', readNewsCount(uid)); }
  function bindAuthWhenReady(tries){
    tries = tries || 0;
    if(window.firebase && firebase.apps && firebase.apps.length && firebase.auth){
      try { firebase.auth().onAuthStateChanged(function(user){ updateNewsBadges(user && user.uid); }); } catch(e) {}
      return;
    }
    if(tries < 25) setTimeout(function(){ bindAuthWhenReady(tries + 1); }, 120);
  }
  window.FTSNav = { showBadge: showBadge, updateNewsBadges: updateNewsBadges, readNewsCount: readNewsCount };
  document.addEventListener('DOMContentLoaded', function(){ bindAuthWhenReady(0); });
})();
