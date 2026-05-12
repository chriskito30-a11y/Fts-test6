/* ================================================================
   FTS-CHAT.JS — helpers communs Forum + Messages
   ================================================================ */
'use strict';

window.FTSChat = window.FTSChat || {};

(function(Chat){
  const AV_COLORS = [
    '#d4201a', '#c9a84c', '#8b5cf6', '#06b6d4', '#22c55e', '#f97316', '#1a5276', '#6c3483'
  ];

  Chat.escape = function(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  Chat.avColor = function(str = '') {
    const s = String(str || '?');
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = s.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AV_COLORS[Math.abs(hash) % AV_COLORS.length];
  };

  Chat.colorFrom = Chat.avColor;

  Chat.initials = function(name = '') {
    const clean = String(name || '').trim();
    if (!clean) return '?';
    return clean
      .split(/\s+/)
      .map(part => part[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  Chat.setAvatar = function(el, label = '', options = {}) {
    if (!el) return;

    const type = options.type || 'person';
    const icon = options.icon || '';

    if (type === 'category' || type === 'group') {
      el.textContent = icon || (type === 'category' ? '🎭' : '👥');
      el.style.background = options.background || 'rgba(201,168,76,.18)';
      el.style.color = options.color || '#c9a84c';
      el.style.fontSize = '1.1rem';
      return;
    }

    el.textContent = Chat.initials(label);
    el.style.background = Chat.avColor(label || '?');
    el.style.color = '#fff';
    el.style.removeProperty('font-size');
  };

  Chat.fmtTs = function(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    const diff = (now - d) / 86400000;
    if (diff < 2) return 'Hier';
    if (diff < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  Chat.fmtFull = function(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  Chat.fmtDay = function(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === yesterday.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  Chat.openChat = function() {
    document.getElementById('app')?.classList.add('chat-open');
    document.body.classList.add('chat-open');
  };

  Chat.closeChat = function() {
    document.getElementById('app')?.classList.remove('chat-open');
    document.body.classList.remove('chat-open');
  };

  Chat.autoResize = function(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  Chat.handleEnter = function(event, callback) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      callback();
    }
  };

  Chat.scrollBottom = function(id = 'messages') {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  };
})(window.FTSChat);
