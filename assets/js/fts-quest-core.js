'use strict';

(function(){
  const D = window.FTSQuestData;
  const UI = window.FTSQuestUI;

  function renderTodayAction(){
    const target = UI.$('#todayQuestCard');
    const action = D.todayAction;
    if (!target || !action) return;
    target.innerHTML = `
      <article class="today-card">
        <div class="today-main">
          <p class="quest-kicker">${UI.escape(action.kicker)}</p>
          <h2>${UI.escape(action.title)}</h2>
          <p>${UI.escape(action.description)}</p>
          <ul class="today-steps">${(action.steps || []).map(step => `<li>${UI.escape(step)}</li>`).join('')}</ul>
        </div>
        <div class="today-side">
          <span>${UI.escape(action.time)}</span>
          <strong>${UI.escape(action.reward)}</strong>
          <a class="quest-btn quest-btn-primary" href="${UI.escape(action.primaryHref)}">${UI.escape(action.primaryLabel)}</a>
          <a class="quest-btn quest-btn-ghost" href="${UI.escape(action.secondaryHref)}">${UI.escape(action.secondaryLabel)}</a>
        </div>
      </article>`;
  }

  function renderJourneyAxes(){
    const target = UI.$('#journeyAxisGrid');
    if (!target || !D.journeyAxes) return;
    const progress = UI.Progress?.summary ? UI.Progress.summary() : { axisList: [] };
    target.innerHTML = D.journeyAxes.map(axis => `
      <article class="journey-axis-card ${progress.axisList.find(item => item.id === axis.id && item.count > 0) ? 'has-progress' : ''}">
        <span>${UI.escape(axis.icon)}</span>
        <strong>${UI.escape(axis.title)}</strong>
        <p>${UI.escape(axis.text)}</p>
        <small>${UI.escape(axis.action)}</small>
        <em>${progress.axisList.find(item => item.id === axis.id)?.count || 0} action(s)</em>
      </article>
    `).join('');
  }

  function renderCoachCard(){
    const target = UI.$('#questCoachCard');
    if (!target || !UI.Progress) return;
    const summary = UI.Progress.summary();
    const hasProgress = summary.totalActions > 0;
    const doneToday = summary.todayCount > 0;
    const title = !hasProgress
      ? 'Commence par une action qui sert vraiment'
      : doneToday
        ? 'Tu as déjà fait avancer ton parcours aujourd’hui'
        : 'Reprends avec une petite action utile';
    const description = !hasProgress
      ? 'Choisis une mission courte : planning, sac, question à poser, ressource à relire ou encouragement à envoyer.'
      : doneToday
        ? 'Tu peux t’arrêter là, ou transformer ton énergie en exercice court avec la roulette scénique.'
        : 'Le meilleur retour, c’est une action de 3 minutes qui prépare le prochain cours ou aide la troupe.';
    const primaryHref = !hasProgress || !doneToday ? 'quest-defis.html' : 'quest-roulette.html';
    const primaryLabel = !hasProgress ? 'Faire ma première mission' : doneToday ? 'Lancer un exercice court' : 'Faire ma mission du jour';
    const lastAction = summary.lastAction;
    target.innerHTML = `
      <article class="coach-card">
        <div class="coach-main">
          <p class="quest-kicker">Coach FTS</p>
          <h2>${UI.escape(title)}</h2>
          <p>${UI.escape(description)}</p>
          <div class="coach-actions">
            <a class="quest-btn quest-btn-primary" href="${UI.escape(primaryHref)}">${UI.escape(primaryLabel)}</a>
            <a class="quest-btn quest-btn-ghost" href="quest-trophees.html">Voir mes traces</a>
          </div>
        </div>
        <div class="coach-side">
          <span>Rythme sain</span>
          <strong>${UI.escape(summary.healthyHint)}</strong>
          ${lastAction ? `<p>Dernière action : ${UI.escape(lastAction.label)}</p>` : '<p>Aucune action enregistrée pour le moment.</p>'}
        </div>
      </article>`;
  }

  function renderProgressRecap(){
    const target = UI.$('#progressRecapGrid');
    if (!target || !UI.Progress) return;
    const summary = UI.Progress.summary();
    const topAxis = summary.topAxis || { label:'Aucun axe', icon:'✦', count:0 };
    const last = summary.lastAction;
    const cards = [
      { icon:'✓', label:'Actions utiles', value: summary.totalActions, text:'Cochées quand elles sont vraiment faites.' },
      { icon:'⚡', label:'XP d’action', value: (D.player?.xp || 0) + summary.xp, text:'Gagnés par préparation, exercice et entraide.' },
      { icon:'📅', label:'Jours actifs', value: summary.activeDays, text:'Un jour compte dès qu’une action utile est faite.' },
      { icon: topAxis.icon, label:'Axe dominant', value: topAxis.label, text: topAxis.count ? `${topAxis.count} action(s) sur cet axe.` : 'À construire avec les prochaines missions.' }
    ];
    target.innerHTML = cards.map(card => `
      <article class="progress-recap-card">
        <span>${UI.escape(card.icon)}</span>
        <small>${UI.escape(card.label)}</small>
        <strong>${UI.escape(card.value)}</strong>
        <p>${UI.escape(card.text)}</p>
      </article>
    `).join('') + `
      <article class="progress-recap-card progress-recap-wide">
        <span>🎬</span>
        <small>Dernière trace</small>
        <strong>${last ? UI.escape(last.label) : 'Rien encore'}</strong>
        <p>${last ? UI.escape(`${last.source} · ${last.xp} XP · ${last.at ? new Date(last.at).toLocaleString('fr-FR') : ''}`) : 'Commence par une mission courte, puis reviens ici voir ton carnet se remplir.'}</p>
      </article>`;
  }

  function renderStats(){
    const target = UI.$('#statsGrid');
    if (!target) return;
    const player = D.player;
    const progress = UI.Progress?.summary ? UI.Progress.summary() : { xp:0, totalActions:player.challenges, activeDays:0 };
    const stats = [
      { icon: '⚡', label: 'XP', value: player.xp + progress.xp },
      { icon: '✓', label: 'Actions', value: progress.totalActions },
      { icon: '📅', label: 'Jours', value: progress.activeDays },
      { icon: '◆', label: 'Badges', value: player.badges }
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
        ${mod.role ? `<small class="module-role">${UI.escape(mod.role)}</small>` : ''}
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
        feedback.textContent = 'Code inconnu. Vérifie l’orthographe ou demande au prof.';
        feedback.classList.remove('success');
        UI.log(`Code ${code} refusé : inconnu.`);
      }
      input.value = '';
    });
  }

  function init(){
    const card = UI.$('#questProfileCard');
    if (card) UI.renderPlayerCard(card, UI.loadAvatar());
    renderTodayAction();
    renderCoachCard();
    renderJourneyAxes();
    renderProgressRecap();
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

  document.addEventListener('DOMContentLoaded', function(){
    try { init(); } catch(err) {
      console.error('FTS Quest Core init error:', err);
      if (window.FTSQuestUI && window.FTSQuestUI.log) window.FTSQuestUI.log('Erreur init Core : ' + err.message);
    }
  });
})();
