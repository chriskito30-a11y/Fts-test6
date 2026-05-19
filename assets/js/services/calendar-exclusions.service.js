/* ================================================================
   FTS CALENDAR EXCLUSIONS SERVICE — cache vacances / jours fériés
   Stockage volontairement dans fts_content/calendarExclusions pour
   réutiliser les rules existantes : lecture publique, écriture admin.
   ================================================================ */
(function(window){
  'use strict';
  window.FTS = window.FTS || {};
  const S = window.FTS.Services = window.FTS.Services || {};
  if(S.CalendarExclusions) return;

  const PATH = 'fts_content/calendarExclusions';
  const DEFAULT_MAX_AGE = 330 * 24 * 60 * 60 * 1000;
  const ACADEMY = 'Montpellier';
  const ZONE = 'Zone C';

  function db(){ return window.FTS.initFirebase ? window.FTS.initFirebase() : window.firebase.database(); }
  function pad(n){ return String(n).padStart(2, '0'); }
  function dateKeyFromDate(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function dateKey(v){
    if(!v) return '';
    if(typeof v === 'number') return dateKeyFromDate(new Date(v));
    const s = String(v).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m) return m[1] + '-' + m[2] + '-' + m[3];
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? dateKeyFromDate(d) : '';
  }
  function addDaysKey(key, days){
    const d = new Date(key + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return dateKeyFromDate(d);
  }
  function expandRange(startKey, endKey, includeEnd){
    const out = {};
    if(!startKey || !endKey) return out;
    let cursor = startKey;
    let guard = 0;
    const last = includeEnd ? endKey : addDaysKey(endKey, -1);
    while(cursor <= last && guard < 120){
      out[cursor] = true;
      cursor = addDaysKey(cursor, 1);
      guard++;
    }
    return out;
  }
  function toBoolMap(input){
    const out = {};
    if(Array.isArray(input)) input.forEach(x => { const k = dateKey(x); if(k) out[k] = true; });
    else if(input && typeof input === 'object') Object.keys(input).forEach(k => { const kk = dateKey(k); if(kk && input[k] !== false) out[kk] = true; });
    return out;
  }
  function normalizeConfig(raw){
    const cfg = raw && typeof raw === 'object' ? raw : {};
    return {
      academy: cfg.academy || ACADEMY,
      zone: cfg.zone || ZONE,
      excludeSchoolHolidays: cfg.excludeSchoolHolidays !== false,
      excludePublicHolidays: cfg.excludePublicHolidays !== false,
      schoolBreaksCache: toBoolMap(cfg.schoolBreaksCache),
      publicHolidaysCache: toBoolMap(cfg.publicHolidaysCache),
      manualDates: toBoolMap(cfg.manualDates),
      updatedAt: Number(cfg.updatedAt || 0),
      refreshedAt: Number(cfg.refreshedAt || 0),
      source: cfg.source || 'manual-or-cache'
    };
  }
  function effectiveMap(cfg){
    const c = normalizeConfig(cfg);
    return Object.assign({}, c.excludeSchoolHolidays ? c.schoolBreaksCache : {}, c.excludePublicHolidays ? c.publicHolidaysCache : {}, c.manualDates || {});
  }
  function effectiveList(cfg){ return Object.keys(effectiveMap(cfg)).sort(); }
  function countMap(obj){ return Object.keys(obj || {}).length; }

  async function fetchPublicHolidays(years){
    const out = {};
    if(!window.fetch) return out;
    for(const year of years){
      try{
        const res = await fetch('https://calendrier.api.gouv.fr/jours-feries/metropole/' + encodeURIComponent(year) + '.json', { cache:'no-store' });
        if(!res.ok) continue;
        const json = await res.json();
        Object.keys(json || {}).forEach(k => { const key = dateKey(k); if(key) out[key] = true; });
      }catch(e){ console.warn('[FTS CalendarExclusions] jours fériés', year, e); }
    }
    return out;
  }

  async function fetchSchoolBreaks(years){
    const out = {};
    if(!window.fetch) return out;
    const start = Math.min.apply(null, years) + '-01-01';
    const end = Math.max.apply(null, years) + '-12-31';
    const urls = [
      'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?limit=100&where=' + encodeURIComponent('location="' + ACADEMY + '" AND start_date >= "' + start + '" AND start_date <= "' + end + '"'),
      'https://data.education.gouv.fr/api/records/1.0/search/?dataset=fr-en-calendrier-scolaire&rows=100&refine.location=' + encodeURIComponent(ACADEMY)
    ];
    for(const url of urls){
      try{
        const res = await fetch(url, { cache:'no-store' });
        if(!res.ok) continue;
        const json = await res.json();
        const rows = Array.isArray(json.results) ? json.results : (Array.isArray(json.records) ? json.records.map(r => r.fields || r) : []);
        rows.forEach(row => {
          const loc = String(row.location || '').toLowerCase();
          if(loc && loc.indexOf('montpellier') === -1) return;
          const s = dateKey(row.start_date || row.startDate || row.debut || row.date_debut);
          const e = dateKey(row.end_date || row.endDate || row.fin || row.date_fin);
          if(!s || !e) return;
          Object.assign(out, expandRange(s, e, false));
        });
        if(Object.keys(out).length) return out;
      }catch(e){ console.warn('[FTS CalendarExclusions] vacances scolaires', e); }
    }
    return out;
  }

  async function read(){
    const snap = await db().ref(PATH).once('value');
    return normalizeConfig(snap.val() || {});
  }
  async function save(patch){
    const payload = normalizeConfig(Object.assign({}, await read().catch(()=>({})), patch || {}, { updatedAt: Date.now() }));
    await db().ref(PATH).set(payload);
    return payload;
  }
  async function refresh(options){
    options = options || {};
    const now = new Date();
    const currentYear = Number(options.year || now.getFullYear());
    const years = options.years || [currentYear, currentYear + 1];
    const [schoolBreaksCache, publicHolidaysCache] = await Promise.all([
      fetchSchoolBreaks(years),
      fetchPublicHolidays(years)
    ]);
    const previous = await read().catch(()=>({}));
    const merged = normalizeConfig(Object.assign({}, previous, {
      academy: ACADEMY,
      zone: ZONE,
      schoolBreaksCache: Object.keys(schoolBreaksCache).length ? schoolBreaksCache : previous.schoolBreaksCache,
      publicHolidaysCache: Object.keys(publicHolidaysCache).length ? publicHolidaysCache : previous.publicHolidaysCache,
      manualDates: previous.manualDates || {},
      refreshedAt: Date.now(),
      updatedAt: Date.now(),
      source: 'api-cache'
    }));
    await db().ref(PATH).set(merged);
    return merged;
  }
  async function ensureFresh(options){
    const cfg = await read().catch(()=>normalizeConfig({}));
    const age = Date.now() - Number(cfg.refreshedAt || cfg.updatedAt || 0);
    const hasCache = countMap(cfg.schoolBreaksCache) || countMap(cfg.publicHolidaysCache);
    if(options && options.force) return refresh(options);
    if(!hasCache || age > (options && options.maxAgeMs || DEFAULT_MAX_AGE)) return refresh(options).catch(() => cfg);
    return cfg;
  }
  function dateTextarea(map){ return Object.keys(toBoolMap(map)).sort().join('\n'); }

  S.CalendarExclusions = { path:PATH, read, save, refresh, ensureFresh, effectiveMap, effectiveList, dateKey, dateTextarea, normalizeConfig };
})(window);
