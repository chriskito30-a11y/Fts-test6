/* ================================================================
   PAGE MODULE — MESSAGES
   Extrait depuis messages.html pour supprimer le JavaScript inline.
   ================================================================ */

function setH(){ document.documentElement.style.setProperty("--vh", window.innerHeight + "px"); }
setH(); window.addEventListener("resize", setH);
window.addEventListener("orientationchange", () => setTimeout(setH, 200));

/* ---- bloc inline extrait ---- */
/* ================================================================
   MESSAGES.JS — Messagerie privée FTS
   ✅ Layout mobile-first (slide panel)
   ✅ Couleurs site FTS
   ✅ iOS zoom fix (font-size 16px)
   ================================================================ */

let db, auth, me, myUid;
let allUsers = {}, allConvs = [];
let currentConvId = null, currentListener = null;
let convType = "direct", selectedUids = new Set(), lastMsgDate = null;
let deepLinkConvId = null, deepLinkMsgId = null, deepLinkHandled = false;

/* Couleurs avatars déterministes */
function avColor(s){ return FTSChat.avColor(s); }
function setAv(el, name, isGroup){ FTSChat.setAvatar(el, name, { type: isGroup ? "group" : "person", icon: "👥" }); }

/* ── INIT ────────────────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  if("serviceWorker" in navigator){ navigator.serviceWorker.register("./sw.js", {scope:"./"}).catch(()=>{}); }
  const params = new URLSearchParams(location.search || "");
  deepLinkConvId = params.get("conv");
  deepLinkMsgId = params.get("msg");
  db   = FTS.initFirebase();
  auth = firebase.auth();

  auth.onAuthStateChanged(async user => {
    if(!user){ location.href="auth.html"; return; }
    myUid = user.uid;
    try{
      const s = await db.ref("fts_users/"+myUid).once("value");
      me = s.val();
      if(!me || me.status !== "active"){ await auth.signOut(); location.href="auth.html"; return; }

      document.getElementById("auth-loading").style.display = "none";
      document.getElementById("app").style.display = "flex";

      const av = document.getElementById("my-avatar");
      av.textContent = (me.name||"?").charAt(0).toUpperCase();
      av.style.background = avColor(me.name||myUid);

      await loadUsers();
      listenConvs();
      checkNotifStatus();
      openMessageDeepLink();
    }catch(e){ console.warn("[FTS Msg]", e); showBootError(e); }
  });
});


function showBootError(e){
  const box = document.getElementById('auth-loading');
  if(!box) return;
  box.innerHTML = `<div class="auth-logo">FAIS TON <span>SHOW</span></div><p class="messages-error-text">Erreur chargement messages : ${FTS.esc(e && e.message ? e.message : String(e))}<br><br><a href="membres.html" class="messages-error-link">Retour membres</a></p>`;
}

/* ── MEMBRES ─────────────────────────────────────────────────── */
async function loadUsers(){
  const s = await db.ref("fts_users").orderByChild("status").equalTo("active").once("value");
  allUsers = {};
  if(s.exists()) s.forEach(c => { if(c.key !== myUid) allUsers[c.key] = c.val(); });
}

/* ── CONVERSATIONS ───────────────────────────────────────────── */
function listenConvs(){
  db.ref("fts_dm/userConvs/"+myUid).on("value", async snap => {
    const ids = snap.val() ? Object.keys(snap.val()) : [];
    if(!ids.length){ renderConvs([]); return; }
    const loaded = await Promise.all(
      ids.map(id => db.ref("fts_dm/conversations/"+id).once("value").then(s => ({id, data:s.val()})))
    );
    allConvs = loaded.filter(c => c.data).sort((a,b) => (b.data.lastTs||0)-(a.data.lastTs||0));
    renderConvs(allConvs);
  });
}

function renderConvs(convs){
  const el = document.getElementById("conv-list");
  if(!convs.length){
    el.innerHTML = `<div class="conv-empty"><span class="conv-empty-icon">✉️</span><p>Aucune conversation.<br>Commence un message !</p></div>`;
    return;
  }
  el.innerHTML = convs.map(({id, data}) => {
    const isG  = data.type === "group";
    const unrd = (data.unread && data.unread[myUid]) || 0;
    const name = isG ? (data.name||"Groupe") : otherName(data.participants);
    const col  = isG ? "rgba(201,168,76,.2)" : avColor(name);
    const lett = isG ? "👥" : name.charAt(0).toUpperCase();
    const prev = data.lastMessage ? FTS.esc(data.lastMessage.substring(0,55)) : "Nouvelle conversation";
    const ts   = data.lastTs ? fmtTs(data.lastTs) : "";
    return `<div class="conv-item${id===currentConvId?" active":""}" data-conv-id="${FTS.esc(id)}" data-fts-click="selectConv('${id}')">
      <div class="conv-av" data-fts-bg="${col}">${lett}</div>
      <div class="conv-body">
        <div class="conv-row1">
          <div class="conv-name">${FTS.esc(name)}</div>
          <div class="conv-ts${unrd?" unread":""}">${ts}</div>
        </div>
        <div class="conv-row2">
          <div class="conv-preview">${prev}</div>
          ${unrd ? `<div class="conv-badge">${unrd>99?"99+":unrd}</div>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");
}

function otherName(parts){
  if(!parts) return "Inconnu";
  const uid = Object.keys(parts).find(u => u !== myUid);
  if(!uid) return "Moi";
  const u = allUsers[uid];
  return u ? u.name||u.email : "Membre";
}

function searchConvs(q){
  if(!q.trim()){ renderConvs(allConvs); return; }
  const t = q.toLowerCase();
  renderConvs(allConvs.filter(({data}) => {
    const n = data.type==="group" ? (data.name||"") : otherName(data.participants);
    return n.toLowerCase().includes(t);
  }));
}

/* ── SÉLECTION ───────────────────────────────────────────────── */
async function selectConv(id){
  currentConvId = id; lastMsgDate = null;
  document.querySelectorAll(".conv-item").forEach(el => {
    el.classList.toggle("active", el.dataset.convId === id);
  });
  const s    = await db.ref("fts_dm/conversations/"+id).once("value");
  const data = s.val(); if(!data) return;

  // Si l'utilisateur avait supprimé cette conversation de sa liste,
  // une ouverture via notification doit la réinscrire automatiquement.
  // Sinon il peut lire/répondre mais le fil n'apparaît plus ensuite.
  if(data.participants && data.participants[myUid] === true){
    await db.ref("fts_dm/userConvs/"+myUid+"/"+id).set(true).catch(()=>{});
  }

  const isG  = data.type === "group";
  const name = isG ? (data.name||"Groupe") : otherName(data.participants);
  const pc   = Object.keys(data.participants||{}).length;

  setAv(document.getElementById("chat-av"), name, isG);
  document.getElementById("chat-name").textContent = name;
  document.getElementById("chat-sub").textContent  = isG ? `${pc} participant${pc>1?"s":""}` : "Message privé";

  /* Afficher chat */
  document.getElementById("chat-empty").style.display = "none";
  document.getElementById("chat-zone").classList.add("on");
  document.getElementById("app").classList.add("chat-open");

  /* Messages */
  document.getElementById("messages").innerHTML = "";
  if(currentListener) currentListener();
  const ref = db.ref("fts_dm/messages/"+id).limitToLast(80);
  ref.on("child_added", snap => addMsg(snap.key, snap.val(), snap.val().senderId === myUid));
  ref.on("child_changed", snap => updateMsg(snap.key, snap.val()));
  ref.on("child_removed", snap => removeMsg(snap.key));
  currentListener = () => ref.off();

  /* Marquer lu + nettoyer immédiatement la bulle rouge sans attendre un refresh */
  await db.ref("fts_dm/conversations/"+id+"/unread/"+myUid).set(0);
  const localConv = allConvs.find(c => c.id === id);
  if(localConv && localConv.data){
    localConv.data.unread = localConv.data.unread || {};
    localConv.data.unread[myUid] = 0;
    renderConvs(allConvs);
  }
  setTimeout(() => document.getElementById("msg-input").focus(), 200);
}

/* ── FERMER CHAT (mobile) ────────────────────────────────────── */
function closeChat(){
  document.getElementById("app").classList.remove("chat-open");
  document.getElementById("chat-zone").classList.remove("on");
  document.getElementById("chat-empty").style.display = "flex";
  currentConvId = null;
  if(currentListener){ currentListener(); currentListener = null; }
  document.querySelectorAll(".conv-item").forEach(el => el.classList.remove("active"));
}

/* ── ENVOI ───────────────────────────────────────────────────── */
async function sendMessage(){
  if(!currentConvId) return;
  const input = document.getElementById("msg-input");
  const text  = input.value.trim(); if(!text) return;
  input.value = ""; input.style.height = "";
  const msg = { senderId:myUid, senderName:me.name||me.email, text, ts:Date.now() };
  const msgRef = await db.ref("fts_dm/messages/"+currentConvId).push(msg);
  const convSnap = await db.ref("fts_dm/conversations/"+currentConvId).once("value");
  const convData = convSnap.val() || {};
  const ps = convData.participants || {};
  const upd = {
    ["fts_dm/conversations/"+currentConvId+"/lastMessage"]:    text.substring(0,80),
    ["fts_dm/conversations/"+currentConvId+"/lastSenderName"]: me.name,
    ["fts_dm/conversations/"+currentConvId+"/lastTs"]:         msg.ts,
  };
  const recipients = [];
  for(const uid of Object.keys(ps)){
    // Important : si un participant avait supprimé la conversation de sa liste,
    // tout nouveau message doit recréer son index userConvs.
    // Sans ça, la notification ouvre bien le fil, mais il redisparaît ensuite.
    upd["fts_dm/userConvs/"+uid+"/"+currentConvId] = true;

    if(uid !== myUid){
      recipients.push(uid);
      const c = (await db.ref("fts_dm/conversations/"+currentConvId+"/unread/"+uid).once("value")).val()||0;
      upd["fts_dm/conversations/"+currentConvId+"/unread/"+uid] = c+1;
    } else {
      upd["fts_dm/conversations/"+currentConvId+"/unread/"+uid] = 0;
    }
  }
  await db.ref().update(upd);
  // Confidentialité MP : notification uniquement aux vrais participants de la conversation.
  notifyDirectMessage(currentConvId, convData, uniqueUids(recipients), text, msgRef.key);
}

/* ── BULLE ───────────────────────────────────────────────────── */
function isGroupConv(){ const c=allConvs.find(x=>x.id===currentConvId); return c&&c.data&&c.data.type==="group"; }

function msgTextHtml(m){
  const text = m && m.text ? String(m.text) : '';
  if(text.startsWith('[media]')) return FTSChat.renderMedia(text.slice(7));
  return FTS.esc(text).replace(/\n/g,"<br>");
}

function addMsg(key, m, own){
  const wrap = document.getElementById("messages");
  const dStr = new Date(m.ts).toDateString();
  if(dStr !== lastMsgDate){
    lastMsgDate = dStr;
    const sep = document.createElement("div");
    sep.className = "day-sep";
    sep.innerHTML = `<span>${fmtDay(m.ts)}</span>`;
    wrap.appendChild(sep);
  }
  const div = document.createElement("div");
  div.className = "msg-wrap " + (own ? "own" : "other");
  div.id = "msg-" + key;
  div.dataset.key = key;
  const showSender = !own && isGroupConv();
  div.innerHTML = `
    ${showSender ? `<div class="msg-sender">${FTS.esc(m.senderName)}</div>` : ""}
    <div class="msg-bubble">
      <span class="msg-text-content">${msgTextHtml(m)}</span>
      ${m.editedAt ? '<span class="msg-edited">modifié</span>' : ''}
      <div class="msg-foot">
        <span class="msg-time">${fmtFull(m.ts)}</span>
        ${own ? '<span class="msg-check">✓✓</span>' : ""}
      </div>
    </div>
    ${own ? `<div class="msg-actions">
      <button class="msg-act" data-fts-click="editMessage('${key}')">Modifier</button>
      <button class="msg-act danger" data-fts-click="deleteMessage('${key}')">Supprimer</button>
    </div>` : ""}`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function updateMsg(key, m){
  const el = document.getElementById("msg-" + key);
  if(!el) return;
  const txt = el.querySelector(".msg-text-content");
  if(txt) txt.innerHTML = msgTextHtml(m);
  const bubble = el.querySelector(".msg-bubble");
  if(bubble && m.editedAt && !bubble.querySelector(".msg-edited")){
    const marker = document.createElement("span");
    marker.className = "msg-edited";
    marker.textContent = "modifié";
    bubble.insertBefore(marker, bubble.querySelector(".msg-foot"));
  }
}

function removeMsg(key){
  const el = document.getElementById("msg-" + key);
  if(el) el.remove();
}

async function editMessage(key){
  if(!currentConvId || !key) return;
  const snap = await db.ref("fts_dm/messages/"+currentConvId+"/"+key).once("value");
  const msg = snap.val();
  if(!msg || msg.senderId !== myUid) return;
  const next = prompt("Modifier le message :", msg.text || "");
  if(next === null) return;
  const text = next.trim();
  if(!text) return alert("Le message ne peut pas être vide.");
  await db.ref("fts_dm/messages/"+currentConvId+"/"+key).update({ text, editedAt: Date.now() });
  const conv = allConvs.find(c => c.id === currentConvId);
  if(conv && conv.data && conv.data.lastSenderName === (me.name || me.email)){
    await db.ref("fts_dm/conversations/"+currentConvId).update({ lastMessage: text.substring(0,80), lastTs: Date.now() });
  }
}

async function deleteMessage(key){
  if(!currentConvId || !key) return;
  if(!confirm("Supprimer ce message ?")) return;
  await db.ref("fts_dm/messages/"+currentConvId+"/"+key).remove();
}

async function deleteCurrentConversation(){
  if(!currentConvId) return;
  if(!confirm("Supprimer cette conversation de ta messagerie ?\n\nElle restera visible pour les autres participants.")) return;
  const id = currentConvId;
  await db.ref("fts_dm/userConvs/"+myUid+"/"+id).remove();
  closeChat();
}


/* ── MODAL ───────────────────────────────────────────────────── */
function openModal(){
  selectedUids.clear(); convType = "direct";
  document.getElementById("tab-d").classList.add("on");
  document.getElementById("tab-g").classList.remove("on");
  document.getElementById("gname-wrap").style.display = "none";
  document.getElementById("pick-lbl").textContent = "Destinataire";
  document.getElementById("picker-q").value = "";
  document.getElementById("modal-err").textContent = "";
  document.getElementById("sel-info").textContent = "";
  renderUsers(Object.entries(allUsers));
  document.getElementById("modal").classList.remove("hidden");
}
function closeModal(){ document.getElementById("modal").classList.add("hidden"); }

function setType(t){
  convType = t;
  document.getElementById("tab-d").classList.toggle("on", t==="direct");
  document.getElementById("tab-g").classList.toggle("on", t==="group");
  document.getElementById("gname-wrap").style.display = t==="group" ? "block" : "none";
  document.getElementById("pick-lbl").textContent = t==="group" ? "Membres du groupe" : "Destinataire";
  selectedUids.clear();
  document.getElementById("sel-info").textContent = "";
  renderUsers(Object.entries(allUsers));
}

function filterUsers(){
  const q = document.getElementById("picker-q").value.toLowerCase();
  renderUsers(Object.entries(allUsers).filter(([,u]) => (u.name||u.email||"").toLowerCase().includes(q)));
}

function renderUsers(users){
  const el = document.getElementById("user-list");
  if(!users.length){ el.innerHTML='<div class="picker-empty">Aucun membre trouvé</div>'; return; }
  el.innerHTML = users.map(([uid, u]) => {
    const sel  = selectedUids.has(uid);
    const role = u.role==="admin" ? "🛡 Admin" : u.role==="prof" ? "🎓 Prof" : "";
    return `<div class="user-row${sel?" sel":""}" data-fts-click="toggleUser('${uid}')">
      <div class="user-av" data-fts-bg="${avColor(u.name||uid)}">${(u.name||u.email||"?").charAt(0).toUpperCase()}</div>
      <div class="user-main">
        <div class="user-name">${FTS.esc(u.name||u.email)}</div>
        ${role ? `<div class="user-role">${role}</div>` : ""}
      </div>
      <div class="user-check">${sel?"✓":""}</div>
    </div>`;
  }).join("");
}

function toggleUser(uid){
  if(convType==="direct"){ selectedUids.clear(); selectedUids.add(uid); }
  else{ selectedUids.has(uid) ? selectedUids.delete(uid) : selectedUids.add(uid); }
  const n = selectedUids.size;
  document.getElementById("sel-info").textContent = n ? `${n} membre${n>1?"s":""} sélectionné${n>1?"s":""}` : "";
  filterUsers();
}

async function startConv(){
  const err = document.getElementById("modal-err");
  if(!selectedUids.size){ err.textContent="Sélectionne au moins un membre."; return; }
  if(convType==="group" && !document.getElementById("gname").value.trim()){ err.textContent="Entre un nom pour le groupe."; return; }
  const parts = {[myUid]:true}; selectedUids.forEach(u => { parts[u]=true; });
  let convId;
  if(convType==="direct"){
    const other = [...selectedUids][0];
    convId = [myUid, other].sort().join("_");
    const ex = await db.ref("fts_dm/conversations/"+convId).once("value");
    if(!ex.exists()){
      await db.ref("fts_dm/conversations/"+convId).set({type:"direct",participants:parts,lastMessage:"",lastTs:Date.now(),createdAt:Date.now()});
      await db.ref("fts_dm/userConvs/"+myUid+"/"+convId).set(true);
      await db.ref("fts_dm/userConvs/"+other+"/"+convId).set(true);
    }
  }else{
    const ref = db.ref("fts_dm/conversations").push(); convId = ref.key;
    await ref.set({type:"group",name:document.getElementById("gname").value.trim(),participants:parts,lastMessage:"",lastTs:Date.now(),createdAt:Date.now(),createdBy:myUid});
    const idx = {}; Object.keys(parts).forEach(u => { idx["fts_dm/userConvs/"+u+"/"+convId]=true; });
    await db.ref().update(idx);
  }
  closeModal();
  await selectConv(convId);
}


function urlBase64ToUint8Array(b64){ const pad='='.repeat((4-b64.length%4)%4); const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/')); const arr=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i); return arr; }
async function getSubscription(){ if(!('serviceWorker' in navigator)) return null; const reg=await navigator.serviceWorker.ready; return reg.pushManager.getSubscription(); }
async function checkNotifStatus(){ const sub=await getSubscription(); updateNotifBtn(!!sub); }
function updateNotifBtn(on){ const btn=document.getElementById('btn-notif'); if(!btn) return; btn.textContent = on ? '🔔 Notifs activées' : '🔕 Activer les notifs'; btn.classList.toggle('on', on); }
async function toggleNotifications(){ const sub=await getSubscription(); if(sub){ await sub.unsubscribe(); fetch(FTS.PUSH.workerUrl+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:myUid})}).catch(()=>{}); updateNotifBtn(false); } else await subscribePush(); }
async function subscribePush(){
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){ alert('Autorise les notifications pour continuer.'); return; }
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(FTS.PUSH.vapidPublicKey)});
    const groups = (me?.group || me?.disciplines?.join(', ') || '').split(',').map(x=>x.trim()).filter(Boolean);
    const subgroups = (me?.subgroup || '').split(',').map(x=>x.trim()).filter(Boolean);
    await fetch(FTS.PUSH.workerUrl+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:myUid, subscription:sub.toJSON(), group:groups.join(', '), subgroup:subgroups.join(', '), groups, subgroups})});
    updateNotifBtn(true);
  }catch(e){ alert('Erreur notifications : '+e.message); }
}
function uniqueUids(list){ return Array.from(new Set((list || []).filter(Boolean))); }
async function getAdminRecipientUids(excludeUid){
  try{
    const snap = await db.ref('fts_users').orderByChild('role').equalTo('admin').once('value');
    const ids = [];
    if(snap.exists()) snap.forEach(child => {
      const u = child.val() || {};
      if(child.key !== excludeUid && u.status === 'active') ids.push(child.key);
    });
    return ids;
  }catch(e){ console.warn('[FTS Messages] Admin recipients', e); return []; }
}
function notifyDirectMessage(convId, convData, recipients, text, msgId){
  if(!recipients || !recipients.length || !FTS.PUSH) return;
  const participants = convData && convData.participants ? convData.participants : {};
  const isGroup = convData && convData.type === 'group';
  const title = isGroup ? ('FTS — ' + (convData.name || 'Groupe privé')) : 'FTS — Message privé';
  const body = (me.name || me.email || 'Membre') + ' : ' + text.substring(0, 90);

  uniqueUids(recipients).forEach(uid => {
    // Double verrou : même si une ancienne liste traîne, on n'envoie jamais à un UID hors participants.
    if(uid === myUid || participants[uid] !== true) return;

    // Le recipientUid est aussi ajouté dans l'URL : si le worker Cloudflare ne conserve pas tous
    // les champs du payload, le service worker peut quand même vérifier le vrai destinataire.
    const url = './messages.html?conv=' + encodeURIComponent(convId)
      + (msgId ? '&msg=' + encodeURIComponent(msgId) : '')
      + '&recipientUid=' + encodeURIComponent(uid);

    fetch(FTS.PUSH.workerUrl+'/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      type:isGroup ? 'dm_group' : 'dm_direct',
      uid,
      expectedUid:uid,
      recipientUid:uid,
      requiresUidMatch:true,
      conversationId:convId,
      msgId,
      title,
      body,
      url,
      senderUid:myUid,
      adminCopy:false,
      forceUid:true,
      tag:'dm-' + convId + '-' + (msgId || Date.now()) + '-' + uid,
      notificationKey:'dm-' + convId + '-' + (msgId || Date.now()) + '-' + uid,
      collapseKey:'dm-' + convId + '-' + uid
    })}).catch(()=>{});
  });
}
function openMessageDeepLink(){
  if(deepLinkHandled || !deepLinkConvId) return;
  deepLinkHandled = true;
  selectConv(deepLinkConvId).then(() => {
    if(deepLinkMsgId){
      setTimeout(() => {
        const el = document.getElementById('msg-' + deepLinkMsgId);
        if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('notif-target'); setTimeout(()=>el.classList.remove('notif-target'), 3500); }
      }, 900);
    }
  });
}

/* ── DATES / HEURES ──────────────────────────────────────────── */
function fmtTs(ts){ return FTSChat.fmtTs(ts); }
function fmtFull(ts){ return FTSChat.fmtFull(ts); }
function fmtDay(ts){ return FTSChat.fmtDay(ts); }
function handleKey(e){ FTSChat.handleEnter(e, sendMessage); }
function autoResize(el){ FTSChat.autoResize(el); }

/* FTS_AUTO_EXTRACTED_HANDLERS:messages.html */
(function(){
  'use strict';
  var handlers = [{"selector": "[data-fts-handler-1]", "event": "click", "code": "openModal()"}, {"selector": "[data-fts-handler-2]", "event": "input", "code": "searchConvs(this.value)"}, {"selector": "[data-fts-handler-3]", "event": "click", "code": "toggleNotifications()"}, {"selector": "[data-fts-handler-4]", "event": "click", "code": "openModal()"}, {"selector": "[data-fts-handler-5]", "event": "click", "code": "closeChat()"}, {"selector": "[data-fts-handler-6]", "event": "click", "code": "deleteCurrentConversation()"}, {"selector": "[data-fts-handler-7]", "event": "keydown", "code": "handleKey(event)"}, {"selector": "[data-fts-handler-8]", "event": "input", "code": "autoResize(this)"}, {"selector": "[data-fts-handler-9]", "event": "click", "code": "sendMessage()"}, {"selector": "[data-fts-handler-10]", "event": "click", "code": "closeModal()"}, {"selector": "[data-fts-handler-11]", "event": "click", "code": "setType('direct')"}, {"selector": "[data-fts-handler-12]", "event": "click", "code": "setType('group')"}, {"selector": "[data-fts-handler-13]", "event": "input", "code": "filterUsers()"}, {"selector": "[data-fts-handler-14]", "event": "click", "code": "closeModal()"}, {"selector": "[data-fts-handler-15]", "event": "click", "code": "startConv()"}];
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
