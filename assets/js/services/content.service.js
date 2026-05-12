/* ================================================================
   FTS CONTENT SERVICE — Contenus publics, catégories, questionnaire
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};
  function db(){ return window.FTS.initFirebase(); }

  S.Content = {
    ref(path){ return db().ref('fts_content' + (path ? '/' + path : '')); },
    get(path){ return this.ref(path).once('value').then(s => s.val()); },
    set(path, data){ return this.ref(path).set(data); },
    update(path, patch){ return this.ref(path).update(Object.assign({}, patch, { updatedAt: Date.now() })); },
    remove(path){ return this.ref(path).remove(); },
    getAnnouncement(){ return this.get('annonces/current'); },
    setAnnouncement(data){ return this.set('annonces/current', Object.assign({}, data, { updatedAt: Date.now() })); },
    getQuestionnaire(){ return this.get('questionnaire'); },
    setQuestionnaire(data){ return this.set('questionnaire', data); },
    getCategories(){ return this.get('categories').then(v => v || {}); },
    setCategories(data){ return this.set('categories', data); }
  };
})(window);
