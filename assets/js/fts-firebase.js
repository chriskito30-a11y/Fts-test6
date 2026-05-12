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


/* ── APPS SCRIPT ───────────────────────────────────────────────── */

FTS.SCRIPT = {
  publication: "https://script.google.com/macros/s/AKfycby0VF50V2UGWLZ-65GeeeHlibSrZhqqcx1IHQ8-bkrGmsxCBO3hkYZrMiCnE1GqTgEBNg/exec",
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
