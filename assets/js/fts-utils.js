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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/* Chaîne JavaScript sûre à injecter dans un attribut HTML data-fts-click/onclick. */
FTS.jsArg = function(value) {
  const json = JSON.stringify(String(value == null ? '' : value))
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026');
  return json.replace(/"/g, '&quot;');
};

/* ── PROFILS PUBLICS SÉCURISÉS ─────────────────────────────────
   Objectif : éviter que les membres lisent tout fts_users.
   fts_public_profiles contient uniquement les champs utiles aux listes,
   messages, forum, notifications ciblées et gamification. Aucun email,
   téléphone, date de naissance, consentement RGPD/droit image.
*/
FTS.toPublicProfile = function(profile, uid) {
  profile = profile || {};
  uid = uid || profile.uid || '';

  function arr(v){
    if(Array.isArray(v)) return v.filter(Boolean).map(String);
    if(typeof v === 'string') return v.split(',').map(x => x.trim()).filter(Boolean);
    return [];
  }
  function byCat(v){
    const out = {};
    if(!v || typeof v !== 'object' || Array.isArray(v)) return out;
    Object.keys(v).forEach(k => { out[k] = arr(v[k]); });
    return out;
  }

  const childDisciplines = [];
  const childSubgroups = [];
  const childSubgroupsByCat = {};
  if(profile.hasEnfant && Array.isArray(profile.enfants)) {
    profile.enfants.forEach(child => {
      arr(child && child.disciplines).forEach(x => childDisciplines.push(x));
      arr(child && (child.subgroups || child.subgroup || child.subcategories)).forEach(x => childSubgroups.push(x));
      const childByCat = byCat(child && (child.subgroupsByCat || child.subcategoriesByCat || child.groupsByCat));
      Object.keys(childByCat).forEach(cat => {
        childSubgroupsByCat[cat] = Array.from(new Set([...(childSubgroupsByCat[cat] || []), ...childByCat[cat]]));
      });
    });
  }

  const firstName = String(profile.firstName || '').trim();
  const lastName = String(profile.lastName || '').trim();
  const name = String(profile.displayName || profile.name || [firstName, lastName].filter(Boolean).join(' ') || 'Membre').trim();
  const directSubgroupsByCat = byCat(profile.subgroupsByCat || profile.subcategoriesByCat || profile.groupsByCat);
  Object.keys(childSubgroupsByCat).forEach(cat => {
    directSubgroupsByCat[cat] = Array.from(new Set([...(directSubgroupsByCat[cat] || []), ...childSubgroupsByCat[cat]]));
  });

  return {
    uid: uid,
    name: name,
    firstName: firstName,
    lastName: lastName ? lastName.charAt(0).toUpperCase() + '.' : '',
    role: String(profile.role || 'member'),
    status: String(profile.status || 'pending'),
    disciplines: Array.from(new Set([...arr(profile.disciplines || profile.group || profile.groups), ...childDisciplines])),
    subgroups: Array.from(new Set([...arr(profile.subgroups || profile.subgroup || profile.subcategories), ...childSubgroups])),
    subgroup: Array.from(new Set([...arr(profile.subgroups || profile.subgroup || profile.subcategories), ...childSubgroups])).join(', '),
    subgroupsByCat: directSubgroupsByCat,
    xp: Number(profile.xp || 0),
    specialBadge: profile.specialBadge || null,
    updatedAt: Date.now()
  };
};

FTS.syncPublicProfile = async function(db, uid, profile) {
  if(!db || !uid || !profile) return;
  const publicProfile = FTS.toPublicProfile(profile, uid);
  if(publicProfile.status === 'active') {
    await db.ref('fts_public_profiles/' + uid).set(publicProfile);
  } else {
    await db.ref('fts_public_profiles/' + uid).remove().catch(function(){});
  }
};

FTS.syncAllPublicProfiles = async function(db) {
  if(!db) return { ok:false, count:0 };
  const snap = await db.ref('fts_users').once('value');
  const updates = {};
  let count = 0;
  if(snap.exists()) snap.forEach(function(child){
    const profile = child.val() || {};
    if(String(profile.status || '') === 'active') {
      updates['fts_public_profiles/' + child.key] = FTS.toPublicProfile(profile, child.key);
      count++;
    } else {
      updates['fts_public_profiles/' + child.key] = null;
    }
  });
  if(Object.keys(updates).length) await db.ref().update(updates);
  return { ok:true, count:count };
};

FTS.activePublicProfilesRef = function(db) {
  return db.ref('fts_public_profiles').orderByChild('status').equalTo('active');
};

FTS.publicProfilesRef = function(db) {
  return db.ref('fts_public_profiles');
};

FTS.safeUrl = function(url, fallback) {
  fallback = fallback || '#';
  const raw = String(url || '').trim();
  if(!raw) return fallback;
  if(raw === '#') return raw;
  if(raw.startsWith('//')) {
    try {
      const u = new URL(raw, location.protocol);
      const protocol = String(u.protocol || '').toLowerCase();
      if(['https:', 'http:'].includes(protocol)) return u.href;
    } catch(e) {}
    return fallback;
  }
  if(raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('/')) return raw;
  try {
    const u = new URL(raw, location.origin);
    const protocol = String(u.protocol || '').toLowerCase();
    if(['https:', 'http:', 'mailto:', 'tel:'].includes(protocol)) return u.href;
  } catch(e) {}
  return fallback;
};

/* Ajoute automatiquement le token Firebase sur les appels au Worker push. */
(function(){
  if(window.__FTS_SECURE_PUSH_FETCH__) return;
  window.__FTS_SECURE_PUSH_FETCH__ = true;
  const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if(!nativeFetch) return;
  window.fetch = async function(input, init) {
    let url = '';
    try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch(e) { url = ''; }
    try {
      const worker = window.FTS && FTS.PUSH && FTS.PUSH.workerUrl ? String(FTS.PUSH.workerUrl).replace(/\/+$/, '') : '';
      if(worker && typeof url === 'string' && url.indexOf(worker) === 0 && window.firebase && firebase.auth && firebase.auth().currentUser) {
        init = init || {};
        const headers = new Headers(init.headers || (input && input.headers) || {});
        if(!headers.has('Authorization')) {
          const token = await firebase.auth().currentUser.getIdToken();
          headers.set('Authorization', 'Bearer ' + token);
        }
        init.headers = headers;
      }
    } catch(e) {}
    return nativeFetch(input, init);
  };
})();



/* ── NORMALISATION (Firebase keys, comparaisons) ─────────────── */
/*
  Usage : FTS.norm('Théâtre') → 'theatre'
*/
/* Fallback explicite pour les pages qui envoient des notifications push. */
(function(){
  window.FTS = window.FTS || {};
  if (!FTS.getAuthToken) {
    FTS.getAuthToken = async function(forceRefresh) {
      try {
        if (!window.firebase || !firebase.auth || !firebase.auth().currentUser) return '';
        return await firebase.auth().currentUser.getIdToken(forceRefresh === true);
      } catch(e) {
        console.warn('[FTS] Token Firebase indisponible', e);
        return '';
      }
    };
  }
  if (!FTS.authJsonHeaders) {
    FTS.authJsonHeaders = async function(headers, options) {
      const out = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
      const token = await FTS.getAuthToken(options && options.forceRefresh === true);
      if (token) out.Authorization = 'Bearer ' + token;
      return out;
    };
  }
  if (!FTS.pushRequest) {
    FTS.pushRequest = async function(path, payload, options) {
      if (!FTS.PUSH || !FTS.PUSH.workerUrl) throw new Error('Worker push non configure.');
      const opts = Object.assign({}, options || {});
      const workerUrl = String(FTS.PUSH.workerUrl || '').replace(/\/+$/, '');
      const target = /^https?:\/\//i.test(String(path || ''))
        ? String(path)
        : workerUrl + '/' + String(path || '').replace(/^\/+/, '');
      const allowHttpError = opts.allowHttpError === true;
      delete opts.allowHttpError;
      opts.method = opts.method || 'POST';
      opts.headers = await FTS.authJsonHeaders(opts.headers || {}, opts);
      if (payload !== undefined && opts.body === undefined) opts.body = JSON.stringify(payload);
      const res = await fetch(target, opts);
      if (!res.ok && !allowHttpError) {
        let detail = '';
        try { detail = await res.text(); } catch(e) {}
        throw new Error('Worker push HTTP ' + res.status + (detail ? ' - ' + detail.slice(0, 160) : ''));
      }
      return res;
    };
  }
})();

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
        rawSubs.forEach((s, index) => {
          if (typeof s === 'string') subs.push({ key: FTS.norm(s || String(index)), id: FTS.norm(s || String(index)), name: s, label: s, active: true });
          else if (s && s.active !== false && (s.name || s.label || s.key || s.id)) {
            const subName = s.name || s.label || s.key || s.id;
            const subKey = s.key || s.id || FTS.norm(subName || String(index));
            subs.push(Object.assign({}, s, { key: subKey, id: s.id || subKey, name: subName, label: s.label || subName, active: true }));
          }
        });
      } else {
        Object.entries(rawSubs).forEach(([subKeyRaw, s]) => {
          if (typeof s === 'string') {
            const subKey = subKeyRaw || FTS.norm(s);
            subs.push({ key: subKey, id: subKey, name: s, label: s, active: true });
          }
          else if (s && s.active !== false && (s.name || s.label || s.key || s.id)) {
            const subName = s.name || s.label || s.key || s.id || subKeyRaw;
            const subKey = s.key || s.id || subKeyRaw || FTS.norm(subName);
            subs.push(Object.assign({}, s, { key: subKey, id: s.id || subKey, name: subName, label: s.label || subName, active: true }));
          }
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

/* FTS_UNREAD_OVERVIEW_HELPER
   Vue centralisee des non-lus: MP + forum + sondages.
   Retourne un total synchronise et des liens profonds vers l'endroit exact a lire.
*/
(function(){
  'use strict';
  window.FTS = window.FTS || {};
  if (window.FTS.listenUnreadOverview) return;

  function norm(v){
    if (window.FTS && typeof FTS.norm === 'function') return FTS.norm(v);
    return String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  }

  function list(v){
    return (Array.isArray(v) ? v : String(v || '').split(',')).map(function(x){ return String(x || '').trim(); }).filter(Boolean);
  }

  function uniq(arr){
    var seen = {};
    return (arr || []).filter(function(v){
      var k = norm(v);
      if (!k || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  function cloneOverview(overview){
    return {
      total: Number(overview.total || 0) || 0,
      dm: {
        total: Number(overview.dm && overview.dm.total || 0) || 0,
        items: (overview.dm && overview.dm.items || []).map(function(x){ return Object.assign({}, x); })
      },
      forum: {
        total: Number(overview.forum && overview.forum.total || 0) || 0,
        items: (overview.forum && overview.forum.items || []).map(function(x){ return Object.assign({}, x); })
      },
      polls: {
        total: Number(overview.polls && overview.polls.total || 0) || 0,
        items: (overview.polls && overview.polls.items || []).map(function(x){ return Object.assign({}, x); })
      }
    };
  }

  function emptyOverview(){
    return {
      total: 0,
      dm: { total: 0, items: [] },
      forum: { total: 0, items: [] },
      polls: { total: 0, items: [] }
    };
  }

  function profileGroups(profile){
    var own = list(profile && (profile.disciplines || profile.groups || profile.group || profile.categories));
    var kids = [];
    if (profile && profile.hasEnfant && Array.isArray(profile.enfants)) {
      profile.enfants.forEach(function(e){ kids = kids.concat(list(e && (e.disciplines || e.groups || e.group || e.categories))); });
    }
    return uniq(own.concat(kids));
  }

  function profileSubgroups(profile){
    var own = list(profile && (profile.subgroups || profile.subcategories || profile.subgroup || profile.sousCategories));
    var kids = [];
    if (profile && profile.hasEnfant && Array.isArray(profile.enfants)) {
      profile.enfants.forEach(function(e){ kids = kids.concat(list(e && (e.subgroups || e.subcategories || e.subgroup || e.sousCategories))); });
    }
    return uniq(own.concat(kids));
  }

  function forumInitialReadTs(profile){
    return Number(profile && (profile.forumBaselineAt || profile.createdAt || profile.created_at || profile.ts || 0)) || 0;
  }

  function forumLastReadTs(reads, channel, profile){
    var direct = Number((reads && reads[channel] && reads[channel].ts) || (reads && reads[channel]) || 0) || 0;
    return direct || forumInitialReadTs(profile);
  }

  function shouldCountForumMessage(msg, uid){
    if (!msg) return false;
    if (msg.uid && msg.uid === uid && !(msg.system === true || msg.gamification === true || msg.notifyAll === true || msg.type === 'special_badge' || msg.type === 'artist_of_week' || msg.type === 'xp_level')) return false;
    return true;
  }

  function channelUrl(channel){
    return 'forum.html?channel=' + encodeURIComponent(channel);
  }

  function pollUrl(id){
    return 'sondages.html?poll=' + encodeURIComponent(id);
  }

  function dmUrl(id){
    return 'messages.html?conv=' + encodeURIComponent(id);
  }

  window.FTS.listenUnreadOverview = function(db, uid, profile, callback, options){
    options = options || {};
    if (!db || !uid || typeof callback !== 'function') return function(){};

    var stopped = false;
    var overview = emptyOverview();
    var lastKey = '';
    var maxItems = Number(options.maxItems || 8) || 8;
    var activeProfile = profile || {};

    var userConvsRef = null;
    var userConvsCb = null;
    var dmListeners = {};
    var dmData = {};
    var publicProfiles = {};
    var publicProfileLoading = {};

    var forumChannels = [];
    var forumChannelListeners = [];
    var forumReadsRef = null;
    var forumReadsCb = null;
    var forumTimer = null;
    var forumRefreshId = 0;

    var pollRef = null;
    var pollCb = null;
    var pollRefreshId = 0;

    function emit(){
      if (stopped) return;
      overview.total = Number(overview.dm.total || 0) + Number(overview.forum.total || 0) + Number(overview.polls.total || 0);
      var copy = cloneOverview(overview);
      var key = JSON.stringify(copy);
      if (key === lastKey) return;
      lastKey = key;
      try { callback(copy); } catch(e) { console.warn('[FTS] listenUnreadOverview callback:', e); }
    }

    function detachDm(id){
      var entry = dmListeners[id];
      if (entry && entry.ref && entry.cb) {
        try { entry.ref.off('value', entry.cb); } catch(e) {}
      }
      delete dmListeners[id];
      delete dmData[id];
    }

    function dmOtherUid(conv){
      var parts = conv && conv.participants ? Object.keys(conv.participants) : [];
      return parts.find(function(id){ return id !== uid; }) || '';
    }

    function refreshDmLabels(){
      if (stopped) return;
      renderDm();
    }

    function loadPublicProfile(otherUid){
      if (!otherUid || publicProfiles[otherUid] || publicProfileLoading[otherUid]) return;
      publicProfileLoading[otherUid] = true;
      db.ref('fts_public_profiles/' + otherUid).once('value').then(function(snap){
        publicProfiles[otherUid] = snap.val() || {};
        delete publicProfileLoading[otherUid];
        refreshDmLabels();
      }).catch(function(){
        publicProfiles[otherUid] = {};
        delete publicProfileLoading[otherUid];
      });
    }

    function dmLabel(id, conv){
      if (!conv) return 'Message prive';
      if (conv.type === 'group') return conv.name || 'Groupe prive';
      var otherUid = dmOtherUid(conv);
      if (otherUid) {
        loadPublicProfile(otherUid);
        var p = publicProfiles[otherUid] || {};
        if (p.name || p.firstName) return p.name || p.firstName;
      }
      if (conv.lastSenderName) return conv.lastSenderName;
      return 'Message prive';
    }

    function renderDm(){
      var items = Object.keys(dmData).map(function(id){
        var conv = dmData[id] || {};
        var count = Number(conv.unread && conv.unread[uid] || 0) || 0;
        if (!count) return null;
        return {
          id: id,
          count: count,
          label: dmLabel(id, conv),
          url: dmUrl(id),
          ts: Number(conv.lastTs || conv.updatedAt || conv.createdAt || 0) || 0
        };
      }).filter(Boolean).sort(function(a,b){ return (b.ts || 0) - (a.ts || 0); });
      overview.dm = {
        total: items.reduce(function(sum, item){ return sum + Number(item.count || 0); }, 0),
        items: items.slice(0, maxItems)
      };
      emit();
    }

    function listenDm(){
      userConvsRef = db.ref('fts_dm/userConvs/' + uid);
      userConvsCb = function(snap){
        if (stopped) return;
        var ids = snap && snap.val() ? Object.keys(snap.val()) : [];
        var active = ids.reduce(function(acc, id){ acc[id] = true; return acc; }, {});
        Object.keys(dmListeners).forEach(function(id){ if (!active[id]) detachDm(id); });
        if (!ids.length) {
          dmData = {};
          overview.dm = { total: 0, items: [] };
          emit();
          return;
        }
        ids.forEach(function(id){
          if (dmListeners[id]) return;
          var ref = db.ref('fts_dm/conversations/' + id);
          var cb = function(s){
            if (stopped) return;
            var val = s && s.val();
            if (!val) {
              detachDm(id);
            } else {
              dmData[id] = val;
              if (val.type !== 'group') loadPublicProfile(dmOtherUid(val));
            }
            renderDm();
          };
          dmListeners[id] = { ref: ref, cb: cb };
          ref.on('value', cb);
        });
        renderDm();
      };
      userConvsRef.on('value', userConvsCb);
    }

    async function visibleForumChannels(){
      var role = String((activeProfile && activeProfile.role) || '').toLowerCase();
      var isAdmin = role === 'admin';
      var groups = profileGroups(activeProfile).map(norm);
      var subs = profileSubgroups(activeProfile).map(norm);
      var channels = [{ id:'general', label:'Forum general', url:channelUrl('general') }];
      try {
        var structure = window.FTS && FTS.getCategoryStructureAsync
          ? await FTS.getCategoryStructureAsync(db)
          : (window.FTS && FTS.getCategoryStructure ? FTS.getCategoryStructure() : []);
        (structure || []).forEach(function(cat){
          var catName = cat.name || cat.category || '';
          var catNorm = norm(catName);
          if (!catNorm) return;
          if (isAdmin || groups.indexOf(catNorm) !== -1) {
            channels.push({ id:catNorm, label:'General ' + catName, url:channelUrl(catNorm) });
          }
          (cat.subs || cat.subcats || []).forEach(function(sub){
            var subName = typeof sub === 'string' ? sub : (sub && (sub.name || sub.label));
            var subNorm = norm(subName);
            if (!subNorm) return;
            if (isAdmin || subs.indexOf(subNorm) !== -1) {
              channels.push({ id:subNorm, label:String(subName || subNorm), url:channelUrl(subNorm) });
            }
          });
        });
      } catch(e) {
        groups.forEach(function(g){ channels.push({ id:g, label:'General ' + g, url:channelUrl(g) }); });
        subs.forEach(function(s){ channels.push({ id:s, label:s, url:channelUrl(s) }); });
      }
      var seen = {};
      return channels.filter(function(ch){
        if (!ch || !ch.id || seen[ch.id]) return false;
        seen[ch.id] = true;
        return true;
      });
    }

    function clearForumListeners(){
      if (forumTimer) clearTimeout(forumTimer);
      forumTimer = null;
      try {
        forumChannelListeners.forEach(function(entry){
          if (entry && entry.ref && entry.cb) entry.ref.off('value', entry.cb);
        });
        if (forumReadsRef && forumReadsCb) forumReadsRef.off('value', forumReadsCb);
      } catch(e) {}
      forumChannelListeners = [];
      forumReadsRef = null;
      forumReadsCb = null;
    }

    function scheduleForum(){
      if (forumTimer) clearTimeout(forumTimer);
      forumTimer = setTimeout(refreshForum, 160);
    }

    async function refreshForum(){
      if (stopped) return;
      var refreshId = ++forumRefreshId;
      if (!forumChannels.length) {
        overview.forum = { total: 0, items: [] };
        emit();
        return;
      }
      try {
        var readsSnap = await db.ref('fts_users/' + uid + '/forumReads').once('value');
        if (stopped || refreshId !== forumRefreshId) return;
        var reads = readsSnap.val() || {};
        var rows = [];
        await Promise.all(forumChannels.map(function(ch){
          var lastRead = forumLastReadTs(reads, ch.id, activeProfile);
          if (!lastRead) return Promise.resolve();
          return db.ref('fts_forum/messages/' + ch.id).orderByChild('ts').startAt(lastRead + 1).limitToLast(50).once('value')
            .then(function(snap){
              var count = 0;
              var ts = 0;
              snap.forEach(function(child){
                var msg = child.val() || {};
                if (!shouldCountForumMessage(msg, uid)) return;
                count += 1;
                ts = Math.max(ts, Number(msg.ts || 0) || 0);
              });
              if (count) rows.push({ channel:ch.id, count:count, label:ch.label, url:ch.url, ts:ts });
            }).catch(function(){});
        }));
        if (stopped || refreshId !== forumRefreshId) return;
        rows.sort(function(a,b){ return (b.ts || 0) - (a.ts || 0); });
        overview.forum = {
          total: rows.reduce(function(sum, item){ return sum + Number(item.count || 0); }, 0),
          items: rows.slice(0, maxItems)
        };
      } catch(e) {
        overview.forum = { total: 0, items: [] };
      }
      emit();
    }

    async function listenForum(){
      clearForumListeners();
      forumChannels = await visibleForumChannels();
      if (stopped) return;
      forumReadsRef = db.ref('fts_users/' + uid + '/forumReads');
      forumReadsCb = scheduleForum;
      forumReadsRef.on('value', forumReadsCb);
      forumChannels.forEach(function(ch){
        var ref = db.ref('fts_forum/messages/' + ch.id).orderByChild('ts').limitToLast(1);
        var cb = scheduleForum;
        forumChannelListeners.push({ ref:ref, cb:cb });
        ref.on('value', cb);
      });
      scheduleForum();
    }

    function listenPolls(){
      pollRef = db.ref('fts_poll_unread/' + uid);
      pollCb = function(snap){
        if (stopped) return;
        var refreshId = ++pollRefreshId;
        var raw = snap && snap.val() ? snap.val() : {};
        var ids = Object.keys(raw).filter(Boolean);
        if (!ids.length) {
          overview.polls = { total: 0, items: [] };
          emit();
          return;
        }
        Promise.all(ids.slice(0, maxItems).map(function(id){
          return db.ref('fts_polls/' + id).once('value').then(function(pollSnap){
            var poll = pollSnap.val() || {};
            return {
              id: id,
              count: 1,
              label: poll.title || poll.name || 'Sondage',
              url: pollUrl(id),
              ts: Number(poll.createdAt || poll.updatedAt || (raw[id] && raw[id].ts) || 0) || 0
            };
          }).catch(function(){
            return { id:id, count:1, label:'Sondage', url:pollUrl(id), ts:0 };
          });
        })).then(function(items){
          if (stopped || refreshId !== pollRefreshId) return;
          items.sort(function(a,b){ return (b.ts || 0) - (a.ts || 0); });
          overview.polls = { total: ids.length, items: items };
          emit();
        });
      };
      pollRef.on('value', pollCb);
    }

    function cleanup(){
      if (stopped) return;
      stopped = true;
      if (forumTimer) clearTimeout(forumTimer);
      try {
        if (userConvsRef && userConvsCb) userConvsRef.off('value', userConvsCb);
        Object.keys(dmListeners).forEach(detachDm);
        clearForumListeners();
        if (pollRef && pollCb) pollRef.off('value', pollCb);
      } catch(e) {}
      dmListeners = {};
      dmData = {};
      pollRef = null;
      pollCb = null;
    }

    listenDm();
    listenPolls();
    Promise.resolve(activeProfile && Object.keys(activeProfile).length ? activeProfile : db.ref('fts_users/' + uid).once('value').then(function(s){ return s.val() || {}; }))
      .then(function(p){ activeProfile = p || {}; return listenForum(); })
      .catch(function(){ activeProfile = activeProfile || {}; return listenForum(); });
    emit();

    if (options.autoCleanup !== false) {
      window.addEventListener('pagehide', cleanup, { once:true });
    }

    return cleanup;
  };
})();
/* END_FTS_UNREAD_OVERVIEW_HELPER */

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
