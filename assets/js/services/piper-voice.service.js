(function(){
  'use strict';

  window.FTS = window.FTS || {};
  window.FTS.Services = window.FTS.Services || {};

  const MANIFEST_URL = new URL('../../voices/piper/manifest.json?v=1', import.meta.url).href;
  const VOICES_JSON_URL = new URL('../../voices/piper/voices.json?v=1', import.meta.url).href;
  const VENDOR_URL = new URL('../../vendor/piper/piper-tts-web.js?v=1', import.meta.url).href;
  const VOICE_BASE_URL = new URL('../../voices/piper/', import.meta.url).href;
  const PIPER_BASE_URL = new URL('../../../piper/', import.meta.url).href;
  const ONNX_BASE_URL = new URL('../../../onnx/', import.meta.url).href;
  const ONNX_WORKER_URL = new URL('../../../worker/OnnxWebWorker.js?v=1', import.meta.url).href;

  const noopExpressionRuntime = {
    destroy(){},
    generate(){ return Promise.resolve([]); }
  };

  const GENERATED_AUDIO_CACHE = 'fts-piper-generated-audio-v8';
  const GENERATED_MANIFEST_CACHE = 'fts-piper-generated-manifests-v8';
  const memoryAudioCache = new Map();
  const memoryManifestCache = new Map();

  const state = {
    manifest: null,
    manifestPromise: null,
    engine: null,
    runtimeModule: null,
    loadPromise: null,
    audio: null,
    audioUrl: '',
    unlockAudio: null,
    token: 0,
    currentLengthScale: 1,
    resetCounter: 0,
    voicesIndex: null,
    voicesIndexPromise: null,
    preparePromise: null,
    preparedModels: new Set(),
    preparedCore: false
  };

  function isSupported(){
    return !!(window.fetch && window.Worker && window.WebAssembly && window.URL && window.Blob && window.Audio);
  }

  async function loadManifest(){
    if (state.manifest) return state.manifest;
    if (state.manifestPromise) return state.manifestPromise;
    state.manifestPromise = fetch(MANIFEST_URL)
      .then(response => {
        if (!response.ok) throw new Error('Manifest Piper introuvable');
        return response.json();
      })
      .then(manifest => {
        state.manifest = manifest || { voices: [] };
        dispatchReady();
        return state.manifest;
      })
      .catch(error => {
        state.manifestPromise = null;
        throw error;
      });
    return state.manifestPromise;
  }

  function getVoices(){
    return state.manifest && Array.isArray(state.manifest.voices) ? state.manifest.voices : [];
  }

  function getVoice(id){
    const voices = getVoices();
    return voices.find(voice => voice.id === id) || voices[0] || null;
  }

  async function load(){
    if (!isSupported()) throw new Error('Piper non compatible avec ce navigateur');
    await loadManifest();
    if (state.engine) return state.engine;
    if (state.loadPromise) return state.loadPromise;

    state.loadPromise = import(VENDOR_URL).then(mod => {
      state.runtimeModule = mod;
      const remoteProvider = new mod.RemoteVoiceProvider({ baseUrl: VOICE_BASE_URL });
      const voiceProvider = {
        destroy(){ remoteProvider.destroy(); },
        list(){ return remoteProvider.list(); },
        async fetch(model){
          const voiceData = await remoteProvider.fetch(model);
          const config = cloneVoiceConfig(voiceData[0]);
          const scale = Number(state.currentLengthScale) || 1;
          config.inference = Object.assign({}, config.inference || {});
          config.inference.length_scale = clampNumber((Number(config.inference.length_scale) || 1) * scale, 0.75, 1.65);
          return [config, voiceData[1]];
        }
      };

      const worker = new Worker(ONNX_WORKER_URL, { type: 'module', name: 'fts-piper-onnx' });
      state.engine = new mod.PiperWebEngine({
        onnxRuntime: new mod.OnnxWebWorkerRuntime({
          worker,
          basePath: ONNX_BASE_URL,
          numThreads: 1
        }),
        phonemizeRuntime: new mod.PhonemizeWebRuntime({ basePath: PIPER_BASE_URL }),
        expressionRuntime: noopExpressionRuntime,
        voiceProvider
      });
      dispatchReady();
      return state.engine;
    }).catch(error => {
      state.loadPromise = null;
      throw error;
    });

    return state.loadPromise;
  }


  async function prepareLineAudio(text, voiceId, options){
    options = options || {};
    await loadManifest();
    const voice = getVoice(voiceId);
    const value = String(text || '').trim();
    if (!voice || !value) return { ok:false, cached:false, reason: !voice ? 'voice_not_found' : 'empty_text' };
    const cacheKey = options.cacheKey || buildGeneratedAudioKey(value, voiceId, options);

    const existingManifest = await getCachedAudioManifest(cacheKey);
    if (existingManifest && Array.isArray(existingManifest.segments) && existingManifest.segments.length) {
      const allSegmentsReady = await areManifestSegmentsCached(existingManifest);
      if (allSegmentsReady) return { ok:true, cached:true, cacheKey, manifest:existingManifest };
    }

    const chunks = splitTextIntoAudioChunks(value, 135);
    if (!chunks.length) return { ok:false, cached:false, cacheKey, reason:'empty_chunks' };
    const segments = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const segmentKey = cacheKey + '-seg-' + (i + 1) + '-' + hashString(chunk);
      if (typeof options.onProgress === 'function') {
        try { options.onProgress({ status:'segment', done:i, total:chunks.length, segment:i + 1, segments:chunks.length, text:chunk }); } catch(e) {}
      }
      let blob = await getCachedAudioBlob(segmentKey);
      if (!blob) {
        blob = await generateBlobWithRetry(chunk, voice, options);
        if (!blob) return { ok:false, cached:false, cacheKey, reason:'generation_failed_segment_' + (i + 1), segment:i + 1, segments:chunks.length };
        const stored = await putCachedAudioBlob(segmentKey, blob);
        if (!stored) return { ok:false, cached:false, cacheKey, reason:'cache_write_failed_segment_' + (i + 1), segment:i + 1, segments:chunks.length };
      }
      segments.push({ cacheKey: segmentKey, textHash: hashString(chunk) });
      if (typeof options.onProgress === 'function') {
        try { options.onProgress({ status:'segment-ready', done:i + 1, total:chunks.length, segment:i + 1, segments:chunks.length }); } catch(e) {}
      }
    }

    const manifest = { version: 8, cacheKey, voiceId, textHash: hashString(value), segments, createdAt: Date.now() };
    const manifestStored = await putCachedAudioManifest(cacheKey, manifest);
    if (!manifestStored) return { ok:false, cached:false, cacheKey, reason:'manifest_write_failed' };
    return { ok:true, cached:false, cacheKey, manifest };
  }

  async function playPreparedAudio(cacheKey, options){
    const token = nextToken();
    const manifest = await getCachedAudioManifest(cacheKey);
    if (token !== state.token) return { ok:false, cancelled:true };
    if (manifest && Array.isArray(manifest.segments) && manifest.segments.length) {
      for (let i = 0; i < manifest.segments.length; i += 1) {
        if (token !== state.token) return { ok:false, cancelled:true };
        const blob = await getCachedAudioBlob(manifest.segments[i].cacheKey);
        if (!blob) return { ok:false, cancelled:false, reason:'missing_segment_' + (i + 1) };
        const played = await playBlob(blob, token, Number(options && options.rate) || 1);
        if (!played || !played.ok) return played || { ok:false, cancelled:false };
      }
      return { ok:true, cancelled:false };
    }

    const blob = await getCachedAudioBlob(cacheKey);
    if (token !== state.token) return { ok:false, cancelled:true };
    if (!blob) return { ok:false, cancelled:false, reason:'missing_cache' };
    return await playBlob(blob, token, Number(options && options.rate) || 1);
  }

  async function generateBlobWithRetry(text, voice, options){
    const first = await generateBlob(text, voice, false);
    if (first && first.blob) return first.blob;
    resetEngine();
    const second = await generateBlob(text, voice, true);
    return second && second.blob ? second.blob : null;
  }

  async function generateBlob(text, voice, isRetry){
    try {
      const engine = await load();
      state.currentLengthScale = voice.lengthScale || 1;
      const response = await withTimeout(
        engine.generate(text, voice.model, Number(voice.speaker) || 0),
        getGenerateTimeout(text, isRetry),
        'Génération Piper trop longue'
      );
      if (!response || !response.file) throw new Error('Audio Piper vide');
      return { ok:true, blob:response.file };
    } catch(error) {
      resetEngine();
      return { ok:false, error };
    } finally {
      state.currentLengthScale = 1;
    }
  }

  async function getCachedAudioBlob(cacheKey){
    const key = String(cacheKey || '');
    if (!key) return null;
    if (memoryAudioCache.has(key)) return memoryAudioCache.get(key);
    if (!window.caches || !caches.open) return null;
    try {
      const cache = await caches.open(GENERATED_AUDIO_CACHE);
      const response = await cache.match(cacheUrlForKey(key));
      if (!response) return null;
      const blob = await response.blob();
      memoryAudioCache.set(key, blob);
      return blob;
    } catch(e) {
      return null;
    }
  }

  async function putCachedAudioBlob(cacheKey, blob){
    const key = String(cacheKey || '');
    if (!key || !blob) return false;
    if (!window.caches || !caches.open) return false;
    try {
      const cache = await caches.open(GENERATED_AUDIO_CACHE);
      const url = cacheUrlForKey(key);
      await cache.put(url, new Response(blob, { headers:{ 'Content-Type': blob.type || 'audio/wav' } }));
      const verify = await cache.match(url);
      if (!verify) return false;
      memoryAudioCache.set(key, blob);
      return true;
    } catch(e) {
      return false;
    }
  }


  async function getCachedAudioManifest(cacheKey){
    const key = String(cacheKey || '');
    if (!key) return null;
    if (memoryManifestCache.has(key)) return memoryManifestCache.get(key);
    if (!window.caches || !caches.open) return null;
    try {
      const cache = await caches.open(GENERATED_MANIFEST_CACHE);
      const response = await cache.match(manifestUrlForKey(key));
      if (!response) return null;
      const manifest = await response.json();
      memoryManifestCache.set(key, manifest);
      return manifest;
    } catch(e) {
      return null;
    }
  }

  async function putCachedAudioManifest(cacheKey, manifest){
    const key = String(cacheKey || '');
    if (!key || !manifest) return false;
    if (!window.caches || !caches.open) return false;
    try {
      const cache = await caches.open(GENERATED_MANIFEST_CACHE);
      const url = manifestUrlForKey(key);
      await cache.put(url, new Response(JSON.stringify(manifest), { headers:{ 'Content-Type':'application/json' } }));
      const verify = await cache.match(url);
      if (!verify) return false;
      memoryManifestCache.set(key, manifest);
      return true;
    } catch(e) {
      return false;
    }
  }

  async function areManifestSegmentsCached(manifest){
    if (!manifest || !Array.isArray(manifest.segments) || !manifest.segments.length) return false;
    for (let i = 0; i < manifest.segments.length; i += 1) {
      const blob = await getCachedAudioBlob(manifest.segments[i].cacheKey);
      if (!blob) return false;
    }
    return true;
  }

  function manifestUrlForKey(key){
    return new URL('/__fts_repetition_audio_manifest__/' + encodeURIComponent(String(key)) + '.json', window.location.origin).href;
  }

  function splitTextIntoAudioChunks(text, maxLength){
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    const limit = Math.max(80, Number(maxLength) || 135);
    if (!value) return [];
    if (value.length <= limit) return [value];

    const chunks = [];
    const sentences = value.match(/[^.!?;:]+[.!?;:]?|\S+/g) || [value];
    let current = '';
    sentences.forEach(part => {
      const piece = String(part || '').trim();
      if (!piece) return;
      if ((current + ' ' + piece).trim().length <= limit) {
        current = (current + ' ' + piece).trim();
        return;
      }
      if (current) chunks.push(current);
      if (piece.length <= limit) {
        current = piece;
        return;
      }
      const words = piece.split(/\s+/).filter(Boolean);
      let line = '';
      words.forEach(word => {
        if ((line + ' ' + word).trim().length <= limit) line = (line + ' ' + word).trim();
        else {
          if (line) chunks.push(line);
          line = word;
        }
      });
      current = line;
    });
    if (current) chunks.push(current);
    return chunks.filter(Boolean);
  }

  function cacheUrlForKey(key){
    return new URL('/__fts_repetition_audio_cache__/' + encodeURIComponent(String(key)) + '.wav', window.location.origin).href;
  }

  function buildGeneratedAudioKey(text, voiceId, options){
    return 'fts-piper-line-' + hashString([voiceId || '', String(Number(options && options.rate || 1).toFixed(2)), text || ''].join('::'));
  }

  function hashString(value){
    const str = String(value || '');
    let hash = 5381;
    for (let i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  async function speak(text, voiceId, options){
    const token = nextToken();
    await loadManifest();
    const voice = getVoice(voiceId);
    const value = String(text || '').trim();
    if (!voice || !value) return { ok:false, cancelled:false };

    const rate = (Number(options && options.rate) || 1) * (Number(voice.rate) || 1);
    const cacheKey = options && options.cacheKey ? options.cacheKey : buildGeneratedAudioKey(value, voiceId, { rate });
    const prepared = await prepareLineAudio(value, voiceId, { rate, cacheKey });
    if (token !== state.token) return { ok:false, cancelled:true };
    if (prepared && prepared.ok) return await playPreparedAudio(cacheKey, { rate });
    const firstResult = await generateAndPlay(value, voice, token, rate, false);
    if (firstResult && firstResult.ok) return firstResult;
    if (firstResult && firstResult.cancelled) return firstResult;

    // PiperWebEngine peut rester bloqué en BusyState si une génération échoue ou si le worker ONNX se fige.
    // On reconstruit alors le moteur et on retente UNE fois avec la voix embarquée avant de laisser l'appelant basculer en secours navigateur.
    resetEngine();
    if (token !== state.token) return { ok:false, cancelled:true };
    return await generateAndPlay(value, voice, token, rate, true, firstResult && firstResult.error);
  }

  async function generateAndPlay(text, voice, token, rate, isRetry, previousError){
    try {
      const engine = await load();
      if (token !== state.token) return { ok:false, cancelled:true };
      state.currentLengthScale = voice.lengthScale || 1;
      const response = await withTimeout(
        engine.generate(text, voice.model, Number(voice.speaker) || 0),
        getGenerateTimeout(text, isRetry),
        'Génération Piper trop longue'
      );
      if (token !== state.token) return { ok:false, cancelled:true };
      if (!response || !response.file) throw new Error('Audio Piper vide');
      return await playBlob(response.file, token, rate);
    } catch (error) {
      // Important : la librairie Piper remet son état Idle seulement si tout se passe bien.
      // En cas d'erreur, on détruit le worker pour éviter que les lectures suivantes restent muettes.
      resetEngine();
      return { ok:false, cancelled: token !== state.token, error: error || previousError };
    } finally {
      state.currentLengthScale = 1;
    }
  }

  function withTimeout(promise, delay, message){
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error(message || 'Timeout'));
      }, delay);
      Promise.resolve(promise).then(value => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      }).catch(error => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function getGenerateTimeout(text, isRetry){
    const length = String(text || '').length;
    // V8 : timeout par segment audio, plus court car les répliques longues sont découpées.
    // Sur téléphone, la première génération Piper peut être très lente parce qu'elle charge le worker,
    // ONNX, le phonemizer et le modèle vocal. Il vaut mieux attendre pendant l'écran de préparation
    // que déclencher une fausse erreur puis laisser l'élève bloqué.
    const base = isRetry ? 45000 : 30000;
    return Math.max(base, Math.min(90000, base + length * 260));
  }

  function resetEngine(){
    const engine = state.engine;
    state.engine = null;
    state.loadPromise = null;
    state.resetCounter += 1;
    if (engine && engine.destroy) {
      try { engine.destroy(); } catch(e) {}
    }
  }


  async function loadVoicesIndex(){
    if (state.voicesIndex) return state.voicesIndex;
    if (state.voicesIndexPromise) return state.voicesIndexPromise;
    state.voicesIndexPromise = fetch(VOICES_JSON_URL).then(response => {
      if (!response.ok) throw new Error('Index des voix Piper introuvable');
      return response.json();
    }).then(index => {
      state.voicesIndex = index || {};
      return state.voicesIndex;
    }).catch(error => {
      state.voicesIndexPromise = null;
      throw error;
    });
    return state.voicesIndexPromise;
  }

  async function prepare(options){
    options = options || {};
    if (!isSupported()) throw new Error('Piper non compatible avec ce navigateur');
    await loadManifest();

    const requestedVoiceIds = Array.isArray(options.voiceIds) && options.voiceIds.length
      ? options.voiceIds
      : getVoices().map(voice => voice.id);
    const uniqueVoiceIds = Array.from(new Set(requestedVoiceIds.filter(Boolean)));
    const voices = uniqueVoiceIds.map(getVoice).filter(Boolean);
    if (!voices.length) return { ok:false, prepared:false, reason:'no_voice' };

    const modelKeys = Array.from(new Set(voices.map(voice => voice.model).filter(Boolean)));
    const missingModels = modelKeys.filter(model => !state.preparedModels.has(model));
    if (state.preparedCore && !missingModels.length) {
      dispatchPrepareProgress({ status:'ready', done:1, total:1, percent:100, label:'Voix FTS disponibles' });
      return { ok:true, prepared:true, cached:true };
    }
    if (state.preparePromise) return state.preparePromise;

    state.preparePromise = (async () => {
      const index = await loadVoicesIndex();
      const urls = buildPreparationUrls(index, modelKeys);
      await cacheUrls(urls, options.onProgress);
      state.preparedCore = true;
      modelKeys.forEach(model => state.preparedModels.add(model));
      dispatchPrepareProgress({ status:'ready', done:urls.length, total:urls.length, percent:100, label:'Voix FTS téléchargées · génération des répliques à lancer' });
      if (typeof options.onProgress === 'function') {
        try { options.onProgress({ status:'ready', done:urls.length, total:urls.length, percent:100, label:'Voix FTS téléchargées · génération des répliques à lancer' }); } catch(e) {}
      }
      return { ok:true, prepared:true, cached:false };
    })().catch(error => {
      dispatchPrepareProgress({ status:'error', error, label:'Téléchargement des fichiers voix FTS impossible' });
      throw error;
    }).finally(() => {
      state.preparePromise = null;
      state.currentLengthScale = 1;
    });

    return state.preparePromise;
  }


  function buildPreparationUrls(index, modelKeys){
    const urls = [
      MANIFEST_URL,
      VOICES_JSON_URL,
      VENDOR_URL,
      ONNX_WORKER_URL,
      new URL('../../../onnx/ort-wasm-simd-threaded.wasm', import.meta.url).href,
      new URL('../../../piper/piper_phonemize.wasm', import.meta.url).href,
      new URL('../../../piper/piper_phonemize.data', import.meta.url).href
    ];

    modelKeys.forEach(modelKey => {
      const model = index && index[modelKey];
      const files = model && model.files ? Object.keys(model.files) : [];
      files.forEach(filePath => urls.push(new URL(filePath, VOICE_BASE_URL).href));
    });

    return Array.from(new Set(urls));
  }

  async function cacheUrls(urls, onProgress){
    const canUseCache = !!(window.caches && caches.open);
    const cache = canUseCache ? await caches.open('fts-piper-assets-v3') : null;
    const total = urls.length || 1;

    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];
      const label = labelForPreparationUrl(url);
      const progress = { status:'downloading', done:i, total, percent:Math.round((i / total) * 90), label };
      dispatchPrepareProgress(progress);
      if (typeof onProgress === 'function') { try { onProgress(progress); } catch(e) {} }

      if (cache) {
        const hit = await cache.match(url);
        if (hit) continue;
      }
      const response = await fetch(url, { cache:'force-cache' });
      if (!response.ok) throw new Error('Téléchargement impossible : ' + label);
      if (cache) await cache.put(url, response.clone());
    }

    const progress = { status:'downloaded', done:total, total, percent:90, label:'Fichiers voix enregistrés sur cet appareil' };
    dispatchPrepareProgress(progress);
    if (typeof onProgress === 'function') { try { onProgress(progress); } catch(e) {} }
  }

  function labelForPreparationUrl(url){
    const value = String(url || '');
    if (value.includes('.onnx')) return 'Téléchargement du modèle de voix…';
    if (value.includes('piper-tts-web')) return 'Téléchargement du moteur vocal…';
    if (value.includes('OnnxWebWorker')) return 'Préparation du worker audio…';
    if (value.includes('phonemize')) return 'Préparation de la prononciation française…';
    if (value.includes('ort-wasm')) return 'Préparation du moteur ONNX…';
    return 'Préparation des voix FTS…';
  }

  function dispatchPrepareProgress(detail){
    try {
      window.dispatchEvent(new CustomEvent('FTS_PIPER_PREPARE_PROGRESS', { detail: detail || {} }));
    } catch(e) {}
  }

  function stop(){
    state.token += 1;
    stopAudio();
  }

  function unlock(){
    if (!isSupported()) return;
    try {
      const audio = state.unlockAudio || new Audio();
      state.unlockAudio = audio;
      audio.volume = 0;
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
      const playPromise = audio.play();
      if (playPromise && playPromise.then) {
        playPromise.then(() => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch(e) {}
        }).catch(() => {});
      }
    } catch(e) {}
  }

  function nextToken(){
    state.token += 1;
    stopAudio();
    return state.token;
  }

  function stopAudio(){
    if (state.audio) {
      try {
        state.audio.pause();
        state.audio.removeAttribute('src');
        state.audio.load();
      } catch(e) {}
    }
    if (state.audioUrl) {
      try { URL.revokeObjectURL(state.audioUrl); } catch(e) {}
    }
    state.audio = null;
    state.audioUrl = '';
  }

  function playBlob(blob, token, rate){
    return new Promise(resolve => {
      stopAudio();
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      state.audio = audio;
      state.audioUrl = url;
      audio.src = url;
      audio.playbackRate = clampNumber(rate, 0.75, 1.25);
      audio.onended = () => finishAudio(token, resolve, true);
      audio.onerror = () => finishAudio(token, resolve, false);
      audio.play().catch(error => {
        finishAudio(token, resolve, false, error);
      });
    });
  }

  function finishAudio(token, resolve, ok, error){
    if (token === state.token) stopAudio();
    resolve({ ok, cancelled: token !== state.token, error });
  }

  function cloneVoiceConfig(config){
    try {
      return JSON.parse(JSON.stringify(config || {}));
    } catch(e) {
      return Object.assign({}, config || {});
    }
  }

  function clampNumber(value, min, max){
    value = Number(value);
    if (!Number.isFinite(value)) return 1;
    return Math.max(min, Math.min(max, value));
  }

  function dispatchReady(){
    try {
      window.dispatchEvent(new CustomEvent('FTS_PIPER_VOICES_READY', {
        detail: { voices: getVoices(), supported: isSupported() }
      }));
    } catch(e) {}
  }

  window.FTS.Services.PiperVoice = {
    isSupported,
    loadManifest,
    load,
    prepare,
    prepareLineAudio,
    playPreparedAudio,
    speak,
    stop,
    unlock,
    getVoices,
    getVoice,
    resetEngine
  };

  loadManifest().catch(() => {});
})();
