/* ================================================================
   PAGE MODULE — ADMIN
   Extrait depuis admin.html pour supprimer le JavaScript inline.
   ================================================================ */

let db, auth;
function doLogout(){ firebase.auth().signOut().then(()=>location.href='auth.html'); }
function showError(msg){
  const err=document.getElementById('auth-error');
  if(err){ err.style.display='block'; err.innerHTML=FTS.esc(msg)+'<br><br><a href="auth.html">Retour connexion</a>'; }
}


/* ── PUSH ADMIN : canal interne nouvelles inscriptions ───────────
   Marque l'abonnement push de l'admin avec le groupe technique __admin__.
   Ainsi les nouvelles demandes peuvent notifier uniquement les admins.
──────────────────────────────────────────────────────────────── */
async function ftsEnsureAdminPushChannel(user, profile){
  try{
    if(!user || !user.uid || !profile || profile.role !== 'admin') return;
    if(!window.FTS || !FTS.PUSH || !FTS.PUSH.workerUrl || !FTS.PUSH.vapidPublicKey) return;
    if(!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if(typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey: ftsUrlBase64ToUint8Array(FTS.PUSH.vapidPublicKey)
      });
    }

    const groups = ftsUniqueAdminPushList(['__admin__']
      .concat(profile.disciplines || [])
      .concat(String(profile.group || profile.groups || '').split(',')));
    const subgroups = ftsUniqueAdminPushList([]
      .concat(profile.subgroups || [])
      .concat(String(profile.subgroup || profile.subcategories || '').split(',')));

    await FTS.pushRequest('/subscribe', {
      uid:user.uid,
      subscription:sub.toJSON(),
      group:groups.join(', '),
      subgroup:subgroups.join(', '),
      role:'admin',
      admin:true,
      adminChannel:true
    }).catch(function(){});
  }catch(e){
    console.warn('[FTS Admin Push] Canal admin non initialisé', e);
  }
}
function ftsUniqueAdminPushList(list){
  return [...new Set((list||[]).map(v=>String(v||'').trim()).filter(Boolean))];
}
function ftsUrlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
window.addEventListener('DOMContentLoaded',()=>{
  db=FTS.initFirebase(); auth=firebase.auth();
  auth.onAuthStateChanged(async user=>{
    if(!user){ location.href='auth.html'; return; }
    try{
      const snap=await db.ref('fts_users/'+user.uid).once('value');
      const profile=snap.val();
      if(!profile || profile.role!=='admin'){
        location.href='membres.html'; return;
      }
      document.getElementById('admin-name').textContent=profile.firstName || profile.name || user.email || 'admin';
      document.getElementById('auth-loading').style.display='none';
      document.getElementById('admin-shell').style.display='block';
      ftsEnsureAdminPushChannel(user, profile);
      try { FTS.syncAllPublicProfiles(db).catch(function(e){ console.warn('[FTS Admin] Sync profils publics non bloquant :', e); }); } catch(e) {}
      loadAdminOverview();
      adminStartLivePendingRefresh();
    }catch(e){ console.warn('[FTS Admin Hub]',e); showError(e && e.message ? e.message : String(e)); }
  });
});



function adminStartLivePendingRefresh(){
  if(window.__FTS_ADMIN_PENDING_LIVE_BOUND__ || !db) return;
  window.__FTS_ADMIN_PENDING_LIVE_BOUND__ = true;
  let t = null;
  db.ref('fts_users').on('value', function(){
    clearTimeout(t);
    t = setTimeout(function(){ loadAdminOverview(); }, 250);
  });
}

/* FTS_AUTO_EXTRACTED_HANDLERS:admin.html */
(function(){
  'use strict';
  var handlers = [{"selector": "[data-fts-handler-1]", "event": "click", "code": "doLogout()"}];
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

/* === FTS Etape 4 — Admin cockpit résumé V3 : sous-catégories rattachées à leur catégorie === */
function adminNormList(value){
  if(Array.isArray(value)) return value.map(v=>String(v||'').trim()).filter(Boolean);
  if(value && typeof value === 'object') return Object.values(value).map(v=>String(v||'').trim()).filter(Boolean);
  return String(value||'').split(',').map(v=>v.trim()).filter(Boolean);
}
function adminUnique(list){
  return [...new Set((list||[]).map(v=>String(v||'').trim()).filter(Boolean))];
}
function adminNormKey(value){
  if(window.FTS && typeof FTS.norm === 'function') return FTS.norm(value || '');
  return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function adminUserIsStaff(u){
  const role = String((u && u.role) || '').toLowerCase();
  return role === 'admin' || role === 'prof' || role === 'teacher';
}
function adminCollectPeopleFromUser(u){
  const people = [];
  const status = u && u.status;
  if(status !== 'active') return people;
  const parentCats = adminUnique(adminNormList(u.disciplines || u.group || u.groups || u.categories));
  const parentSubs = adminUnique(adminNormList(u.subgroups || u.subgroup || u.subcategories || u.subcategory));
  if(parentCats.length || parentSubs.length){
    people.push({cats:parentCats, subs:parentSubs});
  }
  const children = Array.isArray(u.enfants) ? u.enfants : [];
  children.forEach(child=>{
    const childCats = adminUnique(adminNormList(child.disciplines || child.group || child.groups || child.categories));
    const childSubs = adminUnique(adminNormList(child.subgroups || child.subgroup || child.subcategories || child.subcategory));
    if(childCats.length || childSubs.length){
      people.push({cats:childCats, subs:childSubs});
    }
  });
  return people;
}
function adminBuildCategoryMeta(structure){
  const cats = {};
  const subToCats = {};
  (structure || []).forEach(cat=>{
    const catName = cat.name || cat.category || '';
    const catKey = adminNormKey(catName);
    if(!catName || !catKey) return;
    const subs = adminUnique((cat.subs || cat.subcats || cat.subcategories || []).map(s=>{
      if(typeof s === 'string') return s;
      return s && (s.name || s.label || s.title);
    }).filter(Boolean));
    cats[catKey] = { name:catName, subsByKey:{} };
    subs.forEach(sub=>{
      const subKey = adminNormKey(sub);
      if(!subKey) return;
      cats[catKey].subsByKey[subKey] = sub;
      subToCats[subKey] = subToCats[subKey] || [];
      subToCats[subKey].push(catKey);
    });
  });
  return {cats, subToCats};
}
function adminEnsureCategory(stats, name){
  if(!name) return null;
  if(!stats[name]) stats[name] = {name, total:0, subs:{}};
  return stats[name];
}
function adminAddPersonToStats(stats, person, meta){
  const rawCats = adminUnique(person.cats || []);
  const rawSubs = adminUnique(person.subs || []);
  const explicitCatKeys = rawCats.map(adminNormKey).filter(Boolean);

  // Si une personne a seulement une sous-catégorie, on retrouve sa catégorie via la structure officielle.
  const inferredCatKeys = [];
  rawSubs.forEach(sub=>{
    const matches = (meta.subToCats && meta.subToCats[adminNormKey(sub)]) || [];
    matches.forEach(k=>{ if(!inferredCatKeys.includes(k)) inferredCatKeys.push(k); });
  });

  const catKeys = adminUnique([...explicitCatKeys, ...inferredCatKeys]);
  catKeys.forEach(catKey=>{
    const catMeta = meta.cats && meta.cats[catKey];
    const catName = catMeta ? catMeta.name : (rawCats.find(c=>adminNormKey(c)===catKey) || catKey);
    const entry = adminEnsureCategory(stats, catName);
    if(!entry) return;
    entry.total += 1;

    // Important : on n'affiche sous une catégorie QUE les sous-catégories qui lui appartiennent.
    rawSubs.forEach(sub=>{
      const subKey = adminNormKey(sub);
      const officialSubName = catMeta && catMeta.subsByKey ? catMeta.subsByKey[subKey] : null;
      if(!officialSubName) return;
      entry.subs[officialSubName] = (entry.subs[officialSubName] || 0) + 1;
    });
  });
}
function adminRenderCategorySummary(stats){
  const grid = document.getElementById('category-summary-grid');
  if(!grid) return;
  const rows = Object.values(stats || {}).sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name, 'fr'));
  if(!rows.length){
    grid.innerHTML = '<div class="insight-empty">Aucune catégorie trouvée dans les profils validés pour le moment.</div>';
    return;
  }
  grid.innerHTML = rows.map(cat=>{
    const subs = Object.entries(cat.subs || {}).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0], 'fr'));
    const subHtml = subs.length
      ? `<div class="sub-stat-list">${subs.map(([name,count])=>`<span class="sub-stat-pill">${FTS.esc(name)} · <strong>${count}</strong></span>`).join('')}</div>`
      : '<div class="sub-stat-list"><span class="sub-stat-pill">Aucune sous-catégorie renseignée</span></div>';
    return `<article class="category-stat-card">
      <div class="category-stat-top">
        <div class="category-stat-name">${FTS.esc(cat.name)}</div>
        <div class="category-stat-count">${cat.total} personne${cat.total>1?'s':''}</div>
      </div>
      ${subHtml}
    </article>`;
  }).join('');
}
async function loadAdminOverview(){
  if(!db) return;
  try{
    const [usersSnap, categoryStructure] = await Promise.all([
      db.ref('fts_users').once('value'),
      (window.FTS && typeof FTS.getCategoryStructureAsync === 'function') ? FTS.getCategoryStructureAsync(db) : Promise.resolve([])
    ]);
    const users = usersSnap.val() || {};
    const meta = adminBuildCategoryMeta(categoryStructure || []);
    let pending=0, active=0, staff=0, children=0;
    const categoryStats = {};
    Object.values(users).forEach(u=>{
      if(!u) return;
      if(u.status === 'pending') pending += 1;
      if(u.status === 'active') active += 1;
      if(u.status === 'active' && adminUserIsStaff(u)) staff += 1;
      if(Array.isArray(u.enfants)) children += u.enfants.length;
      adminCollectPeopleFromUser(u).forEach(person=>adminAddPersonToStats(categoryStats, person, meta));
    });
    const setText=(id,value)=>{ const el=document.getElementById(id); if(el) el.textContent=String(value); };
    setText('stat-pending', pending);
    setText('stat-pending-simple', pending);
    setText('stat-active', active);
    setText('stat-staff', staff);
    setText('stat-children', children);
    adminRenderCategorySummary(categoryStats);
  }catch(e){
    console.warn('[FTS Admin Overview]', e);
    const grid = document.getElementById('category-summary-grid');
    if(grid) grid.innerHTML = '<div class="insight-empty">Résumé temporairement indisponible.</div>';
  }
}

/* === FTS V79 — Admin quotidien : points à surveiller + recherche rapide === */
const adminV79State = { users:{}, today:{}, searchReady:false };
function adminText(value){ return (window.FTS && typeof FTS.esc === 'function') ? FTS.esc(value || '') : String(value||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function adminLower(value){ return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function adminIsVisibleRecord(v){
  if(!v) return false;
  if(v.visible === false || v.active === false || v.status === 'inactive' || v.status === 'hidden') return false;
  const end = Number(v.endsAt || v.endAt || v.expiresAt || v.expireAt || 0);
  return !end || end >= Date.now();
}
function adminParseDateTs(v){
  if(!v) return 0;
  if(Number(v.dateTs || v.ts || v.startTs || 0)) return Number(v.dateTs || v.ts || v.startTs || 0);
  const iso = v.dateIso || v.iso || v.date;
  const hour = v.hour || v.h || '00:00';
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''))){
    const d = new Date(String(iso) + 'T' + String(hour || '00:00'));
    return d.getTime() || 0;
  }
  return 0;
}
function adminCountChildren(u){ return Array.isArray(u && u.enfants) ? u.enfants.length : 0; }
function adminDisplayName(u){
  return [u && (u.firstName || u.firstname || u.prenom), u && (u.lastName || u.lastname || u.nom)].filter(Boolean).join(' ').trim() || (u && (u.name || u.displayName || u.email)) || 'Membre';
}
function adminPersonSearchBlob(uid, u){
  const parts = [uid, adminDisplayName(u), u && u.email, u && u.phone, u && u.tel, u && u.role, u && u.status];
  adminNormList(u && (u.disciplines || u.categories || u.groups || u.group)).forEach(x=>parts.push(x));
  adminNormList(u && (u.subgroups || u.subcategories || u.subgroup || u.subcategory)).forEach(x=>parts.push(x));
  (Array.isArray(u && u.enfants) ? u.enfants : []).forEach(c=>{
    parts.push(c && (c.firstName || c.prenom || c.name), c && (c.lastName || c.nom), c && c.phone, c && c.tel, c && c.birthdate);
    adminNormList(c && (c.disciplines || c.categories || c.groups || c.group)).forEach(x=>parts.push(x));
    adminNormList(c && (c.subgroups || c.subcategories || c.subgroup || c.subcategory)).forEach(x=>parts.push(x));
  });
  return adminLower(parts.filter(Boolean).join(' '));
}
function adminRenderTodayCard(icon, title, value, note, href, tone){
  return `<a class="fts-admin-today-card ${tone ? 'tone-'+tone : ''}" href="${adminText(href || 'admin.html')}">
    <div class="fts-admin-today-icon">${adminText(icon)}</div>
    <div class="fts-admin-today-main"><strong>${adminText(value)}</strong><span>${adminText(title)}</span><small>${adminText(note)}</small></div>
  </a>`;
}
function adminRenderTodayPanel(data){
  const grid = document.getElementById('admin-today-grid');
  if(!grid) return;
  const cards = [
    adminRenderTodayCard('⏳','inscriptions à valider', data.pending || 0, 'À traiter en premier.', 'forum-admin.html#tab-pending', (data.pending||0)>0?'warning':''),
    adminRenderTodayCard('📣','annonces actives', data.activeAnnouncements || 0, 'Infos visibles côté membres.', 'contenus-admin.html', ''),
    adminRenderTodayCard('📅','événements sur 30 jours', data.upcomingEvents || 0, 'Dates proches à vérifier.', 'calendrier-admin.html', ''),
    adminRenderTodayCard('📊','sondages actifs', data.activePolls || 0, 'Réponses à suivre.', 'sondages.html', ''),
    adminRenderTodayCard('🤖','rappels à venir', data.pendingReminders || 0, 'Rappels pending programmés.', 'rappels-admin.html', ''),
    adminRenderTodayCard('⚠️','rappels à vérifier', data.reminderErrors || 0, 'Avec erreur de dispatch ou blocage.', 'rappels-admin.html#reminder-errors', (data.reminderErrors||0)>0?'danger':'')
  ];
  grid.innerHTML = cards.join('');
}
async function adminLoadTodaySignals(users, pendingCount){
  const data = { pending:pendingCount || 0, activeAnnouncements:0, upcomingEvents:0, activePolls:0, pendingReminders:0, reminderErrors:0 };
  try{
    const refs = await Promise.allSettled([
      db.ref('fts_content/annonces/current').once('value'),
      db.ref('fts_content/annonces/targeted').once('value'),
      db.ref('fts_events').once('value'),
      db.ref('fts_polls').once('value'),
      db.ref('fts_scheduled_reminders').once('value')
    ]);
    const current = refs[0].status === 'fulfilled' ? refs[0].value.val() : null;
    if(adminIsVisibleRecord(current)) data.activeAnnouncements += 1;
    const targeted = refs[1].status === 'fulfilled' ? (refs[1].value.val() || {}) : {};
    Object.values(targeted).forEach(a=>{ if(adminIsVisibleRecord(a)) data.activeAnnouncements += 1; });
    const now = Date.now();
    const in30 = now + 30*24*60*60*1000;
    const events = refs[2].status === 'fulfilled' ? (refs[2].value.val() || {}) : {};
    Object.values(events).forEach(ev=>{
      const ts = adminParseDateTs(ev);
      if(adminIsVisibleRecord(ev) && ts && ts >= now - 6*60*60*1000 && ts <= in30) data.upcomingEvents += 1;
    });
    const polls = refs[3].status === 'fulfilled' ? (refs[3].value.val() || {}) : {};
    Object.values(polls).forEach(p=>{
      if(!p || p.active === false) return;
      const closesAt = Number(p.closesAt || 0);
      if(!closesAt || closesAt >= now) data.activePolls += 1;
    });
    const reminders = refs[4].status === 'fulfilled' ? (refs[4].value.val() || {}) : {};
    Object.values(reminders).forEach(r=>{
      if(!r) return;
      if(r.status === 'pending') data.pendingReminders += 1;
      { const lockAt = Number(r.dispatchLockAt || 0); const staleDispatch = r.status === 'dispatching' && lockAt && Date.now() - lockAt > 2*60*1000; if(r.dispatchError || r.lastDispatchError || r.error || r.status === 'failed' || r.status === 'error' || staleDispatch) data.reminderErrors += 1; }
    });
  }catch(e){ console.warn('[FTS Admin V79] signaux indisponibles', e); }
  adminV79State.today = data;
  adminRenderTodayPanel(data);
}
function adminInitSearch(){
  if(adminV79State.searchReady) return;
  const input = document.getElementById('admin-global-search');
  if(!input) return;
  adminV79State.searchReady = true;
  input.addEventListener('input', () => adminRenderSearchResults(input.value));
}
function adminRenderSearchResults(query){
  const box = document.getElementById('admin-global-search-results');
  if(!box) return;
  const q = adminLower(query).trim();
  if(q.length < 2){ box.innerHTML = '<div class="fts-admin-search-empty">Tape au moins 2 caractères pour rechercher.</div>'; return; }
  const rows = Object.entries(adminV79State.users || {}).map(([uid,u])=>({uid,u,blob:adminPersonSearchBlob(uid,u)})).filter(row=>row.blob.includes(q)).slice(0,12);
  if(!rows.length){ box.innerHTML = '<div class="fts-admin-search-empty">Aucun membre ou enfant trouvé.</div>'; return; }
  box.innerHTML = rows.map(({uid,u})=>{
    const children = Array.isArray(u && u.enfants) ? u.enfants : [];
    const childText = children.length ? children.map(c=>c && (c.firstName || c.prenom || c.name)).filter(Boolean).join(', ') : 'Aucun enfant renseigné';
    const cats = adminUnique(adminNormList(u && (u.disciplines || u.categories || u.groups || u.group))).join(', ') || 'Accès à vérifier';
    return `<article class="fts-admin-search-result">
      <div class="fts-admin-search-avatar">${adminText((adminDisplayName(u)||'?').charAt(0).toUpperCase())}</div>
      <div class="fts-admin-search-info"><strong>${adminText(adminDisplayName(u))}</strong><span>${adminText(u.email || 'Email non renseigné')}</span><small>${adminText(cats)} · ${adminText(childText)}</small></div>
      <div class="fts-admin-search-actions"><button type="button" data-admin-member-read="${adminText(uid)}">Fiche</button><a href="forum-admin.html#tab-members">Gérer</a><a href="rappels-admin.html">Rappel</a><a href="messages.html">Message</a></div>
    </article>`;
  }).join('');
}
function adminInitActionGuide(){
  const open = document.getElementById('admin-open-action-guide');
  const modal = document.getElementById('admin-action-modal');
  if(!open || !modal) return;
  const setOpen = on => {
    modal.classList.toggle('is-open', !!on);
    modal.setAttribute('aria-hidden', on ? 'false' : 'true');
    document.body.classList.toggle('fts-admin-modal-open', !!on);
  };
  open.addEventListener('click', ()=>setOpen(true));
  modal.querySelectorAll('[data-admin-close-action-guide]').forEach(el=>el.addEventListener('click', ()=>setOpen(false)));
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && modal.classList.contains('is-open')) setOpen(false); });
}

// Extension non intrusive : on complète loadAdminOverview existant sans toucher aux fonctions sensibles.
const FTS_ADMIN_ORIGINAL_LOAD_OVERVIEW = loadAdminOverview;
loadAdminOverview = async function(){
  if(!db) return;
  try{
    const [usersSnap, categoryStructure] = await Promise.all([
      db.ref('fts_users').once('value'),
      (window.FTS && typeof FTS.getCategoryStructureAsync === 'function') ? FTS.getCategoryStructureAsync(db) : Promise.resolve([])
    ]);
    const users = usersSnap.val() || {};
    adminV79State.users = users;
    const meta = adminBuildCategoryMeta(categoryStructure || []);
    let pending=0, active=0, staff=0, children=0;
    const categoryStats = {};
    Object.values(users).forEach(u=>{
      if(!u) return;
      if(u.status === 'pending') pending += 1;
      if(u.status === 'active') active += 1;
      if(u.status === 'active' && adminUserIsStaff(u)) staff += 1;
      children += adminCountChildren(u);
      adminCollectPeopleFromUser(u).forEach(person=>adminAddPersonToStats(categoryStats, person, meta));
    });
    const setText=(id,value)=>{ const el=document.getElementById(id); if(el) el.textContent=String(value); };
    setText('stat-pending', pending);
    setText('stat-pending-simple', pending);
    setText('stat-active', active);
    setText('stat-staff', staff);
    setText('stat-children', children);
    adminRenderCategorySummary(categoryStats);
    adminInitSearch();
    adminRenderSearchResults(document.getElementById('admin-global-search')?.value || '');
    adminLoadTodaySignals(users, pending);
  }catch(e){
    console.warn('[FTS Admin Overview V79]', e);
    const grid = document.getElementById('category-summary-grid');
    if(grid) grid.innerHTML = '<div class="insight-empty">Résumé temporairement indisponible.</div>';
    adminRenderTodayPanel({ pending:0, activeAnnouncements:0, upcomingEvents:0, activePolls:0, pendingReminders:0, reminderErrors:0 });
  }
};

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adminInitActionGuide);
else adminInitActionGuide();


/* === FTS V80 — Fiche membre unifiée lecture seule ===
   Objectif : afficher beaucoup d'informations sans aucune écriture Firebase.
   Cette zone ne fait que des once('value') et ne crée/modifie rien. */
const adminV80State = { currentUid:'', currentView:'normal', currentData:null };
function adminV80Html(v){ return adminText(v); }
function adminV80Date(ts){
  const n = Number(ts || 0);
  if(!n) return '—';
  try{ return new Date(n).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' }); }catch(e){ return '—'; }
}
function adminV80List(value){ return adminUnique(adminNormList(value)); }
function adminV80UserCats(u){ return adminV80List(u && (u.disciplines || u.categories || u.groups || u.group)); }
function adminV80UserSubs(u){ return adminV80List(u && (u.subgroups || u.subcategories || u.subgroup || u.subcategory)); }
function adminV80ChildName(c, i){ return (c && (c.firstName || c.prenom || c.name || c.displayName)) || ('Enfant ' + (Number(i || 0)+1)); }
function adminV80ChildCats(c){ return adminV80List(c && (c.disciplines || c.categories || c.groups || c.group)); }
function adminV80ChildSubs(c){ return adminV80List(c && (c.subgroups || c.subcategories || c.subgroup || c.subcategory)); }
function adminV80Badges(list, empty){
  const arr = adminUnique(list || []);
  if(!arr.length) return `<span class="fts-member-pill">${adminV80Html(empty || 'Non renseigné')}</span>`;
  return arr.map(x=>`<span class="fts-member-pill">${adminV80Html(x)}</span>`).join('');
}
function adminV80TargetArrays(obj){
  const cats = [];
  const subs = [];
  function add(v, out){ adminV80List(v).forEach(x=>out.push(x)); }
  if(!obj) return {cats:[], subs:[]};
  add(obj.categories || obj.targetCategories || obj.cats || obj.groups || obj.targetCats, cats);
  add(obj.subcategories || obj.targetSubcategories || obj.subs || obj.subgroups || obj.targetSubs || obj.targetSubgroups, subs);
  if(obj.targets){
    add(obj.targets.categories, cats); add(obj.targets.targetCategories, cats);
    add(obj.targets.subcategories, subs); add(obj.targets.targetSubcategories, subs);
    if(obj.targets.categories && typeof obj.targets.categories === 'object' && !Array.isArray(obj.targets.categories)) Object.keys(obj.targets.categories).forEach(k=>cats.push(k));
    if(obj.targets.subcategories && typeof obj.targets.subcategories === 'object' && !Array.isArray(obj.targets.subcategories)) Object.keys(obj.targets.subcategories).forEach(k=>subs.push(k));
  }
  if(obj.targetGroups && typeof obj.targetGroups === 'object'){
    Object.entries(obj.targetGroups).forEach(([cat, value])=>{ if(cat) cats.push(cat); add(value, subs); });
  }
  return { cats:adminUnique(cats), subs:adminUnique(subs) };
}
function adminV80AllAccess(u){
  const cats = [...adminV80UserCats(u)];
  const subs = [...adminV80UserSubs(u)];
  const children = Array.isArray(u && u.enfants) ? u.enfants : [];
  children.forEach(c=>{ cats.push(...adminV80ChildCats(c)); subs.push(...adminV80ChildSubs(c)); });
  return { cats:adminUnique(cats).map(adminNormKey), subs:adminUnique(subs).map(adminNormKey), rawCats:adminUnique(cats), rawSubs:adminUnique(subs) };
}
function adminV80MatchesAccess(item, u){
  const t = adminV80TargetArrays(item || {});
  const access = adminV80AllAccess(u || {});
  if(!t.cats.length && !t.subs.length) return true;
  const catOk = t.cats.some(c=>access.cats.includes(adminNormKey(c)));
  const subOk = t.subs.some(st=>access.subs.includes(adminNormKey(st)));
  return catOk || subOk;
}
function adminV80ResourceForUser(r, u){
  if(!r) return false;
  if(r.active === false || r.status === 'inactive' || r.visible === false) return false;
  const cat = r.cat || r.category || r.categorie || r.discipline || '';
  const sub = r.subcat || r.subcategory || r.sousCategorie || r.sous_categorie || '';
  if(!cat && !sub) return true;
  const access = adminV80AllAccess(u || {});
  return (cat && access.cats.includes(adminNormKey(cat))) || (sub && access.subs.includes(adminNormKey(sub)));
}
function adminV80EventForUser(ev, u){ return adminIsVisibleRecord(ev || {}) && adminV80MatchesAccess(ev, u); }
function adminV80ScheduleForUser(s, uid, u){
  if(!s || s.active === false) return false;
  if(String(s.uid || s.userUid || s.memberUid || '') === String(uid)) return true;
  return adminV80MatchesAccess({ categories:s.targetCategory || s.category, subcategories:s.targetSubcategory || s.subcategory, targetGroups:s.targetGroups }, u);
}
function adminV80ReminderForUser(r, uid){
  if(!r) return false;
  return String(r.uid || r.userUid || r.memberUid || r.targetUid || '') === String(uid);
}
function adminV80Row(title, meta, right){
  return `<div class="fts-member-row"><div><strong>${adminV80Html(title || 'Sans titre')}</strong>${meta ? `<span>${adminV80Html(meta)}</span>` : ''}</div>${right ? `<small>${adminV80Html(right)}</small>` : ''}</div>`;
}
function adminV80Empty(text){ return `<div class="fts-member-empty">${adminV80Html(text || 'Aucune donnée trouvée.')}</div>`; }
async function adminV80Read(uid){
  const refs = [
    ['user', 'fts_users/' + uid],
    ['forumUser', 'fts_forum/users/' + uid],
    ['schedules', 'fts_schedules'],
    ['reminders', 'fts_scheduled_reminders'],
    ['resources', 'fts_ressources'],
    ['events', 'fts_events'],
    ['polls', 'fts_polls'],
    ['pollResponses', 'fts_poll_responses'],
    ['pollUnread', 'fts_poll_unread/' + uid],
    ['notifications', 'fts_user_notifications/' + uid],
    ['dmUserConvs', 'fts_dm/userConvs/' + uid],
    ['rewardHistory', 'fts_forum/rewardHistory'],
    ['artistOfWeek', 'fts_community/artistOfWeek']
  ];
  const settled = await Promise.allSettled(refs.map(([,path])=>db.ref(path).once('value')));
  const data = { uid, errors:[] };
  settled.forEach((res, i)=>{
    const key = refs[i][0];
    const path = refs[i][1];
    if(res.status === 'fulfilled') data[key] = res.value.val() || null;
    else { data[key] = null; data.errors.push(path + ' : ' + (res.reason && res.reason.message ? res.reason.message : 'lecture impossible')); }
  });
  return data;
}
function adminV80BuildDerived(data){
  const uid = data.uid;
  const u = data.user || {};
  const schedules = Object.entries(data.schedules || {}).map(([id,x])=>({id,...(x||{})})).filter(x=>adminV80ScheduleForUser(x, uid, u));
  const reminders = Object.entries(data.reminders || {}).map(([id,x])=>({id,...(x||{})})).filter(x=>adminV80ReminderForUser(x, uid));
  const resources = Object.entries(data.resources || {}).map(([id,x])=>({id,...(x||{})})).filter(x=>adminV80ResourceForUser(x, u));
  const events = Object.entries(data.events || {}).map(([id,x])=>({id,...(x||{})})).filter(x=>adminV80EventForUser(x, u));
  const polls = Object.entries(data.polls || {}).map(([id,x])=>({id,...(x||{})}));
  const pollResponses = data.pollResponses || {};
  const pollsReceived = polls.filter(p => (p.recipients && p.recipients[uid]) || adminV80MatchesAccess(p, u));
  const pollsAnswered = polls.filter(p => pollResponses[p.id] && pollResponses[p.id][uid]);
  const pollsCreated = polls.filter(p => String(p.createdByUid || '') === String(uid));
  const notifications = Object.entries(data.notifications || {}).map(([id,x])=>({id,...(x||{})}));
  const unreadNotifs = notifications.filter(n=>n && n.read !== true);
  const dmConvs = Object.keys(data.dmUserConvs || {});
  const rewards = Object.entries(data.rewardHistory || {}).map(([id,x])=>({id,...(x||{})})).filter(r=>String(r.targetUid||'')===String(uid) || String(r.assignedBy||'')===String(uid));
  const forumStats = data.forumUser && data.forumUser.stats ? data.forumUser.stats : {};
  return { schedules, reminders, resources, events, pollsReceived, pollsAnswered, pollsCreated, notifications, unreadNotifs, dmConvs, rewards, forumStats };
}
function adminV80RenderNormal(data){
  const uid = data.uid;
  const u = data.user || {};
  const d = adminV80BuildDerived(data);
  const name = adminDisplayName(u);
  const children = Array.isArray(u.enfants) ? u.enfants : [];
  const nextReminders = d.reminders.slice().sort((a,b)=>Number(a.sendAt||a.remindAt||a.ts||0)-Number(b.sendAt||b.remindAt||b.ts||0)).slice(0,6);
  const nextEvents = d.events.slice().sort((a,b)=>adminParseDateTs(a)-adminParseDateTs(b)).slice(0,5);
  return `<div class="fts-member-read-head">
    <div class="fts-member-read-avatar">${adminV80Html((name || '?').charAt(0).toUpperCase())}</div>
    <div><div class="fts-member-read-name">${adminV80Html(name)}</div>
      <div class="fts-member-read-meta"><span class="fts-member-pill ${u.status==='active'?'ok':'warn'}">${adminV80Html(u.status || 'statut ?')}</span><span class="fts-member-pill">${adminV80Html(u.role || 'member')}</span><span class="fts-member-pill">${adminV80Html(u.email || 'Email non renseigné')}</span>${u.phone || u.tel ? `<span class="fts-member-pill">${adminV80Html(u.phone || u.tel)}</span>` : ''}</div>
      <div class="fts-member-read-actions"><a href="forum-admin.html#tab-members">Gérer les accès</a><a href="rappels-admin.html">Créer / voir rappels</a><a href="messages.html">Messagerie</a></div>
    </div>
  </div>
  <div class="fts-member-read-grid">
    <section class="fts-member-read-card"><h3>Accès du compte</h3><div class="fts-member-read-meta">${adminV80Badges(adminV80UserCats(u),'Aucune discipline')}</div><div class="fts-member-read-meta">${adminV80Badges(adminV80UserSubs(u),'Aucun groupe')}</div></section>
    <section class="fts-member-read-card"><h3>Résumé rapide</h3>
      ${adminV80Row('Enfants renseignés', children.length ? children.map((c,i)=>adminV80ChildName(c,i)).join(', ') : 'Aucun', String(children.length))}
      ${adminV80Row('Ressources visibles estimées', 'Selon catégories / sous-catégories du profil', String(d.resources.length))}
      ${adminV80Row('Sondages reçus / répondus', `${d.pollsReceived.length} reçus · ${d.pollsAnswered.length} répondus`, `${Math.max(0,d.pollsReceived.length-d.pollsAnswered.length)} à vérifier`)}
    </section>
    <section class="fts-member-read-card full"><h3>Enfants / élèves rattachés</h3>${children.length ? `<div class="fts-member-list">${children.map((c,i)=>adminV80Row(adminV80ChildName(c,i), `Cours : ${adminUnique([...adminV80ChildCats(c), ...adminV80ChildSubs(c)]).join(', ') || 'non renseigné'}${c.birthdate ? ' · Naissance : '+c.birthdate : ''}`, c.phone || c.tel || '')).join('')}</div>` : adminV80Empty('Aucun enfant renseigné sur ce profil.')}</section>
    <section class="fts-member-read-card"><h3>Rappels lisibles</h3>${nextReminders.length ? `<div class="fts-member-list">${nextReminders.map(r=>adminV80Row(r.title || r.courseLabel || r.label || 'Rappel', `${r.status || 'status ?'} · ${r.message || r.note || ''}`, adminV80Date(r.sendAt || r.remindAt || r.ts))).join('')}</div>` : adminV80Empty('Aucun rappel directement rattaché à ce membre.')}</section>
    <section class="fts-member-read-card"><h3>Événements visibles estimés</h3>${nextEvents.length ? `<div class="fts-member-list">${nextEvents.map(ev=>adminV80Row(ev.title || ev.name || 'Événement', `${ev.type || 'date'} · ${ev.location || ''}`, adminV80Date(adminParseDateTs(ev)))).join('')}</div>` : adminV80Empty('Aucun événement visible détecté.')}</section>
    <section class="fts-member-read-card"><h3>Dernières ressources visibles</h3>${d.resources.length ? `<div class="fts-member-list">${d.resources.slice(0,6).map(r=>adminV80Row(r.name || r.title || 'Ressource', `${r.cat || r.category || 'Sans catégorie'}${r.subcat || r.subcategory ? ' · '+(r.subcat || r.subcategory) : ''}`, r.type || 'doc')).join('')}</div>` : adminV80Empty('Aucune ressource visible estimée.')}</section>
    <section class="fts-member-read-card"><h3>Communauté</h3>
      ${adminV80Row('Conversations privées', 'D’après fts_dm/userConvs', String(d.dmConvs.length))}
      ${adminV80Row('Notifications non lues', 'D’après fts_user_notifications', String(d.unreadNotifs.length))}
      ${adminV80Row('XP / stats forum', Object.entries(d.forumStats || {}).map(([k,v])=>`${k}:${v}`).join(' · ') || 'Aucune stat', '')}
    </section>
  </div>`;
}
function adminV80RenderAdmin(data){
  const uid = data.uid;
  const u = data.user || {};
  const d = adminV80BuildDerived(data);
  const rawProfile = JSON.stringify({ uid, fts_users:data.user || null, fts_forum_user:data.forumUser || null }, null, 2);
  return `<div class="fts-member-read-grid">
    <section class="fts-member-read-card full"><h3>Lecture admin — identité complète</h3>
      ${adminV80Row('UID Firebase', uid, '')}
      ${adminV80Row('Création / mise à jour profil', `createdAt : ${adminV80Date(u.createdAt)} · updatedAt : ${adminV80Date(u.updatedAt)}`, '')}
      ${adminV80Row('Préférences rappels', JSON.stringify(u.reminderPrefs || u.remindersPrefs || {}, null, 0) || '—', '')}
    </section>
    <section class="fts-member-read-card"><h3>Ce que le membre peut voir</h3>
      ${adminV80Row('Ressources visibles estimées', 'fts_ressources selon accès', String(d.resources.length))}
      ${adminV80Row('Événements visibles estimés', 'fts_events selon accès', String(d.events.length))}
      ${adminV80Row('Sondages reçus estimés', 'fts_polls recipients/ciblage', String(d.pollsReceived.length))}
    </section>
    <section class="fts-member-read-card"><h3>Ce que le membre a fait</h3>
      ${adminV80Row('Sondages répondus', 'Réponses enregistrées', String(d.pollsAnswered.length))}
      ${adminV80Row('Sondages créés', 'Si prof/admin', String(d.pollsCreated.length))}
      ${adminV80Row('Récompenses données/reçues', 'Historique lisible', String(d.rewards.length))}
      ${adminV80Row('Conversations privées', 'Présence dans userConvs', String(d.dmConvs.length))}
    </section>
    <section class="fts-member-read-card"><h3>Planning / rappels</h3>
      ${adminV80Row('Plannings concernés', 'fts_schedules lus et filtrés', String(d.schedules.length))}
      ${adminV80Row('Rappels concernés', 'fts_scheduled_reminders lus et filtrés', String(d.reminders.length))}
      ${d.reminders.slice(0,5).map(r=>adminV80Row(r.title || r.courseLabel || r.label || r.id, `${r.status || 'status ?'} · ${r.message || ''}`, adminV80Date(r.sendAt || r.remindAt || r.ts))).join('') || adminV80Empty('Aucun rappel.')}
    </section>
    <section class="fts-member-read-card"><h3>Notifications</h3>
      ${adminV80Row('Total notifications', 'fts_user_notifications/' + uid, String(d.notifications.length))}
      ${adminV80Row('Non lues', 'read !== true', String(d.unreadNotifs.length))}
      ${d.notifications.slice(0,5).map(n=>adminV80Row(n.title || n.type || n.id, n.body || n.url || '', adminV80Date(n.createdAt || n.ts))).join('') || adminV80Empty('Aucune notification lisible.')}
    </section>
    <section class="fts-member-read-card"><h3>Récompenses / forum</h3>
      ${data.forumUser && data.forumUser.specialBadge ? adminV80Row(data.forumUser.specialBadge.label || 'Badge spécial', data.forumUser.specialBadge.reason || '', adminV80Date(data.forumUser.specialBadge.until)) : adminV80Empty('Aucun badge temporaire actif détecté.')}
      ${data.artistOfWeek && data.artistOfWeek.uid === uid ? adminV80Row('Artiste de la semaine', data.artistOfWeek.name || '', adminV80Date(data.artistOfWeek.until)) : ''}
      ${d.rewards.slice(0,5).map(r=>adminV80Row(r.label || r.type || 'Récompense', r.reason || r.name || '', adminV80Date(r.ts))).join('')}
    </section>
    <section class="fts-member-read-card full"><h3>Données brutes utiles au diagnostic</h3><p>Lecture seule. Pratique pour comprendre un profil sans ouvrir Firebase.</p><pre class="fts-member-admin-json">${adminV80Html(rawProfile)}</pre></section>
    ${data.errors && data.errors.length ? `<section class="fts-member-read-card full"><h3>Lectures indisponibles</h3>${data.errors.map(e=>adminV80Empty(e)).join('')}</section>` : ''}
  </div>`;
}
function adminV80Render(){
  const content = document.getElementById('admin-member-content');
  if(!content || !adminV80State.currentData) return;
  content.innerHTML = adminV80State.currentView === 'admin' ? adminV80RenderAdmin(adminV80State.currentData) : adminV80RenderNormal(adminV80State.currentData);
}
async function adminV80OpenMember(uid){
  if(!uid || !db) return;
  const modal = document.getElementById('admin-member-modal');
  const content = document.getElementById('admin-member-content');
  if(!modal || !content) return;
  adminV80State.currentUid = uid;
  adminV80State.currentView = 'normal';
  adminV80State.currentData = null;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('fts-admin-modal-open');
  document.querySelectorAll('[data-member-view]').forEach(b=>b.classList.toggle('active', b.dataset.memberView === 'normal'));
  content.innerHTML = '<div class="fts-admin-search-empty">Chargement de la fiche membre en lecture seule…</div>';
  try{
    const data = await adminV80Read(uid);
    adminV80State.currentData = data;
    const title = document.getElementById('admin-member-title');
    if(title) title.textContent = 'Fiche membre — ' + adminDisplayName(data.user || {});
    adminV80Render();
  }catch(e){
    console.warn('[FTS Admin V80] fiche membre', e);
    content.innerHTML = '<div class="fts-member-empty">Impossible de charger cette fiche en lecture seule.</div>';
  }
}
function adminV80CloseMember(){
  const modal = document.getElementById('admin-member-modal');
  if(!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden','true');
  document.body.classList.remove('fts-admin-modal-open');
}
function adminV80InitMemberSheet(){
  document.addEventListener('click', e=>{
    const btn = e.target.closest && e.target.closest('[data-admin-member-read]');
    if(btn){ e.preventDefault(); adminV80OpenMember(btn.getAttribute('data-admin-member-read')); return; }
    if(e.target.closest && e.target.closest('[data-admin-close-member]')){ e.preventDefault(); adminV80CloseMember(); }
  });
  document.querySelectorAll('[data-member-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      adminV80State.currentView = btn.dataset.memberView || 'normal';
      document.querySelectorAll('[data-member-view]').forEach(b=>b.classList.toggle('active', b === btn));
      adminV80Render();
    });
  });
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape'){ const m=document.getElementById('admin-member-modal'); if(m && m.classList.contains('is-open')) adminV80CloseMember(); } });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adminV80InitMemberSheet);
else adminV80InitMemberSheet();
