'use strict';
window.FTSQuestUI = {
  el(selector, root=document){ return root.querySelector(selector); },
  els(selector, root=document){ return Array.from(root.querySelectorAll(selector)); },
  escape(value){
    return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  },
  avatarMarkup(className){
    return `<div class="avatar-art ${this.escape(className)}" aria-hidden="true"><span class="avatar-face"></span><span class="avatar-mask"></span><span class="avatar-aura"></span></div>`;
  },
  log(message){
    const log = this.el('#questLog');
    if (!log) return;
    const line = document.createElement('p');
    line.innerHTML = `› ${message}`;
    log.prepend(line);
  },
  openPanel(title, html){
    const panel = this.el('#questPanel');
    this.el('#panelTitle').textContent = title;
    this.el('#panelContent').innerHTML = html;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden','false');
  },
  closePanel(){
    const panel = this.el('#questPanel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden','true');
  }
};
