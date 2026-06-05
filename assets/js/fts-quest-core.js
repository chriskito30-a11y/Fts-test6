'use strict';
(function(){
  const data = window.FTSQuestData;
  const UI = window.FTSQuestUI;
  if (!data || !UI) return;

  function renderStats(){
    const grid = UI.el('#statsGrid');
    grid.innerHTML = data.player.stats.map(stat => `
      <div class="stat-card">
        <i>${UI.escape(stat.icon)}</i>
        <strong>${UI.escape(stat.value)}</strong>
        <span>${UI.escape(stat.label)}</span>
      </div>
    `).join('');
  }

  function renderAvatars(){
    const grid = UI.el('#avatarGrid');
    grid.innerHTML = data.avatars.map(avatar => `
      <article class="avatar-card ${avatar.id === data.player.activeAvatar ? 'active' : ''} ${avatar.unlocked ? '' : 'locked'}" data-avatar-id="${UI.escape(avatar.id)}">
        <span class="rarity">${UI.escape(avatar.rarity)} · ${UI.escape(avatar.family)}</span>
        <div class="mini-avatar">${UI.avatarMarkup(avatar.className)}</div>
        <h3>${UI.escape(avatar.name)}</h3>
        <p>${UI.escape(avatar.description)}</p>
      </article>
    `).join('');
  }

  function renderTitles(){
    const grid = UI.el('#titleGrid');
    grid.innerHTML = data.titles.map(title => `
      <article class="title-card ${title.unlocked ? 'unlocked' : 'locked'}">
        <span class="rarity">${title.unlocked ? 'Débloqué' : 'À gagner'}</span>
        <h3>${UI.escape(title.name)}</h3>
        <p>${UI.escape(title.description)}</p>
      </article>
    `).join('');
  }

  function renderMissions(){
    const grid = UI.el('#missionGrid');
    grid.innerHTML = data.missions.map(mission => `
      <article class="mission-card">
        <h3>${UI.escape(mission.title)}</h3>
        <p>${UI.escape(mission.description)}</p>
        <ul>${mission.steps.map(step => `<li>${UI.escape(step)}</li>`).join('')}</ul>
        <div class="mission-progress">
          <div class="rings" style="--p:${Number(mission.percent)}%">${Number(mission.percent)}%</div>
          <p>Progression prototype</p>
        </div>
      </article>
    `).join('');
  }

  function renderModules(){
    const grid = UI.el('#moduleGrid');
    grid.innerHTML = data.modules.map(module => `
      <article class="module-card">
        <span class="rarity">${UI.escape(module.status)}</span>
        <h3>${UI.escape(module.title)}</h3>
        <p>${UI.escape(module.description)}</p>
        <strong>HTML séparé</strong>
      </article>
    `).join('');
  }

  function bindTabs(){
    UI.els('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        UI.els('.tab-btn').forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
        UI.els('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
        UI.log(`<em>Navigation</em> · onglet ${UI.escape(btn.textContent.trim())}`);
      });
    });
  }

  function bindAvatars(){
    UI.el('#avatarGrid').addEventListener('click', event => {
      const card = event.target.closest('.avatar-card');
      if (!card) return;
      const avatar = data.avatars.find(a => a.id === card.dataset.avatarId);
      if (!avatar) return;
      if (!avatar.unlocked) {
        UI.log(`<em>Avatar verrouillé</em> · ${UI.escape(avatar.name)} sera débloqué plus tard.`);
        return;
      }
      data.player.activeAvatar = avatar.id;
      UI.els('.avatar-card').forEach(c => c.classList.toggle('active', c === card));
      UI.el('#activeAvatarFrame').innerHTML = UI.avatarMarkup(avatar.className);
      UI.log(`<em>Avatar actif</em> · ${UI.escape(avatar.name)}`);
    });
  }

  function bindSecretCodes(){
    UI.el('#secretCodeForm').addEventListener('submit', event => {
      event.preventDefault();
      const input = UI.el('#secretCode');
      const feedback = UI.el('#codeFeedback');
      const code = input.value.trim().toUpperCase();
      const reward = data.codes[code];
      feedback.className = 'form-feedback';
      if (!reward) {
        feedback.textContent = 'Code inconnu dans le prototype. Essaie IMPRO-ETOILE, SHOWTIME ou FTS-QUEST.';
        feedback.classList.add('error');
        UI.log(`<em>Code refusé</em> · ${UI.escape(code || 'vide')}`);
        return;
      }
      data.player.xp += reward.xp;
      const pct = Math.min(100, Math.round((data.player.xp / data.player.nextXp) * 100));
      UI.el('#xpText').textContent = `${data.player.xp} / ${data.player.nextXp} XP`;
      UI.el('#xpFill').style.width = `${pct}%`;
      feedback.textContent = `Bravo ! +${reward.xp} XP · ${reward.reward}`;
      feedback.classList.add('success');
      input.value = '';
      UI.log(`<em>Code validé</em> · ${UI.escape(code)} · +${reward.xp} XP`);
    });
  }

  function bindPanels(){
    UI.els('[data-close-panel]').forEach(btn => btn.addEventListener('click', () => UI.closePanel()));
    UI.els('[data-open-panel]').forEach(btn => btn.addEventListener('click', () => {
      const type = btn.dataset.openPanel;
      if (type === 'roadmap') {
        UI.openPanel('Modules prévus', `<p>Le calendrier de l’avent est sorti du socle : il restera un événement saisonnier à activer plus tard.</p><ul><li>Core autonome</li><li>Avatars premium</li><li>Codes secrets</li><li>Défis / checklists / bingo</li><li>Roulette impro membre + prof</li><li>Livre-jeu interactif illustré</li></ul>`);
      } else {
        UI.openPanel('Options prototype', `<p>Cette brique est volontairement non connectée à Firebase. Elle sert à valider le design, les composants et la logique générale avant intégration.</p><ul><li>Aucune écriture RTDB</li><li>Aucune modification de membres.html</li><li>Aucun worker nécessaire</li></ul>`);
      }
    }));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') UI.closePanel(); });
  }

  function revealOnScroll(){
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold:.12 });
    UI.els('[data-reveal]').forEach(el => obs.observe(el));
  }

  function init(){
    renderStats();
    renderAvatars();
    renderTitles();
    renderMissions();
    renderModules();
    bindTabs();
    bindAvatars();
    bindSecretCodes();
    bindPanels();
    revealOnScroll();
    UI.log('<em>FTS Quest Core</em> initialisé en mode prototype autonome.');
    UI.log('<em>Calendrier de l’avent</em> retiré du socle permanent.');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
