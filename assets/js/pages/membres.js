/* ================================================================
   PAGE MODULE — MEMBRES
   Extrait depuis membres.html pour supprimer le JavaScript inline.
   ================================================================ */

/* ================================================================
   MEMBRES.JS — Espace membres sécurisé par Firebase Auth
   ✅ Plus de mot de passe en clair
   ✅ Catégories filtrées selon disciplines du profil
   ✅ Admin voit tout
   ================================================================ */

/* ── CONFIG CATÉGORIES ──────────────────────────────────────── */
const C = {
  categories: [
    { icon:"🎭", name:"Theatre",          subcats:["7/9 ans","10/12 ans","13/15 ans","Impro","10/17 ans - Lundi","Adultes - Lundi","Adultes - Vendredi"], whatsapp:"" },
    { icon:"🎤", name:"Chant",            subcats:[], whatsapp:"" },
    { icon:"💃", name:"Danse",            subcats:["Les Baby Show","Show Danse Junior","Ados / Adultes"], whatsapp:"" },
    { icon:"🎸", name:"Musique",          subcats:["Guitare","Basse","Batterie","Piano","Formation Musicale"], whatsapp:"" },
    { icon:"⭐", name:"Singer Academy",   subcats:["Loisir","Spectacle"], whatsapp:"" },
    { icon:"🎬", name:"Comedie Musicale", subcats:["Kids","Enfants","Adultes"], whatsapp:"" },
    { icon:"🌟", name:"Singer Show",      subcats:[], whatsapp:"" },
    { icon:"🎨", name:"Atelier",          subcats:[], whatsapp:"" },
  ],
};

/* ── ÉTAT ────────────────────────────────────────────────────── */
let db        = null;  // module-level pour loadDocs Firebase
let cur       = null;
let allEvts   = [];
let allDocs   = {};
let showAll   = false;
let userProfile = null;
let currentUid = null;
let pendingResourceOpen = null;
let latestUnreadMessages = 0;

/* ── ICÔNES FICHIERS ─────────────────────────────────────────── */
const ICONS = {
  mp3:"♪", audio:"♪",
  video:"▶", mp4:"▶", youtube:"▶",
  image:"▪", jpg:"▪", png:"▪",
  pdf:"▩",
};


/* ── CHARGEMENT CATÉGORIES FIREBASE ───────────────────────────── */
async function loadCategories() {
  try {
    const structure = FTS.getCategoryStructureAsync
      ? await FTS.getCategoryStructureAsync(db)
      : (FTS.getCategoryStructure ? FTS.getCategoryStructure() : []);

    if (Array.isArray(structure) && structure.length) {
      C.categories = structure
        .filter(c => c && c.active !== false)
        .map(c => ({
          icon: c.icon || c.emoji || FTS.catIcon(c.name || c.category),
          name: c.name || c.category,
          subcats: (c.subs || c.subcats || [])
            .map(s => typeof s === 'string' ? s : (s && (s.name || s.label)))
            .filter(Boolean),
          whatsapp: c.whatsapp || ''
        }))
        .filter(c => c.name);
    }
  } catch(e) {
    console.warn('[FTS] Catégories Firebase indisponibles :', e);
  }
}

/* ── DROITS SOUS-CATÉGORIES MEMBRE ───────────────────────────── */
function profileIsAdmin() {
  return userProfile && userProfile.role === 'admin';
}

function normList(arr) {
  return (Array.isArray(arr) ? arr : String(arr || '').split(','))
    .map(x => String(x || '').trim())
    .filter(Boolean);
}

function userDisciplines() {
  const own = normList(userProfile && (userProfile.disciplines || userProfile.group));
  // Inclure les disciplines des enfants pour que le parent accède aux ressources de son enfant
  const child = (userProfile && userProfile.hasEnfant && Array.isArray(userProfile.enfants))
    ? userProfile.enfants.flatMap(e => Array.isArray(e.disciplines) ? e.disciplines : [])
    : [];
  return [...new Set([...own, ...child])];
}

function userSubgroups() {
  const own = normList(userProfile && (userProfile.subgroups || userProfile.subcategories || userProfile.subgroup));
  // Inclure les sous-groupes des enfants (ex: "Show Danse Junior" d'Emma)
  const child = (userProfile && userProfile.hasEnfant && Array.isArray(userProfile.enfants))
    ? userProfile.enfants.flatMap(e => normList(e.subgroups || e.subgroup || []))
    : [];
  return [...new Set([...own, ...child])];
}

function allowedSubcatsForCategory(cat) {
  const all = Array.isArray(cat && cat.subcats) ? cat.subcats : [];
  if (profileIsAdmin()) return all;
  const allowedNorms = new Set(userSubgroups().map(FTS.norm));
  return all.filter(s => allowedNorms.has(FTS.norm(s)));
}

function canSeeDocInCategory(doc, cat) {
  if (profileIsAdmin()) return true;
  const catName = String(cat && cat.name || '').trim();
  const userCatNorms = new Set(userDisciplines().map(FTS.norm));
  if (catName && !userCatNorms.has(FTS.norm(catName))) return false;

  const docSub = String(doc.sub || '').trim();
  if (!docSub) return true; // document général de la discipline autorisée
  const allowedNorms = new Set(allowedSubcatsForCategory(cat).map(FTS.norm));
  return allowedNorms.has(FTS.norm(docSub));
}

/* ── INITIALISATION ──────────────────────────────────────────── */
(function init() {
  db = FTS.initFirebase();
  const auth = firebase.auth();

  auth.onAuthStateChanged(async user => {

    if (!user) {
      // Pas connecté → page de connexion
      window.location.href = 'auth.html';
      return;
    }

    try {
      // Lecture du profil RTDB
      const snap = await db.ref('fts_users/' + user.uid).once('value');
      userProfile = snap.val();
      currentUid = user.uid;

      if (!userProfile || userProfile.status === 'pending') {
        // Compte en attente → retour auth
        await auth.signOut();
        window.location.href = 'auth.html';
        return;
      }

      // ✅ Accès autorisé — afficher la page
      document.getElementById('auth-loading').style.display  = 'none';
      document.getElementById('page-content').style.display  = 'block';

      // Guide installation PWA : affiché uniquement sur navigateur mobile, jamais en mode app installée.
      initPwaInstallCoach();

      // Nom d'affichage
      document.getElementById('user-display-name').textContent =
        userProfile.firstName || userProfile.name || user.email;

      await loadCategories();
      renderDashboard(userProfile, user.email);

      // Liens nav selon rôle
      if (userProfile.role === 'admin') {
        document.getElementById('bnav-profs').style.display = 'flex';
        document.getElementById('bnav-admin').style.display = 'flex';
      } else if (userProfile.role === 'prof') {
        document.getElementById('bnav-profs').style.display = 'flex';
      }

      // Filtrage des catégories selon les disciplines
      applyDisciplineFilter(userProfile);

      // Badge non lus messages
      listenUnreadBadge(user.uid);
      checkNotifStatus();
      listenResourceNotificationFallback(user.uid);

      // Chargement des données
      loadEvts();
      loadAnnonce();
      loadRecentDocs();
      loadMemberNews();
      handleResourceDeepLink();

    } catch(e) {
      console.warn('[FTS] Erreur chargement profil :', e);
      window.location.href = 'auth.html';
    }
  });
})();


/* ── TABLEAU DE BORD ─────────────────────────────────────────── */
function renderDashboard(profile, email) {
  const displayName = profile.firstName || profile.name || email || 'membre';

  // Disciplines affichées = propres + celles des enfants
  const ownDiscs   = profile.disciplines || [];
  const childDiscs = (profile.hasEnfant && Array.isArray(profile.enfants))
    ? profile.enfants.flatMap(e => Array.isArray(e.disciplines) ? e.disciplines : [])
    : [];
  const discs = profile.role === 'admin'
    ? C.categories.map(c => c.name)
    : [...new Set([...ownDiscs, ...childDiscs])];

  const roleLabel = profile.role === 'admin' ? 'Admin' : profile.role === 'prof' ? 'Prof' : 'Membre';
  const roleIcon  = profile.role === 'admin' ? '🛡' : profile.role === 'prof' ? '🎓' : '👤';

  const pills = document.getElementById('profile-pills');
  if (pills) {
    const discPills = discs.length
      ? discs.map(d => {
          const idx = C.categories.findIndex(c => c.name === d);
          const cat = idx >= 0 ? C.categories[idx] : null;
          const label = cat ? cat.name : d;
          const icon = cat ? cat.icon : '🎭';
          if (idx < 0) return `<span class="profile-pill">${icon} ${FTS.esc(label)}</span>`;
          return `<button type="button" class="profile-pill" data-cat-index="${idx}" aria-label="Ouvrir les ressources ${FTS.esc(label)}">${icon} ${FTS.esc(label)}</button>`;
        }).join('')
      : '<span class="profile-pill">⏳ Disciplines à valider</span>';

    // Pills enfants si compte parent
    const enfantPills = (profile.hasEnfant && Array.isArray(profile.enfants) && profile.enfants.length)
      ? profile.enfants.map(e =>
          `<span class="profile-pill profile-pill-child">🎩 ${FTS.esc(e.prenom || '')}</span>`
        ).join('')
      : '';

    pills.innerHTML = `<span class="profile-pill role">${roleIcon} ${roleLabel}</span>` + discPills + enfantPills;
  }


  const sub = document.getElementById('welcome-sub');
  if (sub) {
    sub.textContent = discs.length
      ? 'Retrouve tes ressources, tes événements et tes espaces d’échange en un seul endroit.'
      : 'Ton compte est actif, mais aucune discipline n’est encore associée à ton profil.';
  }
}


function eventTargetValues(e){
  const cats = normList(e && (e.targetCategories || e.categories || e.groups));
  const subs = normList(e && (e.targetSubgroups || e.targetSubcategories || e.subgroups || e.subcategories));
  const groups = {};

  if (e && e.targetGroups && typeof e.targetGroups === 'object' && !Array.isArray(e.targetGroups)) {
    Object.entries(e.targetGroups).forEach(([cat, list]) => {
      if (!cat) return;
      groups[cat] = normList(list);
    });
  } else {
    // Compatibilité anciens événements : sans mapping catégorie -> sous-catégories,
    // on rattache les sous-catégories à leur discipline via la structure actuelle.
    cats.forEach(cat => { groups[cat] = []; });
    subs.forEach(sub => {
      const cat = C.categories.find(c => (c.subcats || []).some(s => FTS.norm(s) === FTS.norm(sub)));
      if (cat && cat.name) {
        if (!groups[cat.name]) groups[cat.name] = [];
        groups[cat.name].push(sub);
      }
    });
  }

  return { cats, subs, groups };
}

function canSeeEvent(e){
  if (profileIsAdmin()) return true;
  const t = eventTargetValues(e || {});
  if (!t.cats.length && !t.subs.length && !Object.keys(t.groups).length) return true;

  const myCats = userDisciplines().map(FTS.norm);
  const mySubs = userSubgroups().map(FTS.norm);

  // Règle cible :
  // - catégorie cochée SANS sous-catégorie = toute la catégorie voit l'événement
  // - catégorie cochée AVEC sous-catégories = seuls ces sous-groupes voient l'événement
  // - aucune cible = tout le monde
  for (const [cat, subs] of Object.entries(t.groups)) {
    const catOk = myCats.includes(FTS.norm(cat));
    const cleanSubs = normList(subs);
    if (catOk && !cleanSubs.length) return true;
    if (catOk && cleanSubs.some(sub => mySubs.includes(FTS.norm(sub)))) return true;
  }

  // Sécurité de compatibilité pour anciens événements qui n'auraient que des champs plats.
  if (!Object.keys(t.groups).length) {
    if (t.cats.length && !t.subs.length) return t.cats.some(c => myCats.includes(FTS.norm(c)));
    if (t.subs.length) return t.subs.some(sub => mySubs.includes(FTS.norm(sub)));
  }

  return false;
}



/* ── NOUVEAUTÉS CIBLÉES MEMBRE ─────────────────────────────────
   Objectif : afficher uniquement ce que le membre peut déjà voir ailleurs.
   Aucun nouveau chemin Firebase, aucun contournement de permissions.
   Les filtres réutilisent canSeeDocInCategory() et canSeeEvent(). */
function seenNewsStorageKey() {
  return 'fts_seen_news_' + (currentUid || 'anonymous');
}

function getSeenNewsMap() {
  try {
    const raw = localStorage.getItem(seenNewsStorageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch(e) { return {}; }
}

function saveSeenNewsMap(map) {
  try { localStorage.setItem(seenNewsStorageKey(), JSON.stringify(map || {})); } catch(e) {}
}

function memberNewsCountStorageKey() {
  return 'fts_member_news_count_' + (currentUid || 'anonymous');
}

function saveMemberNewsCount(count) {
  try { localStorage.setItem(memberNewsCountStorageKey(), String(Math.max(0, Number(count || 0)))); } catch(e) {}
  if (window.FTSNav && typeof window.FTSNav.setBadge === 'function') {
    window.FTSNav.setBadge('fts-news-badge', count);
  }
}

function newsItemId(item) {
  if (!item) return '';
  const base = item.key || item.title || item.action || '';
  return [item.type || 'item', base, item.ts || '0'].map(v => String(v || '').trim()).join('|');
}

function isNewsSeen(itemOrId) {
  const id = typeof itemOrId === 'string' ? itemOrId : newsItemId(itemOrId);
  if (!id) return false;
  return getSeenNewsMap()[id] === true;
}

function markNewsSeen(itemOrId) {
  const id = typeof itemOrId === 'string' ? itemOrId : newsItemId(itemOrId);
  if (!id) return;
  const map = getSeenNewsMap();
  map[id] = true;
  saveSeenNewsMap(map);
}

function recentNewsSince() {
  // Pas de lecture/écriture Firebase : on limite juste les nouveautés anciennes côté navigateur.
  return Date.now() - 14 * 24 * 60 * 60 * 1000;
}

function itemTs(obj) {
  const raw = obj && (obj.updatedAt || obj.createdAt || obj.publishedAt || obj.dateCreated || obj.ts || obj.dateTs || obj.startTs || 0);
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isAfterLastVisit(ts, sinceTs) {
  return Number(ts || 0) > Number(sinceTs || 0);
}

async function getUnreadMessageCount(uid) {
  if (!uid) return 0;
  try {
    const snap = await db.ref('fts_dm/userConvs/' + uid).once('value');
    const convIds = snap.val() ? Object.keys(snap.val()) : [];
    if (!convIds.length) return 0;
    let total = 0;
    await Promise.all(convIds.map(id =>
      db.ref('fts_dm/conversations/' + id + '/unread/' + uid).once('value')
        .then(s => { total += Number(s.val() || 0) || 0; })
        .catch(() => {})
    ));
    return total;
  } catch(e) {
    console.warn('[FTS] Compteur messages nouveautés indisponible :', e);
    return 0;
  }
}

function newsLabelDate(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay ? 'Aujourd’hui' : d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' });
  } catch(e) { return ''; }
}

async function collectNewResources(sinceTs) {
  const snap = await db.ref('fts_ressources').once('value');
  const items = [];
  if (!snap.exists()) return items;

  snap.forEach(child => {
    const d = child.val() || {};
    if (d.active === false || d.status === 'inactive') return;
    const ts = itemTs(d);
    if (!isAfterLastVisit(ts, sinceTs)) return;

    const catName = d.cat || d.category || '';
    const idx = C.categories.findIndex(c => FTS.norm(c.name) === FTS.norm(catName));
    if (idx < 0) return;
    const cat = C.categories[idx];
    const item = {
      type: 'resource',
      icon: ICONS[(d.type || 'doc').toLowerCase().trim()] || '📄',
      title: d.name || d.nom || d.title || d.titre || 'Nouveau document',
      meta: (d.subcat || d.subcategory) ? `${catName} · ${d.subcat || d.subcategory}` : catName,
      ts,
      action: 'resource',
      key: child.key,
      catIndex: idx,
      cat: catName,
      sub: d.subcat || d.subcategory || ''
    };
    if (!canSeeDocInCategory({ sub:item.sub }, cat)) return;
    items.push(item);
  });
  return items;
}

async function collectNewEvents(sinceTs) {
  const snap = await db.ref('fts_events').once('value');
  const items = [];
  if (!snap.exists()) return items;
  const startOfToday = new Date();
  startOfToday.setHours(0,0,0,0);

  snap.forEach(child => {
    const v = child.val() || {};
    if (v.active === false || v.status === 'inactive') return;
    if (!canSeeEvent(v)) return;

    const eventDateTs = Number(v.dateTs || v.startTs || 0) || 0;
    if (eventDateTs && eventDateTs < startOfToday.getTime()) return;

    const ts = itemTs({ updatedAt:v.updatedAt, createdAt:v.createdAt, ts:v.ts });
    if (!isAfterLastVisit(ts, sinceTs)) return;

    items.push({
      type: 'event',
      icon: v.important ? '🔥' : '📅',
      title: v.name || v.nom || v.title || v.titre || 'Nouvel événement',
      meta: [v.dateLabel || v.date || v.d || '', v.hour || v.heure || v.time || v.h || ''].filter(Boolean).join(' · '),
      ts,
      action: 'event',
      key: child.key
    });
  });
  return items;
}

async function collectNewAnnouncement(sinceTs) {
  const snap = await db.ref('fts_content/annonces/current').once('value');
  const a = snap.val() || {};
  if (!a || a.active === false || a.status === 'inactive') return [];
  const title = a.title || a.titre || '';
  const body = a.body || a.text || a.texte || '';
  if (!title && !body) return [];
  const ts = itemTs(a);
  if (!isAfterLastVisit(ts, sinceTs)) return [];
  return [{
    type: 'announcement',
    icon: '⚠️',
    title: title || 'Nouvelle annonce importante',
    meta: 'Information importante',
    ts,
    action: 'announcement'
  }];
}

async function loadMemberNews() {
  const panel = document.getElementById('member-news-panel');
  const list = document.getElementById('member-news-list');
  const hint = document.getElementById('member-news-hint');
  if (!panel || !list || !currentUid) return;

  const now = Date.now();
  const sinceTs = recentNewsSince();

  try {
    const [resources, events, announcement, unread] = await Promise.all([
      collectNewResources(sinceTs).catch(() => []),
      collectNewEvents(sinceTs).catch(() => []),
      collectNewAnnouncement(sinceTs).catch(() => []),
      getUnreadMessageCount(currentUid)
    ]);

    latestUnreadMessages = unread;
    updateMsgBadge(unread);

    const items = [];
    if (unread > 0) {
      items.push({
        type: 'messages',
        icon: '💬',
        title: unread === 1 ? '1 message non lu' : `${unread} messages non lus`,
        meta: 'Messages privés / groupes',
        ts: now + 1,
        action: 'messages',
        skipSeenFilter: true
      });
    }
    items.push(...resources, ...events, ...announcement);

    const unique = [];
    const seenIds = new Set();
    items.sort((a,b) => Number(b.ts || 0) - Number(a.ts || 0)).forEach(item => {
      const id = newsItemId(item);
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      if (!item.skipSeenFilter && isNewsSeen(id)) return;
      unique.push({ ...item, newsId: id });
    });

    renderMemberNews(unique.slice(0, 5), false);
    if (hint) hint.textContent = 'Non consultées · selon vos cours';
  } catch(e) {
    console.warn('[FTS] Nouveautés indisponibles :', e);
    panel.classList.add('u-initial-hidden');
  }
}

function renderMemberNews(items) {
  const panel = document.getElementById('member-news-panel');
  const list = document.getElementById('member-news-list');
  if (!panel || !list) return;

  if (!items.length) {
    saveMemberNewsCount(0);
    panel.classList.add('u-initial-hidden');
    return;
  }

  panel.classList.remove('u-initial-hidden');
  panel.style.display = 'block';
  saveMemberNewsCount(items.length);
  const title = panel.querySelector('.smart-section-head h2');
  if (title) title.textContent = 'Nouveautés à consulter';

  list.innerHTML = items.map(item => `
    <button type="button" class="smart-item member-news-item" data-news-action="${FTS.esc(item.action || '')}"
      data-news-key="${FTS.esc(item.key || '')}"
      data-news-id="${FTS.esc(item.newsId || newsItemId(item))}"
      data-cat-index="${Number.isInteger(item.catIndex) ? item.catIndex : ''}"
      data-resource-cat="${FTS.esc(item.cat || '')}"
      data-resource-sub="${FTS.esc(item.sub || '')}">
      <span class="smart-item-icon member-news-icon member-news-${FTS.esc(item.type || 'item')}">${item.icon || '🔔'}</span>
      <span class="smart-item-main">
        <strong>${FTS.esc(item.title || 'Nouvelle information')}</strong>
        <small>${FTS.esc(item.meta || '')}${newsLabelDate(item.ts) ? ' · ' + FTS.esc(newsLabelDate(item.ts)) : ''}</small>
      </span>
      <span class="smart-item-action">Voir</span>
    </button>`).join('');
}

function refreshNewsPanelAfterSeen(btn) {
  if (btn && btn.parentNode) btn.remove();
  const panel = document.getElementById('member-news-panel');
  const list = document.getElementById('member-news-list');
  if (panel && list) {
    var remaining = list.querySelectorAll('.member-news-item').length;
    saveMemberNewsCount(remaining);
    if (!remaining) {
      panel.classList.add('u-initial-hidden');
      panel.style.display = 'none';
    }
  }
}

function openMemberNewsItem(btn) {
  const action = btn.dataset.newsAction || '';
  const newsId = btn.dataset.newsId || '';

  // Les messages restent pilotés par le vrai compteur non-lu Firebase.
  // Les autres nouveautés sont marquées comme lues localement, une par une.
  if (action !== 'messages' && newsId) {
    markNewsSeen(newsId);
    refreshNewsPanelAfterSeen(btn);
  }

  if (action === 'messages') {
    window.location.href = 'hub-messages.html';
    return;
  }
  if (action === 'announcement') {
    const panel = document.getElementById('priority-panel');
    if (panel) panel.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  if (action === 'event') {
    const key = btn.dataset.newsKey || '';
    const target = key ? document.getElementById('evt-' + key) : null;
    const section = document.getElementById('membres-events');
    if (target) {
      target.scrollIntoView({ behavior:'smooth', block:'center' });
      target.classList.add('news-highlight');
      setTimeout(() => target.classList.remove('news-highlight'), 2600);
    } else if (section) {
      section.scrollIntoView({ behavior:'smooth', block:'start' });
    }
    return;
  }
  if (action === 'resource') {
    const idx = Number(btn.dataset.catIndex);
    if (!Number.isInteger(idx)) return;
    pendingResourceOpen = {
      resource: btn.dataset.newsKey || '',
      catName: btn.dataset.resourceCat || (C.categories[idx] && C.categories[idx].name) || '',
      subcat: btn.dataset.resourceSub || ''
    };
    openCat(idx);
  }
}

function updateNextEventSummary(events) {
  const title = document.getElementById('dash-next-event');
  const date  = document.getElementById('dash-next-event-date');
  if (!title || !date) return;

  if (!events || !events.length) {
    title.textContent = 'Aucun événement';
    date.textContent  = 'Pour le moment';
    return;
  }

  const e = events[0];
  title.textContent = e.n || 'Événement';
  date.textContent  = `${e.d || ''}${e.h ? ' · ' + e.h : ''}`;
}

/* ── FILTRAGE PAR DISCIPLINES ────────────────────────────────── */
function applyDisciplineFilter(profile) {
  // Les accès ressources sont générés directement dans renderDashboard().
  // Cette fonction est conservée pour compatibilité avec l’ancien flux.
  return;
}

/* ── CHARGEMENT ÉVÉNEMENTS ───────────────────────────────────── */
async function loadEvts() {
  const el = document.getElementById('evts');
  try {
    const snap = await db.ref('fts_events').once('value');
    const rows = [];
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (snap.exists()) {
      snap.forEach(child => {
        const v = child.val() || {};
        if (v.active === false || v.status === 'inactive') return;
        if (!canSeeEvent(v)) return;

        const ts = Number(v.dateTs || v.startTs || v.ts || 0);
        rows.push({
          id: child.key,
          n: v.name || v.nom || v.title || v.titre || v.n || '',
          t: v.type || v.t || '',
          d: v.dateLabel || v.date || v.d || '',
          h: v.hour || v.heure || v.time || v.h || '',
          l: v.location || v.lieu || v.l || '',
          u: v.url || v.link || v.lien || v.u || '',
          important: v.important === true || v.priority === 'important',
          targetCategories: normList(v.targetCategories || v.categories || v.groups),
          targetSubgroups: normList(v.targetSubgroups || v.targetSubcategories || v.subgroups || v.subcategories),
          targetGroups: (v.targetGroups && typeof v.targetGroups === 'object') ? v.targetGroups : null,
          ts
        });
      });
    }

    allEvts = rows
      .filter(x => x.n && (x.d || x.ts))
      .filter(x => !x.ts || x.ts >= startOfToday.getTime())
      .sort((a,b) => {
        if (a.ts || b.ts) return (a.ts || Number.MAX_SAFE_INTEGER) - (b.ts || Number.MAX_SAFE_INTEGER);
        return String(a.d).localeCompare(String(b.d), 'fr');
      });

    updateNextEventSummary(allEvts);
    showEvts(allEvts.slice(0, 3));
  } catch(e) {
    console.warn('[FTS] Événements Firebase indisponibles :', e);
    if (el) el.innerHTML = "<div class='list-loading'>Impossible de charger les événements</div>";
    updateNextEventSummary([]);
  }
}

function showEvts(es) {
  const el = document.getElementById('evts');
  if (!es.length) {
    el.innerHTML = "<div class='list-loading'>Aucun événement à venir</div>";
    return;
  }
  el.innerHTML = es.map(e => `
    <div class="evt" id="evt-${FTS.esc(e.id || '')}">
      <div class="evt-info">
        <div class="evt-name">${FTS.esc(e.n)}</div>
        <div class="evt-meta">${FTS.esc(e.d)}${e.h?' — '+FTS.esc(e.h):''}${e.l?' — '+FTS.esc(e.l):''}</div>
      </div>
      ${e.important?`<span class="evt-type important">Important</span>`:''}
      ${e.t?`<span class="evt-type">${FTS.esc(e.t)}</span>`:''}
      ${e.u?`<a href="${e.u}" target="_blank" rel="noopener" class="evt-link">S'inscrire</a>`:''}
    </div>`).join('');
}

function toggleEvts() {
  showAll = !showAll;
  showEvts(showAll ? allEvts : allEvts.slice(0, 3));
  document.getElementById('btg').textContent = showAll ? 'Voir moins' : 'Voir tous';
}

/* ── OUVERTURE D'UNE CATÉGORIE ───────────────────────────────── */
function openCat(i) {
  cur = i;
  const cat = C.categories[i];
  document.getElementById('mtit').textContent = cat.icon + ' ' + cat.name;
  document.getElementById('mo').classList.remove('hidden');
  showCat(i);
}

/* ── AFFICHAGE CONTENU CATÉGORIE ─────────────────────────────── */
async function showCat(i) {
  const cat = C.categories[i];
  const ct  = document.getElementById('catcnt');

  let h = '';

  const visibleSubcats = allowedSubcatsForCategory(cat);

  if (visibleSubcats.length) {
    h += `<div class="sub-label">Sections</div>
           <div class="subcat-group">
             <button class="subcat-tag all-btn act" data-subcat-index="0" data-cat-index="${i}">Tout</button>
             ${visibleSubcats.map((s,j) =>
               `<button class="subcat-tag" data-subcat-index="${j+1}" data-cat-index="${i}">${FTS.esc(s)}</button>`
             ).join('')}
           </div>`;
  }

  h += `<input type="search" id="srch-${i}" class="search-input js-resource-search"
               data-cat-index="${i}"
               placeholder="🔍 Rechercher…">`;

  h += `<div class="doc-label">Documents</div>
         <div id="dc-${i}"><div class="list-loading">Chargement…</div></div>`;

  ct.innerHTML = h;
  await loadDocs(cat.name, i);
}

/* ── CHARGEMENT DOCUMENTS (Firebase uniquement) ──────────────── */
async function loadDocs(name, idx) {
  const el = document.getElementById('dc-' + idx);
  if (!el) return;

  let rows = [];

  // Source unique V1 : Firebase RTDB (ressources publiées via profs/admin)
  try {
    const snap = await db.ref('fts_ressources').once('value');
    if (snap.exists()) {
      snap.forEach(child => {
        const d = child.val() || {};
        if (d.active === false || d.status === 'inactive') return;
        const catName = d.cat || d.category || '';
        if (FTS.norm(catName) !== FTS.norm(name)) return;
        rows.push({
          cat:  catName,
          sub:  d.subcat || d.subcategory || '',
          name: d.name || d.nom || d.title || d.titre || '',
          url:  d.url || d.content || d.contenu || d.link || d.lien || '',
          type: (d.type || 'doc').toLowerCase().trim(),
          key:  child.key,
          ts:   d.createdAt || d.updatedAt || 0,
        });
      });
    }
  } catch(e) {
    console.warn('[FTS] Ressources Firebase indisponibles :', e);
  }

  // Dédoublonnage par nom + catégorie
  const seen = new Set();
  const deduped = rows
    .filter(r => r.name)
    .sort((a, b) => b.ts - a.ts)
    .filter(r => {
      const k = FTS.norm(r.name) + '|' + FTS.norm(r.cat) + '|' + FTS.norm(r.sub || '');
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

  const cat = C.categories[idx];
  const allowedDocs = deduped.filter(d => canSeeDocInCategory(d, cat));
  allDocs[idx] = allowedDocs;
  showDocs(allowedDocs, idx);
}


/* ── DOCUMENTS RÉCENTS DU DASHBOARD ─────────────────────────────
   Source conservée : fts_ressources, avec le même filtrage que les modales.
   Objectif : rendre les derniers documents visibles sans changer la logique. */
async function loadRecentDocs() {
  const el = document.getElementById('recent-docs');
  if (!el) return;

  try {
    const snap = await db.ref('fts_ressources').once('value');
    const rows = [];

    if (snap.exists()) {
      snap.forEach(child => {
        const d = child.val() || {};
        if (d.active === false || d.status === 'inactive') return;

        const catName = d.cat || d.category || '';
        const idx = C.categories.findIndex(c => FTS.norm(c.name) === FTS.norm(catName));
        if (idx < 0) return;

        const cat = C.categories[idx];
        const item = {
          cat: catName,
          catIndex: idx,
          sub: d.subcat || d.subcategory || '',
          name: d.name || d.nom || d.title || d.titre || '',
          url: d.url || d.content || d.contenu || d.link || d.lien || '',
          type: (d.type || 'doc').toLowerCase().trim(),
          key: child.key,
          ts: d.createdAt || d.updatedAt || 0,
        };

        if (!item.name) return;
        if (!canSeeDocInCategory(item, cat)) return;
        rows.push(item);
      });
    }

    const docs = rows
      .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
      .slice(0, 4);

    renderRecentDocs(docs);
  } catch(e) {
    console.warn('[FTS] Documents récents indisponibles :', e);
    el.innerHTML = '<div class="list-loading">Impossible de charger les documents.</div>';
  }
}

function renderRecentDocs(docs) {
  const el = document.getElementById('recent-docs');
  if (!el) return;

  if (!docs.length) {
    el.innerHTML = `
      <div class="empty-state-card">
        <strong>Aucun document pour le moment.</strong>
        <span>Les ressources publiées par les professeurs apparaîtront ici automatiquement.</span>
      </div>`;
    return;
  }

  el.innerHTML = docs.map(d => {
    const t = (d.type || 'doc').toLowerCase().trim();
    const icon = ICONS[t] || '📄';
    const label = d.sub ? `${d.cat} · ${d.sub}` : d.cat;
    return `
      <button type="button" class="smart-item dashboard-resource-item"
        data-cat-index="${d.catIndex}"
        data-resource-key="${FTS.esc(d.key || '')}"
        data-resource-cat="${FTS.esc(d.cat || '')}"
        data-resource-sub="${FTS.esc(d.sub || '')}">
        <span class="smart-item-icon">${icon}</span>
        <span class="smart-item-main">
          <strong>${FTS.esc(d.name)}</strong>
          <small>${FTS.esc(label)}</small>
        </span>
        <span class="smart-item-action">Ouvrir</span>
      </button>`;
  }).join('');
}

function openDashboardResource(btn) {
  const idx = Number(btn.dataset.catIndex);
  if (!Number.isInteger(idx)) return;
  pendingResourceOpen = {
    resource: btn.dataset.resourceKey || '',
    catName: btn.dataset.resourceCat || (C.categories[idx] && C.categories[idx].name) || '',
    subcat: btn.dataset.resourceSub || ''
  };
  openCat(idx);
}

/* ── AFFICHAGE DOCUMENTS ─────────────────────────────────────── */
function showDocs(docs, idx) {
  const el = document.getElementById('dc-' + idx);
  if (!el) return;

  if (!docs.length) {
    el.innerHTML = "<p class='empty-documents'>Aucun document pour le moment.</p>";
    return;
  }

  el.innerHTML = docs.map(d => {
    const t     = (d.type || 'doc').toLowerCase().trim();
    const isUrl = d.url && d.url.indexOf('http') === 0;

    if (!isUrl || t === 'texte' || t === 'text' || t === 'txt') {
      return `<div class="doc-text" id="doc-${FTS.esc(d.key || '')}" data-doc-key="${FTS.esc(d.key || '')}">
                ${d.name ? `<strong>${FTS.esc(d.name)}</strong><br>` : ''}
                ${FTS.esc(d.url)}
              </div>`;
    }

    const icon = ICONS[t] || '□';
    return `<a href="${d.url}" target="_blank" rel="noopener" class="doc-link" id="doc-${FTS.esc(d.key || '')}" data-doc-key="${FTS.esc(d.key || '')}">
              <span class="doc-icon">${icon}</span>
              <span class="doc-name">
                ${FTS.esc(d.name)}
                ${d.sub ? `<span class="doc-sub">— ${FTS.esc(d.sub)}</span>` : ''}
              </span>
            </a>`;
  }).join('');
  revealPendingResource(idx);
}

/* ── OUVERTURE DIRECTE DEPUIS UNE NOTIFICATION ──────────────── */
function handleResourceDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const resource = params.get('resource') || '';
  const catName = params.get('cat') || '';
  const subcat = params.get('subcat') || '';
  if (!resource && !catName) return;
  pendingResourceOpen = { resource, catName, subcat };
  const idx = C.categories.findIndex(c => FTS.norm(c.name) === FTS.norm(catName));
  if (idx >= 0) openCat(idx);
}

function revealPendingResource(idx) {
  if (!pendingResourceOpen) return;
  const cat = C.categories[idx];
  if (!cat || FTS.norm(cat.name) !== FTS.norm(pendingResourceOpen.catName)) return;

  if (pendingResourceOpen.subcat) {
    const visibleSubcats = allowedSubcatsForCategory(cat);
    const subIdx = visibleSubcats.findIndex(s => FTS.norm(s) === FTS.norm(pendingResourceOpen.subcat));
    if (subIdx >= 0) {
      const buttons = document.querySelectorAll('.subcat-tag');
      const btn = buttons[subIdx + 1];
      if (btn && !btn.classList.contains('act')) { filtDocs(subIdx + 1, idx, btn); return; }
    }
  }

  setTimeout(() => {
    const el = pendingResourceOpen.resource ? document.getElementById('doc-' + pendingResourceOpen.resource) : null;
    if (el) {
      el.scrollIntoView({ behavior:'smooth', block:'center' });
      el.style.outline = '2px solid var(--gold)';
      el.style.boxShadow = '0 0 0 4px rgba(201,168,76,.12)';
      setTimeout(() => { el.style.outline = ''; el.style.boxShadow = ''; }, 3500);
      pendingResourceOpen = null;
    }
  }, 150);
}

/* ── FILTRAGE PAR SOUS-CATÉGORIE ─────────────────────────────── */
function filtDocs(si, idx, el) {
  document.querySelectorAll('.subcat-tag').forEach(t => t.classList.remove('act'));
  el.classList.add('act');

  const srch = document.getElementById('srch-' + idx);
  if (srch) srch.value = '';

  const cat      = C.categories[idx];
  const docs     = allDocs[idx] || [];
  const visibleSubcats = allowedSubcatsForCategory(cat);
  const filtered = si === 0 ? docs : docs.filter(x => FTS.norm(x.sub) === FTS.norm(visibleSubcats[si - 1] || ''));
  showDocs(filtered, idx);
}

/* ── RECHERCHE ───────────────────────────────────────────────── */
function searchDocs(idx, q) {
  const docs = allDocs[idx] || [];
  const term = q.toLowerCase().trim();
  const res  = term
    ? docs.filter(x => (x.name + ' ' + x.sub).toLowerCase().includes(term))
    : docs;
  showDocs(res, idx);
}

/* ── FERMER LA MODAL ─────────────────────────────────────────── */
function closeMo() {
  document.getElementById('mo').classList.add('hidden');
  cur = null;
}

document.getElementById('mo').addEventListener('click', function(e) {
  if (e.target.id === 'mo') closeMo();
});

/* ── ANNONCE DYNAMIQUE ───────────────────────────────────────── */
async function loadAnnonce() {
  const el = document.getElementById('annonce-dyn');
  if (!el) return;

  try {
    const snap = await db.ref('fts_content/annonces/current').once('value');
    const a = snap.val() || {};
    if (a.active === false || a.status === 'inactive') return;

    const title = a.title || a.titre || '';
    const body  = a.body || a.text || a.texte || '';
    const btn   = a.buttonText || a.btn || '';
    const url   = a.buttonUrl || a.url || '';

    if (!title && !body) return;

    el.innerHTML = `
      ${title ? `<strong>${FTS.esc(title)}</strong><br>` : ''}
      ${body ? FTS.esc(body).replace(/\n/g, '<br>') : ''}
      ${btn && url ? `<br><a href="${FTS.esc(url)}" class="evt-link evt-action-link">${FTS.esc(btn)}</a>` : ''}
    `;
    const panel = document.getElementById('priority-panel');
    if (panel) {
      panel.classList.remove('u-initial-hidden');
      panel.style.display = 'block';
    }
  } catch(e) {
    console.warn('[FTS] Annonce Firebase indisponible :', e);
  }
}


/* ── NOTIFICATIONS PUSH RESSOURCES / FORUM / MESSAGES ────────── */
function urlBase64ToUint8Array(b64){
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const arr = new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
async function getSubscription(){
  if(!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}
function updateNotifBtn(on){
  const btn = document.getElementById('btn-notif');
  if(btn) {
    btn.classList.toggle('on', !!on);
    btn.innerHTML = on
      ? '<span class="quick-ico">🔔</span><span class="quick-title">Notifs activées</span>'
      : '<span class="quick-ico">🔕</span><span class="quick-title">Activer les notifs</span>';
  }
  updateAccountNotifStatus(!!on);
}
async function checkNotifStatus(){
  try { updateNotifBtn(!!(await getSubscription())); }
  catch(e) { updateNotifBtn(false); }
}
function memberNotificationGroups(){ return normList(userProfile && (userProfile.group || userProfile.disciplines)); }
function memberNotificationSubgroups(){ return normList(userProfile && (userProfile.subgroup || userProfile.subgroups || userProfile.subcategories)); }
async function toggleNotifications(){
  try{
    if(!FTS.PUSH || !FTS.PUSH.workerUrl || !FTS.PUSH.vapidPublicKey){
      alert('Configuration notifications manquante. Vérifie FTS.PUSH dans fts-firebase.js.'); return;
    }
    const existing = await getSubscription();
    if(existing){
      await existing.unsubscribe();
      await fetch(FTS.PUSH.workerUrl + '/unsubscribe', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({uid: currentUid})}).catch(()=>{});
      updateNotifBtn(false); return;
    }
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){ alert('Autorise les notifications pour continuer.'); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(FTS.PUSH.vapidPublicKey)});
    const groups = memberNotificationGroups();
    const subgroups = memberNotificationSubgroups();
    await fetch(FTS.PUSH.workerUrl + '/subscribe', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid: currentUid, subscription: sub.toJSON(), group: groups.join(', '), subgroup: subgroups.join(', '), groups, subgroups, source:'membres'})
    });
    updateNotifBtn(true);
  }catch(e){ alert('Erreur notifications : ' + (e && e.message ? e.message : e)); }
}
function listenResourceNotificationFallback(uid){
  if(!uid || !('Notification' in window) || !('serviceWorker' in navigator)) return;
  let initialized = false;
  db.ref('fts_user_notifications/' + uid).limitToLast(20).on('child_added', async snap => {
    const n = snap.val() || {};
    if(!initialized) return;
    if(n.type !== 'event' || n.read === true) return;

    // Évite les doublons : les ressources sont déjà envoyées par push ciblé
    // depuis profs.js. Le nœud fts_user_notifications sert ici de trace / inbox,
    // pas de second déclencheur visuel.
    if(n.type === 'resource' && (n.skipLocalPush === true || (FTS.PUSH && FTS.PUSH.workerUrl))) return;

    if(Notification.permission !== 'granted') return;
    try{
      const reg = await navigator.serviceWorker.ready;
      const isEvent = true;
      reg.showNotification(n.title || 'Nouvel événement', {
        body: n.body || 'Un nouvel événement est disponible.',
        icon:'./assets/img/fts192.png', badge:'./assets/img/fts192.png',
        tag:'event-local-' + (n.eventId || snap.key),
        data:{ url:n.url || './membres.html' }
      });
    }catch(e){}
  });
  setTimeout(() => { initialized = true; }, 1500);
}

/* ── BADGE NON LUS MESSAGES ──────────────────────────────────── */
function listenUnreadBadge(uid) {
  db.ref('fts_dm/userConvs/' + uid).on('value', async snap => {
    const convIds = snap.val() ? Object.keys(snap.val()) : [];
    if (!convIds.length) { updateMsgBadge(0); return; }
    let total = 0;
    await Promise.all(convIds.map(id =>
      db.ref('fts_dm/conversations/' + id + '/unread/' + uid).once('value')
        .then(s => { total += (s.val() || 0); })
    ));
    updateMsgBadge(total);
  });
}

function updateMsgBadge(count) {
  latestUnreadMessages = Number(count || 0) || 0;
  const el = document.getElementById('msg-badge');
  if (!el) return;
  const dash = document.getElementById('dash-msg-count');
  if (dash) dash.textContent = count > 99 ? '99+' : String(count);

  if (count > 0) {
    el.textContent = count > 99 ? '99+' : count;
    el.style.display = 'inline-block';
  } else {
    el.style.display = 'none';
  }
}


/* ── GESTION DU COMPTE ───────────────────────────────────────── */
function getAccountDisplayName() {
  const user = firebase.auth().currentUser;
  if (!userProfile && !user) return 'Membre';
  return (userProfile && (userProfile.name || [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ')))
    || (user && user.email)
    || 'Membre';
}

function fillAccountIdentity() {
  const user = firebase.auth().currentUser;
  const email = (userProfile && userProfile.email) || (user && user.email) || '—';
  const firstName = (userProfile && userProfile.firstName) || '—';
  const lastName = (userProfile && userProfile.lastName) || '—';
  const displayName = getAccountDisplayName();

  const identity = document.getElementById('account-identity-line');
  const emailEl = document.getElementById('account-email');
  const firstEl = document.getElementById('account-firstname');
  const lastEl = document.getElementById('account-lastname');
  const avatar = document.getElementById('account-avatar');

  if (identity) identity.textContent = displayName;
  if (emailEl) emailEl.textContent = email;
  if (firstEl) firstEl.textContent = firstName;
  if (lastEl) lastEl.textContent = lastName;
  if (avatar) avatar.textContent = displayName && displayName !== 'Membre' ? displayName.trim().charAt(0).toUpperCase() : '👤';
}

function updateAccountNotifStatus(on) {
  const status = document.getElementById('account-notif-status');
  const icon = document.getElementById('account-notif-icon');
  const action = document.getElementById('account-notif-action-label');
  if (status) status.textContent = on ? 'Activées' : 'Désactivées';
  if (icon) icon.textContent = on ? '🔔' : '🔕';
  if (action) action.textContent = on ? 'Désactiver les notifications' : 'Activer les notifications';
}

function openAccountModal() {
  const m = document.getElementById('account-modal');
  if (!m) return;
  clearAccountMsg('account-pwd-msg');
  clearAccountMsg('profile-msg');
  fillAccountIdentity();
  checkNotifStatus();
  const p1 = document.getElementById('account-new-pwd');
  const p2 = document.getElementById('account-new-pwd2');
  if (p1) p1.value = '';
  if (p2) p2.value = '';

  // Pré-remplir le profil
  const tel = document.getElementById('profile-tel');
  if (tel) tel.value = (userProfile && userProfile.telephone) || '';
  renderProfileEnfants();

  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
}

function renderProfileEnfants() {
  const wrap = document.getElementById('profile-enfants-wrap');
  const list = document.getElementById('profile-enfants-list');
  if (!wrap || !list || !userProfile) return;

  if (!userProfile.hasEnfant || !Array.isArray(userProfile.enfants) || !userProfile.enfants.length) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  list.innerHTML = userProfile.enfants.map((e, i) => `
    <div class="profile-enfant-card">
      <div class="profile-enfant-card-title">🎩 Enfant ${i + 1}</div>
      <div class="profile-enfant-name">${FTS.esc((e.prenom || '') + ' ' + (e.nom || ''))}</div>
      ${e.dateNaissance ? `<div class="profile-enfant-dob">Né(e) le ${FTS.esc(e.dateNaissance)}</div>` : ''}
      ${e.disciplines && e.disciplines.length ? `<div class="child-disciplines">Disciplines : ${FTS.esc(e.disciplines.join(', '))}</div>` : ''}
      <input class="account-field" type="tel" placeholder="Téléphone — 06 12 34 56 78"
        data-enfant-idx="${i}" value="${FTS.esc(e.telephone || '')}"
        class="u-mt-sm">
    </div>`).join('');
}

async function saveProfileInfo() {
  const btn = document.getElementById('btn-save-profile');
  const tel = (document.getElementById('profile-tel').value || '').trim();
  const updates = { telephone: tel };

  if (userProfile.hasEnfant && Array.isArray(userProfile.enfants)) {
    const enfants = userProfile.enfants.map((e, i) => ({ ...e }));
    document.querySelectorAll('[data-enfant-idx]').forEach(input => {
      const idx = parseInt(input.dataset.enfantIdx, 10);
      if (enfants[idx]) enfants[idx].telephone = input.value.trim();
    });
    updates.enfants = enfants;
  }

  try {
    if (btn) btn.disabled = true;
    setAccountMsg('profile-msg', 'Enregistrement…', '');
    await db.ref('fts_users/' + currentUid).update(updates);
    userProfile.telephone = tel;
    if (updates.enfants) userProfile.enfants = updates.enfants;
    setAccountMsg('profile-msg', '✓ Profil enregistré.', 'ok');
  } catch(e) {
    setAccountMsg('profile-msg', 'Erreur lors de la sauvegarde. Réessaie.', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function closeAccountModal() {
  const m = document.getElementById('account-modal');
  if (m) {
    m.classList.add('hidden');
    m.setAttribute('aria-hidden', 'true');
  }
}

function setAccountMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('ok', 'err');
  if (type) el.classList.add(type);
}
function clearAccountMsg(id) { setAccountMsg(id, '', ''); }

function accountFriendlyError(code) {
  switch(code) {
    case 'auth/requires-recent-login': return 'Par sécurité, reconnecte-toi puis recommence cette action.';
    case 'auth/weak-password': return 'Le mot de passe est trop faible.';
    case 'auth/network-request-failed': return 'Problème réseau. Réessaie dans quelques instants.';
    case 'PERMISSION_DENIED': return 'Suppression partielle bloquée par les règles Firebase. Connecte-toi en admin ou ajuste les règles.';
    default: return 'Une erreur est survenue. Réessaie ou reconnecte-toi.';
  }
}

async function changeAccountPassword() {
  const user = firebase.auth().currentUser;
  const btn  = document.getElementById('btn-account-pwd');
  const p1   = document.getElementById('account-new-pwd').value;
  const p2   = document.getElementById('account-new-pwd2').value;

  if (!user) { window.location.href = 'auth.html'; return; }
  if (!p1 || p1.length < 8) { setAccountMsg('account-pwd-msg', 'Le mot de passe doit contenir au moins 8 caractères.', 'err'); return; }
  if (p1 !== p2) { setAccountMsg('account-pwd-msg', 'Les deux mots de passe ne correspondent pas.', 'err'); return; }

  try {
    if (btn) btn.disabled = true;
    setAccountMsg('account-pwd-msg', 'Modification en cours…', '');
    await user.updatePassword(p1);
    document.getElementById('account-new-pwd').value = '';
    document.getElementById('account-new-pwd2').value = '';
    setAccountMsg('account-pwd-msg', 'Mot de passe modifié avec succès.', 'ok');
  } catch(e) {
    setAccountMsg('account-pwd-msg', accountFriendlyError(e.code), 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function removeUserDatabaseTraces(uid) {
  const updates = {};
  updates['fts_users/' + uid] = null;
  updates['fts_forum/users/' + uid] = null;
  updates['fts_dm/userConvs/' + uid] = null;

  try {
    const convSnap = await db.ref('fts_dm/userConvs/' + uid).once('value');
    const convIds = convSnap.val() ? Object.keys(convSnap.val()) : [];
    convIds.forEach(id => {
      updates['fts_dm/conversations/' + id + '/participants/' + uid] = null;
      updates['fts_dm/conversations/' + id + '/unread/' + uid] = null;
    });
  } catch(e) {
    console.warn('[FTS] Nettoyage conversations partiel :', e);
  }

  await db.ref().update(updates);
}

async function anonymizeUserMessages(uid) {
  try {
    const forumSnap = await db.ref('fts_forum/messages').once('value');
    const updates = {};
    forumSnap.forEach(chSnap => {
      chSnap.forEach(msgSnap => {
        const m = msgSnap.val() || {};
        if (m.uid === uid) {
          updates['fts_forum/messages/' + chSnap.key + '/' + msgSnap.key + '/name'] = 'Compte supprimé';
          updates['fts_forum/messages/' + chSnap.key + '/' + msgSnap.key + '/uid'] = null;
        }
      });
    });
    if (Object.keys(updates).length) await db.ref().update(updates);
  } catch(e) {
    console.warn('[FTS] Anonymisation forum partielle :', e);
  }
}

async function deleteMyAccount() {
  const user = firebase.auth().currentUser;
  const btn  = document.getElementById('btn-account-delete');
  if (!user) { window.location.href = 'auth.html'; return; }

  const first = confirm('Supprimer définitivement ton compte Fais Ton Show ? Cette action est irréversible.');
  if (!first) return;
  const typed = prompt('Pour confirmer, écris SUPPRIMER en majuscules :');
  if (typed !== 'SUPPRIMER') {
    setAccountMsg('account-delete-msg', 'Suppression annulée.', '');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setAccountMsg('account-delete-msg', 'Suppression des données en cours…', '');
    const uid = user.uid;
    await anonymizeUserMessages(uid);
    await removeUserDatabaseTraces(uid);
    await user.delete();
    window.location.href = 'auth.html';
  } catch(e) {
    console.warn('[FTS] Suppression compte :', e);
    setAccountMsg('account-delete-msg', accountFriendlyError(e.code || e.message), 'err');
    if (btn) btn.disabled = false;
  }
}

function openAccountPwaHelp() {
  if (isPwaStandaloneMode()) {
    setAccountMsg('profile-msg', '✓ L’application est déjà ouverte en mode installé.', 'ok');
    return;
  }
  closeAccountModal();
  openPwaInstallCoach();
}

const accountModal = document.getElementById('account-modal');
if (accountModal) {
  accountModal.addEventListener('click', function(e) {
    if (e.target.id === 'account-modal') closeAccountModal();
  });
}



/* ── GUIDE INSTALLATION PWA MOBILE ───────────────────────────── */
let deferredInstallPrompt = null;
let pwaCoachOpenTimer = null;

function forceHidePwaInstallCoach(rememberSession) {
  if (pwaCoachOpenTimer) {
    clearTimeout(pwaCoachOpenTimer);
    pwaCoachOpenTimer = null;
  }
  const modal = document.getElementById('pwa-coach');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.pointerEvents = 'none';
  }
  document.body.classList.remove('pwa-coach-open');
  document.documentElement.classList.remove('pwa-coach-open');
  if (rememberSession) {
    try { sessionStorage.setItem('fts-pwa-coach-closed-session', '1'); } catch(e) {}
  }
}

function refreshAndroidInstallButton() {
  const btn = document.getElementById('pwa-install-main');
  const note = document.getElementById('pwa-android-auto-note');
  if (!btn) return;

  if (deferredInstallPrompt) {
    btn.disabled = false;
    btn.classList.remove('is-waiting');
    btn.textContent = 'Installer l’application';
    if (note) note.textContent = 'Ton téléphone propose l’installation automatique. Appuie sur le bouton ci-dessus.';
  } else {
    btn.disabled = true;
    btn.classList.add('is-waiting');
    btn.textContent = 'Installation automatique indisponible';
    if (note) note.textContent = 'Utilise la méthode sûre avec le menu ⋮ de Chrome ci-dessous.';
  }
}

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  refreshAndroidInstallButton();
});

window.addEventListener('appinstalled', function() {
  try { localStorage.setItem('fts-pwa-installed', '1'); } catch(e) {}
  closePwaInstallCoach();
});

function isPwaStandaloneMode() {
  const standaloneQueries = [
    '(display-mode: standalone)',
    '(display-mode: fullscreen)',
    '(display-mode: minimal-ui)',
    '(display-mode: window-controls-overlay)',
    '(display-mode: tabbed)'
  ];
  const displayModeStandalone = standaloneQueries.some(function(query) {
    try { return window.matchMedia(query).matches; } catch(e) { return false; }
  });
  const iosStandalone = window.navigator.standalone === true;
  const androidWebApkReferrer = String(document.referrer || '').startsWith('android-app://');
  return displayModeStandalone || iosStandalone || androidWebApkReferrer;
}

function isMobileViewportOrDevice() {
  return window.matchMedia('(max-width: 820px)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function getPwaDeviceType() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'android';
}

function switchPwaTab(type) {
  const next = type === 'ios' ? 'ios' : 'android';
  document.querySelectorAll('[data-pwa-tab]').forEach(function(btn) {
    const active = btn.dataset.pwaTab === next;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const ios = document.getElementById('pwa-panel-ios');
  const android = document.getElementById('pwa-panel-android');
  if (ios) ios.classList.toggle('active', next === 'ios');
  if (android) android.classList.toggle('active', next === 'android');
}

function closePwaInstallCoach(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  forceHidePwaInstallCoach(true);
}
window.closePwaInstallCoach = closePwaInstallCoach;
window.FTSClosePwaCoach = closePwaInstallCoach;

function openPwaInstallCoach() {
  if (isPwaStandaloneMode()) {
    forceHidePwaInstallCoach(false);
    return;
  }
  const modal = document.getElementById('pwa-coach');
  if (!modal) return;
  switchPwaTab(getPwaDeviceType());
  refreshAndroidInstallButton();
  modal.style.display = 'flex';
  modal.style.visibility = '';
  modal.style.pointerEvents = '';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('pwa-coach-open');
  document.documentElement.classList.add('pwa-coach-open');
}

function initPwaInstallCoach() {
  if (isPwaStandaloneMode()) {
    forceHidePwaInstallCoach(false);
    return;
  }
  if (!isMobileViewportOrDevice()) return;
  try {
    if (sessionStorage.getItem('fts-pwa-coach-closed-session') === '1') return;
  } catch(e) {}

  if (pwaCoachOpenTimer) clearTimeout(pwaCoachOpenTimer);
  // Petit délai volontaire : laisse le dashboard apparaître, puis guide l'installation.
  pwaCoachOpenTimer = setTimeout(function() {
    pwaCoachOpenTimer = null;
    openPwaInstallCoach();
  }, 650);
}

async function triggerAndroidInstallPrompt(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  if (!deferredInstallPrompt) {
    switchPwaTab('android');
    refreshAndroidInstallButton();
    return;
  }
  try {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
  } catch(e) {
    console.warn('[FTS] Installation PWA Android non déclenchée :', e);
  } finally {
    deferredInstallPrompt = null;
    refreshAndroidInstallButton();
    closePwaInstallCoach();
  }
}

function bindPwaCoachSafetyEvents() {
  // Filet de sécurité : la fermeture fonctionne même si un autre listener échoue.
  const handler = function(e) {
    const target = e.target;
    if (!target || !target.closest) return;
    if (target.closest('#pwa-coach-close') || target.closest('#pwa-coach-later')) {
      closePwaInstallCoach(e);
      return;
    }
    if (target.id === 'pwa-coach') {
      closePwaInstallCoach(e);
    }
  };
  document.addEventListener('click', handler, true);
  document.addEventListener('pointerup', handler, true);
}

try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (isPwaStandaloneMode()) forceHidePwaInstallCoach(false);
      bindPwaCoachSafetyEvents();
    }, { once: true });
  } else {
    if (isPwaStandaloneMode()) forceHidePwaInstallCoach(false);
    bindPwaCoachSafetyEvents();
  }
  ['(display-mode: standalone)','(display-mode: fullscreen)','(display-mode: minimal-ui)','(display-mode: window-controls-overlay)','(display-mode: tabbed)'].forEach(function(query) {
    try {
      const mq = window.matchMedia(query);
      const onChange = function() { if (isPwaStandaloneMode()) forceHidePwaInstallCoach(false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch(e) {}
  });
} catch(e) {}


/* ── ÉVÉNEMENTS UI SANS JS INLINE ────────────────────────────── */
function bindMembresUiEvents() {
  const bindClick = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  };

  bindClick('btn-open-account', openAccountModal);
  bindClick('btn-notif', toggleNotifications);
  bindClick('btg', toggleEvts);
  bindClick('btn-save-profile', saveProfileInfo);
  bindClick('btn-account-pwd', changeAccountPassword);
  bindClick('btn-account-signout', doSignOut);
  bindClick('btn-account-notifs', toggleNotifications);
  bindClick('btn-account-pwa-help', openAccountPwaHelp);
  bindClick('pwa-coach-close', closePwaInstallCoach);
  bindClick('pwa-coach-later', closePwaInstallCoach);
  bindClick('pwa-install-main', triggerAndroidInstallPrompt);

  document.addEventListener('click', function(e) {

    const pwaTab = e.target.closest('[data-pwa-tab]');
    if (pwaTab) {
      switchPwaTab(pwaTab.dataset.pwaTab);
      return;
    }

    if (e.target && e.target.id === 'pwa-coach') {
      closePwaInstallCoach();
      return;
    }
    const closeAccountBtn = e.target.closest('[data-action="close-account-modal"]');
    if (closeAccountBtn) {
      closeAccountModal();
      return;
    }

    const closeResourceBtn = e.target.closest('[data-action="close-resource-modal"]');
    if (closeResourceBtn) {
      closeMo();
      return;
    }

    const memberNewsBtn = e.target.closest('.member-news-item[data-news-action]');
    if (memberNewsBtn) {
      openMemberNewsItem(memberNewsBtn);
      return;
    }

    const dashResourceBtn = e.target.closest('.dashboard-resource-item[data-cat-index]');
    if (dashResourceBtn) {
      openDashboardResource(dashResourceBtn);
      return;
    }

    const catBtn = e.target.closest('[data-cat-index].profile-pill');
    if (catBtn) {
      const idx = Number(catBtn.dataset.catIndex);
      if (Number.isInteger(idx)) openCat(idx);
      return;
    }

    const subcatBtn = e.target.closest('.subcat-tag[data-cat-index][data-subcat-index]');
    if (subcatBtn) {
      const catIndex = Number(subcatBtn.dataset.catIndex);
      const subcatIndex = Number(subcatBtn.dataset.subcatIndex);
      if (Number.isInteger(catIndex) && Number.isInteger(subcatIndex)) {
        filtDocs(subcatIndex, catIndex, subcatBtn);
      }
    }
  });

  document.addEventListener('input', function(e) {
    const input = e.target.closest('.js-resource-search[data-cat-index]');
    if (!input) return;
    const idx = Number(input.dataset.catIndex);
    if (Number.isInteger(idx)) searchDocs(idx, input.value);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindMembresUiEvents);
} else {
  bindMembresUiEvents();
}

/* ── DÉCONNEXION ─────────────────────────────────────────────── */
function doSignOut() {
  firebase.auth().signOut().then(() => {
    window.location.href = 'auth.html';
  });
}
