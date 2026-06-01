/* ================================================================
   PAGE MODULE — SAISON-ADMIN
   Extrait depuis saison-admin.html pour supprimer le JavaScript inline.
   ================================================================ */

const DEFAULT_SAISON={meta:{eyebrow:"Association culturelle",title:"SAISON",year:"2026/2027",slogan:"Deux parcours, une passion — trouvez votre place sur scène"},parcoursIntro:[{key:"loisir",icon:"🎈",tag:"Parcours Loisir",title:"À ton rythme",desc:"1 cours hebdomadaire pour découvrir, s'amuser et progresser librement."},{key:"perf",icon:"🚀",tag:"Parcours Performance",title:"Aller plus loin",desc:"Plus de technique, plusieurs spectacles dans l'année — et l'Atelier Improvisation offert toute l'année."}],inscriptionDefault:"",paymentOptions:{allowedPlans:[1,3,5,10],firstInstallmentPercents:{"1":100,"3":33.33,"5":30,"10":25},installmentDay:10},items:[]};
let db,auth,saison=JSON.parse(JSON.stringify(DEFAULT_SAISON)),selectedIndex=0,loadedCategories=[],isPublishingSeason=false;
const FALLBACK_ITEMS=[
{id:"theatre",active:true,order:10,icon:"🎭",name:"Théâtre",subtitle:"Mercredi · Lundi",badge:"",offers:[{key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours hebdomadaire le <strong>mercredi</strong>.",bullets:["Plusieurs ateliers de théâtre dans la saison inclus","Plusieurs ateliers d'expression corporelle inclus"],price:"270€",priceNote:"Tarif saison",link:""},{key:"perf",label:"🚀 Performance",style:"perf",main:"1 cours hebdomadaire le <strong>mercredi</strong> + entraînements supplémentaires.",bullets:["Nouveau : entraînement jeudi dès octobre","Atelier Improvisation offert toute l'année"],price:"",priceNote:"Tarif à compléter",link:""}]},
{id:"danse",active:true,order:20,icon:"💃",name:"Danse",subtitle:"Mardi · Jeudi",badge:"",offers:[{key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours hebdomadaire. Groupes : Baby Show, Junior, Ados/Adultes.",bullets:[],price:"180€ / 200€",priceNote:"Enfants : 180€ · Adultes : 200€",link:""}]},
{id:"musique",active:true,order:30,icon:"🎸",name:"Musique & Chant",subtitle:"Individuel + ateliers",badge:"",offers:[{key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours individuel hebdomadaire.",bullets:[],price:"500€",priceNote:"Instrumental / chant + cours individuels",link:""}]},
{id:"singer",active:true,order:40,icon:"🎶",name:"Singer Academy",subtitle:"Vendredi · Mercredi",badge:"",offers:[{key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours de base le vendredi soir.",bullets:[],price:"270€",priceNote:"Tarif saison",link:""}]},
{id:"comedie",active:true,order:50,icon:"🎬",name:"Comédie Musicale",subtitle:"Tous âges",badge:"",offers:[{key:"loisir",label:"🎭 Kids / Loisir",style:"loisir",main:"1 cours hebdomadaire adapté à l'âge.",bullets:[],price:"350€",priceNote:"Tarif saison",link:""}]},
{id:"formation",active:true,order:70,icon:"🎼",name:"Formation Musicale",subtitle:"Option Musique & Chant",badge:"",offers:[{key:"option",label:"🎼 Option",style:"option",main:"Option payante en supplément, réservée aux élèves déjà inscrits en Musique & Chant.",bullets:[],price:"150€",priceNote:"Tarif saison",link:""}]},
{id:"atelier",active:true,order:80,icon:"🎨",name:"Atelier Créatif",subtitle:"Inclus Performance",badge:"Offert",offers:[{key:"inclus",label:"🎁 Inclus",style:"option",main:"Inclus automatiquement dans tous les Parcours Performance.",bullets:["Offert toute l'année pour tous les élèves Performance"],price:"160€",priceNote:"Tarif atelier seul — offert en Performance",link:""}]}
];
function ensureData(){if(!saison.items||!saison.items.length)saison.items=JSON.parse(JSON.stringify(FALLBACK_ITEMS));ensurePaymentOptions();}
function defaultFirstInstallmentPercent(plan){
  const n=Number(plan)||1;
  if(n<=1)return 100;
  if(n===3)return 33.33;
  if(n===5)return 30;
  if(n===10)return 25;
  return Math.round((100/n)*100)/100;
}
function ensurePaymentOptions(){
  const p=saison.paymentOptions&&typeof saison.paymentOptions==='object'?saison.paymentOptions:{};
  let plans=Array.isArray(p.allowedPlans)?p.allowedPlans.map(n=>Number(n)).filter(n=>Number.isFinite(n)&&n>=1&&n<=12):[1,3,5,10];
  if(!plans.includes(1))plans.unshift(1);
  plans=Array.from(new Set(plans)).sort((a,b)=>a-b);
  const legacy=Number(p.firstInstallmentPercent);
  const percents=(p.firstInstallmentPercents&&typeof p.firstInstallmentPercents==='object')?p.firstInstallmentPercents:{};
  const cleanPercents={};
  for(let n=1;n<=12;n++){
    let v=Number(percents[String(n)]);
    if(!Number.isFinite(v)&&n!==1&&Number.isFinite(legacy)&&legacy>0)v=legacy;
    if(!Number.isFinite(v)||v<=0||v>100)v=defaultFirstInstallmentPercent(n);
    if(n===1)v=100;
    cleanPercents[String(n)]=Math.round(v*100)/100;
  }
  let day=Number(p.installmentDay);
  if(!Number.isFinite(day)||day<1||day>27)day=10;
  saison.paymentOptions={allowedPlans:plans,firstInstallmentPercents:cleanPercents,firstInstallmentPercent:cleanPercents['3']||25,installmentDay:Math.round(day)};
}
function formatEurosFromCents(cents){return (Math.round(Number(cents||0))/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});}
function splitRemainderAdmin(amount,count){
  if(!count)return[];
  const base=Math.floor(amount/count), rest=amount-base*count;
  return Array.from({length:count},(_,i)=>base+(i<rest?1:0));
}
function schedulePreviewAdmin(totalCents,plan,percent){
  const n=Number(plan)||1;
  if(n<=1)return{first:totalCents,rest:[],label:formatEurosFromCents(totalCents)};
  const pct=Math.min(100,Math.max(1,Number(percent)||defaultFirstInstallmentPercent(n)));
  const first=Math.max(100,Math.ceil(totalCents*pct/100));
  const rest=splitRemainderAdmin(Math.max(0,totalCents-first),n-1);
  const uniq=Array.from(new Set(rest));
  const label=uniq.length===1?`${formatEurosFromCents(first)} puis ${n-1} × ${formatEurosFromCents(uniq[0])}`:`${formatEurosFromCents(first)} puis ${rest.map(formatEurosFromCents).join(' / ')}`;
  return{first,rest,label};
}
function getSeasonPreviewAmountCents(){
  const amountInput=document.getElementById('season-preview-amount');
  return Math.max(0,Math.round(Number(amountInput&&amountInput.value||400)*100));
}
function parsePercentInputValue(value,plan,mode){
  const n=Number(plan)||1;
  if(n===1)return 100;
  const raw=String(value==null?'':value).trim().replace(',', '.');
  if(raw==='')return mode==='fallback'?defaultFirstInstallmentPercent(n):null;
  const v=Number(raw);
  if(!Number.isFinite(v))return mode==='fallback'?defaultFirstInstallmentPercent(n):null;
  return Math.min(100,Math.max(1,Math.round(v*100)/100));
}
function updatePaymentPlanPreviews(){
  const table=document.getElementById('season-plan-table');
  if(!table)return;
  const amountCents=getSeasonPreviewAmountCents();
  const head=table.querySelector('.season-plan-head span:last-child');
  if(head)head.textContent='Aperçu sur '+formatEurosFromCents(amountCents);
  table.querySelectorAll('.season-plan-row').forEach(row=>{
    const input=row.querySelector('[data-plan-percent]');
    const preview=row.querySelector('.season-plan-preview');
    if(!input||!preview)return;
    const n=Number(input.getAttribute('data-plan-percent'))||1;
    const percent=parsePercentInputValue(input.value,n,'fallback');
    preview.textContent=schedulePreviewAdmin(amountCents,n,percent).label;
  });
}
function renderPaymentOptions(){
  ensurePaymentOptions();
  const table=document.getElementById('season-plan-table');
  if(!table)return;
  const allowed=new Set((saison.paymentOptions.allowedPlans||[]).map(Number));
  const amountInput=document.getElementById('season-preview-amount');
  const amountCents=getSeasonPreviewAmountCents();
  table.innerHTML='<div class="season-plan-head"><span>Actif</span><span>Paiement</span><span>1ère échéance</span><span>Aperçu sur '+formatEurosFromCents(amountCents)+'</span></div>'+Array.from({length:12},(_,i)=>i+1).map(n=>{
    const percent=saison.paymentOptions.firstInstallmentPercents[String(n)]||defaultFirstInstallmentPercent(n);
    const prev=schedulePreviewAdmin(amountCents,n,percent);
    return `<div class="season-plan-row ${allowed.has(n)?'is-active':'is-muted'}"><label class="season-plan-check"><input type="checkbox" value="${n}" ${allowed.has(n)?'checked':''} ${n===1?'disabled':''}> <span>${n} fois</span></label><div>${n===1?'Paiement complet':'Paiement en '+n+' fois'}</div><label class="season-percent-field"><input type="text" inputmode="decimal" autocomplete="off" data-plan-percent="${n}" value="${percent}" ${n===1?'disabled':''}> <span>%</span></label><div class="season-plan-preview">${prev.label}</div></div>`;
  }).join('');
  table.querySelectorAll('input[type="checkbox"]').forEach(el=>el.addEventListener('change',()=>readPaymentOptions(true)));
  table.querySelectorAll('[data-plan-percent]').forEach(el=>{
    el.addEventListener('input',()=>readPaymentOptions(false));
    el.addEventListener('blur',()=>readPaymentOptions(false));
  });
  const day=document.getElementById('season-installment-day');
  if(day){day.value=saison.paymentOptions.installmentDay;if(!day.__ftsBound){day.__ftsBound=true;day.addEventListener('input',()=>readPaymentOptions(false));}}
  if(amountInput&&!amountInput.__ftsBound){amountInput.__ftsBound=true;amountInput.addEventListener('input',updatePaymentPlanPreviews);}
}
function readPaymentOptions(shouldRender=true){
  const checked=Array.from(document.querySelectorAll('#season-plan-table input[type="checkbox"]:checked')).map(el=>Number(el.value)).filter(n=>Number.isFinite(n)&&n>=1&&n<=12);
  if(!checked.includes(1))checked.unshift(1);
  const percents={};
  document.querySelectorAll('#season-plan-table [data-plan-percent]').forEach(el=>{
    const n=String(el.getAttribute('data-plan-percent'));
    const parsed=parsePercentInputValue(el.value,n,'strict');
    if(parsed!==null)percents[n]=parsed;
  });
  for(let n=1;n<=12;n++){if(!percents[String(n)])percents[String(n)]=defaultFirstInstallmentPercent(n);}
  let day=Number(document.getElementById('season-installment-day')?.value||10);
  if(!Number.isFinite(day)||day<1)day=1;
  if(day>27)day=27;
  saison.paymentOptions={allowedPlans:Array.from(new Set(checked)).sort((a,b)=>a-b),firstInstallmentPercents:percents,firstInstallmentPercent:percents['3']||25,installmentDay:Math.round(day)};
  if(shouldRender)renderPaymentOptions();
  else updatePaymentPlanPreviews();
}
function seasonNorm(value){return (FTS.norm?FTS.norm(value||''):String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));}
function seasonDefaultOfferForCategory(cat){
  const label=cat && (cat.name||cat.category) ? (cat.name||cat.category) : 'Activité';
  return {key:'loisir',label:'🎈 Loisir',style:'loisir',main:'Informations à compléter pour <strong>'+FTS.esc(label)+'</strong>.',bullets:[],price:'',priceNote:'Tarif à compléter',link:''};
}
function seasonSubtitleFromCategory(cat){
  const subs=Array.isArray(cat&&cat.subs)?cat.subs.filter(s=>s&&s.active!==false&&s.name):[];
  if(subs.length) return subs.length+' groupe'+(subs.length>1?'s':'');
  return '';
}
function seasonFindItemForCategory(cat){
  if(!cat||!saison||!Array.isArray(saison.items)) return null;
  const key=seasonNorm(cat.key||cat.name||cat.category);
  const name=seasonNorm(cat.name||cat.category||cat.key);
  const aliases={
    comedie_musicale:['comedie','comedie_musicale'],
    comedie:['comedie','comedie_musicale'],
    singer_academy:['singer','singer_academy'],
    singer:['singer','singer_academy'],
    singer_show:['singershow','singer_show'],
    musique:['musique','musique_chant'],
    chant:['chant','musique','musique_chant'],
    theatre:['theatre'],
    danse:['danse'],
    atelier:['atelier','atelier_creatif'],
    formation_musicale:['formation','formation_musicale'],
    magie:['magie']
  };
  const candidates=[key,name].concat(aliases[key]||[],aliases[name]||[]).filter(Boolean);
  return saison.items.find(it=>candidates.includes(seasonNorm(it.id))||candidates.includes(seasonNorm(it.name))||seasonNorm(it.name)===name)||null;
}
function syncSeasonWithOfficialCategories(){
  const cats=(loadedCategories||[]).filter(c=>c&&c.active!==false&&(c.name||c.category||c.key));
  if(!saison.items) saison.items=[];
  let added=0;
  cats.forEach(cat=>{
    const existing=seasonFindItemForCategory(cat);
    if(existing){
      existing.officialCategoryKey=existing.officialCategoryKey||cat.key||seasonNorm(cat.name||cat.category);
      existing.officialCategoryName=existing.officialCategoryName||cat.name||cat.category||cat.key;
      if(!existing.icon) existing.icon=cat.icon||FTS.catIcon(cat.name||cat.category);
      if(!existing.name) existing.name=cat.name||cat.category||cat.key;
      if(!existing.subtitle) existing.subtitle=seasonSubtitleFromCategory(cat);
      if(!Array.isArray(existing.offers)||!existing.offers.length) existing.offers=[seasonDefaultOfferForCategory(cat)];
      return;
    }
    const id=cat.key||seasonNorm(cat.name||cat.category)||('categorie_'+Date.now()+'_'+added);
    saison.items.push({
      id,
      officialCategoryKey:cat.key||id,
      officialCategoryName:cat.name||cat.category||id,
      active:true,
      order:Number(cat.order||999),
      icon:cat.icon||FTS.catIcon(cat.name||cat.category)||'🎭',
      name:cat.name||cat.category||id,
      subtitle:seasonSubtitleFromCategory(cat),
      badge:'',
      offers:[seasonDefaultOfferForCategory(cat)]
    });
    added++;
  });
  return added;
}
function init(){db=FTS.initFirebase();auth=firebase.auth();auth.onAuthStateChanged(async user=>{if(!user){location.href='auth.html';return}const snap=await db.ref('fts_users/'+user.uid).once('value');const profile=snap.val();const role=String(profile&&profile.role||'').toLowerCase();const status=String(profile&&profile.status||'').toLowerCase();if(!profile||status!=='active'){await auth.signOut();location.href='auth.html';return}if(role!=='admin'){location.href='membres.html';return}document.getElementById('auth-loading').style.display='none';document.getElementById('admin-shell').style.display='block';loadedCategories=await FTS.getCategoryStructureAsync(db);await load();});}
async function load(){const snap=await db.ref('fts_saison/config').once('value');if(snap.val())saison=snap.val();ensureData();const added=syncSeasonWithOfficialCategories();bindMeta();renderPaymentOptions();renderList();selectActivity(0);if(added)showMsg('ok',added+' catégorie(s) officielle(s) ajoutée(s) dans Saison. Ajoute les tarifs puis clique sur Publier.')}
function bindMeta(){document.getElementById('m-title').value=saison.meta?.title||'';document.getElementById('m-year').value=saison.meta?.year||'';document.getElementById('m-slogan').value=saison.meta?.slogan||'';document.getElementById('m-link').value=saison.inscriptionDefault||'';['m-title','m-year','m-slogan','m-link'].forEach(id=>document.getElementById(id).addEventListener('input', readMeta))}
function readMeta(){saison.meta=saison.meta||{};saison.meta.title=document.getElementById('m-title').value;saison.meta.year=document.getElementById('m-year').value;saison.meta.slogan=document.getElementById('m-slogan').value;saison.inscriptionDefault=document.getElementById('m-link').value}
function sortedItems(){return saison.items.map((it,i)=>({...it,_i:i})).sort((a,b)=>(+a.order||0)-(+b.order||0))}
function renderList(){document.getElementById('activity-list').innerHTML=sortedItems().map(it=>{const hasPrice=(it.offers||[]).some(o=>String(o&&o.price||'').trim());const meta=[it.subtitle||'',(it.offers?.length||0)+' formule(s)',hasPrice?'tarif OK':'tarif à compléter'].filter(Boolean).join(' · ');return `<div class="act-row ${it._i===selectedIndex?'sel':''} ${!hasPrice?'needs-price':''}" data-fts-click="selectActivity(${it._i})"><div class="act-ico">${FTS.esc(it.icon||'🎭')}</div><div class="act-info"><div class="act-name">${FTS.esc(it.name||'Sans titre')}</div><div class="act-meta">${FTS.esc(meta)}</div></div><div class="status-dot ${it.active===false?'off':''}">●</div></div>`}).join('')}
function selectActivity(i){selectedIndex=i;renderList();const a=saison.items[i];document.getElementById('empty-edit').style.display=a?'none':'block';document.getElementById('editor').style.display=a?'block':'none';if(!a)return;document.getElementById('a-name').value=a.name||'';document.getElementById('a-icon').value=a.icon||'';document.getElementById('a-subtitle').value=a.subtitle||'';document.getElementById('a-badge').value=a.badge||'';document.getElementById('a-order').value=a.order||0;document.getElementById('a-active').value=String(a.active!==false);['a-name','a-icon','a-subtitle','a-badge','a-order','a-active'].forEach(id=>{const el=document.getElementById(id);if(!el.__ftsSeasonBound){el.__ftsSeasonBound=true;el.addEventListener('input', readActivity);el.addEventListener('change', readActivity);}});renderCategoryHelper();renderOffers();renderPreview()}
function readActivity(){const a=saison.items[selectedIndex];if(!a)return;a.name=document.getElementById('a-name').value;a.icon=document.getElementById('a-icon').value;a.subtitle=document.getElementById('a-subtitle').value;a.badge=document.getElementById('a-badge').value;a.order=Number(document.getElementById('a-order').value||0);a.active=document.getElementById('a-active').value==='true';renderList();renderPreview()}
function renderOffers(){const a=saison.items[selectedIndex];document.getElementById('offers').innerHTML=(a.offers||[]).map((o,idx)=>`<div class="offer-card modern-offer"><div class="offer-head"><div><div class="offer-title">Formule ${idx+1}</div><div class="offer-subtitle">Bloc affiché quand l’utilisateur ouvre l’activité sur saison.html</div></div><button class="btn-outline danger" data-fts-click="deleteOffer(${idx})">Supprimer</button></div><div class="form-grid modern-form"><div class="field"><label>Identifiant interne</label><input value="${FTS.esc(o.key||'')}" data-fts-input="setOffer(${idx},'key',this.value)" placeholder="loisir, perf, option"><small>Technique : sert à ouvrir le bon onglet. Évite les espaces.</small></div><div class="field"><label>Nom du bouton / onglet</label><input value="${FTS.esc(o.label||'')}" data-fts-input="setOffer(${idx},'label',this.value)" placeholder="🎈 Loisir"><small>Texte visible par les familles.</small></div><div class="field"><label>Couleur du parcours</label><select data-fts-change="setOffer(${idx},'style',this.value)"><option ${o.style==='loisir'?'selected':''} value="loisir">Loisir</option><option ${o.style==='perf'?'selected':''} value="perf">Performance</option><option ${o.style==='option'?'selected':''} value="option">Option</option></select><small>Change seulement le style visuel.</small></div><div class="field"><label>Tarif affiché</label><input value="${FTS.esc(o.price||'')}" data-fts-input="setOffer(${idx},'price',this.value)" placeholder="270€, 180€ / 200€…"><small>Visible dans le bloc d’inscription.</small></div><div class="field full"><label>Lien d’inscription spécifique</label><input value="${FTS.esc(o.link||'')}" data-fts-input="setOffer(${idx},'link',this.value)" placeholder="Vide = lien par défaut"><small>Laisse vide si cette formule utilise le lien général.</small></div><div class="field full"><label>Texte principal de la formule</label><textarea data-fts-input="setOffer(${idx},'main',this.value)" placeholder="1 cours hebdomadaire…">${FTS.esc(o.main||'')}</textarea><small>Accepte le HTML déjà utilisé, par exemple &lt;strong&gt;mercredi&lt;/strong&gt;.</small></div><div class="field full"><label>Points inclus / avantages</label><textarea data-fts-input="setOfferBullets(${idx},this.value)" placeholder="Une ligne = un avantage">${FTS.esc((o.bullets||[]).join('\n'))}</textarea><small>Chaque ligne devient une coche sur la page publique.</small></div><div class="field full"><label>Petite note sous le tarif</label><input value="${FTS.esc(o.priceNote||'')}" data-fts-input="setOffer(${idx},'priceNote',this.value)" placeholder="Tarif saison, adhésion comprise…"><small>Précision rassurante affichée sous le prix.</small></div></div></div>`).join('');renderPreview()}
function setOffer(i,k,v){saison.items[selectedIndex].offers[i][k]=v;renderPreview()}
function setOfferBullets(i,v){saison.items[selectedIndex].offers[i].bullets=v.split('\n').map(x=>x.trim()).filter(Boolean);renderPreview()}
function addOffer(){const a=saison.items[selectedIndex];a.offers=a.offers||[];a.offers.push({key:'nouvelle',label:'Nouvelle formule',style:'option',main:'',bullets:[],price:'',priceNote:'',link:''});renderOffers();renderList();renderPreview()}
function deleteOffer(i){if(!confirm('Supprimer cette formule ?'))return;saison.items[selectedIndex].offers.splice(i,1);renderOffers();renderList();renderPreview()}
function addActivity(){saison.items.push({id:'activite_'+Date.now(),active:true,order:99,icon:'🎭',name:'Nouvelle activité',subtitle:'',badge:'',offers:[{key:'formule',label:'Formule',style:'option',main:'',bullets:[],price:'',priceNote:'',link:''}]});selectActivity(saison.items.length-1)}
function deleteActivity(){if(!confirm('Supprimer cette activité ?'))return;saison.items.splice(selectedIndex,1);selectedIndex=0;renderList();selectActivity(0)}

function renderCategoryHelper(){
  const wrap=document.getElementById('season-cat-helper');
  if(!wrap)return;
  const cats=(loadedCategories||[]).filter(c=>c&&c.name);
  if(!cats.length){wrap.innerHTML='';return;}
  const a=saison.items[selectedIndex]||{};
  const linkedKey=a.officialCategoryKey||'';
  wrap.innerHTML='<div class="helper-title">Catégories officielles synchronisées</div><div class="helper-text">Les activités viennent de <strong>Admin contenus &gt; Catégories officielles</strong>. Si tu ajoutes Magie là-bas, elle apparaît ici automatiquement avec un tarif à compléter. Après modification du prix, clique sur <strong>Publier</strong>.</div>'+(linkedKey?'<div class="season-sync-badge">Reliée à : '+FTS.esc(a.officialCategoryName||linkedKey)+'</div>':'')+'<div class="season-cat-pills">'+cats.map((c,idx)=>'<button type="button" class="season-cat-pill" data-fts-click="applyCategoryPreset('+idx+')"><span>'+(c.icon||FTS.catIcon(c.name)||'🎭')+'</span>'+FTS.esc(c.name)+'</button>').join('')+'</div>';
}
function applyCategoryPreset(idx){
  const cat=(loadedCategories||[])[idx];
  const a=saison.items[selectedIndex];
  if(!cat||!a)return;
  a.name=cat.name||a.name;
  a.icon=cat.icon||FTS.catIcon(cat.name)||a.icon;
  a.officialCategoryKey=cat.key||a.officialCategoryKey||seasonNorm(cat.name);
  a.officialCategoryName=cat.name||a.officialCategoryName||'';
  if(!a.subtitle) a.subtitle=seasonSubtitleFromCategory(cat);
  document.getElementById('a-name').value=a.name||'';
  document.getElementById('a-icon').value=a.icon||'';
  renderList();
  renderPreview();
}
function renderPreview(){
  const box=document.getElementById('saison-preview');
  const a=saison.items[selectedIndex];
  if(!box||!a){return;}
  const offers=Array.isArray(a.offers)?a.offers:[];
  const offersHtml=offers.length
    ? offers.map((offer,idx)=>'<div class="offer-preview"><div class="preview-offer-label">Formule '+(idx+1)+' · '+FTS.esc(offer.label||'Formule')+'</div><div class="preview-offer-main">'+(offer.main||'Description de la formule')+'</div><div class="preview-price">'+FTS.esc(offer.price||'Tarif à venir')+'</div>'+(offer.priceNote?'<div class="preview-price-note">'+FTS.esc(offer.priceNote)+'</div>':'')+'</div>').join('')
    : '<div class="offer-preview"><div class="preview-offer-label">Aucune formule</div><div class="preview-offer-main">Ajoute une formule pour voir l’aperçu public.</div></div>';
  box.innerHTML='<div class="preview-title">Aperçu public</div><div class="public-tile-preview"><div class="preview-icon">'+FTS.esc(a.icon||'🎭')+'</div><div><div class="preview-name">'+FTS.esc(a.name||'Sans titre')+'</div><div class="preview-sub">'+FTS.esc(a.subtitle||'Sous-titre')+'</div>'+(a.badge?'<div class="preview-badge">'+FTS.esc(a.badge)+'</div>':'')+'</div><span class="preview-status '+(a.active===false?'off':'')+'">'+(a.active===false?'Brouillon':'Visible')+'</span></div><div class="preview-offers-list">'+offersHtml+'</div>';
}

async function saveAll(){
  if(isPublishingSeason) return;
  isPublishingSeason = true;
  try{
    readMeta();
    readPaymentOptions();
    readActivity();
    syncSeasonWithOfficialCategories();
    await db.ref('fts_saison/config').set({...saison,updatedAt:Date.now()});
    showMsg('ok','Saison publiée. La page publique se mettra à jour automatiquement.');
  }catch(e){
    showMsg('err','Erreur publication : '+(e && e.message ? e.message : e));
  }finally{
    isPublishingSeason = false;
  }
}
function exportJson(){readMeta();document.getElementById('json-area').value=JSON.stringify(saison,null,2);showMsg('ok','Export JSON généré.')}
function currentActivityImportKey(){
  const a=saison&&Array.isArray(saison.items)?saison.items[selectedIndex]:null;
  if(!a)return'';
  return String(a.id||a.officialCategoryKey||a.name||'');
}
function findActivityIndexAfterImport(wanted){
  const key=seasonNorm(wanted||'');
  if(!key||!saison||!Array.isArray(saison.items))return 0;
  const idx=saison.items.findIndex(it=>{
    const values=[it&&it.id,it&&it.officialCategoryKey,it&&it.name,it&&it.officialCategoryName].map(seasonNorm);
    return values.includes(key);
  });
  return idx>=0?idx:0;
}
function selectedActivityPriceSummary(){
  const a=saison&&Array.isArray(saison.items)?saison.items[selectedIndex]:null;
  const prices=(a&&Array.isArray(a.offers)?a.offers:[]).map(o=>String(o&&o.price||'').trim()).filter(Boolean);
  return prices.length?prices.join(' / '):'tarif vide';
}
function importJson(){
  try{
    if(!confirm('Importer ce JSON dans l’éditeur ? Les modifications non publiées seront remplacées.'))return;
    const area=document.getElementById('json-area');
    const wanted=currentActivityImportKey();
    const parsed=JSON.parse(area.value);
    if(!parsed||typeof parsed!=='object')throw new Error('Le JSON doit être un objet Saison.');
    saison=parsed;
    ensureData();
    syncSeasonWithOfficialCategories();
    bindMeta();
    renderPaymentOptions();
    renderList();
    selectActivity(findActivityIndexAfterImport(wanted));
    area.value=JSON.stringify(saison,null,2);
    showMsg('ok','JSON importé dans l’éditeur. Activité affichée : '+((saison.items[selectedIndex]&&saison.items[selectedIndex].name)||'')+' · '+selectedActivityPriceSummary()+'. Clique sur Publier pour l’envoyer en ligne.');
  }catch(e){
    showMsg('err','JSON invalide : '+e.message);
  }
}
function showMsg(cls,txt){const m=document.getElementById('msg');m.className='msg '+cls;m.textContent=txt;setTimeout(()=>m.className='msg',4500)}function doLogout(){firebase.auth().signOut().then(()=>location.href='auth.html')}

/* ── Options liées Saison — constructeur simple ─────────────────── */
function seasonAdminSubEntries(cat){
  const raw=cat&&(cat.subcats||cat.subcategories||cat.subs)||{};
  if(Array.isArray(raw))return raw.map((v,i)=>[String(i),v]);
  return Object.entries(raw||{});
}
function seasonAdminSubInfo(key,val){
  const sub=typeof val==='object'&&val?val:{name:String(val||key)};
  if(sub.active===false)return null;
  const label=sub.name||sub.label||sub.title||sub.key||sub.id||key;
  const id=sub.key||sub.id||key||seasonNorm(label);
  return {key:String(id||'principal'),label:String(label||'Groupe principal'),active:true};
}
function seasonAdminCatalog(){
  const rows=[];
  (loadedCategories||[]).forEach(cat=>{
    const catId=cat.key||cat.id||seasonNorm(cat.name||cat.category||'');
    const catLabel=cat.name||cat.category||cat.label||catId;
    seasonAdminSubEntries(cat).forEach(([key,val])=>{
      const sub=seasonAdminSubInfo(key,val);
      if(!sub)return;
      rows.push({categoryId:catId,categoryLabel:catLabel,subcategoryId:sub.key,subcategoryLabel:sub.label,label:catLabel+' — '+sub.label});
    });
  });
  if(!rows.length){
    (saison.items||[]).forEach(it=>rows.push({categoryId:it.id,categoryLabel:it.name||it.id,subcategoryId:'principal',subcategoryLabel:'Groupe principal',label:(it.name||it.id)+' — Groupe principal'}));
  }
  return rows.sort((a,b)=>a.label.localeCompare(b.label,'fr'));
}
function selectedActivitySubcatsAdmin(){
  const a=saison.items[selectedIndex]||{};
  const key=a.officialCategoryKey||a.id||seasonNorm(a.name||'');
  const cat=(loadedCategories||[]).find(c=>seasonNorm(c.key||c.id||c.name||c.category)===seasonNorm(key)||seasonNorm(c.name||c.category)===seasonNorm(a.name));
  return seasonAdminSubEntries(cat).map(([k,v])=>seasonAdminSubInfo(k,v)).filter(Boolean);
}
function ensureOfferLinkedOptions(offer){if(!Array.isArray(offer.linkedOptions))offer.linkedOptions=[];return offer.linkedOptions;}
function linkedRuleLabel(rule){
  const type=rule.type==='paid'?'payante':'incluse';
  const max=Number(rule.maxChoices||1)||1;
  const req=rule.required?'obligatoire':'facultative';
  return `${type} · ${req} · ${max} choix max`;
}
function renderOfferLinkedOptions(offerIndex,offer){
  const rules=ensureOfferLinkedOptions(offer);
  const catalog=seasonAdminCatalog();
  const subcats=selectedActivitySubcatsAdmin();
  return `<div class="linked-options-admin"><div class="linked-head"><div><strong>Options liées à cette formule</strong><small>Choix inclus, options payantes, prix fixe ou prix Saison. Les choix viennent des catégories/sous-catégories existantes.</small></div><button type="button" class="btn-outline" data-fts-click="addLinkedOptionRule(${offerIndex})">+ Ajouter une règle</button></div>${rules.length?rules.map((r,ri)=>`<div class="linked-rule"><div class="linked-rule-title"><div><strong>${FTS.esc(r.label||'Option liée')}</strong><small>${FTS.esc(linkedRuleLabel(r))}</small></div><button type="button" class="btn-outline danger" data-fts-click="deleteLinkedOptionRule(${offerIndex},${ri})">Supprimer</button></div><div class="form-grid modern-form linked-grid"><div class="field full"><label>Titre affiché</label><input value="${FTS.esc(r.label||'')}" data-fts-input="setLinkedOptionRule(${offerIndex},${ri},'label',this.value)" placeholder="Choisis ton cours complémentaire"></div><div class="field"><label>Type</label><select data-fts-change="setLinkedOptionRule(${offerIndex},${ri},'type',this.value)"><option value="included" ${r.type!=='paid'?'selected':''}>Incluse / offerte</option><option value="paid" ${r.type==='paid'?'selected':''}>Option payante</option></select></div><div class="field"><label>Obligatoire</label><select data-fts-change="setLinkedOptionRule(${offerIndex},${ri},'required',this.value==='true')"><option value="false" ${!r.required?'selected':''}>Non</option><option value="true" ${r.required?'selected':''}>Oui</option></select></div><div class="field"><label>Nombre max de choix</label><select data-fts-change="setLinkedOptionRule(${offerIndex},${ri},'maxChoices',Number(this.value))">${[1,2,3].map(n=>`<option value="${n}" ${Number(r.maxChoices||1)===n?'selected':''}>${n}</option>`).join('')}</select></div><div class="field"><label>Prix</label><select data-fts-change="setLinkedOptionRule(${offerIndex},${ri},'pricingMode',this.value)"><option value="free" ${(r.pricingMode||'free')==='free'?'selected':''}>0€ / inclus</option><option value="season_price" ${r.pricingMode==='season_price'?'selected':''}>Prix Saison du cours choisi</option><option value="fixed" ${r.pricingMode==='fixed'?'selected':''}>Prix fixe défini ici</option></select></div><div class="field"><label>Prix fixe en €</label><input type="number" min="0" step="1" value="${Number(r.priceCents||0)/100||''}" data-fts-input="setLinkedOptionFixedPrice(${offerIndex},${ri},this.value)" placeholder="Ex : 120"></div></div><div class="linked-split"><div><div class="linked-mini-title">Groupes concernés par cette règle</div><small>Laisse vide = tous les groupes de cette formule.</small><div class="linked-checks">${subcats.map(s=>`<label><input type="checkbox" ${Array.isArray(r.subcategoryIds)&&r.subcategoryIds.includes(s.key)?'checked':''} data-fts-change="toggleLinkedRuleSubcat(${offerIndex},${ri},'${FTS.esc(String(s.key))}',this.checked)"> ${FTS.esc(s.label)}</label>`).join('')||'<em>Aucun groupe détecté.</em>'}</div></div><div><div class="linked-mini-title">Cours proposés dans la liste</div><small>La capacité sera décomptée sur le cours choisi.</small><div class="linked-checks linked-course-checks">${catalog.map(c=>{const on=(r.choices||[]).some(ch=>ch.categoryId===c.categoryId&&ch.subcategoryId===c.subcategoryId);return `<label><input type="checkbox" ${on?'checked':''} data-fts-change="toggleLinkedRuleChoice(${offerIndex},${ri},'${FTS.esc(c.categoryId)}','${FTS.esc(c.subcategoryId)}',this.checked)"> ${FTS.esc(c.label)}</label>`;}).join('')}</div></div></div></div>`).join(''):'<div class="linked-empty">Aucune option liée pour cette formule.</div>'}</div>`;
}
function addLinkedOptionRule(offerIndex){const offer=saison.items[selectedIndex].offers[offerIndex];ensureOfferLinkedOptions(offer).push({id:'opt_'+Date.now().toString(36),active:true,label:'Option liée',type:'included',required:false,maxChoices:1,pricingMode:'free',priceCents:0,subcategoryIds:[],choices:[]});renderOffers();}
function deleteLinkedOptionRule(offerIndex,ruleIndex){if(!confirm('Supprimer cette règle d’option ?'))return;ensureOfferLinkedOptions(saison.items[selectedIndex].offers[offerIndex]).splice(ruleIndex,1);renderOffers();}
function setLinkedOptionRule(offerIndex,ruleIndex,key,value){const r=ensureOfferLinkedOptions(saison.items[selectedIndex].offers[offerIndex])[ruleIndex];if(!r)return;r[key]=value;renderPreview();}
function setLinkedOptionFixedPrice(offerIndex,ruleIndex,value){const r=ensureOfferLinkedOptions(saison.items[selectedIndex].offers[offerIndex])[ruleIndex];if(!r)return;r.priceCents=Math.max(0,Math.round(Number(value||0)*100)||0);renderPreview();}
function toggleLinkedRuleSubcat(offerIndex,ruleIndex,subcatId,checked){const r=ensureOfferLinkedOptions(saison.items[selectedIndex].offers[offerIndex])[ruleIndex];if(!r)return;r.subcategoryIds=Array.isArray(r.subcategoryIds)?r.subcategoryIds:[];r.subcategoryIds=r.subcategoryIds.filter(x=>String(x)!==String(subcatId));if(checked)r.subcategoryIds.push(subcatId);renderPreview();}
function toggleLinkedRuleChoice(offerIndex,ruleIndex,categoryId,subcategoryId,checked){const r=ensureOfferLinkedOptions(saison.items[selectedIndex].offers[offerIndex])[ruleIndex];if(!r)return;r.choices=Array.isArray(r.choices)?r.choices:[];r.choices=r.choices.filter(x=>!(String(x.categoryId)===String(categoryId)&&String(x.subcategoryId)===String(subcategoryId)));if(checked)r.choices.push({categoryId,subcategoryId});renderPreview();}
function renderOffers(){const a=saison.items[selectedIndex];document.getElementById('offers').innerHTML=(a.offers||[]).map((o,idx)=>`<div class="offer-card modern-offer"><div class="offer-head"><div><div class="offer-title">Formule ${idx+1}</div><div class="offer-subtitle">Bloc affiché quand l’utilisateur ouvre l’activité sur saison.html</div></div><button class="btn-outline danger" data-fts-click="deleteOffer(${idx})">Supprimer</button></div><div class="form-grid modern-form"><div class="field"><label>Identifiant interne</label><input value="${FTS.esc(o.key||'')}" data-fts-input="setOffer(${idx},'key',this.value)" placeholder="loisir, perf, option"><small>Technique : sert à ouvrir le bon onglet. Évite les espaces.</small></div><div class="field"><label>Nom du bouton / onglet</label><input value="${FTS.esc(o.label||'')}" data-fts-input="setOffer(${idx},'label',this.value)" placeholder="🎈 Loisir"><small>Texte visible par les familles.</small></div><div class="field"><label>Couleur du parcours</label><select data-fts-change="setOffer(${idx},'style',this.value)"><option ${o.style==='loisir'?'selected':''} value="loisir">Loisir</option><option ${o.style==='perf'?'selected':''} value="perf">Performance</option><option ${o.style==='option'?'selected':''} value="option">Option</option></select><small>Change seulement le style visuel.</small></div><div class="field"><label>Tarif affiché</label><input value="${FTS.esc(o.price||'')}" data-fts-input="setOffer(${idx},'price',this.value)" placeholder="270€, 180€ / 200€…"><small>Visible dans le bloc d’inscription.</small></div><div class="field full"><label>Lien d’inscription spécifique</label><input value="${FTS.esc(o.link||'')}" data-fts-input="setOffer(${idx},'link',this.value)" placeholder="Vide = lien par défaut"><small>Laisse vide si cette formule utilise le lien général.</small></div><div class="field full"><label>Texte principal de la formule</label><textarea data-fts-input="setOffer(${idx},'main',this.value)" placeholder="1 cours hebdomadaire…">${FTS.esc(o.main||'')}</textarea><small>Accepte le HTML déjà utilisé, par exemple &lt;strong&gt;mercredi&lt;/strong&gt;.</small></div><div class="field full"><label>Points inclus / avantages</label><textarea data-fts-input="setOfferBullets(${idx},this.value)" placeholder="Une ligne = un avantage">${FTS.esc((o.bullets||[]).join('\n'))}</textarea><small>Chaque ligne devient une coche sur la page publique.</small></div><div class="field full"><label>Petite note sous le tarif</label><input value="${FTS.esc(o.priceNote||'')}" data-fts-input="setOffer(${idx},'priceNote',this.value)" placeholder="Tarif saison, adhésion comprise…"><small>Précision rassurante affichée sous le prix.</small></div></div>${renderOfferLinkedOptions(idx,o)}</div>`).join('');renderPreview()}

init();

/* FTS_AUTO_EXTRACTED_HANDLERS:saison-admin.html */
(function(){
  'use strict';
  var handlers = [{"selector": "[data-fts-handler-1]", "event": "click", "code": "exportJson()"}, {"selector": "[data-fts-handler-2]", "event": "click", "code": "saveAll()"}, {"selector": "[data-fts-handler-3]", "event": "click", "code": "doLogout()"}, {"selector": "[data-fts-handler-4]", "event": "click", "code": "addActivity()"}, {"selector": "[data-fts-handler-5]", "event": "click", "code": "importJson()"}, {"selector": "[data-fts-handler-6]", "event": "click", "code": "addOffer()"}, {"selector": "[data-fts-handler-7]", "event": "click", "code": "deleteActivity()"}];
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
