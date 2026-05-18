/* ================================================================
   FTS-OFFLINE.JS — couche offline durable pour la PWA Fais Ton Show
   - Cache local IndexedDB des données Firebase essentielles
   - Fallback lecture seule quand le réseau est absent
   - Bandeau UX hors ligne / synchronisation
   - API extensible pour futures fonctionnalités
   À charger après fts-firebase.js et avant les scripts de page.
   ================================================================ */
(function(window){
  'use strict';

  window.FTS = window.FTS || {};
  if (window.FTS.Offline && window.FTS.Offline.ready) return;

  var DB_NAME = 'fts-offline-v1';
  var DB_VERSION = 1;
  var STORE_DATA = 'data';
  var STORE_META = 'meta';
  var STORE_QUEUE = 'queue';
  var STORE_FILES = 'files';
  var READ_TIMEOUT = 4500;

  var state = {
    ready: true,
    currentUid: null,
    patched: false,
    lastSync: 0,
    isOnline: navigator.onLine !== false
  };

  // Chemins importants à sauvegarder automatiquement.
  // Les futures features peuvent ajouter leurs chemins avec FTS.Offline.registerPath('fts_xxx').
  var essentialPrefixes = [
    'fts_content',
    'fts_events',
    'fts_ressources',
    'fts_saison',
    'fts_forum/messages',
    'fts_forum/users',
    'fts_polls',
    'fts_poll_unread',
    'fts_user_notifications',
    'fts_dm/userConvs',
    'fts_dm/conversations'
  ];
  var essentialExact = [];

  function log(){ try { console.log.apply(console, ['[FTS Offline]'].concat([].slice.call(arguments))); } catch(e){} }
  function warn(){ try { console.warn.apply(console, ['[FTS Offline]'].concat([].slice.call(arguments))); } catch(e){} }

  function openDb(){
    return new Promise(function(resolve, reject){
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponible'));
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(){
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE_DATA)) db.createObjectStore(STORE_DATA, { keyPath:'key' });
        if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath:'key' });
        if (!db.objectStoreNames.contains(STORE_QUEUE)) db.createObjectStore(STORE_QUEUE, { keyPath:'id', autoIncrement:true });
        if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES, { keyPath:'url' });
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
  }

  async function tx(store, mode, fn){
    var db = await openDb();
    return new Promise(function(resolve, reject){
      var transaction = db.transaction(store, mode || 'readonly');
      var objectStore = transaction.objectStore(store);
      var result;
      try { result = fn(objectStore, transaction); } catch(e){ reject(e); try{ db.close(); }catch(_){} return; }
      transaction.oncomplete = function(){ try{ db.close(); }catch(_){} resolve(result); };
      transaction.onerror = function(){ try{ db.close(); }catch(_){} reject(transaction.error); };
    });
  }

  function cleanPath(path){
    return String(path || '').replace(/^\/+/, '').replace(/\/+$/, '');
  }

  function refPath(ref){
    try {
      var root = (window.FTS && window.FTS.FIREBASE && window.FTS.FIREBASE.databaseURL) || '';
      var url = ref && ref.toString ? ref.toString() : '';
      if (root && url.indexOf(root) === 0) return cleanPath(decodeURIComponent(url.slice(root.length)));
      var u = new URL(url);
      return cleanPath(decodeURIComponent(u.pathname));
    } catch(e) { return ''; }
  }

  function cacheable(path){
    path = cleanPath(path);
    if (!path) return false;
    if (path.indexOf('fts_debug_notifications') === 0) return false;
    if (path.indexOf('fts_users/') === 0) return true; // profil connecté + forumReads
    if (essentialExact.indexOf(path) !== -1) return true;
    return essentialPrefixes.some(function(prefix){ return path === prefix || path.indexOf(prefix + '/') === 0; });
  }

  function scopedKey(path){
    path = cleanPath(path);
    var uid = state.currentUid || 'public';
    return uid + '::' + path;
  }

  async function setMeta(key, value){
    try { await tx(STORE_META, 'readwrite', function(s){ s.put({ key:key, value:value, updatedAt:Date.now() }); }); } catch(e){}
  }
  async function getMeta(key){
    try {
      var res;
      await tx(STORE_META, 'readonly', function(s){ var r=s.get(key); r.onsuccess=function(){ res=r.result; }; });
      return res && res.value;
    } catch(e){ return null; }
  }

  async function put(path, value){
    path = cleanPath(path);
    if (!cacheable(path)) return;
    var now = Date.now();
    try {
      await tx(STORE_DATA, 'readwrite', function(s){
        s.put({ key: scopedKey(path), uid: state.currentUid || 'public', path:path, value:value, updatedAt:now });
      });
      state.lastSync = now;
      await setMeta('lastSync', now);
      updateBanner();
    } catch(e){ warn('cache impossible', path, e); }
  }

  async function get(path){
    path = cleanPath(path);
    var keys = [scopedKey(path)];
    if (state.currentUid) keys.push('public::' + path);
    for (var i=0; i<keys.length; i++){
      try {
        var out;
        await tx(STORE_DATA, 'readonly', function(s){ var r=s.get(keys[i]); r.onsuccess=function(){ out=r.result; }; });
        if (out) return out;
      } catch(e){}
    }
    return null;
  }

  function childValue(parent, childPath){
    var base = parent && parent.value;
    if (base == null) return null;
    var parentPath = cleanPath(parent.path);
    var child = cleanPath(childPath);
    if (!parentPath || child.indexOf(parentPath + '/') !== 0) return null;
    var rest = child.slice(parentPath.length + 1).split('/').filter(Boolean);
    var cur = base;
    for (var i=0; i<rest.length; i++){
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[rest[i]];
    }
    return cur == null ? null : cur;
  }

  async function getBest(path){
    var direct = await get(path);
    if (direct) return direct;
    path = cleanPath(path);
    var parts = path.split('/');
    while(parts.length > 1){
      parts.pop();
      var parentPath = parts.join('/');
      var parent = await get(parentPath);
      var v = childValue(parent, path);
      if (v !== null) return { key: scopedKey(path), uid: state.currentUid || 'public', path:path, value:v, updatedAt: parent.updatedAt };
    }
    return null;
  }

  function makeSnapshot(path, value){
    path = cleanPath(path);
    var key = path.split('/').pop() || null;
    return {
      key: key,
      ref: null,
      exists: function(){ return value !== null && value !== undefined; },
      val: function(){ return value === undefined ? null : value; },
      child: function(childPath){ return makeSnapshot(path + '/' + childPath, childValue({ path:path, value:value }, path + '/' + childPath)); },
      forEach: function(cb){
        if (!value || typeof value !== 'object') return false;
        var keys = Object.keys(value);
        for (var i=0; i<keys.length; i++){
          var stop = cb(makeSnapshot(path + '/' + keys[i], value[keys[i]]));
          if (stop === true) return true;
        }
        return false;
      }
    };
  }

  function timeoutPromise(ms){
    return new Promise(function(_, reject){ setTimeout(function(){ reject(new Error('FTS_OFFLINE_TIMEOUT')); }, ms); });
  }

  async function cachedOnce(path, originalPromise){
    path = cleanPath(path);
    if (!cacheable(path)) return originalPromise;

    // Hors ligne : on répond immédiatement depuis le cache si disponible.
    if (navigator.onLine === false) {
      var cached = await getBest(path);
      if (cached) return makeSnapshot(path, cached.value);
    }

    try {
      var snap = await Promise.race([originalPromise, timeoutPromise(READ_TIMEOUT)]);
      try { await put(path, snap && snap.val ? snap.val() : null); } catch(e){}
      return snap;
    } catch(err) {
      var fallback = await getBest(path);
      if (fallback) {
        showOfflineToast('Affichage des dernières données sauvegardées.');
        return makeSnapshot(path, fallback.value);
      }
      throw err;
    }
  }

  function patchFirebase(){
    if (state.patched || typeof firebase === 'undefined' || !firebase.database) return;
    try {
      var probeDb = window.FTS && window.FTS.initFirebase ? window.FTS.initFirebase() : firebase.database();
      if (!probeDb || !probeDb.ref) return;
      var protos = [Object.getPrototypeOf(probeDb.ref('/'))];
      try { protos.push(Object.getPrototypeOf(probeDb.ref('/').orderByChild('x'))); } catch(_) {}
      var patchedAny = false;

      protos.forEach(function(proto){
        if (!proto || proto.__ftsOfflinePatched || !proto.once || !proto.on) return;

        var originalOnce = proto.once;
        var originalOn = proto.on;

        proto.once = function(eventType){
          var path = refPath(this);
          var promise = originalOnce.apply(this, arguments);
          if (eventType === 'value' && cacheable(path)) return cachedOnce(path, promise);
          return promise;
        };

        proto.on = function(eventType, callback, cancelCallback){
          var path = refPath(this);
          if (eventType === 'value' && typeof callback === 'function' && cacheable(path)) {
            getBest(path).then(function(cached){
              if (cached) callback(makeSnapshot(path, cached.value));
            }).catch(function(){});
            var wrapped = function(snap){
              try { put(path, snap && snap.val ? snap.val() : null); } catch(e){}
              callback(snap);
            };
            return originalOn.call(this, eventType, wrapped, cancelCallback);
          }
          return originalOn.apply(this, arguments);
        };

        proto.__ftsOfflinePatched = true;
        patchedAny = true;
      });

      state.patched = state.patched || patchedAny;
      if (patchedAny) log('Firebase RTDB patché pour fallback offline.');
    } catch(e){ warn('patch Firebase impossible', e); }
  }

  async function syncEssential(uid){
    if (!uid || typeof firebase === 'undefined') return;
    state.currentUid = uid;
    patchFirebase();
    if (navigator.onLine === false) return;
    var db = window.FTS.initFirebase && window.FTS.initFirebase();
    if (!db) return;
    var paths = [
      'fts_users/' + uid,
      'fts_content',
      'fts_events',
      'fts_ressources',
      'fts_saison/config',
      'fts_forum/users/' + uid,
      'fts_forum/messages',
      'fts_user_notifications/' + uid,
      'fts_dm/userConvs/' + uid,
      'fts_polls',
      'fts_poll_unread/' + uid
    ];
    for (var i=0; i<paths.length; i++){
      try {
        var snap = await Promise.race([db.ref(paths[i]).once('value'), timeoutPromise(6500)]);
        await put(paths[i], snap.val());
      } catch(e) { /* non bloquant */ }
    }
    updateBanner();
  }

  function formatSync(ts){
    if (!ts) return 'pas encore synchronisé';
    try { return new Intl.DateTimeFormat('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(ts)); }
    catch(e){ return new Date(ts).toLocaleString(); }
  }

  function ensureBanner(){
    var el = document.getElementById('fts-offline-banner');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'fts-offline-banner';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<span class="fts-offline-dot"></span><span class="fts-offline-text"></span>';
    document.body.appendChild(el);
    if (!document.getElementById('fts-offline-style')) {
      var st = document.createElement('style');
      st.id = 'fts-offline-style';
      st.textContent = '#fts-offline-banner{position:fixed;left:12px;right:12px;bottom:calc(78px + env(safe-area-inset-bottom));z-index:99999;display:none;align-items:center;gap:8px;padding:10px 12px;border-radius:18px;background:rgba(20,20,24,.92);color:#fff;font:600 13px/1.25 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 12px 35px rgba(0,0,0,.24);backdrop-filter:blur(14px)}#fts-offline-banner.is-visible{display:flex}.fts-offline-dot{width:9px;height:9px;border-radius:99px;background:#f4c542;box-shadow:0 0 0 4px rgba(244,197,66,.2)}@media(min-width:760px){#fts-offline-banner{left:auto;right:20px;bottom:20px;max-width:390px}}';
      document.head.appendChild(st);
    }
    return el;
  }

  async function updateBanner(){
    state.isOnline = navigator.onLine !== false;
    if (!state.lastSync) state.lastSync = Number(await getMeta('lastSync')) || 0;
    var el = ensureBanner();
    var text = el.querySelector('.fts-offline-text');
    if (!state.isOnline) {
      text.textContent = 'Mode hors ligne — données du ' + formatSync(state.lastSync);
      el.classList.add('is-visible');
    } else {
      el.classList.remove('is-visible');
    }
  }

  function showOfflineToast(message){
    var el = ensureBanner();
    var text = el.querySelector('.fts-offline-text');
    text.textContent = message || 'Mode hors ligne — dernières données sauvegardées.';
    el.classList.add('is-visible');
    if (navigator.onLine !== false) setTimeout(updateBanner, 3500);
  }

  async function cacheFile(url){
    if (!url || !('caches' in window)) return false;
    var cache = await caches.open('fts-offline-files-v1');
    var res = await fetch(url, { mode:'cors', credentials:'omit' });
    if (!res || !res.ok) throw new Error('Téléchargement impossible');
    await cache.put(url, res.clone());
    await tx(STORE_FILES, 'readwrite', function(s){ s.put({ url:url, updatedAt:Date.now(), size:Number(res.headers.get('content-length') || 0) }); });
    return true;
  }

  async function removeFile(url){
    if ('caches' in window) { var cache = await caches.open('fts-offline-files-v1'); await cache.delete(url); }
    await tx(STORE_FILES, 'readwrite', function(s){ s.delete(url); });
  }

  async function hasFile(url){
    if (!url || !('caches' in window)) return false;
    var cache = await caches.open('fts-offline-files-v1');
    return !!(await cache.match(url));
  }

  function registerPath(path){
    path = cleanPath(path);
    if (path && essentialPrefixes.indexOf(path) === -1) essentialPrefixes.push(path);
  }

  function init(){
    patchFirebase();
    updateBanner();
    window.addEventListener('online', function(){ state.isOnline = true; updateBanner(); tryAutoSync(); });
    window.addEventListener('offline', function(){ state.isOnline = false; updateBanner(); });
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) tryAutoSync(); });
    if (typeof firebase !== 'undefined' && firebase.auth) {
      try {
        firebase.auth().onAuthStateChanged(function(user){
          state.currentUid = user && user.uid || null;
          if (user && navigator.onLine !== false) setTimeout(function(){ syncEssential(user.uid); }, 800);
        });
      } catch(e){}
    }
  }

  function tryAutoSync(){
    try {
      var user = firebase && firebase.auth && firebase.auth().currentUser;
      if (user && navigator.onLine !== false) syncEssential(user.uid);
    } catch(e){}
  }

  window.FTS.Offline = {
    ready: true,
    state: state,
    registerPath: registerPath,
    put: put,
    get: function(path){ return getBest(path).then(function(x){ return x && x.value; }); },
    syncEssential: syncEssential,
    cacheFile: cacheFile,
    removeFile: removeFile,
    hasFile: hasFile,
    showOfflineToast: showOfflineToast,
    updateBanner: updateBanner,
    patchFirebase: patchFirebase
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(window);
