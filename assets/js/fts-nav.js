/* FTS-NAV.JS — navigation membre/prof/admin partagée */
(function(){
  'use strict';

  var ADMIN_FALLBACK_EMAILS = ['contact@faistonshow.fr'];

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

  function boolVisible(el, visible){
    if (!el) return;
    el.hidden = !visible;
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
    el.style.display = visible ? 'flex' : 'none';
  }

  function ensureRoleLinks(nav){
    if (!nav) return;
    if (!document.getElementById('fts-nav-prof')) {
      var prof = document.createElement('a');
      prof.href = 'profs.html';
      prof.className = 'fts-nav-item fts-role-nav';
      prof.id = 'fts-nav-prof';
      prof.setAttribute('data-nav', 'prof');
      prof.hidden = true;
      prof.setAttribute('aria-hidden', 'true');
      prof.innerHTML = '<span class="fts-nav-icon">🎓</span><span class="fts-nav-label">Prof</span>';
      nav.appendChild(prof);
    }
    if (!document.getElementById('fts-nav-admin')) {
      var admin = document.createElement('a');
      admin.href = 'admin.html';
      admin.className = 'fts-nav-item fts-role-nav';
      admin.id = 'fts-nav-admin';
      admin.setAttribute('data-nav', 'admin');
      admin.hidden = true;
      admin.setAttribute('aria-hidden', 'true');
      admin.innerHTML = '<span class="fts-nav-icon">🛡️</span><span class="fts-nav-label">Admin</span>';
      nav.appendChild(admin);
    }
  }

  function applyRoleNavigation(profile, email){
    var nav = document.querySelector('.fts-bottom-nav');
    if (!nav) return;
    ensureRoleLinks(nav);

    var role = String((profile && profile.role) || '').trim().toLowerCase();
    var mail = String(email || (profile && profile.email) || '').trim().toLowerCase();
    var isAdmin = role === 'admin' || ADMIN_FALLBACK_EMAILS.indexOf(mail) !== -1;
    var isProf = role === 'prof' || isAdmin;

    boolVisible(document.getElementById('fts-nav-prof'), isProf);
    boolVisible(document.getElementById('fts-nav-admin'), isAdmin);

    nav.classList.remove('fts-nav-3', 'fts-nav-4', 'fts-nav-5');
    nav.classList.add(isAdmin ? 'fts-nav-5' : isProf ? 'fts-nav-4' : 'fts-nav-3');
    updateActiveNav();
  }

  function updateActiveNav(){
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.fts-nav-item[data-nav]').forEach(function(a){
      var nav = a.getAttribute('data-nav');
      var active = false;
      if (nav === 'membres' && page === 'membres.html') active = true;
      if (nav === 'messages' && (page === 'hub-messages.html' || page === 'messages.html' || page === 'forum.html')) active = true;
      if (nav === 'prof' && page === 'profs.html') active = true;
      if (nav === 'admin' && page === 'admin.html') active = true;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
    });
  }

  function updateBadges(){
    var done = function(uid){ setBadge('fts-news-badge', getStoredNewsCount(uid)); };
    try {
      if (window.FTS && typeof FTS.initFirebase === 'function') FTS.initFirebase();
      if (window.firebase && firebase.auth) {
        var user = firebase.auth().currentUser;
        if (user) return done(user.uid);
        firebase.auth().onAuthStateChanged(function(u){ done(u && u.uid); });
      }
    } catch(e) {}
  }

  function initRoleNavigation(){
    var nav = document.querySelector('.fts-bottom-nav');
    if (!nav) return;
    ensureRoleLinks(nav);
    applyRoleNavigation(null, null);
    try {
      if (window.FTS && typeof FTS.initFirebase === 'function') FTS.initFirebase();
      if (!(window.firebase && firebase.auth)) return;
      firebase.auth().onAuthStateChanged(function(user){
        if (!user) { applyRoleNavigation(null, null); return; }
        if (firebase.database) {
          firebase.database().ref('fts_users/' + user.uid).once('value')
            .then(function(snap){ applyRoleNavigation(snap.val() || {}, user.email); })
            .catch(function(){ applyRoleNavigation({ email: user.email }, user.email); });
        } else {
          applyRoleNavigation({ email: user.email }, user.email);
        }
      });
    } catch(e) {
      console.warn('[FTSNav] role navigation:', e);
    }
  }

  window.FTSNav = {
    setBadge: setBadge,
    updateBadges: updateBadges,
    updateRoleNavigation: applyRoleNavigation,
    refresh: function(){ updateActiveNav(); updateBadges(); initRoleNavigation(); }
  };

  document.addEventListener('DOMContentLoaded', function(){
    updateActiveNav();
    updateBadges();
    initRoleNavigation();
  });
})();
