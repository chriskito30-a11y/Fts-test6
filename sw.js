const CACHE = 'fts-v16-no-double-resource-notifs';
const FILES = [
  './manifest.json',
  './index.html',
  './auth.html',
  './membres.html',
  './forum.html',
  './messages.html',
  './profs.html',
  './admin.html',
  './contenus-admin.html',
  './calendrier-admin.html',
  './forum-admin.html',
  './saison.html',
  './saison-admin.html',
  './assets/css/fts-chat.css',
  './assets/css/fts.css',
  './assets/css/style.css',
  './assets/css/pages/admin.css',
  './assets/css/pages/auth.css',
  './assets/css/pages/calendrier-admin.css',
  './assets/css/pages/contenus-admin.css',
  './assets/css/pages/forum-admin.css',
  './assets/css/pages/forum.css',
  './assets/css/pages/index.css',
  './assets/css/pages/membres.css',
  './assets/css/pages/messages.css',
  './assets/css/pages/profs.css',
  './assets/css/pages/saison-admin.css',
  './assets/css/pages/saison.css',
  './assets/js/fts-chat.js',
  './assets/js/fts-firebase.js',
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
  './assets/js/pages/admin.js',
  './assets/js/pages/auth.js',
  './assets/js/pages/calendrier-admin.js',
  './assets/js/pages/contenus-admin.js',
  './assets/js/pages/forum-admin.js',
  './assets/js/pages/forum.js',
  './assets/js/pages/index.js',
  './assets/js/pages/membres.js',
  './assets/js/pages/messages.js',
  './assets/js/pages/profs.js',
  './assets/js/pages/saison-admin.js',
  './assets/js/pages/saison.js',
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
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
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
const NOTIF_DEDUPE_CACHE = 'fts-notification-dedupe-v1';
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
  const dedupeKey = notificationDedupeKey(data);
  if(dedupeKey && await wasRecentlyShownNotification(dedupeKey)) return;

  const tag = data.tag || data.collapseKey || data.notificationKey ||
    data.resourceId || data.messageId || data.conversationId || data.eventId || data.channel || 'fts-notification';

  await self.registration.showNotification(data.title || 'Fais Ton Show', {
    body: data.body || 'Nouvelle notification',
    icon: './assets/img/fts192.png',
    badge: './assets/img/fts192.png',
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
