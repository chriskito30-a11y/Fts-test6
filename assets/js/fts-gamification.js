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
    '🎤 Voix d’or', '🎭 Impro master', '❤️ Esprit d’équipe',
    '🌟 Super présence', '🎬 Star de scène', '👏 Coup de cœur prof'
  ];
  const REACTIONS = ['❤️','🔥','👏','😂','🎭','🎤'];

  function now(){ return Date.now(); }
  function dayKey(ts){
    const d = new Date(ts || now());
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function esc(s){ return (window.FTS && FTS.esc) ? FTS.esc(s) : String(s||'').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
  function getXpBadge(xp){
    xp = Number(xp || 0);
    let badge = XP_BADGES[0];
    for(const b of XP_BADGES){ if(xp >= b.xp) badge = b; else break; }
    return badge;
  }
  function isActiveTimed(obj){ return !!(obj && obj.label && (!obj.until || Number(obj.until) > now())); }
  function getPublicBadge(user, artistOfWeek){
    user = user || {};
    if(artistOfWeek && artistOfWeek.uid && artistOfWeek.uid === user.uid && isActiveTimed(artistOfWeek)){
      return { label: artistOfWeek.label || '⭐ Artiste de la semaine', kind:'artist' };
    }
    if(isActiveTimed(user.specialBadge)){
      const lbl = String(user.specialBadge.label || '');
      const k = user.specialBadge.kind || user.specialBadge.type || (lbl.includes('Artiste de la semaine') ? 'artist' : 'rare');
      return { label:user.specialBadge.label, kind:k };
    }
    return { label:getXpBadge(user.xp).label, kind:'xp' };
  }
  function renderBadge(label, kind){
    return `<span class="fts-public-badge fts-public-badge--${esc(kind || 'xp')}">${esc(label || getXpBadge(0).label)}</span>`;
  }
  function publicName(user){
    return (user && (user.name || [user.firstName,user.lastName].filter(Boolean).join(' ') || user.email)) || 'Un membre';
  }
  async function pushGeneralMessage(db, text, extra){
    if(!db || !text) return null;
    const msg = Object.assign({
      uid:'system', name:'Fais Ton Show', text:String(text), ts:now(), system:true
    }, extra || {});
    return db.ref('fts_forum/messages/general').push(msg);
  }

  async function writeRewardHistory(db, payload){
    if(!db || !payload) return null;
    const item = Object.assign({ ts:now() }, payload || {});
    // Historique confort : ne doit jamais bloquer l'attribution si les rules refusent.
    return db.ref('fts_forum/rewardHistory').push(item).catch(()=>null);
  }

  async function clearSpecialBadge(db, targetUid, clearedBy){
    if(!db || !targetUid) return;
    await db.ref(`fts_forum/users/${targetUid}/specialBadge`).remove();
    db.ref(`fts_users/${targetUid}/specialBadge`).remove().catch(()=>{});
    await writeRewardHistory(db, { type:'cleared', targetUid, assignedBy:clearedBy || '' });
  }

  async function extendSpecialBadge(db, targetUid, days, assignedBy){
    if(!db || !targetUid) return;
    const ref = db.ref(`fts_forum/users/${targetUid}/specialBadge`);
    const snap = await ref.once('value');
    const current = snap.val();
    if(!current || !current.label) throw new Error('Aucun badge temporaire actif à prolonger.');
    const base = Math.max(Number(current.until || 0), now());
    const until = base + Math.max(1, Number(days || 7)) * 86400000;
    const payload = Object.assign({}, current, { until, extendedBy:assignedBy || '', extendedAt:now() });
    await ref.set(payload);
    db.ref(`fts_users/${targetUid}/specialBadge`).set(payload).catch(()=>{});
    await writeRewardHistory(db, { type:'extended', targetUid, label:payload.label, until, assignedBy:assignedBy || '' });
  }
  async function awardXp(db, targetUid, action, points, options){
    options = options || {};
    if(!db || !targetUid || !points) return { ok:false, reason:'missing' };
    const today = dayKey();
    const maxPerDay = Number(options.maxPerDay || 0);
    const logKey = String(action || 'action').replace(/[.#$\[\]/]/g, '_');
    const logRef = db.ref(`fts_forum/users/${targetUid}/xpLog/${today}/${logKey}`);
    let allowed = true;
    if(maxPerDay > 0){
      await logRef.transaction(v => {
        v = Number(v || 0);
        if(v >= maxPerDay){ allowed = false; return; }
        return v + 1;
      });
    }
    if(!allowed) return { ok:false, reason:'limited' };

    const userRef = db.ref('fts_forum/users/' + targetUid);
    let before = 0, after = 0;
    await userRef.child('xp').transaction(v => {
      before = Number(v || 0);
      after = before + Number(points || 0);
      return after;
    });
    const updates = {};
    updates[`fts_users/${targetUid}/xp`] = after;
    updates[`fts_users/${targetUid}/xpUpdatedAt`] = now();
    updates[`fts_forum/users/${targetUid}/xpUpdatedAt`] = now();
    await db.ref().update(updates).catch(()=>{});
    db.ref(`fts_forum/users/${targetUid}/stats/${logKey}`).transaction(v => Number(v || 0) + 1).catch(()=>{});
    db.ref(`fts_users/${targetUid}/stats/${logKey}`).transaction(v => Number(v || 0) + 1).catch(()=>{});

    const oldBadge = getXpBadge(before).label;
    const newBadge = getXpBadge(after).label;
    if(oldBadge !== newBadge){
      const snap = await db.ref('fts_forum/users/' + targetUid).once('value').catch(()=>null);
      const u = snap && snap.val ? snap.val() : {};
      await pushGeneralMessage(db, `🎉 Nouveau cap franchi pour ${publicName(u)} dans la communauté Fais Ton Show !`, { gamification:true, type:'xp_level', targetUid });
    }
    return { ok:true, before, after };
  }
  async function setSpecialBadge(db, targetUid, badgeLabel, days, assignedBy, reason){
    const until = now() + Math.max(1, Number(days || 7)) * 86400000;
    const payload = { label:badgeLabel, until, assignedBy:assignedBy || '', reason:reason || '', ts:now() };
    await db.ref(`fts_forum/users/${targetUid}/specialBadge`).set(payload);
    db.ref(`fts_users/${targetUid}/specialBadge`).set(payload).catch(()=>{});
    const snap = await db.ref('fts_forum/users/' + targetUid).once('value').catch(()=>null);
    const u = snap && snap.val ? snap.val() : {};
    await writeRewardHistory(db, { type:'special_badge', targetUid, label:badgeLabel, until, assignedBy:assignedBy || '', reason:reason || '', name:publicName(u) });
    await pushGeneralMessage(db, `🌟 ${publicName(u)} reçoit le badge temporaire « ${badgeLabel} » !`, { gamification:true, type:'special_badge', targetUid });
    await awardXp(db, targetUid, 'special_badge_received', 30, { maxPerDay:2 }).catch(()=>{});
  }
  async function setArtistOfWeek(db, targetUid, assignedBy, text, days){
    const until = now() + Math.max(1, Number(days || 7)) * 86400000;
    const snap = await db.ref('fts_forum/users/' + targetUid).once('value').catch(()=>null);
    const u = snap && snap.val ? snap.val() : {};

    // IMPORTANT : on écrit d'abord dans specialBadge avec EXACTEMENT la même structure
    // qu'un badge temporaire classique. Certaines rules Firebase refusent les champs
    // supplémentaires (uid/kind/text/name), ce qui provoquait permission_denied.
    const payload = {
      label:'⭐ Artiste de la semaine',
      until,
      assignedBy:assignedBy || '',
      reason:text || '',
      ts:now()
    };

    // Écriture principale : même chemin que les badges temporaires, déjà autorisé.
    await db.ref(`fts_forum/users/${targetUid}/specialBadge`).set(payload);

    // Toutes les écritures confort sont facultatives et ne doivent JAMAIS bloquer
    // l'attribution si une rule les refuse.
    db.ref(`fts_users/${targetUid}/specialBadge`).set(payload).catch(()=>{});
    db.ref('fts_community/artistOfWeek').set(Object.assign({ uid:targetUid, kind:'artist', name:publicName(u), text:text || '' }, payload)).catch(()=>{});
    writeRewardHistory(db, { type:'artist_of_week', targetUid, label:payload.label, until, assignedBy:assignedBy || '', reason:text || '', name:publicName(u) }).catch(()=>{});
    pushGeneralMessage(db, `🎉 Bravo à ${publicName(u)} qui devient Artiste de la semaine !`, { gamification:true, type:'artist_of_week', targetUid }).catch(()=>{});
    awardXp(db, targetUid, 'artist_of_week', 100, { maxPerDay:1 }).catch(()=>{});
  }

  window.FTSGamification = { XP_BADGES, RARE_BADGES, REACTIONS, getXpBadge, getPublicBadge, renderBadge, awardXp, setSpecialBadge, setArtistOfWeek, clearSpecialBadge, extendSpecialBadge, pushGeneralMessage, writeRewardHistory, isActiveTimed };
})();
