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
    voices: [],
    db: null,
    authUser: null,
    profile: null,
    resources: [],
    localPdfFile: null,
    loadingPdf: false
  };

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    bindElements();
    bindEvents();
    loadVoices();
    initPdfEngine();
    initAppDocuments();
    renderEmpty();
    updateSpeechStatus();
  }

  function bindElements(){
    ['repScriptInput','repAnalyzeBtn','repClearBtn','repStats','repCharacters','repRoleSelect','repMode','repOwnLines','repPause','repRate','repVoice','repStartBtn','repContinueBtn','repPrevBtn','repNextBtn','repStopBtn','repCurrentLine','repProgressText','repCounter','repMeterBar','repLineList','repSpeechStatus','repAppStatus','repResourceSelect','repLoadResourcePdfBtn','repLocalPdfInput','repLoadLocalPdfBtn','repPdfStatus'].forEach(id=>{
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
    if (els.repResourceSelect) els.repResourceSelect.addEventListener('change', onResourceSelectChange);
    if (els.repLoadResourcePdfBtn) els.repLoadResourcePdfBtn.addEventListener('click', loadSelectedResourcePdf);
    if (els.repLocalPdfInput) els.repLocalPdfInput.addEventListener('change', onLocalPdfChange);
    if (els.repLoadLocalPdfBtn) els.repLoadLocalPdfBtn.addEventListener('click', loadLocalPdf);
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

  function initPdfEngine(){
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      setPdfStatus('Les PDF texte peuvent être analysés. Les PDF scannés/image ne seront pas lus sans OCR.');
    } else {
      setPdfStatus('Analyse PDF indisponible : la librairie PDF n’a pas été chargée.', false);
    }
  }

  function initAppDocuments(){
    if (!els.repAppStatus || !els.repResourceSelect) return;
    if (typeof firebase === 'undefined' || !window.FTS || !FTS.initFirebase) {
      setAppStatus('App non connectée');
      renderResourceOptions([], 'Connexion Firebase indisponible');
      return;
    }

    try {
      state.db = FTS.initFirebase();
    } catch (err) {
      console.warn('[FTS Répétition] Firebase init', err);
      setAppStatus('Connexion app impossible');
      renderResourceOptions([], 'Impossible de se connecter à l’app');
      return;
    }

    firebase.auth().onAuthStateChanged(async user => {
      state.authUser = user || null;
      if (!user) {
        state.profile = null;
        state.resources = [];
        setAppStatus('Non connecté');
        renderResourceOptions([], 'Connecte-toi à l’app pour voir tes PDF');
        return;
      }
      setAppStatus('Chargement des PDF…');
      try {
        const [profileSnap, resourceSnap] = await Promise.all([
          state.db.ref('fts_users/' + user.uid).once('value'),
          state.db.ref('fts_ressources').once('value')
        ]);
        state.profile = Object.assign({ uid: user.uid }, profileSnap.val() || {});
        const raw = resourceSnap.val() || {};
        state.resources = Object.keys(raw)
          .map(key => normalizeResource(raw[key] || {}, key))
          .filter(resource => resource.active && isPdfResource(resource) && canProfileSeeResource(state.profile, resource))
          .sort((a,b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        renderResourceOptions(state.resources);
        setAppStatus(state.resources.length ? `${state.resources.length} PDF disponible${state.resources.length>1?'s':''}` : 'Aucun PDF disponible');
      } catch (err) {
        console.warn('[FTS Répétition] ressources', err);
        setAppStatus('Lecture impossible');
        renderResourceOptions([], 'Impossible de charger les PDF de l’app');
      }
    });
  }

  function normalizeResource(r, key){
    const cat = r.cat || r.category || r.categorie || r.Categorie || '';
    const subcat = r.subcat || r.subcategory || r.sousCategorie || r.sous_categorie || r['Sous-categorie'] || r['Sous-catégorie'] || '';
    const name = r.name || r.nom || r.Nom || r.titre || r.title || 'Document sans titre';
    const url = r.url || r.content || r.link || r.lien || r.text || r['Contenu ou Lien Google Drive'] || '';
    const type = String(r.type || r.Type || '').toLowerCase();
    const active = r.active !== false && r.status !== 'inactive' && r.visible !== false;
    return Object.assign({}, r, { key, id:key, cat, category:cat, subcat, subcategory:subcat, name, title:name, url, content:url, type, active });
  }

  function isPdfResource(resource){
    const url = String(resource.url || '').toLowerCase();
    const type = String(resource.type || '').toLowerCase();
    return type.includes('pdf') || /\.pdf(?:$|[?#])/i.test(url) || /drive\.google\.com/i.test(url);
  }

  function canProfileSeeResource(profile, resource){
    if (!profile) return false;
    if (profile.role === 'admin' || profile.role === 'prof') return true;
    const cat = norm(resource.cat || resource.category || '');
    const sub = norm(resource.subcat || resource.subcategory || '');
    if (!cat && !sub) return true;
    const tokens = collectProfileTokens(profile);
    if (cat && tokens.has(cat)) return true;
    if (sub && tokens.has(sub)) return true;
    return false;
  }

  function collectProfileTokens(profile){
    const tokens = new Set();
    addTokensFromValue(profile.disciplines, tokens);
    addTokensFromValue(profile.categories, tokens);
    addTokensFromValue(profile.category, tokens);
    addTokensFromValue(profile.subcategories, tokens);
    addTokensFromValue(profile.subcats, tokens);
    addTokensFromValue(profile.groups, tokens);
    addTokensFromValue(profile.groupe, tokens);
    addTokensFromValue(profile.children, tokens);
    addTokensFromValue(profile.enfants, tokens);
    return tokens;
  }

  function addTokensFromValue(value, tokens){
    if (!value) return;
    if (typeof value === 'string') {
      value.split(/[;,|]/).forEach(part => { const n = norm(part); if (n) tokens.add(n); });
      const n = norm(value); if (n) tokens.add(n);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(v => addTokensFromValue(v, tokens));
      return;
    }
    if (typeof value === 'object') {
      Object.keys(value).forEach(k => {
        if (value[k] === true || typeof value[k] === 'string' || Array.isArray(value[k]) || typeof value[k] === 'object') {
          const nk = norm(k); if (nk) tokens.add(nk);
          addTokensFromValue(value[k], tokens);
        }
      });
    }
  }

  function norm(value){
    if (window.FTS && typeof FTS.norm === 'function') return FTS.norm(value);
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  }

  function renderResourceOptions(resources, emptyLabel){
    if (!els.repResourceSelect) return;
    if (!resources.length) {
      els.repResourceSelect.innerHTML = `<option value="">${escapeHtml(emptyLabel || 'Aucun PDF disponible')}</option>`;
      els.repLoadResourcePdfBtn.disabled = true;
      return;
    }
    els.repResourceSelect.innerHTML = '<option value="">Choisir un PDF…</option>' + resources.map(resource => {
      const meta = [resource.cat, resource.subcat].filter(Boolean).join(' · ');
      const label = `${resource.name}${meta ? ' — ' + meta : ''}`;
      return `<option value="${escapeAttr(resource.key)}">${escapeHtml(label)}</option>`;
    }).join('');
    els.repLoadResourcePdfBtn.disabled = true;
  }

  function onResourceSelectChange(){
    els.repLoadResourcePdfBtn.disabled = !els.repResourceSelect.value || state.loadingPdf;
  }

  function onLocalPdfChange(){
    state.localPdfFile = els.repLocalPdfInput && els.repLocalPdfInput.files && els.repLocalPdfInput.files[0] ? els.repLocalPdfInput.files[0] : null;
    els.repLoadLocalPdfBtn.disabled = !state.localPdfFile || state.loadingPdf;
    if (state.localPdfFile) setPdfStatus(`PDF sélectionné : ${state.localPdfFile.name}`);
  }

  async function loadSelectedResourcePdf(){
    const key = els.repResourceSelect.value;
    const resource = state.resources.find(r => r.key === key);
    if (!resource) return;
    await runPdfLoad(async () => {
      setPdfStatus(`Chargement de “${resource.name}”…`);
      const url = normalizePdfUrl(resource.url || resource.content || '');
      if (!url) throw new Error('Cette ressource n’a pas de lien PDF exploitable.');
      const text = await extractPdfTextFromUrl(url);
      applyExtractedText(text, resource.name);
    });
  }

  async function loadLocalPdf(){
    if (!state.localPdfFile) return;
    await runPdfLoad(async () => {
      setPdfStatus(`Analyse de “${state.localPdfFile.name}”…`);
      const buffer = await state.localPdfFile.arrayBuffer();
      const text = await extractPdfTextFromBuffer(buffer);
      applyExtractedText(text, state.localPdfFile.name);
    });
  }

  async function runPdfLoad(task){
    if (state.loadingPdf) return;
    state.loadingPdf = true;
    updatePdfButtons();
    stop(false);
    try {
      await task();
    } catch (err) {
      console.warn('[FTS Répétition] PDF', err);
      const message = err && err.message ? err.message : 'Analyse PDF impossible.';
      setPdfStatus(`${message} Si le PDF est sur Google Drive, télécharge-le puis utilise l’import depuis ce téléphone / PC.`, false);
    } finally {
      state.loadingPdf = false;
      updatePdfButtons();
    }
  }

  function updatePdfButtons(){
    if (els.repLoadResourcePdfBtn) els.repLoadResourcePdfBtn.disabled = state.loadingPdf || !els.repResourceSelect.value;
    if (els.repLoadLocalPdfBtn) els.repLoadLocalPdfBtn.disabled = state.loadingPdf || !state.localPdfFile;
  }

  function normalizePdfUrl(url){
    let value = String(url || '').trim();
    if (!value) return '';
    const drive = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i) || value.match(/[?&]id=([^&]+)/i);
    if (/drive\.google\.com/i.test(value) && drive && drive[1]) {
      value = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(drive[1])}`;
    }
    return value;
  }

  async function extractPdfTextFromUrl(url){
    if (!window.pdfjsLib) throw new Error('La lecture PDF n’est pas disponible sur ce navigateur.');
    const response = await fetch(url, { mode:'cors' });
    if (!response.ok) throw new Error(`PDF inaccessible (${response.status}).`);
    const buffer = await response.arrayBuffer();
    return extractPdfTextFromBuffer(buffer);
  }

  async function extractPdfTextFromBuffer(buffer){
    if (!window.pdfjsLib) throw new Error('La lecture PDF n’est pas disponible sur ce navigateur.');
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      setPdfStatus(`Analyse PDF : page ${pageNumber}/${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      pages.push(await extractPageText(page));
    }
    const text = pages.join('\n\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    if (!text || text.length < 20) throw new Error('Aucun texte exploitable trouvé dans ce PDF. Il est peut-être scanné en image.');
    return text;
  }

  async function extractPageText(page){
    const content = await page.getTextContent();
    const items = (content.items || []).map(item => ({
      text: String(item.str || '').trim(),
      x: item.transform ? item.transform[4] : 0,
      y: item.transform ? item.transform[5] : 0
    })).filter(item => item.text);
    items.sort((a,b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);
    const lines = [];
    items.forEach(item => {
      const last = lines[lines.length - 1];
      if (!last || Math.abs(last.y - item.y) > 3) {
        lines.push({ y:item.y, parts:[item] });
      } else {
        last.parts.push(item);
      }
    });
    return lines.map(line => line.parts.sort((a,b)=>a.x-b.x).map(part => part.text).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
  }

  function applyExtractedText(text, label){
    els.repScriptInput.value = text;
    analyze();
    const lineCount = state.lines.filter(l => l.kind === 'line').length;
    const roleCount = state.characters.length;
    setPdfStatus(`PDF analysé : ${lineCount} réplique${lineCount>1?'s':''}, ${roleCount} rôle${roleCount>1?'s':''} détecté${roleCount>1?'s':''}.`);
    if (!lineCount || !roleCount) {
      setPdfStatus(`Le PDF “${label}” a été lu, mais aucun rôle n’a été détecté. Vérifie que les répliques sont bien en début de ligne avec un séparateur, ex. Alice : Bonjour.`, false);
    }
  }

  function setAppStatus(text){
    if (els.repAppStatus) els.repAppStatus.textContent = text;
  }

  function setPdfStatus(text, ok = true){
    if (!els.repPdfStatus) return;
    els.repPdfStatus.textContent = text;
    els.repPdfStatus.classList.toggle('is-error', ok === false);
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
