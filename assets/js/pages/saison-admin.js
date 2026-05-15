/* ================================================================
   PAGE MODULE — SAISON-ADMIN
   Extrait depuis saison-admin.html pour supprimer le JavaScript inline.
   ================================================================ */

const DEFAULT_SAISON={meta:{eyebrow:"Association culturelle",title:"SAISON",year:"2026/2027",slogan:"Deux parcours, une passion — trouvez votre place sur scène"},parcoursIntro:[{key:"loisir",icon:"🎈",tag:"Parcours Loisir",title:"À ton rythme",desc:"1 cours hebdomadaire pour découvrir, s'amuser et progresser librement."},{key:"perf",icon:"🚀",tag:"Parcours Performance",title:"Aller plus loin",desc:"Plus de technique, plusieurs spectacles dans l'année — et l'Atelier Improvisation offert toute l'année."}],inscriptionDefault:"",items:[]};
let db,auth,saison=JSON.parse(JSON.stringify(DEFAULT_SAISON)),selectedIndex=0,loadedCategories=[];
const FALLBACK_ITEMS=[
{id:"theatre",active:true,order:10,icon:"🎭",name:"Théâtre",subtitle:"Mercredi · Lundi",badge:"",offers:[{key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours hebdomadaire le <strong>mercredi</strong>.",bullets:["Plusieurs ateliers de théâtre dans la saison inclus","Plusieurs ateliers d'expression corporelle inclus"],price:"270€",priceNote:"Tarif saison",link:""},{key:"perf",label:"🚀 Performance",style:"perf",main:"1 cours hebdomadaire le <strong>mercredi</strong> + entraînements supplémentaires.",bullets:["Nouveau : entraînement jeudi dès octobre","Atelier Improvisation offert toute l'année"],price:"",priceNote:"Tarif à compléter",link:""}]},
{id:"danse",active:true,order:20,icon:"💃",name:"Danse",subtitle:"Mardi · Jeudi",badge:"",offers:[{key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours hebdomadaire. Groupes : Baby Show, Junior, Ados/Adultes.",bullets:[],price:"180€ / 200€",priceNote:"Enfants : 180€ · Adultes : 200€",link:""}]},
{id:"musique",active:true,order:30,icon:"🎸",name:"Musique & Chant",subtitle:"Individuel + ateliers",badge:"",offers:[{key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours individuel hebdomadaire.",bullets:[],price:"500€",priceNote:"Instrumental / chant + cours individuels",link:""}]},
{id:"singer",active:true,order:40,icon:"🎶",name:"Singer Academy",subtitle:"Vendredi · Mercredi",badge:"",offers:[{key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours de base le vendredi soir.",bullets:[],price:"270€",priceNote:"Tarif saison",link:""}]},
{id:"comedie",active:true,order:50,icon:"🎬",name:"Comédie Musicale",subtitle:"Tous âges",badge:"",offers:[{key:"loisir",label:"🎭 Kids / Loisir",style:"loisir",main:"1 cours hebdomadaire adapté à l'âge.",bullets:[],price:"350€",priceNote:"Tarif saison",link:""}]},
{id:"formation",active:true,order:70,icon:"🎼",name:"Formation Musicale",subtitle:"Option Musique & Chant",badge:"",offers:[{key:"option",label:"🎼 Option",style:"option",main:"Option payante en supplément, réservée aux élèves déjà inscrits en Musique & Chant.",bullets:[],price:"150€",priceNote:"Tarif saison",link:""}]},
{id:"atelier",active:true,order:80,icon:"🎨",name:"Atelier Créatif",subtitle:"Inclus Performance",badge:"Offert",offers:[{key:"inclus",label:"🎁 Inclus",style:"option",main:"Inclus automatiquement dans tous les Parcours Performance.",bullets:["Offert toute l'année pour tous les élèves Performance"],price:"160€",priceNote:"Tarif atelier seul — offert en Performance",link:""}]}
];
function ensureData(){if(!saison.items||!saison.items.length)saison.items=JSON.parse(JSON.stringify(FALLBACK_ITEMS));}
function init(){db=FTS.initFirebase();auth=firebase.auth();auth.onAuthStateChanged(async user=>{if(!user){location.href='auth.html';return}const snap=await db.ref('fts_users/'+user.uid).once('value');const profile=snap.val();if(!profile||profile.role!=='admin'){location.href='membres.html';return}document.getElementById('auth-loading').style.display='none';document.getElementById('admin-shell').style.display='block';loadedCategories=await FTS.getCategoryStructureAsync(db);await load();});}
async function load(){const snap=await db.ref('fts_saison/config').once('value');if(snap.val())saison=snap.val();ensureData();bindMeta();renderList();selectActivity(0)}
function bindMeta(){document.getElementById('m-title').value=saison.meta?.title||'';document.getElementById('m-year').value=saison.meta?.year||'';document.getElementById('m-slogan').value=saison.meta?.slogan||'';document.getElementById('m-link').value=saison.inscriptionDefault||'';['m-title','m-year','m-slogan','m-link'].forEach(id=>document.getElementById(id).addEventListener('input', readMeta))}
function readMeta(){saison.meta=saison.meta||{};saison.meta.title=document.getElementById('m-title').value;saison.meta.year=document.getElementById('m-year').value;saison.meta.slogan=document.getElementById('m-slogan').value;saison.inscriptionDefault=document.getElementById('m-link').value}
function sortedItems(){return saison.items.map((it,i)=>({...it,_i:i})).sort((a,b)=>(+a.order||0)-(+b.order||0))}
function renderList(){document.getElementById('activity-list').innerHTML=sortedItems().map(it=>`<div class="act-row ${it._i===selectedIndex?'sel':''}" data-fts-click="selectActivity(${it._i})"><div class="act-ico">${FTS.esc(it.icon||'🎭')}</div><div class="act-info"><div class="act-name">${FTS.esc(it.name||'Sans titre')}</div><div class="act-meta">${FTS.esc(it.subtitle||'')} · ${it.offers?.length||0} formule(s)</div></div><div class="status-dot ${it.active===false?'off':''}">●</div></div>`).join('')}
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
  wrap.innerHTML='<div class="helper-title">Choisir depuis les catégories existantes</div><div class="helper-text">Optionnel : clique sur une catégorie pour recopier son nom et son icône dans l’activité sélectionnée. Ça évite les noms différents entre les pages.</div><div class="season-cat-pills">'+cats.map((c,idx)=>'<button type="button" class="season-cat-pill" data-fts-click="applyCategoryPreset('+idx+')"><span>'+(c.icon||FTS.catIcon(c.name)||'🎭')+'</span>'+FTS.esc(c.name)+'</button>').join('')+'</div>';
}
function applyCategoryPreset(idx){
  const cat=(loadedCategories||[])[idx];
  const a=saison.items[selectedIndex];
  if(!cat||!a)return;
  a.name=cat.name||a.name;
  a.icon=cat.icon||FTS.catIcon(cat.name)||a.icon;
  document.getElementById('a-name').value=a.name||'';
  document.getElementById('a-icon').value=a.icon||'';
  renderList();
  renderPreview();
}
function renderPreview(){
  const box=document.getElementById('saison-preview');
  const a=saison.items[selectedIndex];
  if(!box||!a){return;}
  const offer=(a.offers&&a.offers[0])?a.offers[0]:{};
  box.innerHTML='<div class="preview-title">Aperçu public</div><div class="public-tile-preview"><div class="preview-icon">'+FTS.esc(a.icon||'🎭')+'</div><div><div class="preview-name">'+FTS.esc(a.name||'Sans titre')+'</div><div class="preview-sub">'+FTS.esc(a.subtitle||'Sous-titre')+'</div>'+(a.badge?'<div class="preview-badge">'+FTS.esc(a.badge)+'</div>':'')+'</div><span class="preview-status '+(a.active===false?'off':'')+'">'+(a.active===false?'Brouillon':'Visible')+'</span></div><div class="offer-preview"><div class="preview-offer-label">'+FTS.esc(offer.label||'Formule')+'</div><div class="preview-offer-main">'+(offer.main||'Description de la formule')+'</div><div class="preview-price">'+FTS.esc(offer.price||'Tarif à venir')+'</div></div>';
}

async function saveAll(){try{readMeta();readActivity();await db.ref('fts_saison/config').set({...saison,updatedAt:Date.now()});showMsg('ok','Saison publiée. La page publique se mettra à jour automatiquement.')}catch(e){showMsg('err','Erreur publication : '+e.message)}}
function exportJson(){readMeta();document.getElementById('json-area').value=JSON.stringify(saison,null,2);showMsg('ok','Export JSON généré.')}function importJson(){try{saison=JSON.parse(document.getElementById('json-area').value);ensureData();bindMeta();renderList();selectActivity(0);showMsg('ok','JSON importé. Clique sur Publier pour l’envoyer en ligne.')}catch(e){showMsg('err','JSON invalide : '+e.message)}}
function showMsg(cls,txt){const m=document.getElementById('msg');m.className='msg '+cls;m.textContent=txt;setTimeout(()=>m.className='msg',4500)}function doLogout(){firebase.auth().signOut().then(()=>location.href='auth.html')}
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
