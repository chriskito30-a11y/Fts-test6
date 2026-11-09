/* Fais Ton Show · Aventure — moteur indépendant du reste de la PWA.
   Aucune collecte, aucun traceur, aucune prétendue disponibilité.
   Les événements fts:discovery restent locaux tant qu'un collecteur conforme n'est pas branché. */
(function () {
  "use strict";
  const data = window.FTSDiscoveryConfig;
  if (!data) { console.error("FTS Aventure : configuration absente"); return; }
  const get = (id) => document.getElementById(id);
  const sourceParam = new URLSearchParams(location.search).get("source") || "direct";
  const source = Object.prototype.hasOwnProperty.call(data.sources, sourceParam) ? sourceParam : "direct";
  const answers = { audience: null, age: null, motive: null, world: null, timing: null };
  let step = 0;
  let agePhase = false;
  let trialResultVersion = 0;
  const audienceChoices = [
    {id:"adult",icon:"✦",title:"Moi !",detail:"Une petite aventure rien que pour moi."},
    {id:"child",icon:"★",title:"Mon enfant",detail:"Une expérience à lui faire découvrir."},
    {id:"teen",icon:"↗",title:"Mon ado",detail:"Une nouvelle façon de créer et de partager."}
  ];
  const timingChoices = [
    {id:"now",icon:"↗",title:"Pourquoi pas maintenant !",detail:"J'aimerais savoir si je peux essayer."},
    {id:"rentree",icon:"◷",title:"À la rentrée 2027/2028",detail:"Une idée à garder pour la prochaine saison."},
    {id:"curious",icon:"✦",title:"Je suis juste curieux",detail:"Je regarde ce qui existe, sans engagement."}
  ];

  function emit(event, details) {
    // Point d'extension uniquement : aucun envoi réseau ni persistance.
    document.dispatchEvent(new CustomEvent("fts:discovery", {
      detail: Object.assign({event:event, source:source}, details || {})
    }));
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function isParent() { return answers.audience === "child" || answers.audience === "teen"; }
  function noun() { return answers.audience === "teen" ? "ton ado" : "ton enfant"; }
  function show(which) {
    ["intro","journey","result"].forEach(function(id){ get(id).hidden = id !== which; });
    if (which === "journey") {
      get("stepTitle").setAttribute("tabindex", "-1");
      get("stepTitle").focus({preventScroll:true});
    }
    if (which === "result") {
      get("resultTitle").setAttribute("tabindex", "-1");
      get("resultTitle").focus({preventScroll:true});
    }
    scrollToTop();
  }
  function scrollToTop() {
    window.scrollTo({top:0,behavior:"instant"});
  }
  function start() {
    emit("start");
    step = 0;
    agePhase = false;
    renderStep();
  }
  function restart() {
    trialResultVersion += 1;
    Object.keys(answers).forEach(function(k){ answers[k] = null; });
    step = 0;
    agePhase = false;
    emit("restart");
    show("intro");
    get("startBtn").focus({preventScroll:true});
  }
  function question() {
    if (step === 0) return {
      eyebrow:"01 · POUR QUI ?", title:"Cette aventure, ce serait pour qui ?",
      description:"Peut-être pour toi, ou pour quelqu'un à qui tu as envie de faire découvrir quelque chose.",
      choices:audienceChoices
    };
    if (step === 1) return {
      eyebrow:"02 · TON ENVIE",
      title:isParent() ? "Qu'est-ce qui pourrait donner envie à " + noun() + " ?" : "Qu'est-ce qui te ferait le plus plaisir ?",
      description:"Oublie les disciplines pour un instant. Commence simplement par ce qui fait envie.",
      choices:data.motives.map(function(m){return {id:m.id,icon:m.icon,title:m.title,detail:m.detail};})
    };
    if (step === 2) return {
      eyebrow:"03 · LES UNIVERS",
      title:isParent() ? "Qu'est-ce que " + noun() + " aurait envie de découvrir ?" : "Qu'est-ce qui t'intrigue le plus ?",
      description:"Tu peux aussi choisir « Surprenez-moi ! ». Pas besoin de connaître déjà les activités.",
      choices:data.worlds
    };
    return {
      eyebrow:"04 · ET APRÈS ?",
      title:isParent() ? "Et si vous essayiez, ce serait quand ?" : "Tu te verrais essayer quand ?",
      description:"Aucune obligation : cela sert uniquement à proposer la suite qui te convient.",
      choices:timingChoices
    };
  }

  function renderStep() {
    show("journey");
    get("stepCount").textContent = String(step + 1).padStart(2,"0") + " / 04";
    get("progressTrack").setAttribute("aria-valuenow",String(step + 1));
    get("progressFill").style.width = ((step + 1) * 25) + "%";
    const q = question();
    get("stepEyebrow").textContent = agePhase ? "01 · L'ÂGE (FACULTATIF)" : q.eyebrow;
    get("stepTitle").textContent = agePhase ? "Quel âge a " + noun() + " ?" : q.title;
    get("stepDescription").textContent = agePhase ?
      "Cela nous évite de proposer un groupe manifestement inadapté." : q.description;
    get("stepChoices").hidden = agePhase;
    get("ageStep").hidden = !agePhase;
    if (agePhase) {
      get("ageInput").value = answers.age == null ? "" : answers.age;
      get("ageError").hidden = true;
      return;
    }
    const items = q.choices;
    get("stepChoices").innerHTML = items.map(function(c){
      const icon = c.icon || "✦";
      return '<button type="button" class="choice-btn" data-option="' + escapeHtml(c.id) + '">' +
        '<span class="choice-icon" aria-hidden="true">' + escapeHtml(icon) + '</span>' +
        '<span class="choice-text"><strong>' + escapeHtml(c.title) + '</strong>' +
        (c.detail ? '<small>' + escapeHtml(c.detail) + '</small>' : '') + '</span></button>';
    }).join("");
    get("stepChoices").querySelectorAll("[data-option]").forEach(function(button) {
      button.addEventListener("click", function(){ choose(button.dataset.option); });
    });
  }

  function choose(value) {
    if (step === 0) {
      if (!audienceChoices.some(function(c){return c.id === value;})) return;
      if (answers.audience !== value) answers.age = null;
      answers.audience = value;
      emit("answer", {question:"audience",value:value});
      if (isParent()) { agePhase = true; renderStep(); return; }
    } else if (step === 1) {
      if (!data.motives.some(function(c){return c.id === value;})) return;
      answers.motive = value;
      emit("answer", {question:"motive",value:value});
    } else if (step === 2) {
      if (!data.worlds.some(function(c){return c.id === value;})) return;
      answers.world = value;
      emit("answer", {question:"world",value:value});
    } else {
      if (!timingChoices.some(function(c){return c.id === value;})) return;
      answers.timing = value;
      emit("answer", {question:"timing",value:value});
      renderResult();
      return;
    }
    step += 1;
    agePhase = false;
    renderStep();
  }

  function continueAge(skip) {
    if (skip) {
      answers.age = null;
    } else {
      const raw = get("ageInput").value.trim();
      const age = Number(raw);
      if (!raw || !Number.isInteger(age) || age < 3 || age > 17) {
        get("ageError").textContent = "Indique un âge entier entre 3 et 17 ans, ou passe cette question.";
        get("ageError").hidden = false;
        get("ageInput").focus();
        return;
      }
      answers.age = age;
    }
    emit("age_step", {provided:answers.age != null});
    agePhase = false;
    step = 1;
    renderStep();
  }

  function goBack() {
    if (agePhase) {
      agePhase = false; step = 0;
    } else if (step === 0) {
      show("intro"); return;
    } else if (step === 1 && isParent()) {
      step = 0; agePhase = true;
    } else {
      step -= 1;
    }
    emit("back", {step:step + 1});
    renderStep();
  }

  function permitted(activity) {
    if (!answers.audience || !activity.audiences.includes(answers.audience)) return false;
    if (answers.age == null) {
      // Ne pas suggérer un groupe d'âge chiffré sans connaître l'âge.
      return !(activity.minAge != null && activity.maxAge != null);
    }
    return !(activity.minAge != null && answers.age < activity.minAge) &&
           !(activity.maxAge != null && answers.age > activity.maxAge);
  }
  function score(activity) {
    const world = answers.world;
    const motive = answers.motive;
    let s = activity.motives.includes(motive) ? 12 : 0;
    if (world !== "surprise" && activity.worlds.includes(world)) s += 36;
    if (world === "surprise") {
      if (motive === "rire" && activity.family === "jeu") s += 7;
      if (motive === "collectif" && (activity.family === "mixte" || activity.family === "voix")) s += 7;
      if (motive === "creer" && activity.family === "mixte") s += 7;
      if (motive === "nouveau" && (activity.family === "magie" || activity.family === "musique")) s += 7;
    }
    if (answers.age != null && activity.minAge != null && activity.maxAge != null) s += 2;
    return s;
  }
  function recommendations() {
    const sorted = data.activities.filter(permitted).map(function(a,i){
      return {activity:a,score:score(a),order:i};
    }).sort(function(a,b){return b.score - a.score || a.order-b.order;});
    if (!sorted.length) return [];
    const first = sorted[0].activity;
    // En mode surprise, la deuxième expérience doit réellement être contrastée.
    let second = null;
    if (answers.world === "surprise") {
      second = sorted.find(function(row){return row.activity.id !== first.id && row.activity.family !== first.family;});
    }
    if (!second) second = sorted.find(function(row){return row.activity.id !== first.id;});
    return [first].concat(second ? [second.activity] : []);
  }
  function messageLink(topic, proposals) {
    const motive = data.motives.find(function(m){return m.id === answers.motive;});
    const world = data.worlds.find(function(w){return w.id === answers.world;});
    const forWho = answers.audience === "adult" ? "Moi-même" : (answers.audience === "teen" ? "Mon ado" : "Mon enfant");
    const age = answers.age == null ? "Non précisé" : String(answers.age) + " ans";
    const subject = topic === "now" ? "FTS — demande d'informations pour un essai" : "FTS — informations rentrée 2027/2028";
    const body = [
      "Bonjour,",
      "",
      topic === "now" ? "Je souhaiterais savoir s'il est possible de faire un essai." :
        "Je souhaite être informé(e) des possibilités pour la rentrée 2027/2028.",
      "",
      "Pour : " + forWho,
      "Âge (si concerné) : " + age,
      "Ce qui m'attire : " + (motive ? motive.title : "Non précisé"),
      "Univers : " + (world ? world.title : "Non précisé"),
      "Activités découvertes : " + proposals.map(function(a){return a.title;}).join(", "),
      "Origine de la découverte : " + source,
      "",
      "Merci pour vos renseignements.",
      ""
    ].join("\n");
    return "mailto:contact@faistonshow.fr?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }
  async function displayPublishedTrials(proposals, version) {
    const api = window.FTSTrials;
    if (!api) {
      get("ctaNote").textContent = "Les créneaux d'essai ne sont pas consultables pour l'instant. Le bouton permet de contacter FTS.";
      return;
    }
    let listing;
    try { listing = await api.load(); }
    catch (_) { listing = {status:"unavailable",categories:[]}; }
    if (version !== trialResultVersion || answers.timing !== "now" || get("result").hidden) return;
    const action = get("mainCta");
    const note = get("ctaNote");
    const panel = get("trialMatches");
    if (listing.status !== "ok") {
      note.textContent = "Impossible de consulter les créneaux publiés pour le moment. Tu peux demander des renseignements à FTS par e-mail.";
      return;
    }
    const available = proposals.flatMap(function(activity) {
      return api.matches(activity, answers, listing.categories);
    });
    if (!available.length) {
      note.textContent = "Aucun créneau d'essai correspondant n'est actuellement publié pour ces activités. Le bouton prépare une demande d'information, sans réservation.";
      return;
    }
    panel.innerHTML = '<h3 class="results-section-title">DES ESSAIS À DÉCOUVRIR</h3>' +
      '<p>Voici les créneaux publiés qui correspondent à ce que tu nous as indiqué. Tu accèdes directement au lien HelloAsso du créneau choisi.</p>' +
      '<div class="trial-list">' + available.map(function(item) {
        return '<a class="trial-link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer" data-activity="' + escapeHtml(item.activityId) + '">' +
          '<span class="trial-title"><strong>' + escapeHtml(item.activityTitle) + '</strong><span>' +
          escapeHtml(item.courseName) + (item.detail ? ' · ' + escapeHtml(item.detail) : '') +
          '</span></span><span aria-hidden="true">↗</span></a>';
      }).join('') + '</div>';
    panel.hidden = false;
    panel.querySelectorAll("[data-activity]").forEach(function(link) {
      link.addEventListener("click", function() {
        emit("trial_link_click", {activity:link.dataset.activity});
      });
    });
    if (available.length === 1) {
      action.href = available[0].url;
      action.target = "_blank";
      action.rel = "noopener noreferrer";
      action.textContent = "VOIR CET ESSAI SUR HELLOASSO ↗";
    } else {
      action.href = "#trialMatches";
      action.removeAttribute("target");
      action.removeAttribute("rel");
      action.textContent = "CHOISIR MON CRÉNEAU ↓";
    }
    note.textContent = "Les liens proviennent du site des essais FTS. Un créneau publié ne garantit pas qu'il reste une place : vérifier les conditions sur HelloAsso.";
    emit("trial_matches", {activities:available.map(function(x){return x.activityId;}),count:available.length});
  }

  function renderResult() {
    const version = ++trialResultVersion;
    get("trialMatches").hidden = true;
    get("trialMatches").innerHTML = "";
    get("mainCta").removeAttribute("target");
    get("mainCta").removeAttribute("rel");
    const motive = data.motives.find(function(m){return m.id === answers.motive;}) || data.motives[0];
    const proposals = recommendations();
    const parent = isParent();
    get("resultTitle").textContent = parent ? motive.parentHeadline.replace("ton enfant", noun()) : motive.headline;
    get("resultIntro").textContent = motive.intro;
    get("resultCards").innerHTML = proposals.map(function(a) {
      return '<article class="result-card"><div class="result-icon" aria-hidden="true">' + escapeHtml(a.icon) + '</div>' +
        '<h4>' + escapeHtml(a.title) + '</h4><p>' + escapeHtml(a.detail) + '</p><small>' +
        escapeHtml(a.condition || "Les conditions d'accès sont à vérifier.") + '</small></article>';
    }).join("");
    if (!proposals.length) {
      get("resultCards").innerHTML = '<article class="result-card"><h4>Un groupe à confirmer avec FTS</h4>' +
        '<p>Nous ne pouvons pas identifier avec suffisamment de certitude une activité adaptée avec ces informations.</p>' +
        '<small>Contacte l’équipe si tu souhaites vérifier les possibilités.</small></article>';
    }
    const ageWarning = parent && answers.age == null ? " Sans âge renseigné, les propositions sont indicatives et nécessitent une vérification." : "";
    get("resultNote").textContent = "Ces pistes partent de tes envies, pas d'un test de personnalité. Les places, horaires et conditions ne sont pas vérifiés ici." + ageWarning;
    const action = get("mainCta");
    const secondary = document.querySelector(".result-actions .secondary-btn");
    if (answers.timing === "now") {
      action.href = messageLink("now", proposals);
      action.textContent = "ME RENSEIGNER SUR UN ESSAI ↗";
      get("ctaNote").textContent = "Recherche des créneaux publiés sur le site des essais FTS…";
      secondary.href = "../saison.html";
      secondary.textContent = "VOIR LES ACTIVITÉS ACTUELLES ↗";
    } else if (answers.timing === "rentree") {
      action.href = messageLink("rentree", proposals);
      action.textContent = "DEMANDER LES INFOS RENTRÉE 2027 ↗";
      get("ctaNote").textContent = "Le bouton ouvre un e-mail prérempli. Ce n'est ni une inscription automatique ni un abonnement à une newsletter.";
      secondary.href = "../saison.html";
      secondary.textContent = "DÉCOUVRIR LES ACTIVITÉS ↗";
    } else {
      action.href = "../saison.html";
      action.textContent = "EXPLORER LES ACTIVITÉS FTS ↗";
      get("ctaNote").textContent = "Tu peux continuer à découvrir Fais Ton Show sans laisser de coordonnées.";
      secondary.href = "../index.html";
      secondary.textContent = "DÉCOUVRIR LE SITE FTS ↗";
    }
    get("apprehensionReply").textContent = "";
    get("apprehensionChoices").innerHTML = data.apprehensions.map(function(item) {
      return '<button type="button" aria-pressed="false" data-apprehension="' + escapeHtml(item.id) + '">' +
        escapeHtml(item.label) + '</button>';
    }).join("");
    get("apprehensionChoices").querySelectorAll("button").forEach(function(button) {
      button.addEventListener("click", function() {
        const item = data.apprehensions.find(function(a){return a.id === button.dataset.apprehension;});
        get("apprehensionChoices").querySelectorAll("button").forEach(function(b){
          b.setAttribute("aria-pressed", String(b === button));
        });
        get("apprehensionReply").textContent = item ? item.reply : "";
      });
    });
    emit("complete", {motive:answers.motive,world:answers.world,timing:answers.timing,recommendations:proposals.map(function(a){return a.id;})});
    show("result");
    if(answers.timing === "now") void displayPublishedTrials(proposals, version);
  }

  get("sourceLine").textContent = data.sources[source].line;
  get("startBtn").addEventListener("click", start);
  get("backBtn").addEventListener("click", goBack);
  get("resultBack").addEventListener("click", function(){
    trialResultVersion += 1;
    step = 3; agePhase = false; renderStep();
  });
  get("ageContinue").addEventListener("click", function(){ continueAge(false); });
  get("ageSkip").addEventListener("click", function(){ continueAge(true); });
  get("ageInput").addEventListener("keydown", function(e){
    if (e.key === "Enter") {e.preventDefault(); continueAge(false);}
  });
  get("restartBtn").addEventListener("click", restart);
  get("mainCta").addEventListener("click", function(){emit("cta_click", {timing:answers.timing});});
  document.querySelector(".result-actions .secondary-btn").addEventListener("click", function(){emit("activities_click");});
  window.FTSDiscovery = { // Interface de test, sans dépendance au reste de la PWA.
    source:source,
    getState:function(){return {step:step,agePhase:agePhase,answers:Object.assign({},answers)};},
    getRecommendations:function(){return recommendations().map(function(a){return a.id;});}
  };
})();
