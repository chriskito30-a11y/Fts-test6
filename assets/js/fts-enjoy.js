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
    { key:'resources', label:'📚 Ressources', words:['ressource','ressources','document','documents','doc','docs','texte','partition','tablature','musique','audio','video','vidéo','pdf','parole','réplique','replique','fichier','fichiers','cours a travailler','répéter','repeter'] },
    { key:'calendar', label:'📅 Planning', words:['planning','calendrier','date','horaire','horaires','heure','cours','répétition','repetition','spectacle','stage','événement','evenement','venir','quand','prochain cours','prochaine répétition','absence','rdv','rendez vous'] },
    { key:'messages', label:'💬 Messages', words:['message','messages','messagerie','privé','prive','mp','dm','conversation','discussion privée','prof','professeur','contacter','répondre','repondre','envoyer un message'] },
    { key:'unread', label:'🔴 Non lus', words:['non lu','non lus','à lire','a lire','badge','pastille','bulle','rouge','notification rouge','ou aller','où aller','quoi lire','nouveau message'] },
    { key:'forum', label:'👥 Forum', words:['forum','groupe','groupes','discussion','discussion groupe','catégorie','categorie','publier','post','commentaire','communauté','communaute','annonce groupe','canal'] },
    { key:'polls', label:'📊 Sondages', words:['sondage','sondages','vote','voter','répondre au sondage','repondre au sondage','questionnaire','avis','réponse attendue','reponse attendue'] },
    { key:'notifications', label:'🔔 Notifications', words:['notification','notifications','notif','notifs','alerte','push','sonne','recevoir','reçois','recois','autoriser','activer','désactiver','desactiver'] },
    { key:'account', label:'👤 Mon compte', words:['compte','profil','connexion','connecter','mot de passe','email','mail','identifiant','validé','valide','validation','enfant','parent','accès','acces','discipline','groupe manquant'] },
    { key:'install', label:'📲 Installer l’app', words:['installer','installation','application','app','pwa','iphone','android','écran accueil','ecran accueil','raccourci','icone','icône','mobile'] },
    { key:'season', label:'🎭 Saison / inscriptions', words:['saison','inscription','inscrire','tarif','tarifs','prix','activité','activite','loisir','performance','place','billet','billetterie','cotisation','adhésion','adhesion'] },
    { key:'help', label:'🆘 Aide', words:['aide','problème','probleme','bug','erreur','marche pas','bloqué','bloque','perdu','question','administration','admin','souci','ça bug','ca bug'] }
  ];

  const state = {
    options: {}, db: null, auth: null, user: null, profile: null,
    categories: [], allowedCategories: [], unread: 0, unreadOverview: emptyUnreadOverview(),
    events: [], courses: [], currentView: 'home',
    mounted: false, root: null, body: null, badge: null, input: null,
    listeners: []
  };

  const cfg = () => Object.assign({
    page: document.body && document.body.dataset ? (document.body.dataset.page || '') : '',
    avatar: 'assets/img/enjoy.png',
    openAvatar: 'assets/img/enjoy-open.png',
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

  function emptyUnreadOverview() {
    return {
      total: 0,
      dm: { total: 0, items: [] },
      forum: { total: 0, items: [] },
      polls: { total: 0, items: [] }
    };
  }

  function getUnreadOverview() {
    return state.unreadOverview || emptyUnreadOverview();
  }

  function unreadTotal() {
    const ov = getUnreadOverview();
    return Number(ov.total || state.unread || 0) || 0;
  }

  function unreadSummaryText() {
    const ov = getUnreadOverview();
    const parts = [];
    if (ov.dm && ov.dm.total) parts.push(`${ov.dm.total} MP`);
    if (ov.forum && ov.forum.total) parts.push(`${ov.forum.total} forum`);
    if (ov.polls && ov.polls.total) parts.push(`${ov.polls.total} sondage${ov.polls.total > 1 ? 's' : ''}`);
    return parts.join(' · ');
  }

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

  function setAvatarMode(isOpen) {
    if (!state.root) return;
    const normalSrc = cfg().avatar || 'assets/img/enjoy.png';
    const openSrc = cfg().openAvatar || 'assets/img/enjoy-open.png';
    const src = isOpen ? openSrc : normalSrc;
    state.root.querySelectorAll('.fts-enjoy-avatar, .fts-enjoy-header-avatar').forEach(img => {
      if (img && img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
  }

  function buildRoot() {
    if (document.getElementById('fts-enjoy-root')) {
      state.root = document.getElementById('fts-enjoy-root');
      state.body = state.root.querySelector('.fts-enjoy-body');
      state.badge = state.root.querySelector('.fts-enjoy-badge');
      state.input = state.root.querySelector('.fts-enjoy-input');
      setAvatarMode(state.root.classList.contains('is-open'));
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
    setAvatarMode(true);
    if (isMobileEnjoy()) document.body.classList.add('fts-enjoy-open-mobile');
    setTimeout(() => { updateViewportHeight(); }, 120);
  }

  function close() {
    if (!state.root) return;
    state.root.classList.remove('is-open', 'is-typing');
    setAvatarMode(false);
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
    if (FTSObj().listenUnreadOverview) {
      const cleanup = FTSObj().listenUnreadOverview(state.db, user.uid, state.profile || {}, overview => {
        state.unreadOverview = overview || emptyUnreadOverview();
        state.unread = unreadTotal();
        setBadge(state.unread);
        if (state.currentView === 'home') renderHome();
        if (state.currentView === 'unread') renderUnreadOverview({ replace:true });
      });
      state.listeners.push(cleanup);
      return;
    }
    const ref = state.db.ref('fts_dm/userConvs/' + user.uid);
    const handler = async snap => {
      const ids = [];
      snap.forEach(ch => ids.push(ch.key));
      try {
        const vals = await Promise.all(ids.map(id => state.db.ref('fts_dm/conversations/' + id + '/unread/' + user.uid).once('value')));
        state.unread = vals.reduce((sum, s) => sum + Number(s.val() || 0), 0);
        state.unreadOverview = { total: state.unread, dm: { total: state.unread, items: [] }, forum: { total: 0, items: [] }, polls: { total: 0, items: [] } };
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
    state.currentView = 'home';
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
    const totalUnread = unreadTotal();
    const unreadDetails = unreadSummaryText();
    const unreadText = totalUnread > 0
      ? `\nTu as ${totalUnread} élément${totalUnread > 1 ? 's' : ''} à lire${unreadDetails ? ' : ' + unreadDetails : ''}.`
      : '';
    const intro = `Salut ${first ? first + ' ' : ''}👋\nJe peux t’aider avec ton espace ${role} Fais Ton Show.${unreadText}`;
    bot(intro);

    const quick = [
      { label:'📚 Mes ressources', small: groups.length ? groups.slice(0,2).join(' · ') + (groups.length > 2 ? '…' : '') : 'Selon ton profil', intent:'resources' },
      { label:'📅 Mon planning', small: state.courses.length ? relativeCourseDate(state.courses[0].startAt, state.courses[0].endAt) : (state.events.length ? state.events[0].date || 'Prochain événement' : 'Cours et événements'), intent:'calendar' },
      { label:'💬 Messages', small: totalUnread ? `${totalUnread} à lire${unreadDetails ? ' · ' + unreadDetails : ''}` : 'MP, forum, sondages', intent:'messages' },
      { label:'👥 Forum', small:'Groupes et annonces', intent:'forum' },
      { label:'📊 Sondages', small:(getUnreadOverview().polls.total ? `${getUnreadOverview().polls.total} en attente` : 'Votes et réponses'), intent:'polls' },
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

  function countLabel(n, singular, plural) {
    const count = Number(n || 0) || 0;
    return `${count} ${count > 1 ? plural : singular}`;
  }

  function itemSmall(item, singular, plural) {
    return countLabel(item && item.count, singular, plural);
  }

  function renderUnreadOverview(options) {
    if (!state.body) return;
    state.currentView = 'unread';
    if (options && options.replace) state.body.innerHTML = '';
    if (!state.user) {
      bot('Connecte-toi pour que je puisse te montrer tes messages, forums et sondages à lire.', [
        { label:'Se connecter', url:'auth.html', primary:true }
      ]);
      return;
    }

    const ov = getUnreadOverview();
    const total = unreadTotal();
    if (!total) {
      bot('Je ne vois rien à lire pour le moment : aucun MP, message forum ou sondage en attente.', [
        { label:'Ouvrir le hub messages', url:'hub-messages.html', primary:true },
        { label:'Voir mes messages privés', url:'messages.html' },
        { label:'Voir le forum', url:'forum.html' }
      ]);
      return;
    }

    bot(`Tu as ${total} élément${total > 1 ? 's' : ''} à lire. Voilà où aller, sans chercher au hasard :`);

    if (ov.dm && ov.dm.total) {
      section('Messages privés');
      renderActions((ov.dm.items || []).map(item => ({
        label: `💬 ${item.label || 'Conversation'}`,
        small: itemSmall(item, 'message non lu', 'messages non lus'),
        url: item.url || pageUrl('messages.html', { conv:item.id }),
        primary: true
      })).concat((ov.dm.items || []).length ? [] : [{ label:'Ouvrir mes messages privés', small:countLabel(ov.dm.total, 'message non lu', 'messages non lus'), url:'messages.html', primary:true }]));
    }

    if (ov.forum && ov.forum.total) {
      section('Forum');
      renderActions((ov.forum.items || []).map(item => ({
        label: `👥 ${item.label || 'Canal forum'}`,
        small: itemSmall(item, 'message non lu', 'messages non lus'),
        url: item.url || pageUrl('forum.html', { channel:item.channel }),
        primary: !(ov.dm && ov.dm.total)
      })).concat((ov.forum.items || []).length ? [] : [{ label:'Ouvrir le forum', small:countLabel(ov.forum.total, 'message non lu', 'messages non lus'), url:'forum.html' }]));
    }

    if (ov.polls && ov.polls.total) {
      section('Sondages');
      renderActions((ov.polls.items || []).map(item => ({
        label: `📊 ${item.label || 'Sondage'}`,
        small:'Réponse attendue',
        url: item.url || pageUrl('sondages.html', { poll:item.id }),
        primary: !(ov.dm && ov.dm.total) && !(ov.forum && ov.forum.total)
      })).concat((ov.polls.items || []).length ? [] : [{ label:'Ouvrir les sondages', small:countLabel(ov.polls.total, 'sondage en attente', 'sondages en attente'), url:'sondages.html' }]));
    }

    renderActions([{ label:'Voir le hub messages', url:'hub-messages.html' }]);
  }

  function notificationSummary() {
    if (!('Notification' in window)) return 'Non compatible';
    if (Notification.permission === 'granted') return 'Autorisées';
    if (Notification.permission === 'denied') return 'Bloquées';
    return 'À activer';
  }

  function detectIntent(text) {
    const n = norm(text);
    const tokens = n.split('_').filter(Boolean);
    const tokenSet = new Set(tokens);
    const hasFtsAnchor = ['fts','fais_ton_show','enjoy','assistant','application','app'].some(w => n.includes(w));
    const politeOnly = ['bonjour','salut','hello','coucou','merci','ok'].includes(n);
    if (politeOnly) return { type:'direct', key:'help', score:2 };
    if (n.includes('prochain_cours') || n.includes('mon_cours') || (n.includes('cours') && (n.includes('quand') || n.includes('horaire') || n.includes('heure')))) {
      return { type:'direct', key:'calendar', score:4 };
    }

    const scored = INTENTS.map(intent => {
      let score = 0;
      const matched = [];
      intent.words.forEach(w => {
        const nw = norm(w);
        if (!nw) return;
        const wordScore = nw.length > 10 ? 3 : (nw.length > 4 ? 2 : 1);
        const matchedDirectly = nw.includes('_') ? n.includes(nw) : tokenSet.has(nw);
        if (matchedDirectly) {
          score += wordScore;
          matched.push(w);
        }
      });
      if (intent.key === 'help' && score === 1 && !hasFtsAnchor) score = 1;
      return Object.assign({}, intent, { score, matched });
    }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);

    if (!scored.length) return { type: hasFtsAnchor ? 'unclear' : 'unknown', score:0 };
    const best = scored[0];
    const near = scored.filter(x => x.key !== best.key && x.score >= 2 && best.score - x.score <= 2).slice(0, 3);
    if (near.length) return { type:'ambiguous', choices:[best].concat(near) };
    if (best.score < 2 && !hasFtsAnchor) return { type:'unknown', score:best.score };
    if (best.score < 2) return { type:'unclear', choices:scored.slice(0, 3) };
    return { type:'direct', key:best.key, score:best.score };
  }

  function ask(text) {
    userMsg(text);
    state.currentView = 'chat';
    handleIntent(detectIntent(text), text);
  }

  function handleIntent(result, rawText) {
    if (!result || result.type === 'unknown') return answerUnknown();
    if (result.type === 'ambiguous') return answerClarify(result.choices);
    if (result.type === 'unclear') return answerUnclear(result.choices);
    return respond(result.key, rawText);
  }

  function respond(intent, rawText) {
    if (intent !== 'unread') state.currentView = 'chat';
    switch(intent) {
      case 'resources': return answerResources();
      case 'calendar': return answerCalendar(rawText);
      case 'messages': return answerMessages();
      case 'unread': return renderUnreadOverview();
      case 'forum': return answerForum();
      case 'polls': return answerPolls();
      case 'notifications': return answerNotifications();
      case 'account': return answerAccount();
      case 'install': return answerInstall();
      case 'season': return answerSeason();
      default: return answerHelp();
    }
  }

  function intentAction(intent, primary) {
    return { label:intent.label, intent:intent.key, primary:primary === true };
  }

  function answerClarify(choices) {
    const usable = (choices || []).filter(c => c && c.key).slice(0, 4);
    bot('Ta question peut vouloir dire plusieurs choses dans Fais Ton Show. Choisis la piste la plus proche et je t’emmène au bon endroit.', usable.map((c, index) => intentAction(c, index === 0)));
  }

  function answerUnclear(choices) {
    const usable = (choices && choices.length ? choices : INTENTS.filter(i => ['resources','calendar','messages','account'].includes(i.key))).slice(0, 4);
    bot('Je n’ai pas assez d’indices pour répondre proprement. Je préfère te demander une précision plutôt que de t’envoyer n’importe où.', usable.map((c, index) => intentAction(c, index === 0)));
  }

  function answerUnknown() {
    bot('Je ne suis pas sûr de comprendre dans le cadre Fais Ton Show, je préfère ne pas inventer. Je peux t’aider sur les ressources, le planning, les messages, le forum, les sondages, les notifications, l’installation ou ton compte.', [
      { label:'Voir les sujets possibles', intent:'help', primary:true },
      { label:'Ouvrir mon espace membre', url:'membres.html' },
      { label:'Voir la FAQ', url:'faq.html' }
    ]);
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
    if (unreadTotal() > 0) return renderUnreadOverview();
    bot('Je ne vois rien à lire pour le moment. La zone Messages regroupe les MP, le forum et les sondages, donc tu peux choisir directement l’espace dont tu as besoin.', [
      { label:'Ouvrir le hub messages', url:'hub-messages.html', primary:true },
      { label:'Messages privés', url:'messages.html' },
      { label:'Forum', url:'forum.html' }
    ]);
  }

  function answerForum() {
    const forumUnread = getUnreadOverview().forum.total || 0;
    bot((forumUnread ? `Tu as ${forumUnread} message${forumUnread > 1 ? 's' : ''} forum à lire.\n` : '') + 'Le forum sert aux discussions de groupe, aux annonces et aux échanges par activité. Tu ne vois que les espaces liés à ton profil.', [
      { label:'Ouvrir le forum', url:'forum.html', primary:true },
      { label:'Voir mes non-lus', intent:'unread' },
      { label:'Voir mes ressources', intent:'resources' }
    ]);
  }

  function answerPolls() {
    if (!state.user) return bot('Connecte-toi pour voir les sondages associés à ton compte.', [{ label:'Se connecter', url:'auth.html', primary:true }]);
    const pollUnread = getUnreadOverview().polls.total || 0;
    if (pollUnread > 0) {
      bot(`Tu as ${pollUnread} sondage${pollUnread > 1 ? 's' : ''} en attente. Je peux t’ouvrir directement celui ou ceux à traiter.`, [
        { label:'Voir les sondages à répondre', intent:'unread', primary:true },
        { label:'Ouvrir les sondages', url:'sondages.html' }
      ]);
      return;
    }
    bot('Je ne vois pas de sondage en attente pour ton compte. Tu peux quand même ouvrir la page Sondages pour consulter les votes passés ou les résultats visibles.', [
      { label:'Ouvrir les sondages', url:'sondages.html', primary:true },
      { label:'Voir le hub messages', url:'hub-messages.html' }
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
    bot('Je peux t’aider sur les sujets Fais Ton Show ci-dessous. Choisis une piste : je préfère te guider clairement plutôt que deviner.', [
      { label:'Ressources', intent:'resources' },
      { label:'Planning', intent:'calendar' },
      { label:'Messages', intent:'messages' },
      { label:'Compte / accès', intent:'account' },
      { label:'Notifications', intent:'notifications' },
      { label:'Installation app', intent:'install' }
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
        state.unreadOverview = emptyUnreadOverview();
        state.currentView = 'home';
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
    Object.assign(state, { mounted:false, root:null, body:null, badge:null, input:null, user:null, profile:null, categories:[], allowedCategories:[], unread:0, unreadOverview:emptyUnreadOverview(), events:[], courses:[], currentView:'home' });
  }

  window.FTSEnjoy = { init, open, close, toggle, refresh: refreshContext, destroy, ask };
})();
