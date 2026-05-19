/* ================================================================
   FTS SCHEDULES SERVICE — source de vérité des créneaux cours/RDV.
   V60 : lecture membre + écriture admin dans fts_schedules.
   ================================================================ */
(function(){
  'use strict';
  window.FTS = window.FTS || {};
  FTS.Services = FTS.Services || {};
  if(FTS.Services.Schedules) return;

  const PATH = 'fts_schedules';
  function db(){ return FTS.initFirebase ? FTS.initFirebase() : firebase.database(); }
  function now(){ return Date.now(); }
  function clean(v){ return String(v || '').trim(); }

  function normalizeSchedule(data){
    const d = data || {};
    return {
      id: clean(d.id),
      active: d.active !== false,
      kind: clean(d.kind || 'music_individual'),
      uid: clean(d.uid),
      recipientName: clean(d.recipientName),
      recipientEmail: clean(d.recipientEmail),
      targetCategory: clean(d.targetCategory),
      targetSubcategory: clean(d.targetSubcategory),
      title: clean(d.title || 'Créneau Fais Ton Show'),
      lessonType: clean(d.lessonType),
      teacher: clean(d.teacher),
      place: clean(d.place),
      durationMinutes: Number(d.durationMinutes || 30) || 30,
      recurrenceMode: clean(d.recurrenceMode || 'single'),
      startAt: Number(d.startAt || d.eventAt || 0) || 0,
      repeatUntil: Number(d.repeatUntil || 0) || 0,
      manualDates: Array.isArray(d.manualDates) ? d.manualDates.map(Number).filter(Boolean) : [],
      excludedDates: Array.isArray(d.excludedDates) ? d.excludedDates.map(String).filter(Boolean) : [],
      remindersEnabled: d.remindersEnabled === true,
      reminder24h: d.reminder24h === true,
      reminder1h: d.reminder1h === true,
      createdAt: Number(d.createdAt || 0) || 0,
      updatedAt: Number(d.updatedAt || 0) || 0,
      createdBy: clean(d.createdBy),
      source: clean(d.source || 'rappels-admin')
    };
  }

  async function create(data){
    const ref = db().ref(PATH).push();
    const payload = normalizeSchedule(Object.assign({}, data, {
      id: ref.key,
      createdAt: data.createdAt || now(),
      updatedAt: now()
    }));
    await ref.set(payload);
    return ref.key;
  }

  async function update(id, patch){
    if(!id) throw new Error('Missing schedule id');
    await db().ref(PATH + '/' + id).update(Object.assign({}, patch || {}, { updatedAt: now() }));
  }

  async function remove(id){
    if(!id) throw new Error('Missing schedule id');
    await db().ref(PATH + '/' + id).remove();
  }

  function listenAll(cb){
    const ref = db().ref(PATH);
    ref.on('value', snap => cb(snap.val() || {}));
    return function(){ ref.off(); };
  }

  async function all(){
    const snap = await db().ref(PATH).once('value');
    return snap.val() || {};
  }

  FTS.Services.Schedules = { path: PATH, create, update, remove, listenAll, all, normalizeSchedule };
})();
