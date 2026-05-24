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


  /* ── Rendu fichiers/médias partagé Forum + Messages ─────────────
     Supporte le format existant : [media]URL|nom-encode.
     N'altère pas l'upload ni la structure Firebase. */
  Chat.mediaDownloadUrl = function(url = '') {
    const clean = String(url || '');
    if (clean.includes('/upload/') && !clean.includes('/fl_attachment')) {
      return clean.replace('/upload/', '/upload/fl_attachment/');
    }
    return clean;
  };

  Chat.cleanMediaName = function(raw = '', fallback = 'Fichier joint') {
    let name = '';
    try { name = decodeURIComponent(raw || ''); }
    catch(e) { name = raw || ''; }
    name = String(name || '').split('/').pop().split('?')[0].trim();
    if (!name) name = fallback || 'Fichier joint';
    return name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  };

  Chat.parseMediaPayload = function(payload = '') {
    const parts = String(payload || '').split('|');
    const url = parts.shift() || '';
    const fromPayload = parts.join('|');
    const fallback = url.split('?')[0].split('/').pop() || 'Fichier joint';
    return { url, name: Chat.cleanMediaName(fromPayload || fallback, fallback) };
  };

  Chat.fileKindFromUrl = function(url = '') {
    const ext = String(url || '').split('?')[0].split('.').pop().toLowerCase();
    if (ext === 'pdf') return { ext, cls:'pdf', icon:'📄', label:'PDF' };
    if (['mp3','wav','ogg','aac','m4a'].includes(ext)) return { ext, cls:'audio', icon:'🎵', label:'Audio' };
    if (['mp4','mov','webm'].includes(ext)) return { ext, cls:'video', icon:'🎬', label:'Vidéo' };
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return { ext, cls:'image', icon:'🖼️', label:'Image' };
    return { ext, cls:'file', icon:'📎', label:'Fichier' };
  };

  Chat.renderFileCard = function(icon, title, url, label, kind) {
    const normalizedUrl = FTS.safeUrl(url, '#');
    const safeUrl = Chat.escape(normalizedUrl);
    const dlUrl = Chat.escape(Chat.mediaDownloadUrl(normalizedUrl));
    const safeTitle = Chat.escape(title || 'Fichier joint');
    const safeLabel = Chat.escape(label || 'Fichier joint');
    const safeKind = Chat.escape(kind || 'file');
    return `<div class="msg-file-card msg-file-card--${safeKind}">
      <a class="msg-file-main" href="${safeUrl}" target="_blank" rel="noopener" title="${safeTitle}" aria-label="Ouvrir ${safeTitle}">
        <span class="msg-file-icon" aria-hidden="true">${icon}</span>
        <span class="msg-file-info">
          <span class="msg-file-title">${safeTitle}</span>
          <span class="msg-file-sub">${safeLabel}</span>
        </span>
      </a>
      <div class="msg-file-actions">
        <a class="msg-file-open" href="${safeUrl}" target="_blank" rel="noopener" aria-label="Ouvrir ${safeTitle}">Ouvrir</a>
        <a class="msg-file-download" href="${dlUrl}" target="_blank" rel="noopener" download aria-label="Télécharger ${safeTitle}">⬇ Télécharger</a>
      </div>
    </div>`;
  };

  Chat.renderMedia = function(payload = '') {
    const media = Chat.parseMediaPayload(payload);
    const url = media.url;
    const title = media.name || 'Fichier joint';
    const kind = Chat.fileKindFromUrl(url);
    const normalizedUrl = FTS.safeUrl(url, '#');
    const dl = Chat.escape(Chat.mediaDownloadUrl(normalizedUrl));
    const safeUrl = Chat.escape(normalizedUrl);
    const safeTitle = Chat.escape(title);
    const ext = kind.ext;
    const isImg = (url.includes('/image/upload/') && ext !== 'pdf') || ['jpg','jpeg','png','gif','webp'].includes(ext);
    const isVideo = (url.includes('/video/upload/') && !['mp3','wav','ogg','aac','m4a'].includes(ext)) || ['mp4','mov','webm'].includes(ext);
    const isAudio = ['mp3','wav','ogg','aac','m4a'].includes(ext);
    const isPdf = ext === 'pdf';

    if (isImg) return `<div class="msg-media-wrap msg-media-wrap--image">
      <div class="msg-media-title"><span>🖼️</span><strong>${safeTitle}</strong></div>
      <img class="msg-img" src="${safeUrl}" data-fts-click="window.open(${FTS.jsArg(normalizedUrl)})" alt="${safeTitle}">
      <div class="msg-file-actions compact"><a class="msg-file-open" href="${safeUrl}" target="_blank" rel="noopener">Ouvrir</a><a class="msg-file-download compact" href="${dl}" target="_blank" rel="noopener" download>⬇ Télécharger</a></div>
    </div>`;

    if (isVideo) return `<div class="msg-media-wrap msg-media-wrap--video">
      <div class="msg-media-title"><span>🎬</span><strong>${safeTitle}</strong></div>
      <video class="msg-video" src="${safeUrl}" controls playsinline></video>
      <div class="msg-file-actions compact"><a class="msg-file-open" href="${safeUrl}" target="_blank" rel="noopener">Ouvrir</a><a class="msg-file-download compact" href="${dl}" target="_blank" rel="noopener" download>⬇ Télécharger</a></div>
    </div>`;

    if (isAudio) return `<div class="msg-audio-card msg-file-card--audio">
      <div class="msg-media-title"><span>🎵</span><strong>${safeTitle}</strong></div>
      <audio class="msg-audio" controls preload="none"><source src="${safeUrl}"></audio>
      <div class="msg-file-actions compact"><a class="msg-file-open" href="${safeUrl}" target="_blank" rel="noopener">Ouvrir</a><a class="msg-file-download compact" href="${dl}" target="_blank" rel="noopener" download>⬇ Télécharger</a></div>
    </div>`;

    if (isPdf) return Chat.renderFileCard('📄', title, url, 'PDF · ouvrir ou télécharger', 'pdf');
    return Chat.renderFileCard(kind.icon, title, url, kind.label + ' · ouvrir ou télécharger', kind.cls);
  };

})(window.FTSChat);
