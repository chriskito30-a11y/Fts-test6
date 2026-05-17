/* Hub Messages — auth légère + compteurs MP / Forum */
(function(){
  'use strict';
  var db = FTS.initFirebase();
  var currentUid = null;
  var currentProfile = null;
  var dmUnreadByConv = {};
  var dmUnreadListeners = {};

  function norm(v){ return (window.FTS && FTS.norm) ? FTS.norm(v) : String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function list(v){ return (Array.isArray(v) ? v : String(v || '').split(',')).map(function(x){ return String(x || '').trim(); }).filter(Boolean); }
  function uniq(arr){ var seen = {}; return arr.filter(function(v){ var k = norm(v); if(!k || seen[k]) return false; seen[k] = true; return true; }); }

  function setHubBadge(id, count){
    var badge = document.getElementById(id);
    if (!badge) return;
    var n = Math.max(0, Number(count || 0));
    var card = badge.closest('.hub-card');
    var statusId = id === 'hub-dm-badge' ? 'hub-dm-status' : (id === 'hub-forum-badge' ? 'hub-forum-status' : '');
    var status = statusId ? document.getElementById(statusId) : null;
    if (!n) {
      badge.hidden = true;
      badge.textContent = '0';
      if (card) card.classList.remove('has-unread');
      if (status) status.textContent = id === 'hub-dm-badge' ? 'Aucun message privé à lire' : 'Aucune nouveauté groupe';
      return;
    }
    badge.hidden = false;
    badge.textContent = n > 20 ? '20+' : String(n);
    if (status) status.textContent = n > 20 ? '20+ à lire' : (n + ' à lire');
    if (card) card.classList.add('has-unread');
  }

  function profileGroups(profile){
    var parent = list(profile && (profile.disciplines || profile.groups || profile.group));
    var children = [];
    if (profile && profile.hasEnfant && Array.isArray(profile.enfants)) {
      profile.enfants.forEach(function(e){ children = children.concat(list(e.disciplines || e.groups || e.group)); });
    }
    return uniq(parent.concat(children)).map(norm);
  }

  function profileSubgroups(profile){
    var parent = list(profile && (profile.subgroups || profile.subcategories || profile.subgroup));
    var children = [];
    if (profile && profile.hasEnfant && Array.isArray(profile.enfants)) {
      profile.enfants.forEach(function(e){ children = children.concat(list(e.subgroups || e.subcategories || e.subgroup)); });
    }
    return uniq(parent.concat(children)).map(norm);
  }

  async function getForumChannels(profile){
    var isAdmin = String((profile && profile.role) || '').toLowerCase() === 'admin';
    var channels = ['general'];
    var groups = profileGroups(profile);
    var subs = profileSubgroups(profile);
    try {
      var structure = FTS.getCategoryStructureAsync ? await FTS.getCategoryStructureAsync(db) : (FTS.getCategoryStructure ? FTS.getCategoryStructure() : []);
      (structure || []).forEach(function(cat){
        var catNorm = norm(cat.category);
        if (isAdmin || groups.indexOf(catNorm) !== -1) channels.push(catNorm);
        (cat.subs || []).forEach(function(sub){
          var subNorm = norm(sub.name);
          if (isAdmin || subs.indexOf(subNorm) !== -1) channels.push(subNorm);
        });
      });
    } catch(e) {
      groups.forEach(function(g){ channels.push(g); });
      subs.forEach(function(s){ channels.push(s); });
    }
    return Object.keys(channels.reduce(function(acc, ch){ if(ch) acc[ch] = true; return acc; }, {}));
  }

  function renderPrivateUnreadTotal(){
    var total = Object.keys(dmUnreadByConv).reduce(function(sum, id){ return sum + (Number(dmUnreadByConv[id] || 0) || 0); }, 0);
    setHubBadge('hub-dm-badge', total);
  }

  function listenPrivateUnread(uid){
    db.ref('fts_dm/userConvs/' + uid).on('value', function(snap){
      var convIds = snap.val() ? Object.keys(snap.val()) : [];
      var active = convIds.reduce(function(acc, id){ acc[id] = true; return acc; }, {});

      Object.keys(dmUnreadListeners).forEach(function(id){
        if (!active[id]) {
          var entry = dmUnreadListeners[id];
          if (entry && entry.ref && entry.cb) entry.ref.off('value', entry.cb);
          delete dmUnreadListeners[id];
          delete dmUnreadByConv[id];
        }
      });

      if (!convIds.length) {
        dmUnreadByConv = {};
        renderPrivateUnreadTotal();
        return;
      }

      convIds.forEach(function(id){
        if (dmUnreadListeners[id]) return;
        var ref = db.ref('fts_dm/conversations/' + id + '/unread/' + uid);
        var cb = function(s){
          dmUnreadByConv[id] = Number(s.val() || 0) || 0;
          renderPrivateUnreadTotal();
        };
        dmUnreadListeners[id] = { ref: ref, cb: cb };
        ref.on('value', cb);
      });
      renderPrivateUnreadTotal();
    });
  }

  async function refreshForumUnread(){
    if (!currentUid || !currentProfile) { setHubBadge('hub-forum-badge', 0); return; }
    try {
      var channels = await getForumChannels(currentProfile);
      if (!channels.length) { setHubBadge('hub-forum-badge', 0); return; }
      var readsSnap = await db.ref('fts_users/' + currentUid + '/forumReads').once('value');
      var reads = readsSnap.val() || {};
      var total = 0;
      await Promise.all(channels.map(function(ch){
        var lastRead = Number((reads[ch] && reads[ch].ts) || reads[ch] || 0);
        if (!lastRead) return Promise.resolve();
        return db.ref('fts_forum/messages/' + ch).orderByChild('ts').startAt(lastRead + 1).limitToLast(50).once('value')
          .then(function(snap){
            snap.forEach(function(child){
              var msg = child.val() || {};
              if (msg.uid && msg.uid === currentUid) return;
              total += 1;
            });
          }).catch(function(){});
      }));
      setHubBadge('hub-forum-badge', total);
    } catch(e) {
      console.warn('[FTS Hub Messages] compteur forum:', e);
      setHubBadge('hub-forum-badge', 0);
    }
  }

  function listenForumUnread(uid, profile){
    currentUid = uid;
    currentProfile = profile || {};
    refreshForumUnread();
    db.ref('fts_forum/messages').on('value', refreshForumUnread);
    db.ref('fts_users/' + uid + '/forumReads').on('value', refreshForumUnread);
  }

  firebase.auth().onAuthStateChanged(function(user){
    if (!user) {
      location.href = 'auth.html';
      return;
    }
    db.ref('fts_users/' + user.uid).once('value').then(function(snap){
      currentProfile = snap.val() || {};
      var loader = document.getElementById('auth-loading');
      var page = document.getElementById('page-content');
      if (loader) loader.style.display = 'none';
      if (page) page.classList.remove('u-initial-hidden');
      listenPrivateUnread(user.uid);
      listenForumUnread(user.uid, currentProfile);
      if (window.FTSNav) window.FTSNav.updateBadges();
    }).catch(function(){
      var loader = document.getElementById('auth-loading');
      var page = document.getElementById('page-content');
      if (loader) loader.style.display = 'none';
      if (page) page.classList.remove('u-initial-hidden');
      listenPrivateUnread(user.uid);
      listenForumUnread(user.uid, {});
      if (window.FTSNav) window.FTSNav.updateBadges();
    });
  });
})();
