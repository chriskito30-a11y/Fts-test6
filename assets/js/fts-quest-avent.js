'use strict';

(function(){
  const questData = window.FTSQuestData || {};
  const adventData = window.FTSQuestAdventData || { days: [] };
  const ui = window.FTSQuestUI || {};
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const storageKey = questData.storageKeys?.adventState || 'ftsQuest.advent.state.v1';
  const trophiesKey = questData.storageKeys?.trophiesState || 'ftsQuest.trophies.state.v1';
  const statLabels = {
    audace: 'Audace',
    ecoute: 'Écoute',
    creativite: 'Créativité',
    espritEquipe: 'Esprit d’équipe',
    concentration: 'Concentration'
  };

  const state = {
    opened: {},
    inventory: [],
    stats: { audace: 0, ecoute: 0, creativite: 0, espritEquipe: 0, concentration: 0 },
    xp: 0,
    testMode: false,
    selectedDay: null
  };

  function readJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch(e){ return fallback; }
  }

  function writeJSON(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){}
  }

  function log(message){
    if(ui.log) ui.log(message);
    else {
      const box = $('#questLog');
      if(box) box.innerHTML = `<p>${escapeHtml(message)}</p>` + box.innerHTML;
    }
  }

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }

  function todayInfo(){
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return { month, day };
  }

  function isTestFromUrl(){
    const params = new URLSearchParams(location.search);
    return params.get(adventData.testModeParam || 'test') === '1' || params.get('mode') === 'test';
  }

  function load(){
    const saved = readJSON(storageKey, {});
    state.opened = saved.opened || {};
    state.inventory = Array.isArray(saved.inventory) ? saved.inventory : [];
    state.stats = { ...state.stats, ...(saved.stats || {}) };
    state.xp = Number(saved.xp || 0);
    state.testMode = Boolean(saved.testMode || isTestFromUrl());
  }

  function save(){
    writeJSON(storageKey, {
      opened: state.opened,
      inventory: state.inventory,
      stats: state.stats,
      xp: state.xp,
      testMode: state.testMode,
      savedAt: Date.now()
    });
  }

  function openedCount(){ return Object.keys(state.opened).length; }

  function dayStatus(day){
    if(state.opened[day.day]) return 'opened';
    if(state.testMode) return 'available';
    const t = todayInfo();
    if(t.month !== 12) return 'locked';
    if(day.day <= Math.min(t.day, 24)) return 'available';
    return 'locked';
  }

  function statusLabel(status, day){
    if(status === 'opened') return 'Ouverte';
    if(status === 'available') return dayStatus(day) === 'available' ? 'À ouvrir' : 'Disponible';
    return 'Verrouillée';
  }

  function renderGrid(){
    const grid = $('#adventGrid');
    if(!grid) return;
    grid.innerHTML = adventData.days.map(day => {
      const status = dayStatus(day);
      return `<button class="advent-door ${status}" type="button" data-day="${day.day}" ${status === 'locked' ? 'aria-disabled="true"' : ''}>
        <span class="door-glow"></span>
        <strong>${day.day}</strong>
        <em>${escapeHtml(day.icon)}</em>
        <small>${escapeHtml(statusLabel(status, day))}</small>
        <b>${escapeHtml(day.type)}</b>
      </button>`;
    }).join('');

    $$('.advent-door', grid).forEach(btn => btn.addEventListener('click', () => {
      const day = Number(btn.dataset.day);
      const item = adventData.days.find(d => d.day === day);
      if(!item) return;
      const status = dayStatus(item);
      if(status === 'locked') {
        log(`🔒 La case ${day} n’est pas encore disponible.`);
        return;
      }
      openModal(item);
    }));
  }

  function renderSummary(){
    const count = openedCount();
    const ring = $('#adventRing');
    if(ring){
      const pct = Math.round((count / 24) * 100);
      ring.style.setProperty('--progress', `${pct}%`);
      ring.innerHTML = `<strong>${count}/24</strong><span>cases ouvertes</span>`;
    }
    const stats = $('#adventSummaryStats');
    if(stats){
      stats.innerHTML = `
        <div><strong>${state.xp}</strong><span>XP Noël</span></div>
        <div><strong>${state.inventory.length}</strong><span>objets</span></div>
        <div><strong>${state.testMode ? 'Libre' : 'Réel'}</strong><span>mode</span></div>
      `;
    }
    const pill = $('#adventModePill');
    if(pill) pill.textContent = state.testMode ? 'Mode libre actif' : 'Mode réel';
  }

  function renderInventory(){
    const wrap = $('#adventInventory');
    if(!wrap) return;
    if(!state.inventory.length){
      wrap.innerHTML = '<p class="empty-state">Aucun objet pour l’instant. Certaines cases ajoutent des souvenirs dans l’inventaire.</p>';
      return;
    }
    wrap.innerHTML = state.inventory.map(name => `<article class="inventory-item"><span>🎁</span><div><strong>${escapeHtml(name)}</strong><small>Souvenir du Calendrier magique</small></div></article>`).join('');
  }

  function renderStats(){
    const wrap = $('#adventStats');
    if(!wrap) return;
    wrap.innerHTML = Object.entries(statLabels).map(([key, label]) => {
      const value = Number(state.stats[key] || 0);
      const pct = Math.min(100, value * 20);
      return `<div class="adv-stat"><div><strong>${escapeHtml(label)}</strong><b>${value}</b></div><i><em style="width:${pct}%"></em></i></div>`;
    }).join('');
  }

  function renderAll(){
    renderGrid();
    renderSummary();
    renderInventory();
    renderStats();
  }

  function rewardText(day){
    const rewards = [];
    if(day.xp) rewards.push(`+${day.xp} XP Noël`);
    if(day.stat && statLabels[day.stat]) rewards.push(`+1 ${statLabels[day.stat]}`);
    if(day.item) rewards.push(`Objet : ${day.item}`);
    if(day.rewardLabel) rewards.push(day.rewardLabel);
    if(day.titleReward) rewards.push(`Titre : ${day.titleReward}`);
    return rewards;
  }

  function openModal(day){
    state.selectedDay = day.day;
    $('#adventModalIcon').textContent = day.icon;
    $('#adventModalType').textContent = `${day.type} · Case ${day.day}`;
    $('#adventModalTitle').textContent = day.title;
    $('#adventModalText').textContent = day.text;
    $('#adventModalAction').textContent = day.action;
    const rewardBox = $('#adventModalReward');
    const rewards = rewardText(day);
    rewardBox.innerHTML = rewards.length ? `<strong>Surprise</strong>${rewards.map(r => `<span>${escapeHtml(r)}</span>`).join('')}` : '';
    const validate = $('#adventValidate');
    validate.textContent = state.opened[day.day] ? 'Déjà validée · revoir la case' : 'Valider ma surprise';
    const modal = $('#adventModal');
    if(modal?.showModal) modal.showModal();
    else modal.setAttribute('open', 'open');
  }

  function closeModal(){
    const modal = $('#adventModal');
    if(modal?.close) modal.close();
    else modal.removeAttribute('open');
  }

  function unlockTrophy(id){
    if(!id) return;
    const allRewards = questData.trophies?.rewards || [];
    const reward = allRewards.find(r => r.id === id);
    if(!reward) return;
    const saved = readJSON(trophiesKey, { trophies: {}, history: [], activeTitle: questData.player?.activeTitle || 'Explorateur de scène', xpBonus: 0 });
    saved.trophies = saved.trophies || {};
    saved.history = saved.history || [];
    const existing = saved.trophies[id] || {};
    if(existing.unlocked || reward.unlocked) return;
    saved.trophies[id] = { ...existing, unlocked: true, unlockedAt: Date.now() };
    saved.history.unshift({ id, title: reward.title, icon: reward.icon, at: Date.now(), source: 'advent' });
    saved.history = saved.history.slice(0, 30);
    writeJSON(trophiesKey, saved);
  }

  function unlockTitleByName(titleName){
    if(!titleName) return;
    const allRewards = questData.trophies?.rewards || [];
    const reward = allRewards.find(r => r.type === 'title' && r.title === titleName);
    if(reward) unlockTrophy(reward.id);
  }

  function validateSelected(){
    const day = adventData.days.find(d => d.day === state.selectedDay);
    if(!day) return;
    if(!state.opened[day.day]){
      state.opened[day.day] = { openedAt: Date.now(), title: day.title, type: day.type };
      state.xp += Number(day.xp || 0);
      if(day.stat) state.stats[day.stat] = Number(state.stats[day.stat] || 0) + 1;
      if(day.item && !state.inventory.includes(day.item)) state.inventory.push(day.item);
      if(day.rewardId) unlockTrophy(day.rewardId);
      if(day.titleReward) unlockTitleByName(day.titleReward);
      if(ui?.Progress){
        ui.Progress.recordAction({
          id: `advent:day:${day.day}`,
          label: `Case calendrier : ${day.title}`,
          source: 'Calendrier magique',
          detail: [day.type, day.message, day.mission, day.rewardLabel].filter(Boolean).join(' · '),
          axis: ui.Progress.axisForText(`${day.type || ''} ${day.title || ''} ${day.message || ''} ${day.mission || ''}`, 'aider'),
          xp: Math.min(20, Number(day.xp || 8)),
          href: 'quest-avent.html'
        });
      }
      save();
      log(`🎄 Case ${day.day} ouverte : ${day.title}`);
    } else {
      log(`ℹ️ Case ${day.day} déjà ouverte.`);
    }
    renderAll();
    closeModal();
  }

  function openToday(){
    const t = todayInfo();
    let dayNumber = t.month === 12 ? Math.min(t.day, 24) : 1;
    if(state.testMode){
      const next = adventData.days.find(d => !state.opened[d.day]);
      dayNumber = next?.day || 24;
    }
    const day = adventData.days.find(d => d.day === dayNumber);
    if(dayStatus(day) === 'locked') {
      log('🎄 Le calendrier est prêt. Active le mode libre pour ouvrir les cases hors décembre.');
      return;
    }
    openModal(day);
  }

  function toggleTestMode(){
    state.testMode = !state.testMode;
    save();
    renderAll();
    log(state.testMode ? '✨ Mode libre activé : les 24 cases sont ouvrables.' : '🎄 Mode réel activé : verrouillage par date.');
  }

  function bind(){
    $('#openTodayBtn')?.addEventListener('click', openToday);
    $('#showProgressBtn')?.addEventListener('click', () => {
      document.querySelector('.advent-lower')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#toggleAdventTest')?.addEventListener('click', toggleTestMode);
    $('#adventClose')?.addEventListener('click', closeModal);
    $('#adventValidate')?.addEventListener('click', validateSelected);
    $('#adventModal')?.addEventListener('click', (event) => {
      if(event.target?.id === 'adventModal') closeModal();
    });
  }

  function init(){
    load();
    bind();
    renderAll();
    log('🎄 Calendrier magique prêt.');
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { init(); } catch(err){ console.error(err); log('Erreur calendrier : ' + err.message); }
  });
})();
