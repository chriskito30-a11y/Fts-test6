/* ================================================================
   FTS FORUM SERVICE — Canaux, messages, utilisateurs forum
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};
  function db(){ return window.FTS.initFirebase(); }

  S.Forum = {
    usersRef(uid){ return db().ref(uid ? 'fts_forum/users/' + uid : 'fts_forum/users'); },
    messagesRef(channel){ return db().ref('fts_forum/messages/' + channel); },
    listUsers(){ return this.usersRef().once('value').then(s => s.val() || {}); },
    upsertUser(uid, data){ return this.usersRef(uid).update(Object.assign({}, data, { updatedAt: Date.now() })); },
    listenMessages(channel, callback){ return this.messagesRef(channel).orderByChild('ts').on('value', s => callback(s.val() || {})); },
    stopMessages(channel){ return this.messagesRef(channel).off(); },
    sendMessage(channel, message){
      const ref = this.messagesRef(channel).push();
      return ref.set(Object.assign({}, message, { id: ref.key, ts: message.ts || Date.now() })).then(() => ref.key);
    },
    deleteMessage(channel, messageId){ return this.messagesRef(channel).child(messageId).remove(); },
    updateMessage(channel, messageId, patch){ return this.messagesRef(channel).child(messageId).update(Object.assign({}, patch, { editedAt: Date.now() })); }
  };
})(window);
