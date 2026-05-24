/* ================================================================
   PAGE MODULE — RGPD ADMIN V174
   Registre interne, incidents, historique des demandes.
   ================================================================ */
'use strict';

let rgpdDb = null;
let rgpdAuth = null;
let rgpdCurrentUser = null;
let rgpdRegistry = null;

const RGPD_DEFAULTS = {
  meta: {
    controller: 'Association Fais Ton Show',
    contact: 'contact@faistonshow.fr',
    policyVersion: '2026-05',
    lastReview: new Date().toISOString().slice(0,10)
  },
  treatments: [
    {
      title: 'Gestion des adhérents et comptes application',
      purpose: 'Créer les comptes, gérer les accès membres/profs/admins, valider les inscriptions et organiser les groupes.',
      data: 'Nom, prénom, email, rôle, statut, catégories, sous-catégories, enfants rattachés, date de création, consentement RGPD.',
      people: 'Adhérents, parents, élèves mineurs, professeurs, administrateurs.',
      legalBasis: 'Exécution de l’adhésion / intérêt légitime de gestion associative / consentement pour certains usages.',
      access: 'Administrateurs. Professeurs uniquement selon leurs besoins pédagogiques. Membre sur son propre espace.',
      retention: 'Pendant l’adhésion. Suppression automatisée sur demande depuis l’espace membre ou par admin.'
    },
    {
      title: 'Communication interne, messages, forum et notifications',
      purpose: 'Informer les membres, échanger avec les groupes, envoyer des rappels, annonces et notifications importantes.',
      data: 'Messages, identifiants d’expéditeur, réponses, réactions, notifications, statut non lu, abonnements push.',
      people: 'Membres, parents, élèves, professeurs, administrateurs.',
      legalBasis: 'Intérêt légitime d’organisation associative et consentement technique pour les notifications push.',
      access: 'Participants aux conversations, groupes concernés, professeurs/admins selon rôle.',
      retention: 'Durée utile à l’organisation. Suppression des traces UID lors de la suppression complète du compte.'
    },
    {
      title: 'Ressources pédagogiques et contenus',
      purpose: 'Mettre à disposition documents, textes, partitions, musiques, vidéos, annonces et contenus de cours.',
      data: 'Documents, liens, médias, catégories, sous-catégories, auteurs de publication.',
      people: 'Membres, élèves, professeurs, administrateurs.',
      legalBasis: 'Exécution de l’adhésion et intérêt légitime pédagogique.',
      access: 'Membres des groupes concernés, professeurs, administrateurs.',
      retention: 'Durée de la saison ou durée utile pédagogique. Suppression ou archivage par admin.'
    },
    {
      title: 'Calendrier, événements, rappels et sondages',
      purpose: 'Organiser cours, répétitions, spectacles, rappels, événements et réponses aux sondages.',
      data: 'Événements, dates, groupes ciblés, réponses aux sondages, rappels programmés, identifiants utilisateurs liés.',
      people: 'Membres, parents, élèves, professeurs, administrateurs.',
      legalBasis: 'Intérêt légitime d’organisation et exécution de l’adhésion.',
      access: 'Administrateurs, professeurs selon besoin, membres concernés.',
      retention: 'Durée de la saison ou durée utile. Nettoyage des traces UID lors de la suppression complète.'
    },
    {
      title: 'Demandes RGPD et preuves de conformité',
      purpose: 'Tracer les consentements, exports, modifications, suppressions, incidents et preuves internes.',
      data: 'Horodatages, type de demande, UID concerné, action réalisée, registre interne, incidents documentés.',
      people: 'Membres, parents, professeurs, administrateurs.',
      legalBasis: 'Obligation légale RGPD et intérêt légitime de preuve.',
      access: 'Administrateurs uniquement.',
      retention: 'Durée nécessaire à la preuve et à la gestion de conformité, avec minimisation des données.'
    }
  ],
  processors: [
    { name:'Firebase / Google', role:'Authentification, Realtime Database, données techniques de l’app', location:'Union européenne / services Google', note:'Compte de service admin utilisé uniquement côté Worker secret.' },
    { name:'Cloudflare Workers', role:'Workers email/RGPD/push, secrets serveur, routage technique', location:'Cloudflare', note:'Secrets stockés dans Variables and Secrets, pas dans GitHub.' },
    { name:'Brevo', role:'Envoi d’e-mails transactionnels', location:'Union européenne', note:'Utilisé via Make/webhook.' },
    { name:'Make', role:'Automatisations e-mails et scénarios', location:'Union européenne', note:'Webhook stocké côté Worker secret.' },
    { name:'Cloudinary', role:'Stockage / diffusion de certains médias', location:'Cloudinary', note:'Vérifier les médias contenant des personnes identifiables.' },
    { name:'Microsoft OneDrive', role:'Dossiers vidéos Danse', location:'Microsoft', note:'Liens servis via Worker, non exposés directement dans le code public.' },
    { name:'GitHub Pages', role:'Hébergement statique de la PWA', location:'GitHub', note:'Aucun secret ne doit être présent dans le dépôt.' },
    { name:'HelloAsso', role:'Inscriptions, adhésions ou paiements si utilisé', location:'France / HelloAsso', note:'À documenter selon le parcours d’inscription réel.' }
  ],
  procedure: [
    'Identifier immédiatement les données concernées, les personnes touchées et l’origine de l’incident.',
    'Couper l’accès concerné : changer secret, révoquer clé, désactiver compte, corriger règle ou retirer document exposé.',
    'Documenter l’incident dans ce registre : date, description, risque, actions prises, personnes concernées.',
    'Évaluer le risque pour les personnes : aucun risque, risque, ou risque élevé.',
    'Si risque pour les personnes : notifier la CNIL au plus tard sous 72 heures après constatation.',
    'Si risque élevé : informer aussi les personnes concernées avec des consignes simples.',
    'Après correction : vérifier les logs, tester les accès, puis noter la clôture de l’incident.'
  ],
  checklist: [
    'Politique de confidentialité accessible publiquement.',
    'Consentement RGPD obligatoire à l’inscription.',
    'Trace privacyAccepted / privacyAcceptedAt / privacyVersion en base.',
    'Export des données disponible côté membre.',
    'Modification email automatisée via Worker RGPD.',
    'Suppression compte membre automatisée.',
    'Suppression admin complète via Worker full-scan strict.',
    'Désactivation notifications disponible.',
    'Registre interne des traitements rempli et revu.',
    'Sous-traitants listés.',
    'Procédure violation de données documentée.',
    'Autorisation photo/vidéo gérée hors app ou à intégrer si nécessaire.'
  ]
};

function rgpdEsc(value){ return window.FTS && FTS.esc ? FTS.esc(value == null ? '' : value) : String(value == null ? '' : value); }
function rgpdDate(ts){
  if(!ts) return '—';
  try{ return new Date(ts).toLocaleString('fr-FR'); }catch(_){ return String(ts); }
}
function rgpdShowError(msg){
  const err = document.getElementById('auth-error');
  if(err){ err.style.display='block'; err.innerHTML = rgpdEsc(msg) + '<br><br><a href="auth.html">Retour connexion</a>'; }
}
function rgpdToast(msg, type){
  let el = document.getElementById('rgpd-toast');
  if(!el){
    el = document.createElement('div');
    el.id = 'rgpd-toast';
    document.body.appendChild(el);
  }
  el.className = 'rgpd-toast ' + (type || 'ok');
  el.textContent = msg;
  clearTimeout(el.__t);
  el.__t = setTimeout(()=>{ el.classList.remove('show'); }, 3200);
  requestAnimationFrame(()=>el.classList.add('show'));
}
function rgpdCloneDefaults(){ return JSON.parse(JSON.stringify(RGPD_DEFAULTS)); }

window.addEventListener('DOMContentLoaded', function(){
  rgpdDb = FTS.initFirebase();
  rgpdAuth = firebase.auth();
  document.getElementById('rgpd-logout').addEventListener('click', ()=>firebase.auth().signOut().then(()=>location.href='auth.html'));
  document.getElementById('rgpd-save-registry').addEventListener('click', rgpdSaveRegistry);
  document.getElementById('rgpd-load-defaults').addEventListener('click', rgpdLoadDefaultsConfirm);
  document.getElementById('rgpd-add-processor').addEventListener('click', rgpdAddProcessor);
  document.getElementById('rgpd-export-registry').addEventListener('click', rgpdExportRegistry);
  document.getElementById('incident-save').addEventListener('click', rgpdSaveIncident);
  document.getElementById('rgpd-refresh-requests').addEventListener('click', rgpdLoadRequests);
  document.getElementById('incident-date').value = new Date().toISOString().slice(0,10);
  rgpdInitCollapsibles();

  rgpdAuth.onAuthStateChanged(async function(user){
    if(!user){ location.href='auth.html'; return; }
    try{
      const profileSnap = await rgpdDb.ref('fts_users/' + user.uid).once('value');
      const profile = profileSnap.val();
      if(!profile || profile.role !== 'admin'){
        location.href = 'membres.html';
        return;
      }
      rgpdCurrentUser = user;
      document.getElementById('auth-loading').style.display='none';
      document.getElementById('rgpd-shell').hidden = false;
      await rgpdLoadRegistry();
      await rgpdLoadIncidents();
      await rgpdLoadRequests();
    }catch(e){
      console.warn('[FTS RGPD Admin]', e);
      rgpdShowError(e && e.message ? e.message : String(e));
    }
  });
});

function rgpdInitCollapsibles(){
  const cards = Array.from(document.querySelectorAll('.rgpd-card'));
  cards.forEach((card, index)=>{
    if(card.classList.contains('rgpd-actions-card')) return;
    const head = card.querySelector('.rgpd-card-head') || null;
    const title = card.querySelector('h2');
    if(!title) return;
    const key = 'fts_rgpd_admin_section_' + index;
    card.classList.add('rgpd-collapsible');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rgpd-collapse-toggle';
    btn.setAttribute('aria-expanded','true');
    btn.innerHTML = '<span>Replier</span><b aria-hidden="true">⌄</b>';
    const target = head || title.parentElement;
    if(head){
      head.appendChild(btn);
    }else{
      const wrap = document.createElement('div');
      wrap.className = 'rgpd-card-head rgpd-auto-head';
      title.parentNode.insertBefore(wrap, title);
      const div = document.createElement('div');
      div.appendChild(title);
      wrap.appendChild(div);
      wrap.appendChild(btn);
    }
    const saved = localStorage.getItem(key);
    const shouldCollapseByDefault = index >= 2 && index !== 4 && index !== 5;
    const collapsed = saved ? saved === 'collapsed' : shouldCollapseByDefault;
    rgpdSetCollapsed(card, btn, collapsed);
    btn.addEventListener('click', ()=>{
      const next = !card.classList.contains('is-collapsed');
      rgpdSetCollapsed(card, btn, next);
      localStorage.setItem(key, next ? 'collapsed' : 'open');
    });
  });
}
function rgpdSetCollapsed(card, btn, collapsed){
  card.classList.toggle('is-collapsed', !!collapsed);
  btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  btn.querySelector('span').textContent = collapsed ? 'Déplier' : 'Replier';
}

async function rgpdLoadRegistry(){
  const snap = await rgpdDb.ref('fts_privacy_registry/current').once('value');
  rgpdRegistry = snap.val() || rgpdCloneDefaults();
  rgpdRegistry.meta = Object.assign({}, RGPD_DEFAULTS.meta, rgpdRegistry.meta || {});
  rgpdRegistry.treatments = Array.isArray(rgpdRegistry.treatments) && rgpdRegistry.treatments.length ? rgpdRegistry.treatments : rgpdCloneDefaults().treatments;
  rgpdRegistry.processors = Array.isArray(rgpdRegistry.processors) && rgpdRegistry.processors.length ? rgpdRegistry.processors : rgpdCloneDefaults().processors;
  rgpdRegistry.procedure = Array.isArray(rgpdRegistry.procedure) && rgpdRegistry.procedure.length ? rgpdRegistry.procedure : rgpdCloneDefaults().procedure;
  rgpdRegistry.checklist = Array.isArray(rgpdRegistry.checklist) && rgpdRegistry.checklist.length ? rgpdRegistry.checklist : rgpdCloneDefaults().checklist;
  rgpdRenderAll();
}
function rgpdRenderAll(){
  rgpdRenderMeta();
  rgpdRenderStatus();
  rgpdRenderTreatments();
  rgpdRenderProcessors();
  rgpdRenderProcedure();
  rgpdRenderChecklist();
}
function rgpdRenderMeta(){
  const m = rgpdRegistry.meta || {};
  document.getElementById('rgpd-controller').value = m.controller || '';
  document.getElementById('rgpd-contact').value = m.contact || '';
  document.getElementById('rgpd-policy-version').value = m.policyVersion || '';
  document.getElementById('rgpd-last-review').value = m.lastReview || new Date().toISOString().slice(0,10);
}
function rgpdRenderStatus(){
  const items = [
    ['Politique publique', true, 'confidentialite.html disponible'],
    ['Consentement inscription', true, 'case obligatoire + trace Firebase'],
    ['Droits utilisateurs', true, 'export, email, suppression, notifications'],
    ['Suppression complète', true, 'Worker full-scan strict'],
    ['Registre interne', !!(rgpdRegistry && rgpdRegistry.updatedAt), rgpdRegistry && rgpdRegistry.updatedAt ? 'dernière sauvegarde : ' + rgpdDate(rgpdRegistry.updatedAt) : 'à enregistrer une première fois'],
    ['Incidents', true, 'registre disponible admin-only']
  ];
  document.getElementById('rgpd-status-grid').innerHTML = items.map(i=>`<article class="rgpd-status-card ${i[1]?'ok':'todo'}"><strong>${rgpdEsc(i[0])}</strong><span>${i[1]?'✅':'🟡'}</span><small>${rgpdEsc(i[2])}</small></article>`).join('');
  const score = items.filter(i=>i[1]).length;
  document.querySelector('#rgpd-score-card small').textContent = score + '/' + items.length + ' contrôles au vert';
}
function rgpdRenderTreatments(){
  const box = document.getElementById('rgpd-treatments');
  box.innerHTML = rgpdRegistry.treatments.map((t, idx)=>`
    <article class="rgpd-treatment" data-treatment-index="${idx}">
      <div class="rgpd-treatment-title"><span>${idx+1}</span><input data-field="title" value="${rgpdEsc(t.title)}"/></div>
      <div class="rgpd-treatment-grid">
        ${rgpdTreatmentField('purpose','Finalité',t.purpose)}
        ${rgpdTreatmentField('data','Données',t.data)}
        ${rgpdTreatmentField('people','Personnes concernées',t.people)}
        ${rgpdTreatmentField('legalBasis','Base légale',t.legalBasis)}
        ${rgpdTreatmentField('access','Accès',t.access)}
        ${rgpdTreatmentField('retention','Durée / suppression',t.retention)}
      </div>
    </article>`).join('');
}
function rgpdTreatmentField(key,label,value){
  return `<label><span>${rgpdEsc(label)}</span><textarea data-field="${rgpdEsc(key)}" rows="3">${rgpdEsc(value)}</textarea></label>`;
}
function rgpdRenderProcessors(){
  const box = document.getElementById('rgpd-processors');
  box.innerHTML = rgpdRegistry.processors.map((p, idx)=>`
    <article class="rgpd-processor" data-processor-index="${idx}">
      <label>Nom<input data-field="name" value="${rgpdEsc(p.name)}"/></label>
      <label>Rôle<input data-field="role" value="${rgpdEsc(p.role)}"/></label>
      <label>Localisation<input data-field="location" value="${rgpdEsc(p.location)}"/></label>
      <label>Note<textarea data-field="note" rows="2">${rgpdEsc(p.note)}</textarea></label>
      <button type="button" class="rgpd-danger" data-remove-processor="${idx}">Retirer</button>
    </article>`).join('');
  box.querySelectorAll('[data-remove-processor]').forEach(btn=>btn.addEventListener('click', function(){
    const i = Number(this.getAttribute('data-remove-processor'));
    rgpdCollectRegistryFromDom();
    rgpdRegistry.processors.splice(i,1);
    rgpdRenderProcessors();
  }));
}
function rgpdRenderProcedure(){
  document.getElementById('rgpd-procedure').innerHTML = rgpdRegistry.procedure.map(step=>`<li>${rgpdEsc(step)}</li>`).join('');
}
function rgpdRenderChecklist(){
  document.getElementById('rgpd-checklist').innerHTML = rgpdRegistry.checklist.map(item=>`<label><input type="checkbox" checked disabled/><span>${rgpdEsc(item)}</span></label>`).join('');
}
function rgpdAddProcessor(){
  rgpdCollectRegistryFromDom();
  rgpdRegistry.processors.push({name:'',role:'',location:'',note:''});
  rgpdRenderProcessors();
}
function rgpdCollectRegistryFromDom(){
  rgpdRegistry = rgpdRegistry || rgpdCloneDefaults();
  rgpdRegistry.meta = {
    controller: document.getElementById('rgpd-controller').value.trim(),
    contact: document.getElementById('rgpd-contact').value.trim(),
    policyVersion: document.getElementById('rgpd-policy-version').value.trim(),
    lastReview: document.getElementById('rgpd-last-review').value || new Date().toISOString().slice(0,10)
  };
  rgpdRegistry.treatments = Array.from(document.querySelectorAll('[data-treatment-index]')).map(card=>{
    const o = {};
    card.querySelectorAll('[data-field]').forEach(field=>{ o[field.getAttribute('data-field')] = field.value.trim(); });
    return o;
  });
  rgpdRegistry.processors = Array.from(document.querySelectorAll('[data-processor-index]')).map(card=>{
    const o = {};
    card.querySelectorAll('[data-field]').forEach(field=>{ o[field.getAttribute('data-field')] = field.value.trim(); });
    return o;
  }).filter(p=>p.name || p.role || p.location || p.note);
  rgpdRegistry.procedure = rgpdRegistry.procedure || rgpdCloneDefaults().procedure;
  rgpdRegistry.checklist = rgpdRegistry.checklist || rgpdCloneDefaults().checklist;
}
async function rgpdSaveRegistry(){
  try{
    rgpdCollectRegistryFromDom();
    rgpdRegistry.updatedAt = firebase.database.ServerValue.TIMESTAMP;
    rgpdRegistry.updatedBy = rgpdCurrentUser ? rgpdCurrentUser.uid : null;
    await rgpdDb.ref('fts_privacy_registry/current').set(rgpdRegistry);
    await rgpdDb.ref('fts_privacy_registry/history').push({
      type:'registry_saved',
      by: rgpdCurrentUser ? rgpdCurrentUser.uid : null,
      at: firebase.database.ServerValue.TIMESTAMP,
      policyVersion: rgpdRegistry.meta.policyVersion || ''
    });
    rgpdToast('Registre RGPD enregistré.', 'ok');
    await rgpdLoadRegistry();
  }catch(e){
    console.error(e);
    rgpdToast('Enregistrement impossible : ' + (e && e.message ? e.message : String(e)), 'error');
  }
}
function rgpdLoadDefaultsConfirm(){
  if(!confirm('Remplacer les champs affichés par le modèle Fais Ton Show ? Pense à enregistrer ensuite.')) return;
  rgpdRegistry = rgpdCloneDefaults();
  rgpdRenderAll();
  rgpdToast('Modèle FTS rechargé. Clique sur Enregistrer pour le sauvegarder.', 'ok');
}
function rgpdExportRegistry(){
  rgpdCollectRegistryFromDom();
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'Fais Ton Show',
    registry: rgpdRegistry
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'registre-rgpd-fais-ton-show-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
async function rgpdSaveIncident(){
  const description = document.getElementById('incident-description').value.trim();
  const actions = document.getElementById('incident-actions').value.trim();
  if(!description){ rgpdToast('Ajoute une description de l’incident.', 'error'); return; }
  try{
    await rgpdDb.ref('fts_privacy_incidents').push({
      date: document.getElementById('incident-date').value || new Date().toISOString().slice(0,10),
      risk: document.getElementById('incident-risk').value,
      description,
      actions,
      status:'documented',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      createdBy: rgpdCurrentUser ? rgpdCurrentUser.uid : null
    });
    document.getElementById('incident-description').value = '';
    document.getElementById('incident-actions').value = '';
    rgpdToast('Incident enregistré.', 'ok');
    await rgpdLoadIncidents();
  }catch(e){
    rgpdToast('Incident non enregistré : ' + (e && e.message ? e.message : String(e)), 'error');
  }
}
async function rgpdLoadIncidents(){
  const box = document.getElementById('incident-list');
  try{
    const snap = await rgpdDb.ref('fts_privacy_incidents').once('value');
    const rows = [];
    snap.forEach(child=>rows.push(Object.assign({id:child.key}, child.val() || {})));
    rows.sort((a,b)=>{
      const da = Number(a.createdAt || Date.parse(a.date || '') || 0);
      const db = Number(b.createdAt || Date.parse(b.date || '') || 0);
      return db - da;
    });
    if(!rows.length){ box.className='rgpd-list-empty'; box.textContent='Aucun incident documenté.'; return; }
    box.className='rgpd-history-list rgpd-incident-list';
    box.innerHTML = rows.slice(0,80).map(i=>{
      const risk = i.risk || '—';
      const date = i.date || rgpdDate(i.createdAt);
      const status = i.status || 'documented';
      return `<article class="rgpd-history-item rgpd-incident-item">
        <div class="rgpd-history-top"><strong>${rgpdEsc(date)} — ${rgpdEsc(risk)}</strong><span>${rgpdEsc(status)}</span></div>
        <p>${rgpdEsc(i.description || '')}</p>
        <small>${rgpdEsc(i.actions || 'Aucune action renseignée')}</small>
      </article>`;
    }).join('');
  }catch(e){
    box.className='rgpd-list-empty error';
    box.textContent='Impossible de charger les incidents : ' + (e && e.message ? e.message : String(e));
  }
}

function rgpdActionDate(row){
  return Number(row.at || row.createdAt || row.doneAt || row.completedAt || row.requestedAt || row.ts || 0);
}
function rgpdLooksLikeAction(obj){
  return obj && typeof obj === 'object' && !Array.isArray(obj) && (obj.type || obj.action || obj.status || obj.createdAt || obj.requestedAt || obj.doneAt || obj.at);
}
function rgpdCollectActionsFromTree(value, source, path, out){
  if(!value || typeof value !== 'object' || Array.isArray(value)) return;
  if(rgpdLooksLikeAction(value)){
    out.push(Object.assign({ source, id:path }, value));
    return;
  }
  Object.keys(value).forEach(k=>{
    rgpdCollectActionsFromTree(value[k], source, path ? path + '/' + k : k, out);
  });
}
function rgpdActionLabel(row){
  const labels = {
    email_update: 'Modification email',
    delete_account: 'Suppression compte',
    member_delete_account: 'Suppression compte membre',
    admin_delete_account: 'Suppression compte par admin',
    registry_saved: 'Registre enregistré'
  };
  return labels[row.type] || row.type || row.action || row.source || 'action';
}
function rgpdActionIdentity(row){
  if(row.email) return row.email;
  if(row.uid) return 'UID : ' + row.uid;
  if(row.targetUidHash) return 'Compte supprimé · hash UID : ' + String(row.targetUidHash).slice(0,16) + '…';
  if(row.actorUidHash) return 'Demande membre · hash UID : ' + String(row.actorUidHash).slice(0,16) + '…';
  if(row.targetEmailHash) return 'hash email : ' + String(row.targetEmailHash).slice(0,16) + '…';
  return row.id || '';
}
async function rgpdLoadRequests(){
  const box = document.getElementById('privacy-requests-list');
  box.className='rgpd-list-empty';
  box.textContent='Chargement de l’historique…';
  try{
    const refs = ['fts_privacy_requests','fts_privacy_admin_actions','fts_privacy_registry/history'];
    const all = [];
    for(const path of refs){
      try{
        const snap = await rgpdDb.ref(path).once('value');
        rgpdCollectActionsFromTree(snap.val(), path, '', all);
      }catch(_e){}
    }
    all.sort((a,b)=>rgpdActionDate(b)-rgpdActionDate(a));
    const rows = all.slice(0,40);
    if(!rows.length){ box.textContent='Aucune demande ou action RGPD enregistrée pour le moment.'; return; }
    box.className='rgpd-history-list rgpd-actions-history-list';
    box.innerHTML = rows.map(r=>`<article class="rgpd-history-item">
      <div class="rgpd-history-top"><strong>${rgpdEsc(rgpdActionLabel(r))}</strong><span>${rgpdEsc(r.status || r.result || r.source || '')}</span></div>
      <p>${rgpdEsc(rgpdActionIdentity(r))}</p>
      <small>${rgpdDate(rgpdActionDate(r))}</small>
    </article>`).join('');
  }catch(e){
    box.className='rgpd-list-empty error';
    box.textContent='Impossible de charger l’historique : ' + (e && e.message ? e.message : String(e));
  }
}
