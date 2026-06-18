(function(){
  function initContactBox(){
    var openBtn = document.querySelector('[data-fts-contact-open]');
    var overlay = document.getElementById('fts-contact-overlay');
    if (!openBtn || !overlay) return;
    var closeBtn = overlay.querySelector('[data-fts-contact-close]');

    function open(){
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('fts-contact-open');
    }

    function close(){
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('fts-contact-open');
      openBtn.focus({ preventScroll:true });
    }

    openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(event){
      if (event.target === overlay) close();
    });
    document.addEventListener('keydown', function(event){
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactBox);
  } else {
    initContactBox();
  }
})();
