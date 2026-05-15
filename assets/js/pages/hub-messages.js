/* Hub Messages — auth légère, sans logique chat/forum */
(function(){
  'use strict';
  var db = FTS.initFirebase();
  firebase.auth().onAuthStateChanged(function(user){
    if (!user) {
      location.href = 'auth.html';
      return;
    }
    var loader = document.getElementById('auth-loading');
    var page = document.getElementById('page-content');
    if (loader) loader.style.display = 'none';
    if (page) page.classList.remove('u-initial-hidden');
    if (window.FTSNav) window.FTSNav.updateBadges();
  });
})();
