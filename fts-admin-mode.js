/* ================================================================
   FTS ADMIN MODE — V78
   Mode simple par défaut. Le mode avancé se développe uniquement au clic.
   ================================================================ */
(function(){
  'use strict';
  if(window.FTSAdminMode) return;
  const ADV_CLASS = 'fts-admin-advanced';
  function pageLabel(){
    const title = document.querySelector('.fts-admin-logo, .page-hdr h1, .polls-hero h1');
    return title ? (title.textContent || '').replace(/\s+/g,' ').trim() : 'Administration';
  }
  function setAdvanced(on){
    document.body.classList.toggle(ADV_CLASS, !!on);
    document.querySelectorAll('[data-fts-admin-mode-toggle]').forEach(btn=>{
      btn.classList.toggle('is-advanced', !!on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      btn.textContent = on ? 'Masquer le mode avancé' : 'Afficher le mode avancé';
    });
    document.querySelectorAll('[data-fts-admin-mode-state]').forEach(el=>{
      el.textContent = on ? 'Mode avancé affiché : toutes les options sont disponibles.' : 'Mode simple : seules les actions fréquentes sont visibles.';
    });
  }
  function createModebar(compact){
    const bar = document.createElement('div');
    bar.className = 'fts-admin-modebar' + (compact ? ' compact' : '');
    bar.innerHTML = '<div class="fts-admin-mode-copy"><div class="fts-admin-mode-icon">🧭</div><div><div class="fts-admin-mode-title">Mode simple par défaut</div><div class="fts-admin-mode-desc" data-fts-admin-mode-state>Mode simple : seules les actions fréquentes sont visibles.</div><div class="fts-admin-mode-hint">Les outils avancés ne sont pas supprimés : ils sont simplement rangés derrière le bouton.</div></div></div><button type="button" class="fts-admin-mode-toggle" data-fts-admin-mode-toggle aria-expanded="false">Afficher le mode avancé</button>';
    bar.querySelector('[data-fts-admin-mode-toggle]').addEventListener('click',()=>setAdvanced(!document.body.classList.contains(ADV_CLASS)));
    return bar;
  }
  function inject(){
    document.body.classList.remove(ADV_CLASS); // toujours simple au chargement
    if(document.querySelector('[data-fts-admin-modebar]')) return;
    const bar = createModebar(false);
    bar.setAttribute('data-fts-admin-modebar','');
    const shell = document.querySelector('#admin-shell .admin-wrap, #admin-shell .wrap-admin, #admin-shell .layout, #page-content .wrap, #page-content .polls-wrap, #dashboard .dash-body');
    const header = document.querySelector('.fts-admin-pagehead, .page-hdr, .polls-hero');
    if(shell){ shell.insertBefore(bar, shell.firstChild); }
    else if(header && header.parentNode){ header.parentNode.insertBefore(bar, header.nextSibling); }
  }
  window.FTSAdminMode = { setAdvanced, inject, pageLabel };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
