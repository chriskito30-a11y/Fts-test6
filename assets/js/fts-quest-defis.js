'use strict';

(function(){
  const D = window.FTSQuestData;
  const UI = window.FTSQuestUI;
  if (!D || !UI) return;

  const stateKey = D.storageKeys.challengesState || 'ftsQuest.challenges.state.v1';
  let state = loadState();
  let activePackId = state.activePackId || (D.challengePacks && D.challengePacks[0] && D.challengePacks[0].id);

  function loadState(){
    try { return JSON.parse(localStorage.getItem(stateKey) || '{}') || {}; }
    catch(err){ return {}; }
  }

  function saveState(){
    state.activePackId = activePackId;
    localStorage.setItem(stateKey, JSON.stringify(state));
  }

  function key(packId, stepId){ return `${packId}::${stepId}`; }
  function isDone(packId, stepId){ return Boolean(state[key(packId, stepId)]); }

  function setDone(packId, stepId, done){
    const k = key(packId, stepId);
    if (done) state[k] = { done:true, at:new Date().toISOString() };
    else delete state[k];
    saveState();
  }

  function packProgress(pack){
    const total = pack.steps.length || 1;
    const done = pack.steps.filter(step => isDone(pack.id, step.id)).length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }

  function totalProgress(){
    const packs = D.challengePacks || [];
    const total = packs.reduce((sum, pack) => sum + pack.steps.length, 0) || 1;
    const done = packs.reduce((sum, pack) => sum + pack.steps.filter(step => isDone(pack.id, step.id)).length, 0);
    const xp = packs.reduce((sum, pack) => {
      const p = packProgress(pack);
      return sum + Math.round((pack.rewardXp || 0) * (p.done / Math.max(1, p.total)));
    }, 0);
    return { done, total, pct: Math.round((done / total) * 100), xp };
  }

  function renderSummary(){
    const summary = UI.$('#challengeScore');
    const pills = UI.$('#challengePills');
    const t = totalProgress();
    if (summary) {
      summary.innerHTML = `
        <div class="challenge-big-score"><strong>${t.pct}%</strong><span>${t.done}/${t.total} actions validées</span></div>
        <div class="xp-track"><span style="width:${t.pct}%"></span></div>
      `;
    }
    if (pills) {
      pills.innerHTML = `<span>+${t.xp} XP progression</span><span>${(D.challengePacks || []).length} packs</span><span>Suivi personnel</span>`;
    }
  }

  function renderPacks(){
    const target = UI.$('#challengePackGrid');
    if (!target) return;
    target.innerHTML = (D.challengePacks || []).map(pack => {
      const p = packProgress(pack);
      return `
        <button class="challenge-pack-card color-${UI.escape(pack.color)} ${pack.id === activePackId ? 'active' : ''}" type="button" data-pack="${UI.escape(pack.id)}">
          <span class="pack-icon">${UI.escape(pack.icon)}</span>
          <strong>${UI.escape(pack.title)}</strong>
          <p>${UI.escape(pack.subtitle)}</p>
          <div class="pack-meta"><em>${UI.escape(pack.audience)}</em><em>${UI.escape(pack.difficulty)}</em></div>
          <div class="xp-track sm"><span style="width:${p.pct}%"></span></div>
          <small>${p.done}/${p.total} · +${pack.rewardXp} XP</small>
        </button>`;
    }).join('');
    UI.$$('.challenge-pack-card', target).forEach(btn => {
      btn.addEventListener('click', () => {
        activePackId = btn.dataset.pack;
        saveState();
        renderAll();
        UI.log('Pack actif : ' + (getActivePack().title || activePackId));
      });
    });
  }

  function getActivePack(){
    return (D.challengePacks || []).find(pack => pack.id === activePackId) || (D.challengePacks || [])[0];
  }

  function renderActivePack(){
    const pack = getActivePack();
    if (!pack) return;
    const kicker = UI.$('#activePackKicker');
    const title = UI.$('#activePackTitle');
    const subtitle = UI.$('#activePackSubtitle');
    const board = UI.$('#activeChallengeBoard');
    const p = packProgress(pack);
    if (kicker) kicker.textContent = `${pack.icon} ${pack.type} · ${p.done}/${p.total}`;
    if (title) title.textContent = pack.title;
    if (subtitle) subtitle.textContent = pack.subtitle;
    if (!board) return;

    const boardClass = pack.type === 'bingo' ? 'bingo-board' : 'checklist-board';
    board.className = `active-challenge-board ${boardClass}`;
    board.innerHTML = pack.steps.map((step, index) => {
      const done = isDone(pack.id, step.id);
      const axis = UI.Progress?.axisForChallenge ? UI.Progress.axisForChallenge(pack, step) : 'oser';
      const axisMeta = (D.journeyAxes || []).find(item => item.id === axis) || { title:'Oser', icon:'✦' };
      return `
        <button class="challenge-step ${done ? 'done' : ''}" type="button" data-step="${UI.escape(step.id)}">
          <span class="step-index">${done ? '✓' : index + 1}</span>
          <strong>${UI.escape(step.label)}</strong>
          <small>${UI.escape(step.help)}</small>
          <em class="step-axis">${UI.escape(axisMeta.icon)} ${UI.escape(axisMeta.title)}</em>
        </button>`;
    }).join('');

    UI.$$('.challenge-step', board).forEach(btn => {
      btn.addEventListener('click', () => {
        const stepId = btn.dataset.step;
        const next = !isDone(pack.id, stepId);
        setDone(pack.id, stepId, next);
        const step = pack.steps.find(item => item.id === stepId);
        if (next && UI.Progress) {
          UI.Progress.recordAction({
            id: `challenge:${pack.id}:${stepId}`,
            label: step ? step.label : stepId,
            source: pack.title,
            detail: step ? step.help : '',
            axis: UI.Progress.axisForChallenge(pack, step),
            xp: pack.type === 'bingo' ? 10 : 14,
            href: 'quest-defis.html'
          });
        }
        UI.log(`${next ? 'Validé' : 'Annulé'} · ${pack.title} · ${step ? step.label : stepId}`);
        renderAll();
      });
    });
  }

  function renderImpact(){
    const target = UI.$('#missionImpactPanel');
    if (!target || !UI.Progress) return;
    const summary = UI.Progress.summary();
    const impact = summary.lastImpact;
    const pack = getActivePack();
    const packState = pack ? packProgress(pack) : { done:0, total:0 };
    if (!impact) {
      target.innerHTML = `
        <article class="impact-card quiet">
          <span>🎯</span>
          <div>
            <strong>Choisis une action vraiment faite.</strong>
            <p>Le carnet FTS Quest gardera une trace utile : préparation, écoute, répétition, entraide ou scène.</p>
          </div>
        </article>`;
      return;
    }
    const axis = (D.journeyAxes || []).find(item => item.id === impact.action?.axis) || { title:'Parcours', icon:'✦' };
    const unlocked = impact.unlocked || [];
    target.innerHTML = `
      <article class="impact-card ${impact.added ? 'success' : 'quiet'}">
        <span>${impact.added ? '✓' : '↺'}</span>
        <div>
          <strong>${UI.escape(impact.message || 'Progression mise à jour.')}</strong>
          <p>${UI.escape(axis.icon)} ${UI.escape(axis.title)} · +${UI.escape(impact.action?.xp || 0)} XP · ${packState.done}/${packState.total} action(s) dans ce pack.</p>
          ${unlocked.length ? `<small>${unlocked.map(item => `${UI.escape(item.icon || '🏆')} ${UI.escape(item.title)}`).join(' · ')}</small>` : '<small>Une action suffit. Le reste doit rester utile, pas obligatoire.</small>'}
        </div>
      </article>`;
  }

  function initActions(){
    const clear = UI.$('#clearVisibleBtn');
    const reset = UI.$('#resetChallengesBtn');
    if (clear) clear.addEventListener('click', () => {
      const pack = getActivePack();
      pack.steps.forEach(step => setDone(pack.id, step.id, false));
      UI.log('Mission remise à zéro : ' + pack.title);
      renderAll();
    });
    if (reset) reset.addEventListener('click', () => {
      state = {};
      activePackId = (D.challengePacks && D.challengePacks[0] && D.challengePacks[0].id) || activePackId;
      saveState();
      UI.log('Progression défis réinitialisée.');
      renderAll();
    });
  }

  function renderAll(){
    renderSummary();
    renderPacks();
    renderActivePack();
    renderImpact();
    UI.renderLog();
  }

  function init(){
    renderAll();
    initActions();
    UI.initReveal();
  }

  document.addEventListener('DOMContentLoaded', function(){
    try { init(); }
    catch(err){
      console.error('FTS Quest Defis init error:', err);
      if (UI.log) UI.log('Erreur init Défis : ' + err.message);
    }
  });
})();
