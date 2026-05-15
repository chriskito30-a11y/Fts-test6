/* ================================================================
   PROFS.JS
   ✅ Firebase Auth — accès admin ou prof uniquement
   ✅ Publication dans Firebase RTDB (fts_ressources)
   ✅ Gestion complète : voir, modifier, supprimer
   ✅ Profs voient leurs disciplines, admins voient tout
   ================================================================ */

let categoryStructure = [];
let SUBCATS = {};
let ALL_CATS = [];

const TYPE_ICONS = { pdf:"▩", mp3:"♪", audio:"♪", video:"▶", image:"▪", texte:"✉", doc:"□" };

/*
  Liens OneDrive pour les vidéos de danse.
  - read  = lien lecture seule visible par les élèves, automatiquement mis dans le champ Lien
  - write = lien dépôt/modification visible uniquement par le prof dans le formulaire

  Important : les clés correspondent aux noms des sous-catégories Danse dans Firebase.
*/
const DANCE_VIDEO_FOLDERS = {
  "Les Baby Show": {
    read: "https://1drv.ms/f/c/523a8512bc652dc1/IgBuRNwPMrgqSY12s26Nv8iKAY2vgBnAo9TG4mY172-g-y8",
    write: "https://1drv.ms/f/c/523a8512bc652dc1/IgBuRNwPMrgqSY12s26Nv8iKAWSrfYxCOeni6vVgyB6Uakw"
  },
  "Show Danse Junior": {
    read: "https://1drv.ms/f/c/523a8512bc652dc1/IgABEDHu9sKOR4yxli-R6VoIAZIHxhkdbl7m-NdhGfisbD4",
    write: "https://1drv.ms/f/c/523a8512bc652dc1/IgABEDHu9sKOR4yxli-R6VoIAc0jNvvHrY9EqRn6NIc5cZ4"
  },
  "Ados/Adultes": {
    read: "https://1drv.ms/f/c/523a8512bc652dc1/IgA7vQbTu8VLTZd9y-HZlP-cAVQC4_ebP3UHsoOhKsp9jhI",
    write: "https://1drv.ms/f/c/523a8512bc652dc1/IgA7vQbTu8VLTZd9y-HZlP-cAebVob0jmvI8pBg7mm6v8gc"
  }
};

let db, auth;
let userProfile, currentUserUid;
let allDocs = [];      // tous les docs chargés depuis Firebase
let filteredDocs = []; // après filtres

/* ── INIT ─────────────────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", function() {
  db   = FTS.initFirebase();
  auth = firebase.auth();

  auth.onAuthStateChanged(async function(user) {
    if (!user) { window.location.href = "auth.html"; return; }

    currentUserUid = user.uid;

    try {
      const snap = await db.ref("fts_users/" + user.uid).once("value");
      userProfile = snap.val();

      if (!userProfile || userProfile.status !== "active") {
        await auth.signOut();
        window.location.href = "auth.html";
        return;
      }

      if (userProfile.role !== "admin" && userProfile.role !== "prof") {
        // Membre normal → espace membres
        window.location.href = "membres.html";
        return;
      }

      // ✅ Accès autorisé
      document.getElementById("auth-loading").style.display = "none";
      document.getElementById("page-content").style.display = "block";

      // Nom + badge rôle
      document.getElementById("user-display-name").textContent =
        userProfile.firstName || userProfile.name || user.email;
      const roleBadge = document.getElementById("user-role-badge");
      roleBadge.textContent = userProfile.role === "admin" ? "🛡 Admin" : "🎓 Prof";
      roleBadge.className   = "user-role role-" + userProfile.role;

      // Lien Admin dans nav (admins seulement)
      if (userProfile.role === "admin") {
        document.getElementById("bnav-admin").style.display = "flex";
      }

      // Badge non lus messages
      listenUnreadBadge(user.uid);

      // Construire les sélecteurs de catégories depuis Firebase
      await buildCatSelectors();

      // Charger les documents
      loadDocs();
      initPublishPreview();
      updateProfsStats();

    } catch(e) {
      console.warn("[FTS Profs]", e);
      window.location.href = "auth.html";
    }
  });

  // Drag & drop
  const dropZone = document.getElementById("drop-zone");
  dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault(); dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });
  document.getElementById("f-file").addEventListener("change", function() {
    if (this.files[0]) uploadFile(this.files[0]);
  });
});

/* ── CATÉGORIES AUTORISÉES ────────────────────────────────────── */
function allowedCats() {
  if (userProfile.role === "admin") return ALL_CATS;
  const discs = userProfile.disciplines || [];
  return ALL_CATS.filter(c => discs.includes(c.value));
}

function categoryOptionsFromStructureLocal(structure) {
  const rows = Array.isArray(structure) && structure.length
    ? structure
    : (FTS.getDefaultCategoryStructure ? FTS.getDefaultCategoryStructure() : []);

  return rows
    .filter(c => c && c.active !== false)
    .sort((a, b) => (+a.order || 999) - (+b.order || 999))
    .map(c => {
      const value = c.name || c.category || c.value || "";
      const icon  = c.icon || c.emoji || (FTS.catIcon ? FTS.catIcon(value) : "");
      const rawSubs = c.subs || c.subcats || c.subcategories || [];
      let subcats = [];

      if (Array.isArray(rawSubs)) {
        subcats = rawSubs
          .filter(s => typeof s === "string" || (s && s.active !== false))
          .map(s => typeof s === "string" ? s : (s.name || s.label || ""))
          .filter(Boolean);
      } else {
        subcats = Object.values(rawSubs)
          .filter(s => typeof s === "string" || (s && s.active !== false))
          .map(s => typeof s === "string" ? s : (s.name || s.label || ""))
          .filter(Boolean);
      }

      return {
        value,
        label: (icon ? icon + " " : "") + value,
        subcats
      };
    })
    .filter(c => c.value);
}

async function buildCatSelectors() {
  categoryStructure = FTS.getCategoryStructureAsync
    ? await FTS.getCategoryStructureAsync(db)
    : (FTS.getCategoryStructure ? FTS.getCategoryStructure() : []);

  ALL_CATS = FTS.categoryOptionsFromStructure
    ? FTS.categoryOptionsFromStructure(categoryStructure)
    : categoryOptionsFromStructureLocal(categoryStructure);

  if (!ALL_CATS.length && FTS.getDefaultCategoryStructure) {
    ALL_CATS = categoryOptionsFromStructureLocal(FTS.getDefaultCategoryStructure());
  }

  SUBCATS = {};
  ALL_CATS.forEach(c => { SUBCATS[c.value] = c.subcats || []; });

  const cats = allowedCats();
  const opts = '<option value="">-- Choisir --</option>' +
    cats.map(c => `<option value="${FTS.esc(c.value)}">${FTS.esc(c.label)}</option>`).join("");

  document.getElementById("f-cat").innerHTML = opts;
  document.getElementById("e-cat").innerHTML = opts;

  document.getElementById("filter-cat").innerHTML =
    '<option value="">Toutes les catégories</option>' +
    cats.map(c => `<option value="${FTS.esc(c.value)}">${FTS.esc(c.label)}</option>`).join("");
  updateProfsStats();
}

/* ── ONGLETS ──────────────────────────────────────────────────── */
function switchTab(name) {
  document.querySelectorAll(".tab-pane, .tab-lnk").forEach(el => el.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  document.getElementById("tab-btn-" + name).classList.add("active");
  if (name === "students") loadStudents();
}

/* ── LISTE DES ÉLÈVES ─────────────────────────────────────────── */
async function loadStudents() {
  const el = document.getElementById("students-list");
  if (!el) return;
  el.innerHTML = '<div class="empty-manage">Chargement…</div>';

  try {
    const snap = await db.ref("fts_users")
      .orderByChild("status").equalTo("active").once("value");

    // Disciplines autorisées pour ce prof (null = admin voit tout)
    const allowedDiscs = userProfile.role === "admin"
      ? null
      : (userProfile.disciplines || []).map(d => normAccess(d));

    const students = [];
    if (snap.exists()) {
      snap.forEach(child => {
        const u = child.val() || {};
        // Exclure admins et profs
        if (u.role === "admin" || u.role === "prof") return;

        // Disciplines de ce compte (parent ou élève)
        const accountDiscs = Array.isArray(u.disciplines)
          ? u.disciplines
          : String(u.group || "").split(",").map(x => x.trim()).filter(Boolean);

        // Disciplines des enfants (si compte parent)
        const childDiscs = (u.hasEnfant && Array.isArray(u.enfants))
          ? u.enfants.flatMap(e => Array.isArray(e.disciplines) ? e.disciplines : [])
          : [];

        const allDiscs = [...new Set([...accountDiscs, ...childDiscs])];

        if (allowedDiscs) {
          const match = allDiscs.some(d => allowedDiscs.includes(normAccess(d)));
          if (!match) return;
        }

        students.push({ uid: child.key, ...u, accountDiscs, childDiscs, allDiscs });
      });
    }

    students.sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

    const badge = document.getElementById("students-count");
    if (badge) badge.textContent = students.length;
    const statStudents = document.getElementById("profs-stat-students");
    if (statStudents) statStudents.textContent = students.length;

    if (!students.length) {
      el.innerHTML = "<div class='empty-manage'>Aucun élève dans tes disciplines pour le moment.</div>";
      return;
    }

    el.innerHTML = students.map(u => {
      const displayName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || u.email || "—";
      const discLabel   = u.accountDiscs.join(", ") || "—";

      // Blocs enfants si compte parent
      let enfantsHtml = "";
      if (u.hasEnfant && Array.isArray(u.enfants) && u.enfants.length) {
        // Filtrer seulement les enfants qui ont au moins une discipline du prof
        const enfantsVisibles = allowedDiscs
          ? u.enfants.filter(e =>
              Array.isArray(e.disciplines) &&
              e.disciplines.some(d => allowedDiscs.includes(normAccess(d)))
            )
          : u.enfants;

        enfantsHtml = enfantsVisibles.map(e => `
          <div class="student-child">
            🎩 <strong>${FTS.esc(e.prenom || "")} ${FTS.esc(e.nom || "")}</strong>
            ${e.disciplines && e.disciplines.length
              ? `<span style="color:var(--gold)"> · ${FTS.esc(e.disciplines.join(", "))}</span>`
              : ""}
            ${e.telephone ? `<span style="color:#555"> · 📞 ${FTS.esc(e.telephone)}</span>` : ""}
          </div>`).join("");
      }

      return `
        <div class="student-card">
          <div class="student-avatar">${FTS.esc((u.firstName || u.name || "?").charAt(0).toUpperCase())}</div>
          <div class="student-info">
            <div class="student-name">
              ${FTS.esc(displayName.trim())}
              ${u.hasEnfant ? '<span class="student-parent-badge">parent</span>' : ""}
            </div>
            ${u.telephone ? `<div class="student-meta">📞 ${FTS.esc(u.telephone)}</div>` : ""}
            <div class="student-meta">${FTS.esc(discLabel)}</div>
            ${enfantsHtml}
          </div>
        </div>`;
    }).join("");

  } catch(e) {
    console.warn("[FTS Profs] Chargement élèves :", e);
    el.innerHTML = "<div class='empty-manage'>Impossible de charger les élèves. Réessaie.</div>";
  }
}

/* ── SOUS-CATÉGORIES ─────────────────────────────────────────── */
function updateSubcats() {
  const cat = document.getElementById("f-cat").value;
  _fillSubcat("f-subcat", "subcat-row", cat);
  updateDanceVideoFolder();
  renderPublishPreview();
}
function updateEditSubcats() {
  const cat = document.getElementById("e-cat").value;
  _fillSubcat("e-subcat", "e-subcat-row", cat);
}
function _fillSubcat(selId, rowId, cat) {
  const sel = document.getElementById(selId);
  const row = document.getElementById(rowId);
  sel.innerHTML = '<option value="">-- Aucune --</option>';
  if (SUBCATS[cat] && SUBCATS[cat].length) {
    SUBCATS[cat].forEach(s => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s;
      sel.appendChild(o);
    });
    row.style.display = "block";
  } else {
    row.style.display = "none";
  }
}

/* ── DOSSIERS VIDÉO DANSE ─────────────────────────────────────── */
function isDanceCat(cat) {
  return normAccess(cat) === normAccess("Danse");
}

function getDanceFolderConfig(subcat) {
  const wanted = normAccess(subcat || "");
  const key = Object.keys(DANCE_VIDEO_FOLDERS).find(k => normAccess(k) === wanted);
  return key ? { key, ...DANCE_VIDEO_FOLDERS[key] } : null;
}

function updateDanceVideoFolder() {
  const cat = document.getElementById("f-cat").value;
  const subcat = document.getElementById("f-subcat").value;
  const type = document.getElementById("f-type").value;
  const box = document.getElementById("dance-video-folder-box");
  const title = document.getElementById("dance-video-folder-title");
  const text = document.getElementById("dance-video-folder-text");
  const note = document.getElementById("dance-video-folder-note");
  const uploadLink = document.getElementById("dance-video-upload-link");
  const urlInput = document.getElementById("f-url");

  if (!box || !uploadLink || !urlInput) return;

  const shouldShow = isDanceCat(cat) && type === "video" && !!subcat;
  if (!shouldShow) {
    box.style.display = "none";
    uploadLink.href = "#";
    uploadLink.classList.add("disabled");
    return;
  }

  const cfg = getDanceFolderConfig(subcat);
  box.style.display = "block";
  title.textContent = "Dossier vidéo Danse — " + subcat;

  if (cfg && cfg.read) {
    urlInput.value = cfg.read;
    text.textContent = "Le lien lecture élèves a été renseigné automatiquement dans le champ Lien.";
  } else {
    text.textContent = "Lien lecture élèves non configuré pour cette sous-catégorie.";
  }

  if (cfg && cfg.write) {
    uploadLink.href = cfg.write;
    uploadLink.classList.remove("disabled");
    uploadLink.textContent = "📁 Déposer la vidéo dans OneDrive";
    note.textContent = "Après dépôt dans OneDrive, reviens ici, ajoute un titre et publie.";
  } else {
    uploadLink.href = "#";
    uploadLink.classList.add("disabled");
    uploadLink.textContent = "📁 Lien dépôt OneDrive à configurer";
    note.textContent = "Ajoute plus tard le lien write dans DANCE_VIDEO_FOLDERS pour activer ce bouton.";
  }
}

/* ── TYPE ─────────────────────────────────────────────────────── */
function updateType() {
  const t = document.getElementById("f-type").value;
  document.getElementById("url-row").style.display    = t === "texte" ? "none" : "block";
  document.getElementById("upload-row").style.display = t === "texte" ? "none" : "block";
  const labels = {
    pdf:"Lien Google Drive (PDF)", mp3:"Lien audio",
    video:"Lien OneDrive, YouTube ou Google Drive", image:"Lien image", doc:"Lien",
  };
  document.getElementById("video-upload-tip").style.display =
  t === "video" ? "block" : "none";
  document.getElementById("url-label").textContent = labels[t] || "Lien";
  updateDanceVideoFolder();
  renderPublishPreview();
}


/* ── APERÇU PUBLICATION + STATS ─────────────────────────────── */
function initPublishPreview() {
  ["f-cat", "f-subcat", "f-type", "f-name", "f-url", "f-text"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.previewBound === "1") return;
    el.dataset.previewBound = "1";
    el.addEventListener("input", renderPublishPreview);
    el.addEventListener("change", renderPublishPreview);
  });
  renderPublishPreview();
}

function typeLabel(type) {
  const labels = { pdf:"Document PDF", mp3:"Audio", audio:"Audio", video:"Vidéo", image:"Image", texte:"Message", doc:"Lien" };
  return labels[type] || "Ressource";
}

function renderPublishPreview() {
  const nameEl = document.getElementById("preview-name");
  const metaEl = document.getElementById("preview-meta");
  const noteEl = document.getElementById("preview-note");
  const pillEl = document.getElementById("preview-type-pill");
  if (!nameEl || !metaEl || !pillEl) return;

  const cat = document.getElementById("f-cat")?.value || "";
  const subcat = document.getElementById("f-subcat")?.value || "";
  const type = document.getElementById("f-type")?.value || "doc";
  const name = (document.getElementById("f-name")?.value || "").trim();
  const url = (document.getElementById("f-url")?.value || "").trim();
  const text = (document.getElementById("f-text")?.value || "").trim();

  nameEl.textContent = name || "Titre de la ressource";
  pillEl.textContent = typeLabel(type);
  const target = cat ? (subcat ? cat + " · " + subcat : cat) : "Catégorie à choisir";
  const linkInfo = type === "texte" ? "texte direct" : (url ? "lien renseigné" : "lien/fichier à ajouter");
  metaEl.textContent = target + " · " + typeLabel(type) + " · " + linkInfo;
  if (noteEl) {
    noteEl.style.display = text ? "block" : "none";
    noteEl.textContent = text;
  }
}

function updateProfsStats() {
  const docsEl = document.getElementById("profs-stat-docs");
  const catsEl = document.getElementById("profs-stat-cats");
  const catsNoteEl = document.getElementById("profs-stat-cats-note");
  const lastEl = document.getElementById("profs-stat-last");
  if (docsEl) docsEl.textContent = allDocs.length || 0;
  const cats = allowedCats ? allowedCats() : [];
  if (catsEl) catsEl.textContent = cats.length || 0;
  if (catsNoteEl) catsNoteEl.textContent = cats.length ? cats.map(c => c.value).slice(0, 2).join(", ") + (cats.length > 2 ? "…" : "") : "accessibles";
  if (lastEl) lastEl.textContent = allDocs[0]?.name ? String(allDocs[0].name).slice(0, 22) : "—";
}

/* ── UPLOAD CLOUDINARY ────────────────────────────────────────── */
function uploadFile(file) {
  if (file.size > 100 * 1024 * 1024) { showMsg("Fichier trop volumineux (max 100 Mo)", "error"); return; }
  document.getElementById("upload-progress").style.display = "block";
  document.getElementById("drop-text").style.display = "none";
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("progress-bar").style.background = "var(--red)";
  document.getElementById("progress-text").textContent = "Upload en cours…";

  FTS.uploadCloudinary(file, pct => {
    document.getElementById("progress-bar").style.width = pct + "%";
    document.getElementById("progress-text").textContent = "Upload " + pct + "%…";
  })
  .then(url => {
    document.getElementById("f-url").value = url;
    document.getElementById("progress-text").textContent = "✓ " + file.name + " uploadé !";
    document.getElementById("progress-bar").style.width = "100%";
    document.getElementById("progress-bar").style.background = "#22c55e";
    const ext = file.name.split(".").pop().toLowerCase();
    const typeMap = { pdf:"pdf", mp3:"mp3", mp4:"video", jpg:"image", jpeg:"image", png:"image", gif:"image" };
    if (typeMap[ext]) {
      document.getElementById("f-type").value = typeMap[ext];
      updateType();
    }
  })
  .catch(() => {
    document.getElementById("progress-text").textContent = "Erreur lors de l'upload";
    document.getElementById("drop-text").style.display = "block";
    document.getElementById("upload-progress").style.display = "none";
  });
}

/* ── PUBLICATION ──────────────────────────────────────────────── */
async function doSubmit() {
  const cat    = document.getElementById("f-cat").value;
  const subcat = document.getElementById("f-subcat").value;
  const type   = document.getElementById("f-type").value;
  const name   = document.getElementById("f-name").value.trim();
  const url    = document.getElementById("f-url").value.trim();
  const text   = document.getElementById("f-text").value.trim();

  if (!cat)                        { showMsg("Choisis une catégorie.",              "error"); return; }
  if (!name)                       { showMsg("Entre un titre.",                     "error"); return; }
  if (type !== "texte" && !url)    { showMsg("Entre le lien ou glisse un fichier.", "error"); return; }
  if (type === "texte" && !text)   { showMsg("Entre le texte.",                     "error"); return; }

  const btn = document.getElementById("btn-submit");
  btn.disabled = true;
  btn.textContent = "Publication…";
  clearMsg();

  try {
    const content = type === "texte" ? text : url;
    const data = {
      cat,
      category:   cat,
      subcat:     subcat || "",
      subcategory: subcat || "",
      name,
      url:        content,
      content,
      type,
      text:       type !== "texte" ? text : "",
      active:     true,
      status:     "active",
      visibility: "members",
      authorUid:  currentUserUid,
      authorName: userProfile.name || userProfile.firstName || "",
      createdAt:  Date.now(),
      updatedAt:  Date.now(),
    };

    const ref = await db.ref("fts_ressources").push(data);
    data.key = ref.key;
    await FTS.ensureResourceCategory(db, data);
    await buildCatSelectors();
    await notifyNewResource(data);

    showMsg("✓ Publié avec succès !", "success");
    resetForm();

  } catch(e) {
    showMsg("Erreur lors de la publication. Réessaie.", "error");
    console.error("[FTS Profs]", e);
  }

  btn.disabled = false;
  btn.textContent = "Publier";
}

function resetForm() {
  ["f-name","f-url","f-text"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("f-cat").value   = "";
  document.getElementById("drop-text").style.display    = "block";
  document.getElementById("upload-progress").style.display = "none";
  document.getElementById("progress-bar").style.width   = "0%";
  document.getElementById("subcat-row").style.display   = "none";
  const box = document.getElementById("dance-video-folder-box");
  if (box) box.style.display = "none";
  renderPublishPreview();
}


/* ── NOTIFICATIONS NOUVEAU DOCUMENT ──────────────────────────── */
function splitAccessList(v) {
  if (Array.isArray(v)) return v.map(x => String(x || '').trim()).filter(Boolean);
  return String(v || '').split(',').map(x => x.trim()).filter(Boolean);
}

function normAccess(v) {
  return FTS.norm ? FTS.norm(v || '') : String(v || '').toLowerCase().trim();
}

function resourceTargetPayload(data) {
  const cat = data.cat || data.category || "";
  const subcat = data.subcat || data.subcategory || "";
  return {
    group: cat,
    subgroup: subcat || "",
    category: cat,
    subcategory: subcat
  };
}

function userCanReceiveResourceNotification(u, target) {
  if (!u || u.status !== "active") return false;
  if (u.role === "admin") return true;

  const cats = splitAccessList(u.disciplines && u.disciplines.length ? u.disciplines : u.group);
  const hasCat = cats.some(c => normAccess(c) === normAccess(target.category));
  if (!hasCat) return false;

  // Document publié directement dans la discipline : tous les membres de cette discipline sont concernés.
  if (!target.subcategory) return true;

  // Document publié dans une section : uniquement les membres qui possèdent cette section.
  const byCat = u.subgroupsByCat || {};
  const matchingCatKey = Object.keys(byCat).find(k => normAccess(k) === normAccess(target.category));
  const exactCatSubs = splitAccessList(matchingCatKey ? byCat[matchingCatKey] : []);
  const globalSubs = splitAccessList(u.subgroups && u.subgroups.length ? u.subgroups : u.subgroup);
  const allowedSubs = exactCatSubs.length ? exactCatSubs : globalSubs;
  return allowedSubs.some(s => normAccess(s) === normAccess(target.subcategory));
}

async function getResourceRecipientUids(target) {
  const snap = await db.ref("fts_users").orderByChild("status").equalTo("active").once("value");
  const uids = [];
  if (snap.exists()) {
    snap.forEach(child => {
      if (child.key === currentUserUid) return; // évite la notification à soi-même
      if (userCanReceiveResourceNotification(child.val(), target)) uids.push(child.key);
    });
  }
  // Sécurité : les admins actifs reçoivent toujours les notifications documents,
  // même s'ils ne sont pas dans la catégorie / sous-catégorie.
  const adminSnap = await db.ref("fts_users").orderByChild("role").equalTo("admin").once("value");
  if (adminSnap.exists()) {
    adminSnap.forEach(child => {
      const u = child.val() || {};
      if (child.key !== currentUserUid && u.status === "active" && !uids.includes(child.key)) uids.push(child.key);
    });
  }
  return uids;
}

async function notifyNewResource(data) {
  try {
    const target = resourceTargetPayload(data);
    const recipientUids = await getResourceRecipientUids(target);
    if (!recipientUids.length) return;

    const catLabel = target.subcategory ? (target.category + " — " + target.subcategory) : target.category;
    const url = "./membres.html?resource=" + encodeURIComponent(data.key || "")
      + "&cat=" + encodeURIComponent(target.category || "")
      + "&subcat=" + encodeURIComponent(target.subcategory || "");

    // Trace interne utile pour audit / debug, sans bloquer la publication.
    const notif = {
      type: "resource",
      resourceId: data.key || "",
      cat: target.category,
      category: target.category,
      subcat: target.subcategory,
      subcategory: target.subcategory,
      title: "Nouveau document",
      body: data.name || "Nouveau document",
      url,
      read: false,
      createdAt: Date.now(),
      authorUid: currentUserUid
    };
    const fanout = {};
    recipientUids.forEach(uid => {
      const nref = db.ref("fts_user_notifications/" + uid).push();
      fanout["fts_user_notifications/" + uid + "/" + nref.key] = notif;
    });
    await db.ref().update(fanout).catch(() => {});

    if (!FTS.PUSH || !FTS.PUSH.workerUrl) {
      await db.ref("fts_debug_notifications/resource_" + (data.key || Date.now())).set({
        ok: false,
        reason: "FTS.PUSH.workerUrl manquant dans fts-firebase.js",
        recipientCount: recipientUids.length,
        recipients: recipientUids,
        cat: target.category,
        subcat: target.subcategory,
        createdAt: Date.now()
      }).catch(() => {});
      return;
    }

    const pushPayloadBase = {
      group: target.group,
      subgroup: target.subgroup,
      category: target.category,
      subcategory: target.subcategory,
      type: "resource",
      resourceId: data.key || "",
      title: "FTS — Nouveau document",
      body: (data.name || "Nouveau document") + (catLabel ? " · " + catLabel : ""),
      url,
      senderUid: currentUserUid
    };

    await Promise.allSettled(recipientUids.map(uid =>
      fetch(FTS.PUSH.workerUrl + "/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pushPayloadBase,
          uid,
          uids: [uid],
          recipientUids: [uid],
          recipients: [uid],
          tag: "resource-" + (data.key || Date.now()) + "-" + uid
        })
      })
    ));
  } catch(e) {
    console.warn("[FTS Profs] Notification document non envoyée", e);
  }
}

/* ── CHARGEMENT DOCUMENTS ─────────────────────────────────────── */
function loadDocs() {
  db.ref("fts_ressources").orderByChild("createdAt").on("value", snap => {
    allDocs = [];
    if (snap.exists()) {
      snap.forEach(child => {
        const d = child.val();
        // Profs voient seulement leurs disciplines
        if (userProfile.role !== "admin") {
          const discs = userProfile.disciplines || [];
          const dcat = d.cat || d.category;
          if (!discs.includes(dcat)) return;
        }
        allDocs.unshift({ ...d, cat: d.cat || d.category || "", subcat: d.subcat || d.subcategory || "", url: d.url || d.content || "", key: child.key }); // plus récent en premier
      });
    }
    document.getElementById("manage-count").textContent = allDocs.length;
    updateProfsStats();
    applyFilters();
  });
}

/* ── FILTRES ──────────────────────────────────────────────────── */
function applyFilters() {
  const catFilter  = document.getElementById("filter-cat").value;
  const typeFilter = document.getElementById("filter-type").value;

  filteredDocs = allDocs.filter(d => {
    if (catFilter  && d.cat  !== catFilter)  return false;
    if (typeFilter && d.type !== typeFilter) return false;
    return true;
  });

  renderDocs();
}

/* ── RENDU LISTE ──────────────────────────────────────────────── */
function renderDocs() {
  const el = document.getElementById("doc-list");

  if (!filteredDocs.length) {
    el.innerHTML = '<div class="empty-manage">Aucun document publié pour le moment.</div>';
    return;
  }

  el.innerHTML = filteredDocs.map(d => {
    const icon = TYPE_ICONS[d.type] || "□";
    const date = d.createdAt ? new Date(d.createdAt).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" }) : "—";
    const isAdmin = userProfile.role === "admin";

    return `<div class="doc-item">
      <div class="doc-item-icon">${icon}</div>
      <div class="doc-item-info">
        <div class="doc-item-name">${FTS.esc(d.name)}</div>
        <div class="doc-item-meta">
          <span class="doc-item-cat">${FTS.esc(d.cat)}${d.subcat ? " — " + FTS.esc(d.subcat) : ""}</span>
          <span>${FTS.esc(d.type)}</span>
          <span>${date}</span>
          ${isAdmin && d.authorName ? `<span>par ${FTS.esc(d.authorName)}</span>` : ""}
        </div>
      </div>
      <div class="doc-item-actions">
        <button class="btn-edit"   onclick="openEditModal('${FTS.esc(d.key)}')">✎ Éditer</button>
        <button class="btn-delete" onclick="deleteDoc('${FTS.esc(d.key)}', '${FTS.esc(d.name)}')">🗑 Supprimer</button>
      </div>
    </div>`;
  }).join("");
}

/* ── SUPPRESSION ──────────────────────────────────────────────── */
async function deleteDoc(key, name) {
  if (!confirm("Supprimer « " + name + " » ?\n\nCette action est irréversible.")) return;
  try {
    await db.ref("fts_ressources/" + key).remove();
    // allDocs se met à jour via le listener .on("value")
  } catch(e) {
    alert("Erreur lors de la suppression.");
  }
}

/* ── MODALE ÉDITION ───────────────────────────────────────────── */
function openEditModal(key) {
  const d = allDocs.find(x => x.key === key);
  if (!d) return;

  document.getElementById("edit-key").value = key;
  document.getElementById("e-cat").value    = d.cat || "";
  document.getElementById("e-type").value   = d.type || "doc";
  document.getElementById("e-name").value   = d.name || "";
  document.getElementById("e-url").value    = d.url  || "";
  document.getElementById("e-text").value   = d.text || "";

  updateEditSubcats();
  // Sélectionner la bonne sous-cat après rendu
  setTimeout(() => {
    document.getElementById("e-subcat").value = d.subcat || "";
  }, 50);

  document.getElementById("edit-modal").classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
}

async function saveEdit() {
  const key    = document.getElementById("edit-key").value;
  const cat    = document.getElementById("e-cat").value;
  const subcat = document.getElementById("e-subcat").value;
  const type   = document.getElementById("e-type").value;
  const name   = document.getElementById("e-name").value.trim();
  const url    = document.getElementById("e-url").value.trim();
  const text   = document.getElementById("e-text").value.trim();

  if (!cat || !name) { alert("Catégorie et titre requis."); return; }

  try {
    const data = {
      cat, category: cat,
      subcat: subcat || "", subcategory: subcat || "",
      type, name,
      url, content: url,
      text,
      active: true,
      status: "active",
      visibility: "members",
      updatedAt: Date.now(),
    };
    await db.ref("fts_ressources/" + key).update(data);
    await FTS.ensureResourceCategory(db, data);
    await buildCatSelectors();
    closeEditModal();
  } catch(e) {
    alert("Erreur lors de la modification.");
  }
}

/* ── BADGE NON LUS ────────────────────────────────────────────── */
function listenUnreadBadge(uid) {
  const db = FTS.initFirebase ? firebase.database() : null;
  if (!db) return;
  db.ref('fts_dm/userConvs/' + uid).on('value', async snap => {
    const convIds = snap.val() ? Object.keys(snap.val()) : [];
    if (!convIds.length) { updateMsgBadge(0); return; }
    let total = 0;
    await Promise.all(convIds.map(id =>
      db.ref('fts_dm/conversations/' + id + '/unread/' + uid).once('value')
        .then(s => { total += (s.val() || 0); })
    ));
    updateMsgBadge(total);
  });
}
function updateMsgBadge(count) {
  const el = document.getElementById('msg-badge');
  if (!el) return;
  if (count > 0) { el.textContent = count > 99 ? '99+' : count; el.style.display = 'inline-block'; }
  else { el.style.display = 'none'; }
}

/* ── UTILITAIRES ──────────────────────────────────────────────── */
function showMsg(msg, type) {
  const el = document.getElementById("msg");
  el.className = "msg " + type;
  el.textContent = msg;
  el.style.display = "block";
  if (type === "success") setTimeout(() => el.style.display = "none", 4000);
}
function clearMsg() { document.getElementById("msg").style.display = "none"; }

function doSignOut() {
  auth.signOut().then(() => window.location.href = "auth.html");
}
