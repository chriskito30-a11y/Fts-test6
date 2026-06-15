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
    const hasSeasonConfigOffer=Array.isArray(legacy.offers)&&legacy.offers.length;
    const hasCategoryOffer=Array.isArray(cs.offers)&&cs.offers.length;
    const offers=hasSeasonConfigOffer?legacy.offers:(hasCategoryOffer?cs.offers:[{key:'infos',label:'Infos',style:'option',main:cs.description?esc(cs.description):`Informations à venir pour <strong>${esc(title)}</strong>.`,bullets:[],price:cs.price||'',priceNote:cs.priceNote||'',link:cs.link||''}]);
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
function render(){const m=saison.meta||DEFAULT_SAISON.meta;document.getElementById('page-eyebrow').textContent=m.eyebrow||'';document.getElementById('page-title').innerHTML=esc(m.title||'SAISON')+'<br><span>'+esc(m.year||'')+'</span>';document.getElementById('page-slogan').textContent=m.slogan||'';document.getElementById('parcours-cards').innerHTML=(saison.parcoursIntro||[]).map(p=>`<div class="p-card ${esc(p.key)}"><span class="p-icon">${esc(p.icon)}</span><div class="p-tag">${esc(p.tag)}</div><div class="p-title">${esc(p.title)}</div><p class="p-desc">${esc(p.desc)}</p></div>`).join('');const items=itemList();document.getElementById('tiles').innerHTML=items.map(i=>`<button class="tile" data-id="${esc(i.id)}" data-fts-click="toggle('${esc(i.id)}')"><span class="tile-icon">${esc(i.icon)}</span><div class="tile-name">${esc(i.name)}</div><div class="tile-sub">${esc(i.subtitle)}</div>${i.badge?`<span class="tile-badge">${esc(i.badge)}</span>`:''}<span class="tile-arrow">▼</span></button>`).join('')||'<div class="loading-card">Aucune activité publiée pour le moment.</div>';document.getElementById('panels').innerHTML=items.map(renderPanel).join('');items.forEach(i=>refreshSubcatOfferFilter(i.id));}
function renderPanel(i){return `<div class="panel" id="panel-${esc(i.id)}"><div class="panel-hdr"><span class="panel-icon">${esc(i.icon)}</span><div><div class="panel-title">${esc(i.name)}</div><div class="panel-sub">${esc(i.subtitle)}</div></div></div><div class="panel-body">${i.description?`<p class="season-desc">${esc(i.description)}</p>`:''}${renderSubcats(i)}${renderOffers(i)}</div></div>`;}
function subcatKey(s){return typeof s==='string'?(norm(s)||s):(s.key||norm(s.name||s.label)||'principal');}
function subcatName(s){return typeof s==='string'?s:(s.name||s.label||'Groupe principal');}
function subcatSeason(s){return (typeof s==='object'&&s&&s.season)?s.season:{};}
function normalizeOfferKey(value){
  const s=String(value||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
  if(!s) return '';
  if(['loisir','loisirs','kid','kids','decouverte','parcours loisir'].includes(s)) return 'loisir';
  if(['performance','perf','perfo','scene','troupe','avance','avancee','parcours performance'].includes(s)) return 'perf';
  if(['option','options'].includes(s)) return 'option';
  if(['inclus','incluse','offert','offerte'].includes(s)) return 'inclus';
  return s.replace(/\s+/g,'_');
}
function parseAllowedOffers(value){
  let raw=[];
  if(Array.isArray(value)) raw=value;
  else if(value&&typeof value==='object') raw=Object.values(value);
  else raw=String(value||'').split(/[,+/;]|\bet\b/gi);
  return raw.map(normalizeOfferKey).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i);
}
function offerTokensForFilter(offer){
  if(!offer) return [];
  return [offer.key,offer.style,offer.label,offer.name,offer.title]
    .flatMap(v=>parseAllowedOffers(v))
    .filter(Boolean)
    .filter((x,i,a)=>a.indexOf(x)===i);
}
function offerKeyForFilter(offer){return offerTokensForFilter(offer)[0]||'';}
function activeOfferForItem(item){
  const list=(item&&item.offers)||[];
  const selected=selectedSeasonOffers[item.id]||'';
  return list.find(o=>String(o.key)===String(selected))||list[0]||null;
}
function subcatAllowedOffers(s){
  const ss=subcatSeason(s);
  const raw=[];
  [
    ss.allowedOffers,ss.formules,ss.parcours,ss.offerKeys,ss.allowedOffer,ss.formule,ss.parcoursAutorises,ss.formulesAutorisees,
    s&&s.allowedOffers,s&&s.formules,s&&s.parcours,s&&s.offerKeys,s&&s.allowedOffer,s&&s.formule
  ].forEach(v=>{
    if(Array.isArray(v)) raw.push(...v);
    else if(v&&typeof v==='object') raw.push(...Object.values(v));
    else if(v) raw.push(v);
  });
  return parseAllowedOffers(raw);
}
function subcatAllowsOffer(s,offer){
  const allowed=subcatAllowedOffers(s);
  if(!allowed.length) return true;
  const currentTokens=offerTokensForFilter(offer);
  return currentTokens.some(t=>allowed.includes(t));
}
function offerLabelFromAllowed(key){
  const labels={
    loisir:'Loisir',
    perf:'Academy',
    performance:'Academy',
    academy:'Academy',
    option:'Option',
    inclus:'Inclus',
    loisir_30:'Loisir 30 min',
    loisir_30_min:'Loisir 30 min',
    loisir_1h:'Loisir 1h',
    loisir_1_h:'Loisir 1h',
    perf_30:'Academy 30 min',
    perf_30_min:'Academy 30 min',
    performance_30:'Academy 30 min',
    performance_30_min:'Academy 30 min',
    academy_30:'Academy 30 min',
    academy_30_min:'Academy 30 min',
    perf_1h:'Academy 1h',
    perf_1_h:'Academy 1h',
    performance_1h:'Academy 1h',
    performance_1_h:'Academy 1h',
    academy_1h:'Academy 1h',
    academy_1_h:'Academy 1h'
  };
  if(labels[key]) return labels[key];
  return String(key||'')
    .replace(/_/g,' ')
    .replace(/\bperf\b/gi,'Academy')
    .replace(/\bloisir\b/gi,'Loisir')
    .replace(/\boption\b/gi,'Option')
    .replace(/\binclus\b/gi,'Inclus')
    .replace(/\b30\b/g,'30 min')
    .replace(/\s+/g,' ')
    .trim();
}
function allowedOfferBadges(s){
  const allowed=subcatAllowedOffers(s);
  if(!allowed.length) return '';
  return `<div class="season-subcat-offers">${allowed.map(x=>`<span>${esc(offerLabelFromAllowed(x))}</span>`).join('')}</div>`;
}

function isLinkedOnlySubcat(s){
  const ss=subcatSeason(s);
  if(ss.showOnSeason===false || ss.hideOnSeason===true || ss.hiddenOnSeason===true) return true;
  const allowed=subcatAllowedOffers(s);
  return allowed.includes('inclus');
}
function publicSeasonSubcats(item){
  return ((item&&item.subcats)||[]).filter(s=>!isLinkedOnlySubcat(s));
}

function refreshSubcatOfferFilter(activityId){
  const item=itemList().find(x=>String(x.id)===String(activityId));
  if(!item) return;
  const offer=activeOfferForItem(item);
  const subs=publicSeasonSubcats(item);
  const visibleSubs=subs.filter(s=>subcatAllowsOffer(s,offer));
  const visibleKeys=visibleSubs.map(subcatKey);
  const selected=selectedSeasonSubcats[item.id]||'';
  if((!selected || !visibleKeys.includes(selected)) && visibleKeys.length===1){
    selectedSeasonSubcats[item.id]=visibleKeys[0];
  }else if(selected && !visibleKeys.includes(selected)){
    selectedSeasonSubcats[item.id]='';
  }
  const safeActivity=window.CSS&&CSS.escape?CSS.escape(activityId):String(activityId).replace(/[^a-zA-Z0-9_-]/g,'\\$&');
  document.querySelectorAll(`.season-subcat[data-activity="${safeActivity}"]`).forEach(btn=>{
    const key=btn.getAttribute('data-subcat')||'';
    const ok=visibleKeys.includes(key);
    btn.hidden=!ok;
    btn.classList.toggle('selected', ok && selectedSeasonSubcats[item.id]===key);
  });
  document.querySelectorAll(`[id^="season-subcat-detail-${safeActivity}-"]`).forEach(el=>{
    const key=el.getAttribute('data-subcat')||'';
    const ok=visibleKeys.includes(key);
    el.hidden=!ok;
    if(!ok || selectedSeasonSubcats[item.id]!==key) el.classList.remove('open');
  });
  const empty=document.getElementById(`season-subcat-empty-${activityId}`);
  if(empty) empty.hidden=visibleKeys.length>0;
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
  return {key:subcatKey(s),name,title,day,time,level,age,note,price,maxSeats,seasonDetail,allowedOffers:subcatAllowedOffers(s)};
}
function renderSubcatDetails(activityId,s){
  const ss=subcatSeason(s);
  const lines=[];
  if(ss.day) lines.push(['Jour',ss.day]);
  if(ss.time) lines.push(['Horaire',ss.time]);
  if(ss.level) lines.push(['Niveau',ss.level]);
  if(ss.age) lines.push(['Âge',ss.age]);
  if(ss.price) lines.push(['Tarif spécifique',ss.price]);
  const maxSeats=Number(ss.maxSeats||ss.placesMax||ss.capacity||0)||0;
  if(maxSeats>0) lines.push(['Places disponibles',maxSeats+' maximum']);
  const lineHtml=lines.length?`<div class="season-subcat-detail-grid">${lines.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`:'';
  const note=ss.note?`<p class="season-subcat-detail-note">${esc(ss.note)}</p>`:'';
  if(!lineHtml&&!note) return '';
  return `<div class="season-subcat-detail" id="season-subcat-detail-${esc(activityId)}-${esc(subcatKey(s))}" data-subcat="${esc(subcatKey(s))}">${lineHtml}${note}</div>`;
}
function renderSubcats(i){
  const subs=publicSeasonSubcats(i);
  if(!subs.length) return '';
  const selected=selectedSeasonSubcats[i.id]||'';
  const activeOffer=activeOfferForItem(i);
  const offerLabel=activeOffer?(activeOffer.label||activeOffer.key||'formule'):'';
  return `<div class="season-subcats"><div class="season-subcats-title">Groupes / horaires</div><div class="season-subcats-help">Choisis d’abord la formule puis le groupe concerné : le paiement sera pré-rempli avec ce choix.</div><div class="season-subcats-empty" id="season-subcat-empty-${esc(i.id)}" hidden>Aucun groupe compatible avec ${esc(offerLabel)} pour le moment.</div><div class="season-subcats-grid">${subs.map(s=>{const ss=subcatSeason(s);const key=subcatKey(s);const bits=[ss.day,ss.time,ss.level].filter(Boolean);const visible=subcatAllowsOffer(s,activeOffer);const active=selected&&selected===key&&visible;return `<button type="button" class="season-subcat${active?' selected':''}" ${visible?'':'hidden'} data-activity="${esc(i.id)}" data-subcat="${esc(key)}" data-fts-click="selectSeasonSubcat('${esc(i.id)}','${esc(key)}')"><strong>${esc(ss.title||subcatName(s))}</strong>${bits.length?`<div class="season-subcat-meta">${bits.map(esc).join(' · ')}</div>`:''}${allowedOfferBadges(s)}${ss.note?`<div class="season-subcat-note">${esc(ss.note)}</div>`:''}${ss.price?`<div class="season-subcat-price">${esc(ss.price)}</div>`:''}${Number(ss.maxSeats||ss.placesMax||ss.capacity||0)>0?`<div class="season-subcat-capacity">${esc(String(Number(ss.maxSeats||ss.placesMax||ss.capacity||0)))} places max</div>`:''}<span class="season-subcat-check">✓</span></button>`}).join('')}</div>${subs.map(s=>renderSubcatDetails(i.id,s)).join('')}</div>`;
}
function selectSeasonSubcat(activityId,subcatId){
  selectedSeasonSubcats[activityId]=subcatId;
  const safeActivity=window.CSS&&CSS.escape?CSS.escape(activityId):activityId.replace(/[^a-zA-Z0-9_-]/g,'\\$&');
  document.querySelectorAll(`.season-subcat[data-activity="${safeActivity}"]`).forEach(btn=>btn.classList.toggle('selected',btn.getAttribute('data-subcat')===subcatId));
  document.querySelectorAll(`[id^="season-subcat-detail-${safeActivity}-"]`).forEach(el=>el.classList.remove('open'));
  const detail=document.getElementById(`season-subcat-detail-${activityId}-${subcatId}`);
  if(detail) detail.classList.add('open');
}
function renderOffers(i){const offers=i.offers||[];const tabs=offers.length>1?`<div class="tabs">${offers.map((o,idx)=>`<button class="tab ${idx===0?'act':''} ${esc(o.style||o.key)}" data-fts-click="switchTab('${esc(i.id)}','${esc(o.key)}',this)">${esc(o.label||o.key)}</button>`).join('')}</div>`:'';return tabs+offers.map((o,idx)=>`<div class="tab-content ${idx===0?'act':''}" id="${esc(i.id)}-${esc(o.key)}"><div class="c-main ${o.style==='perf'?'perf':''}">${o.main||''}</div>${renderBullets(o.bullets)}${renderOfferBox(o,i)}</div>`).join('');}
function renderBullets(bullets){if(!bullets||!bullets.length)return'';return `<ul class="c-list">${bullets.map(b=>{const gift=String(b).includes('🎁');const warn=String(b).includes('💰');return `<li class="${gift?'gift':warn?'warn':'incl'}"><span class="icon">${gift?'🎁':warn?'💰':'✔'}</span><span>${esc(String(b).replace(/^([✔⚡🎁💰])\s*/,'')).replace(/Offert :/,'<strong>Offert :</strong>')}</span></li>`}).join('')}</ul>`}
function renderOfferBox(o,i){const rawLink=String(o.link||saison.inscriptionDefault||'').trim();const link=(rawLink&&rawLink!=='#')?FTS.safeUrl(rawLink,''):'';const paymentBtn=renderPaymentButton(i,o);const soon=(!link&&!paymentBtn)?`<span class="btn-register muted">Lien bientôt disponible</span>`:'';return `<div class="offer-box"><div><div class="offer-price">${esc(o.price||'Tarif à venir')} ${o.price?'<small>/ saison</small>':''}</div>${o.priceNote?`<div class="offer-note">${esc(o.priceNote)}</div>`:''}</div><div class="offer-actions">${link?`<a class="btn-register" href="${esc(link)}" target="_blank" rel="noopener">S'inscrire</a>`:''}${paymentBtn}${soon}</div></div>`;}


/* ── Paiement HelloAsso public contrôlé ────────────────────────────── */
function ftsPaymentApiBase(){return String((FTS.PAYMENT&&FTS.PAYMENT.workerUrl)||'').replace(/\/+$/,'');}
function ftsCanShowPayment(){return !!(ftsPaymentApiBase() && !ftsPaymentApiBase().includes('REMPLACER_PAR_URL_WORKER'));}
function priceChoices(priceLabel){
  const raw=String(priceLabel||'').replace(',', '.');
  const matches=raw.match(/\d+(?:\.\d{1,2})?/g)||[];
  const out=[];
  matches.forEach(m=>{const cents=Math.round(Number(m)*100); if(Number.isFinite(cents)&&cents>=100&&!out.some(x=>x.cents===cents)) out.push({cents,label:(cents/100).toFixed(2).replace('.', ',')+' €'});});
  return out;
}
function hasPriceChoice(prices,cents){return (prices||[]).some(p=>Number(p.cents)===Number(cents));}
function automaticAmountForSelection(item,offer,subcat,prices){
  if(!item||!offer||!subcat||!prices||!prices.length) return null;
  const activity=norm(item.id||item.name||'');
  const offerKey=norm(offer.key||offer.label||'');
  const subKey=norm(subcat.key||subcat.name||subcat.title||'');
  const subLabel=norm(subcat.title||subcat.name||'');
  const text=(subKey+' '+subLabel).trim();

  // Danse Loisir : Baby Show et Enfants restent à 180 €, Ados/Adultes à 200 €.
  if(activity==='danse' && offerKey==='loisir' && hasPriceChoice(prices,18000) && hasPriceChoice(prices,20000)){
    return text.includes('ados') || text.includes('adultes') ? 20000 : 18000;
  }

  // Comédie musicale Loisir : Kids 7/9 ans à 280 €, Enfants 10+ et Adultes à 360 €.
  if(activity==='comedie_musicale' && offerKey==='loisir' && hasPriceChoice(prices,28000) && hasPriceChoice(prices,36000)){
    return text.includes('kids') || text.includes('7_9') ? 28000 : 36000;
  }

  const subPrices=priceChoices(subcat.price||subcat.tarif||'');
  if(subPrices.length===1 && hasPriceChoice(prices,subPrices[0].cents)) return subPrices[0].cents;
  return null;
}
function lockedPriceLabel(cents){return euroFromCents(cents)+' · automatique';}
const FTS_INSTALLMENT_NOTICE='Le paiement en plusieurs fois est une facilité de paiement, et non un abonnement. En le choisissant, vous vous engagez à régler l’intégralité du montant de la saison selon l’échéancier prévu.';
const FTS_INSTALLMENT_ACK='J’ai compris que le paiement en plusieurs fois est une facilité de paiement, et non un abonnement, et je m’engage à régler la totalité du montant dû pour la saison.';
function isMultiPaymentPlan(plan){return (Number(String(plan||'1x').replace('x',''))||1)>1;}
function installmentInfoHtml(prefix){return `<div id="${prefix}-installment-notice" class="fts-installment-notice" hidden><strong>Important :</strong> ${esc(FTS_INSTALLMENT_NOTICE)}</div><label id="${prefix}-installment-ack-wrap" class="fts-installment-ack" hidden><input type="checkbox" name="installmentAck"> <span>${esc(FTS_INSTALLMENT_ACK)}</span></label>`;}
function installmentRecapHtml(prefix){return `<div id="${prefix}-installment-recap" class="fts-installment-recap" hidden><strong>Récapitulatif :</strong> ${esc(FTS_INSTALLMENT_NOTICE)}</div>`;}
function syncInstallmentInfo(form,prefix){if(!form||!form.paymentPlan)return;const multi=isMultiPaymentPlan(form.paymentPlan.value);const notice=document.getElementById(prefix+'-installment-notice');const wrap=document.getElementById(prefix+'-installment-ack-wrap');const recap=document.getElementById(prefix+'-installment-recap');const input=wrap&&wrap.querySelector('input[name="installmentAck"]');[notice,wrap,recap].forEach(el=>{if(el)el.hidden=!multi;});if(input){input.required=multi;if(!multi)input.checked=false;}}
function validateInstallmentAck(form,prefix){syncInstallmentInfo(form,prefix);if(!form||!isMultiPaymentPlan(form.paymentPlan&&form.paymentPlan.value))return;const input=document.querySelector('#'+prefix+'-installment-ack-wrap input[name="installmentAck"]');if(input&&!input.checked){input.focus();throw new Error('Merci de confirmer que le paiement en plusieurs fois est une facilité de paiement et engage le règlement complet de la saison.');}}
function renderPaymentButton(item,offer){
  if(!ftsCanShowPayment()) return '';
  const prices=priceChoices(offer&&offer.price);
  if(!prices.length) return '<span class="btn-register muted">Paiement indisponible</span>';
  return `<button type="button" class="btn-register fts-pay-btn fts-direct-pay" data-fts-click="openSeasonPayment('${esc(item.id)}','${esc(offer.key)}')">Payer seul</button>`;
}
function selectedSeasonSubcat(item){
  const subs=publicSeasonSubcats(item);
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
  div.innerHTML=`<div class="fts-payment-card"><button type="button" class="fts-payment-close" data-fts-click="closeSeasonPayment()">×</button><div class="eyebrow">Paiement sécurisé HelloAsso</div><h2 id="fts-pay-title">Règlement Fais Ton Show</h2><p id="fts-pay-summary" class="fts-pay-summary"></p><form id="fts-pay-form"><div class="fts-pay-section-title">Responsable / payeur</div><div class="fts-pay-grid"><label>Prénom responsable<input name="firstName" autocomplete="given-name" required></label><label>Nom responsable<input name="lastName" autocomplete="family-name" required></label><label>Email responsable<input name="email" type="email" autocomplete="email" required></label><label>Téléphone responsable<input name="phone" type="tel" autocomplete="tel" required></label></div><div class="fts-pay-section-title">Participant / élève</div><div class="fts-pay-grid"><label>Prénom participant<input name="studentFirstName" required></label><label>Nom participant<input name="studentLastName" required></label><label>Téléphone d'urgence<input name="emergencyPhone" type="tel" required></label><label id="fts-pay-sub-wrap">Groupe<select name="subcategoryId"></select></label><label>Montant<select name="amountCents"></select></label><label>Paiement<select name="paymentPlan"></select></label></div>${installmentInfoHtml('fts-pay')}<div id="fts-pay-schedule-preview" class="fts-pay-schedule-preview"></div>${installmentRecapHtml('fts-pay')}<div class="promo-field"><label>Code promo / code spécial <input name="promoCode" placeholder="Optionnel : réduction, gratuité ou chèque/espèces"></label></div><button class="btn-register fts-pay-submit" type="submit">Continuer</button><div id="fts-pay-msg" class="fts-pay-msg"></div></form></div>`;
  document.body.appendChild(div);
  document.getElementById('fts-pay-form').addEventListener('submit',submitSeasonPayment);
}
function openSeasonPayment(activityId,offerKey){
  const item=itemList().find(x=>String(x.id)===String(activityId));
  const offer=item&&(item.offers||[]).find(o=>String(o.key)===String(offerKey));
  if(!item||!offer){alert('Formule introuvable.');return;}
  const prices=priceChoices(offer.price);
  if(!prices.length){alert('Tarif non reconnu pour cette formule.');return;}
  selectedSeasonOffers[item.id]=offer.key;
  refreshSubcatOfferFilter(item.id);
  const chosenSubcat=selectedSeasonSubcat(item);
  if(chosenSubcat && !subcatAllowsOffer((item.subcats||[]).find(s=>subcatKey(s)===chosenSubcat.key), offer)){
    alert('Ce groupe n’est pas disponible pour cette formule. Choisis un groupe compatible.');
    return;
  }
  if((item.subcats||[]).length && !chosenSubcat){
    alert('Choisis d’abord le groupe / horaire concerné avant de lancer le paiement.');
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
  const phone=profile.phone||profile.tel||profile.telephone||'';
  document.getElementById('fts-pay-title').textContent=(item.name||'Activité')+' · '+(offer.label||offer.key||'Formule');
  document.getElementById('fts-pay-summary').innerHTML=`<strong>${esc(item.name)}</strong><br>Formule : <strong>${esc(offer.label||offer.key)}</strong><br>${chosenSubcat?`Groupe : <strong>${esc(chosenSubcat.title||chosenSubcat.name)}</strong>${chosenSubcat.seasonDetail?`<br><span class="fts-pay-subdetail">${esc(chosenSubcat.seasonDetail)}</span>`:''}<br>`:''}Saison : <strong>${esc((saison.meta&&saison.meta.year)||'')}</strong>`;
  const form=document.getElementById('fts-pay-form');
  form.firstName.value=first; form.lastName.value=last; form.email.value=email; form.phone.value=phone; form.studentFirstName.value=''; form.studentLastName.value=''; form.emergencyPhone.value='';
  renderPaymentPlanSelect(form.paymentPlan);
  const updatePreview=()=>{updatePaymentSchedulePreview('fts-pay-schedule-preview',Number(form.amountCents.value||0),form.paymentPlan.value);syncInstallmentInfo(form,'fts-pay');};
  const refreshAmountForSubcat=()=>{
    const currentSubcat=findSeasonSubcat(item,form.subcategoryId.value)||chosenSubcat||{key:'principal',name:'Groupe principal',title:'Groupe principal',price:''};
    const automatic=automaticAmountForSelection(item,offer,currentSubcat,prices);
    if(automatic){
      form.amountCents.innerHTML=`<option value="${automatic}">${esc(lockedPriceLabel(automatic))}</option>`;
      form.amountCents.value=String(automatic);
      form.amountCents.disabled=true;
      form.amountCents.title='Montant choisi automatiquement selon le groupe sélectionné.';
    }else{
      form.amountCents.disabled=false;
      form.amountCents.title='';
      form.amountCents.innerHTML=prices.map(p=>`<option value="${p.cents}">${esc(p.label)}</option>`).join('');
    }
    updatePreview();
  };
  form.amountCents.onchange=updatePreview;
  form.paymentPlan.onchange=updatePreview;
  const subs=item.subcats||[];
  const wrap=document.getElementById('fts-pay-sub-wrap');
  if(subs.length){const compatibleSubs=publicSeasonSubcats(item).filter(s=>subcatAllowsOffer(s,offer));wrap.style.display='grid';form.subcategoryId.innerHTML=compatibleSubs.map(s=>{const sub=subcatPaymentInfo(s);const label=sub.seasonDetail?`${sub.title||sub.name} — ${sub.seasonDetail}`:(sub.title||sub.name);return `<option value="${esc(sub.key)}">${esc(label)}</option>`}).join(''); if(chosenSubcat) form.subcategoryId.value=chosenSubcat.key; form.subcategoryId.onchange=refreshAmountForSubcat;}
  else{wrap.style.display='none';form.subcategoryId.innerHTML='<option value="principal">Groupe principal</option>';form.subcategoryId.onchange=null;}
  refreshAmountForSubcat();
  document.getElementById('fts-pay-msg').textContent='';
  document.getElementById('fts-season-payment-modal').classList.add('open');
}
function closeSeasonPayment(){const m=document.getElementById('fts-season-payment-modal');if(m)m.classList.remove('open');}
async function submitSeasonPayment(event){
  event.preventDefault();
  const msg=document.getElementById('fts-pay-msg');
  try{
    if(!ftsPaymentContext)throw new Error('Session paiement indisponible.');
    const token=ftsPaymentUser?await ftsPaymentUser.getIdToken(true):'';
    const form=event.target;
    validateInstallmentAck(form,'fts-pay');
    const item=ftsPaymentContext.item, offer=ftsPaymentContext.offer;
    const selectedSubcat=findSeasonSubcat(item,form.subcategoryId.value)||{key:form.subcategoryId.value,name:'Groupe principal',title:'Groupe principal',day:'',time:'',level:'',age:'',note:'',price:'',maxSeats:0,seasonDetail:''};
    const studentFirstName=String(form.studentFirstName.value||'').trim();
    const studentLastName=String(form.studentLastName.value||'').trim();
    const payload={type:'season_registration',source:'saison.html',returnPath:'paiement',activityId:item.id,offerKey:offer.key,amountCents:Number(form.amountCents.value),paymentPlan:form.paymentPlan.value,subcategoryId:selectedSubcat.key,subcategoryName:selectedSubcat.name,subcategoryTitle:selectedSubcat.title,subcategoryDay:selectedSubcat.day,subcategoryTime:selectedSubcat.time,subcategoryLevel:selectedSubcat.level,subcategoryAge:selectedSubcat.age,subcategoryNote:selectedSubcat.note,subcategoryPrice:selectedSubcat.price,subcategoryMaxSeats:Number(selectedSubcat.maxSeats||0)||0,subcategorySeasonDetail:selectedSubcat.seasonDetail,subcategoryAllowedOffers:selectedSubcat.allowedOffers||[],subcategory:selectedSubcat,payer:{firstName:form.firstName.value,lastName:form.lastName.value,email:form.email.value,phone:form.phone.value},student:{firstName:studentFirstName,lastName:studentLastName,name:[studentFirstName,studentLastName].filter(Boolean).join(' '),emergencyPhone:form.emergencyPhone.value},emergencyPhone:form.emergencyPhone.value,promoCode:form.promoCode?form.promoCode.value:''};
    msg.textContent='Création du paiement sécurisé…';
    const headers={'Content-Type':'application/json'}; if(token) headers.Authorization='Bearer '+token;
    const res=await fetch(ftsPaymentApiBase()+'/checkout',{method:'POST',headers,body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok){const labels={subcategory_full:'Ce groupe est complet : le nombre de places maximum est atteint.',subcategory_offer_not_allowed:'Ce groupe n’est pas disponible pour cette formule.',payment_access_denied:'Paiement non autorisé pour ce compte.',missing_payer_first_name:'Prénom responsable obligatoire.',missing_payer_last_name:'Nom responsable obligatoire.',invalid_payer_email:'Email responsable invalide.',missing_payer_phone:'Téléphone responsable obligatoire.',missing_student_first_name:'Prénom participant obligatoire.',missing_student_last_name:'Nom participant obligatoire.',missing_emergency_phone:'Téléphone d’urgence obligatoire.'};throw new Error(labels[data.error]||data.error||'Erreur création paiement');}
    if(data.redirectUrl){location.href=data.redirectUrl;}else if(data.confirmationUrl){location.href=data.confirmationUrl;}else{msg.textContent=data.offlinePending?'Inscription enregistrée. Paiement hors ligne à remettre à l’association.':'Inscription gratuite confirmée.';}
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


/* ── Panier mixte Saison + Boutique ─────────────────────────────── */
const FTS_SEASON_CART_KEY='fts_season_mixed_cart_v1';
let ftsSeasonCart={season:[],shop:[]};
let ftsCartProducts=[];
let ftsCartProductsLoaded=false;
let ftsDirectShopLines=[];
function cartId(prefix){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);}
function normalizePaymentOptionsFront(){
  const raw=(saison&&saison.paymentOptions)||{};
  const allowed=Array.isArray(raw.allowedPlans)
    ? raw.allowedPlans
        .map(x=>{
          const s=String(x||'').trim().toLowerCase();
          if(/^([1-9]|1[0-2])x$/.test(s)) return s;
          if(/^([1-9]|1[0-2])$/.test(s)) return s+'x';
          return '';
        })
        .filter(Boolean)
        .filter((x,i,arr)=>arr.indexOf(x)===i)
    : ['1x','3x','5x','10x'];
  const first={}; const src=raw.firstInstallmentPercents&&typeof raw.firstInstallmentPercents==='object'?raw.firstInstallmentPercents:{};
  for(let i=1;i<=12;i++){
    const n=String(i);
    const k=i+'x';
    const fallback=i===1?100:Math.round((100/i)*100)/100;
    const rawValue=src[k]!==undefined?src[k]:src[n];
    first[k]=Math.min(100,Math.max(1,Number(rawValue||0)||fallback));
  }
  return {allowedPlans:allowed.length?allowed:['1x'],firstInstallmentPercents:first,installmentDay:Math.min(27,Math.max(1,Number(raw.installmentDay||10)||10))};
}
function paymentPlanLabel(plan){const n=Number(String(plan).replace('x',''))||1;return n===1?'Paiement en 1 fois':'Paiement en '+n+' fois';}
function renderPaymentPlanSelect(select){if(!select)return;const opts=normalizePaymentOptionsFront();select.innerHTML=opts.allowedPlans.map(p=>`<option value="${esc(p)}">${esc(paymentPlanLabel(p))}</option>`).join('');}
function splitPreview(amount,count){if(!count)return[];const base=Math.floor(amount/count);const rest=amount-base*count;return Array.from({length:count},(_,i)=>base+(i<rest?1:0));}
function paymentSchedulePreview(amount,plan){const opts=normalizePaymentOptionsFront();const count=Number(String(plan).replace('x',''))||1;if(count<=1)return {initial:amount,future:[],percent:100};const percent=Number(opts.firstInstallmentPercents[plan]||(100/count));const initial=Math.max(100,Math.ceil(amount*percent/100));return {initial,future:splitPreview(Math.max(0,amount-initial),count-1),percent};}
function updatePaymentSchedulePreview(id,amount,plan){const el=document.getElementById(id);if(!el)return;const s=paymentSchedulePreview(amount,plan);const count=Number(String(plan).replace('x',''))||1;if(!amount){el.innerHTML='';return;}el.innerHTML=count<=1?`<strong>${esc(euroFromCents(amount))}</strong> réglé en une fois.`:`<strong>1ère échéance : ${esc(euroFromCents(s.initial))}</strong> (${String(s.percent).replace('.',',')}%) · puis ${s.future.length} échéance(s) d’environ ${esc(euroFromCents(s.future[0]||0))}.`;}
function euroFromCents(cents){return (Number(cents||0)/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});}
function loadCart(){try{ftsSeasonCart=JSON.parse(localStorage.getItem(FTS_SEASON_CART_KEY)||'{}')||{};}catch(e){ftsSeasonCart={};}if(!Array.isArray(ftsSeasonCart.season))ftsSeasonCart.season=[];if(!Array.isArray(ftsSeasonCart.shop))ftsSeasonCart.shop=[];normalizeCartSeasonAmounts();}
function normalizeCartSeasonAmounts(){
  let changed=false;
  (ftsSeasonCart.season||[]).forEach(l=>{
    const item=itemList().find(x=>String(x.id)===String(l.activityId));
    const offer=item&&(item.offers||[]).find(o=>String(o.key)===String(l.offerKey));
    const prices=Array.isArray(l.prices)&&l.prices.length?l.prices:(offer?priceChoices(offer.price):[]);
    const automatic=automaticAmountForSelection(item,offer,l.subcategory,prices);
    if(automatic){l.amountCents=automatic;l.lockedAmount=true;changed=true;}
  });
  if(changed) localStorage.setItem(FTS_SEASON_CART_KEY,JSON.stringify(ftsSeasonCart));
}
function saveCart(){localStorage.setItem(FTS_SEASON_CART_KEY,JSON.stringify(ftsSeasonCart));renderCartBubble();}
function cartCount(){return (ftsSeasonCart.season||[]).length+(ftsSeasonCart.shop||[]).reduce((s,x)=>s+Math.max(1,Number(x.quantity||1)||1),0);}
function renderCartBubble(){ensureSeasonCartShell();const n=cartCount();const b=document.getElementById('fts-cart-bubble');if(b){b.hidden=!n;b.querySelector('strong').textContent=String(n);}}
async function loadCartProducts(){if(ftsCartProductsLoaded)return;ftsCartProductsLoaded=true;try{const res=await fetch(ftsPaymentApiBase()+'/catalog/products',{method:'GET',headers:{'Content-Type':'application/json'}});const data=await res.json().catch(()=>({}));ftsCartProducts=Array.isArray(data.products)?data.products:[];}catch(e){console.warn('[FTS panier] produits boutique indisponibles',e);ftsCartProducts=[];}}
function productOptions(text){return String(text||'').split(/\n+/).map((line,i)=>{const parts=line.split(':');if(parts.length<2)return null;const name=parts.shift().trim();const values=parts.join(':').split(',').map(v=>v.trim()).filter(Boolean);return name&&values.length?{name,key:norm(name)||('opt_'+i),values}:null;}).filter(Boolean);}
function seasonLineFrom(activityId,offerKey){const item=itemList().find(x=>String(x.id)===String(activityId));const offer=item&&(item.offers||[]).find(o=>String(o.key)===String(offerKey));if(!item||!offer)throw new Error('Formule introuvable.');const prices=priceChoices(offer.price);if(!prices.length)throw new Error('Tarif non reconnu.');selectedSeasonOffers[item.id]=offer.key;refreshSubcatOfferFilter(item.id);const chosen=selectedSeasonSubcat(item);if((item.subcats||[]).length&&!chosen)throw new Error('Choisis d’abord le groupe / horaire concerné avant d’ajouter au panier.');const subcat=chosen||{key:'principal',name:'Groupe principal',title:'Groupe principal',day:'',time:'',level:'',age:'',note:'',price:'',maxSeats:0,seasonDetail:'',allowedOffers:[]};const automatic=automaticAmountForSelection(item,offer,subcat,prices);return {id:cartId('season'),type:'season_registration',activityId:item.id,activityName:item.name,offerKey:offer.key,offerLabel:offer.label||offer.key,prices,amountCents:automatic||prices[0].cents,lockedAmount:!!automatic,subcategory:subcat};}
function addSeasonToCart(activityId,offerKey){try{loadCart();const line=seasonLineFrom(activityId,offerKey);ftsSeasonCart.season.push(line);saveCart();openSeasonCart();}catch(e){alert(e&&e.message?e.message:e);}}
function removeCartLine(kind,id){loadCart();ftsSeasonCart[kind]=(ftsSeasonCart[kind]||[]).filter(x=>String(x.id)!==String(id));saveCart();renderSeasonCart();}
function updateCartSeasonAmount(id,value){const l=(ftsSeasonCart.season||[]).find(x=>String(x.id)===String(id));if(l){l.amountCents=Number(value)||l.amountCents;l.linkedOptions=[];saveCart();renderSeasonCart();}}
function addShopToCart(productId){const p=ftsCartProducts.find(x=>String(x.id)===String(productId));if(!p)return;const card=document.querySelector(`[data-cart-product="${CSS.escape(String(productId))}"]`);const variants={};if(card)card.querySelectorAll('[data-cart-option]').forEach(sel=>{variants[sel.getAttribute('data-cart-option')]=sel.value;});const quantity=card?Math.max(1,Math.min(20,Math.round(Number(card.querySelector('[data-cart-qty]').value||1))||1)):1;loadCart();ftsSeasonCart.shop.push({id:cartId('shop'),type:'shop_order',productId:p.id,productName:p.name||p.title||'Article',unitPriceCents:Number(p.priceCents||0)||0,quantity,variants});saveCart();renderSeasonCart();}
function directShopLineAmount(line){return Number(line&&line.unitPriceCents||0)*Math.max(1,Number(line&&line.quantity||1)||1);}
function directShopTotal(){return (ftsDirectShopLines||[]).reduce((sum,line)=>sum+directShopLineAmount(line),0);}
function currentDirectLinkedTotal(){const form=document.getElementById('fts-pay-form'),root=document.getElementById('fts-pay-linked-options');if(!form||!root||!ftsPaymentContext)return 0;const item=ftsPaymentContext.item,offer=ftsPaymentContext.offer,subcat=findSeasonSubcat(item,form.subcategoryId.value)||{key:'principal',name:'Groupe principal',title:'Groupe principal'};try{return linkedSelectionsTotal(collectLinkedOptionsFrom(root,item,offer,subcat,Number(form.amountCents.value||0)||0));}catch(e){return 0;}}
function refreshDirectPaymentTotals(){const form=document.getElementById('fts-pay-form');if(!form)return;updatePaymentSchedulePreview('fts-pay-schedule-preview',Number(form.amountCents.value||0)+currentDirectLinkedTotal()+directShopTotal(),form.paymentPlan.value);}
function directShopVariantsFrom(card){const variants={};if(card)card.querySelectorAll('[data-direct-option]').forEach(sel=>{variants[sel.getAttribute('data-direct-option')]=sel.value;});return variants;}
function renderDirectShopSuggestions(){if(!ftsCartProducts.length)return '<section class="fts-cart-section"><h3>Boutique</h3><p class="fts-cart-muted">Aucun article boutique disponible pour le moment.</p></section>';return `<section class="fts-cart-section"><h3>Completer avec la boutique</h3><p class="fts-cart-muted">Ajoute un t-shirt, sac ou goodie a ton inscription avant de continuer.</p><div class="fts-cart-products">${ftsCartProducts.slice(0,8).map(p=>{const opts=productOptions(p.variantsText);return `<article class="fts-cart-product" data-direct-product="${esc(p.id)}"><div>${p.imageUrl?`<img src="${esc(p.imageUrl)}" alt="">`:'Boutique'}</div><strong>${esc(p.name||p.title||'Article')}</strong><small>${esc(euroFromCents(p.priceCents))}</small>${opts.map(o=>`<label>${esc(o.name)}<select data-direct-option="${esc(o.name)}" required>${o.values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`).join('')}<label>Qte<input data-direct-qty type="number" min="1" max="20" value="1"></label><button type="button" class="fts-admin-primary" onclick="addDirectShopLine('${esc(p.id)}')">Ajouter</button></article>`}).join('')}</div></section>`;}
function renderDirectShopLines(){const box=document.getElementById('fts-pay-shop-lines');if(!box)return;box.innerHTML=ftsDirectShopLines.length?`<section class="fts-cart-section"><h3>Articles ajoutes</h3>${ftsDirectShopLines.map(l=>`<article class="fts-cart-line"><div><strong>${esc(l.productName)}</strong><small>${esc(Object.entries(l.variants||{}).map(([k,v])=>k+': '+v).join(' · ')||'Boutique')} · quantite ${esc(String(l.quantity||1))}</small></div><strong>${esc(euroFromCents(directShopLineAmount(l)))}</strong><button type="button" class="btn-outline" onclick="removeDirectShopLine('${esc(l.id)}')">Retirer</button></article>`).join('')}</section>`:'';refreshDirectPaymentTotals();}
function renderDirectShopBlock(){const box=document.getElementById('fts-pay-shop');if(!box)return;box.innerHTML=renderDirectShopSuggestions()+'<div id="fts-pay-shop-lines"></div>';renderDirectShopLines();}
function addDirectShopLine(productId){const p=ftsCartProducts.find(x=>String(x.id)===String(productId));if(!p)return;const card=document.querySelector(`[data-direct-product="${CSS.escape(String(productId))}"]`);const quantity=card?Math.max(1,Math.min(20,Math.round(Number(card.querySelector('[data-direct-qty]').value||1))||1)):1;ftsDirectShopLines.push({id:cartId('shop'),type:'shop_order',productId:p.id,productName:p.name||p.title||'Article',unitPriceCents:Number(p.priceCents||0)||0,quantity,variants:directShopVariantsFrom(card)});renderDirectShopLines();}
function removeDirectShopLine(id){ftsDirectShopLines=(ftsDirectShopLines||[]).filter(x=>String(x.id)!==String(id));renderDirectShopLines();}
function ensureSeasonCartShell(){if(document.getElementById('fts-season-cart-modal'))return;const bubble=document.createElement('button');bubble.id='fts-cart-bubble';bubble.type='button';bubble.hidden=true;bubble.className='fts-cart-bubble';bubble.innerHTML='🛒 <strong>0</strong>';bubble.addEventListener('click',openSeasonCart);document.body.appendChild(bubble);const modal=document.createElement('div');modal.id='fts-season-cart-modal';modal.className='fts-payment-modal fts-cart-modal';modal.innerHTML=`<div class="fts-payment-card fts-cart-card"><button type="button" class="fts-payment-close" data-cart-close>×</button><div class="eyebrow">Panier Saison + Boutique</div><h2>Finaliser mon inscription</h2><div id="fts-cart-content"></div></div>`;document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-cart-close]'))modal.classList.remove('open');});}
async function openSeasonCart(){ensureSeasonCartShell();loadCart();await loadCartProducts();renderSeasonCart();document.getElementById('fts-season-cart-modal').classList.add('open');}
function renderSeasonCart(){ensureSeasonCartShell();const box=document.getElementById('fts-cart-content');if(!box)return;const seasonLines=ftsSeasonCart.season||[];const shopLines=ftsSeasonCart.shop||[];const total=seasonLines.reduce((s,x)=>s+Number(x.amountCents||0),0)+shopLines.reduce((s,x)=>s+(Number(x.unitPriceCents||0)*Math.max(1,Number(x.quantity||1)||1)),0);const profile=ftsPaymentProfile||{};const email=(ftsPaymentUser&&ftsPaymentUser.email)||profile.email||'';const first=profile.firstName||profile.prenom||'';const last=profile.lastName||profile.nom||'';const phone=profile.phone||profile.tel||profile.telephone||'';box.innerHTML=`${!seasonLines.length&&!shopLines.length?'<div class="fts-cart-empty">Ton panier est vide. Ajoute une ou plusieurs activités.</div>':''}${seasonLines.length?`<section class="fts-cart-section"><h3>Activités choisies</h3>${seasonLines.map(l=>`<article class="fts-cart-line"><div><strong>${esc(l.activityName)}</strong><small>${esc(l.offerLabel)} · ${esc((l.subcategory&&l.subcategory.title)||(l.subcategory&&l.subcategory.name)||'Groupe principal')}</small></div>${l.lockedAmount?`<strong title="Montant choisi automatiquement selon le groupe">${esc(lockedPriceLabel(l.amountCents))}</strong>`:`<select onchange="updateCartSeasonAmount('${esc(l.id)}',this.value)">${(l.prices||[]).map(p=>`<option value="${p.cents}" ${Number(l.amountCents)===Number(p.cents)?'selected':''}>${esc(p.label)}</option>`).join('')}</select>`}<button type="button" onclick="removeCartLine('season','${esc(l.id)}')">Retirer</button></article>`).join('')}</section>`:''}${renderCartShopSuggestions()}${shopLines.length?`<section class="fts-cart-section"><h3>Articles ajoutés</h3>${shopLines.map(l=>`<article class="fts-cart-line"><div><strong>${esc(l.productName)}</strong><small>${esc(Object.entries(l.variants||{}).map(([k,v])=>k+': '+v).join(' · ')||'Boutique')} · quantité ${esc(String(l.quantity||1))}</small></div><strong>${esc(euroFromCents(Number(l.unitPriceCents||0)*Number(l.quantity||1)))}</strong><button type="button" onclick="removeCartLine('shop','${esc(l.id)}')">Retirer</button></article>`).join('')}</section>`:''}<form id="fts-cart-form" class="fts-cart-form"><div class="fts-pay-section-title">Responsable / payeur</div><div class="fts-pay-grid"><label>Prénom responsable<input name="firstName" required value="${esc(first)}"></label><label>Nom responsable<input name="lastName" required value="${esc(last)}"></label><label>Email responsable<input name="email" type="email" required value="${esc(email)}"></label><label>Téléphone responsable<input name="phone" type="tel" required value="${esc(phone)}"></label></div><div class="fts-pay-section-title">Participant / élève</div><div class="fts-pay-grid"><label>Prénom participant<input name="studentFirstName" required></label><label>Nom participant<input name="studentLastName" required></label><label>Téléphone d'urgence<input name="emergencyPhone" type="tel" required></label><label>Paiement<select name="paymentPlan"></select></label></div>${installmentInfoHtml('fts-cart')}<div id="fts-cart-schedule-preview" class="fts-pay-schedule-preview"></div>${installmentRecapHtml('fts-cart')}<div class="promo-field"><label>Code promo / code spécial <input name="promoCode" placeholder="Optionnel"></label></div><div class="fts-cart-total"><span>Total</span><strong>${esc(euroFromCents(total))}</strong></div><button class="btn-register fts-pay-submit" type="submit" ${total?'':'disabled'}>Passer à la caisse</button><div id="fts-cart-msg" class="fts-pay-msg"></div></form>`;const form=document.getElementById('fts-cart-form');if(form){renderPaymentPlanSelect(form.paymentPlan);const update=()=>{updatePaymentSchedulePreview('fts-cart-schedule-preview',total,form.paymentPlan.value);syncInstallmentInfo(form,'fts-cart');};form.paymentPlan.onchange=update;update();form.addEventListener('submit',submitMixedCart);}}
function renderCartShopSuggestions(){if(!ftsCartProducts.length)return '<section class="fts-cart-section"><h3>Boutique</h3><p class="fts-cart-muted">Aucun article boutique disponible pour le moment.</p></section>';return `<section class="fts-cart-section"><h3>Compléter avec la boutique</h3><p class="fts-cart-muted">Ajoute un t-shirt, sac ou goodie à ton inscription avant de passer à la caisse.</p><div class="fts-cart-products">${ftsCartProducts.slice(0,8).map(p=>{const opts=productOptions(p.variantsText);return `<article class="fts-cart-product" data-cart-product="${esc(p.id)}"><div>${p.imageUrl?`<img src="${esc(p.imageUrl)}" alt="">`:'🛍️'}</div><strong>${esc(p.name||p.title||'Article')}</strong><small>${esc(euroFromCents(p.priceCents))}</small>${opts.map(o=>`<label>${esc(o.name)}<select data-cart-option="${esc(o.name)}" required>${o.values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`).join('')}<label>Qté<input data-cart-qty type="number" min="1" max="20" value="1"></label><button type="button" class="fts-admin-primary" onclick="addShopToCart('${esc(p.id)}')">Ajouter</button></article>`}).join('')}</div></section>`;}
async function submitMixedCart(e){e.preventDefault();const msg=document.getElementById('fts-cart-msg');try{loadCart();const seasonLines=ftsSeasonCart.season||[];const shopLines=ftsSeasonCart.shop||[];if(!seasonLines.length&&!shopLines.length)throw new Error('Le panier est vide.');const form=e.target;validateInstallmentAck(form,'fts-cart');const token=ftsPaymentUser?await ftsPaymentUser.getIdToken(true):'';const studentFirstName=String(form.studentFirstName.value||'').trim();const studentLastName=String(form.studentLastName.value||'').trim();const payload={type:'mixed_cart',source:'saison.html',returnPath:'paiement',paymentPlan:form.paymentPlan.value,promoCode:form.promoCode?form.promoCode.value:'',payer:{firstName:form.firstName.value,lastName:form.lastName.value,email:form.email.value,phone:form.phone.value},student:{firstName:studentFirstName,lastName:studentLastName,name:[studentFirstName,studentLastName].filter(Boolean).join(' '),emergencyPhone:form.emergencyPhone.value},emergencyPhone:form.emergencyPhone.value,seasonLines:seasonLines.map(l=>({type:'season_registration',activityId:l.activityId,offerKey:l.offerKey,amountCents:Number(l.amountCents||0),subcategoryId:l.subcategory&&l.subcategory.key,subcategoryName:l.subcategory&&l.subcategory.name,subcategoryTitle:l.subcategory&&l.subcategory.title,subcategoryDay:l.subcategory&&l.subcategory.day,subcategoryTime:l.subcategory&&l.subcategory.time,subcategoryLevel:l.subcategory&&l.subcategory.level,subcategoryAge:l.subcategory&&l.subcategory.age,subcategoryNote:l.subcategory&&l.subcategory.note,subcategoryPrice:l.subcategory&&l.subcategory.price,subcategoryMaxSeats:Number(l.subcategory&&l.subcategory.maxSeats||0)||0,subcategorySeasonDetail:l.subcategory&&l.subcategory.seasonDetail,subcategoryAllowedOffers:l.subcategory&&l.subcategory.allowedOffers||[],subcategory:l.subcategory})),shopLines:shopLines.map(l=>({type:'shop_order',productId:l.productId,quantity:Number(l.quantity||1),variants:l.variants||{}}))};msg.textContent='Création du paiement groupé…';const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;const res=await fetch(ftsPaymentApiBase()+'/checkout',{method:'POST',headers,body:JSON.stringify(payload)});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error((data&&data.error)||'Erreur création paiement');localStorage.removeItem(FTS_SEASON_CART_KEY);if(data.redirectUrl)location.href=data.redirectUrl;else if(data.confirmationUrl)location.href=data.confirmationUrl;else msg.textContent='Commande enregistrée.';}catch(err){msg.textContent='Impossible de lancer le paiement groupé : '+(err&&err.message?err.message:err);}}

/* ── Options liées Saison — affichage public + panier ───────────── */
function seasonFindItem(activityId){return itemList().find(x=>String(x.id)===String(activityId));}
function seasonFindOffer(item,offerKey){return item&&(item.offers||[]).find(o=>String(o.key)===String(offerKey));}
function seasonFindSubcatInfo(item,subcatId){return findSeasonSubcat(item,subcatId)||{key:subcatId||'principal',name:'Groupe principal',title:'Groupe principal',day:'',time:'',level:'',age:'',note:'',price:'',maxSeats:0,seasonDetail:'',allowedOffers:[]};}
function linkedRuleAmountCents(rule){
  const raw=rule&&(rule.appliesForAmountCents||rule.requiredForAmountCents);
  const list=Array.isArray(raw)?raw:(raw==null?[]:[raw]);
  return list.map(v=>Number(v)||0).filter(v=>v>0).filter((v,i,a)=>a.indexOf(v)===i);
}
function linkedRuleAmountMet(rule,amountCents){
  const amounts=linkedRuleAmountCents(rule);
  if(!amounts.length)return true;
  const selected=Number(amountCents||0)||0;
  return amounts.includes(selected);
}
function optionRuleApplies(rule,subcat,amountCents){if(!rule||rule.active===false)return false;const ids=Array.isArray(rule.subcategoryIds)?rule.subcategoryIds.filter(Boolean):[];if(ids.length&&!ids.map(String).includes(String(subcat&&subcat.key||'')))return false;return linkedRuleAmountMet(rule,amountCents);}
function selectedCategoriesFromLinkedSelections(selections){
  const set=new Set();
  (selections||[]).forEach(rule=>(rule.choices||[]).forEach(choice=>{if(choice&&choice.categoryId)set.add(String(choice.categoryId));}));
  return set;
}
function selectedCategoriesFromLinkedRoot(root){
  const set=new Set();
  if(!root)return set;
  root.querySelectorAll('input[data-category-id]:checked').forEach(input=>{const id=input.getAttribute('data-category-id');if(id)set.add(String(id));});
  return set;
}
function linkedRuleDependencyIds(rule){
  const raw=rule&&(rule.dependsOnChoiceCategoryIds||rule.dependsOnCategoryIds||rule.showIfChoiceCategoryIds||rule.requiresSelectedCategoryIds||rule.requiresChoiceCategoryIds);
  return Array.isArray(raw)?raw.map(x=>String(x||'').trim()).filter(Boolean):[];
}
function linkedRuleDependencyMet(rule,selectedCategories){
  const deps=linkedRuleDependencyIds(rule);
  if(!deps.length)return true;
  const selected=selectedCategories||new Set();
  return deps.some(id=>selected.has(id));
}
function linkedRuleDedupeKey(rule,index){
  const id=String(rule&&rule.id||'').trim();
  if(id)return 'id:'+id;
  const choices=(rule&&Array.isArray(rule.choices)?rule.choices:[]).map(choice=>[choice&&choice.categoryId,choice&&choice.offerKey,choice&&choice.subcategoryId||'principal'].map(v=>String(v||'')).join(':')).sort().join(',');
  return ['rule',rule&&rule.label,rule&&rule.type,rule&&rule.pricingMode,rule&&rule.required?'1':'0',rule&&rule.maxChoices,choices||index].map(v=>String(v||'')).join('|');
}
function uniqueLinkedRules(rules){
  const seen=new Set();
  return (rules||[]).filter((rule,index)=>{
    const key=linkedRuleDedupeKey(rule,index);
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}
function applicableLinkedRules(item,offer,subcat,selections,amountCents){
  const selectedCategories=selectedCategoriesFromLinkedSelections(selections||[]);
  return uniqueLinkedRules(((offer&&offer.linkedOptions)||[]).filter(r=>optionRuleApplies(r,subcat,amountCents)&&Array.isArray(r.choices)&&r.choices.length&&linkedRuleDependencyMet(r,selectedCategories)));
}
function targetChoiceInfo(choice){
  const item=seasonFindItem(choice.categoryId); 
  if(!item)return null;

  const sub=seasonFindSubcatInfo(item,choice.subcategoryId||'principal');
  const offerKey=choice.offerKey||'option';
  let offer=seasonFindOffer(item,offerKey)||((item.offers||[]).find(o=>String(o.key)==='option')||(item.offers||[])[0]);

  const offerLabel=String((offer&&offer.label)||'').trim();
  const subLabel=String(sub.title||sub.name||'').trim();
  const parts=[item.name];

  if(offerLabel)parts.push(offerLabel);
  if(subLabel && !offerLabel.toLowerCase().includes(subLabel.toLowerCase()))parts.push(subLabel);

  return {
    item,
    offer,
    sub,
    categoryId:item.id,
    subcategoryId:sub.key,
    offerKey:offer&&offer.key||'',
    label:parts.filter(Boolean).join(' — ')
  };
}
function linkedChoicePrice(rule,choice){
  const mode=rule.pricingMode||'free';
  if(mode==='free'||rule.type!=='paid')return 0;
  if(mode==='fixed')return Number(rule.priceCents||0)||0;
  const info=targetChoiceInfo(choice); const prices=info&&info.offer?priceChoices(info.offer.price):[];
  const requested=Number(choice.amountCents||0)||0;
  if(requested&&prices.some(p=>Number(p.cents)===requested))return requested;
  return prices[0]?Number(prices[0].cents||0):0;
}
function linkedSelectionsTotal(selections){return (selections||[]).reduce((sum,r)=>sum+(r.choices||[]).reduce((s,ch)=>s+Number(ch.amountCents||0),0),0);}
function lineBaseAmount(line){return Number(line&&line.amountCents||0)||0;}
function lineTotalAmount(line){return lineBaseAmount(line)+linkedSelectionsTotal(line&&line.linkedOptions||[]);}
function linkedChoiceMeta(info){
  const sub=info&&info.sub||{};
  const txt=v=>String(v||'').replace(/\s+/g,' ').trim();
  const slot=[sub.day,sub.time].map(txt).filter(Boolean).join(' · ');
  const parts=[];
  if(slot)parts.push(slot);
  const level=txt(sub.level);
  if(level)parts.push(level);
  if(Number(sub.maxSeats||0)>0)parts.push(Number(sub.maxSeats||0)+' places max');
  return parts.join(' · ');
}
function uniqueLinkedChoices(choices){
  const seen=new Set();
  return (choices||[]).filter(choice=>{
    const key=[choice&&choice.categoryId,choice&&choice.offerKey,choice&&choice.subcategoryId||'principal'].map(v=>String(v||'')).join('|');
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}
function renderLinkedOptionsInputs(containerId,item,offer,subcat,selections,amountCents){
  const rules=applicableLinkedRules(item,offer,subcat,selections||[],amountCents);
  if(!rules.length)return '';
  const selectedMap={};
  (selections||[]).forEach(r=>(r.choices||[]).forEach(ch=>{selectedMap[(r.ruleId||r.id)+'|'+ch.categoryId+'|'+(ch.offerKey||'')+'|'+ch.subcategoryId]=true;}));
  return `<section class="fts-linked-options" data-linked-container="${esc(containerId)}"><div class="fts-pay-section-title">Options liées à cette inscription</div>${rules.map(rule=>{const max=Math.min(3,Math.max(1,Number(rule.maxChoices||1)||1));const inputType=(max===1&&rule.required)?'radio':'checkbox';return `<div class="fts-linked-rule" data-linked-rule="${esc(rule.id)}" data-required="${rule.required?'1':'0'}" data-max="${max}"><strong>${esc(rule.label||'Option liée')}</strong><small>${rule.required?'Obligatoire':'Facultatif'} · ${max===1?'1 choix':max+' choix maximum'}</small><div class="fts-linked-choice-list">${uniqueLinkedChoices(rule.choices).map((choice,idx)=>{const info=targetChoiceInfo(choice);if(!info)return'';const amount=linkedChoicePrice(rule,choice);const key=rule.id+'|'+info.categoryId+'|'+(info.offerKey||'')+'|'+info.subcategoryId;const name=containerId+'_'+rule.id;const meta=linkedChoiceMeta(info);return `<label class="fts-linked-choice"><input type="${inputType}" name="${esc(name)}" value="${esc(info.categoryId+'|'+info.subcategoryId+'|'+info.offerKey)}" data-rule-id="${esc(rule.id)}" data-category-id="${esc(info.categoryId)}" data-subcategory-id="${esc(info.subcategoryId)}" data-offer-key="${esc(info.offerKey)}" data-label="${esc(info.label)}" data-amount-cents="${amount}" ${selectedMap[key]?'checked':''}> <span class="fts-linked-choice-main"><span class="fts-linked-choice-title">${esc(info.label)}</span>${meta?`<small class="fts-linked-choice-meta">${esc(meta)}</small>`:''}</span><em>${amount?('+'+esc(euroFromCents(amount))):'Inclus'}</em></label>`}).join('')}</div></div>`}).join('')}</section>`;
}

function enforceLinkedChoiceLimit(root,changedEl){
  if(!root||!changedEl)return;
  const ruleId=changedEl.getAttribute('data-rule-id');
  if(!ruleId)return;
  const ruleEl=changedEl.closest('.fts-linked-rule');
  if(!ruleEl)return;
  const max=Math.max(1,Number(ruleEl.getAttribute('data-max')||1)||1);
  const inputs=Array.from(ruleEl.querySelectorAll('input[data-rule-id]'));
  if(max===1){
    if(changedEl.checked){
      inputs.forEach(input=>{if(input!==changedEl)input.checked=false;});
    }
    inputs.forEach(input=>{input.disabled=false;});
    return;
  }
  const checked=inputs.filter(input=>input.checked);
  if(checked.length>max&&changedEl.checked){
    changedEl.checked=false;
  }
  const after=inputs.filter(input=>input.checked);
  inputs.forEach(input=>{input.disabled=!input.checked&&after.length>=max;});
}
function refreshLinkedChoiceLimits(root){
  if(!root)return;
  root.querySelectorAll('.fts-linked-rule').forEach(ruleEl=>{
    const max=Math.max(1,Number(ruleEl.getAttribute('data-max')||1)||1);
    if(max<=1){
      ruleEl.querySelectorAll('input[data-rule-id]').forEach(input=>input.disabled=false);
      return;
    }
    const inputs=Array.from(ruleEl.querySelectorAll('input[data-rule-id]'));
    const checked=inputs.filter(input=>input.checked);
    inputs.forEach(input=>{input.disabled=!input.checked&&checked.length>=max;});
  });
}

function collectLinkedOptionsFrom(root,item,offer,subcat,amountCents){
  const selectedCategories=selectedCategoriesFromLinkedRoot(root);
  const rules=uniqueLinkedRules(((offer&&offer.linkedOptions)||[]).filter(r=>optionRuleApplies(r,subcat,amountCents)&&Array.isArray(r.choices)&&r.choices.length&&linkedRuleDependencyMet(r,selectedCategories)));
  const out=[];
  for(const rule of rules){
    const max=Math.min(3,Math.max(1,Number(rule.maxChoices||1)||1));
    const checked=Array.from(root.querySelectorAll(`[data-rule-id="${CSS.escape(String(rule.id))}"]:checked`));
    if(rule.required&&checked.length<1)throw new Error('Choix obligatoire : '+(rule.label||'option liée'));
    if(checked.length>max)throw new Error('Trop de choix pour : '+(rule.label||'option liée'));
    if(checked.length){out.push({ruleId:rule.id,label:rule.label||'',type:rule.type||'included',pricingMode:rule.pricingMode||'free',required:!!rule.required,maxChoices:max,choices:checked.map(el=>({categoryId:el.getAttribute('data-category-id'),subcategoryId:el.getAttribute('data-subcategory-id'),offerKey:el.getAttribute('data-offer-key')||'',label:el.getAttribute('data-label')||'',amountCents:Number(el.getAttribute('data-amount-cents')||0)||0}))});}
  }
  return out;
}
function updateDirectLinkedOptions(){
  const form=document.getElementById('fts-pay-form'); if(!form||!ftsPaymentContext)return;
  const item=ftsPaymentContext.item, offer=ftsPaymentContext.offer;
  const subcat=findSeasonSubcat(item,form.subcategoryId.value)||{key:'principal',name:'Groupe principal',title:'Groupe principal'};
  const box=document.getElementById('fts-pay-linked-options');
  const update=(selections)=>{updatePaymentSchedulePreview('fts-pay-schedule-preview',Number(form.amountCents.value||0)+linkedSelectionsTotal(selections||[])+directShopTotal(),form.paymentPlan.value);syncInstallmentInfo(form,'fts-pay');};
  const render=(selections)=>{
    if(!box){update([]);return;}
    const amountCents=Number(form.amountCents.value||0)||0;
    box.innerHTML=renderLinkedOptionsInputs('direct',item,offer,subcat,selections||[],amountCents);
    refreshLinkedChoiceLimits(box);
    box.querySelectorAll('input').forEach(el=>el.addEventListener('change',()=>{
      enforceLinkedChoiceLimit(box,el);
      let next=[];
      try{next=collectLinkedOptionsFrom(box,item,offer,subcat,Number(form.amountCents.value||0)||0);}catch(e){next=[];}
      render(next);
    }));
    let current=[];
    try{current=collectLinkedOptionsFrom(box,item,offer,subcat,Number(form.amountCents.value||0)||0);}catch(e){current=selections||[];}
    update(current);
  };
  render([]);
}
function updateCartLinkedOptions(lineId){
  loadCart();
  const line=(ftsSeasonCart.season||[]).find(l=>String(l.id)===String(lineId)); if(!line)return;
  const item=seasonFindItem(line.activityId), offer=seasonFindOffer(item,line.offerKey), subcat=line.subcategory||{key:'principal'};
  const root=document.querySelector(`[data-cart-linked="${CSS.escape(String(lineId))}"]`);
  if(root){
    const active=document.activeElement;
    if(active&&root.contains(active)&&active.matches('input[data-rule-id]'))enforceLinkedChoiceLimit(root,active);
    refreshLinkedChoiceLimits(root);
    line.linkedOptions=collectLinkedOptionsFrom(root,item,offer,subcat,Number(line.amountCents||0)||0);
  }
  saveCart();renderSeasonCart();
}
function ensureSeasonPaymentModal(){
  if(document.getElementById('fts-season-payment-modal'))return;
  const div=document.createElement('div');
  div.id='fts-season-payment-modal';
  div.className='fts-payment-modal';
  div.innerHTML=`<div class="fts-payment-card"><button type="button" class="fts-payment-close" data-fts-click="closeSeasonPayment()">×</button><div class="eyebrow">Paiement sécurisé HelloAsso</div><h2 id="fts-pay-title">Règlement Fais Ton Show</h2><p id="fts-pay-summary" class="fts-pay-summary"></p><form id="fts-pay-form"><div class="fts-pay-section-title">Responsable / payeur</div><div class="fts-pay-grid"><label>Prénom responsable<input name="firstName" autocomplete="given-name" required></label><label>Nom responsable<input name="lastName" autocomplete="family-name" required></label><label>Email responsable<input name="email" type="email" autocomplete="email" required></label><label>Téléphone responsable<input name="phone" type="tel" autocomplete="tel" required></label></div><div class="fts-pay-section-title">Participant / élève</div><div class="fts-pay-grid"><label>Prénom participant<input name="studentFirstName" required></label><label>Nom participant<input name="studentLastName" required></label><label>Téléphone d'urgence<input name="emergencyPhone" type="tel" required></label><label id="fts-pay-sub-wrap">Groupe<select name="subcategoryId"></select></label><label>Montant<select name="amountCents"></select></label><label>Paiement<select name="paymentPlan"></select></label></div>${installmentInfoHtml('fts-pay')}<div id="fts-pay-linked-options"></div><div id="fts-pay-shop"></div><div id="fts-pay-schedule-preview" class="fts-pay-schedule-preview"></div>${installmentRecapHtml('fts-pay')}<div class="promo-field"><label>Code promo / code spécial <input name="promoCode" placeholder="Optionnel : réduction, gratuité ou chèque/espèces"></label></div><button class="btn-register fts-pay-submit" type="submit">Continuer</button><div id="fts-pay-msg" class="fts-pay-msg"></div></form></div>`;
  document.body.appendChild(div);
  document.getElementById('fts-pay-form').addEventListener('submit',submitSeasonPayment);
}
function openSeasonPayment(activityId,offerKey){
  const item=itemList().find(x=>String(x.id)===String(activityId));
  const offer=item&&(item.offers||[]).find(o=>String(o.key)===String(offerKey));
  if(!item||!offer){alert('Formule introuvable.');return;}
  const prices=priceChoices(offer.price);
  if(!prices.length){alert('Tarif non reconnu pour cette formule.');return;}
  selectedSeasonOffers[item.id]=offer.key;refreshSubcatOfferFilter(item.id);
  const chosenSubcat=selectedSeasonSubcat(item);
  if(chosenSubcat && !subcatAllowsOffer((item.subcats||[]).find(s=>subcatKey(s)===chosenSubcat.key), offer)){alert('Ce groupe n’est pas disponible pour cette formule. Choisis un groupe compatible.');return;}
  if((item.subcats||[]).length && !chosenSubcat){alert('Choisis d’abord le groupe / horaire concerné avant de lancer le paiement.');const zone=document.querySelector(`#panel-${CSS.escape(item.id)} .season-subcats`);if(zone)zone.scrollIntoView({behavior:'smooth',block:'center'});return;}
  ensureSeasonPaymentModal();ftsPaymentContext={item,offer};ftsDirectShopLines=[];const directShopBox=document.getElementById('fts-pay-shop');if(directShopBox)directShopBox.innerHTML='<section class="fts-cart-section"><h3>Boutique</h3><p class="fts-cart-muted">Chargement des articles...</p></section>';loadCartProducts().then(()=>renderDirectShopBlock()).catch(()=>renderDirectShopBlock());
  const profile=ftsPaymentProfile||{};const email=(ftsPaymentUser&&ftsPaymentUser.email)||profile.email||'';const first=profile.firstName||profile.prenom||'';const last=profile.lastName||profile.nom||'';const phone=profile.phone||profile.tel||profile.telephone||'';
  document.getElementById('fts-pay-title').textContent=(item.name||'Activité')+' · '+(offer.label||offer.key||'Formule');
  document.getElementById('fts-pay-summary').innerHTML=`<strong>${esc(item.name)}</strong><br>Formule : <strong>${esc(offer.label||offer.key)}</strong><br>${chosenSubcat?`Groupe : <strong>${esc(chosenSubcat.title||chosenSubcat.name)}</strong>${chosenSubcat.seasonDetail?`<br><span class="fts-pay-subdetail">${esc(chosenSubcat.seasonDetail)}</span>`:''}<br>`:''}Saison : <strong>${esc((saison.meta&&saison.meta.year)||'')}</strong>`;
  const form=document.getElementById('fts-pay-form');form.firstName.value=first;form.lastName.value=last;form.email.value=email;form.phone.value=phone;form.studentFirstName.value='';form.studentLastName.value='';form.emergencyPhone.value='';
  renderPaymentPlanSelect(form.paymentPlan);
  const pricesRefresh=()=>{const currentSubcat=findSeasonSubcat(item,form.subcategoryId.value)||chosenSubcat||{key:'principal',name:'Groupe principal',title:'Groupe principal',price:''};const automatic=automaticAmountForSelection(item,offer,currentSubcat,prices);if(automatic){form.amountCents.innerHTML=`<option value="${automatic}">${esc(lockedPriceLabel(automatic))}</option>`;form.amountCents.value=String(automatic);form.amountCents.disabled=true;form.amountCents.title='Montant choisi automatiquement selon le groupe sélectionné.';}else{form.amountCents.disabled=false;form.amountCents.title='';form.amountCents.innerHTML=prices.map(p=>`<option value="${p.cents}">${esc(p.label)}</option>`).join('');}updateDirectLinkedOptions();};
  form.amountCents.onchange=()=>updateDirectLinkedOptions();form.paymentPlan.onchange=()=>updateDirectLinkedOptions();
  const subs=item.subcats||[];const wrap=document.getElementById('fts-pay-sub-wrap');
  if(subs.length){const compatibleSubs=publicSeasonSubcats(item).filter(s=>subcatAllowsOffer(s,offer));wrap.style.display='grid';form.subcategoryId.innerHTML=compatibleSubs.map(s=>{const sub=subcatPaymentInfo(s);const label=sub.seasonDetail?`${sub.title||sub.name} — ${sub.seasonDetail}`:(sub.title||sub.name);return `<option value="${esc(sub.key)}">${esc(label)}</option>`}).join('');if(chosenSubcat)form.subcategoryId.value=chosenSubcat.key;form.subcategoryId.onchange=pricesRefresh;}else{wrap.style.display='none';form.subcategoryId.innerHTML='<option value="principal">Groupe principal</option>';form.subcategoryId.onchange=null;}
  pricesRefresh();document.getElementById('fts-pay-msg').textContent='';document.getElementById('fts-season-payment-modal').classList.add('open');
}
async function submitSeasonPayment(event){
  event.preventDefault();const msg=document.getElementById('fts-pay-msg');
  try{if(!ftsPaymentContext)throw new Error('Session paiement indisponible.');const token=ftsPaymentUser?await ftsPaymentUser.getIdToken(true):'';const form=event.target;validateInstallmentAck(form,'fts-pay');const item=ftsPaymentContext.item, offer=ftsPaymentContext.offer;const selectedSubcat=findSeasonSubcat(item,form.subcategoryId.value)||{key:form.subcategoryId.value,name:'Groupe principal',title:'Groupe principal',day:'',time:'',level:'',age:'',note:'',price:'',maxSeats:0,seasonDetail:''};const amountCents=Number(form.amountCents.value)||0;const linkedRoot=document.getElementById('fts-pay-linked-options');const linkedOptions=linkedRoot?collectLinkedOptionsFrom(linkedRoot,item,offer,selectedSubcat,amountCents):[];const studentFirstName=String(form.studentFirstName.value||'').trim();const studentLastName=String(form.studentLastName.value||'').trim();const payload={type:'season_registration',source:'saison.html',returnPath:'paiement',activityId:item.id,offerKey:offer.key,amountCents,paymentPlan:form.paymentPlan.value,linkedOptions,subcategoryId:selectedSubcat.key,subcategoryName:selectedSubcat.name,subcategoryTitle:selectedSubcat.title,subcategoryDay:selectedSubcat.day,subcategoryTime:selectedSubcat.time,subcategoryLevel:selectedSubcat.level,subcategoryAge:selectedSubcat.age,subcategoryNote:selectedSubcat.note,subcategoryPrice:selectedSubcat.price,subcategoryMaxSeats:Number(selectedSubcat.maxSeats||0)||0,subcategorySeasonDetail:selectedSubcat.seasonDetail,subcategoryAllowedOffers:selectedSubcat.allowedOffers||[],subcategory:selectedSubcat,payer:{firstName:form.firstName.value,lastName:form.lastName.value,email:form.email.value,phone:form.phone.value},student:{firstName:studentFirstName,lastName:studentLastName,name:[studentFirstName,studentLastName].filter(Boolean).join(' '),emergencyPhone:form.emergencyPhone.value},emergencyPhone:form.emergencyPhone.value,promoCode:form.promoCode?form.promoCode.value:''};msg.textContent='Création du paiement sécurisé…';const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;const res=await fetch(ftsPaymentApiBase()+'/checkout',{method:'POST',headers,body:JSON.stringify(payload)});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok){const labels={linked_option_required:'Un choix obligatoire est manquant.',linked_option_not_allowed:'Une option choisie n’est pas autorisée.',linked_option_full:'Un cours choisi en option est complet.',linked_option_amount_not_allowed:'Le montant d’une option liée doit être recalculé. Recharge la page puis réessaie.',subcategory_full:'Ce groupe est complet : le nombre de places maximum est atteint.',subcategory_offer_not_allowed:'Ce groupe n’est pas disponible pour cette formule.',amount_not_allowed_for_offer:'Le montant choisi ne correspond pas au tarif autorisé.',promo_not_allowed_for_order:'Ce code promo ne s’applique pas à cette commande.',helloasso_api_error_400:'HelloAsso a refusé la demande de paiement. Recharge la page puis réessaie.',helloasso_checkout_failed:'HelloAsso a refusé la demande de paiement. Recharge la page puis réessaie.'};throw new Error(labels[data.error]||data.error||'Erreur création paiement');}if(data.redirectUrl)location.href=data.redirectUrl;else if(data.confirmationUrl)location.href=data.confirmationUrl;else msg.textContent=data.offlinePending?'Inscription enregistrée. Paiement hors ligne à remettre à l’association.':'Inscription gratuite confirmée.';}catch(e){msg.textContent='Impossible de lancer le paiement : '+(e&&e.message?e.message:e);}
}
async function submitSeasonPayment(event){
  event.preventDefault();
  const msg=document.getElementById('fts-pay-msg');
  try{
    if(!ftsPaymentContext)throw new Error('Session paiement indisponible.');
    const token=ftsPaymentUser?await ftsPaymentUser.getIdToken(true):'';
    const form=event.target;
    validateInstallmentAck(form,'fts-pay');
    const item=ftsPaymentContext.item,offer=ftsPaymentContext.offer;
    const selectedSubcat=findSeasonSubcat(item,form.subcategoryId.value)||{key:form.subcategoryId.value,name:'Groupe principal',title:'Groupe principal',day:'',time:'',level:'',age:'',note:'',price:'',maxSeats:0,seasonDetail:''};
    const amountCents=Number(form.amountCents.value)||0;
    const linkedRoot=document.getElementById('fts-pay-linked-options');
    const linkedOptions=linkedRoot?collectLinkedOptionsFrom(linkedRoot,item,offer,selectedSubcat,amountCents):[];
    const studentFirstName=String(form.studentFirstName.value||'').trim();
    const studentLastName=String(form.studentLastName.value||'').trim();
    const payer={firstName:form.firstName.value,lastName:form.lastName.value,email:form.email.value,phone:form.phone.value};
    const student={firstName:studentFirstName,lastName:studentLastName,name:[studentFirstName,studentLastName].filter(Boolean).join(' '),emergencyPhone:form.emergencyPhone.value};
    const seasonLine={type:'season_registration',activityId:item.id,offerKey:offer.key,amountCents,linkedOptions,subcategoryId:selectedSubcat.key,subcategoryName:selectedSubcat.name,subcategoryTitle:selectedSubcat.title,subcategoryDay:selectedSubcat.day,subcategoryTime:selectedSubcat.time,subcategoryLevel:selectedSubcat.level,subcategoryAge:selectedSubcat.age,subcategoryNote:selectedSubcat.note,subcategoryPrice:selectedSubcat.price,subcategoryMaxSeats:Number(selectedSubcat.maxSeats||0)||0,subcategorySeasonDetail:selectedSubcat.seasonDetail,subcategoryAllowedOffers:selectedSubcat.allowedOffers||[],subcategory:selectedSubcat};
    const shopLines=(ftsDirectShopLines||[]).map(l=>({type:'shop_order',productId:l.productId,quantity:Number(l.quantity||1),variants:l.variants||{}}));
    const payload=shopLines.length?{type:'mixed_cart',source:'saison.html',returnPath:'paiement',paymentPlan:form.paymentPlan.value,promoCode:form.promoCode?form.promoCode.value:'',payer,student,emergencyPhone:form.emergencyPhone.value,seasonLines:[seasonLine],shopLines}:Object.assign({source:'saison.html',returnPath:'paiement',paymentPlan:form.paymentPlan.value,payer,student,emergencyPhone:form.emergencyPhone.value,promoCode:form.promoCode?form.promoCode.value:''},seasonLine);
    msg.textContent='Création du paiement sécurisé…';
    const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
    const res=await fetch(ftsPaymentApiBase()+'/checkout',{method:'POST',headers,body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok){const labels={linked_option_required:'Un choix obligatoire est manquant.',linked_option_not_allowed:'Une option choisie n’est pas autorisée.',linked_option_full:'Un cours choisi en option est complet.',linked_option_amount_not_allowed:'Le montant d’une option liée doit être recalculé. Recharge la page puis réessaie.',subcategory_full:'Ce groupe est complet : le nombre de places maximum est atteint.',subcategory_offer_not_allowed:'Ce groupe n’est pas disponible pour cette formule.',amount_not_allowed_for_offer:'Le montant choisi ne correspond pas au tarif autorisé.',promo_not_allowed_for_order:'Ce code promo ne s’applique pas à cette commande.',helloasso_api_error_400:'HelloAsso a refusé la demande de paiement. Recharge la page puis réessaie.',helloasso_checkout_failed:'HelloAsso a refusé la demande de paiement. Recharge la page puis réessaie.'};throw new Error(labels[data.error]||data.error||'Erreur création paiement');}
    if(data.redirectUrl)location.href=data.redirectUrl;else if(data.confirmationUrl)location.href=data.confirmationUrl;else msg.textContent=data.offlinePending?'Inscription enregistrée. Paiement hors ligne à remettre à l’association.':'Inscription gratuite confirmée.';
  }catch(e){msg.textContent='Impossible de lancer le paiement : '+(e&&e.message?e.message:e);}
}
function normalizeCartSeasonAmounts(){let changed=false;(ftsSeasonCart.season||[]).forEach(l=>{const item=itemList().find(x=>String(x.id)===String(l.activityId));const offer=item&&(item.offers||[]).find(o=>String(o.key)===String(l.offerKey));const prices=Array.isArray(l.prices)&&l.prices.length?l.prices:(offer?priceChoices(offer.price):[]);const automatic=automaticAmountForSelection(item,offer,l.subcategory,prices);if(automatic){l.amountCents=automatic;l.lockedAmount=true;changed=true;}if(!Array.isArray(l.linkedOptions)){l.linkedOptions=[];changed=true;}});if(changed)localStorage.setItem(FTS_SEASON_CART_KEY,JSON.stringify(ftsSeasonCart));}
function seasonLineFrom(activityId,offerKey){const item=itemList().find(x=>String(x.id)===String(activityId));const offer=item&&(item.offers||[]).find(o=>String(o.key)===String(offerKey));if(!item||!offer)throw new Error('Formule introuvable.');const prices=priceChoices(offer.price);if(!prices.length)throw new Error('Tarif non reconnu.');selectedSeasonOffers[item.id]=offer.key;refreshSubcatOfferFilter(item.id);const chosen=selectedSeasonSubcat(item);if((item.subcats||[]).length&&!chosen)throw new Error('Choisis d’abord le groupe / horaire concerné avant d’ajouter au panier.');const subcat=chosen||{key:'principal',name:'Groupe principal',title:'Groupe principal',day:'',time:'',level:'',age:'',note:'',price:'',maxSeats:0,seasonDetail:'',allowedOffers:[]};const automatic=automaticAmountForSelection(item,offer,subcat,prices);return {id:cartId('season'),type:'season_registration',activityId:item.id,activityName:item.name,offerKey:offer.key,offerLabel:offer.label||offer.key,prices,amountCents:automatic||prices[0].cents,lockedAmount:!!automatic,subcategory:subcat,linkedOptions:[]};}
function renderCartLinkedOptions(line){const item=seasonFindItem(line.activityId),offer=seasonFindOffer(item,line.offerKey),subcat=line.subcategory||{key:'principal'};const html=renderLinkedOptionsInputs('cart_'+line.id,item,offer,subcat,line.linkedOptions||[],Number(line.amountCents||0)||0);return html?`<div class="fts-cart-linked" data-cart-linked="${esc(line.id)}" onchange="updateCartLinkedOptions('${esc(line.id)}')">${html}</div>`:'';}
function renderSeasonCart(){ensureSeasonCartShell();const box=document.getElementById('fts-cart-content');if(!box)return;const seasonLines=ftsSeasonCart.season||[];const shopLines=ftsSeasonCart.shop||[];const total=seasonLines.reduce((s,x)=>s+lineTotalAmount(x),0)+shopLines.reduce((s,x)=>s+(Number(x.unitPriceCents||0)*Math.max(1,Number(x.quantity||1)||1)),0);const profile=ftsPaymentProfile||{};const email=(ftsPaymentUser&&ftsPaymentUser.email)||profile.email||'';const first=profile.firstName||profile.prenom||'';const last=profile.lastName||profile.nom||'';const phone=profile.phone||profile.tel||profile.telephone||'';box.innerHTML=`${!seasonLines.length&&!shopLines.length?'<div class="fts-cart-empty">Ton panier est vide. Ajoute une ou plusieurs activités.</div>':''}${seasonLines.length?`<section class="fts-cart-section"><h3>Activités choisies</h3>${seasonLines.map(l=>`<article class="fts-cart-line"><div><strong>${esc(l.activityName)}</strong><small>${esc(l.offerLabel)} · ${esc((l.subcategory&&l.subcategory.title)||(l.subcategory&&l.subcategory.name)||'Groupe principal')}</small>${renderCartLinkedOptions(l)}</div>${l.lockedAmount?`<strong title="Montant choisi automatiquement selon le groupe">${esc(lockedPriceLabel(l.amountCents))}</strong>`:`<select onchange="updateCartSeasonAmount('${esc(l.id)}',this.value)">${(l.prices||[]).map(p=>`<option value="${p.cents}" ${Number(l.amountCents)===Number(p.cents)?'selected':''}>${esc(p.label)}</option>`).join('')}</select>`}<button type="button" onclick="removeCartLine('season','${esc(l.id)}')">Retirer</button></article>`).join('')}</section>`:''}${renderCartShopSuggestions()}${shopLines.length?`<section class="fts-cart-section"><h3>Articles ajoutés</h3>${shopLines.map(l=>`<article class="fts-cart-line"><div><strong>${esc(l.productName)}</strong><small>${esc(Object.entries(l.variants||{}).map(([k,v])=>k+': '+v).join(' · ')||'Boutique')} · quantité ${esc(String(l.quantity||1))}</small></div><strong>${esc(euroFromCents(Number(l.unitPriceCents||0)*Number(l.quantity||1)))}</strong><button type="button" onclick="removeCartLine('shop','${esc(l.id)}')">Retirer</button></article>`).join('')}</section>`:''}<form id="fts-cart-form" class="fts-cart-form"><div class="fts-pay-section-title">Responsable / payeur</div><div class="fts-pay-grid"><label>Prénom responsable<input name="firstName" required value="${esc(first)}"></label><label>Nom responsable<input name="lastName" required value="${esc(last)}"></label><label>Email responsable<input name="email" type="email" required value="${esc(email)}"></label><label>Téléphone responsable<input name="phone" type="tel" required value="${esc(phone)}"></label></div><div class="fts-pay-section-title">Participant / élève</div><div class="fts-pay-grid"><label>Prénom participant<input name="studentFirstName" required></label><label>Nom participant<input name="studentLastName" required></label><label>Téléphone d'urgence<input name="emergencyPhone" type="tel" required></label><label>Paiement<select name="paymentPlan"></select></label></div>${installmentInfoHtml('fts-cart')}<div id="fts-cart-schedule-preview" class="fts-pay-schedule-preview"></div>${installmentRecapHtml('fts-cart')}<div class="promo-field"><label>Code promo / code spécial <input name="promoCode" placeholder="Optionnel"></label></div><div class="fts-cart-total"><span>Total</span><strong>${esc(euroFromCents(total))}</strong></div><button class="btn-register fts-pay-submit" type="submit" ${total?'':'disabled'}>Passer à la caisse</button><div id="fts-cart-msg" class="fts-pay-msg"></div></form>`;const form=document.getElementById('fts-cart-form');if(form){renderPaymentPlanSelect(form.paymentPlan);const update=()=>{updatePaymentSchedulePreview('fts-cart-schedule-preview',total,form.paymentPlan.value);syncInstallmentInfo(form,'fts-cart');};form.paymentPlan.onchange=update;update();form.addEventListener('submit',submitMixedCart);}}
async function submitMixedCart(e){e.preventDefault();const msg=document.getElementById('fts-cart-msg');try{loadCart();const seasonLines=ftsSeasonCart.season||[];const shopLines=ftsSeasonCart.shop||[];if(!seasonLines.length&&!shopLines.length)throw new Error('Le panier est vide.');for(const line of seasonLines){const item=seasonFindItem(line.activityId),offer=seasonFindOffer(item,line.offerKey),subcat=line.subcategory||{key:'principal'};const root=document.querySelector(`[data-cart-linked="${CSS.escape(String(line.id))}"]`);if(root)line.linkedOptions=collectLinkedOptionsFrom(root,item,offer,subcat,Number(line.amountCents||0)||0);else line.linkedOptions=[];}saveCart();const form=e.target;validateInstallmentAck(form,'fts-cart');const token=ftsPaymentUser?await ftsPaymentUser.getIdToken(true):'';const studentFirstName=String(form.studentFirstName.value||'').trim();const studentLastName=String(form.studentLastName.value||'').trim();const payload={type:'mixed_cart',source:'saison.html',returnPath:'paiement',paymentPlan:form.paymentPlan.value,promoCode:form.promoCode?form.promoCode.value:'',payer:{firstName:form.firstName.value,lastName:form.lastName.value,email:form.email.value,phone:form.phone.value},student:{firstName:studentFirstName,lastName:studentLastName,name:[studentFirstName,studentLastName].filter(Boolean).join(' '),emergencyPhone:form.emergencyPhone.value},emergencyPhone:form.emergencyPhone.value,seasonLines:seasonLines.map(l=>({type:'season_registration',activityId:l.activityId,offerKey:l.offerKey,amountCents:Number(l.amountCents||0),linkedOptions:l.linkedOptions||[],subcategoryId:l.subcategory&&l.subcategory.key,subcategoryName:l.subcategory&&l.subcategory.name,subcategoryTitle:l.subcategory&&l.subcategory.title,subcategoryDay:l.subcategory&&l.subcategory.day,subcategoryTime:l.subcategory&&l.subcategory.time,subcategoryLevel:l.subcategory&&l.subcategory.level,subcategoryAge:l.subcategory&&l.subcategory.age,subcategoryNote:l.subcategory&&l.subcategory.note,subcategoryPrice:l.subcategory&&l.subcategory.price,subcategoryMaxSeats:Number(l.subcategory&&l.subcategory.maxSeats||0)||0,subcategorySeasonDetail:l.subcategory&&l.subcategory.seasonDetail,subcategoryAllowedOffers:l.subcategory&&l.subcategory.allowedOffers||[],subcategory:l.subcategory})),shopLines:shopLines.map(l=>({type:'shop_order',productId:l.productId,quantity:Number(l.quantity||1),variants:l.variants||{}}))};msg.textContent='Création du paiement groupé…';const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;const res=await fetch(ftsPaymentApiBase()+'/checkout',{method:'POST',headers,body:JSON.stringify(payload)});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok){const labels={linked_option_required:'Un choix obligatoire est manquant.',linked_option_not_allowed:'Une option choisie n’est pas autorisée.',linked_option_full:'Un cours choisi en option est complet.',linked_option_amount_not_allowed:'Le montant d’une option liée doit être recalculé. Recharge la page puis réessaie.',amount_not_allowed_for_offer:'Un montant ne correspond pas au tarif autorisé.',promo_not_allowed_for_order:'Ce code promo ne s’applique pas à cette commande.',helloasso_api_error_400:'HelloAsso a refusé la demande de paiement. Recharge la page puis réessaie.',helloasso_checkout_failed:'HelloAsso a refusé la demande de paiement. Recharge la page puis réessaie.'};throw new Error(labels[data.error]||(data&&data.error)||'Erreur création paiement');}localStorage.removeItem(FTS_SEASON_CART_KEY);if(data.redirectUrl)location.href=data.redirectUrl;else if(data.confirmationUrl)location.href=data.confirmationUrl;else msg.textContent='Commande enregistrée.';}catch(err){msg.textContent='Impossible de lancer le paiement groupé : '+(err&&err.message?err.message:err);}}

loadCart();

function toggle(id){const tile=document.querySelector('[data-id="'+id+'"]'),panel=document.getElementById('panel-'+id);if(!tile||!panel)return;if(current&&current!==id){const oldT=document.querySelector('[data-id="'+current+'"]'),oldP=document.getElementById('panel-'+current);if(oldT)oldT.classList.remove('open');if(oldP)oldP.classList.remove('open')}if(current===id){tile.classList.remove('open');panel.classList.remove('open');current=null}else{tile.classList.add('open');panel.classList.add('open');current=id;setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),50)}}
function switchTab(disc,parcours,btn){selectedSeasonOffers[disc]=parcours;const panel=document.getElementById('panel-'+disc);panel.querySelectorAll('.tab').forEach(t=>t.classList.remove('act'));panel.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('act'));btn.classList.add('act');document.getElementById(disc+'-'+parcours).classList.add('act');refreshSubcatOfferFilter(disc)}
function applySeason(){saison=officialCategories?buildSeasonFromCategories(officialCategories):(legacySaison||DEFAULT_SAISON);render();}
function finishInitialRender(){
  try{ applySeason(); }
  catch(e){ console.warn('[FTS Saison render]',e); saison=legacySaison||DEFAULT_SAISON; renderFallbackSeason(); }
  document.body.classList.remove('saison-loading');
}
function renderFallbackSeason(){
  try{ render(); }
  catch(e){
    const tiles=document.getElementById('tiles');
    const panels=document.getElementById('panels');
    if(tiles) tiles.innerHTML='<div class="loading-card">Impossible d’afficher la saison pour le moment.</div>';
    if(panels) panels.innerHTML='';
  }
}
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
