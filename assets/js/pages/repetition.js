(function(){
  'use strict';

  const els = {};
  const state = {
    lines: [],
    characters: [],
    currentIndex: 0,
    playing: false,
    awaitingUser: false,
    timeoutId: null,
    voices: []
  };

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    bindElements();
    bindEvents();
    loadVoices();
    renderEmpty();
    updateSpeechStatus();
  }

  function bindElements(){
    ['repScriptInput','repAnalyzeBtn','repClearBtn','repStats','repCharacters','repRoleSelect','repMode','repOwnLines','repPause','repRate','repVoice','repStartBtn','repContinueBtn','repPrevBtn','repNextBtn','repStopBtn','repCurrentLine','repProgressText','repCounter','repMeterBar','repLineList','repSpeechStatus'].forEach(id=>{
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents(){
    els.repAnalyzeBtn.addEventListener('click', analyze);
    els.repClearBtn.addEventListener('click', clearAll);
    els.repStartBtn.addEventListener('click', start);
    els.repContinueBtn.addEventListener('click', continueAfterOwnLine);
    els.repPrevBtn.addEventListener('click', previousLine);
    els.repNextBtn.addEventListener('click', nextLineManual);
    els.repStopBtn.addEventListener('click', stop);
    els.repRoleSelect.addEventListener('change', refreshPlayer);
    els.repMode.addEventListener('change', refreshPlayer);
    els.repOwnLines.addEventListener('change', refreshPlayer);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  function updateSpeechStatus(){
    if (!('speechSynthesis' in window)) {
      els.repSpeechStatus.textContent = 'Voix non compatible';
      return;
    }
    els.repSpeechStatus.textContent = state.voices.length ? 'Voix disponible' : 'Voix du navigateur';
  }

  function loadVoices(){
    if (!('speechSynthesis' in window)) return;
    state.voices = window.speechSynthesis.getVoices() || [];
    const current = els.repVoice.value;
    const french = state.voices.filter(v => /fr|French|France/i.test(`${v.lang} ${v.name}`));
    const ordered = french.length ? french.concat(state.voices.filter(v => !french.includes(v))) : state.voices;
    els.repVoice.innerHTML = '<option value="">Voix par défaut</option>' + ordered.map((voice, index)=>{
      const originalIndex = state.voices.indexOf(voice);
      return `<option value="${originalIndex}">${escapeHtml(voice.name)}${voice.lang ? ' — ' + escapeHtml(voice.lang) : ''}</option>`;
    }).join('');
    if (current) els.repVoice.value = current;
    updateSpeechStatus();
  }

  function analyze(){
    stop(false);
    const text = (els.repScriptInput.value || '').trim();
    const lines = parseScript(text);
    state.lines = lines;
    state.characters = collectCharacters(lines);
    state.currentIndex = 0;
    state.awaitingUser = false;
    renderAnalysis();
    refreshPlayer();
  }

  function parseScript(text){
    if (!text) return [];
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed = [];

    rawLines.forEach(raw => {
      const heading = raw.match(/^#{1,4}\s+(.+)$/);
      if (heading) {
        parsed.push({ speaker:'SCÈNE', text:heading[1].trim(), kind:'stage' });
        return;
      }

      if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('*') && raw.endsWith('*'))) {
        parsed.push({ speaker:'DIDASCALIE', text:cleanStage(raw), kind:'stage' });
        return;
      }

      const line = splitRoleLine(raw);
      if (line) {
        parsed.push({ speaker:normalizeSpeaker(line.speaker), text:line.text.trim(), kind:'line' });
        return;
      }

      if (parsed.length) {
        parsed[parsed.length - 1].text = `${parsed[parsed.length - 1].text} ${raw}`.trim();
      } else {
        parsed.push({ speaker:'TEXTE', text:raw, kind:'stage' });
      }
    });

    return parsed.filter(item => item.text);
  }

  function cleanStage(raw){
    return raw.replace(/^\[/,'').replace(/\]$/,'').replace(/^\*/,'').replace(/\*$/,'').trim();
  }

  function splitRoleLine(raw){
    const value = String(raw || '').trim();
    if (!value || /^[#\[*]/.test(value)) return null;

    // On accepte un rôle en début de ligne, sans obligation de majuscules.
    // Priorité aux séparateurs clairs pour éviter de couper les prénoms composés
    // comme Jean-Pierre. Le point est accepté en dernier pour les formats "Rôle. Réplique".
    const patterns = [
      /^(.{1,70}?)[ \t]*(?::|：|•)[ \t]*(.+)$/u,
      /^(.{1,70}?)[ \t]+(?:—|–|-)[ \t]+(.+)$/u,
      /^(.{1,70}?)(?:—|–)(.+)$/u,
      /^(.{1,70}?)[ \t]*\.[ \t]+(.+)$/u
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (!match) continue;
      const speaker = sanitizeSpeakerCandidate(match[1]);
      const text = String(match[2] || '').trim();
      if (isValidSpeakerCandidate(speaker) && text) {
        return { speaker, text };
      }
    }

    return null;
  }

  function sanitizeSpeakerCandidate(value){
    return String(value || '')
      .replace(/[«»"“”]/g,'')
      .replace(/\s+/g,' ')
      .trim();
  }

  function isValidSpeakerCandidate(value){
    if (!value) return false;
    if (value.length > 70) return false;
    if (!/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/u.test(value)) return false;
    if (/[?!;,]/.test(value)) return false;
    const words = value.split(/\s+/).filter(Boolean);
    return words.length <= 8;
  }

  function normalizeSpeaker(value){
    return String(value || '').replace(/\s+/g,' ').trim().toUpperCase();
  }

  function collectCharacters(lines){
    const excluded = new Set(['DIDASCALIE','SCÈNE','TEXTE']);
    return Array.from(new Set(lines.filter(l => l.kind === 'line' && !excluded.has(l.speaker)).map(l => l.speaker))).sort((a,b)=>a.localeCompare(b,'fr'));
  }

  function renderAnalysis(){
    const lineCount = state.lines.filter(l => l.kind === 'line').length;
    const stageCount = state.lines.filter(l => l.kind === 'stage').length;
    els.repStats.innerHTML = `
      <div><strong>${lineCount}</strong><span>réplique${lineCount>1?'s':''}</span></div>
      <div><strong>${state.characters.length}</strong><span>rôle${state.characters.length>1?'s':''}</span></div>
      <div><strong>${stageCount}</strong><span>didascalie${stageCount>1?'s':''}</span></div>
    `;
    els.repCharacters.innerHTML = state.characters.length
      ? state.characters.map(name => `<span class="rep-tag">${escapeHtml(name)}</span>`).join('')
      : '<span class="rep-tag">Aucun rôle détecté</span>';

    els.repRoleSelect.disabled = !state.characters.length;
    els.repRoleSelect.innerHTML = state.characters.length
      ? '<option value="">Choisir mon rôle</option>' + state.characters.map(name => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join('')
      : '<option value="">Aucun rôle détecté</option>';

    renderLineList();
    setButtons();
  }

  function renderLineList(){
    if (!state.lines.length) {
      els.repLineList.innerHTML = '<div class="rep-empty">Le texte analysé apparaîtra ici.</div>';
      return;
    }
    const role = els.repRoleSelect.value;
    els.repLineList.innerHTML = state.lines.map((line,index)=>{
      const classes = ['rep-line'];
      if (index === state.currentIndex) classes.push('active');
      if (line.speaker === role) classes.push('own');
      return `<div class="${classes.join(' ')}" data-line-index="${index}">
        <div class="rep-line-role">${escapeHtml(line.speaker)}</div>
        <div class="rep-line-text">${escapeHtml(displayTextForLine(line))}</div>
      </div>`;
    }).join('');

    els.repLineList.querySelectorAll('[data-line-index]').forEach(node => {
      node.addEventListener('click', () => {
        stopSpeechOnly();
        state.currentIndex = Number(node.getAttribute('data-line-index')) || 0;
        state.awaitingUser = false;
        refreshPlayer();
      });
    });
  }

  function start(){
    if (!state.lines.length) return;
    if (els.repMode.value !== 'full' && !els.repRoleSelect.value) {
      alert('Choisis ton rôle avant de lancer la répétition.');
      return;
    }
    stopSpeechOnly();
    state.playing = true;
    state.awaitingUser = false;
    state.currentIndex = Math.min(state.currentIndex, state.lines.length - 1);
    setButtons();
    playCurrent();
  }

  function playCurrent(){
    clearPendingTimeout();
    if (!state.playing || !state.lines.length) return;
    if (state.currentIndex >= state.lines.length) {
      finish();
      return;
    }

    const line = state.lines[state.currentIndex];
    const role = els.repRoleSelect.value;
    const mode = els.repMode.value;
    const isOwn = mode !== 'full' && line.speaker === role;

    renderCurrentLine(line, isOwn);
    renderLineList();
    setButtons();

    if (line.kind === 'stage') {
      speak(line.text, () => advance());
      return;
    }

    if (mode === 'full' || !isOwn) {
      speak(`${line.speaker}. ${line.text}`, () => advance());
      return;
    }

    state.awaitingUser = true;
    setButtons();

    if (mode === 'auto') {
      state.timeoutId = setTimeout(() => advance(), Number(els.repPause.value) || 4500);
      return;
    }

    if (mode === 'confirm') {
      state.timeoutId = setTimeout(() => {
        speak(`${line.speaker}. ${line.text}`, () => advance());
      }, Number(els.repPause.value) || 4500);
    }
  }

  function speak(text, onEnd){
    if (!('speechSynthesis' in window)) {
      state.timeoutId = setTimeout(onEnd, 900);
      return;
    }
    stopSpeechOnly(false);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = Number(els.repRate.value) || 1;
    const voiceIndex = els.repVoice.value;
    if (voiceIndex !== '' && state.voices[Number(voiceIndex)]) utterance.voice = state.voices[Number(voiceIndex)];
    utterance.onend = () => onEnd && onEnd();
    utterance.onerror = () => onEnd && onEnd();
    window.speechSynthesis.speak(utterance);
  }

  function advance(){
    state.awaitingUser = false;
    state.currentIndex += 1;
    if (state.currentIndex >= state.lines.length) {
      finish();
      return;
    }
    playCurrent();
  }

  function continueAfterOwnLine(){
    if (!state.awaitingUser) return;
    clearPendingTimeout();
    advance();
  }

  function previousLine(){
    stopSpeechOnly();
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    state.awaitingUser = false;
    refreshPlayer();
    if (state.playing) playCurrent();
  }

  function nextLineManual(){
    stopSpeechOnly();
    state.currentIndex = Math.min(Math.max(0,state.lines.length - 1), state.currentIndex + 1);
    state.awaitingUser = false;
    refreshPlayer();
    if (state.playing) playCurrent();
  }

  function stop(resetText = true){
    clearPendingTimeout();
    stopSpeechOnly(false);
    state.playing = false;
    state.awaitingUser = false;
    setButtons();
    if (resetText) refreshPlayer();
  }

  function stopSpeechOnly(cancel = true){
    if (cancel && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function clearPendingTimeout(){
    if (state.timeoutId) clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }

  function finish(){
    stopSpeechOnly();
    state.playing = false;
    state.awaitingUser = false;
    state.currentIndex = Math.max(0, state.lines.length - 1);
    els.repProgressText.textContent = 'Répétition terminée.';
    setButtons();
    refreshPlayer(false);
  }

  function refreshPlayer(renderList = true){
    if (!state.lines.length) {
      renderEmpty();
      return;
    }
    const line = state.lines[state.currentIndex] || state.lines[0];
    const role = els.repRoleSelect.value;
    const isOwn = els.repMode.value !== 'full' && line && line.speaker === role;
    renderCurrentLine(line, isOwn);
    if (renderList) renderLineList();
    setButtons();
  }

  function renderCurrentLine(line, isOwn){
    if (!line) return renderEmpty();
    const total = state.lines.length;
    const percent = total ? ((state.currentIndex + 1) / total) * 100 : 0;
    els.repCurrentLine.className = 'rep-current' + (isOwn ? ' is-own' : line.kind === 'stage' ? ' is-stage' : ' is-other');
    els.repCurrentLine.innerHTML = `
      <p class="rep-current-role">${isOwn ? 'À toi' : escapeHtml(line.speaker)}</p>
      <p class="rep-current-text">${escapeHtml(displayTextForLine(line))}</p>
    `;
    els.repCounter.textContent = `${Math.min(state.currentIndex + 1,total)} / ${total}`;
    els.repMeterBar.style.width = `${Math.max(0,Math.min(100,percent))}%`;
    els.repProgressText.textContent = isOwn
      ? 'L’app attend ta réplique.'
      : (state.playing ? 'Lecture en cours.' : 'Prêt à lancer depuis cette réplique.');
  }

  function displayTextForLine(line){
    const role = els.repRoleSelect.value;
    const mode = els.repOwnLines.value;
    if (line.kind !== 'line' || line.speaker !== role) return line.text;
    if (mode === 'hide') return '••••••';
    if (mode === 'initials') return toInitials(line.text);
    return line.text;
  }

  function toInitials(text){
    return String(text || '').split(/\s+/).map(word => {
      const first = word.match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/u);
      return first ? first[0] + '…' : word;
    }).join(' ');
  }

  function setButtons(){
    const hasLines = state.lines.length > 0;
    els.repStartBtn.disabled = !hasLines || state.playing;
    els.repStopBtn.disabled = !hasLines || !state.playing;
    els.repPrevBtn.disabled = !hasLines || state.currentIndex <= 0;
    els.repNextBtn.disabled = !hasLines || state.currentIndex >= state.lines.length - 1;
    els.repContinueBtn.disabled = !state.awaitingUser;
  }

  function renderEmpty(){
    els.repCurrentLine.className = 'rep-current';
    els.repCurrentLine.innerHTML = '<p class="rep-current-role">En attente</p><p class="rep-current-text">Analyse un texte, choisis ton rôle, puis lance la répétition.</p>';
    els.repProgressText.textContent = 'Aucun texte lancé.';
    els.repCounter.textContent = '0 / 0';
    els.repMeterBar.style.width = '0%';
    els.repLineList.innerHTML = '<div class="rep-empty">Le texte analysé apparaîtra ici.</div>';
    setButtons();
  }

  function clearAll(){
    stop(false);
    els.repScriptInput.value = '';
    state.lines = [];
    state.characters = [];
    state.currentIndex = 0;
    els.repStats.innerHTML = '<div><strong>0</strong><span>réplique</span></div><div><strong>0</strong><span>rôle</span></div><div><strong>0</strong><span>didascalie</span></div>';
    els.repCharacters.innerHTML = '';
    els.repRoleSelect.disabled = true;
    els.repRoleSelect.innerHTML = '<option value="">Analyse d’abord le texte</option>';
    renderEmpty();
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  }

  function escapeAttr(value){
    return escapeHtml(value).replace(/'/g,'&#39;');
  }
})();
