(function(){
  'use strict';

  const REPETITION_VERSION = 'V112';

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
    loadingPdf: false,
    playToken: 0,
    ignoredSpeakers: new Set(),
    roleVoicePrefs: {},
    currentScriptId: '',
    currentScriptLabel: '',
    sections: [],
    directResourceHandled: false,
    difficultLines: new Set(),
    focusDifficultOnly: false,
    currentView: 'library'
  };

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    bindElements();
    bindEvents();
    loadVoices();
    scheduleVoiceReloads();
    initPdfEngine();
    initAppDocuments();
    renderResumeCard();
    renderEmpty();
    setView('library');
    updateSpeechStatus();
  }

  function bindElements(){
    ['repScriptInput','repAnalyzeBtn','repClearBtn','repStats','repCharacters','repRoleSelect','repRoleReadControls','repMode','repOwnLines','repPause','repRate','repVoice','repStartBtn','repContinueBtn','repCueBtn','repDifficultBtn','repReviewDifficultBtn','repExitDifficultBtn','repDifficultCount','repTrainingPresets','repRestartBtn','repPrevBtn','repNextBtn','repStopBtn','repCurrentLine','repProgressText','repCounter','repMeterBar','repLineList','repSpeechStatus','repAppStatus','repResourceSelect','repLoadResourcePdfBtn','repReloadAppPdfBtn','repLocalPdfInput','repLoadLocalPdfBtn','repPdfStatus','repAppDebug','repAppDebugWrap','repResumeCard','repResumeTitle','repResumeMeta','repResumeBtn','repForgetResumeBtn','repOfflineLibrary','repOfflineCount','repOfflineList','repSectionSelect','repSectionNav','repBackToLibraryBtn','repBackToRoleBtn','repBeginRehearsalBtn','repOpenSettingsBtn','repBackToLibraryFromPlayerBtn','repSettingsBtn','repToggleScriptBtn'].forEach(id=>{
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents(){
    els.repAnalyzeBtn.addEventListener('click', analyze);
    els.repClearBtn.addEventListener('click', clearAll);
    els.repStartBtn.addEventListener('click', start);
    els.repContinueBtn.addEventListener('click', continueAfterOwnLine);
    if (els.repCueBtn) els.repCueBtn.addEventListener('click', cueOwnLine);
    if (els.repDifficultBtn) els.repDifficultBtn.addEventListener('click', toggleDifficultLine);
    if (els.repReviewDifficultBtn) els.repReviewDifficultBtn.addEventListener('click', startDifficultReview);
    if (els.repExitDifficultBtn) els.repExitDifficultBtn.addEventListener('click', exitDifficultReview);
    if (els.repTrainingPresets) {
      els.repTrainingPresets.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => applyTrainingPreset(btn.getAttribute('data-preset') || 'discover'));
      });
    }
    if (els.repRestartBtn) els.repRestartBtn.addEventListener('click', restartFromBeginning);
    els.repPrevBtn.addEventListener('click', previousLine);
    els.repNextBtn.addEventListener('click', nextLineManual);
    els.repStopBtn.addEventListener('click', stop);
    els.repRoleSelect.addEventListener('change', () => { stop(false); state.currentIndex = 0; state.awaitingUser = false; state.focusDifficultOnly = false; refreshPlayer(); renderRoleChoices(); updateDifficultUi(); saveCurrentScriptSettings(); if (getSelectedRole() && (state.currentView === 'role' || state.currentView === 'library')) setView('mode'); });
    els.repMode.addEventListener('change', () => { refreshPlayer(); saveCurrentScriptSettings(); });
    els.repOwnLines.addEventListener('change', () => { refreshPlayer(); saveCurrentScriptSettings(); });
    els.repPause.addEventListener('change', saveCurrentScriptSettings);
    els.repRate.addEventListener('change', saveCurrentScriptSettings);
    els.repVoice.addEventListener('change', saveCurrentScriptSettings);
    if (els.repResourceSelect) els.repResourceSelect.addEventListener('change', onResourceSelectChange);
    if (els.repLoadResourcePdfBtn) els.repLoadResourcePdfBtn.addEventListener('click', loadSelectedResourcePdf);
    if (els.repReloadAppPdfBtn) els.repReloadAppPdfBtn.addEventListener('click', () => loadAppDocumentsForCurrentUser(true));
    if (els.repLocalPdfInput) els.repLocalPdfInput.addEventListener('change', onLocalPdfChange);
    if (els.repLoadLocalPdfBtn) els.repLoadLocalPdfBtn.addEventListener('click', loadLocalPdf);
    if (els.repResumeBtn) els.repResumeBtn.addEventListener('click', resumeLastScript);
    if (els.repForgetResumeBtn) els.repForgetResumeBtn.addEventListener('click', forgetLastScript);
    if (els.repSectionSelect) els.repSectionSelect.addEventListener('change', goToSelectedSection);
    document.querySelectorAll('[data-view-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view-target') || 'library';
        if (view === 'role' && !state.lines.length) return;
        if ((view === 'mode' || view === 'rehearse') && !getSelectedRole()) return;
        setView(view);
        if (view === 'rehearse') refreshPlayer();
      });
    });
    if (els.repBackToLibraryBtn) els.repBackToLibraryBtn.addEventListener('click', () => setView('library'));
    if (els.repBackToRoleBtn) els.repBackToRoleBtn.addEventListener('click', () => setView('role'));
    if (els.repBeginRehearsalBtn) els.repBeginRehearsalBtn.addEventListener('click', () => enterRehearsal(false));
    if (els.repOpenSettingsBtn) els.repOpenSettingsBtn.addEventListener('click', () => setView('settings'));
    if (els.repBackToLibraryFromPlayerBtn) els.repBackToLibraryFromPlayerBtn.addEventListener('click', () => { stop(false); setView('library'); });
    if (els.repSettingsBtn) els.repSettingsBtn.addEventListener('click', () => setView('settings'));
    if (els.repToggleScriptBtn) els.repToggleScriptBtn.addEventListener('click', toggleScriptPanel);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  function setView(view){
    const allowed = ['library','role','mode','settings','rehearse'];
    const next = allowed.includes(view) ? view : 'library';
    state.currentView = next;
    document.body.setAttribute('data-rep-view', next);
    document.body.classList.toggle('rep-show-script', false);
    document.querySelectorAll('[data-view-target]').forEach(btn => {
      const target = btn.getAttribute('data-view-target') || '';
      const active = target === next || (next === 'settings' && target === 'mode');
      btn.classList.toggle('is-active', active);
    });
    if (next === 'rehearse') refreshPlayer(false);
    setButtons();
    scrollToTopSoft();
  }

  function scrollToTopSoft(){
    try { window.scrollTo({ top:0, behavior:'smooth' }); } catch(e) { window.scrollTo(0,0); }
  }

  function getSelectedRole(){
    return els.repRoleSelect ? els.repRoleSelect.value : '';
  }

  function enterRehearsal(autoStart){
    if (!state.lines.length) {
      alert('Choisis d’abord un texte.');
      setView('library');
      return;
    }
    if (els.repMode && els.repMode.value !== 'full' && !getSelectedRole()) {
      alert('Choisis d’abord ton personnage.');
      setView('role');
      return;
    }
    setView('rehearse');
    refreshPlayer();
    saveCurrentScriptSettings();
    if (autoStart) start();
  }

  function toggleScriptPanel(){
    document.body.classList.toggle('rep-show-script');
    if (document.body.classList.contains('rep-show-script')) renderLineList();
  }

  function updateSpeechStatus(){
    if (!('speechSynthesis' in window)) {
      els.repSpeechStatus.textContent = 'Voix non compatible';
      return;
    }
    els.repSpeechStatus.textContent = state.voices.length ? 'Voix disponible' : 'Voix du navigateur';
  }

  function scheduleVoiceReloads(){
    // Sur mobile, les voix arrivent parfois après le chargement de la page.
    // On relit plusieurs fois sans toucher à la boucle de lecture stable.
    [250, 900, 1800, 3200].forEach(delay => {
      setTimeout(() => loadVoices(true), delay);
    });
  }

  function loadVoices(silent){
    if (!('speechSynthesis' in window)) return;
    const previousSignature = (state.voices || []).map(v => `${v.name}|${v.lang}|${v.voiceURI}`).join('||');
    state.voices = window.speechSynthesis.getVoices() || [];
    const current = els.repVoice.value;
    const french = getFrenchVoices();
    const ordered = french.length ? french.concat(state.voices.filter(v => !french.includes(v))) : state.voices;
    els.repVoice.innerHTML = '<option value="">Voix par défaut</option>' + ordered.map((voice)=>{
      const originalIndex = state.voices.indexOf(voice);
      const gender = inferVoiceGender(voice);
      const genderLabel = gender === 'female' ? ' · femme' : gender === 'male' ? ' · homme' : '';
      return `<option value="${originalIndex}">${escapeHtml(voice.name)}${voice.lang ? ' — ' + escapeHtml(voice.lang) : ''}${genderLabel}</option>`;
    }).join('');
    if (current && state.voices[Number(current)]) els.repVoice.value = current;
    updateSpeechStatus();
    const nextSignature = (state.voices || []).map(v => `${v.name}|${v.lang}|${v.voiceURI}`).join('||');
    if (state.characters && state.characters.length && (!silent || previousSignature !== nextSignature)) renderRoleReadControls();
  }

  function initPdfEngine(){
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      setPdfStatus('Choisis un PDF, puis l’app te proposera automatiquement ton rôle.');
    } else {
      setPdfStatus('Analyse PDF indisponible : la librairie PDF n’a pas été chargée.', false);
    }
  }

  function initAppDocuments(){
    if (!els.repAppStatus || !els.repResourceSelect) return;
    if (typeof firebase === 'undefined' || !window.FTS || !FTS.initFirebase) {
      setAppStatus('Connexion app indisponible');
      renderResourceOptions([], 'Connexion Firebase indisponible');
      setAppDebug('Firebase indisponible sur cette page.', true);
      return;
    }

    try {
      state.db = FTS.initFirebase();
    } catch (err) {
      console.warn('[FTS Répétition] Firebase init', err);
      setAppStatus('Connexion app impossible');
      renderResourceOptions([], 'Impossible de se connecter à l’app');
      setAppDebug(getErrorMessage(err), true);
      return;
    }

    firebase.auth().onAuthStateChanged(async user => {
      state.authUser = user || null;
      try {
        if (user && user.uid) localStorage.setItem('fts_repetition_lastUid', user.uid);
      } catch(e) {}
      renderResumeCard();
      renderOfflineLibrary();
      if (!user) {
        state.profile = null;
        state.resources = [];
        setAppStatus('Connecte-toi pour voir tes PDF');
        renderResourceOptions([], 'Connecte-toi à l’app pour voir tes PDF');
        setAppDebug('', false);
        renderOfflineLibrary();
        return;
      }
      await loadAppDocumentsForCurrentUser(false);
    });
  }


  async function loadAppDocumentsForCurrentUser(manual){
    if (!els.repAppStatus || !els.repResourceSelect) return;
    const user = state.authUser || (firebase.auth && firebase.auth().currentUser) || null;
    if (!user) {
      state.profile = null;
      state.resources = [];
      setAppStatus('Connecte-toi pour voir tes PDF');
      renderResourceOptions([], 'Connecte-toi à l’app pour voir tes PDF');
      setAppDebug('', false);
      return;
    }

    setAppStatus(manual ? 'Rechargement des PDF…' : 'Chargement des PDF…');
    renderResourceOptions([], manual ? 'Rechargement…' : 'Chargement des documents…');
    if (els.repReloadAppPdfBtn) els.repReloadAppPdfBtn.disabled = true;

    const debug = {
      uid: user.uid,
      email: user.email || '',
      profileRead: false,
      resourcesRead: false,
      resourcesPath: '',
      totalResources: 0,
      pdfResources: 0,
      visiblePdfResources: 0,
      categoriesDetectees: [],
      sousCategoriesDetectees: [],
      erreurProfil: '',
      erreurRessources: ''
    };

    try {
      let profileData = null;
      try {
        const profileSnap = await state.db.ref('fts_users/' + user.uid).once('value');
        profileData = profileSnap.val() || {};
        debug.profileRead = true;
      } catch (profileErr) {
        debug.erreurProfil = getErrorMessage(profileErr);
        throw new Error('Profil membre inaccessible : ' + debug.erreurProfil);
      }

      state.profile = Object.assign({ uid: user.uid, email:user.email || '' }, profileData || {});
      const access = collectProfileAccess(state.profile);
      debug.categoriesDetectees = Array.from(access.cats).sort();
      debug.sousCategoriesDetectees = Array.from(access.subs).sort();

      let raw = null;
      try {
        const snap = await state.db.ref('fts_ressources').once('value');
        raw = snap.val() || {};
        debug.resourcesPath = 'fts_ressources';
        debug.resourcesRead = true;
      } catch (resourceErr) {
        debug.erreurRessources = 'fts_ressources : ' + getErrorMessage(resourceErr);
        console.warn('[FTS Répétition] lecture ressources fts_ressources', resourceErr);
        throw new Error('Ressources inaccessibles : ' + debug.erreurRessources);
      }

      const normalized = Object.keys(raw || {}).map(key => normalizeResource(raw[key] || {}, key));
      debug.totalResources = normalized.length;
      const pdfs = normalized.filter(resource => resource.active && isPdfResource(resource));
      debug.pdfResources = pdfs.length;
      state.resources = pdfs
        .filter(resource => canProfileSeeResource(state.profile, resource))
        .sort((a,b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      debug.visiblePdfResources = state.resources.length;

      renderResourceOptions(state.resources);
      await handleDirectResourceRequest();
      setAppStatus(state.resources.length ? `${state.resources.length} PDF disponible${state.resources.length>1?'s':''} · Tout est normal` : 'Aucun PDF disponible pour tes groupes · Tout est normal');
      setAppDebug('', false);
    } catch (err) {
      console.warn('[FTS Répétition] ressources', err);
      state.resources = [];
      setAppStatus('Lecture impossible');
      renderResourceOptions([], getFriendlyLoadError(err));
      setAppDebug(formatAppDebug(debug, err), true);
    } finally {
      if (els.repReloadAppPdfBtn) els.repReloadAppPdfBtn.disabled = false;
    }
  }

  function getFriendlyLoadError(err){
    const msg = getErrorMessage(err);
    if (/permission|PERMISSION_DENIED|denied/i.test(msg)) return 'Accès refusé par Firebase : ce compte ne peut pas lire fts_ressources. Ouvre le détail ci-dessous.';
    if (/Profil membre/i.test(msg)) return 'Impossible de lire ton profil membre.';
    if (/Ressources/i.test(msg)) return 'Impossible de lire les ressources de l’app.';
    return 'Impossible de charger les PDF de l’app';
  }

  function getErrorMessage(err){
    return err && (err.message || err.code) ? String(err.message || err.code) : String(err || 'Erreur inconnue');
  }

  function setAppDebug(text, isError){
    if (els.repAppDebug) els.repAppDebug.textContent = text || '';
    if (els.repAppDebugWrap) {
      els.repAppDebugWrap.hidden = !isError;
      els.repAppDebugWrap.open = !!isError;
    }
  }

  function formatAppDebug(debug, err){
    const lines = [];
    lines.push('Module répétition : ' + REPETITION_VERSION);
    lines.push('Utilisateur : ' + (debug.email || debug.uid || 'inconnu'));
    lines.push('Profil lisible : ' + (debug.profileRead ? 'oui' : 'non'));
    lines.push('Ressources lisibles : ' + (debug.resourcesRead ? 'oui' : 'non'));
    if (debug.resourcesPath) lines.push('Branche ressources : ' + debug.resourcesPath);
    if (debug.erreurProfil) lines.push('Erreur profil : ' + debug.erreurProfil);
    if (debug.erreurRessources) lines.push('Erreur ressources : ' + debug.erreurRessources);
    lines.push('Catégories détectées : ' + (debug.categoriesDetectees.length ? debug.categoriesDetectees.join(', ') : 'aucune'));
    lines.push('Sous-catégories détectées : ' + (debug.sousCategoriesDetectees.length ? debug.sousCategoriesDetectees.join(', ') : 'aucune'));
    lines.push('Ressources totales : ' + debug.totalResources);
    lines.push('PDF trouvés : ' + debug.pdfResources);
    lines.push('PDF visibles après filtrage : ' + debug.visiblePdfResources);
    if (err) lines.push('Erreur finale : ' + getErrorMessage(err));
    return lines.join('\n');
  }



  function norm(value){
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
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
    const status = String(profile.status || '').toLowerCase();
    const role = String(profile.role || '').toLowerCase();
    if (role === 'admin') return true;
    if (status && status !== 'active') return false;

    const targetCat = norm(resource.cat || resource.category || resource.group || '');
    const targetSub = norm(resource.subcat || resource.subcategory || resource.subgroup || resource.section || '');

    // Document non ciblé : visible pour les membres connectés actifs.
    if (!targetCat && !targetSub) return true;

    const access = collectProfileAccess(profile);

    // Règle stricte identique à l'espace membre :
    // - document de catégorie seule = visible à tous les membres de cette catégorie ;
    // - document catégorie + sous-catégorie = visible seulement aux membres de cette catégorie ET sous-catégorie ;
    // - document sous-catégorie seule = visible seulement aux membres de cette sous-catégorie.
    if (targetCat && !access.cats.has(targetCat)) return false;
    if (targetSub && !access.subs.has(targetSub)) return false;
    return true;
  }

  function collectProfileAccess(profile){
    const cats = new Set();
    const subs = new Set();

    addList(profile.disciplines || profile.categories || profile.category || profile.group || profile.groups, cats);
    addList(profile.subgroups || profile.subcategories || profile.subcats || profile.subgroup || profile.subcategory, subs);

    // Accès par catégorie si le profil les stocke ainsi : { Théâtre: ["Ados"] }
    addSubgroupsByCat(profile.subgroupsByCat || profile.subcategoriesByCat || profile.groupsByCat, cats, subs);

    // Parents : inclure les accès des enfants, car le parent doit voir les documents de ses enfants.
    const children = [];
    if (Array.isArray(profile.enfants)) children.push(...profile.enfants);
    if (Array.isArray(profile.children)) children.push(...profile.children);
    if (profile.enfants && typeof profile.enfants === 'object' && !Array.isArray(profile.enfants)) children.push(...Object.values(profile.enfants));
    if (profile.children && typeof profile.children === 'object' && !Array.isArray(profile.children)) children.push(...Object.values(profile.children));
    children.forEach(child => {
      if (!child || typeof child !== 'object') return;
      addList(child.disciplines || child.categories || child.category || child.group || child.groups || child.cours || child.activities, cats);
      addList(child.subgroups || child.subcategories || child.subcats || child.subgroup || child.subcategory || child.sections || child.groupes || child.groups, subs);
      addSubgroupsByCat(child.subgroupsByCat || child.subcategoriesByCat || child.groupsByCat, cats, subs);
    });

    return { cats, subs };
  }

  function addSubgroupsByCat(value, cats, subs){
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    Object.keys(value).forEach(catName => {
      const catNorm = norm(catName);
      if (catNorm) cats.add(catNorm);
      addList(value[catName], subs);
    });
  }

  function addList(value, target){
    if (!value) return;
    if (typeof value === 'string') {
      value.split(/[;,|]/).forEach(part => { const n = norm(part); if (n) target.add(n); });
      const n = norm(value); if (n) target.add(n);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(v => addList(v, target));
      return;
    }
    if (typeof value === 'object') {
      Object.keys(value).forEach(k => {
        if (value[k] === true) { const nk = norm(k); if (nk) target.add(nk); }
        else addList(value[k], target);
      });
    }
  }


  function getDirectResourceKey(){
    try {
      const params = new URLSearchParams(window.location.search || '');
      return params.get('resource') || params.get('resourceId') || params.get('doc') || '';
    } catch(e) { return ''; }
  }

  function shouldAutoLoadDirectResource(){
    try {
      const params = new URLSearchParams(window.location.search || '');
      return params.get('autoload') === '1' || params.get('start') === '1';
    } catch(e) { return false; }
  }

  async function handleDirectResourceRequest(){
    const requestedKey = getDirectResourceKey();
    if (!requestedKey || state.directResourceHandled || !els.repResourceSelect) return;
    const resource = state.resources.find(r => String(r.key || '') === String(requestedKey));
    if (!resource) {
      state.directResourceHandled = true;
      setPdfStatus('Ce PDF n’est pas disponible pour ce compte ou n’est pas compatible répétition.', false);
      return;
    }
    els.repResourceSelect.value = resource.key;
    onResourceSelectChange();
    state.directResourceHandled = true;
    if (shouldAutoLoadDirectResource()) {
      await loadSelectedResourcePdf();
    } else {
      setPdfStatus(`PDF sélectionné : “${resource.name}”. Clique sur “Commencer à réviser”.`);
      try { document.querySelector('.rep-app-docs')?.scrollIntoView({ behavior:'smooth', block:'start' }); } catch(e) {}
    }
  }

  function renderResourceOptions(resources, emptyLabel){
    if (!els.repResourceSelect) return;
    if (!resources.length) {
      els.repResourceSelect.innerHTML = `<option value="">${escapeHtml(emptyLabel || 'Aucun PDF disponible')}</option>`;
      els.repLoadResourcePdfBtn.disabled = true;
      els.repLoadResourcePdfBtn.textContent = 'Commencer à réviser';
      return;
    }
    els.repResourceSelect.innerHTML = '<option value="">Choisir un PDF…</option>' + resources.map(resource => {
      const meta = [resource.cat, resource.subcat].filter(Boolean).join(' · ');
      const label = `${resource.name}${meta ? ' — ' + meta : ''}`;
      return `<option value="${escapeAttr(resource.key)}">${escapeHtml(label)}</option>`;
    }).join('');
    els.repLoadResourcePdfBtn.disabled = true;
    els.repLoadResourcePdfBtn.textContent = 'Commencer à réviser';
  }

  function onResourceSelectChange(){
    els.repLoadResourcePdfBtn.disabled = !els.repResourceSelect.value || state.loadingPdf;
    if (!els.repLoadResourcePdfBtn || !els.repResourceSelect.value) return;
    const key = els.repResourceSelect.value;
    const cached = getCachedScript(getResourceScriptId(key));
    els.repLoadResourcePdfBtn.textContent = cached && cached.text ? 'Reprendre ce texte' : 'Commencer à réviser';
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
      const scriptId = getResourceScriptId(resource.key);
      const cached = getCachedScript(scriptId);
      if (cached && cached.text) {
        applyExtractedText(cached.text, resource.name, { id: scriptId, label: resource.name, source:'resource', key:resource.key, fromCache:true });
        setPdfStatus(`Texte chargé depuis cet appareil : “${resource.name}”.`);
        return;
      }
      const text = await extractPdfTextFromUrl(url);
      applyExtractedText(text, resource.name, { id: scriptId, label: resource.name, source:'resource', key:resource.key });
    });
  }

  async function loadLocalPdf(){
    if (!state.localPdfFile) return;
    await runPdfLoad(async () => {
      setPdfStatus(`Analyse de “${state.localPdfFile.name}”…`);
      const buffer = await state.localPdfFile.arrayBuffer();
      const text = await extractPdfTextFromBuffer(buffer);
      const scriptId = getLocalScriptId(state.localPdfFile.name, text);
      applyExtractedText(text, state.localPdfFile.name, { id: scriptId, label: state.localPdfFile.name, source:'local' });
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

  function applyExtractedText(text, label, meta){
    els.repScriptInput.value = text;
    const scriptMeta = meta || { id:getLocalScriptId(label || 'texte', text), label:label || 'Texte de répétition', source:'manual' };
    state.currentScriptId = scriptMeta.id || getLocalScriptId(label || 'texte', text);
    state.currentScriptLabel = scriptMeta.label || label || 'Texte de répétition';
    cacheScript(state.currentScriptId, state.currentScriptLabel, text, scriptMeta);
    analyze();
    restoreSettingsForCurrentScript();
    renderResumeCard();
    const lineCount = state.lines.filter(l => l.kind === 'line').length;
    const roleCount = state.characters.length;
    setPdfStatus(`Texte prêt : ${lineCount} réplique${lineCount>1?'s':''}, ${roleCount} personnage${roleCount>1?'s':''}. Choisis ton rôle puis appuie sur Play.`);
    if (!lineCount || !roleCount) {
      setPdfStatus(`Le PDF “${label}” a été lu, mais aucun rôle n’a été détecté. Vérifie que les répliques sont bien en début de ligne avec un séparateur, ex. Alice : Bonjour.`, false);
      setView('library');
    } else if (els.repRoleSelect && els.repRoleSelect.value) {
      setPdfStatus(`Texte prêt : ${lineCount} réplique${lineCount>1?'s':''}, ${roleCount} personnage${roleCount>1?'s':''}. Tes réglages ont été retrouvés.`);
      setView((scriptMeta && scriptMeta.fromCache) ? 'rehearse' : 'rehearse');
    } else {
      setView('role');
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
    state.sections = collectSections(lines);
    renderAnalysis();
    refreshPlayer();
  }

  function parseScript(text){
    if (!text) return [];
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const roleCandidateCounts = buildRoleCandidateCounts(rawLines);
    const parsed = [];

    rawLines.forEach(raw => {
      const markdownHeading = raw.match(/^#{1,4}\s+(.+)$/);
      if (markdownHeading) {
        const section = parseActSceneHeading(markdownHeading[1].trim());
        if (section) parsed.push(section);
        else parsed.push({ speaker:'SCÈNE', text:markdownHeading[1].trim(), kind:'stage', sectionType:'heading' });
        return;
      }

      const actScene = parseActSceneHeading(raw);
      if (actScene) {
        parsed.push(actScene);
        return;
      }

      if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('*') && raw.endsWith('*'))) {
        parsed.push({ speaker:'DIDASCALIE', text:cleanStage(raw), kind:'stage' });
        return;
      }

      const line = splitRoleLine(raw);
      if (line && shouldAcceptRoleLine(line, parsed, roleCandidateCounts)) {
        parsed.push({ speaker:normalizeSpeaker(line.speaker), text:line.text.trim(), kind:'line' });
        return;
      }

      appendContinuation(parsed, raw);
    });

    return parsed.filter(item => item.text);
  }

  function appendContinuation(parsed, raw){
    const value = String(raw || '').trim();
    if (!value) return;
    if (parsed.length) {
      parsed[parsed.length - 1].text = `${parsed[parsed.length - 1].text} ${value}`.trim();
    } else {
      parsed.push({ speaker:'TEXTE', text:value, kind:'stage' });
    }
  }

  function buildRoleCandidateCounts(rawLines){
    const counts = {};
    rawLines.forEach(raw => {
      if (!raw) return;
      if (/^#{1,4}\s+/.test(raw)) return;
      if (parseActSceneHeading(raw)) return;
      if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('*') && raw.endsWith('*'))) return;
      const line = splitRoleLine(raw);
      if (!line) return;
      const speaker = normalizeSpeaker(line.speaker);
      counts[speaker] = (counts[speaker] || 0) + 1;
    });
    return counts;
  }

  function shouldAcceptRoleLine(line, parsed, roleCandidateCounts){
    const speaker = normalizeSpeaker(line && line.speaker ? line.speaker : '');
    if (!speaker) return false;

    const count = roleCandidateCounts[speaker] || 0;
    if (count >= 2) return true;

    const hasDialogueBefore = parsed.some(item => item && item.kind === 'line');
    if (!hasDialogueBefore) return true;

    const repeatedSpeakers = Object.keys(roleCandidateCounts || {}).filter(name => (roleCandidateCounts[name] || 0) >= 2);
    if (!repeatedSpeakers.length) return true;

    // Si un nouveau rôle n'apparaît qu'une seule fois au milieu d'une scène,
    // c'est souvent une suite de réplique coupée à la ligne avec un ":".
    // On accepte quand même les noms très explicites en majuscules pour garder
    // la possibilité d'ajouter un petit rôle ponctuel.
    if (looksLikeForcedSpeakerLabel(line.rawSpeaker || line.speaker)) return true;

    return false;
  }

  function looksLikeForcedSpeakerLabel(value){
    const raw = String(value || '').trim();
    if (!raw) return false;
    const letters = raw.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
    if (!letters) return false;
    return letters.length >= 2 && letters === letters.toUpperCase();
  }

  function cleanStage(raw){
    return raw.replace(/^\[/,'').replace(/\]$/,'').replace(/^\*/,'').replace(/\*$/,'').trim();
  }

  function parseActSceneHeading(raw){
    const value = String(raw || '').trim();
    if (!value) return null;
    const act = value.match(/^acte\s+([ivxlcdm]+|\d+)(?:\s*[-—:–.]\s*(.*))?$/i);
    if (act) {
      const num = act[1].trim();
      const title = (act[2] || '').trim();
      return { speaker:'ACTE ' + num.toUpperCase(), text:title || 'Acte ' + num.toUpperCase(), kind:'stage', sectionType:'act', sectionNumber:num.toUpperCase(), sectionTitle:title };
    }
    const scene = value.match(/^sc[èe]ne\s+([ivxlcdm]+|\d+)(?:\s*[-—:–.]\s*(.*))?$/i);
    if (scene) {
      const num = scene[1].trim();
      const title = (scene[2] || '').trim();
      return { speaker:'SCÈNE ' + num.toUpperCase(), text:title || 'Scène ' + num.toUpperCase(), kind:'stage', sectionType:'scene', sectionNumber:num.toUpperCase(), sectionTitle:title };
    }
    return null;
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
      const rawSpeaker = String(match[1] || '').trim();
      const speaker = sanitizeSpeakerCandidate(rawSpeaker);
      const text = String(match[2] || '').trim();
      if (isValidSpeakerCandidate(speaker) && text) {
        return { speaker, rawSpeaker, text };
      }
    }

    return null;
  }

  function sanitizeSpeakerCandidate(value){
    return String(value || '')
      .replace(/[«»"“”]/g,'')
      .replace(/\([^)]*\)/g,'')
      .replace(/\[[^\]]*\]/g,'')
      .replace(/\*[^*]*\*/g,'')
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
    // Clé de rôle stable : accents, casse et apostrophes ne doivent pas créer
    // de faux personnages différents. Ex : "Mère" et "Mere" = MERE.
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, ' ')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function collectCharacters(lines){
    const excluded = new Set(['DIDASCALIE','SCÈNE','TEXTE']);
    return Array.from(new Set(lines.filter(l => l.kind === 'line' && !excluded.has(l.speaker)).map(l => l.speaker))).sort((a,b)=>a.localeCompare(b,'fr'));
  }

  function collectSections(lines){
    const sections = [];
    let currentAct = '';
    (lines || []).forEach((line, index) => {
      if (!line || line.kind !== 'stage') return;
      if (line.sectionType === 'act') {
        currentAct = line.speaker;
        sections.push({ index, type:'act', label:line.speaker + (line.sectionTitle ? ' · ' + line.sectionTitle : ''), act:currentAct });
      }
      if (line.sectionType === 'scene') {
        const prefix = currentAct ? currentAct + ' · ' : '';
        sections.push({ index, type:'scene', label:prefix + line.speaker + (line.sectionTitle ? ' · ' + line.sectionTitle : ''), act:currentAct });
      }
    });
    return sections;
  }

  function renderAnalysis(){
    const lineCount = state.lines.filter(l => l.kind === 'line').length;
    const stageCount = state.lines.filter(l => l.kind === 'stage').length;
    els.repStats.innerHTML = `
      <div><strong>${lineCount}</strong><span>réplique${lineCount>1?'s':''}</span></div>
      <div><strong>${state.characters.length}</strong><span>rôle${state.characters.length>1?'s':''}</span></div>
      <div><strong>${stageCount}</strong><span>didascalie${stageCount>1?'s':''}</span></div>
    `;
    els.repRoleSelect.disabled = !state.characters.length;
    els.repRoleSelect.innerHTML = state.characters.length
      ? '<option value="">Choisir mon rôle</option>' + state.characters.map(name => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join('')
      : '<option value="">Aucun rôle détecté</option>';

    renderRoleChoices();
    renderRoleReadControls();
    renderSectionNavigation();
    renderLineList();
    updateDifficultUi();
    setButtons();
  }


  function renderRoleChoices(){
    if (!els.repCharacters) return;
    if (!state.characters.length) {
      els.repCharacters.innerHTML = '<span class="rep-tag">Aucun rôle détecté</span>';
      return;
    }
    const selected = els.repRoleSelect.value;
    const counts = countLinesBySpeaker();
    els.repCharacters.innerHTML = state.characters.map(name => {
      const active = selected === name ? ' is-active' : '';
      const count = counts[name] || 0;
      return `<button class="rep-role-card${active}" type="button" data-role="${escapeAttr(name)}">
        <strong>${escapeHtml(name)}</strong>
        <span>${count} réplique${count>1?'s':''}</span>
      </button>`;
    }).join('');
    els.repCharacters.querySelectorAll('[data-role]').forEach(button => {
      button.addEventListener('click', () => {
        const role = button.getAttribute('data-role') || '';
        els.repRoleSelect.value = role;
        stop(false);
        state.currentIndex = 0;
        state.awaitingUser = false;
        state.focusDifficultOnly = false;
        refreshPlayer();
        renderRoleChoices();
        saveCurrentScriptSettings();
        setView(state.currentView === 'settings' ? 'settings' : 'mode');
      });
    });
  }

  function countLinesBySpeaker(){
    const counts = {};
    state.lines.forEach(line => {
      if (line && line.kind === 'line' && line.speaker) counts[line.speaker] = (counts[line.speaker] || 0) + 1;
    });
    return counts;
  }

  function renderSectionNavigation(){
    if (!els.repSectionNav || !els.repSectionSelect) return;
    const sections = state.sections || [];
    if (!sections.length) {
      els.repSectionNav.hidden = true;
      els.repSectionSelect.innerHTML = '<option value="">Aucune scène détectée</option>';
      return;
    }
    els.repSectionNav.hidden = false;
    els.repSectionSelect.innerHTML = '<option value="">Aller à un acte / une scène…</option>' + sections.map(section => {
      const icon = section.type === 'act' ? '🎬 ' : '🎭 ';
      return `<option value="${section.index}">${escapeHtml(icon + section.label)}</option>`;
    }).join('');
  }

  function goToSelectedSection(){
    if (!els.repSectionSelect || !els.repSectionSelect.value) return;
    const index = Number(els.repSectionSelect.value);
    if (!Number.isFinite(index)) return;
    stopSpeechOnly();
    state.currentIndex = Math.max(0, Math.min(state.lines.length - 1, index));
    state.awaitingUser = false;
    state.focusDifficultOnly = false;
    refreshPlayer();
    saveCurrentScriptSettings();
    if (state.playing) playCurrent();
  }



  function scrollToRoleChoice(){
    try {
      const target = els.repCharacters || els.repRoleSelect;
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior:'smooth', block:'center' });
    } catch(e) {}
  }

  function scrollToPlayer(){
    try {
      const target = document.querySelector('.rep-player');
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior:'smooth', block:'start' });
    } catch(e) {}
  }

  function renderRoleReadControls(){
    if (!els.repRoleReadControls) return;
    if (!state.characters.length) {
      els.repRoleReadControls.innerHTML = '<p class="rep-help">Les rôles détectés apparaîtront ici.</p>';
      return;
    }

    // Si un nouveau texte est analysé, on conserve seulement les rôles encore présents.
    state.ignoredSpeakers = new Set(Array.from(state.ignoredSpeakers || []).filter(name => state.characters.includes(name)));
    Object.keys(state.roleVoicePrefs || {}).forEach(name => {
      if (!state.characters.includes(name)) delete state.roleVoicePrefs[name];
    });

    els.repRoleReadControls.innerHTML = `
      <div class="rep-role-read-head">
        <strong>Rôles à faire lire par l’app</strong>
        <small>Décoche un faux rôle ou un rôle à ignorer : ses lignes seront passées.</small>
      </div>
      <div class="rep-role-read-list">
        ${state.characters.map(name => {
          const checked = !state.ignoredSpeakers.has(name);
          return `<label class="rep-role-read-item ${checked ? '' : 'is-muted'}">
            <input type="checkbox" value="${escapeAttr(name)}" ${checked ? 'checked' : ''} />
            <span>${escapeHtml(name)}</span>
          </label>`;
        }).join('')}
      </div>
      <details class="rep-role-voice-details">
        <summary>
          <span>Voix par rôle</span>
          <small>Optionnel · français France homme/femme ou voix précise</small>
        </summary>
        <div class="rep-role-voice-list">
          ${state.characters.map(name => `
            <label class="rep-role-voice-item">
              <span>${escapeHtml(name)}</span>
              <select class="rep-select rep-role-voice-select" data-speaker="${escapeAttr(name)}">
                ${renderRoleVoiceOptions(state.roleVoicePrefs[name] || '')}
              </select>
            </label>
          `).join('')}
        </div>
        <p class="rep-role-voice-note">Selon le téléphone ou le navigateur, les voix homme/femme disponibles peuvent varier. Si aucune voix correspondante n’existe, l’app utilise la meilleure voix française disponible.</p>
      </details>
    `;

    els.repRoleReadControls.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        const name = input.value;
        if (input.checked) state.ignoredSpeakers.delete(name);
        else state.ignoredSpeakers.add(name);
        refreshPlayer();
        renderLineList();
        saveCurrentScriptSettings();
      });
    });

    els.repRoleReadControls.querySelectorAll('.rep-role-voice-select').forEach(select => {
      select.addEventListener('change', () => {
        const name = select.getAttribute('data-speaker') || '';
        if (!name) return;
        if (select.value) state.roleVoicePrefs[name] = select.value;
        else delete state.roleVoicePrefs[name];
        saveCurrentScriptSettings();
      });
    });
  }

  function renderRoleVoiceOptions(selectedValue){
    const frenchVoices = getFrenchVoices();
    const hasFemale = frenchVoices.some(v => inferVoiceGender(v) === 'female');
    const hasMale = frenchVoices.some(v => inferVoiceGender(v) === 'male');
    const choices = [
      { value:'', label:'Voix automatique' },
      { value:'fr-female', label: hasFemale ? 'Voix française femme' : 'Voix française femme — non détectée sur cet appareil', disabled: !hasFemale },
      { value:'fr-male', label: hasMale ? 'Voix française homme' : 'Voix française homme — non détectée sur cet appareil', disabled: !hasMale }
    ];
    const voiceChoices = frenchVoices.length ? frenchVoices : state.voices;
    const options = choices.map(choice => {
      const disabled = choice.disabled ? 'disabled' : '';
      const selected = selectedValue === choice.value && !choice.disabled ? 'selected' : '';
      return `<option value="${escapeAttr(choice.value)}" ${selected} ${disabled}>${escapeHtml(choice.label)}</option>`;
    });
    if (voiceChoices.length) {
      options.push('<option value="" disabled>────────── Voix disponibles sur cet appareil ──────────</option>');
      voiceChoices.forEach(voice => {
        const index = state.voices.indexOf(voice);
        const value = 'voice:' + index;
        const gender = inferVoiceGender(voice);
        const genderLabel = gender === 'female' ? ' · femme' : gender === 'male' ? ' · homme' : '';
        const label = `${voice.name}${voice.lang ? ' — ' + voice.lang : ''}${genderLabel}`;
        options.push(`<option value="${escapeAttr(value)}" ${selectedValue === value ? 'selected' : ''}>${escapeHtml(label)}</option>`);
      });
    }
    return options.join('');
  }

  function getFrenchVoices(){
    const voices = state.voices || [];
    const frFR = voices.filter(v => /^fr[-_]FR$/i.test(String(v.lang || '')) || /français.*france|france.*français|french.*france|france.*french/i.test(`${v.name} ${v.lang}`));
    const fr = voices.filter(v => /^fr/i.test(String(v.lang || '')) || /fran[cç]ais|french/i.test(`${v.name} ${v.lang}`));
    const result = [];
    frFR.concat(fr).forEach(v => { if (!result.includes(v)) result.push(v); });
    return result;
  }

  function inferVoiceGender(voice){
    const label = norm(`${voice && voice.name ? voice.name : ''} ${voice && voice.voiceURI ? voice.voiceURI : ''}`);
    const female = ['amelie','amélie','audrey','aurelie','aurélie','marie','julie','lucie','lea','léa','celine','céline','claire','chloe','chloé','manon','camille','sophie','florence','isabelle','virginie','hortense','zoe','zoé','female','femme','woman'];
    const male = ['thomas','nicolas','bernard','paul','jacques','pierre','claude','antoine','henri','louis','mathieu','alain','guillaume','jean','male','homme','man'];
    if (female.some(name => label.includes(norm(name)))) return 'female';
    if (male.some(name => label.includes(norm(name)))) return 'male';
    return '';
  }


  function applyTrainingPreset(preset){
    const map = {
      discover: { mode:'manual', ownLines:'show', pause:'4500', rate:'0.85' },
      learn:    { mode:'manual', ownLines:'initials', pause:'4500', rate:'1' },
      run:      { mode:'auto', ownLines:'hide', pause:'2500', rate:'1' }
    };
    const cfg = map[preset] || map.discover;
    if (els.repMode) els.repMode.value = cfg.mode;
    if (els.repOwnLines) els.repOwnLines.value = cfg.ownLines;
    if (els.repPause) els.repPause.value = cfg.pause;
    if (els.repRate) els.repRate.value = cfg.rate;
    state.focusDifficultOnly = false;
    refreshPlayer();
    renderPresetState(preset);
    saveCurrentScriptSettings();
    if (state.currentView === 'mode') enterRehearsal(false);
  }

  function renderPresetState(activePreset){
    if (!els.repTrainingPresets) return;
    els.repTrainingPresets.querySelectorAll('[data-preset]').forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-preset') === activePreset);
    });
  }

  function currentOwnLineIndex(){
    const role = els.repRoleSelect ? els.repRoleSelect.value : '';
    const line = state.lines[state.currentIndex];
    return line && line.kind === 'line' && role && line.speaker === role ? state.currentIndex : -1;
  }

  function getDifficultIndexesForRole(){
    const role = els.repRoleSelect ? els.repRoleSelect.value : '';
    return Array.from(state.difficultLines || [])
      .map(Number)
      .filter(index => Number.isFinite(index) && index >= 0 && index < state.lines.length)
      .filter(index => {
        const line = state.lines[index];
        return line && line.kind === 'line' && (!role || line.speaker === role);
      })
      .sort((a,b)=>a-b);
  }

  function toggleDifficultLine(){
    const index = currentOwnLineIndex();
    if (index < 0) return;
    if (state.difficultLines.has(index)) state.difficultLines.delete(index);
    else state.difficultLines.add(index);
    updateDifficultUi();
    renderLineList();
    refreshPlayer(false);
    saveCurrentScriptSettings();
  }

  function startDifficultReview(){
    const role = els.repRoleSelect ? els.repRoleSelect.value : '';
    if (!role) {
      alert('Choisis d’abord ton personnage.');
      return;
    }
    const indexes = getDifficultIndexesForRole();
    if (!indexes.length) {
      alert('Aucune réplique marquée à retravailler pour ce rôle.');
      return;
    }
    stop(false);
    state.focusDifficultOnly = true;
    state.currentIndex = indexes.find(i => i >= state.currentIndex) || indexes[0];
    state.awaitingUser = false;
    els.repMode.value = 'manual';
    refreshPlayer();
    updateDifficultUi();
    scrollToPlayer();
    saveCurrentScriptSettings();
  }

  function exitDifficultReview(){
    state.focusDifficultOnly = false;
    refreshPlayer();
    updateDifficultUi();
    saveCurrentScriptSettings();
  }

  function nextDifficultIndex(fromIndex, direction){
    const indexes = getDifficultIndexesForRole();
    if (!indexes.length) return -1;
    if (direction < 0) {
      for (let i = indexes.length - 1; i >= 0; i -= 1) if (indexes[i] < fromIndex) return indexes[i];
      return indexes[indexes.length - 1];
    }
    for (const index of indexes) if (index > fromIndex) return index;
    return -1;
  }

  function updateDifficultUi(){
    const indexes = getDifficultIndexesForRole();
    const currentOwn = currentOwnLineIndex();
    const isMarked = currentOwn >= 0 && state.difficultLines.has(currentOwn);
    if (els.repDifficultCount) {
      const count = indexes.length;
      els.repDifficultCount.textContent = count + ' réplique' + (count > 1 ? 's' : '') + ' à retravailler';
    }
    if (els.repDifficultBtn) {
      els.repDifficultBtn.disabled = currentOwn < 0;
      els.repDifficultBtn.textContent = isMarked ? '⭐ Marquée' : '⭐ À retravailler';
      els.repDifficultBtn.classList.toggle('is-active', isMarked);
    }
    if (els.repReviewDifficultBtn) {
      els.repReviewDifficultBtn.disabled = !indexes.length;
      els.repReviewDifficultBtn.textContent = indexes.length ? 'Réviser ⭐ (' + indexes.length + ')' : 'Réviser ⭐';
    }
    if (els.repExitDifficultBtn) {
      els.repExitDifficultBtn.hidden = !state.focusDifficultOnly;
    }
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
      if (line.kind === 'stage') classes.push('stage');
      if (line.sectionType) classes.push('section');
      if (isIgnoredSpeakerLine(line, role)) classes.push('ignored');
      if (state.difficultLines && state.difficultLines.has(index)) classes.push('difficult');
      const ignoredNote = isIgnoredSpeakerLine(line, role) ? '<small class="rep-line-note">Rôle ignoré — cette ligne sera passée</small>' : '';
      const difficultNote = state.difficultLines && state.difficultLines.has(index) ? '<small class="rep-line-note rep-line-star">⭐ À retravailler</small>' : '';
      return `<div class="${classes.join(' ')}" data-line-index="${index}">
        <div class="rep-line-role">${escapeHtml(line.speaker)}</div>
        <div class="rep-line-text">${escapeHtml(displayTextForLine(line))}${ignoredNote}${difficultNote}</div>
      </div>`;
    }).join('');

    els.repLineList.querySelectorAll('[data-line-index]').forEach(node => {
      node.addEventListener('click', () => {
        stopSpeechOnly();
        state.currentIndex = Number(node.getAttribute('data-line-index')) || 0;
        state.awaitingUser = false;
        refreshPlayer();
        saveCurrentScriptSettings();
      });
    });
    keepActiveLineVisible();
  }

  function keepActiveLineVisible(){
    if (!els.repLineList) return;
    const active = els.repLineList.querySelector('.rep-line.active');
    if (!active) return;
    try { active.scrollIntoView({ behavior:'smooth', block:'center', inline:'nearest' }); } catch(e) {}
  }

  function start(){
    if (!state.lines.length) return;
    if (els.repMode.value !== 'full' && !els.repRoleSelect.value) {
      alert('Choisis ton rôle avant de lancer la répétition.');
      return;
    }
    stopSpeechOnly();
    state.playToken += 1;
    state.playing = true;
    state.awaitingUser = false;
    state.currentIndex = Math.min(state.currentIndex, state.lines.length - 1);
    setButtons();
    saveCurrentScriptSettings();
    playCurrent();
  }

  function playCurrent(){
    clearPendingTimeout();
    if (!state.playing || !state.lines.length) return;
    const token = state.playToken;
    if (state.currentIndex >= state.lines.length) {
      finish();
      return;
    }

    const line = state.lines[state.currentIndex];
    const role = els.repRoleSelect.value;
    const mode = els.repMode.value;
    const isOwn = mode !== 'full' && line.speaker === role;
    const isIgnored = isIgnoredSpeakerLine(line, role);

    renderCurrentLine(line, isOwn, isIgnored);
    if (document.body.classList.contains('rep-show-script')) renderLineList();
    setButtons();

    if (isIgnored) {
      els.repProgressText.textContent = 'Rôle ignoré : l’app passe cette ligne.';
      state.timeoutId = setTimeout(() => { if (token === state.playToken && state.playing) advance(); }, 80);
      return;
    }

    // renderCurrentLine a déjà mis à jour l'aperçu ci-dessus.
    if (line.kind === 'stage') {
      speakLine(line, false, () => { if (token === state.playToken && state.playing) advance(); });
      return;
    }

    if (mode === 'full' || !isOwn) {
      speakLine(line, true, () => { if (token === state.playToken && state.playing) advance(); });
      return;
    }

    state.awaitingUser = true;
    setButtons();

    if (mode === 'auto') {
      const delay = computeSilentLineDelay(line);
      els.repProgressText.textContent = `Réplique muette : à toi de parler, l’app enchaîne dans ${Math.round(delay/1000)} s.`;
      state.timeoutId = setTimeout(() => { if (token === state.playToken && state.playing) advance(); }, delay);
      return;
    }

    if (mode === 'confirm') {
      state.timeoutId = setTimeout(() => {
        speakLine(line, true, () => { if (token === state.playToken && state.playing) advance(); });
      }, Number(els.repPause.value) || 4500);
    }
  }


  function isIgnoredSpeakerLine(line, selectedRole){
    if (!line || line.kind !== 'line') return false;
    // Le rôle choisi par l'élève reste toujours actif pour pouvoir s'arrêter dessus.
    if (selectedRole && line.speaker === selectedRole) return false;
    return state.ignoredSpeakers && state.ignoredSpeakers.has(line.speaker);
  }


  function computeSilentLineDelay(line){
    const minDelay = Number(els.repPause.value) || 4500;
    const text = getSpeakableText(line && line.text ? line.text : '');
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    // En mode muet, on simule le temps de lecture de l'élève : minimum choisi + durée selon longueur.
    const estimated = 1400 + (words * 430);
    return Math.max(minDelay, Math.min(18000, estimated));
  }

  function speakLine(line, includeSpeaker, onEnd){
    const text = getSpeakableText(line ? line.text : '');
    if (!text) {
      state.timeoutId = setTimeout(() => { if (onEnd) onEnd(); }, 80);
      return;
    }
    const prefix = includeSpeaker && line && line.speaker ? `${line.speaker}. ` : '';
    speak(prefix + text, onEnd, { speaker: line && line.speaker ? line.speaker : '' });
  }

  function getSpeakableText(text){
    return stripInlineStageDirections(text)
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function stripInlineStageDirections(text){
    let value = String(text || '');
    // Retire les didascalies intégrées : (il s'avance), [elle rit], *en chantant*.
    // On boucle pour gérer plusieurs indications dans une même réplique.
    let previous = '';
    while (previous !== value) {
      previous = value;
      value = value
        .replace(/\([^()]*\)/g, ' ')
        .replace(/\[[^\[\]]*\]/g, ' ')
        .replace(/\*[^*]*\*/g, ' ');
    }
    return value;
  }

  function speak(text, onEnd, options){
    // IMPORTANT : ne jamais appeler speechSynthesis.cancel() au début d'une lecture.
    // Sur mobile, cancel() peut déclencher immédiatement onend/onerror de l'utterance
    // en cours ou tout juste ajoutée, ce qui faisait avancer toutes les lignes jusqu'à la fin.
    // La voix est coupée uniquement par Stop / Précédent / Suivant / changement de rôle.
    if (!('speechSynthesis' in window)) {
      state.timeoutId = setTimeout(() => { if (onEnd) onEnd(); }, 900);
      return;
    }
    // Dernière tentative de chargement : sur Android/iOS, getVoices() peut se remplir tardivement.
    if (!state.voices.length) loadVoices(true);
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = resolveVoiceForSpeaker(options && options.speaker ? options.speaker : '');
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      // Très important sur mobile : certains navigateurs ignorent la voix si lang reste fr-FR
      // alors que la voix réelle annonce fr_FR, fr-CA, fr-fr-x-..., etc.
      utterance.lang = selectedVoice.lang || 'fr-FR';
    } else {
      utterance.lang = 'fr-FR';
    }
    utterance.rate = Number(els.repRate.value) || 1;
    utterance.onend = () => onEnd && onEnd();
    utterance.onerror = () => onEnd && onEnd();
    window.speechSynthesis.speak(utterance);
  }

  function resolveVoiceForSpeaker(speaker){
    const pref = speaker && state.roleVoicePrefs ? state.roleVoicePrefs[speaker] : '';
    if (pref) {
      const roleVoice = voiceFromPreference(pref);
      if (roleVoice) return roleVoice;
    }

    const voiceIndex = els.repVoice.value;
    if (voiceIndex !== '' && state.voices[Number(voiceIndex)]) return state.voices[Number(voiceIndex)];

    const french = getFrenchVoices();
    return french[0] || null;
  }

  function voiceFromPreference(pref){
    if (!pref) return null;
    if (String(pref).startsWith('voice:')) {
      const index = Number(String(pref).replace('voice:', ''));
      return state.voices[index] || null;
    }

    const french = getFrenchVoices();
    if (pref === 'fr-female') {
      // Ne pas faire semblant : si aucune voix femme n'est détectée sur le téléphone,
      // on retombe sur la voix française auto. L'option est normalement désactivée dans l'UI.
      return french.find(v => inferVoiceGender(v) === 'female') || french[0] || null;
    }
    if (pref === 'fr-male') {
      // Idem : Android/iOS ne fournissent parfois qu'une seule voix française.
      return french.find(v => inferVoiceGender(v) === 'male') || french[0] || null;
    }
    return null;
  }

  function advance(){
    state.awaitingUser = false;
    if (state.focusDifficultOnly) {
      const next = nextDifficultIndex(state.currentIndex, 1);
      if (next < 0) {
        finishDifficultReview();
        return;
      }
      state.currentIndex = next;
    } else {
      state.currentIndex += 1;
    }
    saveCurrentScriptSettings();
    if (state.currentIndex >= state.lines.length) {
      finish();
      return;
    }
    playCurrent();
  }

  function finishDifficultReview(){
    stop(false);
    state.focusDifficultOnly = false;
    els.repProgressText.textContent = 'Révision des répliques difficiles terminée.';
    updateDifficultUi();
    refreshPlayer(false);
    saveCurrentScriptSettings();
  }

  function cueOwnLine(){
    const line = state.lines[state.currentIndex];
    const role = els.repRoleSelect.value;
    if (!line || line.kind !== 'line' || !role || line.speaker !== role) return;

    // En cas de trou de mémoire, l'app souffle la vraie réplique sans avancer.
    // On coupe l'avance automatique/confirmation pour laisser l'élève reprendre la main.
    clearPendingTimeout();
    state.awaitingUser = true;
    setButtons();
    speakLine(line, true, () => {
      if (state.playing) {
        state.awaitingUser = true;
        setButtons();
      }
    });
  }

  function continueAfterOwnLine(){
    if (!state.awaitingUser) return;
    clearPendingTimeout();
    advance();
  }

  function restartFromBeginning(){
    if (!state.lines.length) return;
    const wasPlaying = !!state.playing;
    clearPendingTimeout();
    state.playToken += 1;
    stopSpeechOnly(true);
    state.currentIndex = 0;
    state.awaitingUser = false;
    state.playing = wasPlaying;
    refreshPlayer(document.body.classList.contains('rep-show-script'));
    saveCurrentScriptSettings();
    if (wasPlaying) playCurrent();
  }

  function previousLine(){
    if (!state.lines.length) return;
    const wasPlaying = !!state.playing;
    clearPendingTimeout();
    state.playToken += 1;
    stopSpeechOnly(true);
    if (state.focusDifficultOnly) {
      const prev = nextDifficultIndex(state.currentIndex, -1);
      if (prev >= 0) state.currentIndex = prev;
    } else {
      state.currentIndex = Math.max(0, state.currentIndex - 1);
    }
    state.awaitingUser = false;
    state.playing = wasPlaying;
    refreshPlayer(document.body.classList.contains('rep-show-script'));
    saveCurrentScriptSettings();
    if (wasPlaying) playCurrent();
  }

  function nextLineManual(){
    if (!state.lines.length) return;
    const wasPlaying = !!state.playing;
    clearPendingTimeout();
    state.playToken += 1;
    stopSpeechOnly(true);
    if (state.focusDifficultOnly) {
      const next = nextDifficultIndex(state.currentIndex, 1);
      if (next >= 0) state.currentIndex = next;
      else { finishDifficultReview(); return; }
    } else {
      state.currentIndex = Math.min(Math.max(0,state.lines.length - 1), state.currentIndex + 1);
    }
    state.awaitingUser = false;
    state.playing = wasPlaying;
    refreshPlayer(document.body.classList.contains('rep-show-script'));
    saveCurrentScriptSettings();
    if (wasPlaying) playCurrent();
  }

  function stop(resetText = true){
    clearPendingTimeout();
    state.playToken += 1;
    state.playing = false;
    state.awaitingUser = false;
    stopSpeechOnly(true);
    setButtons();
    if (resetText) refreshPlayer();
  }

  function stopSpeechOnly(cancel = true){
    if (!('speechSynthesis' in window)) return;
    if (!cancel) return;
    try {
      window.speechSynthesis.pause();
      window.speechSynthesis.cancel();
      // Certains navigateurs mobiles gardent une utterance en file si cancel arrive pendant onstart.
      setTimeout(() => {
        try { window.speechSynthesis.cancel(); } catch(e) {}
      }, 0);
    } catch (err) {
      try { window.speechSynthesis.cancel(); } catch(e) {}
    }
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
    saveCurrentScriptSettings();
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
    const isIgnored = isIgnoredSpeakerLine(line, role);
    renderCurrentLine(line, isOwn, isIgnored);
    if (renderList) renderLineList();
    setButtons();
  }

  function renderCurrentLine(line, isOwn, isIgnored){
    if (!line) return renderEmpty();
    const total = state.lines.length;
    const percent = total ? ((state.currentIndex + 1) / total) * 100 : 0;
    const isDifficult = state.difficultLines && state.difficultLines.has(state.currentIndex);
    els.repCurrentLine.className = 'rep-current' + (isIgnored ? ' is-ignored' : isOwn ? ' is-own' : line.kind === 'stage' ? ' is-stage' : ' is-other') + (isDifficult ? ' is-difficult' : '') + (state.focusDifficultOnly ? ' is-focus-difficult' : '');
    els.repCurrentLine.innerHTML = `
      <p class="rep-current-role">${isIgnored ? 'Rôle ignoré' : isOwn ? 'À toi' : escapeHtml(line.speaker)}${isDifficult ? ' · ⭐' : ''}</p>
      <p class="rep-current-text">${escapeHtml(displayTextForLine(line))}</p>
    `;
    els.repCounter.textContent = `${Math.min(state.currentIndex + 1,total)} / ${total}`;
    els.repMeterBar.style.width = `${Math.max(0,Math.min(100,percent))}%`;
    const mode = els.repMode.value;
    els.repProgressText.textContent = isIgnored
      ? 'Cette ligne sera passée.'
      : state.focusDifficultOnly
        ? 'Révision des répliques marquées : dis ta ligne, puis valide.'
      : isOwn
        ? (mode === 'auto' ? 'Réplique muette : dis ta ligne, l’app enchaînera automatiquement.' : 'À toi : dis ta réplique, puis valide pour continuer.')
        : (state.playing ? 'L’app donne la réplique.' : 'Prêt à lancer depuis cette réplique.');
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
    document.body.classList.toggle('is-awaiting-user', !!state.awaitingUser);
    document.body.classList.toggle('is-playing', !!state.playing);
    document.body.classList.toggle('has-script-ready', !!hasLines);
    els.repStartBtn.disabled = !hasLines || state.playing;
    if (els.repRestartBtn) els.repRestartBtn.disabled = !hasLines || state.currentIndex <= 0;
    els.repStopBtn.disabled = !hasLines || !state.playing;
    els.repPrevBtn.disabled = !hasLines || state.currentIndex <= 0;
    els.repNextBtn.disabled = !hasLines || state.currentIndex >= state.lines.length - 1;
    els.repContinueBtn.disabled = !state.awaitingUser;
    if (els.repCueBtn) {
      const line = state.lines[state.currentIndex];
      const role = els.repRoleSelect.value;
      els.repCueBtn.disabled = !(state.awaitingUser && line && line.kind === 'line' && role && line.speaker === role);
    }
    updateDifficultUi();
  }

  function renderEmpty(){
    els.repCurrentLine.className = 'rep-current';
    els.repCurrentLine.innerHTML = '<p class="rep-current-role">En attente</p><p class="rep-current-text">Choisis un PDF, choisis ton rôle, puis appuie sur Play.</p>';
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
    state.focusDifficultOnly = false;
    state.ignoredSpeakers = new Set();
    state.difficultLines = new Set();
    state.focusDifficultOnly = false;
    state.roleVoicePrefs = {};
    state.currentScriptId = '';
    state.currentScriptLabel = '';
    state.sections = [];
    els.repStats.innerHTML = '<div><strong>0</strong><span>réplique</span></div><div><strong>0</strong><span>rôle</span></div><div><strong>0</strong><span>didascalie</span></div>';
    els.repCharacters.innerHTML = '';
    els.repRoleSelect.disabled = true;
    els.repRoleSelect.innerHTML = '<option value="">Analyse d’abord le texte</option>';
    renderEmpty();
  }

  function storagePrefix(){
    let uid = state.authUser && state.authUser.uid ? state.authUser.uid : '';
    if (!uid) {
      try { uid = localStorage.getItem('fts_repetition_lastUid') || ''; } catch(e) {}
    }
    return 'fts_repetition_' + (uid || 'local') + '_';
  }

  function getResourceScriptId(key){
    return 'resource:' + String(key || '').trim();
  }

  function getLocalScriptId(label, text){
    return 'local:' + simpleHash(String(label || '') + '|' + String(text || '').slice(0, 3000));
  }

  function simpleHash(value){
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function cacheScript(id, label, text, meta){
    if (!id || !text) return;
    try {
      const payload = {
        id,
        label: label || 'Texte de répétition',
        text,
        meta: meta || {},
        updatedAt: Date.now()
      };
      localStorage.setItem(storagePrefix() + 'script_' + id, JSON.stringify(payload));
      localStorage.setItem(storagePrefix() + 'lastScriptId', id);
      pruneScriptCache();
      renderOfflineLibrary();
    } catch (err) {
      console.warn('[FTS Répétition] cache script', err);
    }
  }

  function getCachedScript(id){
    if (!id) return null;
    try {
      const raw = localStorage.getItem(storagePrefix() + 'script_' + id);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function getLastCachedScript(){
    try {
      const id = localStorage.getItem(storagePrefix() + 'lastScriptId');
      return id ? getCachedScript(id) : null;
    } catch (err) {
      return null;
    }
  }

  function getCachedScriptItems(){
    try {
      const prefix = storagePrefix() + 'script_';
      const items = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        try {
          const cached = JSON.parse(localStorage.getItem(key) || '{}');
          if (!cached || !cached.id || !cached.text) continue;
          const settings = getScriptSettings(cached.id) || {};
          items.push({
            id: cached.id,
            key,
            label: cached.label || 'Texte de répétition',
            text: cached.text || '',
            meta: cached.meta || {},
            updatedAt: cached.updatedAt || 0,
            settings
          });
        } catch(e) {}
      }
      return items.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
      return [];
    }
  }

  function renderOfflineLibrary(){
    if (!els.repOfflineLibrary || !els.repOfflineList) return;
    const items = getCachedScriptItems();
    if (!items.length) {
      els.repOfflineLibrary.hidden = true;
      return;
    }
    els.repOfflineLibrary.hidden = false;
    if (els.repOfflineCount) els.repOfflineCount.textContent = `${items.length} texte${items.length>1?'s':''}`;
    els.repOfflineList.innerHTML = items.map(item => {
      const settings = item.settings || {};
      const date = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('fr-FR') : '';
      const meta = [
        settings.role ? 'Rôle : ' + settings.role : '',
        Number.isFinite(settings.currentIndex) ? 'Ligne ' + (settings.currentIndex + 1) : '',
        settings.difficultLines && settings.difficultLines.length ? settings.difficultLines.length + ' ⭐' : '',
        date
      ].filter(Boolean).join(' · ');
      return `<article class="rep-offline-item" data-script-id="${escapeAttr(item.id)}">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(meta || 'Enregistré sur cet appareil')}</small>
        </div>
        <div class="rep-offline-actions">
          <button class="rep-btn rep-btn-primary" type="button" data-offline-open="${escapeAttr(item.id)}">Reprendre</button>
          <button class="rep-btn" type="button" data-offline-settings="${escapeAttr(item.id)}">⚙️</button>
          <button class="rep-btn" type="button" data-offline-delete="${escapeAttr(item.id)}">Supprimer</button>
        </div>
      </article>`;
    }).join('');
    els.repOfflineList.querySelectorAll('[data-offline-open]').forEach(btn => {
      btn.addEventListener('click', () => openCachedScript(btn.getAttribute('data-offline-open') || '', 'rehearse'));
    });
    els.repOfflineList.querySelectorAll('[data-offline-settings]').forEach(btn => {
      btn.addEventListener('click', () => openCachedScript(btn.getAttribute('data-offline-settings') || '', 'settings'));
    });
    els.repOfflineList.querySelectorAll('[data-offline-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteCachedScript(btn.getAttribute('data-offline-delete') || ''));
    });
  }

  function openCachedScript(id, view){
    const cached = getCachedScript(id);
    if (!cached || !cached.text) return;
    applyExtractedText(cached.text, cached.label || 'Texte de répétition', Object.assign({}, cached.meta || {}, { id:cached.id, label:cached.label || 'Texte de répétition', fromCache:true }));
    setPdfStatus('Texte chargé depuis cet appareil. Les réglages et la reprise ont été restaurés si disponibles.');
    if (view === 'settings') setView('settings');
    else if (view === 'rehearse' && getSelectedRole()) setView('rehearse');
  }

  function deleteCachedScript(id){
    if (!id) return;
    const cached = getCachedScript(id);
    const label = cached && cached.label ? cached.label : 'ce texte';
    if (!confirm(`Supprimer “${label}” de cet appareil ?`)) return;
    try {
      localStorage.removeItem(storagePrefix() + 'script_' + id);
      localStorage.removeItem(storagePrefix() + 'settings_' + id);
      if (localStorage.getItem(storagePrefix() + 'lastScriptId') === id) {
        localStorage.removeItem(storagePrefix() + 'lastScriptId');
      }
    } catch(e) {}
    renderResumeCard();
    renderOfflineLibrary();
  }

  function pruneScriptCache(){
    try {
      const prefix = storagePrefix() + 'script_';
      const items = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          try {
            const value = JSON.parse(localStorage.getItem(key) || '{}');
            items.push({ key, updatedAt:value.updatedAt || 0 });
          } catch(e) {}
        }
      }
      items.sort((a,b) => b.updatedAt - a.updatedAt).slice(30).forEach(item => localStorage.removeItem(item.key));
    } catch(e) {}
  }

  function renderResumeCard(){
    if (!els.repResumeCard) return;
    const cached = getLastCachedScript();
    if (!cached || !cached.text) {
      els.repResumeCard.hidden = true;
      return;
    }
    els.repResumeCard.hidden = false;
    if (els.repResumeTitle) els.repResumeTitle.textContent = cached.label || 'Dernière répétition';
    const settings = getScriptSettings(cached.id) || {};
    const date = cached.updatedAt ? new Date(cached.updatedAt).toLocaleDateString('fr-FR') : '';
    if (els.repResumeMeta) {
      els.repResumeMeta.textContent = [settings.role ? 'Rôle : ' + settings.role : '', Number.isFinite(settings.currentIndex) ? 'Ligne ' + (settings.currentIndex + 1) : '', settings.difficultLines && settings.difficultLines.length ? settings.difficultLines.length + ' ⭐' : '', date].filter(Boolean).join(' · ');
    }
  }

  function resumeLastScript(){
    const cached = getLastCachedScript();
    if (!cached || !cached.text) return;
    applyExtractedText(cached.text, cached.label || 'Dernière répétition', Object.assign({}, cached.meta || {}, { id:cached.id, label:cached.label || 'Dernière répétition', fromCache:true }));
    setPdfStatus('Répétition reprise depuis cet appareil. Firebase n’a pas besoin de relire ce PDF.');
    if (getSelectedRole()) setView('rehearse');
  }

  function forgetLastScript(){
    try {
      const cached = getLastCachedScript();
      if (cached && cached.id) {
        localStorage.removeItem(storagePrefix() + 'script_' + cached.id);
        localStorage.removeItem(storagePrefix() + 'settings_' + cached.id);
      }
      localStorage.removeItem(storagePrefix() + 'lastScriptId');
    } catch(e) {}
    renderResumeCard();
    renderOfflineLibrary();
  }

  function getScriptSettings(id){
    if (!id) return null;
    try {
      const raw = localStorage.getItem(storagePrefix() + 'settings_' + id);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function restoreSettingsForCurrentScript(){
    const settings = getScriptSettings(state.currentScriptId);
    if (!settings) return;
    if (settings.role && state.characters.includes(settings.role)) els.repRoleSelect.value = settings.role;
    if (settings.mode && els.repMode.querySelector(`option[value="${cssEscape(settings.mode)}"]`)) els.repMode.value = settings.mode;
    if (settings.ownLines && els.repOwnLines.querySelector(`option[value="${cssEscape(settings.ownLines)}"]`)) els.repOwnLines.value = settings.ownLines;
    if (settings.pause) els.repPause.value = String(settings.pause);
    if (settings.rate) els.repRate.value = String(settings.rate);
    if (settings.voice !== undefined) els.repVoice.value = String(settings.voice || '');
    state.ignoredSpeakers = new Set((settings.ignoredSpeakers || []).filter(name => state.characters.includes(name)));
    state.difficultLines = new Set((settings.difficultLines || []).map(Number).filter(index => Number.isFinite(index) && index >= 0 && index < state.lines.length));
    state.focusDifficultOnly = false;
    state.roleVoicePrefs = Object.assign({}, settings.roleVoicePrefs || {});
    if (Number.isFinite(settings.currentIndex)) state.currentIndex = Math.max(0, Math.min(state.lines.length - 1, settings.currentIndex));
    renderRoleChoices();
    renderRoleReadControls();
    renderSectionNavigation();
    updateDifficultUi();
    refreshPlayer();
  }

  function saveCurrentScriptSettings(){
    if (!state.currentScriptId) return;
    try {
      const payload = {
        role: els.repRoleSelect ? els.repRoleSelect.value : '',
        mode: els.repMode ? els.repMode.value : 'manual',
        ownLines: els.repOwnLines ? els.repOwnLines.value : 'show',
        pause: els.repPause ? els.repPause.value : '4500',
        rate: els.repRate ? els.repRate.value : '1',
        voice: els.repVoice ? els.repVoice.value : '',
        ignoredSpeakers: Array.from(state.ignoredSpeakers || []),
        difficultLines: Array.from(state.difficultLines || []),
        roleVoicePrefs: Object.assign({}, state.roleVoicePrefs || {}),
        currentIndex: state.currentIndex || 0,
        updatedAt: Date.now()
      };
      localStorage.setItem(storagePrefix() + 'settings_' + state.currentScriptId, JSON.stringify(payload));
      localStorage.setItem(storagePrefix() + 'lastScriptId', state.currentScriptId);
      renderResumeCard();
      renderOfflineLibrary();
    } catch (err) {
      console.warn('[FTS Répétition] sauvegarde réglages', err);
    }
  }

  function cssEscape(value){
    if (window.CSS && CSS.escape) return CSS.escape(String(value));
    return String(value).replace(/"/g, '\\"');
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  }

  function escapeAttr(value){
    return escapeHtml(value).replace(/'/g,'&#39;');
  }
})();
