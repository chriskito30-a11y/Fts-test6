/* ================================================================
   FTS — Ventes & inscriptions admin
   Lecture seule des commandes existantes RTDB.
   Ne modifie aucune commande, aucun paiement, aucun membre.
   ================================================================ */
(function(window){
  'use strict';

  const FTS = window.FTS = window.FTS || {};
  let db = null;
  let currentUser = null;
  let profile = null;
  let orders = [];
  let activeTab = 'groups';

  const $ = id => document.getElementById(id);
  const esc = v => FTS.esc ? FTS.esc(v == null ? '' : v) : String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const norm = v => String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const cents = v => Number(v || 0);
  const euro = v => (cents(v) / 100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
  const dateLabel = ts => ts ? new Date(Number(ts)).toLocaleString('fr-FR') : 'Date inconnue';

  function typeLabel(type){
    const t = String(type || '').toLowerCase();
    if(t === 'season_registration') return 'Inscription saison';
    if(t === 'event_ticket') return 'Place spectacle / événement';
    if(t === 'stage_registration') return 'Stage';
    if(t === 'shop_order') return 'Boutique';
    if(t === 'membership') return 'Adhésion';
    if(t === 'one_off') return 'Ponctuel';
    return type || 'Paiement';
  }
  function statusKind(status){
    const s = norm(status || '');
    if(['paid','authorized','validated','success','confirmed','succeeded'].includes(s)) return 'paid';
    if(['refused','failed','error','canceled','cancelled','abandoned','contested','refunded'].includes(s)) return 'refused';
    return 'pending';
  }
  function statusLabel(status){
    const k = statusKind(status);
    if(k === 'paid') return 'Validé';
    if(k === 'refused') return 'Refusé / annulé';
    return 'En attente';
  }
  function installmentKind(status){
    const s = norm(status || '');
    if(['paid','authorized','validated','success','confirmed','succeeded'].includes(s)) return 'paid';
    if(['refused','failed','error','canceled','cancelled','contested'].includes(s)) return 'refused';
    if(['scheduled','pending','initial_pending'].includes(s)) return s === 'scheduled' ? 'scheduled' : 'pending';
    return 'pending';
  }
  function payerName(o){
    const p = o.payer || {};
    return o.userName || [p.firstName, p.lastName].filter(Boolean).join(' ') || o.payerName || o.userEmail || o.uid || 'Payeur inconnu';
  }
  function payerEmail(o){ return o.userEmail || (o.payer && o.payer.email) || o.email || ''; }
  function studentName(o){ return o.studentName || o.beneficiaryName || o.memberName || o.childName || payerName(o); }
  function amount(o){ return cents(o.totalAmount || o.totalAmountCents || o.amountCents || o.amount || 0); }
  function paidAmount(o){ return cents(o.paidAmount || (statusKind(o.status)==='paid' ? amount(o) : 0)); }
  function remainingAmount(o){
    if(o.remainingAmount != null) return cents(o.remainingAmount);
    return Math.max(0, amount(o) - paidAmount(o));
  }
  function installmentSummary(o){
    const list = Array.isArray(o.installments) ? o.installments : [];
    if(!list.length) return {total: statusKind(o.status)==='paid' ? 1 : 0, paid: statusKind(o.status)==='paid' ? 1 : 0, pending: statusKind(o.status)==='pending' ? 1 : 0, refused: statusKind(o.status)==='refused' ? 1 : 0, remaining: statusKind(o.status)==='paid' ? 0 : 1};
    let paid=0,pending=0,refused=0;
    list.forEach(x=>{ const k=installmentKind(x.status); if(k==='paid') paid++; else if(k==='refused') refused++; else pending++; });
    return {total:list.length, paid, pending, refused, remaining:Math.max(0, list.length - paid - refused)};
  }
  function groupKey(o){
    const type = String(o.type || 'payment');
    if(type === 'season_registration'){
      return [o.season || 'Saison non renseignée', o.activityName || o.activityId || 'Activité non renseignée', o.subcategoryName || o.subcategoryId || 'Groupe non renseigné'].join('||');
    }
    if(type === 'event_ticket') return ['Événements', o.eventTitle || o.eventName || o.itemName || 'Événement non renseigné'].join('||');
    if(type === 'stage_registration') return ['Stages', o.stageTitle || o.stageName || o.itemName || 'Stage non renseigné'].join('||');
    if(type === 'shop_order') return ['Boutique', o.productName || o.itemName || 'Article non renseigné'].join('||');
    if(type === 'membership') return ['Adhésions', o.season || 'Saison non renseignée'].join('||');
    if(type === 'one_off') return ['Ponctuel', o.itemName || o.label || 'Paiement ponctuel'].join('||');
    return ['Autres paiements', typeLabel(type)].join('||');
  }
  function groupTitleFromKey(key){
    const parts = String(key).split('||');
    if(parts.length >= 3) return {main: parts[1], sub: parts[0] + ' · ' + parts[2], icon:'🎭'};
    return {main: parts[1] || parts[0], sub: parts[0], icon:'🎫'};
  }

  function filteredOrders(){
    const q = norm(($('sales-search') && $('sales-search').value) || '');
    const type = ($('sales-type') && $('sales-type').value) || 'all';
    const status = ($('sales-status') && $('sales-status').value) || 'all';
    const season = ($('sales-season') && $('sales-season').value) || 'all';
    return orders.filter(o=>{
      if(type !== 'all' && String(o.type || '') !== type) return false;
      if(status !== 'all' && statusKind(o.status) !== status) return false;
      if(season !== 'all' && String(o.season || '') !== season) return false;
      if(q){
        const hay = norm([o.id,o.itemName,o.activityName,o.subcategoryName,o.offerLabel,o.eventTitle,o.stageTitle,o.productName,studentName(o),payerName(o),payerEmail(o)].join(' '));
        if(!hay.includes(q)) return false;
      }
      return true;
    }).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  }

  function renderStats(list){
    const paid = list.filter(o=>statusKind(o.status)==='paid');
    const pending = list.filter(o=>statusKind(o.status)==='pending');
    const refused = list.filter(o=>statusKind(o.status)==='refused');
    const revenue = paid.reduce((sum,o)=>sum + paidAmount(o), 0);
    const html = [
      ['Commandes', list.length, 'Tous statuts'],
      ['Validées', paid.length, euro(revenue)],
      ['En attente', pending.length, euro(pending.reduce((s,o)=>s+remainingAmount(o),0)) + ' restant'],
      ['Refusées / annulées', refused.length, 'À vérifier']
    ].map(x=>`<article class="sales-stat"><strong>${esc(x[1])}</strong><span>${esc(x[0])} · ${esc(x[2])}</span></article>`).join('');
    $('sales-stats').innerHTML = html;
  }

  function renderGroups(list){
    const groups = new Map();
    list.forEach(o=>{
      const key = groupKey(o);
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    });
    if(!groups.size){ $('sales-groups').innerHTML = '<div class="sales-empty">Aucune commande ne correspond aux filtres.</div>'; return; }
    $('sales-groups').innerHTML = Array.from(groups.entries()).map(([key,rows])=>{
      const t = groupTitleFromKey(key);
      const paid = rows.filter(o=>statusKind(o.status)==='paid');
      const pending = rows.filter(o=>statusKind(o.status)==='pending');
      const refused = rows.filter(o=>statusKind(o.status)==='refused');
      const revenue = paid.reduce((sum,o)=>sum+paidAmount(o),0);
      return `<details class="sales-group" open>
        <summary>
          <div class="sales-group-title"><div class="sales-group-ico">${esc(t.icon)}</div><div><h2>${esc(t.main)}</h2><p>${esc(t.sub)}</p></div></div>
          <div class="sales-badges"><span class="sales-badge ok">${paid.length} validé(s)</span><span class="sales-badge wait">${pending.length} attente</span><span class="sales-badge bad">${refused.length} refusé(s)</span><span class="sales-badge money">${euro(revenue)}</span></div>
        </summary>
        <div class="sales-table">${rows.map(renderCompactRow).join('')}</div>
      </details>`;
    }).join('');
  }
  function renderCompactRow(o){
    const sum = installmentSummary(o);
    return `<div class="sales-row">
      <div><strong>${esc(studentName(o))}</strong><small>${esc(payerName(o))}${payerEmail(o)?' · '+esc(payerEmail(o)):''}</small></div>
      <div><strong>${esc(o.offerLabel || typeLabel(o.type))}</strong><small>${esc(o.paymentPlan || '')}${sum.total>1?' · '+sum.remaining+' échéance(s) restante(s)':''}</small></div>
      <div><span class="sales-status ${statusKind(o.status)}">${esc(statusLabel(o.status))}</span><small>${esc(o.id || '')}</small></div>
      <div><strong>${euro(amount(o))}</strong><small>${esc(dateLabel(o.createdAt))}</small></div>
    </div>`;
  }
  function renderOrders(list){
    if(!list.length){ $('sales-orders').innerHTML = '<div class="sales-empty">Aucune commande ne correspond aux filtres.</div>'; return; }
    $('sales-orders').innerHTML = list.map(o=>{
      const sum = installmentSummary(o);
      const inst = Array.isArray(o.installments) ? o.installments.map(x=>`<span class="sales-installment ${installmentKind(x.status)}">#${esc(x.number||'?')} · ${euro(x.amount)} · ${esc(x.date||'')} · ${esc(x.status||'')}</span>`).join('') : '';
      return `<article class="sales-order-card">
        <div class="sales-order-head"><div><div class="sales-order-title">${esc(o.itemName || typeLabel(o.type))}</div><div class="sales-order-meta">${esc(o.id || '')} · ${esc(dateLabel(o.createdAt))}</div></div><span class="sales-status ${statusKind(o.status)}">${esc(statusLabel(o.status))}</span></div>
        <div class="sales-order-grid">
          <div class="sales-mini"><span>Payeur</span><strong>${esc(payerName(o))}</strong><small>${esc(payerEmail(o))}</small></div>
          <div class="sales-mini"><span>Pour</span><strong>${esc(studentName(o))}</strong><small>${esc([o.activityName,o.subcategoryName,o.offerLabel].filter(Boolean).join(' · '))}</small></div>
          <div class="sales-mini"><span>Montants</span><strong>${euro(amount(o))}</strong><small>Payé : ${euro(paidAmount(o))} · Restant : ${euro(remainingAmount(o))}</small></div>
          <div class="sales-mini"><span>Échéances</span><strong>${sum.paid}/${sum.total} payée(s)</strong><small>${sum.remaining} restante(s) · ${sum.refused} refusée(s)</small></div>
          <div class="sales-mini"><span>Type</span><strong>${esc(typeLabel(o.type))}</strong><small>${esc(o.source || '')}</small></div>
          <div class="sales-mini"><span>HelloAsso</span><strong>${esc(o.helloAssoPaymentId || o.checkoutIntentId || '—')}</strong><small>${esc(o.provider || '')}</small></div>
        </div>
        ${inst ? `<div class="sales-installment-list">${inst}</div>` : ''}
      </article>`;
    }).join('');
  }
  function renderInstallments(list){
    const rows = [];
    list.forEach(o=>{
      const inst = Array.isArray(o.installments) ? o.installments : [];
      inst.forEach(x=>rows.push({order:o, installment:x}));
    });
    if(!rows.length){ $('sales-installments').innerHTML = '<div class="sales-empty">Aucune échéance détaillée enregistrée pour les commandes filtrées.</div>'; return; }
    rows.sort((a,b)=>String(a.installment.date||'').localeCompare(String(b.installment.date||'')) || Number(a.installment.number||0)-Number(b.installment.number||0));
    $('sales-installments').innerHTML = `<div class="sales-table">${rows.map(({order:o,installment:x})=>`<div class="sales-row"><div><strong>${esc(studentName(o))}</strong><small>${esc(o.activityName || typeLabel(o.type))} · ${esc(o.subcategoryName || '')}</small></div><div><strong>Échéance #${esc(x.number || '?')}</strong><small>${esc(x.date || 'Date inconnue')}</small></div><div><span class="sales-status ${installmentKind(x.status)==='paid'?'paid':installmentKind(x.status)==='refused'?'refused':'pending'}">${esc(x.status || 'en attente')}</span><small>${esc(o.paymentPlan || '')}</small></div><div><strong>${euro(x.amount)}</strong><small>${esc(o.id || '')}</small></div></div>`).join('')}</div>`;
  }
  function renderAll(){
    const list = filteredOrders();
    renderStats(list);
    renderGroups(list);
    renderOrders(list);
    renderInstallments(list);
  }
  function fillSeasons(){
    const select = $('sales-season'); if(!select) return;
    const current = select.value || 'all';
    const seasons = [...new Set(orders.map(o=>String(o.season||'').trim()).filter(Boolean))].sort().reverse();
    select.innerHTML = '<option value="all">Toutes</option>' + seasons.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if(seasons.includes(current)) select.value = current;
  }
  async function loadOrders(){
    const snap = await db.ref('fts_orders').once('value');
    const rows = [];
    if(snap.exists()) snap.forEach(child=>rows.push(Object.assign({id:child.key}, child.val() || {})));
    orders = rows;
    fillSeasons();
    renderAll();
  }
  function bindUi(){
    ['sales-search','sales-type','sales-status','sales-season'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('input', renderAll); if(el) el.addEventListener('change', renderAll); });
    const refresh = $('sales-refresh'); if(refresh) refresh.addEventListener('click', loadOrders);
    const exportBtn = $('sales-export'); if(exportBtn) exportBtn.addEventListener('click', exportCsv);
    document.querySelectorAll('[data-sales-tab]').forEach(btn=>btn.addEventListener('click',()=>{
      activeTab = btn.getAttribute('data-sales-tab') || 'groups';
      document.querySelectorAll('[data-sales-tab]').forEach(b=>b.classList.toggle('active', b===btn));
      ['groups','orders','installments'].forEach(name=>{ const el=$('sales-'+name); if(el) el.hidden = name !== activeTab; });
    }));
  }
  function exportCsv(){
    const rows = filteredOrders();
    const head = ['reference','type','statut','saison','activite','groupe','formule','eleve','payeur','email','plan','montant','paye','restant','echeances_total','echeances_payees','echeances_restantes','echeances_refusees','date_creation'];
    const lines = [head.join(';')];
    rows.forEach(o=>{
      const sum = installmentSummary(o);
      const row = [o.id,o.type,statusLabel(o.status),o.season,o.activityName,o.subcategoryName,o.offerLabel,studentName(o),payerName(o),payerEmail(o),o.paymentPlan,amount(o)/100,paidAmount(o)/100,remainingAmount(o)/100,sum.total,sum.paid,sum.remaining,sum.refused,dateLabel(o.createdAt)];
      lines.push(row.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(';'));
    });
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fts-ventes-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function fail(msg){ const e=$('sales-error'); if(e) e.textContent=msg; }
  function boot(){
    if(!window.firebase || !FTS.initFirebase){ fail('Firebase indisponible.'); return; }
    db = FTS.initFirebase();
    firebase.auth().onAuthStateChanged(async user=>{
      currentUser = user || null;
      if(!currentUser){ location.href='auth.html'; return; }
      try{
        const snap = await db.ref('fts_users/' + currentUser.uid).once('value');
        profile = snap.val() || {};
        if(String(profile.role||'').toLowerCase() !== 'admin'){ location.href='membres.html'; return; }
        $('sales-loading').style.display='none';
        $('sales-shell').hidden=false;
        bindUi();
        await loadOrders();
      }catch(e){ console.warn('[FTS ventes admin]', e); fail('Impossible de charger les ventes. Vérifie les droits admin.'); }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
