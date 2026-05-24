/* ================================================================
   FTS-GAMIFICATION.JS — badges XP invisibles, badges temporaires,
   artiste de la semaine, réactions forum.
   ================================================================ */
(function(){
  'use strict';
  if(window.FTSGamification) return;

  const XP_BADGES = [
    { xp:0,    label:'🌱 Nouveau talent' },
    { xp:50,   label:'✨ En scène' },
    { xp:100,  label:'🎭 Artiste' },
    { xp:150,  label:'🌟 Artiste engagé' },
    { xp:200,  label:'👏 Performer' },
    { xp:300,  label:'🔥 Talent confirmé' },
    { xp:500,  label:'🎬 Star montante' },
    { xp:700,  label:'💎 Artiste premium' },
    { xp:1000, label:'🏆 Pilier FTS' },
    { xp:1500, label:'👑 Icône FTS' }
  ];

  const RARE_BADGES = [
    '🎤 Voix d’or',
    '🎭 Impro master',
    '❤️ Esprit d’équipe',
    '🌟 Super présence',
    '🎬 Star de scène',
    '👏 Coup de cœur prof'
  ];

  const REACTIONS = ['❤️','🔥','👏','😂','🎭','🎤'];

  function now(){
    return Date.now();
  }

  function dayKey(ts){
    const d = new Date(ts || now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function esc(s){
    return (window.FTS && FTS.esc)
      ? FTS.esc(s)
      : String(s || '').replace(/[&<>'"]/g, c => ({
          '&':'&amp;',
          '<':'&lt;',
          '>':'&gt;',
          "'":'&#039;',
          '"':'&quot;'
        }[c]));
  }

  function getXpBadge(xp){
    xp = Number(xp || 0);
    let badge = XP_BADGES[0];

    for(const b of XP_BADGES){
      if(xp >= b.xp) badge = b;
      else break;
    }

    return badge;
  }

  function isActiveTimed(obj){
    return !!(
      obj &&
      obj.label &&
      (!obj.until || Number(obj.until) > now())
    );
  }

  function getPublicBadge(user, artistOfWeek){
    user = user || {};

    if(
      artistOfWeek &&
      artistOfWeek.uid &&
      artistOfWeek.uid === user.uid &&
      isActiveTimed(artistOfWeek)
    ){
      return {
        label: artistOfWeek.label || '⭐ Artiste de la semaine',
        kind: 'artist'
      };
    }

    if(isActiveTimed(user.specialBadge)){
      return {
        label: user.specialBadge.label,
        kind: user.specialBadge.kind || user.specialBadge.type || 'rare'
      };
    }

    return {
      label: getXpBadge(user.xp).label,
      kind: 'xp'
    };
  }

  function renderBadge(label, kind){
    return `<span class="fts-public-badge fts-public-badge--${esc(kind || 'xp')}">${esc(label || getXpBadge(0).label)}</span>`;
  }

  function publicName(user){
    return (
      user &&
      (
        user.name ||
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        user.email
      )
    ) || 'Un membre';
  }

  async function getActiveForumRecipients(db, excludeUid){
    const out = [];
    if(!db) return out;
    const excluded = String(excludeUid || '').trim();
    try{
      const snap = await FTS.activePublicProfilesRef(db).once('value');
      snap.forEach(child => {
        if(!child.key) return;
        if(excluded && child.key === excluded) return;
        out.push(child.key);
      });
    }catch(e){
      console.warn('[FTS Gamification] destinataires forum général indisponibles:', e);
    }
    return out;
  }

  function shouldNotifySenderForForumSystemMessage(msg){
    return !!(msg && (msg.system === true || msg.gamification === true || msg.notifyAll === true || msg.type === 'special_badge' || msg.type === 'artist_of_week' || msg.type === 'xp_level'));
  }

  async function primeForumUnreadForRecipients(db, recipients, channel, messageTs){
    if(!db || !Array.isArray(recipients) || !recipients.length || !channel || !messageTs) return;
    const baseline = Math.max(0, Number(messageTs || now()) - 1);
    await Promise.allSettled(recipients.map(uid => {
      const ref = db.ref('fts_users/' + uid + '/forumReads/' + channel);
      return ref.transaction(current => {
        const existing = Number((current && current.ts) || current || 0);
        // Si l'utilisateur a déjà une lecture plus récente, on ne touche à rien.
        if(existing && existing >= baseline) return current;
        // Si aucune lecture n'existe, on crée un point de départ juste avant le message.
        if(!existing) return { ts: baseline };
        return current;
      }).catch(() => null);
    }));
  }

  async function notifyGeneralForumMessage(db, msg, msgId){
    if(!db || !msgId || !msg) return;

    const senderUid = String(msg.uid || '').trim();
    const includeSender = shouldNotifySenderForForumSystemMessage(msg);
    const recipients = await getActiveForumRecipients(db, includeSender ? '' : senderUid);
    if(!recipients.length) return;

    const text = String(msg.text || 'Nouvelle annonce Fais Ton Show');
    const body = text.length > 110 ? text.slice(0, 107) + '…' : text;
    const url = './forum.html?channel=general&msg=' + encodeURIComponent(msgId);
    const notificationKey = 'forum-general-' + msgId;

    // Trace/inbox Firebase : confort uniquement, jamais bloquant.
    try{
      const fanout = {};
      recipients.forEach(uid => {
        const nref = db.ref('fts_user_notifications/' + uid).push();
        fanout['fts_user_notifications/' + uid + '/' + nref.key] = {
          type: 'forum',
          channel: 'general',
          title: 'FTS — Forum',
          body,
          url,
          msgId,
          senderUid,
          notificationKey,
          read: false,
          createdAt: now()
        };
      });
      db.ref().update(fanout).catch(() => {});
      primeForumUnreadForRecipients(db, recipients, 'general', Number(msg.ts || now())).catch(() => {});
      db.ref('fts_debug_notifications/' + notificationKey).set({
        type: 'forum',
        channel: 'general',
        msgId,
        senderUid,
        recipientCount: recipients.length,
        recipients,
        createdAt: now()
      }).catch(() => {});
    }catch(e){}

    // Push réelle : même logique que forum.js, forcée par UID.
    if(window.FTS && FTS.PUSH && FTS.PUSH.workerUrl && window.fetch){
      Promise.allSettled(recipients.map(uid =>
        fetch(FTS.PUSH.workerUrl + '/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'forum',
            channel: 'general',
            title: 'FTS — Forum',
            body,
            url,
            msgId,
            senderUid,
            uid,
            uids: [uid],
            recipientUids: [uid],
            recipients: [uid],
            forceUid: true,
            tag: notificationKey + '-' + uid,
            collapseKey: notificationKey + '-' + uid
          })
        }).catch(() => {})
      )).catch(() => {});
    }
  }

  async function notifyRewardRecipient(db, targetUid, title, body, url, meta){
    if(!db || !targetUid) return;
    meta = meta || {};
    const uid = String(targetUid || '').trim();
    if(!uid) return;
    const ts = now();
    const keyBase = String(meta.notificationKey || ('reward-' + uid + '-' + ts)).replace(/[^a-zA-Z0-9_-]/g, '-');

    try{
      const nref = db.ref('fts_user_notifications/' + uid).push();
      await nref.set({
        type: meta.type || 'reward',
        title: title || 'FTS — Récompense',
        body: body || 'Tu as reçu une nouvelle récompense Fais Ton Show.',
        url: url || './forum.html?channel=general',
        targetUid: uid,
        badge: meta.badge || '',
        reason: meta.reason || '',
        read: false,
        createdAt: ts
      }).catch(() => null);
    }catch(e){}

    try{
      db.ref('fts_debug_notifications/' + keyBase).set({
        type: meta.type || 'reward',
        targetUid: uid,
        title: title || 'FTS — Récompense',
        body: body || '',
        createdAt: ts
      }).catch(() => {});
    }catch(e){}

    if(window.FTS && FTS.PUSH && FTS.PUSH.workerUrl && window.fetch){
      const endpoint = String(FTS.PUSH.workerUrl || '').replace(/\/+$/, '') + '/notify';
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: meta.type || 'reward',
          title: title || 'FTS — Récompense',
          body: body || 'Tu as reçu une nouvelle récompense Fais Ton Show.',
          url: url || './forum.html?channel=general',
          targetUid: uid,
          uid,
          uids: [uid],
          recipientUids: [uid],
          recipients: [uid],
          forceUid: true,
          tag: keyBase,
          collapseKey: keyBase
        })
      }).catch(() => {});
    }
  }

  async function pushGeneralMessage(db, text, extra){
    if(!db || !text) return null;

    const msg = Object.assign({
      uid: 'system',
      name: 'Fais Ton Show',
      text: String(text),
      ts: now(),
      system: true
    }, extra || {});

    const ref = await db.ref('fts_forum/messages/general').push(msg);

    // Le message automatique doit se comporter comme un vrai message du forum général :
    // il déclenche aussi les notifications et les compteurs non lus. Non bloquant.
    notifyGeneralForumMessage(db, msg, ref && ref.key).catch(() => {});

    return ref;
  }

  async function writeRewardHistory(db, payload){
    if(!db || !payload) return null;

    const item = Object.assign({
      ts: now()
    }, payload || {});

    // Historique confort : ne doit jamais bloquer.
    return db.ref('fts_forum/rewardHistory')
      .push(item)
      .catch(() => null);
  }

  async function clearSpecialBadge(db, targetUid, clearedBy){
    if(!db || !targetUid) return false;

    // Seule action obligatoire : retirer le badge visible.
    await db.ref(`fts_forum/users/${targetUid}/specialBadge`).remove();

    // Tout le reste est NON BLOQUANT pour éviter les permission_denied visibles.
    db.ref(`fts_users/${targetUid}/specialBadge`)
      .remove()
      .catch(() => {});

    writeRewardHistory(db, {
      type: 'cleared',
      targetUid,
      assignedBy: clearedBy || ''
    }).catch(() => {});

    return true;
  }

  async function extendSpecialBadge(db, targetUid, days, assignedBy){
    if(!db || !targetUid) return false;

    const badgeRef = db.ref(`fts_forum/users/${targetUid}/specialBadge`);
    const snap = await badgeRef.once('value');
    const current = snap.val();

    if(!current || !current.label){
      throw new Error('Aucun badge temporaire actif à prolonger.');
    }

    const base = Math.max(Number(current.until || 0), now());
    const until = base + Math.max(1, Number(days || 7)) * 86400000;

    const payload = Object.assign({}, current, {
      until,
      extendedBy: assignedBy || '',
      extendedAt: now()
    });

    await badgeRef.set(payload);

    db.ref(`fts_users/${targetUid}/specialBadge`)
      .set(payload)
      .catch(() => {});

    writeRewardHistory(db, {
      type: 'extended',
      targetUid,
      label: payload.label,
      until,
      assignedBy: assignedBy || ''
    }).catch(() => {});

    return true;
  }

  async function awardXp(db, targetUid, action, points, options){
    options = options || {};

    if(!db || !targetUid || !points){
      return { ok:false, reason:'missing' };
    }

    const today = dayKey();
    const maxPerDay = Number(options.maxPerDay || 0);
    const logKey = String(action || 'action').replace(/[.#$\[\]/]/g, '_');
    const logRef = db.ref(`fts_forum/users/${targetUid}/xpLog/${today}/${logKey}`);

    let allowed = true;

    if(maxPerDay > 0){
      await logRef.transaction(v => {
        v = Number(v || 0);

        if(v >= maxPerDay){
          allowed = false;
          return;
        }

        return v + 1;
      });
    }

    if(!allowed){
      return { ok:false, reason:'limited' };
    }

    const userRef = db.ref(`fts_forum/users/${targetUid}`);

    let before = 0;
    let after = 0;

    await userRef.child('xp').transaction(v => {
      before = Number(v || 0);
      after = before + Number(points || 0);
      return after;
    });

    const updates = {};
    updates[`fts_users/${targetUid}/xp`] = after;
    updates[`fts_users/${targetUid}/xpUpdatedAt`] = now();
    updates[`fts_forum/users/${targetUid}/xpUpdatedAt`] = now();

    await db.ref().update(updates).catch(() => {});

    db.ref(`fts_forum/users/${targetUid}/stats/${logKey}`)
      .transaction(v => Number(v || 0) + 1)
      .catch(() => {});

    db.ref(`fts_users/${targetUid}/stats/${logKey}`)
      .transaction(v => Number(v || 0) + 1)
      .catch(() => {});

    const oldBadge = getXpBadge(before).label;
    const newBadge = getXpBadge(after).label;

    if(oldBadge !== newBadge){
      const snap = await db.ref(`fts_forum/users/${targetUid}`)
        .once('value')
        .catch(() => null);

      const u = snap && snap.val ? snap.val() : {};

      await pushGeneralMessage(
        db,
        `🎉 Nouveau cap franchi pour ${publicName(u)} dans la communauté Fais Ton Show !`,
        {
          gamification: true,
          type: 'xp_level',
          targetUid
        }
      ).catch(() => {});
    }

    return { ok:true, before, after };
  }

  async function setSpecialBadge(db, targetUid, badgeLabel, days, assignedBy, reason, options){
    if(!db || !targetUid || !badgeLabel){
      throw new Error('Badge ou membre introuvable.');
    }

    const until = now() + Math.max(1, Number(days || 7)) * 86400000;
    options = options || {};
    const publicTargetName = String(options.publicName || options.childName || '').trim();

    const payload = {
      label: badgeLabel,
      until,
      assignedBy: assignedBy || '',
      reason: reason || '',
      ts: now()
    };

    // Si la récompense concerne un enfant rattaché à un compte parent,
    // on garde son nom dans le badge pour l'affichage admin/prof/forum.
    if (publicTargetName) payload.publicName = publicTargetName;
    if (options.childName) payload.childName = String(options.childName).trim();
    if (options.childId) payload.childId = String(options.childId).trim();

    // Écriture principale obligatoire.
    await db.ref(`fts_forum/users/${targetUid}/specialBadge`).set(payload);

    // Écritures secondaires non bloquantes.
    db.ref(`fts_users/${targetUid}/specialBadge`)
      .set(payload)
      .catch(() => {});

    const snap = await db.ref(`fts_forum/users/${targetUid}`)
      .once('value')
      .catch(() => null);

    const u = snap && snap.val ? snap.val() : {};
    const displayTargetName = publicTargetName || publicName(u);

    writeRewardHistory(db, {
      type: 'special_badge',
      targetUid,
      label: badgeLabel,
      until,
      assignedBy: assignedBy || '',
      reason: reason || '',
      name: displayTargetName
    }).catch(() => {});

    pushGeneralMessage(
      db,
      `🌟 ${displayTargetName} reçoit le badge temporaire « ${badgeLabel} » !`,
      {
        // Important : les rules Firebase du forum exigent uid === auth.uid pour un prof.
        // On publie donc le message automatique avec l'uid du prof/admin qui attribue.
        uid: assignedBy || targetUid,
        name: 'Fais Ton Show',
        system: true,
        gamification: true,
        type: 'special_badge',
        notifyAll: true,
        targetUid
      }
    ).catch(() => {});

    notifyRewardRecipient(
      db,
      targetUid,
      'FTS — Nouveau badge 🏅',
      `${displayTargetName} reçoit le badge « ${badgeLabel} » !`,
      './forum.html?channel=general',
      { type: 'special_badge', badge: badgeLabel, reason, notificationKey: 'reward-special-badge-' + targetUid + '-' + now() }
    ).catch(() => {});

    awardXp(db, targetUid, 'special_badge_received', 30, {
      maxPerDay: 2
    }).catch(() => {});

    return true;
  }

  async function setArtistOfWeek(db, targetUid, assignedBy, text, days, options){
    if(!db || !targetUid){
      throw new Error('Membre introuvable.');
    }

    const until = now() + Math.max(1, Number(days || 7)) * 86400000;
    options = options || {};
    const publicTargetName = String(options.publicName || options.childName || '').trim();

    const payload = {
      label: '⭐ Artiste de la semaine',
      until,
      assignedBy: assignedBy || '',
      reason: text || '',
      ts: now()
    };

    // Même logique pour l'artiste de la semaine : si c'est un enfant,
    // l'admin/prof doit voir le nom de l'enfant et pas seulement le parent.
    if (publicTargetName) payload.publicName = publicTargetName;
    if (options.childName) payload.childName = String(options.childName).trim();
    if (options.childId) payload.childId = String(options.childId).trim();

    // ÉCRITURE PRINCIPALE UNIQUE ET OBLIGATOIRE.
    // Même chemin que les badges temporaires.
    await db.ref(`fts_forum/users/${targetUid}/specialBadge`).set(payload);

    // Tout le reste est non bloquant.
    db.ref(`fts_forum/users/${targetUid}`)
      .once('value')
      .then(snap => {
        const u = snap && snap.val ? (snap.val() || {}) : {};
        const displayTargetName = publicTargetName || publicName(u);

        db.ref(`fts_users/${targetUid}/specialBadge`)
          .set(payload)
          .catch(() => {});

        db.ref('fts_community/artistOfWeek')
          .set(Object.assign({
            uid: targetUid,
            kind: 'artist',
            name: displayTargetName,
            text: text || ''
          }, payload))
          .catch(() => {});

        writeRewardHistory(db, {
          type: 'artist_of_week',
          targetUid,
          label: payload.label,
          until,
          assignedBy: assignedBy || '',
          reason: text || '',
          name: displayTargetName
        }).catch(() => {});

        pushGeneralMessage(
          db,
          `🎉 Bravo à ${displayTargetName} qui devient Artiste de la semaine !`,
          {
            // Important : les rules Firebase du forum exigent uid === auth.uid pour un prof.
            // On publie donc le message automatique avec l'uid du prof/admin qui attribue.
            uid: assignedBy || targetUid,
            name: 'Fais Ton Show',
            system: true,
            gamification: true,
            type: 'artist_of_week',
            notifyAll: true,
            targetUid
          }
        ).catch(() => {});

        notifyRewardRecipient(
          db,
          targetUid,
          'FTS — Artiste de la semaine ⭐',
          `${displayTargetName} devient Artiste de la semaine !`,
          './forum.html?channel=general',
          { type: 'artist_of_week', badge: '⭐ Artiste de la semaine', reason: text || '', notificationKey: 'reward-artist-of-week-' + targetUid + '-' + now() }
        ).catch(() => {});

        awardXp(db, targetUid, 'artist_of_week', 100, {
          maxPerDay: 1
        }).catch(() => {});
      })
      .catch(() => {});

    return true;
  }

  window.FTSGamification = {
    XP_BADGES,
    RARE_BADGES,
    REACTIONS,
    getXpBadge,
    getPublicBadge,
    renderBadge,
    awardXp,
    setSpecialBadge,
    setArtistOfWeek,
    clearSpecialBadge,
    extendSpecialBadge,
    pushGeneralMessage,
    writeRewardHistory,
    isActiveTimed
  };

})();
