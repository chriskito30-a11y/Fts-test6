/* ================================================================
   FTS CALENDAR SERVICE — vue calendrier sans nouvelle donnée Firebase
   Sources existantes : fts_events + fts_schedules
   Fuseau de référence : Europe/Paris
   ================================================================ */
(function(root, factory){
  const api = factory();
  root.FTSCalendar = api;
  if(typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function(){
  'use strict';

  const TZ = 'Europe/Paris';
  const DAY_MS = 86400000;

  function norm(v){
    return String(v == null ? '' : v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function list(v){
    return (Array.isArray(v) ? v : String(v || '').split(','))
      .map(x => String(x || '').trim()).filter(Boolean);
  }
  function uniq(values){
    const seen = new Set();
    return (values || []).filter(v => { const k = norm(v); if(!k || seen.has(k)) return false; seen.add(k); return true; });
  }
  function role(profile){ return String(profile && profile.role || '').trim().toLowerCase(); }
  function isTeam(profile){ return role(profile) === 'admin' || role(profile) === 'prof'; }

  function profileCategories(profile){
    const own = list(profile && (profile.disciplines || profile.groups || profile.group));
    const children = profile && Array.isArray(profile.enfants) ? profile.enfants : (profile && profile.enfants && typeof profile.enfants === 'object' ? Object.values(profile.enfants) : []);
    const kids = children.flatMap(e => list(e && (e.disciplines || e.groups || e.group || e.categories)));
    return uniq(own.concat(kids));
  }
  function profileSubgroups(profile){
    const own = list(profile && (profile.subgroups || profile.subcategories || profile.subgroup));
    const children = profile && Array.isArray(profile.enfants) ? profile.enfants : (profile && profile.enfants && typeof profile.enfants === 'object' ? Object.values(profile.enfants) : []);
    const kids = children.flatMap(e => list(e && (e.subgroups || e.subcategories || e.subgroup || e.groupes)));
    const mapped = [];
    function addMap(value){
      if(!value || typeof value !== 'object' || Array.isArray(value)) return;
      Object.values(value).forEach(rows => list(rows).forEach(x => mapped.push(x)));
    }
    addMap(profile && (profile.subgroupsByCat || profile.subcategoriesByCat || profile.groupsByCat));
    children.forEach(e => addMap(e && (e.subgroupsByCat || e.subcategoriesByCat || e.groupsByCat)));
    return uniq(own.concat(kids,mapped));
  }

  function eventTargets(e){
    const cats = list(e && (e.targetCategories || e.categories || e.groups));
    const subs = list(e && (e.targetSubgroups || e.targetSubcategories || e.subgroups || e.subcategories));
    const groups = {};
    if(e && e.targetGroups && typeof e.targetGroups === 'object' && !Array.isArray(e.targetGroups)){
      Object.entries(e.targetGroups).forEach(([cat, rows]) => { if(cat) groups[cat] = list(rows); });
    }
    return { cats, subs, groups };
  }

  function memberMatchesEvent(profile, e){
    if(!e || e.active === false || e.status === 'inactive') return false;
    if(isTeam(profile)) return true;
    const t = eventTargets(e);
    if(!t.cats.length && !t.subs.length && !Object.keys(t.groups).length) return true;

    const myCats = profileCategories(profile).map(norm);
    const mySubs = profileSubgroups(profile).map(norm);

    for(const [cat, subs] of Object.entries(t.groups)){
      const catOk = myCats.includes(norm(cat));
      const cleanSubs = list(subs);
      if(catOk && !cleanSubs.length) return true;
      if(catOk && cleanSubs.some(sub => mySubs.includes(norm(sub)))) return true;
    }

    // Compatibilité avec les anciens événements sans targetGroups.
    if(!Object.keys(t.groups).length){
      if(t.cats.length && !t.subs.length && t.cats.some(cat => myCats.includes(norm(cat)))) return true;
      if(t.subs.length && t.subs.some(sub => mySubs.includes(norm(sub)))) return true;
    }
    return false;
  }

  function memberMatchesSchedule(profile, uid, s){
    if(!s || s.active === false) return false;
    if(isTeam(profile)) return true;
    const kind = String(s.kind || '').trim();
    const ownerUid = String(s.uid || '').trim();
    if(kind === 'music_individual' || ownerUid) return !!uid && ownerUid === String(uid);

    const cat = String(s.targetCategory || s.category || '').trim();
    const sub = String(s.targetSubcategory || s.subcategory || '').trim();
    if(!cat && !sub) return true;
    const myCats = profileCategories(profile).map(norm);
    const mySubs = profileSubgroups(profile).map(norm);
    if(cat && !myCats.includes(norm(cat))) return false;
    if(sub && !mySubs.includes(norm(sub))) return false;
    return true;
  }

  const fmtParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
  });

  function zonedParts(ts){
    const out = {};
    fmtParts.formatToParts(new Date(Number(ts))).forEach(p => { if(p.type !== 'literal') out[p.type] = p.value; });
    return {
      year:Number(out.year), month:Number(out.month), day:Number(out.day),
      hour:Number(out.hour), minute:Number(out.minute), second:Number(out.second)
    };
  }

  function zoneOffsetMs(ts){
    const p = zonedParts(ts);
    const utcLike = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return utcLike - Math.floor(Number(ts) / 1000) * 1000;
  }

  function parisTimestamp(year, month, day, hour, minute, second){
    const wall = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour || 0), Number(minute || 0), Number(second || 0));
    let guess = wall;
    for(let i=0;i<4;i++){
      const next = wall - zoneOffsetMs(guess);
      if(Math.abs(next - guess) < 1000){ guess = next; break; }
      guess = next;
    }
    return guess;
  }

  function ymdInParis(ts){
    const p = zonedParts(ts);
    return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
  }

  function addParisDays(ts, days){
    const p = zonedParts(ts);
    const pivot = new Date(Date.UTC(p.year, p.month - 1, p.day + Number(days || 0), 12, 0, 0));
    return parisTimestamp(pivot.getUTCFullYear(), pivot.getUTCMonth()+1, pivot.getUTCDate(), p.hour, p.minute, p.second);
  }

  function parseParisDateTime(iso, hour){
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return 0;
    const hm = String(hour || '00:00').match(/^(\d{1,2}):(\d{2})/);
    return parisTimestamp(Number(m[1]), Number(m[2]), Number(m[3]), hm ? Number(hm[1]) : 0, hm ? Number(hm[2]) : 0, 0);
  }

  function defaultScheduleUntil(startAt){
    const p = zonedParts(startAt || Date.now());
    let year = p.year;
    let until = parisTimestamp(year, 6, 30, 23, 59, 59);
    if(until < Number(startAt || Date.now())) until = parisTimestamp(year + 1, 6, 30, 23, 59, 59);
    return until;
  }

  function expandSchedule(s, rangeStart, rangeEnd, maxRows){
    if(!s || s.active === false) return [];
    const rows = [];
    const max = Math.max(1, Number(maxRows || 400));
    const duration = Math.max(5, Number(s.durationMinutes || 30) || 30);
    const mode = String(s.recurrenceMode || 'single');
    const excluded = new Set(Array.isArray(s.excludedDates) ? s.excludedDates.map(String) : []);
    const startRange = Number(rangeStart || 0) || 0;
    const endRange = Number(rangeEnd || Number.MAX_SAFE_INTEGER) || Number.MAX_SAFE_INTEGER;

    function push(ts){
      ts = Number(ts || 0);
      if(!ts || !Number.isFinite(ts) || rows.length >= max) return;
      const endAt = ts + duration * 60000;
      if(endAt < startRange || ts > endRange) return;
      if(excluded.has(ymdInParis(ts))) return;
      rows.push({ startAt:ts, endAt, durationMinutes:duration, schedule:s });
    }

    if(mode === 'manual'){
      (Array.isArray(s.manualDates) ? s.manualDates : []).map(Number).filter(Boolean).sort((a,b)=>a-b).forEach(push);
    } else if(mode === 'weekly' || mode === 'biweekly' || mode === 'triweekly'){
      const startAt = Number(s.startAt || s.eventAt || 0);
      if(!startAt) return [];
      const step = mode === 'weekly' ? 7 : mode === 'biweekly' ? 14 : 21;
      const until = Math.min(Number(s.repeatUntil || 0) || defaultScheduleUntil(startAt), endRange + 31 * DAY_MS);
      let cur = startAt;
      let guard = 0;
      while(cur + duration*60000 < startRange && guard < 600){ cur = addParisDays(cur, step); guard++; }
      while(cur <= until && guard < 800 && rows.length < max){ push(cur); cur = addParisDays(cur, step); guard++; }
    } else {
      push(Number(s.startAt || s.eventAt || 0));
    }
    return rows.sort((a,b)=>a.startAt-b.startAt);
  }

  function eventStart(e){
    // dateIso + hour représentent l'heure métier voulue à Paris. On les préfère au timestamp
    // pour rester correct même si l'admin ouvre un jour la page depuis un autre fuseau.
    const iso = e && (e.dateIso || e.iso || '');
    if(iso){
      const parsed = parseParisDateTime(iso, e && (e.hour || e.h || e.time || '00:00'));
      if(parsed) return parsed;
    }
    return Number(e && (e.dateTs || e.startTs || e.startAt || 0)) || 0;
  }

  function eventEnd(e, startAt){
    const endIso = e && (e.endDateIso || e.dateEndIso || '');
    if(endIso){
      const parsed = parseParisDateTime(endIso, e.hour || e.h || e.time || '23:59');
      if(parsed > startAt) return parsed;
    }
    const direct = Number(e && (e.endDateTs || e.endTs || e.endAt || 0)) || 0;
    if(direct > startAt) return direct;
    return startAt + 2 * 60 * 60 * 1000;
  }

  function normalizeEvent(id, e){
    const startAt = eventStart(e || {});
    if(!startAt) return null;
    const hour = String(e && (e.hour || e.h || e.time || '') || '').trim();
    const allDay = !hour;
    let endAt = eventEnd(e || {}, startAt);
    if(allDay){
      const startP = zonedParts(startAt);
      const startMidnight = parisTimestamp(startP.year, startP.month, startP.day, 0, 0, 0);
      const endIso = e && (e.endDateIso || e.dateEndIso || '');
      const endExclusive = endIso ? addParisDays(parseParisDateTime(endIso, '00:00'), 1) : addParisDays(startMidnight, 1);
      return {
        id:`event:${id}`, source:'event', sourceId:id, startAt:startMidnight, endAt:endExclusive,
        allDay:true, title:String(e.name || e.title || e.n || 'Événement'),
        subtitle:String(e.type || e.t || 'Événement'), location:String(e.location || e.lieu || e.l || ''),
        url:String(e.url || e.link || e.u || ''), important:e.important === true || e.priority === 'important', raw:e
      };
    }
    return {
      id:`event:${id}`, source:'event', sourceId:id, startAt, endAt,
      allDay:false, title:String(e.name || e.title || e.n || 'Événement'),
      subtitle:String(e.type || e.t || 'Événement'), location:String(e.location || e.lieu || e.l || ''),
      url:String(e.url || e.link || e.u || ''), important:e.important === true || e.priority === 'important', raw:e
    };
  }

  function scheduleTitle(s, fullView){
    const base = String(s.title || s.lessonType || s.targetSubcategory || s.targetCategory || 'Cours Fais Ton Show').trim();
    if(fullView && (s.kind === 'music_individual' || s.uid)){
      const who = String(s.recipientName || s.courseOwnerName || '').trim();
      return who ? `${base} — ${who}` : base;
    }
    return base;
  }

  function normalizeScheduleOccurrence(scheduleId, occ, fullView){
    const s = occ.schedule || {};
    const individual = String(s.kind || '') === 'music_individual' || !!s.uid;
    const target = individual ? String(s.recipientName || s.courseOwnerName || '') : [s.targetCategory, s.targetSubcategory].filter(Boolean).join(' · ');
    return {
      id:`schedule:${scheduleId}:${occ.startAt}`, source:'schedule', sourceId:scheduleId,
      startAt:occ.startAt, endAt:occ.endAt, allDay:false,
      title:scheduleTitle(s, !!fullView), subtitle:individual ? 'Cours individuel' : (target || 'Cours collectif'),
      category:String(s.targetCategory || ''), subcategory:String(s.targetSubcategory || ''),
      recipientName:String(s.recipientName || s.courseOwnerName || ''), teacher:String(s.teacher || ''),
      location:String(s.place || ''), individual, raw:s
    };
  }

  function fmtDate(ts, options){
    return new Intl.DateTimeFormat('fr-FR', Object.assign({ timeZone:TZ }, options || {})).format(new Date(Number(ts)));
  }
  function dateLabel(ts){ return fmtDate(ts, { weekday:'long', day:'numeric', month:'long', year:'numeric' }); }
  function timeLabel(ts){ return fmtDate(ts, { hour:'2-digit', minute:'2-digit' }); }

  function icsEscape(v){
    return String(v || '').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
  }
  function utcIcs(ts){
    const d = new Date(Number(ts));
    const p = n => String(n).padStart(2,'0');
    return d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())+'T'+p(d.getUTCHours())+p(d.getUTCMinutes())+p(d.getUTCSeconds())+'Z';
  }
  function icsDateOnly(ts){
    const p = zonedParts(ts);
    return `${p.year}${String(p.month).padStart(2,'0')}${String(p.day).padStart(2,'0')}`;
  }

  function buildIcs(items, calendarName){
    const lines = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Fais Ton Show//Calendrier FTS//FR',
      'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-TIMEZONE:'+TZ,
      'X-WR-CALNAME:'+icsEscape(calendarName || 'Fais Ton Show')
    ];
    (items || []).filter(Boolean).sort((a,b)=>a.startAt-b.startAt).forEach((item, index) => {
      const uid = String((item.id || ('fts-'+index)) + '@faistonshow.fr').replace(/[^a-zA-Z0-9@._:-]/g,'-');
      const descBits = [item.subtitle || '', item.teacher ? 'Prof : '+item.teacher : '', item.recipientName ? 'Élève : '+item.recipientName : ''].filter(Boolean);
      lines.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+utcIcs(Date.now()));
      if(item.allDay){
        lines.push('DTSTART;VALUE=DATE:'+icsDateOnly(item.startAt));
        lines.push('DTEND;VALUE=DATE:'+icsDateOnly(item.endAt));
      } else {
        lines.push('DTSTART:'+utcIcs(item.startAt));
        lines.push('DTEND:'+utcIcs(item.endAt));
      }
      lines.push('SUMMARY:'+icsEscape(item.title || 'Fais Ton Show'));
      if(descBits.length) lines.push('DESCRIPTION:'+icsEscape(descBits.join('\n')));
      if(item.location) lines.push('LOCATION:'+icsEscape(item.location));
      if(item.url) lines.push('URL:'+icsEscape(item.url));
      lines.push(
        'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:Rappel Fais Ton Show — 24 h','END:VALARM',
        'BEGIN:VALARM','TRIGGER:-PT1H','ACTION:DISPLAY','DESCRIPTION:Rappel Fais Ton Show — 1 h','END:VALARM',
        'END:VEVENT'
      );
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function googleCalendarUrl(item){
    if(!item) return '#';
    const title = encodeURIComponent(item.title || 'Fais Ton Show');
    let dates;
    if(item.allDay){ dates = icsDateOnly(item.startAt)+'/'+icsDateOnly(item.endAt); }
    else { dates = utcIcs(item.startAt)+'/'+utcIcs(item.endAt); }
    const details = encodeURIComponent([item.subtitle || '', item.teacher ? 'Prof : '+item.teacher : ''].filter(Boolean).join('\n'));
    const location = encodeURIComponent(item.location || '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  }

  return {
    TZ, norm, list, isTeam, profileCategories, profileSubgroups,
    memberMatchesEvent, memberMatchesSchedule,
    zonedParts, parisTimestamp, ymdInParis, addParisDays, parseParisDateTime,
    expandSchedule, normalizeEvent, normalizeScheduleOccurrence,
    dateLabel, timeLabel, buildIcs, googleCalendarUrl
  };
});
