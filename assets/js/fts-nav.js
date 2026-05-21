/* FTS-NAV.JS — navigation membre/prof/admin partagée */
(function(){
  'use strict';

  var ADMIN_FALLBACK_EMAILS = ['contact@faistonshow.fr'];
  var unreadListenerUid = null;
  var unreadConvListeners = {};
  var unreadTotalByConv = {};
  var unreadUserConvsRef = null;
  var currentForumProfile = null;
  var pollUnreadTotal = 0;
  var pollUnreadRef = null;
  var pollUnreadCb = null;
  var forumUnreadTotal = 0;
  var forumUnreadTimer = null;
  var forumChannelListeners = [];
  var forumReadsRef = null;
  var forumReadsCb = null;

  function esc(v){
    if (window.FTS && typeof FTS.esc === 'function') return FTS.esc(v);
    return String(v == null ? '' : v).replace(/[&<>'"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]); });
  }
  function norm(v){
    if (window.FTS && typeof FTS.norm === 'function') return FTS.norm(v);
    return String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  function catIcon(name){
    if (window.FTS && typeof FTS.catIcon === 'function') return FTS.catIcon(name);
    var n = norm(name);
    if (n.includes('theatre')) return '🎭';
    if (n.includes('danse')) return '💃';
    if (n.includes('chant')) return '🎤';
    if (n.includes('musique')) return '🎸';
    if (n.includes('comedie')) return '🎬';
    if (n.includes('singer')) return '⭐';
    return '📄';
  }

  function setBadge(id, count){
    var el = document.getElementById(id);
    if (!el) return;
    var n = Math.max(0, Number(count || 0));
    if (!n) {
      el.textContent = '';
      el.classList.remove('is-on');
      el.style.display = 'none';
      return;
    }
    el.textContent = n > 20 ? '20+' : String(n);
    el.classList.add('is-on');
    el.style.display = 'inline-flex';
  }

  function boolVisible(el, visible){
    if (!el) return;
    el.hidden = !visible;
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
    el.style.display = visible ? 'flex' : 'none';
  }

  function ensureMessagesBadge(){
    var link = document.querySelector('.fts-nav-item[data-nav="messages"]');
    if (!link) return null;
    var badge = document.getElementById('fts-messages-badge');
    if (badge) return badge;

    var icon = link.querySelector('.fts-nav-icon');
    if (!icon) return null;
    var wrap = icon.closest('.fts-nav-icon-wrap');
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'fts-nav-icon-wrap';
      icon.parentNode.insertBefore(wrap, icon);
      wrap.appendChild(icon);
    }
    badge = document.createElement('span');
    badge.className = 'fts-nav-badge';
    badge.id = 'fts-messages-badge';
    badge.style.display = 'none';
    wrap.appendChild(badge);
    return badge;
  }

  function ensureRoleLinks(nav){
    if (!nav) return;
    if (!document.getElementById('fts-nav-prof')) {
      var prof = document.createElement('a');
      prof.href = 'profs.html';
      prof.className = 'fts-nav-item fts-role-nav';
      prof.id = 'fts-nav-prof';
      prof.setAttribute('data-nav', 'prof');
      prof.hidden = true;
      prof.setAttribute('aria-hidden', 'true');
      prof.innerHTML = '<span class="fts-nav-icon">🎓</span><span class="fts-nav-label">Prof</span>';
      nav.appendChild(prof);
    }
    if (!document.getElementById('fts-nav-admin')) {
      var admin = document.createElement('a');
      admin.href = 'admin.html';
      admin.className = 'fts-nav-item fts-role-nav';
      admin.id = 'fts-nav-admin';
      admin.setAttribute('data-nav', 'admin');
      admin.hidden = true;
      admin.setAttribute('aria-hidden', 'true');
      admin.innerHTML = '<span class="fts-nav-icon">🛡️</span><span class="fts-nav-label">Admin</span>';
      nav.appendChild(admin);
    }
  }

  function applyRoleNavigation(profile, email){
    var nav = document.querySelector('.fts-bottom-nav');
    if (!nav) return;
    ensureRoleLinks(nav);

    var role = String((profile && profile.role) || '').trim().toLowerCase();
    var mail = String(email || (profile && profile.email) || '').trim().toLowerCase();
    var isAdmin = role === 'admin' || ADMIN_FALLBACK_EMAILS.indexOf(mail) !== -1;
    var isProf = role === 'prof' || isAdmin;

    boolVisible(document.getElementById('fts-nav-prof'), isProf);
    boolVisible(document.getElementById('fts-nav-admin'), isAdmin);

    nav.classList.remove('fts-nav-3', 'fts-nav-4', 'fts-nav-5');
    nav.classList.add(isAdmin ? 'fts-nav-5' : isProf ? 'fts-nav-4' : 'fts-nav-3');
    updateActiveNav();
  }

  function updateActiveNav(){
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.fts-nav-item[data-nav]').forEach(function(a){
      var nav = a.getAttribute('data-nav');
      var active = false;
      if (nav === 'membres' && page === 'membres.html') active = true;
      if (nav === 'documents' && page === 'repetition.html') active = true;
      if (nav === 'messages' && (page === 'hub-messages.html' || page === 'messages.html' || page === 'forum.html' || page === 'sondages.html')) active = true;
      if (nav === 'prof' && page === 'profs.html') active = true;
      if (nav === 'admin' && page === 'admin.html') active = true;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
    });
  }

  function initFirebaseSafe(){
    try {
      if (window.FTS && typeof FTS.initFirebase === 'function') return FTS.initFirebase();
      if (window.firebase && firebase.database) return firebase.database();
    } catch(e) {}
    return null;
  }

  function privateUnreadTotal(){
    return Object.keys(unreadTotalByConv).reduce(function(sum, id){ return sum + (Number(unreadTotalByConv[id] || 0) || 0); }, 0);
  }


  function forumInitialReadTs(profile){
    return Number(profile && (profile.forumBaselineAt || profile.createdAt || profile.created_at || profile.ts || 0)) || 0;
  }

  function forumLastReadTs(reads, channel, profile){
    var direct = Number((reads[channel] && reads[channel].ts) || reads[channel] || 0) || 0;
    return direct || forumInitialReadTs(profile);
  }

  function shouldCountForumUnreadMessage(msg, uid){
    if(!msg) return false;
    if(msg.uid && msg.uid === uid && !(msg.system === true || msg.gamification === true || msg.notifyAll === true || msg.type === 'special_badge' || msg.type === 'artist_of_week' || msg.type === 'xp_level')) return false;
    return true;
  }

  function renderMemberUnreadTotal(){
    var total = privateUnreadTotal() + Number(forumUnreadTotal || 0) + Number(pollUnreadTotal || 0);
    ensureMessagesBadge();
    // Historique : certaines pages avaient la pastille sur Membres. On la garde.
    setBadge('fts-member-badge', total);
    // Nouveau comportement attendu : pastille aussi sur le bouton Messages, partout.
    setBadge('fts-messages-badge', total);
  }

  function list(v){
    return (Array.isArray(v) ? v : String(v || '').split(',')).map(function(x){ return String(x || '').trim(); }).filter(Boolean);
  }

  function profileGroups(profile){
    var own = list(profile && (profile.disciplines || profile.groups || profile.group));
    var kids = [];
    if (profile && profile.hasEnfant && Array.isArray(profile.enfants)) {
      profile.enfants.forEach(function(e){ kids = kids.concat(list(e.disciplines || e.groups || e.group || e.categories)); });
    }
    return own.concat(kids).map(norm);
  }

  function profileSubgroups(profile){
    var own = list(profile && (profile.subgroups || profile.subcategories || profile.subgroup));
    var kids = [];
    if (profile && profile.hasEnfant && Array.isArray(profile.enfants)) {
      profile.enfants.forEach(function(e){ kids = kids.concat(list(e.subgroups || e.subcategories || e.subgroup || e.groupes)); });
    }
    return own.concat(kids).map(norm);
  }

  async function getVisibleForumChannels(db, profile){
    var role = String((profile && profile.role) || '').toLowerCase();
    var isAdmin = role === 'admin';
    var channels = ['general'];
    var groups = profileGroups(profile);
    var subs = profileSubgroups(profile);
    try {
      var structure = window.FTS && FTS.getCategoryStructureAsync
        ? await FTS.getCategoryStructureAsync(db)
        : (window.FTS && FTS.getCategoryStructure ? FTS.getCategoryStructure() : []);
      (structure || []).forEach(function(cat){
        var catName = cat.name || cat.category || '';
        var catNorm = norm(catName);
        if (isAdmin || groups.indexOf(catNorm) !== -1) channels.push(catNorm);
        (cat.subs || cat.subcats || []).forEach(function(sub){
          var subName = typeof sub === 'string' ? sub : (sub && (sub.name || sub.label));
          var subNorm = norm(subName);
          if (isAdmin || subs.indexOf(subNorm) !== -1) channels.push(subNorm);
        });
      });
    } catch(e) {
      groups.forEach(function(g){ channels.push(g); });
      subs.forEach(function(g){ channels.push(g); });
    }
    var uniq = {};
    channels.forEach(function(ch){ if (ch) uniq[ch] = true; });
    return Object.keys(uniq);
  }

  function scheduleForumUnreadRefresh(uid){
    if (forumUnreadTimer) clearTimeout(forumUnreadTimer);
    forumUnreadTimer = setTimeout(function(){ refreshForumUnreadTotal(uid); }, 160);
  }

  async function refreshForumUnreadTotal(uid){
    var db = initFirebaseSafe();
    if (!uid || !db || !currentForumProfile) { forumUnreadTotal = 0; renderMemberUnreadTotal(); return; }
    try {
      var channels = await getVisibleForumChannels(db, currentForumProfile);
      var readsSnap = await db.ref('fts_users/' + uid + '/forumReads').once('value');
      var reads = readsSnap.val() || {};
      var total = 0;
      await Promise.all(channels.map(function(ch){
        var lastRead = forumLastReadTs(reads, ch, currentForumProfile);
        if (!lastRead) return Promise.resolve();
        return db.ref('fts_forum/messages/' + ch).orderByChild('ts').startAt(lastRead + 1).limitToLast(50).once('value')
          .then(function(snap){
            snap.forEach(function(child){
              var msg = child.val() || {};
              if (!shouldCountForumUnreadMessage(msg, uid)) return;
              total += 1;
            });
          }).catch(function(){});
      }));
      forumUnreadTotal = total;
    } catch(e) {
      forumUnreadTotal = 0;
    }
    renderMemberUnreadTotal();
  }

  function clearForumUnreadListeners(){
    try {
      forumChannelListeners.forEach(function(entry){
        if (entry && entry.ref && entry.cb) entry.ref.off('value', entry.cb);
      });
      if (forumReadsRef && forumReadsCb) forumReadsRef.off('value', forumReadsCb);
    } catch(e) {}
    forumChannelListeners = [];
    forumReadsRef = null;
    forumReadsCb = null;
    forumUnreadTotal = 0;
  }

  function clearPollUnreadListener(){
    try { if (pollUnreadRef && pollUnreadCb) pollUnreadRef.off('value', pollUnreadCb); } catch(e) {}
    pollUnreadRef = null; pollUnreadCb = null; pollUnreadTotal = 0;
  }

  function listenPollUnread(uid){
    var db = initFirebaseSafe();
    if (!uid || !db) return;
    clearPollUnreadListener();
    pollUnreadRef = db.ref('fts_poll_unread/' + uid);
    pollUnreadCb = function(snap){
      pollUnreadTotal = snap.exists() ? Object.keys(snap.val() || {}).length : 0;
      renderMemberUnreadTotal();
    };
    pollUnreadRef.on('value', pollUnreadCb);
  }

  async function listenForumUnread(uid, profile){
    var db = initFirebaseSafe();
    if (!uid || !db) return;
    currentForumProfile = profile || {};
    clearForumUnreadListeners();
    forumReadsRef = db.ref('fts_users/' + uid + '/forumReads');
    forumReadsCb = function(){ scheduleForumUnreadRefresh(uid); };
    forumReadsRef.on('value', forumReadsCb);

    // Stabilisation : ne plus écouter tout fts_forum/messages en temps réel.
    // On écoute seulement les derniers changements des salons visibles pour garder les pastilles réactives
    // sans télécharger tout l'historique forum sur chaque page.
    try {
      var channels = await getVisibleForumChannels(db, currentForumProfile);
      channels.forEach(function(ch){
        var ref = db.ref('fts_forum/messages/' + ch).orderByChild('ts').limitToLast(1);
        var cb = function(){ scheduleForumUnreadRefresh(uid); };
        forumChannelListeners.push({ ref:ref, cb:cb });
        ref.on('value', cb);
      });
    } catch(e) {}

    scheduleForumUnreadRefresh(uid);
  }

  function clearUnreadListeners(){
    try {
      Object.keys(unreadConvListeners).forEach(function(id){
        var entry = unreadConvListeners[id];
        if (entry && entry.ref && entry.cb) entry.ref.off('value', entry.cb);
      });
      if (unreadUserConvsRef) unreadUserConvsRef.off();
    } catch(e) {}
    unreadConvListeners = {};
    unreadTotalByConv = {};
    unreadUserConvsRef = null;
    clearForumUnreadListeners();
    clearPollUnreadListener();
  }

  function listenUnreadMessages(uid){
    if (!uid) return;
    var db = initFirebaseSafe();
    if (!(db && window.firebase && firebase.database)) return;

    if (unreadListenerUid && unreadListenerUid !== uid) clearUnreadListeners();
    if (unreadListenerUid === uid && unreadUserConvsRef) return;
    unreadListenerUid = uid;

    unreadUserConvsRef = db.ref('fts_dm/userConvs/' + uid);
    unreadUserConvsRef.on('value', function(snap){
      var convIds = snap.val() ? Object.keys(snap.val()) : [];
      var active = convIds.reduce(function(acc, id){ acc[id] = true; return acc; }, {});

      Object.keys(unreadConvListeners).forEach(function(id){
        if (!active[id]) {
          var entry = unreadConvListeners[id];
          if (entry && entry.ref && entry.cb) entry.ref.off('value', entry.cb);
          delete unreadConvListeners[id];
          delete unreadTotalByConv[id];
        }
      });

      if (!convIds.length) {
        unreadTotalByConv = {};
        renderMemberUnreadTotal();
        return;
      }

      convIds.forEach(function(id){
        if (unreadConvListeners[id]) return;
        var ref = db.ref('fts_dm/conversations/' + id + '/unread/' + uid);
        var cb = function(s){
          unreadTotalByConv[id] = Number(s.val() || 0) || 0;
          renderMemberUnreadTotal();
        };
        unreadConvListeners[id] = { ref: ref, cb: cb };
        ref.on('value', cb);
      });
      renderMemberUnreadTotal();
    });
  }

  function startUnreadForUser(user){
    if (!user) {
      setBadge('fts-member-badge', 0);
      setBadge('fts-messages-badge', 0);
      clearUnreadListeners();
      return;
    }
    listenUnreadMessages(user.uid);
    listenPollUnread(user.uid);
    var db = initFirebaseSafe();
    if (db) {
      db.ref('fts_users/' + user.uid).once('value')
        .then(function(snap){ listenForumUnread(user.uid, snap.val() || {}); })
        .catch(function(){ listenForumUnread(user.uid, {}); });
    }
  }

  function updateBadges(){
    try {
      ensureMessagesBadge();
      if (window.FTS && typeof FTS.initFirebase === 'function') FTS.initFirebase();
      if (window.firebase && firebase.auth) {
        var user = firebase.auth().currentUser;
        if (user) { startUnreadForUser(user); return; }
        firebase.auth().onAuthStateChanged(function(u){ startUnreadForUser(u); });
      }
    } catch(e) {}
  }

  function initRoleNavigation(){
    var nav = document.querySelector('.fts-bottom-nav');
    if (!nav) return;
    ensureRoleLinks(nav);
    applyRoleNavigation(null, null);
    try {
      if (window.FTS && typeof FTS.initFirebase === 'function') FTS.initFirebase();
      if (!(window.firebase && firebase.auth)) return;
      firebase.auth().onAuthStateChanged(function(user){
        if (!user) { applyRoleNavigation(null, null); return; }
        if (firebase.database) {
          firebase.database().ref('fts_users/' + user.uid).once('value')
            .then(function(snap){ applyRoleNavigation(snap.val() || {}, user.email); })
            .catch(function(){ applyRoleNavigation({ email: user.email }, user.email); });
        } else {
          applyRoleNavigation({ email: user.email }, user.email);
        }
      });
    } catch(e) {
      console.warn('[FTSNav] role navigation:', e);
    }
  }

  function profileLists(profile){
    function list(v){ return (Array.isArray(v) ? v : String(v || '').split(',')).map(function(x){ return String(x || '').trim(); }).filter(Boolean); }
    var ownCats = list(profile && (profile.disciplines || profile.group));
    var ownSubs = list(profile && (profile.subgroups || profile.subcategories || profile.subgroup));
    var childCats = [];
    var childSubs = [];
    if (profile && profile.hasEnfant && Array.isArray(profile.enfants)) {
      profile.enfants.forEach(function(e){
        childCats = childCats.concat(list(e.disciplines || e.group));
        childSubs = childSubs.concat(list(e.subgroups || e.subcategories || e.subgroup));
      });
    }
    return {
      cats: Array.from(new Set(ownCats.concat(childCats))),
      subs: Array.from(new Set(ownSubs.concat(childSubs)))
    };
  }

  function canSeeResource(d, profile){
    if (!profile) return false;
    var role = String(profile.role || '').toLowerCase();
    if (role === 'admin') return true;
    var lists = profileLists(profile);
    var cat = d.cat || d.category || '';
    var sub = d.subcat || d.subcategory || '';
    if (cat && lists.cats.map(norm).indexOf(norm(cat)) === -1) return false;
    if (sub && lists.subs.length && lists.subs.map(norm).indexOf(norm(sub)) === -1) return false;
    return true;
  }

  function resourceDownloadUrl(url){
    if (!url) return '';
    if (url.indexOf('/upload/') !== -1 && url.indexOf('/fl_attachment') === -1) return url.replace('/upload/', '/upload/fl_attachment/');
    return url;
  }


  function isPdfResource(r){
    var type = String((r && r.type) || '').toLowerCase().trim();
    var url = String((r && r.url) || '').toLowerCase().trim();
    return type === 'pdf' || type.indexOf('pdf') !== -1 || /\.pdf(\?|#|$)/i.test(url);
  }

  function isRepetitionCompatible(r){
    if (!r || !isPdfResource(r)) return false;
    var cat = norm([r.cat, r.category].join(' '));
    var compatibleCat = cat.indexOf('theatre') !== -1
      || cat.indexOf('comedie musicale') !== -1
      || cat.indexOf('singer show') !== -1
      || cat.indexOf('singer academy') !== -1
      || cat.indexOf('chant') !== -1;
    var flagged = r.scriptRehearsal === true || String(r.scriptRehearsal || '').toLowerCase() === 'true';
    return compatibleCat && flagged;
  }

  function repetitionUrlForResource(r){
    var key = r && r.key ? String(r.key) : '';
    return key ? 'repetition.html?resource=' + encodeURIComponent(key) + '&autoload=1' : 'repetition.html';
  }

  function isTextResource(r){
    var type = String((r && r.type) || '').toLowerCase().trim();
    var url = String((r && r.url) || '').trim();
    var isHttp = /^https?:\/\//i.test(url);
    return !isHttp || type === 'texte' || type === 'text' || type === 'txt' || type === 'note';
  }

  function textResourceContent(r){
    return String((r && (r.url || r.content || r.contenu || '')) || '').trim();
  }

  function openTextResource(index){
    var rows = window.FTSNav && window.FTSNav._documentsRows ? window.FTSNav._documentsRows : [];
    var r = rows[Number(index)];
    if (!r) return;
    var list = document.getElementById('fts-docs-list');
    var search = document.getElementById('fts-docs-search');
    var title = document.getElementById('fts-docs-title');
    if (search) search.value = '';
    if (title) title.textContent = r.name || 'Document texte';
    if (list) {
      list.innerHTML = '<div class="fts-doc-text-view">'
        + '<button type="button" class="fts-doc-back" data-action="back-documents-list">← Retour aux documents</button>'
        + '<div class="fts-doc-text-meta">' + esc(r.cat || 'Documents') + (r.sub ? ' · ' + esc(r.sub) : '') + '</div>'
        + '<div class="fts-doc-text-content">' + esc(textResourceContent(r)).replace(/\n/g, '<br>') + '</div>'
        + '</div>';
    }
  }

  function ensureDocumentsModal(){
    var existing = document.getElementById('fts-docs-modal');
    if (existing) return existing;
    var div = document.createElement('div');
    div.className = 'fts-docs-modal hidden';
    div.id = 'fts-docs-modal';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = '<div class="fts-docs-box" role="dialog" aria-modal="true" aria-labelledby="fts-docs-title">'
      + '<div class="fts-docs-head"><div><div class="fts-docs-kicker">Espace membre</div><h2 id="fts-docs-title">Mes documents</h2></div>'
      + '<button type="button" class="fts-docs-close" data-action="close-documents-modal" aria-label="Fermer">✕</button></div>'
      + '<div class="fts-docs-tools"><input type="search" id="fts-docs-search" placeholder="🔍 Rechercher un document…"></div>'
      + '<div class="fts-docs-list" id="fts-docs-list"><div class="fts-docs-empty">Chargement…</div></div>'
      + '</div>';
    document.body.appendChild(div);
    return div;
  }

  function groupResources(rows){
    var groups = {};
    rows.forEach(function(r){
      var k = r.cat || 'Documents';
      if (!groups[k]) groups[k] = [];
      groups[k].push(r);
    });
    return groups;
  }

  function renderDocuments(rows, term){
    var list = document.getElementById('fts-docs-list');
    if (!list) return;
    var q = norm(term || '');
    var filtered = rows.filter(function(r){ return !q || norm([r.name, r.cat, r.sub, r.type].join(' ')).indexOf(q) !== -1; });
    if (!filtered.length) {
      list.innerHTML = '<div class="fts-docs-empty"><strong>Aucun document trouvé.</strong><span>Les ressources visibles selon ton profil apparaîtront ici.</span></div>';
      return;
    }
    var groups = groupResources(filtered);
    list.innerHTML = Object.keys(groups).sort().map(function(cat){
      var items = groups[cat].map(function(r){
        var isText = isTextResource(r);
        var icon = r.icon || (isText ? 'T' : (r.type === 'pdf' ? '▩' : r.type.indexOf('audio') >= 0 || r.type === 'mp3' ? '♪' : r.type.indexOf('video') >= 0 ? '▶' : '□'));
        var sub = r.sub ? '<small>' + esc(r.sub) + '</small>' : '<small>' + esc(isText ? 'texte' : (r.type || 'document')) + '</small>';
        if (isText) {
          return '<div class="fts-doc-row fts-doc-row--text"><button type="button" class="fts-doc-open" data-action="open-text-document" data-doc-index="' + esc(String(r._docIndex || 0)) + '"><span class="fts-doc-ico">' + icon + '</span><span><strong>' + esc(r.name || 'Document texte') + '</strong>' + sub + '</span></button><button type="button" class="fts-doc-dl fts-doc-dl--text" data-action="open-text-document" data-doc-index="' + esc(String(r._docIndex || 0)) + '">Lire</button></div>';
        }
        var safeUrl = esc(r.url || '#');
        var dl = esc(resourceDownloadUrl(r.url || ''));
        var rehearse = isRepetitionCompatible(r)
          ? '<a class="fts-doc-dl fts-doc-rehearse" href="' + esc(repetitionUrlForResource(r)) + '" aria-label="Répéter ' + esc(r.name || 'Document') + '">🎭 <span>Répéter</span></a>'
          : '';
        return '<div class="fts-doc-row"><a class="fts-doc-open" href="' + safeUrl + '" target="_blank" rel="noopener"><span class="fts-doc-ico">' + icon + '</span><span><strong>' + esc(r.name || 'Document') + '</strong>' + sub + '</span></a><div class="fts-doc-actions"><a class="fts-doc-dl" href="' + dl + '" target="_blank" rel="noopener" download aria-label="Télécharger ' + esc(r.name || 'Document') + '">⬇ <span>Télécharger</span></a>' + rehearse + '</div></div>';
      }).join('');
      return '<section class="fts-doc-group"><h3>' + catIcon(cat) + ' ' + esc(cat) + '</h3>' + items + '</section>';
    }).join('');
  }

  function openDocumentsModal(){
    var modal = ensureDocumentsModal();
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    var list = document.getElementById('fts-docs-list');
    if (list) list.innerHTML = '<div class="fts-docs-empty">Chargement des documents…</div>';

    try {
      var db = initFirebaseSafe();
      var user = window.firebase && firebase.auth && firebase.auth().currentUser;
      if (!db || !user) {
        if (list) list.innerHTML = '<div class="fts-docs-empty"><strong>Connexion nécessaire.</strong><span>Retourne sur l’espace membre pour te reconnecter.</span></div>';
        return;
      }
      Promise.all([
        db.ref('fts_users/' + user.uid).once('value'),
        db.ref('fts_ressources').once('value')
      ]).then(function(res){
        var profile = res[0].val() || {};
        var snap = res[1];
        var rows = [];
        snap.forEach(function(child){
          var d = child.val() || {};
          if (d.active === false || d.status === 'inactive') return;
          var name = d.name || d.nom || d.title || d.titre || '';
          var url = d.url || d.content || d.contenu || d.link || d.lien || '';
          if (!name || !url) return;
          if (!canSeeResource(d, profile)) return;
          rows.push({
            key: child.key || '',
            name: name,
            url: url,
            content: d.content || d.contenu || '',
            cat: d.cat || d.category || 'Documents',
            sub: d.subcat || d.subcategory || '',
            type: String(d.type || 'doc').toLowerCase().trim(),
            scriptRehearsal: d.scriptRehearsal === true || String(d.scriptRehearsal || '').toLowerCase() === 'true',
            icon: d.icon || '',
            ts: Number(d.createdAt || d.updatedAt || 0)
          });
        });
        rows.sort(function(a,b){ return Number(b.ts || 0) - Number(a.ts || 0); });
        rows.forEach(function(r, idx){ r._docIndex = idx; });
        window.FTSNav._documentsRows = rows;
        renderDocuments(rows, '');
      }).catch(function(err){
        console.warn('[FTSNav] documents:', err);
        if (list) list.innerHTML = '<div class="fts-docs-empty">Impossible de charger les documents.</div>';
      });
    } catch(e) {
      if (list) list.innerHTML = '<div class="fts-docs-empty">Impossible de charger les documents.</div>';
    }
  }

  function closeDocumentsModal(){
    var modal = document.getElementById('fts-docs-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function bindDocumentsModal(){
    document.addEventListener('click', function(e){
      var open = e.target.closest('[data-action="open-documents-modal"]');
      if (open) { e.preventDefault(); openDocumentsModal(); return; }
      if (e.target && e.target.id === 'fts-docs-modal') { closeDocumentsModal(); return; }
      var close = e.target.closest('[data-action="close-documents-modal"]');
      if (close) { closeDocumentsModal(); return; }
      var textDoc = e.target.closest('[data-action="open-text-document"]');
      if (textDoc) { e.preventDefault(); openTextResource(textDoc.getAttribute('data-doc-index')); return; }
      var back = e.target.closest('[data-action="back-documents-list"]');
      if (back) {
        e.preventDefault();
        var title = document.getElementById('fts-docs-title');
        if (title) title.textContent = 'Mes documents';
        renderDocuments(window.FTSNav._documentsRows || [], '');
        return;
      }
    });
    document.addEventListener('input', function(e){
      if (e.target && e.target.id === 'fts-docs-search') renderDocuments(window.FTSNav._documentsRows || [], e.target.value || '');
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeDocumentsModal(); });
  }

  window.FTSNav = {
    setBadge: setBadge,
    updateBadges: updateBadges,
    updateRoleNavigation: applyRoleNavigation,
    openDocumentsModal: openDocumentsModal,
    _documentsRows: [],
    refresh: function(){ updateActiveNav(); updateBadges(); initRoleNavigation(); }
  };

  document.addEventListener('DOMContentLoaded', function(){
    updateActiveNav();
    updateBadges();
    initRoleNavigation();
    bindDocumentsModal();
  });
})();
