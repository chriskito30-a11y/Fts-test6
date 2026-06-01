/* ================================================================
   PAGE MODULE — RGPD ADMIN V177
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
      data: 'Nom, prénom, email, rôle, statut, catégories, sous-catégories, enfants rattachés, date de création, consentement RGPD, choix droit à l’image et historique de modification.',
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
    'Droit à l’image obligatoire à l’inscription, modifiable depuis le compte et consultable par admin/profs.'
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
  const refreshIncidentsBtn = document.getElementById('rgpd-refresh-incidents');
  if(refreshIncidentsBtn) refreshIncidentsBtn.addEventListener('click', rgpdLoadIncidents);
  document.getElementById('rgpd-refresh-requests').addEventListener('click', rgpdLoadRequests);
  const anonBtn = document.getElementById('rgpd-anonymize-old-actions');
  if(anonBtn) anonBtn.addEventListener('click', rgpdAnonymizeLegacyActions);
  document.getElementById('incident-date').value = new Date().toISOString().slice(0,10);
  rgpdInitCollapsibles();

  rgpdAuth.onAuthStateChanged(async function(user){
    if(!user){ location.href='auth.html'; return; }
    try{
      const profileSnap = await rgpdDb.ref('fts_users/' + user.uid).once('value');
      const profile = profileSnap.val();
      const role = String(profile && profile.role || '').toLowerCase();
      const status = String(profile && profile.status || '').toLowerCase();
      if(!profile || status !== 'active'){
        await rgpdAuth.signOut();
        location.href = 'auth.html';
        return;
      }
      if(role !== 'admin'){
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
function rgpdNormalizeIncident(raw, id){
  const row = raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
  row.id = id || row.id || '';
  row.date = row.date || row.incidentDate || row.createdDate || '';
  row.risk = row.risk || row.severity || row.level || '—';
  row.description = row.description || row.desc || row.title || row.summary || 'Incident sans description';
  row.actions = row.actions || row.action || row.correctiveActions || row.measures || 'Aucune action renseignée';
  row.status = row.status || 'documented';
  row.createdAt = row.createdAt || row.at || row.ts || 0;
  return row;
}
function rgpdCollectIncidentsFromTree(value, path, out){
  if(!value || typeof value !== 'object' || Array.isArray(value)) return;
  const keys = Object.keys(value);
  const hasIncidentFields = ['description','desc','actions','action','risk','severity','date','createdAt','status'].some(k=>Object.prototype.hasOwnProperty.call(value, k));
  const hasNestedObjects = keys.some(k=>value[k] && typeof value[k] === 'object' && !Array.isArray(value[k]));
  if(hasIncidentFields && (!hasNestedObjects || value.description || value.desc || value.actions || value.action || value.risk || value.severity || value.date)){
    out.push(rgpdNormalizeIncident(value, path));
  }
  keys.forEach(k=>{
    if(value[k] && typeof value[k] === 'object' && !Array.isArray(value[k])){
      rgpdCollectIncidentsFromTree(value[k], path ? path + '/' + k : k, out);
    }
  });
}
async function rgpdLoadIncidents(){
  const box = document.getElementById('incident-list');
  box.className='rgpd-list-empty';
  box.textContent='Chargement des incidents…';
  try{
    const snap = await rgpdDb.ref('fts_privacy_incidents').once('value');
    const rows = [];
    const value = snap.val();
    if(value && typeof value === 'object'){
      Object.keys(value).forEach(k=>{
        const child = value[k];
        if(child && typeof child === 'object' && !Array.isArray(child)){
          const direct = ['description','desc','actions','action','risk','severity','date','createdAt','status'].some(f=>Object.prototype.hasOwnProperty.call(child, f));
          if(direct) rows.push(rgpdNormalizeIncident(child, k));
          else rgpdCollectIncidentsFromTree(child, k, rows);
        }
      });
    }
    const unique = [];
    const seen = new Set();
    rows.forEach(i=>{
      const key = String(i.id || '') || [i.date, i.createdAt, i.risk, i.description, i.actions].join('|');
      if(!seen.has(key)){ seen.add(key); unique.push(i); }
    });
    unique.sort((a,b)=>{
      const da = Number(a.createdAt || Date.parse(a.date || '') || 0);
      const db = Number(b.createdAt || Date.parse(b.date || '') || 0);
      return db - da;
    });
    if(!unique.length){ box.className='rgpd-list-empty'; box.textContent='Aucun incident documenté.'; return; }
    box.className='rgpd-history-list rgpd-incident-list';
    box.innerHTML = unique.map(i=>{
      const risk = i.risk || '—';
      const date = i.date || rgpdDate(i.createdAt);
      const status = i.status || 'documented';
      const desc = i.description || 'Incident sans description';
      const actions = i.actions || 'Aucune action renseignée';
      return `<article class="rgpd-history-item rgpd-incident-item">
        <div class="rgpd-history-top"><strong>${rgpdEsc(date)} — ${rgpdEsc(risk)}</strong><span>${rgpdEsc(status)}</span></div>
        <p>${rgpdEsc(desc)}</p>
        <small>${rgpdEsc(actions)}</small>
      </article>`;
    }).join('');
  }catch(e){
    box.className='rgpd-list-empty error';
    box.textContent='Impossible de charger les incidents : ' + (e && e.message ? e.message : String(e));
  }
}

function rgpdActionDate(row){
  return Number(row.at || row.createdAt || row.doneAt || row.completedAt || row.requestedAt || row.ts || row.anonymizedAt || 0);
}
function rgpdLooksLikeAction(obj){
  if(!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if(obj.type || obj.action || obj.proofReference || obj.proofText) return true;
  if(obj.source === 'fts_privacy_registry/history') return true;
  if(obj.targetUidHash || obj.actorUidHash || obj.targetEmailHash || obj.emailHash) return true;
  if((obj.status || obj.doneAt || obj.requestedAt || obj.createdAt) && (obj.targetUid || obj.targetEmail || obj.targetName || obj.adminUid)) return true;
  return false;
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
    change_email: 'Modification email',
    delete_account: 'Suppression compte',
    member_delete_account: 'Suppression compte membre',
    admin_delete_account: 'Suppression compte par admin',
    registry_saved: 'Registre enregistré',
    legacy_admin_delete_account_anonymized: 'Suppression compte par admin'
  };
  if(row.type) return labels[row.type] || row.type;
  if(row.action) return labels[row.action] || row.action;
  if(row.source === 'fts_privacy_registry/history') return 'Registre enregistré';
  return 'Action RGPD';
}
function rgpdActionStatus(row){
  const status = row.status || row.result || '';
  if(status === 'done') return 'terminé';
  if(status === 'completed') return 'terminé';
  if(status === 'documented') return 'documenté';
  if(status === 'anonymized') return 'anonymisé';
  return status || '—';
}
function rgpdShortHash(value){
  const v = String(value || '');
  return v ? v.slice(0,16) + '…' : '—';
}
function rgpdProofReference(row){
  if(row.proofReference) return row.proofReference;
  const ts = rgpdActionDate(row) || Date.now();
  const d = new Date(ts);
  const pad = n => String(n).padStart(2,'0');
  const ymd = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  const hms = pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  const suffix = String(row.targetUidHash || row.actorUidHash || row.targetEmailHash || row.emailHash || row.id || '000000').replace(/[^a-zA-Z0-9]/g,'').slice(0,6).toUpperCase() || '000000';
  return 'SUP-' + ymd + '-' + hms + '-' + suffix;
}
function rgpdActionReadableSummary(row){
  if(row.readableSummary) return row.readableSummary;
  const label = rgpdActionLabel(row);
  if(row.type === 'registry_saved' || row.source === 'fts_privacy_registry/history') return 'Le registre interne RGPD a été mis à jour.';
  if(label.toLowerCase().includes('suppression')){
    return 'Le compte utilisateur a été supprimé. Les données personnelles applicatives identifiées dans la base de données de l’application ont été supprimées ; seule une trace administrative anonymisée est conservée.';
  }
  if(label.toLowerCase().includes('email')) return 'Adresse e-mail modifiée à la demande de l’utilisateur ou par action admin.';
  return 'Action RGPD enregistrée dans le registre interne.';
}
function rgpdActionTechnical(row){
  const parts = [];
  if(row.targetUidHash) parts.push('hash UID ' + rgpdShortHash(row.targetUidHash));
  if(row.actorUidHash) parts.push('hash UID demandeur ' + rgpdShortHash(row.actorUidHash));
  if(row.targetEmailHash) parts.push('hash email ' + rgpdShortHash(row.targetEmailHash));
  if(row.emailHash) parts.push('hash email ' + rgpdShortHash(row.emailHash));
  if(row.legacyAnonymized || row.anonymizedAt) parts.push('ancien log anonymisé');
  if(rgpdHasLegacyPersonalData(row)) parts.push('ancien log à anonymiser');
  return parts.join(' · ') || 'aucune donnée personnelle en clair affichée';
}
function rgpdBuildProofText(row){
  if(row.proofText) return row.proofText;
  const label = rgpdActionLabel(row);
  const ref = rgpdProofReference(row);
  const date = rgpdDate(rgpdActionDate(row));
  const status = rgpdActionStatus(row);
  const summary = rgpdActionReadableSummary(row);
  const tech = rgpdActionTechnical(row);
  return [
    'Fais Ton Show — Preuve RGPD',
    '',
    'Référence : ' + ref,
    'Type : ' + label,
    'Statut : ' + status,
    'Date de traitement : ' + date,
    'Traitement effectué par : Administrateur Fais Ton Show',
    'Résultat : ' + summary,
    'Données conservées : uniquement une trace administrative anonymisée dans le registre RGPD.',
    'Détail technique : ' + tech
  ].join('\n');
}
function rgpdActionKey(row){
  return [row.source||'', row.type||row.action||'', rgpdActionDate(row), row.targetUidHash||row.actorUidHash||row.targetEmailHash||row.emailHash||row.id||''].join('|');
}
function rgpdHasLegacyPersonalData(row){
  return !!(row && (row.targetEmail || row.targetName || row.targetUid || row.email || row.uid));
}
async function rgpdSha256(value){
  const text = String(value || '');
  if(!text) return '';
  try{
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(_e){
    let h = 0;
    for(let i=0;i<text.length;i++){ h = ((h<<5)-h) + text.charCodeAt(i); h |= 0; }
    return 'local-' + Math.abs(h).toString(16);
  }
}
async function rgpdPrepareProofFields(row){
  const clean = Object.assign({}, row);
  delete clean.id;
  delete clean.source;
  if(row.targetUid){ clean.targetUidHash = await rgpdSha256(row.targetUid); delete clean.targetUid; }
  if(row.targetEmail){ clean.targetEmailHash = await rgpdSha256(String(row.targetEmail).toLowerCase().trim()); delete clean.targetEmail; }
  if(row.targetName){ clean.targetNameHash = await rgpdSha256(String(row.targetName).trim()); delete clean.targetName; }
  if(row.uid){ clean.uidHash = await rgpdSha256(row.uid); delete clean.uid; }
  if(row.email){ clean.emailHash = await rgpdSha256(String(row.email).toLowerCase().trim()); delete clean.email; }
  clean.type = clean.type || (clean.targetUidHash || clean.targetEmailHash || clean.targetNameHash ? 'legacy_admin_delete_account_anonymized' : 'admin_delete_account');
  clean.status = clean.status || 'done';
  clean.legacyAnonymized = rgpdHasLegacyPersonalData(row) ? true : !!clean.legacyAnonymized;
  clean.anonymizedAt = clean.anonymizedAt || firebase.database.ServerValue.TIMESTAMP;
  clean.anonymizedBy = clean.anonymizedBy || (rgpdCurrentUser ? rgpdCurrentUser.uid : null);
  clean.proofReference = clean.proofReference || rgpdProofReference(clean);
  clean.readableSummary = clean.readableSummary || rgpdActionReadableSummary(clean);
  clean.proofText = clean.proofText || rgpdBuildProofText(clean);
  return clean;
}
async function rgpdAnonymizeLegacyActions(){
  if(!confirm('Anonymiser les anciens logs ET générer des preuves RGPD lisibles ? Les emails, noms et UID bruts seront remplacés par des hash irréversibles.')) return;
  const btn = document.getElementById('rgpd-anonymize-old-actions');
  if(btn) btn.disabled = true;
  try{
    const snap = await rgpdDb.ref('fts_privacy_admin_actions').once('value');
    const actions = [];
    rgpdCollectActionsFromTree(snap.val(), 'fts_privacy_admin_actions', '', actions);
    const updates = {};
    for(const row of actions){
      if(!row.id) continue;
      const needsProof = !row.proofReference || !row.proofText || !row.readableSummary;
      if(!rgpdHasLegacyPersonalData(row) && !needsProof) continue;
      updates[row.id] = await rgpdPrepareProofFields(row);
    }
    const count = Object.keys(updates).length;
    if(!count){ rgpdToast('Aucun ancien log à corriger.', 'ok'); return; }
    await rgpdDb.ref('fts_privacy_admin_actions').update(updates);
    rgpdToast(count + ' log(s) RGPD corrigé(s) avec preuve lisible.', 'ok');
    await rgpdLoadRequests();
  }catch(e){
    rgpdToast('Correction impossible : ' + (e && e.message ? e.message : String(e)), 'error');
  }finally{
    if(btn) btn.disabled = false;
  }
}
async function rgpdCopyProof(text){
  try{
    await navigator.clipboard.writeText(text);
    rgpdToast('Preuve RGPD copiée.', 'ok');
  }catch(e){
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    rgpdToast('Preuve RGPD copiée.', 'ok');
  }
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
    const seen = new Set();
    const dedup = [];
    all.forEach(r=>{
      const key = rgpdActionKey(r);
      if(!seen.has(key)){ seen.add(key); dedup.push(r); }
    });
    dedup.sort((a,b)=>rgpdActionDate(b)-rgpdActionDate(a));
    const rows = dedup.slice(0,50);
    if(!rows.length){ box.textContent='Aucune demande ou action RGPD enregistrée pour le moment.'; return; }
    window.__rgpdProofTexts = {};
    box.className='rgpd-history-list rgpd-actions-history-list';
    box.innerHTML = rows.map((r, idx)=>{
      const proofText = rgpdBuildProofText(r);
      const proofId = 'proof_' + idx;
      window.__rgpdProofTexts[proofId] = proofText;
      const needsAnon = rgpdHasLegacyPersonalData(r);
      const ref = rgpdProofReference(r);
      return `<article class="rgpd-history-item rgpd-proof-item ${needsAnon ? 'needs-anon' : ''}">
        <div class="rgpd-history-top"><strong>${rgpdEsc(rgpdActionLabel(r))}</strong><span>${rgpdEsc(rgpdActionStatus(r))}</span></div>
        <p><b>Référence :</b> ${rgpdEsc(ref)}</p>
        <p>${rgpdEsc(rgpdActionReadableSummary(r))}</p>
        <small><b>Date :</b> ${rgpdEsc(rgpdDate(rgpdActionDate(r)))}</small>
        <small><b>Détail technique :</b> ${rgpdEsc(rgpdActionTechnical(r))}</small>
        ${needsAnon ? '<small class="rgpd-warning-inline">Ancien log brut détecté : clique sur “Anonymiser + preuves lisibles”.</small>' : ''}
        <button type="button" class="rgpd-copy-proof" data-proof-id="${rgpdEsc(proofId)}">Copier la preuve</button>
      </article>`;
    }).join('');
    box.querySelectorAll('.rgpd-copy-proof').forEach(btn=>btn.addEventListener('click', function(){
      const id = this.getAttribute('data-proof-id');
      rgpdCopyProof((window.__rgpdProofTexts && window.__rgpdProofTexts[id]) || '');
    }));
  }catch(e){
    box.className='rgpd-list-empty error';
    box.textContent='Impossible de charger l’historique : ' + (e && e.message ? e.message : String(e));
  }
}
