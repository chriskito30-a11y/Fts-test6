'use strict';

(function(){
  const D = window.FTSQuestData || {};
  const UI = window.FTSQuestUI;
  const keys = D.storageKeys || {};
  const historyKey = keys.codesHistory || 'ftsQuest.codes.history.v1';
  const progressKey = keys.playerProgress || 'ftsQuest.player.progress.v1';

  function readJson(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(err){ return fallback; }
  }
  function writeJson(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function getProgress(){
    return readJson(progressKey, { xp: 0, accepted: 0, rewards: [], usedCodes: {} });
  }
  function saveProgress(progress){ writeJson(progressKey, progress); }
  function getHistory(){ return readJson(historyKey, []); }
  function saveHistory(history){ writeJson(historyKey, history.slice(0, 12)); }
  function codeList(){ return Object.values(D.codes || {}); }

  function addHistory(item){
    const history = getHistory();
    history.unshift({ ...item, at: new Date().toISOString() });
    saveHistory(history);
  }

  function renderRewardPreview(result, ok){
    const target = UI.$('#rewardPreview');
    if (!target) return;
    if (!result) {
      target.innerHTML = '<div class="empty-state"><strong>Aucune récompense sélectionnée</strong><p>Entre un code pour afficher le résultat ici.</p></div>';
      return;
    }
    target.innerHTML = `
      <article class="reward-result ${ok ? 'success' : 'error'}">
        <span class="reward-burst">${ok ? '✦' : '!'}</span>
        <div>
          <p class="mini-label">${ok ? 'Récompense débloquée' : 'Code refusé'}</p>
          <h3>${UI.escape(result.title || 'Code inconnu')}</h3>
          <p>${UI.escape(ok ? result.reward : result.message)}</p>
          ${ok ? `<strong>+${Number(result.xp || 0)} XP</strong>` : ''}
        </div>
      </article>`;
  }

  function renderProgress(){
    const target = UI.$('#codesProgress');
    if (!target) return;
    const progress = getProgress();
    const total = codeList().length || 1;
    const pct = Math.round((Object.keys(progress.usedCodes || {}).length / total) * 100);
    target.innerHTML = `
      <div class="progress-hero"><span>${progress.accepted || 0}</span><div><strong>codes validés</strong><p>${progress.xp || 0} XP prototype gagnés</p></div></div>
      <div class="xp-track"><span style="width:${pct}%"></span></div>
      <div class="reward-pills">${(progress.rewards || []).slice(0,6).map(r => `<span>${UI.escape(r)}</span>`).join('') || '<span>Aucune récompense pour le moment</span>'}</div>
      <button class="quest-btn quest-btn-ghost" id="resetCodesBtn" type="button">Réinitialiser le test local</button>`;
    const reset = UI.$('#resetCodesBtn');
    if (reset) reset.addEventListener('click', () => {
      localStorage.removeItem(progressKey);
      localStorage.removeItem(historyKey);
      UI.log('Codes secrets : test local réinitialisé.');
      initRender();
    });
  }

  function renderHistory(){
    const target = UI.$('#codesHistory');
    if (!target) return;
    const history = getHistory();
    if (!history.length) {
      target.innerHTML = '<div class="empty-state"><strong>Aucun historique</strong><p>Valide un code pour créer une première ligne.</p></div>';
      return;
    }
    target.innerHTML = history.map(item => {
      const d = new Date(item.at);
      return `<article class="history-item ${item.ok ? 'ok' : 'ko'}"><span>${item.ok ? '✓' : '×'}</span><div><strong>${UI.escape(item.code)}</strong><p>${UI.escape(item.message)}</p></div><time>${d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</time></article>`;
    }).join('');
  }

  function renderCodesGrid(){
    const target = UI.$('#codesGrid');
    if (!target) return;
    const progress = getProgress();
    target.innerHTML = codeList().map(code => {
      const used = !!(progress.usedCodes || {})[code.code];
      return `<article class="code-card ${used ? 'used' : ''}">
        <div class="code-card-top"><span>${UI.escape(code.rarity)}</span><em>${UI.escape(code.type)}</em></div>
        <strong>${UI.escape(code.title)}</strong>
        <code>${UI.escape(code.code)}</code>
        <p>${UI.escape(code.description)}</p>
        <ul><li>Récompense : ${UI.escape(code.reward)}</li><li>Cible : ${UI.escape(code.target)}</li><li>Limite : ${UI.escape(code.maxUse)}</li></ul>
        <button class="quest-btn ${used ? 'quest-btn-ghost' : 'quest-btn-primary'} test-code-btn" type="button" data-code="${UI.escape(code.code)}">${used ? 'Déjà utilisé' : 'Tester ce code'}</button>
      </article>`;
    }).join('');
    UI.$$('.test-code-btn', target).forEach(btn => btn.addEventListener('click', () => validateCode(btn.dataset.code)));
  }

  function renderRules(){
    const target = UI.$('#rulesGrid');
    if (!target) return;
    const rules = [
      ['Une fois par membre', 'Chaque code important sera limité pour éviter les abus et le spam XP.'],
      ['Ciblage groupe', 'Un code pourra viser théâtre 10/12, chant performance, profs, bêta testeurs, etc.'],
      ['Expiration', 'Un code de cours peut durer 24h, un code événement peut durer une semaine.'],
      ['Récompenses variées', 'XP, titre, badge, cadre, avatar, indice futur livre-jeu ou case de bingo.'],
      ['Validation serveur plus tard', 'La vraie version Firebase/Worker devra vérifier les droits côté serveur.'],
      ['Pas de classement toxique', 'Les codes valorisent la participation, pas la comparaison publique entre enfants.']
    ];
    target.innerHTML = rules.map((r,i) => `<article class="rule-card"><span>${String(i+1).padStart(2,'0')}</span><strong>${UI.escape(r[0])}</strong><p>${UI.escape(r[1])}</p></article>`).join('');
  }

  function validateCode(raw){
    const code = String(raw || '').trim().toUpperCase();
    if (!code) return;
    const found = (D.codes || {})[code];
    const progress = getProgress();
    if (!found) {
      const msg = 'Code inconnu dans ce prototype.';
      renderRewardPreview({ title: code, message: msg }, false);
      addHistory({ code, ok:false, message: msg });
      UI.log(`Code ${code} refusé : inconnu.`);
      initRender();
      return;
    }
    if (progress.usedCodes && progress.usedCodes[code]) {
      const msg = 'Code déjà utilisé dans ce test local.';
      renderRewardPreview({ title: found.title, message: msg }, false);
      addHistory({ code, ok:false, message: msg });
      UI.log(`Code ${code} refusé : déjà utilisé localement.`);
      initRender();
      return;
    }
    progress.xp = Number(progress.xp || 0) + Number(found.xp || 0);
    progress.accepted = Number(progress.accepted || 0) + 1;
    progress.usedCodes = progress.usedCodes || {};
    progress.usedCodes[code] = true;
    progress.rewards = progress.rewards || [];
    progress.rewards.unshift(found.reward);
    saveProgress(progress);
    renderRewardPreview(found, true);
    addHistory({ code, ok:true, message: `+${found.xp} XP · ${found.reward}` });
    UI.log(`Code ${code} accepté : ${found.reward}`);
    initRender(false);
  }

  function initTabs(){
    UI.$$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.$$('.tab-btn').forEach(item => { item.classList.remove('active'); item.setAttribute('aria-selected','false'); });
        UI.$$('.tab-panel').forEach(item => item.classList.remove('active'));
        btn.classList.add('active'); btn.setAttribute('aria-selected','true');
        const panel = UI.$(`#tab-${btn.dataset.tab}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  function initForm(){
    const form = UI.$('#questCodeForm');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = UI.$('#questCodeInput');
      validateCode(input ? input.value : '');
      if (input) input.value = '';
    });
  }

  function initRender(withPreview=true){
    renderProgress();
    renderHistory();
    renderCodesGrid();
    renderRules();
    if (withPreview) renderRewardPreview(null, false);
    UI.renderLog();
  }

  document.addEventListener('DOMContentLoaded', function(){
    try {
      initTabs();
      initForm();
      initRender();
      UI.initReveal();
    } catch(err) {
      console.error('FTS Quest Codes init error:', err);
      if (UI && UI.log) UI.log('Erreur init Codes : ' + err.message);
    }
  });
})();
