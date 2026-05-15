/* ================================================================
   PAGE MODULE — CALENDRIER-ADMIN
   Extrait depuis calendrier-admin.html pour supprimer le JavaScript inline.
   ================================================================ */

let db, auth, events = [], selectedKey = '';
let categoryStructure = [];
let selectedTargetCategories = new Set();
let selectedTargetSubgroups = {};
let isSavingEvent = false;
let eventReloadTimer = null;
let hasBootSyncedEventsMirror = false;
let isSyncingEventsMirror = false;
function $(id){ return document.getElementById(id); }
function msg(txt, ok=true){ const el=$('msg'); el.textContent=txt; el.className='msg '+(ok?'ok':'err'); setTimeout(()=>{ el.className='msg'; }, 3200); }
function doLogout(){ firebase.auth().signOut().then(()=>location.href='auth.html'); }

function init(){
  db=FTS.initFirebase();
  auth=firebase.auth();
  auth.onAuthStateChanged(async user=>{
    if(!user){ location.href='auth.html'; return; }
    try{
      const snap=await db.ref('fts_users/'+user.uid).once('value');
      const profile=snap.val();
      if(!profile || profile.role!=='admin'){ location.href='membres.html'; return; }
      $('auth-loading').style.display='none';
      $('admin-shell').style.display='block';
      await loadTargetCategories();
      bindTargetSelectionHandlers();
      listenEvents();
      newEvent();
    }catch(e){ console.warn('[FTS Calendrier]', e); location.href='auth.html'; }
  });
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
      return {
        icon: c.icon || c.emoji || FTS.catIcon(name),
        name,
        subcats
      };
    })
    .filter(c => c.name);
}

async function loadTargetCategories(){
  try{
    const rows = FTS.getCategoryStructureAsync
      ? await FTS.getCategoryStructureAsync(db)
      : (FTS.getCategoryStructure ? FTS.getCategoryStructure() : []);
    categoryStructure = normalizeCategoryStructure(rows);
  }catch(e){
    console.warn('[FTS Calendrier] Catégories indisponibles', e);
    categoryStructure = normalizeCategoryStructure(FTS.getDefaultCategoryStructure ? FTS.getDefaultCategoryStructure() : []);
  }
  renderTargetSelector();
}

function bindTargetSelectionHandlers(){
  if(window.__FTS_CAL_TARGETS_BOUND__) return;
  window.__FTS_CAL_TARGETS_BOUND__ = true;
  document.addEventListener('click', function(event){
    const el = event.target && event.target.closest ? event.target.closest('[data-cal-target-action]') : null;
    if(!el || !document.documentElement.contains(el)) return;
    event.preventDefault();
    const action = el.getAttribute('data-cal-target-action');
    const cat = el.getAttribute('data-cat') || '';
    const sub = el.getAttribute('data-sub') || '';
    if(action === 'toggle-cat') toggleTargetCategory(cat);
    if(action === 'toggle-sub') toggleTargetSubgroup(cat, sub);
  });
}

function toggleTargetCategory(cat){
  if(!cat) return;
  if(selectedTargetCategories.has(cat)){
    selectedTargetCategories.delete(cat);
    delete selectedTargetSubgroups[cat];
  }else{
    selectedTargetCategories.add(cat);
    if(!selectedTargetSubgroups[cat]) selectedTargetSubgroups[cat] = new Set();
  }
  renderTargetSelector();
}

function toggleTargetSubgroup(cat, sub){
  if(!cat || !sub) return;
  if(!selectedTargetCategories.has(cat)) selectedTargetCategories.add(cat);
  if(!selectedTargetSubgroups[cat]) selectedTargetSubgroups[cat] = new Set();
  if(selectedTargetSubgroups[cat].has(sub)) selectedTargetSubgroups[cat].delete(sub);
  else selectedTargetSubgroups[cat].add(sub);
  renderTargetSelector();
}

function renderTargetSelector(){
  const wrap = $('event-targets');
  if(!wrap) return;
  if(!categoryStructure.length){
    wrap.innerHTML = '<div class="empty">Aucun groupe disponible.</div>';
    return;
  }
  wrap.innerHTML = categoryStructure.map(cat => {
    const catOn = selectedTargetCategories.has(cat.name);
    const subs = Array.isArray(cat.subcats) ? cat.subcats : [];
    const subHtml = (catOn && subs.length) ? `<div class="target-subgrid">${subs.map(sub => {
      const on = selectedTargetSubgroups[cat.name] && selectedTargetSubgroups[cat.name].has(sub);
      return `<button type="button" class="target-pill target-sub ${on ? 'active' : ''}" data-cal-target-action="toggle-sub" data-cat="${FTS.esc(cat.name)}" data-sub="${FTS.esc(sub)}">${on ? '✓ ' : ''}${FTS.esc(sub)}</button>`;
    }).join('')}</div>` : '';
    return `<div class="target-group">
      <button type="button" class="target-pill target-cat ${catOn ? 'active' : ''}" data-cal-target-action="toggle-cat" data-cat="${FTS.esc(cat.name)}">${catOn ? '✓ ' : ''}${cat.icon || FTS.catIcon(cat.name)} ${FTS.esc(cat.name)}</button>
      ${subHtml}
    </div>`;
  }).join('');
}

function resetTargetSelection(){
  selectedTargetCategories = new Set();
  selectedTargetSubgroups = {};
  renderTargetSelector();
}

function setTargetSelectionFromEvent(e){
  selectedTargetCategories = new Set(normArray(e.targetCategories || e.categories || e.groups));
  selectedTargetSubgroups = {};

  if(e && e.targetGroups && typeof e.targetGroups === 'object' && !Array.isArray(e.targetGroups)){
    Object.entries(e.targetGroups).forEach(([cat, subs]) => {
      if(!cat) return;
      selectedTargetCategories.add(cat);
      selectedTargetSubgroups[cat] = new Set(normArray(subs));
    });
  }else{
    const raw = e.targetSubgroups || e.targetSubcategories || e.subgroups || e.subcategories || [];
    const subs = normArray(raw);
    subs.forEach(sub => {
      const cat = categoryStructure.find(c => (c.subcats || []).some(s => FTS.norm(s) === FTS.norm(sub)));
      if(cat){
        selectedTargetCategories.add(cat.name);
        if(!selectedTargetSubgroups[cat.name]) selectedTargetSubgroups[cat.name] = new Set();
        selectedTargetSubgroups[cat.name].add(sub);
      }
    });
  }

  renderTargetSelector();
}

function getTargetSelection(){
  const categories = [...selectedTargetCategories];
  const subgroups = [];
  const groups = {};

  categories.forEach(cat => {
    const set = selectedTargetSubgroups[cat];
    const subs = set ? [...set].map(x => String(x || '').trim()).filter(Boolean) : [];
    groups[cat] = [...new Set(subs)];
    subs.forEach(s => subgroups.push(s));
  });

  return {
    targetCategories: [...new Set(categories)],
    targetSubgroups: [...new Set(subgroups)],
    targetGroups: groups
  };
}

function normArray(value){
  if(Array.isArray(value)) return value.map(x => String(x || '').trim()).filter(Boolean);
  return String(value || '').split(',').map(x => x.trim()).filter(Boolean);
}

function eventTargetLabel(e){
  const cats = normArray(e.targetCategories);
  const subs = normArray(e.targetSubgroups);
  if(!cats.length && !subs.length) return 'Tout le monde';
  if(subs.length) return [...cats, ...subs].join(' · ');
  return cats.join(' · ');
}

function userMatchesEventTargets(profile, e){
  const cats = normArray(e.targetCategories);
  const subs = normArray(e.targetSubgroups);
  if(!cats.length && !subs.length) return true;
  const userCats = collectUserCategories(profile).map(FTS.norm);
  const userSubs = collectUserSubgroups(profile).map(FTS.norm);
  const catOk = cats.some(c => userCats.includes(FTS.norm(c)));
  const subOk = subs.some(sg => userSubs.includes(FTS.norm(sg)));
  return catOk || subOk;
}

function collectUserCategories(profile){
  const own = normArray(profile && (profile.disciplines || profile.group));
  const child = (profile && Array.isArray(profile.enfants))
    ? profile.enfants.flatMap(e => normArray(e.disciplines || e.group))
    : [];
  return [...new Set([...own, ...child])];
}

function collectUserSubgroups(profile){
  const own = normArray(profile && (profile.subgroups || profile.subcategories || profile.subgroup));
  const child = (profile && Array.isArray(profile.enfants))
    ? profile.enfants.flatMap(e => normArray(e.subgroups || e.subcategories || e.subgroup))
    : [];
  return [...new Set([...own, ...child])];
}

function listenEvents(){
  // On écoute les deux sources :
  // 1) fts_events = source officielle membres
  // 2) fts_content/questionnaire/options = copie publique utilisée par index
  // Cela permet de retrouver/modifier les anciens événements déjà synchronisés.
  // Le rechargement est délayé pour éviter les cascades d'écritures Firebase.
  const reload = () => scheduleEventsReload();
  db.ref('fts_events').on('value', reload, err=>{
    console.warn('[FTS Calendrier] events', err);
    $('event-list').innerHTML='<div class="empty">Impossible de charger les événements fts_events.</div>';
  });
  db.ref('fts_content/questionnaire/options').on('value', reload, err=>{
    console.warn('[FTS Calendrier] questionnaire events', err);
  });
}

function scheduleEventsReload(){
  if(isSyncingEventsMirror) return;
  clearTimeout(eventReloadTimer);
  eventReloadTimer = setTimeout(() => loadEventsFromAllSources(), 120);
}

async function loadEventsFromAllSources(){
  try{
    const [evtSnap, qSnap] = await Promise.all([
      db.ref('fts_events').once('value'),
      db.ref('fts_content/questionnaire/options').once('value')
    ]);

    const byKey = new Map();

    if(evtSnap.exists()) evtSnap.forEach(child=>{
      const e = normalizeEvent(child.key, child.val()||{});
      e.source = 'events';
      e.eventKey = child.key;
      e.qKey = questionEventKey(child.key);
      byKey.set(child.key, e);
    });

    if(qSnap.exists()) qSnap.forEach(child=>{
      const v = child.val() || {};
      if(String(v.type || '').toLowerCase() !== 'event') return;
      // Les options créées/synchronisées par le calendrier portent source=fts_events,
      // mais on récupère aussi les anciennes options event créées depuis contenus-admin.
      const eventKey = v.eventKey || (String(child.key).startsWith('event_') ? String(child.key).replace(/^event_/, '') : child.key);
      if(byKey.has(eventKey)){
        const existing = byKey.get(eventKey);
        existing.qKey = child.key;
        return;
      }
      const e = normalizeEvent(eventKey, {
        name: v.title || v.titre,
        type: v.description || v.desc || '',
        active: v.active,
        status: v.status,
        dateIso: v.dateIso || v.isoDate || '',
        date: v.dateLabel || v.date || v.d || '',
        dateLabel: v.dateLabel || v.date || v.d || '',
        hour: v.hour || v.h || '',
        location: v.location || v.l || '',
        url: v.link || v.lien || v.url || v.u || '',
        description: v.destDesc || v.dest_desc || v.description || v.desc || '',
        dateTs: v.dateTs || v.startTs || v.ts || v.order || 0,
        updatedAt: v.updatedAt || 0
      });
      e.source = 'questionnaire';
      e.eventKey = eventKey;
      e.qKey = child.key;
      byKey.set(eventKey, e);
    });

    events = Array.from(byKey.values()).sort((a,b)=>
      (a.dateTs||Number.MAX_SAFE_INTEGER)-(b.dateTs||Number.MAX_SAFE_INTEGER) ||
      (a.name||'').localeCompare(b.name||'', 'fr')
    );
    renderList();

    // Migration / réparation du miroir questionnaire uniquement au premier chargement.
    // Ce miroir est nécessaire pour index.html si fts_events n'est pas lisible publiquement,
    // mais le relancer à chaque listener crée des boucles d'écritures.
    if(!hasBootSyncedEventsMirror){
      hasBootSyncedEventsMirror = true;
      await syncAllEventsToQuestionnaire();
    }
  }catch(e){
    console.warn('[FTS Calendrier] load all sources', e);
    $('event-list').innerHTML='<div class="empty">Impossible de charger les événements.</div>';
  }
}

function normalizeEvent(key, v){
  return {
    key,
    name:v.name||v.nom||v.title||v.titre||v.n||'',
    type:v.type||v.t||'',
    active:v.active!==false && v.status!=='inactive',
    date:v.dateIso||v.isoDate||v.dateInput||v.date||'',
    dateLabel:v.dateLabel||v.d||v.date||'',
    hour:v.hour||v.heure||v.time||v.h||'',
    location:v.location||v.lieu||v.l||'',
    url:v.url||v.link||v.lien||v.u||'',
    desc:v.description||v.desc||'',
    dateTs:Number(v.dateTs||v.startTs||v.ts||0),
    updatedAt:v.updatedAt||0,
    important:v.important === true || v.priority === 'important',
    priority:v.priority || (v.important ? 'important' : 'normal'),
    targetCategories:normArray(v.targetCategories || v.categories || v.groups),
    targetSubgroups:normArray(v.targetSubgroups || v.targetSubcategories || v.subgroups || v.subcategories),
    targetGroups:(v.targetGroups && typeof v.targetGroups === 'object') ? v.targetGroups : null
  };
}

function renderList(){
  const el=$('event-list');
  if(!events.length){ el.innerHTML='<div class="empty">Aucun événement. Clique sur “Ajouter un événement”.</div>'; return; }
  el.innerHTML=events.map(e=>{
    const d=e.dateTs?new Date(e.dateTs):null;
    const day=d?String(d.getDate()).padStart(2,'0'):'—';
    const month=d?d.toLocaleDateString('fr-FR',{month:'short'}).replace('.',''):'Date';
    return `<div class="evt-row${selectedKey===e.key?' sel':''}${!e.active?' evt-off':''}" data-fts-click="editEvent('${FTS.esc(e.key)}')">
      <div class="evt-date"><div class="evt-day">${day}</div><div class="evt-month">${FTS.esc(month)}</div></div>
      <div class="evt-info"><div class="evt-name">${FTS.esc(e.name||'Sans nom')}<span class="status-pill ${e.active?'status-on':'status-off'}">${e.active?'Visible':'Masqué'}</span>${e.important?'<span class="status-pill status-important">Important</span>':''}${e.source==='questionnaire'?'<span class="status-pill status-off">À migrer</span>':''}</div><div class="evt-meta">${FTS.esc(e.dateLabel||'Date non renseignée')}${e.hour?' · '+FTS.esc(e.hour):''}${e.location?' · '+FTS.esc(e.location):''}</div><div class="evt-target">👥 ${FTS.esc(eventTargetLabel(e))}</div></div>
    </div>`;
  }).join('');
}

function newEvent(){
  selectedKey='';
  ['e-key','e-name','e-type','e-date','e-hour','e-location','e-url','e-desc'].forEach(id=>$(id).value='');
  $('e-active').value='true';
  if($('e-important')) $('e-important').value='false';
  resetTargetSelection();
  renderList();
}
function editEvent(key){
  const e=events.find(x=>x.key===key || x.eventKey===key); if(!e) return;
  selectedKey=key;
  $('e-key').value=e.key;
  $('e-name').value=e.name||'';
  $('e-type').value=e.type||'';
  $('e-active').value=String(e.active!==false);
  $('e-date').value=isoInputFromEvent(e);
  $('e-hour').value=toInputTime(e.hour||'');
  $('e-location').value=e.location||'';
  $('e-url').value=e.url||'';
  $('e-desc').value=e.desc||'';
  if($('e-important')) $('e-important').value=String(!!e.important);
  setTargetSelectionFromEvent(e);
  renderList();
}
function isoInputFromEvent(e){
  if(e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) return e.date;
  if(e.dateTs) return new Date(e.dateTs).toISOString().slice(0,10);
  return '';
}
function toInputTime(h){
  const s=String(h||'').trim();
  if(/^\d{2}:\d{2}$/.test(s)) return s;
  const m=s.match(/(\d{1,2})\s*h\s*(\d{2})?/i);
  if(m) return String(m[1]).padStart(2,'0')+':'+(m[2]||'00');
  return '';
}
function frDateLabel(iso){
  if(!iso) return '';
  const d=new Date(iso+'T00:00:00');
  return d.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}
function dateTs(iso,hour){
  if(!iso) return 0;
  const h=(hour||'00:00').split(':');
  const d=new Date(iso+'T00:00:00');
  d.setHours(Number(h[0]||0), Number(h[1]||0), 0, 0);
  return d.getTime();
}
function questionEventKey(eventKey){
  return 'event_' + String(eventKey || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}
function eventToQuestionnaireOption(key, data){
  const date = data.dateLabel || data.date || data.d || '';
  const hour = data.hour || data.h || '';
  const location = data.location || data.l || '';
  const details = [];
  if(date) details.push({ key:'Date', value: hour ? date + ' · ' + hour : date });
  if(location) details.push({ key:'Lieu', value: location });
  return {
    source:'fts_events',
    eventKey:key,
    type:'event',
    order:Number(data.dateTs || 9999999999999),
    icon:data.icon || '🎪',
    active:data.active !== false && data.status !== 'inactive',
    status:(data.active !== false && data.status !== 'inactive') ? 'active' : 'inactive',
    title:data.name || data.title || data.n || 'Événement',
    titre:data.name || data.title || data.n || 'Événement',
    description:data.description || data.desc || data.type || '',
    desc:data.description || data.desc || data.type || '',
    link:data.url || data.u || data.link || data.lien || '#',
    lien:data.url || data.u || data.link || data.lien || '#',
    destTitle:data.name || data.title || data.n || 'Événement',
    dest_titre:data.name || data.title || data.n || 'Événement',
    destDesc:data.description || data.desc || (date ? (hour ? date + ' · ' + hour : date) : ''),
    dest_desc:data.description || data.desc || (date ? (hour ? date + ' · ' + hour : date) : ''),
    details,
    detail1_cle:details[0]?.key || '',
    detail1_valeur:details[0]?.value || '',
    detail2_cle:details[1]?.key || '',
    detail2_valeur:details[1]?.value || '',
    dateTs:Number(data.dateTs || data.startTs || data.ts || 0),
    dateLabel:date,
    hour,
    location,
    important:data.important === true || data.priority === 'important',
    priority:data.priority || (data.important ? 'important' : 'normal'),
    targetCategories:normArray(data.targetCategories || []),
    targetSubgroups:normArray(data.targetSubgroups || []),
    updatedAt:Date.now()
  };
}
async function syncEventToQuestionnaire(key, data){
  await db.ref('fts_content/questionnaire/options/' + questionEventKey(key)).set(eventToQuestionnaireOption(key, data));
}
async function removeEventFromQuestionnaire(key){
  await db.ref('fts_content/questionnaire/options/' + questionEventKey(key)).remove();
}
async function syncAllEventsToQuestionnaire(){
  if(isSyncingEventsMirror) return;
  isSyncingEventsMirror = true;
  try{
    const snap = await db.ref('fts_events').once('value');
    const updates = {};
    if(snap.exists()) snap.forEach(child => {
      updates['fts_content/questionnaire/options/' + questionEventKey(child.key)] = eventToQuestionnaireOption(child.key, child.val() || {});
    });
    if(Object.keys(updates).length) await db.ref().update(updates);
  }catch(e){ console.warn('[FTS Calendrier] sync questionnaire', e); }
  finally{
    setTimeout(() => { isSyncingEventsMirror = false; }, 250);
  }
}
async function getEventRecipientUids(excludeUid, eventData){
  const snap = await db.ref('fts_users').orderByChild('status').equalTo('active').once('value');
  const uids = [];
  if(snap.exists()) snap.forEach(child => {
    const profile = child.val() || {};
    if(child.key !== excludeUid && userMatchesEventTargets(profile, eventData || {})) uids.push(child.key);
  });
  return uids;
}
async function notifyNewEvent(key, data){
  try{
    if(!key || !data || data.active === false || data.status === 'inactive') return;
    const currentUser = auth && auth.currentUser ? auth.currentUser.uid : '';
    const recipientUids = await getEventRecipientUids(currentUser, data);
    if(!recipientUids.length) return;

    const dateText = data.dateLabel || data.date || data.d || '';
    const hourText = data.hour || data.h || '';
    const locationText = data.location || data.l || '';
    const details = [dateText + (hourText ? ' · ' + hourText : ''), locationText].filter(Boolean).join(' · ');
    const url = './membres.html?event=' + encodeURIComponent(key);
    const notificationKey = 'event-' + key;

    // Trace interne utile pour audit / fallback local côté membres.
    const notif = {
      type:'event', eventId:key, notificationKey, title:'Nouvel événement',
      body:(data.name || data.title || 'Nouvel événement') + (details ? ' · ' + details : ''),
      url, read:false, createdAt:Date.now(), authorUid:currentUser
    };
    const fanout = {};
    recipientUids.forEach(uid => {
      const nref = db.ref('fts_user_notifications/' + uid).push();
      fanout['fts_user_notifications/' + uid + '/' + nref.key] = notif;
    });
    await db.ref().update(fanout).catch(()=>{});

    if(!FTS.PUSH || !FTS.PUSH.workerUrl){
      await db.ref('fts_debug_notifications/event_' + key).set({
        ok:false, reason:'FTS.PUSH.workerUrl manquant dans fts-firebase.js',
        recipientCount:recipientUids.length, recipients:recipientUids, eventId:key, notificationKey, createdAt:Date.now()
      }).catch(()=>{});
      return;
    }

    const payload = {
      type:'event',
      eventId:key,
      notificationKey,
      title:'FTS — Nouvel événement',
      body:(data.name || data.title || 'Nouvel événement') + (details ? ' · ' + details : ''),
      url,
      senderUid:currentUser,
      uids:recipientUids,
      recipientUids,
      recipients:recipientUids,
      tag:notificationKey,
      collapseKey:notificationKey,
      forceUid:true
    };

    const res = await fetch(FTS.PUSH.workerUrl + '/notify', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });

    await db.ref('fts_debug_notifications/' + notificationKey).set({
      ok:res.ok,
      status:res.status,
      recipientCount:recipientUids.length,
      recipients:recipientUids,
      eventId:key,
      notificationKey,
      createdAt:Date.now()
    }).catch(()=>{});
  }catch(e){ console.warn('[FTS Calendrier] Notification événement non envoyée', e); }
}
async function saveEvent(){
  if(isSavingEvent) return;
  const saveBtn = $('btn-save-event');
  isSavingEvent = true;
  if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement…'; }

  try{
    const name=$('e-name').value.trim();
    const iso=$('e-date').value;
    const hour=$('e-hour').value;
    if(!name){ msg('Nom requis', false); return; }
    if(!iso){ msg('Date requise', false); return; }
    const selected = events.find(x => x.key === $('e-key').value || x.eventKey === $('e-key').value);
    const key = (selected && selected.eventKey) || $('e-key').value || db.ref('fts_events').push().key;
    const active=$('e-active').value==='true';
    const targets = getTargetSelection();
    const important = $('e-important') ? $('e-important').value === 'true' : false;
    const data={
      name,
      title:name,
      n:name,
      type:$('e-type').value.trim(),
      t:$('e-type').value.trim(),
      active,
      status:active?'active':'inactive',
      dateIso:iso,
      date:frDateLabel(iso),
      dateLabel:frDateLabel(iso),
      d:frDateLabel(iso),
      hour,
      h:hour,
      location:$('e-location').value.trim(),
      l:$('e-location').value.trim(),
      url:$('e-url').value.trim(),
      u:$('e-url').value.trim(),
      description:$('e-desc').value.trim(),
      important,
      priority:important ? 'important' : 'normal',
      targetCategories:targets.targetCategories,
      targetSubgroups:targets.targetSubgroups,
      targetGroups:targets.targetGroups,
      dateTs:dateTs(iso,hour),
      updatedAt:Date.now()
    };
    const isNewEvent = !$('e-key').value && !(selected && selected.eventKey);
    if(isNewEvent) data.createdAt=Date.now();
    await db.ref('fts_events/'+key).set(data);
    await syncEventToQuestionnaire(key, data);
    if(isNewEvent) await notifyNewEvent(key, data);
    // Si l’événement venait d’une ancienne option du questionnaire, on supprime l’ancienne entrée
    // après migration pour éviter les doublons.
    if(selected && selected.qKey && selected.qKey !== questionEventKey(key)){
      await db.ref('fts_content/questionnaire/options/' + selected.qKey).remove();
    }
    selectedKey=key; $('e-key').value=key;
    msg('Événement enregistré — visible dans membres et dans le questionnaire');
  }catch(e){
    console.warn('[FTS Calendrier] saveEvent', e);
    msg('Erreur enregistrement : ' + (e && e.message ? e.message : e), false);
  }finally{
    isSavingEvent = false;
    if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer'; }
  }
}
async function deleteEvent(){
  const key=$('e-key').value;
  if(!key){ msg('Sélectionne un événement à supprimer', false); return; }
  const selected = events.find(x => x.key === key || x.eventKey === key);
  const eventKey = (selected && selected.eventKey) || key;
  if(!confirm('Supprimer définitivement cet événement ?')) return;
  const updates = {};
  updates['fts_events/' + eventKey] = null;
  updates['fts_content/questionnaire/options/' + questionEventKey(eventKey)] = null;
  if(selected && selected.qKey) updates['fts_content/questionnaire/options/' + selected.qKey] = null;
  await db.ref().update(updates);
  newEvent();
  msg('Événement supprimé');
}

init();

/* FTS_AUTO_EXTRACTED_HANDLERS:calendrier-admin.html */
(function(){
  'use strict';
  var handlers = [{"selector": "[data-fts-handler-1]", "event": "click", "code": "doLogout()"}, {"selector": "[data-fts-handler-2]", "event": "click", "code": "newEvent()"}, {"selector": "[data-fts-handler-3]", "event": "click", "code": "saveEvent()"}, {"selector": "[data-fts-handler-4]", "event": "click", "code": "newEvent()"}, {"selector": "[data-fts-handler-5]", "event": "click", "code": "deleteEvent()"}];
  function bindExtractedHandlers(){
    handlers.forEach(function(h){
      document.querySelectorAll(h.selector).forEach(function(el){
        if (el.__ftsExtractedHandlers && el.__ftsExtractedHandlers[h.event + h.code]) return;
        el.__ftsExtractedHandlers = el.__ftsExtractedHandlers || {};
        el.__ftsExtractedHandlers[h.event + h.code] = true;
        el.addEventListener(h.event, function(event){
          try { (new Function('event', h.code)).call(el, event); }
          catch (err) { console.error('[FTS] Handler extrait en erreur:', h.code, err); }
        });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindExtractedHandlers);
  else bindExtractedHandlers();
})();
/* END_FTS_AUTO_EXTRACTED_HANDLERS */
