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
    const token = await getToken(false);
    const res = await fetch(WORKER_URL + path, Object.assign({
      method:'GET',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + token }
    }, options || {}));
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
        returnPath: 'paiement.html',
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

  async function handleReturn(){
    const params = new URLSearchParams(location.search);
    const orderId = params.get('orderId') || params.get('order') || params.get('localOrderId');
    const result = params.get('result') || params.get('status') || params.get('code');
    const panel = $('payment-status-panel');
    const box = $('payment-return-status');
    if(!panel || !box || (!orderId && !result)) return;
    panel.hidden = false;
    let html = '<div class="payment-status-pill pending">Vérification en cours</div><p>Vérification de votre réservation ou paiement.</p>';
    if(result === 'free') html = '<div class="payment-status-pill pending">Confirmation en cours</div><p>Vérification de votre réservation gratuite.</p>';
    if(result === 'offline') html = '<div class="payment-status-pill pending">Confirmation en cours</div><p>Vérification de votre commande avec paiement hors ligne.</p>';
    box.innerHTML = html;
    if(orderId){
      try{
        const data = await api('/payment-status?orderId=' + encodeURIComponent(orderId), { method:'GET' });
        const order = data.order || {};
        const cls = statusClass(order.status);
        const status = String(order.status || '').toLowerCase();
        const globalStatus = String(order.globalPaymentStatus || '').toLowerCase();
        const itemName = order.itemName || order.itemTitle || 'Fais Ton Show';
        let detail = '';
        if(status === 'free_confirmed' || globalStatus === 'free'){
          detail = '<p>Aucun paiement en ligne n’est requis. Votre réservation est bien enregistrée.</p>';
        }else if(status === 'offline_pending' || globalStatus === 'offline_pending'){
          detail = '<p>Votre demande est enregistrée. Le règlement est à remettre à l’association.</p>';
          if(order.totalAmount || order.amountCents) detail += '<p><strong>Montant à régler : '+esc(formatEuros(order.totalAmount || order.amountCents))+'</strong></p>';
          if(order.offlineMethod) detail += '<p>Mode prévu : '+esc(order.offlineMethod)+'</p>';
        }else if(status === 'offline_received' || globalStatus === 'offline_received'){
          detail = '<p>Le paiement hors ligne a été marqué comme reçu par l’administration.</p>';
        }
        box.innerHTML = `<div class="payment-status-pill ${cls}">${esc(statusLabel(order.status))}</div><p>${esc(itemName)}</p>${detail}<small>Référence : ${esc(order.id || orderId)}</small>`;
      }catch(e){
        if(result === 'free') box.innerHTML = '<div class="payment-status-pill pending">Réservation en cours de confirmation</div><p>La réservation gratuite a été demandée, mais le statut n’a pas pu être relu pour le moment.</p>';
        else if(result === 'offline') box.innerHTML = '<div class="payment-status-pill pending">Paiement hors ligne enregistré</div><p>La commande a été créée, mais le statut n’a pas pu être relu pour le moment.</p>';
        else box.innerHTML = '<div class="payment-status-pill pending">Paiement en attente</div><p>Le retour a bien été reçu. Le statut sera mis à jour dès que HelloAsso aura confirmé le paiement.</p>';
      }
    }
  }

  async function initPaymentPage(){
    await handleReturn();
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
