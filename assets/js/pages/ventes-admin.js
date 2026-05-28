/* ================================================================
   FTS — Ventes & inscriptions admin
   Vue pilotage lisible : types > activités > sous-groupes > personnes.
   Lecture admin. La suppression retire uniquement les commandes locales sélectionnées de fts_orders.
   ================================================================ */
(function(window){
  'use strict';

  const FTS = window.FTS = window.FTS || {};
  let db = null;
  let currentUser = null;
  let profile = null;
  let orders = [];
  let activeTab = 'groups';
  const selectedOrderIds = new Set();

  const $ = id => document.getElementById(id);
  const esc = v => FTS.esc ? FTS.esc(v == null ? '' : v) : String(v == null ? '' : v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const norm = v => String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const cents = v => Number(v || 0);
  const euro = v => (cents(v) / 100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
  const dateLabel = ts => ts ? new Date(Number(ts)).toLocaleString('fr-FR') : 'Date inconnue';
  const shortDate = ts => ts ? new Date(Number(ts)).toLocaleDateString('fr-FR') : '—';

  const TYPE_ORDER = ['mixed_cart','season_registration','event_ticket','stage_registration','shop_order','membership','one_off','other'];
  const TYPE_META = {
    mixed_cart:{label:'Paniers mixtes', icon:'🧺', hint:'Inscriptions + boutique en paiement groupé'},
    season_registration:{label:'Inscriptions saison', icon:'🎭', hint:'Activités, formules et sous-groupes'},
    event_ticket:{label:'Spectacles / événements', icon:'🎟️', hint:'Billetterie et réservations'},
    stage_registration:{label:'Stages', icon:'🚀', hint:'Inscriptions aux stages'},
    shop_order:{label:'Boutique', icon:'🛍️', hint:'Goodies, tenues et articles'},
    membership:{label:'Adhésions', icon:'🤝', hint:'Adhésions simples'},
    one_off:{label:'Ponctuel', icon:'✨', hint:'Costumes, frais ou paiements divers'},
    other:{label:'Autres paiements', icon:'💳', hint:'Commandes non classées'}
  };

  function typeKey(o){
    const t = String(o.type || '').trim();
    return TYPE_META[t] ? t : 'other';
  }
  function typeLabel(type){ return (TYPE_META[type] && TYPE_META[type].label) || type || 'Paiement'; }
  function typeIcon(type){ return (TYPE_META[type] && TYPE_META[type].icon) || '💳'; }
  function statusKind(status){
    const s = norm(status || '');
    if(['paid','authorized','validated','success','confirmed','succeeded','free_confirmed','offline_received'].includes(s)) return 'paid';
    if(['refused','failed','error','canceled','cancelled','abandoned','contested','refunded'].includes(s)) return 'refused';
    if(['offline_pending'].includes(s)) return 'pending';
    return 'pending';
  }
  function statusLabel(status){
    const s = norm(status || '');
    if(s === 'free_confirmed') return 'Gratuit confirmé';
    if(s === 'offline_pending') return 'Paiement à recevoir';
    if(s === 'offline_received') return 'Paiement reçu';
    const k = statusKind(status);
    if(k === 'paid') return 'Validé';
    if(k === 'refused') return 'Refusé / annulé';
    return 'En attente';
  }
  function normalizeOrderStatus(o){
    if(!o || typeof o !== 'object') return o;
    const status = norm(o.status || '');
    const global = norm(o.globalPaymentStatus || '');
    if((!status || status === 'pending') && (o.freeConfirmed === true || global === 'free' || o.freeReason)){
      o.status = 'free_confirmed';
      o.globalPaymentStatus = o.globalPaymentStatus || 'free';
      o.provider = o.provider || 'none';
      o.paidAmount = 0;
      o.remainingAmount = 0;
    }
    if((!status || status === 'pending') && (o.offlinePayment === true || global === 'offline_pending')){
      o.status = 'offline_pending';
      o.globalPaymentStatus = o.globalPaymentStatus || 'offline_pending';
      o.provider = o.provider || 'offline';
    }
    if(global === 'offline_received') o.status = 'offline_received';
    return o;
  }
  function installmentKind(status){
    const s = norm(status || '');
    if(['paid','authorized','validated','success','confirmed','succeeded','free_confirmed','offline_received'].includes(s)) return 'paid';
    if(['refused','failed','error','canceled','cancelled','contested'].includes(s)) return 'refused';
    if(['scheduled','pending','initial_pending','offline_pending'].includes(s)) return s === 'scheduled' ? 'scheduled' : 'pending';
    return 'pending';
  }
  function payerName(o){
    const p = o.payer || {};
    return o.userName || [p.firstName, p.lastName].filter(Boolean).join(' ') || o.payerName || o.userEmail || o.uid || 'Payeur inconnu';
  }
  function payerEmail(o){ return o.userEmail || (o.payer && o.payer.email) || o.email || ''; }
  function payerPhone(o){ const p=o.payer||{}; return o.payerPhone || p.phone || p.tel || p.telephone || o.phone || o.tel || ''; }
  function emergencyPhone(o){ return o.emergencyPhone || o.emergencyContactPhone || (o.student && (o.student.emergencyPhone || o.student.emergencyContactPhone)) || ''; }
  function participantFirstName(o){ return o.studentFirstName || o.participantFirstName || ''; }
  function participantLastName(o){ return o.studentLastName || o.participantLastName || ''; }
  function studentName(o){ return [participantFirstName(o), participantLastName(o)].filter(Boolean).join(' ') || o.studentName || o.participantName || o.beneficiaryName || o.memberName || o.childName || payerName(o); }
  function variantInfo(o){
    if(o.variantLabel) return o.variantLabel;
    if(o.variants && typeof o.variants === 'object') return Object.entries(o.variants).map(([k,v])=>`${k}: ${v}`).join(' · ');
    return '';
  }
  function offerTokenLabel(t){ return ({loisir:'Loisir',perf:'Performance',performance:'Performance',option:'Option',inclus:'Inclus'}[String(t||'').toLowerCase()] || t); }
  function subcategoryAllowedOffersLabel(o){
    const raw = Array.isArray(o.subcategoryAllowedOffers) ? o.subcategoryAllowedOffers : [];
    return raw.length ? raw.map(offerTokenLabel).join(' + ') : '';
  }
  function subcategoryDetail(o){
    const direct = String(o.subcategorySeasonDetail || '').trim();
    if(direct) return direct;
    return [o.subcategoryDay, o.subcategoryTime, o.subcategoryLevel, o.subcategoryAge, o.subcategoryNote].map(x=>String(x||'').trim()).filter(Boolean).join(' · ');
  }
  function subgroupKey(o){
    const name = o.subcategoryName || o.subcategoryTitle || o.subcategoryId || 'Groupe non renseigné';
    const detail = subcategoryDetail(o);
    return detail ? `${name} — ${detail}` : name;
  }
  function subcategoryMaxSeats(o){
    return Math.max(0, Number(o.subcategoryMaxSeats || o.subcategoryCapacity || o.subcategoryPlacesMax || 0) || 0);
  }
  function reservedSeasonSeats(list){
    return list.filter(o=>statusKind(o.status)!=='refused').reduce((sum,o)=>sum + Math.max(1, Number(o.quantity || 1) || 1), 0);
  }
  function maxSeatsForRows(list){
    return list.reduce((max,o)=>Math.max(max, subcategoryMaxSeats(o)), 0);
  }
  function cartSeasonLines(o){ return Array.isArray(o && o.cartLines) ? o.cartLines.filter(l=>l && l.type === 'season_registration') : []; }
  function cartShopLines(o){ return Array.isArray(o && o.cartLines) ? o.cartLines.filter(l=>l && l.type === 'shop_order') : []; }
  function lineStudentName(line, parent){ return [line && line.studentFirstName, line && line.studentLastName].filter(Boolean).join(' ') || (line && line.studentName) || studentName(parent || {}); }
  function lineSubcategoryDetail(line){
    const direct = String(line && line.subcategorySeasonDetail || '').trim();
    if(direct) return direct;
    return [line && line.subcategoryDay, line && line.subcategoryTime, line && line.subcategoryLevel, line && line.subcategoryAge, line && line.subcategoryNote].map(x=>String(x||'').trim()).filter(Boolean).join(' · ');
  }
  function lineGroupName(line){ return (line && (line.subcategoryTitle || line.subcategoryName || line.subcategoryId)) || 'Groupe non renseigné'; }
  function lineSubgroupKey(line){ const detail = lineSubcategoryDetail(line); const name = lineGroupName(line); return detail ? `${name} — ${detail}` : name; }
  function lineOfferLabel(line){ return (line && line.offerLabel) || offerTokenLabel(line && line.offerKey) || ''; }
  function lineActivityLabel(line){ return (line && (line.activityName || line.activityId)) || 'Activité non renseignée'; }
  function lineAmount(line){ return cents(line && line.amountCents || 0); }
  function cartLinesDetailedLabel(o){
    const lines = Array.isArray(o && o.cartLines) ? o.cartLines : [];
    return lines.map(l=>{
      if(l.type === 'season_registration') return [lineStudentName(l,o), lineActivityLabel(l), lineGroupName(l), lineOfferLabel(l)].filter(Boolean).join(' · ');
      if(l.type === 'shop_order') return [l.productName || l.itemName || 'Article boutique', l.variantLabel, l.quantity ? 'Qté ' + l.quantity : ''].filter(Boolean).join(' · ');
      return l.itemName || l.type || '';
    }).filter(Boolean).join(' + ');
  }
  function cartLinesLabel(o){ const lines=Array.isArray(o.cartLines)?o.cartLines:[]; return lines.length?lines.map(l=>l.activityName||l.productName||l.itemName||l.type).filter(Boolean).join(' + '):''; }
  function renderCartLinesMini(o){
    const lines = Array.isArray(o && o.cartLines) ? o.cartLines : [];
    if(!lines.length) return '';
    return `<div class="sales-cart-lines">${lines.map(l=>{
      if(l.type === 'season_registration'){
        const title = [lineStudentName(l,o), lineActivityLabel(l)].filter(Boolean).join(' — ');
        const detail = [lineGroupName(l), lineSubcategoryDetail(l), lineOfferLabel(l), euro(lineAmount(l))].filter(Boolean).join(' · ');
        return `<div class="sales-cart-line season"><strong>${esc(title)}</strong><small>${esc(detail)}</small></div>`;
      }
      if(l.type === 'shop_order'){
        const title = l.productName || l.itemName || 'Article boutique';
        const detail = [l.variantLabel, l.quantity ? 'Qté ' + l.quantity : '', euro(lineAmount(l))].filter(Boolean).join(' · ');
        return `<div class="sales-cart-line shop"><strong>${esc(title)}</strong><small>${esc(detail)}</small></div>`;
      }
      return `<div class="sales-cart-line"><strong>${esc(l.itemName || l.type || 'Ligne')}</strong></div>`;
    }).join('')}</div>`;
  }
  function orderFromCartLine(parent, line){
    return Object.assign({}, parent, line, {
      id: parent.id,
      type: line.type || parent.type,
      parentType: parent.type,
      cartParentId: parent.id,
      status: parent.status,
      globalPaymentStatus: parent.globalPaymentStatus,
      provider: parent.provider,
      paymentPlan: parent.paymentPlan,
      payer: parent.payer,
      userName: parent.userName,
      userEmail: parent.userEmail,
      payerPhone: parent.payerPhone,
      installments: parent.installments,
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
      amountCents: line.amountCents || 0,
      totalAmount: line.amountCents || 0,
      paidAmount: statusKind(parent.status)==='paid' ? (line.amountCents || 0) : 0,
      remainingAmount: statusKind(parent.status)==='paid' ? 0 : (line.amountCents || 0),
      itemName: line.itemName || parent.itemName
    });
  }
  function itemLabel(o){ return cartLinesDetailedLabel(o) || o.itemName || o.eventTitle || o.stageTitle || o.productName || o.label || typeLabel(typeKey(o)); }
  function amount(o){ return cents(o.totalAmount || o.totalAmountCents || o.amountCents || o.amount || 0); }
  function paidAmount(o){
    const s = norm(o && o.status || '');
    if(s === 'free_confirmed') return 0;
    return cents(o.paidAmount || (statusKind(o.status)==='paid' ? amount(o) : 0));
  }
  function remainingAmount(o){
    const s = norm(o && o.status || '');
    if(s === 'free_confirmed' || s === 'offline_received') return 0;
    if(o.remainingAmount != null) return cents(o.remainingAmount);
    return Math.max(0, amount(o) - paidAmount(o));
  }
  function isShopPickedUp(o){
    return !!(o.shopPickedUpAt || o.pickedUpAt || (o.fulfillment && o.fulfillment.pickedUpAt) || String(o.fulfillmentStatus || '') === 'picked_up');
  }
  function shopTodoOrders(list){
    return list.filter(o=>typeKey(o)==='shop_order' && statusKind(o.status)==='paid' && !isShopPickedUp(o));
  }
  function installmentSummary(o){
    const list = Array.isArray(o.installments) ? o.installments : [];
    if(!list.length){
      return {
        total: statusKind(o.status)==='paid' || statusKind(o.status)==='pending' || statusKind(o.status)==='refused' ? 1 : 0,
        paid: statusKind(o.status)==='paid' ? 1 : 0,
        pending: statusKind(o.status)==='pending' ? 1 : 0,
        refused: statusKind(o.status)==='refused' ? 1 : 0,
        remaining: statusKind(o.status)==='paid' ? 0 : 1
      };
    }
    let paid=0,pending=0,refused=0;
    list.forEach(x=>{ const k=installmentKind(x.status); if(k==='paid') paid++; else if(k==='refused') refused++; else pending++; });
    return {total:list.length, paid, pending, refused, remaining:Math.max(0, list.length - paid - refused)};
  }
  function summarize(list){
    const paid = list.filter(o=>statusKind(o.status)==='paid');
    const pending = list.filter(o=>statusKind(o.status)==='pending');
    const refused = list.filter(o=>statusKind(o.status)==='refused');
    return {
      total:list.length,
      paid:paid.length,
      pending:pending.length,
      refused:refused.length,
      revenue:paid.reduce((sum,o)=>sum + paidAmount(o), 0),
      waitingAmount:pending.reduce((s,o)=>s + remainingAmount(o),0),
      remainingAmount:list.reduce((s,o)=>s + remainingAmount(o),0),
      remainingInstallments:list.reduce((s,o)=>s + installmentSummary(o).remaining,0),
      refusedInstallments:list.reduce((s,o)=>s + installmentSummary(o).refused,0)
    };
  }
  function byMap(list, keyFn){
    const m = new Map();
    list.forEach(x=>{ const k = keyFn(x) || 'Non renseigné'; if(!m.has(k)) m.set(k, []); m.get(k).push(x); });
    return m;
  }
  function sortAlphaEntries(entries){
    return entries.sort((a,b)=>String(a[0]).localeCompare(String(b[0]), 'fr', {numeric:true, sensitivity:'base'}));
  }
  function sortTypeEntries(entries){
    return entries.sort((a,b)=>TYPE_ORDER.indexOf(a[0]) - TYPE_ORDER.indexOf(b[0]));
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
        const hay = norm([o.id,o.itemName,o.activityName,o.subcategoryName,o.subcategorySeasonDetail,o.subcategoryDay,o.subcategoryTime,o.subcategoryLevel,o.subcategoryAge,o.subcategoryNote,o.offerLabel,o.eventTitle,o.stageTitle,o.productName,o.variantLabel,variantInfo(o),studentName(o),participantFirstName(o),participantLastName(o),payerName(o),payerEmail(o),payerPhone(o),emergencyPhone(o),o.paymentPlan,cartLinesDetailedLabel(o)].join(' '));
        if(!hay.includes(q)) return false;
      }
      return true;
    }).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  }

  function filteredOrderIds(){
    return filteredOrders().map(o=>String(o.id || '')).filter(Boolean);
  }
  function selectionCountLabel(count){
    return count + ' commande' + (count > 1 ? 's' : '') + ' sélectionnée' + (count > 1 ? 's' : '');
  }
  function updateBulkUi(){
    const bulk = $('sales-bulk');
    if(bulk) bulk.hidden = activeTab !== 'orders';
    const count = selectedOrderIds.size;
    const label = $('sales-selected-count');
    if(label) label.textContent = selectionCountLabel(count);
    const btn = $('sales-delete-selected');
    if(btn) btn.disabled = count < 1;
    const all = $('sales-select-all');
    if(all){
      const ids = filteredOrderIds();
      const selectedInFilter = ids.filter(id=>selectedOrderIds.has(id)).length;
      all.checked = ids.length > 0 && selectedInFilter === ids.length;
      all.indeterminate = selectedInFilter > 0 && selectedInFilter < ids.length;
      all.disabled = ids.length < 1;
    }
  }

  function metric(label, value, detail, cls=''){
    return `<article class="sales-stat ${cls}"><strong>${esc(value)}</strong><span>${esc(label)}${detail ? ' · ' + esc(detail) : ''}</span></article>`;
  }
  function renderStats(list){
    const s = summarize(list);
    $('sales-stats').innerHTML = [
      metric('Commandes', s.total, 'tous statuts'),
      metric('Validées', s.paid, euro(s.revenue), 'ok'),
      metric('En attente', s.pending, euro(s.waitingAmount) + ' restant', 'wait'),
      metric('Alertes', s.refused + s.refusedInstallments, 'refus / incidents', 'bad')
    ].join('');
  }

  function badgesFor(list){
    const s = summarize(list);
    return `<div class="sales-badges">
      <span class="sales-badge ok">${s.paid} payé(s)</span>
      <span class="sales-badge wait">${s.pending} attente</span>
      <span class="sales-badge bad">${s.refused} refusé(s)</span>
      <span class="sales-badge money">${euro(s.revenue)}</span>
    </div>`;
  }
  function orderPersonLine(o){
    const sum = installmentSummary(o);
    const payText = sum.total > 1 ? `${sum.paid}/${sum.total} échéance(s) payée(s) · ${sum.remaining} restante(s)${sum.refused ? ' · ' + sum.refused + ' refusée(s)' : ''}` : (statusKind(o.status)==='paid' ? 'Paiement complet' : 'Paiement non finalisé');
    return `<details class="sales-person">
      <summary>
        <div class="sales-person-main"><strong>${esc(studentName(o))}</strong><small>${esc(o.offerLabel || typeLabel(typeKey(o)))}${o.paymentPlan ? ' · ' + esc(o.paymentPlan) : ''}</small></div>
        <div class="sales-person-pay"><span class="sales-status ${statusKind(o.status)}">${esc(statusLabel(o.status))}</span><strong>${euro(amount(o))}</strong></div>
      </summary>
      <div class="sales-person-body">
        ${Array.isArray(o.cartLines)&&o.cartLines.length?`<div><span>Détail panier</span><strong>${esc(o.cartLines.length+' ligne(s)')}</strong><small>${esc(cartLinesDetailedLabel(o) || cartLinesLabel(o))}</small></div>${renderCartLinesMini(o)}`:''}${subcategoryDetail(o)?`<div><span>Détail groupe</span><strong>${esc(o.subcategoryTitle || o.subcategoryName || 'Groupe')}</strong><small>${esc(subcategoryDetail(o))}</small></div>`:''}
        ${subcategoryMaxSeats(o)>0?`<div><span>Places groupe</span><strong>${esc(String(subcategoryMaxSeats(o)))} places max</strong><small>Limite enregistrée au moment de la commande</small></div>`:''}
        ${subcategoryAllowedOffersLabel(o)?`<div><span>Formules autorisées</span><strong>${esc(subcategoryAllowedOffersLabel(o))}</strong><small>Règle enregistrée au moment du paiement</small></div>`:''}
        <div><span>Payeur</span><strong>${esc(payerName(o))}</strong><small>${esc([payerEmail(o), payerPhone(o)].filter(Boolean).join(' · '))}</small></div>
        ${emergencyPhone(o)?`<div><span>Urgence</span><strong>${esc(emergencyPhone(o))}</strong><small>Téléphone d’urgence</small></div>`:''}
        <div><span>Échéances</span><strong>${esc(payText)}</strong><small>Payé : ${euro(paidAmount(o))} · Restant : ${euro(remainingAmount(o))}</small></div>
        <div><span>Référence</span><strong>${esc(o.id || '—')}</strong><small>${esc(shortDate(o.createdAt))} · ${esc(o.helloAssoPaymentId || o.checkoutIntentId || '')}</small></div>
      </div>
    </details>`;
  }

  function renderSeasonType(list){
    const seasons = sortAlphaEntries(Array.from(byMap(list, o=>o.season || 'Saison non renseignée').entries())).reverse();
    return seasons.map(([season, seasonRows])=>{
      const activities = sortAlphaEntries(Array.from(byMap(seasonRows, o=>o.activityName || o.activityId || 'Activité non renseignée').entries()));
      return `<section class="sales-season-block">
        <div class="sales-section-head"><div><h2>${esc(season)}</h2><p>Vue par activité puis par sous-groupe.</p></div>${badgesFor(seasonRows)}</div>
        <div class="sales-activity-grid">
          ${activities.map(([activity, activityRows])=>renderActivityCard(activity, activityRows)).join('')}
        </div>
      </section>`;
    }).join('');
  }
  function renderActivityCard(activity, rows){
    const subgroups = sortAlphaEntries(Array.from(byMap(rows, subgroupKey).entries()));
    const s = summarize(rows);
    return `<article class="sales-activity-card">
      <header><div><h3>${esc(activity)}</h3><p>${s.paid} confirmé(s) · ${s.pending} attente · ${euro(s.revenue)}</p></div><span>${esc(typeIcon('season_registration'))}</span></header>
      <div class="sales-subgroups">
        ${subgroups.map(([group, groupRows], index)=>renderSubgroup(group, groupRows, index === 0 && subgroups.length === 1)).join('')}
      </div>
    </article>`;
  }
  function renderSubgroup(group, rows, open){
    const s = summarize(rows);
    const paidRows = rows.filter(o=>statusKind(o.status)==='paid');
    const pendingRows = rows.filter(o=>statusKind(o.status)==='pending');
    const refusedRows = rows.filter(o=>statusKind(o.status)==='refused');
    const maxSeats=maxSeatsForRows(rows);
    const reserved=reservedSeasonSeats(rows);
    const capacityText=maxSeats>0 ? ` · ${reserved}/${maxSeats} place(s) réservée(s)` : '';
    const capacityClass=maxSeats>0 && reserved>=maxSeats ? ' full' : '';
    return `<details class="sales-subgroup${capacityClass}" ${open ? 'open' : ''}>
      <summary>
        <div><strong>${esc(group)}</strong><small>${s.paid} confirmé(s) · ${s.pending} attente · ${s.refused} refusé(s)${esc(capacityText)}</small></div>
        <div class="sales-subgroup-count"><b>${maxSeats>0?esc(String(Math.max(0,maxSeats-reserved))):esc(String(s.paid))}</b><span>${maxSeats>0?'places libres':'payés'}</span></div>
      </summary>
      <div class="sales-people-list">
        ${paidRows.length ? `<h4>✅ Confirmés</h4>${paidRows.map(orderPersonLine).join('')}` : ''}
        ${pendingRows.length ? `<h4>⏳ En attente</h4>${pendingRows.map(orderPersonLine).join('')}` : ''}
        ${refusedRows.length ? `<h4>⚠️ Refusés / annulés</h4>${refusedRows.map(orderPersonLine).join('')}` : ''}
      </div>
    </details>`;
  }

  function renderGenericType(type, list){
    const meta = TYPE_META[type] || TYPE_META.other;
    const keyFn = type === 'event_ticket' ? (o=>o.eventTitle || o.eventName || itemLabel(o))
      : type === 'stage_registration' ? (o=>o.stageTitle || o.stageName || itemLabel(o))
      : type === 'shop_order' ? (o=>o.productName || itemLabel(o))
      : type === 'membership' ? (o=>o.season || 'Adhésions')
      : type === 'one_off' ? (o=>itemLabel(o))
      : (o=>itemLabel(o));
    const groups = sortAlphaEntries(Array.from(byMap(list, keyFn).entries()));
    return `<section class="sales-type-block">
      <div class="sales-section-head"><div><h2>${esc(meta.icon)} ${esc(meta.label)}</h2><p>${esc(meta.hint)}</p></div>${badgesFor(list)}</div>
      <div class="sales-generic-list">
        ${groups.map(([name, rows])=>{
          const s=summarize(rows);
          return `<details class="sales-subgroup" open>
            <summary><div><strong>${esc(name)}</strong><small>${s.total} commande(s) · ${euro(s.revenue)} encaissé</small></div><div class="sales-subgroup-count"><b>${s.paid}</b><span>payés</span></div></summary>
            <div class="sales-people-list">${rows.map(orderPersonLine).join('')}</div>
          </details>`;
        }).join('')}
      </div>
    </section>`;
  }

  function renderMixedCartType(list){
    const seasonOrders = [];
    const shopRows = [];
    list.forEach(o=>{
      cartSeasonLines(o).forEach(line=>seasonOrders.push(orderFromCartLine(o, line)));
      cartShopLines(o).forEach(line=>shopRows.push(orderFromCartLine(o, line)));
    });
    const meta = TYPE_META.mixed_cart;
    const intro = `<section class="sales-type-block sales-mixed-overview">
      <div class="sales-section-head"><div><h2>${esc(meta.icon)} Paniers mixtes détaillés</h2><p>Les paniers sont éclatés ci-dessous par activité, groupe et formule pour retrouver facilement qui est inscrit où.</p></div>${badgesFor(list)}</div>
    </section>`;
    const seasonHtml = seasonOrders.length ? renderSeasonType(seasonOrders) : '';
    const shopHtml = shopRows.length ? renderGenericType('shop_order', shopRows) : '';
    const rawHtml = `<section class="sales-type-block"><div class="sales-section-head"><div><h2>🧾 Commandes panier complètes</h2><p>Vue originale par commande pour contrôler le paiement groupé et les échéances.</p></div></div><div class="sales-generic-list">${list.map(orderPersonLine).join('')}</div></section>`;
    return intro + seasonHtml + shopHtml + rawHtml;
  }

  function renderGroups(list){
    if(!list.length){ $('sales-groups').innerHTML = '<div class="sales-empty">Aucune commande ne correspond aux filtres.</div>'; return; }
    const types = sortTypeEntries(Array.from(byMap(list, typeKey).entries()));
    $('sales-groups').innerHTML = types.map(([type, rows])=>{
      if(type === 'season_registration') return renderSeasonType(rows);
      if(type === 'mixed_cart') return renderMixedCartType(rows);
      return renderGenericType(type, rows);
    }).join('');
  }

  function renderOrders(list){
    if(!list.length){ $('sales-orders').innerHTML = '<div class="sales-empty">Aucune commande ne correspond aux filtres.</div>'; return; }
    const types = sortTypeEntries(Array.from(byMap(list, typeKey).entries()));
    $('sales-orders').innerHTML = types.map(([type, rows])=>{
      const meta = TYPE_META[type] || TYPE_META.other;
      return `<section class="sales-type-block"><div class="sales-section-head"><div><h2>${esc(meta.icon)} ${esc(meta.label)}</h2><p>Liste complète des commandes.</p></div>${badgesFor(rows)}</div>${rows.map(renderOrderCard).join('')}</section>`;
    }).join('');
  }
  function renderOrderCard(o){
    const sum = installmentSummary(o);
    const inst = Array.isArray(o.installments) ? o.installments.map(x=>`<span class="sales-installment ${installmentKind(x.status)}">#${esc(x.number||'?')} · ${euro(x.amount)} · ${esc(x.date||'')} · ${esc(x.status||'')}</span>`).join('') : '';
    const id = String(o.id || '');
    const checked = id && selectedOrderIds.has(id) ? 'checked' : '';
    return `<article class="sales-order-card ${checked ? 'is-selected' : ''}">
      <div class="sales-order-head"><label class="sales-order-select"><input class="sales-order-checkbox" type="checkbox" data-order-id="${esc(id)}" ${checked}/> <span>Sélectionner</span></label><div><div class="sales-order-title">${esc(itemLabel(o))}</div><div class="sales-order-meta">${esc(o.id || '')} · ${esc(dateLabel(o.createdAt))}</div></div><span class="sales-status ${statusKind(o.status)}">${esc(statusLabel(o.status))}</span></div>
      <div class="sales-order-grid">
        <div class="sales-mini"><span>Payeur</span><strong>${esc(payerName(o))}</strong><small>${esc([payerEmail(o), payerPhone(o)].filter(Boolean).join(' · '))}</small></div>
        <div class="sales-mini"><span>Pour</span><strong>${esc(studentName(o))}</strong><small>${esc(cartLinesDetailedLabel(o) || [o.activityName,o.subcategoryName,subcategoryDetail(o),o.offerLabel,variantInfo(o)].filter(Boolean).join(' · '))}</small></div>
        ${emergencyPhone(o)?`<div class="sales-mini"><span>Urgence</span><strong>${esc(emergencyPhone(o))}</strong><small>Contact renseigné à l'inscription</small></div>`:''}
        ${subcategoryMaxSeats(o)>0?`<div class="sales-mini"><span>Places groupe</span><strong>${esc(String(subcategoryMaxSeats(o)))} max</strong><small>Limite du sous-groupe au moment du paiement</small></div>`:''}
        <div class="sales-mini"><span>Montants</span><strong>${euro(amount(o))}</strong><small>Payé : ${euro(paidAmount(o))} · Restant : ${euro(remainingAmount(o))}</small></div>
        <div class="sales-mini"><span>Échéances</span><strong>${sum.paid}/${sum.total} payée(s)</strong><small>${sum.remaining} restante(s) · ${sum.refused} refusée(s)</small></div>
        <div class="sales-mini"><span>Type</span><strong>${esc(typeLabel(typeKey(o)))}</strong><small>${esc(o.source || '')}</small></div>
        <div class="sales-mini"><span>HelloAsso</span><strong>${esc(o.helloAssoPaymentId || o.checkoutIntentId || '—')}</strong><small>${esc(o.provider || '')}</small></div>
        ${o.promoCode || o.freeReason || o.offlineMethod ? `<div class="sales-mini"><span>Code / origine</span><strong>${esc(o.promoCode || (o.freeReason === 'configured_free' ? 'Tarif gratuit' : '—'))}</strong><small>${esc([o.promoLabel, o.freeReason, o.offlineMethod].filter(Boolean).join(' · '))}</small></div>` : ''}
      </div>
      ${inst ? `<div class="sales-installment-list">${inst}</div>` : ''}
    </article>`;
  }
  function renderShopTodo(list){
    const rows = shopTodoOrders(list);
    if(!rows.length){
      $('sales-shop').innerHTML = '<div class="sales-empty">Aucune commande boutique à traiter.</div>';
      return;
    }
    const totalQty = rows.reduce((sum,o)=>sum + Math.max(1, Number(o.quantity || 1) || 1), 0);
    $('sales-shop').innerHTML = `<section class="sales-type-block">
      <div class="sales-section-head"><div><h2>🛍️ Boutique à traiter</h2><p>${rows.length} commande(s) · ${totalQty} article(s) à remettre.</p></div></div>
      <div class="sales-shop-list">${rows.map(renderShopTodoCard).join('')}</div>
    </section>`;
  }
  function renderShopTodoCard(o){
    const id = String(o.id || '');
    return `<article class="sales-shop-card">
      <div>
        <strong>${esc(o.productName || itemLabel(o))}</strong>
        <small>${esc(o.variantLabel || 'Aucune variante')} · Qté ${esc(o.quantity || 1)}</small>
      </div>
      <div>
        <strong>${esc(payerName(o))}</strong>
        <small>${esc([payerEmail(o), payerPhone(o)].filter(Boolean).join(' · '))}</small>
      </div>
      <div>
        <strong>${euro(amount(o))}</strong>
        <small>${esc(shortDate(o.createdAt))}</small>
      </div>
      <button type="button" class="sales-btn small sales-pickup-btn" data-order-id="${esc(id)}">Marquer récupérée</button>
    </article>`;
  }
  async function markShopPickedUp(orderId){
    if(!orderId) return;
    fail('');
    try{
      const token = await firebase.auth().currentUser.getIdToken(true);
      const res = await fetch(paymentWorkerUrl() + '/admin/orders/pickup', {
        method:'POST',
        headers:{ Authorization:'Bearer ' + token, 'Content-Type':'application/json', Accept:'application/json' },
        body: JSON.stringify({ id:orderId, pickedUp:true })
      });
      const data = await res.json().catch(()=>null);
      if(!res.ok || !data || data.ok === false) throw new Error((data && data.error) || ('pickup_order_' + res.status));
      await loadOrders();
    }catch(e){
      console.warn('[FTS ventes admin] récupération boutique impossible', e);
      fail('Impossible de marquer la commande comme récupérée. Vérifie que le Worker contient /admin/orders/pickup.');
    }
  }

  function renderInstallments(list){
    const rows = [];
    list.forEach(o=>{
      const inst = Array.isArray(o.installments) ? o.installments : [];
      inst.forEach(x=>rows.push({order:o, installment:x, kind:installmentKind(x.status)}));
    });
    if(!rows.length){ $('sales-installments').innerHTML = '<div class="sales-empty">Aucune échéance détaillée enregistrée pour les commandes filtrées.</div>'; return; }
    rows.sort((a,b)=>{
      const ak = a.kind === 'refused' ? 0 : a.kind === 'pending' ? 1 : a.kind === 'scheduled' ? 2 : 3;
      const bk = b.kind === 'refused' ? 0 : b.kind === 'pending' ? 1 : b.kind === 'scheduled' ? 2 : 3;
      return ak-bk || String(a.installment.date||'').localeCompare(String(b.installment.date||'')) || Number(a.installment.number||0)-Number(b.installment.number||0);
    });
    $('sales-installments').innerHTML = `<section class="sales-type-block"><div class="sales-section-head"><div><h2>📆 Échéances</h2><p>Refus et échéances à surveiller remontent en premier.</p></div></div><div class="sales-table">${rows.map(({order:o,installment:x,kind})=>`<div class="sales-row"><div><strong>${esc(studentName(o))}</strong><small>${esc(o.activityName || typeLabel(typeKey(o)))} · ${esc([o.subcategoryName,subcategoryDetail(o)].filter(Boolean).join(' · '))}</small></div><div><strong>Échéance #${esc(x.number || '?')}</strong><small>${esc(x.date || 'Date inconnue')}</small></div><div><span class="sales-status ${kind==='paid'?'paid':kind==='refused'?'refused':'pending'}">${esc(x.status || 'en attente')}</span><small>${esc(o.paymentPlan || '')}</small></div><div><strong>${euro(x.amount)}</strong><small>${esc(o.id || '')}</small></div></div>`).join('')}</div></section>`;
  }
  function renderAll(){
    const list = filteredOrders();
    renderStats(list);
    renderGroups(list);
    renderOrders(list);
    renderShopTodo(list);
    renderInstallments(list);
    updateBulkUi();
  }
  function fillSeasons(){
    const select = $('sales-season'); if(!select) return;
    const current = select.value || 'all';
    const seasons = [...new Set(orders.map(o=>String(o.season||'').trim()).filter(Boolean))].sort().reverse();
    select.innerHTML = '<option value="all">Toutes</option>' + seasons.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if(seasons.includes(current)) select.value = current;
  }
  function paymentWorkerUrl(){
    const cfg = FTS.PAYMENT || {};
    return String(cfg.workerUrl || cfg.apiBase || 'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/,'');
  }

  async function loadOrders(){
    if($('sales-refresh')) $('sales-refresh').disabled = true;
    fail('');
    try{
      const token = await firebase.auth().currentUser.getIdToken(true);
      const res = await fetch(paymentWorkerUrl() + '/admin/orders?limit=500', {
        method:'GET',
        headers:{ Authorization:'Bearer ' + token, Accept:'application/json' }
      });
      const data = await res.json().catch(()=>null);
      if(!res.ok || !data || data.ok === false) throw new Error((data && data.error) || ('admin_orders_' + res.status));
      orders = Array.isArray(data.orders) ? data.orders.map(normalizeOrderStatus) : [];
      const existingIds = new Set(orders.map(o=>String(o.id || '')).filter(Boolean));
      Array.from(selectedOrderIds).forEach(id=>{ if(!existingIds.has(id)) selectedOrderIds.delete(id); });
      fillSeasons();
      renderAll();
    }catch(e){
      console.warn('[FTS ventes admin] chargement Worker impossible', e);
      fail('Impossible de charger les ventes depuis le Worker. Vérifie que le Worker déployé contient /admin/orders et que ton compte est admin.');
      orders = [];
      renderAll();
    }finally{
      if($('sales-refresh')) $('sales-refresh').disabled = false;
    }
  }
  async function deleteSelectedOrders(){
    const ids = Array.from(selectedOrderIds).filter(Boolean);
    if(!ids.length){ updateBulkUi(); return; }
    const msg = `Supprimer définitivement ${ids.length} commande(s) de l’admin ventes ?\n\nCela supprime uniquement la trace locale dans l’app Fais Ton Show. Le paiement réel HelloAsso n’est pas annulé ni remboursé.`;
    if(!window.confirm(msg)) return;
    const btn = $('sales-delete-selected');
    if(btn) btn.disabled = true;
    fail('');
    try{
      const token = await firebase.auth().currentUser.getIdToken(true);
      const res = await fetch(paymentWorkerUrl() + '/admin/orders/delete', {
        method:'POST',
        headers:{ Authorization:'Bearer ' + token, 'Content-Type':'application/json', Accept:'application/json' },
        body: JSON.stringify({ ids })
      });
      const data = await res.json().catch(()=>null);
      if(!res.ok || !data || data.ok === false) throw new Error((data && data.error) || ('delete_orders_' + res.status));
      selectedOrderIds.clear();
      await loadOrders();
    }catch(e){
      console.warn('[FTS ventes admin] suppression impossible', e);
      fail('Suppression impossible. Vérifie que le Worker déployé contient /admin/orders/delete et que ton compte est admin.');
      updateBulkUi();
    }
  }

  function bindUi(){
    ['sales-search','sales-type','sales-status','sales-season'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('input', renderAll); if(el) el.addEventListener('change', renderAll); });
    const refresh = $('sales-refresh'); if(refresh) refresh.addEventListener('click', loadOrders);
    const exportBtn = $('sales-export'); if(exportBtn) exportBtn.addEventListener('click', exportCsv);
    const deleteBtn = $('sales-delete-selected'); if(deleteBtn) deleteBtn.addEventListener('click', deleteSelectedOrders);
    const selectAll = $('sales-select-all'); if(selectAll) selectAll.addEventListener('change', ()=>{
      const ids = filteredOrderIds();
      if(selectAll.checked) ids.forEach(id=>selectedOrderIds.add(id));
      else ids.forEach(id=>selectedOrderIds.delete(id));
      renderAll();
    });
    const ordersView = $('sales-orders'); if(ordersView) ordersView.addEventListener('change', e=>{
      const box = e.target && e.target.closest ? e.target.closest('.sales-order-checkbox') : null;
      if(!box) return;
      const id = String(box.getAttribute('data-order-id') || '');
      if(!id) return;
      if(box.checked) selectedOrderIds.add(id); else selectedOrderIds.delete(id);
      renderAll();
    });
    const shopView = $('sales-shop'); if(shopView) shopView.addEventListener('click', e=>{
      const btn = e.target && e.target.closest ? e.target.closest('.sales-pickup-btn') : null;
      if(!btn) return;
      btn.disabled = true;
      markShopPickedUp(String(btn.getAttribute('data-order-id') || ''));
    });
    document.querySelectorAll('[data-sales-tab]').forEach(btn=>btn.addEventListener('click',()=>{
      activeTab = btn.getAttribute('data-sales-tab') || 'groups';
      document.querySelectorAll('[data-sales-tab]').forEach(b=>b.classList.toggle('active', b===btn));
      ['groups','orders','shop','installments'].forEach(name=>{ const el=$('sales-'+name); if(el) el.hidden = name !== activeTab; });
      updateBulkUi();
    }));
  }
  function exportCsv(){
    const rows = filteredOrders();
    const head = ['reference','type','statut','saison','activite','groupe','detail_groupe','jour','horaire','niveau','age','note','places_max','formules_autorisees','formule','participant_prenom','participant_nom','participant','payeur','email','telephone','telephone_urgence','produit','variante','quantite','plan','montant','paye','restant','echeances_total','echeances_payees','echeances_restantes','echeances_refusees','date_creation'];
    const lines = [head.join(';')];
    rows.forEach(o=>{
      const sum = installmentSummary(o);
      const row = [o.id,o.type,statusLabel(o.status),o.season,o.activityName,o.subcategoryName,subcategoryDetail(o),o.subcategoryDay,o.subcategoryTime,o.subcategoryLevel,o.subcategoryAge,o.subcategoryNote,subcategoryMaxSeats(o)||'',subcategoryAllowedOffersLabel(o),o.offerLabel,participantFirstName(o),participantLastName(o),studentName(o),payerName(o),payerEmail(o),payerPhone(o),emergencyPhone(o),o.productName||'',variantInfo(o),o.quantity||'',o.paymentPlan,amount(o)/100,paidAmount(o)/100,remainingAmount(o)/100,sum.total,sum.paid,sum.remaining,sum.refused,dateLabel(o.createdAt)];
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
