(function(window){
  'use strict';
  const FTS = window.FTS = window.FTS || {};
  const esc = v => FTS.esc ? FTS.esc(v == null ? '' : v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const euro = c => (Number(c || 0) / 100).toLocaleString('fr-FR', { style:'currency', currency:'EUR' });
  const worker = () => String((FTS.PAYMENT && FTS.PAYMENT.workerUrl) || 'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/, '');

  function currentAuth(){
    return window.firebase && firebase.auth ? firebase.auth() : null;
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
        ${initialScope === 'season_registration' ? '<label>Activités autorisées <small>IDs séparés par virgule, vide = toutes</small><input class="promo-activities" placeholder="theatre, danse"></label><label>Formules autorisées<input class="promo-offers" placeholder="loisir, perf"></label><label>Groupes autorisés<input class="promo-subcats" placeholder="baby_show, adultes"></label>' : ''}
        ${initialScope === 'shop_order' ? '<label>Produits autorisés <small>IDs séparés par virgule, vide = toute boutique</small><input class="promo-products" placeholder="tshirt, mug"></label>' : ''}
        ${isCalendar ? '<label class="promo-current-event"><span>Portée du code</span><select class="promo-event-mode"><option value="current">Cet événement uniquement</option><option value="all_scope">Tous les événements du type choisi</option></select><small class="promo-current-event-help">Sélectionne d’abord un événement existant pour utiliser “Cet événement uniquement”.</small></label>' : (isEventScope(initialScope) ? '<label>Événements autorisés <small>IDs séparés par virgule, vide = tous</small><input class="promo-events" placeholder="eventId"></label>' : '')}
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
      if(q('.promo-products')) q('.promo-products').value = csv(p && p.productIds);
      if(q('.promo-events')) q('.promo-events').value = csv(p && p.eventIds);
      if(q('.promo-activities')) q('.promo-activities').value = csv(p && p.activityIds);
      if(q('.promo-offers')) q('.promo-offers').value = csv(p && p.offerKeys);
      if(q('.promo-subcats')) q('.promo-subcats').value = csv(p && p.subcategoryIds);
      if(q('.promo-event-mode')){
        q('.promo-event-mode').value = p && Array.isArray(p.eventIds) && p.eventIds.length ? 'current' : 'all_scope';
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
      let eventIds = q('.promo-events') ? list(q('.promo-events').value) : [];
      if(isCalendar && q('.promo-event-mode') && q('.promo-event-mode').value === 'current'){
        const id = currentEventId(section);
        if(!id){ q('.promo-msg').textContent = 'Enregistre ou sélectionne d’abord un événement pour limiter le code à cet événement.'; return; }
        eventIds = [id];
      }
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
        productIds:q('.promo-products') ? list(q('.promo-products').value) : [],
        eventIds,
        activityIds:q('.promo-activities') ? list(q('.promo-activities').value) : [],
        offerKeys:q('.promo-offers') ? list(q('.promo-offers').value) : [],
        subcategoryIds:q('.promo-subcats') ? list(q('.promo-subcats').value) : []
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
      if(e.target.closest('.promo-event-mode')) refreshContext(section);
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
    load();
  }

  function refreshContext(section){
    if(!section || section.getAttribute('data-promo-calendar') !== 'true') return;
    const state = section.__promoState || {};
    const scope = section.getAttribute('data-promo-scope') || state.scope || 'event_ticket';
    const sel = section.querySelector('.promo-scope-select');
    if(sel && sel.value !== scope) sel.value = scope;
    state.scope = scope;
    const eventId = currentEventId(section);
    const help = section.querySelector('.promo-current-event-help');
    if(help){
      help.textContent = eventId ? 'Cet événement : ' + eventId : 'Sélectionne ou enregistre d’abord un événement pour limiter le code à celui-ci.';
    }
  }
  function init(){
    document.querySelectorAll('[data-promo-admin]').forEach(buildSection);
  }
  window.FTSPromoAdmin = { init, refreshContext };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
