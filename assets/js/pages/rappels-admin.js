/* ================================================================
   PAGE MODULE — RAPPELS-ADMIN
   Module test isolé pour créer/simuler des rappels automatiques.
   IMPORTANT : ne crée aucun MP réel et ne modifie pas fts_dm.
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
    ['lesson-title','lesson-type','teacher-name','place-name','lesson-at','duration-min','message-extra','standby-mode','reminder-24h','reminder-1h'].forEach(id => {
      $(id)?.addEventListener('input', updatePreview);
      $(id)?.addEventListener('change', updatePreview);
    });
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
    const action = event.target.closest('[data-reminder-action]');
    if(action){
      const id = action.getAttribute('data-id') || selectedReminderId;
      const type = action.getAttribute('data-reminder-action');
      if(type === 'delete') deleteReminder(id);
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
    $('field-user')?.classList.toggle('u-hidden', !individual);
    $('field-category')?.classList.toggle('u-hidden', individual);
    $('field-subcategory')?.classList.toggle('u-hidden', individual);
    $('field-lesson-type')?.querySelector('label') && ($('field-lesson-type').querySelector('label').textContent = individual ? 'Instrument / cours' : 'Type de rendez-vous');
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
    const offsets = [];
    if($('reminder-24h')?.checked) offsets.push(24 * 60);
    if($('reminder-1h')?.checked) offsets.push(60);
    return { kind, eventAt, uid, user, category, subcategory, lessonType, title, teacher, place, duration, extra, standby, offsets };
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

  function updatePreview(){
    const data = getFormData();
    const offset = data.offsets.includes(60) ? 60 : (data.offsets[0] || 24*60);
    const previewTitle = data.uid && data.user ? displayName(data.user) : (data.kind === 'music_individual' ? 'Membre sélectionné' : [data.category || 'Groupe', data.subcategory].filter(Boolean).join(' · ') || 'Ciblage groupe');
    const body = buildMessage(data, offset);
    const status = data.standby ? 'Stand-by test' : 'Prêt à envoyer plus tard';
    const el = $('bot-preview');
    if(!el) return;
    el.innerHTML = `<div class="bot-bubble">
      <div class="bot-avatar">🤖</div>
      <div class="bot-msg">
        <div class="bot-badge">🤖 Rappel automatique · ${esc(status)}</div>
        <div class="bot-title">${esc(previewTitle)}</div>
        <div class="bot-text">${esc(body).replace(/\n/g,'<br>')}</div>
      </div>
    </div>`;
  }

  async function createReminders(){
    if(isSaving) return;
    const data = getFormData();
    if(!data.eventAt){ msg('Ajoute une date et une heure valides.', false); return; }
    if(!data.offsets.length){ msg('Choisis au moins un rappel : 24h avant ou 1h avant.', false); return; }
    if(data.kind === 'music_individual' && !data.uid){ msg('Choisis le membre concerné par le créneau individuel.', false); return; }
    if(data.kind !== 'music_individual' && !data.category && !data.subcategory){ msg('Choisis au moins une catégorie ou sous-catégorie pour ce rappel groupe.', false); return; }
    const invalid = data.offsets.find(offset => data.eventAt - offset*60*1000 <= Date.now());
    if(invalid){ msg('Un des rappels serait déjà dans le passé. Change la date ou décoche ce rappel.', false); return; }

    isSaving = true;
    const btn = $('btn-create-reminders');
    const old = btn ? btn.textContent : '';
    if(btn){ btn.disabled = true; btn.textContent = 'Création…'; }
    try{
      const created = [];
      for(const offset of data.offsets){
        const sendAt = data.eventAt - offset * 60 * 1000;
        const payload = {
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
          sendAt,
          reminderOffsetMinutes: offset,
          status: data.standby ? 'standby' : 'pending',
          auto: true,
          botLabel: 'Rappel automatique Fais Ton Show',
          createdBy: currentUser ? currentUser.uid : '',
          createdByName: currentProfile ? displayName(currentProfile) : 'Admin',
          makeReady: !data.standby
        };
        const id = await FTS.Services.Reminders.create(payload);
        created.push(id);
      }
      msg(`${created.length} rappel(s) créé(s) dans le module test. Aucun MP réel envoyé.`, true);
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
      wrap.innerHTML = '<div class="empty">Sélectionne un rappel pour voir le détail et les actions.</div>';
      return;
    }
    const status = r.status || 'standby';
    const target = r.uid ? (r.recipientName || r.recipientEmail || 'Membre') : [r.targetCategory, r.targetSubcategory].filter(Boolean).join(' · ');
    wrap.innerHTML = `<div class="preview-card">
      <div class="bot-bubble">
        <div class="bot-avatar">🤖</div>
        <div class="bot-msg">
          <div class="bot-badge">🤖 Rappel automatique · ${esc(statusLabel(status))}</div>
          <div class="bot-title">${esc(target || 'Ciblage')}</div>
          <div class="bot-text">${esc(r.body || '').replace(/\n/g,'<br>')}</div>
        </div>
      </div>
      <div class="helper-box">
        <strong>Détail technique</strong>
        <p>eventAt : ${esc(formatFullDateTime(r.eventAt))}<br>sendAt : ${esc(formatFullDateTime(r.sendAt))}<br>type : ${esc(r.kind || '')} · canal futur : ${esc(r.channel || 'dm_auto')}</p>
      </div>
      <div class="row-actions">
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
    if(status === 'cancelled') return 'Annulé';
    return 'Stand-by';
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
    ['lesson-title','lesson-type','teacher-name','place-name','message-extra'].forEach(id => { if($(id)) $(id).value = ''; });
    if($('reminder-user')) $('reminder-user').value = '';
    if($('reminder-category')) $('reminder-category').value = '';
    if($('reminder-subcategory')) $('reminder-subcategory').value = '';
    if($('duration-min')) $('duration-min').value = '30';
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
