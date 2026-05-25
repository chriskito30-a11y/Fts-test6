/* ================================================================
   FTS-ENJOY.JS — Assistant Enjoy Fais Ton Show
   - Sans IA générative
   - Connecté au profil authentifié
   - Ne lit que ce que l'utilisateur connecté peut lire via Firebase
   - Module autonome, injectable page par page
   ================================================================ */

(function(){
  'use strict';

  const DEFAULT_CATEGORIES = [
    { icon:'🎭', name:'Theatre', subcats:['7/9 ans','10/12 ans','13/15 ans','Impro','10/17 ans - Lundi','Adultes - Lundi','Adultes - Vendredi'] },
    { icon:'🎤', name:'Chant', subcats:[] },
    { icon:'💃', name:'Danse', subcats:['Les Baby Show','Show Danse Junior','Ados / Adultes'] },
    { icon:'🎸', name:'Musique', subcats:['Guitare','Basse','Batterie','Piano','Formation Musicale'] },
    { icon:'⭐', name:'Singer Academy', subcats:['Loisir','Spectacle'] },
    { icon:'🎬', name:'Comedie Musicale', subcats:['Kids','Enfants','Adultes'] },
    { icon:'🌟', name:'Singer Show', subcats:[] },
    { icon:'🎨', name:'Atelier', subcats:[] }
  ];

  const INTENTS = [
    { key:'resources', label:'📚 Ressources', words:['ressource','document','doc','texte','partition','tablature','musique','audio','video','vidéo','pdf','parole','réplique','replique','fichier'] },
    { key:'calendar', label:'📅 Planning', words:['planning','calendrier','date','horaire','heure','cours','répétition','repetition','spectacle','stage','événement','evenement','venir','quand'] },
    { key:'messages', label:'💬 Messages', words:['message','messagerie','privé','prive','prof','professeur','contacter','répondre','repondre','discussion','dm'] },
    { key:'forum', label:'👥 Forum', words:['forum','groupe','discussion','catégorie','categorie','publier','post','commentaire','communauté','communaute'] },
    { key:'notifications', label:'🔔 Notifications', words:['notification','notif','alerte','push','sonne','recevoir','reçois','recois','autoriser','activer'] },
    { key:'account', label:'👤 Mon compte', words:['compte','profil','connexion','connecter','mot de passe','email','mail','identifiant','validé','valide','enfant','parent','accès','acces'] },
    { key:'install', label:'📲 Installer l’app', words:['installer','installation','application','app','pwa','iphone','android','écran accueil','ecran accueil','raccourci'] },
    { key:'season', label:'🎭 Saison / inscriptions', words:['saison','inscription','inscrire','tarif','prix','activité','activite','loisir','performance','place','billet','billetterie'] },
    { key:'help', label:'🆘 Aide', words:['aide','problème','probleme','bug','erreur','marche pas','bloqué','bloque','perdu','question','administration','admin'] }
  ];

  const state = {
    options: {}, db: null, auth: null, user: null, profile: null,
    categories: [], allowedCategories: [], unread: 0, events: [], courses: [],
    mounted: false, root: null, body: null, badge: null, input: null,
    listeners: []
  };

  const cfg = () => Object.assign({
    page: document.body && document.body.dataset ? (document.body.dataset.page || '') : '',
    avatar: 'assets/img/enjoy.png',
    autoOpenOnce: false,
    nudgeOnce: true,
    showWhenLoggedOut: true,
    maxEvents: 3,
    maxCourses: 4,
    debug: false
  }, state.options || {});

  const FTSObj = () => window.FTS || {};
  const esc = (s) => (FTSObj().esc ? FTSObj().esc(s) : String(s == null ? '' : s).replace(/[&<>\"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])));
  const norm = (s) => (FTSObj().norm ? FTSObj().norm(s) : String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));
  const catIcon = (s) => (FTSObj().catIcon ? FTSObj().catIcon(s) : '💬');
  const uniq = (arr) => [...new Set((arr || []).map(x => String(x || '').trim()).filter(Boolean))];
  const asList = (v) => Array.isArray(v) ? v : String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const isAdmin = () => state.profile && state.profile.role === 'admin';
  const isProf = () => state.profile && state.profile.role === 'prof';

  function log(){ if (cfg().debug) console.log('[Enjoy]', ...arguments); }

  function getFirstName() {
    const p = state.profile || {};
    return p.firstName || p.prenom || p.name || (state.user && state.user.email ? state.user.email.split('@')[0] : '');
  }

  function getRoleLabel() {
    const r = state.profile && state.profile.role;
    if (r === 'admin') return 'admin';
    if (r === 'prof') return 'prof';
    return 'membre';
  }

  function getDisciplines() {
    const p = state.profile || {};
    const own = asList(p.disciplines || p.group || p.groups || p.categories);
    const child = (p.hasEnfant && Array.isArray(p.enfants))
      ? p.enfants.flatMap(e => asList(e.disciplines || e.group || e.groups || e.categories))
      : [];
    return uniq([...own, ...child]);
  }

  function getSubgroups() {
    const p = state.profile || {};
    const own = asList(p.subgroups || p.subcategories || p.subgroup || p.sousCategories);
    const child = (p.hasEnfant && Array.isArray(p.enfants))
      ? p.enfants.flatMap(e => asList(e.subgroups || e.subcategories || e.subgroup || e.sousCategories))
      : [];
    return uniq([...own, ...child]);
  }

  function hasAccessToCategory(cat) {
    if (!cat) return false;
    if (isAdmin()) return true;
    const disciplines = getDisciplines().map(norm);
    if (!disciplines.length) return false;
    return disciplines.includes(norm(cat.name || cat.category));
  }

  function allowedSubcatsFor(cat) {
    const subs = Array.isArray(cat && cat.subcats) ? cat.subcats : [];
    if (isAdmin()) return subs;
    const allowed = new Set(getSubgroups().map(norm));
    return subs.filter(s => allowed.has(norm(s)));
  }

  function pageUrl(name, params) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return name + q;
  }

  function go(url) { window.location.href = url; }

  function isMobileEnjoy() {
    return window.matchMedia && window.matchMedia('(max-width: 560px)').matches;
  }

  function updateViewportHeight() {
    if (!state.root) return;
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    if (h) state.root.style.setProperty('--enjoy-vvh', Math.max(320, Math.round(h)) + 'px');
  }

  function bindKeyboardFix(root) {
    if (!root || root.dataset.keyboardFix === '1') return;
    root.dataset.keyboardFix = '1';
    const input = root.querySelector('.fts-enjoy-input');
    const sync = () => {
      updateViewportHeight();
      if (state.body) setTimeout(scrollDown, 40);
    };
    window.addEventListener('resize', sync, { passive:true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', sync, { passive:true });
      window.visualViewport.addEventListener('scroll', sync, { passive:true });
    }
    if (input) {
      input.addEventListener('focus', () => {
        root.classList.add('is-typing');
        sync();
        setTimeout(() => {
          try { input.scrollIntoView({ block:'nearest', behavior:'smooth' }); } catch(e) {}
          scrollDown();
        }, 180);
      });
      input.addEventListener('blur', () => {
        root.classList.remove('is-typing');
        setTimeout(updateViewportHeight, 80);
      });
    }
  }

  function buildRoot() {
    if (document.getElementById('fts-enjoy-root')) {
      state.root = document.getElementById('fts-enjoy-root');
      state.body = state.root.querySelector('.fts-enjoy-body');
      state.badge = state.root.querySelector('.fts-enjoy-badge');
      state.input = state.root.querySelector('.fts-enjoy-input');
      bindKeyboardFix(state.root);
      updateViewportHeight();
      return;
    }

    const root = document.createElement('div');
    root.id = 'fts-enjoy-root';
    root.className = 'fts-enjoy-root';
    root.innerHTML = `
      <button class="fts-enjoy-bubble" type="button" aria-label="Ouvrir Enjoy, assistant Fais Ton Show">
        <img class="fts-enjoy-avatar" src="${esc(cfg().avatar)}" alt="Enjoy">
        <span class="fts-enjoy-avatar-fallback">E</span>
        <span class="fts-enjoy-badge" aria-hidden="true"></span>
      </button>
      <div class="fts-enjoy-nudge">Besoin d’aide ?</div>
      <section class="fts-enjoy-panel" role="dialog" aria-modal="false" aria-label="Enjoy, assistant Fais Ton Show">
        <header class="fts-enjoy-header">
          <img class="fts-enjoy-header-avatar" src="${esc(cfg().avatar)}" alt="Enjoy">
          <div class="fts-enjoy-title"><strong>Enjoy</strong><span>Ton assistant Fais Ton Show</span></div>
          <button class="fts-enjoy-close" type="button" aria-label="Fermer">✕</button>
        </header>
        <div class="fts-enjoy-body"></div>
        <form class="fts-enjoy-inputbar">
          <input class="fts-enjoy-input" type="search" autocomplete="off" placeholder="Pose ta question…">
          <button class="fts-enjoy-send" type="submit" aria-label="Envoyer">➜</button>
        </form>
      </section>`;

    document.body.appendChild(root);
    state.root = root;
    state.body = root.querySelector('.fts-enjoy-body');
    state.badge = root.querySelector('.fts-enjoy-badge');
    state.input = root.querySelector('.fts-enjoy-input');

    const bubble = root.querySelector('.fts-enjoy-bubble');
    const avatar = root.querySelector('.fts-enjoy-avatar');
    const headerAvatar = root.querySelector('.fts-enjoy-header-avatar');
    avatar.addEventListener('error', () => bubble.classList.add('no-avatar'));
    headerAvatar.addEventListener('error', () => { headerAvatar.style.display = 'none'; });
    bubble.addEventListener('click', toggle);
    root.querySelector('.fts-enjoy-close').addEventListener('click', close);
    root.querySelector('.fts-enjoy-inputbar').addEventListener('submit', e => {
      e.preventDefault();
      const value = state.input.value.trim();
      if (!value) return;
      state.input.value = '';
      ask(value);
    });
    root.addEventListener('click', e => {
      if (e.target === root && root.classList.contains('is-open')) close();
    });
    bindKeyboardFix(root);
    updateViewportHeight();

    if (cfg().nudgeOnce && !localStorage.getItem('fts_enjoy_nudge_seen')) {
      setTimeout(() => root.classList.add('show-nudge'), 900);
      setTimeout(() => root.classList.remove('show-nudge'), 5500);
      localStorage.setItem('fts_enjoy_nudge_seen', '1');
    }
  }

  function open() {
    if (!state.root) return;
    updateViewportHeight();
    state.root.classList.add('is-open');
    if (isMobileEnjoy()) document.body.classList.add('fts-enjoy-open-mobile');
    setTimeout(() => { updateViewportHeight(); if (state.input) state.input.focus({ preventScroll:true }); }, 120);
  }

  function close() {
    if (!state.root) return;
    state.root.classList.remove('is-open', 'is-typing');
    document.body.classList.remove('fts-enjoy-open-mobile');
  }

  function toggle() { state.root && state.root.classList.contains('is-open') ? close() : open(); }

  function setBadge(n) {
    if (!state.badge) return;
    const count = Number(n || 0);
    if (count > 0) {
      state.badge.textContent = count > 9 ? '9+' : String(count);
      state.badge.classList.add('is-visible');
    } else {
      state.badge.textContent = '';
      state.badge.classList.remove('is-visible');
    }
  }

  function bot(text, actions) {
    const msg = document.createElement('div');
    msg.className = 'fts-enjoy-message bot';
    msg.innerHTML = esc(text);
    state.body.appendChild(msg);
    if (actions && actions.length) renderActions(actions);
    scrollDown();
  }

  function userMsg(text) {
    const msg = document.createElement('div');
    msg.className = 'fts-enjoy-message user';
    msg.innerHTML = esc(text);
    state.body.appendChild(msg);
    scrollDown();
  }

  function scrollDown() { state.body.scrollTop = state.body.scrollHeight; }

  function actionHtml(a, idx) {
    const klass = 'fts-enjoy-action' + (a.primary ? ' primary' : '');
    const small = a.small ? `<small>${esc(a.small)}</small>` : '';
    if (a.url) return `<a class="${klass}" data-enjoy-action="${idx}" href="${esc(a.url)}">${esc(a.label)}${small}</a>`;
    return `<button class="${klass}" data-enjoy-action="${idx}" type="button">${esc(a.label)}${small}</button>`;
  }

  function renderActions(actions) {
    const wrap = document.createElement('div');
    wrap.className = 'fts-enjoy-actions';
    wrap.innerHTML = actions.map(actionHtml).join('');
    wrap.querySelectorAll('[data-enjoy-action]').forEach(btn => {
      const a = actions[Number(btn.dataset.enjoyAction)];
      if (a && a.fn) btn.addEventListener('click', e => { e.preventDefault(); a.fn(); });
      else if (a && a.intent) btn.addEventListener('click', e => { e.preventDefault(); respond(a.intent); });
    });
    state.body.appendChild(wrap);
  }

  function section(title) {
    const el = document.createElement('div');
    el.className = 'fts-enjoy-section-title';
    el.textContent = title;
    state.body.appendChild(el);
  }

  function renderGrid(items) {
    const grid = document.createElement('div');
    grid.className = 'fts-enjoy-grid';
    grid.innerHTML = items.map((item, idx) => {
      const small = item.small ? `<small>${esc(item.small)}</small>` : '';
      return `<button type="button" class="fts-enjoy-chip" data-chip="${idx}">${esc(item.label)}${small}</button>`;
    }).join('');
    grid.querySelectorAll('[data-chip]').forEach(btn => {
      const item = items[Number(btn.dataset.chip)];
      btn.addEventListener('click', () => item.fn ? item.fn() : (item.intent ? respond(item.intent) : item.url ? go(item.url) : null));
    });
    state.body.appendChild(grid);
  }

  function renderTopics() {
    const topics = document.createElement('div');
    topics.className = 'fts-enjoy-topics';
    const labels = INTENTS.map(i => ({ key:i.key, label:i.label }));
    topics.innerHTML = labels.map(t => `<button type="button" class="fts-enjoy-topic" data-intent="${esc(t.key)}">${esc(t.label)}</button>`).join('');
    topics.querySelectorAll('[data-intent]').forEach(btn => btn.addEventListener('click', () => respond(btn.dataset.intent)));
    state.body.appendChild(topics);
  }

  async function loadCategories() {
    let cats = DEFAULT_CATEGORIES;
    try {
      if (FTSObj().getCategoryStructureAsync && state.db) {
        const arr = await FTSObj().getCategoryStructureAsync(state.db);
        if (Array.isArray(arr) && arr.length) cats = arr;
      } else if (FTSObj().getCategoryStructure) {
        const arr = FTSObj().getCategoryStructure();
        if (Array.isArray(arr) && arr.length) cats = arr;
      }
    } catch(e) { log('categories fallback', e); }

    state.categories = cats
      .filter(c => c && c.active !== false)
      .map(c => ({
        icon: c.icon || c.emoji || catIcon(c.name || c.category),
        name: c.name || c.category,
        subcats: (c.subs || c.subcats || [])
          .map(s => typeof s === 'string' ? s : (s && (s.name || s.label)))
          .filter(Boolean)
      }))
      .filter(c => c.name);

    state.allowedCategories = state.categories.filter(hasAccessToCategory);
  }

  async function loadProfile(user) {
    state.profile = null;
    if (!state.db || !user) return;
    const snap = await state.db.ref('fts_users/' + user.uid).once('value');
    state.profile = snap.val() || null;
  }

  function listenUnread(user) {
    if (!state.db || !user) return;
    const ref = state.db.ref('fts_dm/userConvs/' + user.uid);
    const handler = async snap => {
      const ids = [];
      snap.forEach(ch => ids.push(ch.key));
      try {
        const vals = await Promise.all(ids.map(id => state.db.ref('fts_dm/conversations/' + id + '/unread/' + user.uid).once('value')));
        state.unread = vals.reduce((sum, s) => sum + Number(s.val() || 0), 0);
        setBadge(state.unread);
      } catch(e) { log('unread denied/unavailable', e); }
    };
    ref.on('value', handler);
    state.listeners.push(() => ref.off('value', handler));
  }


  function scheduleTargetValues(s) {
    const cat = String(s && (s.targetCategory || s.category || '') || '').trim();
    const sub = String(s && (s.targetSubcategory || s.subcategory || '') || '').trim();
    const groups = {};
    if (cat) groups[cat] = sub ? [sub] : [];
    return { cats: cat ? [cat] : [], subs: sub ? [sub] : [], groups };
  }

  function canSeeSchedule(s) {
    if (!s || s.active === false) return false;
    const kind = String(s.kind || '').trim();
    if (kind === 'music_individual' || s.uid) {
      return isAdmin() || String(s.uid || '') === String(state.user && state.user.uid || '');
    }
    if (isAdmin()) return true;
    const t = scheduleTargetValues(s);
    if (!t.cats.length && !t.subs.length && !Object.keys(t.groups).length) return true;
    const myCats = getDisciplines().map(norm);
    const mySubs = getSubgroups().map(norm);
    for (const [cat, subs] of Object.entries(t.groups)) {
      const catOk = myCats.includes(norm(cat));
      const cleanSubs = (subs || []).map(norm).filter(Boolean);
      if (catOk && !cleanSubs.length) return true;
      if (catOk && cleanSubs.some(sub => mySubs.includes(sub))) return true;
    }
    return false;
  }

  function scheduleDateKey(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function defaultScheduleUntil(startAt) {
    const now = new Date();
    let year = now.getFullYear();
    let until = new Date(year, 5, 30, 23, 59, 59, 999).getTime();
    if (until < Date.now()) until = new Date(year + 1, 5, 30, 23, 59, 59, 999).getTime();
    return Math.min(until, Date.now() + 18 * 31 * 24 * 60 * 60 * 1000);
  }

  function addScheduleDays(ts, days) {
    const d = new Date(ts);
    d.setDate(d.getDate() + days);
    return d.getTime();
  }

  function nextOccurrenceForSchedule(s, nowTs) {
    if (!s || s.active === false) return null;
    const duration = Math.max(5, Number(s.durationMinutes || 30) || 30);
    const mode = String(s.recurrenceMode || 'single');
    const excluded = new Set(Array.isArray(s.excludedDates) ? s.excludedDates : []);
    let candidates = [];

    if (mode === 'manual') {
      candidates = (Array.isArray(s.manualDates) ? s.manualDates : []).map(Number).filter(Boolean);
    } else if (mode === 'weekly' || mode === 'biweekly' || mode === 'triweekly') {
      const startAt = Number(s.startAt || 0);
      if (!startAt) return null;
      const step = mode === 'weekly' ? 7 : (mode === 'biweekly' ? 14 : 21);
      const until = Number(s.repeatUntil || 0) || defaultScheduleUntil(startAt);
      let cur = startAt;
      let guard = 0;
      while (cur + duration * 60000 < nowTs && guard < 260) { cur = addScheduleDays(cur, step); guard++; }
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
      .map(ts => ({ startAt:ts, endAt:ts + duration * 60000, durationMinutes:duration, schedule:s }))
      .filter(o => o.endAt >= nowTs)
      .sort((a,b) => a.startAt - b.startAt);
    return future[0] || null;
  }

  function relativeCourseDate(ts, endAt) {
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

  function courseIcon(s) {
    const text = [s && s.lessonType, s && s.title, s && s.targetCategory, s && s.category].join(' ').toLowerCase();
    if (text.includes('guitare') || text.includes('basse') || text.includes('musique')) return '🎸';
    if (text.includes('chant')) return '🎤';
    if (text.includes('danse')) return '💃';
    if (text.includes('theatre') || text.includes('théâtre')) return '🎭';
    if (text.includes('singer')) return '🌟';
    return '📅';
  }

  async function loadCourses() {
    state.courses = [];
    if (!state.db || !state.user) return;
    try {
      const snap = await state.db.ref('fts_schedules').once('value');
      const nowTs = Date.now();
      const rows = [];
      snap.forEach(child => {
        const s = Object.assign({ id: child.key }, child.val() || {});
        if (!canSeeSchedule(s)) return;
        const occ = nextOccurrenceForSchedule(s, nowTs);
        if (!occ) return;
        const so = occ.schedule || s;
        rows.push(Object.assign(occ, {
          scheduleId: s.id || child.key,
          title: so.title || so.lessonType || so.targetSubcategory || so.subcategory || so.targetCategory || so.category || 'Cours Fais Ton Show',
          teacher: so.teacher || '',
          place: so.place || so.location || '',
          icon: courseIcon(so)
        }));
      });
      state.courses = rows.sort((a,b) => a.startAt - b.startAt).slice(0, cfg().maxCourses || 4);
    } catch(e) { log('courses unavailable', e); }
  }

  async function loadEvents() {
    state.events = [];
    if (!state.db) return;
    try {
      const snap = await state.db.ref('fts_events').once('value');
      const now = new Date(); now.setHours(0,0,0,0);
      const disc = new Set(getDisciplines().map(norm));
      const subs = new Set(getSubgroups().map(norm));
      const rows = [];
      snap.forEach(child => {
        const v = child.val() || {};
        if (v.active === false || v.status === 'inactive') return;
        const ts = Number(v.dateTs || v.startTs || v.ts || 0);
        if (ts && ts < now.getTime()) return;
        const evCats = asList(v.category || v.categories || v.discipline || v.disciplines).map(norm);
        const evSubs = asList(v.subcategory || v.subcategories || v.subcat || v.subgroups).map(norm);
        const scoped = evCats.length || evSubs.length;
        const allowed = isAdmin() || !scoped || evCats.some(x => disc.has(x)) || evSubs.some(x => subs.has(x));
        if (!allowed) return;
        rows.push({
          id: child.key,
          title: v.name || v.nom || v.title || v.titre || 'Événement',
          date: v.dateLabel || v.date || v.d || '',
          hour: v.hour || v.heure || v.time || v.h || '',
          place: v.location || v.lieu || v.l || '',
          ts
        });
      });
      state.events = rows.sort((a,b) => (a.ts || Number.MAX_SAFE_INTEGER) - (b.ts || Number.MAX_SAFE_INTEGER)).slice(0, cfg().maxEvents);
    } catch(e) { log('events unavailable', e); }
  }

  async function refreshContext() {
    if (!state.user) return;
    try {
      await loadProfile(state.user);
      await loadCategories();
      await loadCourses();
      await loadEvents();
      renderHome();
    } catch(e) {
      log('refresh context error', e);
      renderHome();
    }
  }

  function renderHome() {
    if (!state.body) return;
    state.body.innerHTML = '';

    if (!state.user) {
      bot('Salut 👋 Moi c’est Enjoy. Je peux t’aider à te connecter, installer l’application ou trouver les infos de Fais Ton Show.', [
        { label:'Se connecter', url:'auth.html', primary:true },
        { label:'Installer l’application', intent:'install' },
        { label:'Voir la saison / inscriptions', url:'saison.html' }
      ]);
      section('Questions fréquentes'); renderTopics();
      return;
    }

    const first = getFirstName();
    const role = getRoleLabel();
    const groups = state.allowedCategories.map(c => c.name);
    const unreadText = state.unread > 0 ? `\nTu as ${state.unread} message${state.unread > 1 ? 's' : ''} non lu${state.unread > 1 ? 's' : ''}.` : '';
    const intro = `Salut ${first ? first + ' ' : ''}👋\nJe peux t’aider avec ton espace ${role} Fais Ton Show.${unreadText}`;
    bot(intro);

    const quick = [
      { label:'📚 Mes ressources', small: groups.length ? groups.slice(0,2).join(' · ') + (groups.length > 2 ? '…' : '') : 'Selon ton profil', intent:'resources' },
      { label:'📅 Mon planning', small: state.courses.length ? relativeCourseDate(state.courses[0].startAt, state.courses[0].endAt) : (state.events.length ? state.events[0].date || 'Prochain événement' : 'Cours et événements'), intent:'calendar' },
      { label:'💬 Messages', small: state.unread ? `${state.unread} non lu${state.unread > 1 ? 's' : ''}` : 'Discussions privées', intent:'messages' },
      { label:'👥 Forum', small:'Groupes et annonces', intent:'forum' },
      { label:'🔔 Notifications', small: notificationSummary(), intent:'notifications' },
      { label:'🆘 Besoin d’aide', small:'Compte ou accès', intent:'help' }
    ];
    if (isProf()) quick.unshift({ label:'🧑‍🏫 Espace prof', small:'Publier / gérer', url:'profs.html' });
    if (isAdmin()) quick.unshift({ label:'🛠 Administration', small:'Membres / contenus', url:'admin.html' });
    section('Accès rapides'); renderGrid(quick);

    if (groups.length) {
      section('Tes accès');
      renderActions(state.allowedCategories.slice(0, 8).map(c => ({
        label: `${c.icon || catIcon(c.name)} ${c.name}`,
        small: allowedSubcatsFor(c).length ? allowedSubcatsFor(c).join(' · ') : 'Ressources générales',
        url: pageUrl('membres.html', { cat:c.name })
      })));
    }

    section('Tu peux aussi demander'); renderTopics();
    const note = document.createElement('p');
    note.className = 'fts-enjoy-mini';
    note.textContent = 'Enjoy ne remplace pas l’équipe : il t’oriente uniquement avec les infos visibles par ton compte.';
    state.body.appendChild(note);
  }

  function notificationSummary() {
    if (!('Notification' in window)) return 'Non compatible';
    if (Notification.permission === 'granted') return 'Autorisées';
    if (Notification.permission === 'denied') return 'Bloquées';
    return 'À activer';
  }

  function detectIntent(text) {
    const n = norm(text);
    if (n.includes('prochain_cours') || n.includes('mon_cours') || (n.includes('cours') && (n.includes('quand') || n.includes('horaire') || n.includes('heure')))) return 'calendar';
    let best = { key:'help', score:0 };
    INTENTS.forEach(intent => {
      let score = 0;
      intent.words.forEach(w => {
        const nw = norm(w);
        if (n.includes(nw)) score += Math.max(1, nw.length > 7 ? 2 : 1);
      });
      if (score > best.score) best = { key:intent.key, score };
    });
    return best.score ? best.key : 'help';
  }

  function ask(text) {
    userMsg(text);
    respond(detectIntent(text), text);
  }

  function respond(intent, rawText) {
    switch(intent) {
      case 'resources': return answerResources();
      case 'calendar': return answerCalendar(rawText);
      case 'messages': return answerMessages();
      case 'forum': return answerForum();
      case 'notifications': return answerNotifications();
      case 'account': return answerAccount();
      case 'install': return answerInstall();
      case 'season': return answerSeason();
      default: return answerHelp();
    }
  }

  function answerResources() {
    if (!state.user) return bot('Connecte-toi d’abord pour que je puisse voir les ressources associées à ton profil.', [{ label:'Se connecter', url:'auth.html', primary:true }]);
    const cats = state.allowedCategories;
    if (!cats.length) {
      return bot('Ton compte est actif, mais je ne vois pas encore de discipline associée à ton profil. Si une activité manque, l’administration doit corriger ton accès.', [
        { label:'Ouvrir mon espace membre', url:'membres.html', primary:true },
        { label:'Contacter l’équipe', intent:'messages' }
      ]);
    }
    bot('Tes ressources sont rangées par activité. Je peux ouvrir directement les espaces visibles par ton profil.', cats.slice(0, 8).map(c => ({
      label:`${c.icon || catIcon(c.name)} ${c.name}`,
      small: allowedSubcatsFor(c).length ? allowedSubcatsFor(c).join(' · ') : 'Documents généraux',
      url: pageUrl('membres.html', { cat:c.name })
    })).concat([{ label:'Voir toutes mes ressources', url:'membres.html', primary:true }]));
  }

  function answerCalendar(rawText) {
    const actions = [{ label:'Ouvrir mon planning', url:'membres.html#planning', primary:true }, { label:'Voir la saison', url:'saison.html' }];
    const n = norm(rawText || '');
    const wantsEvent = n.includes('spectacle') || n.includes('evenement') || n.includes('stage') || n.includes('date');
    const wantsCourse = !rawText || n.includes('cours') || n.includes('repetition') || n.includes('horaire') || n.includes('heure') || n.includes('planning') || n.includes('quand');

    if (wantsCourse) {
      if (state.courses.length) {
        const lines = state.courses.map(c => {
          const s = c.schedule || {};
          const meta = [relativeCourseDate(c.startAt, c.endAt), c.teacher ? 'Prof : ' + c.teacher : '', c.place || ''].filter(Boolean).join(' · ');
          return `• ${c.icon || '📅'} ${c.title}${meta ? ' — ' + meta : ''}`;
        }).join('\n');
        bot(`Voici les prochains cours/répétitions que je peux voir pour ton compte :\n${lines}`, actions);
        return;
      }
      bot('Je ne vois pas encore de prochain cours rattaché à ton compte. Ça peut arriver si les créneaux ne sont pas encore saisis dans le planning ou si ton accès doit être corrigé.', actions.concat([{ label:'Vérifier mon compte', intent:'account' }]));
      return;
    }

    if (wantsEvent && state.events.length) {
      const lines = state.events.map(e => `• ${e.title}${e.date ? ' — ' + e.date : ''}${e.hour ? ' · ' + e.hour : ''}${e.place ? ' · ' + e.place : ''}`).join('\n');
      bot(`Voici les prochains événements que je peux voir pour ton compte :\n${lines}`, actions);
    } else if (state.events.length) {
      const lines = state.events.map(e => `• ${e.title}${e.date ? ' — ' + e.date : ''}${e.hour ? ' · ' + e.hour : ''}${e.place ? ' · ' + e.place : ''}`).join('\n');
      bot(`Je ne vois pas de cours à afficher ici, mais voici les prochains événements visibles :\n${lines}`, actions);
    } else {
      bot('Je ne vois pas encore de prochain rendez-vous ciblé pour ton compte, ou le planning n’est pas disponible ici. Tu peux ouvrir ton espace membre pour vérifier.', actions);
    }
  }

  function answerMessages() {
    if (!state.user) return bot('Pour accéder aux messages, il faut être connecté à ton compte Fais Ton Show.', [{ label:'Se connecter', url:'auth.html', primary:true }]);
    const text = state.unread > 0
      ? `Tu as ${state.unread} message${state.unread > 1 ? 's' : ''} non lu${state.unread > 1 ? 's' : ''}.`
      : 'Je ne vois pas de message non lu pour le moment.';
    bot(`${text}\nLa messagerie sert aux échanges privés avec l’équipe, les professeurs ou les membres concernés.`, [
      { label:'Ouvrir mes messages', url:'messages.html', primary:true },
      { label:'Voir le forum', url:'forum.html' }
    ]);
  }

  function answerForum() {
    bot('Le forum sert aux discussions de groupe, aux annonces et aux échanges par activité. Tu ne vois que les espaces liés à ton profil.', [
      { label:'Ouvrir le forum', url:'forum.html', primary:true },
      { label:'Voir mes ressources', intent:'resources' }
    ]);
  }

  function answerNotifications() {
    const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
    let text = 'Les notifications servent aux annonces importantes, nouveaux messages, changements d’horaires et rappels.';
    if (perm === 'granted') text += '\nBonne nouvelle : elles semblent autorisées sur ce navigateur.';
    else if (perm === 'denied') text += '\nElles sont bloquées par le navigateur ou le téléphone. Il faudra les réautoriser dans les réglages du site/appareil.';
    else if (perm === 'default') text += '\nElles ne sont pas encore autorisées. Tu peux les activer depuis ton espace membre.';
    else text += '\nTon navigateur ne semble pas compatible avec les notifications web.';
    bot(text, [
      { label:'Ouvrir mon espace membre', url:'membres.html', primary:true },
      { label:'J’ai un problème', intent:'help' }
    ]);
  }

  function answerAccount() {
    if (!state.user) return bot('Tu peux te connecter avec ton email. Si ton compte est en attente, l’administration doit le valider avant l’accès complet.', [{ label:'Se connecter', url:'auth.html', primary:true }]);
    const p = state.profile || {};
    const groups = state.allowedCategories.map(c => c.name).join(', ') || 'aucune discipline visible';
    bot(`Ton compte est connecté en tant que ${getRoleLabel()}.\nStatut : ${p.status || 'actif'}\nAccès visibles : ${groups}.\nSi une activité manque, demande une correction à l’administration.`, [
      { label:'Ouvrir mon espace membre', url:'membres.html', primary:true },
      { label:'Contacter l’équipe', intent:'messages' }
    ]);
  }

  function answerInstall() {
    bot('Pour installer l’app :\n• Android : ouvre le site, puis “Installer l’application” ou menu ⋮ > Ajouter à l’écran d’accueil.\n• iPhone : ouvre Safari, bouton Partage, puis “Sur l’écran d’accueil”.\nEnsuite, ouvre Fais Ton Show depuis l’icône créée.', [
      { label:'Aller à l’accueil', url:'index.html', primary:true },
      { label:'Se connecter', url:'auth.html' }
    ]);
  }

  function answerSeason() {
    bot('Pour les activités, parcours, horaires, tarifs ou inscriptions, la page Saison centralise les informations publiques. Dans ton espace membre, tu retrouves ensuite les infos liées à ton compte.', [
      { label:'Voir la saison', url:'saison.html', primary:true },
      { label:'Ouvrir mon espace membre', url:'membres.html' }
    ]);
  }

  function answerHelp() {
    bot('Je peux t’aider sur les ressources, le planning, les messages, le forum, les notifications, l’installation ou ton compte. Si ta demande concerne un accès manquant ou un bug, contacte l’équipe depuis la messagerie.', [
      { label:'Ressources', intent:'resources' },
      { label:'Planning', intent:'calendar' },
      { label:'Messages', intent:'messages' },
      { label:'Notifications', intent:'notifications' },
      { label:'Contacter l’équipe', url:'messages.html', primary:true }
    ]);
  }

  async function init(options) {
    state.options = Object.assign({}, options || {});
    if (state.mounted) return refreshContext();
    buildRoot();
    state.mounted = true;

    if (typeof firebase === 'undefined') {
      bot('Enjoy est chargé, mais Firebase n’est pas disponible sur cette page. Je peux seulement donner une aide générale.', [
        { label:'Installer l’app', intent:'install' },
        { label:'Voir la saison', url:'saison.html' }
      ]);
      return;
    }

    try {
      state.db = FTSObj().initFirebase ? FTSObj().initFirebase() : firebase.database();
      state.auth = firebase.auth();
      state.auth.onAuthStateChanged(async user => {
        state.user = user || null;
        state.profile = null;
        state.allowedCategories = [];
        state.events = [];
        state.courses = [];
        state.unread = 0;
        setBadge(0);
        state.listeners.splice(0).forEach(fn => { try { fn(); } catch(e){} });
        if (user) {
          await refreshContext();
          listenUnread(user);
        } else if (cfg().showWhenLoggedOut) {
          renderHome();
        } else {
          state.root.classList.add('is-hidden');
        }
      });
    } catch(e) {
      log('init error', e);
      renderHome();
    }
  }

  function destroy() {
    state.listeners.splice(0).forEach(fn => { try { fn(); } catch(e){} });
    if (state.root) state.root.remove();
    document.body.classList.remove('fts-enjoy-open-mobile');
    Object.assign(state, { mounted:false, root:null, body:null, badge:null, input:null, user:null, profile:null, categories:[], allowedCategories:[], unread:0, events:[], courses:[] });
  }

  window.FTSEnjoy = { init, open, close, toggle, refresh: refreshContext, destroy, ask };
})();
