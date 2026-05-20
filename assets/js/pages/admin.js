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
      loadAdminOverview();
    }catch(e){ console.warn('[FTS Admin Hub]',e); showError(e && e.message ? e.message : String(e)); }
  });
});

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
    adminRenderTodayCard('⚠️','rappels à vérifier', data.reminderErrors || 0, 'Avec erreur de dispatch ou blocage.', 'rappels-admin.html', (data.reminderErrors||0)>0?'danger':'')
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
      if(r.dispatchError || r.status === 'failed' || r.status === 'error') data.reminderErrors += 1;
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
      <div class="fts-admin-search-actions"><a href="forum-admin.html#tab-members">Gérer</a><a href="rappels-admin.html">Rappel</a><a href="messages.html">Message</a></div>
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
