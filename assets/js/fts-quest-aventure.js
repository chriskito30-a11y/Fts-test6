'use strict';

(function(){
  const quest = window.FTSQuestAdventureData || {};
  const base = window.FTSQuestData || {};
  const ui = window.FTSQuestUI || {};
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const storageKey = base.storageKeys?.adventureState || 'ftsQuest.aventure.state.v1';
  const trophiesKey = base.storageKeys?.trophiesState || 'ftsQuest.trophies.state.v1';
  const initialStats = () => Object.fromEntries((quest.stats || []).map(stat => [stat.id, 0]));

  const state = {
    currentScene: quest.startScene || 'scene_001',
    visited: [],
    inventory: [],
    stats: initialStats(),
    history: [],
    endings: [],
    completedRewards: []
  };

  function escape(value){ return ui.escape ? ui.escape(value) : String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
  function readJSON(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch(e){ return fallback; } }
  function writeJSON(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} }
  function log(message){ if(ui.log) ui.log(message); }

  function scene(id){ return quest.scenes?.[id] || quest.scenes?.[quest.startScene]; }
  function hasItem(id){ return state.inventory.includes(id); }
  function addItem(id){ if(id && !hasItem(id)) state.inventory.push(id); }
  function hasAll(items){ return !items || !items.length || items.every(hasItem); }
  function hasAny(items){ return !items || !items.length || items.some(hasItem); }

  function resetRun(target){
    state.currentScene = target || quest.startScene;
    state.visited = [];
    state.inventory = [];
    state.stats = initialStats();
    state.history = [];
    save(false);
  }

  function load(){
    const saved = readJSON(storageKey, null);
    if(!saved) return;
    state.currentScene = saved.currentScene || state.currentScene;
    state.visited = Array.isArray(saved.visited) ? saved.visited : [];
    state.inventory = Array.isArray(saved.inventory) ? saved.inventory : [];
    state.stats = { ...initialStats(), ...(saved.stats || {}) };
    state.history = Array.isArray(saved.history) ? saved.history : [];
    state.endings = Array.isArray(saved.endings) ? saved.endings : [];
    state.completedRewards = Array.isArray(saved.completedRewards) ? saved.completedRewards : [];
  }

  function save(showLog=true){
    writeJSON(storageKey, { ...state, savedAt: Date.now() });
    if(showLog) log('💾 Aventure sauvegardée sur ce navigateur.');
  }

  function unlockTrophy(id){
    if(!id || state.completedRewards.includes(id)) return;
    const reward = base.trophies?.rewards?.find(r => r.id === id);
    if(!reward) return;
    const store = readJSON(trophiesKey, {});
    store.trophies = store.trophies || {};
    store.history = Array.isArray(store.history) ? store.history : [];
    const already = store.trophies[id]?.unlocked || reward.unlocked;
    if(!already){
      store.trophies[id] = { ...(store.trophies[id] || {}), unlocked: true, unlockedAt: Date.now() };
      store.history.unshift({ id, title: reward.title, icon: reward.icon, at: Date.now(), manual: false, source: 'quest-aventure' });
      store.history = store.history.slice(0, 30);
      writeJSON(trophiesKey, store);
      log('🏆 Trophée aventure débloqué : ' + reward.title);
    }
    state.completedRewards.push(id);
  }

  function applyEffects(choice){
    if(choice.resetRun){ resetRun(choice.target || quest.startScene); return; }
    Object.entries(choice.effects || {}).forEach(([key, value]) => {
      state.stats[key] = Math.max(0, (state.stats[key] || 0) + Number(value || 0));
    });
    (choice.addItems || []).forEach(addItem);
    if(choice.label){
      state.history.unshift({ label: choice.label, at: Date.now() });
      state.history = state.history.slice(0, 8);
    }
  }

  function choose(choice){
    if(choice.href){ window.location.href = choice.href; return; }
    if(!hasAll(choice.requiresAll) || !hasAny(choice.requiresAny)) return;
    applyEffects(choice);
    if(!choice.resetRun && choice.target) state.currentScene = choice.target;
    render();
    save(false);
  }

  function availableChoices(s){
    return (s.choices || []).map(choice => ({
      ...choice,
      locked: !hasAll(choice.requiresAll) || !hasAny(choice.requiresAny)
    }));
  }

  function requirementLabel(choice){
    const names = ids => (ids || []).map(id => quest.items?.[id]?.label || id).join(', ');
    if(choice.requiresAll && !hasAll(choice.requiresAll)) return 'Nécessite : ' + names(choice.requiresAll);
    if(choice.requiresAny && !hasAny(choice.requiresAny)) return 'Nécessite au moins : ' + names(choice.requiresAny);
    return '';
  }

  function renderScene(s){
    const visual = $('#sceneVisual');
    const chapter = $('#sceneChapter');
    const title = $('#sceneTitle');
    const text = $('#sceneText');
    const reward = $('#sceneReward');
    const choices = $('#choiceList');
    if(visual) visual.innerHTML = `<span>${escape(s.icon || '🎭')}</span><em>${escape(s.mood || '')}</em>`;
    if(chapter) chapter.textContent = quest.chapters?.[s.chapter] || s.chapter || '';
    if(title) title.textContent = s.title || '';
    if(text) text.innerHTML = (s.text || []).map(p => `<p>${escape(p)}</p>`).join('');
    if(reward){
      if(s.ending){
        reward.hidden = false;
        reward.innerHTML = s.ending === 'good' ? '🏆 Bonne fin débloquée : la troupe est prête pour le dernier rappel.' : '🎟️ Fin alternative débloquée : le mystère reste partiellement ouvert.';
      } else {
        reward.hidden = true;
        reward.innerHTML = '';
      }
    }
    if(choices){
      choices.innerHTML = availableChoices(s).map((choice, index) => {
        const req = requirementLabel(choice);
        const gains = Object.entries(choice.effects || {}).map(([k,v]) => `+${v} ${labelForStat(k)}`).join(' · ');
        const items = (choice.addItems || []).filter(id => !hasItem(id)).map(id => `${quest.items?.[id]?.icon || '◆'} ${quest.items?.[id]?.label || id}`).join(' · ');
        return `<button class="adventure-choice ${choice.locked ? 'locked' : ''}" type="button" data-choice="${index}" ${choice.locked ? 'disabled' : ''}>
          <strong>${escape(choice.label)}</strong>
          ${req ? `<small>${escape(req)}</small>` : ''}
          ${gains ? `<small>${escape(gains)}</small>` : ''}
          ${items ? `<small>Objet possible : ${escape(items)}</small>` : ''}
        </button>`;
      }).join('');
      $$('[data-choice]', choices).forEach(btn => btn.addEventListener('click', () => choose(availableChoices(s)[Number(btn.dataset.choice)])));
    }
  }

  function labelForStat(id){ return (quest.stats || []).find(s => s.id === id)?.label || id; }

  function renderInventory(){
    const target = $('#inventoryList');
    if(!target) return;
    if(!state.inventory.length){
      target.innerHTML = '<p class="empty-state">Ton sac est vide. Explore les salles pour trouver des indices.</p>';
      return;
    }
    target.innerHTML = state.inventory.map(id => {
      const item = quest.items?.[id] || { label:id, icon:'◆', description:'' };
      return `<article class="inventory-item"><span>${escape(item.icon)}</span><div><strong>${escape(item.label)}</strong><small>${escape(item.description)}</small></div></article>`;
    }).join('');
  }

  function renderStats(){
    const blocks = [$('#adventureStats'), $('#adventureMiniStats')].filter(Boolean);
    const html = (quest.stats || []).map(stat => {
      const value = state.stats[stat.id] || 0;
      const pct = Math.min(100, value * 18);
      return `<div class="adv-stat"><div><span>${escape(stat.icon)}</span><strong>${escape(stat.label)}</strong><b>${value}</b></div><i><em style="width:${pct}%"></em></i></div>`;
    }).join('');
    blocks.forEach(el => { el.innerHTML = html; });
  }

  function renderHistory(){
    const target = $('#adventureHistory');
    if(!target) return;
    if(!state.history.length){ target.innerHTML = '<p class="empty-state">Tes choix importants apparaîtront ici.</p>'; return; }
    target.innerHTML = state.history.map(h => `<p>› ${escape(h.label)}</p>`).join('');
  }

  function renderProgress(s){
    const ids = Object.keys(quest.scenes || {});
    if(!state.visited.includes(state.currentScene)) state.visited.push(state.currentScene);
    const pct = Math.round((state.visited.length / Math.max(1, ids.length)) * 100);
    const ring = $('#adventureProgressRing');
    const title = $('#adventureProgressTitle');
    const count = $('#adventureSceneCount');
    if(ring){ ring.style.setProperty('--progress', `${pct}%`); ring.innerHTML = `<strong>${pct}%</strong><span>exploré</span>`; }
    if(title) title.textContent = quest.chapters?.[s.chapter]?.replace(/^Chapitre /,'Acte ') || 'Aventure';
    if(count) count.textContent = `${state.visited.length}/${ids.length}`;
  }

  function handleSceneRewards(s){
    if(s.ending && !state.endings.includes(s.ending)){
      state.endings.push(s.ending);
      (s.rewards || []).forEach(unlockTrophy);
      save(false);
    }
  }

  function render(){
    const s = scene(state.currentScene);
    if(!s) return;
    renderProgress(s);
    renderScene(s);
    renderInventory();
    renderStats();
    renderHistory();
    handleSceneRewards(s);
  }

  function init(){
    load();
    render();
    if(ui.renderLog) ui.renderLog();
    if(ui.initReveal) ui.initReveal();
    $('#adventureStart')?.addEventListener('click', () => { render(); log('🎭 Aventure chargée : ' + quest.title); });
    $('#adventureSave')?.addEventListener('click', () => save(true));
    $('#adventureReset')?.addEventListener('click', () => { resetRun(quest.startScene); render(); log('↺ Aventure recommencée.'); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { init(); } catch(err){ console.error('FTS Quest Adventure init error:', err); log('Erreur aventure : ' + err.message); }
  });
})();
