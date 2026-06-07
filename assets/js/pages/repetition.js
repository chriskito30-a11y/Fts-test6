(function(){
  'use strict';

  const REPETITION_VERSION = 'V140-voice-timeout';

  const AUTO_VOICE_PROFILES = [
    { key:'neutral', label:'naturelle', pitch:1, rate:1 },
    { key:'bright', label:'plus claire', pitch:1.16, rate:1.03 },
    { key:'deep', label:'plus grave', pitch:.86, rate:.96 },
    { key:'quick', label:'plus vive', pitch:1.06, rate:1.1 },
    { key:'calm', label:'plus posee', pitch:.94, rate:.9 },
    { key:'light', label:'plus legere', pitch:1.24, rate:.98 },
    { key:'warm', label:'plus ronde', pitch:.9, rate:1.04 },
    { key:'sharp', label:'plus nette', pitch:1.12, rate:1.14 }
  ];

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
    focusOwnOnly: false,
    sceneOnly: false,
    sceneScope: null,
    openSceneGroupKey: '',
    currentView: 'library',
    xpSession: { practice:0, own:0, difficult:0 },
    piperPrep: { status:'idle', ready:false, signature:'', promise:null, progress:0 }
  };

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    bindElements();
    liftPlayerControlsToViewport();
    bindEvents();
    initEmbeddedVoices();
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
    ['repScriptInput','repAnalyzeBtn','repClearBtn','repStats','repCharacters','repRoleSelect','repRoleReadControls','repMode','repReadSpeakerName','repOwnLines','repPause','repRate','repVoice','repStartBtn','repContinueBtn','repCueBtn','repDifficultBtn','repReviewDifficultBtn','repExitDifficultBtn','repDifficultCount','repTrainingPresets','repRestartBtn','repPrevBtn','repNextBtn','repStopBtn','repCurrentLine','repProgressText','repCounter','repMeterBar','repLineList','repSpeechStatus','repAppStatus','repResourceSelect','repLoadResourcePdfBtn','repReloadAppPdfBtn','repLocalPdfInput','repLoadLocalPdfBtn','repPdfStatus','repAppDebug','repAppDebugWrap','repResumeCard','repResumeTitle','repResumeMeta','repResumeBtn','repResumeReviewBtn','repResumeOwnBtn','repResumePdfBtn','repForgetResumeBtn','repOfflineLibrary','repOfflineCount','repOfflineList','repSectionSelect','repSectionNav','repSceneCurrent','repSceneAccordion','repScenePanel','repOpenSceneBtn','repRestartSceneBtn','repSceneOnlyToggle','repBackToLibraryBtn','repBackToRoleBtn','repBeginRehearsalBtn','repOpenSettingsBtn','repBackToLibraryFromPlayerBtn','repSettingsBtn','repToggleScriptBtn','repScriptPreview'].forEach(id=>{
      els[id] = document.getElementById(id);
    });
  }



  function liftPlayerControlsToViewport(){
    // La barre de contrôle doit être fixée au viewport, pas à la carte répétition.
    // Sur certains navigateurs Android/Fold, un élément `position:fixed` placé dans
    // une carte avec effets graphiques peut se comporter comme s'il était ancré à
    // cette carte. On la déplace donc une seule fois à la racine du document.
    const bar = document.querySelector('.rep-actions-player');
    if (!bar || bar.dataset.viewportLifted === '1') return;
    bar.dataset.viewportLifted = '1';
    bar.setAttribute('aria-label', 'Contrôles de répétition');
    document.body.appendChild(bar);
  }

  function bindEvents(){
    els.repAnalyzeBtn.addEventListener('click', analyze);
    if (els.repScriptInput) els.repScriptInput.addEventListener('input', renderScriptEditorPreview);
    els.repClearBtn.addEventListener('click', clearAll);
    els.repStartBtn.addEventListener('click', start);
    els.repContinueBtn.addEventListener('click', continueAfterOwnLine);
    if (els.repCueBtn) els.repCueBtn.addEventListener('click', cueOwnLine);
    if (els.repDifficultBtn) els.repDifficultBtn.addEventListener('click', toggleDifficultLine);
    if (els.repReviewDifficultBtn) els.repReviewDifficultBtn.addEventListener('click', startDifficultReview);
    if (els.repExitDifficultBtn) els.repExitDifficultBtn.addEventListener('click', exitFocusMode);
    if (els.repTrainingPresets) {
      els.repTrainingPresets.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => applyTrainingPreset(btn.getAttribute('data-preset') || 'discover'));
      });
    }
    if (els.repRestartBtn) els.repRestartBtn.addEventListener('click', restartFromBeginning);
    els.repPrevBtn.addEventListener('click', previousLine);
    els.repNextBtn.addEventListener('click', nextLineManual);
    els.repStopBtn.addEventListener('click', stop);
    els.repRoleSelect.addEventListener('change', () => { stop(false); state.currentIndex = 0; state.awaitingUser = false; state.focusDifficultOnly = false; state.focusOwnOnly = false; refreshPlayer(); renderRoleChoices(); renderSectionNavigation(); updateDifficultUi(); saveCurrentScriptSettings(); if (getSelectedRole() && (state.currentView === 'role' || state.currentView === 'library')) setView('mode'); });
    els.repMode.addEventListener('change', () => { refreshPlayer(); saveCurrentScriptSettings(); });
    if (els.repReadSpeakerName) els.repReadSpeakerName.addEventListener('change', () => { saveCurrentScriptSettings(); });
    els.repOwnLines.addEventListener('change', () => { refreshPlayer(); saveCurrentScriptSettings(); });
    els.repPause.addEventListener('change', saveCurrentScriptSettings);
    els.repRate.addEventListener('change', saveCurrentScriptSettings);
    els.repVoice.addEventListener('change', () => { state.piperPrep.ready = false; state.piperPrep.signature = ''; saveCurrentScriptSettings(); renderRoleReadControls(); updateSpeechStatus(); prepareEmbeddedVoicesForCurrentScript(false); });
    if (els.repResourceSelect) els.repResourceSelect.addEventListener('change', onResourceSelectChange);
    if (els.repLoadResourcePdfBtn) els.repLoadResourcePdfBtn.addEventListener('click', loadSelectedResourcePdf);
    if (els.repReloadAppPdfBtn) els.repReloadAppPdfBtn.addEventListener('click', () => loadAppDocumentsForCurrentUser(true));
    if (els.repLocalPdfInput) els.repLocalPdfInput.addEventListener('change', onLocalPdfChange);
    if (els.repLoadLocalPdfBtn) els.repLoadLocalPdfBtn.addEventListener('click', loadLocalPdf);
    if (els.repResumeBtn) els.repResumeBtn.addEventListener('click', resumeLastScript);
    if (els.repResumeReviewBtn) els.repResumeReviewBtn.addEventListener('click', resumeLastScriptDifficult);
    if (els.repResumeOwnBtn) els.repResumeOwnBtn.addEventListener('click', resumeLastScriptOwnOnly);
    if (els.repResumePdfBtn) els.repResumePdfBtn.addEventListener('click', openLastCachedPdf);
    if (els.repForgetResumeBtn) els.repForgetResumeBtn.addEventListener('click', forgetLastScript);
    if (els.repSectionSelect) els.repSectionSelect.addEventListener('change', goToSelectedSection);
    if (els.repOpenSceneBtn) els.repOpenSceneBtn.addEventListener('click', toggleScenePanel);
    if (els.repRestartSceneBtn) els.repRestartSceneBtn.addEventListener('click', restartCurrentScene);
    if (els.repSceneOnlyToggle) els.repSceneOnlyToggle.addEventListener('change', () => { state.sceneOnly = !!els.repSceneOnlyToggle.checked; updateSceneScopeFromCurrent(); renderSectionNavigation(); saveCurrentScriptSettings(); });
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
    if (next === 'mode' || next === 'rehearse') prepareEmbeddedVoicesForCurrentScript(false);
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

  async function enterRehearsal(autoStart){
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
    if (usesEmbeddedVoicesForCurrentScript()) {
      const prepared = await prepareEmbeddedVoicesForCurrentScript(true);
      if (!prepared) {
        els.repSpeechStatus.textContent = 'Voix FTS non préparées · secours navigateur disponible';
      }
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

  function initEmbeddedVoices(){
    window.addEventListener('FTS_PIPER_VOICES_READY', () => {
      loadVoices(true);
      updateSpeechStatus();
      if (state.characters && state.characters.length) renderRoleReadControls();
      prepareEmbeddedVoicesForCurrentScript(false);
    });
    window.addEventListener('FTS_PIPER_PREPARE_PROGRESS', event => {
      const detail = event && event.detail ? event.detail : {};
      state.piperPrep.status = detail.status || state.piperPrep.status || 'preparing';
      state.piperPrep.progress = Number(detail.percent) || state.piperPrep.progress || 0;
      if (detail.status === 'ready') state.piperPrep.ready = true;
      if (els.repSpeechStatus && detail.label) els.repSpeechStatus.textContent = detail.percent ? `${detail.label} ${Math.round(detail.percent)}%` : detail.label;
    });
    const piper = getPiperService();
    if (piper && piper.loadManifest) {
      piper.loadManifest().then(() => {
        loadVoices(true);
        updateSpeechStatus();
        prepareEmbeddedVoicesForCurrentScript(false);
      }).catch(() => updateSpeechStatus());
    }
  }

  function getPiperService(){
    return window.FTS && window.FTS.Services && window.FTS.Services.PiperVoice ? window.FTS.Services.PiperVoice : null;
  }

  function getEmbeddedVoices(){
    const piper = getPiperService();
    return piper && piper.getVoices ? (piper.getVoices() || []) : [];
  }

  function hasEmbeddedVoices(){
    const piper = getPiperService();
    return !!(piper && piper.isSupported && piper.isSupported() && getEmbeddedVoices().length);
  }

  function updateSpeechStatus(){
    const embeddedCount = hasEmbeddedVoices() ? getEmbeddedVoices().length : 0;
    if (embeddedCount) {
      if (state.piperPrep && state.piperPrep.status === 'preparing') {
        els.repSpeechStatus.textContent = `Préparation voix FTS ${Math.round(state.piperPrep.progress || 0)}%`;
      } else if (state.piperPrep && state.piperPrep.ready) {
        els.repSpeechStatus.textContent = `${embeddedCount} voix embarquées FTS · prêtes hors ligne`;
      } else {
        els.repSpeechStatus.textContent = `${embeddedCount} voix embarquées FTS · à préparer`;
      }
      return;
    }
    if (!('speechSynthesis' in window)) {
      els.repSpeechStatus.textContent = 'Voix non compatible';
      return;
    }
    if (state.voices.length > 1) {
      els.repSpeechStatus.textContent = `${state.voices.length} voix · auto par rôle`;
    } else if (state.voices.length === 1) {
      els.repSpeechStatus.textContent = '1 voix · variantes par rôle';
    } else {
      els.repSpeechStatus.textContent = 'Voix du navigateur';
    }
  }

  function scheduleVoiceReloads(){
    // Sur mobile, les voix arrivent parfois après le chargement de la page.
    // On relit plusieurs fois sans toucher à la boucle de lecture stable.
    [250, 900, 1800, 3200].forEach(delay => {
      setTimeout(() => loadVoices(true), delay);
    });
  }

  function loadVoices(silent){
    const hasSpeech = 'speechSynthesis' in window;
    const previousSignature = (state.voices || []).map(v => `${v.name}|${v.lang}|${v.voiceURI}`).join('||');
    state.voices = hasSpeech ? (window.speechSynthesis.getVoices() || []) : [];
    const current = els.repVoice.value;
    const french = getFrenchVoices();
    const ordered = french.length ? french.concat(state.voices.filter(v => !french.includes(v))) : state.voices;
    const embeddedVoices = getEmbeddedVoices();
    const embeddedOptions = embeddedVoices.length ? embeddedVoices.map(voice => {
      const genderLabel = voice.gender === 'female' ? ' Â· femme' : voice.gender === 'male' ? ' Â· homme' : '';
      return `<option value="piper:${escapeAttr(voice.id)}">FTS ${escapeHtml(voice.label || voice.id)}${genderLabel}</option>`;
    }).join('') + '<option value="" disabled>---------- Navigateur ----------</option>' : '';
    els.repVoice.innerHTML = '<option value="">Voix embarquees FTS - auto par personnage</option>' + embeddedOptions + '<option value="browser-auto">Voix du navigateur - auto</option><option value="default">Voix unique du navigateur</option>' + ordered.map((voice)=>{
      const originalIndex = state.voices.indexOf(voice);
      const gender = inferVoiceGender(voice);
      const genderLabel = gender === 'female' ? ' · femme' : gender === 'male' ? ' · homme' : '';
      return `<option value="${originalIndex}">${escapeHtml(voice.name)}${voice.lang ? ' — ' + escapeHtml(voice.lang) : ''}${genderLabel}</option>`;
    }).join('');
    if (current === '' || current === 'default' || current === 'browser-auto' || (String(current).startsWith('piper:') && embeddedVoices.some(voice => 'piper:' + voice.id === current)) || (current && state.voices[Number(current)])) els.repVoice.value = current;
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
      renderResourceOptions([], 'Connexion indisponible');
      setAppDebug('Connexion indisponible pour charger les textes de l’app.', true);
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
      const pdfs = normalized.filter(resource => resource.active && isScriptRehearsalPdf(resource));
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


  function isScriptRehearsalPdf(resource){
    if (!isPdfResource(resource)) return false;
    const cat = norm(resource.cat || resource.category || '');
    const compatibleCat = ['theatre','comedie musicale','singer show','singer academy','chant'].some(key => cat.includes(key));
    const flagged = resource.scriptRehearsal === true || String(resource.scriptRehearsal || '').toLowerCase() === 'true';
    return compatibleCat && flagged;
  }

  function canProfileSeeResource(profile, resource){
    if (!profile) return false;
    const status = String(profile.status || '').toLowerCase();
    const role = String(profile.role || '').toLowerCase();
    if (status !== 'active') return false;
    if (role === 'admin') return true;

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
        applyExtractedText(cached.text, resource.name, Object.assign({}, cached.meta || {}, { id: scriptId, label: resource.name, source:'resource', key:resource.key, fromCache:true }));
        setPdfStatus(`Texte prêt à reprendre.`);
        // Si le texte était déjà analysé avant la V135, on ne relit pas le PDF automatiquement
        // pour éviter du trafic inutile. Le PDF original sera enregistré localement au prochain chargement complet.
        return;
      }
      const buffer = await fetchPdfBufferFromUrl(url);
      const savedPdf = await cacheOriginalPdf(scriptId, resource.name, buffer, { source:'resource', key:resource.key });
      const text = await extractPdfTextFromBuffer(cloneArrayBuffer(buffer));
      applyExtractedText(text, resource.name, { id: scriptId, label: resource.name, source:'resource', key:resource.key, pdfCached: savedPdf });
    });
  }

  async function loadLocalPdf(){
    if (!state.localPdfFile) return;
    await runPdfLoad(async () => {
      setPdfStatus(`Analyse de “${state.localPdfFile.name}”…`);
      const buffer = await state.localPdfFile.arrayBuffer();
      const text = await extractPdfTextFromBuffer(cloneArrayBuffer(buffer));
      const scriptId = getLocalScriptId(state.localPdfFile.name, text);
      const savedPdf = await cacheOriginalPdf(scriptId, state.localPdfFile.name, buffer, { source:'local' });
      applyExtractedText(text, state.localPdfFile.name, { id: scriptId, label: state.localPdfFile.name, source:'local', pdfCached: savedPdf });
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

  async function fetchPdfBufferFromUrl(url){
    const response = await fetch(url, { mode:'cors' });
    if (!response.ok) throw new Error(`PDF inaccessible (${response.status}).`);
    return response.arrayBuffer();
  }

  function cloneArrayBuffer(buffer){
    if (!buffer) return new ArrayBuffer(0);
    if (buffer instanceof ArrayBuffer) return buffer.slice(0);
    if (ArrayBuffer.isView(buffer)) return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    return new Blob([buffer], { type:'application/pdf' });
  }

  async function normalizePdfArrayBuffer(input){
    if (!input) return new ArrayBuffer(0);
    if (input instanceof ArrayBuffer) return input.slice(0);
    if (ArrayBuffer.isView(input)) return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    if (input instanceof Blob) return input.arrayBuffer();
    return new Blob([input], { type:'application/pdf' }).arrayBuffer();
  }

  async function extractPdfTextFromUrl(url){
    if (!window.pdfjsLib) throw new Error('La lecture PDF n’est pas disponible sur ce navigateur.');
    const buffer = await fetchPdfBufferFromUrl(url);
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
    els.repScriptInput.value = formatTextForEditor(text);
    renderScriptEditorPreview();
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

  function formatTextForEditor(text){
    const raw = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!raw) return '';
    const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
    const formatted = [];
    let lastWasDialogue = false;
    lines.forEach(line => {
      const isStructured = !!splitRoleLine(line) || !!parseActSceneHeading(line) || /^#{1,4}\s+/.test(line) || isStageOnlyLine(line);
      if (formatted.length && isStructured && lastWasDialogue) formatted.push('');
      formatted.push(line);
      lastWasDialogue = isStructured;
    });
    return formatted.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  function isStageOnlyLine(line){
    const value = String(line || '').trim();
    return (value.startsWith('[') && value.endsWith(']')) || (value.startsWith('*') && value.endsWith('*'));
  }

  function escapeHtml(value){
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatStageInline(text){
    return escapeHtml(text).replace(/(\([^()]*\)|\[[^\[\]]*\]|\*[^*]+\*)/g, '<em>$1</em>');
  }

  function renderScriptEditorPreview(){
    if (!els.repScriptPreview || !els.repScriptInput) return;
    const text = String(els.repScriptInput.value || '').trim();
    if (!text) {
      els.repScriptPreview.innerHTML = '<p class="rep-preview-muted">L’aperçu apparaîtra ici.</p>';
      return;
    }
    const rows = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 120);
    const html = rows.map(line => {
      const heading = line.match(/^#{1,4}\s+(.+)$/);
      const section = parseActSceneHeading(heading ? heading[1].trim() : line);
      if (section) return '<div class="rep-preview-section">' + escapeHtml(section.text) + '</div>';
      if (isStageOnlyLine(line)) return '<div class="rep-preview-stage"><em>' + escapeHtml(cleanStage(line)) + '</em></div>';
      const roleLine = splitRoleLine(line);
      if (roleLine) {
        return '<div class="rep-preview-line"><strong>' + escapeHtml(roleLine.speaker) + ' :</strong> <span>' + formatStageInline(roleLine.text) + '</span></div>';
      }
      return '<div class="rep-preview-continuation">' + formatStageInline(line) + '</div>';
    }).join('');
    const more = rows.length >= 120 ? '<div class="rep-preview-muted">Aperçu limité aux premières lignes.</div>' : '';
    els.repScriptPreview.innerHTML = html + more;
  }

  function analyze(){
    stop(false);
    const text = (els.repScriptInput.value || '').trim();
    renderScriptEditorPreview();
    const lines = parseScript(text);
    state.lines = lines;
    state.characters = collectCharacters(lines);
    state.currentIndex = state.sceneOnly && state.sceneScope ? state.sceneScope.start : (state.focusOwnOnly ? (getOwnIndexesForRole()[0] || 0) : 0);
    state.awaitingUser = false;
    state.sections = collectSections(lines);
    state.sceneScope = null;
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

  function findMatchingRole(value){
    const wanted = normalizeSpeaker(value);
    if (!wanted || !state.characters || !state.characters.length) return '';
    return state.characters.find(name => normalizeSpeaker(name) === wanted) || '';
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
        state.focusOwnOnly = false;
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

  function updateSceneCurrentSummary(groups){
    if (!els.repSectionNav) return;
    if (!state.lines.length) {
      els.repSectionNav.hidden = true;
      if (els.repSectionSelect) els.repSectionSelect.innerHTML = '<option value="">Aucune scène détectée</option>';
      return null;
    }
    groups = groups || buildSceneGroups();
    const currentScene = getSceneForIndex(state.currentIndex, groups);
    if (currentScene) updateSceneScopeFromCurrent(false);
    els.repSectionNav.hidden = false;
    if (els.repSceneCurrent) {
      const count = countLinesInRange(currentScene ? currentScene.start : 0, currentScene ? currentScene.end : state.lines.length - 1);
      const roleCount = countRoleLinesInRange(currentScene ? currentScene.start : 0, currentScene ? currentScene.end : state.lines.length - 1);
      els.repSceneCurrent.innerHTML = `<strong>${escapeHtml(currentScene ? currentScene.fullLabel : 'Texte complet')}</strong><small>${count} réplique${count>1?'s':''}${roleCount ? ' · ' + roleCount + ' de mon rôle' : ''}</small>`;
    }
    if (els.repSceneOnlyToggle) els.repSceneOnlyToggle.checked = !!state.sceneOnly;
    return currentScene;
  }

  function renderSectionNavigation(){
    if (!els.repSectionNav) return;
    const groups = buildSceneGroups();
    const currentScene = updateSceneCurrentSummary(groups);
    if (!state.lines.length) return;

    // Important UX : on ouvre un acte seulement quand l'utilisateur ouvre la navigation.
    // Pendant la lecture, la scène courante se met à jour sans redéployer/reconstruire
    // l'accordéon, sinon le panneau envahit l'écran à chaque réplique.
    if (!state.openSceneGroupKey && currentScene && currentScene.groupKey) state.openSceneGroupKey = currentScene.groupKey;

    if (els.repSectionSelect) {
      els.repSectionSelect.innerHTML = '<option value="">Aller à un acte / une scène…</option>' + groups.flatMap(group => group.scenes.map(scene => `<option value="${scene.start}">${escapeHtml(scene.fullLabel)}</option>`)).join('');
    }
    if (!els.repSceneAccordion) return;
    els.repSceneAccordion.innerHTML = groups.map(group => {
      const open = group.key === state.openSceneGroupKey ? ' open' : '';
      return `<details class="rep-scene-group" data-scene-group="${escapeAttr(group.key)}"${open}>
        <summary><span>${escapeHtml(group.label)}</span><small>${group.scenes.length} scène${group.scenes.length>1?'s':''}</small></summary>
        <div class="rep-scene-list">
          ${group.scenes.map(scene => {
            const active = currentScene && scene.key === currentScene.key ? ' is-active' : '';
            const total = countLinesInRange(scene.start, scene.end);
            const roleTotal = countRoleLinesInRange(scene.start, scene.end);
            return `<button class="rep-scene-choice${active}" type="button" data-scene-start="${scene.start}">
              <span>${escapeHtml(scene.label)}</span>
              <small>${total} réplique${total>1?'s':''}${roleTotal ? ' · ' + roleTotal + ' de mon rôle' : ''}</small>
            </button>`;
          }).join('')}
        </div>
      </details>`;
    }).join('');

    els.repSceneAccordion.querySelectorAll('.rep-scene-group').forEach(details => {
      details.addEventListener('toggle', () => {
        if (details.open) state.openSceneGroupKey = details.getAttribute('data-scene-group') || '';
      });
    });
    els.repSceneAccordion.querySelectorAll('[data-scene-start]').forEach(button => {
      button.addEventListener('click', () => {
        const start = Number(button.getAttribute('data-scene-start')) || 0;
        goToSceneStart(start, true);
      });
    });
  }

  function buildSceneGroups(){
    const lines = state.lines || [];
    if (!lines.length) return [];
    const groups = [];
    let currentGroup = null;
    let sceneCounter = 0;

    function ensureGroup(label, startIndex){
      const key = 'group_' + normalizeForKey(label || 'Texte');
      let group = groups.find(g => g.key === key);
      if (!group) {
        group = { key, label: label || 'Texte', start:startIndex || 0, scenes:[] };
        groups.push(group);
      }
      return group;
    }

    lines.forEach((line, index) => {
      if (!line || line.kind !== 'stage') return;
      if (line.sectionType === 'act') {
        currentGroup = ensureGroup(line.speaker + (line.sectionTitle ? ' · ' + line.sectionTitle : ''), index);
        return;
      }
      if (line.sectionType === 'scene') {
        if (!currentGroup) currentGroup = ensureGroup('Texte', 0);
        sceneCounter += 1;
        const label = line.speaker + (line.sectionTitle ? ' · ' + line.sectionTitle : '');
        currentGroup.scenes.push({ key:'scene_' + sceneCounter, label, fullLabel:(currentGroup.label !== 'Texte' ? currentGroup.label + ' · ' : '') + label, start:index, end:lines.length - 1, groupKey:currentGroup.key });
      }
    });

    const flat = groups.flatMap(g => g.scenes);
    if (!flat.length) {
      const acts = lines.map((line,index)=>({line,index})).filter(item => item.line && item.line.kind === 'stage' && item.line.sectionType === 'act');
      if (acts.length) {
        acts.forEach((item, i) => {
          const label = item.line.speaker + (item.line.sectionTitle ? ' · ' + item.line.sectionTitle : '');
          const group = ensureGroup(label, item.index);
          group.scenes.push({ key:'actscene_' + i, label:'Acte complet', fullLabel:label, start:item.index, end:(acts[i+1] ? acts[i+1].index - 1 : lines.length - 1), groupKey:group.key });
        });
      } else {
        groups.push({ key:'texte', label:'Texte complet', start:0, scenes:[{ key:'scene_full', label:'Texte complet', fullLabel:'Texte complet', start:0, end:lines.length - 1, groupKey:'texte' }] });
      }
    }

    const allScenes = groups.flatMap(g => g.scenes).sort((a,b)=>a.start-b.start);
    allScenes.forEach((scene, i) => {
      const next = allScenes[i+1];
      scene.end = Math.max(scene.start, next ? next.start - 1 : lines.length - 1);
    });
    return groups.filter(g => g.scenes.length);
  }

  function getSceneForIndex(index, groups){
    const allScenes = (groups || buildSceneGroups()).flatMap(g => g.scenes);
    if (!allScenes.length) return null;
    return allScenes.find(scene => index >= scene.start && index <= scene.end) || allScenes.find(scene => index < scene.start) || allScenes[allScenes.length - 1];
  }

  function countLinesInRange(start, end){
    return (state.lines || []).filter((line,index) => index >= start && index <= end && line && line.kind === 'line').length;
  }

  function countRoleLinesInRange(start, end){
    const role = getSelectedRole();
    if (!role) return 0;
    return (state.lines || []).filter((line,index) => index >= start && index <= end && line && line.kind === 'line' && line.speaker === role).length;
  }

  function normalizeForKey(value){
    return String(value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'texte';
  }

  function toggleScenePanel(){
    if (!els.repScenePanel) return;
    els.repScenePanel.hidden = !els.repScenePanel.hidden;
    if (!els.repScenePanel.hidden) renderSectionNavigation();
  }

  function updateSceneScopeFromCurrent(force = true){
    if (!state.lines.length) return;
    const scene = getSceneForIndex(state.currentIndex);
    if (!scene) return;
    if (force || !state.sceneScope || state.currentIndex < state.sceneScope.start || state.currentIndex > state.sceneScope.end) {
      state.sceneScope = { start:scene.start, end:scene.end, label:scene.fullLabel };
    }
  }

  function goToSceneStart(start, closePanel){
    const wasPlaying = !!state.playing;
    clearPendingTimeout();
    state.playToken += 1;
    stopSpeechOnly(true);
    state.currentIndex = Math.max(0, Math.min(state.lines.length - 1, start));
    state.awaitingUser = false;
    state.focusDifficultOnly = false;
    updateSceneScopeFromCurrent(true);
    if (closePanel && els.repScenePanel) els.repScenePanel.hidden = true;
    refreshPlayer(document.body.classList.contains('rep-show-script'));
    saveCurrentScriptSettings();
    if (wasPlaying) { state.playing = true; playCurrent(); }
  }

  function restartCurrentScene(){
    updateSceneScopeFromCurrent(true);
    if (state.sceneScope) goToSceneStart(state.sceneScope.start, true);
  }

  function goToSelectedSection(){
    if (!els.repSectionSelect || !els.repSectionSelect.value) return;
    const index = Number(els.repSectionSelect.value);
    if (!Number.isFinite(index)) return;
    goToSceneStart(index, true);
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
        <strong>Rôles lus par l’app</strong>
        <small>Comme dans une italienne, ton rôle s’arrête pour te laisser parler. Décoche seulement les faux rôles.</small>
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
          <small>Auto · voix ou variantes par personnage</small>
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
        <p class="rep-role-voice-note">Les voix FTS sont embarquees dans l'app : Jessica, Pierre, Siwis et Gilles restent disponibles sur mobile. Les voix du navigateur restent seulement en secours.</p>
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
        state.piperPrep.ready = false;
        state.piperPrep.signature = '';
        prepareEmbeddedVoicesForCurrentScript(false);
      });
    });

    els.repRoleReadControls.querySelectorAll('.rep-role-voice-select').forEach(select => {
      select.addEventListener('change', () => {
        const name = select.getAttribute('data-speaker') || '';
        if (!name) return;
        if (select.value) state.roleVoicePrefs[name] = select.value;
        else delete state.roleVoicePrefs[name];
        state.piperPrep.ready = false;
        state.piperPrep.signature = '';
        saveCurrentScriptSettings();
        prepareEmbeddedVoicesForCurrentScript(false);
      });
    });
  }

  function renderRoleVoiceOptions(selectedValue){
    const frenchVoices = getFrenchVoices();
    const hasFemale = frenchVoices.some(v => inferVoiceGender(v) === 'female');
    const hasMale = frenchVoices.some(v => inferVoiceGender(v) === 'male');
    const embeddedVoices = getEmbeddedVoices();
    const profileChoices = AUTO_VOICE_PROFILES.slice(1, 6).map(profile => ({
      value:'profile:' + profile.key,
      label:'Variante ' + profile.label
    }));
    const embeddedChoices = embeddedVoices.map(voice => ({
      value:'piper:' + voice.id,
      label:'FTS ' + (voice.label || voice.id) + (voice.gender === 'female' ? ' - femme' : voice.gender === 'male' ? ' - homme' : '')
    }));
    const choices = [
      { value:'', label:'Auto FTS par personnage' },
      { value:'piper-gender:female', label:'FTS femme auto', disabled: !embeddedVoices.some(voice => voice.gender === 'female') },
      { value:'piper-gender:male', label:'FTS homme auto', disabled: !embeddedVoices.some(voice => voice.gender === 'male') },
      ...embeddedChoices,
      ...profileChoices,
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
      discover: { mode:'manual', ownLines:'show', pause:'4500', rate:'0.85', readSpeakerName:'no' },
      learn:    { mode:'manual', ownLines:'initials', pause:'4500', rate:'1', readSpeakerName:'no' },
      run:      { mode:'auto', ownLines:'hide', pause:'2500', rate:'1', readSpeakerName:'no' }
    };
    const cfg = map[preset] || map.discover;
    if (els.repMode) els.repMode.value = cfg.mode;
    if (els.repOwnLines) els.repOwnLines.value = cfg.ownLines;
    if (els.repPause) els.repPause.value = cfg.pause;
    if (els.repRate) els.repRate.value = cfg.rate;
    if (els.repReadSpeakerName) els.repReadSpeakerName.value = cfg.readSpeakerName || 'no';
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


  function getOwnIndexesForRole(){
    const role = els.repRoleSelect ? els.repRoleSelect.value : '';
    if (!role) return [];
    const roleKey = normalizeSpeaker(role);
    return state.lines
      .map((line,index) => ({ line, index }))
      .filter(item => item.line && item.line.kind === 'line' && normalizeSpeaker(item.line.speaker) === roleKey)
      .map(item => item.index);
  }

  function nextOwnIndex(fromIndex, direction){
    const indexes = getOwnIndexesForRole();
    if (!indexes.length) return -1;
    if (direction < 0) {
      for (let i = indexes.length - 1; i >= 0; i -= 1) if (indexes[i] < fromIndex) return indexes[i];
      return indexes[indexes.length - 1];
    }
    for (const index of indexes) if (index > fromIndex) return index;
    return -1;
  }

  function startOwnLinesOnly(){
    let role = els.repRoleSelect ? els.repRoleSelect.value : '';
    if (role) {
      const matched = findMatchingRole(role);
      if (matched && matched !== role && els.repRoleSelect) {
        els.repRoleSelect.value = matched;
        role = matched;
      }
    }
    if (!role) {
      alert('Choisis d’abord ton personnage.');
      return false;
    }
    const indexes = getOwnIndexesForRole();
    if (!indexes.length) {
      alert('Aucune réplique trouvée pour ce rôle.');
      return false;
    }
    stop(false);
    state.focusOwnOnly = true;
    state.focusDifficultOnly = false;
    const target = indexes.find(i => i >= state.currentIndex) || indexes[0];
    state.currentIndex = target;
    state.awaitingUser = false;
    setView('rehearse');
    refreshPlayer();
    updateDifficultUi();
    scrollToPlayer();
    saveCurrentScriptSettings();
    return true;
  }

  function exitFocusMode(){
    state.focusDifficultOnly = false;
    state.focusOwnOnly = false;
    refreshPlayer();
    updateDifficultUi();
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
    state.focusOwnOnly = false;
    const target = indexes.find(i => i >= state.currentIndex) || indexes[0];
    state.currentIndex = getDifficultReviewStartIndex(target);
    state.awaitingUser = false;
    els.repMode.value = 'manual';
    refreshPlayer();
    updateDifficultUi();
    scrollToPlayer();
    saveCurrentScriptSettings();
  }

  function exitDifficultReview(){
    state.focusDifficultOnly = false;
    state.focusOwnOnly = false;
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

  function getDifficultReviewStartIndex(targetIndex){
    // Mode “Réviser ⭐” : on replace l'élève juste avant sa réplique difficile
    // pour que l'app donne la réplique, au lieu d'arriver directement sur sa ligne.
    const role = els.repRoleSelect ? els.repRoleSelect.value : '';
    const target = state.lines[targetIndex];
    if (!target || target.kind !== 'line' || !role || target.speaker !== role) return Math.max(0, targetIndex || 0);

    // On cherche la réplique lisible juste avant, idéalement un autre personnage.
    for (let i = targetIndex - 1; i >= Math.max(0, targetIndex - 4); i -= 1) {
      const line = state.lines[i];
      if (!line) continue;
      if (line.kind === 'line' && line.speaker !== role && !isIgnoredSpeakerLine(line, role)) return i;
    }

    // Si aucune réplique d'un autre rôle n'est proche, on peut garder une indication de scène juste avant.
    for (let i = targetIndex - 1; i >= Math.max(0, targetIndex - 2); i -= 1) {
      const line = state.lines[i];
      if (line && line.kind === 'stage') return i;
    }

    return targetIndex;
  }

  function getCurrentDifficultTargetIndex(){
    const role = els.repRoleSelect ? els.repRoleSelect.value : '';
    const line = state.lines[state.currentIndex];
    if (line && line.kind === 'line' && role && line.speaker === role && state.difficultLines && state.difficultLines.has(state.currentIndex)) {
      return state.currentIndex;
    }
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
      els.repDifficultBtn.textContent = isMarked ? '★' : '⭐';
      els.repDifficultBtn.title = isMarked ? 'Réplique marquée à retravailler' : 'Marquer cette réplique à retravailler';
      els.repDifficultBtn.setAttribute('aria-label', els.repDifficultBtn.title);
      els.repDifficultBtn.classList.toggle('is-active', isMarked);
    }
    if (els.repReviewDifficultBtn) {
      els.repReviewDifficultBtn.disabled = !indexes.length;
      els.repReviewDifficultBtn.textContent = indexes.length ? 'Réviser ⭐ (' + indexes.length + ')' : 'Réviser ⭐';
    }
    if (els.repExitDifficultBtn) {
      els.repExitDifficultBtn.hidden = !(state.focusDifficultOnly || state.focusOwnOnly);
      els.repExitDifficultBtn.textContent = state.focusOwnOnly ? 'Tout' : 'Tout';
      els.repExitDifficultBtn.title = state.focusOwnOnly ? 'Revenir au texte complet' : 'Revenir à tout le texte';
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

  async function start(){
    if (!state.lines.length) return;
    if (els.repMode.value !== 'full' && !els.repRoleSelect.value) {
      alert('Choisis ton rôle avant de lancer la répétition.');
      return;
    }
    if (usesEmbeddedVoicesForCurrentScript()) {
      const prepared = await prepareEmbeddedVoicesForCurrentScript(true);
      if (!prepared) {
        els.repSpeechStatus.textContent = 'Voix FTS lentes · lecture avec secours navigateur si besoin';
      }
    }
    const piper = getPiperService();
    if (piper && piper.unlock) piper.unlock();
    stopSpeechOnly();
    state.playToken += 1;
    state.playing = true;
    state.awaitingUser = false;
    state.currentIndex = Math.min(state.currentIndex, state.lines.length - 1);
    if (state.sceneOnly) updateSceneScopeFromCurrent(true);
    setButtons();
    saveCurrentScriptSettings();
    playCurrent();
  }


  function awardRepetitionXp(action, points, maxPerDay){
    // XP invisible : aucune alerte utilisateur. Si Firebase refuse, la répétition continue.
    try {
      const user = state.authUser || (firebase.auth && firebase.auth().currentUser) || null;
      if (!user || !user.uid || !state.db || !window.FTSGamification || !FTSGamification.awardXp) return;
      FTSGamification.awardXp(state.db, user.uid, action, points, { maxPerDay:maxPerDay || 1 }).catch(() => {});
    } catch(e) {}
  }

  function registerRepetitionEffort(){
    const line = state.lines[state.currentIndex];
    const role = getSelectedRole();
    if (!line || line.kind !== 'line' || !role || line.speaker !== role) return;

    if (!state.xpSession) state.xpSession = { practice:0, own:0, difficult:0 };

    if (state.focusDifficultOnly) {
      state.xpSession.difficult += 1;
      // Chaque réplique difficile réellement retravaillée peut tenter un gain, limité par jour.
      awardRepetitionXp('script_rehearsal_difficult', 5, 2);
      return;
    }

    if (state.focusOwnOnly) {
      state.xpSession.own += 1;
      if (state.xpSession.own >= 3) {
        state.xpSession.own = 0;
        awardRepetitionXp('script_rehearsal_own_lines', 5, 2);
      }
      return;
    }

    if (els.repMode && els.repMode.value !== 'full') {
      state.xpSession.practice += 1;
      if (state.xpSession.practice >= 5) {
        state.xpSession.practice = 0;
        awardRepetitionXp('script_rehearsal_practice', 5, 3);
      }
    }
  }

  function playCurrent(){
    clearPendingTimeout();
    if (!state.playing || !state.lines.length) return;
    const token = state.playToken;
    if (state.currentIndex >= state.lines.length) {
      finish();
      return;
    }
    if (state.sceneOnly && state.sceneScope && state.currentIndex > state.sceneScope.end) {
      finishSceneOnly();
      return;
    }

    const line = state.lines[state.currentIndex];
    const role = els.repRoleSelect.value;
    const mode = els.repMode.value;
    const isOwn = mode !== 'full' && line.speaker === role;
    const isIgnored = isIgnoredSpeakerLine(line, role);

    if (state.focusOwnOnly && (!role || line.kind !== 'line' || line.speaker !== role)) {
      const target = nextOwnIndex(state.currentIndex - 1, 1);
      if (target >= 0) {
        state.currentIndex = target;
        state.timeoutId = setTimeout(() => { if (token === state.playToken && state.playing) playCurrent(); }, 40);
      } else {
        finishOwnLinesOnly();
      }
      return;
    }

    renderCurrentLine(line, state.focusOwnOnly ? false : isOwn, isIgnored);
    if (document.body.classList.contains('rep-show-script')) renderLineList();
    setButtons();

    if (isIgnored) {
      els.repProgressText.textContent = 'Rôle ignoré : l’app passe cette ligne.';
      state.timeoutId = setTimeout(() => { if (token === state.playToken && state.playing) advance(); }, 80);
      return;
    }

    // renderCurrentLine a déjà mis à jour l'aperçu ci-dessus.
    if (line.kind === 'stage') {
      els.repProgressText.textContent = 'Didascalie affichée, non lue. L’app passe à la réplique.';
      state.timeoutId = setTimeout(() => { if (token === state.playToken && state.playing) advance(); }, 650);
      return;
    }

    if (state.focusOwnOnly) {
      speakLine(line, true, () => { if (token === state.playToken && state.playing) advance(); });
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
      els.repProgressText.textContent = `Filage muet : à toi de parler, l’app enchaîne dans ${Math.round(delay/1000)} s.`;
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
    const shouldReadSpeaker = includeSpeaker && shouldReadSpeakerName();
    const prefix = shouldReadSpeaker && line && line.speaker ? `${line.speaker}. ` : '';
    speak(prefix + text, onEnd, { speaker: line && line.speaker ? line.speaker : '' });
  }

  function shouldReadSpeakerName(){
    return !els.repReadSpeakerName || els.repReadSpeakerName.value !== 'no';
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
    const settingsForLine = resolveVoiceForSpeaker(options && options.speaker ? options.speaker : '');
    if (settingsForLine && settingsForLine.engine === 'piper') {
      speakWithEmbeddedVoice(text, onEnd, settingsForLine);
      return;
    }
    speakWithBrowser(text, onEnd, settingsForLine);
    return;
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
    const voiceSettings = resolveVoiceForSpeaker(options && options.speaker ? options.speaker : '');
    if (voiceSettings && voiceSettings.voice) {
      utterance.voice = voiceSettings.voice;
      // Très important sur mobile : certains navigateurs ignorent la voix si lang reste fr-FR
      // alors que la voix réelle annonce fr_FR, fr-CA, fr-fr-x-..., etc.
      utterance.lang = voiceSettings.voice.lang || 'fr-FR';
    } else {
      utterance.lang = 'fr-FR';
    }
    utterance.rate = clampVoiceNumber((Number(els.repRate.value) || 1) * (voiceSettings && voiceSettings.rate ? voiceSettings.rate : 1), .65, 1.4);
    utterance.pitch = clampVoiceNumber(voiceSettings && voiceSettings.pitch ? voiceSettings.pitch : 1, .5, 1.8);
    utterance.onend = () => onEnd && onEnd();
    utterance.onerror = () => onEnd && onEnd();
    window.speechSynthesis.speak(utterance);
  }


  function usesEmbeddedVoicesForCurrentScript(){
    if (!hasEmbeddedVoices()) return false;
    const selected = els.repVoice ? String(els.repVoice.value || '') : '';
    if (selected === 'browser-auto' || selected === 'default') return false;
    if (selected !== '' && !selected.startsWith('piper:') && !selected.startsWith('piper-gender:')) return false;
    return collectEmbeddedVoiceIdsForCurrentScript().length > 0;
  }

  function collectEmbeddedVoiceIdsForCurrentScript(){
    const ids = new Set();
    if (!hasEmbeddedVoices()) return [];
    const role = getSelectedRole();
    const selected = els.repVoice ? String(els.repVoice.value || '') : '';

    if (selected.startsWith('piper:')) {
      const voiceId = selected.replace('piper:', '');
      if (voiceId) ids.add(voiceId);
    }

    (state.lines || []).forEach(line => {
      if (!line || line.kind !== 'line' || !line.speaker) return;
      if (role && line.speaker === role && els.repMode && els.repMode.value !== 'full') return;
      if (isIgnoredSpeakerLine(line, role)) return;
      const settings = resolveVoiceForSpeaker(line.speaker);
      if (settings && settings.engine === 'piper' && settings.voiceId) ids.add(settings.voiceId);
    });

    if (!ids.size && selected === '') {
      const first = getEmbeddedVoices()[0];
      if (first && first.id) ids.add(first.id);
    }
    return Array.from(ids);
  }

  async function prepareEmbeddedVoicesForCurrentScript(blocking){
    const piper = getPiperService();
    if (!piper || !piper.prepare || !hasEmbeddedVoices()) return true;
    const voiceIds = collectEmbeddedVoiceIdsForCurrentScript();
    if (!voiceIds.length) return true;
    const signature = voiceIds.slice().sort().join('|');
    if (state.piperPrep.ready && state.piperPrep.signature === signature) return true;
    if (state.piperPrep.promise && state.piperPrep.signature === signature) {
      if (!blocking) return false;
      try { await state.piperPrep.promise; return true; } catch(e) { return false; }
    }

    state.piperPrep.status = 'preparing';
    state.piperPrep.ready = false;
    state.piperPrep.signature = signature;
    state.piperPrep.progress = 0;
    if (els.repSpeechStatus) els.repSpeechStatus.textContent = 'Préparation des voix FTS…';
    const previousStartDisabled = els.repStartBtn ? els.repStartBtn.disabled : false;
    if (blocking && els.repStartBtn) els.repStartBtn.disabled = true;

    state.piperPrep.promise = piper.prepare({
      voiceIds,
      onProgress(progress){
        const percent = Number(progress && progress.percent) || 0;
        state.piperPrep.progress = percent;
        if (els.repSpeechStatus && progress && progress.label) {
          els.repSpeechStatus.textContent = percent ? `${progress.label} ${Math.round(percent)}%` : progress.label;
        }
      }
    }).then(() => {
      state.piperPrep.ready = true;
      state.piperPrep.status = 'ready';
      state.piperPrep.progress = 100;
      updateSpeechStatus();
      return true;
    }).catch(() => {
      state.piperPrep.ready = false;
      state.piperPrep.status = 'error';
      return false;
    }).finally(() => {
      state.piperPrep.promise = null;
      if (blocking && els.repStartBtn) els.repStartBtn.disabled = previousStartDisabled;
      setButtons();
    });

    if (!blocking) return false;
    return await state.piperPrep.promise;
  }

  function speakWithEmbeddedVoice(text, onEnd, voiceSettings){
    const piper = getPiperService();
    if (!piper || !piper.speak || !voiceSettings || !voiceSettings.voiceId) {
      speakWithBrowser(text, onEnd, resolveAutomaticVoiceForSpeaker(voiceSettings && voiceSettings.speaker ? voiceSettings.speaker : ''));
      return;
    }
    const token = state.playToken;
    let settled = false;
    const fallbackVoice = resolveAutomaticVoiceForSpeaker(voiceSettings.speaker || '');
    const textLength = String(text || '').length;
    const timeoutDelay = Math.max(9000, Math.min(26000, 7000 + textLength * 90));

    function finishWithBrowserFallback(){
      if (settled || token !== state.playToken) return;
      settled = true;
      try { if (piper && piper.stop) piper.stop(); } catch(e) {}
      updateSpeechStatus();
      speakWithBrowser(text, onEnd, fallbackVoice);
    }

    els.repSpeechStatus.textContent = 'Voix FTS en préparation...';
    const safetyTimer = setTimeout(finishWithBrowserFallback, timeoutDelay);

    piper.speak(text, voiceSettings.voiceId, { rate: Number(els.repRate.value) || 1 }).then(result => {
      if (settled || token !== state.playToken || (result && result.cancelled)) return;
      settled = true;
      clearTimeout(safetyTimer);
      if (result && result.ok) {
        updateSpeechStatus();
        if (onEnd) onEnd();
        return;
      }
      updateSpeechStatus();
      speakWithBrowser(text, onEnd, fallbackVoice);
    }).catch(() => {
      if (settled || token !== state.playToken) return;
      settled = true;
      clearTimeout(safetyTimer);
      updateSpeechStatus();
      speakWithBrowser(text, onEnd, fallbackVoice);
    });
  }

  function speakWithBrowser(text, onEnd, voiceSettings){
    if (!('speechSynthesis' in window)) {
      state.timeoutId = setTimeout(() => { if (onEnd) onEnd(); }, 900);
      return;
    }
    if (!state.voices.length) loadVoices(true);
    const utterance = new SpeechSynthesisUtterance(text);
    if (voiceSettings && voiceSettings.voice) {
      utterance.voice = voiceSettings.voice;
      utterance.lang = voiceSettings.voice.lang || 'fr-FR';
    } else {
      utterance.lang = 'fr-FR';
    }
    utterance.rate = clampVoiceNumber((Number(els.repRate.value) || 1) * (voiceSettings && voiceSettings.rate ? voiceSettings.rate : 1), .65, 1.4);
    utterance.pitch = clampVoiceNumber(voiceSettings && voiceSettings.pitch ? voiceSettings.pitch : 1, .5, 1.8);
    utterance.onend = () => onEnd && onEnd();
    utterance.onerror = () => onEnd && onEnd();
    window.speechSynthesis.speak(utterance);
  }

  function resolveVoiceForSpeaker(speaker){
    const pref = speaker && state.roleVoicePrefs ? state.roleVoicePrefs[speaker] : '';
    if (pref) {
      const roleVoice = voiceFromPreference(pref, speaker);
      if (roleVoice) return roleVoice;
    }

    const voiceIndex = els.repVoice.value;
    if (String(voiceIndex).startsWith('piper:') || String(voiceIndex).startsWith('piper-gender:')) {
      return embeddedVoiceFromPreference(voiceIndex, speaker) || resolveAutomaticVoiceForSpeaker(speaker);
    }
    if (voiceIndex === '') {
      return resolveEmbeddedVoiceForSpeaker(speaker) || resolveAutomaticVoiceForSpeaker(speaker);
    }
    if (voiceIndex === 'browser-auto') return resolveAutomaticVoiceForSpeaker(speaker);
    if (voiceIndex === 'default') return makeVoiceSettings(null, AUTO_VOICE_PROFILES[0]);
    if (voiceIndex !== '' && state.voices[Number(voiceIndex)]) return makeVoiceSettings(state.voices[Number(voiceIndex)], getAutoVoiceProfile(speaker));

    return resolveAutomaticVoiceForSpeaker(speaker);
  }

  function voiceFromPreference(pref, speaker){
    if (!pref) return null;
    if (String(pref).startsWith('piper:') || String(pref).startsWith('piper-gender:')) {
      return embeddedVoiceFromPreference(pref, speaker || '');
    }
    if (String(pref).startsWith('profile:')) {
      return makeVoiceSettings(null, getVoiceProfileByKey(String(pref).replace('profile:', '')) || AUTO_VOICE_PROFILES[0]);
    }
    if (String(pref).startsWith('voice:')) {
      const index = Number(String(pref).replace('voice:', ''));
      return state.voices[index] ? makeVoiceSettings(state.voices[index], AUTO_VOICE_PROFILES[0]) : null;
    }

    const french = getFrenchVoices();
    if (pref === 'fr-female') {
      // Ne pas faire semblant : si aucune voix femme n'est détectée sur le téléphone,
      // on retombe sur la voix française auto. L'option est normalement désactivée dans l'UI.
      return makeVoiceSettings(french.find(v => inferVoiceGender(v) === 'female') || french[0] || null, AUTO_VOICE_PROFILES[0]);
    }
    if (pref === 'fr-male') {
      // Idem : Android/iOS ne fournissent parfois qu'une seule voix française.
      return makeVoiceSettings(french.find(v => inferVoiceGender(v) === 'male') || french[0] || null, AUTO_VOICE_PROFILES[0]);
    }
    return null;
  }

  function embeddedVoiceFromPreference(pref, speaker){
    const value = String(pref || '');
    if (value.startsWith('piper:')) {
      const voiceId = value.replace('piper:', '');
      const voice = getEmbeddedVoices().find(item => item.id === voiceId);
      return voice ? makeEmbeddedVoiceSettings(voice, speaker) : null;
    }
    if (value.startsWith('piper-gender:')) {
      const gender = value.replace('piper-gender:', '');
      return resolveEmbeddedVoiceForSpeaker(speaker, gender);
    }
    return null;
  }

  function resolveEmbeddedVoiceForSpeaker(speaker, gender){
    const voices = getEmbeddedVoices();
    if (!voices.length || !hasEmbeddedVoices()) return null;
    const filtered = gender ? voices.filter(voice => voice.gender === gender) : voices;
    const pool = filtered.length ? filtered : voices;
    const voice = pool[getSpeakerIndex(speaker) % pool.length];
    return makeEmbeddedVoiceSettings(voice, speaker);
  }

  function makeEmbeddedVoiceSettings(voice, speaker){
    if (!voice) return null;
    return {
      engine: 'piper',
      voiceId: voice.id,
      speaker: speaker || '',
      pitch: 1,
      rate: voice.rate || 1
    };
  }

  function resolveAutomaticVoiceForSpeaker(speaker){
    const french = getFrenchVoices();
    const voices = french.length ? french : (state.voices || []);
    const profile = getAutoVoiceProfile(speaker);
    if (!voices.length) return makeVoiceSettings(null, profile);
    const index = getSpeakerIndex(speaker);
    return makeVoiceSettings(voices[index % voices.length], profile);
  }

  function getSpeakerIndex(speaker){
    const normalized = normalizeSpeaker(speaker || '');
    const index = (state.characters || []).findIndex(name => normalizeSpeaker(name) === normalized);
    return index >= 0 ? index : 0;
  }

  function getAutoVoiceProfile(speaker){
    return AUTO_VOICE_PROFILES[getSpeakerIndex(speaker) % AUTO_VOICE_PROFILES.length] || AUTO_VOICE_PROFILES[0];
  }

  function getVoiceProfileByKey(key){
    return AUTO_VOICE_PROFILES.find(profile => profile.key === key) || null;
  }

  function makeVoiceSettings(voice, profile){
    profile = profile || AUTO_VOICE_PROFILES[0];
    return {
      engine: 'browser',
      voice: voice || null,
      pitch: profile.pitch || 1,
      rate: profile.rate || 1
    };
  }

  function clampVoiceNumber(value, min, max){
    value = Number(value);
    if (!Number.isFinite(value)) return 1;
    return Math.max(min, Math.min(max, value));
  }

  function advance(){
    registerRepetitionEffort();
    state.awaitingUser = false;
    if (state.focusOwnOnly) {
      const next = nextOwnIndex(state.currentIndex, 1);
      if (next < 0) {
        finishOwnLinesOnly();
        return;
      }
      state.currentIndex = next;
    } else if (state.focusDifficultOnly) {
      const currentTarget = getCurrentDifficultTargetIndex();
      if (currentTarget >= 0) {
        // Après une réplique difficile validée, on prépare la difficulté suivante avec son contexte.
        const nextTarget = nextDifficultIndex(currentTarget, 1);
        if (nextTarget < 0) {
          finishDifficultReview();
          return;
        }
        state.currentIndex = getDifficultReviewStartIndex(nextTarget);
      } else {
        // Depuis la réplique de contexte, aller à la prochaine réplique étoilée.
        const indexes = getDifficultIndexesForRole();
        const target = indexes.find(i => i > state.currentIndex);
        if (Number.isFinite(target)) state.currentIndex = target;
        else { finishDifficultReview(); return; }
      }
    } else {
      state.currentIndex += 1;
    }
    if (state.sceneOnly && state.sceneScope && state.currentIndex > state.sceneScope.end) {
      finishSceneOnly();
      return;
    }
    saveCurrentScriptSettings();
    if (state.currentIndex >= state.lines.length) {
      finish();
      return;
    }
    playCurrent();
  }

  function finishSceneOnly(){
    stop(false);
    els.repProgressText.textContent = 'Scène terminée.';
    refreshPlayer(false);
    saveCurrentScriptSettings();
  }

  function finishOwnLinesOnly(){
    stop(false);
    state.focusOwnOnly = false;
    els.repProgressText.textContent = 'Révision de tes répliques terminée.';
    updateDifficultUi();
    refreshPlayer(false);
    saveCurrentScriptSettings();
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
    state.currentIndex = state.sceneOnly && state.sceneScope ? state.sceneScope.start : (state.focusOwnOnly ? (getOwnIndexesForRole()[0] || 0) : 0);
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
    if (state.focusOwnOnly) {
      const next = nextOwnIndex(state.currentIndex, -1);
      if (next >= 0) state.currentIndex = next;
      else { finishOwnLinesOnly(); return; }
    } else if (state.focusDifficultOnly) {
      const currentTarget = getCurrentDifficultTargetIndex();
      const anchor = currentTarget >= 0 ? currentTarget : state.currentIndex;
      const prev = nextDifficultIndex(anchor, -1);
      if (prev >= 0) state.currentIndex = getDifficultReviewStartIndex(prev);
    } else {
      state.currentIndex = Math.max(0, state.currentIndex - 1);
    }
    if (state.sceneOnly && state.sceneScope && state.currentIndex < state.sceneScope.start) state.currentIndex = state.sceneScope.start;
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
    if (state.focusOwnOnly) {
      const next = nextOwnIndex(state.currentIndex, 1);
      if (next >= 0) state.currentIndex = next;
      else { finishOwnLinesOnly(); return; }
    } else if (state.focusDifficultOnly) {
      const currentTarget = getCurrentDifficultTargetIndex();
      const anchor = currentTarget >= 0 ? currentTarget : state.currentIndex;
      const next = nextDifficultIndex(anchor, 1);
      if (next >= 0) state.currentIndex = getDifficultReviewStartIndex(next);
      else { finishDifficultReview(); return; }
    } else {
      state.currentIndex = Math.min(Math.max(0,state.lines.length - 1), state.currentIndex + 1);
    }
    if (state.sceneOnly && state.sceneScope && state.currentIndex > state.sceneScope.end) { finishSceneOnly(); return; }
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
    if (!cancel) return;
    const piper = getPiperService();
    if (piper && piper.stop) piper.stop();
    if (!('speechSynthesis' in window)) return;
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
    const isOwn = !state.focusOwnOnly && els.repMode.value !== 'full' && line && line.speaker === role;
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
    els.repCurrentLine.className = 'rep-current' + (isIgnored ? ' is-ignored' : isOwn ? ' is-own' : line.kind === 'stage' ? ' is-stage' : ' is-other') + (isDifficult ? ' is-difficult' : '') + (state.focusDifficultOnly ? ' is-focus-difficult' : '') + (state.focusOwnOnly ? ' is-focus-own' : '');
    els.repCurrentLine.innerHTML = `
      <p class="rep-current-role">${isIgnored ? 'Rôle ignoré' : state.focusOwnOnly ? 'Mes répliques · ' + escapeHtml(line.speaker) : isOwn ? 'À toi' : escapeHtml(line.speaker)}${isDifficult ? ' · ⭐' : ''}</p>
      <p class="rep-current-text">${escapeHtml(displayTextForLine(line))}</p>
    `;
    els.repCounter.textContent = `${Math.min(state.currentIndex + 1,total)} / ${total}`;
    els.repMeterBar.style.width = `${Math.max(0,Math.min(100,percent))}%`;
    updateSceneCurrentSummary();
    const mode = els.repMode.value;
    els.repProgressText.textContent = isIgnored
      ? 'Cette ligne sera passée.'
      : state.focusOwnOnly
        ? 'Mes répliques uniquement : l’app lit seulement ton rôle.'
      : state.focusDifficultOnly
        ? 'Révision des répliques marquées : dis ta ligne, puis valide.'
      : isOwn
        ? (mode === 'auto' ? 'Filage muet : dis ta ligne, l’app enchaînera automatiquement.' : 'À toi : dis ta réplique, puis valide pour continuer.')
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
    document.body.classList.toggle('rep-own-only', !!state.focusOwnOnly);
    document.body.classList.toggle('has-script-ready', !!hasLines);
    els.repStartBtn.disabled = !hasLines || state.playing;
    if (els.repRestartBtn) els.repRestartBtn.disabled = !hasLines || (state.focusOwnOnly ? state.currentIndex <= (getOwnIndexesForRole()[0] || 0) : state.currentIndex <= 0);
    els.repStopBtn.disabled = !hasLines || !state.playing;
    els.repPrevBtn.disabled = !hasLines || (state.focusOwnOnly ? getOwnIndexesForRole().length < 2 : state.currentIndex <= 0);
    els.repNextBtn.disabled = !hasLines || (state.focusOwnOnly ? getOwnIndexesForRole().length < 2 : state.currentIndex >= state.lines.length - 1);
    els.repContinueBtn.disabled = !state.awaitingUser || state.focusOwnOnly;
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
    renderScriptEditorPreview();
    state.lines = [];
    state.characters = [];
    state.currentIndex = 0;
    state.focusDifficultOnly = false;
    state.ignoredSpeakers = new Set();
    state.difficultLines = new Set();
    state.focusDifficultOnly = false;
    state.focusOwnOnly = false;
    state.sceneOnly = false;
    state.sceneScope = null;
    state.roleVoicePrefs = {};
    state.xpSession = { practice:0, own:0, difficult:0 };
    state.currentScriptId = '';
    state.currentScriptLabel = '';
    state.sections = [];
    els.repStats.innerHTML = '<div><strong>0</strong><span>réplique</span></div><div><strong>0</strong><span>rôle</span></div><div><strong>0</strong><span>didascalie</span></div>';
    els.repCharacters.innerHTML = '';
    els.repRoleSelect.disabled = true;
    els.repRoleSelect.innerHTML = '<option value="">Analyse d’abord le texte</option>';
    renderEmpty();
  }

  const PDF_DB_NAME = 'fts-repetition-pdfs-v1';
  const PDF_STORE_NAME = 'pdfs';

  function openPdfDb(){
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('Stockage local PDF indisponible.'));
      const req = indexedDB.open(PDF_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PDF_STORE_NAME)) db.createObjectStore(PDF_STORE_NAME, { keyPath:'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Ouverture du stockage PDF impossible.'));
    });
  }

  async function cacheOriginalPdf(id, label, buffer, meta){
    if (!id || !buffer) return false;
    try {
      const arrayBuffer = await normalizePdfArrayBuffer(buffer);
      const size = arrayBuffer && arrayBuffer.byteLength ? arrayBuffer.byteLength : 0;
      if (!size) {
        console.warn('[FTS Répétition] PDF original vide, cache annulé', { id, label });
        return false;
      }
      const db = await openPdfDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(PDF_STORE_NAME, 'readwrite');
        tx.objectStore(PDF_STORE_NAME).put({
          id,
          label: label || 'PDF original',
          arrayBuffer,
          size,
          type: 'application/pdf',
          meta: meta || {},
          updatedAt: Date.now()
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Enregistrement PDF impossible.'));
      });
      try { db.close(); } catch(_) {}
      return true;
    } catch (err) {
      console.warn('[FTS Répétition] cache PDF original', err);
      return false;
    }
  }

  async function getCachedOriginalPdf(id){
    if (!id) return null;
    try {
      const db = await openPdfDb();
      const item = await new Promise((resolve, reject) => {
        const tx = db.transaction(PDF_STORE_NAME, 'readonly');
        const req = tx.objectStore(PDF_STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error('Lecture PDF local impossible.'));
      });
      try { db.close(); } catch(_) {}
      return item;
    } catch (err) {
      console.warn('[FTS Répétition] lecture PDF original', err);
      return null;
    }
  }

  async function deleteCachedOriginalPdf(id){
    if (!id) return;
    try {
      const db = await openPdfDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(PDF_STORE_NAME, 'readwrite');
        tx.objectStore(PDF_STORE_NAME).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Suppression PDF impossible.'));
      });
      try { db.close(); } catch(_) {}
    } catch (err) {
      console.warn('[FTS Répétition] suppression PDF original', err);
    }
  }

  function safePdfFileName(label){
    return String(label || 'texte-repetition').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'texte-repetition';
  }

  async function openCachedPdf(id){
    const item = await getCachedOriginalPdf(id);
    if (!item || (!item.arrayBuffer && !item.blob)) {
      setPdfStatus('PDF original non enregistré sur cet appareil. Ouvre/analyse ce PDF une fois en ligne pour l’ajouter.', false);
      return;
    }
    const blob = item.arrayBuffer
      ? new Blob([item.arrayBuffer], { type:'application/pdf' })
      : (item.blob instanceof Blob ? item.blob : new Blob([item.blob], { type:'application/pdf' }));
    if (!blob.size) {
      setPdfStatus('PDF original enregistré vide. Réanalyse ce PDF une fois pour le réparer.', false);
      return;
    }
    const url = URL.createObjectURL(blob);
    try {
      const opened = window.open(url, '_blank', 'noopener');
      if (!opened) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.download = safePdfFileName(item.label) + '.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setPdfStatus('PDF original ouvert depuis cet appareil.');
    } catch (err) {
      console.warn('[FTS Répétition] ouverture PDF original', err);
      setPdfStatus('Ouverture du PDF impossible sur cet appareil.', false);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
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


  function computeCachedProgress(item, settings){
    const text = item && item.text ? item.text : '';
    const roughLines = text.split(/\n+/).filter(line => line.trim()).length || 1;
    const current = Number.isFinite(settings.currentIndex) ? Math.max(0, settings.currentIndex + 1) : 0;
    const percent = Math.max(0, Math.min(100, Math.round((current / roughLines) * 100)));
    return {
      percent,
      label: percent ? percent + '% travaillé' : 'Pas encore commencé'
    };
  }

  function formatShortDate(value){
    try {
      const date = new Date(value);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) return 'Aujourd’hui';
      return date.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
    } catch(e) {
      return '';
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
      const date = item.updatedAt ? formatShortDate(item.updatedAt) : '';
      const difficultCount = settings.difficultLines && settings.difficultLines.length ? settings.difficultLines.length : 0;
      const progress = computeCachedProgress(item, settings);
      const role = settings.role || 'Rôle à choisir';
      const reviewButton = difficultCount
        ? `<button class="rep-btn rep-btn-review" type="button" data-offline-review="${escapeAttr(item.id)}">Réviser ⭐</button>`
        : '';
      const ownButton = settings.role
        ? `<button class="rep-btn rep-btn-own" type="button" data-offline-own="${escapeAttr(item.id)}">Mes répliques</button>`
        : '';
      const pdfButton = item.meta && item.meta.pdfCached
        ? `<button class="rep-btn rep-btn-pdf" type="button" data-offline-pdf="${escapeAttr(item.id)}">Ouvrir PDF</button>`
        : '';
      return `<article class="rep-offline-item rep-offline-premium" data-script-id="${escapeAttr(item.id)}">
        <div class="rep-offline-main">
          <div class="rep-offline-title-row">
            <strong>${escapeHtml(item.label)}</strong>
            <span class="rep-offline-role">${escapeHtml(role)}</span>
          </div>
          <div class="rep-offline-progress"><span style="width:${progress.percent}%"></span></div>
          <div class="rep-offline-meta">
            <span>${progress.label}</span>
            ${difficultCount ? `<span>${difficultCount} ⭐ à revoir</span>` : '<span>Rien à revoir</span>'}
            ${date ? `<span>${escapeHtml(date)}</span>` : ''}
          </div>
        </div>
        <div class="rep-offline-actions ${difficultCount ? 'has-review' : ''}">
          <button class="rep-btn rep-btn-primary" type="button" data-offline-open="${escapeAttr(item.id)}">Reprendre</button>
          ${ownButton}
          ${reviewButton}
          ${pdfButton}
          <button class="rep-btn rep-btn-icon-only" type="button" data-offline-settings="${escapeAttr(item.id)}" title="Réglages" aria-label="Réglages">⚙️</button>
          <button class="rep-btn rep-btn-icon-only" type="button" data-offline-delete="${escapeAttr(item.id)}" title="Supprimer ce texte" aria-label="Supprimer ce texte">🗑</button>
        </div>
      </article>`;
    }).join('');
    els.repOfflineList.querySelectorAll('[data-offline-open]').forEach(btn => {
      btn.addEventListener('click', () => openCachedScript(btn.getAttribute('data-offline-open') || '', 'rehearse'));
    });
    els.repOfflineList.querySelectorAll('[data-offline-review]').forEach(btn => {
      btn.addEventListener('click', () => openCachedScript(btn.getAttribute('data-offline-review') || '', 'difficult'));
    });
    els.repOfflineList.querySelectorAll('[data-offline-own]').forEach(btn => {
      btn.addEventListener('click', () => openCachedScript(btn.getAttribute('data-offline-own') || '', 'own'));
    });
    els.repOfflineList.querySelectorAll('[data-offline-pdf]').forEach(btn => {
      btn.addEventListener('click', () => openCachedPdf(btn.getAttribute('data-offline-pdf') || ''));
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
    else if (view === 'own') {
      if (!getSelectedRole() && cached.settings && cached.settings.role) {
        const matchedRole = findMatchingRole(cached.settings.role);
        if (matchedRole && els.repRoleSelect) els.repRoleSelect.value = matchedRole;
      }
      if (getSelectedRole()) {
        const started = startOwnLinesOnly();
        if (!started) setView('role');
      } else {
        setPdfStatus('Choisis ton rôle pour voir uniquement tes répliques.');
        setView('role');
      }
    }
    else if (view === 'difficult') {
      if (getSelectedRole()) {
        setView('rehearse');
        startDifficultReview();
      } else {
        setView('role');
      }
    }
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
      deleteCachedOriginalPdf(id);
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
      items.sort((a,b) => b.updatedAt - a.updatedAt).slice(30).forEach(item => { const id = item.key.replace(prefix, ''); localStorage.removeItem(item.key); deleteCachedOriginalPdf(id); });
    } catch(e) {}
  }

  function renderResumeCard(){
    if (!els.repResumeCard) return;
    const cached = getLastCachedScript();
    if (!cached || !cached.text) {
      els.repResumeCard.hidden = true;
      if (els.repResumeReviewBtn) els.repResumeReviewBtn.hidden = true;
      return;
    }
    els.repResumeCard.hidden = false;
    if (els.repResumeTitle) els.repResumeTitle.textContent = cached.label || 'Dernière répétition';
    const settings = getScriptSettings(cached.id) || {};
    const date = cached.updatedAt ? new Date(cached.updatedAt).toLocaleDateString('fr-FR') : '';
    const difficultCount = settings.difficultLines && settings.difficultLines.length ? settings.difficultLines.length : 0;
    if (els.repResumeMeta) {
      els.repResumeMeta.textContent = [settings.role ? 'Rôle : ' + settings.role : '', Number.isFinite(settings.currentIndex) ? 'Ligne ' + (settings.currentIndex + 1) : '', difficultCount ? difficultCount + ' ⭐' : '', date].filter(Boolean).join(' · ');
    }
    if (els.repResumeReviewBtn) {
      els.repResumeReviewBtn.hidden = !difficultCount;
      els.repResumeReviewBtn.textContent = difficultCount ? 'Réviser ⭐' : 'Réviser ⭐';
      els.repResumeReviewBtn.title = difficultCount ? 'Réviser les répliques à retravailler' : '';
      els.repResumeReviewBtn.setAttribute('aria-label', 'Réviser les répliques à retravailler');
    }
    if (els.repResumeOwnBtn) {
      els.repResumeOwnBtn.hidden = !(settings && settings.role);
      els.repResumeOwnBtn.title = 'Revoir uniquement mes répliques';
      els.repResumeOwnBtn.setAttribute('aria-label', 'Revoir uniquement mes répliques');
    }
    if (els.repResumePdfBtn) {
      const hasPdf = !!(cached.meta && cached.meta.pdfCached);
      els.repResumePdfBtn.hidden = !hasPdf;
      els.repResumePdfBtn.title = 'Ouvrir le PDF original enregistré sur cet appareil';
      els.repResumePdfBtn.setAttribute('aria-label', 'Ouvrir le PDF original');
    }
  }

  function resumeLastScript(){
    const cached = getLastCachedScript();
    if (!cached || !cached.text) return;
    applyExtractedText(cached.text, cached.label || 'Dernière répétition', Object.assign({}, cached.meta || {}, { id:cached.id, label:cached.label || 'Dernière répétition', fromCache:true }));
    setPdfStatus('Texte prêt à reprendre.');
    if (getSelectedRole()) setView('rehearse');
  }

  function resumeLastScriptDifficult(){
    const cached = getLastCachedScript();
    if (!cached || !cached.text) return;
    openCachedScript(cached.id, 'difficult');
  }

  function resumeLastScriptOwnOnly(){
    const cached = getLastCachedScript();
    if (!cached || !cached.text) return;
    openCachedScript(cached.id, 'own');
  }

  function openLastCachedPdf(){
    const cached = getLastCachedScript();
    if (!cached || !cached.id) return;
    openCachedPdf(cached.id);
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
    if (settings.role) {
      const matchedRole = findMatchingRole(settings.role);
      if (matchedRole) els.repRoleSelect.value = matchedRole;
    }
    if (settings.mode && els.repMode.querySelector(`option[value="${cssEscape(settings.mode)}"]`)) els.repMode.value = settings.mode;
    if (settings.readSpeakerName && els.repReadSpeakerName && els.repReadSpeakerName.querySelector(`option[value="${cssEscape(settings.readSpeakerName)}"]`)) els.repReadSpeakerName.value = settings.readSpeakerName;
    if (settings.ownLines && els.repOwnLines.querySelector(`option[value="${cssEscape(settings.ownLines)}"]`)) els.repOwnLines.value = settings.ownLines;
    if (settings.pause) els.repPause.value = String(settings.pause);
    if (settings.rate) els.repRate.value = String(settings.rate);
    if (settings.voice !== undefined) els.repVoice.value = String(settings.voice || '');
    state.ignoredSpeakers = new Set((settings.ignoredSpeakers || []).filter(name => state.characters.includes(name)));
    state.difficultLines = new Set((settings.difficultLines || []).map(Number).filter(index => Number.isFinite(index) && index >= 0 && index < state.lines.length));
    state.focusDifficultOnly = false;
    state.focusOwnOnly = false;
    state.sceneOnly = !!settings.sceneOnly;
    state.sceneScope = settings.sceneScope || null;
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
        readSpeakerName: els.repReadSpeakerName ? els.repReadSpeakerName.value : 'yes',
        ownLines: els.repOwnLines ? els.repOwnLines.value : 'show',
        pause: els.repPause ? els.repPause.value : '4500',
        rate: els.repRate ? els.repRate.value : '1',
        voice: els.repVoice ? els.repVoice.value : '',
        ignoredSpeakers: Array.from(state.ignoredSpeakers || []),
        difficultLines: Array.from(state.difficultLines || []),
        roleVoicePrefs: Object.assign({}, state.roleVoicePrefs || {}),
        currentIndex: state.currentIndex || 0,
        sceneOnly: !!state.sceneOnly,
        sceneScope: state.sceneScope || null,
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
