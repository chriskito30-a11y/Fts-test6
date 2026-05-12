/* ================================================================
   FTS AUTH SERVICE — Authentification Firebase centralisée
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};

  function auth(){
    if (typeof firebase === 'undefined' || !firebase.auth) throw new Error('Firebase Auth non chargé.');
    return firebase.auth();
  }
  function db(){ return window.FTS.initFirebase(); }

  S.Auth = {
    instance: auth,
    onStateChanged(callback){ return auth().onAuthStateChanged(callback); },
    currentUser(){ return auth().currentUser; },
    signIn(email, password){ return auth().signInWithEmailAndPassword(email, password); },
    signUp(email, password){ return auth().createUserWithEmailAndPassword(email, password); },
    signOut(){ return auth().signOut(); },
    sendPasswordReset(email){ return auth().sendPasswordResetEmail(email); },
    updatePassword(newPassword){
      const user = auth().currentUser;
      if (!user) return Promise.reject(new Error('Aucun utilisateur connecté.'));
      return user.updatePassword(newPassword);
    },
    deleteAccount(){
      const user = auth().currentUser;
      if (!user) return Promise.reject(new Error('Aucun utilisateur connecté.'));
      return user.delete();
    },
    getProfile(uid){ return db().ref('fts_users/' + uid).once('value').then(s => s.val()); },
    requireActiveUser(callback, options){
      const opts = options || {};
      return this.onStateChanged(async (user) => {
        if (!user) {
          if (opts.redirect !== false) location.href = opts.loginUrl || 'auth.html';
          return callback(null, null);
        }
        const profile = await this.getProfile(user.uid);
        if (!profile || profile.status !== 'active') {
          if (opts.redirectPending) location.href = opts.pendingUrl || 'auth.html';
        }
        return callback(user, profile);
      });
    },
    isAdmin(profile){ return !!profile && profile.role === 'admin'; },
    isProf(profile){ return !!profile && (profile.role === 'prof' || profile.role === 'admin'); }
  };
})(window);
