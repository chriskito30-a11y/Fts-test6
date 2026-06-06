'use strict';

(function(){
  const data = window.FTSQuestData || {};
  const ui = window.FTSQuestUI || {};
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const storageKey = data.storageKeys?.trophiesState || 'ftsQuest.trophies.state.v1';
  const playerKey = data.storageKeys?.playerProgress || 'ftsQuest.player.progress.v1';

  const baseRewards = data.trophies?.rewards || [];
  const levelScale = data.trophies?.levelScale || [];
  const rarities = ['all','unlocked','locked','common','rare','epic','legendary','mythic'];
  const rarityLabels = {
    all: 'Tout',
    unlocked: 'Débloqués',
    locked: 'Verrouillés',
    common: 'Commun',
    rare: 'Rare',
    epic: 'Épique',
    legendary: 'Légendaire',
    mythic: 'Mythique'
  };

  const state = {
    filter: 'all',
    trophies: {},
    history: [],
    activeTitle: 'Explorateur de scène',
    xpBonus: 0
  };

  function readJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch(e){ return fallback; }
  }

  function writeJSON(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){}
  }

  function log(msg){
    if(ui.log) ui.log(msg);
    else {
      const box = $('#questLog');
      if(box) box.innerHTML = `<p>${msg}</p>` + box.innerHTML;
    }
  }

  function mergedRewards(){
    return baseRewards.map(r => {
      const local = state.trophies[r.id] || {};
      return { ...r, ...local, unlocked: Boolean(local.unlocked ?? r.unlocked) };
    });
  }

  function totalXp(){
    return (data.player?.xp || 0) + state.xpBonus + mergedRewards().filter(r => r.unlocked).reduce((sum,r) => sum + (r.xp || 0), 0);
  }

  function currentLevel(){
    const xp = totalXp();
    return levelScale.find(l => xp >= l.minXp && xp <= l.maxXp) || levelScale[levelScale.length - 1] || {level:1, act:'Acte I', label:'Je découvre', minXp:0, maxXp:100};
  }

  function levelPercent(){
    const lvl = currentLevel();
    const xp = totalXp();
    const span = Math.max(1, lvl.maxXp - lvl.minXp);
    return Math.max(0, Math.min(100, Math.round(((xp - lvl.minXp) / span) * 100)));
  }

  function save(){
    writeJSON(storageKey, {
      trophies: state.trophies,
      history: state.history,
      activeTitle: state.activeTitle,
      xpBonus: state.xpBonus
    });
  }

  function load(){
    const saved = readJSON(storageKey, {});
    state.trophies = saved.trophies || {};
    state.history = saved.history || [];
    state.activeTitle = saved.activeTitle || data.player?.activeTitle || 'Explorateur de scène';
    state.xpBonus = saved.xpBonus || 0;
  }

  function renderProfile(){
    const lvl = currentLevel();
    const xp = totalXp();
    const pct = levelPercent();
    const name = $('#trophyPlayerName');
    const chip = $('#trophyActChip');
    const ring = $('#trophyXpRing');
    const stats = $('#trophyProfileStats');
    const rewards = mergedRewards();
    const badges = rewards.filter(r => r.type === 'badge');
    const titles = rewards.filter(r => r.type === 'title');
    if(name) name.textContent = data.player?.name || 'Artiste FTS';
    if(chip) chip.textContent = `${lvl.act} · Niveau ${lvl.level}`;
    if(ring){
      ring.style.setProperty('--progress', `${pct}%`);
      ring.innerHTML = `<strong>${pct}%</strong><span>${lvl.label}</span>`;
    }
    if(stats){
      stats.innerHTML = `
        <div><strong>${xp}</strong><span>XP total</span></div>
        <div><strong>${badges.filter(r=>r.unlocked).length}/${badges.length}</strong><span>badges</span></div>
        <div><strong>${titles.filter(r=>r.unlocked).length}/${titles.length}</strong><span>titres</span></div>
        <div><strong>${state.activeTitle}</strong><span>titre actif</span></div>
      `;
    }
  }

  function renderActs(){
    const wrap = $('#actTrack');
    if(!wrap) return;
    const xp = totalXp();
    const current = currentLevel();
    wrap.innerHTML = levelScale.map(l => {
      const done = xp > l.maxXp;
      const active = l.level === current.level;
      return `<article class="act-card ${done ? 'done' : ''} ${active ? 'active' : ''}">
        <div class="act-dot">${done ? '✓' : l.level}</div>
        <strong>${l.act}</strong>
        <span>${l.label}</span>
        <small>${l.minXp} XP${l.maxXp < 999999 ? ` → ${l.maxXp} XP` : ' +'}</small>
      </article>`;
    }).join('');
  }

  function renderFilters(){
    const wrap = $('#trophyFilters');
    if(!wrap) return;
    wrap.innerHTML = rarities.map(r => `<button class="trophy-filter ${state.filter===r?'active':''}" type="button" data-filter="${r}">${rarityLabels[r]}</button>`).join('');
    $$('.trophy-filter', wrap).forEach(btn => btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      renderFilters();
      renderGrid();
    }));
  }

  function filteredRewards(){
    return mergedRewards().filter(r => {
      if(state.filter === 'all') return true;
      if(state.filter === 'unlocked') return r.unlocked;
      if(state.filter === 'locked') return !r.unlocked;
      return r.rarity === state.filter;
    });
  }

  function renderGrid(){
    const wrap = $('#trophyGrid');
    if(!wrap) return;
    const rewards = filteredRewards();
    wrap.innerHTML = rewards.map(r => `<article class="trophy-card rarity-${r.rarity} ${r.unlocked ? 'unlocked' : 'locked'}" data-id="${r.id}">
      <div class="trophy-glow"></div>
      <div class="trophy-icon">${r.unlocked ? r.icon : '🔒'}</div>
      <div class="trophy-meta">
        <span>${r.discipline} · ${rarityLabels[r.rarity] || r.rarity}</span>
        <strong>${r.title}</strong>
        <p>${r.condition}</p>
      </div>
      <div class="trophy-reward">${r.xp ? `+${r.xp} XP` : r.type === 'title' ? 'Titre' : 'Badge'}</div>
      ${!r.unlocked ? `<button class="mini-unlock" type="button" data-unlock="${r.id}">Débloquer test</button>` : ''}
    </article>`).join('');
    $$('[data-unlock]', wrap).forEach(btn => btn.addEventListener('click', () => unlockReward(btn.dataset.unlock, true)));
  }

  function renderTitles(){
    const wrap = $('#titleList');
    if(!wrap) return;
    const titles = mergedRewards().filter(r => r.type === 'title');
    wrap.innerHTML = titles.map(t => `<button class="title-choice ${t.unlocked ? 'unlocked' : 'locked'} ${state.activeTitle===t.title?'active':''}" type="button" data-title="${t.title}" ${t.unlocked ? '' : 'disabled'}>
      <span>${t.unlocked ? t.icon : '🔒'}</span>
      <strong>${t.title}</strong>
      <small>${t.condition}</small>
    </button>`).join('');
    $$('.title-choice.unlocked', wrap).forEach(btn => btn.addEventListener('click', () => {
      state.activeTitle = btn.dataset.title;
      save();
      renderAll();
      log('🏷️ Titre actif : ' + state.activeTitle);
    }));
  }

  function renderHistory(){
    const wrap = $('#rewardTimeline');
    if(!wrap) return;
    if(!state.history.length){
      wrap.innerHTML = '<p class="empty-state">Aucune récompense récente. Débloque un badge test pour alimenter le journal.</p>';
      return;
    }
    wrap.innerHTML = state.history.slice(0, 12).map(h => `<article class="timeline-item">
      <span>${h.icon || '🏆'}</span>
      <div><strong>${h.title}</strong><small>${new Date(h.at).toLocaleString('fr-FR')}</small></div>
    </article>`).join('');
  }

  function unlockReward(id, manual){
    const reward = baseRewards.find(r => r.id === id);
    if(!reward) return;
    const current = state.trophies[id] || {};
    if(current.unlocked || reward.unlocked) {
      log('ℹ️ Récompense déjà débloquée : ' + reward.title);
      return;
    }
    state.trophies[id] = { ...current, unlocked: true, unlockedAt: Date.now() };
    state.history.unshift({ id, title: reward.title, icon: reward.icon, at: Date.now(), manual: Boolean(manual) });
    state.history = state.history.slice(0, 30);
    save();
    renderAll();
    log('🏆 Trophée débloqué : ' + reward.title);
  }

  function simulate(){
    const locked = mergedRewards().filter(r => !r.unlocked);
    if(!locked.length){ log('🎉 Tous les trophées sont déjà débloqués dans ce prototype.'); return; }
    const reward = locked[Math.floor(Math.random() * locked.length)];
    unlockReward(reward.id, true);
  }

  function reset(){
    state.trophies = {};
    state.history = [];
    state.activeTitle = data.player?.activeTitle || 'Explorateur de scène';
    state.xpBonus = 0;
    save();
    renderAll();
    log('🧹 Salle des trophées réinitialisée en local.');
  }

  function renderAll(){
    renderProfile();
    renderActs();
    renderFilters();
    renderGrid();
    renderTitles();
    renderHistory();
  }

  function init(){
    load();
    renderAll();
    const sim = $('#simulateReward');
    if(sim) sim.addEventListener('click', simulate);
    const resetBtn = $('#resetTrophies');
    if(resetBtn) resetBtn.addEventListener('click', reset);
    log('🏆 Salle des trophées initialisée.');
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { init(); } catch(err){ console.error(err); log('Erreur trophées : ' + err.message); }
  });
})();
