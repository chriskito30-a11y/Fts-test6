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
    }catch(e){ console.warn('[FTS Admin Hub]',e); showError(e && e.message ? e.message : String(e)); }
  });
});
