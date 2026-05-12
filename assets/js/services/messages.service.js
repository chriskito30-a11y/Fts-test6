/* ================================================================
   FTS MESSAGES SERVICE — Messagerie privée et groupes
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};
  function db(){ return window.FTS.initFirebase(); }

  S.Messages = {
    convRef(id){ return db().ref(id ? 'fts_dm/conversations/' + id : 'fts_dm/conversations'); },
    messageRef(convId, messageId){ return db().ref('fts_dm/messages/' + convId + (messageId ? '/' + messageId : '')); },
    userConvsRef(uid, convId){ return db().ref('fts_dm/userConvs/' + uid + (convId ? '/' + convId : '')); },
    getConversation(id){ return this.convRef(id).once('value').then(s => s.val()); },
    listenConversation(id, callback){ return this.convRef(id).on('value', s => callback(s.val())); },
    listenUserConvs(uid, callback){ return this.userConvsRef(uid).on('value', s => callback(s.val() || {})); },
    listenMessages(convId, callback){ return this.messageRef(convId).orderByChild('ts').on('value', s => callback(s.val() || {})); },
    stopMessages(convId){ return this.messageRef(convId).off(); },
    createConversation(data){
      const ref = this.convRef().push();
      return ref.set(Object.assign({}, data, { id: ref.key, createdAt: Date.now(), updatedAt: Date.now() })).then(() => ref.key);
    },
    updateConversation(id, patch){ return this.convRef(id).update(Object.assign({}, patch, { updatedAt: Date.now() })); },
    sendMessage(convId, message){
      const ref = this.messageRef(convId).push();
      return ref.set(Object.assign({}, message, { id: ref.key, ts: message.ts || Date.now() })).then(() => ref.key);
    },
    updateMessage(convId, messageId, patch){ return this.messageRef(convId, messageId).update(Object.assign({}, patch, { editedAt: Date.now() })); },
    deleteMessage(convId, messageId){ return this.messageRef(convId, messageId).remove(); },
    markRead(uid, convId){ return this.userConvsRef(uid, convId).update({ unread: 0, lastReadAt: Date.now() }); }
  };
})(window);
