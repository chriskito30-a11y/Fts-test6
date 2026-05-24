/* ================================================================
   FTS USERS SERVICE — Profils, rôles, membres
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};
  function db(){ return window.FTS.initFirebase(); }
  const path = 'fts_users';

  S.Users = {
    ref(uid){ return db().ref(uid ? path + '/' + uid : path); },
    get(uid){ return this.ref(uid).once('value').then(s => s.val()); },
    set(uid, data){ return this.ref(uid).set(data); },
    update(uid, patch){ return this.ref(uid).update(patch); },
    remove(uid){ return this.ref(uid).remove(); },
    list(){ return this.ref().once('value').then(s => s.val() || {}); },
    listByStatus(status){ return this.ref().orderByChild('status').equalTo(status).once('value').then(s => s.val() || {}); },
    listPublicActive(){ return db().ref('fts_public_profiles').orderByChild('status').equalTo('active').once('value').then(s => s.val() || {}); },
    approve(uid){ return this.update(uid, { status:'active', updatedAt: Date.now() }); },
    setRole(uid, role){ return this.update(uid, { role, updatedAt: Date.now() }); },
    syncForumUser(uid, profile){
      return db().ref('fts_forum/users/' + uid).update({
        uid,
        name: profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Membre',
        email: profile.email || '',
        role: profile.role || 'member',
        status: profile.status || 'pending',
        disciplines: profile.disciplines || {},
        updatedAt: Date.now()
      });
    }
  };
})(window);
