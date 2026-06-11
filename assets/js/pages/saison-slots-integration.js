/* ================================================================
   SAISON-SLOTS-INTEGRATION.JS
   Branche le module FTSSlots à saison.html sans modifier le Worker.
   ================================================================ */

(function(){
  'use strict';

  if(!window.FTSSlots){
    console.warn('[FTS Slots Saison] Module FTSSlots non chargé.');
    return;
  }

  const Slots = window.FTSSlots;
  const esc = (v) => (window.FTS && FTS.esc ? FTS.esc(v == null ? '' : v) : String(v == null ? '' : v));
  const norm = (v) => (window.FTS && FTS.norm ? FTS.norm(v || '') : String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));

  const CONFIG = {
    instrumentsPool: 'instruments_individuels',
    chantPianoPool: 'chant_piano_individuels'
  };

  function textParts(value, out){
    out = out || [];
    if(value == null) return out;
    if(typeof value === 'string' || typeof value === 'number'){
      out.push(String(value));
      return out;
    }
    if(Array.isArray(value)){
      value.forEach(v => textParts(v, out));
      return out;
    }
    if(typeof value === 'object'){
      ['id','key','name','title','label','main','subtitle','description','priceNote','activity','slotActivity','day','time'].forEach(k => {
        if(value[k] != null) textParts(value[k], out);
      });
      if(value.bullets) textParts(value.bullets, out);
    }
    return out;
  }

  function offerText(offer){
    return textParts(offer || {}).join(' ').toLowerCase();
  }

  function inferDuration(offer){
    if(offer && Number(offer.slotDurationMinutes)) return Number(offer.slotDurationMinutes);
    if(offer && Number(offer.durationMinutes)) return Number(offer.durationMinutes);
    const text = offerText(offer);
    if(/(^|\D)(1\s*h|1\s*heure|60\s*min)/i.test(text)) return 60;
    if(/(^|\D)(30\s*min|0\s*h\s*30|demi)/i.test(text)) return 30;
    return null;
  }

  function currentSubcat(item){
    try{
      if(typeof selectedSeasonSubcat === 'function') return selectedSeasonSubcat(item) || null;
    }catch(e){ /* lecture optionnelle */ }
    return null;
  }

  function containsToken(text, token){
    const n = norm(text || '');
    const t = norm(token || '');
    return n === t || n.includes('_' + t + '_') || n.startsWith(t + '_') || n.endsWith('_' + t) || n.includes(t);
  }

  function detectActivityFromText(text){
    const n = norm(text || '');
    const checks = [
      ['batterie', ['batterie','drums']],
      ['basse', ['basse','bass']],
      ['guitare', ['guitare','guitar']],
      ['piano', ['piano']],
      ['chant', ['chant','voix','vocal']]
    ];
    for(const [activity, tokens] of checks){
      if(tokens.some(t => containsToken(n, t))) return activity;
    }
    return '';
  }

  function poolForActivity(activity){
    const a = norm(activity || '');
    if(['guitare','basse','batterie'].includes(a)) return CONFIG.instrumentsPool;
    if(['chant','piano'].includes(a)) return CONFIG.chantPianoPool;
    return '';
  }

  function explicitSlotMeta(item, offer, subcat){
    const season = item && item.season || {};
    const raw = Object.assign({}, season.slotBooking || {}, offer && offer.slotBooking || {});
    const hasExplicit = raw.enabled === true || raw.poolId || raw.activity || (offer && (offer.slotPoolId || offer.slotActivity || offer.requiresSlotBooking === true)) || season.slotPoolId || season.slotActivity || season.requiresSlotBooking === true || item && item.slotPoolId;
    if(!hasExplicit) return null;
    const specificText = textParts([offer, subcat]).join(' ');
    const genericText = textParts([item]).join(' ');
    const detected = detectActivityFromText(specificText) || detectActivityFromText(genericText);
    const activity = norm(raw.activity || offer && offer.slotActivity || season.slotActivity || item && item.slotActivity || detected || item && item.id || '');
    const forcedPool = poolForActivity(activity);
    const poolId = forcedPool || raw.poolId || offer && offer.slotPoolId || season.slotPoolId || item && item.slotPoolId;
    return {
      poolId,
      activity,
      durationMinutes: Number(raw.durationMinutes || offer && offer.slotDurationMinutes || offer && offer.durationMinutes || inferDuration(offer) || 0) || null
    };
  }

  function autoSlotMeta(item, offer, subcat){
    const id = norm(item && item.id || item && item.name || '');
    const specificText = textParts([offer, subcat]).join(' ');
    const genericText = textParts([item]).join(' ');
    const duration = inferDuration(offer);
    const specificActivity = detectActivityFromText(specificText);
    const genericActivity = detectActivityFromText(genericText);
    const itemActivity = ['guitare','basse','batterie','chant','piano'].includes(id) ? id : '';
    const activity = specificActivity || itemActivity || genericActivity;
    const forcedPool = poolForActivity(activity);
    if(forcedPool){
      return { poolId: forcedPool, activity, durationMinutes: duration };
    }
    const allText = norm([specificText, genericText, id].join(' '));
    if(id === 'musique' || containsToken(allText, 'instrument') || containsToken(allText, 'instruments')){
      return { poolId: CONFIG.instrumentsPool, activity: '', activityOptions: ['guitare','basse','batterie'], durationMinutes: duration };
    }
    return null;
  }

  function resolveSlotMeta(item, offer){
    const subcat = currentSubcat(item);
    const explicit = explicitSlotMeta(item, offer, subcat);
    const meta = explicit || autoSlotMeta(item, offer, subcat);
    if(!meta || !meta.poolId) return null;
    if(meta.activity){
      const strictPool = poolForActivity(meta.activity);
      if(strictPool) meta.poolId = strictPool;
    }
    return meta;
  }

  async function slotSystemIsEnabled(meta){
    try{
      const cfg = await Slots.loadConfig();
      if(!cfg || !cfg.enabled) return false;
      const pools = await Slots.loadPools();
      const pool = pools.find(p => p.id === meta.poolId);
      return !!(pool && pool.active !== false);
    }catch(e){
      console.warn('[FTS Slots Saison] état indisponible', e);
      return false;
    }
  }

  function getItemOffer(activityId, offerKey){
    if(typeof itemList !== 'function') return {};
    const item = itemList().find(x => String(x.id) === String(activityId));
    const offer = item && (item.offers || []).find(o => String(o.key) === String(offerKey));
    return { item, offer };
  }

  async function chooseReservation(item, offer, source){
    try{
      if(item && (item.subcats || []).length && typeof selectedSeasonSubcat === 'function' && !selectedSeasonSubcat(item)) return null;
    }catch(e){ /* la validation native de saison.js prendra le relais */ }
    const meta = resolveSlotMeta(item, offer);
    if(!meta) return null;
    const enabled = await slotSystemIsEnabled(meta);
    if(!enabled) return null;
    const reservation = await Slots.openBookingModal({
      poolId: meta.poolId,
      activity: meta.activity || '',
      activityOptions: meta.activityOptions || null,
      durationMinutes: meta.durationMinutes || null,
      source: source || 'saison'
    });
    return reservation;
  }

  function slotLineFromReservation(reservation){
    if(!reservation) return '';
    const label = reservation.label || `${reservation.dayLabel || Slots.DAY_LABELS[reservation.day] || reservation.day} ${Slots.timeLabel(reservation.start)} - ${Slots.timeLabel(reservation.end)}`;
    return `${Slots.activityLabel(reservation.activity)} · ${label}`;
  }

  function decorateSeasonLine(line, reservation){
    if(!line || !reservation) return line;
    line.slotReservationId = reservation.id;
    line.slotReservation = {
      id: reservation.id,
      poolId: reservation.poolId,
      activity: reservation.activity,
      durationMinutes: reservation.durationMinutes,
      day: reservation.day,
      start: reservation.start,
      end: reservation.end,
      label: slotLineFromReservation(reservation),
      status: reservation.status || 'pending_payment'
    };
    line.offerLabel = String(line.offerLabel || '') + ' · ' + line.slotReservation.label;
    return line;
  }

  async function enrichReservationFromForm(reservationId, form){
    if(!reservationId || !form) return;
    const first = String(form.studentFirstName && form.studentFirstName.value || '').trim();
    const last = String(form.studentLastName && form.studentLastName.value || '').trim();
    const parentFirst = String(form.firstName && form.firstName.value || '').trim();
    const parentLast = String(form.lastName && form.lastName.value || '').trim();
    const patch = {
      status: 'pending_payment',
      studentName: [first,last].filter(Boolean).join(' '),
      parentName: [parentFirst,parentLast].filter(Boolean).join(' '),
      payerEmail: String(form.email && form.email.value || '').trim(),
      payerPhone: String(form.phone && form.phone.value || '').trim(),
      note: 'À confirmer manuellement après vérification du paiement HelloAsso.'
    };
    await Slots.updateReservation(reservationId, patch).catch(e => console.warn('[FTS Slots Saison] enrichReservation', e));
  }

  function injectDirectSlotSummary(reservation){
    if(!reservation) return;
    const summary = document.getElementById('fts-pay-summary');
    if(!summary) return;
    let box = document.getElementById('fts-pay-slot-summary');
    if(!box){
      box = document.createElement('div');
      box.id = 'fts-pay-slot-summary';
      box.className = 'fts-slots-booking-summary is-visible';
      summary.insertAdjacentElement('afterend', box);
    }
    box.textContent = 'Créneau réservé : ' + slotLineFromReservation(reservation) + ' · à confirmer après paiement.';
  }

  const originalAddSeasonToCart = window.addSeasonToCart;
  if(typeof originalAddSeasonToCart === 'function'){
    window.addSeasonToCart = async function(activityId, offerKey){
      try{
        const { item, offer } = getItemOffer(activityId, offerKey);
        const reservation = item && offer ? await chooseReservation(item, offer, 'saison_cart') : null;
        if(!reservation) return originalAddSeasonToCart.apply(this, arguments);
        if(typeof loadCart !== 'function' || typeof seasonLineFrom !== 'function' || typeof saveCart !== 'function' || typeof openSeasonCart !== 'function'){
          return originalAddSeasonToCart.apply(this, arguments);
        }
        loadCart();
        const line = decorateSeasonLine(seasonLineFrom(activityId, offerKey), reservation);
        ftsSeasonCart.season.push(line);
        saveCart();
        openSeasonCart();
      }catch(e){
        alert(e && e.message ? e.message : e);
      }
    };
  }

  const originalOpenSeasonPayment = window.openSeasonPayment;
  if(typeof originalOpenSeasonPayment === 'function'){
    window.openSeasonPayment = async function(activityId, offerKey){
      try{
        const { item, offer } = getItemOffer(activityId, offerKey);
        const reservation = item && offer ? await chooseReservation(item, offer, 'saison_direct') : null;
        window.FTSSlotsCurrentDirectReservation = reservation || null;
        originalOpenSeasonPayment.apply(this, arguments);
        if(reservation) setTimeout(() => injectDirectSlotSummary(reservation), 0);
      }catch(e){
        alert(e && e.message ? e.message : e);
      }
    };
  }

  const originalSubmitSeasonPayment = window.submitSeasonPayment;
  if(typeof originalSubmitSeasonPayment === 'function'){
    window.submitSeasonPayment = async function(event){
      const reservation = window.FTSSlotsCurrentDirectReservation;
      if(reservation && reservation.id){
        await enrichReservationFromForm(reservation.id, event && event.target);
      }
      return originalSubmitSeasonPayment.apply(this, arguments);
    };
  }

  const originalSubmitMixedCart = window.submitMixedCart;
  if(typeof originalSubmitMixedCart === 'function'){
    window.submitMixedCart = async function(event){
      try{
        if(typeof loadCart === 'function') loadCart();
        const form = event && event.target;
        const lines = (typeof ftsSeasonCart !== 'undefined' && ftsSeasonCart.season) ? ftsSeasonCart.season : [];
        for(const line of lines){
          if(line && line.slotReservationId) await enrichReservationFromForm(line.slotReservationId, form);
        }
      }catch(e){
        console.warn('[FTS Slots Saison] cart reservations', e);
      }
      return originalSubmitMixedCart.apply(this, arguments);
    };
  }

  const originalRemoveCartLine = window.removeCartLine;
  if(typeof originalRemoveCartLine === 'function'){
    window.removeCartLine = async function(kind, id){
      try{
        if(kind === 'season' && typeof loadCart === 'function'){
          loadCart();
          const line = (ftsSeasonCart.season || []).find(x => String(x.id) === String(id));
          if(line && line.slotReservationId) await Slots.cancelReservation(line.slotReservationId).catch(() => {});
        }
      }catch(e){ console.warn('[FTS Slots Saison] cancel slot on remove', e); }
      return originalRemoveCartLine.apply(this, arguments);
    };
  }

  window.FTSSlotsIntegration = {
    resolveSlotMeta,
    chooseReservation,
    slotLineFromReservation
  };
})();
