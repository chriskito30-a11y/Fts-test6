(function(window){
  'use strict';
  const FTS = window.FTS = window.FTS || {};
  const esc = v => FTS.esc ? FTS.esc(v == null ? '' : v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const euro = c => (Number(c || 0) / 100).toLocaleString('fr-FR', { style:'currency', currency:'EUR' });
  const worker = () => String((FTS.PAYMENT && FTS.PAYMENT.workerUrl) || 'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/, '');

  function currentAuth(){
    return window.firebase && firebase.auth ? firebase.auth() : null;
  }
  function currentDb(){
    if(window.FTS && FTS.initFirebase) return FTS.initFirebase();
    return window.firebase && firebase.database ? firebase.database() : null;
  }
  async function dbGet(path){
    const db = currentDb();
    if(!db) throw new Error('firebase_database_missing');
    const snap = await db.ref(path).once('value');
    return snap.val();
  }
  function waitForUser(){
    const auth = currentAuth();
    if(!auth) return Promise.reject(new Error('firebase_auth_missing'));
    if(auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if(done) return;
        done = true;
        try { unsubscribe && unsubscribe(); } catch(e) {}
        reject(new Error('not_connected'));
      }, 8000);
      const unsubscribe = auth.onAuthStateChanged(user => {
        if(done) return;
        if(!user) return;
        done = true;
        clearTimeout(timer);
        try { unsubscribe && unsubscribe(); } catch(e) {}
        resolve(user);
      }, err => {
        if(done) return;
        done = true;
        clearTimeout(timer);
        reject(err || new Error('not_connected'));
      });
    });
  }
  async function token(){
    const user = await waitForUser();
    return user.getIdToken(true);
  }
  async function api(path, opts){
    const t = await token();
    const res = await fetch(worker() + path, Object.assign({
      headers:{ 'Content-Type':'application/json', Accept:'application/json', Authorization:'Bearer ' + t }
    }, opts || {}));
    const data = await res.json().catch(() => null);
    if(!res.ok || !data || data.ok === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }
  function msFromDate(v, end){
    if(!v) return 0;
    const d = new Date(v + (end ? 'T23:59:59' : 'T00:00:00'));
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  }
  function dateFromMs(ms){
    if(!ms) return '';
    const d = new Date(Number(ms));
    return Number.isFinite(d.getTime()) ? d.toISOString().slice(0,10) : '';
  }
  function list(v){ return String(v || '').split(/[;,\n]/).map(x => x.trim()).filter(Boolean); }
  function csv(a){ return Array.isArray(a) ? a.join(', ') : ''; }
  function titleForScope(scope){
    if(scope === 'season_registration') return 'Codes Saison / inscriptions';
    if(scope === 'shop_order') return 'Codes boutique';
    if(scope === 'stage_registration') return 'Codes stages';
    if(scope === 'event_stage') return 'Codes événements / stages';
    return 'Codes spectacles / événements';
  }
  function isEventScope(scope){ return scope === 'event_ticket' || scope === 'stage_registration'; }
  function scopeQueryFor(section, scope){
    return section.getAttribute('data-promo-calendar') === 'true' ? '' : ('?scope=' + encodeURIComponent(scope));
  }
  function displayedCodes(section, state){
    if(section.getAttribute('data-promo-calendar') !== 'true') return state.codes;
    return state.codes.filter(p => isEventScope(p.scope));
  }
  function currentEventId(section){ return String(section.getAttribute('data-current-event-id') || '').trim(); }
  function currentScope(section, state){
    if(section.getAttribute('data-promo-calendar') === 'true'){
      const sel = section.querySelector('.promo-scope-select');
      return (sel && sel.value) || section.getAttribute('data-promo-scope') || state.scope || 'event_ticket';
    }
    return section.getAttribute('data-promo-scope') || state.scope || 'all';
  }
  function eventTargetLabel(p){
    if(!isEventScope(p.scope)) return '';
    if(Array.isArray(p.eventIds) && p.eventIds.length) return p.eventIds.length === 1 ? 'Cet événement' : p.eventIds.length + ' événements précis';
    return p.scope === 'stage_registration' ? 'Tous les stages' : 'Tous les spectacles / événements';
  }

  function isShopScope(scope){ return scope === 'shop_order'; }
  function isSeasonScope(scope){ return scope === 'season_registration'; }

  function normalizedRows(raw){
    if(Array.isArray(raw)) return raw;
    if(raw && typeof raw === 'object') return Object.entries(raw).map(([id, row]) => Object.assign({ id }, row || {}));
    return [];
  }
  function selectedValues(section, selector){
    return Array.from(section.querySelectorAll(selector + ':checked')).map(input => String(input.value || '').trim()).filter(Boolean);
  }
  function renderPicker(box, rows, selected, opts){
    if(!box) return;
    opts = opts || {};
    const selectedSet = new Set(Array.isArray(selected) ? selected.map(String) : []);
    if(opts.loading){ box.innerHTML = '<div class="promo-picker-empty">Chargement…</div>'; return; }
    if(opts.error){ box.innerHTML = '<div class="promo-picker-empty bad">Impossible de charger : ' + esc(opts.error) + '</div>'; return; }
    if(!rows.length){ box.innerHTML = '<div class="promo-picker-empty">' + esc(opts.empty || 'Aucun élément disponible.') + '</div>'; return; }
    const cls = opts.checkClass || 'promo-target-check';
    box.innerHTML = rows.map(row => {
      const id = String(row.id || row.key || '');
      const name = row.name || row.title || row.label || id;
      const meta = row.meta || '';
      return '<label class="promo-target-option"><input type="checkbox" class="' + esc(cls) + '" value="' + esc(id) + '" ' + (selectedSet.has(id) ? 'checked' : '') + '><span><strong>' + esc(name) + '</strong>' + (meta ? '<small>' + esc(meta) + '</small>' : '') + '</span></label>';
    }).join('');
  }

  function shopProductRows(state){
    const products = Array.isArray(state.products) ? state.products : [];
    return products.filter(p => p && p.active !== false && !String(p.category || '').startsWith('__PIECES__:')).sort((a,b) => Number(a.order || 999) - Number(b.order || 999) || String(a.name || a.title || '').localeCompare(String(b.name || b.title || ''), 'fr'));
  }
  function renderShopProductPicker(section, selected){
    const box = section.querySelector('.promo-products-picker');
    if(!box) return;
    const state = section.__promoState || {};
    const rows = shopProductRows(state).map(product => ({
      id:String(product.id || product.productId || ''),
      name:product.name || product.title || product.id || '',
      meta:[product.category || '', product.priceCents ? euro(product.priceCents) : '', product.stock ? ('Stock ' + product.stock) : 'Stock non limité'].filter(Boolean).join(' · ')
    })).filter(r => r.id);
    renderPicker(box, rows, selected, { loading:state.productsLoading, error:state.productsError, empty:'Aucun article boutique disponible.', checkClass:'promo-product-check' });
  }
  function selectedShopProductIds(section){ return selectedValues(section, '.promo-product-check'); }
  async function loadShopProducts(section){
    const state = section.__promoState || {};
    if(state.productsLoaded || state.productsLoading) return;
    const box = section.querySelector('.promo-products-picker');
    if(!box) return;
    state.productsLoading = true; state.productsError = '';
    renderShopProductPicker(section, []);
    try{
      const data = await api('/admin/catalog');
      const raw = data && data.products || {};
      state.products = normalizedRows(raw);
      state.productsLoaded = true;
    }catch(e){ state.productsError = e && e.message || 'erreur'; state.products = []; }
    finally{ state.productsLoading = false; renderShopProductPicker(section, state.pendingProductIds || []); }
  }

  function seasonActivityRows(state){
    const season = state.season || {};
    return (Array.isArray(season.items) ? season.items : []).filter(a => a && a.active !== false).map(a => ({
      id:String(a.id || ''),
      name:a.name || a.label || a.id || '',
      meta:Array.isArray(a.offers) && a.offers.length ? (a.offers.length + ' formule(s)') : ''
    })).filter(r => r.id);
  }
  function selectedSeasonActivityIds(section){ return selectedValues(section, '.promo-activity-check'); }
  function selectedSeasonOfferKeys(section){ return selectedValues(section, '.promo-offer-check'); }
  function selectedSeasonSubcategoryIds(section){ return selectedValues(section, '.promo-subcat-check'); }
  function uniqueById(rows){
    const seen = new Set();
    return rows.filter(r => { const id = String(r.id || ''); if(!id || seen.has(id)) return false; seen.add(id); return true; });
  }
  function seasonOfferRows(section){
    const state = section.__promoState || {};
    const selectedActs = selectedSeasonActivityIds(section);
    const items = Array.isArray(state.season && state.season.items) ? state.season.items : [];
    const pool = selectedActs.length ? items.filter(a => selectedActs.includes(String(a.id || ''))) : items;
    const rows = [];
    pool.forEach(a => (Array.isArray(a.offers) ? a.offers : []).forEach(o => {
      const id = String(o && (o.key || o.id || o.name || o.label) || '').trim();
      if(!id) return;
      rows.push({ id, name:o.label || o.name || id, meta:a.name || a.id || '' });
    }));
    return uniqueById(rows).sort((a,b) => String(a.name).localeCompare(String(b.name),'fr'));
  }
  function seasonSubcatRows(section){
    const state = section.__promoState || {};
    const selectedActs = selectedSeasonActivityIds(section);
    const items = Array.isArray(state.season && state.season.items) ? state.season.items : [];
    const pool = selectedActs.length ? items.filter(a => selectedActs.includes(String(a.id || ''))) : items;
    const rows = [];
    pool.forEach(a => {
      const subcats = normalizedRows(a.subcats || a.subcategories || []);
      subcats.forEach(sc => {
        const id = String(sc.key || sc.id || sc.name || '').trim();
        if(!id) return;
        rows.push({ id, name:sc.name || sc.label || id, meta:a.name || a.id || '' });
      });
    });
    return uniqueById(rows).sort((a,b) => String(a.name).localeCompare(String(b.name),'fr'));
  }
  function renderSeasonPickers(section, selected){
    selected = selected || {};
    const state = section.__promoState || {};
    renderPicker(section.querySelector('.promo-activities-picker'), seasonActivityRows(state), selected.activityIds || [], { loading:state.seasonLoading, error:state.seasonError, empty:'Aucune activité Saison disponible.', checkClass:'promo-activity-check' });
    renderPicker(section.querySelector('.promo-offers-picker'), seasonOfferRows(section), selected.offerKeys || [], { loading:state.seasonLoading, error:state.seasonError, empty:'Aucune formule disponible.', checkClass:'promo-offer-check' });
    renderPicker(section.querySelector('.promo-subcats-picker'), seasonSubcatRows(section), selected.subcategoryIds || [], { loading:state.seasonLoading, error:state.seasonError, empty:'Aucun groupe précis disponible.', checkClass:'promo-subcat-check' });
  }
  async function loadSeasonConfig(section){
    const state = section.__promoState || {};
    if(state.seasonLoaded || state.seasonLoading) return;
    if(!section.querySelector('.promo-activities-picker')) return;
    state.seasonLoading = true; state.seasonError = '';
    renderSeasonPickers(section, {});
    try{ state.season = await dbGet('fts_saison/config') || {}; state.seasonLoaded = true; }
    catch(e){ state.seasonError = e && e.message || 'erreur'; state.season = {}; }
    finally{ state.seasonLoading = false; renderSeasonPickers(section, state.pendingSeason || {}); }
  }

  function eventRows(state){
    const rows = (Array.isArray(state.events) ? state.events : []).filter(e => e && e.active !== false && e.visible !== false).map(e => {
      const date = e.dateLabel || e.date || e.d || '';
      const hour = e.hour || e.h || e.time || '';
      const type = e.paymentType || e.saleType || e.type || '';
      const price = e.priceCents ? euro(e.priceCents) : (e.price ? String(e.price) : '');
      return { id:String(e.id || ''), name:e.title || e.name || e.n || e.id || '', meta:[date, hour, type, price].filter(Boolean).join(' · ') };
    }).filter(r => r.id);
    return rows.sort((a,b) => String(a.meta).localeCompare(String(b.meta),'fr') || String(a.name).localeCompare(String(b.name),'fr'));
  }
  function selectedEventIds(section){ return selectedValues(section, '.promo-event-check'); }
  function renderEventPicker(section, selected){
    const state = section.__promoState || {};
    renderPicker(section.querySelector('.promo-events-picker'), eventRows(state), selected || [], { loading:state.eventsLoading, error:state.eventsError, empty:'Aucun événement disponible.', checkClass:'promo-event-check' });
  }
  async function loadEvents(section){
    const state = section.__promoState || {};
    if(state.eventsLoaded || state.eventsLoading) return;
    if(!section.querySelector('.promo-events-picker')) return;
    state.eventsLoading = true; state.eventsError = '';
    renderEventPicker(section, []);
    try{
      const raw = await dbGet('fts_events') || {};
      state.events = normalizedRows(raw);
      state.eventsLoaded = true;
    }catch(e){ state.eventsError = e && e.message || 'erreur'; state.events = []; }
    finally{ state.eventsLoading = false; renderEventPicker(section, state.pendingEventIds || []); }
  }


  function buildSection(section){
    if(section.__promoBuilt) return;
    section.__promoBuilt = true;
    const initialScope = section.getAttribute('data-promo-scope') || 'all';
    const isCalendar = section.getAttribute('data-promo-calendar') === 'true';
    section.innerHTML = `<div class="promo-head"><div><div class="mini-title">Codes promo & spéciaux</div><h2>${esc(titleForScope(isCalendar ? 'event_stage' : initialScope))}</h2><p>Réductions, gratuité via code, ou paiement hors ligne chèque / espèces. Le Worker vérifie toujours le code au paiement.</p></div><button type="button" class="btn-outline promo-refresh">Actualiser</button></div>
      <div class="promo-grid">
        ${isCalendar ? '<label>Valable pour<select class="promo-scope-select"><option value="event_ticket">Spectacle / événement</option><option value="stage_registration">Stage</option></select></label>' : ''}
        <label>Code<input class="promo-code" placeholder="INVITE100"></label>
        <label>Nom interne<input class="promo-label" placeholder="Invitation / règlement hors ligne"></label>
        <label>Type<select class="promo-kind"><option value="percent">Pourcentage</option><option value="fixed">Montant fixe €</option><option value="free">Gratuité</option><option value="offline_payment">Paiement hors ligne</option></select></label>
        <label>Valeur<input class="promo-value" type="number" step="0.01" placeholder="10 ou 20"></label>
        <label>Date début<input class="promo-start" type="date"></label>
        <label>Date fin<input class="promo-end" type="date"></label>
        <label>Utilisations max<input class="promo-max" type="number" min="0" step="1" placeholder="0 = illimité"></label>
        <label>Mode hors ligne<input class="promo-offline" placeholder="Chèque ou espèces"></label>
        <label class="promo-check"><input class="promo-active" type="checkbox" checked> Actif</label>
        <label class="promo-check"><input class="promo-public" type="checkbox"> Visible publiquement</label>
      </div>
      <div class="promo-targets">
        ${initialScope === 'season_registration' ? '<div class="promo-picker-wrap"><div class="promo-picker-title">Activités autorisées</div><small>Coche les activités concernées. Si rien n’est coché, le code est valable sur toute la Saison.</small><div class="promo-activities-picker"><div class="promo-picker-empty">Chargement des activités…</div></div></div><div class="promo-picker-wrap"><div class="promo-picker-title">Formules autorisées</div><small>Coche les formules concernées. Si rien n’est coché, toutes les formules restent autorisées.</small><div class="promo-offers-picker"><div class="promo-picker-empty">Chargement des formules…</div></div></div><div class="promo-picker-wrap"><div class="promo-picker-title">Groupes autorisés</div><small>Optionnel. Si rien n’est coché, tous les groupes restent autorisés.</small><div class="promo-subcats-picker"><div class="promo-picker-empty">Chargement des groupes…</div></div></div>' : ''}
        ${initialScope === 'shop_order' ? '<div class="promo-picker-wrap"><div class="promo-picker-title">Produits autorisés</div><small>Coche les articles concernés. Si rien n’est coché, le code est valable sur toute la boutique.</small><div class="promo-products-picker"><div class="promo-picker-empty">Chargement des articles…</div></div></div>' : ''}
        ${isCalendar ? '<div class="promo-picker-wrap"><div class="promo-picker-title">Événements autorisés</div><small>Coche les événements concernés. Si rien n’est coché, le code est valable sur tous les événements du type choisi.</small><div class="promo-events-picker"><div class="promo-picker-empty">Chargement des événements…</div></div></div>' : (isEventScope(initialScope) ? '<div class="promo-picker-wrap"><div class="promo-picker-title">Événements autorisés</div><small>Coche les événements concernés. Si rien n’est coché, le code est valable sur tous les événements.</small><div class="promo-events-picker"><div class="promo-picker-empty">Chargement des événements…</div></div></div>' : '')}
      </div>
      <div class="promo-actions"><button type="button" class="btn-gold promo-save">Enregistrer le code</button><button type="button" class="btn-outline promo-reset">Nouveau</button></div>
      <div class="promo-msg"></div><div class="promo-list"><div class="empty">Chargement…</div></div>`;

    const st = { scope:initialScope, codes:[] };
    section.__promoState = st;
    const q = s => section.querySelector(s);

    function setScope(scope){
      if(q('.promo-scope-select')) q('.promo-scope-select').value = scope || 'event_ticket';
      section.setAttribute('data-promo-scope', scope || 'event_ticket');
      st.scope = scope || 'event_ticket';
    }
    function fill(p){
      const scope = (p && p.scope) || currentScope(section, st);
      setScope(scope);
      q('.promo-code').value = p && p.code || '';
      q('.promo-label').value = p && p.label || '';
      q('.promo-kind').value = p && p.kind || 'percent';
      q('.promo-value').value = p && (p.kind === 'fixed' ? Number(p.value || 0) / 100 : p.value) || '';
      q('.promo-start').value = dateFromMs(p && p.startsAt);
      q('.promo-end').value = dateFromMs(p && p.endsAt);
      q('.promo-max').value = p && p.maxUses || '';
      q('.promo-offline').value = p && p.offlineMethod || '';
      q('.promo-active').checked = !p || p.active !== false;
      q('.promo-public').checked = !!(p && p.publicVisible);
      if(isShopScope(initialScope)){
        st.pendingProductIds = Array.isArray(p && p.productIds) ? p.productIds.map(String) : [];
        renderShopProductPicker(section, st.pendingProductIds);
        loadShopProducts(section);
      }
      if(isSeasonScope(initialScope)){
        st.pendingSeason = {
          activityIds:Array.isArray(p && p.activityIds) ? p.activityIds.map(String) : [],
          offerKeys:Array.isArray(p && p.offerKeys) ? p.offerKeys.map(String) : [],
          subcategoryIds:Array.isArray(p && p.subcategoryIds) ? p.subcategoryIds.map(String) : []
        };
        renderSeasonPickers(section, st.pendingSeason);
        loadSeasonConfig(section);
      }
      if(isCalendar || section.querySelector('.promo-events-picker')){
        st.pendingEventIds = Array.isArray(p && p.eventIds) ? p.eventIds.map(String) : [];
        renderEventPicker(section, st.pendingEventIds);
        loadEvents(section);
      }
      refreshContext(section);
    }
    async function load(){
      try{
        q('.promo-list').innerHTML = '<div class="empty">Chargement…</div>';
        const data = await api('/admin/promo-codes' + scopeQueryFor(section, currentScope(section, st)));
        st.codes = data.codes || [];
        renderList();
      }catch(e){
        q('.promo-list').innerHTML = '<div class="empty">Impossible de charger les codes : ' + esc(e.message) + '</div>';
      }
    }
    function kindLabel(p){
      const k = p.kind || p.type;
      if(k === 'fixed') return '-' + euro(p.value);
      if(k === 'percent') return '-' + Number(p.value || 0) + '%';
      if(k === 'free') return 'Gratuité';
      if(k === 'offline_payment') return 'Paiement hors ligne';
      return k || '';
    }
    function renderList(){
      const codes = displayedCodes(section, st);
      q('.promo-list').innerHTML = codes.length ? codes.map(p => `<div class="promo-row"><div><strong>${esc(p.code)}</strong><span>${esc(p.label || '')} · ${esc(kindLabel(p))}${isCalendar ? ' · ' + esc(eventTargetLabel(p)) : ''}</span><small>${p.active === false ? 'Inactif' : 'Actif'} · utilisé ${Number(p.usedCount || 0)}${p.maxUses ? '/' + Number(p.maxUses) : ''}${p.endsAt ? ' · fin ' + esc(dateFromMs(p.endsAt)) : ''}</small></div><div><button type="button" class="btn-outline promo-edit" data-code="${esc(p.code)}">Modifier</button><button type="button" class="btn-outline danger promo-del" data-code="${esc(p.code)}">Supprimer</button></div></div>`).join('') : '<div class="empty">Aucun code pour ce contexte.</div>';
    }
    async function save(){
      const code = q('.promo-code').value.trim();
      if(!code){ q('.promo-msg').textContent = 'Code obligatoire.'; return; }
      const kind = q('.promo-kind').value;
      const valueRaw = Number(String(q('.promo-value').value || '0').replace(',','.')) || 0;
      const scope = currentScope(section, st);
      let eventIds = section.querySelector('.promo-events-picker') ? selectedEventIds(section) : [];
      const body = {
        code,
        label:q('.promo-label').value,
        kind,
        scope,
        active:q('.promo-active').checked,
        publicVisible:q('.promo-public').checked,
        value:kind === 'fixed' ? Math.round(valueRaw * 100) : valueRaw,
        startsAt:msFromDate(q('.promo-start').value, false),
        endsAt:msFromDate(q('.promo-end').value, true),
        maxUses:Number(q('.promo-max').value || 0) || 0,
        offlineMethod:q('.promo-offline').value,
        productIds:isShopScope(initialScope) ? selectedShopProductIds(section) : [],
        eventIds,
        activityIds:isSeasonScope(initialScope) ? selectedSeasonActivityIds(section) : [],
        offerKeys:isSeasonScope(initialScope) ? selectedSeasonOfferKeys(section) : [],
        subcategoryIds:isSeasonScope(initialScope) ? selectedSeasonSubcategoryIds(section) : []
      };
      try{
        q('.promo-msg').textContent = 'Enregistrement…';
        await api('/admin/promo-codes/save', { method:'POST', body:JSON.stringify(body) });
        q('.promo-msg').textContent = 'Code enregistré.';
        fill(null);
        await load();
      }catch(e){ q('.promo-msg').textContent = 'Erreur : ' + e.message; }
    }
    section.addEventListener('change', e => {
      if(e.target.closest('.promo-scope-select')){
        setScope(e.target.value);
        load();
      }
      if(e.target.closest('.promo-activity-check')){
        const state = section.__promoState || {};
        state.pendingSeason = {
          activityIds:selectedSeasonActivityIds(section),
          offerKeys:selectedSeasonOfferKeys(section),
          subcategoryIds:selectedSeasonSubcategoryIds(section)
        };
        renderSeasonPickers(section, state.pendingSeason);
      }
    });
    section.addEventListener('click', async e => {
      if(e.target.closest('.promo-refresh')) load();
      if(e.target.closest('.promo-reset')){ fill(null); q('.promo-msg').textContent = ''; }
      if(e.target.closest('.promo-save')) save();
      const edit = e.target.closest('.promo-edit');
      if(edit){ const p = st.codes.find(x => x.code === edit.getAttribute('data-code')); fill(p); }
      const del = e.target.closest('.promo-del');
      if(del){
        const code = del.getAttribute('data-code');
        if(confirm('Supprimer le code ' + code + ' ?')){
          await api('/admin/promo-codes/delete', { method:'POST', body:JSON.stringify({ code }) });
          await load();
        }
      }
    });
    refreshContext(section);
    if(isShopScope(initialScope)) loadShopProducts(section);
    if(isSeasonScope(initialScope)) loadSeasonConfig(section);
    if(isCalendar || section.querySelector('.promo-events-picker')) loadEvents(section);
    load();
  }

  function refreshContext(section){
    if(!section || section.getAttribute('data-promo-calendar') !== 'true') return;
    const state = section.__promoState || {};
    const scope = section.getAttribute('data-promo-scope') || state.scope || 'event_ticket';
    const sel = section.querySelector('.promo-scope-select');
    if(sel && sel.value !== scope) sel.value = scope;
    state.scope = scope;
    renderEventPicker(section, state.pendingEventIds || []);
  }
  function init(){
    document.querySelectorAll('[data-promo-admin]').forEach(buildSection);
  }
  window.FTSPromoAdmin = { init, refreshContext };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
