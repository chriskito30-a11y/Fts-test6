/* ================================================================
   PAGE MODULE — RAPPELS-ADMIN
   Module test isolé pour créer/simuler des rappels automatiques.
   V58 : ajoute génération de planning récurrent/manual + exclusions manuelles, puis rappels test isolés.
   ================================================================ */
(function(){
  'use strict';

  let db, auth, currentUser, currentProfile;
  let users = {};
  let categoryStructure = [];
  let reminders = {};
  let selectedReminderId = '';
  let filterStatus = 'all';
  let isSaving = false;

  function $(id){ return document.getElementById(id); }
  function esc(v){ return window.FTS && FTS.esc ? FTS.esc(v == null ? '' : v) : String(v == null ? '' : v); }
  function norm(v){ return window.FTS && FTS.norm ? FTS.norm(v || '') : String(v || '').toLowerCase(); }
  function msg(txt, ok){
    const el = $('msg');
    if(!el) return;
    el.textContent = txt;
    el.className = 'msg ' + (ok === false ? 'err' : 'ok');
    clearTimeout(msg._t);
    msg._t = setTimeout(() => { el.className = 'msg'; }, 4200);
  }
  function doLogout(){ firebase.auth().signOut().then(() => location.href='auth.html'); }
  window.doLogout = doLogout;

  function init(){
    db = FTS.initFirebase();
    auth = firebase.auth();
    auth.onAuthStateChanged(async user => {
      if(!user){ location.href='auth.html'; return; }
      currentUser = user;
      try{
        const snap = await db.ref('fts_users/' + user.uid).once('value');
        currentProfile = snap.val();
        if(!currentProfile || currentProfile.role !== 'admin'){
          location.href = 'membres.html';
          return;
        }
        $('auth-loading').style.display = 'none';
        $('admin-shell').style.display = 'block';
        bindEvents();
        await Promise.all([loadUsers(), loadCategories()]);
        setDefaultDates();
        renderUsers();
        renderCategories();
        updateConditionalFields();
        updatePreview();
        listenReminders();
      }catch(e){
        console.warn('[FTS Rappels Admin] init', e);
        location.href = 'auth.html';
      }
    });
  }

  async function loadUsers(){
    try{
      const snap = await db.ref('fts_users').once('value');
      users = snap.val() || {};
    }catch(e){
      console.warn('[FTS Rappels Admin] users', e);
      users = {};
    }
  }

  async function loadCategories(){
    try{
      const rows = FTS.getCategoryStructureAsync ? await FTS.getCategoryStructureAsync(db) : [];
      categoryStructure = normalizeCategoryStructure(rows);
    }catch(e){
      console.warn('[FTS Rappels Admin] categories fallback', e);
      categoryStructure = normalizeCategoryStructure(FTS.getDefaultCategoryStructure ? FTS.getDefaultCategoryStructure() : []);
    }
  }

  function normalizeCategoryStructure(rows){
    return (Array.isArray(rows) ? rows : [])
      .filter(c => c && c.active !== false)
      .map(c => {
        const name = c.name || c.category || '';
        const rawSubs = c.subs || c.subcats || c.subcategories || [];
        const subcats = (Array.isArray(rawSubs) ? rawSubs : Object.values(rawSubs))
          .map(s => typeof s === 'string' ? s : (s && (s.name || s.label)))
          .filter(Boolean);
        return { name, icon: c.icon || c.emoji || (FTS.catIcon ? FTS.catIcon(name) : '🎭'), subcats };
      }).filter(c => c.name);
  }

  function bindEvents(){
    $('logout-btn')?.addEventListener('click', doLogout);
    $('reminder-kind')?.addEventListener('change', () => { updateConditionalFields(); updatePreview(); });
    $('reminder-user')?.addEventListener('change', updatePreview);
    $('reminder-category')?.addEventListener('change', () => { renderSubcategories(); updatePreview(); });
    $('reminder-subcategory')?.addEventListener('change', updatePreview);
    ['lesson-title','lesson-type','teacher-name','place-name','lesson-at','duration-min','message-extra','standby-mode','reminder-24h','reminder-1h','repeat-until','manual-dates','excluded-dates'].forEach(id => {
      $(id)?.addEventListener('input', updatePreview);
      $(id)?.addEventListener('change', updatePreview);
    });
    $('planning-mode')?.addEventListener('input', () => { updateConditionalFields(); updatePreview(); });
    $('planning-mode')?.addEventListener('change', () => { updateConditionalFields(); updatePreview(); });
    $('btn-create-reminders')?.addEventListener('click', createReminders);
    $('btn-reset-form')?.addEventListener('click', resetForm);
    $('btn-fill-music-demo')?.addEventListener('click', fillMusicDemo);
    document.addEventListener('click', handleDocumentClick);
  }

  function handleDocumentClick(event){
    const filter = event.target.closest('[data-filter-status]');
    if(filter){
      filterStatus = filter.getAttribute('data-filter-status') || 'all';
      document.querySelectorAll('[data-filter-status]').forEach(b => b.classList.toggle('active', b === filter));
      renderReminders();
      return;
    }
    const row = event.target.closest('[data-reminder-id]');
    if(row){
      selectedReminderId = row.getAttribute('data-reminder-id') || '';
      renderReminders();
      renderSelectedReminder();
      return;
    }
    const copy = event.target.closest('[data-copy-reminder]');
    if(copy){
      const id = copy.getAttribute('data-id') || selectedReminderId;
      copyReminderText(id);
      return;
    }
    const action = event.target.closest('[data-reminder-action]');
    if(action){
      const id = action.getAttribute('data-id') || selectedReminderId;
      const type = action.getAttribute('data-reminder-action');
      if(type === 'delete') deleteReminder(id);
      if(type === 'send-test-dm') sendRealTestDm(id);
      if(type === 'standby') setReminderStatus(id, 'standby');
      if(type === 'pending') setReminderStatus(id, 'pending');
      if(type === 'cancelled') setReminderStatus(id, 'cancelled');
    }
  }

  function setDefaultDates(){
    const el = $('lesson-at');
    if(!el || el.value) return;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(17, 30, 0, 0);
    el.value = toLocalInputValue(d.getTime());
  }

  function toLocalInputValue(ts){
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromLocalInputValue(value){
    if(!value) return 0;
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  function renderUsers(){
    const select = $('reminder-user');
    if(!select) return;
    const rows = Object.entries(users)
      .filter(([,u]) => u && u.status === 'active')
      .sort((a,b) => displayName(a[1]).localeCompare(displayName(b[1]), 'fr'));
    select.innerHTML = '<option value="">Choisir un membre…</option>' + rows.map(([uid,u]) => {
      const label = displayName(u) + (u.email ? ' · ' + u.email : '');
      return `<option value="${esc(uid)}">${esc(label)}</option>`;
    }).join('');
  }

  function renderCategories(){
    const select = $('reminder-category');
    if(!select) return;
    select.innerHTML = '<option value="">Toutes / choisir…</option>' + categoryStructure.map(c => `<option value="${esc(c.name)}">${esc((c.icon || '') + ' ' + c.name)}</option>`).join('');
    renderSubcategories();
  }

  function renderSubcategories(){
    const cat = $('reminder-category')?.value || '';
    const select = $('reminder-subcategory');
    if(!select) return;
    const found = categoryStructure.find(c => c.name === cat);
    const subs = found && Array.isArray(found.subcats) ? found.subcats : [];
    select.innerHTML = '<option value="">Toutes les sous-catégories</option>' + subs.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  }

  function displayName(u){
    if(!u) return 'Membre';
    return u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email || 'Membre';
  }

  function updateConditionalFields(){
    const kind = $('reminder-kind')?.value || 'music_individual';
    const individual = kind === 'music_individual';
    const planningMode = $('planning-mode')?.value || 'single';
    const repeatInput = $('repeat-until');
    const eventAt = fromLocalInputValue($('lesson-at')?.value || '');
    if(repeatInput && !repeatInput.value && (planningMode === 'weekly' || planningMode === 'biweekly' || planningMode === 'triweekly') && eventAt){
      repeatInput.value = toDateInputValue(defaultRepeatUntil(eventAt, planningMode));
    }
    $('field-user')?.classList.toggle('u-hidden', !individual);
    $('field-category')?.classList.toggle('u-hidden', individual);
    $('field-subcategory')?.classList.toggle('u-hidden', individual);
    $('field-lesson-type')?.querySelector('label') && ($('field-lesson-type').querySelector('label').textContent = individual ? 'Instrument / cours' : 'Type de rendez-vous');
    $('field-repeat-until')?.classList.toggle('u-hidden', planningMode === 'single' || planningMode === 'manual');
    $('field-manual-dates')?.classList.toggle('u-hidden', planningMode !== 'manual');
    updatePlanningSummary();
  }

  function getFormData(){
    const kind = $('reminder-kind')?.value || 'music_individual';
    const eventAt = fromLocalInputValue($('lesson-at')?.value || '');
    const uid = $('reminder-user')?.value || '';
    const user = uid ? users[uid] : null;
    const category = $('reminder-category')?.value || '';
    const subcategory = $('reminder-subcategory')?.value || '';
    const lessonType = ($('lesson-type')?.value || '').trim();
    const title = ($('lesson-title')?.value || '').trim() || buildDefaultTitle(kind, lessonType, category, subcategory);
    const teacher = ($('teacher-name')?.value || '').trim();
    const place = ($('place-name')?.value || '').trim();
    const duration = parseInt($('duration-min')?.value || '30', 10) || 30;
    const extra = ($('message-extra')?.value || '').trim();
    const standby = !!$('standby-mode')?.checked;
    const planningMode = $('planning-mode')?.value || 'single';
    const repeatUntil = parseDateOnly($('repeat-until')?.value || '');
    const manualDatesText = $('manual-dates')?.value || '';
    const excludedDatesText = $('excluded-dates')?.value || '';
    const offsets = [];
    if($('reminder-24h')?.checked) offsets.push(24 * 60);
    if($('reminder-1h')?.checked) offsets.push(60);
    const occurrences = buildOccurrences(eventAt, planningMode, repeatUntil, manualDatesText, excludedDatesText);
    return { kind, eventAt, uid, user, category, subcategory, lessonType, title, teacher, place, duration, extra, standby, offsets, planningMode, repeatUntil, manualDatesText, excludedDatesText, occurrences };
  }

  function parseDateOnly(value){
    if(!value) return 0;
    const ts = new Date(value + 'T23:59:59').getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  function addDays(ts, days){
    const d = new Date(ts);
    d.setDate(d.getDate() + days);
    return d.getTime();
  }

  function defaultRepeatUntil(firstAt, mode){
    if(!firstAt || (mode !== 'weekly' && mode !== 'biweekly' && mode !== 'triweekly')) return 0;
    // Safe UX default : assez long pour tester, sans créer une saison entière par erreur.
    const stepDays = mode === 'weekly' ? 7 : (mode === 'biweekly' ? 14 : 21);
    const occurrences = 8;
    const d = new Date(firstAt);
    d.setDate(d.getDate() + stepDays * (occurrences - 1));
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  function toDateInputValue(ts){
    if(!ts) return '';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function dateKey(ts){
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function parseManualDateLine(line, fallbackHour, fallbackMinute){
    const raw = String(line || '').trim();
    if(!raw) return 0;
    let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
    if(m){
      const h = m[4] != null ? parseInt(m[4],10) : fallbackHour;
      const min = m[5] != null ? parseInt(m[5],10) : fallbackMinute;
      const ts = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10), h, min, 0, 0).getTime();
      return Number.isFinite(ts) ? ts : 0;
    }
    m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if(m){
      const h = m[4] != null ? parseInt(m[4],10) : fallbackHour;
      const min = m[5] != null ? parseInt(m[5],10) : fallbackMinute;
      const ts = new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10), h, min, 0, 0).getTime();
      return Number.isFinite(ts) ? ts : 0;
    }
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  function parseExcludedDates(text){
    const set = new Set();
    String(text || '').split(/\n|,|;/).map(x => x.trim()).filter(Boolean).forEach(line => {
      const ts = parseManualDateLine(line, 12, 0);
      if(ts) set.add(dateKey(ts));
    });
    return set;
  }

  function buildOccurrences(firstAt, mode, repeatUntil, manualText, excludedText){
    const excluded = parseExcludedDates(excludedText);
    const base = firstAt ? new Date(firstAt) : new Date();
    const fallbackHour = Number.isFinite(base.getHours()) ? base.getHours() : 17;
    const fallbackMinute = Number.isFinite(base.getMinutes()) ? base.getMinutes() : 30;
    let rows = [];

    if(mode === 'manual'){
      const manualRows = String(manualText || '')
        .split(/\n|,|;/)
        .map(line => parseManualDateLine(line, fallbackHour, fallbackMinute))
        .filter(Boolean);
      // UX safe : la date de référence sert de première date si aucune date manuelle n'est encore saisie.
      rows = manualRows.length ? manualRows : (firstAt ? [firstAt] : []);
    }else if(mode === 'weekly' || mode === 'biweekly' || mode === 'triweekly'){
      if(firstAt){
        const stepDays = mode === 'weekly' ? 7 : (mode === 'biweekly' ? 14 : 21);
        const until = repeatUntil || defaultRepeatUntil(firstAt, mode);
        let cur = firstAt;
        let guard = 0;
        while(cur <= until && guard < 80){
          rows.push(cur);
          cur = addDays(cur, stepDays);
          guard++;
        }
      }
    }else if(firstAt){
      rows = [firstAt];
    }

    rows = [...new Set(rows)]
      .sort((a,b)=>a-b)
      .filter(ts => ts && Number.isFinite(ts) && !excluded.has(dateKey(ts)));
    return rows;
  }

  function updatePlanningSummary(){
    const el = $('planning-summary');
    if(!el) return;
    const data = getFormDataShallow();
    const occurrences = buildOccurrences(data.eventAt, data.planningMode, data.repeatUntil, data.manualDatesText, data.excludedDatesText);
    if(!occurrences.length){ el.innerHTML = '<strong>0 séance générée</strong><span>Ajoute une date de référence, une date de fin ou des dates manuelles valides.</span>'; return; }
    const first = formatFullDateTime(occurrences[0]);
    const last = formatFullDateTime(occurrences[occurrences.length-1]);
    el.innerHTML = `<strong>${occurrences.length} séance${occurrences.length>1?'s':''} générée${occurrences.length>1?'s':''}</strong><span>${esc(first)}${occurrences.length>1?' → '+esc(last):''}</span>`;
  }

  function getFormDataShallow(){
    return {
      eventAt: fromLocalInputValue($('lesson-at')?.value || ''),
      planningMode: $('planning-mode')?.value || 'single',
      repeatUntil: parseDateOnly($('repeat-until')?.value || ''),
      manualDatesText: $('manual-dates')?.value || '',
      excludedDatesText: $('excluded-dates')?.value || ''
    };
  }

  function buildDefaultTitle(kind, lessonType, category, subcategory){
    if(kind === 'music_individual') return `Cours de ${lessonType || 'musique'}`;
    if(kind === 'group') return [category || 'Groupe', subcategory].filter(Boolean).join(' — ') || 'Rappel de cours';
    return lessonType || 'Rendez-vous exceptionnel';
  }

  function buildMessage(data, offset){
    const eventLabel = formatFullDateTime(data.eventAt);
    const who = data.uid && data.user ? displayName(data.user) : '';
    const title = data.title || buildDefaultTitle(data.kind, data.lessonType, data.category, data.subcategory);
    const before = offset === 60 ? 'commence dans 1h' : 'est prévu demain';
    const lines = [];
    lines.push(`${title} ${before}.`);
    lines.push(`📅 ${eventLabel}`);
    if(data.teacher) lines.push(`👤 Prof : ${data.teacher}`);
    if(data.place) lines.push(`📍 Lieu : ${data.place}`);
    if(data.extra) lines.push(data.extra);
    if(who && data.kind !== 'music_individual') lines.push(`Destinataire test : ${who}`);
    return lines.join('\n');
  }

  function formatFullDateTime(ts){
    if(!ts) return 'date à définir';
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  }

  function reminderTarget(r){
    if(!r) return 'Ciblage';
    if(r.uid) return r.recipientName || r.recipientEmail || 'Membre';
    return [r.targetCategory, r.targetSubcategory].filter(Boolean).join(' · ') || 'Groupe / catégorie';
  }

  function kindLabel(kind){
    if(kind === 'music_individual') return 'Cours individuel musique';
    if(kind === 'group') return 'Rappel de groupe';
    if(kind === 'exceptional') return 'Rendez-vous exceptionnel';
    return 'Rappel';
  }

  function offsetLabel(minutes){
    const m = parseInt(minutes || 0, 10);
    if(m === 60) return '1h avant';
    if(m === 1440) return '24h avant';
    if(m > 60) return Math.round(m / 60) + 'h avant';
    return (m || '—') + ' min avant';
  }

  function buildPreviewReminder(data, offset){
    return {
      kind: data.kind,
      uid: data.kind === 'music_individual' ? data.uid : '',
      recipientName: data.uid && data.user ? displayName(data.user) : '',
      recipientEmail: data.uid && data.user ? (data.user.email || '') : '',
      targetCategory: data.kind !== 'music_individual' ? data.category : '',
      targetSubcategory: data.kind !== 'music_individual' ? data.subcategory : '',
      title: data.title,
      body: buildMessage(data, offset),
      lessonType: data.lessonType,
      teacher: data.teacher,
      place: data.place,
      durationMinutes: data.duration,
      eventAt: data.eventAt,
      sendAt: data.eventAt ? data.eventAt - offset * 60 * 1000 : 0,
      reminderOffsetMinutes: offset,
      status: data.standby ? 'standby' : 'pending',
      botLabel: 'Rappel automatique Fais Ton Show',
      channel: 'dm_auto',
      messageType: 'auto-reminder',
      bot: true,
      makeReady: !data.standby
    };
  }

  function cleanBotBody(body){
    return String(body || '')
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean)
      .filter(x => !x.startsWith('📅') && !x.startsWith('👤 Prof') && !x.startsWith('📍 Lieu'))
      .join('\n');
  }

  function renderBotConversation(r, options){
    options = options || {};
    const status = r.status || 'standby';
    const target = reminderTarget(r);
    const cleanBody = cleanBotBody(r.body || '') || (r.title || kindLabel(r.kind));
    const body = esc(cleanBody).replace(/\n/g, '<br>');
    const statusText = options.statusText || statusLabel(status);
    const modeText = options.realMode ? 'Test réel : MP + push envoyés manuellement' : (r.makeReady ? 'Make pourra traiter ce rappel' : 'Stand-by : aucun envoi automatique');
    return `<div class="bot-conversation ${options.compact ? 'compact' : ''}">
      <div class="bot-thread-head">
        <span>Simulation conversation</span>
        <strong>${esc(target)}</strong>
      </div>
      <div class="bot-system-separator">${options.realMode ? 'Rendu proche du MP réel envoyé au compte test' : 'Aperçu uniquement — aucun MP réel envoyé depuis cette page'}</div>
      <div class="bot-chat-row">
        <div class="bot-mini-avatar" aria-hidden="true">🤖</div>
        <div class="bot-chat-bubble">
          <div class="bot-auto-head">
            <span class="bot-badge">${esc(r.botLabel || 'Rappel automatique Fais Ton Show')}</span>
            <span class="badge ${esc(status)}">${esc(statusText)}</span>
          </div>
          <div class="bot-title">${esc(r.title || kindLabel(r.kind))}</div>
          <div class="bot-text">${body}</div>
          <div class="bot-chipline">
            <span>📅 ${esc(formatFullDateTime(r.eventAt))}</span>
            <span>⏰ ${esc(offsetLabel(r.reminderOffsetMinutes))}</span>
            ${r.teacher ? `<span>👤 ${esc(r.teacher)}</span>` : ''}
            ${r.place ? `<span>📍 ${esc(r.place)}</span>` : ''}
          </div>
          <div class="bot-auto-footer">Message automatique identifiable · ${esc(modeText)}</div>
        </div>
      </div>
    </div>`;
  }

  function updatePreview(){
    updatePlanningSummary();
    const data = getFormData();
    const offset = data.offsets.includes(60) ? 60 : (data.offsets[0] || 24*60);
    const previewData = Object.assign({}, data, { eventAt: data.occurrences[0] || data.eventAt });
    const el = $('bot-preview');
    if(!el) return;
    const count = data.occurrences.length;
    const countHtml = count > 1 ? `<div class="preview-series-note">Aperçu sur la première séance · ${count} séances au total · ${count * Math.max(data.offsets.length,1)} rappel(s) possible(s)</div>` : '';
    el.innerHTML = countHtml + renderBotConversation(buildPreviewReminder(previewData, offset), { compact:true, statusText: data.standby ? 'Stand-by test' : 'Prêt Make' });
  }

  async function createReminders(){
    if(isSaving) return;
    const data = getFormData();
    if(!data.eventAt && data.planningMode !== 'manual'){ msg('Ajoute une date et une heure valides.', false); return; }
    if(!data.occurrences.length){ msg('Aucune séance générée. Vérifie la date de référence, la date de fin ou les dates manuelles.', false); return; }
    if(!data.offsets.length){ msg('Choisis au moins un rappel : 24h avant ou 1h avant.', false); return; }
    if(data.kind === 'music_individual' && !data.uid){ msg('Choisis le membre concerné par le créneau individuel.', false); return; }
    if(data.kind !== 'music_individual' && !data.category && !data.subcategory){ msg('Choisis au moins une catégorie ou sous-catégorie pour ce rappel groupe.', false); return; }
    const invalid = [];
    data.occurrences.forEach(ts => data.offsets.forEach(offset => { if(ts - offset*60*1000 <= Date.now()) invalid.push({ts, offset}); }));
    if(invalid.length){ msg('Un ou plusieurs rappels seraient déjà dans le passé. Change la date ou les rappels.', false); return; }
    const totalToCreate = data.occurrences.length * data.offsets.length;
    if(totalToCreate > 80){ msg('Trop de rappels à créer d’un coup. Réduis la période ou les dates.', false); return; }
    if(totalToCreate > 12 && !confirm('Créer ' + totalToCreate + ' rappels test ?')) return;

    isSaving = true;
    const btn = $('btn-create-reminders');
    const old = btn ? btn.textContent : '';
    if(btn){ btn.disabled = true; btn.textContent = 'Création…'; }
    try{
      const created = [];
      const seriesId = db.ref('fts_scheduled_reminders').push().key || ('series_' + Date.now());
      for(const eventAt of data.occurrences){
        for(const offset of data.offsets){
          const sendAt = eventAt - offset * 60 * 1000;
          const occurrenceData = Object.assign({}, data, { eventAt });
          const payload = {
            kind: data.kind,
            uid: data.kind === 'music_individual' ? data.uid : '',
            recipientName: data.uid && data.user ? displayName(data.user) : '',
            recipientEmail: data.uid && data.user ? (data.user.email || '') : '',
            targetCategory: data.kind !== 'music_individual' ? data.category : '',
            targetSubcategory: data.kind !== 'music_individual' ? data.subcategory : '',
            title: data.title,
            body: buildMessage(occurrenceData, offset),
            lessonType: data.lessonType,
            teacher: data.teacher,
            place: data.place,
            durationMinutes: data.duration,
            eventAt,
            sendAt,
            reminderOffsetMinutes: offset,
            status: data.standby ? 'standby' : 'pending',
            auto: true,
            botLabel: 'Rappel automatique Fais Ton Show',
            createdBy: currentUser ? currentUser.uid : '',
            createdByName: currentProfile ? displayName(currentProfile) : 'Admin',
            makeReady: !data.standby,
            seriesId,
            recurrenceMode: data.planningMode,
            excludedDatesText: data.excludedDatesText || ''
          };
          const id = await FTS.Services.Reminders.create(payload);
          created.push(id);
        }
      }
      msg(`${created.length} rappel(s) créé(s) pour ${data.occurrences.length} séance(s). Aucun MP réel envoyé automatiquement.`, true);
      resetForm(false);
    }catch(e){
      console.warn('[FTS Rappels Admin] create', e);
      msg('Erreur pendant la création du rappel. Vérifie les rules fts_scheduled_reminders.', false);
    }finally{
      isSaving = false;
      if(btn){ btn.disabled = false; btn.textContent = old || 'Créer les rappels test'; }
    }
  }

  function listenReminders(){
    if(!FTS.Services || !FTS.Services.Reminders){
      msg('Service rappels non chargé.', false);
      return;
    }
    FTS.Services.Reminders.listen(data => {
      reminders = data || {};
      renderReminders();
      renderSelectedReminder();
    });
  }

  function sortedReminders(){
    return Object.entries(reminders || {})
      .filter(([,r]) => r)
      .filter(([,r]) => filterStatus === 'all' || (r.status || 'standby') === filterStatus)
      .sort((a,b) => (a[1].sendAt || 0) - (b[1].sendAt || 0));
  }

  function renderReminders(){
    const list = $('reminder-list');
    const count = $('reminder-count');
    if(!list) return;
    const rows = sortedReminders();
    if(count) count.textContent = `${rows.length} rappel(s)`;
    if(!rows.length){ list.innerHTML = '<div class="empty">Aucun rappel pour ce filtre.</div>'; return; }
    list.innerHTML = rows.map(([id,r]) => {
      const active = selectedReminderId === id;
      const status = r.status || 'standby';
      const target = r.uid ? (r.recipientName || r.recipientEmail || 'Membre') : [r.targetCategory, r.targetSubcategory].filter(Boolean).join(' · ');
      return `<article class="reminder-row ${active ? 'active' : ''}" data-reminder-id="${esc(id)}">
        <div class="reminder-top">
          <div>
            <div class="reminder-title">${esc(r.title || 'Rappel')}</div>
            <div class="reminder-meta">${esc(target || 'Ciblage non renseigné')}<br>Envoi prévu : ${esc(formatFullDateTime(r.sendAt))}</div>
          </div>
          <span class="badge ${esc(status)}">${statusLabel(status)}</span>
        </div>
      </article>`;
    }).join('');
  }

  function renderSelectedReminder(){
    const wrap = $('selected-reminder');
    if(!wrap) return;
    const r = selectedReminderId ? reminders[selectedReminderId] : null;
    if(!r){
      wrap.innerHTML = '<div class="empty">Sélectionne un rappel pour voir le détail, le rendu bot et les actions.</div>';
      return;
    }
    wrap.innerHTML = `<div class="preview-card selected-bot-card">
      ${renderBotConversation(r)}
      <div class="tech-grid">
        <div><span>eventAt</span><strong>${esc(formatFullDateTime(r.eventAt))}</strong></div>
        <div><span>sendAt</span><strong>${esc(formatFullDateTime(r.sendAt))}</strong></div>
        <div><span>type</span><strong>${esc(kindLabel(r.kind))}</strong></div>
        <div><span>canal futur</span><strong>${esc(r.channel || 'dm_auto')}</strong></div>
        <div><span>messageType</span><strong>${esc(r.messageType || 'auto-reminder')}</strong></div>
        <div><span>makeReady</span><strong>${r.makeReady ? 'true' : 'false'}</strong></div>
      </div>
      <div class="row-actions">
        <button class="btn-outline btn-sm" data-copy-reminder="1" data-id="${esc(selectedReminderId)}">Copier le texte</button>
        ${r.uid ? `<button class="btn btn-sm btn-gold" data-reminder-action="send-test-dm" data-id="${esc(selectedReminderId)}">Envoyer MP test réel</button>` : `<button class="btn-outline btn-sm" disabled title="Réservé aux rappels avec membre ciblé">MP test indisponible</button>`}
        <button class="btn-outline btn-sm" data-reminder-action="standby" data-id="${esc(selectedReminderId)}">Mettre en stand-by</button>
        <button class="btn-outline btn-sm" data-reminder-action="pending" data-id="${esc(selectedReminderId)}">Activer test pending</button>
        <button class="btn-outline danger btn-sm" data-reminder-action="cancelled" data-id="${esc(selectedReminderId)}">Annuler</button>
        <button class="btn-outline danger btn-sm" data-reminder-action="delete" data-id="${esc(selectedReminderId)}">Supprimer</button>
      </div>
    </div>`;
  }

  function statusLabel(status){
    if(status === 'pending') return 'Prêt Make';
    if(status === 'sent') return 'Envoyé';
    if(status === 'sent_test') return 'Test réel envoyé';
    if(status === 'cancelled') return 'Annulé';
    return 'Stand-by';
  }


  function directConvId(a, b){ return [String(a || ''), String(b || '')].sort().join('_'); }

  async function sendRealTestDm(id){
    const r = id ? reminders[id] : null;
    if(!r){ msg('Sélectionne un rappel.', false); return; }
    if(!r.uid){ msg('Le test MP réel est réservé aux rappels avec un membre ciblé.', false); return; }
    if(!currentUser || !currentUser.uid){ msg('Session admin introuvable.', false); return; }
    const recipient = users[r.uid] || null;
    const recipientName = r.recipientName || displayName(recipient) || 'Membre';
    const ok = confirm('Envoyer un MP automatique RÉEL au compte test : ' + recipientName + ' ?\n\nCela créera une conversation/notification comme un vrai message.');
    if(!ok) return;

    const actionBtn = Array.from(document.querySelectorAll('[data-reminder-action="send-test-dm"]')).find(btn => btn.getAttribute('data-id') === id);
    const old = actionBtn ? actionBtn.textContent : '';
    if(actionBtn){ actionBtn.disabled = true; actionBtn.textContent = 'Envoi test…'; }

    try{
      const adminUid = currentUser.uid;
      const uid = r.uid;
      const convId = directConvId(adminUid, uid);
      const now = Date.now();
      const participants = {}; participants[adminUid] = true; participants[uid] = true;
      const convRef = db.ref('fts_dm/conversations/' + convId);
      const convSnap = await convRef.once('value');
      if(!convSnap.exists()){
        await convRef.set({
          type:'direct',
          participants,
          lastMessage:'',
          lastTs:now,
          createdAt:now,
          createdBy:adminUid,
          autoReminderTest:true
        });
      }else{
        await convRef.child('participants').update(participants);
      }

      const text = r.body || r.title || 'Rappel automatique Fais Ton Show';
      const senderName = '🤖 Rappel automatique FTS';
      const msgRef = db.ref('fts_dm/messages/' + convId).push();
      const messagePayload = {
        id: msgRef.key,
        senderId: adminUid,
        senderName,
        text,
        ts: now,
        auto: true,
        bot: true,
        botLabel: r.botLabel || 'Rappel automatique Fais Ton Show',
        messageType: 'auto-reminder',
        reminderId: id,
        reminderKind: r.kind || '',
        eventAt: r.eventAt || 0,
        reminderOffsetMinutes: r.reminderOffsetMinutes || 0
      };
      await msgRef.set(messagePayload);

      const unreadSnap = await db.ref('fts_dm/conversations/' + convId + '/unread/' + uid).once('value');
      const currentUnread = Number(unreadSnap.val() || 0);
      const updates = {};
      updates['fts_dm/conversations/' + convId + '/lastMessage'] = '🤖 ' + String(text).replace(/\s+/g, ' ').substring(0, 76);
      updates['fts_dm/conversations/' + convId + '/lastSenderName'] = senderName;
      updates['fts_dm/conversations/' + convId + '/lastTs'] = now;
      updates['fts_dm/conversations/' + convId + '/unread/' + uid] = currentUnread + 1;
      updates['fts_dm/conversations/' + convId + '/unread/' + adminUid] = 0;
      updates['fts_dm/userConvs/' + adminUid + '/' + convId] = true;
      updates['fts_dm/userConvs/' + uid + '/' + convId] = true;
      await db.ref().update(updates);

      await sendPushForRealTest(uid, convId, msgRef.key, text, r);

      await FTS.Services.Reminders.update(id, {
        status:'sent_test',
        makeReady:false,
        realDmTestAt:now,
        realDmConvId:convId,
        realDmMsgId:msgRef.key,
        realDmRecipientUid:uid
      });
      selectedReminderId = id;
      msg('MP test réel envoyé. Vérifie le compte test : conversation + notification push si activée.', true);
    }catch(e){
      console.warn('[FTS Rappels Admin] test MP réel', e);
      msg('Erreur pendant le test MP réel : ' + (e && e.message ? e.message : 'vérifie console/rules'), false);
    }finally{
      if(actionBtn){ actionBtn.disabled = false; actionBtn.textContent = old || 'Envoyer MP test réel'; }
    }
  }

  async function sendPushForRealTest(uid, convId, msgId, text, r){
    if(!FTS.PUSH || !FTS.PUSH.workerUrl || !window.fetch) return;
    const title = 'FTS — Rappel automatique';
    const body = String(text || '').replace(/\s+/g, ' ').substring(0, 120);
    const url = './messages.html?conv=' + encodeURIComponent(convId)
      + '&msg=' + encodeURIComponent(msgId)
      + '&recipientUid=' + encodeURIComponent(uid);
    const payload = {
      type:'dm_direct',
      uid,
      expectedUid:uid,
      recipientUid:uid,
      requiresUidMatch:true,
      conversationId:convId,
      msgId,
      title,
      body,
      url,
      senderUid:currentUser ? currentUser.uid : '',
      adminCopy:false,
      forceUid:true,
      autoReminder:true,
      reminderId:r.id || selectedReminderId || '',
      tag:'dm-' + convId + '-' + msgId + '-' + uid,
      notificationKey:'dm-' + convId + '-' + msgId + '-' + uid,
      collapseKey:'dm-' + convId + '-' + uid
    };
    await fetch(FTS.PUSH.workerUrl + '/notify', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    }).catch(e => console.warn('[FTS Rappels Admin] push test non bloquant', e));
  }

  async function copyReminderText(id){
    const r = id ? reminders[id] : null;
    if(!r || !r.body){ msg('Aucun texte à copier.', false); return; }
    try{
      await navigator.clipboard.writeText(r.body);
      msg('Texte du rappel copié.', true);
    }catch(e){
      msg('Copie impossible sur ce navigateur.', false);
    }
  }

  async function setReminderStatus(id, status){
    if(!id) return;
    try{
      await FTS.Services.Reminders.setStatus(id, status);
      msg('Statut mis à jour.', true);
    }catch(e){
      console.warn('[FTS Rappels Admin] status', e);
      msg('Impossible de modifier le statut.', false);
    }
  }

  async function deleteReminder(id){
    if(!id) return;
    if(!confirm('Supprimer ce rappel test ?')) return;
    try{
      await FTS.Services.Reminders.remove(id);
      if(selectedReminderId === id) selectedReminderId = '';
      msg('Rappel supprimé.', true);
    }catch(e){
      console.warn('[FTS Rappels Admin] delete', e);
      msg('Impossible de supprimer ce rappel.', false);
    }
  }

  function resetForm(showMsg){
    ['lesson-title','lesson-type','teacher-name','place-name','message-extra','manual-dates','excluded-dates'].forEach(id => { if($(id)) $(id).value = ''; });
    if($('reminder-user')) $('reminder-user').value = '';
    if($('reminder-category')) $('reminder-category').value = '';
    if($('reminder-subcategory')) $('reminder-subcategory').value = '';
    if($('duration-min')) $('duration-min').value = '30';
    if($('planning-mode')) $('planning-mode').value = 'single';
    if($('repeat-until')) $('repeat-until').value = '';
    if($('standby-mode')) $('standby-mode').checked = true;
    if($('reminder-24h')) $('reminder-24h').checked = true;
    if($('reminder-1h')) $('reminder-1h').checked = true;
    setDefaultDates();
    renderSubcategories();
    updateConditionalFields();
    updatePreview();
    if(showMsg !== false) msg('Formulaire réinitialisé.', true);
  }

  function fillMusicDemo(){
    if($('reminder-kind')) $('reminder-kind').value = 'music_individual';
    if($('lesson-type')) $('lesson-type').value = 'Guitare';
    if($('teacher-name')) $('teacher-name').value = 'Chris';
    if($('place-name')) $('place-name').value = 'Salle musique';
    if($('duration-min')) $('duration-min').value = '30';
    if($('planning-mode')) $('planning-mode').value = 'single';
    if($('repeat-until')) $('repeat-until').value = '';
    if($('message-extra')) $('message-extra').value = 'Merci de prévenir rapidement en cas d’absence.';
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(17, 30, 0, 0);
    if($('lesson-at')) $('lesson-at').value = toLocalInputValue(d.getTime());
    updateConditionalFields();
    updatePreview();
  }

  init();
})();
