/* ================================================================
   PAGE MODULE — CONTENUS-ADMIN
   Extrait depuis contenus-admin.html pour supprimer le JavaScript inline.
   ================================================================ */

let db, auth;
let questionnaire = [];
let resources = [];
let categoryStructure = [];
let categoriesRaw = [];
let targetedAnnonces = [];
let selectedTargetedAnnonce = null;
let resourceListenerStarted = false;
let questionnaireListenerStarted = false;

function $(id){ return document.getElementById(id); }
function msg(id, txt, ok=true){
  const el=$(id); if(!el) return;
  el.textContent=txt;
  el.className='msg '+(ok?'ok':'err');
  setTimeout(()=>{ el.className='msg'; }, 3000);
}

const adminActionBusy = {};
const adminActionButtons = {
  saveAnnonce: '[data-fts-handler-6]',
  saveQuestionnaire: '[data-fts-handler-8]',
  deleteQuestionnaire: '[data-fts-handler-9]',
  saveResource: '[data-fts-handler-12]',
  deleteResource: '[data-fts-handler-13]',
  saveCategory: '[data-fts-handler-15]',
  deleteCategory: '[data-fts-handler-16]',
  saveTargetedAnnonce: '[data-fts-handler-18]',
  deleteTargetedAnnonce: '[data-fts-handler-19]'
};
function errText(e){ return (e && e.message) ? e.message : String(e || 'Erreur inconnue'); }
function setAdminActionBusyUi(key, busy){
  const selector = adminActionButtons[key];
  if(!selector) return;
  document.querySelectorAll(selector).forEach(btn=>{
    if(!btn) return;
    if(!btn.dataset.originalText) btn.dataset.originalText = btn.textContent || '';
    btn.disabled = !!busy;
    btn.classList.toggle('is-admin-loading', !!busy);
    if(busy) btn.textContent = 'Action en cours…';
    else btn.textContent = btn.dataset.originalText || btn.textContent || 'Valider';
  });
}
async function safeAdminAction(key, msgId, action){
  if(adminActionBusy[key]) return;
  adminActionBusy[key] = true;
  setAdminActionBusyUi(key, true);
  try{
    await action();
  }catch(e){
    console.warn('[FTS Contenus Admin]', key, e);
    msg(msgId, 'Erreur : ' + errText(e), false);
  }finally{
    adminActionBusy[key] = false;
    setAdminActionBusyUi(key, false);
  }
}

function escText(v){ return FTS.esc(String(v||'').trim()); }
function dtLocalFromTs(ts){
  const n = Number(ts || 0);
  if (!n) return '';
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return '';
  const pad = v => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function tsFromDtLocal(id){
  const v = ($(id)?.value || '').trim();
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}
function expiryLabelFromInput(id){
  const ts = tsFromDtLocal(id);
  if (!ts) return 'permanente';
  return 'jusqu’au ' + new Date(ts).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function expiryLabelFromTs(ts){
  const n = Number(ts || 0);
  if (!n) return 'Permanente';
  return 'Jusqu’au ' + new Date(n).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function isExpiredTs(ts){
  const n = Number(ts || 0);
  return !!n && n <= Date.now();
}
function renderAdminPreviews(){
  renderAnnoncePreview();
  renderQuestionnairePreview();
  renderResourcePreview();
  renderTargetedAnnoncePreview();
}
function renderAnnoncePreview(){
  const box=$('annonce-preview'); if(!box) return;
  const active=$('a-active')?.value==='true';
  const title=$('a-title')?.value.trim() || 'Info importante';
  const body=$('a-body')?.value.trim() || 'Ton annonce apparaîtra ici.';
  const btn=$('a-btn')?.value.trim();
  box.innerHTML=`<div class="preview-label">Aperçu membre ${active?'':'· masqué'} · ${FTS.esc(expiryLabelFromInput('a-expires'))}</div><div class="preview-card ${active?'':'is-muted'}"><strong>${escText(title)}</strong><p>${escText(body)}</p>${btn?`<span class="preview-button">${escText(btn)}</span>`:''}</div>`;
}
function renderQuestionnairePreview(){
  const box=$('questionnaire-preview'); if(!box) return;
  const icon=$('q-icon')?.value.trim() || '🎭';
  const title=$('q-title')?.value.trim() || 'Titre de la carte';
  const desc=$('q-desc')?.value.trim() || 'Résumé affiché sous le titre.';
  const d1k=$('q-d1k')?.value.trim(), d1v=$('q-d1v')?.value.trim();
  const d2k=$('q-d2k')?.value.trim(), d2v=$('q-d2v')?.value.trim();
  const active=$('q-active')?.value!=='false';
  const tags=[];
  if(d1k && d1v) tags.push(`<span>${escText(d1k)} : ${escText(d1v)}</span>`);
  if(d2k && d2v) tags.push(`<span>${escText(d2k)} : ${escText(d2v)}</span>`);
  box.innerHTML=`<div class="preview-label">Aperçu accueil ${active?'':'· masqué'}</div><div class="preview-card ${active?'':'is-muted'}"><span class="preview-icon">${escText(icon)}</span><strong>${escText(title)}</strong><p>${escText(desc)}</p>${tags.length?`<div class="preview-tags">${tags.join('')}</div>`:''}</div>`;
}
function isScriptRehearsalCategory(cat){
  const n=(FTS.norm ? FTS.norm(cat||'') : String(cat||'').toLowerCase().trim());
  return ['theatre','comedie musicale','singer show','singer academy','chant'].some(key => n.includes(key));
}
function updateScriptRehearsalField(){
  const wrap=$('r-script-rehearsal-wrap');
  const cb=$('r-script-rehearsal');
  if(!wrap||!cb) return;
  const cat=($('r-cat-new')?.value.trim() || $('r-cat')?.value || '').trim();
  const type=String($('r-type')?.value||'').toLowerCase();
  const allowed=type==='pdf' && isScriptRehearsalCategory(cat);
  wrap.hidden=!allowed;
  wrap.classList.toggle('is-disabled', !allowed);
  if(!allowed) cb.checked=false;
}
function renderResourcePreview(){
  updateScriptRehearsalField();
  const box=$('resource-preview'); if(!box) return;
  const name=$('r-name')?.value.trim() || 'Nom de la ressource';
  const type=($('r-type')?.value || 'pdf').toUpperCase();
  const cat=($('r-cat-new')?.value.trim() || $('r-cat')?.value || 'Catégorie');
  const sub=($('r-subcat-new')?.value.trim() || $('r-subcat')?.value || '');
  const active=$('r-active')?.value!=='false';
  const rehearsal=$('r-script-rehearsal')?.checked===true;
  const rehearsalBadge=rehearsal?'<span class="preview-type preview-type--rehearsal">🎭 Répétition</span>':'';
  box.innerHTML=`<div class="preview-label">Aperçu membre ${active?'':'· masqué'}</div><div class="preview-card resource-card ${active?'':'is-muted'}"><span class="preview-type">${escText(type)}</span>${rehearsalBadge}<strong>${escText(name)}</strong><p>${escText(cat)}${sub?' · '+escText(sub):''}</p></div>`;
}
function bindPreviewInputs(){
  ['a-active','a-title','a-body','a-btn','a-url','a-expires','ta-active','ta-title','ta-body','ta-btn','ta-url','ta-expires','ta-display','q-type','q-order','q-icon','q-active','q-title','q-desc','q-link','q-d1k','q-d1v','q-d2k','q-d2v','q-dtitle','q-ddesc','r-cat','r-cat-new','r-subcat','r-subcat-new','r-type','r-active','r-name','r-url','r-script-rehearsal'].forEach(id=>{
    const el=$(id); if(!el || el.__ftsPreviewBound) return;
    el.__ftsPreviewBound=true;
    el.addEventListener('input', renderAdminPreviews);
    el.addEventListener('change', renderAdminPreviews);
  });
}

function showTab(id,btn){
  document.querySelectorAll('.tab-lnk').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  $('tab-'+id)?.classList.add('active');
  if(id==='questionnaire') renderQList();
  if(id==='ressources') renderRList();
  if(id==='categories') renderCList();
}
function doLogout(){ firebase.auth().signOut().then(()=>location.href='auth.html'); }

function init(){
  db=FTS.initFirebase();
  auth=firebase.auth();
  auth.onAuthStateChanged(async user=>{
    if(!user){ location.href='auth.html'; return; }
    const snap=await db.ref('fts_users/'+user.uid).once('value');
    const p=snap.val();
    if(!p || p.role!=='admin'){ location.href='membres.html'; return; }
    $('auth-loading').style.display='none';
    $('admin-shell').style.display='block';
    bindPreviewInputs();
    renderAdminPreviews();
    await seedCategoriesIfEmpty();
    listenCategories();
    listenQuestionnaire();
    listenResources();
    await loadAnnonce();
    listenTargetedAnnonces();
  });
}

/* ═══ ANNONCE ═══════════════════════════════════════════════ */
async function loadAnnonce(){
  const s=await db.ref('fts_content/annonces/current').once('value');
  const a=s.val()||{};
  $('a-active').value=String(a.active!==false);
  $('a-title').value=a.title||'';
  $('a-body').value=a.body||a.text||'';
  $('a-btn').value=a.buttonText||'';
  $('a-url').value=a.buttonUrl||'';
  if($('a-expires')) $('a-expires').value=dtLocalFromTs(a.expiresAt || a.expireAt || a.endAt || 0);
  renderAnnoncePreview();
}
async function saveAnnonce(){
  return safeAdminAction('saveAnnonce', 'msg-annonce', async function(){
    await db.ref('fts_content/annonces/current').set({
      active:$('a-active').value==='true',
      title:$('a-title').value.trim(),
      body:$('a-body').value.trim(),
      buttonText:$('a-btn').value.trim(),
      buttonUrl:$('a-url').value.trim(),
      expiresAt:tsFromDtLocal('a-expires'),
      updatedAt:Date.now()
    });
    msg('msg-annonce','Annonce enregistrée — aperçu et diffusion prêts.');
  });
}


/* ═══ ANNONCES CIBLÉES SUPPLÉMENTAIRES ════════════════════════ */
function taNorm(v){ return String(v||'').trim(); }
function normList(arr){
  if(!arr) return [];
  const source = Array.isArray(arr) ? arr : (typeof arr === 'object' ? Object.keys(arr) : [arr]);
  const out = [];
  source.forEach(v => {
    const t = String(v || '').trim();
    if(t && !out.some(x => FTS.norm(x) === FTS.norm(t))) out.push(t);
  });
  return out;
}
function taSelectedCats(){ return Array.from(document.querySelectorAll('#ta-cat-picker input[type="checkbox"]:checked')).map(x=>x.value).filter(Boolean); }
function taSelectedGroups(){
  const groups = {};
  taSelectedCats().forEach(cat => { groups[cat] = []; });
  document.querySelectorAll('#ta-subcat-picker input[type="checkbox"]:checked').forEach(input => {
    const cat = input.dataset.cat || '';
    if(!cat) return;
    if(!groups[cat]) groups[cat] = [];
    groups[cat].push(input.value);
  });
  return groups;
}
function taFlattenSubs(groups){
  const out=[];
  Object.values(groups||{}).forEach(list => (Array.isArray(list)?list:[]).forEach(s => { if(s && !out.includes(s)) out.push(s); }));
  return out;
}
function taTargetSummaryHtml(){
  const cats = taSelectedCats();
  const groups = taSelectedGroups();
  if(!cats.length) return '<div class="target-summary"><strong>Visible par</strong><span>Tous les membres actifs</span></div>';
  const rows = cats.map(cat=>{
    const subs = normList(groups[cat] || []);
    const label = subs.length ? subs.join(', ') : 'Toute la catégorie';
    return `<span class="target-summary-chip"><b>${FTS.esc(cat)}</b> ${FTS.esc(label)}</span>`;
  }).join('');
  return `<div class="target-summary"><strong>Visible par</strong><div class="target-summary-chips">${rows}</div></div>`;
}
function renderTargetSummary(){
  const box=$('targeted-annonce-preview');
  if(!box) return;
  let summary=$('ta-target-summary');
  if(!summary){
    summary=document.createElement('div');
    summary.id='ta-target-summary';
    box.parentNode.insertBefore(summary, box);
  }
  summary.innerHTML=taTargetSummaryHtml();
}
function renderTargetPickers(data){
  const catBox=$('ta-cat-picker');
  const subBox=$('ta-subcat-picker');
  if(!catBox || !subBox) return;
  const selectedCats = normList((data && (data.targetCategories || data.categories || data.groups)) || taSelectedCats());
  const existingGroups = (data && data.targetGroups && typeof data.targetGroups==='object') ? data.targetGroups : {};
  catBox.innerHTML = (categoryStructure||[]).length
    ? categoryStructure.map(c => {
        const checked = selectedCats.some(x => FTS.norm(x)===FTS.norm(c.category));
        return `<label class="target-chip"><input type="checkbox" value="${FTS.esc(c.category)}" ${checked?'checked':''}> <span>${FTS.esc(c.icon||FTS.catIcon(c.category))} ${FTS.esc(c.category)}</span></label>`;
      }).join('')
    : '<div class="hint">Aucune catégorie disponible.</div>';
  renderTargetSubcats(existingGroups);
  catBox.querySelectorAll('input').forEach(i => i.addEventListener('change', () => { renderTargetSubcats(); renderTargetSummary(); renderTargetedAnnoncePreview(); }));
}
function renderTargetSubcats(existingGroups){
  const subBox=$('ta-subcat-picker'); if(!subBox) return;
  const selectedCats = taSelectedCats();
  if(!selectedCats.length){
    subBox.innerHTML = '<div class="target-empty">Aucune catégorie sélectionnée : annonce visible pour tous les membres actifs.</div>';
    renderTargetSummary();
    return;
  }
  const html = selectedCats.map(catName => {
    const cat=(categoryStructure||[]).find(c => FTS.norm(c.category)===FTS.norm(catName));
    const subs=((cat && cat.subs) || []).filter(s=>s && s.name);
    if(!subs.length) return `<div class="target-subgroup"><strong>${FTS.esc(catName)}</strong><small>Aucune sous-catégorie : toute la catégorie est ciblée.</small></div>`;
    const checkedList = normList((existingGroups && existingGroups[catName]) || []);
    return `<div class="target-subgroup"><strong>${FTS.esc(catName)}</strong><div class="target-subchips">${subs.map(s=>{
      const checked = checkedList.some(x => FTS.norm(x)===FTS.norm(s.name));
      return `<label class="target-chip sub"><input type="checkbox" data-cat="${FTS.esc(catName)}" value="${FTS.esc(s.name)}" ${checked?'checked':''}> <span>${FTS.esc(s.name)}</span></label>`;
    }).join('')}</div><small>Si tu ne coches rien ici, toute la catégorie ${FTS.esc(catName)} reçoit l’annonce.</small></div>`;
  }).join('');
  subBox.innerHTML = html;
  subBox.querySelectorAll('input').forEach(i => i.addEventListener('change', () => { renderTargetSummary(); renderTargetedAnnoncePreview(); }));
  renderTargetSummary();
}
function renderTargetedAnnoncePreview(){
  renderTargetSummary();
  const box=$('targeted-annonce-preview'); if(!box) return;
  const active=$('ta-active')?.value==='true';
  const title=$('ta-title')?.value.trim() || 'Annonce ciblée';
  const body=$('ta-body')?.value.trim() || 'Ton annonce ciblée apparaîtra ici.';
  const btn=$('ta-btn')?.value.trim();
  const cats=taSelectedCats();
  const groups=taSelectedGroups();
  const subs=taFlattenSubs(groups);
  const targetLabel = cats.length ? `${cats.length} catégorie${cats.length>1?'s':''}${subs.length?' · '+subs.length+' sous-catégorie'+(subs.length>1?'s':''):''}` : 'Tous les membres actifs';
  const expiryLabel = expiryLabelFromInput('ta-expires');
  box.innerHTML=`<div class="preview-label">Aperçu membre ${active?'':'· masqué'} · ${FTS.esc(targetLabel)} · ${FTS.esc(expiryLabel)}</div><div class="preview-card ${active?'':'is-muted'}"><strong>${escText(title)}</strong><p>${escText(body)}</p>${btn?`<span class="preview-button">${escText(btn)}</span>`:''}</div>`;
}
function normalizeTargetedAnnonce(v={}, key=''){
  const groups = (v.targetGroups && typeof v.targetGroups==='object') ? v.targetGroups : {};
  let cats = normList(v.targetCategories || v.categories || v.groups || Object.keys(groups));
  Object.keys(groups).forEach(cat => { if(cat && !cats.some(x=>FTS.norm(x)===FTS.norm(cat))) cats.push(cat); });
  return {...v, key, targetCategories:cats, targetGroups:groups, active:v.active!==false && v.status!=='inactive'};
}
function listenTargetedAnnonces(){
  db.ref('fts_content/annonces/targeted').on('value', snap => {
    const rows=[];
    snap.forEach(ch => rows.push(normalizeTargetedAnnonce(ch.val()||{}, ch.key)));
    targetedAnnonces = rows.sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0));
    renderTargetedAnnoncesList();
    if(!selectedTargetedAnnonce && targetedAnnonces[0]) editTargetedAnnonce(targetedAnnonces[0].key);
    else if(!targetedAnnonces.length) newTargetedAnnonce();
  });
}
function renderTargetedAnnoncesList(){
  const el=$('targeted-annonces-list'); if(!el) return;
  el.innerHTML = targetedAnnonces.length ? targetedAnnonces.map(a => {
    const title=a.title||a.body||'Annonce ciblée sans titre';
    const cats=normList(a.targetCategories||[]);
    const subs=taFlattenSubs(a.targetGroups||{});
    const meta = cats.length ? `${cats.join(', ')}${subs.length?' · '+subs.length+' sous-catégorie'+(subs.length>1?'s':''):''}` : 'Tous les membres actifs';
    const expiry = expiryLabelFromTs(a.expiresAt || a.expireAt || a.endAt || 0);
    const expired = isExpiredTs(a.expiresAt || a.expireAt || a.endAt || 0);
    return `<div class="item${selectedTargetedAnnonce===a.key?' sel':''}" data-fts-click="editTargetedAnnonce('${FTS.esc(a.key)}')"><div class="item-title">${expired?'⏱️':(a.active?'📣':'🙈')} ${FTS.esc(title)}</div><div class="item-meta">${FTS.esc(meta)} · ${FTS.esc(expiry)}${expired?' · expirée':''}</div></div>`;
  }).join('') : '<div class="hint">Aucune annonce ciblée pour le moment.</div>';
}
function newTargetedAnnonce(){
  selectedTargetedAnnonce=null;
  ['ta-key','ta-title','ta-body','ta-btn','ta-url','ta-expires'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('ta-active')) $('ta-active').value='true';
  if($('ta-display')) $('ta-display').value='card';
  renderTargetPickers({targetCategories:[],targetGroups:{}});
  renderTargetedAnnoncesList();
  renderTargetedAnnoncePreview();
}
function editTargetedAnnonce(key){
  const a=targetedAnnonces.find(x=>x.key===key); if(!a) return;
  selectedTargetedAnnonce=key;
  $('ta-key').value=key;
  $('ta-active').value=String(a.active!==false && a.status!=='inactive');
  $('ta-display').value=a.displayMode||a.display||'card';
  $('ta-title').value=a.title||'';
  $('ta-body').value=a.body||a.text||'';
  $('ta-btn').value=a.buttonText||a.btn||'';
  $('ta-url').value=a.buttonUrl||a.url||'';
  if($('ta-expires')) $('ta-expires').value=dtLocalFromTs(a.expiresAt || a.expireAt || a.endAt || 0);
  renderTargetPickers(a);
  renderTargetedAnnoncesList();
  renderTargetedAnnoncePreview();
}
async function saveTargetedAnnonce(){
  return safeAdminAction('saveTargetedAnnonce', 'msg-targeted-annonce', async function(){
    const title=$('ta-title').value.trim();
    const body=$('ta-body').value.trim();
    if(!title && !body){ msg('msg-targeted-annonce','Ajoute au moins un titre ou un message.',false); return; }
    const groups=taSelectedGroups();
    const cats=taSelectedCats();
    const now=Date.now();
    const data={
      active:$('ta-active').value==='true',
      status:$('ta-active').value==='true'?'active':'inactive',
      title, body,
      text:body,
      buttonText:$('ta-btn').value.trim(),
      buttonUrl:$('ta-url').value.trim(),
      displayMode:$('ta-display').value||'card',
      expiresAt:tsFromDtLocal('ta-expires'),
      targetCategories:cats,
      categories:cats,
      targetGroups:groups,
      targetSubgroups:taFlattenSubs(groups),
      updatedAt:now
    };
    const key=$('ta-key').value;
    const ref=key ? db.ref('fts_content/annonces/targeted/'+key) : db.ref('fts_content/annonces/targeted').push();
    if(!key) data.createdAt=now;
    await ref.update(data);
    $('ta-key').value=ref.key;
    selectedTargetedAnnonce=ref.key;
    msg('msg-targeted-annonce','Annonce ciblée enregistrée — ciblage vérifié.');
  });
}
async function deleteTargetedAnnonce(){
  return safeAdminAction('deleteTargetedAnnonce', 'msg-targeted-annonce', async function(){
    const key=$('ta-key').value;
    if(!key){ newTargetedAnnonce(); return; }
    if(!confirm('Supprimer cette annonce ciblée ?')) return;
    await db.ref('fts_content/annonces/targeted/'+key).remove();
    newTargetedAnnonce();
    msg('msg-targeted-annonce','Annonce ciblée supprimée');
  });
}

/* ═══ QUESTIONNAIRE ═══════════════════════════════════════════
   Source officielle : fts_content/questionnaire/options
   Compatibilité : si d'anciens items sont directement sous questionnaire,
   on les lit aussi et on les migre à la prochaine sauvegarde.
═══════════════════════════════════════════════════════════════ */
function normalizeQuestionnaireItem(v={}, key=''){
  const details = [];
  if(Array.isArray(v.details)){
    v.details.forEach(d=>{
      const k=(d?.key||d?.cle||'').trim();
      const val=(d?.value||d?.valeur||'').trim();
      if(k && val) details.push({key:k, value:val});
    });
  }
  const d1k=v.detail1_cle||v.detail1Key||v.detail1_key||'';
  const d1v=v.detail1_valeur||v.detail1Value||v.detail1_value||'';
  const d2k=v.detail2_cle||v.detail2Key||v.detail2_key||'';
  const d2v=v.detail2_valeur||v.detail2Value||v.detail2_value||'';
  if(!details.length && d1k && d1v) details.push({key:d1k, value:d1v});
  if(details.length<2 && d2k && d2v) details.push({key:d2k, value:d2v});
  const title=v.title||v.titre||'';
  return {
    ...v,
    key,
    type:v.type||'adhesion',
    order:Number(v.order||999),
    icon:v.icon||'🎭',
    active:v.active!==false && v.status!=='inactive',
    title,
    titre:title,
    description:v.description||v.desc||'',
    link:v.link||v.lien||'',
    lien:v.link||v.lien||'',
    destTitle:v.destTitle||v.dest_titre||'',
    destDesc:v.destDesc||v.dest_desc||'',
    details
  };
}
function listenQuestionnaire(){
  if(questionnaireListenerStarted) return;
  questionnaireListenerStarted = true;
  db.ref('fts_content/questionnaire').on('value', snap=>{
    const rows=[];
    const root=snap.val()||{};

    // Format officiel : questionnaire/options/{id}
    const opts=root.options||{};
    Object.keys(opts).forEach(key=>rows.push(normalizeQuestionnaireItem(opts[key], key)));

    // Compatibilité ancien format : questionnaire/{id} avec champs type/title/link
    Object.keys(root).forEach(key=>{
      if(key==='options' || key==='settings') return;
      const v=root[key];
      if(v && typeof v==='object' && (v.type || v.title || v.titre || v.link || v.lien)){
        rows.push(normalizeQuestionnaireItem({...v, _legacyPath:'fts_content/questionnaire/'+key}, key));
      }
    });

    const seen=new Set();
    questionnaire=rows.filter(q=>{
      const id=q._legacyPath ? 'legacy:'+q.key : q.key;
      if(seen.has(id)) return false;
      seen.add(id);

      // IMPORTANT UX / SOURCE UNIQUE :
      // Les événements et spectacles se gèrent uniquement depuis calendrier-admin.html.
      // S'ils sont miroités dans fts_content/questionnaire/options pour l'accueil,
      // on ne les affiche pas ici afin d'éviter création/modification en double.
      if((q.type||'').toLowerCase()==='event') return false;

      return q.title || q.titre;
    }).sort((a,b)=>(a.order||999)-(b.order||999)||(a.title||'').localeCompare(b.title||'', 'fr'));
    renderQList();
    const selected=$('q-key').value;
    if(selected && questionnaire.some(q=>q.key===selected)) editQuestionnaire(selected, $('q-key').dataset.legacy||'');
    else if(questionnaire.length) editQuestionnaire(questionnaire[0].key, questionnaire[0]._legacyPath);
    else newQuestionnaire();
  }, err=>{
    console.warn('[FTS Contenus] questionnaire', err);
    msg('msg-q','Lecture questionnaire impossible : '+err.message,false);
  });
}
function renderQList(){
  const el=$('q-list'); if(!el) return;
  const selected=$('q-key')?.value||'';
  el.innerHTML=questionnaire.length ? questionnaire.map(q=>{
    const legacyAttr=q._legacyPath ? ` data-legacy="${FTS.esc(q._legacyPath)}"` : '';
    return `<div class="item${selected===q.key?' sel':''}" data-fts-click="editQuestionnaire('${FTS.esc(q.key)}', this.dataset.legacy||'')"${legacyAttr}>
      <div class="item-title">${FTS.esc(q.icon||'')} ${FTS.esc(q.title||q.titre||'Sans titre')}</div>
      <div class="item-meta">${FTS.esc(q.type||'')} · ${priorityLabel(q.order)}${q.active===false?' · masqué':''}${q._legacyPath?' · ancien emplacement':''}</div>
    </div>`;
  }).join('') : '<div class="hint">Aucune option.</div>';
}
function newQuestionnaire(){
  ['q-key','q-title','q-desc','q-link','q-d1k','q-d1v','q-d2k','q-d2v','q-dtitle','q-ddesc'].forEach(id=>$(id).value='');
  $('q-key').dataset.legacy='';
  $('q-type').value='adhesion';
  $('q-icon').value='🎭';
  $('q-order').value='100';
  $('q-active').value='true';
  renderQList();
  renderQuestionnairePreview();
}
function editQuestionnaire(key, legacyPath=''){
  const q=questionnaire.find(x=>x.key===key && (!legacyPath || x._legacyPath===legacyPath)) || questionnaire.find(x=>x.key===key);
  if(!q) return;
  $('q-key').value=key;
  $('q-key').dataset.legacy=legacyPath || q._legacyPath || '';
  $('q-type').value=(q.type==='event')?'adhesion':(q.type||'adhesion');
  $('q-order').value=normalizePriorityValue(q.order); 
  $('q-icon').value=q.icon||'';
  $('q-active').value=String(q.active!==false);
  $('q-title').value=q.title||q.titre||'';
  $('q-desc').value=q.description||q.desc||'';
  $('q-link').value=q.link||q.lien||'';
  const ds=q.details||[];
  $('q-d1k').value=ds[0]?.key||'';
  $('q-d1v').value=ds[0]?.value||'';
  $('q-d2k').value=ds[1]?.key||'';
  $('q-d2v').value=ds[1]?.value||'';
  $('q-dtitle').value=q.destTitle||q.dest_titre||'';
  $('q-ddesc').value=q.destDesc||q.dest_desc||'';
  renderQList();
  renderQuestionnairePreview();
}
async function saveQuestionnaire(){
  return safeAdminAction('saveQuestionnaire', 'msg-q', async function(){
    const existingKey=$('q-key').value;
    const legacyPath=$('q-key').dataset.legacy||'';
    const details=[];
    [['q-d1k','q-d1v'],['q-d2k','q-d2v']].forEach(([k,v])=>{
      const detailKey=$(k).value.trim();
      const val=$(v).value.trim();
      if(detailKey && val) details.push({key:detailKey,value:val});
    });
    const title=$('q-title').value.trim();
    const description=$('q-desc').value.trim();
    const link=$('q-link').value.trim();
    const destTitle=$('q-dtitle').value.trim();
    const destDesc=$('q-ddesc').value.trim();
    if(!title){ msg('msg-q','Titre requis',false); return; }
    const data={
      type:($('q-type').value==='event'?'adhesion':$('q-type').value),
      order:Number($('q-order').value||0),
      icon:$('q-icon').value.trim(),
      active:$('q-active').value==='true',
      status:$('q-active').value==='true'?'active':'inactive',
      title,titre:title,
      description,desc:description,
      link,lien:link,
      destTitle,dest_titre:destTitle,
      destDesc,dest_desc:destDesc,
      details,
      detail1_cle:details[0]?.key||'', detail1_valeur:details[0]?.value||'',
      detail2_cle:details[1]?.key||'', detail2_valeur:details[1]?.value||'',
      updatedAt:Date.now()
    };
    const ref=(existingKey && !legacyPath) ? db.ref('fts_content/questionnaire/options/'+existingKey) : db.ref('fts_content/questionnaire/options').push();
    if(!existingKey || legacyPath) data.createdAt=Date.now();
    await ref.set(data);
    if(legacyPath) await db.ref(legacyPath).remove();
    $('q-key').value=ref.key;
    $('q-key').dataset.legacy='';
    msg('msg-q','Option enregistrée');
  
  });
}

async function deleteQuestionnaire(){
  return safeAdminAction('deleteQuestionnaire', 'msg-q', async function(){
    const key=$('q-key').value;
    const legacyPath=$('q-key').dataset.legacy||'';
    if(!key || !confirm('Supprimer cette option ?')) return;
    if(legacyPath) await db.ref(legacyPath).remove();
    else await db.ref('fts_content/questionnaire/options/'+key).remove();
    newQuestionnaire();
    msg('msg-q','Option supprimée');
  });
}

/* ═══ CATÉGORIES ══════════════════════════════════════════════ */
async function seedCategoriesIfEmpty(){
  const snap=await db.ref('fts_content/categories').once('value');
  if(snap.exists()) return;
  const upd={};
  (FTS.DEFAULT_CATEGORIES||FTS.CATEGORIES||[]).forEach((c,i)=>{
    const name=c.name||c.category;
    const key=FTS.norm(name);
    upd[key]={name,category:name,icon:c.icon||FTS.catIcon(name),order:c.order||((i+1)*10),active:true,subcats:{},createdAt:Date.now(),updatedAt:Date.now()};
    (c.subcats||[]).forEach(s=>{upd[key].subcats[FTS.norm(s)]={name:s,active:true,updatedAt:Date.now()};});
  });
  await db.ref('fts_content/categories').set(upd);
}
function listenCategories(){
  db.ref('fts_content/categories').on('value', snap=>{
    categoriesRaw=[];
    if(snap.exists()) snap.forEach(c=>{
      const v=c.val()||{};
      let subs=[];
      const raw=v.subcats||v.subcategories||{};
      if(Array.isArray(raw)) raw.forEach(s=>{ if(typeof s==='string') subs.push({name:s,active:true}); else if(s && s.active!==false && (s.name||s.label)) subs.push({name:s.name||s.label,active:true}); });
      else Object.values(raw).forEach(s=>{ if(typeof s==='string') subs.push({name:s,active:true}); else if(s && s.active!==false && (s.name||s.label)) subs.push({name:s.name||s.label,active:true}); });
      categoriesRaw.push({key:c.key,...v,subcatsArray:subs.filter(x=>x.name)});
    });
    categoriesRaw.sort((a,b)=>(a.order||999)-(b.order||999)||(a.name||'').localeCompare(b.name||'', 'fr'));
    categoryStructure=categoriesRaw.filter(c=>c.active!==false).map(c=>({
      key:c.key,
      category:c.name||c.category||c.key,
      name:c.name||c.category||c.key,
      icon:c.icon||c.emoji||FTS.catIcon(c.name||c.category||c.key),
      order:c.order||999,
      active:c.active!==false,
      subs:(c.subcatsArray||[]).filter(s=>s.active!==false)
    }));
    fillCats();
    renderCList();
    // Important : le sélecteur des annonces ciblées dépend des catégories.
    // Sans ce rendu après chargement Firebase, l'admin reste bloqué sur "Chargement des catégories…".
    const currentTargeted = selectedTargetedAnnonce ? targetedAnnonces.find(x => x.key === selectedTargetedAnnonce) : null;
    renderTargetPickers(currentTargeted || { targetCategories: taSelectedCats(), targetGroups: taSelectedGroups() });
  }, err=>console.warn('[FTS Contenus] categories', err));
}
function fillCats(){
  const sel=$('r-cat'); if(!sel) return;
  const current=sel.value;
  sel.innerHTML=(categoryStructure||[]).map(c=>`<option value="${FTS.esc(c.category)}">${FTS.esc(c.icon||FTS.catIcon(c.category))} ${FTS.esc(c.category)}</option>`).join('');
  if(current && [...sel.options].some(o=>o.value===current)) sel.value=current;
  updateResourceSubcats();
}
function updateResourceSubcats(){
  const sub=$('r-subcat'); if(!sub) return;
  const current=sub.value;
  const cat=(categoryStructure||[]).find(c=>c.category===$('r-cat').value);
  sub.innerHTML='<option value="">-- Aucune --</option>'+(((cat&&cat.subs)||[]).map(s=>`<option value="${FTS.esc(s.name)}">${FTS.esc(s.name)}</option>`).join(''));
  if(current && [...sub.options].some(o=>o.value===current)) sub.value=current;
  renderResourcePreview();
}
function renderCList(){
  const el=$('c-list'); if(!el) return;
  const selected=$('c-key')?.value||'';
  el.innerHTML=categoriesRaw.length?categoriesRaw.map(c=>`<div class="item${selected===c.key?' sel':''}" data-fts-click="editCategory('${FTS.esc(c.key)}')"><div class="item-title">${FTS.esc(c.icon||FTS.catIcon(c.name))} ${FTS.esc(c.name||c.category||'Sans nom')}</div><div class="item-meta">${(c.subcatsArray||[]).length} sous-catégorie${(c.subcatsArray||[]).length>1?'s':''} · ${priorityLabel(c.order)}${c.active===false?' · masquée':''}</div></div>`).join(''):'<div class="hint">Aucune catégorie.</div>';
}
function newCategory(){
  ['c-key','c-name','c-icon','c-subcats'].forEach(id=>$(id).value='');
  $('c-order').value='100';
  $('c-active').value='true';
  renderCList();
}
function editCategory(key){
  const c=categoriesRaw.find(x=>x.key===key); if(!c)return;
  $('c-key').value=key;
  $('c-name').value=c.name||c.category||'';
  $('c-icon').value=c.icon||c.emoji||FTS.catIcon(c.name||c.category||'');
  $('c-order').value=normalizePriorityValue(c.order);
  $('c-active').value=String(c.active!==false);
  $('c-subcats').value=(c.subcatsArray||[]).map(s=>s.name).join('\n');
  renderCList();
}
async function saveCategory(){
  return safeAdminAction('saveCategory', 'msg-c', async function(){
    const oldKey=$('c-key').value;
    const name=$('c-name').value.trim();
    if(!name){ msg('msg-c','Nom requis',false); return; }
    const key=FTS.norm(name);
    const lines=$('c-subcats').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const subcats={};
    lines.forEach(x=>subcats[FTS.norm(x)]={name:x,active:true,updatedAt:Date.now()});
    const icon=$('c-icon').value.trim()||FTS.catIcon(name);
    const data={name,category:name,icon,emoji:icon,order:Number($('c-order').value||999),active:$('c-active').value==='true',subcats,updatedAt:Date.now()};
    if(!oldKey) data.createdAt=Date.now();
    const updates={};
    updates['fts_content/categories/'+key]=data;
    if(oldKey&&oldKey!==key) updates['fts_content/categories/'+oldKey]=null;
    await db.ref().update(updates);
    await syncResourcesCategoryRename(oldKey,key,name);
    $('c-key').value=key;
    msg('msg-c','Catégorie enregistrée');
  });
}
async function syncResourcesCategoryRename(oldKey,newKey,newName){
  if(!oldKey || oldKey===newKey) return;
  const snap=await db.ref('fts_ressources').once('value');
  const updates={};
  if(snap.exists()) snap.forEach(ch=>{
    const r=ch.val()||{};
    const cat=r.cat||r.category;
    if(FTS.norm(cat)===oldKey){
      updates['fts_ressources/'+ch.key+'/cat']=newName;
      updates['fts_ressources/'+ch.key+'/category']=newName;
      updates['fts_ressources/'+ch.key+'/updatedAt']=Date.now();
    }
  });
  if(Object.keys(updates).length) await db.ref().update(updates);
}
async function deleteCategory(){
  return safeAdminAction('deleteCategory', 'msg-c', async function(){
    const key=$('c-key').value;
    const name=$('c-name').value.trim();
    if(!key||!name){ msg('msg-c','Sélectionne une catégorie à supprimer',false); return; }
    if(!confirm('Supprimer définitivement cette catégorie ET toutes les ressources liées dans Firebase ?')) return;
    const snap=await db.ref('fts_ressources').once('value');
    const updates={};
    updates['fts_content/categories/'+key]=null;
    if(snap.exists()) snap.forEach(ch=>{
      const r=ch.val()||{};
      const cat=r.cat||r.category;
      if(FTS.norm(cat)===key) updates['fts_ressources/'+ch.key]=null;
    });
    await db.ref().update(updates);
    newCategory();
    msg('msg-c','Catégorie et ressources liées supprimées');
  });
}

/* ═══ RESSOURCES ══════════════════════════════════════════════ */
function normalizeResource(r={},key=''){
  const cat=r.cat||r.category||r.categorie||r.Categorie||'';
  const subcat=r.subcat||r.subcategory||r.sousCategorie||r.sous_categorie||r['Sous-categorie']||r['Sous-catégorie']||'';
  const name=r.name||r.nom||r.Nom||r.titre||r.title||'Sans titre';
  const content=r.content||r.url||r.link||r.lien||r.text||r['Contenu ou Lien Google Drive']||'';
  return {...r,key,cat,category:cat,subcat,subcategory:subcat,name,content,url:content,type:r.type||r.Type||'doc',active:r.active!==false&&r.status!=='inactive'};
}
function listenResources(){
  if(resourceListenerStarted) return;
  resourceListenerStarted=true;
  db.ref('fts_ressources').on('value', snap=>{
    const raw=snap.val()||{};
    resources=Object.keys(raw).map(key=>normalizeResource(raw[key]||{},key));
    resources.sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    renderRList();
    const selected=$('r-key').value;
    if(selected && resources.some(r=>r.key===selected)) editResource(selected);
    else if(resources.length) editResource(resources[0].key);
    else newResource();
  }, err=>{
    console.warn('[FTS Contenus] ressources',err);
    msg('msg-r','Lecture ressources impossible : '+err.message,false);
  });
}
function renderRList(){
  const el=$('r-list'); if(!el) return;
  const selected=$('r-key')?.value||'';
  el.innerHTML=resources.length?resources.map(r=>{ const badge=(r.scriptRehearsal===true||r.scriptRehearsal==='true')?' · 🎭 répétition':''; return `<div class="item${selected===r.key?' sel':''}" data-fts-click="editResource('${FTS.esc(r.key)}')"><div class="item-title">${FTS.esc(r.name||'Sans titre')}</div><div class="item-meta">${FTS.esc(r.cat||r.category||'Sans catégorie')}${r.subcat?' · '+FTS.esc(r.subcat):''} · ${FTS.esc(r.type||'doc')}${badge}${r.active===false||r.status==='inactive'?' · masqué':''}</div></div>`; }).join(''):'<div class="hint">Aucune ressource.</div>';
}
function newResource(){
  ['r-key','r-name','r-url','r-cat-new','r-subcat-new'].forEach(id=>$(id).value='');
  $('r-type').value='pdf';
  $('r-active').value='true';
  if($('r-script-rehearsal')) $('r-script-rehearsal').checked=false;
  fillCats();
  renderRList();
  renderResourcePreview();
}
function editResource(key){
  const r=resources.find(x=>x.key===key); if(!r)return;
  $('r-key').value=key;
  $('r-cat-new').value='';
  $('r-subcat-new').value='';
  fillCats();
  if(r.cat && [...$('r-cat').options].some(o=>o.value===r.cat)) $('r-cat').value=r.cat;
  updateResourceSubcats();
  if(r.subcat && [...$('r-subcat').options].some(o=>o.value===r.subcat)) $('r-subcat').value=r.subcat;
  $('r-type').value=r.type||'doc';
  $('r-active').value=String(r.active!==false && r.status!=='inactive');
  $('r-name').value=r.name||'';
  $('r-url').value=r.url||r.content||r.text||'';
  if($('r-script-rehearsal')) $('r-script-rehearsal').checked=(r.scriptRehearsal===true || r.scriptRehearsal==='true');
  updateScriptRehearsalField();
  renderRList();
  renderResourcePreview();
}
async function saveResource(){
  return safeAdminAction('saveResource', 'msg-r', async function(){
    const key=$('r-key').value;
    const cat=($('r-cat-new').value.trim() || $('r-cat').value || '').trim();
    const subcat=($('r-subcat-new').value.trim() || $('r-subcat').value || '').trim();
    const active=$('r-active').value==='true';
    const content=$('r-url').value.trim();
    const name=$('r-name').value.trim();
    const now=Date.now();
    if(!cat||!name){ msg('msg-r','Catégorie et nom requis',false); return; }
    const scriptRehearsal=($('r-script-rehearsal')?.checked===true) && $('r-type').value==='pdf' && isScriptRehearsalCategory(cat);
    const data={cat,category:cat,subcat,subcategory:subcat,type:$('r-type').value,active,status:active?'active':'inactive',visibility:'members',name,url:content,content,scriptRehearsal,updatedAt:now};
    if(!key) data.createdAt=now;
    const ref=key?db.ref('fts_ressources/'+key):db.ref('fts_ressources').push();
    await ref.update(data);
    if(FTS.ensureResourceCategory) await FTS.ensureResourceCategory(db,data);
    $('r-key').value=ref.key;
    msg('msg-r','Ressource enregistrée');
  });
}
async function deleteResource(){
  return safeAdminAction('deleteResource', 'msg-r', async function(){
    const key=$('r-key').value;
    if(!key || !confirm('Supprimer cette ressource dans Firebase ?')) return;
    await db.ref('fts_ressources/'+key).remove();
    newResource();
    msg('msg-r','Ressource supprimée');
  });
}

init();

/* FTS_AUTO_EXTRACTED_HANDLERS:contenus-admin.html */
(function(){
  'use strict';
  var handlers = [{"selector": "[data-fts-handler-1]", "event": "click", "code": "doLogout()"}, {"selector": "[data-fts-handler-2]", "event": "click", "code": "showTab('annonces',this)"}, {"selector": "[data-fts-handler-3]", "event": "click", "code": "showTab('questionnaire',this)"}, {"selector": "[data-fts-handler-4]", "event": "click", "code": "showTab('ressources',this)"}, {"selector": "[data-fts-handler-5]", "event": "click", "code": "showTab('categories',this)"}, {"selector": "[data-fts-handler-6]", "event": "click", "code": "saveAnnonce()"}, {"selector": "[data-fts-handler-7]", "event": "click", "code": "newQuestionnaire()"}, {"selector": "[data-fts-handler-8]", "event": "click", "code": "saveQuestionnaire()"}, {"selector": "[data-fts-handler-9]", "event": "click", "code": "deleteQuestionnaire()"}, {"selector": "[data-fts-handler-10]", "event": "click", "code": "newResource()"}, {"selector": "[data-fts-handler-11]", "event": "change", "code": "updateResourceSubcats()"}, {"selector": "[data-fts-handler-12]", "event": "click", "code": "saveResource()"}, {"selector": "[data-fts-handler-13]", "event": "click", "code": "deleteResource()"}, {"selector": "[data-fts-handler-14]", "event": "click", "code": "newCategory()"}, {"selector": "[data-fts-handler-15]", "event": "click", "code": "saveCategory()"}, {"selector": "[data-fts-handler-16]", "event": "click", "code": "deleteCategory()"}, {"selector": "[data-fts-handler-17]", "event": "click", "code": "newTargetedAnnonce()"}, {"selector": "[data-fts-handler-18]", "event": "click", "code": "saveTargetedAnnonce()"}, {"selector": "[data-fts-handler-19]", "event": "click", "code": "deleteTargetedAnnonce()"}];
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
