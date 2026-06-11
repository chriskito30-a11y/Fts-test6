/* ================================================================
   PROFS-SLOTS.JS — Onglet planning individuel profs
   ================================================================ */

(function(){
  'use strict';

  function mount(){
    if(!window.FTSSlots) return;
    const box = document.getElementById('profs-slots-planning');
    if(!box || box.dataset.slotsMounted === '1') return;
    box.dataset.slotsMounted = '1';
    window.FTSSlots.renderTeacherSchedule(box, {});
  }

  const originalSwitchTab = window.switchTab;
  if(typeof originalSwitchTab === 'function'){
    window.switchTab = function(name){
      const result = originalSwitchTab.apply(this, arguments);
      if(name === 'slots') setTimeout(mount, 0);
      return result;
    };
  }

  window.addEventListener('DOMContentLoaded', function(){
    const btn = document.getElementById('tab-btn-slots');
    if(btn) btn.addEventListener('click', function(){ setTimeout(mount, 0); });
  });
})();
