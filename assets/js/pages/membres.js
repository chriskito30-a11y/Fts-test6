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
let accountSchedules = {};
let accountReminderSaving = false;
let currentUid = null;
let pendingResourceOpen = null;
let latestUnreadMessages = 0;
let seenNewsCache = null;
let seenNewsLoaded = false;
let memberSchedules = {};
let nextCourseTimer = null;
let nextCourseUnsubscribe = null;

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


function awardMemberDailyLoginXp(memberUid) {
  // XP de connexion invisible. Max 1/jour dans FTSGamification, donc aucun risque si le forum l'appelle aussi.
  try {
    if (!memberUid || !db || !window.FTSGamification || !FTSGamification.awardXp) return;
    FTSGamification.awardXp(db, memberUid, 'daily_login', 5, { maxPerDay:1 }).catch(() => {});
  } catch(e) {}
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
      initFirstStepsOnboarding(user.uid, userProfile);

      // Nom d'affichage
      document.getElementById('user-display-name').textContent =
        userProfile.firstName || userProfile.name || user.email;

      await loadCategories();
      renderDashboard(userProfile, user.email);
      initMemberGamificationBadge(user.uid, userProfile, user.email);
      awardMemberDailyLoginXp(user.uid);

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
      initNextCoursePanel(user.uid);
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


/* ── PLANNING MEMBRE : MON PROCHAIN COURS / RDV ────────────────
   Source : fts_schedules. Les rappels restent séparés.
   Le membre voit le prochain créneau qui le concerne, puis les suivants. */
function scheduleTargetValues(s){
  const cat = String(s && (s.targetCategory || s.category || '') || '').trim();
  const sub = String(s && (s.targetSubcategory || s.subcategory || '') || '').trim();
  const groups = {};
  if (cat) groups[cat] = sub ? [sub] : [];
  return {
    cats: cat ? [cat] : [],
    subs: sub ? [sub] : [],
    groups
  };
}

function canSeeSchedule(s){
  if (!s || s.active === false) return false;
  const kind = String(s.kind || '').trim();
  if (kind === 'music_individual' || s.uid) {
    return profileIsAdmin() || String(s.uid || '') === String(currentUid || '');
  }
  if (profileIsAdmin()) return true;
  const t = scheduleTargetValues(s);
  if (!t.cats.length && !t.subs.length && !Object.keys(t.groups).length) return true;
  const myCats = userDisciplines().map(FTS.norm);
  const mySubs = userSubgroups().map(FTS.norm);
  for (const [cat, subs] of Object.entries(t.groups)) {
    const catOk = myCats.includes(FTS.norm(cat));
    const cleanSubs = normList(subs);
    if (catOk && !cleanSubs.length) return true;
    if (catOk && cleanSubs.some(sub => mySubs.includes(FTS.norm(sub)))) return true;
  }
  return false;
}

function scheduleDateKey(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function defaultScheduleUntil(startAt){
  const now = new Date();
  // Fin de saison logique : 30 juin. Si elle est passée, on prend celle de l'année suivante.
  let year = now.getFullYear();
  let until = new Date(year, 5, 30, 23, 59, 59, 999).getTime();
  if (until < Date.now()) until = new Date(year + 1, 5, 30, 23, 59, 59, 999).getTime();
  // Garde-fou : jamais plus de 18 mois de calcul côté mobile.
  const max = Date.now() + 18 * 31 * 24 * 60 * 60 * 1000;
  return Math.min(until, max);
}

function addScheduleDays(ts, days){
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function nextOccurrenceForSchedule(s, nowTs){
  if (!s || s.active === false) return null;
  const duration = Math.max(5, Number(s.durationMinutes || 30) || 30);
  const mode = String(s.recurrenceMode || 'single');
  const excluded = new Set(Array.isArray(s.excludedDates) ? s.excludedDates : []);
  let candidates = [];

  if (mode === 'manual') {
    candidates = (Array.isArray(s.manualDates) ? s.manualDates : [])
      .map(Number)
      .filter(Boolean);
  } else if (mode === 'weekly' || mode === 'biweekly' || mode === 'triweekly') {
    const startAt = Number(s.startAt || 0);
    if (!startAt) return null;
    const step = mode === 'weekly' ? 7 : (mode === 'biweekly' ? 14 : 21);
    const until = Number(s.repeatUntil || 0) || defaultScheduleUntil(startAt);
    let cur = startAt;
    let guard = 0;
    // Avance vite si le créneau est très ancien.
    while (cur + duration * 60000 < nowTs && guard < 260) {
      cur = addScheduleDays(cur, step);
      guard++;
    }
    while (cur <= until && guard < 300) {
      candidates.push(cur);
      cur = addScheduleDays(cur, step);
      guard++;
      if (candidates.length >= 8) break;
    }
  } else {
    const startAt = Number(s.startAt || 0);
    if (startAt) candidates = [startAt];
  }

  const future = candidates
    .filter(ts => ts && !excluded.has(scheduleDateKey(ts)))
    .map(ts => ({
      startAt: ts,
      endAt: ts + duration * 60000,
      durationMinutes: duration,
      schedule: s
    }))
    .filter(o => o.endAt >= nowTs)
    .sort((a,b) => a.startAt - b.startAt);

  return future[0] || null;
}

function upcomingMemberOccurrences(limit){
  const nowTs = Date.now();
  return Object.entries(memberSchedules || {})
    .map(([id, s]) => Object.assign({ id }, s || {}))
    .filter(canSeeSchedule)
    .map(s => {
      const occ = nextOccurrenceForSchedule(s, nowTs);
      return occ ? Object.assign(occ, { scheduleId: s.id || occ.schedule.id || '' }) : null;
    })
    .filter(Boolean)
    .sort((a,b) => a.startAt - b.startAt)
    .slice(0, limit || 4);
}

function nextCourseTypeLabel(s){
  const kind = String(s && s.kind || '');
  if (kind === 'music_individual') return 'Cours individuel';
  if (kind === 'exceptional') return 'Rendez-vous';
  return 'Cours / répétition';
}

function nextCourseIcon(s){
  const text = [s && s.lessonType, s && s.title, s && s.targetCategory].join(' ').toLowerCase();
  if (text.includes('guitare') || text.includes('basse') || text.includes('musique')) return '🎸';
  if (text.includes('chant')) return '🎤';
  if (text.includes('danse')) return '💃';
  if (text.includes('theatre') || text.includes('théâtre')) return '🎭';
  if (text.includes('singer')) return '🌟';
  return '📅';
}

function relativeCourseDate(ts, endAt){
  const d = new Date(ts);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startTarget - startToday) / 86400000);
  const time = d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  if (endAt && Date.now() >= ts && Date.now() <= endAt) return 'En cours · jusqu’à ' + new Date(endAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  if (diffDays === 0) return 'Aujourd’hui · ' + time;
  if (diffDays === 1) return 'Demain · ' + time;
  return d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }) + ' · ' + time;
}

function googleCalendarUrlForOccurrence(occ){
  const s = occ.schedule || {};
  const pad = n => String(n).padStart(2, '0');
  function gdate(ts){
    const d = new Date(ts);
    return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+'00Z';
  }
  const title = encodeURIComponent((s.title || s.lessonType || 'Créneau Fais Ton Show') + ' — Fais Ton Show');
  const details = encodeURIComponent('Créneau Fais Ton Show' + (s.teacher ? '\nProf : ' + s.teacher : '') + (s.lessonType ? '\nType : ' + s.lessonType : ''));
  const location = encodeURIComponent(s.place || 'Fais Ton Show');
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + title + '&dates=' + gdate(occ.startAt) + '/' + gdate(occ.endAt) + '&details=' + details + '&location=' + location;
}

function renderNextCoursePanel(){
  const panel = document.getElementById('next-course-panel');
  const card = document.getElementById('next-course-card');
  const status = document.getElementById('next-course-status');
  if (!panel || !card) return;

  const rows = upcomingMemberOccurrences(4);
  if (!rows.length) {
    panel.classList.add('u-initial-hidden');
    panel.style.display = 'none';
    return;
  }
  panel.classList.remove('u-initial-hidden');
  panel.style.display = 'block';
  if (status) status.textContent = 'Mise à jour auto';

  const first = rows[0];
  const s = first.schedule || {};
  const title = s.title || s.lessonType || s.targetSubcategory || s.targetCategory || 'Prochain créneau';
  const metaParts = [nextCourseTypeLabel(s), s.teacher ? 'Prof : ' + s.teacher : '', s.place || '', first.durationMinutes ? first.durationMinutes + ' min' : ''].filter(Boolean);
  const more = rows.slice(1);

  card.innerHTML = `
    <div class="next-course-main">
      <div class="next-course-icon">${nextCourseIcon(s)}</div>
      <div class="next-course-body">
        <div class="next-course-kicker">Prochain rendez-vous</div>
        <div class="next-course-title">${FTS.esc(title)}</div>
        <div class="next-course-time">${FTS.esc(relativeCourseDate(first.startAt, first.endAt))}</div>
        <div class="next-course-meta">${FTS.esc(metaParts.join(' · '))}</div>
      </div>
    </div>
    <div class="next-course-actions">
      <a class="btn-outline btn-sm" href="${googleCalendarUrlForOccurrence(first)}" target="_blank" rel="noopener">Ajouter à Google Calendar</a>
    </div>
    ${more.length ? `<div class="next-course-more">
      <div class="next-course-more-title">Ensuite</div>
      ${more.map(o => {
        const so = o.schedule || {};
        const t = so.title || so.lessonType || so.targetSubcategory || so.targetCategory || 'Créneau';
        return `<div class="next-course-mini"><span>${nextCourseIcon(so)} ${FTS.esc(t)}</span><strong>${FTS.esc(relativeCourseDate(o.startAt, o.endAt))}</strong></div>`;
      }).join('')}
    </div>` : ''}`;
}

function initNextCoursePanel(uid){
  const panel = document.getElementById('next-course-panel');
  if (!panel || !db || !uid) return;
  if (nextCourseUnsubscribe) { try { nextCourseUnsubscribe(); } catch(e){} nextCourseUnsubscribe = null; }
  clearInterval(nextCourseTimer);
  try {
    if (FTS.Services && FTS.Services.Schedules && FTS.Services.Schedules.listenAll) {
      nextCourseUnsubscribe = FTS.Services.Schedules.listenAll(data => {
        memberSchedules = data || {};
        renderNextCoursePanel();
      });
    } else {
      const ref = db.ref('fts_schedules');
      ref.on('value', snap => { memberSchedules = snap.val() || {}; renderNextCoursePanel(); }, () => {
        panel.classList.add('u-initial-hidden');
      });
      nextCourseUnsubscribe = () => ref.off();
    }
    nextCourseTimer = setInterval(renderNextCoursePanel, 60000);
  } catch(e) {
    console.warn('[FTS] Planning membre indisponible :', e);
    panel.classList.add('u-initial-hidden');
  }
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
  if (type === 'announcement') return 'announcement|' + String(item.source || 'current') + '|' + String(key || 'current') + '|' + String(item.ts || '0').trim();
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


function memberForumInitialReadTs() {
  return Number(userProfile && (userProfile.forumBaselineAt || userProfile.createdAt || userProfile.created_at || userProfile.ts || 0)) || 0;
}
function memberForumLastReadTs(reads, channel) {
  const direct = Number((reads[channel] && reads[channel].ts) || reads[channel] || 0) || 0;
  return direct || memberForumInitialReadTs();
}
function shouldCountMemberForumUnreadMessage(msg, uid) {
  if (!msg) return false;
  if (msg.uid && msg.uid === uid && !(msg.system === true || msg.gamification === true || msg.notifyAll === true || msg.type === 'special_badge' || msg.type === 'artist_of_week' || msg.type === 'xp_level')) return false;
  return true;
}

async function getForumUnreadMessageCount(uid) {
  if (!uid) return 0;
  try {
    const channels = await getVisibleForumChannelsForProfile();
    const readsSnap = await db.ref('fts_users/' + uid + '/forumReads').once('value');
    const reads = readsSnap.val() || {};
    let total = 0;
    await Promise.all(channels.map(ch => {
      const lastRead = memberForumLastReadTs(reads, ch);
      if (!lastRead) return Promise.resolve();
      return db.ref('fts_forum/messages/' + ch).orderByChild('ts').startAt(lastRead + 1).limitToLast(50).once('value')
        .then(snap => {
          snap.forEach(child => {
            const msg = child.val() || {};
            if (!shouldCountMemberForumUnreadMessage(msg, uid)) return;
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


function announcementTargetValues(a){
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
function announcementExpired(a){
  const ts = Number(a && (a.expiresAt || a.expireAt || a.endAt || 0));
  return !!ts && ts <= Date.now();
}
function canSeeAnnouncement(a){
  if (!a || a.active === false || a.status === 'inactive' || announcementExpired(a)) return false;
  if (profileIsAdmin()) return true;
  const t = announcementTargetValues(a || {});
  if (!t.cats.length && !t.subs.length && !Object.keys(t.groups).length) return true;
  const myCats = userDisciplines().map(FTS.norm);
  const mySubs = userSubgroups().map(FTS.norm);
  for (const [cat, subs] of Object.entries(t.groups)) {
    const catOk = myCats.includes(FTS.norm(cat));
    const cleanSubs = normList(subs);
    if (catOk && !cleanSubs.length) return true;
    if (catOk && cleanSubs.some(s => mySubs.includes(FTS.norm(s)))) return true;
  }
  if (t.subs.some(s => mySubs.includes(FTS.norm(s)))) return true;
  return false;
}
async function getVisibleAnnouncements(){
  const list=[];
  try {
    const currentSnap = await db.ref('fts_content/annonces/current').once('value');
    const current = currentSnap.val() || {};
    if ((current.title || current.body || current.text) && canSeeAnnouncement(current)) list.push({...current, key:'current', source:'current'});
  } catch(e) { console.warn('[FTS] Annonce générale indisponible :', e); }
  try {
    const targetSnap = await db.ref('fts_content/annonces/targeted').once('value');
    targetSnap.forEach(ch => {
      const a = ch.val() || {};
      if ((a.title || a.body || a.text) && canSeeAnnouncement(a)) list.push({...a, key:ch.key, source:'targeted'});
    });
  } catch(e) { console.warn('[FTS] Annonces ciblées indisponibles :', e); }
  return list.sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0));
}

async function collectNewAnnouncement(sinceTs) {
  const rows = await getVisibleAnnouncements();
  return rows
    .filter(a => isAfterLastVisit(itemTs(a), sinceTs))
    .slice(0, 3)
    .map(a => ({
      type: 'announcement',
      icon: a.source === 'targeted' ? '📣' : '⚠️',
      title: a.title || a.titre || 'Nouvelle annonce importante',
      meta: a.source === 'targeted' ? 'Annonce ciblée' : 'Information importante',
      ts: itemTs(a),
      source: a.source || 'current',
      action: 'announcement',
      key: a.key
    }));
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


let memberNewsRefreshTimer = null;
let memberNewsIsRefreshing = false;
function scheduleMemberNewsRefresh(delay) {
  if (!currentUid) return;
  clearTimeout(memberNewsRefreshTimer);
  memberNewsRefreshTimer = setTimeout(async function(){
    if (memberNewsIsRefreshing) return;
    memberNewsIsRefreshing = true;
    try { await loadMemberNews(); }
    catch(e) { console.warn('[FTS] Rafraîchissement À faire maintenant indisponible :', e); }
    finally { memberNewsIsRefreshing = false; }
  }, Number.isFinite(Number(delay)) ? Number(delay) : 250);
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
    panel.classList.add('u-initial-hidden');
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
          scriptRehearsal: d.scriptRehearsal === true || String(d.scriptRehearsal || '').toLowerCase() === 'true',
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
          scriptRehearsal: d.scriptRehearsal === true || String(d.scriptRehearsal || '').toLowerCase() === 'true',
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

function resourceKindFromDoc(d) {
  const type = String(d.type || '').toLowerCase().trim();
  const url = String(d.url || '').split('?')[0].toLowerCase();
  const ext = url.split('.').pop();
  const value = type || ext || 'doc';
  if (value === 'pdf' || ext === 'pdf') return { cls:'pdf', icon:'📄', label:'PDF' };
  if (['mp3','wav','ogg','aac','m4a','audio'].includes(value) || ['mp3','wav','ogg','aac','m4a'].includes(ext)) return { cls:'audio', icon:'🎵', label:'Audio' };
  if (['mp4','mov','webm','video'].includes(value) || ['mp4','mov','webm'].includes(ext)) return { cls:'video', icon:'🎬', label:'Vidéo' };
  if (['jpg','jpeg','png','gif','webp','image'].includes(value) || ['jpg','jpeg','png','gif','webp'].includes(ext)) return { cls:'image', icon:'🖼️', label:'Image' };
  return { cls:'file', icon:ICONS[type] || '📎', label:'Document' };
}


function resourceOfflineAvailable() {
  return !!(window.FTS && FTS.Offline && typeof FTS.Offline.cacheFile === 'function' && 'caches' in window);
}

function showResourceOfflineMsg(message, isError) {
  if (window.FTS && FTS.Offline && typeof FTS.Offline.showOfflineToast === 'function') {
    FTS.Offline.showOfflineToast(message);
    return;
  }
  if (isError) console.warn('[FTS] Offline ressource :', message);
}

async function refreshResourceOfflineButton(btn) {
  if (!btn || !resourceOfflineAvailable()) return;
  const url = btn.dataset.offlineUrl || '';
  if (!url) return;
  try {
    const saved = await FTS.Offline.hasFile(url);
    btn.dataset.saved = saved ? '1' : '0';
    btn.classList.toggle('is-saved', !!saved);
    btn.textContent = saved ? '✓ Hors ligne' : '⬇ Hors ligne';
    btn.setAttribute('aria-label', saved ? 'Supprimer cette ressource du mode hors ligne' : 'Rendre cette ressource disponible hors ligne');
    btn.title = saved ? 'Déjà disponible sans connexion — clique pour retirer' : 'Télécharger pour consultation hors ligne';
  } catch(e) {}
}

function refreshResourceOfflineButtons(root) {
  if (!resourceOfflineAvailable()) return;
  const scope = root || document;
  scope.querySelectorAll('[data-action="toggle-resource-offline"]').forEach(btn => refreshResourceOfflineButton(btn));
}

async function toggleResourceOffline(btn) {
  if (!btn || !resourceOfflineAvailable()) {
    showResourceOfflineMsg('Mode hors ligne indisponible sur ce navigateur.', true);
    return;
  }
  const url = btn.dataset.offlineUrl || '';
  if (!url) return;
  const wasSaved = btn.dataset.saved === '1';
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.classList.add('is-loading');
  btn.textContent = wasSaved ? 'Retrait…' : 'Téléchargement…';
  try {
    if (wasSaved) {
      await FTS.Offline.removeFile(url);
      showResourceOfflineMsg('Ressource retirée du mode hors ligne.');
    } else {
      await FTS.Offline.cacheFile(url);
      showResourceOfflineMsg('Ressource disponible hors ligne.');
    }
    await refreshResourceOfflineButton(btn);
  } catch(e) {
    btn.textContent = oldText;
    showResourceOfflineMsg('Impossible de préparer cette ressource hors ligne. Vérifie la connexion puis réessaie.', true);
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-loading');
  }
}

/* ── AFFICHAGE DOCUMENTS ─────────────────────────────────────── */
function isTextResourceDoc(d) {
  const type = String((d && d.type) || '').toLowerCase().trim();
  const url = String((d && d.url) || '').trim();
  const hasHttpUrl = /^https?:\/\//i.test(url);
  return !hasHttpUrl || type === 'texte' || type === 'text' || type === 'txt' || type === 'note';
}

function textResourceDocContent(d) {
  return String((d && (d.content || d.contenu || d.url || '')) || '').trim();
}

function findTextResourceDoc(key) {
  const target = String(key || '');
  if (!target) return null;
  const cats = Object.keys(allDocs || {});
  for (const cat of cats) {
    const rows = allDocs[cat] || [];
    const found = rows.find(x => String(x.key || '') === target);
    if (found) return found;
  }
  return null;
}

function openTextResourceDoc(key) {
  const d = findTextResourceDoc(key);
  if (!d) return;
  const overlay = document.getElementById('mo');
  const titleEl = document.getElementById('mtit');
  const bodyEl = document.getElementById('catcnt');
  if (!overlay || !titleEl || !bodyEl) return;
  const title = d.name || 'Document texte';
  const metaParts = [d.cat || d.category || '', d.sub || d.subcat || d.subcategory || ''].filter(Boolean);
  const content = textResourceDocContent(d) || 'Aucun texte à afficher.';
  titleEl.textContent = title;
  bodyEl.innerHTML = `
    <div class="doc-text-reader">
      ${metaParts.length ? `<div class="doc-text-reader-meta">${FTS.esc(metaParts.join(' · '))}</div>` : ''}
      <div class="doc-text-reader-content">${FTS.esc(content).replace(/\n/g, '<br>')}</div>
    </div>`;
  overlay.classList.remove('hidden');
}


function isRehearsalPdfDoc(d) {
  if (!d) return false;
  const type = String(d.type || '').toLowerCase().trim();
  const url = String(d.url || '').split('?')[0].toLowerCase();
  const isPdf = type === 'pdf' || type.includes('pdf') || /\.pdf(?:$|[?#])/i.test(url) || /drive\.google\.com/i.test(String(d.url || ''));
  if (!isPdf) return false;
  const cat = FTS.norm(d.cat || d.category || '');
  const compatibleCat = ['theatre','comedie musicale','singer show','singer academy','chant'].some(key => cat.includes(key));
  const flagged = d.scriptRehearsal === true || String(d.scriptRehearsal || '').toLowerCase() === 'true';
  return compatibleCat && flagged;
}

function repetitionUrlForDoc(d) {
  const key = d && d.key ? String(d.key) : '';
  if (!key) return 'repetition.html';
  return `repetition.html?resource=${encodeURIComponent(key)}&autoload=1`;
}

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

    if (isTextResourceDoc(d)) {
      const title = FTS.esc(d.name || 'Document texte');
      const preview = FTS.esc(textResourceDocContent(d)).replace(/\s+/g, ' ').slice(0, 120);
      return `<button type="button" class="doc-text doc-text-card" id="doc-${FTS.esc(d.key || '')}" data-action="open-text-doc" data-doc-key="${FTS.esc(d.key || '')}">
                <span class="doc-text-card-head"><strong>${title}</strong><em>Lire</em></span>
                ${preview ? `<span class="doc-text-preview">${preview}${preview.length >= 120 ? '…' : ''}</span>` : ''}
              </button>`;
    }

    const kind = resourceKindFromDoc(d);
    const safeUrl = FTS.esc(d.url);
    const dlUrl = FTS.esc(resourceDownloadUrl(d.url));
    const title = FTS.esc(d.name || 'Document');
    const sub = d.sub ? ` · ${FTS.esc(d.sub)}` : '';
    const rehearseAction = isRehearsalPdfDoc(d)
      ? `<a class="doc-rehearse" href="${FTS.esc(repetitionUrlForDoc(d))}" aria-label="Répéter ${title}">🎭 Répéter</a>`
      : '';
    return `<div class="doc-file-row doc-file-row--${FTS.esc(kind.cls)}" id="doc-${FTS.esc(d.key || '')}" data-doc-key="${FTS.esc(d.key || '')}">
              <a href="${safeUrl}" target="_blank" rel="noopener" class="doc-link" aria-label="Ouvrir ${title}">
                <span class="doc-icon" aria-hidden="true">${kind.icon}</span>
                <span class="doc-name">
                  <strong>${title}</strong>
                  <span class="doc-sub">${FTS.esc(kind.label)}${sub}</span>
                </span>
              </a>
              <div class="doc-actions">
                ${rehearseAction}
                <a class="doc-open" href="${safeUrl}" target="_blank" rel="noopener" aria-label="Ouvrir ${title}">Ouvrir</a>
                <a class="doc-download" href="${dlUrl}" target="_blank" rel="noopener" download aria-label="Télécharger ${title}">⬇ Télécharger</a>
                <button type="button" class="doc-offline" data-action="toggle-resource-offline" data-offline-url="${safeUrl}" aria-label="Rendre ${title} disponible hors ligne">⬇ Hors ligne</button>
              </div>
            </div>`;
  }).join('');
  refreshResourceOfflineButtons(el);
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

/* ── ANNONCES DYNAMIQUES ─────────────────────────────────────── */
function announcementSeenId(a) {
  const source = a && a.source ? String(a.source) : 'current';
  const key = a && a.key ? String(a.key) : 'current';
  const ts = itemTs(a) || Number(a && (a.updatedAt || a.createdAt || 0)) || 0;
  return 'announcement|' + source + '|' + key + '|' + String(ts || '0');
}
function announcementDisplayMode(a) {
  const raw = String((a && (a.displayMode || a.display || a.mode)) || 'card').toLowerCase();
  if (raw === 'banner' || raw === 'ticker' || raw === 'banderole') return 'ticker';
  if (raw === 'both' || raw === 'all' || raw === 'carte+banderole') return 'both';
  return 'card';
}
function hideAlertTicker() {
  const ticker = document.getElementById('fts-alert-ticker');
  if (ticker) {
    ticker.classList.add('u-initial-hidden');
    ticker.style.display = 'none';
    ticker.dataset.announcementIds = '';
  }
}
function renderAlertTicker(announcements) {
  const ticker = document.getElementById('fts-alert-ticker');
  const text = document.getElementById('fts-alert-text');
  const btn = document.getElementById('fts-alert-read');
  if (!ticker || !text) return;

  const rows = (announcements || []).filter(a => {
    const id = announcementSeenId(a);
    return id && !isNewsSeen(id);
  });
  if (!rows.length) { hideAlertTicker(); return; }

  text.textContent = rows.map(a => {
    const title = a.title || a.titre || 'Annonce importante';
    const body = a.body || a.text || a.texte || '';
    return [title, body].filter(Boolean).join(' — ');
  }).join('   •   ');
  ticker.dataset.announcementIds = rows.map(announcementSeenId).join('||');
  ticker.classList.remove('u-initial-hidden');
  ticker.style.display = 'flex';

  if (btn && !btn.__ftsAlertBound) {
    btn.__ftsAlertBound = true;
    btn.addEventListener('click', function(){
      const ids = String(ticker.dataset.announcementIds || '').split('||').filter(Boolean);
      ids.forEach(markNewsSeen);
      hideAlertTicker();
      loadAnnonce();
      loadMemberNews();
    });
  }
}
function renderAnnouncementCards(rows) {
  const el = document.getElementById('annonce-dyn');
  const panel = document.getElementById('priority-panel');
  if (!el || !panel) return;

  const cards = (rows || []).filter(Boolean);
  if (!cards.length) {
    panel.classList.add('u-initial-hidden');
    panel.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const unread = cards.filter(a => !isNewsSeen(announcementSeenId(a)));
  const read = cards.filter(a => isNewsSeen(announcementSeenId(a)));
  const ordered = unread.concat(read);

  // UX : quand toutes les annonces sont lues, elles restent consultables,
  // mais le bloc ne doit plus donner une impression d'urgence.
  const kicker = panel.querySelector('.priority-kicker');
  const titleEl = panel.querySelector('.priority-title');
  const icon = panel.querySelector('.priority-icon');
  if (unread.length) {
    if (icon) icon.textContent = '⚠️';
    if (kicker) kicker.textContent = 'Information importante';
    if (titleEl) titleEl.textContent = 'À lire maintenant';
    panel.setAttribute('aria-label', 'Information importante');
  } else {
    if (icon) icon.textContent = '🎉';
    if (kicker) kicker.textContent = 'Annonces consultées';
    if (titleEl) titleEl.textContent = 'Tout est à jour 🎉';
    panel.setAttribute('aria-label', 'Annonces à jour');
  }

  el.innerHTML = ordered.map(a => {
    const id = announcementSeenId(a);
    const isRead = isNewsSeen(id);
    const title = a.title || a.titre || '';
    const body = a.body || a.text || a.texte || '';
    const btn = a.buttonText || a.btn || '';
    const url = a.buttonUrl || a.url || '';
    const badge = a.source === 'targeted' ? 'Annonce ciblée' : 'Information générale';
    const dateLabel = newsLabelDate(itemTs(a));
    return `<div class="annonce-item ${isRead ? 'annonce-item-read' : 'annonce-item-unread'}" data-annonce-id="${FTS.esc(id)}">
      <div class="annonce-card-body">
        <div class="annonce-card-topline">
          <small class="annonce-card-badge">${FTS.esc(badge)}</small>
          ${isRead ? '<small class="annonce-read-state">Déjà lu</small>' : '<small class="annonce-read-state annonce-read-state-new">À lire</small>'}
        </div>
        ${title ? `<strong>${FTS.esc(title)}</strong><br>` : ''}
        ${body ? FTS.esc(body).replace(/\n/g, '<br>') : ''}
        ${dateLabel ? `<div class="annonce-date">${FTS.esc(dateLabel)}</div>` : ''}
        ${btn && url ? `<br><a href="${FTS.esc(url)}" class="evt-link evt-action-link">${FTS.esc(btn)}</a>` : ''}
      </div>
      ${isRead ? '' : `<div class="annonce-actions"><button type="button" class="annonce-read-btn" data-annonce-read="${FTS.esc(id)}">J’ai lu</button></div>`}
    </div>`;
  }).join('');

  el.querySelectorAll('[data-annonce-read]').forEach(button => {
    button.addEventListener('click', function(){
      const id = this.getAttribute('data-annonce-read') || '';
      if (id) markNewsSeen(id);
      loadAnnonce();
      loadMemberNews();
    });
  });

  panel.classList.remove('u-initial-hidden');
  panel.style.display = 'block';
}

async function loadAnnonce() {
  try {
    const visible = await getVisibleAnnouncements();
    const tickerRows = [];
    const cardRows = [];

    visible.forEach(a => {
      const mode = announcementDisplayMode(a);
      const alreadyRead = isNewsSeen(announcementSeenId(a));

      // Non lu : on respecte le mode choisi dans l'admin.
      // Lu : l'annonce reste consultable en carte discrète, même si elle était en banderole seule.
      if (!alreadyRead && (mode === 'ticker' || mode === 'both')) tickerRows.push(a);
      if (mode === 'card' || mode === 'both' || alreadyRead) cardRows.push(a);
    });

    renderAlertTicker(tickerRows);
    renderAnnouncementCards(cardRows);
  } catch(e) {
    console.warn('[FTS] Annonces Firebase indisponibles :', e);
    hideAlertTicker();
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
    try { markFirstStepDone('notifs'); } catch(e) {}
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
let dmUnreadCleanup = null;
function listenUnreadBadge(uid) {
  if (dmUnreadCleanup) { try { dmUnreadCleanup(); } catch(e) {} dmUnreadCleanup = null; }
  if (window.FTS && typeof FTS.listenDmUnreadTotal === 'function') {
    dmUnreadCleanup = FTS.listenDmUnreadTotal(db, uid, function(total){
      updateMsgBadge(total);
      scheduleMemberNewsRefresh(total > 0 ? 250 : 200);
    });
    return;
  }

  db.ref('fts_dm/userConvs/' + uid).on('value', async snap => {
    const convIds = snap.val() ? Object.keys(snap.val()) : [];
    if (!convIds.length) { updateMsgBadge(0); scheduleMemberNewsRefresh(200); return; }
    let total = 0;
    await Promise.all(convIds.map(id => db.ref('fts_dm/conversations/' + id + '/unread/' + uid).once('value').then(s => { total += (s.val() || 0); })));
    updateMsgBadge(total);
    scheduleMemberNewsRefresh(250);
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
  try { fillProfileForm(); } catch(e) { console.warn('[FTS] Mon compte formulaire non chargé :', e); }
  try { renderProfileEnfants(); } catch(e) { console.warn('[FTS] Mon compte enfants non chargés :', e); }
  try { renderAccountReminderSettings(); } catch(e) { console.warn('[FTS] Mon compte rappels non chargés :', e); }
}

let profileNewChildCounter = 0;

function getProfileInputValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function fillProfileForm() {
  const first = document.getElementById('profile-firstname');
  const last = document.getElementById('profile-lastname');
  const tel = document.getElementById('profile-tel');
  if (first) first.value = (userProfile && userProfile.firstName) || '';
  if (last) last.value = (userProfile && userProfile.lastName) || '';
  if (tel) tel.value = (userProfile && userProfile.telephone) || '';
}

function buildProfileChildCard(child, index, opts) {
  const options = opts || {};
  const idx = options.idx || String(index);
  const isNew = !!options.isNew;
  const safeChild = child || {};
  const title = isNew ? 'Nouvel enfant' : `Enfant ${Number(index) + 1}`;
  const removeBtn = isNew
    ? '<button type="button" class="profile-child-remove" data-action="remove-profile-child">Retirer</button>'
    : '<button type="button" class="profile-child-remove is-existing" data-action="remove-profile-child">Supprimer cet enfant</button>';
  const disciplines = Array.isArray(safeChild.disciplines) && safeChild.disciplines.length
    ? `<div class="child-disciplines">Disciplines : ${FTS.esc(safeChild.disciplines.join(', '))}</div>`
    : '<div class="child-disciplines child-disciplines-muted">Groupes et disciplines à définir par l’administration.</div>';

  return `
    <div class="profile-enfant-card" data-profile-child-card data-child-idx="${FTS.esc(idx)}"${isNew ? ' data-child-new="1"' : ''}>
      <div class="profile-enfant-card-title"><span>🎩 ${title}</span>${removeBtn}</div>
      <div class="profile-child-grid">
        <div>
          <label class="account-label">Prénom</label>
          <input class="account-field" type="text" placeholder="Emma" autocomplete="off"
            data-child-field="prenom" value="${FTS.esc(safeChild.prenom || '')}">
        </div>
        <div>
          <label class="account-label">Nom</label>
          <input class="account-field" type="text" placeholder="Dupont" autocomplete="off"
            data-child-field="nom" value="${FTS.esc(safeChild.nom || '')}">
        </div>
      </div>
      <label class="account-label">Date de naissance</label>
      <input class="account-field" type="date" data-child-field="dateNaissance" value="${FTS.esc(safeChild.dateNaissance || '')}">
      <label class="account-label">Téléphone de l’enfant</label>
      <input class="account-field" type="tel" placeholder="Optionnel — 06 12 34 56 78"
        data-child-field="telephone" value="${FTS.esc(safeChild.telephone || '')}">
      ${disciplines}
    </div>`;
}

function renderProfileEnfants() {
  const wrap = document.getElementById('profile-enfants-wrap');
  const list = document.getElementById('profile-enfants-list');
  if (!wrap || !list || !userProfile) return;

  wrap.style.display = 'block';
  profileNewChildCounter = 0;
  const enfants = Array.isArray(userProfile.enfants) ? userProfile.enfants : [];

  if (!enfants.length) {
    list.innerHTML = '<div class="profile-family-empty">Aucun enfant associé pour le moment.</div>';
    return;
  }

  list.innerHTML = enfants.map((e, i) => buildProfileChildCard(e, i, { idx: String(i) })).join('');
}


function reminderNormKey(value){
  if(window.FTS && typeof FTS.norm === 'function') return FTS.norm(value || '');
  return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function makeReminderCourseKey(ownerType, ownerId, category, subcategory){
  return [ownerType || 'self', ownerId || 'self', category || '', subcategory || ''].map(reminderNormKey).join('|');
}
function accountUniqueList(v){
  if(Array.isArray(v)) return [...new Set(v.map(x => String(x || '').trim()).filter(Boolean))];
  if(v && typeof v === 'object') return accountUniqueList(Object.values(v));
  return String(v || '').split(',').map(x => x.trim()).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i);
}
function accountCourseLabel(category, subcategory, fallback){
  return [category, subcategory].filter(Boolean).join(' — ') || fallback || 'Cours';
}
function findAccountCategoryForSub(sub, preferredCats){
  const s = reminderNormKey(sub);
  const preferred = accountUniqueList(preferredCats || []);
  const preferredKeys = preferred.map(reminderNormKey);
  let fallback = '';
  const structure = (typeof cats !== 'undefined' && Array.isArray(cats)) ? cats : [];
  structure.forEach(cat => {
    const name = cat && (cat.name || cat.category || '');
    const subs = cat && (cat.subcats || cat.subs || cat.subcategories || []);
    const arr = Array.isArray(subs) ? subs : Object.values(subs || {});
    if(arr.some(x => reminderNormKey(typeof x === 'string' ? x : (x && (x.name || x.label))) === s)){
      if(!preferredKeys.length || preferredKeys.includes(reminderNormKey(name))) fallback = fallback || name;
    }
  });
  return fallback || preferred[0] || '';
}
function collectAccountCoursesForOwner(owner){
  const cats = accountUniqueList(owner.disciplines || owner.group || owner.groups || owner.categories);
  const subs = accountUniqueList(owner.subgroups || owner.subgroup || owner.subcategories || owner.subcategory);
  const rows = [];
  if(subs.length){
    subs.forEach(sub => {
      const cat = findAccountCategoryForSub(sub, cats);
      rows.push({
        ownerType: owner.ownerType || 'self', ownerId: owner.ownerId || 'self', ownerName: owner.ownerName || '',
        childId: owner.childId || '', childName: owner.childName || '', category: cat, subcategory: sub,
        courseLabel: accountCourseLabel(cat, sub)
      });
    });
  }
  cats.forEach(cat => {
    if(rows.some(r => reminderNormKey(r.category) === reminderNormKey(cat))) return;
    rows.push({ ownerType: owner.ownerType || 'self', ownerId: owner.ownerId || 'self', ownerName: owner.ownerName || '', childId: owner.childId || '', childName: owner.childName || '', category: cat, subcategory: '', courseLabel: cat });
  });
  return rows;
}
function accountCoursesFromProfile(){
  const u = userProfile || {};
  const rows = [];
  const parentName = u.firstName || (u.name ? String(u.name).split(' ')[0] : '') || 'Moi';
  rows.push(...collectAccountCoursesForOwner(Object.assign({}, u, { ownerType:'self', ownerId:'self', ownerName:parentName })));
  (Array.isArray(u.enfants) ? u.enfants : []).forEach((child, idx) => {
    const childId = child.id || ('enfant_' + (idx + 1));
    const childName = child.prenom || child.firstName || child.name || ('Enfant ' + (idx + 1));
    rows.push(...collectAccountCoursesForOwner(Object.assign({}, child, { ownerType:'child', ownerId:childId, childId, childName, ownerName:childName })));
  });
  return rows;
}
function accountCoursesFromSchedules(){
  const rows = [];
  Object.values(accountSchedules || {}).forEach(s => {
    if(!s || s.active === false || s.uid !== currentUid) return;
    const ownerType = s.courseOwnerType || (s.childName ? 'child' : 'self');
    const ownerId = ownerType === 'child' ? (s.childId || s.childName || '') : 'self';
    const category = s.targetCategory || s.category || '';
    const subcategory = s.targetSubcategory || s.subcategory || s.lessonType || '';
    rows.push({
      ownerType, ownerId, ownerName:s.courseOwnerName || s.childName || (userProfile && userProfile.firstName) || 'Moi',
      childId:s.childId || '', childName:s.childName || '', category, subcategory,
      courseLabel:s.courseLabel || accountCourseLabel(category, subcategory, s.title || s.lessonType || 'Cours'),
      scheduleId:s.id || '', scheduleReminder24h:s.reminder24h === true, scheduleReminder1h:s.reminder1h === true
    });
  });
  return rows;
}
function buildAccountReminderRows(){
  const map = new Map();
  accountCoursesFromProfile().concat(accountCoursesFromSchedules()).forEach(row => {
    const ownerId = row.ownerType === 'child' ? (row.childId || row.ownerId || row.ownerName) : 'self';
    const key = makeReminderCourseKey(row.ownerType, ownerId, row.category || row.courseLabel, row.subcategory || '');
    if(!map.has(key)) map.set(key, Object.assign({}, row, { key, ownerId }));
    else map.set(key, Object.assign({}, map.get(key), row, { key, ownerId }));
  });
  return Array.from(map.values()).filter(r => r.courseLabel).sort((a,b)=>String(a.courseLabel).localeCompare(String(b.courseLabel),'fr'));
}
function prefForAccountRow(row){
  const prefs = (userProfile && userProfile.reminderPrefs) || {};
  return Object.assign({ reminder24h: !!row.scheduleReminder24h, reminder1h: !!row.scheduleReminder1h, paused:false }, prefs[row.key] || {});
}
async function loadAccountSchedules(){
  if(!FTS.Services || !FTS.Services.Schedules || !currentUid) return {};
  try{
    const all = await FTS.Services.Schedules.all();
    accountSchedules = all || {};
  }catch(e){ console.warn('[FTS] Mon compte schedules', e); accountSchedules = {}; }
  return accountSchedules;
}
async function renderAccountReminderSettings(){
  const list = document.getElementById('account-reminders-list');
  if(!list || !currentUid) return;
  list.innerHTML = '<div class="profile-family-empty">Chargement des rappels…</div>';
  await loadAccountSchedules();
  const rows = buildAccountReminderRows();
  if(!rows.length){
    list.innerHTML = '<div class="profile-family-empty">Aucun cours trouvé pour le moment. Tu pourras activer les rappels quand tes cours seront ajoutés.</div>';
    return;
  }
  list.innerHTML = rows.map(row => {
    const pref = prefForAccountRow(row);
    const owner = row.ownerType === 'child' ? (row.childName || row.ownerName || 'Enfant') : 'Moi';
    const paused = !!pref.paused;
    return `<article class="account-reminder-card ${paused ? 'is-paused' : ''}" data-reminder-pref-key="${FTS.esc(row.key)}">
      <div class="account-reminder-main">
        <div><strong>${FTS.esc(row.courseLabel)}</strong><small>${row.ownerType === 'child' ? 'Pour ' + FTS.esc(owner) : 'Pour moi'}</small></div>
        <button type="button" class="account-btn account-btn-small" data-account-reminder-action="toggle-pause">${paused ? 'Réactiver' : 'Suspendre'}</button>
      </div>
      <div class="account-reminder-checks">
        <label><input type="checkbox" data-account-reminder-action="toggle-24h" ${pref.reminder24h ? 'checked' : ''} ${paused ? 'disabled' : ''}> 24h avant</label>
        <label><input type="checkbox" data-account-reminder-action="toggle-1h" ${pref.reminder1h ? 'checked' : ''} ${paused ? 'disabled' : ''}> 1h avant</label>
      </div>
      <div class="account-reminder-state">${paused ? '⏸️ Rappels suspendus pour ce cours' : '🔔 Rappels actifs selon tes choix'}</div>
    </article>`;
  }).join('');
}
async function updateAccountReminderPref(key, patch){
  if(!key || !currentUid || accountReminderSaving) return;
  const rows = buildAccountReminderRows();
  const row = rows.find(r => r.key === key);
  if(!row) return;
  const current = prefForAccountRow(row);
  const next = Object.assign({}, current, row, patch || {}, { updatedAt: Date.now() });
  const btnMsg = document.getElementById('account-reminders-msg');
  try{
    accountReminderSaving = true;
    if(btnMsg){ btnMsg.textContent = 'Enregistrement…'; btnMsg.className = 'account-msg'; }
    const nextPrefs = Object.assign({}, userProfile.reminderPrefs || {}, { [key]: next });
    await db.ref('fts_users/' + currentUid).update({ reminderPrefs: nextPrefs });
    userProfile.reminderPrefs = nextPrefs;
    if(btnMsg){ btnMsg.textContent = '✓ Préférences enregistrées.'; btnMsg.className = 'account-msg ok'; }
    renderAccountReminderSettings();
  }catch(e){
    console.warn('[FTS] update reminder prefs', e);
    if(btnMsg){ btnMsg.textContent = 'Erreur lors de la sauvegarde des rappels.'; btnMsg.className = 'account-msg err'; }
  }finally{ accountReminderSaving = false; }
}
function handleAccountReminderClick(target){
  const card = target && target.closest('[data-reminder-pref-key]');
  if(!card) return false;
  const key = card.dataset.reminderPrefKey || '';
  const row = buildAccountReminderRows().find(r => r.key === key);
  if(!row) return true;
  const pref = prefForAccountRow(row);
  const actionEl = target.closest('[data-account-reminder-action]');
  if(!actionEl) return false;
  const action = actionEl.dataset.accountReminderAction;
  if(action === 'toggle-pause') updateAccountReminderPref(key, { paused: !pref.paused });
  if(action === 'toggle-24h') updateAccountReminderPref(key, { reminder24h: !!actionEl.checked, paused:false });
  if(action === 'toggle-1h') updateAccountReminderPref(key, { reminder1h: !!actionEl.checked, paused:false });
  return true;
}

function addProfileChildCard() {
  const wrap = document.getElementById('profile-enfants-wrap');
  const list = document.getElementById('profile-enfants-list');
  if (!wrap || !list) return;
  wrap.style.display = 'block';

  const empty = list.querySelector('.profile-family-empty');
  if (empty) empty.remove();

  profileNewChildCounter += 1;
  const id = 'new_' + profileNewChildCounter;
  list.insertAdjacentHTML('beforeend', buildProfileChildCard({}, 0, { idx: id, isNew: true }));
  const card = list.querySelector(`[data-child-idx="${id}"]`);
  const firstInput = card && card.querySelector('[data-child-field="prenom"]');
  if (firstInput) firstInput.focus();
}

function removeProfileChildCard(btn) {
  const card = btn && btn.closest('[data-profile-child-card]');
  if (!card) return;
  const isNew = card.hasAttribute('data-child-new');
  if (!isNew) {
    const ok = confirm('Supprimer les données de cet enfant de ton profil ? Cette suppression sera enregistrée quand tu cliqueras sur Enregistrer.');
    if (!ok) return;
  }
  card.remove();
  const list = document.getElementById('profile-enfants-list');
  if (list && !list.querySelector('[data-profile-child-card]')) {
    list.innerHTML = '<div class="profile-family-empty">Aucun enfant associé pour le moment.</div>';
  }
  if (!isNew) setAccountMsg('profile-msg', 'Clique sur Enregistrer pour confirmer la suppression de cet enfant.', '');
}

function collectProfileChildren() {
  const existing = Array.isArray(userProfile.enfants) ? userProfile.enfants : [];
  const children = [];
  const cards = Array.from(document.querySelectorAll('[data-profile-child-card]'));

  for (const card of cards) {
    const rawIdx = card.dataset.childIdx;
    const isNew = card.hasAttribute('data-child-new');
    const base = (!isNew && existing[Number(rawIdx)]) ? { ...existing[Number(rawIdx)] } : {};
    const prenom = (card.querySelector('[data-child-field="prenom"]')?.value || '').trim();
    const nom = (card.querySelector('[data-child-field="nom"]')?.value || '').trim();
    const dateNaissance = (card.querySelector('[data-child-field="dateNaissance"]')?.value || '').trim();
    const telephone = (card.querySelector('[data-child-field="telephone"]')?.value || '').trim();

    if (!prenom && !nom && !dateNaissance && !telephone && isNew) continue;
    if (!prenom || !nom) {
      throw new Error('child-name-required');
    }

    children.push({
      ...base,
      id: base.id || ('enfant_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
      prenom,
      nom,
      dateNaissance,
      telephone,
      disciplines: Array.isArray(base.disciplines) ? base.disciplines : [],
      subgroups: Array.isArray(base.subgroups) ? base.subgroups : [],
      subgroup: typeof base.subgroup === 'string' ? base.subgroup : (Array.isArray(base.subgroups) ? base.subgroups.join(', ') : '')
    });
  }

  return children;
}

async function saveProfileInfo() {
  const btn = document.getElementById('btn-save-profile');
  const firstName = getProfileInputValue('profile-firstname');
  const lastName = getProfileInputValue('profile-lastname');
  const tel = getProfileInputValue('profile-tel');

  if (!firstName || !lastName) {
    setAccountMsg('profile-msg', 'Prénom et nom sont nécessaires.', 'err');
    return;
  }

  let enfants = [];
  try {
    enfants = collectProfileChildren();
  } catch(e) {
    if (e && e.message === 'child-name-required') {
      setAccountMsg('profile-msg', 'Pour ajouter un enfant, indique au minimum son prénom et son nom.', 'err');
      return;
    }
    throw e;
  }

  const updates = {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    telephone: tel,
    hasEnfant: enfants.length > 0,
    enfants
  };

  let saved = false;
  try {
    if (btn) btn.disabled = true;
    setAccountMsg('profile-msg', 'Enregistrement…', '');
    await db.ref('fts_users/' + currentUid).update(updates);
    saved = true;
    userProfile = { ...userProfile, ...updates };
  } catch(e) {
    console.warn('[FTS] Sauvegarde profil impossible :', e);
    setAccountMsg('profile-msg', 'Erreur lors de la sauvegarde. Réessaie.', 'err');
    return;
  } finally {
    if (btn) btn.disabled = false;
  }

  if (saved) {
    setAccountMsg('profile-msg', '✓ Profil enregistré.', 'ok');
    try { firstStepsProfile = Object.assign({}, firstStepsProfile || {}, userProfile || {}); markFirstStepDone('profile'); } catch(e) {}
    try { fillAccountIdentity(); } catch(e) { console.warn('[FTS] Rafraîchissement identité impossible :', e); }
    try { renderProfileEnfants(); } catch(e) { console.warn('[FTS] Rafraîchissement enfants impossible :', e); }
    try {
      if (typeof renderDashboard === 'function') {
        renderDashboard(userProfile, firebase.auth().currentUser ? firebase.auth().currentUser.email : '');
      }
    } catch(e) {
      console.warn('[FTS] Rafraîchissement tableau de bord impossible :', e);
    }
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
  if (action === 'messages' || action === 'forum') {
    try { markFirstStepDone('messages'); } catch(e) {}
    return;
  }
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


function getFtsSecretsWorkerBase(){
  return (window.FTS && FTS.SECRETS && FTS.SECRETS.workerUrl) ? String(FTS.SECRETS.workerUrl).replace(/\/$/, '') : 'https://fts-email.gros-christophe.workers.dev';
}

async function getCurrentIdToken(forceRefresh){
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('not-authenticated');
  return user.getIdToken(!!forceRefresh);
}

async function privacyRequest(path, options){
  const token = await getCurrentIdToken(false);
  const res = await fetch(getFtsSecretsWorkerBase() + path, Object.assign({
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + token }
  }, options || {}));
  let data = null;
  try { data = await res.json(); } catch(e) { data = null; }
  if (!res.ok || !data || data.ok === false) {
    const err = new Error((data && data.error) || ('HTTP ' + res.status));
    err.response = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

async function changeAccountEmail(){
  const user = firebase.auth().currentUser;
  const btn = document.getElementById('btn-account-email');
  const input = document.getElementById('account-new-email');
  const nextEmail = input ? String(input.value || '').trim() : '';
  if (!user) { window.location.href = 'auth.html'; return; }
  if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    setAccountMsg('account-email-msg', 'Indique une adresse e-mail valide.', 'err');
    return;
  }
  if (nextEmail.toLowerCase() === String(user.email || '').toLowerCase()) {
    setAccountMsg('account-email-msg', 'Cette adresse est déjà utilisée sur ton compte.', '');
    return;
  }
  try {
    if (btn) btn.disabled = true;
    setAccountMsg('account-email-msg', 'Modification de l’adresse…', '');
    await user.updateEmail(nextEmail);
    await db.ref('fts_users/' + currentUid).update({ email: nextEmail, emailUpdatedAt: Date.now(), privacyLastActionAt: Date.now() });
    userProfile = Object.assign({}, userProfile || {}, { email: nextEmail });
    if (input) input.value = '';
    fillAccountIdentity();
    setAccountMsg('account-email-msg', '✓ Adresse e-mail modifiée.', 'ok');
  } catch(e) {
    console.warn('[FTS RGPD] Email update', e);
    setAccountMsg('account-email-msg', accountFriendlyError(e.code || e.message), 'err');
  } finally { if (btn) btn.disabled = false; }
}

async function collectPrivacyExportData(uid){
  const data = { exportedAt:new Date().toISOString(), uid, source:'Fais Ton Show PWA', profile:null, forumUser:null, notifications:null, pollUnread:null, pollResponses:{}, dm:{ userConvs:null, conversations:{}, messages:{} }, reminders:{ schedules:{}, scheduledReminders:{} } };
  try { data.profile = (await db.ref('fts_users/' + uid).once('value')).val() || null; } catch(e) {}
  try { data.forumUser = (await db.ref('fts_forum/users/' + uid).once('value')).val() || null; } catch(e) {}
  try { data.notifications = (await db.ref('fts_user_notifications/' + uid).once('value')).val() || null; } catch(e) {}
  try { data.pollUnread = (await db.ref('fts_poll_unread/' + uid).once('value')).val() || null; } catch(e) {}
  try {
    const polls = await db.ref('fts_poll_responses').once('value');
    polls.forEach(p => { const v = p.child(uid).val(); if (v) data.pollResponses[p.key] = v; });
  } catch(e) {}
  try {
    data.dm.userConvs = (await db.ref('fts_dm/userConvs/' + uid).once('value')).val() || null;
    const convIds = data.dm.userConvs ? Object.keys(data.dm.userConvs) : [];
    await Promise.all(convIds.map(async id => {
      data.dm.conversations[id] = (await db.ref('fts_dm/conversations/' + id).once('value')).val() || null;
      data.dm.messages[id] = (await db.ref('fts_dm/messages/' + id).once('value')).val() || null;
    }));
  } catch(e) {}
  try {
    const schedules = await db.ref('fts_schedules').once('value');
    schedules.forEach(ch => { const v = ch.val() || {}; if (String(v.uid || '') === String(uid)) data.reminders.schedules[ch.key] = v; });
  } catch(e) {}
  try {
    const reminders = await db.ref('fts_scheduled_reminders').once('value');
    reminders.forEach(ch => { const v = ch.val() || {}; if (String(v.uid || v.targetUid || '') === String(uid)) data.reminders.scheduledReminders[ch.key] = v; });
  } catch(e) {}
  return data;
}

async function exportMyData(){
  const user = firebase.auth().currentUser;
  const btn = document.getElementById('btn-account-export');
  if (!user) { window.location.href = 'auth.html'; return; }
  try {
    if (btn) btn.disabled = true;
    setAccountMsg('account-export-msg', 'Préparation de l’export…', '');
    const data = await collectPrivacyExportData(user.uid);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fais-ton-show-donnees-' + user.uid + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setAccountMsg('account-export-msg', '✓ Export téléchargé.', 'ok');
  } catch(e) {
    console.warn('[FTS RGPD] Export', e);
    setAccountMsg('account-export-msg', 'Export impossible. Réessaie ou contacte l’association.', 'err');
  } finally { if (btn) btn.disabled = false; }
}

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
  // Voie serveur complète si le Worker RGPD est déployé : permet de supprimer les traces UID
  // même dans les nœuds que l'utilisateur ne peut pas écrire lui-même.
  try {
    const res = await privacyRequest('/rgpd/delete-account', { body: JSON.stringify({ confirm:'DELETE_MY_ACCOUNT' }) });
    return res;
  } catch(workerErr) {
    console.warn('[FTS RGPD] Worker indisponible, tentative de nettoyage client limité :', workerErr);
  }

  const updates = {};
  updates['fts_user_notifications/' + uid] = null;
  updates['fts_poll_unread/' + uid] = null;
  updates['fts_forum/users/' + uid] = null;
  updates['fts_dm/userConvs/' + uid] = null;
  updates['fts_privacy_requests/' + uid] = null;

  try {
    const pollSnap = await db.ref('fts_poll_responses').once('value');
    pollSnap.forEach(p => { updates['fts_poll_responses/' + p.key + '/' + uid] = null; });
  } catch(e) { console.warn('[FTS] Nettoyage réponses sondages partiel :', e); }

  try {
    const convSnap = await db.ref('fts_dm/userConvs/' + uid).once('value');
    const convIds = convSnap.val() ? Object.keys(convSnap.val()) : [];
    convIds.forEach(id => {
      updates['fts_dm/conversations/' + id + '/participants/' + uid] = null;
      updates['fts_dm/conversations/' + id + '/unread/' + uid] = null;
    });
  } catch(e) { console.warn('[FTS] Nettoyage conversations partiel :', e); }

  try {
    const schedules = await db.ref('fts_schedules').once('value');
    schedules.forEach(ch => { const v = ch.val() || {}; if (String(v.uid || '') === String(uid)) updates['fts_schedules/' + ch.key] = null; });
  } catch(e) { console.warn('[FTS] Nettoyage plannings partiel :', e); }

  try {
    const reminders = await db.ref('fts_scheduled_reminders').once('value');
    reminders.forEach(ch => { const v = ch.val() || {}; if (String(v.uid || v.targetUid || '') === String(uid)) updates['fts_scheduled_reminders/' + ch.key] = null; });
  } catch(e) { console.warn('[FTS] Nettoyage rappels partiel :', e); }

  updates['fts_users/' + uid] = null;
  await db.ref().update(updates);
  return { ok:true, mode:'client_limited' };
}

async function deleteOwnForumAndDmMessages(uid) {
  const updates = {};
  try {
    const forumSnap = await db.ref('fts_forum/messages').once('value');
    forumSnap.forEach(chSnap => {
      chSnap.forEach(msgSnap => {
        const m = msgSnap.val() || {};
        if (m.uid === uid) updates['fts_forum/messages/' + chSnap.key + '/' + msgSnap.key] = null;
      });
    });
  } catch(e) { console.warn('[FTS] Suppression messages forum partielle :', e); }
  try {
    const convSnap = await db.ref('fts_dm/userConvs/' + uid).once('value');
    const convIds = convSnap.val() ? Object.keys(convSnap.val()) : [];
    for (const id of convIds) {
      const msgSnap = await db.ref('fts_dm/messages/' + id).once('value');
      msgSnap.forEach(mSnap => {
        const m = mSnap.val() || {};
        if (m.senderId === uid) updates['fts_dm/messages/' + id + '/' + mSnap.key] = null;
      });
    }
  } catch(e) { console.warn('[FTS] Suppression messages privés partielle :', e); }
  if (Object.keys(updates).length) await db.ref().update(updates);
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
    try {
      const sub = await getSubscription();
      if (sub) await sub.unsubscribe();
      if (FTS.PUSH && FTS.PUSH.workerUrl) await fetch(FTS.PUSH.workerUrl + '/unsubscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ uid }) }).catch(()=>{});
    } catch(e) {}
    await deleteOwnForumAndDmMessages(uid);
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




/* ── GUIDE PREMIERS PAS APRÈS INSTALLATION PWA ──────────────── */
const FIRST_STEPS = ['profile', 'notifs', 'docs', 'messages'];
let firstStepsState = {};
let firstStepsUid = null;
let firstStepsProfile = null;
let firstStepsSaveTimer = null;

function firstStepsStorageKey(uid) {
  return 'fts-first-steps-v1-' + String(uid || 'anonymous');
}

function readFirstStepsLocal(uid) {
  try {
    const raw = localStorage.getItem(firstStepsStorageKey(uid));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch(e) { return {}; }
}

function writeFirstStepsLocal(uid, state) {
  try { localStorage.setItem(firstStepsStorageKey(uid), JSON.stringify(state || {})); } catch(e) {}
}

function hasUsableProfileInfo(profile) {
  if (!profile) return false;
  const first = String(profile.firstName || profile.prenom || profile.name || '').trim();
  const last  = String(profile.lastName || profile.nom || '').trim();
  const tel   = String(profile.tel || profile.phone || profile.telephone || '').trim();
  return Boolean(first && (last || tel));
}

function notificationsReadyForFirstSteps() {
  try {
    return window.Notification && Notification.permission === 'granted';
  } catch(e) { return false; }
}

function isFirstStepsCompleted(profile) {
  return Boolean(profile && (profile.onboardingCompleted === true || profile.firstStepsCompleted === true));
}

function shouldShowFirstSteps(profile) {
  return isPwaStandaloneMode() && !isFirstStepsCompleted(profile) && !(firstStepsState && firstStepsState.completed === true);
}

function mergeFirstStepsAutoState(profile) {
  const state = Object.assign({}, firstStepsState || {});
  if (hasUsableProfileInfo(profile)) state.profile = true;
  if (notificationsReadyForFirstSteps()) state.notifs = true;
  return state;
}

function countFirstStepsDone(state) {
  return FIRST_STEPS.filter(step => state && state[step] === true).length;
}

function renderFirstSteps() {
  const panel = document.getElementById('first-steps-panel');
  if (!panel) return;

  if (!shouldShowFirstSteps(firstStepsProfile)) {
    panel.classList.add('u-initial-hidden');
    panel.hidden = true;
    return;
  }

  firstStepsState = mergeFirstStepsAutoState(firstStepsProfile);
  const doneCount = countFirstStepsDone(firstStepsState);
  const complete = doneCount >= FIRST_STEPS.length;

  panel.hidden = false;
  panel.classList.toggle('u-initial-hidden', complete);
  panel.setAttribute('aria-hidden', complete ? 'true' : 'false');

  const progress = document.getElementById('first-steps-progress');
  if (progress) progress.textContent = doneCount + '/' + FIRST_STEPS.length;

  FIRST_STEPS.forEach(function(step) {
    const item = panel.querySelector('[data-first-step="' + step + '"]');
    if (!item) return;
    const isDone = firstStepsState[step] === true;
    item.classList.toggle('is-done', isDone);
    item.setAttribute('aria-pressed', isDone ? 'true' : 'false');
    const check = item.querySelector('.first-step-check');
    if (check) check.textContent = isDone ? '✓' : '○';
    const action = item.querySelector('.first-step-action');
    if (action) action.textContent = isDone ? 'Fait' : (step === 'notifs' ? 'Activer' : step === 'docs' ? 'Voir' : step === 'messages' ? 'Découvrir' : 'Ouvrir');
  });

  const done = document.getElementById('first-steps-done');
  if (done) done.classList.toggle('u-initial-hidden', !complete);

  writeFirstStepsLocal(firstStepsUid, firstStepsState);
  if (complete) completeFirstStepsOnboarding();
}

function saveFirstStepsProgressSoon() {
  if (!firstStepsUid) return;
  if (firstStepsSaveTimer) clearTimeout(firstStepsSaveTimer);
  firstStepsSaveTimer = setTimeout(async function() {
    firstStepsSaveTimer = null;
    try {
      await db.ref('fts_users/' + firstStepsUid + '/onboardingProgress').update(Object.assign({}, firstStepsState, { updatedAt: Date.now() }));
    } catch(e) {
      // Non bloquant : la progression locale suffit si les règles refusent une sous-écriture.
      console.warn('[FTS] Progression premiers pas non synchronisée :', e);
    }
  }, 450);
}

async function completeFirstStepsOnboarding() {
  if (!firstStepsUid || (firstStepsProfile && isFirstStepsCompleted(firstStepsProfile))) return;
  const panel = document.getElementById('first-steps-panel');
  try {
    const updates = {
      onboardingCompleted: true,
      onboardingCompletedAt: Date.now(),
      onboardingProgress: Object.assign({}, firstStepsState, { completedAt: Date.now() })
    };
    await db.ref('fts_users/' + firstStepsUid).update(updates);
    firstStepsProfile = Object.assign({}, firstStepsProfile || {}, updates);
    userProfile = Object.assign({}, userProfile || {}, updates);
  } catch(e) {
    // Non bloquant : localStorage évite que le guide revienne en boucle sur cet appareil.
    console.warn('[FTS] Fin premiers pas non synchronisée :', e);
  }
  firstStepsProfile = Object.assign({}, firstStepsProfile || {}, { onboardingCompleted: true, onboardingCompletedAt: Date.now() });
  userProfile = Object.assign({}, userProfile || {}, { onboardingCompleted: true, onboardingCompletedAt: Date.now() });
  try {
    const local = Object.assign({}, firstStepsState, { completed: true, completedAt: Date.now() });
    writeFirstStepsLocal(firstStepsUid, local);
  } catch(e) {}
  if (panel) {
    panel.classList.add('u-initial-hidden');
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
  }
}

function markFirstStepDone(step) {
  if (!FIRST_STEPS.includes(step)) return;
  firstStepsState[step] = true;
  writeFirstStepsLocal(firstStepsUid, firstStepsState);
  saveFirstStepsProgressSoon();
  renderFirstSteps();
}

function handleFirstStepAction(step) {
  if (!step) return;
  if (step === 'notifs' && firstStepsState && firstStepsState.notifs === true) {
    renderFirstSteps();
    return;
  }
  if (step === 'profile') {
    markFirstStepDone('profile');
    openAccountModal();
    return;
  }
  if (step === 'notifs') {
    toggleNotifications();
    return;
  }
  if (step === 'docs') {
    markFirstStepDone('docs');
    if (window.FTSNav && typeof window.FTSNav.openDocumentsModal === 'function') {
      window.FTSNav.openDocumentsModal();
    } else {
      const firstCat = document.querySelector('.profile-pill[data-cat-index]');
      if (firstCat) firstCat.click();
    }
    return;
  }
  if (step === 'messages') {
    markFirstStepDone('messages');
    openGuideModal();
  }
}

function initFirstStepsOnboarding(uid, profile) {
  firstStepsUid = uid;
  firstStepsProfile = profile || {};
  const remoteProgress = (profile && profile.onboardingProgress && typeof profile.onboardingProgress === 'object') ? profile.onboardingProgress : {};
  firstStepsState = Object.assign({}, readFirstStepsLocal(uid), remoteProgress);
  if (isFirstStepsCompleted(profile)) {
    firstStepsState.completed = true;
    writeFirstStepsLocal(uid, firstStepsState);
  }
  renderFirstSteps();
}

window.addEventListener('appinstalled', function() {
  setTimeout(function(){ renderFirstSteps(); }, 700);
});

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
  bindClick('btn-open-guide-inline', openGuideModal);
  bindClick('btn-account-guide', function(){ closeAccountModal(); openGuideModal(); });
  bindClick('btn-notif', toggleNotifications);
  bindClick('btg', toggleEvts);
  bindClick('btn-save-profile', saveProfileInfo);
  bindClick('btn-add-profile-child', addProfileChildCard);
  bindClick('btn-account-email', changeAccountEmail);
  bindClick('btn-account-export', exportMyData);
  bindClick('btn-account-delete', deleteMyAccount);
  bindClick('btn-account-pwd', changeAccountPassword);
  bindClick('btn-account-signout', doSignOut);
  bindClick('btn-account-notifs', toggleNotifications);
  bindClick('btn-account-pwa-help', openAccountPwaHelp);
  bindClick('pwa-coach-close', closePwaInstallCoach);
  bindClick('pwa-coach-later', closePwaInstallCoach);
  bindClick('pwa-install-main', triggerAndroidInstallPrompt);

  document.addEventListener('click', function(e) {

    const firstStepBtn = e.target.closest('[data-first-step]');
    if (firstStepBtn) {
      e.preventDefault();
      handleFirstStepAction(firstStepBtn.dataset.firstStep);
      return;
    }

    const documentsBtn = e.target.closest('[data-action="open-documents-modal"]');
    if (documentsBtn) {
      try { markFirstStepDone('docs'); } catch(err) {}
    }

    const removeProfileChild = e.target.closest('[data-action="remove-profile-child"]');
    if (removeProfileChild) {
      e.preventDefault();
      removeProfileChildCard(removeProfileChild);
      return;
    }

    if (handleAccountReminderClick(e.target)) {
      e.preventDefault();
      return;
    }

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

    const textDocBtn = e.target.closest('[data-action="open-text-doc"]');
    if (textDocBtn) {
      e.preventDefault();
      openTextResourceDoc(textDocBtn.dataset.docKey || '');
      return;
    }

    const resourceOfflineBtn = e.target.closest('[data-action="toggle-resource-offline"]');
    if (resourceOfflineBtn) {
      e.preventDefault();
      toggleResourceOffline(resourceOfflineBtn);
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

// Quand l'utilisateur revient sur l'espace membre après avoir lu un MP, un forum,
// un sondage ou une ressource dans une autre page, le bloc dynamique doit se nettoyer
// sans obliger à recharger manuellement.
window.addEventListener('focus', function(){ scheduleMemberNewsRefresh(250); });
document.addEventListener('visibilitychange', function(){
  if (!document.hidden) scheduleMemberNewsRefresh(250);
});

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
        if (typeof scheduleMemberNewsRefresh === 'function') scheduleMemberNewsRefresh(350);
      });
    } catch(e) {}
  }
  if (window.firebase && firebase.auth) firebase.auth().onAuthStateChanged(function(user){ if(user) start(user.uid); });
})();
