
(function(window){
  'use strict';
  const FTS=window.FTS=window.FTS||{};
  const esc=v=>FTS.esc?FTS.esc(v==null?'':v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const euro=c=>(Number(c||0)/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
  function worker(){return String((FTS.PAYMENT&&FTS.PAYMENT.workerUrl)||'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/,'');}
  async function token(){const u=firebase.auth().currentUser;if(!u)throw new Error('not_connected');return u.getIdToken(true);}
  async function api(path,opts){const t=await token();const res=await fetch(worker()+path,Object.assign({headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:'Bearer '+t}},opts||{}));const data=await res.json().catch(()=>null);if(!res.ok||!data||data.ok===false)throw new Error((data&&data.error)||('HTTP '+res.status));return data;}
  function msFromDate(v,end){if(!v)return 0;const d=new Date(v+(end?'T23:59:59':'T00:00:00'));return Number.isFinite(d.getTime())?d.getTime():0;}
  function dateFromMs(ms){if(!ms)return '';const d=new Date(Number(ms));return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';}
  function list(v){return String(v||'').split(/[;,\n]/).map(x=>x.trim()).filter(Boolean);}
  function csv(a){return Array.isArray(a)?a.join(', '):'';}
  function titleForScope(scope){return scope==='season_registration'?'Codes Saison / inscriptions':scope==='shop_order'?'Codes boutique':'Codes événements / stages';}
  function buildSection(section){
    const scope=section.getAttribute('data-promo-scope')||'all';
    const target=section.getAttribute('data-promo-target')||'';
    section.innerHTML=`<div class="promo-head"><div><div class="mini-title">Codes promo & spéciaux</div><h2>${esc(titleForScope(scope))}</h2><p>Réductions, gratuité automatique via code, ou paiement hors ligne chèque / espèces. Le Worker vérifie toujours le code au paiement.</p></div><button type="button" class="btn-outline promo-refresh">Actualiser</button></div>
      <div class="promo-grid">
        <label>Code<input class="promo-code" placeholder="RENTREE10"></label>
        <label>Nom interne<input class="promo-label" placeholder="Offre rentrée"></label>
        <label>Type<select class="promo-kind"><option value="percent">Pourcentage</option><option value="fixed">Montant fixe €</option><option value="free">Gratuité</option><option value="offline_payment">Paiement hors ligne</option></select></label>
        <label>Valeur<input class="promo-value" type="number" step="0.01" placeholder="10 ou 20"></label>
        <label>Date début<input class="promo-start" type="date"></label>
        <label>Date fin<input class="promo-end" type="date"></label>
        <label>Utilisations max<input class="promo-max" type="number" min="0" step="1" placeholder="0 = illimité"></label>
        <label>Mode hors ligne<input class="promo-offline" placeholder="Chèque ou espèces"></label>
        <label class="promo-check"><input class="promo-active" type="checkbox" checked> Actif</label>
        <label class="promo-check"><input class="promo-public" type="checkbox"> Visible publiquement</label>
      </div>
      <div class="promo-targets">
        ${scope==='season_registration'?'<label>Activités autorisées <small>IDs séparés par virgule, vide = toutes</small><input class="promo-activities" placeholder="theatre, danse"></label><label>Formules autorisées<input class="promo-offers" placeholder="loisir, perf"></label><label>Groupes autorisés<input class="promo-subcats" placeholder="baby_show, adultes"></label>':''}
        ${scope==='shop_order'?'<label>Produits autorisés <small>IDs séparés par virgule, vide = toute boutique</small><input class="promo-products" placeholder="tshirt, mug"></label>':''}
        ${scope==='event_ticket'||scope==='stage_registration'?'<label>Événements autorisés <small>IDs séparés par virgule, vide = tous</small><input class="promo-events" placeholder="eventId"></label>':''}
      </div>
      <div class="promo-actions"><button type="button" class="btn-gold promo-save">Enregistrer le code</button><button type="button" class="btn-outline promo-reset">Nouveau</button></div>
      <div class="promo-msg"></div><div class="promo-list"><div class="empty">Chargement…</div></div>`;
    const st={scope,target,codes:[]}; section.__promoState=st;
    const q=s=>section.querySelector(s);
    function fill(p){q('.promo-code').value=p&&p.code||''; q('.promo-label').value=p&&p.label||''; q('.promo-kind').value=p&&p.kind||'percent'; q('.promo-value').value=p&&(p.kind==='fixed'?Number(p.value||0)/100:p.value)||''; q('.promo-start').value=dateFromMs(p&&p.startsAt); q('.promo-end').value=dateFromMs(p&&p.endsAt); q('.promo-max').value=p&&p.maxUses||''; q('.promo-offline').value=p&&p.offlineMethod||''; q('.promo-active').checked=!p||p.active!==false; q('.promo-public').checked=!!(p&&p.publicVisible); if(q('.promo-products'))q('.promo-products').value=csv(p&&p.productIds); if(q('.promo-events'))q('.promo-events').value=csv(p&&p.eventIds); if(q('.promo-activities'))q('.promo-activities').value=csv(p&&p.activityIds); if(q('.promo-offers'))q('.promo-offers').value=csv(p&&p.offerKeys); if(q('.promo-subcats'))q('.promo-subcats').value=csv(p&&p.subcategoryIds);}
    async function load(){try{const data=await api('/admin/promo-codes?scope='+encodeURIComponent(scope));st.codes=data.codes||[];renderList();}catch(e){q('.promo-list').innerHTML='<div class="empty">Impossible de charger les codes : '+esc(e.message)+'</div>';}}
    function kindLabel(p){const k=p.kind||p.type;if(k==='fixed')return '-'+euro(p.value); if(k==='percent')return '-'+Number(p.value||0)+'%'; if(k==='free')return 'Gratuité'; if(k==='offline_payment')return 'Paiement hors ligne'; return k||'';}
    function renderList(){q('.promo-list').innerHTML=st.codes.length?st.codes.map(p=>`<div class="promo-row"><div><strong>${esc(p.code)}</strong><span>${esc(p.label||'')} · ${esc(kindLabel(p))}</span><small>${p.active===false?'Inactif':'Actif'} · utilisé ${Number(p.usedCount||0)}${p.maxUses?'/'+Number(p.maxUses):''}${p.endsAt?' · fin '+esc(dateFromMs(p.endsAt)):''}</small></div><div><button type="button" class="btn-outline promo-edit" data-code="${esc(p.code)}">Modifier</button><button type="button" class="btn-outline danger promo-del" data-code="${esc(p.code)}">Supprimer</button></div></div>`).join(''):'<div class="empty">Aucun code pour ce contexte.</div>';}
    async function save(){const code=q('.promo-code').value.trim();if(!code){q('.promo-msg').textContent='Code obligatoire.';return;}const kind=q('.promo-kind').value;const valueRaw=Number(String(q('.promo-value').value||'0').replace(',','.'))||0;const body={code,label:q('.promo-label').value,kind,scope,active:q('.promo-active').checked,publicVisible:q('.promo-public').checked,value:kind==='fixed'?Math.round(valueRaw*100):valueRaw,startsAt:msFromDate(q('.promo-start').value,false),endsAt:msFromDate(q('.promo-end').value,true),maxUses:Number(q('.promo-max').value||0)||0,offlineMethod:q('.promo-offline').value,productIds:q('.promo-products')?list(q('.promo-products').value):[],eventIds:q('.promo-events')?list(q('.promo-events').value):[],activityIds:q('.promo-activities')?list(q('.promo-activities').value):[],offerKeys:q('.promo-offers')?list(q('.promo-offers').value):[],subcategoryIds:q('.promo-subcats')?list(q('.promo-subcats').value):[]};try{q('.promo-msg').textContent='Enregistrement…';await api('/admin/promo-codes/save',{method:'POST',body:JSON.stringify(body)});q('.promo-msg').textContent='Code enregistré.';fill(null);await load();}catch(e){q('.promo-msg').textContent='Erreur : '+e.message;}}
    section.addEventListener('click',async e=>{if(e.target.closest('.promo-refresh'))load(); if(e.target.closest('.promo-reset')){fill(null);q('.promo-msg').textContent='';} if(e.target.closest('.promo-save'))save(); const edit=e.target.closest('.promo-edit'); if(edit){const p=st.codes.find(x=>x.code===edit.getAttribute('data-code'));fill(p);} const del=e.target.closest('.promo-del'); if(del){const code=del.getAttribute('data-code');if(confirm('Supprimer le code '+code+' ?')){await api('/admin/promo-codes/delete',{method:'POST',body:JSON.stringify({code})});await load();}}});
    load();
  }
  function init(){document.querySelectorAll('[data-promo-admin]').forEach(buildSection);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
