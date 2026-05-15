/* FTS-NAV.JS — badge nouveautés localStorage + active nav */
(function(){
  'use strict';

  function setBadge(id, count){
    var el = document.getElementById(id);
    if (!el) return;
    var n = Math.max(0, Number(count || 0));
    if (!n) {
      el.textContent = '';
      el.classList.remove('is-on');
      el.style.display = 'none';
      return;
    }
    el.textContent = n > 20 ? '20+' : String(n);
    el.classList.add('is-on');
    el.style.display = 'inline-flex';
  }

  function getStoredNewsCount(uid){
    if (!uid) return 0;
    try { return Number(localStorage.getItem('fts_member_news_count_' + uid) || 0); }
    catch(e){ return 0; }
  }

  function updateActiveNav(){
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.fts-nav-item[data-nav]').forEach(function(a){
      var nav = a.getAttribute('data-nav');
      var active = false;
      if (nav === 'membres' && page === 'membres.html') active = true;
      if (nav === 'messages' && (page === 'hub-messages.html' || page === 'messages.html' || page === 'forum.html')) active = true;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
    });
  }

  function updateBadges(){
    var done = function(uid){ setBadge('fts-news-badge', getStoredNewsCount(uid)); };
    try {
      if (window.firebase && firebase.auth) {
        var user = firebase.auth().currentUser;
        if (user) return done(user.uid);
        firebase.auth().onAuthStateChanged(function(u){ done(u && u.uid); });
      }
    } catch(e) {}
  }

  window.FTSNav = { setBadge: setBadge, updateBadges: updateBadges };
  document.addEventListener('DOMContentLoaded', function(){
    updateActiveNav();
    updateBadges();
  });
})();
