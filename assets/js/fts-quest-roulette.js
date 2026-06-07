
'use strict';

(function(){
  const data = window.FTSQuestRouletteData || { packs: [], banks: {}, storageKeys: {} };
  const storage = data.storageKeys || {};
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const state = { packId: 'theatre_impro', reels: [], result: {}, spinning: false, custom: {}, saved: [], leverTimer: null };

  function readJSON(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch(e){ return fallback; } }
  function writeJSON(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} }
  function log(msg){ if(window.FTSQuestUI && window.FTSQuestUI.log) window.FTSQuestUI.log(msg); }
  function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
  function getPack(){ return data.packs.find(p => p.id === state.packId) || data.packs[0]; }
  function allItems(bankId){
    const base = (data.banks[bankId] && data.banks[bankId].items) || [];
    const custom = (state.custom[bankId] || []).map(v => `★ ${v}`);
    return base.concat(custom);
  }
  function bankLabel(bankId){ return (data.banks[bankId] && data.banks[bankId].label) || bankId; }
  function countTotalPossibilities(pack){
    return pack.reels.reduce((acc, id) => acc * Math.max(1, allItems(id).length), 1);
  }
  function formatBig(n){
    if(!Number.isFinite(n)) return 'énorme';
    if(n > 1e18) return '+1e18';
    if(n > 1e12) return (n/1e12).toFixed(1).replace('.0','') + ' Bn';
    if(n > 1e9) return (n/1e9).toFixed(1).replace('.0','') + ' Md';
    if(n > 1e6) return (n/1e6).toFixed(1).replace('.0','') + ' M';
    return String(n);
  }

  function renderPackButtons(){
    const wrap = $('#roulettePacks');
    if(!wrap) return;
    wrap.innerHTML = data.packs.map(p => `<button class="roulette-pack ${p.id===state.packId?'active':''}" type="button" data-pack="${p.id}"><strong>${p.label}</strong><span>${p.mode}</span></button>`).join('');
    $$('.roulette-pack', wrap).forEach(btn => btn.addEventListener('click', () => { state.packId = btn.dataset.pack; setupPack(); }));
  }

  function renderReelToggles(){
    const pack = getPack();
    const wrap = $('#reelToggles');
    if(!wrap) return;
    wrap.innerHTML = pack.reels.map(id => `<label class="reel-toggle"><input type="checkbox" checked data-reel="${id}"><span>${bankLabel(id)}</span></label>`).join('');
    $$('.reel-toggle input', wrap).forEach(input => input.addEventListener('change', renderSlot));
  }

  function renderSlot(){
    const pack = getPack();
    const selected = $$('.reel-toggle input:checked').map(i => i.dataset.reel);
    state.reels = selected.length ? selected : pack.reels.slice(0, Math.min(5, pack.reels.length));
    const machine = $('#slotMachine');
    if(!machine) return;
    machine.style.setProperty('--reel-count', Math.min(state.reels.length, 6));
    machine.innerHTML = state.reels.map(id => {
      const value = state.result[id] || '—';
      return `<article class="slot-reel" data-reel="${id}" role="button" tabindex="0" aria-label="Relancer ${bankLabel(id)}">
        <div class="slot-reel-top"><span>${bankLabel(id)}</span><button type="button" data-reroll="${id}" aria-label="Relancer ${bankLabel(id)}">↻</button></div>
        <div class="slot-window"><div class="slot-value">${value}</div></div>
      </article>`;
    }).join('');
    $$('[data-reroll]', machine).forEach(btn => btn.addEventListener('click', (event) => { event.stopPropagation(); pullLever([btn.dataset.reroll]); }));
    $$('.slot-reel', machine).forEach(reel => {
      const relaunch = () => pullLever([reel.dataset.reel]);
      reel.addEventListener('click', relaunch);
      reel.addEventListener('keydown', (event) => {
        if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); relaunch(); }
      });
    });
    updateMeta();
  }

  function updateMeta(){
    const pack = getPack();
    const desc = $('#roulettePackDesc');
    const count = $('#rouletteCount');
    const reels = $('#rouletteReelsCount');
    if(desc) desc.textContent = pack.description;
    if(count) count.textContent = formatBig(countTotalPossibilities(pack));
    if(reels) reels.textContent = state.reels.length;
  }

  function pullLever(reels){
    if(state.spinning) return;
    const lever = $('#slotLever') || $('.slot-lever');
    const machine = $('#slotMachine');
    if(lever){
      lever.classList.remove('pulled');
      void lever.offsetWidth;
      lever.classList.add('pulled');
      clearTimeout(state.leverTimer);
      state.leverTimer = setTimeout(() => lever.classList.remove('pulled'), 650);
    }
    if(machine){
      machine.classList.remove('machine-fired');
      void machine.offsetWidth;
      machine.classList.add('machine-fired');
      setTimeout(() => machine.classList.remove('machine-fired'), 720);
    }
    spin(reels);
  }

  function spin(reels){
    if(state.spinning) return;
    const target = reels && reels.length ? reels : state.reels;
    state.spinning = true;
    const cells = target.map(id => $(`.slot-reel[data-reel="${id}"] .slot-value`)).filter(Boolean);
    cells.forEach(cell => cell.closest('.slot-reel').classList.add('spinning'));
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      target.forEach(id => {
        const cell = $(`.slot-reel[data-reel="${id}"] .slot-value`);
        const items = allItems(id);
        if(cell && items.length) cell.textContent = pick(items);
      });
      if(ticks >= 18){
        clearInterval(timer);
        target.forEach(id => {
          const items = allItems(id);
          state.result[id] = items.length ? pick(items) : '—';
        });
        state.spinning = false;
        writeJSON(storage.last, { packId: state.packId, result: state.result, at: Date.now() });
        renderSlot();
        renderResultText();
        log('🎰 Nouveau tirage roulette généré.');
      }
    }, 55);
  }

  function renderResultText(){
    const box = $('#rouletteResultText');
    if(!box) return;
    const lines = state.reels.map(id => `<li><strong>${bankLabel(id)}</strong><span>${state.result[id] || '—'}</span></li>`).join('');
    box.innerHTML = `<ul class="result-lines">${lines}</ul>`;
  }

  function ensureResult(){
    if(Object.keys(state.result).length) return;
    state.reels.forEach(id => {
      const items = allItems(id);
      state.result[id] = items.length ? pick(items) : '—';
    });
    writeJSON(storage.last, { packId: state.packId, result: state.result, at: Date.now() });
    renderSlot();
    renderResultText();
  }

  function recordRouletteProgress(item, pack){
    const questUI = window.FTSQuestUI;
    if(!questUI || !questUI.Progress) return null;
    const detail = item.reels.map(id => `${bankLabel(id)} : ${item.result[id] || '—'}`).join(' · ');
    return questUI.Progress.recordAction({
      id: `roulette:${pack.id}:${new Date().toISOString().slice(0, 10)}`,
      label: `Tirage travaillé : ${pack.label}`,
      source: 'Roulette scénique',
      detail,
      axis: questUI.Progress.axisForText(`${pack.label} ${detail}`, 'creer'),
      xp: 15,
      href: 'quest-roulette.html'
    });
  }

  function saveCurrent(){
    ensureResult();
    const pack = getPack();
    const item = { id: 'spin_' + Date.now(), packId: pack.id, packLabel: pack.label, result: {...state.result}, reels: state.reels.slice(), at: Date.now() };
    state.saved.unshift(item);
    state.saved = state.saved.slice(0, 20);
    writeJSON(storage.saved, state.saved);
    renderSaved();
    const impact = recordRouletteProgress(item, pack);
    if(impact && impact.added) log('💾 Tirage sauvegardé comme exercice dans ton carnet.');
    else log('💾 Tirage sauvegardé sur cet appareil.');
  }

  function renderSaved(){
    const wrap = $('#savedSpins');
    if(!wrap) return;
    if(!state.saved.length){ wrap.innerHTML = '<p class="empty-state">Aucun tirage sauvegardé pour le moment.</p>'; return; }
    wrap.innerHTML = state.saved.map(item => `<article class="saved-spin"><div><strong>${item.packLabel}</strong><small>${new Date(item.at).toLocaleString('fr-FR')}</small></div><p>${item.reels.map(id => `${bankLabel(id)} : ${item.result[id]}`).join(' · ')}</p></article>`).join('');
  }

  function copyCurrent(){
    const text = state.reels.map(id => `${bankLabel(id)} : ${state.result[id] || '—'}`).join('\n');
    if(navigator.clipboard && text.trim()) navigator.clipboard.writeText(text);
    log('📋 Tirage copié dans le presse-papiers si autorisé par le navigateur.');
  }

  function renderCustomTools(){
    const select = $('#customBank');
    if(select){
      select.innerHTML = Object.keys(data.banks).map(id => `<option value="${id}">${bankLabel(id)}</option>`).join('');
    }
    renderCustomList();
  }
  function renderCustomList(){
    const list = $('#customList');
    if(!list) return;
    const rows = Object.entries(state.custom).flatMap(([bank, items]) => items.map(v => ({bank, v})));
    if(!rows.length){ list.innerHTML = '<p class="empty-state">Aucun ajout pour le moment. L’équipe pourra enrichir les banques d’exercices.</p>'; return; }
    list.innerHTML = rows.map((r, idx) => `<button class="custom-pill" type="button" data-bank="${r.bank}" data-value="${encodeURIComponent(r.v)}"><span>${bankLabel(r.bank)}</span>${r.v}<b>×</b></button>`).join('');
    $$('.custom-pill', list).forEach(btn => btn.addEventListener('click', () => {
      const bank = btn.dataset.bank; const val = decodeURIComponent(btn.dataset.value);
      state.custom[bank] = (state.custom[bank] || []).filter(x => x !== val);
      writeJSON(storage.custom, state.custom);
      renderCustomList(); updateMeta();
    }));
  }

  function setupForm(){
    const form = $('#customForm');
    if(form){
      form.addEventListener('submit', e => {
        e.preventDefault();
        const bank = $('#customBank').value;
        const value = ($('#customValue').value || '').trim();
        if(!value) return;
        state.custom[bank] = state.custom[bank] || [];
        if(!state.custom[bank].includes(value)) state.custom[bank].push(value);
        writeJSON(storage.custom, state.custom);
        $('#customValue').value = '';
        renderCustomList(); updateMeta();
        log('➕ Ajout disponible dans ' + bankLabel(bank) + '.');
      });
    }
    const reset = $('#resetCustoms');
    if(reset) reset.addEventListener('click', () => { state.custom = {}; writeJSON(storage.custom, state.custom); renderCustomList(); updateMeta(); log('🧹 Ajouts remis à zéro sur cet appareil.'); });
  }

  function setupPack(){
    state.result = {};
    renderPackButtons();
    renderReelToggles();
    renderSlot();
    spin();
  }

  function init(){
    state.custom = readJSON(storage.custom, {});
    state.saved = readJSON(storage.saved, []);
    const last = readJSON(storage.last, null);
    if(last && last.packId) { state.packId = last.packId; state.result = last.result || {}; }
    renderPackButtons();
    renderReelToggles();
    renderSlot();
    renderResultText();
    renderSaved();
    renderCustomTools();
    setupForm();
    const spinBtn = $('#spinRoulette'); if(spinBtn) spinBtn.addEventListener('click', () => pullLever());
    const leverBtn = $('#slotLever'); if(leverBtn) leverBtn.addEventListener('click', () => pullLever());
    const machine = $('#slotMachine'); if(machine) machine.addEventListener('dblclick', () => pullLever());
    const machineWrap = $('.slot-machine-wrap');
    if(machineWrap) machineWrap.addEventListener('click', (event) => {
      if(event.target.closest('.slot-reel') || event.target.closest('#slotLever') || event.target.closest('[data-reroll]')) return;
      pullLever();
    });
    const saveBtn = $('#saveSpin'); if(saveBtn) saveBtn.addEventListener('click', saveCurrent);
    const copyBtn = $('#copySpin'); if(copyBtn) copyBtn.addEventListener('click', copyCurrent);
    const clearBtn = $('#clearSaved'); if(clearBtn) clearBtn.addEventListener('click', () => { state.saved=[]; writeJSON(storage.saved, []); renderSaved(); });
    if(!Object.keys(state.result).length) spin();
    log('🎲 Roulette impro initialisée : clique sur le bras ou sur un rouleau pour relancer.');
  }

  document.addEventListener('DOMContentLoaded', () => { try { init(); } catch(err){ console.error(err); log('Erreur roulette : ' + err.message); } });
})();
