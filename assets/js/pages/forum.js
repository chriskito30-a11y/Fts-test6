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
let currentChannel = null, currentListener = null, lastMsgDate = null;
let adminMode = false;
let deepLinkHandled = false;

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
      document.getElementById('auth-loading').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      const label = userProfile.firstName || userProfile.name || userProfile.email || '?';
      FTSChat.setAvatar(document.getElementById('my-avatar'), label);
      listenUnreadBadge(uid);
      checkNotifStatus();
      buildForumItems(); renderForumList(); openForumDeepLink();
    }catch(e){ console.warn('[FTS Forum]', e); showBootError(e); }
  });
});


function showBootError(e){
  const box = document.getElementById('auth-loading');
  if(!box) return;
  box.innerHTML = `<div class="auth-logo">FAIS TON <span>SHOW</span></div><div class="auth-sub">Erreur chargement forum</div><p style="max-width:420px;text-align:center;color:#888;font-size:.8rem;line-height:1.6;padding:0 1rem">${FTS.esc(e && e.message ? e.message : String(e))}<br><br><a href="membres.html" style="color:#c9a84c">Retour membres</a></p>`;
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
    ts: userData.ts || Date.now()
  };
  db.ref('fts_forum/users/'+uid).update({
    name: userData.name,
    group: userData.group,
    groups: userData.groups,
    subgroup: userData.subgroup,
    subgroups: userData.subgroups,
    status: userData.status,
    role: userData.role,
    ts: Date.now()
  }).catch(e => console.warn('[FTS Forum] Synchro profil forum impossible', e));

  db.ref('fts_forum/users/'+uid+'/status').on('value', snap => {
    if(snap.exists()){ userData.status = snap.val(); updateStatusUI(); buildForumItems(); renderForumList(); openForumDeepLink(); }
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
  buildForumItems(); renderForumList(document.getElementById('forum-search')?.value || ''); openForumDeepLink();
}

function buildForumItems(){
  if(!userData && !userProfile) return;
  const isAdmin = userProfile?.role === 'admin';
  const isActive = userData?.status === 'active' || isAdmin;
  const userGroupNorms = isAdmin ? null : getForumGroups().map(norm);
  const userSubNorms = isAdmin ? null : getForumSubgroups().map(norm);
  const items = [{
    id:'general', type:'channel', icon:'💬', name:'Général', desc:'Discussion ouverte à tous', preview:'Canal commun à tous les membres'
  }];
  if(isActive){
    if(categoryStructure.length){
      for(const cat of categoryStructure){
        const catNorm = norm(cat.category);
        const userHasCat = isAdmin || userGroupNorms?.includes(catNorm);
        const visibleSubs = isAdmin ? cat.subs : cat.subs.filter(s => userSubNorms?.includes(norm(s.name)));
        if(!userHasCat && !visibleSubs.length) continue;
        const channels = [];
        if(userHasCat) channels.push({ id:catNorm, icon:catIcon(cat.category), name:'Général '+cat.category, desc:'Discussion générale — '+cat.category });
        visibleSubs.forEach(sub => channels.push({ id:norm(sub.name), icon:'📅', name:sub.name, desc:'Canal '+sub.name }));
        items.push({ id:'cat_'+catNorm, type:'category', icon:catIcon(cat.category), name:cat.category, desc:`${channels.length} canal${channels.length>1?'s':''} accessible${channels.length>1?'s':''}`, channels });
      }
    }else if(!categoryLoaded){
      items.push({ id:'loading', type:'info', icon:'⏳', name:'Chargement…', desc:'Chargement des catégories' });
    }else{
      const groups = getForumGroups();
      groups.forEach(g => items.push({ id:'cat_'+norm(g), type:'category', icon:catIcon(g), name:g, desc:'Canal '+g, channels:[{id:norm(g), icon:catIcon(g), name:'Général '+g, desc:'Canal '+g}] }));
    }
  }
  forumItems = items;
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
      <div class="conv-item" onclick="toggleCategory('${esc(item.id)}')">
        <div class="conv-av" style="background:rgba(201,168,76,.18)">${item.icon}</div>
        <div class="conv-body">
          <div class="conv-row1"><div class="conv-name">${esc(item.name)}</div><div class="forum-chevron">›</div></div>
          <div class="conv-row2"><div class="conv-preview">${esc(item.desc)}</div></div>
        </div>
      </div>
      <div class="forum-subchannels">
        ${(item.channels||[]).map(ch => `<div class="forum-subchannel${ch.id===currentChannel?' active':''}" onclick="selectForumChannel('${esc(ch.id)}','${esc(ch.name)}','${esc(ch.icon)}','${esc(ch.desc)}')"><span class="forum-sub-icon">${ch.icon}</span><span class="forum-sub-name">${esc(ch.name)}</span></div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function renderChannelBubble(ch){
  return `<div class="conv-item${ch.id===currentChannel?' active':''}" onclick="selectForumChannel('${esc(ch.id)}','${esc(ch.name)}','${esc(ch.icon)}','${esc(ch.desc)}')">
    <div class="conv-av" style="background:rgba(212,32,26,.16)">${ch.icon}</div>
    <div class="conv-body">
      <div class="conv-row1"><div class="conv-name">${esc(ch.name)}</div></div>
      <div class="conv-row2"><div class="conv-preview">${esc(ch.preview || ch.desc || '')}</div></div>
    </div>
  </div>`;
}

function toggleCategory(id){ openCats[id] = !openCats[id]; renderForumList(document.getElementById('forum-search').value || ''); }

function selectForumChannel(id, name, icon, desc){
  currentChannel = id; lastMsgDate = null;
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
  currentChannel = null;
  if(currentListener){ currentListener(); currentListener = null; }
  renderForumList(document.getElementById('forum-search').value || '');
}

function loadMessages(id){
  const ref = db.ref('fts_forum/messages/'+id).limitToLast(80);
  ref.on('child_added', snap => addForumMsg(snap.val(), snap.key));
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
  notifyChannel(currentChannel, msg.name + ' : ' + text.substring(0,80), ref.key);
}

function addForumMsg(m, key){
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
  div.innerHTML = `${!own ? `<div class="msg-sender">${esc(m.name || 'Membre')}</div>` : ''}
    <div class="msg-bubble">${body}<div class="msg-foot"><span class="msg-time">${FTSChat.fmtFull(m.ts)}</span>${own ? '<span class="msg-check">✓✓</span>' : ''}</div></div>
    ${adminMode ? `<button class="btn-del-msg" onclick="deleteMsg('${key}')">Supprimer</button>` : ''}`;
  wrap.appendChild(div); FTSChat.scrollBottom();
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
      const mediaMsg = { uid, name:userData.name, text:'[media]'+url, ts:Date.now() };
      db.ref('fts_forum/messages/'+currentChannel).push(mediaMsg).then(ref => notifyChannel(currentChannel, (userData.name || 'Membre') + ' a envoyé un fichier', ref.key));
    })
    .catch(() => { txt.textContent='Erreur upload'; setTimeout(() => bar.classList.remove('show'), 2500); });
}

function renderMedia(url){
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const isImg = url.includes('/image/upload/') || ['jpg','jpeg','png','gif','webp'].includes(ext);
  const isVideo = (url.includes('/video/upload/') && !['mp3','wav','ogg','aac','m4a'].includes(ext)) || ['mp4','mov','webm'].includes(ext);
  const isAudio = ['mp3','wav','ogg','aac','m4a'].includes(ext);
  const isPdf = ext === 'pdf';
  if(isImg) return `<img class="msg-img" src="${esc(url)}" onclick="window.open('${esc(url)}')">`;
  if(isVideo) return `<video class="msg-video" src="${esc(url)}" controls playsinline></video>`;
  if(isAudio) return `<audio controls preload="none" style="width:100%;min-width:200px"><source src="${esc(url)}"></audio>`;
  if(isPdf) return `<a class="msg-pdf" href="${esc(url)}" target="_blank">📄 Ouvrir le PDF</a>`;
  return `<a class="msg-pdf" href="${esc(url)}" target="_blank">📎 Fichier joint</a>`;
}

function listenUnreadBadge(uid){
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
      if(norm(sub.name) === channel) return { group:'', subgroup:sub.name, label:sub.name };
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
  selectForumChannel(ch.id, ch.name, ch.icon || '💬', ch.desc || '');
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
    const snap = await db.ref('fts_users').orderByChild('role').equalTo('admin').once('value');
    const ids = [];
    if(snap.exists()) snap.forEach(child => {
      const u = child.val() || {};
      if(child.key !== excludeUid && u.status === 'active') ids.push(child.key);
    });
    return ids;
  }catch(e){ console.warn('[FTS Forum] Admin recipients', e); return []; }
}
function notifyAdmins(payload, tagPrefix){
  getAdminRecipientUids(uid).then(adminUids => {
    adminUids.forEach(adminUid => {
      fetch(FTS.PUSH.workerUrl+'/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...payload,
        uid: adminUid,
        uids: [adminUid],
        recipientUids: [adminUid],
        recipients: [adminUid],
        adminCopy: true,
        forceUid: true,
        tag: tagPrefix + '-' + adminUid
      })}).catch(()=>{});
    });
  });
}
function notifyChannel(channel, body, msgId){
  const info = channelInfoById(channel);
  const url = './forum.html?channel=' + encodeURIComponent(channel) + (msgId ? '&msg=' + encodeURIComponent(msgId) : '');
  const payload = {
    type:'forum', channel, group:info.group, subgroup:info.subgroup,
    title:'FTS — Forum', body, url, senderUid:uid, msgId
  };

  // Notification normale : ciblage catégorie / sous-catégorie côté serveur push.
  fetch(FTS.PUSH.workerUrl+'/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{});

  // Copie forcée admins : les admins reçoivent tout, même hors catégorie/sous-catégorie.
  notifyAdmins(payload, 'admin-forum-' + channel + '-' + (msgId || Date.now()));
}
