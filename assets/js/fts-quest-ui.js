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
    UI.log('Avatar sauvegardé localement. Firebase sera branché plus tard.');
  };

  UI.log = function(message){
    const entry = `[${new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}] ${message}`;
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
    if (!log.length) log = ['FTS Quest prêt. Prototype autonome sans Firebase.'];
    target.innerHTML = log.map(item => `<p>${UI.escape(item)}</p>`).join('');
  };

  UI.escape = function(value){
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\'':'&#039;', '"':'&quot;' }[char]));
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
    const pct = Math.min(100, Math.round((player.xp / player.nextXp) * 100));
    target.innerHTML = `
      <article class="quest-player-card frame-${UI.escape(config.frame)} ${compact ? 'compact' : ''}">
        <div class="card-lights"></div>
        <div class="rarity-row"><span>${UI.escape(frame.rarity)}</span><strong>${UI.escape(base.family)}</strong></div>
        <div class="player-card-main">
          <div class="player-avatar-slot">${UI.renderAvatar(config, { size: compact ? 'medium' : 'hero' })}</div>
          <div class="player-info">
            <p class="mini-label">Carte artiste</p>
            <h2>${UI.escape(player.name)}</h2>
            <p class="profile-title">${UI.escape(player.activeTitle)}</p>
            <p class="profile-subtitle">${UI.escape(base.label)} · ${UI.escape(player.discipline)}</p>
          </div>
        </div>
        <div class="xp-block">
          <div class="xp-top"><span>${UI.escape(player.act)} · ${UI.escape(player.levelLabel)}</span><strong>${player.xp} / ${player.nextXp} XP</strong></div>
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
