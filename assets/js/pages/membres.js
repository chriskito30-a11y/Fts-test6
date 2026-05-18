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
let seenNewsCache = null;
let seenNewsLoaded = false;

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


function updateRoleNavigation(profile, email) {
  try {
    const bottomNav = document.querySelector('.fts-bottom-nav');
    const topProf = document.getElementById('fts-nav-prof');
    const topAdmin = document.getElementById('fts-nav-admin');
    const quickProf = document.getElementById('bnav-profs');
    const quickAdmin = document.getElementById('bnav-admin');

    const role = String((profile && profile.role) || '').trim().toLowerCase();
    const mail = String(email || (profile && profile.email) || '').trim().toLowerCase();

    const isAdminRole = role === 'admin' || mail === 'contact@faistonshow.fr';
    const isProfRole = role === 'prof' || isAdminRole;

    if (topProf) { topProf.hidden = !isProfRole; topProf.setAttribute('aria-hidden', isProfRole ? 'false' : 'true'); topProf.style.display = isProfRole ? 'flex' : 'none'; }
    if (topAdmin) { topAdmin.hidden = !isAdminRole; topAdmin.setAttribute('aria-hidden', isAdminRole ? 'false' : 'true'); topAdmin.style.display = isAdminRole ? 'flex' : 'none'; }

    // Anciennes cartes rapides masquées : l'accès se fait désormais par la topbar.
    if (quickProf) quickProf.style.display = 'none';
    if (quickAdmin) quickAdmin.style.display = 'none';

    if (bottomNav) {
      bottomNav.classList.remove('fts-nav-3', 'fts-nav-4', 'fts-nav-5');
      bottomNav.classList.add(isAdminRole ? 'fts-nav-5' : isProfRole ? 'fts-nav-4' : 'fts-nav-3');
    }
  } catch (err) {
    console.warn('[FTS] updateRoleNavigation:', err);
  }
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

      const role = String(userProfile && userProfile.role || '').toLowerCase();
      const status = String(userProfile && userProfile.status || '').toLowerCase();
      const isAdminAccount = role === 'admin' || String(user.email || '').toLowerCase() === 'contact@faistonshow.fr';

      if (!userProfile) {
        // Profil absent : session invalide → déconnexion propre.
        await auth.signOut();
        window.location.href = 'auth.html';
        return;
      }

      if (status === 'pending' && !isAdminAccount) {
        // Compte en attente → retour auth.
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
      initMemberGamificationBadge(user.uid, userProfile, user.email);

      // Liens topbar selon rôle — strict, sans toucher à l'auth.
      updateRoleNavigation(userProfile, user.email);

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
      const loading = document.getElementById('auth-loading');
      if (loading) {
        loading.innerHTML = `
          <div class="auth-loading-logo">Erreur</div>
          <div class="auth-loading-sub">Impossible de charger ton espace. Recharge la page ou réessaie la connexion.</div>
          <button class="btn btn-sm" type="button" onclick="location.reload()">Recharger</button>
          <button class="btn-outline" type="button" onclick="firebase.auth().signOut().then(function(){ location.href='auth.html'; })">Se reconnecter</button>
        `;
      }
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


/* ── BADGE PUBLIC MEMBRE / GAMIFICATION ───────────────────────── */
let memberBadgeUserRef = null;
let memberBadgeArtistRef = null;
let memberForumUser = null;
let memberArtistOfWeek = null;

function formatRewardUntil(until){
  const ts = Number(until || 0);
  if(!ts) return '';
  try {
    return new Date(ts).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' });
  } catch(e) { return ''; }
}

function renderAccountRewardsPanel(){
  if(!window.FTSGamification) return;
  const badgeEl = document.getElementById('account-current-badge');
  const metaEl = document.getElementById('account-rewards-meta');
  const postsEl = document.getElementById('account-stat-posts');
  const reactsEl = document.getElementById('account-stat-reactions');
  const source = Object.assign({ uid: (currentUid || (firebase.auth().currentUser && firebase.auth().currentUser.uid)), xp:0, stats:{} }, memberForumUser || {});
  const badge = FTSGamification.getPublicBadge(source, memberArtistOfWeek);
  if(badgeEl) badgeEl.innerHTML = FTSGamification.renderBadge(badge.label, badge.kind);
  if(metaEl){
    let msg = 'Ton badge est affiché dans le forum quand tu participes.';
    const until = (badge.kind === 'artist' && memberArtistOfWeek && memberArtistOfWeek.uid === source.uid)
      ? memberArtistOfWeek.until
      : (source.specialBadge && source.specialBadge.until);
    if(badge.kind === 'artist') msg = 'Statut temporaire : Artiste de la semaine' + (formatRewardUntil(until) ? ' jusqu’au ' + formatRewardUntil(until) : '') + '.';
    else if(badge.kind === 'rare') msg = 'Badge temporaire attribué par l’équipe' + (formatRewardUntil(until) ? ' jusqu’au ' + formatRewardUntil(until) : '') + '.';
    metaEl.textContent = msg;
  }
  const stats = source.stats || {};
  if(postsEl) postsEl.textContent = Number(stats.forum_post || stats.forumPosts || 0);
  if(reactsEl) reactsEl.textContent = Number(stats.reaction_received || stats.reactionsReceived || 0);
}

function renderMemberPublicBadge(){
  const el = document.getElementById('member-public-badge');
  if(!el || !window.FTSGamification) return;
  const source = Object.assign({ uid: (currentUid || (firebase.auth().currentUser && firebase.auth().currentUser.uid)), xp:0 }, memberForumUser || {});
  const badge = FTSGamification.getPublicBadge(source, memberArtistOfWeek);
  el.innerHTML = FTSGamification.renderBadge(badge.label, badge.kind);
  el.classList.remove('is-empty');
  renderAccountRewardsPanel();
}

function initMemberGamificationBadge(memberUid, profile, email){
  const el = document.getElementById('member-public-badge');
  if(!el || !memberUid || !window.FTSGamification || !db) return;
  el.innerHTML = FTSGamification.renderBadge('🌱 Nouveau talent', 'xp');

  // Hydrate doucement le profil forum utilisé pour afficher les badges publics.
  // Update non bloquant : n'empêche jamais l'ouverture de membres.
  const publicName = (profile && (profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(' '))) || email || 'Membre';
  db.ref('fts_forum/users/' + memberUid).update({
    uid: memberUid,
    name: publicName,
    role: (profile && profile.role) || 'member',
    updatedAt: Date.now()
  }).catch(()=>{});

  if(memberBadgeUserRef) memberBadgeUserRef.off();
  if(memberBadgeArtistRef) memberBadgeArtistRef.off();

  memberBadgeUserRef = db.ref('fts_forum/users/' + memberUid);
  memberBadgeUserRef.on('value', snap => {
    memberForumUser = Object.assign({ uid:memberUid, name:publicName, xp:0 }, snap.val() || {});
    renderMemberPublicBadge();
  });

  // Artiste de la semaine : chemin officiel unique.
  // Important : ne pas réécouter l'ancien chemin fts_forum/artistOfWeek,
  // sinon on risque un affichage incohérent ou une écoute non nettoyée.
  memberBadgeArtistRef = db.ref('fts_community/artistOfWeek');
  memberBadgeArtistRef.on('value', snap => {
    memberArtistOfWeek = snap.val() || null;
    renderMemberPublicBadge();
  }, ()=>{});
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

function readSeenNewsLocal() {
  try {
    const raw = localStorage.getItem(seenNewsStorageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch(e) { return {}; }
}

function getSeenNewsMap() {
  if (seenNewsCache && typeof seenNewsCache === 'object') return seenNewsCache;
  seenNewsCache = readSeenNewsLocal();
  return seenNewsCache;
}

function saveSeenNewsMap(map) {
  seenNewsCache = map && typeof map === 'object' ? map : {};
  try { localStorage.setItem(seenNewsStorageKey(), JSON.stringify(seenNewsCache)); } catch(e) {}
}

function encodeSeenNewsFirebaseKey(id) {
  try {
    return btoa(unescape(encodeURIComponent(String(id || ''))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  } catch(e) {
    return String(id || '').replace(/[.#$\[\]\/]/g, '_').slice(0, 160);
  }
}

async function loadSeenNewsMap() {
  if (seenNewsLoaded) return getSeenNewsMap();
  seenNewsLoaded = true;

  const localMap = readSeenNewsLocal();
  const merged = { ...localMap };

  if (db && currentUid) {
    try {
      const snap = await db.ref('fts_users/' + currentUid + '/seenNews').once('value');
      const remote = snap.val() || {};
      Object.values(remote).forEach(v => {
        if (v && v.id) merged[v.id] = true;
      });
    } catch(e) {
      // Si les règles Firebase refusent l'accès, le localStorage reste la source de secours.
    }
  }

  saveSeenNewsMap(merged);
  return merged;
}

function memberNewsCountStorageKey() {
  return 'fts_member_news_count_' + (currentUid || 'anonymous');
}

function saveMemberNewsCount(count) {
  try { localStorage.setItem(memberNewsCountStorageKey(), String(Math.max(0, Number(count || 0)))); } catch(e) {}
  // Le badge de la topbar est désormais réservé aux messages non lus.
}

function newsItemId(item) {
  if (!item) return '';
  const type = String(item.type || 'item').trim();
  const key = String(item.key || '').trim();

  // IDs volontairement stables : une nouveauté consultée ne doit pas réapparaître
  // au rafraîchissement simplement parce qu'un timestamp ou un libellé a changé.
  if (type === 'resource' && key) return 'resource|' + key;
  if (type === 'event' && key) return 'event|' + key;
  if (type === 'announcement') return 'announcement|current|' + String(item.ts || '0').trim();
  if (type === 'messages') return 'messages|unread';

  const base = key || item.action || item.title || '';
  return [type, base].map(v => String(v || '').trim()).join('|');
}

function isNewsSeen(itemOrId) {
  const id = typeof itemOrId === 'string' ? itemOrId : newsItemId(itemOrId);
  if (!id) return false;
  const val = getSeenNewsMap()[id];
  return val === true || Number(val || 0) > 0;
}

function markNewsSeen(itemOrId) {
  const id = typeof itemOrId === 'string' ? itemOrId : newsItemId(itemOrId);
  if (!id) return;
  const map = getSeenNewsMap();
  map[id] = Date.now();
  saveSeenNewsMap(map);

  // Double sauvegarde non bloquante : localStorage pour l'immédiat, Firebase pour
  // survivre aux rafraîchissements/cache/PWA quand les règles l'autorisent.
  if (db && currentUid) {
    const safeKey = encodeSeenNewsFirebaseKey(id);
    db.ref('fts_users/' + currentUid + '/seenNews/' + safeKey)
      .set({ id, seenAt: Date.now() })
      .catch(() => {});
  }
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

async function getPrivateUnreadMessageCount(uid) {
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
    console.warn('[FTS] Compteur messages privés indisponible :', e);
    return 0;
  }
}

async function getVisibleForumChannelsForProfile() {
  const channels = ['general'];
  const isAdmin = profileIsAdmin();
  const groups = userDisciplines().map(FTS.norm);
  const subs = userSubgroups().map(FTS.norm);
  try {
    const structure = FTS.getCategoryStructureAsync
      ? await FTS.getCategoryStructureAsync(db)
      : (FTS.getCategoryStructure ? FTS.getCategoryStructure() : C.categories);
    (structure || []).forEach(cat => {
      const catName = cat.name || cat.category || '';
      const catNorm = FTS.norm(catName);
      if (isAdmin || groups.includes(catNorm)) channels.push(catNorm);
      (cat.subs || cat.subcats || []).forEach(sub => {
        const subName = typeof sub === 'string' ? sub : (sub && (sub.name || sub.label));
        const subNorm = FTS.norm(subName);
        if (isAdmin || subs.includes(subNorm)) channels.push(subNorm);
      });
    });
  } catch(e) {
    groups.forEach(g => channels.push(g));
    subs.forEach(s => channels.push(s));
  }
  return [...new Set(channels.filter(Boolean))];
}

async function getForumUnreadMessageCount(uid) {
  if (!uid) return 0;
  try {
    const channels = await getVisibleForumChannelsForProfile();
    const readsSnap = await db.ref('fts_users/' + uid + '/forumReads').once('value');
    const reads = readsSnap.val() || {};
    let total = 0;
    await Promise.all(channels.map(ch => {
      const lastRead = Number((reads[ch] && reads[ch].ts) || reads[ch] || 0);
      if (!lastRead) return Promise.resolve();
      return db.ref('fts_forum/messages/' + ch).orderByChild('ts').startAt(lastRead + 1).limitToLast(50).once('value')
        .then(snap => {
          snap.forEach(child => {
            const msg = child.val() || {};
            if (msg.uid && msg.uid === uid) return;
            total += 1;
          });
        }).catch(() => {});
    }));
    return total;
  } catch(e) {
    console.warn('[FTS] Compteur forum indisponible :', e);
    return 0;
  }
}

async function getUnreadMessageCount(uid) {
  const [dm, forum] = await Promise.all([
    getPrivateUnreadMessageCount(uid),
    getForumUnreadMessageCount(uid)
  ]);
  return Number(dm || 0) + Number(forum || 0);
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
  if (!canSeeAnnouncement(a)) return [];
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

async function collectUnreadPollItems(uid) {
  if (!uid) return [];
  const snap = await db.ref('fts_poll_unread/' + uid).once('value');
  const unread = snap.val() || {};
  const ids = Object.keys(unread).filter(Boolean).slice(0, 8);
  if (!ids.length) return [];

  const polls = await Promise.all(ids.map(async id => {
    try {
      const pollSnap = await db.ref('fts_polls/' + id).once('value');
      const p = pollSnap.val() || {};
      const title = p.title || p.titre || p.question || 'Sondage à répondre';
      const end = p.endDate || p.endsAt || p.deadline || '';
      return {
        type: 'poll',
        icon: '📊',
        title,
        meta: end ? ('Réponse attendue · fin ' + end) : 'Réponse attendue',
        ts: Number((unread[id] && unread[id].ts) || p.createdAt || p.ts || Date.now()),
        action: 'polls',
        key: id,
        skipSeenFilter: true
      };
    } catch(e) {
      return {
        type: 'poll',
        icon: '📊',
        title: 'Sondage à répondre',
        meta: 'Réponse attendue',
        ts: Date.now(),
        action: 'polls',
        key: id,
        skipSeenFilter: true
      };
    }
  }));
  return polls.filter(Boolean);
}

async function loadMemberNews() {
  const panel = document.getElementById('member-news-panel');
  const list = document.getElementById('member-news-list');
  const hint = document.getElementById('member-news-hint');
  if (!panel || !list || !currentUid) return;

  const now = Date.now();
  const sinceTs = recentNewsSince();

  try {
    await loadSeenNewsMap();

    const [resources, events, announcement, unread, polls] = await Promise.all([
      collectNewResources(sinceTs).catch(() => []),
      collectNewEvents(sinceTs).catch(() => []),
      collectNewAnnouncement(sinceTs).catch(() => []),
      getUnreadMessageCount(currentUid),
      collectUnreadPollItems(currentUid).catch(() => [])
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
    items.push(...(polls || []), ...resources, ...events, ...announcement);

    const unique = [];
    const seenIds = new Set();
    items.sort((a,b) => Number(b.ts || 0) - Number(a.ts || 0)).forEach(item => {
      const id = newsItemId(item);
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      if (!item.skipSeenFilter && isNewsSeen(id)) return;
      unique.push({ ...item, newsId: id });
    });

    renderMemberNews(unique.slice(0, 6), false);
    if (hint) hint.textContent = unique.length ? 'Actions prioritaires' : 'Tout est à jour';
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
    panel.classList.remove('u-initial-hidden');
    panel.style.display = 'block';
    const title = panel.querySelector('.smart-section-head h2');
    if (title) title.textContent = 'À faire maintenant';
    const hint = document.getElementById('member-news-hint');
    if (hint) hint.textContent = 'Tout est à jour';
    list.innerHTML = `
      <div class="empty-state-card empty-state-card--success">
        <strong>Tout est à jour 🎉</strong>
        <span>Aucun message, sondage ou document important à traiter pour le moment.</span>
      </div>`;
    return;
  }

  panel.classList.remove('u-initial-hidden');
  panel.style.display = 'block';
  saveMemberNewsCount(items.length);
  const title = panel.querySelector('.smart-section-head h2');
  if (title) title.textContent = 'À faire maintenant';

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
      renderMemberNews([]);
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
  if (action === 'polls') {
    window.location.href = 'sondages.html';
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

  const card = title.closest ? title.closest('.focus-card') : null;
  if (!events || !events.length) {
    title.textContent = 'Aucun événement';
    date.textContent  = 'Pour le moment';
    if (card) card.classList.remove('has-action');
    return;
  }

  const e = events[0];
  title.textContent = e.n || 'Événement';
  date.textContent  = `${e.d || ''}${e.h ? ' · ' + e.h : ''}`;
  if (card) card.classList.add('has-action');
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

function resourceDownloadUrl(url) {
  if (!url) return '';
  if (url.includes('/upload/') && !url.includes('/fl_attachment')) {
    return url.replace('/upload/', '/upload/fl_attachment/');
  }
  return url;
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
    const safeUrl = FTS.esc(d.url);
    const dlUrl = FTS.esc(resourceDownloadUrl(d.url));
    const title = FTS.esc(d.name || 'Document');
    return `<div class="doc-file-row" id="doc-${FTS.esc(d.key || '')}" data-doc-key="${FTS.esc(d.key || '')}">
              <a href="${safeUrl}" target="_blank" rel="noopener" class="doc-link">
                <span class="doc-icon">${icon}</span>
                <span class="doc-name">
                  ${title}
                  ${d.sub ? `<span class="doc-sub">— ${FTS.esc(d.sub)}</span>` : ''}
                </span>
              </a>
              <a class="doc-download" href="${dlUrl}" target="_blank" rel="noopener" download aria-label="Télécharger ${title}">⬇ Télécharger</a>
            </div>`;
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
function announcementTargets(a) {
  const cats = normList(a && (a.targetCategories || a.categories || a.groups));
  const subs = normList(a && (a.targetSubgroups || a.targetSubcategories || a.subgroups || a.subcategories));
  const groups = {};
  if (a && a.targetGroups && typeof a.targetGroups === 'object' && !Array.isArray(a.targetGroups)) {
    Object.entries(a.targetGroups).forEach(([cat, list]) => {
      if (!cat) return;
      groups[cat] = normList(list);
    });
  } else {
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

function canSeeAnnouncement(a) {
  if (!a || a.active === false || a.status === 'inactive') return false;
  if (profileIsAdmin()) return true;
  const t = announcementTargets(a);
  if (!t.cats.length && !t.subs.length && !Object.keys(t.groups).length) return true;
  const myCats = userDisciplines().map(FTS.norm);
  const mySubs = userSubgroups().map(FTS.norm);
  for (const [cat, subs] of Object.entries(t.groups)) {
    const catOk = myCats.includes(FTS.norm(cat));
    const cleanSubs = normList(subs);
    if (catOk && !cleanSubs.length) return true;
    if (catOk && cleanSubs.some(sub => mySubs.includes(FTS.norm(sub)))) return true;
  }
  if (!Object.keys(t.groups).length) {
    if (t.cats.length && !t.subs.length) return t.cats.some(c => myCats.includes(FTS.norm(c)));
    if (t.subs.length) return t.subs.some(sub => mySubs.includes(FTS.norm(sub)));
  }
  return false;
}

function announcementSeenId(a) {
  const ts = itemTs(a) || Date.now();
  return 'announcement|current|' + String(ts);
}

function hideAlertTicker() {
  const ticker = document.getElementById('fts-alert-ticker');
  if (ticker) {
    ticker.classList.add('u-initial-hidden');
    ticker.style.display = 'none';
  }
}

function renderAlertTicker(a, id) {
  const ticker = document.getElementById('fts-alert-ticker');
  const text = document.getElementById('fts-alert-text');
  const btn = document.getElementById('fts-alert-read');
  if (!ticker || !text) return;
  if (isNewsSeen(id)) { hideAlertTicker(); return; }
  const title = a.title || a.titre || 'Annonce importante';
  const body = a.body || a.text || a.texte || '';
  const label = [title, body].filter(Boolean).join(' — ');
  text.textContent = label;
  ticker.dataset.announcementId = id;
  ticker.classList.remove('u-initial-hidden');
  ticker.style.display = 'flex';
  if (btn && !btn.__ftsAlertBound) {
    btn.__ftsAlertBound = true;
    btn.addEventListener('click', function(){
      const currentId = ticker.dataset.announcementId || id;
      markNewsSeen(currentId);
      hideAlertTicker();
      loadMemberNews();
    });
  }
}

async function loadAnnonce() {
  const el = document.getElementById('annonce-dyn');
  const panel = document.getElementById('priority-panel');

  try {
    const snap = await db.ref('fts_content/annonces/current').once('value');
    const a = snap.val() || {};
    if (!canSeeAnnouncement(a)) {
      if (panel) panel.classList.add('u-initial-hidden');
      hideAlertTicker();
      return;
    }

    const title = a.title || a.titre || '';
    const body  = a.body || a.text || a.texte || '';
    const btn   = a.buttonText || a.btn || '';
    const url   = a.buttonUrl || a.url || '';
    const mode  = a.displayMode || a.mode || 'panel';
    const seenId = announcementSeenId(a);

    if (!title && !body) return;

    if (mode === 'banner' || mode === 'both') renderAlertTicker(a, seenId);
    else hideAlertTicker();

    if (mode !== 'banner' && el) {
      el.innerHTML = `
        ${title ? `<strong>${FTS.esc(title)}</strong><br>` : ''}
        ${body ? FTS.esc(body).replace(/\n/g, '<br>') : ''}
        ${btn && url ? `<br><a href="${FTS.esc(url)}" class="evt-link evt-action-link">${FTS.esc(btn)}</a>` : ''}
        <div class="annonce-actions"><button type="button" class="annonce-read-btn" id="annonce-read-btn">J’ai lu</button></div>
      `;
      if (panel) {
        panel.classList.remove('u-initial-hidden');
        panel.style.display = 'block';
      }
      const readBtn = document.getElementById('annonce-read-btn');
      if (readBtn) readBtn.addEventListener('click', function(){
        markNewsSeen(seenId);
        if (panel) panel.style.display = 'none';
        hideAlertTicker();
        loadMemberNews();
      });
    } else if (panel) {
      panel.classList.add('u-initial-hidden');
      panel.style.display = 'none';
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
  const dash = document.getElementById('dash-msg-count');
  const status = document.getElementById('dash-msg-status');
  const card = dash ? dash.closest('.focus-card') : null;
  if (dash) dash.textContent = count > 99 ? '99+' : String(count);
  if (status) status.textContent = count > 0 ? (count === 1 ? '1 message à lire' : count + ' messages à lire') : 'Rien à lire';
  if (card) card.classList.toggle('has-action', count > 0);

  if (window.FTSNav && typeof window.FTSNav.setBadge === 'function') {
    window.FTSNav.setBadge('fts-member-badge', latestUnreadMessages);
  }

  if (!el) return;
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

  // On ouvre d'abord la modale : les panneaux secondaires ne doivent jamais bloquer le clic.
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');

  try { clearAccountMsg('account-pwd-msg'); } catch(e) {}
  try { clearAccountMsg('profile-msg'); } catch(e) {}
  try { fillAccountIdentity(); } catch(e) { console.warn('[FTS] Mon compte identité non chargée :', e); }
  try { renderAccountRewardsPanel(); } catch(e) { console.warn('[FTS] Mon compte récompenses non chargées :', e); }
  try { checkNotifStatus(); } catch(e) { console.warn('[FTS] Mon compte notifications non chargées :', e); }

  const p1 = document.getElementById('account-new-pwd');
  const p2 = document.getElementById('account-new-pwd2');
  if (p1) p1.value = '';
  if (p2) p2.value = '';

  // Pré-remplir le profil
  const tel = document.getElementById('profile-tel');
  if (tel) tel.value = (userProfile && userProfile.telephone) || '';
  try { renderProfileEnfants(); } catch(e) { console.warn('[FTS] Mon compte enfants non chargés :', e); }
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

function openGuideModal() {
  const m = document.getElementById('guide-modal');
  if (!m) return;
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
}

function closeGuideModal() {
  const m = document.getElementById('guide-modal');
  if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
}

function handleGuideAction(action) {
  if (!action) return;
  if (action === 'docs') {
    closeGuideModal();
    if (window.FTSNav && typeof window.FTSNav.openDocumentsModal === 'function') {
      window.FTSNav.openDocumentsModal();
    }
    return;
  }
  if (action === 'events') {
    closeGuideModal();
    const target = document.getElementById('membres-events');
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (action === 'account') {
    closeGuideModal();
    openAccountModal();
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

  // Sécurité UX : Mon compte doit toujours s'ouvrir, même si un style/badge se superpose.
  // Capture + délégation pour éviter qu'un autre listener ne bloque le bouton.
  document.addEventListener('click', function(e) {
    const openAccountBtn = e.target.closest('#btn-open-account, [data-action="open-account-modal"]');
    if (!openAccountBtn) return;
    e.preventDefault();
    e.stopPropagation();
    openAccountModal();
  }, true);

  bindClick('btn-open-account', openAccountModal);
  bindClick('btn-open-guide', openGuideModal);
  bindClick('btn-account-guide', function(){ closeAccountModal(); openGuideModal(); });
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

    if (e.target && e.target.id === 'guide-modal') {
      closeGuideModal();
      return;
    }

    const closeGuideBtn = e.target.closest('[data-action="close-guide-modal"]');
    if (closeGuideBtn) {
      closeGuideModal();
      return;
    }

    const guideAction = e.target.closest('[data-guide-action]');
    if (guideAction) {
      handleGuideAction(guideAction.dataset.guideAction);
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

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeGuideModal();
      closeAccountModal();
      closeMo();
      closePwaInstallCoach();
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


/* ── SONDAGES : compteur tableau de bord ─────────────────────── */
(function(){
  function renderPollDash(n){
    var count = document.getElementById('dash-poll-count');
    var status = document.getElementById('dash-poll-status');
    if (!count || !status) return;
    n = Math.max(0, Number(n || 0));
    count.textContent = n ? String(n) : '0';
    status.textContent = n ? (n + ' réponse' + (n > 1 ? 's' : '') + ' attendue' + (n > 1 ? 's' : '')) : 'Aucune réponse attendue';
    var card = count.closest ? count.closest('.focus-card') : null;
    if (card) card.classList.toggle('has-action', n > 0);
  }
  function start(uid){
    try {
      var db = window.FTS && FTS.initFirebase ? FTS.initFirebase() : (firebase && firebase.database ? firebase.database() : null);
      if (!db || !uid) return;
      db.ref('fts_poll_unread/' + uid).on('value', function(snap){
        renderPollDash(snap.exists() ? Object.keys(snap.val() || {}).length : 0);
      });
    } catch(e) {}
  }
  if (window.firebase && firebase.auth) firebase.auth().onAuthStateChanged(function(user){ if(user) start(user.uid); });
})();
