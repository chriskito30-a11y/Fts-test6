/* ================================================================
   PAGE MODULE — FORUM
   Extrait depuis forum.html pour supprimer le JavaScript inline.
   ================================================================ */

function setH(){ document.documentElement.style.setProperty("--vh", window.innerHeight + "px"); }
setH(); window.addEventListener("resize", setH);
window.addEventListener("orientationchange", () => setTimeout(setH, 200));

/* ---- bloc inline extrait ---- */
/* ================================================================
   FORUM.JS — version factorisée visuellement avec Messages
   - mêmes classes de shell que messages.html
   - liste gauche = bulles de catégories
   - chaque bulle ouvre les canaux accessibles
   ================================================================ */

let db, auth, uid, userProfile, userData;
let categoryStructure = [], categoryLoaded = false;
let forumItems = [];
let openCats = {};
let currentChannel = null, currentChannelInfo = null, currentListener = null, lastMsgDate = null;
let adminMode = false;
let deepLinkHandled = false;
let forumReadTimer = null;
let forumUserCache = {};
let forumUserListeners = {};
let artistOfWeek = null;
let currentMessages = {};
let forumUnreadCounts = {};
let forumUnreadRefreshTimer = null;
let forumUnreadListening = false;

function norm(s){ return FTS.norm(s); }
function normList(arr){
  return (Array.isArray(arr) ? arr : String(arr || '').split(','))
    .map(x => String(x || '').trim())
    .filter(Boolean);
}
function uniqList(list){
  const seen = new Set();
  const out = [];
  normList(list).forEach(v => {
    const k = norm(v);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(v);
  });
  return out;
}
function childDisciplines(profile){
  return (profile && profile.hasEnfant && Array.isArray(profile.enfants))
    ? profile.enfants.flatMap(e => normList(e.disciplines || e.group || []))
    : [];
}
function childSubgroups(profile){
  return (profile && profile.hasEnfant && Array.isArray(profile.enfants))
    ? profile.enfants.flatMap(e => normList(e.subgroups || e.subcategories || e.subgroup || []))
    : [];
}
function getForumGroups(){
  return uniqList([
    ...normList(userData && (userData.groups || userData.disciplines || userData.group)),
    ...normList(userProfile && (userProfile.disciplines || userProfile.group)),
    ...childDisciplines(userProfile)
  ]);
}
function getForumSubgroups(){
  return uniqList([
    ...normList(userData && (userData.subgroups || userData.subcategories || userData.subgroup)),
    ...normList(userProfile && (userProfile.subgroups || userProfile.subcategories || userProfile.subgroup)),
    ...childSubgroups(userProfile)
  ]);
}
function esc(s){ return FTS.esc(s); }
function storageGet(k){ return localStorage.getItem(k); }
function storageSet(k,v){ localStorage.setItem(k,v); }
function catIcon(s){ return FTS.catIcon(s); }


window.addEventListener('DOMContentLoaded', async () => {
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js', {scope:'./'}).catch(()=>{}); }
  db = FTS.initFirebase(); auth = firebase.auth();
  loadCategoryStructure();
  auth.onAuthStateChanged(async user => {
    if(!user){ location.href='auth.html'; return; }
    uid = user.uid;
    try{
      const snap = await db.ref('fts_users/'+uid).once('value');
      userProfile = snap.val();
      if(!userProfile || userProfile.status === 'pending'){
        await auth.signOut(); location.href='auth.html'; return;
      }
      if(userProfile.role === 'admin'){
        adminMode = true;
        document.getElementById('btn-admin-gear').style.display = 'flex';
        document.getElementById('admin-bar').classList.add('show');
      }
      await loadUserData();
      listenArtistOfWeek();
      FTSGamification.awardXp(db, uid, 'daily_login', 5, { maxPerDay:1 }).catch(()=>{});
      document.getElementById('auth-loading').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      const label = userProfile.firstName || userProfile.name || userProfile.email || '?';
      FTSChat.setAvatar(document.getElementById('my-avatar'), label);
      listenUnreadBadge(uid);
      checkNotifStatus();
      buildForumItems(); renderForumList(); initForumUnreadWatchers(); openForumDeepLink();
    }catch(e){ console.warn('[FTS Forum]', e); showBootError(e); }
  });
});


function showBootError(e){
  const box = document.getElementById('auth-loading');
  if(!box) return;
  box.innerHTML = `<div class="auth-logo">FAIS TON <span>SHOW</span></div><div class="auth-sub">Erreur chargement forum</div><p class="forum-error-text">${FTS.esc(e && e.message ? e.message : String(e))}<br><br><a href="membres.html" class="forum-error-link">Retour membres</a></p>`;
}

async function loadUserData(){
  const snap = await db.ref('fts_forum/users/'+uid).once('value');
  if(snap.exists()) userData = snap.val() || {};
  else{
    userData = {
      name: userProfile.name || [userProfile.firstName,userProfile.lastName].filter(Boolean).join(' ') || userProfile.email,
      status: userProfile.status || 'active',
      role: userProfile.role || 'member',
      ts: Date.now()
    };
  }

  // Source de vérité des droits : fts_users.
  // On reconstruit à chaque chargement l'union parent + enfant(s), puis on resynchronise fts_forum/users.
  const groups = getForumGroups();
  const subgroups = getForumSubgroups();
  userData = {
    ...userData,
    name: userData.name || userProfile.name || [userProfile.firstName,userProfile.lastName].filter(Boolean).join(' ') || userProfile.email || 'Membre',
    group: groups.join(', '),
    groups,
    subgroup: subgroups.join(', '),
    subgroups,
    status: userData.status || userProfile.status || 'active',
    role: userData.role || userProfile.role || 'member',
    ts: userData.ts || Date.now(),
    uid: uid,
    xp: Number(userData.xp || userProfile.xp || 0),
    specialBadge: userData.specialBadge || userProfile.specialBadge || null
  };
  db.ref('fts_forum/users/'+uid).update({
    name: userData.name,
    group: userData.group,
    groups: userData.groups,
    subgroup: userData.subgroup,
    subgroups: userData.subgroups,
    status: userData.status,
    role: userData.role,
    ts: Date.now(),
    uid: uid,
    xp: Number(userData.xp || 0)
  }).catch(e => console.warn('[FTS Forum] Synchro profil forum impossible', e));

  db.ref('fts_forum/users/'+uid+'/status').on('value', snap => {
    if(snap.exists()){ userData.status = snap.val(); updateStatusUI(); buildForumItems(); renderForumList(); initForumUnreadWatchers(); openForumDeepLink(); }
  });
}

function updateStatusUI(){
  document.getElementById('pending-bar').classList.toggle('show', userData?.status === 'pending' && userProfile?.role !== 'admin');
}

async function loadCategoryStructure(){
  try{
    categoryStructure = FTS.getCategoryStructureAsync ? await FTS.getCategoryStructureAsync(db) : (FTS.getCategoryStructure ? FTS.getCategoryStructure() : []);
  }catch(e){ console.warn('[FTS Forum] Structure catégories Firebase', e); categoryStructure = []; }
  categoryLoaded = true;
  buildForumItems(); renderForumList(document.getElementById('forum-search')?.value || ''); initForumUnreadWatchers(); openForumDeepLink();
}

function buildForumItems(){
  if(!userData && !userProfile) return;
  const isAdmin = userProfile?.role === 'admin';
  const isActive = userData?.status === 'active' || isAdmin;
  const userGroupNorms = isAdmin ? null : getForumGroups().map(norm);
  const userSubNorms = isAdmin ? null : getForumSubgroups().map(norm);
  const items = [{
    id:'general', type:'channel', icon:'💬', name:'Général', desc:'Discussion ouverte à tous', preview:'Canal commun à tous les membres', group:'', subgroup:''
  }];
  if(isActive){
    if(categoryStructure.length){
      for(const cat of categoryStructure){
        const catNorm = norm(cat.category);
        const userHasCat = isAdmin || userGroupNorms?.includes(catNorm);
        const visibleSubs = isAdmin ? cat.subs : cat.subs.filter(s => userSubNorms?.includes(norm(s.name)));
        if(!userHasCat && !visibleSubs.length) continue;
        const channels = [];
        if(userHasCat) channels.push({ id:catNorm, icon:catIcon(cat.category), name:'Général '+cat.category, desc:'Discussion générale — '+cat.category, group:cat.category, subgroup:'' });
        visibleSubs.forEach(sub => channels.push({ id:norm(sub.name), icon:'📅', name:sub.name, desc:'Canal '+sub.name, group:cat.category, subgroup:sub.name }));
        items.push({ id:'cat_'+catNorm, type:'category', icon:catIcon(cat.category), name:cat.category, desc:`${channels.length} canal${channels.length>1?'s':''} accessible${channels.length>1?'s':''}`, channels });
      }
    }else if(!categoryLoaded){
      items.push({ id:'loading', type:'info', icon:'⏳', name:'Chargement…', desc:'Chargement des catégories' });
    }else{
      const groups = getForumGroups();
      groups.forEach(g => items.push({ id:'cat_'+norm(g), type:'category', icon:catIcon(g), name:g, desc:'Canal '+g, channels:[{id:norm(g), icon:catIcon(g), name:'Général '+g, desc:'Canal '+g, group:g, subgroup:''}] }));
    }
  }
  forumItems = items;
}


function getVisibleForumChannelIds(){
  const ids = [];
  (forumItems || []).forEach(item => {
    if(item.type === 'channel' && item.id) ids.push(item.id);
    (item.channels || []).forEach(ch => { if(ch && ch.id) ids.push(ch.id); });
  });
  return [...new Set(ids)];
}

function forumUnreadBadgeHtml(channel){
  const n = Number(forumUnreadCounts[channel] || 0);
  if(!n) return '';
  return `<span class="forum-unread-badge" aria-label="${n} message${n>1?'s':''} non lu${n>1?'s':''}">${n > 99 ? '99+' : n}</span>`;
}

function forumUnreadCategoryTotal(item){
  return (item.channels || []).reduce((sum, ch) => sum + Number(forumUnreadCounts[ch.id] || 0), 0);
}

function scheduleForumUnreadRefresh(){
  if(forumUnreadRefreshTimer) clearTimeout(forumUnreadRefreshTimer);
  forumUnreadRefreshTimer = setTimeout(refreshForumUnreadCounts, 120);
}

function forumInitialReadTs(){
  return Number(userProfile && (userProfile.forumBaselineAt || userProfile.createdAt || userProfile.created_at || userProfile.ts || 0)) || 0;
}
function forumLastReadTs(reads, channel){
  const direct = Number((reads[channel] && reads[channel].ts) || reads[channel] || 0) || 0;
  return direct || forumInitialReadTs();
}
function shouldCountForumUnreadMessage(msg){
  if(!msg) return false;
  if(msg.uid && msg.uid === uid && !(msg.system === true || msg.gamification === true || msg.notifyAll === true || msg.type === 'special_badge' || msg.type === 'artist_of_week' || msg.type === 'xp_level')) return false;
  return true;
}

async function refreshForumUnreadCounts(){
  if(!uid || !db) return;
  const channels = getVisibleForumChannelIds();
  if(!channels.length){ forumUnreadCounts = {}; renderForumList(document.getElementById('forum-search')?.value || ''); return; }
  try{
    const readsSnap = await db.ref('fts_users/' + uid + '/forumReads').once('value');
    const reads = readsSnap.val() || {};
    const next = {};
    await Promise.all(channels.map(ch => {
      const lastRead = forumLastReadTs(reads, ch);
      if(!lastRead){ next[ch] = 0; return Promise.resolve(); }
      return db.ref('fts_forum/messages/' + ch).orderByChild('ts').startAt(lastRead + 1).limitToLast(50).once('value')
        .then(snap => {
          let count = 0;
          snap.forEach(child => {
            const msg = child.val() || {};
            if(!shouldCountForumUnreadMessage(msg)) return;
            count += 1;
          });
          next[ch] = count;
        }).catch(() => { next[ch] = 0; });
    }));
    forumUnreadCounts = next;
    renderForumList(document.getElementById('forum-search')?.value || '');
  }catch(e){ console.warn('[FTS Forum] compteurs non lus:', e); }
}

function initForumUnreadWatchers(){
  if(!uid || !db || forumUnreadListening) return;
  forumUnreadListening = true;
  db.ref('fts_forum/messages').on('value', scheduleForumUnreadRefresh);
  db.ref('fts_users/' + uid + '/forumReads').on('value', scheduleForumUnreadRefresh);
  scheduleForumUnreadRefresh();
}

function renderForumList(q=''){
  const list = document.getElementById('forum-list'); if(!list) return;
  const term = q.trim().toLowerCase();
  let items = forumItems.filter(item => {
    if(!term) return true;
    return (item.name||'').toLowerCase().includes(term) || (item.channels||[]).some(c => c.name.toLowerCase().includes(term));
  });
  if(!items.length){ list.innerHTML = `<div class="conv-empty"><span class="conv-empty-icon">🔎</span><p>Aucun canal trouvé.</p></div>`; return; }
  list.innerHTML = items.map(item => {
    if(item.type === 'channel') return renderChannelBubble(item);
    if(item.type === 'info') return `<div class="conv-empty"><span class="conv-empty-icon">⏳</span><p>${esc(item.desc)}</p></div>`;
    const open = openCats[item.id] || term;
    return `<div class="forum-category-group${open?' open':''}" id="grp-${esc(item.id)}">
      <div class="conv-item" data-fts-click="toggleCategory('${esc(item.id)}')">
        <div class="conv-av conv-av-gold-soft">${item.icon}</div>
        <div class="conv-body">
          <div class="conv-row1"><div class="conv-name">${esc(item.name)}</div>${forumUnreadCategoryTotal(item) ? `<span class="forum-unread-badge">${forumUnreadCategoryTotal(item) > 99 ? '99+' : forumUnreadCategoryTotal(item)}</span>` : ''}<div class="forum-chevron">›</div></div>
          <div class="conv-row2"><div class="conv-preview">${esc(item.desc)}</div></div>
        </div>
      </div>
      <div class="forum-subchannels">
        ${(item.channels||[]).map(ch => `<div class="forum-subchannel${ch.id===currentChannel?' active':''}" data-fts-click="selectForumChannel('${esc(ch.id)}','${esc(ch.name)}','${esc(ch.icon)}','${esc(ch.desc)}','${esc(ch.group || '')}','${esc(ch.subgroup || '')}')"><span class="forum-sub-icon">${ch.icon}</span><span class="forum-sub-name">${esc(ch.name)}</span>${forumUnreadBadgeHtml(ch.id)}</div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function renderChannelBubble(ch){
  return `<div class="conv-item${ch.id===currentChannel?' active':''}" data-fts-click="selectForumChannel('${esc(ch.id)}','${esc(ch.name)}','${esc(ch.icon)}','${esc(ch.desc)}','${esc(ch.group || '')}','${esc(ch.subgroup || '')}')">
    <div class="conv-av conv-av-red-soft">${ch.icon}</div>
    <div class="conv-body">
      <div class="conv-row1"><div class="conv-name">${esc(ch.name)}</div>${forumUnreadBadgeHtml(ch.id)}</div>
      <div class="conv-row2"><div class="conv-preview">${esc(ch.preview || ch.desc || '')}</div></div>
    </div>
  </div>`;
}

function toggleCategory(id){ openCats[id] = !openCats[id]; renderForumList(document.getElementById('forum-search').value || ''); }

function clearForumSystemNotifications(channel){
  try {
    if (window.FTSClearNotifications) {
      window.FTSClearNotifications({ type:'forum', channel: channel, recipientUid: uid });
    }
  } catch(e) {}
}

function markForumChannelRead(channel){
  if(!uid || !channel || !db) return;
  forumUnreadCounts[channel] = 0;
  renderForumList(document.getElementById('forum-search')?.value || '');
  db.ref('fts_users/' + uid + '/forumReads/' + channel).set({ ts: Date.now() }).catch(() => {});
  clearForumSystemNotifications(channel);
}

function selectForumChannel(id, name, icon, desc, group, subgroup){
  currentChannel = id;
  currentChannelInfo = { group: group || '', subgroup: subgroup || '', label: name || id };
  lastMsgDate = null;
  markForumChannelRead(id);
  FTSChat.setAvatar(document.getElementById('chat-av'), name, {type:'category', icon});
  document.getElementById('chat-name').textContent = name;
  document.getElementById('chat-sub').textContent = desc || '';
  document.getElementById('chat-empty').style.display = 'none';
  document.getElementById('chat-zone').classList.add('on');
  FTSChat.openChat();
  document.getElementById('messages').innerHTML = '';
  if(currentListener) currentListener();
  loadMessages(id);
  renderForumList(document.getElementById('forum-search').value || '');
  setTimeout(() => document.getElementById('msg-input').focus(), 200);
}

function closeChat(){
  FTSChat.closeChat();
  document.getElementById('chat-zone').classList.remove('on');
  document.getElementById('chat-empty').style.display = 'flex';
  currentChannel = null; currentChannelInfo = null;
  if(currentListener){ currentListener(); currentListener = null; }
  renderForumList(document.getElementById('forum-search').value || '');
}

function loadMessages(id){
  const ref = db.ref('fts_forum/messages/'+id).limitToLast(80);
  ref.on('child_added', snap => addForumMsg(snap.val(), snap.key));
  ref.on('child_changed', snap => updateForumMsg(snap.val(), snap.key));
  ref.on('child_removed', snap => document.getElementById('msg-'+snap.key)?.remove());
  currentListener = () => ref.off();
}

async function sendMessage(){
  if(!currentChannel) return;
  const input = document.getElementById('msg-input');
  const text = input.value.trim(); if(!text) return;
  input.value = ''; input.style.height = '';
  const msg = { uid, name:userData.name || userProfile.name || userProfile.email, text, ts:Date.now() };
  const ref = await db.ref('fts_forum/messages/'+currentChannel).push(msg);
  FTSGamification.awardXp(db, uid, 'forum_post', 5, { maxPerDay:3 }).catch(()=>{});
  notifyChannel(currentChannel, msg.name + ' : ' + text.substring(0,80), ref.key);
}


function listenArtistOfWeek(){
  db.ref('fts_community/artistOfWeek').on('value', snap => {
    artistOfWeek = snap.val() || null;
    refreshAllVisibleBadges();
  });
}

function ensureForumUser(uidToLoad){
  if(!uidToLoad || uidToLoad === 'system') return;
  if(forumUserListeners[uidToLoad]) return;
  forumUserListeners[uidToLoad] = db.ref('fts_forum/users/' + uidToLoad).on('value', snap => {
    const val = snap.val() || {};
    val.uid = uidToLoad;
    forumUserCache[uidToLoad] = val;
    refreshBadgesForUser(uidToLoad);
  });
}

function getMessagePublicBadge(m){
  const messageUid = m && m.uid;
  const forumUser = (messageUid && forumUserCache[messageUid]) || { uid:messageUid, name:m?.name, xp:0 };
  return FTSGamification.getPublicBadge(forumUser, artistOfWeek);
}

function renderSenderLine(m){
  if(m && m.system) return `<div class="msg-sender msg-sender-system">${esc(m.name || 'Fais Ton Show')}</div>`;
  const b = getMessagePublicBadge(m);
  return `<div class="msg-sender"><span class="msg-author-name-inline">${esc(m.name || 'Membre')}</span> <span class="msg-badge-slot" data-uid="${esc(m.uid || '')}">${FTSGamification.renderBadge(b.label, b.kind)}</span></div>`;
}

function refreshBadgesForUser(uidToRefresh){
  if(!uidToRefresh) return;
  document.querySelectorAll('.msg-badge-slot').forEach(el => {
    if(el.getAttribute('data-uid') !== uidToRefresh) return;
    const u = forumUserCache[uidToRefresh] || { uid:uidToRefresh, xp:0 };
    const b = FTSGamification.getPublicBadge(u, artistOfWeek);
    el.innerHTML = FTSGamification.renderBadge(b.label, b.kind);
  });
}
function refreshAllVisibleBadges(){ Object.keys(forumUserCache || {}).forEach(refreshBadgesForUser); }

function reactionCount(reactions, emoji){
  const bucket = reactions && reactions[emoji];
  return bucket && typeof bucket === 'object' ? Object.keys(bucket).length : 0;
}
function hasReacted(reactions, emoji){ return !!(uid && reactions && reactions[emoji] && reactions[emoji][uid]); }
function renderReactionSummary(reactions){
  const used = FTSGamification.REACTIONS
    .map(emoji => ({ emoji, count:reactionCount(reactions, emoji) }))
    .filter(r => r.count > 0);
  if(!used.length) return '';
  const total = used.reduce((sum, r) => sum + r.count, 0);
  const icons = used.slice(0, 3).map(r => `<span>${r.emoji}</span>`).join('');
  return `<span class="msg-reaction-icons">${icons}</span><span class="msg-reaction-total">${total}</span>`;
}
function renderReactions(m, key){
  const reactions = (m && m.reactions) || {};
  const summary = renderReactionSummary(reactions);
  return `<div class="msg-reactions msg-reactions-compact" id="react-${esc(key)}">
    ${summary ? `<button type="button" class="msg-reaction-summary" data-fts-click="toggleReactionPicker('${esc(key)}')" aria-label="Voir ou ajouter une réaction">${summary}</button>` : ''}
    <button type="button" class="msg-react-open" data-fts-click="toggleReactionPicker('${esc(key)}')" aria-label="Réagir">👍</button>
    <div class="msg-reaction-picker" id="react-picker-${esc(key)}" aria-hidden="true">${FTSGamification.REACTIONS.map(emoji => {
      const count = reactionCount(reactions, emoji);
      const active = hasReacted(reactions, emoji);
      return `<button type="button" class="msg-react ${active?'active':''}" data-fts-click="toggleForumReaction('${esc(key)}','${emoji}')" aria-label="Réagir ${emoji}"><span>${emoji}</span>${count ? `<b>${count}</b>` : ''}</button>`;
    }).join('')}</div>
  </div>`;
}

function closeReactionPickers(exceptKey){
  document.querySelectorAll('.msg-reaction-picker.is-open').forEach(el => {
    if(exceptKey && el.id === 'react-picker-' + exceptKey) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden','true');
  });
}
function toggleReactionPicker(msgKey){
  const picker = document.getElementById('react-picker-' + msgKey);
  if(!picker) return;
  const willOpen = !picker.classList.contains('is-open');
  closeReactionPickers(msgKey);
  picker.classList.toggle('is-open', willOpen);
  picker.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
}

async function toggleForumReaction(msgKey, emoji){
  if(!currentChannel || !uid || !msgKey || !emoji) return;
  const msg = currentMessages[msgKey] || {};
  const ref = db.ref('fts_forum/messages/' + currentChannel + '/' + msgKey + '/reactions/' + emoji + '/' + uid);
  const snap = await ref.once('value');
  if(snap.exists()){
    await ref.remove();
  }else{
    await ref.set(true);
    if(msg.uid && msg.uid !== uid){
      FTSGamification.awardXp(db, msg.uid, 'reaction_received', 2, { maxPerDay:10 }).catch(()=>{});
      FTSGamification.awardXp(db, uid, 'reaction_given', 1, { maxPerDay:5 }).catch(()=>{});
    }
  }
  closeReactionPickers();
}

function updateForumMsg(m, key){
  currentMessages[key] = m || {};
  const react = document.getElementById('react-' + key);
  if(react){ react.outerHTML = renderReactions(m, key); }
}

function addForumMsg(m, key){
  currentMessages[key] = m || {};
  if(m && m.uid) ensureForumUser(m.uid);
  const wrap = document.getElementById('messages');
  const own = (m.uid && m.uid === uid) || (!m.uid && m.name === userData?.name);
  const dStr = new Date(m.ts).toDateString();
  if(dStr !== lastMsgDate){
    lastMsgDate = dStr;
    const sep = document.createElement('div'); sep.className='day-sep'; sep.innerHTML = `<span>${FTSChat.fmtDay(m.ts)}</span>`; wrap.appendChild(sep);
  }
  const div = document.createElement('div'); div.id = 'msg-'+key; div.className = 'msg-wrap ' + (own ? 'own' : 'other');
  const isMedia = m.text && m.text.startsWith('[media]');
  const body = isMedia ? renderMedia(m.text.slice(7)) : esc(m.text || '').replace(/\n/g,'<br>');
  div.innerHTML = `${renderSenderLine(m)}
    <div class="msg-bubble">${body}<div class="msg-foot"><span class="msg-time">${FTSChat.fmtFull(m.ts)}</span>${own ? '<span class="msg-check">✓✓</span>' : ''}</div></div>
    ${renderReactions(m, key)}
    ${adminMode ? `<button class="btn-del-msg" data-fts-click="deleteMsg('${key}')">Supprimer</button>` : ''}`;
  wrap.appendChild(div); FTSChat.scrollBottom();
  if(currentChannel){
    clearTimeout(forumReadTimer);
    forumReadTimer = setTimeout(() => markForumChannelRead(currentChannel), 450);
  }
}

function deleteMsg(k){ if(confirm('Supprimer ce message ?')) db.ref('fts_forum/messages/'+currentChannel+'/'+k).remove(); }
function toggleAdminMode(){ if(userProfile?.role !== 'admin') return; adminMode = !adminMode; document.getElementById('admin-bar').classList.toggle('show', adminMode); if(currentChannel) selectForumChannel(currentChannel, document.getElementById('chat-name').textContent, document.getElementById('chat-av').textContent, document.getElementById('chat-sub').textContent); }
function exitAdmin(){ adminMode = false; document.getElementById('admin-bar').classList.remove('show'); }
function handleKey(e){ FTSChat.handleEnter(e, sendMessage); }
function autoResize(el){ FTSChat.autoResize(el); }

function uploadMedia(file){
  if(!file || !currentChannel) return;
  if(file.size > 100 * 1024 * 1024){ alert('Fichier trop volumineux (max 100 Mo)'); return; }
  const bar=document.getElementById('upload-bar'), fill=document.getElementById('upload-fill'), txt=document.getElementById('upload-txt');
  bar.classList.add('show'); fill.style.width='0%'; txt.textContent='Upload en cours…';
  FTS.uploadCloudinary(file, pct => { fill.style.width = pct + '%'; txt.textContent = 'Upload ' + pct + '%…'; })
    .then(url => {
      txt.textContent = '✓ '+file.name;
      setTimeout(() => bar.classList.remove('show'), 1600);
      document.getElementById('file-input').value = '';
      const mediaMsg = { uid, name:userData.name, text:'[media]'+url+'|'+encodeURIComponent(file.name || 'fichier'), ts:Date.now() };
      db.ref('fts_forum/messages/'+currentChannel).push(mediaMsg).then(ref => { FTSGamification.awardXp(db, uid, 'forum_post', 5, { maxPerDay:3 }).catch(()=>{}); notifyChannel(currentChannel, (userData.name || 'Membre') + ' a envoyé un fichier', ref.key); });
    })
    .catch(() => { txt.textContent='Erreur upload'; setTimeout(() => bar.classList.remove('show'), 2500); });
}

function mediaDownloadUrl(url){
  if(!url) return '';
  // Cloudinary : force un vrai téléchargement quand c'est possible.
  if(url.includes('/upload/') && !url.includes('/fl_attachment')){
    return url.replace('/upload/', '/upload/fl_attachment/');
  }
  return url;
}

function cleanMediaName(raw, fallback){
  let name = '';
  try{ name = decodeURIComponent(raw || ''); }catch(e){ name = raw || ''; }
  name = String(name || '').split('/').pop().split('?')[0].trim();
  if(!name) name = fallback || 'Fichier joint';
  return name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseMediaPayload(payload){
  const parts = String(payload || '').split('|');
  const url = parts.shift() || '';
  const fromPayload = parts.join('|');
  const fallback = url.split('?')[0].split('/').pop() || 'Fichier joint';
  return { url, name: cleanMediaName(fromPayload || fallback, fallback) };
}

function fileKindFromExt(ext){
  if(ext === 'pdf') return { cls:'pdf', icon:'📄', label:'PDF' };
  if(['mp3','wav','ogg','aac','m4a'].includes(ext)) return { cls:'audio', icon:'🎵', label:'Audio' };
  if(['mp4','mov','webm'].includes(ext)) return { cls:'video', icon:'🎬', label:'Vidéo' };
  if(['jpg','jpeg','png','gif','webp'].includes(ext)) return { cls:'image', icon:'🖼️', label:'Image' };
  return { cls:'file', icon:'📎', label:'Fichier' };
}

function renderFileCard(icon, title, url, label, kind){
  const normalizedUrl = FTS.safeUrl(url, '#');
  const safeUrl = esc(normalizedUrl);
  const dlUrl = esc(mediaDownloadUrl(normalizedUrl));
  const safeTitle = esc(title || 'Fichier joint');
  const safeLabel = esc(label || 'Fichier joint');
  const safeKind = esc(kind || 'file');
  return `<div class="msg-file-card msg-file-card--${safeKind}">
    <a class="msg-file-main" href="${safeUrl}" target="_blank" rel="noopener" title="${safeTitle}" aria-label="Ouvrir ${safeTitle}">
      <span class="msg-file-icon" aria-hidden="true">${icon}</span>
      <span class="msg-file-info">
        <span class="msg-file-title">${safeTitle}</span>
        <span class="msg-file-sub">${safeLabel}</span>
      </span>
    </a>
    <div class="msg-file-actions">
      <a class="msg-file-open" href="${safeUrl}" target="_blank" rel="noopener" aria-label="Ouvrir ${safeTitle}">Ouvrir</a>
      <a class="msg-file-download" href="${dlUrl}" target="_blank" rel="noopener" download aria-label="Télécharger ${safeTitle}">⬇ Télécharger</a>
    </div>
  </div>`;
}

function renderMedia(payload){
  const media = parseMediaPayload(payload);
  const url = media.url;
  const title = media.name;
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const kind = fileKindFromExt(ext);
  const normalizedUrl = FTS.safeUrl(url, '#');
  const dl = esc(mediaDownloadUrl(normalizedUrl));
  const safeUrl = esc(normalizedUrl);
  const safeTitle = esc(title || 'Fichier joint');
  const isImg = url.includes('/image/upload/') && !['pdf'].includes(ext) || ['jpg','jpeg','png','gif','webp'].includes(ext);
  const isVideo = (url.includes('/video/upload/') && !['mp3','wav','ogg','aac','m4a'].includes(ext)) || ['mp4','mov','webm'].includes(ext);
  const isAudio = ['mp3','wav','ogg','aac','m4a'].includes(ext);
  const isPdf = ext === 'pdf';

  if(isImg) return `<div class="msg-media-wrap msg-media-wrap--image">
    <div class="msg-media-title"><span>🖼️</span><strong>${safeTitle}</strong></div>
    <img class="msg-img" src="${safeUrl}" data-fts-click="window.open(${FTS.jsArg(normalizedUrl)})" alt="${safeTitle}">
    <div class="msg-file-actions compact"><a class="msg-file-open" href="${safeUrl}" target="_blank" rel="noopener">Ouvrir</a><a class="msg-file-download compact" href="${dl}" target="_blank" rel="noopener" download>⬇ Télécharger</a></div>
  </div>`;

  if(isVideo) return `<div class="msg-media-wrap msg-media-wrap--video">
    <div class="msg-media-title"><span>🎬</span><strong>${safeTitle}</strong></div>
    <video class="msg-video" src="${safeUrl}" controls playsinline></video>
    <div class="msg-file-actions compact"><a class="msg-file-open" href="${safeUrl}" target="_blank" rel="noopener">Ouvrir</a><a class="msg-file-download compact" href="${dl}" target="_blank" rel="noopener" download>⬇ Télécharger</a></div>
  </div>`;

  if(isAudio) return `<div class="msg-audio-card msg-file-card--audio">
    <div class="msg-media-title"><span>🎵</span><strong>${safeTitle}</strong></div>
    <audio class="msg-audio" controls preload="none"><source src="${safeUrl}"></audio>
    <div class="msg-file-actions compact"><a class="msg-file-open" href="${safeUrl}" target="_blank" rel="noopener">Ouvrir</a><a class="msg-file-download compact" href="${dl}" target="_blank" rel="noopener" download>⬇ Télécharger</a></div>
  </div>`;

  if(isPdf) return renderFileCard('📄', title, url, 'PDF · ouvrir ou télécharger', 'pdf');
  return renderFileCard(kind.icon, title, url, kind.label + ' · ouvrir ou télécharger', kind.cls);
}

let dmUnreadCleanup = null;
function listenUnreadBadge(uid){
  if (dmUnreadCleanup) { try { dmUnreadCleanup(); } catch(e) {} dmUnreadCleanup = null; }
  if (window.FTS && typeof FTS.listenDmUnreadTotal === 'function') {
    dmUnreadCleanup = FTS.listenDmUnreadTotal(db, uid, function(total){
      const el=document.getElementById('msg-badge'); if(!el) return;
      if(total>0){ el.textContent = total>99?'99+':total; el.style.display='inline-block'; } else el.style.display='none';
    });
    return;
  }
  db.ref('fts_dm/userConvs/'+uid).on('value', async snap => {
    const ids = snap.val() ? Object.keys(snap.val()) : []; let total = 0;
    await Promise.all(ids.map(id => db.ref('fts_dm/conversations/'+id+'/unread/'+uid).once('value').then(s => total += (s.val() || 0))));
    const el=document.getElementById('msg-badge'); if(!el) return;
    if(total>0){ el.textContent = total>99?'99+':total; el.style.display='inline-block'; } else el.style.display='none';
  });
}



function channelInfoById(channel){
  if(channel === 'general') return { group:'', subgroup:'', label:'Général' };
  for(const cat of categoryStructure || []){
    const catNorm = norm(cat.category);
    if(catNorm === channel) return { group:cat.category, subgroup:'', label:'Général '+cat.category };
    for(const sub of (cat.subs || [])){
      if(norm(sub.name) === channel) return { group:cat.category, subgroup:sub.name, label:sub.name };
    }
  }
  return { group:'', subgroup:'', label:channel };
}

function findForumChannel(channel){
  for(const item of forumItems || []){
    if(item.type === 'channel' && item.id === channel) return item;
    const ch = (item.channels || []).find(c => c.id === channel);
    if(ch) return ch;
  }
  return null;
}

function openForumDeepLink(){
  if(deepLinkHandled || !uid || !forumItems.length) return;
  const params = new URLSearchParams(location.search || '');
  const channel = params.get('channel');
  if(!channel) return;
  const ch = findForumChannel(channel);
  if(!ch) return;
  const parent = (forumItems || []).find(item => (item.channels || []).some(c => c.id === channel));
  if(parent) openCats[parent.id] = true;
  deepLinkHandled = true;
  selectForumChannel(ch.id, ch.name, ch.icon || '💬', ch.desc || '', ch.group || '', ch.subgroup || '');
  const msgId = params.get('msg');
  if(msgId){
    setTimeout(() => {
      const el = document.getElementById('msg-' + msgId);
      if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('notif-target'); setTimeout(()=>el.classList.remove('notif-target'), 3500); }
    }, 900);
  }
}

function urlBase64ToUint8Array(b64){ const pad='='.repeat((4-b64.length%4)%4); const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/')); const arr=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i); return arr; }
async function getSubscription(){ if(!('serviceWorker' in navigator)) return null; const reg=await navigator.serviceWorker.ready; return reg.pushManager.getSubscription(); }
async function checkNotifStatus(){ const sub=await getSubscription(); updateNotifBtn(!!sub); }
function updateNotifBtn(on){ const btn=document.getElementById('btn-notif'); if(!btn) return; btn.textContent = on ? '🔔 Notifs activées' : '🔕 Activer les notifs'; btn.classList.toggle('on', on); }
async function toggleNotifications(){ const sub=await getSubscription(); if(sub){ await sub.unsubscribe(); fetch(FTS.PUSH.workerUrl+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid})}).catch(()=>{}); updateNotifBtn(false); } else await subscribePush(); }
async function subscribePush(){
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){ alert('Autorise les notifications pour continuer.'); return; }
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(FTS.PUSH.vapidPublicKey)});
    const groups = getForumGroups();
    const subgroups = getForumSubgroups();
    await fetch(FTS.PUSH.workerUrl+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      uid, subscription:sub.toJSON(),
      group:groups.join(', '), subgroup:subgroups.join(', '),
      groups, subgroups
    })});
    updateNotifBtn(true);
  }catch(e){ alert('Erreur notifications : '+e.message); }
}
async function getAdminRecipientUids(excludeUid){
  try{
    const snap = await db.ref('fts_public_profiles').orderByChild('role').equalTo('admin').once('value');
    const ids = [];
    if(snap.exists()) snap.forEach(child => {
      const u = child.val() || {};
      if(child.key !== excludeUid && u.status === 'active') ids.push(child.key);
    });
    return ids;
  }catch(e){ console.warn('[FTS Forum] Admin recipients', e); return []; }
}
function forumSubgroupsByCategory(profile, targetGroup){
  const out = [];
  const wantedGroup = norm(targetGroup || '');
  function addFromByCat(value){
    if(!value || typeof value !== 'object' || Array.isArray(value)) return;
    Object.keys(value).forEach(cat => {
      if(!wantedGroup || norm(cat) === wantedGroup) out.push(...normList(value[cat]));
    });
  }
  addFromByCat(profile && (profile.subgroupsByCat || profile.subcategoriesByCat || profile.groupsByCat));
  if(profile && profile.hasEnfant && Array.isArray(profile.enfants)){
    profile.enfants.forEach(child => addFromByCat(child && (child.subgroupsByCat || child.subcategoriesByCat || child.groupsByCat)));
  }
  return uniqList(out);
}

function forumUserHasSubgroup(profile, targetSubgroup, targetGroup){
  const target = norm(targetSubgroup || '');
  if(!target) return true;

  // Priorité aux accès rattachés à une catégorie : évite les collisions futures
  // du type Théâtre > Adultes et Danse > Adultes.
  if(targetGroup){
    const byCatSubs = forumSubgroupsByCategory(profile, targetGroup);
    if(byCatSubs.length) return byCatSubs.some(s => norm(s) === target);
  }

  // Compatibilité anciens profils : sous-catégories stockées en liste plate.
  const directSubs = normList(profile && (profile.subgroups || profile.subcategories || profile.subgroup));
  const childSubs = childSubgroups(profile);
  return [...directSubs, ...childSubs].some(s => norm(s) === target);
}

function forumUserCanReceive(profile, info){
  if(!profile || profile.status !== 'active') return false;
  if(profile.role === 'admin') return true;
  if(!info.group && !info.subgroup) return true; // Général

  const groups = [
    ...normList(profile.disciplines || profile.groups || profile.group),
    ...childDisciplines(profile)
  ];
  const hasGroup = info.group ? groups.some(g => norm(g) === norm(info.group)) : false;

  // Canal de sous-catégorie : il faut appartenir à la catégorie parent ET à la sous-catégorie.
  // Cela évite qu'une future sous-catégorie portant le même nom dans deux catégories notifie trop large.
  if(info.group && info.subgroup){
    return hasGroup && forumUserHasSubgroup(profile, info.subgroup, info.group);
  }

  if(info.group) return hasGroup;
  if(info.subgroup) return forumUserHasSubgroup(profile, info.subgroup, info.group);

  return false;
}

async function getForumRecipientUids(info, excludeUid){
  const out = new Set();

  function scanSnapshot(snap, source){
    if(!snap || !snap.exists || !snap.exists()) return;
    snap.forEach(child => {
      if(child.key === excludeUid) return;
      const profile = child.val() || {};
      // Les deux sources sont volontairement publiques/allégées :
      // - fts_public_profiles : profils actifs nettoyés, enfants inclus si resynchronisés
      // - fts_forum/users : profil forum historique, utile pour les admins/profs et les accès enfant déjà présents
      if(forumUserCanReceive(profile, info)) out.add(child.key);
    });
  }

  try{
    const snap = await FTS.activePublicProfilesRef(db).once('value');
    scanSnapshot(snap, 'public_profiles');
  }catch(e){ console.warn('[FTS Forum] Recipients public profiles', e); }

  // V186 : fallback important. Certains comptes admin/prof ou anciens profils peuvent ne pas être
  // parfaitement resynchronisés dans fts_public_profiles. fts_forum/users reste lisible par les
  // membres actifs et contient uniquement les données forum nécessaires aux notifications.
  try{
    const forumSnap = await db.ref('fts_forum/users').once('value');
    scanSnapshot(forumSnap, 'forum_users');
  }catch(e){ console.warn('[FTS Forum] Recipients forum users', e); }

  return [...out];
}
async function primeForumUnreadForRecipients(recipients, channel, messageTs){
  // V185 : ne plus écrire forumReads chez les autres membres.
  // Le non-lu se calcule depuis leurs propres lectures + les notifications internes.
  return;
}


async function notifyChannel(channel, body, msgId){
  if(!FTS.PUSH || !FTS.PUSH.workerUrl) return;

  const info = (channel === currentChannel && currentChannelInfo) ? currentChannelInfo : channelInfoById(channel);
  const url = './forum.html?channel=' + encodeURIComponent(channel) + (msgId ? '&msg=' + encodeURIComponent(msgId) : '');
  const recipients = await getForumRecipientUids(info, uid);
  if(!recipients.length) return;

  const notificationKey = 'forum-' + channel + '-' + (msgId || Date.now());
  const basePayload = {
    type:'forum',
    channel,
    group:info.group,
    subgroup:info.subgroup,
    title:'FTS — Forum',
    body,
    url,
    senderUid:uid,
    msgId,
    notificationKey
  };

  // Trace interne + baseline unread : ne bloque jamais l'envoi push.
  try{
    const fanout = {};
    recipients.forEach(recipientUid => {
      const nref = db.ref('fts_user_notifications/' + recipientUid).push();
      fanout['fts_user_notifications/' + recipientUid + '/' + nref.key] = {
        type:'forum', channel, group:info.group, subgroup:info.subgroup, title:'FTS — Forum',
        body, url, msgId, senderUid:uid, notificationKey, read:false, createdAt:Date.now()
      };
    });
    db.ref().update(fanout).catch(()=>{});
    primeForumUnreadForRecipients(recipients, channel, Date.now()).catch(()=>{});
    if(userProfile && (userProfile.role === 'admin' || userProfile.role === 'prof')){
      db.ref('fts_debug_notifications/' + notificationKey).set({
        type:'forum', channel, msgId, senderUid:uid, recipientCount:recipients.length, recipients, createdAt:Date.now()
      }).catch(()=>{});
    }
  }catch(e){}

  // Envoi forcé par UID pour éviter les doublons catégorie + sous-catégorie + admin.
  await Promise.allSettled(recipients.map(recipientUid =>
    fetch(FTS.PUSH.workerUrl+'/notify',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        type: basePayload.type,
        channel: basePayload.channel,
        title: basePayload.title,
        body: basePayload.body,
        url: basePayload.url,
        senderUid: basePayload.senderUid,
        msgId: basePayload.msgId,
        notificationKey: basePayload.notificationKey,
        uid: recipientUid,
        uids: [recipientUid],
        recipientUids: [recipientUid],
        recipients: [recipientUid],
        forceUid: true,
        excludeUid: uid,
        excludeUids: [uid],
        tag: notificationKey + '-' + recipientUid,
        collapseKey: notificationKey + '-' + recipientUid
      })
    }).catch(()=>{})
  ));
}

/* FTS_AUTO_EXTRACTED_HANDLERS:forum.html */
(function(){
  'use strict';
  var handlers = [{"selector": "[data-fts-handler-1]", "event": "click", "code": "toggleAdminMode()"}, {"selector": "[data-fts-handler-2]", "event": "input", "code": "renderForumList(this.value)"}, {"selector": "[data-fts-handler-3]", "event": "click", "code": "toggleNotifications()"}, {"selector": "[data-fts-handler-4]", "event": "click", "code": "exitAdmin()"}, {"selector": "[data-fts-handler-5]", "event": "click", "code": "closeChat()"}, {"selector": "[data-fts-handler-6]", "event": "change", "code": "uploadMedia(this.files[0])"}, {"selector": "[data-fts-handler-7]", "event": "click", "code": "document.getElementById('file-input').click()"}, {"selector": "[data-fts-handler-8]", "event": "keydown", "code": "handleKey(event)"}, {"selector": "[data-fts-handler-9]", "event": "input", "code": "autoResize(this)"}, {"selector": "[data-fts-handler-10]", "event": "click", "code": "sendMessage()"}];
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
