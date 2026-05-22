/* ================================================================
   FTS NOTIFICATIONS SERVICE — Préférences, tokens et déclenchement push
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};
  function db(){ return window.FTS.initFirebase(); }

  S.Notifications = {
    userRef(uid){ return db().ref('fts_user_notifications/' + uid); },
    getUser(uid){ return this.userRef(uid).once('value').then(s => s.val() || {}); },
    updateUser(uid, patch){ return this.userRef(uid).update(Object.assign({}, patch, { updatedAt: Date.now() })); },
    setToken(uid, token, meta){ return this.userRef(uid + '/tokens/' + token).set(Object.assign({ token, updatedAt: Date.now() }, meta || {})); },
    removeToken(uid, token){ return this.userRef(uid + '/tokens/' + token).remove(); },
    logDebug(payload){ return db().ref('fts_debug_notifications').push(Object.assign({}, payload, { ts: Date.now() })); },
    async send(payload){
      if (!window.FTS.PUSH || !window.FTS.PUSH.workerUrl) throw new Error('Worker push non configuré.');
      const workerUrl = String(window.FTS.PUSH.workerUrl || '').replace(/\/+$/, '');
      const endpoint = /\/notify$/.test(workerUrl) ? workerUrl : (workerUrl + '/notify');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erreur envoi notification: ' + res.status);
      return res.json().catch(() => ({}));
    }
  };
})(window);
