(function(window){
  'use strict';

  const FTS=window.FTS=window.FTS||{};
  const DATA_PATH='fts_content/piecesModule';
  const SALES_PATH='fts_piece_sales';
  const PRODUCT_PREFIX='__PIECES__:';
  const DEFAULT_SETTINGS={title:'Nos pièces de théâtre',subtitle:'',description:'Des créations prêtes à jouer, avec textes, ressources de mise en scène et droits de représentation.',bannerUrl:'',published:true};
  const state={db:null,user:null,content:{settings:DEFAULT_SETTINGS,pieces:{}},products:{},selectedPieceId:'',sales:[],salesMeta:{},salesLoaded:false};
  const $=id=>document.getElementById(id);
  const esc=value=>FTS.esc?FTS.esc(value==null?'':value):String(value==null?'':value);
  const euro=cents=>(Number(cents||0)/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
  const slug=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);
  const uid=prefix=>(prefix||'id')+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);

  function workerUrl(){ return String((FTS.PAYMENT&&FTS.PAYMENT.workerUrl)||'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/,''); }
  function isPiecesProduct(product){ return String(product&&product.category||'').startsWith(PRODUCT_PREFIX); }
  function rows(value){
    if(Array.isArray(value)) return value.filter(Boolean);
    if(value&&typeof value==='object') return Object.entries(value).map(([id,item])=>Object.assign({id},item||{}));
    return [];
  }
  function productRows(raw){ return Array.isArray(raw)?raw:Object.entries(raw||{}).map(([id,item])=>Object.assign({id},item||{})); }
  function productById(id){ return state.products[String(id)]||null; }
  function safeHttpUrl(value){
    const raw=String(value||'').trim(); if(!raw) return '';
    try{ const url=new URL(raw,location.origin); return ['https:','http:'].includes(url.protocol)?url.href:''; }catch(e){ return ''; }
  }
  function firebaseKey(value){ return String(value||'').trim().replace(/[.#$\[\]\/]/g,'_')||uid('order'); }
  async function token(){ if(!state.user) throw new Error('admin_not_connected'); return state.user.getIdToken(true); }
  async function api(path,options){
    const response=await fetch(workerUrl()+path,Object.assign({method:'GET',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json',Accept:'application/json'}},options||{}));
    const data=await response.json().catch(()=>null); if(!response.ok||!data||data.ok===false) throw new Error((data&&data.error)||('HTTP '+response.status)); return data;
  }
  function message(id,text,ok){ const el=$(id); if(!el)return; el.textContent=text||''; el.className='pieces-admin-message '+(ok===false?'bad':''); }
  function uploadMessage(text,ok){ const el=$('piece-upload-status'); el.textContent=text||''; el.className='pieces-upload-status '+(ok===false?'bad':''); }
  function allPieces(){ return rows(state.content.pieces).sort((a,b)=>Number(a.order||999)-Number(b.order||999)||String(a.title||'').localeCompare(String(b.title||''),'fr')); }
  function pieceById(id){ return allPieces().find(piece=>String(piece.id)===String(id)); }
  function offersFor(piece){ return rows(piece&&piece.offers).sort((a,b)=>Number(a.order||999)-Number(b.order||999)||String(a.name||'').localeCompare(String(b.name||''),'fr')); }
  function lowestPrice(piece){
    const prices=offersFor(piece).filter(offer=>offer.active!==false).map(offer=>productById(offer.productId)).filter(Boolean).map(product=>Number(product.priceCents||0));
    return prices.length?Math.min.apply(null,prices):null;
  }
  function renderPieces(){
    const box=$('pieces-admin-list'); const list=allPieces();
    if(!list.length){box.innerHTML='<div class="pieces-admin-empty">Aucune pièce. Cliquez sur « Ajouter une pièce ».</div>';return;}
    box.innerHTML=list.map(piece=>{const image=safeHttpUrl(piece.imageUrl),price=lowestPrice(piece),archived=piece.archived===true;return `<article class="pieces-admin-item${archived?' archived':''}">
      <div class="pieces-admin-thumb">${image?`<img src="${esc(image)}" alt=""/>`:'🎭'}</div>
      <div><strong>${esc(piece.title||'Pièce sans titre')}</strong><small>${esc(piece.author||'Auteur non renseigné')}</small>${piece.showPrice!==false&&price!=null?`<small>À partir de ${esc(euro(price))}</small>`:''}<small class="pieces-status ${piece.active===false||archived?'off':''}">${archived?'Archivée':piece.active===false?'Masquée':'Visible'}</small></div>
      <div class="pieces-admin-item-actions"><button type="button" data-piece-edit="${esc(piece.id)}">Modifier</button><button type="button" data-piece-duplicate="${esc(piece.id)}">Dupliquer</button><button type="button" data-piece-toggle="${esc(piece.id)}">${piece.active===false?'Publier':'Masquer'}</button><button class="danger" type="button" data-piece-archive="${esc(piece.id)}">Supprimer</button></div>
    </article>`;}).join('');
    box.querySelectorAll('[data-piece-edit]').forEach(button=>button.addEventListener('click',()=>fillPiece(button.getAttribute('data-piece-edit'))));
    box.querySelectorAll('[data-piece-duplicate]').forEach(button=>button.addEventListener('click',()=>duplicatePiece(button.getAttribute('data-piece-duplicate'))));
    box.querySelectorAll('[data-piece-toggle]').forEach(button=>button.addEventListener('click',()=>togglePiece(button.getAttribute('data-piece-toggle'))));
    box.querySelectorAll('[data-piece-archive]').forEach(button=>button.addEventListener('click',()=>archivePiece(button.getAttribute('data-piece-archive'))));
  }
  function offerRow(offer){
    offer=offer||{}; const product=productById(offer.productId)||{}; const price=product.priceCents!=null?Number(product.priceCents)/100:Number(offer.cachedPriceCents||0)/100;
    const row=document.createElement('article'); row.className='offer-row'; row.dataset.offerId=offer.id||uid('offer'); row.dataset.productId=offer.productId||'';
    row.innerHTML=`<label>Nom de l’offre<input data-offer-name required maxlength="160" value="${esc(offer.name||'')}" placeholder="Pack avec 1 représentation"/></label><label>Descriptif<textarea data-offer-description maxlength="400">${esc(offer.description||'')}</textarea></label><label>Représentations<input data-offer-performances type="number" min="0" step="1" value="${esc(offer.performances==null?'':offer.performances)}"/></label><label>Prix en €<input data-offer-price type="number" min="0.01" step="0.01" required value="${price?esc(String(price)):''}"/></label><label>Ordre<input data-offer-order type="number" step="1" value="${esc(offer.order==null?'999':offer.order)}"/></label><label class="offer-active"><input data-offer-active type="checkbox" ${offer.active===false?'':'checked'}/> Active</label><button class="offer-remove" type="button" aria-label="Retirer cette offre">×</button>`;
    row.querySelector('.offer-remove').addEventListener('click',()=>{if(confirm('Retirer cette offre ? Elle sera masquée dans le catalogue lors de l’enregistrement.'))row.remove();});
    $('piece-offers').appendChild(row);
  }
  function previewImage(value){ const box=$('piece-image-preview'),url=safeHttpUrl(value); box.hidden=!url; box.innerHTML=url?`<img src="${esc(url)}" alt="Aperçu"/><span>L’image sera recadrée au format carré sans être déformée.</span>`:''; }
  function resetForm(){
    state.selectedPieceId=''; $('pieces-form').reset(); $('piece-id').value=''; $('piece-order').value='999'; $('piece-show-price').checked=true; $('piece-active').checked=true; $('piece-offers').innerHTML=''; offerRow({name:'Pack avec 1 représentation',performances:1,active:true,order:1}); $('pieces-form-title').textContent='Ajouter une pièce'; previewImage(''); uploadMessage(''); message('pieces-form-message','');
    $('piece-title').focus();
  }
  function fillPiece(id){
    const piece=pieceById(id); if(!piece)return; state.selectedPieceId=piece.id; $('piece-id').value=piece.id||''; $('piece-title').value=piece.title||''; $('piece-author').value=piece.author||''; $('piece-summary').value=piece.summary||''; $('piece-description').value=piece.description||''; $('piece-genre').value=piece.genre||''; $('piece-audience').value=piece.audience||''; $('piece-duration').value=piece.duration||''; $('piece-characters').value=piece.characterCount||''; $('piece-order').value=piece.order==null?999:piece.order; $('piece-distribution').value=piece.distribution||''; $('piece-pack').value=piece.packContents||''; $('piece-rights').value=piece.rightsText||''; $('piece-additional').value=piece.additionalInfo||''; $('piece-image').value=piece.imageUrl||''; $('piece-external-url').value=piece.externalUrl||''; $('piece-external-label').value=piece.externalLabel||''; $('piece-show-price').checked=piece.showPrice!==false; $('piece-active').checked=piece.active!==false; $('piece-offers').innerHTML=''; offersFor(piece).forEach(offerRow); if(!offersFor(piece).length)offerRow({active:true,order:1}); $('pieces-form-title').textContent='Modifier — '+(piece.title||'Pièce'); previewImage(piece.imageUrl); message('pieces-form-message',''); switchTab('catalog'); $('piece-title').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function collectOffers(){
    return Array.from($('piece-offers').querySelectorAll('.offer-row')).map((row,index)=>({id:row.dataset.offerId||uid('offer'),productId:row.dataset.productId||'',name:row.querySelector('[data-offer-name]').value.trim(),description:row.querySelector('[data-offer-description]').value.trim(),performances:Number(row.querySelector('[data-offer-performances]').value||0)||0,priceCents:Math.round(Number(String(row.querySelector('[data-offer-price]').value||'0').replace(',','.'))*100),order:Number(row.querySelector('[data-offer-order]').value||index+1)||index+1,active:row.querySelector('[data-offer-active]').checked}));
  }
  function collectPiece(){
    const externalRaw=$('piece-external-url').value.trim(),imageRaw=$('piece-image').value.trim(); const external=externalRaw?safeHttpUrl(externalRaw):'',image=imageRaw?safeHttpUrl(imageRaw):'';
    if(externalRaw&&!external) throw new Error('Le lien externe doit commencer par http:// ou https://.'); if(imageRaw&&!image) throw new Error('L’URL de l’image doit commencer par http:// ou https://.');
    return {id:$('piece-id').value.trim()||uid('piece'),title:$('piece-title').value.trim(),author:$('piece-author').value.trim(),summary:$('piece-summary').value.trim(),description:$('piece-description').value.trim(),genre:$('piece-genre').value.trim(),audience:$('piece-audience').value.trim(),duration:$('piece-duration').value.trim(),characterCount:$('piece-characters').value.trim(),distribution:$('piece-distribution').value.trim(),packContents:$('piece-pack').value.trim(),rightsText:$('piece-rights').value.trim(),additionalInfo:$('piece-additional').value.trim(),imageUrl:image,externalUrl:external,externalLabel:$('piece-external-label').value.trim(),showPrice:$('piece-show-price').checked,active:$('piece-active').checked,archived:false,order:Number($('piece-order').value||999)||999};
  }
  async function savePieceData(piece,offers,oldPiece){
    if(!piece.title) throw new Error('Le titre de la pièce est obligatoire.'); if(!offers.length) throw new Error('Ajoutez au moins une offre.');
    offers.forEach(offer=>{if(!offer.name)throw new Error('Chaque offre doit avoir un nom.');if(!Number.isFinite(offer.priceCents)||offer.priceCents<=0)throw new Error('Chaque offre doit avoir un prix supérieur à 0 €.');});
    const savedOffers={};
    for(let index=0;index<offers.length;index+=1){
      const offer=offers[index]; const productId=offer.productId||('piece-'+slug(piece.id)+'-'+slug(offer.id));
      const payload={id:productId,name:piece.title+' — '+offer.name,description:offer.description||piece.summary||'Pièce de théâtre et droits de représentation.',priceCents:offer.priceCents,stock:0,category:PRODUCT_PREFIX+piece.id,order:Number(piece.order||999)*100+Number(offer.order||index+1),imageUrl:piece.imageUrl||'',variantsText:'',active:piece.active!==false&&offer.active!==false};
      await api('/admin/catalog/product',{method:'POST',body:JSON.stringify(payload)});
      savedOffers[offer.id]=Object.assign({},offer,{productId,cachedPriceCents:offer.priceCents}); delete savedOffers[offer.id].priceCents;
    }
    const retained=new Set(Object.values(savedOffers).map(offer=>String(offer.productId))); for(const oldOffer of offersFor(oldPiece||{})){if(oldOffer.productId&&!retained.has(String(oldOffer.productId)))await api('/admin/catalog/product/delete',{method:'POST',body:JSON.stringify({id:oldOffer.productId})});}
    const now=Date.now(); const record=Object.assign({},piece,{offers:savedOffers,updatedAt:now,updatedBy:state.user.uid}); if(!oldPiece)record.createdAt=now; else record.createdAt=oldPiece.createdAt||now;
    await state.db.ref(DATA_PATH+'/pieces/'+piece.id).set(record); return record;
  }
  async function savePiece(event){
    event.preventDefault(); const submit=event.currentTarget.querySelector('button[type=submit]'); submit.disabled=true; message('pieces-form-message','Enregistrement de la pièce et de ses tarifs…');
    try{ const piece=collectPiece(),offers=collectOffers(),oldPiece=pieceById(state.selectedPieceId||piece.id); await savePieceData(piece,offers,oldPiece); message('pieces-form-message','Pièce enregistrée.'); await loadAll(); fillPiece(piece.id); }
    catch(error){console.warn('[FTS admin pièces save]',error);message('pieces-form-message',error.message||'Impossible d’enregistrer la pièce.',false);}finally{submit.disabled=false;}
  }
  async function duplicatePiece(id){
    const source=pieceById(id); if(!source)return; const duplicate=Object.assign({},source,{id:uid('piece'),title:(source.title||'Pièce')+' — copie',active:false,archived:false,order:Number(source.order||999)+1});
    const offers=offersFor(source).map(offer=>Object.assign({},offer,{id:uid('offer'),productId:'',priceCents:Number((productById(offer.productId)||{}).priceCents||offer.cachedPriceCents||0)}));
    try{message('pieces-form-message','Duplication en cours…');await savePieceData(duplicate,offers,null);await loadAll();fillPiece(duplicate.id);message('pieces-form-message','Copie créée et masquée. Vérifiez-la avant publication.');}catch(error){message('pieces-form-message','Duplication impossible : '+error.message,false);}
  }
  async function setPieceVisibility(piece,active,archived){
    for(const offer of offersFor(piece)){ const product=productById(offer.productId); if(!product)continue; await api('/admin/catalog/product',{method:'POST',body:JSON.stringify({id:product.id,name:product.name||product.title,description:product.description||'',priceCents:Number(product.priceCents||0),stock:Number(product.stock||0),category:product.category||PRODUCT_PREFIX+piece.id,order:Number(product.order||999),imageUrl:product.imageUrl||'',variantsText:product.variantsText||'',active:active&&offer.active!==false})}); }
    await state.db.ref(DATA_PATH+'/pieces/'+piece.id).update({active:!!active,archived:!!archived,updatedAt:Date.now(),updatedBy:state.user.uid});
  }
  async function togglePiece(id){ const piece=pieceById(id);if(!piece)return;try{await setPieceVisibility(piece,piece.active===false,false);await loadAll();}catch(error){alert('Impossible de modifier la visibilité : '+error.message);} }
  async function archivePiece(id){ const piece=pieceById(id);if(!piece)return;if(!confirm('Archiver définitivement cette pièce ?\n\nElle disparaîtra du public et ses offres seront masquées. Les anciennes ventes seront conservées.'))return;try{await setPieceVisibility(piece,false,true);await loadAll();resetForm();}catch(error){alert('Archivage impossible : '+error.message);} }
  async function uploadImage(){
    const file=$('piece-image-file').files&&$('piece-image-file').files[0]; if(!file)return uploadMessage('Choisissez une image.',false); if(!/^image\//.test(file.type||''))return uploadMessage('Le fichier choisi n’est pas une image.',false); if(file.size>8*1024*1024)return uploadMessage('Image trop lourde : maximum 8 Mo.',false);
    try{uploadMessage('Upload 0 %…');const url=await FTS.uploadCloudinary(file,pct=>uploadMessage('Upload '+pct+' %…'));$('piece-image').value=url;previewImage(url);uploadMessage('Image envoyée.');}catch(error){uploadMessage('Erreur d’envoi : '+error.message,false);}
  }
  function renderSettings(){ const settings=Object.assign({},DEFAULT_SETTINGS,state.content.settings||{});$('pieces-settings-title').value=settings.title;$('pieces-settings-subtitle').value=settings.subtitle||'';$('pieces-settings-description').value=settings.description;$('pieces-settings-banner').value=settings.bannerUrl||'';$('pieces-settings-published').checked=settings.published!==false; }
  async function saveSettings(event){
    event.preventDefault(); const bannerRaw=$('pieces-settings-banner').value.trim(),banner=bannerRaw?safeHttpUrl(bannerRaw):'';if(bannerRaw&&!banner)return message('pieces-settings-message','L’URL de bannière doit commencer par http:// ou https://.',false);
    const settings={title:$('pieces-settings-title').value.trim()||DEFAULT_SETTINGS.title,subtitle:$('pieces-settings-subtitle').value.trim(),description:$('pieces-settings-description').value.trim()||DEFAULT_SETTINGS.description,bannerUrl:banner,published:$('pieces-settings-published').checked,updatedAt:Date.now(),updatedBy:state.user.uid};
    try{await state.db.ref(DATA_PATH+'/settings').set(settings);state.content.settings=settings;message('pieces-settings-message','En-tête enregistré.');}catch(error){message('pieces-settings-message','Enregistrement impossible : '+error.message,false);}
  }
  function buildOfferIndex(){ const map=new Map();allPieces().forEach(piece=>offersFor(piece).forEach(offer=>map.set(String(offer.productId),{piece,offer,product:productById(offer.productId)})));return map; }
  function lineVariants(line){return line&&line.variants&&typeof line.variants==='object'?line.variants:{};}
  function linesForOrder(order){ return Array.isArray(order&&order.cartLines)&&order.cartLines.length?order.cartLines:[order]; }
  function pieceLines(order,index){ return linesForOrder(order).filter(line=>index.has(String(line&&line.productId||''))||String(lineVariants(line).Module||'').toLowerCase().includes('pièce')); }
  function paymentKind(status){const s=String(status||'').toLowerCase();if(['paid','authorized','validated','success','confirmed','succeeded'].includes(s))return'paid';if(['refused','failed','error','canceled','cancelled','abandoned','refunded'].includes(s))return'refused';return'pending';}
  function paymentLabel(status){const kind=paymentKind(status);return kind==='paid'?'Payé / à envoyer':kind==='refused'?'Annulé ou remboursé':'Paiement à vérifier';}
  function orderAmount(order){return Number(order.totalAmount||order.totalAmountCents||order.amountCents||order.amount||0);}
  function lineAmount(line){return Number(line&& (line.amountCents||line.totalAmountCents||line.totalAmount||line.amount)||0)||Number(line&&line.unitPriceCents||0)*Math.max(1,Number(line&&line.quantity||1)||1);}
  function payerName(order){const payer=order.payer||{};return [payer.firstName,payer.lastName].filter(Boolean).join(' ')||order.userName||order.payerName||'Acheteur non renseigné';}
  function payerEmail(order){return order.userEmail||(order.payer&&order.payer.email)||order.email||'';}
  function payerPhone(order){return order.payerPhone||(order.payer&&(order.payer.phone||order.payer.tel||order.payer.telephone))||order.phone||'';}
  function saleDate(value){const date=new Date(Number(value||0));return Number.isFinite(date.getTime())?date.toLocaleString('fr-FR'):'Date inconnue';}
  function renderSales(){
    const box=$('pieces-sales-list'),index=buildOfferIndex(); const sales=state.sales.map(order=>({order,lines:pieceLines(order,index)})).filter(item=>String(item.order.source||'')==='pieces.html'||item.lines.length);
    if(!sales.length){box.innerHTML='<div class="pieces-admin-empty">Aucune commande de pièce trouvée.</div>';return;}
    box.innerHTML=sales.sort((a,b)=>Number(b.order.createdAt||0)-Number(a.order.createdAt||0)).map(({order,lines})=>{
      const id=String(order.id||order.orderId||''),meta=state.salesMeta[firebaseKey(id)]||{},kind=paymentKind(order.status),sent=meta.fulfillmentStatus==='sent',organization=(order.payer&&order.payer.organization)||lines.map(line=>lineVariants(line).Structure||lineVariants(line).Organisation||'').find(Boolean)||'';
      return `<article class="piece-sale" data-piece-sale="${esc(id)}"><div><h3>${esc(payerName(order))}</h3><small>${esc([payerEmail(order),payerPhone(order)].filter(Boolean).join(' · '))}</small>${organization?`<p><strong>Structure :</strong> ${esc(organization)}</p>`:''}<p>Référence : ${esc(id)} · ${esc(saleDate(order.createdAt))}</p><div class="piece-sale-lines">${lines.map(line=>{const found=index.get(String(line.productId||'')),variants=lineVariants(line),title=found?found.piece.title:(variants.Pièce||line.productName||line.itemName||'Pièce'),offer=found?found.offer.name:(variants.Offre||''),performances=found?found.offer.performances:variants.Représentations;return `<div class="piece-sale-line"><strong>${esc(title)}${offer?' — '+esc(offer):''}</strong><small>${performances?esc(String(performances))+' représentation(s) · ':''}${esc(euro(lineAmount(line)))}</small></div>`;}).join('')}</div></div><div><strong>Suivi du pack</strong>${sent?`<small class="piece-sale-sent">Envoyé le ${esc(saleDate(meta.sentAt))}</small>`:'<small>En attente d’envoi manuel</small>'}</div><div class="piece-sale-payment"><strong>${esc(euro(orderAmount(order)))}</strong><span class="piece-sale-status ${kind}">${esc(paymentLabel(order.status))}</span>${sent?'<span class="piece-sale-sent">Pack envoyé</span>':''}</div><div class="piece-sale-followup"><input data-sale-note value="${esc(meta.internalNote||'')}" placeholder="Note interne facultative"/><div class="pieces-admin-actions"><button class="pieces-admin-btn ghost" type="button" data-save-sale-note="${esc(id)}">Enregistrer la note</button>${kind==='paid'&&!sent?`<button class="pieces-admin-btn" type="button" data-mark-sale-sent="${esc(id)}">Marquer comme envoyé</button>`:''}</div></div></article>`;
    }).join('');
    box.querySelectorAll('[data-save-sale-note]').forEach(button=>button.addEventListener('click',()=>saveSaleMeta(button.getAttribute('data-save-sale-note'),false,button)));
    box.querySelectorAll('[data-mark-sale-sent]').forEach(button=>button.addEventListener('click',()=>saveSaleMeta(button.getAttribute('data-mark-sale-sent'),true,button)));
  }
  async function saveSaleMeta(orderId,markSent,button){
    const card=button.closest('[data-piece-sale]'),note=card.querySelector('[data-sale-note]').value.trim(),key=firebaseKey(orderId),existing=state.salesMeta[key]||{}; button.disabled=true;
    const update={orderId,internalNote:note,updatedAt:Date.now(),updatedBy:state.user.uid};if(markSent){update.fulfillmentStatus='sent';update.sentAt=Date.now();}else{update.fulfillmentStatus=existing.fulfillmentStatus||'pending';update.sentAt=existing.sentAt||0;}
    try{await state.db.ref(SALES_PATH+'/'+key).update(update);state.salesMeta[key]=Object.assign({},existing,update);renderSales();}catch(error){alert('Impossible d’enregistrer le suivi : '+error.message);button.disabled=false;}
  }
  async function loadSales(){
    const box=$('pieces-sales-list');box.innerHTML='<div class="pieces-admin-empty">Chargement des ventes…</div>';
    try{const [data,metaSnap]=await Promise.all([api('/admin/orders?limit=500'),state.db.ref(SALES_PATH).once('value')]);state.sales=Array.isArray(data.orders)?data.orders:[];state.salesMeta=metaSnap.val()||{};state.salesLoaded=true;renderSales();}catch(error){console.warn('[FTS admin pièces ventes]',error);box.innerHTML='<div class="pieces-admin-empty">Impossible de charger les ventes. Vérifiez les droits Firebase et le worker.</div>';}
  }
  function switchTab(name){
    document.querySelectorAll('[data-pieces-tab]').forEach(button=>button.classList.toggle('active',button.getAttribute('data-pieces-tab')===name));
    ['catalog','sales','settings'].forEach(view=>{$('pieces-view-'+view).hidden=view!==name;}); if(name==='sales'&&!state.salesLoaded)loadSales();
  }
  async function loadAll(){
    const [contentSnap,catalog]=await Promise.all([state.db.ref(DATA_PATH).once('value'),api('/admin/catalog')]); const content=contentSnap.val()||{};state.content={settings:Object.assign({},DEFAULT_SETTINGS,content.settings||{}),pieces:content.pieces||{}};state.products={};productRows(catalog.products).filter(isPiecesProduct).forEach(product=>{state.products[String(product.id)]=product;});renderPieces();renderSettings();if(state.salesLoaded)renderSales();
  }
  function bindUi(){
    document.querySelectorAll('[data-pieces-tab]').forEach(button=>button.addEventListener('click',()=>switchTab(button.getAttribute('data-pieces-tab'))));
    $('pieces-new').addEventListener('click',()=>{switchTab('catalog');resetForm();});$('piece-reset').addEventListener('click',resetForm);$('pieces-form').addEventListener('submit',savePiece);$('piece-add-offer').addEventListener('click',()=>offerRow({active:true,order:$('piece-offers').children.length+1}));$('piece-upload-image').addEventListener('click',uploadImage);$('piece-image').addEventListener('input',event=>previewImage(event.target.value));$('pieces-settings-form').addEventListener('submit',saveSettings);$('pieces-refresh-sales').addEventListener('click',loadSales);
  }
  function boot(){
    state.db=FTS.initFirebase();firebase.auth().onAuthStateChanged(async user=>{if(!user){location.href='auth.html';return;}try{const snap=await state.db.ref('fts_users/'+user.uid).once('value'),profile=snap.val()||{};if(String(profile.status||'').toLowerCase()!=='active'){await firebase.auth().signOut();location.href='auth.html';return;}if(String(profile.role||'').toLowerCase()!=='admin'){location.href='membres.html';return;}state.user=user;$('pieces-admin-loading').style.display='none';$('pieces-admin-shell').hidden=false;bindUi();resetForm();await loadAll();}catch(error){console.warn('[FTS admin pièces]',error);$('pieces-admin-error').textContent='Impossible de charger l’administration : '+(error.message||error);}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
