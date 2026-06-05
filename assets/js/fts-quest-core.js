'use strict';

(function(){
  const D = window.FTSQuestData;
  const UI = window.FTSQuestUI;

  function renderStats(){
    const target = UI.$('#statsGrid');
    if (!target) return;
    const player = D.player;
    const stats = [
      { icon: '⚡', label: 'XP', value: player.xp },
      { icon: '🏆', label: 'Titres', value: player.titles },
      { icon: '◆', label: 'Badges', value: player.badges },
      { icon: '✓', label: 'Défis', value: player.challenges }
    ];
    target.innerHTML = stats.map(stat => `
      <div class="stat-tile"><span>${stat.icon}</span><strong>${stat.value}</strong><small>${UI.escape(stat.label)}</small></div>
    `).join('');
  }

  function renderAvatarStrip(){
    const target = UI.$('#avatarStrip');
    if (!target) return;
    const active = UI.loadAvatar();
    target.innerHTML = D.bases.slice(0,4).map(base => {
      const cfg = { ...active, base: base.id };
      return `<article class="mini-avatar-card"><div>${UI.renderAvatar(cfg, { size:'small' })}</div><strong>${UI.escape(base.label)}</strong><span>${UI.escape(base.rarity)}</span></article>`;
    }).join('');
  }

  function renderTitles(){
    const target = UI.$('#titleGrid');
    if (!target) return;
    target.innerHTML = D.titles.map(title => `
      <article class="reward-card ${title.unlocked ? 'unlocked' : 'locked'}">
        <span class="reward-icon">${title.unlocked ? '🏆' : '🔒'}</span>
        <strong>${UI.escape(title.label)}</strong>
        <p>${UI.escape(title.description)}</p>
      </article>`).join('');
  }

  function renderMissions(){
    const target = UI.$('#missionGrid');
    if (!target) return;
    target.innerHTML = D.missions.map(mission => `
      <article class="mission-card">
        <div class="mission-head"><strong>${UI.escape(mission.title)}</strong><span>${mission.percent}%</span></div>
        <p>${UI.escape(mission.description)}</p>
        <div class="xp-track sm"><span style="width:${mission.percent}%"></span></div>
        <ul>${mission.steps.map(step => `<li>${UI.escape(step)}</li>`).join('')}</ul>
      </article>`).join('');
  }

  function renderModules(){
    const target = UI.$('#moduleGrid');
    if (!target) return;
    target.innerHTML = D.modules.map(mod => `
      <a class="module-card" href="${UI.escape(mod.href)}" ${mod.href === '#' ? 'aria-disabled="true"' : ''}>
        <span>${UI.escape(mod.status)}</span>
        <strong>${UI.escape(mod.title)}</strong>
        <p>${UI.escape(mod.description)}</p>
      </a>`).join('');
  }

  function initTabs(){
    UI.$$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.$$('.tab-btn').forEach(item => item.classList.remove('active'));
        UI.$$('.tab-panel').forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
        const panel = UI.$(`#tab-${btn.dataset.tab}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  function initCodes(){
    const form = UI.$('#secretCodeForm');
    if (!form) return;
    form.addEventListener('submit', event => {
      event.preventDefault();
      const input = UI.$('#secretCode');
      const feedback = UI.$('#codeFeedback');
      const code = String(input.value || '').trim().toUpperCase();
      const result = D.codes[code];
      if (!code) return;
      if (result) {
        feedback.textContent = `Code accepté : +${result.xp} XP · ${result.reward}`;
        feedback.classList.add('success');
        UI.log(`Code ${code} accepté : ${result.reward}`);
      } else {
        feedback.textContent = 'Code inconnu dans ce prototype.';
        feedback.classList.remove('success');
        UI.log(`Code ${code} refusé : inconnu.`);
      }
      input.value = '';
    });
  }

  function init(){
    const card = UI.$('#questProfileCard');
    if (card) UI.renderPlayerCard(card, UI.loadAvatar());
    renderStats();
    renderAvatarStrip();
    renderTitles();
    renderMissions();
    renderModules();
    initTabs();
    initCodes();
    UI.renderLog();
    UI.initReveal();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
