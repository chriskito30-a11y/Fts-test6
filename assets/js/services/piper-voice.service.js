(function(){
  'use strict';

  window.FTS = window.FTS || {};
  window.FTS.Services = window.FTS.Services || {};

  const MANIFEST_URL = new URL('../../voices/piper/manifest.json?v=1', import.meta.url).href;
  const VENDOR_URL = new URL('../../vendor/piper/piper-tts-web.js?v=1', import.meta.url).href;
  const VOICE_BASE_URL = new URL('../../voices/piper/', import.meta.url).href;
  const PIPER_BASE_URL = new URL('../../../piper/', import.meta.url).href;
  const ONNX_BASE_URL = new URL('../../../onnx/', import.meta.url).href;
  const ONNX_WORKER_URL = new URL('../../../worker/OnnxWebWorker.js?v=1', import.meta.url).href;

  const noopExpressionRuntime = {
    destroy(){},
    generate(){ return Promise.resolve([]); }
  };

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
    currentLengthScale: 1
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

  async function speak(text, voiceId, options){
    const token = nextToken();
    const voice = getVoice(voiceId);
    if (!voice || !String(text || '').trim()) return { ok:false, cancelled:false };

    try {
      const engine = await load();
      if (token !== state.token) return { ok:false, cancelled:true };
      state.currentLengthScale = voice.lengthScale || 1;
      const response = await engine.generate(String(text), voice.model, Number(voice.speaker) || 0);
      if (token !== state.token) return { ok:false, cancelled:true };
      return await playBlob(response.file, token, (Number(options && options.rate) || 1) * (Number(voice.rate) || 1));
    } catch (error) {
      return { ok:false, cancelled:false, error };
    } finally {
      state.currentLengthScale = 1;
    }
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
    speak,
    stop,
    unlock,
    getVoices,
    getVoice
  };

  loadManifest().catch(() => {});
})();
