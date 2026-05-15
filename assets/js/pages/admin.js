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

/* === FTS Etape 4 — Admin cockpit résumé V2 === */
function adminNormList(value){
  if(Array.isArray(value)) return value.map(v=>String(v||'').trim()).filter(Boolean);
  if(value && typeof value === 'object') return Object.values(value).map(v=>String(v||'').trim()).filter(Boolean);
  return String(value||'').split(',').map(v=>v.trim()).filter(Boolean);
}
function adminUnique(list){
  return [...new Set((list||[]).map(v=>String(v||'').trim()).filter(Boolean))];
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
function adminEnsureCategory(stats, name){
  if(!name) return null;
  if(!stats[name]) stats[name] = {name, total:0, subs:{}};
  return stats[name];
}
function adminAddPersonToStats(stats, person){
  const cats = adminUnique(person.cats || []);
  const subs = adminUnique(person.subs || []);
  cats.forEach(cat=>{
    const entry = adminEnsureCategory(stats, cat);
    if(!entry) return;
    entry.total += 1;
    subs.forEach(sub=>{
      entry.subs[sub] = (entry.subs[sub] || 0) + 1;
    });
  });
}
function adminRenderCategorySummary(stats){
  const grid = document.getElementById('category-summary-grid');
  if(!grid) return;
  const rows = Object.values(stats || {}).sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name));
  if(!rows.length){
    grid.innerHTML = '<div class="insight-empty">Aucune catégorie trouvée dans les profils validés pour le moment.</div>';
    return;
  }
  grid.innerHTML = rows.map(cat=>{
    const subs = Object.entries(cat.subs || {}).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));
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
    const snap = await db.ref('fts_users').once('value');
    const users = snap.val() || {};
    let pending=0, active=0, staff=0, children=0;
    const categoryStats = {};
    Object.values(users).forEach(u=>{
      if(!u) return;
      if(u.status === 'pending') pending += 1;
      if(u.status === 'active') active += 1;
      if(u.status === 'active' && adminUserIsStaff(u)) staff += 1;
      if(Array.isArray(u.enfants)) children += u.enfants.length;
      adminCollectPeopleFromUser(u).forEach(person=>adminAddPersonToStats(categoryStats, person));
    });
    const setText=(id,value)=>{ const el=document.getElementById(id); if(el) el.textContent=String(value); };
    setText('stat-pending', pending);
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
