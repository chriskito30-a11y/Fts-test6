(function(window){
  'use strict';
  const FTS=window.FTS=window.FTS||{}; const $=id=>document.getElementById(id);
  const esc=v=>FTS.esc?FTS.esc(v==null?'':v):String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const euro=c=>(Number(c||0)/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
  let products=[];
  function worker(){ return String((FTS.PAYMENT&&FTS.PAYMENT.workerUrl)||'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/,''); }
  async function token(){ const u=firebase.auth().currentUser; return u ? u.getIdToken(true) : ''; }
  async function api(path,opts){ const t=await token(); const headers={'Content-Type':'application/json'}; if(t) headers.Authorization='Bearer '+t; const res=await fetch(worker()+path,Object.assign({headers},opts||{})); const data=await res.json().catch(()=>null); if(!res.ok||!data||data.ok===false) throw new Error((data&&data.error)||('HTTP '+res.status)); return data; }
  function guard(txt){ $('shop-guard').hidden=false; $('shop-guard').innerHTML='<div class="shop-empty">'+esc(txt)+'</div>'; $('shop-list').hidden=true; }
  function slug(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }
  function prettyCategoryName(cat){
    const raw=String(cat||'').trim();
    if(!raw) return '';
    return raw.replace(/^liste\s*d[ée]roulante\s*[—–-]\s*/i,'').trim();
  }
  function dropdownGroupName(p){
    const cat=String(p&&p.category||'').trim();
    const catSlug=slug(cat);
    if(catSlug.indexOf('liste_deroulante_')===0 || catSlug==='liste_deroulante') return prettyCategoryName(cat) || 'Liste déroulante';
    // Compatibilité avec la première version livrée : les anciens produits restent regroupés.
    if(catSlug==='reglement_exceptionnel') return 'Règlement exceptionnel';
    return '';
  }
  function dropdownGroupId(name){ return '__dropdown_group__'+slug(name); }
  function dropdownAmountLabel(p){ return euro(p&&p.priceCents); }
  function parseOptions(text){
    return String(text||'').split(/\n+/).map(line=>line.trim()).filter(Boolean).map((line,i)=>{
      const parts=line.split(':');
      if(parts.length<2) return null;
      const name=parts.shift().trim();
      const values=parts.join(':').split(',').map(v=>v.trim()).filter(Boolean);
      return name&&values.length?{key:slug(name)||('option_'+i),name,values}:null;
    }).filter(Boolean);
  }
  function modal(){
    let m=document.getElementById('shop-buy-modal');
    if(m) return m;
    m=document.createElement('div');
    m.id='shop-buy-modal';
    m.className='shop-buy-modal';
    m.innerHTML='<div class="shop-buy-card"><button type="button" class="shop-buy-close" data-shop-close>×</button><div class="shop-buy-kicker">Boutique Fais Ton Show</div><h2 id="shop-buy-title"></h2><p id="shop-buy-summary"></p><form id="shop-buy-form"><div id="shop-buy-options"></div><label data-shop-quantity>Quantité<input name="quantity" type="number" min="1" max="20" value="1" required></label><label>Prénom<input name="firstName" required></label><label>Nom<input name="lastName" required></label><label>Email<input name="email" type="email" required></label><label>Téléphone<input name="phone" type="tel" required></label><label>Code promo / code spécial<input name="promoCode" placeholder="Optionnel"></label><button type="submit">Continuer</button><div id="shop-buy-msg" class="shop-buy-msg"></div></form></div>';
    document.body.appendChild(m);
    m.addEventListener('click',e=>{ if(e.target===m || e.target.closest('[data-shop-close]')) m.classList.remove('open'); });
    document.getElementById('shop-buy-form').addEventListener('submit',submitBuy);
    return m;
  }
  let currentProduct=null, currentButton=null, currentDropdownGroup=null;
  function dropdownGroups(){
    const map={};
    (products||[]).forEach(p=>{
      const name=dropdownGroupName(p);
      if(!name) return;
      const key=slug(name)||'liste';
      if(!map[key]) map[key]={__dropdownGroup:true,id:dropdownGroupId(name),name,category:'Paiement ponctuel',description:'Choisis le montant ou l’option demandé par l’administration Fais Ton Show.',items:[]};
      map[key].items.push(p);
    });
    return Object.values(map).map(g=>{
      g.items.sort((a,b)=>Number(a.priceCents||0)-Number(b.priceCents||0) || String(a.name||'').localeCompare(String(b.name||''),'fr'));
      g.priceCents=(g.items[0]&&g.items[0].priceCents)||0;
      return g;
    }).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr'));
  }
  function render(){
    const box=$('shop-list'); $('shop-guard').hidden=true; box.hidden=false;
    const groups=dropdownGroups();
    const rows=(products||[]).filter(p=>!dropdownGroupName(p));
    groups.forEach(g=>rows.push(g));
    if(!rows.length){ box.innerHTML='<div class="shop-empty">Aucun article disponible pour le moment.</div>'; return; }
    box.innerHTML=rows.map(p=>{
      if(p.__dropdownGroup){
        const labels=p.items.map(dropdownAmountLabel);
        const prices=p.items.map(item=>Number(item.priceCents||0));
        const min=Math.min.apply(null,prices), max=Math.max.apply(null,prices);
        return `<article class="shop-item shop-item-exceptional"><div class="shop-img">💳</div><div class="shop-body"><span>${esc(p.category)}</span><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><small>Choix disponibles : ${esc(labels.join(' · '))}</small><div class="shop-buy"><strong>${min===max?euro(min):('de '+euro(min)+' à '+euro(max))}</strong><button type="button" data-buy="${esc(p.id)}">Choisir</button></div></div></article>`;
      }
      const opts=parseOptions(p.variantsText);
      return `<article class="shop-item"><div class="shop-img">${p.imageUrl?`<img src="${esc(p.imageUrl)}" alt=""/>`:'🛍️'}</div><div class="shop-body"><span>${esc(p.category||'Boutique')}</span><h2>${esc(p.name||'Article')}</h2><p>${esc(p.description||'')}</p>${opts.length?`<small>${esc(opts.map(o=>o.name).join(' · '))}</small>`:''}<div class="shop-buy"><strong>${euro(p.priceCents)}</strong><button type="button" data-buy="${esc(p.id)}">Acheter</button></div></div></article>`;
    }).join('');
    box.querySelectorAll('[data-buy]').forEach(btn=>btn.addEventListener('click',()=>openBuy(btn.getAttribute('data-buy'),btn)));
  }
  function prefill(form){ try{ const u=firebase.auth().currentUser; form.email.value=(u&&u.email)||''; }catch(e){} }
  function optionsHtml(opts){ return opts.length?opts.map(o=>`<label>${esc(o.name)}<select name="opt_${esc(o.key)}" data-option-name="${esc(o.name)}" required><option value="">Choisir…</option>${o.values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`).join(''):''; }
  function openBuy(id,btn){
    const groups=dropdownGroups();
    const group=groups.find(g=>String(g.id)===String(id));
    const p=group||products.find(x=>String(x.id)===String(id));
    if(!p) return;
    currentProduct=p; currentButton=btn; currentDropdownGroup=p.__dropdownGroup?p:null;
    const m=modal();
    const form=$('shop-buy-form');
    const qtyLabel=form.querySelector('[data-shop-quantity]');
    $('shop-buy-title').textContent=p.name||'Article';
    const zone=$('shop-buy-options');
    if(p.__dropdownGroup){
      $('shop-buy-summary').textContent='Choisis l’option demandée par l’administration.';
      const motifSource=(p.items.find(item=>String(item.variantsText||'').trim())||{}).variantsText || 'Motif : Complément formule spéciale, Option adulte complémentaire, Régularisation inscription, Différence tarifaire, Autre cas validé';
      const motifOptions=parseOptions(motifSource);
      zone.innerHTML=`<label>Montant / option<select name="dropdownProductId" data-dropdown-product required><option value="">Choisir…</option>${p.items.map(item=>`<option value="${esc(item.id)}">${esc(item.name||dropdownAmountLabel(item))} — ${esc(euro(item.priceCents))}</option>`).join('')}</select></label>`+optionsHtml(motifOptions);
      if(qtyLabel) qtyLabel.hidden=true;
    } else {
      const opts=parseOptions(p.variantsText);
      $('shop-buy-summary').textContent=euro(p.priceCents);
      zone.innerHTML=optionsHtml(opts);
      if(qtyLabel) qtyLabel.hidden=false;
    }
    form.reset(); form.quantity.value='1'; prefill(form); $('shop-buy-msg').textContent='';
    const dropdownSelect=form.querySelector('[data-dropdown-product]');
    if(dropdownSelect){
      dropdownSelect.addEventListener('change',()=>{
        const selected=(currentDropdownGroup&&currentDropdownGroup.items||[]).find(item=>String(item.id)===String(dropdownSelect.value));
        $('shop-buy-summary').textContent=selected?('Sélection : '+(selected.name||'Option')+' · '+euro(selected.priceCents)):'Choisis l’option demandée par l’administration.';
      },{once:false});
    }
    m.classList.add('open');
  }
  function selectedProductForSubmit(form){
    if(currentDropdownGroup){
      const sel=form.querySelector('[data-dropdown-product]');
      const picked=(currentDropdownGroup.items||[]).find(item=>String(item.id)===String(sel&&sel.value));
      return picked||null;
    }
    return currentProduct;
  }
  async function submitBuy(e){ e.preventDefault(); const form=e.currentTarget; const p=selectedProductForSubmit(form); if(!p) return; const btn=currentButton; const submit=form.querySelector('button[type="submit"]'); const old=btn?btn.textContent:''; if(btn){btn.disabled=true;btn.textContent='Préparation…'} if(submit){submit.disabled=true;submit.textContent='Préparation…'} try{ const variants={}; form.querySelectorAll('[data-option-name]').forEach(sel=>{ variants[sel.getAttribute('data-option-name')]=sel.value; }); if(currentDropdownGroup){ variants['Liste déroulante']=currentDropdownGroup.name; variants['Choix']=p.name||dropdownAmountLabel(p); } const quantity=currentDropdownGroup?1:Math.max(1,Math.min(20,Math.round(Number(form.quantity.value||1))||1)); const data=await api('/checkout',{method:'POST',body:JSON.stringify({type:'shop_order',source:'boutique.html',productId:p.id,quantity,variants,payer:{firstName:form.firstName.value,lastName:form.lastName.value,email:form.email.value,phone:form.phone.value},promoCode:form.promoCode?form.promoCode.value:''})}); if(data.redirectUrl){location.href=data.redirectUrl;}else if(data.confirmationUrl){location.href=data.confirmationUrl;}else{throw new Error('redirect_missing');} }catch(err){ console.warn(err); $('shop-buy-msg').textContent=err.message==='product_out_of_stock'?'Stock insuffisant.':'Impossible de lancer le paiement.'; if(btn){btn.disabled=false;btn.textContent=old} if(submit){submit.disabled=false;submit.textContent='Continuer'} } }
  async function load(){ const data=await api('/catalog/products',{method:'GET'}); products=data.products||[]; render(); }
  function boot(){ FTS.initFirebase(); if(window.firebase && firebase.auth){ firebase.auth().onAuthStateChanged(()=>load().catch(e=>guard('Boutique indisponible : '+e.message))); } else { load().catch(e=>guard('Boutique indisponible : '+e.message)); } }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})(window);
