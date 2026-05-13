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
function esc(s){return FTS.esc(s||"")}
function itemList(){return (saison.items||[]).filter(i=>i.active!==false).sort((a,b)=>(+a.order||0)-(+b.order||0));}
function render(){const m=saison.meta||DEFAULT_SAISON.meta;document.getElementById('page-eyebrow').textContent=m.eyebrow||'';document.getElementById('page-title').innerHTML=esc(m.title||'SAISON')+'<br><span>'+esc(m.year||'')+'</span>';document.getElementById('page-slogan').textContent=m.slogan||'';document.getElementById('parcours-cards').innerHTML=(saison.parcoursIntro||[]).map(p=>`<div class="p-card ${esc(p.key)}"><span class="p-icon">${esc(p.icon)}</span><div class="p-tag">${esc(p.tag)}</div><div class="p-title">${esc(p.title)}</div><p class="p-desc">${esc(p.desc)}</p></div>`).join('');const items=itemList();document.getElementById('tiles').innerHTML=items.map(i=>`<button class="tile" data-id="${esc(i.id)}" data-fts-click="toggle('${esc(i.id)}')"><span class="tile-icon">${esc(i.icon)}</span><div class="tile-name">${esc(i.name)}</div><div class="tile-sub">${esc(i.subtitle)}</div>${i.badge?`<span class="tile-badge">${esc(i.badge)}</span>`:''}<span class="tile-arrow">▼</span></button>`).join('')||'<div class="loading-card">Aucune activité publiée pour le moment.</div>';document.getElementById('panels').innerHTML=items.map(renderPanel).join('');}
function renderPanel(i){return `<div class="panel" id="panel-${esc(i.id)}"><div class="panel-hdr"><span class="panel-icon">${esc(i.icon)}</span><div><div class="panel-title">${esc(i.name)}</div><div class="panel-sub">${esc(i.subtitle)}</div></div></div><div class="panel-body">${renderOffers(i)}</div></div>`;}
function renderOffers(i){const offers=i.offers||[];const tabs=offers.length>1?`<div class="tabs">${offers.map((o,idx)=>`<button class="tab ${idx===0?'act':''} ${esc(o.style||o.key)}" data-fts-click="switchTab('${esc(i.id)}','${esc(o.key)}',this)">${esc(o.label||o.key)}</button>`).join('')}</div>`:'';return tabs+offers.map((o,idx)=>`<div class="tab-content ${idx===0?'act':''}" id="${esc(i.id)}-${esc(o.key)}"><div class="c-main ${o.style==='perf'?'perf':''}">${o.main||''}</div>${renderBullets(o.bullets)}${renderOfferBox(o)}</div>`).join('');}
function renderBullets(bullets){if(!bullets||!bullets.length)return'';return `<ul class="c-list">${bullets.map(b=>{const gift=String(b).includes('🎁');const warn=String(b).includes('💰');return `<li class="${gift?'gift':warn?'warn':'incl'}"><span class="icon">${gift?'🎁':warn?'💰':'✔'}</span><span>${esc(String(b).replace(/^([✔⚡🎁💰])\s*/,'')).replace(/Offert :/,'<strong>Offert :</strong>')}</span></li>`}).join('')}</ul>`}
function renderOfferBox(o){const link=o.link||saison.inscriptionDefault||'';return `<div class="offer-box"><div><div class="offer-price">${esc(o.price||'Tarif à venir')} ${o.price?'<small>/ saison</small>':''}</div>${o.priceNote?`<div class="offer-note">${esc(o.priceNote)}</div>`:''}</div>${link?`<a class="btn-register" href="${esc(link)}" target="_blank" rel="noopener">S'inscrire</a>`:`<span class="btn-register muted">Lien bientôt disponible</span>`}</div>`;}
function toggle(id){const tile=document.querySelector('[data-id="'+id+'"]'),panel=document.getElementById('panel-'+id);if(!tile||!panel)return;if(current&&current!==id){const oldT=document.querySelector('[data-id="'+current+'"]'),oldP=document.getElementById('panel-'+current);if(oldT)oldT.classList.remove('open');if(oldP)oldP.classList.remove('open')}if(current===id){tile.classList.remove('open');panel.classList.remove('open');current=null}else{tile.classList.add('open');panel.classList.add('open');current=id;setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),50)}}
function switchTab(disc,parcours,btn){const panel=document.getElementById('panel-'+disc);panel.querySelectorAll('.tab').forEach(t=>t.classList.remove('act'));panel.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('act'));btn.classList.add('act');document.getElementById(disc+'-'+parcours).classList.add('act')}
function finishInitialRender(){render();document.body.classList.remove('saison-loading')}
function loadSaison(){
  let firstLoad=true;
  try{
    const db=FTS.initFirebase();
    if(!db){finishInitialRender();return}
    db.ref('fts_saison/config').on('value',snap=>{
      const data=snap.val();
      if(data) saison=data;
      if(firstLoad){firstLoad=false;finishInitialRender()}
      else render();
    },err=>{
      console.warn('[FTS Saison]',err);
      if(firstLoad){firstLoad=false;finishInitialRender()}
    });
    setTimeout(()=>{
      if(firstLoad){
        firstLoad=false;
        finishInitialRender();
      }
    },2500);
  }catch(e){
    console.warn('[FTS Saison]',e);
    finishInitialRender();
  }
}
loadSaison();
