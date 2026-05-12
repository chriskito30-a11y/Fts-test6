/* ================================================================
   FTS EVENTS SERVICE — Calendrier et événements
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};
  function db(){ return window.FTS.initFirebase(); }
  const path = 'fts_events';

  S.Events = {
    ref(id){ return db().ref(id ? path + '/' + id : path); },
    list(){ return this.ref().orderByChild('date').once('value').then(s => s.val() || {}); },
    listen(callback){ return this.ref().orderByChild('date').on('value', s => callback(s.val() || {})); },
    stop(){ return this.ref().off(); },
    get(id){ return this.ref(id).once('value').then(s => s.val()); },
    create(data){
      const ref = this.ref().push();
      return ref.set(Object.assign({}, data, { id: ref.key, createdAt: Date.now(), updatedAt: Date.now() })).then(() => ref.key);
    },
    update(id, patch){ return this.ref(id).update(Object.assign({}, patch, { updatedAt: Date.now() })); },
    remove(id){ return this.ref(id).remove(); },
    upcoming(limit){
      const now = Date.now();
      return this.list().then(items => Object.entries(items)
        .map(([id, e]) => Object.assign({ id }, e))
        .filter(e => (e.active !== false) && Number(e.date || e.start || 0) >= now)
        .sort((a,b) => Number(a.date || a.start || 0) - Number(b.date || b.start || 0))
        .slice(0, limit || 10));
    }
  };
})(window);
