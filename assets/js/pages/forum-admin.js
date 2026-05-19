/* ================================================================
   PAGE MODULE — FORUM-ADMIN
   Extrait depuis forum-admin.html pour supprimer le JavaScript inline.
   ================================================================ */

/* ================================================================
   FORUM-ADMIN.JS
   ✅ Firebase Auth remplace ADMIN_PWD = "admin2026"
   ✅ Double écriture fts_forum/users + fts_users à chaque action
   ✅ Synchronisation complète disciplines ↔ membres.html
   ================================================================ */

let db, firebaseOk    = false;
let allUsers          = {};
let allGroups         = [];
let currentMsgChannel = "general";
let currentAdminUser = null;
let currentAdminProfile = null;
const adminBusyActions = {};


/* ── EMAILS AUTOMATIQUES ───────────────────────────────────────
   Connecteur externe désactivé. La fonction reste présente pour ne
   pas casser les appels existants lors de l'inscription/validation. */
function sendFtsEmailAutomation(type, payload) {
  return Promise.resolve({ disabled:true, type, payload });
}

/* ── INIT ─────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function() {

  db = FTS.initFirebase();
  if (db) firebaseOk = true;

  firebase.auth().onAuthStateChanged(async function(user) {

    if (!user) {
      // Pas connecté → page de connexion
      window.location.href = "auth.html";
      return;
    }

    try {
      // Vérifier le rôle admin dans RTDB
      const snap    = await db.ref("fts_users/" + user.uid).once("value");
      const profile = snap.val();

      if (!profile || profile.role !== "admin") {
        // Connecté mais pas admin → espace membre
        window.location.href = "membres.html";
        return;
      }

      // ✅ Admin confirmé — afficher le dashboard
      currentAdminUser = user;
      currentAdminProfile = profile || {};
      document.getElementById("auth-loading").style.display = "none";
      document.getElementById("dashboard").style.display    = "block";
      await loadGroups();
      listenUsers();
      buildChannelSelector();

    } catch(e) {
      console.warn("[FTS Admin] Erreur :", e);
      window.location.href = "auth.html";
    }
  });
});

/* ── DÉCONNEXION ─────────────────────────────────────────────── */
function doLogout() {
  firebase.auth().signOut().then(() => {
    window.location.href = "auth.html";
  });
}

/* ── CHARGEMENT GROUPES ──────────────────────────────────────── */
async function loadGroups() {
  allGroups = [];
  try {
    const snap = await db.ref("fts_content/categories").once("value");
    const cats = snap.val() || {};
    Object.keys(cats).forEach(key => {
      const cat = cats[key] || {};
      if (cat.active === false) return;
      const catName = cat.name || key;
      allGroups.push({ cat: catName, sub: "" });
      const subcats = cat.subcats || {};
      Object.keys(subcats).forEach(sk => {
        const sub = subcats[sk] || {};
        if (sub.active === false) return;
        if (sub.name) allGroups.push({ cat: catName, sub: sub.name });
      });
    });
  } catch(e) {
    console.warn("[FTS Admin] Catégories Firebase indisponibles", e);
  }
}

function normList(arr) {
  return (Array.isArray(arr) ? arr : String(arr || '').split(','))
    .map(x => String(x || '').trim())
    .filter(Boolean);
}
function uniqList(list) {
  const seen = new Set();
  const out = [];
  normList(list).forEach(v => {
    const k = FTS.norm(v);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(v);
  });
  return out;
}
function childDisciplinesFrom(enfants) {
  return Array.isArray(enfants) ? enfants.flatMap(e => normList(e.disciplines || e.group || [])) : [];
}
function childSubgroupsFrom(enfants) {
  return Array.isArray(enfants) ? enfants.flatMap(e => normList(e.subgroups || e.subcategories || e.subgroup || [])) : [];
}
function buildSubgroupsByCatFromLists(cats, subs) {
  const result = {};
  normList(cats).forEach(cat => {
    const validSubs = allGroups.filter(g => g.cat === cat && g.sub).map(g => g.sub);
    result[cat] = normList(subs).filter(s => validSubs.includes(s));
  });
  return result;
}

function normalizeAdminUser(id, u) {
  u = u || {};
  const disciplines = normList(u.disciplines || u.group);
  const subgroups = normList(u.subgroups || u.subgroup);
  return {
    uid: id,
    name: u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Membre",
    email: u.email || "",
    firstName: u.firstName || "",
    lastName: u.lastName || "",
    telephone: u.telephone || "",
    role: u.role || "member",
    status: u.status || "pending",
    group: disciplines.join(", "),
    subgroup: subgroups.join(", "),
    disciplines,
    subgroups,
    hasEnfant: u.hasEnfant || false,
    enfants: Array.isArray(u.enfants) ? u.enfants : [],
    specialBadge: u.specialBadge || null,
    stats: u.stats || {},
    ts: u.createdAt || u.ts || Date.now(),
    reminderPrefs: u.reminderPrefs || {},
  };
}

function fmtChildBirthDate(value) {
  if (!value) return '';
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parts = raw.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  return raw;
}
function childInfoBits(e) {
  const bits = [];
  const date = fmtChildBirthDate(e && (e.dateNaissance || e.birthDate || e.dateNaissanceEnfant));
  if (date) bits.push('🎂 ' + date);
  if (e && e.telephone) bits.push('📞 ' + e.telephone);
  return bits;
}
function childInfoHtml(e) {
  const bits = childInfoBits(e);
  return bits.length ? '<span class="enfant-info"> · ' + FTS.esc(bits.join(' · ')) + '</span>' : '';
}

/* ── ÉCOUTE TEMPS RÉEL ───────────────────────────────────────── */
function listenUsers() {
  // Source officielle : fts_users.
  // Les nouveaux inscrits pending y sont créés immédiatement, même si la synchro forum est bloquée par les règles.
  db.ref("fts_users").on("value", async function(snap) {
    const raw = snap.val() || {};
    const forumSnap = await db.ref("fts_forum/users").once("value").catch(() => null);
    const forumUsers = forumSnap && forumSnap.val ? (forumSnap.val() || {}) : {};
    allUsers = {};
    Object.keys(raw).forEach(id => {
      allUsers[id] = normalizeAdminUser(id, Object.assign({}, raw[id], {
        specialBadge: (forumUsers[id] && forumUsers[id].specialBadge) || raw[id].specialBadge || null,
        stats: Object.assign({}, raw[id].stats || {}, (forumUsers[id] && forumUsers[id].stats) || {})
      }));
    });
    renderPending();
    renderMembers();
    renderCategorySummary();
    renderRewardsPanel();
  });
}

async function refreshAdminUsersOnce() {
  const snap = await db.ref("fts_users").once("value");
  const raw = snap.val() || {};
  const forumSnap = await db.ref("fts_forum/users").once("value").catch(() => null);
  const forumUsers = forumSnap && forumSnap.val ? (forumSnap.val() || {}) : {};
  allUsers = {};
  Object.keys(raw).forEach(id => {
    allUsers[id] = normalizeAdminUser(id, Object.assign({}, raw[id], {
      specialBadge: (forumUsers[id] && forumUsers[id].specialBadge) || raw[id].specialBadge || null,
      stats: Object.assign({}, raw[id].stats || {}, (forumUsers[id] && forumUsers[id].stats) || {})
    }));
  });
  renderPending();
  renderMembers();
  renderCategorySummary();
  renderRewardsPanel();
}

/* ── RENDU : EN ATTENTE ──────────────────────────────────────── */
function renderPending() {
  const pending = Object.entries(allUsers).filter(([id, u]) => u.status === "pending");
  document.getElementById("badge-pending").textContent = pending.length;
  const list = document.getElementById("pending-list");

  if (!pending.length) {
    list.innerHTML = '<div class="empty-msg">Aucune demande en attente.</div>';
    return;
  }

  list.innerHTML = pending.map(([id, u]) => `
    <div class="user-card">
      <div class="user-avatar pending">${FTS.esc(u.name.charAt(0))}</div>
      <div class="user-info">
        <div class="user-name">
          ${FTS.esc(u.name)}
          <span class="role-badge role-${u.role||'member'}">${roleLabel(u.role)}</span>
        </div>
        <div class="user-meta">${FTS.esc(u.email)}${u.telephone ? ' · 📞 ' + FTS.esc(u.telephone) : ''} · ${fmtDate(u.ts)}</div>
        <div class="user-group">
          ${FTS.esc(u.group || "Aucune discipline")}${u.subgroup ? " — " + FTS.esc(u.subgroup) : ""}
        </div>
        ${adminReminderPrefsSummary(u) ? `<div class="user-reminder-summary">${adminReminderPrefsSummary(u)}</div>` : ''}
        ${u.hasEnfant && u.enfants.length ? u.enfants.map(e =>
          `<span class="enfant-tag">🎩 ${FTS.esc(e.prenom||'')} ${FTS.esc(e.nom||'')}${childInfoHtml(e)}${e.disciplines && e.disciplines.length ? ' · ' + FTS.esc(e.disciplines.join(', ')) : ''}</span>`
        ).join('') : ''}
      </div>
      <div class="user-actions">
        <button class="btn-action btn-approve" data-fts-click="approveUser('${id}')">✓ Valider</button>
        <button class="btn-action btn-modify"  data-fts-click="openModModal('${id}')">✎ Modifier</button>
        <button class="btn-action btn-refuse"  data-fts-click="refuseUser('${id}')">✕ Refuser</button>
      </div>
    </div>`).join("");
}

/* ── RENDU : MEMBRES ACTIFS ──────────────────────────────────── */
function renderMembers() {
  const members = Object.entries(allUsers).filter(([id, u]) =>
    u.status === "active" || u.status === "refused"
  );
  document.getElementById("badge-members").textContent =
    members.filter(([id, u]) => u.status === "active").length;

  const list = document.getElementById("members-list");
  list.innerHTML = members.map(([id, u]) => `
    <div class="user-card">
      <div class="user-avatar ${u.status === "refused" ? "refused" : ""}">${FTS.esc(u.name.charAt(0))}</div>
      <div class="user-info">
        <div class="user-name">
          ${FTS.esc(u.name)}
          <span class="status-badge status-${u.status}">${u.status}</span>
          <span class="role-badge role-${u.role||'member'}">${roleLabel(u.role)}</span>
        </div>
        ${u.telephone ? `<div class="user-meta">📞 ${FTS.esc(u.telephone)}</div>` : ''}
        <div class="user-group">
          ${FTS.esc(u.group || "—")}${u.subgroup ? " — " + FTS.esc(u.subgroup) : ""}
        </div>
        ${u.hasEnfant && u.enfants.length ? u.enfants.map(e =>
          `<span class="enfant-tag">🎩 ${FTS.esc(e.prenom||'')} ${FTS.esc(e.nom||'')}${childInfoHtml(e)}${e.disciplines && e.disciplines.length ? ' · ' + FTS.esc(e.disciplines.join(', ')) : ''}</span>`
        ).join('') : ''}
      </div>
      <div class="user-actions">
        <button class="btn-action btn-modify" data-fts-click="openModModal('${id}')">✎ Éditer</button>
        <button class="btn-action btn-revoke" data-fts-click="revokeUser('${id}')">✕ Révoquer</button>
      </div>
    </div>`).join("");
}


/* ── RÉSUMÉ CATÉGORIES / SOUS-CATÉGORIES ────────────────────────
   Lecture seule : aucun changement Firebase.
   Comptage des personnes actives : compte principal + enfants.
─────────────────────────────────────────────────────────────── */
function getKnownCategories() {
  return [...new Set(allGroups.map(g => g.cat).filter(Boolean))];
}
function getKnownSubcatsFor(cat) {
  return [...new Set(allGroups.filter(g => g.cat === cat && g.sub).map(g => g.sub).filter(Boolean))];
}
function safeSubgroupsByCat(personCats, personSubs, explicitMap) {
  const out = {};
  const map = explicitMap && typeof explicitMap === 'object' ? explicitMap : {};
  normList(personCats).forEach(cat => {
    const valid = getKnownSubcatsFor(cat);
    const explicit = normList(map[cat]);
    const fallback = normList(personSubs).filter(s => valid.includes(s));
    out[cat] = uniqList(explicit.length ? explicit : fallback);
  });
  return out;
}
function getPeopleFromUser(u) {
  const people = [];
  const parentCats = normList(u.disciplines || u.group);
  const parentSubs = normList(u.subgroups || u.subgroup);
  if (parentCats.length || parentSubs.length) {
    people.push({
      cats: parentCats,
      subs: parentSubs,
      byCat: safeSubgroupsByCat(parentCats, parentSubs, u.subgroupsByCat),
    });
  }

  (Array.isArray(u.enfants) ? u.enfants : []).forEach(e => {
    const childCats = normList(e.disciplines || e.group);
    const childSubs = normList(e.subgroups || e.subcategories || e.subgroup);
    if (!childCats.length && !childSubs.length) return;
    people.push({
      cats: childCats,
      subs: childSubs,
      byCat: safeSubgroupsByCat(childCats, childSubs, e.subgroupsByCat),
    });
  });
  return people;
}
function pluralPeople(n) {
  return n > 1 ? n + " personnes" : n + " personne";
}
function renderCategorySummary() {
  const wrap = document.getElementById("category-summary");
  const totalEl = document.getElementById("summary-total-people");
  if (!wrap) return;

  const cats = getKnownCategories();
  const stats = {};
  cats.forEach(cat => {
    stats[cat] = { total: 0, subcats: {} };
    getKnownSubcatsFor(cat).forEach(sub => { stats[cat].subcats[sub] = 0; });
  });

  let totalPeople = 0;
  Object.values(allUsers || {}).forEach(u => {
    if (!u || u.status !== "active") return;
    const people = getPeopleFromUser(u);
    totalPeople += people.length;

    people.forEach(person => {
      uniqList(person.cats).forEach(cat => {
        if (!stats[cat]) stats[cat] = { total: 0, subcats: {} };
        stats[cat].total += 1;

        const subsForCat = safeSubgroupsByCat([cat], person.subs, person.byCat)[cat] || [];
        uniqList(subsForCat).forEach(sub => {
          stats[cat].subcats[sub] = (stats[cat].subcats[sub] || 0) + 1;
        });
      });
    });
  });

  if (totalEl) totalEl.textContent = pluralPeople(totalPeople);

  const visibleCats = Object.entries(stats)
    .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], 'fr'));

  if (!visibleCats.length) {
    wrap.innerHTML = '<div class="empty-msg">Aucune catégorie configurée.</div>';
    return;
  }

  wrap.innerHTML = visibleCats.map(([cat, stat]) => {
    const subs = Object.entries(stat.subcats || {})
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
    return `<article class="summary-card">
      <div class="summary-card-top">
        <strong>${FTS.esc(cat)}</strong>
        <span>${pluralPeople(stat.total)}</span>
      </div>
      ${subs.length ? `<div class="summary-sublist">
        ${subs.map(([sub, count]) => `<div class="summary-subrow"><span>${FTS.esc(sub)}</span><b>${count}</b></div>`).join('')}
      </div>` : '<div class="summary-empty-sub">Pas de sous-catégorie configurée.</div>'}
    </article>`;
  }).join('');
}


/* ── VALIDATION + RAPPELS DEMANDÉS À L'INSCRIPTION ──────────────
   Ajout léger : uniquement si fts_users/{uid}/reminderPrefs contient
   des demandes 24h/1h. Crée les mêmes branches que rappels-admin :
   fts_schedules + fts_scheduled_reminders. Ne touche pas à fts_dm.
─────────────────────────────────────────────────────────────── */
function reminderNormKey(value){
  if(window.FTS && typeof FTS.norm === 'function') return FTS.norm(value || '');
  return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function reminderPrefRows(u){
  const prefs = u && u.reminderPrefs && typeof u.reminderPrefs === 'object' ? u.reminderPrefs : {};
  return Object.entries(prefs).map(([key, p]) => ({ key, ...(p || {}) }))
    .filter(p => p && (p.reminder24h || p.reminder1h))
    .sort((a,b)=>String(a.courseLabel||'').localeCompare(String(b.courseLabel||''),'fr'));
}
function adminReminderPrefsSummary(u){
  const rows = reminderPrefRows(u);
  if(!rows.length) return '';
  const short = rows.slice(0,3).map(p => {
    const bits = [];
    if(p.reminder24h) bits.push('24h');
    if(p.reminder1h) bits.push('1h');
    return `🔔 ${FTS.esc(p.courseLabel || p.category || 'Cours')} <span>${FTS.esc(bits.join(' + '))}</span>`;
  }).join(' ');
  return short + (rows.length > 3 ? ` <em>+${rows.length-3}</em>` : '');
}
function firstNameOfUser(u){
  return (u && (u.firstName || String(u.name||'').split(' ')[0] || u.email || '')) || '';
}
function formatApprovalDateTime(ts){
  if(!ts) return 'date à définir';
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}
function localDateTimeToTs(value){
  if(!value) return 0;
  const d = new Date(value);
  const ts = d.getTime();
  return Number.isFinite(ts) ? ts : 0;
}
function addDays(ts, days){ return ts + days * 24 * 60 * 60 * 1000; }
function parseExcludedDateSet(text){
  const set = new Set();
  String(text || '').split(/\n|,|;/).map(x=>x.trim()).filter(Boolean).forEach(x=>{
    const m = x.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m) set.add(x);
  });
  return set;
}
function dateKey(ts){
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function buildApprovalOccurrences(startAt, intervalDays, count, excludedText){
  const out = [];
  const excluded = parseExcludedDateSet(excludedText);
  let cursor = startAt;
  let guard = 0;
  while(out.length < count && guard < 120){
    if(!excluded.has(dateKey(cursor))) out.push(cursor);
    cursor = addDays(cursor, intervalDays);
    guard++;
  }
  return out;
}
function approvalOffsetsFromPref(pref){
  const offsets = [];
  if(pref.reminder24h) offsets.push(24*60);
  if(pref.reminder1h) offsets.push(60);
  return offsets;
}
function reminderTitleFromPref(pref){
  const label = pref.courseLabel || [pref.category, pref.subcategory].filter(Boolean).join(' — ') || 'cours';
  return 'Cours de ' + label;
}
function reminderBodyFromPref(user, pref, eventAt, offset, extra){
  const before = offset === 60 ? 'commence dans 1h' : 'est prévu demain';
  const parentFirst = firstNameOfUser(user) || 'Bonjour';
  const course = pref.courseLabel || [pref.category, pref.subcategory].filter(Boolean).join(' — ') || 'cours';
  const childName = pref.childName || (pref.ownerType === 'child' ? pref.ownerName : '');
  const lines = [];
  lines.push(`Bonjour ${parentFirst},`);
  if(pref.ownerType === 'child' && childName){
    lines.push(`le cours de ${course} de ${childName} ${before}.`);
  }else{
    lines.push(`ton cours de ${course} ${before}.`);
  }
  lines.push(`📅 ${formatApprovalDateTime(eventAt)}`);
  if(extra) lines.push(extra);
  return lines.join('\n');
}
async function createApprovalPlanningAndReminders(uid, user, pref, cfg){
  const startAt = localDateTimeToTs(cfg.startAt);
  if(!startAt) throw new Error('Date/heure invalide pour ' + (pref.courseLabel || 'un cours'));
  const count = Math.max(1, Math.min(60, parseInt(cfg.count || '1', 10) || 1));
  const intervalDays = parseInt(cfg.intervalDays || '7', 10) || 7;
  const duration = Math.max(5, parseInt(cfg.duration || '60', 10) || 60);
  const offsets = approvalOffsetsFromPref(pref);
  if(!offsets.length) return { scheduleId:null, reminders:0 };
  const occurrences = buildApprovalOccurrences(startAt, intervalDays, count, cfg.excludedDates || '');
  const now = Date.now();
  const scheduleRef = db.ref('fts_schedules').push();
  const scheduleId = scheduleRef.key;
  const schedulePayload = {
    id: scheduleId,
    active: true,
    kind: 'music_individual',
    uid,
    recipientName: user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || '',
    recipientEmail: user.email || '',
    title: reminderTitleFromPref(pref),
    courseLabel: pref.courseLabel || '',
    courseOwnerType: pref.ownerType || '',
    courseOwnerName: pref.ownerName || '',
    childId: pref.childId || pref.ownerId || '',
    childName: pref.childName || (pref.ownerType === 'child' ? pref.ownerName : ''),
    targetCategory: '',
    targetSubcategory: '',
    lessonType: pref.subcategory || pref.category || pref.courseLabel || '',
    durationMinutes: duration,
    recurrenceMode: intervalDays === 14 ? 'biweekly' : intervalDays === 21 ? 'triweekly' : 'weekly',
    startAt,
    occurrenceCount: count,
    intervalDays,
    generatedOccurrences: occurrences,
    excludedDates: Array.from(parseExcludedDateSet(cfg.excludedDates || '')),
    remindersEnabled: true,
    reminder24h: !!pref.reminder24h,
    reminder1h: !!pref.reminder1h,
    reminderPrefsApplied: { reminder24h: !!pref.reminder24h, reminder1h: !!pref.reminder1h },
    source: 'forum-admin-approval',
    createdAt: now,
    updatedAt: now,
    createdBy: currentAdminUser ? currentAdminUser.uid : '',
    createdByName: currentAdminProfile ? (currentAdminProfile.name || currentAdminProfile.firstName || 'Admin') : 'Admin'
  };
  await scheduleRef.set(schedulePayload);
  const seriesId = db.ref('fts_scheduled_reminders').push().key || ('series_' + now);
  let created = 0;
  for(const eventAt of occurrences){
    for(const offset of offsets){
      const sendAt = eventAt - offset * 60 * 1000;
      if(sendAt <= now) continue;
      const payload = {
        kind: 'music_individual',
        uid,
        recipientName: schedulePayload.recipientName,
        recipientEmail: schedulePayload.recipientEmail,
        title: schedulePayload.title,
        courseLabel: schedulePayload.courseLabel,
        courseOwnerType: schedulePayload.courseOwnerType,
        courseOwnerName: schedulePayload.courseOwnerName,
        childId: schedulePayload.childId,
        childName: schedulePayload.childName,
        body: reminderBodyFromPref(user, pref, eventAt, offset, cfg.note || ''),
        lessonType: schedulePayload.lessonType,
        durationMinutes: duration,
        eventAt,
        sendAt,
        reminderOffsetMinutes: offset,
        status: 'pending',
        auto: true,
        bot: true,
        channel: 'dm_auto',
        messageType: 'auto-reminder',
        botLabel: 'Rappel automatique Fais Ton Show',
        createdAt: now,
        updatedAt: now,
        createdBy: schedulePayload.createdBy,
        createdByName: schedulePayload.createdByName,
        dispatchMode: 'native-admin',
        seriesId,
        scheduleId,
        source: 'forum-admin-approval',
        recurrenceMode: schedulePayload.recurrenceMode,
        excludedDatesText: cfg.excludedDates || ''
      };
      await db.ref('fts_scheduled_reminders').push(payload);
      created++;
    }
  }
  return { scheduleId, reminders:created };
}
function ensureApprovalReminderModal(){
  let overlay = document.getElementById('approval-reminder-modal');
  if(overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'approval-reminder-modal';
  overlay.className = 'modal-overlay hidden approval-reminder-overlay';
  overlay.innerHTML = `<div class="modal approval-reminder-modal">
    <h3>Préparer les rappels demandés</h3>
    <p class="approval-reminder-intro">Ce membre a demandé des rappels à l'inscription. Renseigne rapidement le jour et l'heure des cours concernés, puis valide l'inscription.</p>
    <div id="approval-reminder-list"></div>
    <div class="modal-row approval-reminder-actions">
      <button class="btn-cancel" type="button" data-approval-action="cancel">Annuler</button>
      <button class="btn-action" type="button" data-approval-action="skip">Valider sans créer de rappels</button>
      <button class="btn-confirm" type="button" data-approval-action="create">Créer rappels + valider</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  return overlay;
}
function nextLocalDatetimeValue(){
  const d = new Date(Date.now() + 24*60*60*1000);
  d.setMinutes(0,0,0);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function openApprovalReminderModalIfNeeded(uid, user){
  const prefs = reminderPrefRows(user);
  if(!prefs.length) return Promise.resolve('skip');
  return new Promise(resolve => {
    const overlay = ensureApprovalReminderModal();
    const list = document.getElementById('approval-reminder-list');
    const defaultDate = nextLocalDatetimeValue();
    list.innerHTML = prefs.map((p, idx) => {
      const bits = [];
      if(p.reminder24h) bits.push('24h');
      if(p.reminder1h) bits.push('1h');
      const owner = p.ownerType === 'child' ? (p.childName || p.ownerName || 'Enfant') : (user.firstName || user.name || 'Adhérent');
      return `<article class="approval-reminder-card" data-pref-index="${idx}">
        <div class="approval-reminder-card-head">
          <div><strong>${FTS.esc(p.courseLabel || p.category || 'Cours')}</strong><span>${FTS.esc(owner)} · ${FTS.esc(bits.join(' + '))}</span></div>
          <label class="approval-enable"><input type="checkbox" data-field="enabled" checked> Créer</label>
        </div>
        <div class="approval-reminder-grid">
          <label><span>Premier cours</span><input type="datetime-local" data-field="startAt" value="${defaultDate}"></label>
          <label><span>Fréquence</span><select data-field="intervalDays"><option value="7">Chaque semaine</option><option value="14">Tous les 15 jours</option><option value="21">Toutes les 3 semaines</option></select></label>
          <label><span>Nombre de séances</span><select data-field="count"><option value="31">31 séances</option><option value="30">30 séances</option><option value="10">10 séances</option><option value="5">5 séances</option><option value="1">1 séance</option></select></label>
          <label><span>Durée</span><select data-field="duration"><option value="30">30 min</option><option value="45">45 min</option><option value="60" selected>1h</option><option value="90">1h30</option></select></label>
        </div>
        <label class="approval-full"><span>Dates à exclure, optionnel</span><textarea data-field="excludedDates" rows="2" placeholder="2026-10-21\n2026-10-28"></textarea></label>
        <label class="approval-full"><span>Note ajoutée aux rappels, optionnel</span><input data-field="note" placeholder="Ex : Pensez au carnet / partitions…"></label>
      </article>`;
    }).join('');
    overlay.classList.remove('hidden');
    const cleanup = () => {
      overlay.classList.add('hidden');
      overlay.onclick = null;
    };
    overlay.onclick = async ev => {
      const btn = ev.target.closest('[data-approval-action]');
      if(!btn) return;
      const action = btn.dataset.approvalAction;
      if(action === 'cancel'){ cleanup(); resolve('cancel'); return; }
      if(action === 'skip'){ cleanup(); resolve('skip'); return; }
      if(action === 'create'){
        btn.disabled = true;
        const old = btn.textContent;
        btn.textContent = 'Création…';
        try{
          let total = 0;
          const cards = Array.from(list.querySelectorAll('.approval-reminder-card'));
          for(const card of cards){
            const idx = parseInt(card.dataset.prefIndex, 10);
            const pref = prefs[idx];
            if(!card.querySelector('[data-field="enabled"]')?.checked) continue;
            const val = field => card.querySelector(`[data-field="${field}"]`)?.value || '';
            const result = await createApprovalPlanningAndReminders(uid, user, pref, {
              startAt: val('startAt'), intervalDays: val('intervalDays'), count: val('count'), duration: val('duration'), excludedDates: val('excludedDates'), note: val('note')
            });
            total += result.reminders || 0;
          }
          cleanup();
          if(total) alert(total + ' rappel(s) créé(s). Validation du membre en cours.');
          resolve('created');
        }catch(e){
          console.warn('[FTS Admin approval reminders]', e);
          alert('Impossible de créer les rappels : ' + (e && e.message ? e.message : e));
          btn.disabled = false;
          btn.textContent = old;
        }
      }
    };
  });
}

/* ── ACTIONS UTILISATEURS ────────────────────────────────────────
   ✅ Double écriture : fts_forum/users + fts_users
   C'est ce qui synchronise membres.html et forum.html
─────────────────────────────────────────────────────────────── */
async function syncForumUser(id, statusOverride) {
  const u = allUsers[id] || {};
  const parentGroups = normList(u.disciplines || u.group);
  const parentSubs = normList(u.subgroups || u.subgroup);
  const enfants = Array.isArray(u.enfants) ? u.enfants : [];
  const allForumDiscs = uniqList([...parentGroups, ...childDisciplinesFrom(enfants)]);
  const allForumSubs = uniqList([...parentSubs, ...childSubgroupsFrom(enfants)]);
  await db.ref("fts_forum/users/" + id).update({
    name:      u.name || "Membre",
    group:     allForumDiscs.join(", "),
    groups:    allForumDiscs,
    subgroup:  allForumSubs.join(", "),
    subgroups: allForumSubs,
    subgroupsByCat: buildSubgroupsByCatFromLists(allForumDiscs, allForumSubs),
    role:      u.role || "member",
    status:    statusOverride || u.status || "active",
    ts:        Date.now(),
  });
}

async function approveUser(id) {
  const busyKey = 'approveUser:' + id;
  if(adminBusyActions[busyKey]) return;
  adminBusyActions[busyKey] = true;
  try{
    const u = allUsers[id] || {};

    // Si le membre a demandé des rappels à l'inscription, on propose immédiatement
    // de préparer le planning/rappels AVANT validation finale. L'admin peut ignorer.
    const reminderResult = await openApprovalReminderModalIfNeeded(id, u);
    if(reminderResult === 'cancel') return;

    // Source officielle : fts_users
    await db.ref("fts_users/" + id + "/status").set("active");
    // Compatibilité forum : création/mise à jour du profil forum au moment de la validation
    await syncForumUser(id, "active");

    // Mail membre : compte validé
    if (u.email) {
      sendFtsEmailAutomation('account_validated', {
        uid: id,
        name: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || 'membre',
        email: u.email,
      });
    }
  }catch(e){
    alert('Impossible de valider cet utilisateur : ' + (e && e.message ? e.message : e));
  }finally{
    adminBusyActions[busyKey] = false;
  }
}

async function refuseUser(id) {
  if (!confirm("Refuser cet utilisateur ?")) return;
  const busyKey = 'refuseUser:' + id;
  if(adminBusyActions[busyKey]) return;
  adminBusyActions[busyKey] = true;
  try{
    await db.ref("fts_users/" + id + "/status").set("refused");
    await syncForumUser(id, "refused");
  }catch(e){
    alert('Impossible de refuser cet utilisateur : ' + (e && e.message ? e.message : e));
  }finally{
    adminBusyActions[busyKey] = false;
  }
}

async function revokeUser(id) {
  if (!confirm("Révoquer cet utilisateur ?")) return;
  const busyKey = 'revokeUser:' + id;
  if(adminBusyActions[busyKey]) return;
  adminBusyActions[busyKey] = true;
  try{
    await db.ref("fts_users/" + id + "/status").set("refused");
    await syncForumUser(id, "refused");
  }catch(e){
    alert('Impossible de révoquer cet utilisateur : ' + (e && e.message ? e.message : e));
  }finally{
    adminBusyActions[busyKey] = false;
  }
}

/* ── RÔLES ───────────────────────────────────────────────────── */
function roleLabel(role) {
  const map = { admin: "🛡 Admin", prof: "🎓 Prof", member: "👤 Membre" };
  return map[role] || "👤 Membre";
}

function selectRole(el) {
  document.querySelectorAll(".role-pill").forEach(p => {
    p.className = "role-pill";
  });
  const role = el.dataset.role;
  el.classList.add("active-" + role);
}

/* ── MODALE MODIFICATION ─────────────────────────────────────── */
function getActivePillValues(selector) {
  return Array.from(document.querySelectorAll(selector))
    .filter(p => p.classList.contains("active"))
    .map(p => (p.dataset.value || p.textContent || "").trim())
    .filter(Boolean);
}

function pillHtml(label, active, type) {
  return `<div class="pill ${active ? "active" : ""}" data-value="${FTS.esc(label)}" data-fts-click="toggleModPill(this,'${type}')">${FTS.esc(label)}</div>`;
}

function openModModal(id) {
  const u = allUsers[id];
  if (!u) return;

  const uCats = normList(u.disciplines || u.group);

  const uSubs = normList(u.subgroups || u.subgroup);

  const cats = [...new Set(allGroups.map(g => g.cat).filter(Boolean))];
  const role = u.role || "member";

  document.getElementById("mod-uid").value = id;

  // Sélecteur de rôle
  document.querySelectorAll(".role-pill").forEach(p => {
    p.className = "role-pill";
    if (p.dataset.role === role) p.classList.add("active-" + role);
  });

  // Disciplines du compte principal (parent ou adulte)
  const labelParent = u.hasEnfant && u.enfants.length
    ? `Discipline(s) du parent — <span class="mod-parent-name">${FTS.esc(u.name)}</span>`
    : "Discipline(s) — clique pour sélectionner";
  document.querySelector("label[for=''].modal-label, #mod-modal .modal-label")
    || document.querySelectorAll("#mod-modal .modal-label")[0];
  // met à jour le label discipline
  const discLabel = document.querySelectorAll("#mod-modal .modal-label")[1];
  if (discLabel) discLabel.innerHTML = labelParent;

  document.getElementById("mod-cat-pills").innerHTML = cats
    .map(c => pillHtml(c, uCats.includes(c), "cat"))
    .join("");

  updateModSubGroups(uSubs);

  // Section enfants
  const enfantsSection = document.getElementById("mod-enfants-section");
  const enfantsBlocks  = document.getElementById("mod-enfants-blocks");

  if (u.hasEnfant && u.enfants.length) {
    enfantsSection.style.display = "block";
    enfantsBlocks.innerHTML = u.enfants.map((e, i) => {
      const eCats = Array.isArray(e.disciplines) ? e.disciplines : [];
      return `
        <div class="modal-enfant-block">
          <div class="modal-enfant-title">🎩 Enfant ${i+1} — ${FTS.esc(e.prenom||'')} ${FTS.esc(e.nom||'')}${childInfoHtml(e)}</div>
          <div class="pill-container mod-enfant-pills" id="mod-enfant-pills-${i}">
            ${cats.map(c => `<div class="pill ${eCats.includes(c) ? 'active' : ''}"
              data-value="${FTS.esc(c)}" data-enfant="${i}"
              data-fts-click="toggleEnfantPill(this, ${i})">${FTS.esc(c)}</div>`).join('')}
          </div>
          <div id="mod-enfant-subcats-${i}"></div>
        </div>`;
    }).join("");

    // Afficher les sous-catégories existantes de chaque enfant
    u.enfants.forEach((e, i) => {
      const eSubs = normList(e.subgroups || e.subgroup);
      updateModEnfantSubcats(i, eSubs);
    });
  } else {
    enfantsSection.style.display = "none";
    enfantsBlocks.innerHTML = "";
  }

  document.getElementById("mod-modal").classList.remove("hidden");
}

function toggleModPill(el, type) {
  el.classList.toggle("active");
  if (type === "cat") {
    const activeSubs = getActivePillValues(".mod-sub-pills .pill.active");
    updateModSubGroups(activeSubs);
  }
}

function toggleEnfantPill(el, enfantIdx) {
  el.classList.toggle("active");
  // Rafraîchir les sous-catégories de cet enfant
  const currentSubs = getActivePillValues("#mod-enfant-subcats-" + enfantIdx + " .pill.active");
  updateModEnfantSubcats(enfantIdx, currentSubs);
}

function updateModEnfantSubcats(enfantIdx, selectedSubs = []) {
  const wrap = document.getElementById("mod-enfant-subcats-" + enfantIdx);
  if (!wrap) return;
  const activeCats = getActivePillValues("#mod-enfant-pills-" + enfantIdx + " .pill.active");
  if (!activeCats.length) { wrap.innerHTML = ""; return; }

  wrap.innerHTML = activeCats.map(cat => {
    const subs = [...new Set(allGroups
      .filter(g => g.cat === cat && g.sub)
      .map(g => g.sub)
      .filter(Boolean)
    )];
    if (!subs.length) {
      return `<div class="sub-group">
        <div class="sub-group-lbl">${FTS.esc(cat)}</div>
        <p class="no-sub-note">Pas de créneau spécifique.</p>
      </div>`;
    }
    return `<div class="sub-group">
      <div class="sub-group-lbl">${FTS.esc(cat)}</div>
      <div class="pill-container">
        ${subs.map(s => `<div class="pill ${selectedSubs.includes(s) ? 'active' : ''}"
          data-value="${FTS.esc(s)}"
          data-fts-click="toggleEnfantSubPill(this)">${FTS.esc(s)}</div>`).join('')}
      </div>
    </div>`;
  }).join("");
}

function toggleEnfantSubPill(el) {
  el.classList.toggle("active");
}

function updateModSubGroups(selectedSubs = []) {
  const activeCats = getActivePillValues("#mod-cat-pills .pill.active");
  const wrap = document.getElementById("mod-sub-groups");

  if (!activeCats.length) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = activeCats.map(cat => {
    const subs = [...new Set(allGroups
      .filter(g => g.cat === cat && g.sub)
      .map(g => g.sub)
      .filter(Boolean)
    )];

    if (!subs.length) {
      return `<div class="sub-group">
        <div class="sub-group-lbl">${FTS.esc(cat)}</div>
        <p class="no-sub-note">Pas de créneau spécifique.</p>
      </div>`;
    }

    return `<div class="sub-group" data-cat="${FTS.esc(cat)}">
      <div class="sub-group-lbl">${FTS.esc(cat)}</div>
      <div class="pill-container mod-sub-pills">
        ${subs.map(s => pillHtml(s, selectedSubs.includes(s), "sub")).join("")}
      </div>
    </div>`;
  }).join("");
}

function buildSubgroupsByCat(cats, subs) {
  const result = {};
  cats.forEach(cat => {
    const validSubs = allGroups
      .filter(g => g.cat === cat && g.sub)
      .map(g => g.sub);
    result[cat] = subs.filter(s => validSubs.includes(s));
  });
  return result;
}

async function saveModification() {
  const id = document.getElementById("mod-uid").value;
  if (!id) return;

  const cats = getActivePillValues("#mod-cat-pills .pill.active");
  const subs = getActivePillValues(".mod-sub-pills .pill.active");

  // Rôle sélectionné
  const activePill = document.querySelector(".role-pill[class*='active-']");
  const role = activePill ? activePill.dataset.role : "member";
  const subgroupsByCat = buildSubgroupsByCat(cats, subs);

  // Disciplines des enfants (si applicable)
  const u = allUsers[id] || {};
  let enfants = Array.isArray(u.enfants) ? [...u.enfants] : [];
  if (u.hasEnfant && enfants.length) {
    enfants = enfants.map((e, i) => {
      const eCats = Array.from(
        document.querySelectorAll(`#mod-enfant-pills-${i} .pill.active`)
      ).map(p => (p.dataset.value || p.textContent || "").trim()).filter(Boolean);

      const eSubs = Array.from(
        document.querySelectorAll(`#mod-enfant-subcats-${i} .pill.active`)
      ).map(p => (p.dataset.value || "").trim()).filter(Boolean);

      return { ...e, disciplines: eCats, subgroups: eSubs, subgroup: eSubs.join(", ") };
    });
  }

  const userUpdate = {
    disciplines: cats,
    group: cats.join(", "),
    subgroups: subs,
    subgroup: subs.join(", "),
    subgroupsByCat,
    status: "active",
    role,
    updatedAt: Date.now(),
  };
  if (u.hasEnfant) {
    userUpdate.hasEnfant = true;
    userUpdate.enfants   = enfants;
  }

  // Union parent + enfants pour le profil forum
  const childDiscs = childDisciplinesFrom(enfants);
  const childSubs  = childSubgroupsFrom(enfants);
  const allForumDiscs = uniqList([...cats, ...childDiscs]);
  const allForumSubs  = uniqList([...subs, ...childSubs]);
  const forumSubgroupsByCat = buildSubgroupsByCatFromLists(allForumDiscs, allForumSubs);

  const forumUpdate = {
    name: allUsers[id]?.name || "Membre",
    group:         allForumDiscs.join(", "),
    groups:        allForumDiscs,
    subgroup:      allForumSubs.join(", "),
    subgroups:     allForumSubs,
    subgroupsByCat: forumSubgroupsByCat,
    status: "active",
    role,
    ts: Date.now(),
  };

  try {
    await db.ref().update({
      ["fts_users/" + id]: { ...(allUsers[id] || {}), ...userUpdate },
      ["fts_forum/users/" + id]: forumUpdate,
    });

    allUsers[id] = normalizeAdminUser(id, { ...(allUsers[id] || {}), ...userUpdate });
    renderPending();
    renderMembers();
    closeModModal();
  } catch (e) {
    console.warn("[FTS Admin] Sauvegarde accès impossible", e);
    alert("Impossible d'enregistrer les accès : " + (e && e.message ? e.message : e));
  }
}

function closeModModal() { document.getElementById("mod-modal").classList.add("hidden"); }


/* ── RÉCOMPENSES / GAMIFICATION ─────────────────────────────── */
function activeMembersForRewards() {
  return Object.entries(allUsers || {})
    .filter(([id, u]) => u && u.status === 'active')
    .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'fr'));
}

function makeRewardOptionValue(uid, childId) {
  return childId ? `${uid}::${childId}` : uid;
}

function parseRewardOptionValue(value) {
  const parts = String(value || '').split('::');
  return { uid: parts[0] || '', childId: parts[1] || '' };
}

function rewardChildName(e) {
  e = e || {};
  return (
    e.name ||
    [e.firstName, e.lastName].filter(Boolean).join(' ') ||
    [e.prenom, e.nom].filter(Boolean).join(' ') ||
    e.fullName ||
    e.label ||
    'Enfant'
  );
}

function rewardDisplayNameForAdmin(u) {
  u = u || {};
  return u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Membre';
}

function buildRewardOptionsForAdmin() {
  const rows = [];
  activeMembersForRewards().forEach(([uid, u]) => {
    if (!u || u.role === 'admin' || u.role === 'prof') return;
    const parentName = rewardDisplayNameForAdmin(u);
    rows.push({ uid, optionValue: makeRewardOptionValue(uid, ''), label: parentName, parentName, isChild: false, specialBadge: u.specialBadge || null });
    const children = Array.isArray(u.enfants) ? u.enfants : [];
    children.forEach((e, index) => {
      const childId = e.id || e.uid || e.key || `enfant_${index + 1}`;
      const childName = rewardChildName(e);
      rows.push({
        uid, childId, childName, optionValue: makeRewardOptionValue(uid, childId),
        label: `${childName} · enfant de ${parentName}`, parentName, isChild: true, specialBadge: u.specialBadge || null
      });
    });
  });
  return rows.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'fr'));
}

function rewardNameFromBadge(uid, u) {
  const b = (u && u.specialBadge) || {};
  if (b.publicName) return b.publicName;
  if (b.childName) return b.childName;
  const reason = String(b.reason || '');
  const m = reason.match(/^Pour\s+([^·]+)/i);
  if (m && m[1]) return m[1].trim();
  return (u && (u.name || u.email)) || 'Membre';
}

function rewardUntilText(until) {
  if (!until) return 'Durée inconnue';
  try {
    return 'jusqu’au ' + new Date(Number(until)).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch(e) { return 'Durée inconnue'; }
}

function getActiveRewardsForAdmin() {
  const now = Date.now();
  return Object.entries(allUsers || {})
    .filter(([id, u]) => u && u.specialBadge && u.specialBadge.label && (!u.specialBadge.until || Number(u.specialBadge.until) > now))
    .sort((a, b) => Number(a[1].specialBadge.until || 0) - Number(b[1].specialBadge.until || 0));
}

function renderRewardHistoryPanel() {
  const box = document.getElementById('rewards-history');
  if (!box) return;
  const items = getActiveRewardsForAdmin();
  if (!items.length) {
    box.innerHTML = '<div class="rewards-history-empty">Aucune récompense temporaire active pour le moment.</div>';
    return;
  }
  box.innerHTML = `
    <div class="rewards-history-head">
      <strong>Récompenses en cours</strong>
      <small>${items.length} active${items.length > 1 ? 's' : ''}</small>
    </div>
    <div class="rewards-history-list">
      ${items.map(([uid, u]) => {
        const b = u.specialBadge || {};
        const isArtist = b.kind === 'artist' || String(b.label || '').includes('Artiste de la semaine');
        return `
          <div class="reward-history-item ${isArtist ? 'is-artist' : ''}">
            <div class="reward-history-main">
              <span class="reward-history-badge">${FTS.esc(b.label || 'Badge')}</span>
              <strong>${FTS.esc(rewardNameFromBadge(uid, u))}</strong>
              <small>${FTS.esc(rewardUntilText(b.until))}${b.reason ? ' · ' + FTS.esc(b.reason) : ''}</small>
            </div>
            <div class="reward-history-actions">
              <button class="btn-action" data-fts-click="extendReward('${FTS.esc(uid)}')">+7j</button>
              <button class="btn-action btn-del" data-fts-click="clearReward('${FTS.esc(uid)}')">Retirer</button>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function renderRewardsPanel() {
  const userSel = document.getElementById('reward-user');
  const badgeSel = document.getElementById('reward-badge');
  if (!userSel || !badgeSel || !window.FTSGamification) return;
  const currentUser = userSel.value;
  const rows = buildRewardOptionsForAdmin();
  userSel.innerHTML = rows.length
    ? rows.map(u => `<option value="${FTS.esc(u.optionValue || u.uid)}">${FTS.esc(u.label || 'Membre')}</option>`).join('')
    : '<option value="">Aucun membre actif</option>';
  if (currentUser && rows.some(u => (u.optionValue || u.uid) === currentUser)) userSel.value = currentUser;
  if (!badgeSel.dataset.ready) {
    badgeSel.innerHTML = FTSGamification.RARE_BADGES.map(b => `<option value="${FTS.esc(b)}">${FTS.esc(b)}</option>`).join('');
    badgeSel.dataset.ready = '1';
  }
  renderRewardHistoryPanel();
}

async function assignSpecialBadge() {
  const selectedRewardValue = document.getElementById('reward-user')?.value;
  const parsedRewardTarget = parseRewardOptionValue(selectedRewardValue);
  const targetUid = parsedRewardTarget.uid;
  const selectedRewardStudent = buildRewardOptionsForAdmin().find(u => (u.optionValue || u.uid) === selectedRewardValue);
  const badge = document.getElementById('reward-badge')?.value;
  const days = document.getElementById('reward-days')?.value || 7;
  let reason = document.getElementById('reward-reason')?.value || '';
  if (selectedRewardStudent && selectedRewardStudent.isChild && selectedRewardStudent.childName) {
    reason = reason ? `Pour ${selectedRewardStudent.childName} · ${reason}` : `Pour ${selectedRewardStudent.childName}`;
  }
  const current = firebase.auth().currentUser;
  if (!targetUid || !badge) { alert('Choisis un membre et un badge.'); return; }
  try {
    await FTSGamification.setSpecialBadge(
      db, targetUid, badge, days, current && current.uid, reason,
      selectedRewardStudent && selectedRewardStudent.isChild
        ? { childId: selectedRewardStudent.childId, childName: selectedRewardStudent.childName, publicName: selectedRewardStudent.childName }
        : {}
    );
    await refreshAdminUsersOnce();
    alert('Badge temporaire attribué.');
  } catch (e) {
    console.warn('[FTS Rewards] Attribution impossible', e);
    alert('Impossible d’attribuer le badge : ' + (e && e.message ? e.message : e));
  }
}

async function assignArtistOfWeek() {
  const selectedRewardValue = document.getElementById('reward-user')?.value;
  const parsedRewardTarget = parseRewardOptionValue(selectedRewardValue);
  const targetUid = parsedRewardTarget.uid;
  const selectedRewardStudent = buildRewardOptionsForAdmin().find(u => (u.optionValue || u.uid) === selectedRewardValue);
  let reason = document.getElementById('reward-reason')?.value || '';
  if (selectedRewardStudent && selectedRewardStudent.isChild && selectedRewardStudent.childName) {
    reason = reason ? `Pour ${selectedRewardStudent.childName} · ${reason}` : `Pour ${selectedRewardStudent.childName}`;
  }
  const current = firebase.auth().currentUser;
  if (!targetUid) { alert('Choisis un membre.'); return; }
  if (!confirm('Définir ce membre comme Artiste de la semaine ?')) return;
  try {
    await FTSGamification.setArtistOfWeek(
      db, targetUid, current && current.uid, reason, 7,
      selectedRewardStudent && selectedRewardStudent.isChild
        ? { childId: selectedRewardStudent.childId, childName: selectedRewardStudent.childName, publicName: selectedRewardStudent.childName }
        : {}
    );
    await refreshAdminUsersOnce();
    alert('Artiste de la semaine défini.');
  } catch (e) {
    console.warn('[FTS Rewards] Artiste de la semaine impossible', e);
    alert('Impossible de définir l’artiste de la semaine : ' + (e && e.message ? e.message : e));
  }
}


async function extendReward(uid) {
  const current = firebase.auth().currentUser;
  if (!uid || !window.FTSGamification) return;
  try {
    await FTSGamification.extendSpecialBadge(db, uid, 7, current && current.uid);
    await refreshAdminUsersOnce();
  } catch(e) {
    alert('Impossible de prolonger : ' + (e && e.message ? e.message : e));
  }
}

async function clearReward(uid) {
  const current = firebase.auth().currentUser;
  if (!uid || !window.FTSGamification) return;
  const name = allUsers && allUsers[uid] ? (allUsers[uid].name || allUsers[uid].email || 'ce membre') : 'ce membre';
  if (!confirm('Retirer la récompense temporaire de ' + name + ' ?')) return;
  try {
    await FTSGamification.clearSpecialBadge(db, uid, current && current.uid);
    await refreshAdminUsersOnce();
  } catch(e) {
    alert('Impossible de retirer : ' + (e && e.message ? e.message : e));
  }
}

/* ── ONGLET MESSAGES ─────────────────────────────────────────── */
function buildChannelSelector() {
  db.ref("fts_forum/messages").once("value", snap => {
    const channels = ["general", ...Object.keys(snap.val() || {})]
      .filter((v, i, a) => a.indexOf(v) === i);

    document.getElementById("ch-selector").innerHTML = channels.map(c =>
      `<div class="ch-tag ${c === currentMsgChannel ? "active" : ""}" data-fts-click="loadMsgChannel('${c}')">${c}</div>`
    ).join("");

    loadMsgChannel(currentMsgChannel);
  });
}

function loadMsgChannel(ch) {
  currentMsgChannel = ch;
  document.querySelectorAll(".ch-tag").forEach(el => {
    el.classList.toggle("active", el.textContent === ch);
  });

  db.ref("fts_forum/messages/" + ch).limitToLast(50).once("value", snap => {
    const list = document.getElementById("msg-list");
    if (!snap.exists()) {
      list.innerHTML = '<div class="empty-msg">Aucun message dans ce canal.</div>';
      return;
    }
    list.innerHTML = Object.entries(snap.val()).reverse().map(([mid, m]) => `
      <div class="msg-item">
        <div class="msg-body">
          <div class="msg-author-name">${FTS.esc(m.name)}</div>
          <div class="msg-text">${FTS.esc(m.text)}</div>
          <div class="msg-time">${fmtDate(m.ts)}</div>
        </div>
        <button class="btn-del" data-fts-click="delMsg('${ch}', '${mid}')">🗑</button>
      </div>`).join("");
  });
}

function delMsg(ch, mid) {
  if (!confirm("Supprimer ce message ?")) return;
  const busyKey = 'delMsg:' + ch + ':' + mid;
  if(adminBusyActions[busyKey]) return;
  adminBusyActions[busyKey] = true;
  db.ref("fts_forum/messages/" + ch + "/" + mid)
    .remove()
    .then(() => loadMsgChannel(ch))
    .catch(e => alert('Impossible de supprimer le message : ' + (e && e.message ? e.message : e)))
    .finally(() => { adminBusyActions[busyKey] = false; });
}

/* ── NAVIGATION ONGLETS ──────────────────────────────────────── */
function showTab(id, btn) {
  document.querySelectorAll(".tab-content, .tab-btn").forEach(el => el.classList.remove("active"));
  document.getElementById("tab-" + id).classList.add("active");
  btn.classList.add("active");
}

/* ── UTILITAIRE DATE ─────────────────────────────────────────── */
function fmtDate(ts) {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

/* FTS_AUTO_EXTRACTED_HANDLERS:forum-admin.html */
(function(){
  'use strict';
  var handlers = [{"selector": "[data-fts-handler-1]", "event": "click", "code": "doLogout()"}, {"selector": "[data-fts-handler-2]", "event": "click", "code": "showTab('pending', this)"}, {"selector": "[data-fts-handler-3]", "event": "click", "code": "showTab('members', this)"}, {"selector": "[data-fts-handler-4]", "event": "click", "code": "showTab('messages', this)"}, {"selector": "[data-fts-handler-5]", "event": "click", "code": "selectRole(this)"}, {"selector": "[data-fts-handler-6]", "event": "click", "code": "selectRole(this)"}, {"selector": "[data-fts-handler-7]", "event": "click", "code": "selectRole(this)"}, {"selector": "[data-fts-handler-8]", "event": "click", "code": "closeModModal()"}, {"selector": "[data-fts-handler-9]", "event": "click", "code": "saveModification()"}];
  function bindExtractedHandlers(){
    handlers.forEach(function(h){
      document.querySelectorAll(h.selector).forEach(function(el){
        if (el.__ftsExtractedHandlers && el.__ftsExtractedHandlers[h.event + h.code]) return;
        el.__ftsExtractedHandlers = el.__ftsExtractedHandlers || {};
        el.__ftsExtractedHandlers[h.event + h.code] = true;
        el.addEventListener(h.event, function(event){
          try { (new Function('event', h.code)).call(el, event); }
          catch (err) { console.error('[FTS] Handler extrait en erreur:', h.code, err); }
        });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindExtractedHandlers);
  else bindExtractedHandlers();
})();
/* END_FTS_AUTO_EXTRACTED_HANDLERS */
