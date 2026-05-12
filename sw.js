const CACHE = 'fts-v12-messages-fix';
const FILES = [
  './manifest.json',
  './assets/img/assets/img/fts192.png',
  './assets/img/assets/img/fts512.png',
  './membres.html',
  './forum.html',
  './messages.html',
  './profs.html'
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
    icon: './assets/img/assets/img/fts192.png',
    badge: './assets/img/assets/img/fts192.png',
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
