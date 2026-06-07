'use strict';

(function(){
  const D = window.FTSQuestData || {};
  const UI = {};
  D.storageKeys = D.storageKeys || { avatar: 'ftsQuest.avatar.v2', log: 'ftsQuest.log.v2' };
  D.avatarDefault = D.avatarDefault || { base:'showrunner', primary:'#e7354f', secondary:'#ffd166', skin:'#f3b284', hair:'#23131f', eyes:'#7de3ff', eyeStyle:'spark', accessory:'director_hat', frame:'legendary', aura:'spotlight' };
  D.bases = D.bases || [{ id:'showrunner', label:'Showrunner', family:'FTS', rarity:'Prototype' }];
  D.accessories = D.accessories || [{ id:'none', label:'Sans accessoire' }];
  D.frames = D.frames || [{ id:'classic', label:'Classique', rarity:'Commun' }];

  UI.$ = (selector, root=document) => root.querySelector(selector);
  UI.$$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
  UI.readJSON = function(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch(err){ return fallback; }
  };
  UI.writeJSON = function(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(err) {}
  };

  UI.loadAvatar = function(){
    try {
      const raw = localStorage.getItem(D.storageKeys.avatar);
      return raw ? { ...D.avatarDefault, ...JSON.parse(raw) } : { ...D.avatarDefault };
    } catch (err) {
      return { ...D.avatarDefault };
    }
  };

  UI.saveAvatar = function(config){
    localStorage.setItem(D.storageKeys.avatar, JSON.stringify(config));
    UI.log('Carte artiste sauvegardée sur cet appareil.');
  };

  UI.log = function(message){
    const entry = `[${new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}] ${UI.cleanLogMessage(message)}`;
    let log = [];
    try { log = JSON.parse(localStorage.getItem(D.storageKeys.log) || '[]'); } catch(err) {}
    log.unshift(entry);
    log = log.slice(0, 8);
    localStorage.setItem(D.storageKeys.log, JSON.stringify(log));
    const target = UI.$('#questLog');
    if (target) target.innerHTML = log.map(item => `<p>${UI.escape(item)}</p>`).join('');
  };

  UI.renderLog = function(){
    const target = UI.$('#questLog');
    if (!target) return;
    let log = [];
    try { log = JSON.parse(localStorage.getItem(D.storageKeys.log) || '[]'); } catch(err) {}
    log = log.filter(item => !UI.isTechnicalLog(item));
    if (!log.length) log = ['FTS Quest prêt. Choisis une mission utile pour commencer.'];
    target.innerHTML = log.map(item => `<p>${UI.escape(item)}</p>`).join('');
  };

  UI.isTechnicalLog = function(message){
    return /prototype|firebase|localstorage|mock|brique/i.test(String(message || ''));
  };

  UI.cleanLogMessage = function(message){
    return String(message || '')
      .replace(/prototype/gi, 'version actuelle')
      .replace(/Firebase sera branché plus tard/gi, 'la sauvegarde est prête')
      .replace(/localStorage/gi, 'cet appareil')
      .replace(/mock/gi, 'personnel');
  };

  UI.todayKey = function(date=new Date()){
    return date.toISOString().slice(0, 10);
  };

  UI.plainText = function(value){
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  UI.Progress = (function(){
    const progressKey = D.storageKeys.playerProgress || 'ftsQuest.player.progress.v1';
    const trophiesKey = D.storageKeys.trophiesState || 'ftsQuest.trophies.state.v1';
    const axisIds = ['oser','ecouter','creer','repeter','aider','scene'];
    const axisLabels = {
      oser: 'Oser',
      ecouter: 'Écouter',
      creer: 'Créer',
      repeter: 'Répéter',
      aider: 'Aider',
      scene: 'Monter sur scène'
    };

    function emptyState(){
      return { xp: 0, actions: {}, actionOrder: [], axis: {}, days: {}, lastActionAt: '', lastImpact: null };
    }

    function normalize(state){
      const next = { ...emptyState(), ...(state || {}) };
      next.actions = next.actions || {};
      next.actionOrder = Array.isArray(next.actionOrder) ? next.actionOrder.filter(id => next.actions[id]) : Object.keys(next.actions);
      next.axis = next.axis || {};
      next.days = next.days || {};
      axisIds.forEach(id => { next.axis[id] = Number(next.axis[id] || 0); });
      next.xp = Number(next.xp || 0);
      return next;
    }

    function read(){
      return normalize(UI.readJSON(progressKey, emptyState()));
    }

    function write(state){
      UI.writeJSON(progressKey, normalize(state));
    }

    function axisForText(value, fallback='oser'){
      const text = UI.plainText(value);
      if (/aide|aid[eé]|encourag|merci|rangement|groupe|troupe|ami|friend/.test(text)) return 'aider';
      if (/planning|horaire|message|prof|question|ressource|notification|profil|ecout|consigne/.test(text)) return 'ecouter';
      if (/rep[eè]t|texte|musique|chanson|choreo|chauff|warmup|partition|10 min|entrain/.test(text)) return 'repeter';
      if (/cree|creer|creation|personnage|objet|decor|scene sous|imagine|invent|phrase/.test(text)) return 'creer';
      if (/spectacle|show|plateau|costume|tenue|sac|billet|qr|trac|respiration|concentration/.test(text)) return 'scene';
      return fallback;
    }

    function axisForChallenge(pack, step){
      if (step && step.axis) return step.axis;
      if (pack && pack.axis) return pack.axis;
      return axisForText(`${pack?.id || ''} ${pack?.title || ''} ${step?.id || ''} ${step?.label || ''} ${step?.help || ''}`, 'oser');
    }

    function dayLabel(dateKey){
      try {
        return new Date(dateKey + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'short', day:'2-digit', month:'2-digit' });
      } catch(err) {
        return dateKey;
      }
    }

    function earnedMilestoneIds(progress){
      const actions = Object.values(progress.actions || {});
      const has = pattern => actions.some(action => pattern.test(UI.plainText(`${action.id} ${action.label} ${action.source} ${action.detail || ''}`)));
      const count = pattern => actions.filter(action => pattern.test(UI.plainText(`${action.id} ${action.label} ${action.source} ${action.detail || ''}`))).length;
      const axis = progress.axis || {};
      const ids = [];
      if (actions.length >= 1) ids.push('course-ready');
      if ((axis.repeter || 0) >= 3 || count(/repeat|repeter|texte|musique|chanson|choreo|warmup|echauff/) >= 3) ids.push('regular-practice','title-method');
      if ((axis.aider || 0) >= 2 || count(/aide|encourag|merci|rangement|troupe/) >= 2) ids.push('team-spirit','title-team');
      if (count(/spectacle-ready|costume|tenue|sac|billet|show|plateau/) >= 4) ids.push('showtime','title-stage-ready');
      if (has(/question|retour|feedback|prof/)) ids.push('feedback-seeker');
      if ((axis.creer || 0) >= 2 || count(/roulette|cree|creation|personnage|objet|decor|invent/) >= 2) ids.push('creative-spark');
      if (has(/warmup|echauff|respiration|concentration|trac/)) ids.push('calm-stage');
      if (has(/^roulette:/)) ids.push('roulette-first');
      if (has(/^code:/)) ids.push('secret-code');
      return Array.from(new Set(ids));
    }

    function syncTrophies(progress){
      const earned = earnedMilestoneIds(progress);
      const rewards = D.trophies?.rewards || [];
      const saved = UI.readJSON(trophiesKey, {});
      saved.trophies = saved.trophies || {};
      saved.history = Array.isArray(saved.history) ? saved.history : [];
      const unlocked = [];
      earned.forEach(id => {
        const reward = rewards.find(item => item.id === id);
        if (!reward) return;
        const already = reward.unlocked || saved.trophies[id]?.unlocked;
        if (already) return;
        saved.trophies[id] = { ...(saved.trophies[id] || {}), unlocked: true, unlockedAt: Date.now(), source: 'progression' };
        saved.history.unshift({ id, title: reward.title, icon: reward.icon, at: Date.now(), manual: false });
        unlocked.push(reward);
      });
      saved.history = saved.history.slice(0, 30);
      UI.writeJSON(trophiesKey, saved);
      return unlocked;
    }

    function recordAction(action){
      const state = read();
      const now = new Date();
      const id = String(action.id || `action:${now.getTime()}`);
      const existing = state.actions[id];
      if (existing) {
        state.lastImpact = { added:false, action: existing, unlocked: [], message: 'Cette action était déjà dans ta progression.' };
        write(state);
        return state.lastImpact;
      }
      const axis = axisIds.includes(action.axis) ? action.axis : axisForText(`${action.id || ''} ${action.label || ''} ${action.detail || ''}`);
      const entry = {
        id,
        label: String(action.label || 'Action utile'),
        source: String(action.source || 'FTS Quest'),
        detail: String(action.detail || ''),
        href: String(action.href || ''),
        axis,
        xp: Number(action.xp || 12),
        at: now.toISOString()
      };
      state.actions[id] = entry;
      state.actionOrder.unshift(id);
      state.actionOrder = state.actionOrder.slice(0, 80);
      state.axis[axis] = Number(state.axis[axis] || 0) + 1;
      state.xp = Number(state.xp || 0) + entry.xp;
      const day = UI.todayKey(now);
      state.days[day] = state.days[day] || { count: 0, xp: 0 };
      state.days[day].count += 1;
      state.days[day].xp += entry.xp;
      state.lastActionAt = entry.at;
      const unlocked = syncTrophies(state);
      state.lastImpact = {
        added: true,
        action: entry,
        unlocked: unlocked.map(item => ({ id:item.id, title:item.title, icon:item.icon })),
        message: unlocked.length ? `Progression enregistrée. Nouveau trophée : ${unlocked[0].title}` : 'Progression enregistrée.'
      };
      write(state);
      return state.lastImpact;
    }

    function summary(){
      const state = read();
      const actions = state.actionOrder.map(id => state.actions[id]).filter(Boolean);
      const today = UI.todayKey();
      const dayKeys = Object.keys(state.days || {}).sort();
      const axisList = axisIds.map(id => {
        const source = (D.journeyAxes || []).find(axis => axis.id === id);
        return {
          id,
          label: source?.title || axisLabels[id] || id,
          icon: source?.icon || '✦',
          count: Number(state.axis[id] || 0)
        };
      });
      const topAxis = axisList.slice().sort((a,b) => b.count - a.count)[0] || axisList[0];
      const todayCount = Number(state.days[today]?.count || 0);
      return {
        xp: Number(state.xp || 0),
        totalActions: actions.length,
        todayCount,
        activeDays: dayKeys.length,
        days: dayKeys.map(key => ({ key, label: dayLabel(key), ...(state.days[key] || {}) })),
        actions,
        lastAction: actions[0] || null,
        lastImpact: state.lastImpact || null,
        axisList,
        topAxis,
        healthyHint: todayCount === 0 ? 'Une action courte suffit pour avancer aujourd’hui.' : todayCount === 1 ? 'Tu as déjà avancé aujourd’hui. Tu peux t’arrêter là ou ajouter un exercice.' : 'Beau rythme : garde de l’énergie pour le vrai cours.'
      };
    }

    function reset(){
      write(emptyState());
    }

    return { read, write, recordAction, summary, syncTrophies, earnedMilestoneIds, axisForText, axisForChallenge, reset };
  })();

  UI.escape = function(value){
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\'':'&#039;', '"':'&quot;' }[char]));
  };

  UI.getBase = id => D.bases.find(item => item.id === id) || D.bases[0];
  UI.getAccessory = id => D.accessories.find(item => item.id === id) || D.accessories[0];
  UI.getFrame = id => D.frames.find(item => item.id === id) || D.frames[0];

  UI.avatarStyle = function(config){
    return [
      `--avatar-primary:${config.primary}`,
      `--avatar-secondary:${config.secondary}`,
      `--avatar-skin:${config.skin}`,
      `--avatar-hair:${config.hair}`,
      `--avatar-eyes:${config.eyes}`
    ].join(';');
  };

  UI.renderAvatar = function(config, options={}){
    const base = UI.getBase(config.base);
    const accessory = UI.getAccessory(config.accessory);
    const size = options.size || 'large';
    const label = `${base.label}, ${accessory.label}`;
    return `
      <div class="quest-avatar ${size} base-${UI.escape(config.base)} frame-${UI.escape(config.frame)} aura-${UI.escape(config.aura)} eyes-${UI.escape(config.eyeStyle)} accessory-${UI.escape(config.accessory)}" style="${UI.avatarStyle(config)}" role="img" aria-label="${UI.escape(label)}">
        <span class="qaura qaura-back"></span>
        <span class="qbody"><i></i></span>
        <span class="qneck"></span>
        <span class="qhead">
          <i class="qear left"></i><i class="qear right"></i>
          <i class="qhair"></i>
          <i class="qeye left"><b></b></i><i class="qeye right"><b></b></i>
          <i class="qbrow left"></i><i class="qbrow right"></i>
          <i class="qnose"></i><i class="qmouth"></i>
          <i class="qcheek left"></i><i class="qcheek right"></i>
        </span>
        <span class="qaccessory"><i></i><b></b></span>
        <span class="qprop"><i></i></span>
        <span class="qshine"></span>
      </div>`;
  };

  UI.renderPlayerCard = function(target, config, compact=false){
    const player = D.player;
    const base = UI.getBase(config.base);
    const frame = UI.getFrame(config.frame);
    const progress = UI.Progress ? UI.Progress.summary() : { xp:0 };
    const trophyState = UI.readJSON(D.storageKeys.trophiesState || 'ftsQuest.trophies.state.v1', {});
    const totalXp = Number(player.xp || 0) + Number(progress.xp || 0);
    const pct = Math.min(100, Math.round((totalXp / player.nextXp) * 100));
    const activeTitle = trophyState.activeTitle || player.activeTitle;
    target.innerHTML = `
      <article class="quest-player-card frame-${UI.escape(config.frame)} ${compact ? 'compact' : ''}">
        <div class="card-lights"></div>
        <div class="rarity-row"><span>${UI.escape(frame.rarity)}</span><strong>${UI.escape(base.family)}</strong></div>
        <div class="player-card-main">
          <div class="player-avatar-slot">${UI.renderAvatar(config, { size: compact ? 'medium' : 'hero' })}</div>
          <div class="player-info">
            <p class="mini-label">Carte artiste</p>
            <h2>${UI.escape(player.name)}</h2>
            <p class="profile-title">${UI.escape(activeTitle)}</p>
            <p class="profile-subtitle">${UI.escape(base.label)} · ${UI.escape(player.discipline)}</p>
          </div>
        </div>
        <div class="xp-block">
          <div class="xp-top"><span>${UI.escape(player.act)} · ${UI.escape(player.levelLabel)}</span><strong>${totalXp} / ${player.nextXp} XP</strong></div>
          <div class="xp-track"><span style="width:${pct}%"></span></div>
        </div>
      </article>`;
  };

  UI.applyPalette = function(config, paletteId){
    const palette = D.palettes.find(item => item.id === paletteId);
    if (!palette) return config;
    return { ...config, palette: palette.id, primary: palette.primary, secondary: palette.secondary };
  };

  UI.selectableCard = function(item, active, locked=false){
    return `
      <button class="choice-card ${active ? 'active' : ''} ${locked ? 'locked' : ''}" type="button" data-id="${UI.escape(item.id)}">
        <span class="choice-glow"></span>
        <strong>${UI.escape(item.label || item.name || item.title)}</strong>
        ${item.rarity ? `<em>${UI.escape(item.rarity)}</em>` : ''}
        ${item.description ? `<small>${UI.escape(item.description)}</small>` : ''}
      </button>`;
  };

  UI.initReveal = function(){
    const els = UI.$$('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('revealed'));
      return;
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    els.forEach(el => obs.observe(el));
  };

  window.FTSQuestUI = UI;
})();
