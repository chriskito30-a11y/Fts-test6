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

const FTS_PRIVACY_VERSION = '2026-05';
const FTS_IMAGE_RIGHTS_VERSION = '2026-05-droit-image-v2';
const FTS_IMAGE_RIGHTS_NOTICE = 'Autorisation photos/videos FTS : cours, repetitions, stages, spectacles, evenements, communication association interne/externe. Images non vendues, non cedees a des tiers pour usage commercial externe.';
const ADMIN_EMAIL = "contact@faistonshow.fr";
const FTS_PAYMENT_WORKER_URL = String((window.FTS && FTS.PAYMENT && FTS.PAYMENT.workerUrl) || window.FTS_PAYMENTS_WORKER_URL || 'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/, '');
const paymentBridgeState = { orderId:'', order:null, status:'none', error:'', existingAccountHandled:false };


/* ── EMAILS AUTOMATIQUES ───────────────────────────────────────
   À conserver : Make/Brevo sert uniquement aux emails transactionnels.
   Ne pas utiliser ce connecteur pour les rappels automatiques, qui restent
   gérés par le dispatcher natif de l'app.

   Routes envoyées au scénario Make :
   - new_signup : prévenir l'admin d'une nouvelle demande d'inscription
   - account_validated : prévenir le membre que son compte est validé
──────────────────────────────────────────────────────────────── */
async function sendFtsEmailAutomation(type, payload) {
  const data = {
    route: type,
    type: type,
    source: 'fts-pwa',
    app: 'Fais Ton Show',
    sentAt: new Date().toISOString(),
    payload: payload || {},
    // Compatibilité Make : les champs utiles sont aussi disponibles à plat.
    ...(payload || {})
  };

  const workerUrl = (window.FTS && FTS.EMAIL && FTS.EMAIL.workerUrl)
    ? FTS.EMAIL.workerUrl
    : 'https://fts-email.gros-christophe.workers.dev/email';

  let idToken = '';
  try {
    const currentUser = firebase && firebase.auth ? firebase.auth().currentUser : null;
    if (currentUser && currentUser.getIdToken) idToken = await currentUser.getIdToken();
  } catch(e) {
    idToken = '';
  }

  // Non bloquant : l'inscription / validation ne doit jamais échouer à cause d'un email.
  return fetch(workerUrl, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, idToken ? { 'Authorization': 'Bearer ' + idToken } : {}),
    body: JSON.stringify(data),
    keepalive: true
  })
    .then(async res => {
      if (!res.ok) throw new Error('Worker email HTTP ' + res.status);
      return { ok:true, type };
    })
    .catch(err => {
      console.warn('[FTS Email] Envoi Worker impossible', type, err);
      return { ok:false, type, error: err && err.message ? err.message : String(err) };
    });
}



/* ── PUSH ADMIN : nouvelle demande d'inscription ────────────────
   Non bloquant. Envoie une notification au groupe technique __admin__.
   Les compteurs admin restent basés sur fts_users/status=pending : dès qu'un
   admin valide une demande, les autres admins voient le compteur se mettre à jour.
──────────────────────────────────────────────────────────────── */
async function notifyAdminsNewSignup(profile){
  try{
    if(!window.FTS || !FTS.PUSH || !FTS.PUSH.workerUrl || !window.fetch) return;
    const pendingSnap = await db.ref('fts_users').orderByChild('status').equalTo('pending').once('value').catch(function(){ return null; });
    const pendingCount = pendingSnap && pendingSnap.exists && pendingSnap.exists() ? pendingSnap.numChildren() : 1;
    const name = profile && profile.name ? profile.name : 'Nouvelle personne';
    const cats = Array.isArray(profile && profile.disciplines) ? profile.disciplines.join(', ') : (profile && profile.group ? profile.group : '');
    FTS.pushRequest('/notify', {
        group:'__admin__',
        type:'admin_pending_signup',
        title:'FTS — Nouvelle inscription',
        body:name + ' attend une validation' + (pendingCount > 1 ? ' · ' + pendingCount + ' demandes en attente' : ''),
        url:'./forum-admin.html#tab-pending',
        tag:'fts-admin-pending-signups',
        collapseKey:'fts-admin-pending-signups',
        notificationKey:'fts-admin-pending-signups-' + Date.now(),
        pendingCount:pendingCount,
        signupUid:profile && profile.uid ? profile.uid : '',
        categories:cats || ''
    }, { keepalive:true }).catch(function(){});
  }catch(e){
    console.warn('[FTS Auth] Notification admin inscription non envoyée', e);
  }
}

let db, auth;
let selectedDisc    = new Set();
let selectedSubcats  = {};          // { catName: Set<subName> }
let loadedCategories = [];
let enfantCount     = 0;
const enfantDiscs   = {};           // { idx: Set<catName> }
const enfantSubcatsMap = {};        // { idx: { catName: Set<subName> } }
const reminderPrefDraft = {};       // V70 — préférences de rappel inscription par cours


/* ── CLICS DYNAMIQUES AUTH ───────────────────────────────────────
   Les catégories/sous-catégories sont générées après chargement Firebase.
   On évite data-fts-click ici pour ne pas casser les libellés avec espaces,
   accents, apostrophes ou guillemets dans les attributs HTML.
──────────────────────────────────────────────────────────────── */
function bindAuthDynamicSelectionHandlers() {
  if (window.__FTS_AUTH_DYNAMIC_SELECTION_BOUND__) return;
  window.__FTS_AUTH_DYNAMIC_SELECTION_BOUND__ = true;

  document.addEventListener('click', function(event) {
    const el = event.target && event.target.closest
      ? event.target.closest('[data-auth-action]')
      : null;
    if (!el || !document.documentElement.contains(el)) return;

    const action = el.getAttribute('data-auth-action');
    if (!action) return;

    event.preventDefault();

    if (action === 'toggle-disc') {
      toggleDisc(el, el.getAttribute('data-id') || '');
      return;
    }

    if (action === 'toggle-parent-subcat') {
      toggleParentSubcat(el, el.getAttribute('data-cat') || '', el.getAttribute('data-sub') || '');
      return;
    }

    if (action === 'remove-enfant') {
      removeEnfant(parseInt(el.getAttribute('data-idx'), 10));
      return;
    }

    if (action === 'toggle-enfant-disc') {
      toggleEnfantDisc(el, el.getAttribute('data-id') || '', parseInt(el.getAttribute('data-idx'), 10));
      return;
    }

    if (action === 'toggle-enfant-subcat') {
      toggleEnfantSubcat(
        el,
        parseInt(el.getAttribute('data-idx'), 10),
        el.getAttribute('data-cat') || '',
        el.getAttribute('data-sub') || ''
      );
      return;
    }

    if (action === 'toggle-reminder-pref') {
      toggleReminderPref(
        el.getAttribute('data-key') || '',
        el.getAttribute('data-offset') || ''
      );
    }
  });
}

function bridgeNorm(value) {
  if (window.FTS && typeof FTS.norm === 'function') return FTS.norm(value || '');
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function bridgeBlockedStatus(value) {
  return ['refused','failed','error','canceled','cancelled','abandoned'].includes(String(value || '').toLowerCase());
}

function bridgeSeasonLines(order) {
  order = order || {};
  const lines = [];
  if (Array.isArray(order.cartLines)) {
    order.cartLines.forEach(line => {
      if (!line) return;
      const type = String(line.type || line.kind || '').toLowerCase();
      if (type === 'season_registration' || line.activityId || line.offerKey || line.subcategoryId) lines.push(line);
    });
  }
  if (!lines.length && (String(order.type || '').toLowerCase() === 'season_registration' || Number(order.seasonLineCount || 0) > 0)) {
    lines.push(order);
  }
  return lines;
}

function bridgeIsSeasonOrder(order) {
  order = order || {};
  return String(order.type || '').toLowerCase() === 'season_registration'
    || Number(order.seasonLineCount || 0) > 0
    || bridgeSeasonLines(order).length > 0;
}

function bridgeStudentName(line) {
  line = line || {};
  return line.studentName || [line.studentFirstName, line.studentLastName].filter(Boolean).join(' ');
}

function bridgePayerEmail(order) {
  order = order || {};
  return String(order.userEmail || (order.payer && order.payer.email) || '').trim();
}

function bridgePayerPhone(order) {
  order = order || {};
  return String(order.payerPhone || (order.payer && order.payer.phone) || '').trim();
}

function bridgeSplitName(first, last, full) {
  first = String(first || '').trim();
  last = String(last || '').trim();
  if (first || last) return { first, last };
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first:'', last:'' };
  return { first:parts[0] || '', last:parts.slice(1).join(' ') };
}

function bridgeSetInput(id, value) {
  const el = document.getElementById(id);
  if (!el || !value || String(el.value || '').trim()) return;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles:true }));
}

function bridgeKnownCategoryName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const key = bridgeNorm(raw);
  const match = (loadedCategories || []).find(c => bridgeNorm(c && c.name) === key);
  return match ? match.name : raw;
}

function bridgeKnownSubcategoryName(cat, value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const catData = (loadedCategories || []).find(c => bridgeNorm(c && c.name) === bridgeNorm(cat));
  const subs = catData && Array.isArray(catData.subs) ? catData.subs : [];
  const match = subs.map(s => typeof s === 'string' ? s : (s && s.name)).filter(Boolean)
    .find(s => bridgeNorm(s) === bridgeNorm(raw));
  return match || raw;
}

function bridgeApplyParentCourse(line) {
  line = line || {};
  const cat = bridgeKnownCategoryName(line.activityName);
  const sub = bridgeKnownSubcategoryName(cat, line.subcategoryName || line.subcategoryTitle);
  if (cat) {
    selectedDisc.add(cat);
    document.querySelectorAll('#disc-grid .pill').forEach(p => {
      if (bridgeNorm(p.getAttribute('data-id') || p.textContent) === bridgeNorm(cat)) p.classList.add('active');
    });
  }
  if (cat && sub) {
    if (!selectedSubcats[cat]) selectedSubcats[cat] = new Set();
    selectedSubcats[cat].add(sub);
  }
  updateParentSubcats();
  renderReminderPrefs();
}

function bridgeEnsureChildBlock() {
  const checked = document.getElementById('r-has-enfant');
  if (!checked) return null;
  if (!checked.checked) {
    checked.checked = true;
    toggleEnfantSection();
  } else if (!document.querySelector('.enfant-block')) {
    addEnfantField();
  }
  return document.querySelector('.enfant-block');
}

function bridgeApplyChildCourse(line) {
  const block = bridgeEnsureChildBlock();
  if (!block) return;
  line = line || {};
  const names = bridgeSplitName(line.studentFirstName, line.studentLastName, bridgeStudentName(line));
  bridgeSetInputFromElement(block.querySelector('.e-first'), names.first);
  bridgeSetInputFromElement(block.querySelector('.e-last'), names.last);
  const idx = parseInt(block.id.replace('enfant-block-', ''), 10);
  const cat = bridgeKnownCategoryName(line.activityName);
  const sub = bridgeKnownSubcategoryName(cat, line.subcategoryName || line.subcategoryTitle);
  if (cat) {
    if (!enfantDiscs[idx]) enfantDiscs[idx] = new Set();
    enfantDiscs[idx].add(cat);
    document.querySelectorAll('#enfant-disc-' + idx + ' .pill').forEach(p => {
      if (bridgeNorm(p.getAttribute('data-id') || p.textContent) === bridgeNorm(cat)) p.classList.add('active');
    });
    updateEnfantSubcats(idx);
  }
  if (cat && sub) {
    if (!enfantSubcatsMap[idx]) enfantSubcatsMap[idx] = {};
    if (!enfantSubcatsMap[idx][cat]) enfantSubcatsMap[idx][cat] = new Set();
    enfantSubcatsMap[idx][cat].add(sub);
    updateEnfantSubcats(idx);
  }
  renderReminderPrefs();
}

function bridgeSetInputFromElement(el, value) {
  if (!el || !value || String(el.value || '').trim()) return;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles:true }));
}

function bridgeLineLabel(line) {
  line = line || {};
  return [line.activityName, line.subcategoryName || line.subcategoryTitle, line.offerLabel].map(v => String(v || '').trim()).filter(Boolean).join(' - ') || line.itemName || 'Inscription saison';
}

function renderPaymentBridgeNotice() {
  if (!paymentBridgeState.orderId) return;
  let box = document.getElementById('payment-bridge-box');
  const form = document.getElementById('form-register');
  if (!box && form) {
    box = document.createElement('div');
    box.id = 'payment-bridge-box';
    box.className = 'payment-bridge-box';
    form.insertBefore(box, form.firstChild);
  }
  if (!box) return;
  const order = paymentBridgeState.order || {};
  const lines = bridgeSeasonLines(order);
  if (paymentBridgeState.status === 'loading') {
    box.innerHTML = '<strong>Rattachement paiement</strong><p>Lecture de la commande en cours...</p>';
    return;
  }
  if (paymentBridgeState.status === 'linked' || paymentBridgeState.status === 'email_mismatch') {
    box.innerHTML = `<strong>Paiement saison detecte</strong>
      <p>Complete ton compte avec ton mot de passe. Le compte restera en attente de validation admin avant tout acces interne.</p>
      <div class="payment-bridge-lines">${lines.map(line => `<span>${FTS.esc(bridgeLineLabel(line))}${bridgeStudentName(line) ? ' - Eleve : ' + FTS.esc(bridgeStudentName(line)) : ''}</span>`).join('')}</div>`;
    box.innerHTML += '<p class="payment-bridge-existing">Tu as deja un compte FTS ? <button type="button" class="payment-bridge-login" data-payment-bridge-login>Connecte-toi pour demander l ajout de ce cours a ton compte existant.</button></p>';
    const loginBtn = box.querySelector('[data-payment-bridge-login]');
    if (loginBtn) loginBtn.addEventListener('click', function(){ switchTab('login'); });
    return;
  }
  if (paymentBridgeState.status === 'not_eligible') {
    box.innerHTML = '<strong>Commande non eligible</strong><p>Cette commande ne permet pas de rattachement automatique a une demande membre.</p>';
    return;
  }
  if (paymentBridgeState.status === 'not_season') {
    box.innerHTML = '<strong>Commande lue</strong><p>Cette commande ne correspond pas a une inscription saison. Le compte peut etre cree sans rattachement paiement.</p>';
    return;
  }
  box.innerHTML = '<strong>Rattachement non confirme</strong><p>La commande n a pas pu etre relue. Tu peux creer le compte, mais l admin verra que le rattachement est incomplet.</p>';
}

function bridgePrefillForm(order) {
  order = order || {};
  const payer = order.payer || {};
  const payerName = bridgeSplitName(payer.firstName, payer.lastName, order.userName);
  bridgeSetInput('r-first', payerName.first);
  bridgeSetInput('r-last', payerName.last);
  bridgeSetInput('r-email', bridgePayerEmail(order));
  bridgeSetInput('r-tel', bridgePayerPhone(order));

  const line = bridgeSeasonLines(order)[0] || order;
  const student = bridgeStudentName(line);
  const payerFull = [payerName.first, payerName.last].filter(Boolean).join(' ');
  const studentLooksDifferent = student && payerFull && bridgeNorm(student) !== bridgeNorm(payerFull);
  if (studentLooksDifferent) bridgeApplyChildCourse(line);
  else bridgeApplyParentCourse(line);
}

async function initPaymentBridgeFromUrl() {
  const params = new URLSearchParams(location.search);
  const requestedTab = String(params.get('tab') || params.get('mode') || '').toLowerCase();
  const orderId = params.get('orderId') || params.get('order') || params.get('localOrderId') || '';
  if (requestedTab === 'login') switchTab('login');
  else if (requestedTab === 'register' || orderId) switchTab('register');
  if (!orderId) return;
  paymentBridgeState.orderId = orderId;
  paymentBridgeState.status = 'loading';
  renderPaymentBridgeNotice();
  try {
    const res = await fetch(FTS_PAYMENT_WORKER_URL + '/payment-status?orderId=' + encodeURIComponent(orderId), {
      method:'GET',
      headers:{ 'Content-Type':'application/json' }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok === false || !data.order) throw new Error((data && data.error) || ('HTTP ' + res.status));
    const order = data.order || {};
    paymentBridgeState.order = order;
    if (!bridgeIsSeasonOrder(order)) paymentBridgeState.status = 'not_season';
    else if (bridgeBlockedStatus(order.status) || bridgeBlockedStatus(order.globalPaymentStatus)) paymentBridgeState.status = 'not_eligible';
    else {
      paymentBridgeState.status = 'linked';
      bridgePrefillForm(order);
    }
  } catch(e) {
    console.warn('[FTS Auth] Rattachement paiement illisible', e);
    paymentBridgeState.status = 'unreadable';
    paymentBridgeState.error = e && e.message ? e.message : String(e);
  }
  renderPaymentBridgeNotice();
}

function buildPaymentAttachmentForProfile(accountEmail) {
  if (!paymentBridgeState.orderId) return null;
  const order = paymentBridgeState.order || null;
  if (!order) {
    return {
      registrationSource: 'payment_return',
      paymentOrderId: paymentBridgeState.orderId,
      paymentLinkStatus: 'order_unreadable',
      paymentLinkError: paymentBridgeState.error || '',
      paymentLinkedAt: Date.now()
    };
  }
  if (!bridgeIsSeasonOrder(order) || paymentBridgeState.status === 'not_eligible') return null;
  const lines = bridgeSeasonLines(order);
  const firstLine = lines[0] || order;
  const payerEmail = bridgePayerEmail(order);
  const cleanAccountEmail = String(accountEmail || '').trim();
  const emailMismatch = !!(payerEmail && cleanAccountEmail && payerEmail.toLowerCase() !== cleanAccountEmail.toLowerCase());
  return {
    registrationSource: 'payment_return',
    paymentOrderId: order.id || paymentBridgeState.orderId,
    paymentType: order.type || '',
    paymentStatus: order.status || '',
    paymentGlobalStatus: order.globalPaymentStatus || '',
    paymentLinkStatus: emailMismatch ? 'email_mismatch' : 'linked',
    paymentEmailMismatch: emailMismatch,
    accountEmail: cleanAccountEmail,
    season: firstLine.season || order.season || '',
    activityId: firstLine.activityId || order.activityId || '',
    activityName: firstLine.activityName || order.activityName || '',
    offerKey: firstLine.offerKey || order.offerKey || '',
    offerLabel: firstLine.offerLabel || order.offerLabel || '',
    subcategoryId: firstLine.subcategoryId || order.subcategoryId || '',
    subcategoryName: firstLine.subcategoryName || firstLine.subcategoryTitle || order.subcategoryName || order.subcategoryTitle || '',
    studentFirstName: firstLine.studentFirstName || order.studentFirstName || '',
    studentLastName: firstLine.studentLastName || order.studentLastName || '',
    studentName: bridgeStudentName(firstLine) || bridgeStudentName(order),
    payerEmail,
    payerPhone: bridgePayerPhone(order),
    seasonLines: lines.slice(0, 12).map(line => ({
      activityId: line.activityId || '',
      activityName: line.activityName || '',
      offerKey: line.offerKey || '',
      offerLabel: line.offerLabel || '',
      subcategoryId: line.subcategoryId || '',
      subcategoryName: line.subcategoryName || line.subcategoryTitle || '',
      studentFirstName: line.studentFirstName || '',
      studentLastName: line.studentLastName || '',
      studentName: bridgeStudentName(line),
      amountCents: Number(line.amountCents || 0),
      itemName: line.itemName || ''
    })),
    paymentLinkedAt: Date.now()
  };
}

/* ── INIT ──────────────────────────────────────────────────────── */
function bridgeDbKey(value) {
  return String(value || '').trim().replace(/[.#$\[\]\/]/g, '_') || ('order_' + Date.now());
}

async function attachPaymentBridgeToActiveProfile(user, profile) {
  if (!user || !user.uid || !profile || paymentBridgeState.existingAccountHandled) return null;
  if (!paymentBridgeState.orderId || !paymentBridgeState.order || paymentBridgeState.status !== 'linked') return null;
  const attachment = buildPaymentAttachmentForProfile(user.email || profile.email || '');
  if (!attachment || !attachment.paymentOrderId) return null;
  paymentBridgeState.existingAccountHandled = true;
  const key = bridgeDbKey(attachment.paymentOrderId);
  const request = Object.assign({}, attachment, {
    requestType: 'season_access_update',
    existingAccount: true,
    status: 'pending_admin_review',
    requestedAt: Date.now(),
    currentDisciplines: Array.isArray(profile.disciplines) ? profile.disciplines : [],
    currentSubgroups: Array.isArray(profile.subgroups) ? profile.subgroups : []
  });
  const updates = {};
  updates['seasonAccessRequests/' + key] = request;
  updates['lastSeasonAccessRequest'] = request;
  updates.updatedAt = Date.now();
  await db.ref('fts_users/' + user.uid).update(updates);
  return request;
}

function showExistingAccountBridgeScreen(email) {
  showAccountStatusScreen(email, {
    icon: 'OK',
    title: 'Demande d ajout envoyee',
    desc: "Ton compte FTS reste actif. L'equipe verifiera la nouvelle inscription saison avant d'ajouter les disciplines ou groupes a ton compte.<br/><a href=\"membres.html\">Aller a mon espace membre</a>"
  });
}

window.addEventListener('DOMContentLoaded', async () => {

  db   = FTS.initFirebase();
  auth = firebase.auth();

  /* Charger les disciplines depuis Firebase (admin les gère)
     → fallback automatique sur DEFAULT_CATEGORIES si hors ligne */
  loadedCategories = await FTS.getCategoryStructureAsync(db);
  bindAuthDynamicSelectionHandlers();
  document.addEventListener('input', function(event){
    if(event.target && (event.target.id === 'r-first' || event.target.classList.contains('e-first'))) renderReminderPrefs();
  });

  document.getElementById('disc-grid').innerHTML = loadedCategories.map(c =>
    `<div class="pill" data-id="${FTS.esc(c.name)}"
       data-auth-action="toggle-disc">
      ${c.icon || FTS.catIcon(c.name)} ${FTS.esc(c.name)}
    </div>`
  ).join('');
  await initPaymentBridgeFromUrl();

  // Écoute de l'état de connexion
  auth.onAuthStateChanged(async user => {
    if (!user) return; // pas connecté → reste sur la page

    try {
      const snap    = await db.ref('fts_users/' + user.uid).once('value');
      const profile = snap.val();
      try { if(profile && profile.status === 'active') await FTS.syncPublicProfile(db, user.uid, profile); } catch(e) { console.warn('[FTS Auth] Sync profil public non bloquant :', e); }

      if (!profile) {
        // Profil introuvable → déconnexion propre
        await auth.signOut();
        return;
      }

      const status = String(profile.status || '').toLowerCase();
      if (status === 'pending') {
        showPendingScreen(user.email, profile);
        return;
      }

      if (status === 'refused') {
        showRefusedScreen(user.email);
        return;
      }

      if (status !== 'active') {
        showInactiveScreen(user.email);
        return;
      }

      let activeRequest = null;
      try {
        activeRequest = await attachPaymentBridgeToActiveProfile(user, profile);
      } catch(linkErr) {
        console.warn('[FTS Auth] Demande ajout saison non enregistree', linkErr);
        showAccountStatusScreen(user.email, {
          icon: '!',
          title: 'Rattachement a verifier',
          desc: "Ton compte FTS reste actif, mais la demande d'ajout n'a pas pu etre enregistree automatiquement. Garde la reference de commande et contacte Fais Ton Show.<br/><a href=\"membres.html\">Aller a mon espace membre</a>"
        });
        return;
      }
      if (activeRequest) {
        showExistingAccountBridgeScreen(user.email);
        return;
      }

      window.location.href = 'membres.html';
      return;


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
  renderReminderPrefs();
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
      html += '<div class="pill ' + on + '" data-auth-action="toggle-parent-subcat" data-cat="' +
        FTS.esc(cat) + '" data-sub="' + FTS.esc(s) + '">' + FTS.esc(s) + '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
  renderReminderPrefs();
}

function toggleParentSubcat(el, cat, sub) {
  if (!selectedSubcats[cat]) selectedSubcats[cat] = new Set();
  el.classList.toggle('active');
  if (selectedSubcats[cat].has(sub)) selectedSubcats[cat].delete(sub);
  else selectedSubcats[cat].add(sub);
  renderReminderPrefs();
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
  renderReminderPrefs();
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
        ? `<button type="button" class="enfant-remove" data-auth-action="remove-enfant" data-idx="${idx}">✕ Retirer</button>`
        : ''}
    </div>
    <div class="two-cols">
      <div>
        <label class="f-label u-mt-0">Prénom</label>
        <input type="text" class="e-first" placeholder="Emma" autocomplete="off">
      </div>
      <div>
        <label class="f-label u-mt-0">Nom</label>
        <input type="text" class="e-last" placeholder="Martin" autocomplete="off">
      </div>
    </div>
    <label class="f-label">Date de naissance</label>
    <input type="date" class="e-dob" max="${new Date().toISOString().split('T')[0]}">
    <label class="f-label">Téléphone
      <span class="u-muted-normal">(optionnel)</span>
    </label>
    <input type="tel" class="e-tel" placeholder="06 12 34 56 78" autocomplete="off">
    <label class="f-label">Discipline(s) de l'enfant
      <span class="u-muted-normal">(optionnel)</span>
    </label>
    <div class="disc-grid" id="enfant-disc-${idx}"></div>
    <div id="enfant-subcats-${idx}"></div>
  `;
  list.appendChild(block);

  // Pills disciplines enfant — mêmes catégories que le compte principal
  document.getElementById('enfant-disc-' + idx).innerHTML = loadedCategories.map(c =>
    `<div class="pill" data-id="${FTS.esc(c.name)}"
       data-auth-action="toggle-enfant-disc" data-idx="${idx}">
      ${c.icon || FTS.catIcon(c.name)} ${FTS.esc(c.name)}
    </div>`
  ).join('');
  renderReminderPrefs();
}

/* ── SECTION ENFANT — SUPPRIMER — v16 ──────────────────────────── */
function removeEnfant(idx) {
  const block = document.getElementById('enfant-block-' + idx);
  if (block) block.remove();
  delete enfantDiscs[idx];
  delete enfantSubcatsMap[idx];
  renderReminderPrefs();
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
  renderReminderPrefs();
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
      html += '<div class="pill ' + on + '" data-auth-action="toggle-enfant-subcat" data-idx="' + idx + '" data-cat="' +
        FTS.esc(cat) + '" data-sub="' + FTS.esc(s) + '">' + FTS.esc(s) + '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
  renderReminderPrefs();
}

function toggleEnfantSubcat(el, idx, cat, sub) {
  if (!enfantSubcatsMap[idx]) enfantSubcatsMap[idx] = {};
  if (!enfantSubcatsMap[idx][cat]) enfantSubcatsMap[idx][cat] = new Set();
  el.classList.toggle('active');
  if (enfantSubcatsMap[idx][cat].has(sub)) enfantSubcatsMap[idx][cat].delete(sub);
  else enfantSubcatsMap[idx][cat].add(sub);
  renderReminderPrefs();
}


/* ── PRÉFÉRENCES RAPPELS INSCRIPTION — V70 ───────────────────────
   Ajout 100% optionnel : on réutilise les disciplines/sous-catégories
   déjà sélectionnées. Aucun rappel n'est créé ici ; on stocke seulement
   les préférences dans fts_users/{uid}.reminderPrefs pour l'admin.
──────────────────────────────────────────────────────────────── */
function reminderNorm(v) {
  return String(v || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function makeReminderCourseKey(ownerType, ownerId, category, subcategory) {
  return [ownerType || 'self', ownerId || 'self', category || '', subcategory || ''].map(reminderNorm).join('|');
}

function selectedSubListForCat(map, cat) {
  return map && map[cat] ? [...map[cat]].filter(Boolean) : [];
}

function buildReminderPrefRows() {
  const rows = [];
  [...selectedDisc].forEach(cat => {
    const subs = selectedSubListForCat(selectedSubcats, cat);
    const targets = subs.length ? subs : [''];
    targets.forEach(sub => {
      rows.push({
        ownerType: 'self',
        ownerId: 'self',
        ownerName: (document.getElementById('r-first')?.value || '').trim() || 'Moi',
        category: cat,
        subcategory: sub,
        courseLabel: [cat, sub].filter(Boolean).join(' — ') || cat
      });
    });
  });

  document.querySelectorAll('.enfant-block').forEach(block => {
    const idx = parseInt(block.id.replace('enfant-block-', ''), 10);
    const first = (block.querySelector('.e-first')?.value || '').trim();
    const ownerName = first || ('Enfant ' + idx);
    const cats = enfantDiscs[idx] ? [...enfantDiscs[idx]] : [];
    cats.forEach(cat => {
      const subs = enfantSubcatsMap[idx] && enfantSubcatsMap[idx][cat] ? [...enfantSubcatsMap[idx][cat]].filter(Boolean) : [];
      const targets = subs.length ? subs : [''];
      targets.forEach(sub => {
        rows.push({
          ownerType: 'child',
          ownerId: String(idx),
          ownerName,
          category: cat,
          subcategory: sub,
          courseLabel: [cat, sub].filter(Boolean).join(' — ') || cat
        });
      });
    });
  });

  const seen = new Set();
  return rows.filter(row => {
    const key = makeReminderCourseKey(row.ownerType, row.ownerId, row.category, row.subcategory);
    if(seen.has(key)) return false;
    seen.add(key);
    row.key = key;
    return !!row.courseLabel;
  });
}

function renderReminderPrefs() {
  const section = document.getElementById('registration-reminder-prefs');
  const list = document.getElementById('registration-reminder-list');
  if(!section || !list) return;
  const rows = buildReminderPrefRows();
  section.classList.toggle('u-hidden', rows.length === 0);
  if(!rows.length){ list.innerHTML = ''; return; }

  list.innerHTML = rows.map(row => {
    const pref = reminderPrefDraft[row.key] || {};
    const ownerIcon = row.ownerType === 'child' ? '👧' : '👤';
    return `<div class="reminder-pref-row">
      <div>
        <div class="reminder-pref-title">${FTS.esc(row.courseLabel)}</div>
        <div class="reminder-pref-owner">${ownerIcon} ${FTS.esc(row.ownerName)}</div>
      </div>
      <div class="reminder-pref-checks">
        <label class="reminder-pref-chip"><input type="checkbox" data-auth-action="toggle-reminder-pref" data-key="${FTS.esc(row.key)}" data-offset="24h" ${pref.reminder24h ? 'checked' : ''}> 24h avant</label>
        <label class="reminder-pref-chip"><input type="checkbox" data-auth-action="toggle-reminder-pref" data-key="${FTS.esc(row.key)}" data-offset="1h" ${pref.reminder1h ? 'checked' : ''}> 1h avant</label>
      </div>
    </div>`;
  }).join('');
}

function toggleReminderPref(key, offset) {
  if(!key) return;
  if(!reminderPrefDraft[key]) reminderPrefDraft[key] = {};
  if(offset === '24h') reminderPrefDraft[key].reminder24h = !reminderPrefDraft[key].reminder24h;
  if(offset === '1h') reminderPrefDraft[key].reminder1h = !reminderPrefDraft[key].reminder1h;
  renderReminderPrefs();
}

function buildReminderPrefsForProfile(enfantsDraft) {
  const prefs = {};
  [...selectedDisc].forEach(cat => {
    const subs = selectedSubListForCat(selectedSubcats, cat);
    const targets = subs.length ? subs : [''];
    targets.forEach(sub => {
      const draftKey = makeReminderCourseKey('self', 'self', cat, sub);
      const pref = reminderPrefDraft[draftKey] || {};
      const finalKey = makeReminderCourseKey('self', 'self', cat, sub);
      prefs[finalKey] = {
        ownerType: 'self', ownerId: 'self', ownerName: (document.getElementById('r-first')?.value || '').trim(),
        category: cat, subcategory: sub, courseLabel: [cat, sub].filter(Boolean).join(' — ') || cat,
        reminder24h: !!pref.reminder24h, reminder1h: !!pref.reminder1h
      };
    });
  });

  (enfantsDraft || []).forEach(child => {
    const localIdx = child._authIdx;
    const childId = child.id || ('enfant_' + localIdx);
    const cats = child.disciplines || [];
    cats.forEach(cat => {
      const subs = enfantSubcatsMap[localIdx] && enfantSubcatsMap[localIdx][cat] ? [...enfantSubcatsMap[localIdx][cat]].filter(Boolean) : [];
      const targets = subs.length ? subs : [''];
      targets.forEach(sub => {
        const draftKey = makeReminderCourseKey('child', String(localIdx), cat, sub);
        const pref = reminderPrefDraft[draftKey] || {};
        const finalKey = makeReminderCourseKey('child', childId, cat, sub);
        prefs[finalKey] = {
          ownerType: 'child', ownerId: childId, ownerName: child.prenom || '', childId, childName: child.prenom || '',
          category: cat, subcategory: sub, courseLabel: [cat, sub].filter(Boolean).join(' — ') || cat,
          reminder24h: !!pref.reminder24h, reminder1h: !!pref.reminder1h
        };
      });
    });
  });

  return prefs;
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

function showAccountStatusScreen(email, options) {
  options = options || {};
  document.getElementById('auth-tabs').style.display    = 'none';
  document.getElementById('auth-body').style.display    = 'none';
  document.getElementById('pending-screen').style.display = 'block';
  const icon = document.querySelector('#pending-screen .pending-icon');
  const title = document.querySelector('#pending-screen .pending-title');
  const desc = document.querySelector('#pending-screen .pending-desc');
  if (icon && options.icon !== undefined) icon.textContent = options.icon || '';
  if (title) title.textContent = options.title || '';
  if (desc) desc.innerHTML = options.desc || '';
  if (email) document.getElementById('pending-email-display').textContent = email;
}

function showPendingScreen(email, profile) {
  showAccountStatusScreen(email, {
    title: 'Demande envoyée !',
    desc: "Ton compte est en cours de validation par l'équipe FTS.<br/>Tu recevras un e-mail dès que ton accès sera activé."
  });
  if (profile && profile.paymentOrderId) {
    const desc = document.querySelector('#pending-screen .pending-desc');
    if (desc) desc.innerHTML += "<br/>Ton paiement saison est rattache a la demande. L'equipe FTS verifiera le paiement, la personne et le groupe avant activation.";
  }
}

function showRefusedScreen(email) {
  showAccountStatusScreen(email, {
    icon: '!',
    title: 'Compte non activé',
    desc: "Ce compte a été refusé ou révoqué. Contacte l'équipe FTS si tu penses qu'il s'agit d'une erreur."
  });
}

function showInactiveScreen(email) {
  showAccountStatusScreen(email, {
    icon: '!',
    title: 'Accès non activé',
    desc: "Ce compte n'est pas activé. Contacte l'équipe FTS pour vérifier ton accès."
  });
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
  const privacyOk = document.getElementById('r-privacy') && document.getElementById('r-privacy').checked;
  if (!privacyOk) { errEl.textContent = 'Tu dois accepter la politique de confidentialité pour créer ton compte.'; return; }

  const imageRightsEl = document.querySelector('input[name="r-image-rights"]:checked');
  if (!imageRightsEl) { errEl.textContent = 'Choisis oui ou non pour le droit à l’image.'; return; }
  const imageRightsConsent = imageRightsEl.value === 'yes';
  const imageRightsAt = Date.now();

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
          _authIdx:      eIdx,
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

    const reminderPrefs = buildReminderPrefsForProfile(enfants);
    const savedEnfants = enfants.map(e => {
      const copy = Object.assign({}, e);
      delete copy._authIdx;
      return copy;
    });
    const paymentAttachment = isAdmin ? null : buildPaymentAttachmentForProfile(email);

    /* Structure Firebase :
       fts_users/{uid}
         name, firstName, lastName, email, telephone
         role, status, disciplines[], createdAt
         hasEnfant, enfants[{id, prenom, nom, dateNaissance, telephone, disciplines[]}]
    */
    const profile = {
      uid,
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
      hasEnfant:   hasEnfant && savedEnfants.length > 0,
      enfants:     savedEnfants,
      reminderPrefs: reminderPrefs,
      createdAt:   Date.now(),
      privacyAccepted: true,
      privacyAcceptedAt: Date.now(),
      privacyVersion: FTS_PRIVACY_VERSION,
      privacyParentConsent: !!hasEnfant,
      privacySource: 'auth_register',
      imageRightsConsent: imageRightsConsent,
      imageRightsStatus: imageRightsConsent ? 'accepted' : 'refused',
      imageRightsAt: imageRightsAt,
      imageRightsUpdatedAt: imageRightsAt,
      imageRightsVersion: FTS_IMAGE_RIGHTS_VERSION,
      imageRightsNotice: FTS_IMAGE_RIGHTS_NOTICE,
      imageRightsSource: 'auth_register',
      imageRightsHistory: {
        [imageRightsAt]: {
          value: imageRightsConsent,
          status: imageRightsConsent ? 'accepted' : 'refused',
          source: 'auth_register',
          at: imageRightsAt
        }
      },
    };
    if (paymentAttachment) {
      Object.assign(profile, paymentAttachment);
      profile.paymentAttachment = paymentAttachment;
    }

    await db.ref('fts_users/' + uid).set(profile);
    try { await FTS.syncPublicProfile(db, uid, profile); } catch(e) { console.warn('[FTS Auth] Profil public non bloquant :', e); }

    // Historique séparé du droit à l'image : horodatage serveur, non bloquant.
    try {
      await db.ref('fts_image_rights_history/' + uid).push({
        status: imageRightsConsent ? 'accepted' : 'refused',
        value: imageRightsConsent,
        source: 'auth_register',
        version: FTS_IMAGE_RIGHTS_VERSION,
        notice: FTS_IMAGE_RIGHTS_NOTICE,
        at: firebase.database.ServerValue.TIMESTAMP
      });
    } catch(imageHistErr) {
      console.warn('[FTS Auth] Historique droit image non bloquant :', imageHistErr);
    }


    // Mail admin : nouvelle demande d'inscription (sauf compte admin interne)
    if (!isAdmin) {
      const childDiscsForMail = enfants.flatMap(e => Array.isArray(e.disciplines) ? e.disciplines : []);
      const childSubsForMail  = enfants.flatMap(e => Array.isArray(e.subgroups)   ? e.subgroups   : []);
      sendFtsEmailAutomation('new_signup', {
        uid,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        categories: [...new Set([...selectedDisc, ...childDiscsForMail])].join(', '),
        subcategories: [...new Set([...parentSubgroups, ...childSubsForMail])].join(', '),
      });
      notifyAdminsNewSignup(Object.assign({}, profile, {
        uid,
        disciplines: [...new Set([...selectedDisc, ...childDiscsForMail])],
        group: [...new Set([...selectedDisc, ...childDiscsForMail])].join(', '),
        subgroups: [...new Set([...parentSubgroups, ...childSubsForMail])],
        subgroup: [...new Set([...parentSubgroups, ...childSubsForMail])].join(', ')
      }));
    }

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
    'auth/email-already-in-use':   'Un compte existe deja avec cet e-mail. Connecte-toi, utilise mot de passe oublie ou contacte Fais Ton Show.',
    'auth/weak-password':          'Mot de passe trop faible (8 car. min).',
    'auth/too-many-requests':      'Trop de tentatives. Réessaie dans quelques minutes.',
    'auth/network-request-failed': 'Problème réseau. Vérifie ta connexion.',
    'auth/operation-not-allowed':  'Connexion par e-mail non activée sur Firebase.',
  };
  return map[code] || 'Une erreur est survenue. Réessaie.';
}

/* FTS_AUTO_EXTRACTED_HANDLERS:auth.html */
(function(){
  'use strict';
  var handlers = [{"selector": "[data-fts-handler-1]", "event": "click", "code": "doSignOut()"}, {"selector": "[data-fts-handler-2]", "event": "click", "code": "switchTab('login')"}, {"selector": "[data-fts-handler-3]", "event": "click", "code": "switchTab('register')"}, {"selector": "[data-fts-handler-4]", "event": "input", "code": "clearErr('l')"}, {"selector": "[data-fts-handler-5]", "event": "keydown", "code": "if(event.key==='Enter') doLogin()"}, {"selector": "[data-fts-handler-6]", "event": "input", "code": "clearErr('l')"}, {"selector": "[data-fts-handler-7]", "event": "click", "code": "doResetPwd()"}, {"selector": "[data-fts-handler-8]", "event": "click", "code": "doLogin()"}, {"selector": "[data-fts-handler-9]", "event": "input", "code": "clearErr('r')"}, {"selector": "[data-fts-handler-10]", "event": "input", "code": "clearErr('r')"}, {"selector": "[data-fts-handler-11]", "event": "input", "code": "clearErr('r')"}, {"selector": "[data-fts-handler-12]", "event": "keydown", "code": "if(event.key==='Enter') doRegister()"}, {"selector": "[data-fts-handler-13]", "event": "input", "code": "clearErr('r')"}, {"selector": "[data-fts-handler-14]", "event": "change", "code": "toggleEnfantSection()"}, {"selector": "[data-fts-handler-15]", "event": "click", "code": "addEnfantField()"}, {"selector": "[data-fts-handler-16]", "event": "click", "code": "doRegister()"}];
  function bindExtractedHandlers(){
    handlers.forEach(function(h){
      document.querySelectorAll(h.selector).forEach(function(el){
        if (el.__ftsExtractedHandlers && el.__ftsExtractedHandlers[h.event + h.code]) return;
        el.__ftsExtractedHandlers = el.__ftsExtractedHandlers || {};
        el.__ftsExtractedHandlers[h.event + h.code] = true;
        el.addEventListener(h.event, function(event){
          try { (new Function('event', h.code)).call(el, event); }
          catch (err) { console.error('[FTS] Handler extrait en erreur:', h.code, err); }
        });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindExtractedHandlers);
  else bindExtractedHandlers();
})();
/* END_FTS_AUTO_EXTRACTED_HANDLERS */
