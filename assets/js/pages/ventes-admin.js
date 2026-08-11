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
  let officialCategories = null;
  let dashboardDetails = new Map();

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
  function categorySubcats(cat){
    const raw = cat && (cat.subcats || cat.subcategories || {});
    const out = [];
    if(Array.isArray(raw)){
      raw.forEach((s,i)=>{
        if(typeof s === 'string') out.push({key:norm(s)||String(i), name:s, active:true});
        else if(s) out.push(Object.assign({key:s.key || norm(s.name || s.label) || String(i)}, s, {name:s.name || s.label || s.title || s.key || String(i), active:s.active !== false}));
      });
    }else{
      Object.entries(raw || {}).forEach(([k,s])=>{
        if(typeof s === 'string') out.push({key:k, name:s, active:true});
        else if(s) out.push(Object.assign({key:k}, s, {name:s.name || s.label || s.title || k, active:s.active !== false}));
      });
    }
    return out.filter(s=>s && s.active !== false);
  }
  function findOfficialSubcat(activityId, subcategoryId){
    const cat = officialCategories && officialCategories[String(activityId || '')];
    if(!cat) return null;
    const wanted = String(subcategoryId || '');
    return categorySubcats(cat).find(s=>String(s.key || '') === wanted) || null;
  }
  function officialSubcatInfo(activityId, subcategoryId){
    const sub = findOfficialSubcat(activityId, subcategoryId);
    if(!sub) return null;
    const ss = (sub && sub.season) || {};
    const title = ss.title || sub.title || sub.name || sub.label || sub.key || subcategoryId || '';
    const day = ss.day || ss.jour || '';
    const time = ss.time || ss.horaire || ss.hours || '';
    const level = ss.level || ss.niveau || '';
    const age = ss.age || ss.ages || '';
    const note = ss.note || ss.description || '';
    const price = ss.price || ss.tarif || '';
    const maxSeats = Math.max(0, Number(ss.maxSeats || ss.placesMax || ss.capacity || 0) || 0);
    const direct = ss.seasonDetail || ss.detail || ss.details || ss.saisonDetail || '';
    const seasonDetail = String(direct || [day,time,level,age,note].filter(Boolean).join(' · ')).trim();
    const allowedOffers = Array.isArray(ss.allowedOffers) ? ss.allowedOffers : String(ss.allowedOffers || ss.offers || ss.formules || ss.parcours || '').split(',').map(x=>x.trim()).filter(Boolean);
    return {subcategoryName:title, subcategoryTitle:title, subcategoryDay:day, subcategoryTime:time, subcategoryLevel:level, subcategoryAge:age, subcategoryNote:note, subcategoryPrice:price, subcategoryMaxSeats:maxSeats, subcategorySeasonDetail:seasonDetail, subcategoryAllowedOffers:allowedOffers};
  }
  function enrichReservationLine(parent, line){
    const merged = Object.assign({}, parent, line, {
      id: parent.id,
      type: line.type || parent.type,
      parentType: parent.type,
      reservationParentId: parent.id,
      parentTotalAmount: amount(parent),
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
      itemName: line.itemName || parent.itemName || '',
      source: parent.source
    });
    const isLinked = line && line.kind && line.kind !== 'main';
    const official = officialSubcatInfo(line.activityId || merged.activityId, line.subcategoryId || merged.subcategoryId);
    if(official){
      Object.assign(merged, official);
    }else if(isLinked){
      // Les lignes liées anciennes n'ont parfois que activityId/subcategoryId.
      // On efface les détails hérités du cours principal pour ne pas afficher un faux horaire.
      ['subcategoryDay','subcategoryTime','subcategoryLevel','subcategoryAge','subcategoryNote','subcategoryPrice','subcategorySeasonDetail'].forEach(k=>{
        if(!Object.prototype.hasOwnProperty.call(line, k)) merged[k] = '';
      });
      if(!Object.prototype.hasOwnProperty.call(line, 'subcategoryMaxSeats')) merged.subcategoryMaxSeats = 0;
      if(!Object.prototype.hasOwnProperty.call(line, 'subcategoryAllowedOffers')) merged.subcategoryAllowedOffers = [];
    }
    return merged;
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

  function reservationLines(o){ return Array.isArray(o && o.reservationLines) ? o.reservationLines.filter(l=>l && l.type === 'season_registration') : []; }
  function orderFromReservationLine(parent, line){
    return enrichReservationLine(parent, line);
  }
  function expandSeasonReservations(rows){
    const out=[];
    rows.forEach(o=>{
      const lines=reservationLines(o);
      if(lines.length) lines.forEach(line=>out.push(orderFromReservationLine(o,line)));
      else out.push(o);
    });
    return out;
  }

  function isPiecesLine(line){
    const variants = line && line.variants && typeof line.variants === 'object' ? line.variants : {};
    return String(variants.Module || variants.module || '').toLowerCase().indexOf('pièce') !== -1;
  }
  function isPiecesOrder(o){ return String(o && o.source || '').toLowerCase().indexOf('pieces') !== -1 || isPiecesLine(o); }
  function cartSeasonLines(o){ return Array.isArray(o && o.cartLines) ? o.cartLines.filter(l=>l && l.type === 'season_registration') : []; }
  function cartShopLines(o){ return Array.isArray(o && o.cartLines) ? o.cartLines.filter(l=>l && l.type === 'shop_order' && !isPiecesLine(l)) : []; }
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
        const detail = [l.kind && l.kind !== 'main' ? (l.kind === 'paid_option' ? 'Option payante' : 'Option incluse') : '', l.optionRuleLabel || '', lineGroupName(l), lineSubcategoryDetail(l), lineOfferLabel(l), euro(lineAmount(l))].filter(Boolean).join(' · ');
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
    const merged = enrichReservationLine(parent, line);
    merged.cartParentId = parent.id;
    merged.paidAmount = statusKind(parent.status)==='paid' ? (line.amountCents || 0) : 0;
    merged.remainingAmount = statusKind(parent.status)==='paid' ? 0 : (line.amountCents || 0);
    return merged;
  }
  function shopLineVariantLabel(line){
    if(line && line.variantLabel) return line.variantLabel;
    if(line && line.variants && typeof line.variants === 'object') return Object.entries(line.variants).map(([k,v])=>`${k}: ${v}`).join(' · ');
    return '';
  }
  function shopLineAmount(line){
    const direct = cents(line && (line.amountCents || line.totalAmountCents || line.totalAmount || line.amount));
    if(direct) return direct;
    return cents(line && line.unitPriceCents) * Math.max(1, Number(line && line.quantity || 1) || 1);
  }
  function orderFromCartShopLine(parent, line){
    const lineCents = shopLineAmount(line);
    const merged = orderFromCartLine(parent, Object.assign({}, line, {amountCents:lineCents}));
    merged.type = 'shop_order';
    merged.parentType = parent.type;
    merged.cartParentId = parent.id;
    merged.lineId = line.id || line.cartLineId || line.productId || '';
    merged.productName = line.productName || line.itemName || merged.productName || 'Article boutique';
    merged.variantLabel = shopLineVariantLabel(line);
    merged.quantity = Math.max(1, Number(line.quantity || 1) || 1);
    merged.amountCents = lineCents;
    merged.totalAmount = lineCents;
    merged.paidAmount = statusKind(parent.status)==='paid' ? lineCents : 0;
    merged.remainingAmount = statusKind(parent.status)==='paid' ? 0 : lineCents;
    return merged;
  }
  function mixedCartShopOrders(list){
    const out = [];
    list.filter(o=>typeKey(o)==='mixed_cart').forEach(o=>{
      cartShopLines(o).forEach(line=>out.push(orderFromCartShopLine(o, line)));
    });
    return out;
  }
  function combinedShopOrders(list){
    return list.filter(o=>typeKey(o)==='shop_order' && !isPiecesOrder(o)).concat(mixedCartShopOrders(list));
  }
  function mixedCartSeasonOrders(list){
    const out = [];
    list.filter(o=>typeKey(o)==='mixed_cart').forEach(o=>{
      cartSeasonLines(o).forEach(line=>out.push(orderFromCartLine(o, line)));
    });
    return out;
  }
  function combinedSeasonOrders(list){
    return expandSeasonReservations(list.filter(o=>typeKey(o)==='season_registration')).concat(mixedCartSeasonOrders(list));
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
  function shopPickedUpDate(o){
    const raw = o.shopPickedUpAt || o.pickedUpAt || (o.fulfillment && o.fulfillment.pickedUpAt) || '';
    if(!raw) return '—';
    const n = Number(raw);
    const d = Number.isFinite(n) ? new Date(n) : new Date(raw);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR') : '—';
  }
  function isShopLikeOrder(o){
    return (typeKey(o)==='shop_order' && !isPiecesOrder(o)) || (typeKey(o)==='mixed_cart' && cartShopLines(o).length > 0);
  }
  function shopTrackableOrders(list){
    return list.filter(o=>statusKind(o.status)==='paid' && isShopLikeOrder(o));
  }
  function shopTodoOrders(list){
    return shopTrackableOrders(list).filter(o=>!isShopPickedUp(o));
  }
  function shopDoneOrders(list){
    return shopTrackableOrders(list).filter(o=>isShopPickedUp(o));
  }
  function shopTodoQuantity(o){
    if(typeKey(o)==='mixed_cart') return cartShopLines(o).reduce((sum,line)=>sum + Math.max(1, Number(line.quantity || 1) || 1), 0);
    return Math.max(1, Number(o.quantity || 1) || 1);
  }
  function shopTodoTitle(o){
    if(typeKey(o)==='mixed_cart') return 'Panier boutique + inscription';
    return o.productName || itemLabel(o);
  }
  function shopTodoDetail(o){
    if(typeKey(o)==='mixed_cart'){
      return cartShopLines(o).map(line=>[line.productName || line.itemName || 'Article boutique', shopLineVariantLabel(line), 'Qté ' + Math.max(1, Number(line.quantity || 1) || 1)].filter(Boolean).join(' · ')).join(' + ');
    }
    return [o.variantLabel || variantInfo(o) || 'Aucune variante', 'Qté ' + Math.max(1, Number(o.quantity || 1) || 1)].join(' · ');
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

  function validSalesTab(tab){
    return ['groups','orders','shop','installments'].includes(String(tab || '')) ? String(tab) : 'groups';
  }
  function requestedSalesTab(){
    const params = new URLSearchParams(window.location.search || '');
    const raw = params.get('tab') || String(window.location.hash || '').replace(/^#/, '');
    return validSalesTab(raw);
  }
  function applyActiveTab(){
    activeTab = validSalesTab(activeTab);
    document.querySelectorAll('[data-sales-tab]').forEach(btn=>btn.classList.toggle('active', btn.getAttribute('data-sales-tab') === activeTab));
    ['groups','orders','shop','installments'].forEach(name=>{
      const el = $('sales-' + name);
      if(el) el.hidden = name !== activeTab;
    });
    const shell = $('sales-shell');
    if(shell) shell.classList.toggle('sales-shop-focus', activeTab === 'shop');
    document.body.classList.toggle('sales-shop-focus', activeTab === 'shop');
    updateBulkUi();
  }
  function setActiveTab(tab, updateUrl){
    activeTab = validSalesTab(tab);
    applyActiveTab();
    if(updateUrl && window.history && window.history.replaceState){
      const url = new URL(window.location.href);
      if(activeTab === 'groups') url.searchParams.delete('tab');
      else url.searchParams.set('tab', activeTab);
      window.history.replaceState(null, '', url.toString());
    }
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
    list.forEach(o=>{
      cartSeasonLines(o).forEach(line=>seasonOrders.push(orderFromCartLine(o, line)));
    });
    const meta = TYPE_META.mixed_cart;
    const intro = `<section class="sales-type-block sales-mixed-overview">
      <div class="sales-section-head"><div><h2>${esc(meta.icon)} Paniers mixtes · inscriptions</h2><p>Les inscriptions des paniers mixtes sont rangées par activité. Les articles boutique sont regroupés dans la section Boutique unique.</p></div>${badgesFor(list)}</div>
    </section>`;
    const seasonHtml = seasonOrders.length ? renderSeasonType(seasonOrders) : '';
    const rawHtml = `<section class="sales-type-block"><div class="sales-section-head"><div><h2>🧾 Commandes panier complètes</h2><p>Un bloc par paiement groupé, avec toutes les lignes du panier.</p></div></div><div class="sales-generic-list">${list.map(renderMixedCartOrderCard).join('')}</div></section>`;
    return intro + seasonHtml + rawHtml;
  }

  function renderMixedCartOrderCard(o){
    const sum = installmentSummary(o);
    const inst = Array.isArray(o.installments) ? o.installments.map(x=>`<span class="sales-installment ${installmentKind(x.status)}">#${esc(x.number||'?')} · ${euro(x.amount)} · ${esc(x.date||'')} · ${esc(x.status||'')}</span>`).join('') : '';
    return `<article class="sales-order-card sales-mixed-card">
      <div class="sales-order-head"><div><div class="sales-order-title">${esc(payerName(o))}</div><div class="sales-order-meta">${esc(o.id || '')} · ${esc(dateLabel(o.createdAt))}</div></div><span class="sales-status ${statusKind(o.status)}">${esc(statusLabel(o.status))}</span></div>
      <div class="sales-order-grid">
        <div class="sales-mini"><span>Payeur</span><strong>${esc(payerName(o))}</strong><small>${esc([payerEmail(o), payerPhone(o)].filter(Boolean).join(' · '))}</small></div>
        <div class="sales-mini"><span>Pour</span><strong>${esc(studentName(o))}</strong><small>${esc(cartLinesDetailedLabel(o) || cartLinesLabel(o))}</small></div>
        <div class="sales-mini"><span>Montants</span><strong>${euro(amount(o))}</strong><small>Payé : ${euro(paidAmount(o))} · Restant : ${euro(remainingAmount(o))}</small></div>
        <div class="sales-mini"><span>Échéances</span><strong>${sum.paid}/${sum.total} payée(s)</strong><small>${sum.remaining} restante(s) · ${sum.refused} refusée(s)</small></div>
      </div>
      ${renderCartLinesMini(o)}
      ${inst ? `<div class="sales-installment-list">${inst}</div>` : ''}
    </article>`;
  }

  function dashboardSubtitle(rows, fallback){
    const seasons = [...new Set(rows.map(o=>String(o.season || '').trim()).filter(Boolean))];
    const seasonText = seasons.length === 1 ? seasons[0] : seasons.length > 1 ? seasons.length + ' saisons' : '';
    return [seasonText, fallback].filter(Boolean).join(' · ');
  }
  function renderDashboardCard(title, subtitle, icon, rows, detailHtml, cls){
    const s = summarize(rows);
    const id = 'sales-detail-' + (dashboardDetails.size + 1);
    dashboardDetails.set(id, {title, html:detailHtml});
    return `<button type="button" class="sales-dashboard-card ${esc(cls || '')}" data-sales-detail="${esc(id)}">
      <span class="sales-dashboard-icon">${esc(icon || '💳')}</span>
      <span class="sales-dashboard-main"><strong>${esc(title)}</strong><small>${esc(subtitle || '')}</small></span>
      <span class="sales-dashboard-metrics">
        <span><b>${esc(String(s.total))}</b><small>lignes</small></span>
        <span><b>${esc(String(s.pending))}</b><small>attente</small></span>
        <span><b>${euro(s.revenue)}</b><small>encaissé</small></span>
      </span>
    </button>`;
  }

  function renderGroups(list){
    if(!list.length){ $('sales-groups').innerHTML = '<div class="sales-empty">Aucune commande ne correspond aux filtres.</div>'; return; }
    dashboardDetails = new Map();
    const grouped = byMap(list, typeKey);
    const parts = [];
    const mixedRows = grouped.get('mixed_cart') || [];
    if(mixedRows.length){
      parts.push(renderDashboardCard('Paniers mixtes', 'Paiements groupés inscription + boutique', TYPE_META.mixed_cart.icon, mixedRows, renderMixedCartType(mixedRows), 'mixed'));
    }
    const seasonRows = combinedSeasonOrders(list);
    sortAlphaEntries(Array.from(byMap(seasonRows, o=>o.activityName || o.activityId || 'Activité non renseignée').entries())).forEach(([activity, rows])=>{
      const groupsCount = byMap(rows, subgroupKey).size;
      parts.push(renderDashboardCard(activity, dashboardSubtitle(rows, groupsCount + ' groupe(s)'), TYPE_META.season_registration.icon, rows, renderSeasonType(rows), 'season'));
    });
    const shopRows = combinedShopOrders(list);
    if(shopRows.length){
      parts.push(renderDashboardCard('Boutique', 'Articles seuls + paniers mixtes', TYPE_META.shop_order.icon, shopRows, renderGenericType('shop_order', shopRows), 'shop'));
    }
    ['event_ticket','stage_registration','membership','one_off','other'].forEach(type=>{
      const rows = grouped.get(type) || [];
      if(rows.length) parts.push(renderDashboardCard(typeLabel(type), TYPE_META[type].hint, TYPE_META[type].icon, rows, renderGenericType(type, rows), type));
    });
    $('sales-groups').innerHTML = `<section class="sales-dashboard">
      <div class="sales-section-head"><div><h2>Vue pilotage</h2><p>Clique sur une carte pour ouvrir le détail complet sans allonger la page.</p></div>${badgesFor(list)}</div>
      <div class="sales-dashboard-grid">${parts.join('')}</div>
    </section>`;
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
    const allRows = shopTrackableOrders(list);
    const rows = shopTodoOrders(list);
    const doneRows = shopDoneOrders(list);
    const todoQty = rows.reduce((sum,o)=>sum + shopTodoQuantity(o), 0);
    const doneQty = doneRows.reduce((sum,o)=>sum + shopTodoQuantity(o), 0);
    const totalQty = allRows.reduce((sum,o)=>sum + shopTodoQuantity(o), 0);
    const summary = `<div class="sales-shop-summary" aria-label="Résumé boutique">
      <article class="todo"><strong>${esc(String(rows.length))}</strong><span>commande(s) à traiter</span><small>${esc(String(todoQty))} article(s) à remettre</small></article>
      <article class="done"><strong>${esc(String(doneRows.length))}</strong><span>commande(s) récupérée(s)</span><small>${esc(String(doneQty))} article(s) déjà remis</small></article>
      <article><strong>${esc(String(allRows.length))}</strong><span>commande(s) boutique validée(s)</span><small>${esc(String(totalQty))} article(s) au total</small></article>
    </div>`;
    const todoHtml = rows.length
      ? `<div class="sales-shop-list">${rows.map(renderShopTodoCard).join('')}</div>`
      : '<div class="sales-empty sales-shop-empty-ok">Tout est à jour : aucun article boutique à remettre.</div>';
    const doneHtml = doneRows.length
      ? `<div class="sales-shop-list compact">${doneRows.map(renderShopDoneCard).join('')}</div>`
      : '<div class="sales-empty">Aucune commande boutique encore marquée comme récupérée.</div>';
    $('sales-shop').innerHTML = `<section class="sales-type-block sales-shop-focus-view">
      <div class="sales-section-head"><div><h2>🛍️ Boutique à traiter</h2><p>Vue dédiée aux articles boutique uniquement : ce qui reste à remettre et ce qui est déjà récupéré.</p></div></div>
      ${summary}
      <div class="sales-shop-block-head"><h3>À remettre</h3><p>${rows.length} commande(s) · ${todoQty} article(s)</p></div>
      ${todoHtml}
      <details class="sales-shop-done-block">
        <summary><span>Déjà récupérées</span><strong>${doneRows.length} commande(s) · ${doneQty} article(s)</strong></summary>
        ${doneHtml}
      </details>
    </section>`;
  }
  function renderShopTodoCard(o){
    const id = String(o.id || '');
    return `<article class="sales-shop-card">
      <div>
        <strong>${esc(shopTodoTitle(o))}</strong>
        <small>${esc(shopTodoDetail(o))}</small>
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
  function renderShopDoneCard(o){
    return `<article class="sales-shop-card is-done">
      <div>
        <strong>${esc(shopTodoTitle(o))}</strong>
        <small>${esc(shopTodoDetail(o))}</small>
      </div>
      <div>
        <strong>${esc(payerName(o))}</strong>
        <small>${esc([payerEmail(o), payerPhone(o)].filter(Boolean).join(' · '))}</small>
      </div>
      <div>
        <strong>${euro(amount(o))}</strong>
        <small>Récupérée le ${esc(shopPickedUpDate(o))}</small>
      </div>
      <span class="sales-status paid">Récupérée</span>
    </article>`;
  }
  function ensureSalesDetailModal(){
    if(document.getElementById('sales-detail-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'sales-detail-modal';
    modal.className = 'sales-detail-modal';
    modal.hidden = true;
    modal.innerHTML = `<div class="sales-detail-panel" role="dialog" aria-modal="true" aria-labelledby="sales-detail-title">
      <header class="sales-detail-head"><h2 id="sales-detail-title"></h2><button type="button" class="sales-detail-close" data-sales-detail-close>×</button></header>
      <div class="sales-detail-body" id="sales-detail-body"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{
      if(e.target === modal || (e.target && e.target.closest && e.target.closest('[data-sales-detail-close]'))) closeSalesDetail();
    });
  }
  function openSalesDetail(id){
    const detail = dashboardDetails.get(id);
    if(!detail) return;
    ensureSalesDetailModal();
    $('sales-detail-title').textContent = detail.title || 'Détail';
    $('sales-detail-body').innerHTML = detail.html || '';
    $('sales-detail-modal').hidden = false;
    document.body.classList.add('sales-modal-open');
  }
  function closeSalesDetail(){
    const modal = $('sales-detail-modal');
    if(modal) modal.hidden = true;
    document.body.classList.remove('sales-modal-open');
  }
  async function markShopPickedUp(orderId){
    if(!orderId) return;
    fail('');
    try{
      await loadOfficialCategories();
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
    renderShopTodo(orders);
    renderInstallments(list);
    applyActiveTab();
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

  async function loadOfficialCategories(){
    if(!db || officialCategories) return;
    try{
      const snap = await db.ref('fts_content/categories').once('value');
      officialCategories = snap.exists() ? (snap.val() || {}) : {};
    }catch(e){
      console.warn('[FTS ventes admin] catégories officielles indisponibles', e);
      officialCategories = {};
    }
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
    const groupsView = $('sales-groups'); if(groupsView) groupsView.addEventListener('click', e=>{
      const card = e.target && e.target.closest ? e.target.closest('[data-sales-detail]') : null;
      if(!card) return;
      e.preventDefault();
      openSalesDetail(String(card.getAttribute('data-sales-detail') || ''));
    });
    document.addEventListener('keydown', e=>{ if(e.key === 'Escape') closeSalesDetail(); });
    document.querySelectorAll('[data-sales-tab]').forEach(btn=>btn.addEventListener('click',()=>{
      setActiveTab(btn.getAttribute('data-sales-tab') || 'groups', true);
    }));
    setActiveTab(requestedSalesTab(), false);
  }
  function exportCsvRows(baseRows){
    const out = [];
    baseRows.forEach(o=>{
      const type = typeKey(o);
      if(type === 'season_registration'){
        const lines = expandSeasonReservations([o]);
        if(lines.length) lines.forEach(line=>out.push(line));
        else out.push(o);
        return;
      }
      if(type === 'mixed_cart'){
        let added = false;
        cartSeasonLines(o).forEach(line=>{ out.push(orderFromCartLine(o, line)); added = true; });
        cartShopLines(o).forEach(line=>{ out.push(orderFromCartLine(o, line)); added = true; });
        if(!added) out.push(o);
        return;
      }
      out.push(o);
    });
    return out;
  }
  function csvLineAmount(o){ return amount(o); }
  function csvLinePaidAmount(o){
    const a = csvLineAmount(o);
    if(statusKind(o.status) === 'paid') return a;
    return 0;
  }
  function csvLineRemainingAmount(o){
    const a = csvLineAmount(o);
    if(statusKind(o.status) === 'paid' || statusKind(o.status) === 'refused') return 0;
    return a;
  }
  function exportCsv(){
    const rows = exportCsvRows(filteredOrders());
    const head = ['reference_commande','reference_ligne','type_commande','type_ligne','statut','saison','activite','groupe','detail_groupe','jour','horaire','niveau','age','note','places_max','formules_autorisees','formule','option','participant_prenom','participant_nom','participant','payeur','email','telephone','telephone_urgence','produit','variante','quantite','plan','montant_ligne','paye_ligne','restant_ligne','montant_commande','echeances_total','echeances_payees','echeances_restantes','echeances_refusees','date_creation'];
    const lines = [head.join(';')];
    rows.forEach(o=>{
      const sum = installmentSummary(o);
      const parentRef = o.reservationParentId || o.cartParentId || o.id || '';
      const lineRef = o.lineId || o.cartLineId || o.reservationLineId || o.id || '';
      const row = [parentRef,lineRef,o.parentType || o.type,o.type,statusLabel(o.status),o.season,o.activityName,o.subcategoryName || o.subcategoryTitle,subcategoryDetail(o),o.subcategoryDay,o.subcategoryTime,o.subcategoryLevel,o.subcategoryAge,o.subcategoryNote,subcategoryMaxSeats(o)||'',subcategoryAllowedOffersLabel(o),o.offerLabel,o.optionRuleLabel || o.linkedOptionLabel || (o.kind && o.kind !== 'main' ? o.kind : ''),participantFirstName(o),participantLastName(o),studentName(o),payerName(o),payerEmail(o),payerPhone(o),emergencyPhone(o),o.productName||'',variantInfo(o),o.quantity||'',o.paymentPlan,csvLineAmount(o)/100,csvLinePaidAmount(o)/100,csvLineRemainingAmount(o)/100,(o.parentTotalAmount || amount(o))/100,sum.total,sum.paid,sum.remaining,sum.refused,dateLabel(o.createdAt)];
      lines.push(row.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(';'));
    });
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fts-ventes-detaillees-' + new Date().toISOString().slice(0,10) + '.csv';
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
        if(String(profile.status||'').toLowerCase() !== 'active'){ await firebase.auth().signOut(); location.href='auth.html'; return; }
        if(String(profile.role||'').toLowerCase() !== 'admin'){ location.href='membres.html'; return; }
        $('sales-loading').style.display='none';
        $('sales-shell').hidden=false;
        bindUi();
        await loadOfficialCategories();
        await loadOrders();
      }catch(e){ console.warn('[FTS ventes admin]', e); fail('Impossible de charger les ventes. Vérifie les droits admin.'); }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
