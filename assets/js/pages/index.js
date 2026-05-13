/* ================================================================
   PAGE MODULE — INDEX
   Extrait depuis index.html pour supprimer le JavaScript inline.
   ================================================================ */

/* ── CONFIG ─────────────────────────────────────────────────────
   Seules les données spécifiques à cette page restent ici.
   Les options finales sont chargées depuis Firebase.
   ──────────────────────────────────────────────────────────── */
const CFG = {
  name:    "Fais Ton Show",
  eyebrow: "École des arts de la scène",
  slogan:  "On est pas là pour faire semblant, on est là pour faire le Show !",
  footer:  "Fais Ton Show · contact@faistonshow.fr",

  step1: {
    question: "C'est ta première fois avec nous ?",
    desc:     "Pour te guider vers les bonnes options.",
  },

  step2: {
    question:   "Que souhaites-tu faire ?",
    desc:       "Dis-nous si tu fais déjà partie de l'aventure.",
    categories: [
      { id: "adhesion", icon: "🎫", title: "Prendre mon adhésion",       desc: "Rejoindre l'association pour la saison",    profiles: ["new"] },
      { id: "event",    icon: "🎪", title: "Acheter une place",           desc: "Spectacles, soirées, showcases…",          profiles: ["member", "new"] },
      { id: "goodie",   icon: "🛍️", title: "Commander des goodies",       desc: "T-shirts, accessoires, merch…",           profiles: ["member", "new"] },
      { id: "renew",    icon: "🔄", title: "Renouveler mon adhésion",     desc: "Rempiler pour une nouvelle saison",        profiles: ["member"] },
    ],
  },

  step3Questions: {
    adhesion: { q: "Quel type d'adhésion ?",    d: "Choisis la formule adaptée à ta situation." },
    event:    { q: "Quel événement t'intéresse ?", d: "Sélectionne le prochain show qui t'attire." },
    goodie:   { q: "Que cherches-tu ?",          d: "Notre boutique officielle sur HelloAsso." },
    renew:    { q: "Ton type d'adhésion ?",       d: "Même formule ou changement de catégorie ?" },
  },
};

/* ── ÉTAT ────────────────────────────────────────────────────── */
const state = { step1: null, step2: null, step3: null };
let step3Options = {};

/* ── CHARGEMENT QUESTIONNAIRE FIREBASE ────────────────────────── */
async function loadQuestionnaire() {
  const db = FTS.initFirebase();
  const rows = [];

  // 1) Source publique du questionnaire : fts_content/questionnaire.
  // Elle reste chargée même si la lecture de fts_events est refusée par les règles Firebase.
  try {
    const snap = await db.ref('fts_content/questionnaire').once('value');
    const root = snap.val() || {};

    // Format officiel : fts_content/questionnaire/options/{id}
    const opts = root.options || {};
    Object.keys(opts).forEach(key => {
      const v = opts[key] || {};
      if (v.active === false || v.status === 'inactive') return;
      rows.push({ id: key, ...v });
    });

    // Compatibilité ancien format : fts_content/questionnaire/{id}
    Object.keys(root).forEach(key => {
      if (key === 'options' || key === 'settings') return;
      const v = root[key];
      if (!v || typeof v !== 'object') return;
      if (!(v.type || v.title || v.titre || v.link || v.lien)) return;
      if (v.active === false || v.status === 'inactive') return;
      rows.push({ id: key, ...v });
    });
  } catch (e) {
    console.warn('[FTS] Impossible de charger fts_content/questionnaire :', e);
  }

  step3Options = buildStep3Options(rows);

  // 2) Source calendrier : fts_events. Si elle est lisible publiquement, elle remplace
  // les anciennes options événement. Si elle est bloquée, on garde les options
  // synchronisées par calendrier-admin dans fts_content/questionnaire/options.
  try {
    const eventOptions = await loadUpcomingEventOptions(db);
    if (eventOptions.length) {
      step3Options.event = {
        question: CFG.step3Questions.event.q,
        desc: CFG.step3Questions.event.d,
        options: eventOptions
      };
    }
  } catch (e) {
    console.warn('[FTS] fts_events non accessible depuis l’accueil, utilisation du miroir questionnaire :', e);
  }

  // 3) Sécurité : si aucun événement futur n'est exploitable, on ne casse pas les autres choix.
  initPage();
}

function normalizeEventTs(v) {
  return Number(v.dateTs || v.startTs || v.ts || 0);
}

async function loadUpcomingEventOptions(db) {
  const snap = await db.ref('fts_events').once('value');
  const events = [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  if (snap.exists()) {
    snap.forEach(child => {
      const v = child.val() || {};
      if (v.active === false || v.status === 'inactive') return;

      const ts = normalizeEventTs(v);
      const title = v.name || v.nom || v.title || v.titre || v.n || '';
      const date  = v.dateLabel || v.date || v.d || '';
      const hour  = v.hour || v.heure || v.time || v.h || '';
      const place = v.location || v.lieu || v.l || '';
      const link  = v.url || v.link || v.lien || v.u || '#';

      if (!title || (!date && !ts)) return;
      if (ts && ts < startOfToday.getTime()) return;

      const detail = [];
      if (date) detail.push(['Date', hour ? `${date} · ${hour}` : date]);
      if (place) detail.push(['Lieu', place]);

      events.push({
        id: child.key,
        icon: v.icon || '🎪',
        title,
        desc: v.description || v.desc || v.type || '',
        detail,
        link,
        destTitle: title,
        destDesc: v.description || v.desc || (date ? (hour ? `${date} · ${hour}` : date) : '') || '' ,
        ts,
        date
      });
    });
  }

  return events.sort((a, b) => {
    if (a.ts || b.ts) return (a.ts || Number.MAX_SAFE_INTEGER) - (b.ts || Number.MAX_SAFE_INTEGER);
    return String(a.date).localeCompare(String(b.date), 'fr');
  });
}

function buildStep3Options(rows) {
  const result = {};
  rows
    .sort((a, b) => Number(a.order || 999) - Number(b.order || 999))
    .forEach((row, index) => {
      const type = String(row.type || '').toLowerCase().trim();
      const title = row.title || row.titre || '';
      if (!type || !title) return;

      if (!result[type]) {
        const q3 = CFG.step3Questions[type] || { q: 'Choisis une option', d: '' };
        result[type] = { question: q3.q, desc: q3.d, options: [] };
      }

      let detail = [];
      if (Array.isArray(row.details)) {
        detail = row.details
          .map(d => [d.key || d.cle || '', d.value || d.valeur || ''])
          .filter(d => d[0] && d[1]);
      }
      if (!detail.length) {
        if ((row.detail1_cle || row.detail1Key) && (row.detail1_valeur || row.detail1Value)) detail.push([row.detail1_cle || row.detail1Key, row.detail1_valeur || row.detail1Value]);
        if ((row.detail2_cle || row.detail2Key) && (row.detail2_valeur || row.detail2Value)) detail.push([row.detail2_cle || row.detail2Key, row.detail2_valeur || row.detail2Value]);
      }

      const option = {
        id:        row.id || (type + '_' + index),
        icon:      row.icon || '🎭',
        title:     title,
        desc:      row.description || row.desc || '',
        detail,
        link:      row.link || row.lien || '#',
        destTitle: row.destTitle || row.dest_titre || row.destTitleText || title,
        destDesc:  row.destDesc || row.dest_desc || row.description || row.desc || '',
        ts:        Number(row.dateTs || row.startTs || row.ts || 0),
        date:      row.dateLabel || row.date || row.d || ''
      };

      // Les options événement synchronisées depuis calendrier-admin disparaissent
      // automatiquement quand la date est passée.
      if (type === 'event' && option.ts) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (option.ts < startOfToday.getTime()) return;
      }

      result[type].options.push(option);
    });
  Object.keys(result).forEach(type => {
    result[type].options.sort((a, b) => {
      if ((a.ts || 0) || (b.ts || 0)) return (a.ts || Number.MAX_SAFE_INTEGER) - (b.ts || Number.MAX_SAFE_INTEGER);
      return String(a.title || '').localeCompare(String(b.title || ''), 'fr');
    });
  });
  return result;
}

function initPage() {
  // Titre
  const parts = CFG.name.split(' ');
  const last  = parts.pop();
  document.getElementById('h-eyebrow').textContent = CFG.eyebrow;
  document.getElementById('h-title').innerHTML =
    (parts.length ? parts.join(' ') + '<br>' : '') + '<span>' + last + '</span>';
  document.getElementById('h-slogan').textContent = CFG.slogan;
  document.getElementById('footer').textContent   = CFG.footer;
  renderStep1();
}

/* ── ÉTAPE 1 ─────────────────────────────────────────────────── */
function renderStep1() {
  document.getElementById('card').innerHTML = `
    <div class="step-label">Étape 1 / 3</div>
    <div class="step-question">${CFG.step1.question}</div>
    <div class="step-desc">${CFG.step1.desc}</div>
    <div class="options" id="s1-opts">
      <div class="option" data-id="new" data-fts-click="selectStep1(this)">
        <div class="opt-icon">✨</div>
        <div class="opt-text">
          <div class="opt-title">Je découvre l'association</div>
          <div class="opt-desc">Première fois que j'entends parler de vous</div>
        </div>
      </div>
      <div class="option" data-id="member" data-fts-click="selectStep1(this)">
        <div class="opt-icon">🎭</div>
        <div class="opt-text">
          <div class="opt-title">Je suis déjà adhérent·e</div>
          <div class="opt-desc">J'ai déjà ma carte membre cette saison</div>
        </div>
      </div>
    </div>
    <div class="step-actions">
      <button class="btn-step-next" id="btn1" disabled data-fts-click="goStep2()">Continuer →</button>
    </div>`;
}

function selectStep1(el) {
  document.querySelectorAll('#s1-opts .option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  state.step1 = el.dataset.id;
  document.getElementById('btn1').disabled = false;
}

/* ── ÉTAPE 2 ─────────────────────────────────────────────────── */
function goStep2() {
  const cats = CFG.step2.categories.filter(c => c.profiles.includes(state.step1));
  document.getElementById('card').innerHTML = `
    <div class="step-label">Étape 2 / 3</div>
    <div class="step-question">${CFG.step2.question}</div>
    <div class="step-desc">${CFG.step2.desc}</div>
    <div class="options" id="s2-opts">
      ${cats.map(c => `
        <div class="option" data-id="${c.id}" data-fts-click="selectStep2(this)">
          <div class="opt-icon">${c.icon}</div>
          <div class="opt-text">
            <div class="opt-title">${c.title}</div>
            <div class="opt-desc">${c.desc}</div>
          </div>
        </div>`).join('')}
    </div>
    <div class="step-actions">
      <button class="btn-step-back" data-fts-click="renderStep1()">← Retour</button>
      <button class="btn-step-next" id="btn2" disabled data-fts-click="goStep3()">Continuer →</button>
    </div>`;
}

function selectStep2(el) {
  document.querySelectorAll('#s2-opts .option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  state.step2 = el.dataset.id;
  document.getElementById('btn2').disabled = false;
}

/* ── ÉTAPE 3 ─────────────────────────────────────────────────── */
function goStep3() {
  const q3 = step3Options[state.step2];
  if (!q3 || !q3.options.length) {
    document.getElementById('card').innerHTML = `
      <div class="error-wrap">
        <div class="error-icon">🔍</div>
        <div class="error-msg">Aucune option disponible pour le moment.<br>Contactez l'association.</div>
      </div>`;
    return;
  }
  document.getElementById('card').innerHTML = `
    <div class="step-label">Étape 3 / 3</div>
    <div class="step-question">${q3.question}</div>
    <div class="step-desc">${q3.desc}</div>
    <div class="options" id="s3-opts">
      ${q3.options.map(o => `
        <div class="option" data-id="${o.id}" data-fts-click="selectStep3(this)">
          <div class="opt-icon">${o.icon}</div>
          <div class="opt-text">
            <div class="opt-title">${o.title}</div>
            <div class="opt-desc">${o.desc}</div>
          </div>
        </div>`).join('')}
    </div>
    <div class="step-actions">
      <button class="btn-step-back" data-fts-click="goStep2()">← Retour</button>
      <button class="btn-step-next" id="btn3" disabled data-fts-click="showDest()">Voir où s'inscrire →</button>
    </div>`;
}

function selectStep3(el) {
  document.querySelectorAll('#s3-opts .option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  state.step3 = el.dataset.id;
  document.getElementById('btn3').disabled = false;
}

/* ── DESTINATION ─────────────────────────────────────────────── */
function showDest() {
  const q3  = step3Options[state.step2];
  const opt = q3.options.find(o => o.id === state.step3);
  if (!opt) return;

  const details = opt.detail.map(d =>
    `<div class="dest-detail">
      <span class="dest-detail-key">${d[0]}</span>
      <span class="dest-detail-val">${d[1]}</span>
    </div>`
  ).join('');

  document.getElementById('card').innerHTML = `
    <div class="destination">
      <div class="dest-badge">Prêt à rejoindre le show</div>
      <div class="dest-icon">${opt.icon}</div>
      <div class="dest-title">${FTS.esc(opt.destTitle || opt.title)}</div>
      <div class="dest-desc">${FTS.esc(opt.destDesc  || opt.desc)}</div>
      ${details ? '<div class="dest-details">' + details + '</div>' : ''}
      <a href="${opt.link}" class="btn-helloasso" target="_blank" rel="noopener">
        S'inscrire sur HelloAsso →
      </a>
      <button class="btn-ghost" data-fts-click="restart()">Recommencer depuis le début</button>
    </div>`;
}

function restart() {
  state.step1 = state.step2 = state.step3 = null;
  renderStep1();
}

/* ── START ───────────────────────────────────────────────────── */
loadQuestionnaire();
