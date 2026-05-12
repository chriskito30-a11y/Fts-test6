/* ================================================================
   FTS RESOURCES SERVICE — Ressources pédagogiques
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};
  function db(){ return window.FTS.initFirebase(); }
  const path = 'fts_ressources';

  S.Resources = {
    ref(id){ return db().ref(id ? path + '/' + id : path); },
    list(){ return this.ref().once('value').then(s => s.val() || {}); },
    listen(callback){ return this.ref().on('value', s => callback(s.val() || {})); },
    stop(){ return this.ref().off(); },
    get(id){ return this.ref(id).once('value').then(s => s.val()); },
    create(data){
      const ref = this.ref().push();
      return ref.set(Object.assign({}, data, { id: ref.key, createdAt: data.createdAt || Date.now(), updatedAt: Date.now() })).then(() => ref.key);
    },
    update(id, patch){ return this.ref(id).update(Object.assign({}, patch, { updatedAt: Date.now() })); },
    remove(id){ return this.ref(id).remove(); },
    listForProfile(profile){
      return this.list().then(items => Object.entries(items).filter(([id, r]) => {
        if (!profile || profile.role === 'admin') return true;
        const userCats = profile.disciplines || {};
        const cat = r.category || r.categorie || r.discipline || '';
        return !cat || userCats[cat] || userCats[window.FTS.norm ? window.FTS.norm(cat) : cat];
      }).map(([id, r]) => Object.assign({ id }, r)));
    }
  };
})(window);
