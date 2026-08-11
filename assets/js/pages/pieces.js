(function(window){
  'use strict';

  const FTS = window.FTS = window.FTS || {};
  const DATA_PATH = 'fts_content/piecesModule';
  const PRODUCT_PREFIX = '__PIECES__:';
  const CART_KEY = 'fts_pieces_cart_v1';
  const DEFAULT_SETTINGS = {
    title:'Nos pièces de théâtre',
    subtitle:'',
    description:'Des créations prêtes à jouer, avec textes, ressources de mise en scène et droits de représentation.',
    bannerUrl:'',
    published:true
  };
  const state = { db:null, settings:DEFAULT_SETTINGS, pieces:{}, products:[], productMap:new Map(), cart:[], activeModal:null, previousFocus:null };
  const $ = id => document.getElementById(id);
  const esc = value => FTS.esc ? FTS.esc(value == null ? '' : value) : String(value == null ? '' : value);
  const euro = cents => (Number(cents || 0) / 100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});

  function workerUrl(){
    return String((FTS.PAYMENT && FTS.PAYMENT.workerUrl) || 'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/,'');
  }
  function isPiecesProduct(product){ return String(product && product.category || '').startsWith(PRODUCT_PREFIX); }
  function safeHttpUrl(value){
    const raw = String(value || '').trim();
    if(!raw) return '';
    try{
      const url = new URL(raw, location.origin);
      return ['https:','http:'].includes(url.protocol) ? url.href : '';
    }catch(e){ return ''; }
  }
  function rows(value){
    if(Array.isArray(value)) return value.filter(Boolean);
    if(value && typeof value === 'object') return Object.entries(value).map(([id,item])=>Object.assign({id},item||{}));
    return [];
  }
  function sortedPieces(){
    return rows(state.pieces).filter(piece=>piece && piece.active !== false && piece.archived !== true)
      .sort((a,b)=>Number(a.order||999)-Number(b.order||999)||String(a.title||'').localeCompare(String(b.title||''),'fr'));
  }
  function offersFor(piece){
    return rows(piece && piece.offers).filter(offer=>{
      const product = state.productMap.get(String(offer && offer.productId || ''));
      return offer && offer.active !== false && product && product.active !== false && isPiecesProduct(product);
    }).map(offer=>Object.assign({},offer,{product:state.productMap.get(String(offer.productId))}))
      .sort((a,b)=>Number(a.order||999)-Number(b.order||999)||String(a.name||'').localeCompare(String(b.name||''),'fr'));
  }
  function setState(message){
    const el=$('pieces-state');
    if(el){ el.hidden=false; el.textContent=message; }
    const grid=$('pieces-grid'); if(grid) grid.hidden=true;
  }
  function renderHeader(){
    const settings=Object.assign({},DEFAULT_SETTINGS,state.settings||{});
    $('pieces-title').textContent=settings.title||DEFAULT_SETTINGS.title;
    $('pieces-description').textContent=settings.description||DEFAULT_SETTINGS.description;
    const subtitle=$('pieces-subtitle'); subtitle.textContent=String(settings.subtitle||''); subtitle.hidden=!subtitle.textContent;
    const banner=$('pieces-banner'); const bannerUrl=safeHttpUrl(settings.bannerUrl);
    banner.hidden=!bannerUrl; banner.innerHTML=bannerUrl?`<img src="${esc(bannerUrl)}" alt=""/>`:'';
  }
  function render(){
    renderHeader();
    if(state.settings && state.settings.published === false){ setState('Cette page est momentanément masquée.'); return; }
    const list=sortedPieces();
    const grid=$('pieces-grid'); const status=$('pieces-state');
    if(!list.length){ setState('Aucune pièce n’est publiée pour le moment.'); return; }
    status.hidden=true; grid.hidden=false;
    grid.innerHTML=list.map(piece=>{
      const offers=offersFor(piece);
      const minPrice=offers.length?Math.min.apply(null,offers.map(offer=>Number(offer.product.priceCents||0))):0;
      const image=safeHttpUrl(piece.imageUrl);
      return `<article class="piece-card">
        <button class="piece-card-button" type="button" data-piece-open="${esc(piece.id)}" aria-label="Voir la pièce ${esc(piece.title||'')}">
          <div class="piece-card-image">${image?`<img src="${esc(image)}" alt="Couverture de ${esc(piece.title||'la pièce')}" loading="lazy"/>`:'🎭'}</div>
          <div class="piece-card-body">
            <h2>${esc(piece.title||'Pièce de théâtre')}</h2>
            ${piece.author?`<div class="piece-card-author">${esc(piece.author)}</div>`:''}
            ${piece.showPrice!==false&&offers.length?`<div class="piece-card-price">À partir de ${esc(euro(minPrice))}</div>`:''}
          </div>
        </button>
      </article>`;
    }).join('');
    grid.querySelectorAll('[data-piece-open]').forEach(button=>button.addEventListener('click',()=>openDetail(button.getAttribute('data-piece-open'))));
  }
  function detailSection(title,text,wide){
    const clean=String(text||'').trim();
    return clean?`<section class="piece-detail-section${wide?' wide':''}"><h3>${esc(title)}</h3><p>${esc(clean)}</p></section>`:'';
  }
  function openDetail(pieceId){
    const piece=rows(state.pieces).find(item=>String(item.id)===String(pieceId));
    if(!piece) return;
    const offers=offersFor(piece); const image=safeHttpUrl(piece.imageUrl); const external=safeHttpUrl(piece.externalUrl);
    const meta=[piece.genre,piece.audience,piece.duration,piece.characterCount?piece.characterCount+' personnage(s)':''].filter(Boolean);
    $('piece-detail-content').innerHTML=`<article class="piece-detail">
      <div class="piece-detail-hero">
        <div class="piece-detail-image">${image?`<img src="${esc(image)}" alt="Couverture de ${esc(piece.title||'la pièce')}"/>`:'🎭'}</div>
        <div class="piece-detail-title">
          <div class="pieces-kicker">${esc(piece.author?('Une pièce de '+piece.author):'Fais Ton Show')}</div>
          <h2 id="piece-detail-title">${esc(piece.title||'Pièce de théâtre')}</h2>
          ${piece.summary?`<p>${esc(piece.summary)}</p>`:''}
          ${meta.length?`<div class="piece-detail-meta">${meta.map(value=>`<span>${esc(value)}</span>`).join('')}</div>`:''}
        </div>
      </div>
      <div class="piece-detail-sections">
        ${detailSection('Description',piece.description,true)}
        ${detailSection('Distribution et adaptations',piece.distribution,false)}
        ${detailSection('Contenu du pack',piece.packContents,false)}
        ${detailSection('Droits de représentation',piece.rightsText,true)}
        ${detailSection('Conseils et informations',piece.additionalInfo,true)}
      </div>
      ${offers.length?`<section class="piece-offers"><h3>Choisir une offre</h3>${offers.map(offer=>`<article class="piece-offer"><div><strong>${esc(offer.name||'Offre')}</strong>${offer.description?`<small>${esc(offer.description)}</small>`:''}${offer.performances?`<small>${esc(String(offer.performances))} représentation(s) incluse(s)</small>`:''}</div>${piece.showPrice!==false?`<div class="piece-offer-price">${esc(euro(offer.product.priceCents))}</div>`:''}<button type="button" data-add-offer="${esc(offer.id)}">Ajouter au panier</button></article>`).join('')}</section>`:''}
      ${external?`<div class="piece-external-wrap"><a class="piece-external-link" href="${esc(external)}" target="_blank" rel="noopener noreferrer">${esc(piece.externalLabel||'En savoir plus')}</a></div>`:''}
    </article>`;
    $('piece-detail-content').querySelectorAll('[data-add-offer]').forEach(button=>button.addEventListener('click',()=>addOfferToCart(piece,offers.find(offer=>String(offer.id)===String(button.getAttribute('data-add-offer'))))));
    openModal($('piece-detail-modal'));
  }
  function loadCart(){
    try{ state.cart=JSON.parse(localStorage.getItem(CART_KEY)||'[]'); }catch(e){ state.cart=[]; }
    if(!Array.isArray(state.cart)) state.cart=[];
    state.cart=state.cart.filter(line=>line&&line.productId&&state.productMap.has(String(line.productId)));
  }
  function saveCart(){ localStorage.setItem(CART_KEY,JSON.stringify(state.cart)); updateCartBubble(); }
  function updateCartBubble(){
    const bubble=$('pieces-cart-bubble'); if(!bubble) return;
    bubble.hidden=!state.cart.length; const count=bubble.querySelector('strong'); if(count) count.textContent=String(state.cart.length);
  }
  function addOfferToCart(piece,offer){
    if(!offer||!offer.product) return;
    loadCart();
    state.cart.push({id:'piece_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),pieceId:piece.id,offerId:offer.id,productId:offer.productId,pieceTitle:piece.title||'Pièce',offerName:offer.name||'Offre',performances:Number(offer.performances||0)||0});
    saveCart(); closeModal($('piece-detail-modal')); openCart();
  }
  function removeCartLine(lineId){ loadCart(); state.cart=state.cart.filter(line=>String(line.id)!==String(lineId)); saveCart(); renderCart(); }
  function cartTotal(){ return state.cart.reduce((sum,line)=>sum+Number((state.productMap.get(String(line.productId))||{}).priceCents||0),0); }
  function openCart(){ loadCart(); renderCart(); openModal($('pieces-cart-modal')); }
  function renderCart(){
    const box=$('pieces-cart-content'); if(!box) return;
    const user=window.firebase&&firebase.auth&&firebase.auth().currentUser;
    if(!state.cart.length){ box.innerHTML='<div class="pieces-cart-empty">Votre panier de pièces est vide.</div>'; return; }
    box.innerHTML=`<div class="pieces-cart-lines">${state.cart.map(line=>{const product=state.productMap.get(String(line.productId))||{};return `<article class="pieces-cart-line"><div><strong>${esc(line.pieceTitle)}</strong><small>${esc(line.offerName)}${line.performances?' · '+esc(String(line.performances))+' représentation(s)':''}</small></div><strong>${esc(euro(product.priceCents))}</strong><button type="button" data-remove-piece-line="${esc(line.id)}">Retirer</button></article>`;}).join('')}</div>
      <div class="pieces-cart-total"><span>Total — paiement en une fois</span><strong>${esc(euro(cartTotal()))}</strong></div>
      <form class="pieces-checkout-form" id="pieces-checkout-form">
        <div class="pieces-checkout-grid"><label>Prénom<input name="firstName" autocomplete="given-name" required/></label><label>Nom<input name="lastName" autocomplete="family-name" required/></label></div>
        <div class="pieces-checkout-grid"><label>Email<input name="email" type="email" autocomplete="email" required value="${esc(user&&user.email||'')}"/></label><label>Téléphone<input name="phone" type="tel" autocomplete="tel" required/></label></div>
        <label>Troupe, compagnie, école ou association <span>(facultatif)</span><input name="organization" maxlength="180"/></label>
        <button type="submit">Payer en une fois avec HelloAsso</button>
        <div class="pieces-checkout-message" id="pieces-checkout-message" aria-live="polite"></div>
      </form>`;
    box.querySelectorAll('[data-remove-piece-line]').forEach(button=>button.addEventListener('click',()=>removeCartLine(button.getAttribute('data-remove-piece-line'))));
    $('pieces-checkout-form').addEventListener('submit',submitCheckout);
  }
  async function authToken(){
    try{ const user=firebase.auth().currentUser; return user?await user.getIdToken(false):''; }catch(e){ return ''; }
  }
  async function submitCheckout(event){
    event.preventDefault(); loadCart(); if(!state.cart.length) return;
    const form=event.currentTarget; const message=$('pieces-checkout-message'); const button=form.querySelector('button[type=submit]');
    button.disabled=true; button.textContent='Préparation du paiement…'; message.textContent='Connexion sécurisée à HelloAsso…';
    try{
      const organization=String(form.organization.value||'').trim(); const headers={'Content-Type':'application/json'}; const token=await authToken(); if(token) headers.Authorization='Bearer '+token;
      const payload={type:'mixed_cart',source:'pieces.html',returnPath:'paiement',paymentPlan:'1x',payer:{firstName:form.firstName.value,lastName:form.lastName.value,email:form.email.value,phone:form.phone.value},seasonLines:[],shopLines:state.cart.map(line=>({type:'shop_order',productId:line.productId,quantity:1,variants:{Module:'Pièces de théâtre',Pièce:line.pieceTitle,Offre:line.offerName,Représentations:line.performances?String(line.performances):'',Structure:organization}}))};
      const response=await fetch(workerUrl()+'/checkout',{method:'POST',headers,body:JSON.stringify(payload)}); const data=await response.json().catch(()=>({}));
      if(!response.ok||!data||data.ok===false||(!data.redirectUrl&&!data.confirmationUrl)) throw new Error((data&&data.error)||('HTTP '+response.status));
      localStorage.removeItem(CART_KEY); state.cart=[]; updateCartBubble(); location.href=data.redirectUrl||data.confirmationUrl;
    }catch(error){ console.warn('[FTS pièces checkout]',error); message.textContent='Impossible de lancer le paiement. Réessayez dans quelques instants.'; button.disabled=false; button.textContent='Payer en une fois avec HelloAsso'; }
  }
  function focusable(modal){ return Array.from(modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el=>!el.hidden); }
  function openModal(modal){
    if(!modal) return; if(state.activeModal&&state.activeModal!==modal) closeModal(state.activeModal);
    state.previousFocus=document.activeElement; state.activeModal=modal; modal.hidden=false; document.body.classList.add('pieces-modal-open');
    const targets=focusable(modal); if(targets.length) targets[0].focus();
  }
  function closeModal(modal){
    if(!modal) return; modal.hidden=true; if(state.activeModal===modal) state.activeModal=null; if(!state.activeModal) document.body.classList.remove('pieces-modal-open');
    if(state.previousFocus&&document.contains(state.previousFocus)) state.previousFocus.focus(); state.previousFocus=null;
  }
  function onKeydown(event){
    const modal=state.activeModal; if(!modal) return;
    if(event.key==='Escape'){ event.preventDefault(); closeModal(modal); return; }
    if(event.key!=='Tab') return; const targets=focusable(modal); if(!targets.length){event.preventDefault();return;} const first=targets[0],last=targets[targets.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  function bindUi(){
    $('pieces-cart-bubble').addEventListener('click',openCart);
    $('piece-detail-modal').addEventListener('click',event=>{if(event.target===$('piece-detail-modal')||event.target.closest('[data-piece-detail-close]'))closeModal($('piece-detail-modal'));});
    $('pieces-cart-modal').addEventListener('click',event=>{if(event.target===$('pieces-cart-modal')||event.target.closest('[data-pieces-cart-close]'))closeModal($('pieces-cart-modal'));});
    document.addEventListener('keydown',onKeydown);
  }
  async function load(){
    const [contentSnap,catalogResponse]=await Promise.all([
      state.db.ref(DATA_PATH).once('value'),
      fetch(workerUrl()+'/catalog/products',{method:'GET',headers:{Accept:'application/json'}})
    ]);
    const catalog=await catalogResponse.json().catch(()=>({})); if(!catalogResponse.ok||catalog.ok===false) throw new Error(catalog.error||('catalog_'+catalogResponse.status));
    const content=contentSnap.val()||{}; state.settings=Object.assign({},DEFAULT_SETTINGS,content.settings||{}); state.pieces=content.pieces||{};
    state.products=(Array.isArray(catalog.products)?catalog.products:[]).filter(isPiecesProduct); state.productMap=new Map(state.products.map(product=>[String(product.id),product]));
    loadCart(); saveCart(); render();
  }
  function boot(){
    bindUi();
    try{ state.db=FTS.initFirebase(); }catch(error){ setState('La page des pièces est indisponible pour le moment.'); return; }
    if(window.firebase&&firebase.auth) firebase.auth().onAuthStateChanged(()=>load().catch(error=>{console.warn('[FTS pièces]',error);setState('Impossible de charger les pièces pour le moment.');}));
    else load().catch(error=>{console.warn('[FTS pièces]',error);setState('Impossible de charger les pièces pour le moment.');});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})(window);
