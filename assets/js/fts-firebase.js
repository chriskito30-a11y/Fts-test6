/* ================================================================
   FTS-FIREBASE.JS — Configuration Firebase (source unique)
   À charger APRÈS les SDKs Firebase et APRÈS fts-utils.js.
   Ne pas dupliquer cette config dans d'autres fichiers.
   ================================================================ */

'use strict';

window.FTS = window.FTS || {};

/* ── CONFIG FIREBASE ──────────────────────────────────────────── */

FTS.FIREBASE = {
  apiKey:            "AIzaSyBlN-h7D-QWyGmZ4B59AVJkDIQ5molioq0",
  authDomain:        "faistonshow30.firebaseapp.com",
  databaseURL:       "https://faistonshow30-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "faistonshow30",
  storageBucket:     "faistonshow30.firebasestorage.app",
  messagingSenderId: "115713812172",
  appId:             "1:115713812172:web:db8db53a9a9ad819f00469",
};


/* ── CONFIG CLOUDINARY ─────────────────────────────────────────── */

FTS.CLOUDINARY = {
  cloudName:    "dsylvtwqr",
  uploadPreset: "FaisTonShow",
};


/* ── CONFIG PUSH NOTIFICATIONS ─────────────────────────────────── */

FTS.PUSH = {
  workerUrl:      "https://fts-push.gros-christophe.workers.dev",
  vapidPublicKey: "BNenngaKqOtgqvFSo2KJipS0AwVChpzacAX5YSNZmizWLeji07auoKRZBMbOxRljvqz89QigB6esPcHfEDS_nik",
};


/* ── SOURCES DE DONNÉES ───────────────────────────────────────────
   Firebase Realtime Database est désormais la source unique V1.
   Les anciennes URLs Google Sheets CSV ont été supprimées :
   - ressources/documents
   - annonces
   - questionnaire
   - calendrier
   Les pages lisent directement les chemins Firebase correspondants.
   ──────────────────────────────────────────────────────────────── */


/* ── WORKER PRIVÉ EMAIL / LIENS INTERNES ──────────────────────────
   Le webhook Make/Brevo et les liens OneDrive ne sont plus exposés
   dans le code public : ils sont servis par le Worker séparé fts-email. La route OneDrive est protégée par token Firebase admin/prof.
   ──────────────────────────────────────────────────────────────── */

FTS.SECRETS = {
  workerUrl: "https://fts-email.gros-christophe.workers.dev",
};

FTS.EMAIL = {
  workerUrl: "https://fts-email.gros-christophe.workers.dev/email",
};


/* ── WORKER PAIEMENT HELLOASSO ──────────────────────────────────
   À remplacer après création du Worker Cloudflare fts-helloasso-api.
   Les secrets HelloAsso restent uniquement côté Cloudflare.
*/
FTS.PAYMENT = {
  workerUrl: "https://fts-helloasso-api.gros-christophe.workers.dev",
};


/* ── INITIALISATION FIREBASE ──────────────────────────────────── */
/*
  Retourne l'instance db (Realtime Database).
  Gère le cas où Firebase est déjà initialisé (multi-pages).

  Usage :
    const db = FTS.initFirebase();
    if (db) { db.ref('forum/...').on(...) }
*/
FTS.initFirebase = function() {
  if (typeof firebase === 'undefined') {
    console.warn('[FTS] Firebase SDK non chargé.');
    return null;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(FTS.FIREBASE);
  }
  return firebase.database();
};

FTS.getAuthToken = async function(forceRefresh) {
  try {
    if (typeof firebase === 'undefined' || !firebase.auth) return '';
    const user = firebase.auth().currentUser;
    if (!user || !user.getIdToken) return '';
    return await user.getIdToken(forceRefresh === true);
  } catch (e) {
    console.warn('[FTS] Token Firebase indisponible', e);
    return '';
  }
};

FTS.authJsonHeaders = async function(headers, options) {
  const out = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
  const token = await FTS.getAuthToken(options && options.forceRefresh === true);
  if (token) out.Authorization = 'Bearer ' + token;
  return out;
};

FTS.pushRequest = async function(path, payload, options) {
  if (!FTS.PUSH || !FTS.PUSH.workerUrl) {
    throw new Error('Worker push non configurÃ©.');
  }
  const opts = Object.assign({}, options || {});
  const workerUrl = String(FTS.PUSH.workerUrl || '').replace(/\/+$/, '');
  const target = /^https?:\/\//i.test(String(path || ''))
    ? String(path)
    : workerUrl + '/' + String(path || '').replace(/^\/+/, '');
  const allowHttpError = opts.allowHttpError === true;
  delete opts.allowHttpError;
  opts.method = opts.method || 'POST';
  opts.headers = await FTS.authJsonHeaders(opts.headers || {}, opts);
  if (payload !== undefined && opts.body === undefined) opts.body = JSON.stringify(payload);
  const res = await fetch(target, opts);
  if (!res.ok && !allowHttpError) {
    let detail = '';
    try { detail = await res.text(); } catch (e) {}
    throw new Error('Worker push HTTP ' + res.status + (detail ? ' - ' + detail.slice(0, 160) : ''));
  }
  return res;
};
