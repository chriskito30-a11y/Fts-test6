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
  footer:  `Fais Ton Show · <a href="confidentialite.html">Confidentialité</a> · <a href="mailto:contact@faistonshow.fr?subject=Probl%C3%A8me%20rencontr%C3%A9%20sur%20l%27application&body=Bonjour%2C%0A%0AJe%20rencontre%20un%20probl%C3%A8me%20sur%20l%27application%20Fais%20Ton%20Show.%0A%0A1.%20Qui%20%C3%AAtes-vous%20%3F%0ANom%20/%20pr%C3%A9nom%20%3A%0ACompte%20utilis%C3%A9%20%28parent%2C%20%C3%A9l%C3%A8ve%2C%20professeur%2C%20admin%29%20%3A%0A%0A2.%20O%C3%B9%20est%20le%20probl%C3%A8me%20%3F%0APage%20concern%C3%A9e%20%28Accueil%2C%20Membres%2C%20Saison%2C%20Paiement%2C%20Messages%2C%20Forum%2C%20Boutique...%29%20%3A%0A%0A3.%20Que%20s%27est-il%20pass%C3%A9%20%3F%0AD%C3%A9crivez%20le%20probl%C3%A8me%20%3A%0A%0A4.%20Que%20vouliez-vous%20faire%20%3F%0A%0A5.%20Message%20d%27erreur%20affich%C3%A9%2C%20si%20pr%C3%A9sent%20%3A%0A%0A6.%20Appareil%20utilis%C3%A9%20%3A%0AT%C3%A9l%C3%A9phone%20/%20ordinateur%20%3A%0AAndroid%20/%20iPhone%20/%20Windows%20/%20Mac%20%3A%0ANavigateur%20ou%20application%20install%C3%A9e%20%3A%0A%0A7.%20Moment%20du%20probl%C3%A8me%20%3A%0ADate%20et%20heure%20approximative%20%3A%0A%0AVous%20pouvez%20aussi%20ajouter%20une%20capture%20d%27%C3%A9cran%20si%20possible.%0A%0AMerci.%0A">Signaler un problème</a>`,

  step1: {
    question: "C'est ta première fois avec nous ?",
    desc:     "On te guide vers le bon parcours, sans chercher partout.",
  },

  step2: {
    question:   "Que souhaites-tu faire ?",
    desc:       "Choisis ton besoin principal, on te redirige au bon endroit.",
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



/* ── PAIEMENT PUBLIC ÉVÉNEMENTS/STAGES V6 ───────────────────── */
function moneyCents(value){
  const n = Number(value || 0);
  if(!Number.isFinite(n)) return 0;
  return Math.round(n);
}
function euro(cents){
  const n = Number(cents || 0);
  return n ? (n / 100).toLocaleString('fr-FR', { style:'currency', currency:'EUR' }) : '';
}
function paymentWorkerUrl(){
  return (window.FTS && FTS.PAYMENT && FTS.PAYMENT.workerUrl) || 'https://fts-helloasso-api.gros-christophe.workers.dev';
}
function ensurePublicPaymentModal(){
  if(document.getElementById('index-payment-modal')) return;
  const div=document.createElement('div');
  div.id='index-payment-modal';
  div.className='index-payment-modal';
  div.innerHTML=`<div class="index-payment-card" role="dialog" aria-modal="true" aria-labelledby="index-payment-title">
    <button type="button" class="index-payment-close" data-fts-click="closeIndexPayment()">×</button>
    <div class="dest-badge">Paiement sécurisé HelloAsso</div>
    <h2 id="index-payment-title">Réservation Fais Ton Show</h2>
    <p id="index-payment-summary" class="index-payment-summary"></p>
    <form id="index-payment-form">
      <div class="index-payment-grid">
        <label>Prénom payeur<input name="firstName" required autocomplete="given-name"></label>
        <label>Nom payeur<input name="lastName" required autocomplete="family-name"></label>
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Téléphone<input name="phone" type="tel" autocomplete="tel"></label>
        <label class="full">Nom du participant<input name="participantName" required></label>
        <label>Nombre de places<input name="quantity" type="number" min="1" max="20" value="1" required></label>
        <label class="full">Code promo / code spécial<input name="promoCode" placeholder="Optionnel"></label>
      </div>
      <button class="btn-helloasso" type="submit">Continuer →</button>
      <div id="index-payment-msg" class="index-payment-msg"></div>
    </form>
  </div>`;
  document.body.appendChild(div);
  document.getElementById('index-payment-form').addEventListener('submit', submitIndexPayment);
}
let currentIndexPaymentOption=null;
function indexEventReservationLabel(opt, longLabel){
  const nature = String((opt && (opt.paymentNature || opt.eventNature || opt.paymentType)) || '');
  const label = String((opt && (opt.paymentNatureLabel || opt.eventNatureLabel)) || '').toLowerCase();
  if((opt && opt.paymentType === 'stage_registration') || nature === 'stage_registration' || label.includes('stage')) return longLabel ? 'Réserver le stage' : 'Réserver';
  if(nature === 'trial_lesson' || label.includes('essai')) return longLabel ? 'Réserver le cours d’essai' : 'Réserver';
  return longLabel ? 'Réserver / acheter une place' : 'Réserver';
}
function closeIndexPayment(){ const m=document.getElementById('index-payment-modal'); if(m) m.classList.remove('open'); }
function openIndexPayment(opt){
  currentIndexPaymentOption=opt;
  ensurePublicPaymentModal();
  document.getElementById('index-payment-title').textContent = indexEventReservationLabel(opt, true);
  const price = opt.priceCents ? ' · ' + euro(opt.priceCents) : ' · Gratuit';
  document.getElementById('index-payment-summary').textContent = (opt.title || 'Événement Fais Ton Show') + price;
  const form=document.getElementById('index-payment-form'); form.reset(); form.quantity.value='1';
  document.getElementById('index-payment-msg').textContent='';
  document.getElementById('index-payment-modal').classList.add('open');
}
async function submitIndexPayment(e){
  e.preventDefault();
  const opt=currentIndexPaymentOption;
  if(!opt) return;
  const form=e.currentTarget;
  const msg=document.getElementById('index-payment-msg');
  const btn=form.querySelector('button[type="submit"]');
  const old=btn.textContent;
  btn.disabled=true; btn.textContent='Préparation…'; msg.textContent='Création du paiement sécurisé…';
  try{
    const res=await fetch(paymentWorkerUrl().replace(/\/+$/,'') + '/checkout', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        type: opt.paymentType || 'event_ticket',
        source:'index.html', eventId: opt.eventId || opt.id,
        quantity: Math.max(1, Math.min(20, Number(form.quantity.value || 1) || 1)),
        payer:{ firstName:form.firstName.value, lastName:form.lastName.value, email:form.email.value, phone:form.phone.value },
        participant:{ name:form.participantName.value }, promoCode:form.promoCode?form.promoCode.value:''
      })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok || (!data.redirectUrl && !data.confirmationUrl)) throw new Error(data.error || 'Erreur paiement');
    location.href=data.redirectUrl || data.confirmationUrl;
  }catch(err){
    console.warn('[FTS index payment]', err);
    msg.textContent = err && err.message === 'event_full' ? 'Il n’y a plus assez de places disponibles.' : 'Impossible de lancer le paiement.';
    btn.disabled=false; btn.textContent=old;
  }
}
function isPayableOption(opt){ return !!(opt && (opt.paymentEnabled || opt.payEnabled)); }

function eventMetaLine(opt){
  const detail = Array.isArray(opt && opt.detail) ? opt.detail : [];
  const parts = [];
  detail.forEach(d => {
    const key = String(d && d[0] || '').toLowerCase();
    const val = String(d && d[1] || '').trim();
    if (!val) return;
    if (key.includes('date') || key.includes('lieu')) parts.push(val);
  });
  if (!parts.length && opt && opt.date) parts.push(String(opt.date));
  return parts.slice(0, 2).join(' · ');
}

function upcomingEventButton(opt){
  if (isPayableOption(opt)) {
    const label = indexEventReservationLabel(opt, false);
    const price = opt.priceCents ? ' · ' + euro(opt.priceCents) : '';
    return `<button type="button" class="upcoming-event-action" data-fts-click="openUpcomingEventPayment(${FTS.jsArg(opt.id)})">${label}${price} →</button>`;
  }
  const href = FTS.safeUrl(opt.link || '#', '#');
  return `<a class="upcoming-event-action" href="${FTS.esc(href)}"${href === '#' ? '' : ' target="_blank" rel="noopener"'}>Voir le lien →</a>`;
}

function renderUpcomingEvents(){
  const host = document.getElementById('upcoming-events-list');
  const zone = document.getElementById('upcoming-events');
  if (!host || !zone) return;
  const events = ((step3Options.event && step3Options.event.options) || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => {
      if ((a.ts || 0) || (b.ts || 0)) return (a.ts || Number.MAX_SAFE_INTEGER) - (b.ts || Number.MAX_SAFE_INTEGER);
      return String(a.date || a.title || '').localeCompare(String(b.date || b.title || ''), 'fr');
    })
    .slice(0, 6);

  if (!events.length) {
    host.innerHTML = `<div class="upcoming-events-empty">Aucun événement ouvert à la réservation pour le moment.</div>`;
    return;
  }

  host.innerHTML = events.map(opt => {
    const meta = eventMetaLine(opt);
    const desc = opt.desc || opt.destDesc || '';
    return `<article class="upcoming-event-card">
      <div class="upcoming-event-icon" aria-hidden="true">${FTS.esc(opt.icon || '🎪')}</div>
      <div class="upcoming-event-main">
        <h3>${FTS.esc(opt.title || 'Événement Fais Ton Show')}</h3>
        ${meta ? `<div class="upcoming-event-meta">${FTS.esc(meta)}</div>` : ''}
        ${desc ? `<p>${FTS.esc(desc)}</p>` : ''}
      </div>
      <div class="upcoming-event-cta">${upcomingEventButton(opt)}</div>
    </article>`;
  }).join('');
}

function openUpcomingEventPayment(eventId){
  const events = (step3Options.event && step3Options.event.options) || [];
  const opt = events.find(e => String(e.id) === String(eventId) || String(e.eventId) === String(eventId));
  if (opt) openIndexPayment(opt);
}

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
  renderUpcomingEvents();
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
      const paymentEnabled = v.paymentEnabled === true || v.payEnabled === true;
      const priceCents = moneyCents(v.priceCents || v.amountCents || 0);
      const paymentType = v.paymentType || v.saleType || (String(v.type || '').toLowerCase().includes('stage') ? 'stage_registration' : 'event_ticket');
      const paymentNature = v.paymentNature || v.eventNature || v.paymentKind || v.paymentType || v.saleType || '';
      const paymentNatureLabel = v.paymentNatureLabel || v.eventNatureLabel || '';
      const link  = paymentEnabled ? '#payment-' + child.key : (v.url || v.link || v.lien || v.u || '#');

      if (!title || (!date && !ts)) return;
      if (ts && ts < startOfToday.getTime()) return;

      const detail = [];
      if (date) detail.push(['Date', hour ? `${date} · ${hour}` : date]);
      if (place) detail.push(['Lieu', place]);

      events.push({
        id: child.key,
        eventId: child.key,
        icon: v.icon || (paymentType === 'stage_registration' ? '🎓' : '🎪'),
        title,
        desc: v.description || v.desc || v.type || '',
        paymentEnabled, payEnabled:paymentEnabled, paymentType, paymentNature, paymentNatureLabel, priceCents, maxSeats:Number(v.maxSeats || v.capacity || 0) || 0,
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
        eventId:   row.eventId || row.eventKey || row.id || '',
        icon:      row.icon || '🎭',
        title:     title,
        desc:      row.description || row.desc || '',
        detail,
        link:      row.link || row.lien || '#',
        destTitle: row.destTitle || row.dest_titre || row.destTitleText || title,
        destDesc:  row.destDesc || row.dest_desc || row.description || row.desc || '',
        paymentEnabled: row.paymentEnabled === true || row.payEnabled === true,
        payEnabled: row.paymentEnabled === true || row.payEnabled === true,
        paymentType: row.paymentType || row.saleType || 'event_ticket',
        priceCents: moneyCents(row.priceCents || row.amountCents || 0),
        maxSeats: Number(row.maxSeats || row.capacity || 0) || 0,
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
  const footerEl = document.getElementById('footer');
  if (footerEl) footerEl.innerHTML = CFG.footer;
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
  if (state.step2 === 'adhesion' || state.step2 === 'renew') { location.href = 'saison.html'; return; }
  if (state.step2 === 'goodie') { location.href = 'boutique.html'; return; }
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
      <button class="btn-step-next" id="btn3" disabled data-fts-click="showDest()">Voir le bon lien →</button>
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
      ${isPayableOption(opt)
        ? `<button type="button" class="btn-helloasso" data-fts-click="openIndexPaymentByState()">${FTS.esc(indexEventReservationLabel(opt, true))}${opt.priceCents ? ' · ' + euro(opt.priceCents) : ''} →</button>`
        : `<a href="${FTS.esc(FTS.safeUrl(opt.link, '#'))}" class="btn-helloasso" target="_blank" rel="noopener">Ouvrir le lien sécurisé →</a>`}
      <button class="btn-ghost" data-fts-click="restart()">Recommencer depuis le début</button>
    </div>`;
}

function openIndexPaymentByState(){
  const q3 = step3Options[state.step2];
  const opt = q3 && q3.options.find(o => o.id === state.step3);
  if(opt) openIndexPayment(opt);
}

function restart() {
  state.step1 = state.step2 = state.step3 = null;
  renderStep1();
}

/* ── START ───────────────────────────────────────────────────── */
loadQuestionnaire();
