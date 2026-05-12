/* ================================================================
   PAGE MODULE — AUTH
   Extrait depuis auth.html pour supprimer le JavaScript inline.
   ================================================================ */

/* ================================================================
   AUTH.JS — Connexion / Inscription Firebase
   Email/Mot de passe + profil RTDB + gestion rôles
   v16 — disciplines chargées dynamiquement depuis Firebase
         + téléphone + section enfant(s)
   ================================================================ */

const ADMIN_EMAIL = "contact@faistonshow.fr";

let db, auth;
let selectedDisc    = new Set();
let selectedSubcats  = {};          // { catName: Set<subName> }
let loadedCategories = [];
let enfantCount     = 0;
const enfantDiscs   = {};           // { idx: Set<catName> }
const enfantSubcatsMap = {};        // { idx: { catName: Set<subName> } }

/* ── INIT ──────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', async () => {

  db   = FTS.initFirebase();
  auth = firebase.auth();

  /* Charger les disciplines depuis Firebase (admin les gère)
     → fallback automatique sur DEFAULT_CATEGORIES si hors ligne */
  loadedCategories = await FTS.getCategoryStructureAsync(db);

  document.getElementById('disc-grid').innerHTML = loadedCategories.map(c =>
    `<div class="pill" data-id="${FTS.esc(c.name)}"
       onclick="toggleDisc(this,'${FTS.esc(c.name)}')">
      ${c.icon || FTS.catIcon(c.name)} ${FTS.esc(c.name)}
    </div>`
  ).join('');

  // Écoute de l'état de connexion
  auth.onAuthStateChanged(async user => {
    if (!user) return; // pas connecté → reste sur la page

    try {
      const snap    = await db.ref('fts_users/' + user.uid).once('value');
      const profile = snap.val();

      if (!profile) {
        // Profil introuvable → déconnexion propre
        await auth.signOut();
        return;
      }

      if (profile.status === 'pending') {
        showPendingScreen(user.email);
        return;
      }

      if (profile.status === 'active') {
        window.location.href = 'membres.html';
      }

    } catch(e) {
      console.warn('[FTS Auth] Erreur lecture profil :', e);
    }
  });
});

/* ── NAVIGATION ONGLETS ────────────────────────────────────────── */
function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-register').classList.toggle('active', !isLogin);
  document.getElementById('form-login').classList.toggle('active', isLogin);
  document.getElementById('form-register').classList.toggle('active', !isLogin);
  clearErr('l');
  clearErr('r');
}

/* ── PILLS DISCIPLINES (compte principal) ──────────────────────── */
function toggleDisc(el, id) {
  el.classList.toggle('active');
  if (selectedDisc.has(id)) {
    selectedDisc.delete(id);
    delete selectedSubcats[id];
  } else {
    selectedDisc.add(id);
  }
  updateParentSubcats();
}

function updateParentSubcats() {
  const wrap = document.getElementById('disc-subcats');
  if (!wrap) return;
  const active = [...selectedDisc];
  if (!active.length) { wrap.innerHTML = ''; return; }

  let html = '<div class="form-subcats">';
  active.forEach(cat => {
    const catData = loadedCategories.find(c => c.name === cat);
    const subs = (catData && catData.subs
      ? catData.subs.map(s => typeof s === 'string' ? s : (s && s.name)).filter(Boolean)
      : []);
    if (!subs.length) return;
    if (!selectedSubcats[cat]) selectedSubcats[cat] = new Set();
    html += '<div class="form-subcat-group">';
    html += '<div class="form-subcat-lbl">' + FTS.esc(cat) + ' — section</div>';
    html += '<div class="disc-grid">';
    subs.forEach(s => {
      const on = selectedSubcats[cat] && selectedSubcats[cat].has(s) ? 'active' : '';
      html += '<div class="pill ' + on + '" onclick="toggleParentSubcat(this,' +
        JSON.stringify(cat) + ',' + JSON.stringify(s) + ')">' + FTS.esc(s) + '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}

function toggleParentSubcat(el, cat, sub) {
  if (!selectedSubcats[cat]) selectedSubcats[cat] = new Set();
  el.classList.toggle('active');
  if (selectedSubcats[cat].has(sub)) selectedSubcats[cat].delete(sub);
  else selectedSubcats[cat].add(sub);
}

/* ── SECTION ENFANT — TOGGLE — v16 ─────────────────────────────── */
function toggleEnfantSection() {
  const checked = document.getElementById('r-has-enfant').checked;
  const section = document.getElementById('enfant-section');
  if (checked) {
    section.style.display = 'block';
    if (enfantCount === 0) addEnfantField();
  } else {
    section.style.display = 'none';
    document.getElementById('enfants-list').innerHTML = '';
    enfantCount = 0;
  }
}

/* ── SECTION ENFANT — AJOUTER UN BLOC — v16 ────────────────────── */
function addEnfantField() {
  enfantCount++;
  const idx  = enfantCount;
  const list = document.getElementById('enfants-list');
  const block = document.createElement('div');
  block.className = 'enfant-block';
  block.id        = 'enfant-block-' + idx;

  block.innerHTML = `
    <div class="enfant-header">
      <span class="enfant-title">🎩 Enfant ${idx}</span>
      ${idx > 1
        ? `<button type="button" class="enfant-remove" onclick="removeEnfant(${idx})">✕ Retirer</button>`
        : ''}
    </div>
    <div class="two-cols">
      <div>
        <label class="f-label" style="margin-top:0">Prénom</label>
        <input type="text" class="e-first" placeholder="Emma" autocomplete="off">
      </div>
      <div>
        <label class="f-label" style="margin-top:0">Nom</label>
        <input type="text" class="e-last" placeholder="Martin" autocomplete="off">
      </div>
    </div>
    <label class="f-label">Date de naissance</label>
    <input type="date" class="e-dob" max="${new Date().toISOString().split('T')[0]}">
    <label class="f-label">Téléphone
      <span style="color:#555;text-transform:none;letter-spacing:0">(optionnel)</span>
    </label>
    <input type="tel" class="e-tel" placeholder="06 12 34 56 78" autocomplete="off">
    <label class="f-label">Discipline(s) de l'enfant
      <span style="color:#555;text-transform:none;letter-spacing:0">(optionnel)</span>
    </label>
    <div class="disc-grid" id="enfant-disc-${idx}"></div>
    <div id="enfant-subcats-${idx}"></div>
  `;
  list.appendChild(block);

  // Pills disciplines enfant — mêmes catégories que le compte principal
  document.getElementById('enfant-disc-' + idx).innerHTML = loadedCategories.map(c =>
    `<div class="pill" data-id="${FTS.esc(c.name)}"
       onclick="toggleEnfantDisc(this,'${FTS.esc(c.name)}',${idx})">
      ${c.icon || FTS.catIcon(c.name)} ${FTS.esc(c.name)}
    </div>`
  ).join('');
}

/* ── SECTION ENFANT — SUPPRIMER — v16 ──────────────────────────── */
function removeEnfant(idx) {
  const block = document.getElementById('enfant-block-' + idx);
  if (block) block.remove();
  delete enfantDiscs[idx];
  delete enfantSubcatsMap[idx];
}

/* ── PILLS DISCIPLINES ENFANT — v16 ────────────────────────────── */
function toggleEnfantDisc(el, id, idx) {
  if (!enfantDiscs[idx]) enfantDiscs[idx] = new Set();
  el.classList.toggle('active');
  if (enfantDiscs[idx].has(id)) {
    enfantDiscs[idx].delete(id);
    if (enfantSubcatsMap[idx]) delete enfantSubcatsMap[idx][id];
  } else {
    enfantDiscs[idx].add(id);
  }
  updateEnfantSubcats(idx);
}

function updateEnfantSubcats(idx) {
  const wrap = document.getElementById('enfant-subcats-' + idx);
  if (!wrap) return;
  const active = enfantDiscs[idx] ? [...enfantDiscs[idx]] : [];
  if (!active.length) { wrap.innerHTML = ''; return; }

  if (!enfantSubcatsMap[idx]) enfantSubcatsMap[idx] = {};
  let html = '<div class="form-subcats">';
  active.forEach(cat => {
    const catData = loadedCategories.find(c => c.name === cat);
    const subs = (catData && catData.subs
      ? catData.subs.map(s => typeof s === 'string' ? s : (s && s.name)).filter(Boolean)
      : []);
    if (!subs.length) return;
    if (!enfantSubcatsMap[idx][cat]) enfantSubcatsMap[idx][cat] = new Set();
    html += '<div class="form-subcat-group">';
    html += '<div class="form-subcat-lbl">' + FTS.esc(cat) + ' — section</div>';
    html += '<div class="disc-grid">';
    subs.forEach(s => {
      const on = enfantSubcatsMap[idx][cat] && enfantSubcatsMap[idx][cat].has(s) ? 'active' : '';
      html += '<div class="pill ' + on + '" onclick="toggleEnfantSubcat(this,' +
        idx + ',' + JSON.stringify(cat) + ',' + JSON.stringify(s) + ')">' + FTS.esc(s) + '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}

function toggleEnfantSubcat(el, idx, cat, sub) {
  if (!enfantSubcatsMap[idx]) enfantSubcatsMap[idx] = {};
  if (!enfantSubcatsMap[idx][cat]) enfantSubcatsMap[idx][cat] = new Set();
  el.classList.toggle('active');
  if (enfantSubcatsMap[idx][cat].has(sub)) enfantSubcatsMap[idx][cat].delete(sub);
  else enfantSubcatsMap[idx][cat].add(sub);
}

/* ── UTILITAIRES ──────────────────────────────────────────────── */
function clearErr(prefix) {
  const el = document.getElementById(prefix + '-err');
  if (el) el.textContent = '';
}

function setBtn(id, text, disabled) {
  const b = document.getElementById(id);
  b.textContent = text;
  b.disabled    = disabled;
  b.classList.toggle('loading', disabled);
}

function showPendingScreen(email) {
  document.getElementById('auth-tabs').style.display    = 'none';
  document.getElementById('auth-body').style.display    = 'none';
  document.getElementById('pending-screen').style.display = 'block';
  if (email) document.getElementById('pending-email-display').textContent = email;
}

/* ── CONNEXION ─────────────────────────────────────────────────── */
async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pwd   = document.getElementById('l-pwd').value;
  const errEl = document.getElementById('l-err');

  if (!email || !pwd) {
    errEl.textContent = 'Remplis les deux champs.';
    return;
  }

  setBtn('btn-login', 'Connexion en cours…', true);
  errEl.textContent = '';

  try {
    const persistence = document.getElementById('l-remember').checked
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;

    await auth.setPersistence(persistence);
    await auth.signInWithEmailAndPassword(email, pwd);
    // → onAuthStateChanged prend le relais

  } catch(e) {
    setBtn('btn-login', 'Se connecter', false);
    errEl.textContent = friendlyError(e.code);
  }
}

/* ── INSCRIPTION — v16 ─────────────────────────────────────────── */
async function doRegister() {
  const first     = document.getElementById('r-first').value.trim();
  const last      = document.getElementById('r-last').value.trim();
  const email     = document.getElementById('r-email').value.trim();
  const tel       = document.getElementById('r-tel').value.trim();
  const pwd       = document.getElementById('r-pwd').value;
  const errEl     = document.getElementById('r-err');
  const hasEnfant = document.getElementById('r-has-enfant').checked;

  if (!first || !last) { errEl.textContent = 'Prénom et nom requis.';             return; }
  if (!email)          { errEl.textContent = 'Adresse e-mail requise.';           return; }
  if (pwd.length < 8)  { errEl.textContent = 'Mot de passe : 8 caractères min.'; return; }

  // Collecte sous-groupes du parent
  const parentSubgroups = [];
  Object.values(selectedSubcats).forEach(set => set.forEach(s => parentSubgroups.push(s)));

  // Collecte enfants
  const enfants = [];
  if (hasEnfant) {
    document.querySelectorAll('.enfant-block').forEach((block, i) => {
      const eFirst = block.querySelector('.e-first').value.trim();
      const eLast  = block.querySelector('.e-last').value.trim();
      const eDob   = block.querySelector('.e-dob').value;
      const eTel   = block.querySelector('.e-tel').value.trim();
      const eIdx   = parseInt(block.id.replace('enfant-block-', ''));
      if (eFirst && eLast) {
        // Sous-groupes de l'enfant
        const childSubs = [];
        if (enfantSubcatsMap[eIdx]) {
          Object.values(enfantSubcatsMap[eIdx]).forEach(set => set.forEach(s => childSubs.push(s)));
        }
        enfants.push({
          id:            'enfant_' + (i + 1),
          prenom:        eFirst,
          nom:           eLast,
          dateNaissance: eDob  || '',
          telephone:     eTel  || '',
          disciplines:   enfantDiscs[eIdx] ? [...enfantDiscs[eIdx]] : [],
          subgroups:     childSubs,
          subgroup:      childSubs.join(', '),
        });
      }
    });
    if (enfants.length === 0) {
      errEl.textContent = 'Renseigne au moins le prénom et le nom de ton enfant.';
      return;
    }
  }

  setBtn('btn-register', 'Création du compte…', true);
  errEl.textContent = '';

  try {
    const cred    = await auth.createUserWithEmailAndPassword(email, pwd);
    const uid     = cred.user.uid;
    const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    /* Structure Firebase :
       fts_users/{uid}
         name, firstName, lastName, email, telephone
         role, status, disciplines[], createdAt
         hasEnfant, enfants[{id, prenom, nom, dateNaissance, telephone, disciplines[]}]
    */
    const profile = {
      email,
      name:        first + ' ' + last,
      firstName:   first,
      lastName:    last,
      telephone:   tel,
      role:        isAdmin ? 'admin' : 'member',
      status:      isAdmin ? 'active' : 'pending',
      disciplines: [...selectedDisc],
      subgroups:   parentSubgroups,
      subgroup:    parentSubgroups.join(', '),
      hasEnfant:   hasEnfant && enfants.length > 0,
      enfants:     enfants,
      createdAt:   Date.now(),
    };

    await db.ref('fts_users/' + uid).set(profile);

    // Sync forum — groupe = union parent + enfants
    try {
      const forumName = hasEnfant && enfants.length > 0
        ? `${first} ${last} (parent de ${enfants.map(e => e.prenom).join(', ')})`
        : first + ' ' + last;

      // Union des disciplines et sous-groupes parent + enfants
      const childDiscs = enfants.flatMap(e => Array.isArray(e.disciplines) ? e.disciplines : []);
      const childSubs  = enfants.flatMap(e => Array.isArray(e.subgroups)   ? e.subgroups   : []);
      const allGroups  = [...new Set([...selectedDisc, ...childDiscs])];
      const allSubs    = [...new Set([...parentSubgroups, ...childSubs])];

      await db.ref('fts_forum/users/' + uid).set({
        name:     forumName,
        group:    allGroups.join(', '),
        subgroup: allSubs.join(', '),
        subgroups: allSubs,
        status:   isAdmin ? 'active' : 'pending',
        role:     isAdmin ? 'admin' : 'member',
        ts:       Date.now(),
      });
    } catch(syncErr) {
      console.warn('[FTS Auth] Synchro forum différée :', syncErr);
    }

  } catch(e) {
    setBtn('btn-register', 'Créer mon compte', false);
    errEl.textContent = friendlyError(e.code);
  }
}

/* ── MOT DE PASSE OUBLIÉ ───────────────────────────────────────── */
async function doResetPwd() {
  const email = document.getElementById('l-email').value.trim();
  const errEl = document.getElementById('l-err');
  const okEl  = document.getElementById('l-ok');

  if (!email) {
    errEl.textContent = 'Entre ton e-mail ci-dessus, puis reclique ici.';
    document.getElementById('l-email').focus();
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    errEl.textContent = '';
    okEl.textContent  = 'E-mail envoyé ! Vérifie ta boîte mail.';
    okEl.style.display = 'block';
  } catch(e) {
    okEl.style.display = 'none';
    errEl.textContent  = friendlyError(e.code);
  }
}

/* ── DÉCONNEXION ───────────────────────────────────────────────── */
function doSignOut() {
  auth.signOut().then(() => location.reload());
}

/* ── MESSAGES D'ERREUR LISIBLES ────────────────────────────────── */
function friendlyError(code) {
  const map = {
    'auth/invalid-email':          'Adresse e-mail invalide.',
    'auth/user-not-found':         'Aucun compte avec cet e-mail.',
    'auth/wrong-password':         'Mot de passe incorrect.',
    'auth/invalid-credential':     'E-mail ou mot de passe incorrect.',
    'auth/email-already-in-use':   'Un compte existe déjà avec cet e-mail.',
    'auth/weak-password':          'Mot de passe trop faible (8 car. min).',
    'auth/too-many-requests':      'Trop de tentatives. Réessaie dans quelques minutes.',
    'auth/network-request-failed': 'Problème réseau. Vérifie ta connexion.',
    'auth/operation-not-allowed':  'Connexion par e-mail non activée sur Firebase.',
  };
  return map[code] || 'Une erreur est survenue. Réessaie.';
}
