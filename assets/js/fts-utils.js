/* ================================================================
   FTS-UTILS.JS — Utilitaires JavaScript partagés
   Chargé en premier dans toutes les pages via <script src>.
   Expose un objet global window.FTS avec tous les helpers.
   ================================================================ */

'use strict';

window.FTS = window.FTS || {};

const FTS = window.FTS;


/* ── STOCKAGE LOCAL ──────────────────────────────────────────── */

FTS.store = {
  get:    (k)    => localStorage.getItem(k),
  set:    (k, v) => localStorage.setItem(k, String(v)),
  remove: (k)    => localStorage.removeItem(k),
  has:    (k)    => localStorage.getItem(k) !== null,
};


/* ── CSV PARSER — avec headers (retourne tableau d'objets) ───── */
/*
  Usage : const rows = FTS.parseCSV(csvText);
  Retourne : [ { col1: 'val', col2: 'val', ... }, ... ]
*/
FTS.parseCSV = function(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(',')
    .map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

  return lines.slice(1).map(line => {
    const vals = [];
    let val = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === ',' && !inQ) { vals.push(val.trim()); val = ''; }
      else { val += line[i]; }
    }
    vals.push(val.trim());

    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] || '').replace(/^"|"$/g, '');
    });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
};


/* ── CSV PARSER — sans headers (retourne tableau de tableaux) ── */
/*
  Usage : const rows = FTS.parseCSVRaw(csvText);
  Retourne : [ ['val1', 'val2'], ['val3', 'val4'], ... ]
  (ignore la ligne 0 = headers)
*/
FTS.parseCSVRaw = function(text) {
  const lines = text.trim().split('\n');
  const result = [];
  for (let li = 1; li < lines.length; li++) {
    const row = lines[li];
    const cols = [];
    let s = '', q = false;
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '"') { q = !q; }
      else if (row[i] === ',' && !q) { cols.push(s.trim()); s = ''; }
      else { s += row[i]; }
    }
    cols.push(s.trim());
    if (cols.some(x => x)) result.push(cols);
  }
  return result;
};


/* ── SÉCURITÉ HTML ─────────────────────────────────────────────── */

FTS.esc = function(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};


/* ── NORMALISATION (Firebase keys, comparaisons) ─────────────── */
/*
  Usage : FTS.norm('Théâtre') → 'theatre'
*/
FTS.norm = function(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
};


/* ── DATES & HEURES ─────────────────────────────────────────── */

FTS.formatDate = function(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

FTS.formatTime = function(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit'
  });
};

FTS.formatDateTime = function(ts) {
  const d   = new Date(ts);
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString())  return `Aujourd'hui · ${FTS.formatTime(ts)}`;
  if (d.toDateString() === yest.toDateString()) return `Hier · ${FTS.formatTime(ts)}`;
  return `${FTS.formatDate(ts)} · ${FTS.formatTime(ts)}`;
};

FTS.dayLabel = function(ts) {
  const d   = new Date(ts);
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString())  return "Aujourd'hui";
  if (d.toDateString() === yest.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
};


/* ── GÉNÉRATION D'IDENTIFIANT UNIQUE ──────────────────────────── */

FTS.genUID = function() {
  return 'u' + Math.random().toString(36).substr(2, 9);
};


/* ── ICÔNE PAR NOM DE CATÉGORIE ──────────────────────────────── */

FTS.catIcon = function(name) {
  const n = FTS.norm(name);
  if (n.includes('theat'))              return '🎭';
  if (n.includes('dans'))               return '💃';
  if (n.includes('chant'))              return '🎤';
  if (n.includes('musi'))               return '🎸';
  if (n.includes('singer_academy'))     return '⭐';
  if (n.includes('singer_show'))        return '🌟';
  if (n.includes('comedie'))            return '🎬';
  if (n.includes('atelier'))            return '🎨';
  if (n.includes('formation'))          return '🎼';
  if (n.includes('magi'))               return '🎩';
  return '💬';
};


/* ── FETCH AVEC TIMEOUT ───────────────────────────────────────── */
/*
  Usage : FTS.fetch(url, 8000).then(r => r.text()).catch(...)
*/
FTS.fetch = function(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { signal: ctrl.signal })
    .finally(() => clearTimeout(id));
};


/* ── UPLOAD CLOUDINARY ─────────────────────────────────────────── */
/*
  Usage :
    FTS.uploadCloudinary(file, onProgress)
      .then(url => ...)
      .catch(err => ...)
*/
FTS.uploadCloudinary = function(file, onProgress) {
  const { cloudName, uploadPreset } = FTS.CLOUDINARY;
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', uploadPreset);
    fd.append('resource_type', 'auto');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);

    if (onProgress) {
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        resolve(res.secure_url);
      } else {
        reject(new Error('Upload échoué : ' + xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error('Erreur réseau'));
    xhr.send(fd);
  });
};


/* ── SCROLL BAS ───────────────────────────────────────────────── */

FTS.scrollBottom = function(el) {
  if (el) el.scrollTop = el.scrollHeight;
};

/* ── CONFIG CATÉGORIES PARTAGÉES ─────────────────────────────── */
FTS.DEFAULT_CATEGORIES = FTS.DEFAULT_CATEGORIES || [
  { icon:'🎭', name:'Theatre', subcats:['7/9 ans','10/12 ans','13/15 ans','Impro','10/17 ans - Lundi','Adultes - Lundi','Adultes - Vendredi'], order:10 },
  { icon:'🎤', name:'Chant', subcats:[], order:20 },
  { icon:'💃', name:'Danse', subcats:['Les Baby Show','Show Danse Junior','Ados / Adultes'], order:30 },
  { icon:'🎸', name:'Musique', subcats:['Guitare','Basse','Batterie','Piano','Formation Musicale'], order:40 },
  { icon:'⭐', name:'Singer Academy', subcats:['Loisir','Spectacle'], order:50 },
  { icon:'🎬', name:'Comedie Musicale', subcats:['Kids','Enfants','Adultes'], order:60 },
  { icon:'🌟', name:'Singer Show', subcats:[], order:70 },
  { icon:'🎨', name:'Atelier', subcats:[], order:80 }
];
FTS.CATEGORIES = FTS.DEFAULT_CATEGORIES;

FTS.getDefaultCategoryStructure = function() {
  return (FTS.DEFAULT_CATEGORIES || []).map(c => ({
    category: c.name || c.category,
    name: c.name || c.category,
    icon: c.icon || FTS.catIcon(c.name || c.category),
    order: c.order || 999,
    active: c.active !== false,
    subs: (c.subcats || []).map(s => ({ name: s, active: true }))
  }));
};

FTS.getCategoryStructure = function() {
  return FTS.getDefaultCategoryStructure();
};

FTS.getCategoryStructureAsync = async function(db) {
  if (!db) return FTS.getDefaultCategoryStructure();
  try {
    const snap = await db.ref('fts_content/categories').once('value');
    if (!snap.exists()) return FTS.getDefaultCategoryStructure();
    const rows = [];
    snap.forEach(child => {
      const v = child.val() || {};
      if (v.active === false) return;
      const name = v.name || v.category || child.key;
      const subs = [];
      const rawSubs = v.subcats || v.subcategories || {};
      if (Array.isArray(rawSubs)) {
        rawSubs.forEach(s => {
          if (typeof s === 'string') subs.push({ name: s, active: true });
          else if (s && s.active !== false && (s.name || s.label)) subs.push({ name: s.name || s.label, active: true });
        });
      } else {
        Object.values(rawSubs).forEach(s => {
          if (typeof s === 'string') subs.push({ name: s, active: true });
          else if (s && s.active !== false && (s.name || s.label)) subs.push({ name: s.name || s.label, active: true });
        });
      }
      rows.push({
        key: child.key,
        category: name,
        name,
        icon: v.icon || v.emoji || FTS.catIcon(name),
        order: Number(v.order || 999),
        active: v.active !== false,
        subs
      });
    });
    rows.sort((a,b)=>(a.order||999)-(b.order||999)||(a.category||'').localeCompare(b.category||'', 'fr'));
    return rows.length ? rows : FTS.getDefaultCategoryStructure();
  } catch(e) {
    console.warn('[FTS] getCategoryStructureAsync fallback', e);
    return FTS.getDefaultCategoryStructure();
  }
};

FTS.ensureResourceCategory = async function(db, resource) {
  if (!db || !resource) return;
  const cat = (resource.cat || resource.category || '').trim();
  if (!cat) return;
  const key = FTS.norm(cat);
  const now = Date.now();
  const ref = db.ref('fts_content/categories/' + key);
  const snap = await ref.once('value');
  const updates = {};
  if (!snap.exists()) {
    updates.name = cat;
    updates.icon = resource.icon || FTS.catIcon(cat);
    updates.emoji = updates.icon;
    updates.order = 999;
    updates.active = true;
    updates.createdAt = now;
  }
  updates.updatedAt = now;
  const sub = (resource.subcat || resource.subcategory || '').trim();
  if (sub) {
    updates['subcats/' + FTS.norm(sub)] = { name: sub, active: true, updatedAt: now };
  }
  await ref.update(updates);
};



/* FTS_DM_UNREAD_TOTAL_HELPER
   Écoute centralisée et légère du total MP non lus.
   - une seule écoute userConvs par page
   - une écoute live par conversation active
   - nettoyage automatique des anciennes conversations
   - évite les rafraîchissements Promise/once répétitifs à chaque changement d'index
*/
(function(){
  'use strict';
  window.FTS = window.FTS || {};
  if (window.FTS.listenDmUnreadTotal) return;

  window.FTS.listenDmUnreadTotal = function(db, uid, onTotal, options){
    options = options || {};
    if (!db || !uid || typeof onTotal !== 'function') return function(){};

    var userConvsRef = db.ref('fts_dm/userConvs/' + uid);
    var convListeners = {};
    var totals = {};
    var stopped = false;
    var lastTotal = null;

    function emit(extra){
      if (stopped) return;
      var total = Object.keys(totals).reduce(function(sum, id){
        return sum + (Number(totals[id] || 0) || 0);
      }, 0);
      if (total === lastTotal && !extra) return;
      lastTotal = total;
      try { onTotal(total, extra || {}); } catch(e) { console.warn('[FTS] listenDmUnreadTotal callback:', e); }
    }

    function detachConv(id){
      var entry = convListeners[id];
      if (entry && entry.ref && entry.cb) {
        try { entry.ref.off('value', entry.cb); } catch(e) {}
      }
      delete convListeners[id];
      delete totals[id];
    }

    var userCb = function(snap){
      if (stopped) return;
      var convIds = snap && snap.val() ? Object.keys(snap.val()) : [];
      var active = convIds.reduce(function(acc, id){ acc[id] = true; return acc; }, {});

      Object.keys(convListeners).forEach(function(id){
        if (!active[id]) detachConv(id);
      });

      if (!convIds.length) {
        totals = {};
        emit({ empty:true });
        return;
      }

      convIds.forEach(function(id){
        if (convListeners[id]) return;
        var ref = db.ref('fts_dm/conversations/' + id + '/unread/' + uid);
        var cb = function(s){
          totals[id] = Number((s && s.val()) || 0) || 0;
          emit({ convId:id });
        };
        convListeners[id] = { ref:ref, cb:cb };
        ref.on('value', cb);
      });
      emit({ indexed:true });
    };

    userConvsRef.on('value', userCb);

    var cleanup = function(){
      if (stopped) return;
      stopped = true;
      try { userConvsRef.off('value', userCb); } catch(e) {}
      Object.keys(convListeners).forEach(detachConv);
      convListeners = {};
      totals = {};
    };

    if (options.autoCleanup !== false) {
      window.addEventListener('pagehide', cleanup, { once:true });
    }

    return cleanup;
  };
})();
/* END_FTS_DM_UNREAD_TOTAL_HELPER */

/* FTS_DATA_ACTION_DELEGATION */
(function(){
  'use strict';
  if (window.__FTS_DATA_ACTION_DELEGATION__) return;
  window.__FTS_DATA_ACTION_DELEGATION__ = true;

  var eventMap = {
    click: 'data-fts-click',
    input: 'data-fts-input',
    change: 'data-fts-change',
    keydown: 'data-fts-keydown'
  };

  function runDataAction(el, attr, event){
    if (!el) return;
    var code = el.getAttribute(attr);
    if (!code) return;
    try {
      (new Function('event', code)).call(el, event);
    } catch (err) {
      console.error('[FTS] Action data extraite en erreur:', code, err);
    }
  }

  Object.keys(eventMap).forEach(function(eventName){
    document.addEventListener(eventName, function(event){
      var attr = eventMap[eventName];
      var target = event.target;
      var el = target && target.closest ? target.closest('[' + attr + ']') : null;
      if (!el || !document.documentElement.contains(el)) return;
      runDataAction(el, attr, event);
    }, true);
  });
})();
/* END_FTS_DATA_ACTION_DELEGATION */


/* FTS_DYNAMIC_STYLE_HYDRATION */
(function(){
  'use strict';
  if (window.__FTS_DYNAMIC_STYLE_HYDRATION__) return;
  window.__FTS_DYNAMIC_STYLE_HYDRATION__ = true;

  function applyDynamicStyles(root){
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-fts-bg]').forEach(function(el){
      var bg = el.getAttribute('data-fts-bg');
      if (bg) el.style.background = bg;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ applyDynamicStyles(document); });
  } else {
    applyDynamicStyles(document);
  }

  if ('MutationObserver' in window) {
    new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        m.addedNodes && m.addedNodes.forEach(function(node){
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('[data-fts-bg]')) applyDynamicStyles({ querySelectorAll: function(){ return [node]; } });
          applyDynamicStyles(node);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
/* END_FTS_DYNAMIC_STYLE_HYDRATION */
