/* ================================================================
   FAQ.JS — Centre d’aide FTS
   - FAQ publique application + membres/parents
   - FAQ professeurs affichée uniquement pour rôle prof/admin
   - Pas de nouvelle structure Firebase
   ================================================================ */
'use strict';

(function(){
  const db = FTS.initFirebase();

  const FAQ_DATA = [
    {
      id: 'app',
      type: 'public',
      icon: '📱',
      title: 'Application / PWA',
      intro: 'Installer l’application, recevoir les notifications et retrouver les informations importantes.',
      items: [
        ['Comment installer l’application Fais Ton Show ?', 'Depuis le navigateur de votre téléphone, ouvrez le site Fais Ton Show puis utilisez le bouton d’installation proposé. Sur Android, l’installation est généralement proposée automatiquement. Sur iPhone, il faut passer par le bouton de partage puis “Sur l’écran d’accueil”.'],
        ['L’application est-elle obligatoire ?', '<strong>Elle est fortement recommandée.</strong> L’application devient la source officielle pour suivre les informations importantes, les documents, les messages, les groupes et les événements.'],
        ['Où trouver les horaires, répétitions, documents et annonces ?', 'Tout doit être consulté directement dans <strong>l’application FTS</strong>. L’objectif est d’éviter les informations dispersées entre WhatsApp, Messenger, mails ou réseaux sociaux.'],
        ['Pourquoi activer les notifications ?', 'Les notifications servent à recevoir les informations importantes : nouveaux documents, messages, changements d’organisation, événements ou rappels.'],
        ['Je ne reçois plus les notifications, que faire ?', 'Vérifiez les notifications du téléphone, vérifiez que l’application est bien autorisée à envoyer des notifications, puis réinstallez l’application si nécessaire. Si le problème continue, contactez l’association.'],
        ['À quoi sert l’onglet “Non lus” ?', 'Il permet de retrouver rapidement les nouveautés qui vous concernent : nouveaux documents, annonces importantes ou événements non consultés.'],
        ['Est-ce que je vois toutes les informations de l’association ?', 'Non. L’application affiche les informations qui correspondent à votre profil, vos activités et, si vous êtes parent, aux activités de vos enfants.'],
        ['L’application va-t-elle évoluer ?', 'Oui. L’application Fais Ton Show évoluera progressivement pour centraliser encore mieux la vie de l’association.']
      ]
    },
    {
      id: 'membres',
      type: 'public',
      icon: '🎭',
      title: 'Membres / parents',
      intro: 'Inscriptions, cours, absences, paiements et suivi des enfants.',
      items: [
        ['Peut-on faire un cours d’essai ?', 'Oui, un cours d’essai gratuit est possible.'],
        ['À partir de quel âge peut-on s’inscrire ?', 'L’âge dépend de l’activité. Certaines activités commencent vers 6/7 ans, d’autres peuvent avoir des conditions différentes.'],
        ['Peut-on s’inscrire en cours d’année ?', 'Oui, selon les places disponibles.'],
        ['Comment se passe l’inscription ?', 'L’inscription se fait via <strong>HelloAsso</strong>.'],
        ['Quels moyens de paiement sont acceptés ?', 'Les paiements peuvent se faire par carte bancaire via HelloAsso, par chèque ou en espèces.'],
        ['Les paiements peuvent-ils être échelonnés ?', 'Oui, le paiement échelonné est possible.'],
        ['Le remboursement est-il possible ?', 'Non, les remboursements ne sont pas prévus.'],
        ['Que se passe-t-il si un cours est complet ?', 'Une liste d’attente peut être mise en place et une autre proposition de groupe peut être faite si c’est possible.'],
        ['Un parent peut-il suivre plusieurs enfants avec un seul compte ?', 'Oui. Un même compte parent peut suivre plusieurs enfants et voir les informations correspondant à leurs activités.'],
        ['Les enfants peuvent-ils avoir leur propre compte ?', 'Oui, selon l’âge et les besoins.']
      ]
    },
    {
      id: 'organisation',
      type: 'public',
      icon: '📌',
      title: 'Fonctionnement Fais Ton Show',
      intro: 'Organisation des cours, spectacles, répétitions, costumes et vie associative.',
      items: [
        ['Comment les parents sont-ils informés des changements ?', 'Les changements sont communiqués via l’application FTS.'],
        ['Que faire en cas d’absence ?', 'Il faut prévenir le professeur ou utiliser l’application lorsque c’est possible.'],
        ['Faut-il prévenir en cas de retard ?', 'Oui, il faut prévenir en cas de retard.'],
        ['Les cours sont-ils maintenus pendant les vacances scolaires ?', 'Non, sauf indication contraire.'],
        ['Les parents peuvent-ils assister aux cours ?', 'Non, les cours ne sont pas ouverts aux parents, sauf organisation particulière.'],
        ['Les spectacles sont-ils obligatoires ?', 'Cela dépend de l’activité. La participation aux spectacles est importante pour les projets collectifs.'],
        ['L’assiduité est-elle importante pour les spectacles ?', 'Oui, elle est très importante. Les absences répétées compliquent l’organisation collective.'],
        ['Un élève absent souvent peut-il perdre un rôle important ?', 'Non, ce n’est pas une règle automatique. Les situations sont gérées avec bienveillance.'],
        ['Les répétitions supplémentaires sont-elles fréquentes ?', 'Elles sont surtout prévues avant les spectacles. Les ajouts de dernière minute restent rares et exceptionnels.'],
        ['Qui fournit les costumes ?', 'Cela peut être un mélange entre l’association et les familles selon les spectacles.'],
        ['Les familles doivent-elles parfois acheter certains éléments ?', 'Oui, parfois certains éléments peuvent être demandés selon les besoins du spectacle.'],
        ['Les instruments ou matériels sont-ils fournis ?', 'Cela dépend de l’activité et du matériel concerné.'],
        ['Les spectacles sont-ils filmés ou photographiés ?', 'Certains spectacles peuvent l’être. Les photos et vidéos peuvent être utilisées avec autorisation.'],
        ['Où retrouver les photos et vidéos des spectacles ?', 'Cela dépend des projets : application, galerie, lien partagé ou autre support indiqué par l’association.'],
        ['Les parents peuvent-ils aider bénévolement ?', 'Oui, l’aide bénévole des parents est bienvenue selon les besoins.'],
        ['L’association organise-t-elle des stages, événements ou projets spéciaux ?', 'Oui, régulièrement. Les informations sont communiquées via l’application.'],
        ['Quel est l’objectif principal de l’application FTS ?', 'Centraliser les informations, faciliter la communication et réduire les oublis.']
      ]
    },
    {
      id: 'profs',
      type: 'profs',
      icon: '🎓',
      title: 'FAQ Professeurs',
      intro: 'Bonnes pratiques pour publier, cibler les bons groupes et centraliser la communication.',
      items: [
        ['À quoi sert l’espace professeurs ?', 'Il permet aux professeurs autorisés de publier des ressources, documents, liens, vidéos ou informations utiles pour leurs groupes.'],
        ['Qui peut voir la FAQ professeurs ?', 'Uniquement les comptes avec le rôle <strong>prof</strong> ou <strong>admin</strong>.'],
        ['Comment choisir les bons groupes pour une ressource ?', 'Il faut sélectionner uniquement les catégories et sous-catégories concernées. Un document théâtre ne doit pas être publié pour les groupes danse, et inversement.'],
        ['Que voit un membre ?', 'Un membre voit uniquement les informations correspondant à son profil, ses activités et éventuellement celles de ses enfants.'],
        ['Que se passe-t-il si aucune catégorie n’est ciblée ?', 'Selon le type de contenu, cela peut le rendre visible largement. Il faut donc cibler soigneusement pour éviter les erreurs.'],
        ['Quand utiliser une ressource ?', 'Pour partager un document durable : texte, partition, tablature, playback, vidéo, lien, consigne de travail ou support pédagogique.'],
        ['Quand utiliser les messages ?', 'Pour une discussion, une question individuelle, un échange rapide ou une information qui demande une réponse.'],
        ['Quand utiliser le forum / groupes ?', 'Pour les échanges collectifs liés à une activité ou un groupe. Les informations utiles à plusieurs personnes doivent rester dans l’application.'],
        ['Comment éviter de multiplier WhatsApp, SMS ou Messenger ?', 'En utilisant FTS comme source principale : documents dans les ressources, échanges dans Messages, groupes dans Forum, événements dans Calendrier.'],
        ['Les événements doivent-ils être créés depuis l’espace contenus ?', 'Non. Les événements et spectacles doivent être gérés depuis Calendrier admin afin d’éviter les doublons et les erreurs.'],
        ['Comment signaler une information importante ?', 'Utilisez les options d’importance/priorité prévues dans les espaces admin concernés. Une information importante doit rester claire, ciblée et utile.'],
        ['Faut-il prévenir avant de publier un document ?', 'Si le document concerne un groupe précis, il suffit de le publier avec le bon ciblage. Pour une information sensible ou globale, il vaut mieux vérifier avec l’administration.'],
        ['Quels contenus éviter ?', 'Évitez les doublons, les contenus non finalisés, les titres trop vagues et les publications sans catégorie claire.'],
        ['Quel titre donner à une ressource ?', 'Un titre simple et reconnaissable : “Texte scène 4”, “Playback final”, “Partition couplet 1”, “Vidéo répétition du 12 mai”.'],
        ['Que faire en cas d’erreur de publication ?', 'Modifier ou supprimer le contenu si l’interface le permet, sinon contacter un administrateur rapidement.'],
        ['Quelle est la règle d’or ?', '<strong>Une information utile doit être facile à retrouver.</strong> FTS doit éviter la dispersion et réduire la charge mentale des familles, élèves et professeurs.']
      ]
    }
  ];

  const state = {
    query: '',
    filter: 'all',
    canSeeProf: false,
    roleLoaded: false
  };

  const els = {
    content: document.getElementById('faq-content'),
    empty: document.getElementById('faq-empty'),
    search: document.getElementById('faq-search'),
    tabs: Array.from(document.querySelectorAll('.faq-tab')),
    profTab: document.querySelector('.faq-prof-tab'),
    roleNote: document.getElementById('faq-role-note'),
    reset: document.getElementById('faq-reset')
  };

  function esc(value){
    if (window.FTS && typeof FTS.esc === 'function') return FTS.esc(value || '');
    return String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function normalize(value){
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function sectionIsAllowed(section){
    return section.type !== 'profs' || state.canSeeProf;
  }

  function sectionMatchesFilter(section){
    return state.filter === 'all' || section.id === state.filter;
  }

  function itemMatchesQuery(section, item){
    if (!state.query) return true;
    const haystack = normalize(section.title + ' ' + section.intro + ' ' + item[0] + ' ' + item[1]);
    return haystack.includes(state.query);
  }

  function render(){
    const html = FAQ_DATA
      .filter(sectionIsAllowed)
      .filter(sectionMatchesFilter)
      .map(section => {
        const items = section.items.filter(item => itemMatchesQuery(section, item));
        if (!items.length) return '';
        return `
          <section class="faq-section" data-section="${esc(section.id)}">
            <div class="faq-section-header">
              <div class="faq-section-icon">${esc(section.icon)}</div>
              <div>
                <h2>${esc(section.title)}</h2>
                <p>${esc(section.intro)}</p>
              </div>
            </div>
            <div class="faq-list">
              ${items.map((item, index) => `
                <article class="faq-item">
                  <button class="faq-question" type="button" aria-expanded="false">
                    <span>${esc(item[0])}</span>
                    <span class="faq-chevron">⌄</span>
                  </button>
                  <div class="faq-answer">${item[1]}</div>
                </article>
              `).join('')}
            </div>
          </section>`;
      })
      .join('');

    els.content.innerHTML = html;
    const hasResults = !!html.trim();
    els.empty.hidden = hasResults;
    els.content.hidden = !hasResults;
  }

  function setFilter(filter){
    state.filter = filter;
    els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.filter === filter));
    render();
  }

  function bindEvents(){
    els.search.addEventListener('input', () => {
      state.query = normalize(els.search.value);
      render();
    });

    els.tabs.forEach(tab => {
      tab.addEventListener('click', () => setFilter(tab.dataset.filter || 'all'));
    });

    els.content.addEventListener('click', event => {
      const btn = event.target.closest('.faq-question');
      if (!btn) return;
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
    });

    if (els.reset) {
      els.reset.addEventListener('click', () => {
        els.search.value = '';
        state.query = '';
        setFilter('all');
      });
    }
  }

  function updateRoleUi(profile){
    const role = profile && profile.role;
    state.canSeeProf = role === 'prof' || role === 'admin';
    state.roleLoaded = true;

    if (els.profTab) els.profTab.hidden = !state.canSeeProf;

    if (els.roleNote) {
      if (state.canSeeProf) {
        els.roleNote.hidden = false;
        els.roleNote.textContent = role === 'admin'
          ? '🛡 Mode admin : la FAQ professeurs est disponible.'
          : '🎓 Mode professeur : la FAQ professeurs est disponible.';
      } else {
        els.roleNote.hidden = true;
        if (state.filter === 'profs') setFilter('all');
      }
    }
    render();
  }

  async function loadRole(){
    if (!db || typeof firebase === 'undefined' || !firebase.auth) {
      updateRoleUi(null);
      return;
    }

    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        updateRoleUi(null);
        return;
      }
      try {
        const snap = await db.ref('fts_users/' + user.uid).once('value');
        updateRoleUi(snap.val() || null);
      } catch (error) {
        console.warn('[FTS FAQ] Impossible de charger le rôle utilisateur', error);
        updateRoleUi(null);
      }
    });
  }

  bindEvents();
  render();
  loadRole();
})();
