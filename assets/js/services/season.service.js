/* ================================================================
   FTS SEASON SERVICE — Saison publique administrable
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};
  function db(){ return window.FTS.initFirebase(); }
  const path = 'fts_saison/config';

  S.Season = {
    ref(){ return db().ref(path); },
    get(){ return this.ref().once('value').then(s => s.val()); },
    listen(callback){ return this.ref().on('value', s => callback(s.val())); },
    save(config){ return this.ref().set(Object.assign({}, config, { updatedAt: Date.now() })); },
    update(patch){ return this.ref().update(Object.assign({}, patch, { updatedAt: Date.now() })); }
  };
})(window);
