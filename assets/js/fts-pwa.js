/* ================================================================
   FTS PWA — auto-update Service Worker
   ✅ Détecte une nouvelle version de sw.js
   ✅ Active immédiatement le nouveau SW
   ✅ Recharge une seule fois la page pour utiliser les nouveaux fichiers
   ================================================================ */
(function(){
  if (!('serviceWorker' in navigator)) return;

  const SW_URL = './sw.js';
  const RELOAD_KEY = 'fts-sw-reload-v15-event-notif-dedupe';
  let refreshing = false;

  function safeReloadOnce(){
    if (refreshing) return;
    refreshing = true;
    if (!sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', function(){
    safeReloadOnce();
  });

  navigator.serviceWorker.addEventListener('message', function(event){
    if (event.data && event.data.type === 'FTS_SW_ACTIVATED') {
      safeReloadOnce();
    }
  });

  window.addEventListener('load', function(){
    navigator.serviceWorker.register(SW_URL, { scope: './', updateViaCache: 'none' })
      .then(function(reg){
        function activateWaitingWorker(){
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }

        activateWaitingWorker();

        reg.addEventListener('updatefound', function(){
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', function(){
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Vérifie régulièrement les mises à jour quand l'app reste ouverte.
        setInterval(function(){ reg.update().catch(function(){}); }, 60 * 60 * 1000);

        // Vérifie aussi quand l'utilisateur revient sur l'app.
        document.addEventListener('visibilitychange', function(){
          if (!document.hidden) reg.update().catch(function(){});
        });
      })
      .catch(function(err){
        console.warn('[FTS PWA] Service worker non enregistré', err);
      });
  });
})();
