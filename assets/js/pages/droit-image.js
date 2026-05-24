(function(){
  'use strict';
  let db, auth, currentUser, allRows = [], imageHistories = {};
  const esc = (v)=> window.FTS && FTS.esc ? FTS.esc(v == null ? '' : v) : String(v == null ? '' : v).replace(/[&<>"]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));
  const date = (ts)=>{ const n=Number(ts||0); if(!n) return 'non daté'; try{return new Date(n).toLocaleString('fr-FR')}catch(e){return 'non daté'} };
  const arr = (v)=> Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  function showError(msg){ const e=document.getElementById('image-rights-error'); if(e){ e.hidden=false; e.innerHTML=esc(msg)+'<br><br><a href="auth.html">Retour connexion</a>'; } }
  function statusOf(profile){ if(!profile || typeof profile.imageRightsConsent === 'undefined') return 'unknown'; return profile.imageRightsConsent === true || profile.imageRightsStatus === 'accepted' ? 'accepted' : 'refused'; }
  function statusLabel(s){ return s === 'accepted' ? 'Autorisé' : s === 'refused' ? 'Refus' : 'Non renseigné'; }
  function personName(u){ return (u.name || [u.firstName,u.lastName].filter(Boolean).join(' ') || u.email || 'Compte sans nom'); }
  function groupsOf(u){ return [...new Set([].concat(arr(u.disciplines), arr(u.subgroups), arr(u.groups), String(u.subgroup||'').split(',').map(s=>s.trim()).filter(Boolean)))]; }
  async function load(){
    const list=document.getElementById('image-rights-list'); if(list) list.innerHTML='<div class="image-rights-empty">Chargement…</div>';
    const snap = await db.ref('fts_users').once('value');
    try {
      const histSnap = await db.ref('fts_image_rights_history').once('value');
      imageHistories = histSnap.val() || {};
    } catch(e) {
      console.warn('[FTS] Historique droit image indisponible, lecture profil uniquement :', e);
      imageHistories = {};
    }
    const rows=[];
    snap.forEach(ch=>{
      const u=ch.val()||{};
      const st=statusOf(u);
      rows.push({ uid:ch.key, profile:u, status:st, name:personName(u), groups:groupsOf(u), children:arr(u.enfants) });
    });
    allRows=rows.sort((a,b)=> (a.status === 'refused' ? -1 : b.status === 'refused' ? 1 : a.name.localeCompare(b.name,'fr')));
    renderStats(); render();
  }
  function renderStats(){
    const counts={refused:0,accepted:0,unknown:0}; allRows.forEach(r=>counts[r.status]=(counts[r.status]||0)+1);
    const el=document.getElementById('image-rights-stats'); if(!el) return;
    el.innerHTML=`<article><strong>${counts.refused||0}</strong><span>refus</span></article><article><strong>${counts.accepted||0}</strong><span>autorisations</span></article><article><strong>${counts.unknown||0}</strong><span>non renseignés</span></article>`;
  }
  function latestImageHistory(uid){
    const h=imageHistories && imageHistories[uid];
    if(!h || typeof h !== 'object') return null;
    return Object.values(h).filter(Boolean).sort((a,b)=>Number(b.at||0)-Number(a.at||0))[0] || null;
  }
  function render(){
    const q=String(document.getElementById('image-rights-search')?.value||'').toLowerCase().trim();
    const f=document.getElementById('image-rights-filter')?.value||'refused';
    const list=document.getElementById('image-rights-list'); if(!list) return;
    const filtered=allRows.filter(r=>{
      if(f!=='all' && r.status!==f) return false;
      if(!q) return true;
      const hay=[r.name,r.profile.email,r.groups.join(' '),r.children.map(c=>[c.prenom,c.nom,(c.disciplines||[]).join(' '),(c.subgroups||[]).join(' ')].join(' ')).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    });
    if(!filtered.length){ list.innerHTML='<div class="image-rights-empty">Aucun résultat pour ce filtre.</div>'; return; }
    list.innerHTML=filtered.map(r=>card(r)).join('');
  }
  function card(r){
    const u=r.profile||{};
    const h = latestImageHistory(r.uid);
    const children = r.children.length ? `<div class="image-rights-children"><b>Enfant(s) :</b> ${r.children.map(c=>esc([c.prenom,c.nom].filter(Boolean).join(' ')||'Sans nom')).join(', ')}</div>` : '';
    const groups = r.groups.length ? r.groups.join(', ') : '—';
    const lastSource = h && h.source ? h.source : (u.imageRightsSource || 'profil');
    const lastDate = h && h.at ? h.at : (u.imageRightsUpdatedAt || u.imageRightsAt);
    return `<article class="image-rights-card ${esc(r.status)}"><div class="image-rights-card-head"><h2>${esc(r.name)}</h2><span class="image-rights-badge ${esc(r.status)}">${esc(statusLabel(r.status))}</span></div><div class="image-rights-meta"><div><b>Mis à jour :</b> ${esc(date(lastDate))}</div><div><b>Source :</b> ${esc(lastSource)}</div><div><b>Groupes :</b> ${esc(groups)}</div><div><b>Statut compte :</b> ${esc(u.status || '—')} · <b>Rôle :</b> ${esc(u.role || '—')}</div></div>${children}</article>`;
  }
  function exportCsv(){
    const lines=[['Nom','Statut droit image','Date','Groupes','Enfants'].join(';')];
    allRows.forEach(r=>{ const u=r.profile||{}; lines.push([r.name,statusLabel(r.status),date(u.imageRightsUpdatedAt||u.imageRightsAt),r.groups.join(', '),r.children.map(c=>[c.prenom,c.nom].filter(Boolean).join(' ')).join(', ')].map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(';')); });
    const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='droit-image-fais-ton-show.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},250);
  }
  window.addEventListener('DOMContentLoaded',()=>{
    db=FTS.initFirebase(); auth=firebase.auth();
    document.getElementById('image-rights-refresh')?.addEventListener('click',load);
    document.getElementById('image-rights-export')?.addEventListener('click',exportCsv);
    document.getElementById('image-rights-search')?.addEventListener('input',render);
    document.getElementById('image-rights-filter')?.addEventListener('change',render);
    document.getElementById('image-rights-logout')?.addEventListener('click',()=>auth.signOut().then(()=>location.href='auth.html'));
    auth.onAuthStateChanged(async user=>{
      if(!user){ location.href='auth.html'; return; }
      currentUser=user;
      try{
        const profile=(await db.ref('fts_users/'+user.uid).once('value')).val()||{};
        const role=String(profile.role||'').toLowerCase();
        if(role!=='admin' && role!=='prof') { showError('Accès réservé aux administrateurs et professeurs.'); return; }
        document.getElementById('image-rights-shell').hidden=false;
        await load();
      }catch(e){ console.error(e); showError(e && e.message ? e.message : String(e)); }
    });
  });
})();
