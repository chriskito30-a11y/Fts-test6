/* ================================================================
   PAGE MODULE — SAISON
   Extrait depuis saison.html pour supprimer le JavaScript inline.
   ================================================================ */

const DEFAULT_SAISON={
  meta:{eyebrow:"Association culturelle",title:"SAISON",year:"2026/2027",slogan:"Deux parcours, une passion — trouvez votre place sur scène"},
  parcoursIntro:[
    {key:"loisir",icon:"🎈",tag:"Parcours Loisir",title:"À ton rythme",desc:"1 cours hebdomadaire pour découvrir, s'amuser et progresser librement."},
    {key:"perf",icon:"🚀",tag:"Parcours Performance",title:"Aller plus loin",desc:"Plus de technique, plusieurs spectacles dans l'année — et l'Atelier Improvisation offert toute l'année."}
  ],
  inscriptionDefault:"",
  items:[
    {id:"theatre",active:true,order:10,icon:"🎭",name:"Théâtre",subtitle:"Mercredi · Lundi",badge:"",offers:[
      {key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours hebdomadaire le <strong>mercredi</strong>.",bullets:["Plusieurs ateliers de théâtre dans la saison inclus","Plusieurs ateliers d'expression corporelle inclus"],price:"270€",priceNote:"Tarif saison — adhésion comprise selon vos conditions",link:""},
      {key:"perf",label:"🚀 Performance",style:"perf",main:"1 cours hebdomadaire le <strong>mercredi</strong> + entraînements supplémentaires.",bullets:["⚡ Nouveau : entraînement jeudi dès octobre","Plusieurs ateliers de théâtre le mercredi inclus","Plusieurs ateliers de rythme avec la Singer Academy Performance inclus","🎁 Offert : Atelier Improvisation toute l'année"],price:"",priceNote:"Tarif à compléter",link:""}
    ]},
    {id:"danse",active:true,order:20,icon:"💃",name:"Danse",subtitle:"Mardi · Jeudi",badge:"",offers:[
      {key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours hebdomadaire. Groupes : Baby Show, Junior, Ados/Adultes.",bullets:[],price:"180€ / 200€",priceNote:"Enfants : 180€ · Adultes : 200€",link:""},
      {key:"perf",label:"🚀 Performance",style:"perf",main:"1 cours hebdomadaire + répétitions spectacles.",bullets:["Répétitions et préparations spectacles incluses","🎁 Offert : Atelier Improvisation toute l'année"],price:"",priceNote:"Tarif à compléter",link:""}
    ]},
    {id:"musique",active:true,order:30,icon:"🎸",name:"Musique & Chant",subtitle:"Individuel + ateliers",badge:"",offers:[
      {key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours individuel hebdomadaire.",bullets:[],price:"500€",priceNote:"Instrumental / chant + cours individuels",link:""},
      {key:"perf",label:"🚀 Performance",style:"perf",main:"1 cours individuel hebdomadaire + ateliers musicaux partagés.",bullets:["Ateliers partagés avec les autres musiciens pour préparer les concerts","Plusieurs ateliers de création d'harmonies avec la Singer Academy inclus","Plusieurs ateliers de théâtre le mercredi inclus","🎁 Offert : Atelier Improvisation toute l'année","💰 Options payantes en supplément : Formation Musicale ou Singer Show"],price:"",priceNote:"Tarif à compléter",link:""}
    ]},
    {id:"singer",active:true,order:40,icon:"🎶",name:"Singer Academy",subtitle:"Vendredi · Mercredi",badge:"",offers:[
      {key:"loisir",label:"🎈 Loisir",style:"loisir",main:"1 cours de base le <strong>vendredi soir</strong>.",bullets:["Plusieurs ateliers de théâtre le mercredi inclus","Plusieurs ateliers d'expression corporelle le mardi inclus"],price:"270€",priceNote:"Tarif saison",link:""},
      {key:"perf",label:"🚀 Performance",style:"perf",main:"1 cours hebdomadaire le <strong>mercredi soir</strong>.",bullets:["Plusieurs ateliers de théâtre le mercredi inclus","Plusieurs ateliers d'expression corporelle le mardi inclus","🎁 Offert : Atelier Improvisation toute l'année"],price:"",priceNote:"Tarif à compléter",link:""}
    ]},
    {id:"comedie",active:true,order:50,icon:"🎬",name:"Comédie Musicale",subtitle:"Tous âges",badge:"",offers:[
      {key:"loisir",label:"🎭 Kids / Loisir",style:"loisir",main:"1 cours hebdomadaire adapté à l'âge.<br><span class='offer-muted'>Découverte ludique du chant, du théâtre et de la danse.</span>",bullets:[],price:"350€",priceNote:"Tarif saison",link:""},
      {key:"perf",label:"🚀 Performance",style:"perf",main:"1 cours hebdomadaire adapté à l'âge.",bullets:["Plusieurs ateliers d'expression corporelle inclus","Plusieurs ateliers de rythme avec la Singer Academy Performance inclus","🎁 Offert : Atelier Improvisation toute l'année"],price:"",priceNote:"Objectif : devenir un artiste complet, monter sur scène et partager l'esprit Fais Ton Show !",link:""}
    ]},
    {id:"singershow",active:true,order:60,icon:"🌟",name:"Singer Show",subtitle:"Option Musique & Chant",badge:"",offers:[
      {key:"option",label:"🌟 Option",style:"option",main:"Option payante en supplément, <strong>réservée aux élèves déjà inscrits en Musique & Chant</strong>.",bullets:["Cours dédié à la performance scénique vocale","Travail sur la présence scénique, le jeu et l'interprétation"],price:"",priceNote:"Tarif à compléter",link:""}
    ]},
    {id:"formation",active:true,order:70,icon:"🎼",name:"Formation Musicale",subtitle:"Option Musique & Chant",badge:"",offers:[
      {key:"option",label:"🎼 Option",style:"option",main:"Option payante en supplément, <strong>réservée aux élèves déjà inscrits en Musique & Chant</strong>.",bullets:["Théorie musicale, lecture de partitions, solfège","Approfondit la compréhension de la musique pour progresser plus vite"],price:"150€",priceNote:"Tarif saison",link:""}
    ]},
    {id:"atelier",active:true,order:80,icon:"🎨",name:"Atelier Créatif",subtitle:"Inclus Performance",badge:"Offert",offers:[
      {key:"inclus",label:"🎁 Inclus",style:"option",main:"Inclus automatiquement dans tous les <strong>Parcours Performance</strong>.",bullets:["🎁 Offert toute l'année pour tous les élèves Performance","Improvisation théâtrale, créativité, expression libre"],price:"160€",priceNote:"Tarif atelier créatif seul — offert pour les parcours Performance",link:""}
    ]}
  ]
};
let saison=DEFAULT_SAISON,current=null;
let selectedSeasonSubcats={};
let selectedSeasonOffers={};
let legacySaison=DEFAULT_SAISON;
let officialCategories=null;
let ftsPaymentUser=null;
let ftsPaymentProfile=null;
let ftsPaymentEnabled=false;
let ftsPaymentContext=null;
function esc(s){return FTS.esc(s||"")}
function norm(s){return (FTS.norm?FTS.norm(s||''):String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));}
function itemList(){return (saison.items||[]).filter(i=>i.active!==false).sort((a,b)=>(+a.order||0)-(+b.order||0));}
function legacyByCategory(cat){
  const key=norm(cat.key||cat.name||cat.category);
  const aliases={comedie_musicale:['comedie','comedie_musicale'],singer_academy:['singer','singer_academy'],singer_show:['singershow','singer_show'],musique:['musique'],theatre:['theatre'],danse:['danse'],atelier:['atelier'],chant:['chant'],magie:['magie']};
  const candidates=[key].concat(aliases[key]||[]);
  const cname=norm(cat.name||cat.category||'');
  return (legacySaison.items||[]).find(i=>candidates.includes(norm(i.id))||norm(i.name)===cname)||null;
}
function categorySubcats(cat){
  const raw=cat.subcats||cat.subcategories||{};
  const out=[];
  if(Array.isArray(raw)) raw.forEach((s,i)=>{ if(typeof s==='string') out.push({key:norm(s)||String(i),name:s,active:true}); else if(s) out.push({key:s.key||norm(s.name||s.label)||String(i),...s,name:s.name||s.label||'',active:s.active!==false}); });
  else Object.entries(raw).forEach(([k,s])=>{ if(typeof s==='string') out.push({key:k,name:s,active:true}); else if(s) out.push({key:k,...s,name:s.name||s.label||k,active:s.active!==false}); });
  return out.filter(s=>s.active!==false && s.name).sort((a,b)=>(+a.order||999)-(+b.order||999)||(a.name||'').localeCompare(b.name||'', 'fr'));
}
function buildSeasonFromCategories(categories){
  const cats=[];
  Object.entries(categories||{}).forEach(([key,c])=>{ if(c && c.active!==false) cats.push({key,...c}); });
  cats.sort((a,b)=>(+a.order||999)-(+b.order||999)||(a.name||a.category||'').localeCompare(b.name||b.category||'', 'fr'));
  if(!cats.length) return legacySaison||DEFAULT_SAISON;
  const items=cats.filter(c=>!(c.season&&c.season.showOnSeason===false)).map(c=>{
    const legacy=legacyByCategory(c)||{};
    const cs=c.season||{};
    const subcats=categorySubcats(c);
    const label=c.name||c.category||c.key;
    const title=cs.title||label;
    const hasCustomOffer=Array.isArray(cs.offers)&&cs.offers.length;
    const offers=hasCustomOffer?cs.offers:(legacy.offers&&legacy.offers.length?legacy.offers:[{key:'infos',label:'Infos',style:'option',main:cs.description?esc(cs.description):`Informations à venir pour <strong>${esc(title)}</strong>.`,bullets:[],price:cs.price||'',priceNote:cs.priceNote||'',link:cs.link||''}]);
    return {
      id:c.key||norm(title),
      active:c.active!==false,
      order:+(cs.order||c.order||legacy.order||999),
      icon:c.icon||c.emoji||legacy.icon||FTS.catIcon(label),
      name:title,
      subtitle:cs.subtitle||legacy.subtitle||(subcats.length?`${subcats.length} groupe${subcats.length>1?'s':''}`:''),
      badge:cs.badge||legacy.badge||'',
      description:cs.description||'',
      season:cs,
      subcats,
      offers
    };
  });
  return {...(legacySaison||DEFAULT_SAISON),items};
}
function render(){const m=saison.meta||DEFAULT_SAISON.meta;document.getElementById('page-eyebrow').textContent=m.eyebrow||'';document.getElementById('page-title').innerHTML=esc(m.title||'SAISON')+'<br><span>'+esc(m.year||'')+'</span>';document.getElementById('page-slogan').textContent=m.slogan||'';document.getElementById('parcours-cards').innerHTML=(saison.parcoursIntro||[]).map(p=>`<div class="p-card ${esc(p.key)}"><span class="p-icon">${esc(p.icon)}</span><div class="p-tag">${esc(p.tag)}</div><div class="p-title">${esc(p.title)}</div><p class="p-desc">${esc(p.desc)}</p></div>`).join('');const items=itemList();document.getElementById('tiles').innerHTML=items.map(i=>`<button class="tile" data-id="${esc(i.id)}" data-fts-click="toggle('${esc(i.id)}')"><span class="tile-icon">${esc(i.icon)}</span><div class="tile-name">${esc(i.name)}</div><div class="tile-sub">${esc(i.subtitle)}</div>${i.badge?`<span class="tile-badge">${esc(i.badge)}</span>`:''}<span class="tile-arrow">▼</span></button>`).join('')||'<div class="loading-card">Aucune activité publiée pour le moment.</div>';document.getElementById('panels').innerHTML=items.map(renderPanel).join('');}
function renderPanel(i){return `<div class="panel" id="panel-${esc(i.id)}"><div class="panel-hdr"><span class="panel-icon">${esc(i.icon)}</span><div><div class="panel-title">${esc(i.name)}</div><div class="panel-sub">${esc(i.subtitle)}</div></div></div><div class="panel-body">${i.description?`<p class="season-desc">${esc(i.description)}</p>`:''}${renderSubcats(i)}${renderOffers(i)}</div></div>`;}
function subcatKey(s){return typeof s==='string'?(norm(s)||s):(s.key||norm(s.name||s.label)||'principal');}
function subcatName(s){return typeof s==='string'?s:(s.name||s.label||'Groupe principal');}
function subcatSeason(s){return (typeof s==='object'&&s&&s.season)?s.season:{};}
function offerToken(value){
  const raw=norm(value||'');
  if(['perf','performance','performances'].includes(raw)) return 'perf';
  if(['loisir','loisirs'].includes(raw)) return 'loisir';
  if(['option','options'].includes(raw)) return 'option';
  if(['inclus','inclu','incluse'].includes(raw)) return 'inclus';
  return raw;
}
function offerTokens(value){
  if(Array.isArray(value)) return value.map(offerToken).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i);
  return String(value||'').split(/[,+/;]|\bet\b/gi).map(offerToken).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i);
}
function offerLabelFromToken(t){return ({loisir:'Loisir',perf:'Performance',option:'Option',inclus:'Inclus'}[t]||t);}
function allowedOffersForSubcat(s){
  const ss=subcatSeason(s);
  return offerTokens(ss.allowedOffers||ss.offers||ss.formules||ss.parcours||'');
}
function subcatAllowsOffer(s, offerKey){
  const allowed=allowedOffersForSubcat(s);
  if(!allowed.length) return true;
  const key=offerToken(offerKey||'');
  return !key || allowed.includes(key);
}
function currentOfferKey(item){
  const offers=(item&&item.offers)||[];
  return selectedSeasonOffers[item.id] || (offers[0]&&offers[0].key) || '';
}

function subcatPaymentInfo(s){
  const ss=subcatSeason(s);
  const name=subcatName(s);
  const title=ss.title||name;
  const day=ss.day||ss.jour||'';
  const time=ss.time||ss.horaire||ss.hours||'';
  const level=ss.level||ss.niveau||'';
  const age=ss.age||ss.ages||'';
  const note=ss.note||ss.description||'';
  const price=ss.price||ss.tarif||'';
  const maxSeats=Number(ss.maxSeats||ss.placesMax||ss.capacity||0)||0;
  const direct=ss.seasonDetail||ss.detail||ss.details||ss.saisonDetail||'';
  const seasonDetail=String(direct||[day,time,level,age,note].filter(Boolean).join(' · ')).trim();
  const allowedOffers=allowedOffersForSubcat(s);
  return {key:subcatKey(s),name,title,day,time,level,age,note,price,maxSeats,allowedOffers,seasonDetail};
}
function renderSubcatDetails(activityId,s){
  const ss=subcatSeason(s);
  const allowed=allowedOffersForSubcat(s);
  const lines=[];
  if(ss.day) lines.push(['Jour',ss.day]);
  if(ss.time) lines.push(['Horaire',ss.time]);
  if(ss.level) lines.push(['Niveau',ss.level]);
  if(ss.age) lines.push(['Âge',ss.age]);
  if(ss.price) lines.push(['Tarif spécifique',ss.price]);
  const maxSeats=Number(ss.maxSeats||ss.placesMax||ss.capacity||0)||0;
  if(maxSeats>0) lines.push(['Places disponibles',maxSeats+' maximum']);
  if(allowed.length) lines.push(['Formules',allowed.map(offerLabelFromToken).join(' + ')]);
  const lineHtml=lines.length?`<div class="season-subcat-detail-grid">${lines.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`:'';
  const note=ss.note?`<p class="season-subcat-detail-note">${esc(ss.note)}</p>`:'';
  if(!lineHtml&&!note) return '';
  return `<div class="season-subcat-detail" id="season-subcat-detail-${esc(activityId)}-${esc(subcatKey(s))}">${lineHtml}${note}</div>`;
}
function renderSubcats(i){
  const subs=(i.subcats||[]).filter(s=>!(s.season&&s.season.showOnSeason===false));
  if(!subs.length) return '';
  const selected=selectedSeasonSubcats[i.id]||'';
  const activeOffer=currentOfferKey(i);
  const visibleCount=subs.filter(s=>subcatAllowsOffer(s,activeOffer)).length;
  return `<div class="season-subcats" data-activity="${esc(i.id)}"><div class="season-subcats-title">Groupes / horaires</div><div class="season-subcats-help">Choisis un groupe compatible avec la formule sélectionnée. Les groupes non compatibles sont masqués automatiquement.</div><div class="season-subcats-grid">${subs.map(s=>{const ss=subcatSeason(s);const key=subcatKey(s);const bits=[ss.day,ss.time,ss.level].filter(Boolean);const active=selected&&selected===key;const allowed=allowedOffersForSubcat(s);const compatible=subcatAllowsOffer(s,activeOffer);return `<button type="button" class="season-subcat${active?' selected':''}${compatible?'':' is-hidden-by-offer'}" data-activity="${esc(i.id)}" data-subcat="${esc(key)}" data-offers="${esc(allowed.join(','))}" data-fts-click="selectSeasonSubcat('${esc(i.id)}','${esc(key)}')"><strong>${esc(ss.title||subcatName(s))}</strong>${allowed.length?`<div class="season-subcat-offers">${allowed.map(x=>`<span>${esc(offerLabelFromToken(x))}</span>`).join('')}</div>`:''}${bits.length?`<div class="season-subcat-meta">${bits.map(esc).join(' · ')}</div>`:''}${ss.note?`<div class="season-subcat-note">${esc(ss.note)}</div>`:''}${ss.price?`<div class="season-subcat-price">${esc(ss.price)}</div>`:''}${Number(ss.maxSeats||ss.placesMax||ss.capacity||0)>0?`<div class="season-subcat-capacity">${esc(String(Number(ss.maxSeats||ss.placesMax||ss.capacity||0)))} places max</div>`:''}<span class="season-subcat-check">✓</span></button>`}).join('')}</div><div class="season-subcats-empty${visibleCount?'':' open'}" data-empty-for="${esc(i.id)}">Aucun groupe n’est disponible pour cette formule.</div>${subs.map(s=>renderSubcatDetails(i.id,s)).join('')}</div>`;
}
function selectSeasonSubcat(activityId,subcatId){
  const item=itemList().find(x=>String(x.id)===String(activityId));
  const offer=currentOfferKey(item||{});
  const sub=item ? (item.subcats||[]).find(s=>subcatKey(s)===subcatId) : null;
  if(sub && !subcatAllowsOffer(sub, offer)){
    alert('Ce groupe n’est pas disponible pour cette formule. Choisis une formule compatible ou un autre groupe.');
    return;
  }
  selectedSeasonSubcats[activityId]=subcatId;
  const safeActivity=window.CSS&&CSS.escape?CSS.escape(activityId):activityId.replace(/[^a-zA-Z0-9_-]/g,'\$&');
  document.querySelectorAll(`.season-subcat[data-activity="${safeActivity}"]`).forEach(btn=>btn.classList.toggle('selected',btn.getAttribute('data-subcat')===subcatId));
  document.querySelectorAll(`[id^="season-subcat-detail-${safeActivity}-"]`).forEach(el=>el.classList.remove('open'));
  const detail=document.getElementById(`season-subcat-detail-${activityId}-${subcatId}`);
  if(detail) detail.classList.add('open');
}
function updateSeasonSubcatVisibility(activityId,offerKey){
  const item=itemList().find(x=>String(x.id)===String(activityId));
  if(!item) return;
  selectedSeasonOffers[activityId]=offerKey;
  const safeActivity=window.CSS&&CSS.escape?CSS.escape(activityId):activityId.replace(/[^a-zA-Z0-9_-]/g,'\$&');
  let visible=0;
  document.querySelectorAll(`.season-subcat[data-activity="${safeActivity}"]`).forEach(btn=>{
    const subId=btn.getAttribute('data-subcat')||'';
    const sub=(item.subcats||[]).find(s=>subcatKey(s)===subId);
    const ok=!sub || subcatAllowsOffer(sub, offerKey);
    btn.classList.toggle('is-hidden-by-offer', !ok);
    if(ok) visible++;
    if(!ok && selectedSeasonSubcats[activityId]===subId){
      selectedSeasonSubcats[activityId]='';
      btn.classList.remove('selected');
      document.querySelectorAll(`[id^="season-subcat-detail-${safeActivity}-"]`).forEach(el=>el.classList.remove('open'));
    }
  });
  const empty=document.querySelector(`[data-empty-for="${safeActivity}"]`);
  if(empty) empty.classList.toggle('open', visible===0);
}
function renderOffers(i){const offers=i.offers||[];const tabs=offers.length>1?`<div class="tabs">${offers.map((o,idx)=>`<button class="tab ${idx===0?'act':''} ${esc(o.style||o.key)}" data-fts-click="switchTab('${esc(i.id)}','${esc(o.key)}',this)">${esc(o.label||o.key)}</button>`).join('')}</div>`:'';return tabs+offers.map((o,idx)=>`<div class="tab-content ${idx===0?'act':''}" id="${esc(i.id)}-${esc(o.key)}"><div class="c-main ${o.style==='perf'?'perf':''}">${o.main||''}</div>${renderBullets(o.bullets)}${renderOfferBox(o,i)}</div>`).join('');}
function renderBullets(bullets){if(!bullets||!bullets.length)return'';return `<ul class="c-list">${bullets.map(b=>{const gift=String(b).includes('🎁');const warn=String(b).includes('💰');return `<li class="${gift?'gift':warn?'warn':'incl'}"><span class="icon">${gift?'🎁':warn?'💰':'✔'}</span><span>${esc(String(b).replace(/^([✔⚡🎁💰])\s*/,'')).replace(/Offert :/,'<strong>Offert :</strong>')}</span></li>`}).join('')}</ul>`}
function renderOfferBox(o,i){const rawLink=String(o.link||saison.inscriptionDefault||'').trim();const link=(rawLink&&rawLink!=='#')?FTS.safeUrl(rawLink,''):'';const paymentBtn=renderPaymentButton(i,o);return `<div class="offer-box"><div><div class="offer-price">${esc(o.price||'Tarif à venir')} ${o.price?'<small>/ saison</small>':''}</div>${o.priceNote?`<div class="offer-note">${esc(o.priceNote)}</div>`:''}</div><div class="offer-actions">${link?`<a class="btn-register" href="${esc(link)}" target="_blank" rel="noopener">S'inscrire</a>`:`<span class="btn-register muted">Lien bientôt disponible</span>`}${paymentBtn}</div></div>`;}


/* ── Paiement HelloAsso admin/bêta ────────────────────────────── */
function ftsPaymentApiBase(){return String((FTS.PAYMENT&&FTS.PAYMENT.workerUrl)||'').replace(/\/+$/,'');}
function ftsCanShowPayment(){return !!(ftsPaymentEnabled && ftsPaymentUser && ftsPaymentApiBase() && !ftsPaymentApiBase().includes('REMPLACER_PAR_URL_WORKER'));}
function priceChoices(priceLabel){
  const raw=String(priceLabel||'').replace(',', '.');
  const matches=raw.match(/\d+(?:\.\d{1,2})?/g)||[];
  const out=[];
  matches.forEach(m=>{const cents=Math.round(Number(m)*100); if(Number.isFinite(cents)&&cents>=100&&!out.some(x=>x.cents===cents)) out.push({cents,label:(cents/100).toFixed(2).replace('.', ',')+' €'});});
  return out;
}
function renderPaymentButton(item,offer){
  if(!ftsCanShowPayment()) return '';
  const prices=priceChoices(offer&&offer.price);
  if(!prices.length) return '<span class="btn-register muted">Paiement indisponible</span>';
  return `<button type="button" class="btn-register fts-pay-btn" data-fts-click="openSeasonPayment('${esc(item.id)}','${esc(offer.key)}')">Payer</button>`;
}
function selectedSeasonSubcat(item){
  const subs=item&&Array.isArray(item.subcats)?item.subcats:[];
  if(!subs.length) return {key:'principal',name:'Groupe principal',title:'Groupe principal',day:'',time:'',level:'',age:'',note:'',price:'',seasonDetail:''};
  const wanted=selectedSeasonSubcats[item.id]||'';
  if(!wanted) return null;
  const found=subs.find(s=>subcatKey(s)===wanted);
  if(!found) return null;
  return subcatPaymentInfo(found);
}
function findSeasonSubcat(item,key){
  const subs=item&&Array.isArray(item.subcats)?item.subcats:[];
  const found=subs.find(s=>subcatKey(s)===key);
  return found?subcatPaymentInfo(found):null;
}
function ensureSeasonPaymentModal(){
  if(document.getElementById('fts-season-payment-modal'))return;
  const div=document.createElement('div');
  div.id='fts-season-payment-modal';
  div.className='fts-payment-modal';
  div.innerHTML=`<div class="fts-payment-card"><button type="button" class="fts-payment-close" data-fts-click="closeSeasonPayment()">×</button><div class="eyebrow">Paiement sécurisé HelloAsso</div><h2 id="fts-pay-title">Règlement Fais Ton Show</h2><p id="fts-pay-summary" class="fts-pay-summary"></p><form id="fts-pay-form"><div class="fts-pay-grid"><label>Prénom payeur<input name="firstName" required></label><label>Nom payeur<input name="lastName" required></label><label>Email payeur<input name="email" type="email" required></label><label>Nom de l'élève<input name="studentName" required></label><label id="fts-pay-sub-wrap">Groupe<select name="subcategoryId"></select></label><label>Montant<select name="amountCents"></select></label><label>Paiement<select name="paymentPlan"><option value="1x">Paiement en 1 fois</option><option value="3x">Paiement en 3 fois</option><option value="5x">Paiement en 5 fois</option><option value="10x">Paiement en 10 fois</option></select></label></div><button class="btn-register fts-pay-submit" type="submit">Continuer vers HelloAsso</button><div id="fts-pay-msg" class="fts-pay-msg"></div></form></div>`;
  document.body.appendChild(div);
  document.getElementById('fts-pay-form').addEventListener('submit',submitSeasonPayment);
}
function openSeasonPayment(activityId,offerKey){
  const item=itemList().find(x=>String(x.id)===String(activityId));
  const offer=item&&(item.offers||[]).find(o=>String(o.key)===String(offerKey));
  if(!item||!offer){alert('Formule introuvable.');return;}
  const prices=priceChoices(offer.price);
  if(!prices.length){alert('Tarif non reconnu pour cette formule.');return;}
  const chosenSubcat=selectedSeasonSubcat(item);
  if((item.subcats||[]).length && !chosenSubcat){
    alert('Choisis d’abord le groupe / horaire concerné avant de lancer le paiement.');
    const zone=document.querySelector(`#panel-${CSS.escape(item.id)} .season-subcats`);
    if(zone) zone.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  if(chosenSubcat && !subcatAllowsOffer((item.subcats||[]).find(s=>subcatKey(s)===chosenSubcat.key), offer.key)){
    alert('Ce groupe n’est pas disponible pour cette formule. Choisis une formule compatible ou un autre groupe.');
    const zone=document.querySelector(`#panel-${CSS.escape(item.id)} .season-subcats`);
    if(zone) zone.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  ensureSeasonPaymentModal();
  ftsPaymentContext={item,offer};
  const profile=ftsPaymentProfile||{};
  const email=(ftsPaymentUser&&ftsPaymentUser.email)||profile.email||'';
  const first=profile.firstName||profile.prenom||'';
  const last=profile.lastName||profile.nom||'';
  document.getElementById('fts-pay-title').textContent=(item.name||'Activité')+' · '+(offer.label||offer.key||'Formule');
  document.getElementById('fts-pay-summary').innerHTML=`<strong>${esc(item.name)}</strong><br>Formule : <strong>${esc(offer.label||offer.key)}</strong><br>${chosenSubcat?`Groupe : <strong>${esc(chosenSubcat.title||chosenSubcat.name)}</strong>${chosenSubcat.seasonDetail?`<br><span class="fts-pay-subdetail">${esc(chosenSubcat.seasonDetail)}</span>`:''}<br>`:''}Saison : <strong>${esc((saison.meta&&saison.meta.year)||'')}</strong>`;
  const form=document.getElementById('fts-pay-form');
  form.firstName.value=first; form.lastName.value=last; form.email.value=email; form.studentName.value=[first,last].filter(Boolean).join(' ');
  form.amountCents.innerHTML=prices.map(p=>`<option value="${p.cents}">${esc(p.label)}</option>`).join('');
  const subs=item.subcats||[];
  const wrap=document.getElementById('fts-pay-sub-wrap');
  if(subs.length){const compatibleSubs=subs.filter(s=>subcatAllowsOffer(s,offer.key));wrap.style.display='grid';form.subcategoryId.innerHTML=compatibleSubs.map(s=>{const sub=subcatPaymentInfo(s);const label=sub.seasonDetail?`${sub.title||sub.name} — ${sub.seasonDetail}`:(sub.title||sub.name);return `<option value="${esc(sub.key)}">${esc(label)}</option>`}).join(''); if(chosenSubcat) form.subcategoryId.value=chosenSubcat.key;}
  else{wrap.style.display='none';form.subcategoryId.innerHTML='<option value="principal">Groupe principal</option>';}
  document.getElementById('fts-pay-msg').textContent='';
  document.getElementById('fts-season-payment-modal').classList.add('open');
}
function closeSeasonPayment(){const m=document.getElementById('fts-season-payment-modal');if(m)m.classList.remove('open');}
async function submitSeasonPayment(event){
  event.preventDefault();
  const msg=document.getElementById('fts-pay-msg');
  try{
    if(!ftsPaymentContext||!ftsPaymentUser)throw new Error('Session paiement indisponible.');
    const token=await ftsPaymentUser.getIdToken(true);
    const form=event.target;
    const item=ftsPaymentContext.item, offer=ftsPaymentContext.offer;
    const selectedSubcat=findSeasonSubcat(item,form.subcategoryId.value)||{key:form.subcategoryId.value,name:'Groupe principal',title:'Groupe principal',day:'',time:'',level:'',age:'',note:'',price:'',maxSeats:0,seasonDetail:''};
    const payload={source:'saison.html',activityId:item.id,offerKey:offer.key,amountCents:Number(form.amountCents.value),paymentPlan:form.paymentPlan.value,subcategoryId:selectedSubcat.key,subcategoryName:selectedSubcat.name,subcategoryTitle:selectedSubcat.title,subcategoryDay:selectedSubcat.day,subcategoryTime:selectedSubcat.time,subcategoryLevel:selectedSubcat.level,subcategoryAge:selectedSubcat.age,subcategoryNote:selectedSubcat.note,subcategoryPrice:selectedSubcat.price,subcategoryMaxSeats:Number(selectedSubcat.maxSeats||0)||0,subcategoryAllowedOffers:selectedSubcat.allowedOffers||[],subcategorySeasonDetail:selectedSubcat.seasonDetail,subcategory:selectedSubcat,payer:{firstName:form.firstName.value,lastName:form.lastName.value,email:form.email.value},student:{name:form.studentName.value}};
    msg.textContent='Création du paiement sécurisé…';
    const res=await fetch(ftsPaymentApiBase()+'/checkout',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok){const labels={subcategory_full:'Ce groupe est complet : le nombre de places maximum est atteint.',payment_access_denied:'Paiement non autorisé pour ce compte.'};throw new Error(labels[data.error]||data.error||'Erreur création paiement');}
    location.href=data.redirectUrl;
  }catch(e){msg.textContent='Impossible de lancer le paiement : '+(e&&e.message?e.message:e);}
}
function initSeasonPaymentGate(){
  if(typeof firebase==='undefined'||!firebase.auth)return;
  firebase.auth().onAuthStateChanged(async function(user){
    ftsPaymentUser=user||null; ftsPaymentProfile=null; ftsPaymentEnabled=false;
    if(user){
      try{
        const paymentDb=FTS.initFirebase();
        if(!paymentDb) throw new Error('Firebase indisponible');
        const snap=await paymentDb.ref('fts_users/'+user.uid).once('value');
        ftsPaymentProfile=snap.val()||{};
        ftsPaymentEnabled=String(ftsPaymentProfile.role||'').toLowerCase()==='admin'||!!(ftsPaymentProfile.features&&ftsPaymentProfile.features.paymentsBeta===true);
      }catch(e){console.warn('[FTS paiement] profil inaccessible',e);}
    }
    render();
  });
}

function toggle(id){const tile=document.querySelector('[data-id="'+id+'"]'),panel=document.getElementById('panel-'+id);if(!tile||!panel)return;if(current&&current!==id){const oldT=document.querySelector('[data-id="'+current+'"]'),oldP=document.getElementById('panel-'+current);if(oldT)oldT.classList.remove('open');if(oldP)oldP.classList.remove('open')}if(current===id){tile.classList.remove('open');panel.classList.remove('open');current=null}else{tile.classList.add('open');panel.classList.add('open');current=id;setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),50)}}
function switchTab(disc,parcours,btn){const panel=document.getElementById('panel-'+disc);panel.querySelectorAll('.tab').forEach(t=>t.classList.remove('act'));panel.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('act'));btn.classList.add('act');document.getElementById(disc+'-'+parcours).classList.add('act');updateSeasonSubcatVisibility(disc,parcours)}
function applySeason(){saison=officialCategories?buildSeasonFromCategories(officialCategories):(legacySaison||DEFAULT_SAISON);render();}
function finishInitialRender(){applySeason();document.body.classList.remove('saison-loading')}
function loadSaison(){
  let rendered=false;
  try{
    const db=FTS.initFirebase();
    if(!db){finishInitialRender();return}
    const maybeFinish=()=>{ if(!rendered){rendered=true;finishInitialRender();} else applySeason(); };
    db.ref('fts_saison/config').on('value',snap=>{ legacySaison=snap.val()||DEFAULT_SAISON; maybeFinish(); },err=>{ console.warn('[FTS Saison config]',err); maybeFinish(); });
    db.ref('fts_content/categories').on('value',snap=>{ officialCategories=snap.exists()?snap.val():null; maybeFinish(); },err=>{ console.warn('[FTS Saison categories]',err); maybeFinish(); });
    setTimeout(()=>{ if(!rendered){rendered=true;finishInitialRender();} },2500);
  }catch(e){
    console.warn('[FTS Saison]',e);
    finishInitialRender();
  }
}
loadSaison();
initSeasonPaymentGate();
