/* ================================================================
   FTS PAIEMENT — Module HelloAsso isolé
   ================================================================ */
(function(window){
  'use strict';

  const FTS = window.FTS = window.FTS || {};
  const DEFAULT_WORKER_URL = 'https://fts-helloasso-api.gros-christophe.workers.dev';
  const WORKER_URL = String((FTS.PAYMENT && FTS.PAYMENT.workerUrl) || (FTS.PAIEMENTS && FTS.PAIEMENTS.workerUrl) || window.FTS_PAYMENTS_WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, '');

  const DEFAULT_ITEMS = [];

  const state = {
    user: null,
    profile: null,
    items: Array.isArray(window.FTS_PAYMENT_ITEMS) && window.FTS_PAYMENT_ITEMS.length ? window.FTS_PAYMENT_ITEMS : DEFAULT_ITEMS
  };

  function $(id){ return document.getElementById(id); }
  function esc(s){ return FTS.esc ? FTS.esc(s == null ? '' : s) : String(s == null ? '' : s); }
  function formatEuros(cents){ return (Number(cents || 0) / 100).toLocaleString('fr-FR', { style:'currency', currency:'EUR' }); }
  function isAdmin(){ return String((state.profile && state.profile.role) || '').toLowerCase() === 'admin'; }
  function isPaymentBeta(){ return !!(state.profile && state.profile.features && state.profile.features.paymentsBeta === true); }
  function canSeePayments(){ return isAdmin() || isPaymentBeta(); }
  function statusClass(status){
    const s = String(status || '').toLowerCase();
    if(['paid','authorized','validated','success','confirmed','free_confirmed','offline_received'].includes(s)) return 'paid';
    if(['refused','failed','error','canceled','cancelled','abandoned'].includes(s)) return 'refused';
    return 'pending';
  }
  function statusLabel(status){
    const s = String(status || '').toLowerCase();
    if(['free_confirmed'].includes(s)) return 'Réservation gratuite confirmée';
    if(['offline_pending'].includes(s)) return 'Paiement à recevoir';
    if(['offline_received'].includes(s)) return 'Paiement reçu hors ligne';
    if(['paid','authorized','validated','success','confirmed'].includes(s)) return 'Paiement validé';
    if(['refused','failed','error'].includes(s)) return 'Paiement refusé';
    if(['canceled','cancelled'].includes(s)) return 'Paiement annulé';
    if(['abandoned'].includes(s)) return 'Paiement abandonné';
    return 'Paiement en attente';
  }
  function isActiveAccount(){
    return !!(state.user && state.profile && String(state.profile.status || '').toLowerCase() === 'active');
  }
  function blockedBridgeStatus(status){
    return ['refused','failed','error','canceled','cancelled','abandoned'].includes(String(status || '').toLowerCase());
  }
  function seasonLinesFromOrder(order){
    order = order || {};
    const lines = [];
    if(Array.isArray(order.cartLines)){
      order.cartLines.forEach(line => {
        if(!line) return;
        const type = String(line.type || line.kind || '').toLowerCase();
        if(type === 'season_registration' || line.activityId || line.offerKey || line.subcategoryId){
          lines.push(line);
        }
      });
    }
    if(!lines.length && (String(order.type || '').toLowerCase() === 'season_registration' || Number(order.seasonLineCount || 0) > 0)){
      lines.push(order);
    }
    return lines;
  }
  function isSeasonOrder(order){
    order = order || {};
    return String(order.type || '').toLowerCase() === 'season_registration'
      || Number(order.seasonLineCount || 0) > 0
      || seasonLinesFromOrder(order).length > 0;
  }
  function compactLineParts(parts){
    return (parts || []).map(v => String(v || '').trim()).filter(Boolean);
  }
  function lineStudentName(line){
    return line && (line.studentName || [line.studentFirstName, line.studentLastName].filter(Boolean).join(' ')) || '';
  }
  function renderSeasonLines(order){
    const lines = seasonLinesFromOrder(order);
    if(!lines.length) return '';
    return `<div class="payment-season-lines">
      <strong>Inscription saison</strong>
      ${lines.map(line => {
        const title = compactLineParts([line.activityName, line.subcategoryName || line.subcategoryTitle, line.offerLabel]).join(' - ') || line.itemName || 'Ligne saison';
        const meta = compactLineParts([
          lineStudentName(line) ? 'Eleve : ' + lineStudentName(line) : '',
          line.season ? 'Saison : ' + line.season : ''
        ]).join(' - ');
        return `<div class="payment-season-line"><span>${esc(title)}</span>${meta ? `<small>${esc(meta)}</small>` : ''}</div>`;
      }).join('')}
    </div>`;
  }
  function renderMemberBridge(order, orderId){
    if(!isSeasonOrder(order)) return '';
    const status = String(order.status || '').toLowerCase();
    const globalStatus = String(order.globalPaymentStatus || '').toLowerCase();
    if(blockedBridgeStatus(status) || blockedBridgeStatus(globalStatus)){
      return '<div class="payment-account-note is-blocked">Cette commande ne permet pas de creer un compte membre depuis ce retour. Reprenez le paiement ou contactez Fais Ton Show.</div>';
    }
    if(isActiveAccount()){
      return `<div class="payment-account-note">
        <strong>Compte deja actif</strong>
        <span>Vous etes deja connecte avec un compte valide. Le paiement ne cree pas un nouveau compte.</span>
        <div class="payment-return-actions">
          <a class="payment-secondary" href="membres.html">Espace membres</a>
          <a class="payment-secondary" href="saison.html">Retour Saison</a>
        </div>
      </div>`;
    }
    const orderKey = encodeURIComponent(order.id || orderId || '');
    const href = 'auth?tab=register&orderId=' + orderKey;
    const loginHref = 'auth?tab=login&orderId=' + orderKey;
    return `<div class="payment-account-note">
      <strong>Finaliser la demande membre</strong>
      <span>Le paiement ou la reservation ne donne pas encore acces aux espaces internes. L'equipe FTS validera le compte apres verification.</span>
      <div class="payment-return-actions">
        <a class="payment-primary payment-account-cta" href="${esc(href)}">Creer mon compte membre</a>
        <a class="payment-secondary" href="${esc(loginHref)}">J'ai deja un compte</a>
      </div>
    </div>`;
  }
  function setGuard(title, body){
    const panel = $('payment-guard-panel');
    if(!panel) return;
    panel.hidden = false;
    panel.innerHTML = '<div class="panel-title">'+esc(title)+'</div><div class="payment-empty">'+esc(body)+'</div>';
  }
  function hideGuard(){ const p = $('payment-guard-panel'); if(p) p.hidden = true; }

  async function getToken(force){
    if(!window.firebase || !firebase.auth || !firebase.auth().currentUser) throw new Error('not_connected');
    return firebase.auth().currentUser.getIdToken(!!force);
  }

  async function api(path, options){
    options = options || {};
    const headers = Object.assign({ 'Content-Type':'application/json' }, options.headers || {});
    if(!options.optionalAuth){
      const token = await getToken(false);
      headers.Authorization = 'Bearer ' + token;
    }else if(window.firebase && firebase.auth && firebase.auth().currentUser){
      const token = await firebase.auth().currentUser.getIdToken(false).catch(() => '');
      if(token) headers.Authorization = 'Bearer ' + token;
    }
    delete options.optionalAuth;
    const res = await fetch(WORKER_URL + path, Object.assign({
      method:'GET',
      headers
    }, options));
    const data = await res.json().catch(() => null);
    if(!res.ok || !data || data.ok === false){
      const err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.data = data;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function renderItems(){
    const panel = $('payment-items-panel');
    const box = $('payment-items');
    if(!panel || !box) return;
    panel.hidden = false;
    if(!state.items.length){
      box.innerHTML = '<div class="payment-empty">Les paiements se lancent depuis la page Saison pour le moment.</div>';
      return;
    }
    box.innerHTML = state.items.map(item => `
      <article class="payment-item">
        <div class="payment-item-top">
          <div class="payment-icon">${esc(item.icon || '🎫')}</div>
          <div>
            <h2>${esc(item.title || item.name || 'Paiement Fais Ton Show')}</h2>
            <p>${esc(item.description || '')}</p>
          </div>
        </div>
        <div class="payment-price">${formatEuros(item.amountCents)}</div>
        ${item.note ? `<div class="payment-note">${esc(item.note)}</div>` : ''}
        <button class="payment-primary" type="button" data-payment-item="${esc(item.id)}">${esc(item.cta || 'Payer')}</button>
      </article>
    `).join('');
    box.querySelectorAll('[data-payment-item]').forEach(btn => {
      btn.addEventListener('click', () => startCheckout(btn.getAttribute('data-payment-item'), btn));
    });
  }

  async function startCheckout(itemId, btn){
    const item = state.items.find(x => String(x.id) === String(itemId));
    if(!item) return;
    if(btn) { btn.disabled = true; btn.textContent = 'Préparation…'; }
    try{
      const payload = {
        itemId: item.id,
        source: 'paiement.html',
        returnPath: 'paiement',
        userAgent: navigator.userAgent || ''
      };
      const data = await api('/checkout', { method:'POST', body: JSON.stringify(payload) });
      if(!data.redirectUrl) throw new Error('redirect_url_missing');
      window.location.href = data.redirectUrl;
    }catch(e){
      console.error('[FTS Paiement]', e);
      alert('Impossible de préparer le paiement. Vérifie la configuration du Worker HelloAsso.');
      if(btn) { btn.disabled = false; btn.textContent = item.cta || 'Payer'; }
    }
  }

  function setConfirmationMode(kind){
    const hero = document.querySelector('.payment-hero');
    if(!hero) return;
    const title = hero.querySelector('h1');
    const text = hero.querySelector('p');
    const security = hero.querySelector('.payment-security-line');
    if(kind === 'free'){
      if(title) title.textContent = 'Réservation confirmée';
      if(text) text.textContent = 'Votre réservation gratuite est enregistrée. Aucun paiement en ligne n’est nécessaire.';
      if(security) security.hidden = true;
    }else if(kind === 'offline'){
      if(title) title.textContent = 'Demande enregistrée';
      if(text) text.textContent = 'Votre commande est enregistrée. Le paiement sera remis à l’association.';
      if(security) security.hidden = true;
    }
  }

  async function handleReturn(){
    const params = new URLSearchParams(location.search);
    const orderId = params.get('orderId') || params.get('order') || params.get('localOrderId');
    const result = params.get('result') || params.get('status') || params.get('code');
    const panel = $('payment-status-panel');
    const box = $('payment-return-status');
    if(!panel || !box || (!orderId && !result)) return;
    panel.hidden = false;
    let html = '<div class="payment-status-pill pending">Vérification en cours</div><p>Vérification de votre réservation ou paiement.</p>';
    if(result === 'free') { setConfirmationMode('free'); html = '<div class="payment-status-pill pending">Confirmation en cours</div><p>Vérification de votre réservation gratuite.</p>'; }
    if(result === 'offline') { setConfirmationMode('offline'); html = '<div class="payment-status-pill pending">Confirmation en cours</div><p>Vérification de votre commande avec paiement hors ligne.</p>'; }
    box.innerHTML = html;
    if(orderId){
      try{
        const data = await api('/payment-status?orderId=' + encodeURIComponent(orderId), { method:'GET', optionalAuth:true });
        const order = data.order || {};
        const cls = statusClass(order.status);
        const status = String(order.status || '').toLowerCase();
        const globalStatus = String(order.globalPaymentStatus || '').toLowerCase();
        const itemName = order.itemName || order.itemTitle || 'Fais Ton Show';
        const seasonHtml = renderSeasonLines(order);
        const bridgeHtml = renderMemberBridge(order, orderId);
        let detail = '';
        if(status === 'free_confirmed' || globalStatus === 'free'){
          setConfirmationMode('free');
          detail = '<p>Aucun paiement en ligne n’est requis. Votre réservation est bien enregistrée.</p>';
        }else if(status === 'offline_pending' || globalStatus === 'offline_pending'){
          setConfirmationMode('offline');
          detail = '<p>Votre demande est enregistrée. Le règlement est à remettre à l’association.</p>';
          if(order.totalAmount || order.amountCents) detail += '<p><strong>Montant à régler : '+esc(formatEuros(order.totalAmount || order.amountCents))+'</strong></p>';
          if(order.offlineMethod) detail += '<p>Mode prévu : '+esc(order.offlineMethod)+'</p>';
        }else if(status === 'offline_received' || globalStatus === 'offline_received'){
          detail = '<p>Le paiement hors ligne a été marqué comme reçu par l’administration.</p>';
        }
        box.innerHTML = `<div class="payment-status-pill ${cls}">${esc(statusLabel(order.status))}</div><p>${esc(itemName)}</p>${detail}<small>Référence : ${esc(order.id || orderId)}</small>`;
        if(seasonHtml || bridgeHtml){
          box.innerHTML = `<div class="payment-status-pill ${cls}">${esc(statusLabel(order.status))}</div><p>${esc(itemName)}</p>${seasonHtml}${detail}<small>Reference : ${esc(order.id || orderId)}</small>${bridgeHtml}`;
        }
      }catch(e){
        if(result === 'free') box.innerHTML = '<div class="payment-status-pill pending">Réservation en cours de confirmation</div><p>La réservation gratuite a été demandée, mais le statut n’a pas pu être relu pour le moment.</p>';
        else if(result === 'offline') box.innerHTML = '<div class="payment-status-pill pending">Paiement hors ligne enregistré</div><p>La commande a été créée, mais le statut n’a pas pu être relu pour le moment.</p>';
        else box.innerHTML = '<div class="payment-status-pill pending">Paiement en attente</div><p>Le retour a bien été reçu. Le statut sera mis à jour dès que HelloAsso aura confirmé le paiement.</p>';
      }
    }
  }

  async function initPaymentPage(){
    const params = new URLSearchParams(location.search);
    const hasReturnOrder = !!(params.get('orderId') || params.get('order') || params.get('localOrderId') || params.get('result') || params.get('status') || params.get('code'));
    await handleReturn();
    if(hasReturnOrder){ hideGuard(); const itemsPanel = $('payment-items-panel'); if(itemsPanel) itemsPanel.hidden = true; return; }
    if(!state.user){ setGuard('Connexion nécessaire', 'Connectez-vous à votre compte Fais Ton Show pour accéder au paiement.'); return; }
    if(!canSeePayments()){
      setGuard('Paiement indisponible', 'Le paiement en ligne sera affiché ici lorsqu’il sera ouvert aux membres concernés.');
      return;
    }
    hideGuard();
    renderItems();
  }

  function renderAdminRows(orders){
    const box = $('payment-admin-list');
    if(!box) return;
    if(!orders || !orders.length){
      box.innerHTML = '<div class="payment-empty">Aucune commande trouvée pour le moment.</div>';
      return;
    }
    box.innerHTML = orders.map(o => {
      const cls = statusClass(o.status);
      const date = o.createdAt ? new Date(Number(o.createdAt)).toLocaleString('fr-FR') : 'Date inconnue';
      return `<div class="payment-admin-row">
        <div><strong>${esc(o.itemName || o.itemTitle || 'Paiement Fais Ton Show')}</strong><span>${esc(o.userName || o.userEmail || o.uid || '')}</span><small>${esc(o.id || '')} · ${esc(date)}</small></div>
        <div><span class="payment-status-pill ${cls}">${esc(statusLabel(o.status))}</span><small>${formatEuros(o.amountCents)}</small></div>
      </div>`;
    }).join('');
  }

  async function loadAdminOrders(){
    const box = $('payment-admin-list');
    if(box) box.innerHTML = '<div class="payment-empty">Chargement des commandes…</div>';
    try{
      const data = await api('/admin/orders?limit=80', { method:'GET' });
      renderAdminRows(data.orders || []);
    }catch(e){
      console.error('[FTS Paiements admin]', e);
      if(box) box.innerHTML = '<div class="payment-empty">Impossible de charger les paiements. Vérifie le Worker et les droits admin.</div>';
    }
  }

  async function initAdminPage(){
    if(!state.user){ setGuard('Connexion nécessaire', 'Connectez-vous à votre compte administrateur.'); return; }
    if(!isAdmin()){
      setGuard('Accès réservé', 'Cette page est réservée à l’administration Fais Ton Show.');
      return;
    }
    hideGuard();
    const panel = $('payment-admin-panel');
    if(panel) panel.hidden = false;
    const refresh = $('payment-admin-refresh');
    if(refresh && !refresh.__bound){ refresh.__bound = true; refresh.addEventListener('click', loadAdminOrders); }
    await loadAdminOrders();
  }

  function boot(){
    if(!window.firebase || !FTS.initFirebase){
      setGuard('Configuration manquante', 'Firebase n’est pas chargé correctement.');
      return;
    }
    const db = FTS.initFirebase();
    firebase.auth().onAuthStateChanged(async user => {
      state.user = user || null;
      state.profile = null;
      if(user){
        const snap = await db.ref('fts_users/' + user.uid).once('value').catch(() => null);
        state.profile = snap && snap.val ? (snap.val() || {}) : {};
      }
      const isAdminPage = /paiements-admin\.html(?:$|\?)/.test(location.pathname);
      if(isAdminPage) initAdminPage(); else initPaymentPage();
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
