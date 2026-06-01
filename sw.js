const CACHE = 'fts-v211-event-notif-encoding';
const FILES = [
  './manifest.json',
  './index.html',
  './auth.html',
  './membres.html',
  './repetition.html',
  './forum.html',
  './messages.html',
  './faq.html',
  './hub-messages.html',
  './sondages.html',
  './rappels-admin.html',
  './rgpd-admin.html',
  './droit-image.html',
  './profs.html',
  './admin.html',
  './contenus-admin.html',
  './calendrier-admin.html',
  './forum-admin.html',
  './saison.html',
  './saison-admin.html',
  './boutique.html',
  './boutique-admin.html',
  './paiement.html',
  './paiements-admin.html',
  './ventes-admin.html',
  './confidentialite.html',
  './cgv.html',
  './enjoy.html',
  './assets/css/fts-chat.css',
  './assets/css/fts.css',
  './assets/css/pages/admin.css',
  './assets/css/pages/auth.css',
  './assets/css/pages/calendrier-admin.css',
  './assets/css/pages/contenus-admin.css',
  './assets/css/pages/forum-admin.css',
  './assets/css/pages/forum.css',
  './assets/css/pages/index.css',
  './assets/css/pages/membres.css',
  './assets/css/pages/repetition.css',
  './assets/css/pages/messages.css',
  './assets/css/pages/profs.css',
  './assets/css/pages/saison-admin.css',
  './assets/css/pages/saison.css',
  './assets/css/pages/boutique.css',
  './assets/css/pages/boutique-admin.css',
  './assets/css/pages/paiement.css',
  './assets/css/pages/ventes-admin.css',
  './assets/css/fts-enjoy.css',
  './assets/css/fts-nav.css',
  './assets/css/pages/hub-messages.css',
  './assets/css/pages/sondages.css',
  './assets/css/pages/rappels-admin.css',
  './assets/css/pages/rgpd-admin.css',
  './assets/css/pages/droit-image.css',
  './assets/css/pages/faq.css',
  './assets/js/fts-chat.js',
  './assets/js/fts-firebase.js',
  './assets/js/fts-gamification.js',
  './assets/js/fts-offline.js',
  './assets/js/fts-pwa.js',
  './assets/js/fts-utils.js',
  './assets/js/services/auth.service.js',
  './assets/js/services/content.service.js',
  './assets/js/services/events.service.js',
  './assets/js/services/forum.service.js',
  './assets/js/services/messages.service.js',
  './assets/js/services/notifications.service.js',
  './assets/js/services/resources.service.js',
  './assets/js/services/season.service.js',
  './assets/js/services/users.service.js',
  './assets/js/services/reminders.service.js',
  './assets/js/services/schedules.service.js',
  './assets/js/services/reminder-dispatcher.service.js',
  './assets/js/services/calendar-exclusions.service.js',
  './assets/js/pages/admin.js',
  './assets/js/pages/auth.js',
  './assets/js/pages/calendrier-admin.js',
  './assets/js/pages/contenus-admin.js',
  './assets/js/pages/forum-admin.js',
  './assets/js/pages/forum.js',
  './assets/js/pages/index.js',
  './assets/js/pages/membres.js',
  './assets/js/pages/repetition.js',
  './assets/js/pages/messages.js',
  './assets/js/pages/profs.js',
  './assets/js/pages/saison-admin.js',
  './assets/js/pages/saison.js',
  './assets/js/pages/boutique.js',
  './assets/js/pages/boutique-admin.js',
  './assets/js/fts-paiement.js',
  './assets/js/pages/ventes-admin.js',
  './assets/js/fts-promo-admin.js',
  './assets/js/fts-enjoy.js',
  './assets/js/fts-nav.js',
  './assets/js/pages/hub-messages.js',
  './assets/js/pages/sondages.js',
  './assets/js/pages/rappels-admin.js',
  './assets/js/pages/rgpd-admin.js',
  './assets/js/pages/droit-image.js',
  './assets/js/pages/faq.js',
  './assets/img/fts-any-192.png',
  './assets/img/fts-maskable-192.png',
  './assets/img/fts-badge-96.png',
  './assets/img/fts-any-512.png',
  './assets/img/fts-maskable-512.png',
  './assets/img/fts192.png',
  './assets/img/fts512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(FILES.map(f => cache.add(f)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== 'fts-offline-files-v74' && k !== FTS_RUNTIME_CACHE && k !== 'fts-notification-dedupe-v135').map(k => caches.delete(k)))
    )
  );
  e.waitUntil((async function(){
    await self.clients.claim();
    try {
      const clientsList = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
      clientsList.forEach(client => client.postMessage({ type:'FTS_SW_ACTIVATED', cache:CACHE }));
    } catch(_) {}
  })());
});


// Stocke l'UID actif côté Service Worker pour bloquer les notifications MP destinées à un autre compte.
const FTS_SW_DB = 'fts-sw-state-v74';
const FTS_SW_STORE = 'state';

function openSwStateDb(){
  return new Promise(function(resolve, reject){
    const req = indexedDB.open(FTS_SW_DB, 1);
    req.onupgradeneeded = function(){ req.result.createObjectStore(FTS_SW_STORE); };
    req.onsuccess = function(){ resolve(req.result); };
    req.onerror = function(){ reject(req.error); };
  });
}
async function setSwState(key, value){
  try{
    const db = await openSwStateDb();
    await new Promise(function(resolve, reject){
      const tx = db.transaction(FTS_SW_STORE, 'readwrite');
      tx.objectStore(FTS_SW_STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = function(){ reject(tx.error); };
    });
    db.close();
  }catch(e){}
}
async function getSwState(key){
  try{
    const db = await openSwStateDb();
    const value = await new Promise(function(resolve, reject){
      const tx = db.transaction(FTS_SW_STORE, 'readonly');
      const req = tx.objectStore(FTS_SW_STORE).get(key);
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
    db.close();
    return value;
  }catch(e){ return null; }
}

function notificationMatchesClearRequest(notification, req){
  const data = (notification && notification.data) || {};
  const tag = notification && notification.tag ? String(notification.tag) : '';
  const wantedTypes = Array.isArray(req.types) ? req.types : (req.kind === 'dm' ? ['dm_direct', 'dm_group'] : (req.type ? [req.type] : []));

  if (req.conversationId && data.conversationId !== req.conversationId && !tag.includes('dm-' + req.conversationId + '-')) return false;
  if (req.channel && data.channel !== req.channel && !tag.includes('forum-' + req.channel + '-')) return false;
  if (req.pollId && data.pollId !== req.pollId && !tag.includes('poll-' + req.pollId + '-')) return false;
  if (req.resourceId && data.resourceId !== req.resourceId && !tag.includes('resource-' + req.resourceId + '-')) return false;
  if (req.eventId && data.eventId !== req.eventId && !tag.includes('event-' + req.eventId)) return false;

  if (req.recipientUid && data.recipientUid && data.recipientUid !== req.recipientUid) return false;
  if (req.recipientUid && data.expectedUid && data.expectedUid !== req.recipientUid) return false;

  if (wantedTypes.length) {
    const dataType = String(data.type || '');
    if (!wantedTypes.includes(dataType)) return false;
  }
  return true;
}

async function clearMatchingNotifications(req){
  if (!self.registration || !self.registration.getNotifications) return 0;
  try {
    const list = await self.registration.getNotifications({ includeTriggered: true }).catch(() => self.registration.getNotifications());
    let closed = 0;
    (list || []).forEach(n => {
      if (notificationMatchesClearRequest(n, req || {})) {
        n.close();
        closed += 1;
      }
    });
    return closed;
  } catch(e) { return 0; }
}

self.addEventListener('message', function(event){
  if(event.data && event.data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if(event.data && event.data.type === 'FTS_SET_ACTIVE_UID') {
    event.waitUntil(setSwState('activeUid', event.data.uid || null));
    return;
  }
  if(event.data && event.data.type === 'FTS_CLEAR_NOTIFICATIONS') {
    event.waitUntil(clearMatchingNotifications(event.data.payload || {}));
  }
});

const FTS_RUNTIME_CACHE = 'fts-v149-profs-rewards-fix';
const FTS_FILES_CACHE = 'fts-offline-files-v74';

function isFirebaseOrAuthRequest(url){
  return /firebaseio\.com|googleapis\.com\/identitytoolkit|securetoken\.googleapis\.com|gstatic\.com\/firebasejs/.test(url.hostname + url.pathname);
}
function isDocumentAsset(url){
  return /\.(pdf|mp3|m4a|wav|ogg|mp4|webm|jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url.pathname);
}
function isAppShellRequest(url){
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Ne jamais mettre les appels Firebase/Auth en cache HTTP : les données sont gérées par fts-offline.js.
  if(isFirebaseOrAuthRequest(url)) return;

  // Documents/médias : cache-first si déjà téléchargé, puis réseau.
  if(isDocumentAsset(url)) {
    e.respondWith(
      caches.open(FTS_FILES_CACHE).then(cache =>
        cache.match(e.request).then(hit => hit || fetch(e.request).then(res => {
          if(res && res.ok) cache.put(e.request, res.clone()).catch(()=>{});
          return res;
        }))
      ).catch(() => caches.match(e.request))
    );
    return;
  }

  // App shell local : réseau d'abord, fallback cache.
  if(isAppShellRequest(url)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if(res && res.ok) caches.open(CACHE).then(cache => cache.put(e.request, res.clone())).catch(()=>{});
          return res;
        })
        .catch(() => caches.match(e.request).then(hit => hit || caches.match('./membres.html')))
    );
    return;
  }

  // Externe : réseau avec fallback cache, sans polluer le cache principal.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if(res && res.ok && res.type !== 'opaque') caches.open(FTS_RUNTIME_CACHE).then(cache => cache.put(e.request, res.clone())).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

function normalizeNotificationUrl(rawUrl){
  const fallback = './membres.html';
  try {
    const base = self.location.origin + self.location.pathname.replace(/\/[^/]*$/, '/');
    return new URL(rawUrl || fallback, base).href;
  } catch(e) {
    return new URL(fallback, self.location.href).href;
  }
}

// ═══ NOTIFICATIONS PUSH ═══════════════════════════
const NOTIF_DEDUPE_CACHE = 'fts-notification-dedupe-v135';
const NOTIF_DEDUPE_TTL = 10 * 60 * 1000; // 10 min : absorbe doublons d'abonnements / retries

function notificationDedupeKey(data){
  return data.notificationKey || data.collapseKey || data.tag ||
    data.resourceId || data.messageId || data.conversationId || data.eventId || data.channel || '';
}

async function wasRecentlyShownNotification(key){
  if(!key || !('caches' in self)) return false;
  try{
    const cache = await caches.open(NOTIF_DEDUPE_CACHE);
    const req = new Request(self.location.origin + '/__fts_notif_dedupe__/' + encodeURIComponent(key));
    const res = await cache.match(req);
    const now = Date.now();
    if(res){
      const ts = Number(await res.text()) || 0;
      if(now - ts < NOTIF_DEDUPE_TTL) return true;
    }
    await cache.put(req, new Response(String(now), { headers:{ 'Content-Type':'text/plain' } }));
  }catch(e){}
  return false;
}

async function handlePushNotification(event){
  let data = { title: 'Fais Ton Show', body: 'Nouvelle notification', url: './membres.html' };
  try { if (event.data) data = event.data.json(); } catch(e) {}

  const url = normalizeNotificationUrl(data.url);

  // Verrou confidentialité MP : le destinataire peut venir du payload OU de l'URL.
  // Utile si le worker Cloudflare ne transmet pas tous les champs custom du payload.
  let urlRecipientUid = null;
  try { urlRecipientUid = new URL(url).searchParams.get('recipientUid'); } catch(e) {}
  const expectedUid = data.expectedUid || data.recipientUid || data.uid || urlRecipientUid || null;
  const isPrivateMessage = data.requiresUidMatch === true || data.type === 'dm_direct' || data.type === 'dm_group' || !!urlRecipientUid;
  if(isPrivateMessage && expectedUid){
    const activeUid = await getSwState('activeUid');
    if(activeUid !== expectedUid) return;
  }

  const dedupeKey = notificationDedupeKey(data);
  if(dedupeKey && await wasRecentlyShownNotification(dedupeKey)) return;

  const tag = data.tag || data.collapseKey || data.notificationKey ||
    data.resourceId || data.messageId || data.conversationId || data.eventId || data.channel || 'fts-notification';

  await self.registration.showNotification(data.title || 'Fais Ton Show', {
    body: data.body || 'Nouvelle notification',
    icon: './assets/img/fts-any-192.png',
    badge: './assets/img/fts-badge-96.png',
    vibrate: [200, 100, 200],
    tag,
    // Si une notification identique arrive plusieurs fois, elle est remplacée sans revibrer.
    renotify: data.renotify === true && !dedupeKey,
    data: { ...data, url, notificationKey: dedupeKey || data.notificationKey || tag }
  });
}

self.addEventListener('push', function(event) {
  event.waitUntil(handlePushNotification(event));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = normalizeNotificationUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      const target = new URL(targetUrl);
      for (const client of clientList) {
        try {
          const current = new URL(client.url);
          if (current.pathname === target.pathname && 'focus' in client) {
            if ('navigate' in client) return client.navigate(targetUrl).then(c => c ? c.focus() : client.focus());
            return client.focus();
          }
        } catch(e) {}
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// FTS cache bump V109 — contrôles répétition collés à la bottom nav
