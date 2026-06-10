/* ================================================================
   FTS REMINDERS SERVICE — Rappels planifiés isolés
   Stocke les rappels dans fts_scheduled_reminders.
   Le dispatch natif admin traite les rappels pending quand sendAt est passé.
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};
  function db(){ return window.FTS.initFirebase(); }
  const path = 'fts_scheduled_reminders';

  S.Reminders = {
    ref(id){ return db().ref(id ? path + '/' + id : path); },
    list(){ return this.ref().orderByChild('sendAt').once('value').then(s => s.val() || {}); },
    listen(callback){ return this.ref().orderByChild('sendAt').on('value', s => callback(s.val() || {})); },
    off(){ return this.ref().off(); },
    create(data){
      const ref = this.ref().push();
      const now = Date.now();
      const payload = Object.assign({}, data, {
        id: ref.key,
        createdAt: now,
        updatedAt: now,
        source: data.source || 'rappels-admin',
        channel: data.channel || 'dm_auto',
        messageType: data.messageType || 'auto-reminder',
        bot: true
      });
      return ref.set(payload).then(() => ref.key);
    },
    update(id, patch){ return this.ref(id).update(Object.assign({}, patch, { updatedAt: Date.now() })); },
    remove(id){ return this.ref(id).remove(); },
    updateMany(ids, patch){
      const rows = Array.isArray(ids) ? ids.filter(Boolean) : [];
      if(!rows.length) return Promise.resolve();
      const now = Date.now();
      const updates = {};
      rows.forEach(id => { updates[id] = Object.assign({}, patch || {}, { updatedAt: now }); });
      return this.ref().update(updates);
    },
    removeMany(ids){
      const rows = Array.isArray(ids) ? ids.filter(Boolean) : [];
      if(!rows.length) return Promise.resolve();
      const updates = {};
      rows.forEach(id => { updates[id] = null; });
      return this.ref().update(updates);
    },
    setStatus(id, status){
      return this.update(id, { status });
    },
    activate(id){ return this.update(id, { status:'pending' }); },
    standby(id){ return this.update(id, { status:'standby' }); }
  };
})(window);
