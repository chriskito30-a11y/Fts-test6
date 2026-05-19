/* ================================================================
   FTS REMINDER DISPATCHER SERVICE — Envoi natif admin des rappels
   - Démarre uniquement si un admin est connecté
   - Cherche les rappels pending dont sendAt est passé
   - Crée un MP bot + unread + push, puis passe le rappel en sent
   - Anti-doublon via transaction status pending -> dispatching
   ================================================================ */
(function(window){
  'use strict';
  if(window.FTSReminderDispatcherLoaded) return;
  window.FTSReminderDispatcherLoaded = true;

  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};

  const POLL_MS = 60 * 1000;
  const INITIAL_DELAY_MS = 2500;
  const BATCH_LIMIT = 8;
  const LOCK_TTL_MS = 2 * 60 * 1000;
  const LOG_LIMIT = 40;
  const BOT_NAME = '🤖 Rappel automatique FTS';
  const BOT_LABEL = 'Rappel automatique Fais Ton Show';

  let db = null;
  let auth = null;
  let timer = null;
  let running = false;
  let started = false;
  let adminUser = null;
  let adminProfile = null;
  let lastRunAt = 0;

  function setAdminIndicator(state, text){
    try{
      const detail = { state: state || 'idle', text: text || '' };
      window.dispatchEvent(new CustomEvent('fts:reminder-dispatcher-state', { detail }));
      const el = document.getElementById('dispatch-status');
      if(el && text) el.textContent = text;
      if(el && state) el.setAttribute('data-state', state);
    }catch(e){}
  }

  function getDb(){
    if(db) return db;
    if(!window.FTS || !FTS.initFirebase) return null;
    db = FTS.initFirebase();
    return db;
  }

  function norm(v){
    return window.FTS && FTS.norm ? FTS.norm(v || '') : String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function asArray(v){
    if(!v) return [];
    if(Array.isArray(v)) return v.filter(Boolean);
    if(typeof v === 'object') return Object.values(v).filter(Boolean);
    return String(v).split(',').map(x => x.trim()).filter(Boolean);
  }

  function profileName(u){
    if(!u) return 'Membre';
    return u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email || 'Membre';
  }

  function directConvId(a, b){
    return [String(a || ''), String(b || '')].sort().join('_');
  }

  function isOnline(){ return typeof navigator === 'undefined' || navigator.onLine !== false; }

  function scheduleNext(delay){
    clearTimeout(timer);
    timer = setTimeout(runOnce, delay || POLL_MS);
  }

  function shouldTargetProfile(profile, reminder){
    if(!profile || profile.status !== 'active') return false;
    if(profile.role === 'admin') return false;

    const targetCat = norm(reminder.targetCategory || reminder.category || '');
    const targetSub = norm(reminder.targetSubcategory || reminder.subcategory || '');
    if(!targetCat && !targetSub) return false;

    const cats = asArray(profile.disciplines || profile.group || profile.groups || profile.categories).map(norm);
    const subs = asArray(profile.subgroups || profile.subgroup || profile.subcategories || profile.subcategory).map(norm);

    let catOk = !targetCat || cats.includes(targetCat);
    let subOk = !targetSub || subs.includes(targetSub);

    if(Array.isArray(profile.enfants)){
      profile.enfants.forEach(child => {
        const childCats = asArray(child && (child.disciplines || child.group || child.groups || child.categories)).map(norm);
        const childSubs = asArray(child && (child.subgroups || child.subgroup || child.subcategories || child.subcategory)).map(norm);
        if(targetCat && childCats.includes(targetCat)) catOk = true;
        if(targetSub && childSubs.includes(targetSub)) subOk = true;
      });
    }

    return catOk && subOk;
  }

  async function resolveRecipients(reminder){
    const database = getDb();
    if(!database) return [];

    if(reminder.uid){
      const snap = await database.ref('fts_users/' + reminder.uid).once('value');
      const profile = snap.val() || {};
      if(profile.status && profile.status !== 'active') return [];
      return [{ uid: reminder.uid, profile }];
    }

    const snap = await database.ref('fts_users').once('value');
    const all = snap.val() || {};
    return Object.entries(all)
      .filter(([,profile]) => shouldTargetProfile(profile, reminder))
      .map(([uid, profile]) => ({ uid, profile }));
  }

  async function claimReminder(id, reminder){
    const database = getDb();
    const now = Date.now();
    const ref = database.ref('fts_scheduled_reminders/' + id);
    const res = await ref.transaction(current => {
      if(!current) return;
      const status = current.status || 'standby';
      const sendAt = Number(current.sendAt || 0);
      const lockAt = Number(current.dispatchLockAt || 0);
      const staleLock = status === 'dispatching' && lockAt && (now - lockAt > LOCK_TTL_MS);
      if(status !== 'pending' && !staleLock) return;
      if(sendAt > now) return;
      if(current.sentAt || current.dispatchedAt) return;
      current.status = 'dispatching';
      current.dispatchLockAt = now;
      current.dispatchLockBy = adminUser ? adminUser.uid : 'admin';
      current.updatedAt = now;
      return current;
    }, undefined, false);
    return !!res.committed;
  }

  async function sendBotDm(reminderId, reminder, recipient){
    const database = getDb();
    const adminUid = adminUser && adminUser.uid;
    if(!adminUid) throw new Error('Admin introuvable');
    const uid = recipient.uid;
    const convId = directConvId(adminUid, uid);
    const now = Date.now();
    const text = reminder.body || reminder.title || 'Rappel automatique Fais Ton Show';
    const participants = {}; participants[adminUid] = true; participants[uid] = true;

    const convRef = database.ref('fts_dm/conversations/' + convId);
    const convSnap = await convRef.once('value');
    if(!convSnap.exists()){
      await convRef.set({
        type:'direct',
        participants,
        lastMessage:'',
        lastTs:now,
        createdAt:now,
        createdBy:adminUid,
        autoReminder:true
      });
    }else{
      await convRef.child('participants').update(participants);
    }

    const msgRef = database.ref('fts_dm/messages/' + convId).push();
    const msgId = msgRef.key;
    await msgRef.set({
      id: msgId,
      senderId: adminUid,
      senderName: BOT_NAME,
      text,
      ts: now,
      auto: true,
      bot: true,
      botLabel: reminder.botLabel || BOT_LABEL,
      messageType: 'auto-reminder',
      reminderId,
      reminderKind: reminder.kind || '',
      eventAt: reminder.eventAt || 0,
      reminderOffsetMinutes: reminder.reminderOffsetMinutes || 0
    });

    const unreadSnap = await database.ref('fts_dm/conversations/' + convId + '/unread/' + uid).once('value');
    const currentUnread = Number(unreadSnap.val() || 0);
    const updates = {};
    updates['fts_dm/conversations/' + convId + '/lastMessage'] = '🤖 ' + String(text).replace(/\s+/g, ' ').substring(0, 76);
    updates['fts_dm/conversations/' + convId + '/lastSenderName'] = BOT_NAME;
    updates['fts_dm/conversations/' + convId + '/lastTs'] = now;
    updates['fts_dm/conversations/' + convId + '/unread/' + uid] = currentUnread + 1;
    updates['fts_dm/conversations/' + convId + '/unread/' + adminUid] = 0;
    updates['fts_dm/userConvs/' + adminUid + '/' + convId] = true;
    updates['fts_dm/userConvs/' + uid + '/' + convId] = true;
    await database.ref().update(updates);

    await sendPush(uid, convId, msgId, text, reminderId);
    return { uid, convId, msgId };
  }

  async function sendPush(uid, convId, msgId, text, reminderId){
    if(!window.FTS || !FTS.PUSH || !FTS.PUSH.workerUrl || !window.fetch) return;
    const payload = {
      type:'dm_direct',
      uid,
      expectedUid:uid,
      recipientUid:uid,
      requiresUidMatch:true,
      conversationId:convId,
      msgId,
      title:'FTS — Rappel automatique',
      body:String(text || '').replace(/\s+/g, ' ').substring(0, 120),
      url:'./messages.html?conv=' + encodeURIComponent(convId) + '&msg=' + encodeURIComponent(msgId) + '&recipientUid=' + encodeURIComponent(uid),
      senderUid:adminUser ? adminUser.uid : '',
      adminCopy:false,
      forceUid:true,
      autoReminder:true,
      reminderId,
      tag:'dm-' + convId + '-' + msgId + '-' + uid,
      notificationKey:'dm-' + convId + '-' + msgId + '-' + uid,
      collapseKey:'dm-' + convId + '-' + uid
    };
    await fetch(FTS.PUSH.workerUrl + '/notify', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    }).catch(() => {});
  }

  async function finalizeReminder(id, sentRows){
    const database = getDb();
    const now = Date.now();
    const sentTo = {};
    const convs = {};
    const msgs = {};
    sentRows.forEach(row => {
      sentTo[row.uid] = true;
      convs[row.uid] = row.convId;
      msgs[row.uid] = row.msgId;
    });
    await database.ref('fts_scheduled_reminders/' + id).update({
      status:'sent',
      sentAt:now,
      dispatchedAt:now,
      dispatchedBy:adminUser ? adminUser.uid : '',
      dispatchLockAt:null,
      dispatchLockBy:null,
      dispatchRecipientCount:sentRows.length,
      dispatchSentTo:sentTo,
      dispatchConversations:convs,
      dispatchMessages:msgs,
      updatedAt:now
    });
  }

  async function failReminder(id, message){
    const database = getDb();
    await database.ref('fts_scheduled_reminders/' + id).update({
      status:'pending',
      dispatchLockAt:null,
      dispatchLockBy:null,
      dispatchError:String(message || 'Erreur dispatch').substring(0, 240),
      dispatchErrorAt:Date.now(),
      updatedAt:Date.now()
    });
  }

  async function logRun(payload){
    const database = getDb();
    if(!database) return;
    const ref = database.ref('fts_admin_dispatch_logs').push();
    await ref.set(Object.assign({ id:ref.key, ts:Date.now(), adminUid:adminUser ? adminUser.uid : '' }, payload || {})).catch(()=>{});
  }

  async function trimLogs(){
    const database = getDb();
    if(!database) return;
    const snap = await database.ref('fts_admin_dispatch_logs').orderByChild('ts').once('value').catch(()=>null);
    if(!snap) return;
    const val = snap.val() || {};
    const rows = Object.entries(val).sort((a,b)=>(a[1].ts||0)-(b[1].ts||0));
    if(rows.length <= LOG_LIMIT) return;
    const updates = {};
    rows.slice(0, rows.length - LOG_LIMIT).forEach(([id]) => updates['fts_admin_dispatch_logs/' + id] = null);
    await database.ref().update(updates).catch(()=>{});
  }

  async function processReminder(id, reminder){
    const claimed = await claimReminder(id, reminder);
    if(!claimed) return { skipped:true };
    try{
      const recipients = await resolveRecipients(reminder);
      if(!recipients.length) throw new Error('Aucun destinataire actif trouvé');
      const sentRows = [];
      for(const recipient of recipients){
        sentRows.push(await sendBotDm(id, reminder, recipient));
      }
      await finalizeReminder(id, sentRows);
      return { sent:true, count:sentRows.length };
    }catch(e){
      await failReminder(id, e && e.message ? e.message : e);
      return { error:true, message:e && e.message ? e.message : String(e || 'Erreur') };
    }
  }

  async function runOnce(){
    clearTimeout(timer);
    if(!started || running || !adminUser || !isOnline()){
      if(!adminUser) setAdminIndicator('inactive', 'Dispatcher inactif : admin non confirmé');
      if(!isOnline()) setAdminIndicator('offline', 'Dispatcher en pause : hors ligne');
      scheduleNext(POLL_MS);
      return;
    }
    setAdminIndicator('active', 'Rappels automatiques actifs');
    const now = Date.now();
    if(now - lastRunAt < 15000){ scheduleNext(POLL_MS); return; }
    lastRunAt = now;
    running = true;
    let checked = 0, sent = 0, recipients = 0, errors = 0;
    try{
      const database = getDb();
      const snap = await database.ref('fts_scheduled_reminders').orderByChild('status').equalTo('pending').once('value');
      const due = Object.entries(snap.val() || {})
        .filter(([,r]) => r && Number(r.sendAt || 0) <= Date.now() && !r.sentAt && r.status === 'pending')
        .sort((a,b)=>(a[1].sendAt||0)-(b[1].sendAt||0))
        .slice(0, BATCH_LIMIT);
      checked = due.length;
      for(const [id, reminder] of due){
        const res = await processReminder(id, reminder);
        if(res && res.sent){ sent++; recipients += res.count || 0; }
        if(res && res.error) errors++;
      }
      if(checked || sent || errors){
        await logRun({ checked, sent, recipients, errors, mode:'native-admin' });
        trimLogs();
        notifyStatus({ checked, sent, recipients, errors });
      }
    }catch(e){
      errors++;
      await logRun({ checked, sent, recipients, errors, mode:'native-admin', error:String(e && e.message ? e.message : e).substring(0,240) });
      notifyStatus({ checked, sent, recipients, errors });
    }finally{
      running = false;
      scheduleNext(POLL_MS);
    }
  }

  function notifyStatus(detail){
    try{ window.dispatchEvent(new CustomEvent('fts:reminder-dispatcher-status', { detail })); }catch(e){}
  }

  function start(){
    if(started) return;
    const database = getDb();
    if(!database || !window.firebase || !firebase.auth){
      setAdminIndicator('inactive', 'Dispatcher inactif : Firebase non prêt');
      return;
    }
    started = true;
    setAdminIndicator('booting', 'Initialisation des rappels automatiques…');
    auth = firebase.auth();
    auth.onAuthStateChanged(async user => {
      clearTimeout(timer);
      adminUser = null;
      adminProfile = null;
      if(!user) return;
      try{
        const snap = await database.ref('fts_users/' + user.uid).once('value');
        const profile = snap.val();
        if(!profile || profile.role !== 'admin'){
          setAdminIndicator('inactive', 'Dispatcher inactif : profil non admin');
          return;
        }
        adminUser = user;
        adminProfile = profile;
        setAdminIndicator('active', 'Rappels automatiques actifs');
        logRun({ mode:'native-admin', event:'boot', page:location.pathname.split('/').pop() || 'admin' });
        scheduleNext(INITIAL_DELAY_MS);
      }catch(e){
        setAdminIndicator('error', 'Dispatcher inactif : accès Firebase refusé');
        logRun({ mode:'native-admin', event:'boot-error', error:String(e && e.message ? e.message : e).substring(0,240) });
      }
    });
    window.addEventListener('online', () => scheduleNext(2500));
    document.addEventListener('visibilitychange', () => {
      if(!document.hidden) scheduleNext(3000);
    });
  }

  S.ReminderDispatcher = { start, runOnce };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);
})(window);
