'use strict';

window.FTSQuestData = {
  version: '0.7.0-avent-noel',
  storageKeys: {
    player: 'ftsQuest.player.v2',
    avatar: 'ftsQuest.avatar.v2',
    log: 'ftsQuest.log.v3',
    codesHistory: 'ftsQuest.codes.history.v1',
    codesProgress: 'ftsQuest.codes.progress.v1',
    playerProgress: 'ftsQuest.player.progress.v1',
    challengesState: 'ftsQuest.challenges.state.v1',
    trophiesState: 'ftsQuest.trophies.state.v1',
    adventureState: 'ftsQuest.aventure.state.v1',
    adventState: 'ftsQuest.advent.state.v1'
  },
  player: {
    name: 'Artiste FTS',
    discipline: 'Théâtre · Chant · Danse · Musique',
    xp: 120,
    nextXp: 700,
    act: 'Acte II',
    levelLabel: 'Je m’entraîne',
    activeTitle: 'Artiste en route',
    badges: 1,
    titles: 1,
    challenges: 0
  },
  todayAction: {
    kicker: 'Aujourd’hui dans FTS Quest',
    title: 'Prépare ton prochain cours',
    description: 'Une petite mission utile pour arriver plus serein, mieux écouter le groupe et progresser sans pression.',
    time: '3 minutes',
    reward: 'Progression esprit de troupe',
    steps: [
      'Vérifie ton prochain horaire ou ton prochain objectif.',
      'Choisis un mini-défi artistique à faire avant le cours.',
      'Note une question ou une intention à apporter au groupe.'
    ],
    primaryLabel: 'Faire ma mission du jour',
    primaryHref: 'quest-defis.html',
    secondaryLabel: 'Lancer un exercice',
    secondaryHref: 'quest-roulette.html'
  },
  avatarDefault: {
    base: 'showrunner',
    palette: 'red_gold',
    primary: '#e7354f',
    secondary: '#ffd166',
    skin: '#f3b284',
    hair: '#23131f',
    eyes: '#7de3ff',
    eyeStyle: 'spark',
    accessory: 'director_hat',
    frame: 'legendary',
    aura: 'spotlight'
  },
  bases: [
    { id: 'showrunner', label: 'Showrunner', family: 'Comédie musicale', rarity: 'Légendaire', description: 'Leader de scène, énergie showtime et présence premium.' },
    { id: 'comedian', label: 'Caméléon de scène', family: 'Théâtre', rarity: 'Épique', description: 'Un visage expressif pensé pour l’impro, les émotions et le jeu.' },
    { id: 'vocal_star', label: 'Voix d’or', family: 'Chant', rarity: 'Rare', description: 'Un avatar lumineux pour les interprètes et chanteurs de troupe.' },
    { id: 'dance_nova', label: 'Nova Danse', family: 'Danse', rarity: 'Épique', description: 'Silhouette dynamique, aura néon, mouvement et impact scénique.' },
    { id: 'tempo_guardian', label: 'Gardien du tempo', family: 'Musique', rarity: 'Rare', description: 'Style musical, précis, parfait pour les élèves instruments et groupe.' },
    { id: 'backstage_mage', label: 'Mage des coulisses', family: 'Coulisses', rarity: 'Mythique', description: 'Ambiance mystérieuse pour l’aventure et les secrets de troupe.' }
  ],
  palettes: [
    { id: 'red_gold', label: 'Rideau rouge', primary: '#e7354f', secondary: '#ffd166', bg: '#140814' },
    { id: 'violet_neon', label: 'Néon violet', primary: '#7c4dff', secondary: '#7de3ff', bg: '#080a1e' },
    { id: 'blue_stage', label: 'Scène bleue', primary: '#1e88e5', secondary: '#b7ff5a', bg: '#061525' },
    { id: 'pink_pop', label: 'Pop show', primary: '#ff4ecd', secondary: '#ffe45e', bg: '#21071c' },
    { id: 'green_groove', label: 'Groove', primary: '#00d084', secondary: '#ffb703', bg: '#051912' },
    { id: 'silver_shadow', label: 'Ombre argent', primary: '#b9c7d9', secondary: '#f7f7ff', bg: '#080b12' }
  ],
  skins: [
    { id: 'warm', label: 'Warm', value: '#f3b284' },
    { id: 'golden', label: 'Golden', value: '#d8945b' },
    { id: 'deep', label: 'Deep', value: '#8f563b' },
    { id: 'rose', label: 'Rose', value: '#f0a6a6' },
    { id: 'porcelain', label: 'Porcelaine', value: '#ffd7bd' },
    { id: 'fantasy', label: 'Fantaisie', value: '#c8a4ff' }
  ],
  hairColors: [
    { id: 'black', label: 'Noir scène', value: '#1d1420' },
    { id: 'brown', label: 'Brun', value: '#5a3522' },
    { id: 'blond', label: 'Blond show', value: '#f0c66c' },
    { id: 'red', label: 'Cuivre', value: '#bf4c32' },
    { id: 'blue', label: 'Bleu nuit', value: '#293b8f' },
    { id: 'white', label: 'Argent', value: '#edf1ff' }
  ],
  eyeStyles: [
    { id: 'spark', label: 'Étincelle', description: 'Regard vif et héroïque.' },
    { id: 'focus', label: 'Focus', description: 'Regard concentré de répétition.' },
    { id: 'smile', label: 'Sourire', description: 'Regard joyeux et accessible.' },
    { id: 'mystic', label: 'Mystique', description: 'Regard livre-jeu et coulisses.' }
  ],
  eyeColors: [
    { id: 'cyan', label: 'Cyan', value: '#7de3ff' },
    { id: 'gold', label: 'Or', value: '#ffd166' },
    { id: 'green', label: 'Vert', value: '#72f2a1' },
    { id: 'violet', label: 'Violet', value: '#d1a7ff' },
    { id: 'brown', label: 'Noisette', value: '#7a4a2b' },
    { id: 'pink', label: 'Rose néon', value: '#ff7ad9' }
  ],
  accessories: [
    { id: 'none', label: 'Sans accessoire', family: 'Tous', rarity: 'Commun' },
    { id: 'director_hat', label: 'Chapeau metteur en scène', family: 'Théâtre', rarity: 'Rare' },
    { id: 'crown_star', label: 'Couronne star', family: 'Show', rarity: 'Épique' },
    { id: 'cap_neon', label: 'Casquette néon', family: 'Danse', rarity: 'Rare' },
    { id: 'headphones', label: 'Casque tempo', family: 'Musique', rarity: 'Rare' },
    { id: 'mage_hat', label: 'Chapeau mystère', family: 'Coulisses', rarity: 'Mythique' }
  ],
  frames: [
    { id: 'classic', label: 'Classique', rarity: 'Commun' },
    { id: 'rare', label: 'Rare bleu', rarity: 'Rare' },
    { id: 'epic', label: 'Épique violet', rarity: 'Épique' },
    { id: 'legendary', label: 'Légendaire or', rarity: 'Légendaire' },
    { id: 'mythic', label: 'Mythique rouge', rarity: 'Mythique' }
  ],
  titles: [
    { id: 'new_talent', label: 'Nouveau talent', unlocked: true, description: 'Titre de départ pour entrer dans FTS Quest.' },
    { id: 'scene_explorer', label: 'Artiste en route', unlocked: true, description: 'Pour commencer le parcours avec une première mission utile.' },
    { id: 'impro_master', label: 'Écoute active', unlocked: false, description: 'Pour celles et ceux qui appliquent les consignes et soutiennent le groupe.' },
    { id: 'show_star', label: 'Prêt pour le plateau', unlocked: false, description: 'Pour une préparation spectacle sérieuse et sans oubli important.' },
    { id: 'backstage_guardian', label: 'Gardien des Coulisses', unlocked: false, description: 'Pour réussir le livre-jeu interactif avec esprit de troupe.' },
    { id: 'team_spirit', label: 'Esprit d’équipe', unlocked: true, description: 'Récompense les comportements positifs dans la communauté.' }
  ],
  missions: [
    { id: 'cours', title: 'Prêt pour le prochain cours', description: 'Arriver avec les bonnes infos et une intention simple.', percent: 65, steps: ['Horaire vérifié', 'Objectif choisi', 'Question préparée', 'Matériel prêt'] },
    { id: 'spectacle', title: 'Préparation spectacle', description: 'La checklist anti-oubli avant répétition ou représentation.', percent: 45, steps: ['Message prof lu', 'Costume prêt', 'Texte ou musique relu', 'Sac préparé'] },
    { id: 'troupe', title: 'Esprit de troupe', description: 'Valoriser ce qui rend un groupe plus fort.', percent: 35, steps: ['Encouragement donné', 'Aide proposée', 'Rangement fait', 'Merci envoyé'] }
  ],
  journeyAxes: [
    { id: 'oser', icon: '🎭', title: 'Oser', text: 'Essayer une consigne, une voix, un geste ou une idée sans chercher la perfection.', action: 'Utile avant une impro ou une prise de parole.' },
    { id: 'ecouter', icon: '👂', title: 'Écouter', text: 'Repérer les consignes, le rythme du groupe et les besoins des autres.', action: 'Utile en cours, en répétition et en spectacle.' },
    { id: 'creer', icon: '✨', title: 'Créer', text: 'Inventer un personnage, une intention, un mouvement, un son ou une ambiance.', action: 'Utile pour le livre-jeu, les défis et les projets.' },
    { id: 'repeter', icon: '🔁', title: 'Répéter', text: 'Revenir plusieurs fois sur une scène, une chanson, une choré ou un passage.', action: 'Utile pour progresser sans pression.' },
    { id: 'aider', icon: '🤝', title: 'Aider', text: 'Encourager, ranger, transmettre une info ou soutenir quelqu’un.', action: 'Utile pour l’esprit de troupe.' },
    { id: 'scene', icon: '🌟', title: 'Monter sur scène', text: 'Préparer son corps, sa tête, son matériel et son énergie de show.', action: 'Utile avant les représentations.' }
  ],
  modules: [
    { id: 'defis', title: 'Missions de troupe', href: 'quest-defis.html', status: 'Prioritaire', role: 'À faire quand tu veux être utile maintenant.', description: 'Rentrée, spectacle, répétition, entraide et préparation concrète.' },
    { id: 'roulette', title: 'Roulette scénique', href: 'quest-roulette.html', status: 'S’entraîner', role: 'À lancer quand tu veux une consigne courte.', description: 'Générateur d’exercices pour impro, chant, danse, musique et comédie musicale.' },
    { id: 'trophees', title: 'Mes progrès', href: 'quest-trophees.html', status: 'Se souvenir', role: 'À consulter pour voir les efforts qui comptent.', description: 'Badges et titres liés à l’effort, la régularité, l’entraide et la scène.' },
    { id: 'aventure', title: 'Les Mystères des Coulisses', href: 'quest-aventure.html', status: 'Explorer', role: 'À ouvrir pour vivre l’esprit FTS en histoire.', description: 'Aventure interactive sur l’esprit de troupe et les métiers de la scène.' },
    { id: 'avatar', title: 'Mon artiste', href: 'quest-avatar.html', status: 'Personnaliser', role: 'À faire une fois, puis à ajuster quand tu veux.', description: 'Carte artiste personnalisable pour rendre le parcours plus personnel.' },
    { id: 'codes', title: 'Codes secrets', href: 'quest-codes.html', status: 'Débloquer', role: 'À utiliser seulement si tu as reçu un code.', description: 'Codes donnés par un prof ou l’association pour valoriser une action utile.' },
    { id: 'avent', title: 'Calendrier magique', href: 'quest-avent.html', status: 'Saisonnier', role: 'À utiliser pendant une période spéciale.', description: '24 surprises artistiques pour revenir avec une petite action utile.' },
    { id: 'hub', title: 'Mon parcours', href: 'quest.html', status: 'Accueil', role: 'Le point de départ pour choisir quoi faire.', description: 'Action du jour, progression et accès rapide aux espaces FTS Quest.' }
  ],
  codes: {
    'IMPRO-ETOILE': {
      id: 'impro-etoile', code: 'IMPRO-ETOILE', title: 'Étoile d’impro', xp: 50,
      reward: 'Titre : Maître de l’impro', type: 'Cours', rarity: 'Rare',
      description: 'Code donné par un prof après un exercice d’impro.', target: 'Théâtre / Impro', expires: 'Permanent', maxUse: '1 fois par membre'
    },
    'SHOWTIME': {
      id: 'showtime', code: 'SHOWTIME', title: 'Prêt pour le show', xp: 80,
      reward: 'Badge : Prêt pour le show', type: 'Spectacle', rarity: 'Épique',
      description: 'Code événementiel pour valoriser la préparation spectacle.', target: 'Tous les membres', expires: 'Permanent', maxUse: '1 fois par membre'
    },
    'FTS-QUEST': {
      id: 'fts-quest', code: 'FTS-QUEST', title: 'Fondateur FTS Quest', xp: 120,
      reward: 'Cadre : Légendaire or', type: 'Lancement', rarity: 'Légendaire',
      description: 'Code spécial de lancement FTS Quest.', target: 'Membres FTS', expires: 'Permanent', maxUse: '1 fois par membre'
    },
    'AVATAR-LAB': {
      id: 'avatar-lab', code: 'AVATAR-LAB', title: 'Créateur d’identité', xp: 65,
      reward: 'Badge : Avatar personnalisé', type: 'Avatar', rarity: 'Rare',
      description: 'Récompense la création de ta carte artiste.', target: 'Tous les membres', expires: 'Permanent', maxUse: '1 fois par membre'
    },
    'COULISSES': {
      id: 'coulisses', code: 'COULISSES', title: 'Gardien des coulisses', xp: 90,
      reward: 'Titre : Gardien des Coulisses', type: 'Aventure', rarity: 'Mythique',
      description: 'Valorise l’aventure et l’esprit de troupe en coulisses.', target: 'Tous les membres', expires: 'Permanent', maxUse: '1 fois par membre'
    }
  },
  challengePacks: [
    {
      id: 'rentree-fts',
      type: 'checklist',
      icon: '🚀',
      title: 'Bien démarrer la saison',
      subtitle: 'Installer les réflexes qui évitent les oublis dès le début.',
      audience: 'Élèves / parents',
      difficulty: 'Facile',
      rewardXp: 120,
      color: 'gold',
      steps: [
        { id: 'install-pwa', label: 'Installer la PWA sur mon téléphone', help: 'Objectif : accès rapide sans chercher le lien.' },
        { id: 'notifications', label: 'Activer les notifications importantes', help: 'Pour ne pas manquer rappels, annonces et spectacles.' },
        { id: 'planning', label: 'Consulter mon planning / mes cours', help: 'Vérifier son groupe, ses horaires et ses infos.' },
        { id: 'forum', label: 'Ouvrir mon forum de groupe', help: 'Savoir où retrouver les infos collectives.' },
        { id: 'ressources', label: 'Consulter au moins une ressource', help: 'Texte, musique, vidéo ou document utile.' },
        { id: 'profil', label: 'Vérifier mes infos de profil', help: 'Nom, catégorie, sous-catégorie et accès.' }
      ]
    },
    {
      id: 'spectacle-ready',
      type: 'checklist',
      icon: '🎭',
      title: 'Préparation spectacle',
      subtitle: 'La checklist anti-oubli avant répétition ou représentation.',
      audience: 'Élèves / parents',
      difficulty: 'Normal',
      rewardXp: 160,
      color: 'red',
      steps: [
        { id: 'horaire', label: 'J’ai vérifié l’horaire et le lieu', help: 'Évite les messages de dernière minute.' },
        { id: 'message-prof', label: 'J’ai lu le message du professeur', help: 'Consignes, tenue, arrivée, matériel.' },
        { id: 'costume', label: 'Costume / tenue prêt(e)', help: 'À adapter selon le spectacle.' },
        { id: 'sac', label: 'Sac préparé', help: 'Eau, chaussures, partitions, accessoires.' },
        { id: 'texte-musique', label: 'Texte, musique ou choré relu(e)', help: 'Dernière vérification avant le show.' },
        { id: 'billet', label: 'Billet / QR code retrouvé si besoin', help: 'Pour les événements avec billetterie.' }
      ]
    },
    {
      id: 'bingo-artiste',
      type: 'bingo',
      icon: '🏆',
      title: 'Bingo esprit de troupe',
      subtitle: 'Une grille d’actions positives pour renforcer le groupe.',
      audience: 'Tous les artistes',
      difficulty: 'Bienveillant',
      rewardXp: 200,
      color: 'violet',
      gridSize: 9,
      steps: [
        { id: 'read-resource', label: 'Ressource consultée', help: 'Texte, partition, vidéo ou audio.' },
        { id: 'encourage', label: 'Encouragement envoyé', help: 'Un message positif dans le groupe.' },
        { id: 'code-secret', label: 'Code secret trouvé', help: 'Code donné en cours ou événement.' },
        { id: 'repeat', label: 'J’ai répété 10 min', help: 'Même une petite répétition compte.' },
        { id: 'question', label: 'Question préparée', help: 'Une question utile pour le prochain cours.' },
        { id: 'warmup', label: 'Échauffement fait', help: 'Corps, voix ou instrument.' },
        { id: 'planning-check', label: 'Planning vérifié', help: 'Je sais où et quand venir.' },
        { id: 'help-friend', label: 'J’ai aidé quelqu’un', help: 'Esprit d’équipe FTS.' },
        { id: 'ready-show', label: 'Prêt pour le show', help: 'Mentalité spectacle.' }
      ]
    },
    {
      id: 'mini-defis-scene',
      type: 'cards',
      icon: '✨',
      title: 'Entraînement scène',
      subtitle: 'Petites actions artistiques à faire seul ou en groupe.',
      audience: 'Élèves / profs',
      difficulty: 'Variable',
      rewardXp: 90,
      color: 'blue',
      steps: [
        { id: 'emotion-3', label: 'Jouer une phrase avec 3 émotions', help: 'Colère, joie, peur, tristesse, surprise…' },
        { id: 'song-intention', label: 'Chanter avec une intention claire', help: 'À qui je parle ? Pourquoi ?' },
        { id: 'dance-freeze', label: 'Créer une pose finale', help: 'Une fin lisible, forte, scénique.' },
        { id: 'tempo-slow', label: 'Travailler lentement puis au tempo', help: 'Musique / chant / danse.' },
        { id: 'character', label: 'Inventer un personnage', help: 'Nom, objectif, secret, énergie.' },
        { id: 'backstage', label: 'Imaginer un objet de coulisses', help: 'À réutiliser plus tard dans le livre-jeu.' }
      ]
    }
  ]
,
  trophies: {
    levelScale: [
      { level: 1, act: 'Acte I', label: 'Je découvre', minXp: 0, maxXp: 149 },
      { level: 2, act: 'Acte II', label: 'Je m’entraîne', minXp: 150, maxXp: 399 },
      { level: 3, act: 'Acte III', label: 'Je progresse', minXp: 400, maxXp: 799 },
      { level: 4, act: 'Acte IV', label: 'Je prépare la scène', minXp: 800, maxXp: 1299 },
      { level: 5, act: 'Acte V', label: 'Je fais mon show', minXp: 1300, maxXp: 1999 },
      { level: 6, act: 'Acte VI', label: 'Artiste confirmé', minXp: 2000, maxXp: 2999 },
      { level: 7, act: 'Acte VII', label: 'Légende des coulisses', minXp: 3000, maxXp: 999999 }
    ],
    rewards: [
      { id: 'course-ready', type: 'badge', rarity: 'common', discipline: 'Préparation', icon: '🎒', title: 'Prêt pour le cours', condition: 'Préparer horaire, matériel et objectif avant un cours', xp: 60, unlocked: true },
      { id: 'regular-practice', type: 'badge', rarity: 'rare', discipline: 'Répétition', icon: '🔁', title: 'Répétition régulière', condition: 'Répéter plusieurs fois au lieu de tout faire au dernier moment', xp: 140, unlocked: false },
      { id: 'team-spirit', type: 'badge', rarity: 'common', discipline: 'Communauté', icon: '🤝', title: 'Main tendue', condition: 'Aider, encourager ou remercier quelqu’un de la troupe', xp: 120, unlocked: false },
      { id: 'showtime', type: 'badge', rarity: 'epic', discipline: 'Spectacle', icon: '🏆', title: 'Prêt pour le show', condition: 'Valider la préparation spectacle sans oublier tenue, horaire et consignes', xp: 180, unlocked: false },
      { id: 'feedback-seeker', type: 'badge', rarity: 'rare', discipline: 'Progression', icon: '💬', title: 'Retour demandé', condition: 'Demander ou appliquer un retour de prof', xp: 130, unlocked: false },
      { id: 'creative-spark', type: 'badge', rarity: 'rare', discipline: 'Création', icon: '✨', title: 'Étincelle créative', condition: 'Créer un personnage, un mouvement, une intention ou une idée de décor', xp: 120, unlocked: false },
      { id: 'calm-stage', type: 'badge', rarity: 'common', discipline: 'Scène', icon: '🌬️', title: 'Trac apprivoisé', condition: 'Faire un rituel de respiration ou de concentration avant scène', xp: 110, unlocked: false },
      { id: 'roulette-first', type: 'badge', rarity: 'common', discipline: 'Exercice', icon: '🎲', title: 'Consigne travaillée', condition: 'Utiliser un tirage comme vrai exercice', xp: 100, unlocked: false },
      { id: 'secret-code', type: 'badge', rarity: 'rare', discipline: 'Récompense prof', icon: '🔐', title: 'Décodeur FTS', condition: 'Entrer un code reçu après une action utile', xp: 80, unlocked: false },
      { id: 'backstage-detective', type: 'badge', rarity: 'rare', discipline: 'Aventure', icon: '🔎', title: 'Détective de scène', condition: 'Terminer “Les Mystères des Coulisses”', xp: 180, unlocked: false },
      { id: 'curtain-guardian', type: 'badge', rarity: 'legendary', discipline: 'Aventure', icon: '🎭', title: 'Gardien du rideau', condition: 'Obtenir la bonne fin du livre-jeu', xp: 360, unlocked: false },
      { id: 'advent-first-flake', type: 'badge', rarity: 'common', discipline: 'Calendrier', icon: '❄️', title: 'Premier rendez-vous', condition: 'Ouvrir la première case et choisir une petite action artistique', xp: 40, unlocked: false },
      { id: 'advent-enjoy-friend', type: 'badge', rarity: 'rare', discipline: 'Calendrier', icon: '🎁', title: 'Surprise partagée', condition: 'Découvrir une surprise du calendrier et la partager avec quelqu’un', xp: 80, unlocked: false },
      { id: 'advent-heart-troupe', type: 'badge', rarity: 'epic', discipline: 'Communauté', icon: '🤝', title: 'Cœur de troupe', condition: 'Réaliser une mission d’entraide du calendrier', xp: 120, unlocked: false },
      { id: 'advent-christmas-guardian', type: 'badge', rarity: 'legendary', discipline: 'Calendrier', icon: '🎄', title: 'Gardien du calendrier', condition: 'Ouvrir la case finale avec une vraie trace de progression', xp: 300, unlocked: false },
      { id: 'title-explorer', type: 'title', rarity: 'common', discipline: 'Titre', icon: '🏷️', title: 'Artiste en route', condition: 'Commencer le parcours FTS Quest', xp: 0, unlocked: true },
      { id: 'title-team', type: 'title', rarity: 'rare', discipline: 'Titre', icon: '🏷️', title: 'Esprit troupe', condition: 'Valoriser l’entraide et l’écoute', xp: 0, unlocked: false },
      { id: 'title-method', type: 'title', rarity: 'rare', discipline: 'Titre', icon: '🏷️', title: 'Je répète avec méthode', condition: 'Construire une vraie régularité', xp: 0, unlocked: false },
      { id: 'title-stage-ready', type: 'title', rarity: 'epic', discipline: 'Titre', icon: '🏷️', title: 'Prêt pour le plateau', condition: 'Préparer un spectacle avec sérieux', xp: 0, unlocked: false },
      { id: 'title-backstage-guardian', type: 'title', rarity: 'epic', discipline: 'Titre', icon: '🏷️', title: 'Gardien des Coulisses', condition: 'Réussir le livre-jeu interactif', xp: 0, unlocked: false },
      { id: 'title-advent-star', type: 'title', rarity: 'legendary', discipline: 'Titre', icon: '🏷️', title: 'Étoile de la troupe', condition: 'Terminer le Calendrier magique des Coulisses', xp: 0, unlocked: false }
    ]
  }
};
