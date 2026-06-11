/* ================================================================
   FTS-SLOTS.JS — Module autonome de créneaux individuels
   - Ne dépend pas du Worker HelloAsso.
   - Fonctionne avec Firebase RTDB.
   - Pools partagés : instruments, chant/piano, etc.
   ================================================================ */

(function(){
  'use strict';

  window.FTS = window.FTS || {};
  const FTS = window.FTS;
  const esc = (value) => (FTS.esc ? FTS.esc(value == null ? '' : value) : String(value == null ? '' : value));
  const norm = (value) => (FTS.norm ? FTS.norm(value || '') : String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));

  const DAY_LABELS = {
    monday: 'Lundi',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
    thursday: 'Jeudi',
    friday: 'Vendredi',
    saturday: 'Samedi',
    sunday: 'Dimanche'
  };

  const DEFAULT_CONFIG = {
    enabled: false,
    season: '2026/2027',
    holdDurationMinutes: 25,
    updatedAt: 0
  };

  const DEFAULT_POOLS = {
    instruments_individuels: {
      label: 'Instruments individuels',
      active: true,
      teacherLabel: 'Prof instruments',
      capacity: 1,
      activities: ['guitare','basse','batterie'],
      durations: [30,60],
      order: 10
    },
    chant_piano_individuels: {
      label: 'Chant / Piano',
      active: false,
      teacherLabel: 'Prof chant / piano',
      capacity: 1,
      activities: ['chant','piano'],
      durations: [30,60],
      order: 20
    }
  };

  const DEFAULT_WINDOWS = {
    instruments_lundi_14_21: {
      poolId: 'instruments_individuels',
      label: 'Instruments — lundi après-midi/soir',
      day: 'monday',
      start: '14:00',
      end: '21:00',
      activities: ['guitare','basse','batterie'],
      durations: [30,60],
      active: true,
      type: 'regular',
      order: 10
    },
    instruments_jeudi_14_21: {
      poolId: 'instruments_individuels',
      label: 'Instruments — jeudi après-midi/soir',
      day: 'thursday',
      start: '14:00',
      end: '21:00',
      activities: ['guitare','basse','batterie'],
      durations: [30,60],
      active: true,
      type: 'regular',
      order: 20
    }
  };

  function db(){ return FTS.initFirebase ? FTS.initFirebase() : (window.firebase && firebase.database ? firebase.database() : null); }
  function authUser(){ return window.firebase && firebase.auth ? firebase.auth().currentUser : null; }
  function now(){ return Date.now(); }
  function seasonKey(season){ return norm(season || DEFAULT_CONFIG.season || 'saison'); }
  function toArray(value){
    if(Array.isArray(value)) return value.filter(Boolean).map(String);
    if(value && typeof value === 'object') return Object.values(value).filter(Boolean).map(String);
    return String(value || '').split(',').map(x => x.trim()).filter(Boolean);
  }
  function toNumberArray(value){ return toArray(value).map(Number).filter(n => Number.isFinite(n) && n > 0); }
  function minutesFromTime(time){
    const m = String(time || '').trim().match(/^(\d{1,2})[:hH](\d{2})$/);
    if(!m) return null;
    const h = Number(m[1]), min = Number(m[2]);
    if(h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }
  function timeFromMinutes(total){
    const h = Math.floor(total / 60);
    const m = total % 60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  }
  function timeLabel(time){ return String(time || '').replace(':','h'); }
  function endTime(start, duration){
    const s = minutesFromTime(start);
    return s == null ? '' : timeFromMinutes(s + Number(duration || 0));
  }
  function atomKey(day, time){ return norm(day) + '_' + String(time || '').replace(':','_'); }
  function atomsFor(day, start, duration){
    const out = [];
    const s = minutesFromTime(start);
    const d = Number(duration || 30);
    if(s == null || !Number.isFinite(d) || d <= 0 || d % 30 !== 0) return out;
    for(let t = s; t < s + d; t += 30) out.push(atomKey(day, timeFromMinutes(t)));
    return out;
  }
  function activityLabel(value){
    const labels = { guitare:'Guitare', basse:'Basse', batterie:'Batterie', chant:'Chant', piano:'Piano', musique:'Musique' };
    return labels[norm(value)] || String(value || '').replace(/_/g,' ').replace(/^./, c => c.toUpperCase());
  }
  function statusLabel(value){
    const labels = { held:'Réservé temporairement', pending_payment:'Paiement à vérifier', confirmed:'Confirmé', cancelled:'Annulé', expired:'Expiré', blocked:'Bloqué' };
    return labels[String(value || '')] || String(value || '—');
  }
  function isActiveStatus(status){ return ['held','pending_payment','confirmed','blocked'].includes(String(status || '')); }
  function isExpired(item){ return Number(item && item.expiresAt || 0) > 0 && Number(item.expiresAt) < now() && String(item.status || '') !== 'confirmed' && String(item.status || '') !== 'blocked'; }
  function reservationIsBlocking(item){ return item && isActiveStatus(item.status) && !isExpired(item); }
  function slotLabel(slot){ return `${DAY_LABELS[slot.day] || slot.day} ${timeLabel(slot.start)} - ${timeLabel(slot.end)}`; }
  function sortByDayTime(a,b){
    const order = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const da = order.indexOf(a.day), dbi = order.indexOf(b.day);
    if(da !== dbi) return (da < 0 ? 99 : da) - (dbi < 0 ? 99 : dbi);
    return (minutesFromTime(a.start) || 0) - (minutesFromTime(b.start) || 0);
  }
  function normalizePool(id, raw){
    raw = raw || {};
    return {
      id,
      label: raw.label || id,
      active: raw.active !== false,
      teacherLabel: raw.teacherLabel || '',
      capacity: Number(raw.capacity || 1) || 1,
      activities: toArray(raw.activities).map(norm),
      durations: toNumberArray(raw.durations).length ? toNumberArray(raw.durations) : [30],
      order: Number(raw.order || 999) || 999
    };
  }
  function normalizeWindow(id, raw){
    raw = raw || {};
    return {
      id,
      poolId: raw.poolId || '',
      label: raw.label || '',
      day: norm(raw.day || ''),
      start: raw.start || '',
      end: raw.end || '',
      activities: toArray(raw.activities).map(norm),
      durations: toNumberArray(raw.durations).length ? toNumberArray(raw.durations) : [30],
      active: raw.active !== false,
      type: raw.type || 'regular',
      order: Number(raw.order || 999) || 999
    };
  }
  function normalizeReservation(id, raw){
    raw = raw || {};
    return Object.assign({}, raw, {
      id,
      poolId: raw.poolId || '',
      activity: norm(raw.activity || ''),
      durationMinutes: Number(raw.durationMinutes || 30) || 30,
      day: norm(raw.day || ''),
      start: raw.start || '',
      end: raw.end || endTime(raw.start, raw.durationMinutes || 30),
      atoms: toArray(raw.atoms),
      status: raw.status || 'pending_payment',
      createdAt: Number(raw.createdAt || 0) || 0,
      expiresAt: Number(raw.expiresAt || 0) || 0
    });
  }

  async function getProfile(uid){
    const database = db();
    if(!database || !uid) return null;
    const snap = await database.ref('fts_users/' + uid).once('value');
    return snap.val() || null;
  }
  function canAdmin(profile){ return profile && profile.role === 'admin' && profile.status === 'active'; }
  function canProf(profile){ return profile && (profile.role === 'prof' || profile.role === 'admin') && profile.status === 'active'; }

  async function loadConfig(){
    const database = db();
    if(!database) return Object.assign({}, DEFAULT_CONFIG);
    const snap = await database.ref('fts_slots_config').once('value');
    return Object.assign({}, DEFAULT_CONFIG, snap.val() || {});
  }
  async function loadPools(){
    const database = db();
    if(!database) return Object.entries(DEFAULT_POOLS).map(([id,p]) => normalizePool(id,p));
    const snap = await database.ref('fts_slots_pools').once('value');
    const raw = snap.val() || {};
    const base = Object.keys(raw).length ? raw : DEFAULT_POOLS;
    return Object.entries(base).map(([id,p]) => normalizePool(id,p)).sort((a,b) => a.order - b.order || a.label.localeCompare(b.label,'fr'));
  }
  async function loadWindows(){
    const database = db();
    if(!database) return Object.entries(DEFAULT_WINDOWS).map(([id,w]) => normalizeWindow(id,w));
    const snap = await database.ref('fts_slots_windows').once('value');
    const raw = snap.val() || {};
    const base = raw;
    return Object.entries(base).map(([id,w]) => normalizeWindow(id,w)).sort((a,b) => a.order - b.order || sortByDayTime(a,b));
  }

  async function loadLocks(skey, poolId){
    const database = db();
    if(!database || !skey || !poolId) return [];
    const snap = await database.ref('fts_slots_locks/' + skey + '/' + poolId).once('value');
    const out = [];
    snap.forEach(child => {
      const value = child.val() || {};
      out.push(Object.assign({ atom: child.key }, value));
    });
    return out;
  }

  async function loadReservations(){
    const database = db();
    if(!database) return [];
    const snap = await database.ref('fts_slots_reservations').once('value');
    const out = [];
    snap.forEach(child => out.push(normalizeReservation(child.key, child.val())));
    return out.sort(sortByDayTime);
  }

  async function saveConfig(data){
    const database = db();
    if(!database) throw new Error('Firebase indisponible.');
    await database.ref('fts_slots_config').update(Object.assign({}, data, { updatedAt: firebase.database.ServerValue.TIMESTAMP }));
  }
  async function savePool(id, data){
    const database = db();
    if(!database) throw new Error('Firebase indisponible.');
    id = norm(id || data.id || data.label);
    if(!id) throw new Error('Identifiant pool manquant.');
    const payload = Object.assign({}, data);
    delete payload.id;
    payload.activities = toArray(payload.activities).map(norm);
    payload.durations = toNumberArray(payload.durations);
    if(typeof payload.active === 'string') payload.active = payload.active === 'true';
    payload.updatedAt = firebase.database.ServerValue.TIMESTAMP;
    await database.ref('fts_slots_pools/' + id).update(payload);
    return id;
  }
  async function saveWindow(id, data){
    const database = db();
    if(!database) throw new Error('Firebase indisponible.');
    id = norm(id || data.id || [data.poolId, data.day, data.start, data.end].join('_'));
    if(!id) throw new Error('Identifiant plage manquant.');
    const payload = Object.assign({}, data);
    delete payload.id;
    payload.day = norm(payload.day);
    payload.activities = toArray(payload.activities).map(norm);
    payload.durations = toNumberArray(payload.durations);
    if(typeof payload.active === 'string') payload.active = payload.active === 'true';
    payload.updatedAt = firebase.database.ServerValue.TIMESTAMP;
    await database.ref('fts_slots_windows/' + id).update(payload);
    return id;
  }
  async function removeWindow(id){
    const database = db();
    if(!database) throw new Error('Firebase indisponible.');
    await database.ref('fts_slots_windows/' + id).remove();
  }
  async function seedDefaults(){
    const database = db();
    if(!database) throw new Error('Firebase indisponible.');
    const updates = {};
    const [cfgSnap, poolsSnap, windowsSnap] = await Promise.all([
      database.ref('fts_slots_config').once('value'),
      database.ref('fts_slots_pools').once('value'),
      database.ref('fts_slots_windows').once('value')
    ]);
    if(!cfgSnap.exists()) updates['fts_slots_config'] = Object.assign({}, DEFAULT_CONFIG, { updatedAt: firebase.database.ServerValue.TIMESTAMP });
    const currentPools = poolsSnap.val() || {};
    Object.entries(DEFAULT_POOLS).forEach(([id,p]) => { if(!currentPools[id]) updates['fts_slots_pools/' + id] = p; });
    const currentWindows = windowsSnap.val() || {};
    Object.entries(DEFAULT_WINDOWS).forEach(([id,w]) => { if(!currentWindows[id]) updates['fts_slots_windows/' + id] = w; });
    if(Object.keys(updates).length) await database.ref().update(updates);
  }

  function matchingWindows(windows, poolId, activity, duration){
    const act = norm(activity || '');
    return (windows || []).filter(w => {
      if(!w.active || w.poolId !== poolId) return false;
      if(w.activities.length && act && !w.activities.includes(act)) return false;
      if(w.durations.length && duration && !w.durations.includes(Number(duration))) return false;
      return minutesFromTime(w.start) != null && minutesFromTime(w.end) != null && minutesFromTime(w.end) > minutesFromTime(w.start);
    });
  }

  async function getAvailableSlots(options){
    options = options || {};
    const config = await loadConfig();
    const pools = await loadPools();
    const pool = pools.find(p => p.id === options.poolId);
    const duration = Number(options.durationMinutes || 30) || 30;
    const activity = norm(options.activity || '');
    if(!config.enabled) return { enabled:false, reason:'disabled', config, pool, slots:[] };
    if(!pool || !pool.active) return { enabled:false, reason:'pool_disabled', config, pool, slots:[] };
    if(pool.activities.length && activity && !pool.activities.includes(activity)) return { enabled:false, reason:'activity_not_allowed', config, pool, slots:[] };
    if(pool.durations.length && !pool.durations.includes(duration)) return { enabled:false, reason:'duration_not_allowed', config, pool, slots:[] };

    const windows = matchingWindows(await loadWindows(), pool.id, activity, duration);
    const locks = await loadLocks(seasonKey(config.season || DEFAULT_CONFIG.season), pool.id);
    const blockingAtoms = new Set();
    locks.forEach(lock => {
      if(lock && isActiveStatus(lock.status) && !(Number(lock.expiresAt || 0) > 0 && Number(lock.expiresAt || 0) < now() && lock.status !== 'confirmed' && lock.status !== 'blocked')) {
        blockingAtoms.add(lock.atom);
      }
    });

    const slots = [];
    windows.forEach(w => {
      const start = minutesFromTime(w.start);
      const end = minutesFromTime(w.end);
      for(let t = start; t + duration <= end; t += 30){
        const slotStart = timeFromMinutes(t);
        const slotEnd = timeFromMinutes(t + duration);
        const atoms = atomsFor(w.day, slotStart, duration);
        const available = atoms.length && atoms.every(a => !blockingAtoms.has(a));
        if(available){
          slots.push({ poolId: pool.id, poolLabel: pool.label, activity, day: w.day, start: slotStart, end: slotEnd, durationMinutes: duration, atoms, windowId: w.id, windowLabel: w.label, label: `${DAY_LABELS[w.day] || w.day} ${timeLabel(slotStart)} - ${timeLabel(slotEnd)}` });
        }
      }
    });
    slots.sort(sortByDayTime);
    return { enabled:true, config, pool, slots };
  }

  async function writeLockWithTransaction(path, payload){
    const ref = db().ref(path);
    let committed = false;
    const result = await ref.transaction(current => {
      const expired = current && Number(current.expiresAt || 0) > 0 && Number(current.expiresAt || 0) < now() && current.status !== 'confirmed' && current.status !== 'blocked';
      if(current && !expired) return;
      return payload;
    });
    committed = !!(result && result.committed);
    return committed;
  }

  async function releaseLocks(lockPaths){
    const database = db();
    if(!database || !lockPaths || !lockPaths.length) return;
    const updates = {};
    lockPaths.forEach(path => updates[path] = null);
    try { await database.ref().update(updates); } catch(e) { console.warn('[FTS Slots] releaseLocks', e); }
  }

  async function reserveSlot(options){
    options = options || {};
    const database = db();
    const user = authUser();
    if(!database) throw new Error('Firebase indisponible.');
    if(!user) throw new Error('Connecte-toi pour réserver un créneau.');
    const config = await loadConfig();
    if(!config.enabled) throw new Error('La réservation automatique est désactivée.');
    const season = options.season || config.season || DEFAULT_CONFIG.season;
    const skey = seasonKey(season);
    const duration = Number(options.durationMinutes || 30) || 30;
    const day = norm(options.day || '');
    const start = options.start || '';
    const atoms = options.atoms && options.atoms.length ? options.atoms : atomsFor(day, start, duration);
    if(!options.poolId || !day || !start || !atoms.length) throw new Error('Créneau incomplet.');
    const reservationRef = database.ref('fts_slots_reservations').push();
    const reservationId = reservationRef.key;
    const expiresAt = now() + Math.max(5, Number(config.holdDurationMinutes || 25) || 25) * 60 * 1000;
    const lockPaths = atoms.map(atom => `fts_slots_locks/${skey}/${options.poolId}/${atom}`);
    const lockPayload = {
      reservationId,
      uid: user.uid,
      status: options.status || 'pending_payment',
      poolId: options.poolId,
      activity: norm(options.activity || ''),
      day,
      start,
      durationMinutes: duration,
      expiresAt,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    const acquired = [];
    for(const path of lockPaths){
      const ok = await writeLockWithTransaction(path, lockPayload);
      if(!ok){
        await releaseLocks(acquired);
        throw new Error('Ce créneau vient d’être pris. Choisis un autre horaire.');
      }
      acquired.push(path);
    }
    const payload = {
      season,
      seasonKey: skey,
      poolId: options.poolId,
      poolLabel: options.poolLabel || '',
      activity: norm(options.activity || ''),
      activityLabel: options.activityLabel || activityLabel(options.activity),
      durationMinutes: duration,
      day,
      dayLabel: DAY_LABELS[day] || day,
      start,
      end: options.end || endTime(start, duration),
      atoms,
      status: options.status || 'pending_payment',
      uid: user.uid,
      source: options.source || 'saison',
      studentName: options.studentName || '',
      parentName: options.parentName || '',
      payerEmail: options.payerEmail || '',
      note: options.note || '',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      expiresAt,
      lockPaths
    };
    try {
      await reservationRef.set(payload);
    } catch(e) {
      await releaseLocks(acquired);
      throw e;
    }
    return Object.assign({ id: reservationId }, payload, { createdAt: now() });
  }

  async function updateReservation(id, patch){
    const database = db();
    if(!database || !id) throw new Error('Réservation introuvable.');
    await database.ref('fts_slots_reservations/' + id).update(Object.assign({}, patch || {}, { updatedAt: firebase.database.ServerValue.TIMESTAMP }));
  }

  async function setReservationStatus(id, status){
    const database = db();
    if(!database || !id) throw new Error('Réservation introuvable.');
    const snap = await database.ref('fts_slots_reservations/' + id).once('value');
    const r = normalizeReservation(id, snap.val());
    const updates = {};
    updates['fts_slots_reservations/' + id + '/status'] = status;
    updates['fts_slots_reservations/' + id + '/updatedAt'] = firebase.database.ServerValue.TIMESTAMP;
    const skey = r.seasonKey || seasonKey(r.season);
    (r.atoms && r.atoms.length ? r.atoms : atomsFor(r.day, r.start, r.durationMinutes)).forEach(atom => {
      updates[`fts_slots_locks/${skey}/${r.poolId}/${atom}/status`] = status;
      updates[`fts_slots_locks/${skey}/${r.poolId}/${atom}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;
    });
    await database.ref().update(updates);
  }

  async function cancelReservation(id){
    const database = db();
    if(!database || !id) throw new Error('Réservation introuvable.');
    const snap = await database.ref('fts_slots_reservations/' + id).once('value');
    if(!snap.exists()) return;
    const r = normalizeReservation(id, snap.val());
    const updates = {};
    updates['fts_slots_reservations/' + id + '/status'] = 'cancelled';
    updates['fts_slots_reservations/' + id + '/updatedAt'] = firebase.database.ServerValue.TIMESTAMP;
    const skey = r.seasonKey || seasonKey(r.season);
    (r.atoms && r.atoms.length ? r.atoms : atomsFor(r.day, r.start, r.durationMinutes)).forEach(atom => {
      updates[`fts_slots_locks/${skey}/${r.poolId}/${atom}`] = null;
    });
    await database.ref().update(updates);
  }

  async function cleanupExpired(){
    const database = db();
    if(!database) return 0;
    const reservations = await loadReservations();
    const expired = reservations.filter(isExpired);
    if(!expired.length) return 0;
    const updates = {};
    expired.forEach(r => {
      updates['fts_slots_reservations/' + r.id + '/status'] = 'expired';
      updates['fts_slots_reservations/' + r.id + '/updatedAt'] = firebase.database.ServerValue.TIMESTAMP;
      const skey = r.seasonKey || seasonKey(r.season);
      (r.atoms && r.atoms.length ? r.atoms : atomsFor(r.day, r.start, r.durationMinutes)).forEach(atom => updates[`fts_slots_locks/${skey}/${r.poolId}/${atom}`] = null);
    });
    await database.ref().update(updates);
    return expired.length;
  }

  function groupSlotsByDay(slots){
    const grouped = {};
    (slots || []).forEach(s => { (grouped[s.day] = grouped[s.day] || []).push(s); });
    return grouped;
  }

  function openBookingModal(options){
    options = options || {};
    return new Promise((resolve, reject) => {
      const modal = document.createElement('div');
      modal.className = 'fts-slots-modal open';
      modal.innerHTML = `
        <div class="fts-slots-dialog" role="dialog" aria-modal="true" aria-label="Choisir un créneau">
          <div class="fts-slots-head">
            <div>
              <div class="fts-slots-kicker">Créneau individuel</div>
              <div class="fts-slots-title">Choisir mon horaire</div>
              <p class="fts-slots-sub">Les créneaux déjà réservés ne sont pas affichés. Un cours d’1h bloque automatiquement deux créneaux de 30 minutes.</p>
            </div>
            <button type="button" class="fts-slots-close" aria-label="Fermer">×</button>
          </div>
          <div id="fts-slots-picker-body"><div class="fts-slots-empty">Chargement des créneaux…</div></div>
        </div>`;
      document.body.appendChild(modal);
      const close = () => { modal.remove(); resolve(null); };
      modal.querySelector('.fts-slots-close').addEventListener('click', close);
      modal.addEventListener('click', e => { if(e.target === modal) close(); });

      renderPicker(modal.querySelector('#fts-slots-picker-body'), options, async (slot, meta) => {
        try {
          const reservation = await reserveSlot(Object.assign({}, slot, meta, {
            source: options.source || 'saison',
            activityLabel: activityLabel(meta.activity),
            poolLabel: slot.poolLabel
          }));
          reservation.label = slotLabel(slot);
          modal.remove();
          resolve(reservation);
        } catch(e) {
          const msg = modal.querySelector('[data-slots-msg]');
          if(msg){ msg.className = 'fts-slots-msg is-error'; msg.textContent = e && e.message ? e.message : String(e); }
        }
      }).catch(e => {
        modal.querySelector('#fts-slots-picker-body').innerHTML = `<div class="fts-slots-msg is-error">${esc(e && e.message ? e.message : e)}</div>`;
      });
    });
  }

  async function renderPicker(container, options, onSelect){
    if(!container) return;
    options = Object.assign({}, options || {});
    await cleanupExpired().catch(() => {});
    const config = await loadConfig();
    const pools = await loadPools();
    const pool = pools.find(p => p.id === options.poolId);
    if(!config.enabled){
      container.innerHTML = '<div class="fts-slots-empty">La réservation automatique est désactivée. Le créneau sera défini avec le professeur après inscription.</div>';
      return;
    }
    if(!pool || !pool.active){
      container.innerHTML = '<div class="fts-slots-empty">Aucun planning actif pour cette activité. Le créneau sera défini avec le professeur.</div>';
      return;
    }
    const activities = options.activity ? [norm(options.activity)] : (options.activityOptions && options.activityOptions.length ? options.activityOptions.map(norm) : (pool.activities || []));
    let durations = options.durationMinutes ? [Number(options.durationMinutes)] : (pool.durations || [30]);
    durations = durations.filter(d => d === 30 || d === 60);
    let selectedActivity = activities[0] || '';
    let selectedDuration = durations[0] || 30;

    async function draw(){
      const result = await getAvailableSlots({ poolId: pool.id, activity: selectedActivity, durationMinutes: selectedDuration });
      const grouped = groupSlotsByDay(result.slots || []);
      const days = Object.keys(grouped).sort((a,b) => sortByDayTime({day:a,start:'00:00'},{day:b,start:'00:00'}));
      container.innerHTML = `
        <div class="fts-slots-card">
          <div class="fts-slots-grid">
            <div class="fts-slots-field" ${activities.length <= 1 ? 'style="display:none"' : ''}>
              <label>Activité</label>
              <select data-slots-activity>${activities.map(a => `<option value="${esc(a)}" ${a === selectedActivity ? 'selected' : ''}>${esc(activityLabel(a))}</option>`).join('')}</select>
            </div>
            <div class="fts-slots-field" ${durations.length <= 1 ? 'style="display:none"' : ''}>
              <label>Durée</label>
              <select data-slots-duration>${durations.map(d => `<option value="${d}" ${d === selectedDuration ? 'selected' : ''}>${d === 60 ? '1 heure' : '30 minutes'}</option>`).join('')}</select>
            </div>
          </div>
          <div class="fts-slots-pill-row">
            <span class="fts-slots-pill is-on">${esc(pool.label)}</span>
            <span class="fts-slots-pill">${esc(activityLabel(selectedActivity))}</span>
            <span class="fts-slots-pill">${selectedDuration === 60 ? '1 heure' : '30 minutes'}</span>
          </div>
          <div data-slots-msg class="fts-slots-msg">Choisis un créneau. Il sera bloqué temporairement pendant ${esc(config.holdDurationMinutes || 25)} minutes.</div>
        </div>
        <div class="fts-slots-calendar">
          ${days.length ? days.map(day => `
            <section class="fts-slots-day">
              <h3>${esc(DAY_LABELS[day] || day)}</h3>
              <div class="fts-slots-times">
                ${grouped[day].map(slot => `<button type="button" class="fts-slots-time" data-slot='${esc(JSON.stringify(slot))}'><strong>${esc(timeLabel(slot.start))} - ${esc(timeLabel(slot.end))}</strong><small>${esc(activityLabel(selectedActivity))}</small></button>`).join('')}
              </div>
            </section>`).join('') : '<div class="fts-slots-empty">Aucun créneau disponible pour ce choix.</div>'}
        </div>`;
      const activitySelect = container.querySelector('[data-slots-activity]');
      if(activitySelect) activitySelect.addEventListener('change', () => { selectedActivity = activitySelect.value; draw(); });
      const durationSelect = container.querySelector('[data-slots-duration]');
      if(durationSelect) durationSelect.addEventListener('change', () => { selectedDuration = Number(durationSelect.value) || 30; draw(); });
      container.querySelectorAll('[data-slot]').forEach(btn => btn.addEventListener('click', async () => {
        const slot = JSON.parse(btn.getAttribute('data-slot') || '{}');
        container.querySelectorAll('.fts-slots-time').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        btn.disabled = true;
        const msg = container.querySelector('[data-slots-msg]');
        if(msg){ msg.className = 'fts-slots-msg'; msg.textContent = 'Réservation du créneau…'; }
        await onSelect(slot, { poolId: pool.id, activity: selectedActivity, durationMinutes: selectedDuration, season: config.season });
      }));
    }
    await draw();
  }

  function reservationMeta(r){
    const label = `${r.dayLabel || DAY_LABELS[r.day] || r.day} ${timeLabel(r.start)} - ${timeLabel(r.end)}`;
    const who = r.studentName || r.parentName || r.payerEmail || 'Élève à compléter';
    return { label, who };
  }

  async function renderTeacherSchedule(container, options){
    if(typeof container === 'string') container = document.querySelector(container);
    if(!container) return;
    options = options || {};
    container.innerHTML = '<div class="fts-slots-empty">Chargement du planning individuel…</div>';
    try{
      await cleanupExpired().catch(() => {});
      const [config, pools, reservations] = await Promise.all([loadConfig(), loadPools(), loadReservations()]);
      const poolFilter = options.poolId || '';
      const active = reservations.filter(r => reservationIsBlocking(r) && (!poolFilter || r.poolId === poolFilter));
      const poolsById = {}; pools.forEach(p => poolsById[p.id] = p);
      const grouped = {};
      active.sort(sortByDayTime).forEach(r => { (grouped[r.day] = grouped[r.day] || []).push(r); });
      const days = Object.keys(grouped).sort((a,b) => sortByDayTime({day:a,start:'00:00'},{day:b,start:'00:00'}));
      container.innerHTML = `
        <section class="fts-slots-card">
          <div class="fts-slots-head">
            <div>
              <div class="fts-slots-kicker">Planning prof</div>
              <div class="fts-slots-title">Cours individuels</div>
              <p class="fts-slots-sub">Vue simple : qui vient, à quelle heure, pour quelle activité.</p>
            </div>
            <span class="fts-slots-pill ${config.enabled ? 'is-on' : 'is-off'}">${config.enabled ? 'Réservation activée' : 'Réservation désactivée'}</span>
          </div>
          <div class="fts-slots-grid">
            <div class="fts-slots-field">
              <label>Filtrer un planning</label>
              <select data-teacher-pool>
                <option value="">Tous les plannings</option>
                ${pools.map(p => `<option value="${esc(p.id)}" ${poolFilter === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}
              </select>
            </div>
            <div class="fts-slots-field">
              <label>Actions</label>
              <button type="button" class="fts-slots-btn-secondary" data-refresh>Actualiser</button>
            </div>
          </div>
        </section>
        ${days.length ? `<div class="fts-slots-calendar">${days.map(day => `
          <section class="fts-slots-day">
            <h3>${esc(DAY_LABELS[day] || day)}</h3>
            <div class="fts-slots-list">
              ${grouped[day].map(r => {
                const m = reservationMeta(r), pool = poolsById[r.poolId] || {};
                return `<article class="fts-slots-row"><div><strong>${esc(timeLabel(r.start))} - ${esc(timeLabel(r.end))} · ${esc(m.who)}</strong><small>${esc(activityLabel(r.activity))} · ${esc(pool.label || r.poolLabel || r.poolId)} · ${esc(statusLabel(r.status))}</small>${r.note ? `<small>${esc(r.note)}</small>` : ''}</div><span class="fts-slots-pill">${esc(r.durationMinutes)} min</span></article>`;
              }).join('')}
            </div>
          </section>`).join('')}</div>` : '<div class="fts-slots-empty">Aucun cours individuel réservé pour le moment.</div>'}`;
      const sel = container.querySelector('[data-teacher-pool]');
      if(sel) sel.addEventListener('change', () => renderTeacherSchedule(container, Object.assign({}, options, { poolId: sel.value })));
      const refresh = container.querySelector('[data-refresh]');
      if(refresh) refresh.addEventListener('click', () => renderTeacherSchedule(container, options));
    }catch(e){
      container.innerHTML = `<div class="fts-slots-msg is-error">Impossible de charger le planning : ${esc(e && e.message ? e.message : e)}</div>`;
    }
  }

  async function renderAdmin(container){
    if(typeof container === 'string') container = document.querySelector(container);
    if(!container) return;
    container.innerHTML = '<div class="fts-slots-empty">Chargement du module créneaux…</div>';
    try{
      await cleanupExpired().catch(() => {});
      const [config, pools, windows, reservations] = await Promise.all([loadConfig(), loadPools(), loadWindows(), loadReservations()]);
      const windowsByPool = {};
      windows.forEach(w => { (windowsByPool[w.poolId] = windowsByPool[w.poolId] || []).push(w); });
      const activeReservations = reservations.filter(r => !isExpired(r) && !['cancelled','expired'].includes(String(r.status || '')));
      const poolOptions = pools.map(p => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
      container.innerHTML = `
        <section class="fts-slots-card">
          <div class="fts-slots-head">
            <div>
              <div class="fts-slots-kicker">Administration</div>
              <div class="fts-slots-title">Créneaux individuels</div>
              <p class="fts-slots-sub">Module autonome : activation, pools partagés, plages disponibles et réservations.</p>
            </div>
            <span class="fts-slots-pill ${config.enabled ? 'is-on' : 'is-off'}">${config.enabled ? 'Activé' : 'Désactivé'}</span>
          </div>
          <div class="fts-slots-admin-tabs">
            <button type="button" class="active" data-slots-tab="settings">Réglages</button>
            <button type="button" data-slots-tab="windows">Plages</button>
            <button type="button" data-slots-tab="reservations">Réservations</button>
          </div>
          <div data-slots-admin-msg></div>
        </section>

        <section class="fts-slots-section" data-slots-section="settings">
          <div class="fts-slots-card">
            <div class="fts-slots-grid">
              <div class="fts-slots-field"><label>Saison</label><input data-config-season value="${esc(config.season || DEFAULT_CONFIG.season)}"></div>
              <div class="fts-slots-field"><label>Expiration réservation temporaire</label><input data-config-hold type="number" min="5" max="120" value="${esc(config.holdDurationMinutes || 25)}"></div>
              <div class="fts-slots-field"><label>Réservation automatique</label><select data-config-enabled><option value="true" ${config.enabled ? 'selected' : ''}>Activée</option><option value="false" ${!config.enabled ? 'selected' : ''}>Désactivée</option></select></div>
            </div>
            <div class="fts-slots-actions"><button type="button" class="fts-slots-btn" data-save-config>Enregistrer les réglages</button><button type="button" class="fts-slots-btn-secondary" data-seed-defaults>Créer / compléter les réglages de base</button></div>
          </div>
          <div class="fts-slots-card">
            <div class="fts-slots-head"><div><div class="fts-slots-kicker">Pools partagés</div><h2 style="margin:0">Plannings profs</h2><p class="fts-slots-sub">Un pool = un professeur/ressource. Tu peux activer ou désactiver chaque pool indépendamment.</p></div></div>
            <div class="fts-slots-list">
              ${pools.map(p => {
                const hasWindows = !!(windowsByPool[p.id] || []).length;
                return `<article class="fts-slots-row ${p.active && !hasWindows ? 'is-warning' : ''}" data-pool-row="${esc(p.id)}">
                  <div style="width:100%">
                    <strong>${esc(p.label)}</strong>
                    <small>${esc((p.activities || []).map(activityLabel).join(', '))} · ${esc((p.durations || []).join('/'))} min · ${esc(p.teacherLabel || '')}</small>
                    ${p.active && !hasWindows ? '<small class="fts-slots-warn">Actif mais aucune plage configurée : il apparaîtra comme indisponible côté inscription.</small>' : ''}
                    <div class="fts-slots-grid-3 fts-slots-inline-edit">
                      <div class="fts-slots-field"><label>Nom</label><input data-pool-label value="${esc(p.label)}"></div>
                      <div class="fts-slots-field"><label>Prof</label><input data-pool-teacher value="${esc(p.teacherLabel || '')}"></div>
                      <div class="fts-slots-field"><label>Actif</label><select data-pool-active><option value="true" ${p.active ? 'selected' : ''}>Oui</option><option value="false" ${!p.active ? 'selected' : ''}>Non</option></select></div>
                      <div class="fts-slots-field"><label>Activités</label><input data-pool-activities value="${esc((p.activities || []).join(','))}"></div>
                      <div class="fts-slots-field"><label>Durées</label><input data-pool-durations value="${esc((p.durations || []).join(','))}"></div>
                    </div>
                  </div>
                  <div class="fts-slots-actions"><button type="button" class="fts-slots-btn-secondary" data-save-pool="${esc(p.id)}">Enregistrer</button></div>
                </article>`;
              }).join('')}
            </div>
          </div>
        </section>

        <section class="fts-slots-section" data-slots-section="windows" hidden>
          <div class="fts-slots-card">
            <div class="fts-slots-head"><div><div class="fts-slots-kicker">Ajouter / modifier une plage</div><h2 style="margin:0">Disponibilités</h2><p class="fts-slots-sub">Crée une plage, l’app génère les créneaux de 30 min automatiquement. Le bouton Modifier remplit ce formulaire.</p></div></div>
            <input type="hidden" data-window-id value="">
            <div class="fts-slots-grid-3">
              <div class="fts-slots-field"><label>Pool</label><select data-window-pool>${poolOptions}</select></div>
              <div class="fts-slots-field"><label>Jour</label><select data-window-day>${Object.keys(DAY_LABELS).map(d => `<option value="${d}">${DAY_LABELS[d]}</option>`).join('')}</select></div>
              <div class="fts-slots-field"><label>Nom optionnel</label><input data-window-label placeholder="Ex : Lundi instruments"></div>
              <div class="fts-slots-field"><label>Début</label><input data-window-start type="time" value="14:00"></div>
              <div class="fts-slots-field"><label>Fin</label><input data-window-end type="time" value="21:00"></div>
              <div class="fts-slots-field"><label>Activités</label><input data-window-activities placeholder="guitare,basse,batterie"></div>
              <div class="fts-slots-field"><label>Durées</label><input data-window-durations placeholder="30,60" value="30,60"></div>
              <div class="fts-slots-field"><label>Actif</label><select data-window-active><option value="true">Oui</option><option value="false">Non</option></select></div>
            </div>
            <div class="fts-slots-actions"><button type="button" class="fts-slots-btn" data-save-window>Ajouter la plage</button><button type="button" class="fts-slots-btn-secondary" data-reset-window-form hidden>Annuler la modification</button></div>
          </div>
          <div class="fts-slots-card"><div class="fts-slots-list">${windows.map(w => `<article class="fts-slots-row"><div><strong>${esc(w.label || ((DAY_LABELS[w.day] || w.day) + ' ' + w.start + '-' + w.end))}</strong><small>${esc((pools.find(p => p.id === w.poolId) || {}).label || w.poolId)} · ${esc(DAY_LABELS[w.day] || w.day)} · ${esc(timeLabel(w.start))}-${esc(timeLabel(w.end))} · ${esc((w.activities || []).map(activityLabel).join(', '))} · ${esc((w.durations || []).join('/'))} min</small></div><div class="fts-slots-actions"><span class="fts-slots-pill ${w.active ? 'is-on' : 'is-off'}">${w.active ? 'Active' : 'Inactive'}</span><button type="button" class="fts-slots-btn-secondary" data-edit-window="${esc(w.id)}">Modifier</button><button type="button" class="fts-slots-btn-secondary" data-toggle-window="${esc(w.id)}">${w.active ? 'Désactiver' : 'Activer'}</button><button type="button" class="fts-slots-btn-danger" data-remove-window="${esc(w.id)}">Supprimer</button></div></article>`).join('') || '<div class="fts-slots-empty">Aucune plage configurée.</div>'}</div></div>
        </section>

        <section class="fts-slots-section" data-slots-section="reservations" hidden>
          <div class="fts-slots-card">
            <div class="fts-slots-head"><div><div class="fts-slots-kicker">Réservations</div><h2 style="margin:0">À vérifier</h2><p class="fts-slots-sub">Sans Worker, la confirmation reste manuelle après vérification du paiement. Les réservations annulées ou expirées sont masquées ici.</p></div><button type="button" class="fts-slots-btn-secondary" data-refresh-admin>Actualiser</button></div>
            ${activeReservations.length ? `<table class="fts-slots-table"><thead><tr><th>Créneau</th><th>Élève</th><th>Activité</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${activeReservations.sort(sortByDayTime).map(r => { const m = reservationMeta(r); return `<tr><td><strong>${esc(m.label)}</strong><small>${esc((pools.find(p => p.id === r.poolId) || {}).label || r.poolId)}</small></td><td>${esc(m.who)}${r.payerEmail ? `<small>${esc(r.payerEmail)}</small>` : ''}</td><td>${esc(activityLabel(r.activity))}<small>${esc(r.durationMinutes)} min</small></td><td>${esc(statusLabel(r.status))}</td><td><div class="fts-slots-actions"><button class="fts-slots-btn-secondary" data-confirm="${esc(r.id)}">Confirmer</button><button class="fts-slots-btn-danger" data-cancel="${esc(r.id)}">Annuler</button></div></td></tr>`; }).join('')}</tbody></table>` : '<div class="fts-slots-empty">Aucune réservation à vérifier pour le moment.</div>'}
          </div>
        </section>`;

      const msg = container.querySelector('[data-slots-admin-msg]');
      const showMsg = (text, ok) => { if(msg){ msg.className = 'fts-slots-msg ' + (ok ? 'is-ok' : 'is-error'); msg.textContent = text; } };
      const windowById = {}; windows.forEach(w => windowById[w.id] = w);
      const form = {
        id: container.querySelector('[data-window-id]'),
        pool: container.querySelector('[data-window-pool]'),
        day: container.querySelector('[data-window-day]'),
        label: container.querySelector('[data-window-label]'),
        start: container.querySelector('[data-window-start]'),
        end: container.querySelector('[data-window-end]'),
        activities: container.querySelector('[data-window-activities]'),
        durations: container.querySelector('[data-window-durations]'),
        active: container.querySelector('[data-window-active]'),
        save: container.querySelector('[data-save-window]'),
        reset: container.querySelector('[data-reset-window-form]')
      };
      function resetWindowForm(){
        if(!form.id) return;
        form.id.value = ''; form.label.value = ''; form.start.value = '14:00'; form.end.value = '21:00'; form.activities.value = ''; form.durations.value = '30,60'; form.active.value = 'true';
        if(form.pool && pools[0]) form.pool.value = pools[0].id;
        if(form.day) form.day.value = 'monday';
        if(form.save) form.save.textContent = 'Ajouter la plage';
        if(form.reset) form.reset.hidden = true;
      }
      container.querySelectorAll('[data-slots-tab]').forEach(btn => btn.addEventListener('click', () => {
        container.querySelectorAll('[data-slots-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-slots-tab');
        container.querySelectorAll('[data-slots-section]').forEach(sec => sec.hidden = sec.getAttribute('data-slots-section') !== tab);
      }));
      const saveCfg = container.querySelector('[data-save-config]');
      if(saveCfg) saveCfg.addEventListener('click', async () => {
        try{ await saveConfig({ season: container.querySelector('[data-config-season]').value, holdDurationMinutes: Number(container.querySelector('[data-config-hold]').value || 25), enabled: container.querySelector('[data-config-enabled]').value === 'true' }); showMsg('Réglages enregistrés.', true); await renderAdmin(container); }catch(e){ showMsg(e.message || String(e), false); }
      });
      const seed = container.querySelector('[data-seed-defaults]');
      if(seed) seed.addEventListener('click', async () => {
        if(!confirm('Créer les réglages manquants ? Les éléments déjà existants ne seront pas écrasés.')) return;
        try{ await seedDefaults(); showMsg('Réglages de base complétés.', true); await renderAdmin(container); }catch(e){ showMsg(e.message || String(e), false); }
      });
      container.querySelectorAll('[data-save-pool]').forEach(btn => btn.addEventListener('click', async () => {
        const row = btn.closest('[data-pool-row]');
        const id = btn.getAttribute('data-save-pool');
        try{
          await savePool(id, {
            label: row.querySelector('[data-pool-label]').value,
            teacherLabel: row.querySelector('[data-pool-teacher]').value,
            active: row.querySelector('[data-pool-active]').value === 'true',
            activities: row.querySelector('[data-pool-activities]').value,
            durations: row.querySelector('[data-pool-durations]').value
          });
          showMsg('Pool enregistré.', true); await renderAdmin(container);
        }catch(e){ showMsg(e.message || String(e), false); }
      }));
      const saveWin = container.querySelector('[data-save-window]');
      if(saveWin) saveWin.addEventListener('click', async () => {
        try{
          const id = form.id.value || '';
          await saveWindow(id, {
            poolId: form.pool.value,
            day: form.day.value,
            label: form.label.value,
            start: form.start.value,
            end: form.end.value,
            activities: form.activities.value,
            durations: form.durations.value,
            active: form.active.value === 'true',
            type: 'regular',
            order: id && windowById[id] ? windowById[id].order : Date.now()
          });
          showMsg(id ? 'Plage modifiée.' : 'Plage ajoutée.', true); await renderAdmin(container);
        }catch(e){ showMsg(e.message || String(e), false); }
      });
      if(form.reset) form.reset.addEventListener('click', resetWindowForm);
      container.querySelectorAll('[data-edit-window]').forEach(btn => btn.addEventListener('click', () => {
        const w = windowById[btn.getAttribute('data-edit-window')];
        if(!w) return;
        form.id.value = w.id;
        form.pool.value = w.poolId;
        form.day.value = w.day;
        form.label.value = w.label || '';
        form.start.value = w.start || '14:00';
        form.end.value = w.end || '21:00';
        form.activities.value = (w.activities || []).join(',');
        form.durations.value = (w.durations || []).join(',');
        form.active.value = w.active ? 'true' : 'false';
        if(form.save) form.save.textContent = 'Enregistrer la plage';
        if(form.reset) form.reset.hidden = false;
        form.label.scrollIntoView({ behavior:'smooth', block:'center' });
      }));
      container.querySelectorAll('[data-toggle-window]').forEach(btn => btn.addEventListener('click', async () => {
        const w = windowById[btn.getAttribute('data-toggle-window')];
        if(!w) return;
        try{ await saveWindow(w.id, Object.assign({}, w, { active: !w.active })); showMsg(w.active ? 'Plage désactivée.' : 'Plage activée.', true); await renderAdmin(container); }catch(e){ showMsg(e.message || String(e), false); }
      }));
      container.querySelectorAll('[data-remove-window]').forEach(btn => btn.addEventListener('click', async () => {
        if(!confirm('Supprimer cette plage ? Les réservations déjà prises restent visibles, mais ce créneau ne sera plus proposé aux nouveaux inscrits.')) return;
        try{ await removeWindow(btn.getAttribute('data-remove-window')); showMsg('Plage supprimée.', true); await renderAdmin(container); }catch(e){ showMsg(e.message || String(e), false); }
      }));
      container.querySelectorAll('[data-confirm]').forEach(btn => btn.addEventListener('click', async () => { try{ await setReservationStatus(btn.getAttribute('data-confirm'), 'confirmed'); showMsg('Réservation confirmée.', true); await renderAdmin(container); }catch(e){ showMsg(e.message || String(e), false); } }));
      container.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', async () => { if(!confirm('Annuler cette réservation et libérer le créneau ?')) return; try{ await cancelReservation(btn.getAttribute('data-cancel')); showMsg('Réservation annulée et créneau libéré.', true); await renderAdmin(container); }catch(e){ showMsg(e.message || String(e), false); } }));
      const refresh = container.querySelector('[data-refresh-admin]');
      if(refresh) refresh.addEventListener('click', () => renderAdmin(container));
    }catch(e){
      container.innerHTML = `<div class="fts-slots-msg is-error">Impossible de charger le module : ${esc(e && e.message ? e.message : e)}</div>`;
    }
  }

  FTS.Slots = {
    DAY_LABELS,
    DEFAULT_CONFIG,
    DEFAULT_POOLS,
    DEFAULT_WINDOWS,
    db,
    norm,
    activityLabel,
    statusLabel,
    timeLabel,
    endTime,
    atomsFor,
    slotLabel,
    loadConfig,
    loadPools,
    loadWindows,
    loadLocks,
    loadReservations,
    saveConfig,
    savePool,
    saveWindow,
    removeWindow,
    seedDefaults,
    cleanupExpired,
    getAvailableSlots,
    reserveSlot,
    updateReservation,
    setReservationStatus,
    cancelReservation,
    openBookingModal,
    renderPicker,
    renderTeacherSchedule,
    renderAdmin,
    getProfile,
    canAdmin,
    canProf
  };
  window.FTSSlots = FTS.Slots;
})();
