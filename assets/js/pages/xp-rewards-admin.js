(function(window){
  'use strict';
  const FTS = window.FTS = window.FTS || {};
  let db = null;
  let me = null;
  let users = {};
  let forumUsers = {};
  let rewards = {};
  let selected = null;
  const DEFAULT_THRESHOLDS = [500, 1000, 1500, 2000, 3000, 5000];
  const DEFAULT_REWARD_SUGGESTIONS = {
    500:'Badge / petit avantage communauté',
    1000:'Code promo boutique',
    1500:'Code promo goodies',
    2000:'Avantage spectacle ou boutique',
    3000:'Récompense spéciale Fais Ton Show',
    5000:'Récompense VIP / cadeau association'
  };
  let rewardConfig = { thresholds: DEFAULT_THRESHOLDS.slice(), suggestions: Object.assign({}, DEFAULT_REWARD_SUGGESTIONS) };
  function thresholds(){
    const arr = Array.isArray(rewardConfig.thresholds) ? rewardConfig.thresholds : DEFAULT_THRESHOLDS;
    return arr.map(n => Number(n || 0)).filter(n => n > 0).sort((a,b)=>a-b);
  }
  function suggestionFor(threshold){
    return String((rewardConfig.suggestions && rewardConfig.suggestions[threshold]) || DEFAULT_REWARD_SUGGESTIONS[threshold] || 'Récompense XP Fais Ton Show');
  }
  const $ = id => document.getElementById(id);
  const esc = v => FTS.esc ? FTS.esc(v == null ? '' : v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const worker = () => String((FTS.PAYMENT && FTS.PAYMENT.workerUrl) || 'https://fts-helloasso-api.gros-christophe.workers.dev').replace(/\/+$/, '');
  function euro(c){ return (Number(c || 0) / 100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}); }
  function cleanKey(v){ return String(v || '').trim().replace(/[.#$\[\]/]/g, '_'); }
  function norm(v){ return String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function nameOf(u){ return String((u && (u.displayName || u.name || [u.firstName,u.lastName].filter(Boolean).join(' ') || u.email)) || 'Membre').trim(); }
  function xpOf(uid){ return Math.max(Number(users[uid] && users[uid].xp || 0), Number(forumUsers[uid] && forumUsers[uid].xp || 0)); }
  function isMember(u){ const role = String((u && u.role) || '').toLowerCase(); return u && String(u.status || '').toLowerCase() === 'active' && role !== 'admin' && role !== 'prof'; }
  function dateFromMs(ms){ if(!ms) return ''; const d = new Date(Number(ms)); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR') : ''; }
  function msFromDate(v,end){ if(!v) return 0; const d = new Date(v + (end ? 'T23:59:59' : 'T00:00:00')); return Number.isFinite(d.getTime()) ? d.getTime() : 0; }
  async function token(){ const user = firebase.auth().currentUser; if(!user) throw new Error('not_connected'); return user.getIdToken(true); }
  async function api(path, opts){
    const res = await fetch(worker() + path, Object.assign({ headers:{ 'Content-Type':'application/json', Accept:'application/json', Authorization:'Bearer ' + await token() } }, opts || {}));
    const data = await res.json().catch(() => null);
    if(!res.ok || !data || data.ok === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
    return data;
  }
  function hideModal(){ $('xp-modal-backdrop').hidden = true; $('xp-modal').hidden = true; selected = null; }
  function showMsg(text, ok){ const el = $('xp-modal-msg'); if(el){ el.textContent = text || ''; el.className = ok === false ? 'xp-msg xp-error' : 'xp-msg'; } }
  function buildCode(u, threshold){
    const base = nameOf(u).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase() || 'MEMBRE';
    const rnd = Math.random().toString(36).slice(2,6).toUpperCase();
    return `FTS-${base}-${threshold}-${rnd}`;
  }
  function eligibleRows(){
    const q = norm($('xp-search') && $('xp-search').value);
    const min = Number(($('xp-filter') && $('xp-filter').value) || 0);
    const rows = [];
    Object.entries(users || {}).forEach(([uid,u]) => {
      if(!isMember(u)) return;
      const xp = xpOf(uid);
      if(min && xp < min) return;
      const hay = norm([nameOf(u), u.email, uid].join(' '));
      if(q && !hay.includes(q)) return;
      thresholds().forEach(th => {
        if(xp >= th && !(rewards[uid] && rewards[uid][th])) rows.push({ uid, user:u, xp, threshold:th });
      });
    });
    rows.sort((a,b) => b.threshold - a.threshold || b.xp - a.xp || nameOf(a.user).localeCompare(nameOf(b.user),'fr'));
    return rows;
  }
  function historyRows(){
    const out=[];
    Object.entries(rewards || {}).forEach(([uid,byTh]) => Object.entries(byTh || {}).forEach(([th,r]) => out.push(Object.assign({uid, threshold:th}, r || {}))));
    out.sort((a,b)=>Number(b.sentAt || b.createdAt || 0)-Number(a.sentAt || a.createdAt || 0));
    return out;
  }
  function renderPending(){
    const list = $('xp-pending-list');
    const rows = eligibleRows();
    const count = $('xp-pending-count');
    if(count) count.textContent = rows.length + ' à traiter';
    if(!list) return;
    if(!rows.length){ list.innerHTML = '<div class="xp-empty">Aucun palier XP à traiter pour le moment.</div>'; return; }
    list.innerHTML = rows.map(r => `<article class="xp-row"><div><strong>${esc(nameOf(r.user))}</strong><span><b class="xp-score">${r.xp} XP</b> · palier ${r.threshold} XP atteint</span><small>${esc(r.user.email || '')}</small><div><span class="xp-pill">🎁 ${esc(suggestionFor(r.threshold))}</span></div></div><button type="button" class="xp-btn" data-award="${esc(r.uid)}" data-threshold="${r.threshold}">Attribuer</button></article>`).join('');
  }
  function renderHistory(){
    const box = $('xp-history-list');
    const rows = historyRows();
    const count = $('xp-sent-count');
    if(count) count.textContent = rows.length + ' envoyée(s)';
    if(!box) return;
    if(!rows.length){ box.innerHTML = '<div class="xp-empty">Aucune récompense envoyée.</div>'; return; }
    box.innerHTML = rows.slice(0,80).map(r => `<article class="xp-history-item"><strong>${esc(r.displayName || nameOf(users[r.uid] || {}))}</strong><span>${esc(r.code || '')} · palier ${esc(r.threshold)} XP</span><small>${esc(r.rewardLabel || r.usage || '')}${r.sentAt ? ' · envoyé le ' + esc(dateFromMs(r.sentAt)) : ''}</small></article>`).join('');
  }

  function renderThresholdFilter(){
    const sel = $('xp-filter');
    if(!sel) return;
    const current = sel.value || '0';
    sel.innerHTML = '<option value="0">Tous les paliers</option>' + thresholds().map(th => `<option value="${th}">${th} XP et +</option>`).join('');
    sel.value = Array.from(sel.options).some(o => o.value === current) ? current : '0';
  }
  function renderConfigEditor(){
    const box = $('xp-thresholds-editor');
    if(!box) return;
    const rows = thresholds();
    box.innerHTML = rows.map(th => `<div class="xp-threshold-row" data-threshold-row="${th}"><input class="xp-threshold-value" type="number" min="1" step="1" value="${th}" aria-label="Palier XP"><input class="xp-threshold-label" value="${esc(suggestionFor(th))}" aria-label="Récompense suggérée"><button type="button" class="xp-btn ghost" data-remove-threshold="${th}">Supprimer</button></div>`).join('') || '<div class="xp-empty">Aucun palier configuré.</div>';
  }
  function readConfigEditor(){
    const rows = Array.from(document.querySelectorAll('[data-threshold-row]'));
    const nextThresholds = [];
    const nextSuggestions = {};
    rows.forEach(row => {
      const th = Math.round(Number(row.querySelector('.xp-threshold-value') && row.querySelector('.xp-threshold-value').value || 0));
      const label = String(row.querySelector('.xp-threshold-label') && row.querySelector('.xp-threshold-label').value || '').trim();
      if(th > 0 && !nextThresholds.includes(th)){
        nextThresholds.push(th);
        nextSuggestions[th] = label || 'Récompense XP Fais Ton Show';
      }
    });
    nextThresholds.sort((a,b)=>a-b);
    return { thresholds: nextThresholds, suggestions: nextSuggestions };
  }
  async function saveConfig(){
    const cfg = readConfigEditor();
    const msg = $('xp-config-msg');
    if(!cfg.thresholds.length){ if(msg) msg.textContent = 'Ajoute au moins un palier XP.'; return; }
    rewardConfig = cfg;
    await db.ref('fts_xp_rewards_config').set({ thresholds:cfg.thresholds, suggestions:cfg.suggestions, updatedAt:Date.now(), updatedBy:me.uid });
    if(msg) msg.textContent = 'Paliers XP enregistrés.';
    renderThresholdFilter();
    renderConfigEditor();
    renderAll();
  }
  async function loadConfig(){
    const cfg = await db.ref('fts_xp_rewards_config').once('value').then(s=>s.val() || null).catch(()=>null);
    if(cfg && Array.isArray(cfg.thresholds) && cfg.thresholds.length){
      rewardConfig = { thresholds:cfg.thresholds.map(n=>Number(n||0)).filter(n=>n>0), suggestions:Object.assign({}, cfg.suggestions || {}) };
    }
    renderThresholdFilter();
    renderConfigEditor();
  }

  function renderAll(){ renderPending(); renderHistory(); }
  async function loadAll(){
    const [us, fus, rew] = await Promise.all([
      db.ref('fts_users').once('value').then(s=>s.val() || {}),
      db.ref('fts_forum/users').once('value').then(s=>s.val() || {}).catch(()=>({})),
      db.ref('fts_xp_rewards').once('value').then(s=>s.val() || {}).catch(()=>({}))
    ]);
    users = us || {}; forumUsers = fus || {}; rewards = rew || {}; renderAll();
  }
  function openAward(uid, threshold){
    const u = users[uid] || {};
    const xp = xpOf(uid);
    selected = { uid, threshold:Number(threshold), xp };
    $('xp-modal-title').textContent = 'Attribuer une récompense';
    $('xp-target-name').textContent = nameOf(u) + ' · ' + xp + ' XP · palier ' + threshold + ' XP';
    $('xp-code').value = buildCode(u, threshold);
    $('xp-label').value = suggestionFor(threshold);
    $('xp-kind').value = 'fixed';
    $('xp-value').value = threshold >= 2000 ? '10' : '5';
    $('xp-scope').value = 'shop_order';
    $('xp-max').value = '1';
    $('xp-end').value = '';
    $('xp-message').value = `🎉 Bravo ${nameOf(u)} !\n\nTu viens de dépasser le palier des ${threshold} XP sur l’application Fais Ton Show.\n\nLe robot Fais Ton Show t’offre une récompense :\nCODE : ${$('xp-code').value}\n\nUtilisable pour : ${$('xp-label').value}\n\nMerci pour ton énergie dans la communauté ✨`;
    $('xp-modal-backdrop').hidden = false; $('xp-modal').hidden = false; showMsg('');
  }
  function currentMessage(){
    const txt = String($('xp-message').value || '').trim();
    return txt || '🎉 Bravo ! Tu as débloqué une récompense Fais Ton Show.';
  }
  function xpRobotConversationId(uid){
    return 'xp_robot_' + cleanKey(uid);
  }
  function xpRobotMessagePreview(text){
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Nouveau code promo Fais Ton Show';
  }
  function buildXpRobotDmUpdates(uid, threshold, code, label, message, now, notifKey){
    const convId = xpRobotConversationId(uid);
    const msgRef = db.ref('fts_dm/messages/' + convId).push();
    const msgId = msgRef.key;
    const parts = {};
    parts[uid] = true;
    parts[me.uid] = true;
    const text = message || ('🎉 Bravo ! Ton code promo Fais Ton Show est : ' + code);
    const updates = {};
    updates['fts_dm/conversations/' + convId] = {
      type:'group',
      name:'🤖 Fais Ton Show',
      participants:parts,
      system:true,
      bot:true,
      botLabel:'Robot Fais Ton Show',
      xpReward:true,
      targetUid:uid,
      createdBy:me.uid,
      updatedBy:me.uid,
      lastMessage:xpRobotMessagePreview(text),
      lastSenderName:'Fais Ton Show',
      lastTs:now,
      createdAt:now,
      updatedAt:now,
      unread:{ [uid]:1, [me.uid]:0 }
    };
    updates['fts_dm/messages/' + convId + '/' + msgId] = {
      senderId:'system',
      senderName:'Fais Ton Show',
      text,
      ts:now,
      bot:true,
      robot:true,
      system:true,
      messageType:'xp-reward',
      botLabel:'Robot Fais Ton Show',
      code,
      threshold,
      rewardLabel:label
    };
    updates['fts_dm/userConvs/' + uid + '/' + convId] = true;
    updates['fts_dm/userConvs/' + me.uid + '/' + convId] = true;
    return { convId, msgId, updates };
  }
  async function sendReward(){
    if(!selected) return;
    const uid = selected.uid;
    const u = users[uid] || {};
    const threshold = Number(selected.threshold || 0);
    const code = String($('xp-code').value || '').trim().toUpperCase().replace(/\s+/g,'');
    const label = String($('xp-label').value || '').trim() || 'Récompense XP Fais Ton Show';
    const kind = $('xp-kind').value;
    const valueRaw = Number(String($('xp-value').value || '0').replace(',','.')) || 0;
    const scope = $('xp-scope').value;
    const endsAt = msFromDate($('xp-end').value, true);
    const maxUses = Math.max(1, Number($('xp-max').value || 1) || 1);
    if(!code){ showMsg('Code obligatoire.', false); return; }
    if((kind === 'fixed' || kind === 'percent') && valueRaw <= 0){ showMsg('Valeur obligatoire pour ce type de code.', false); return; }
    const value = kind === 'fixed' ? Math.round(valueRaw * 100) : valueRaw;
    const message = currentMessage().replace(/CODE\s*:\s*[^\n]+/i, 'CODE : ' + code);
    try{
      showMsg('Création du code promo…');
      const promoRes = await api('/admin/promo-codes/save', { method:'POST', body:JSON.stringify({
        code, label, kind, scope, active:true, publicVisible:false, value, startsAt:0, endsAt, maxUses,
        productIds:[], eventIds:[], activityIds:[], offerKeys:[], subcategoryIds:[]
      }) });
      const now = Date.now();
      const notifRef = db.ref('fts_user_notifications/' + uid).push();
      const rewardPayload = {
        threshold,
        xpAtReward:selected.xp,
        code,
        rewardLabel:label,
        scope,
        kind,
        value:kind === 'fixed' ? value : valueRaw,
        valueLabel:kind === 'fixed' ? euro(value) : (kind === 'percent' ? valueRaw + '%' : (kind === 'free' ? 'Gratuité' : '')),
        endsAt,
        maxUses,
        status:'sent',
        displayName:nameOf(u),
        uid,
        sentAt:now,
        createdAt:now,
        createdByUid:me.uid,
        createdByEmail:me.email || '',
        notificationId:notifRef.key,
        source:'xp_rewards_admin'
      };
      const notifKey = 'xp-reward-' + uid + '-' + threshold;
      const dm = buildXpRobotDmUpdates(uid, threshold, code, label, message, now, notifKey);
      rewardPayload.notificationId = notifRef.key;
      rewardPayload.dmConversationId = dm.convId;
      rewardPayload.dmMessageId = dm.msgId;
      const notification = {
        type:'xp_reward',
        title:'🤖 Fais Ton Show',
        body:message,
        url:'./messages.html?conv=' + encodeURIComponent(dm.convId) + '&msg=' + encodeURIComponent(dm.msgId),
        code,
        rewardLabel:label,
        threshold,
        conversationId:dm.convId,
        msgId:dm.msgId,
        senderUid:'system',
        senderName:'Robot Fais Ton Show',
        robot:true,
        read:false,
        createdAt:now,
        notificationKey:notifKey
      };
      const updates = Object.assign({}, dm.updates);
      updates['fts_xp_rewards/' + uid + '/' + threshold] = rewardPayload;
      updates['fts_user_notifications/' + uid + '/' + notifRef.key] = notification;
      await db.ref().update(updates);
      db.ref('fts_forum/rewardHistory').push(Object.assign({}, rewardPayload, { type:'xp_promo_code', message })).catch(()=>{});
      if(window.FTS && FTS.PUSH && FTS.PUSH.workerUrl){
        FTS.pushRequest('/notify', {
          type:'dm_group', uid, recipientUid:uid, expectedUid:uid, requiresUidMatch:true,
          senderUid:'system', conversationId:dm.convId, msgId:dm.msgId,
          title:'🤖 Fais Ton Show', body:'Tu as débloqué un code promo : ' + code,
          url:'./messages.html?conv=' + encodeURIComponent(dm.convId) + '&msg=' + encodeURIComponent(dm.msgId), notificationKey:notifKey,
          tag:notifKey, collapseKey:notifKey
        }).catch(()=>{});
      }
      showMsg('Récompense envoyée par le robot Fais Ton Show.', true);
      await loadAll();
      setTimeout(hideModal, 700);
    }catch(e){
      console.warn(e);
      showMsg('Erreur : ' + (e && e.message ? e.message : e), false);
    }
  }
  function bind(){
    $('xp-refresh').addEventListener('click', loadAll);
    const addTh = $('xp-add-threshold');
    if(addTh) addTh.addEventListener('click', () => { const cfg = readConfigEditor(); const next = Math.max(0, ...cfg.thresholds) + 500; cfg.thresholds.push(next || 500); cfg.suggestions[next || 500] = 'Nouvelle récompense XP'; rewardConfig = cfg; renderConfigEditor(); });
    const saveTh = $('xp-save-thresholds');
    if(saveTh) saveTh.addEventListener('click', () => saveConfig().catch(e => { const msg=$('xp-config-msg'); if(msg) msg.textContent = 'Erreur : ' + (e && e.message ? e.message : e); }));
    document.addEventListener('click', e => { const rm = e.target.closest('[data-remove-threshold]'); if(rm){ const th = Number(rm.getAttribute('data-remove-threshold') || 0); const cfg = readConfigEditor(); cfg.thresholds = cfg.thresholds.filter(x => x !== th); delete cfg.suggestions[th]; rewardConfig = cfg; renderConfigEditor(); renderThresholdFilter(); renderPending(); } });
    $('xp-search').addEventListener('input', renderPending);
    $('xp-filter').addEventListener('change', renderPending);
    $('xp-modal-backdrop').addEventListener('click', hideModal);
    $('xp-close').addEventListener('click', hideModal);
    $('xp-cancel').addEventListener('click', hideModal);
    $('xp-send').addEventListener('click', sendReward);
    $('xp-code').addEventListener('input', () => {
      const v = String($('xp-code').value || '').trim().toUpperCase();
      if(v) $('xp-message').value = currentMessage().replace(/CODE\s*:\s*[^\n]+/i, 'CODE : ' + v);
    });
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-award]');
      if(btn) openAward(btn.getAttribute('data-award'), btn.getAttribute('data-threshold'));
    });
  }
  function showError(msg){ const el=$('xp-admin-error'); if(el){ el.textContent=msg; el.className='xp-error'; } }
  window.addEventListener('DOMContentLoaded', () => {
    db = FTS.initFirebase();
    firebase.auth().onAuthStateChanged(async user => {
      if(!user){ location.href='auth.html'; return; }
      try{
        const snap = await db.ref('fts_users/' + user.uid).once('value');
        const profile = snap.val() || {};
        if(String(profile.status || '').toLowerCase() !== 'active' || String(profile.role || '').toLowerCase() !== 'admin') { location.href='membres.html'; return; }
        me = { uid:user.uid, email:user.email || profile.email || '', profile };
        $('xp-admin-loading').style.display = 'none';
        $('xp-admin-shell').hidden = false;
        bind();
        await loadConfig();
        await loadAll();
      }catch(e){ console.warn(e); showError(e && e.message ? e.message : String(e)); }
    });
  });
})(window);
