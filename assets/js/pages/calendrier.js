/* ================================================================
   PAGE — CALENDRIER
   Lecture seule. Aucune nouvelle écriture Firebase.
   Membres : événements ciblés + plannings correspondant à leurs accès.
   Profs/admins : vue complète des mêmes sources existantes.
   ================================================================ */
(function(){
  'use strict';

  const Cal = window.FTSCalendar;
  const state = {
    db:null, user:null, profile:null, full:false,
    events:{}, schedules:{}, items:[], view:localStorage.getItem('fts_calendar_view') || 'month',
    cursor:Date.now(), filter:'all', rangeStart:0, rangeEnd:0,
    eventRef:null, scheduleRef:null, readyEvents:false, readySchedules:false
  };

  const $ = id => document.getElementById(id);
  const esc = v => window.FTS && FTS.esc ? FTS.esc(v) : String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function setError(text){ const el=$('calendar-error'); if(!el) return; el.textContent=text || ''; el.classList.toggle('show', !!text); }
  function roleLabel(){
    const r = String(state.profile && state.profile.role || '').toLowerCase();
    if(r === 'admin') return '🛡️ Admin — calendrier complet';
    if(r === 'prof') return '🎓 Prof — calendrier complet';
    return '👤 Membre — uniquement ce qui te concerne';
  }

  function initRange(){
    const now = Date.now();
    state.rangeStart = Cal.addParisDays(now, -160);
    state.rangeEnd = Cal.addParisDays(now, 560);
  }

  async function boot(){
    if(!Cal){ document.body.innerHTML='<p>Service calendrier indisponible.</p>'; return; }
    initRange();
    state.db = FTS.initFirebase();
    firebase.auth().onAuthStateChanged(async user => {
      if(!user){ location.href='auth.html'; return; }
      try{
        const snap = await state.db.ref('fts_users/'+user.uid).once('value');
        const profile = snap.val() || {};
        if(String(profile.status || '').toLowerCase() !== 'active'){
          await firebase.auth().signOut(); location.href='auth.html'; return;
        }
        state.user = user; state.profile = profile; state.full = Cal.isTeam(profile);
        $('calendar-role').textContent = roleLabel();
        $('calendar-admin-link').hidden = String(profile.role || '').toLowerCase() !== 'admin';
        $('calendar-prof-link').hidden = !state.full;
        $('calendar-export-all').textContent = state.full ? '⬇ Exporter le calendrier complet' : '⬇ Ajouter tout à mon agenda';
        $('calendar-shell').hidden = false;
        bindUi(); listenData(); render();
      }catch(e){ setError('Impossible de charger ton profil : '+(e.message || e)); }
    });
  }

  function listenData(){
    state.eventRef = state.db.ref('fts_events');
    state.scheduleRef = state.db.ref('fts_schedules');
    state.eventRef.on('value', snap => { state.events=snap.val()||{}; state.readyEvents=true; rebuild(); }, err => { state.readyEvents=true; setError('Événements indisponibles : '+(err.message||err)); rebuild(); });
    state.scheduleRef.on('value', snap => { state.schedules=snap.val()||{}; state.readySchedules=true; rebuild(); }, err => { state.readySchedules=true; setError('Plannings indisponibles : '+(err.message||err)); rebuild(); });
  }

  function rebuild(){
    if(!state.profile) return;
    const rows=[];
    Object.entries(state.events || {}).forEach(([id,e]) => {
      if(!Cal.memberMatchesEvent(state.profile, e)) return;
      const item=Cal.normalizeEvent(id,e); if(item && item.endAt>=state.rangeStart && item.startAt<=state.rangeEnd) rows.push(item);
    });
    Object.entries(state.schedules || {}).forEach(([id,s0]) => {
      const s=Object.assign({id},s0||{});
      if(!Cal.memberMatchesSchedule(state.profile, state.user.uid, s)) return;
      Cal.expandSchedule(s,state.rangeStart,state.rangeEnd,500).forEach(occ => rows.push(Cal.normalizeScheduleOccurrence(id,occ,state.full)));
    });
    // Évite les doublons visuels quand deux enregistrements fts_schedules
    // décrivent exactement le même cours au même moment. On ne supprime rien
    // dans Firebase : le dédoublonnage ne concerne que cette vue calendrier.
    const seenScheduleItems = new Set();
    const deduped = rows.filter(item => {
      if(!item || item.source !== 'schedule') return true;
      const raw = item.raw || {};
      const key = [
        item.individual ? 'individual' : 'group',
        Number(item.startAt || 0),
        Number(item.endAt || 0),
        String(item.title || '').trim().toLowerCase(),
        String(item.category || '').trim().toLowerCase(),
        String(item.subcategory || '').trim().toLowerCase(),
        item.individual ? String(raw.uid || '').trim() : '',
        String(item.teacher || '').trim().toLowerCase(),
        String(item.location || '').trim().toLowerCase()
      ].join('|');
      if(seenScheduleItems.has(key)) return false;
      seenScheduleItems.add(key);
      return true;
    });
    state.items=deduped.sort((a,b)=>a.startAt-b.startAt || a.title.localeCompare(b.title,'fr'));
    render();
  }

  function bindUi(){
    document.querySelectorAll('[data-cal-nav]').forEach(btn => btn.addEventListener('click',()=>move(btn.getAttribute('data-cal-nav'))));
    document.querySelectorAll('[data-cal-view]').forEach(btn => btn.addEventListener('click',()=>{ state.view=btn.getAttribute('data-cal-view'); localStorage.setItem('fts_calendar_view',state.view); render(); }));
    $('calendar-filter').addEventListener('change', e => { state.filter=e.target.value; render(); });
    $('calendar-board').addEventListener('click', e => { const btn=e.target.closest('[data-calendar-item]'); if(btn) openItem(btn.getAttribute('data-calendar-item')); });
    $('calendar-modal-close').addEventListener('click',closeModal);
    $('calendar-modal').addEventListener('click',e=>{ if(e.target===$('calendar-modal')) closeModal(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });
    $('calendar-export-all').addEventListener('click', exportAll);
  }

  function cursorParts(){ return Cal.zonedParts(state.cursor); }
  function setCursorYmd(y,m,d){ state.cursor=Cal.parisTimestamp(y,m,d,12,0,0); }
  function move(dir){
    if(dir==='today'){ state.cursor=Date.now(); render(); return; }
    const p=cursorParts();
    if(state.view==='month'){
      const pivot=new Date(Date.UTC(p.year,p.month-1+(dir==='next'?1:-1),1,12)); setCursorYmd(pivot.getUTCFullYear(),pivot.getUTCMonth()+1,1);
    }else if(state.view==='week') state.cursor=Cal.addParisDays(state.cursor,dir==='next'?7:-7);
    else state.cursor=Cal.addParisDays(state.cursor,dir==='next'?30:-30);
    render();
  }

  function filteredItems(){
    if(state.filter==='events') return state.items.filter(x=>x.source==='event');
    if(state.filter==='groups') return state.items.filter(x=>x.source==='schedule' && !x.individual);
    if(state.filter==='individual') return state.items.filter(x=>x.source==='schedule' && x.individual);
    return state.items;
  }

  function itemClass(item){ return item.source==='event' ? 'event' : item.individual ? 'individual' : 'group'; }
  function itemButton(item){
    const time=item.allDay?'':`<time>${esc(Cal.timeLabel(item.startAt))}</time>`;
    return `<button type="button" class="cal-item ${itemClass(item)} ${item.important?'important':''}" data-calendar-item="${esc(item.id)}" title="${esc(item.title)}">${time}${esc(item.title)}</button>`;
  }

  function ymd(ts){ return Cal.ymdInParis(ts); }
  function dayItems(ts, rows){
    const p=Cal.zonedParts(ts);
    const dayStart=Cal.parisTimestamp(p.year,p.month,p.day,0,0,0);
    const dayEnd=Cal.addParisDays(dayStart,1);
    return rows.filter(x => x.startAt < dayEnd && x.endAt > dayStart);
  }
  function isToday(ts){ return ymd(ts)===ymd(Date.now()); }

  function monthRange(){
    const p=cursorParts();
    const first=Cal.parisTimestamp(p.year,p.month,1,12,0,0);
    const firstP=Cal.zonedParts(first);
    const weekday=new Intl.DateTimeFormat('en-US',{timeZone:Cal.TZ,weekday:'short'}).format(new Date(first));
    const map={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6};
    const start=Cal.addParisDays(first,-(map[weekday]||0));
    return {start,year:firstP.year,month:firstP.month};
  }

  function renderMonth(rows){
    const mr=monthRange();
    const names=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    let html=`<div class="month-weekdays">${names.map(n=>`<div>${n}</div>`).join('')}</div><div class="month-grid">`;
    for(let i=0;i<42;i++){
      const ts=Cal.addParisDays(mr.start,i); const p=Cal.zonedParts(ts); const items=dayItems(ts,rows); const outside=p.month!==mr.month;
      html+=`<div class="month-day ${outside?'outside':''} ${isToday(ts)?'today':''}"><div class="month-day-head"><span class="month-day-num">${p.day}</span>${items.length?`<span class="month-count">${items.length}</span>`:''}</div>`;
      html+=items.slice(0,3).map(itemButton).join(''); if(items.length>3) html+=`<div class="month-more">+ ${items.length-3} autre${items.length>4?'s':''}</div>`; html+='</div>';
    }
    html+='</div>'; return html;
  }

  function startOfWeek(ts){
    const day=new Intl.DateTimeFormat('en-US',{timeZone:Cal.TZ,weekday:'short'}).format(new Date(ts)); const map={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6}; return Cal.addParisDays(ts,-(map[day]||0));
  }
  function renderWeek(rows){
    const start=startOfWeek(state.cursor); let html='<div class="week-scroll"><div class="week-grid">';
    for(let i=0;i<7;i++){
      const ts=Cal.addParisDays(start,i); const items=dayItems(ts,rows); const date=Cal.dateLabel(ts).replace(/\s+\d{4}$/,'');
      html+=`<div class="week-day ${isToday(ts)?'today':''}"><div class="week-day-head"><strong>${esc(date)}</strong><span>${items.length} élément${items.length>1?'s':''}</span></div><div class="week-items">${items.length?items.map(itemButton).join(''):'<div class="calendar-empty">—</div>'}</div></div>`;
    }
    return html+'</div></div>';
  }

  function renderList(rows){
    const now=Cal.addParisDays(Date.now(),-1); const future=rows.filter(x=>x.endAt>=now).slice(0,350); if(!future.length) return '<div class="calendar-empty">Aucun élément à venir.</div>';
    const groups={}; future.forEach(x=>{ const k=ymd(x.startAt); (groups[k]||(groups[k]=[])).push(x); });
    return '<div class="agenda-list">'+Object.entries(groups).map(([k,items])=>{
      const ts=items[0].startAt; return `<section class="agenda-day"><div class="agenda-day-title">${esc(Cal.dateLabel(ts))}</div>${items.map(item=>`<div class="agenda-row" data-calendar-item="${esc(item.id)}"><div class="agenda-time">${item.allDay?'Toute la journée':esc(Cal.timeLabel(item.startAt))}</div><div class="agenda-main"><strong>${esc(item.title)}</strong><small>${esc([item.subtitle,item.location].filter(Boolean).join(' · '))}</small></div><div class="agenda-kind">${item.source==='event'?'Événement':item.individual?'Individuel':'Collectif'}</div></div>`).join('')}</section>`;
    }).join('')+'</div>';
  }

  function periodLabel(){
    const p=cursorParts();
    if(state.view==='month') return new Intl.DateTimeFormat('fr-FR',{timeZone:Cal.TZ,month:'long',year:'numeric'}).format(new Date(state.cursor));
    if(state.view==='week'){
      const a=startOfWeek(state.cursor), b=Cal.addParisDays(a,6); return `${new Intl.DateTimeFormat('fr-FR',{timeZone:Cal.TZ,day:'numeric',month:'short'}).format(new Date(a))} — ${new Intl.DateTimeFormat('fr-FR',{timeZone:Cal.TZ,day:'numeric',month:'short',year:'numeric'}).format(new Date(b))}`;
    }
    return 'Tous les éléments à venir';
  }

  function render(){
    if(!$('calendar-board')) return;
    document.querySelectorAll('[data-cal-view]').forEach(b=>b.classList.toggle('active',b.getAttribute('data-cal-view')===state.view));
    $('calendar-period').textContent=periodLabel();
    if(!state.readyEvents || !state.readySchedules){ $('calendar-board').innerHTML='<div class="calendar-loading">Chargement du calendrier…</div>'; return; }
    const rows=filteredItems(); $('calendar-count').textContent=`${rows.length} élément${rows.length>1?'s':''}`;
    $('calendar-board').innerHTML=state.view==='month'?renderMonth(rows):state.view==='week'?renderWeek(rows):renderList(rows);
  }

  function findItem(id){ return state.items.find(x=>x.id===id); }
  function openItem(id){
    const item=findItem(id); if(!item) return;
    $('calendar-modal-title').textContent=item.title;
    $('calendar-modal-type').textContent=item.source==='event'?'Événement programmé':item.individual?'Cours individuel':'Cours collectif';
    const date=item.allDay?Cal.dateLabel(item.startAt):`${Cal.dateLabel(item.startAt)} · ${Cal.timeLabel(item.startAt)} – ${Cal.timeLabel(item.endAt)}`;
    const details=[['Date',date],['Type',item.subtitle],['Lieu',item.location],['Prof',item.teacher],state.full&&item.recipientName?['Membre',item.recipientName]:null,state.full&&item.category?['Discipline',[item.category,item.subcategory].filter(Boolean).join(' · ')]:null].filter(x=>x&&x[1]);
    $('calendar-modal-details').innerHTML=details.map(x=>`<div class="calendar-detail"><span>${esc(x[0])}</span>${esc(x[1])}</div>`).join('');
    const g=Cal.googleCalendarUrl(item);
    $('calendar-modal-actions').innerHTML=`<a class="calendar-link" href="${esc(g)}" target="_blank" rel="noopener">Google Calendar</a><button class="calendar-btn" type="button" id="calendar-item-ics">Télécharger .ics</button>${item.url?`<a class="calendar-link" href="${esc(item.url)}" target="_blank" rel="noopener">Infos / inscription</a>`:''}`;
    $('calendar-item-ics').addEventListener('click',()=>downloadIcs([item],'fais-ton-show.ics'));
    $('calendar-modal').classList.add('open'); $('calendar-modal').setAttribute('aria-hidden','false');
  }
  function closeModal(){ $('calendar-modal').classList.remove('open'); $('calendar-modal').setAttribute('aria-hidden','true'); }

  function downloadIcs(items, filename){
    const text=Cal.buildIcs(items,state.full?'Fais Ton Show — Calendrier équipe':'Fais Ton Show — Mon calendrier');
    const blob=new Blob([text],{type:'text/calendar;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename||'fais-ton-show-calendrier.ics'; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},500);
  }
  function exportAll(){
    const rows=state.items.filter(x=>x.endAt>=Date.now()).slice(0,2000);
    if(!rows.length){ setError('Aucun élément futur à exporter.'); return; }
    downloadIcs(rows,state.full?'fais-ton-show-calendrier-complet.ics':'mon-calendrier-fais-ton-show.ics');
  }

  window.addEventListener('beforeunload',()=>{ try{state.eventRef&&state.eventRef.off(); state.scheduleRef&&state.scheduleRef.off();}catch(e){} });
  boot();
})();
