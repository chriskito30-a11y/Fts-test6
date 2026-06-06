'use strict';

window.FTSQuestData = {
  version: '0.6.0-aventure-coulisses',
  storageKeys: {
    player: 'ftsQuest.player.v2',
    avatar: 'ftsQuest.avatar.v2',
    log: 'ftsQuest.log.v3',
    codesHistory: 'ftsQuest.codes.history.v1',
    playerProgress: 'ftsQuest.player.progress.v1',
    challengesState: 'ftsQuest.challenges.state.v1',
    trophiesState: 'ftsQuest.trophies.state.v1',
    adventureState: 'ftsQuest.aventure.state.v1'
  },
  player: {
    name: 'Artiste FTS',
    discipline: 'Théâtre · Chant · Danse · Musique',
    xp: 420,
    nextXp: 700,
    act: 'Acte II',
    levelLabel: 'Je m’entraîne',
    activeTitle: 'Explorateur de scène',
    badges: 8,
    titles: 4,
    challenges: 12
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
    { id: 'backstage_mage', label: 'Mage des coulisses', family: 'Coulisses', rarity: 'Mythique', description: 'Ambiance mystérieuse pour les futurs modules livre-jeu et aventure.' }
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
    { id: 'new_talent', label: 'Nouveau Talent', unlocked: true, description: 'Titre de départ pour entrer dans FTS Quest.' },
    { id: 'scene_explorer', label: 'Explorateur de scène', unlocked: true, description: 'Pour les artistes qui découvrent le hub et ses modules.' },
    { id: 'impro_master', label: 'Maître de l’impro', unlocked: false, description: 'Débloqué avec la future roulette impro.' },
    { id: 'show_star', label: 'Star du Show', unlocked: false, description: 'Titre prestige lié aux spectacles et checklists.' },
    { id: 'backstage_guardian', label: 'Gardien des Coulisses', unlocked: false, description: 'Titre spécial du futur livre-jeu interactif.' },
    { id: 'team_spirit', label: 'Esprit d’Équipe', unlocked: true, description: 'Récompense les comportements positifs dans la communauté.' }
  ],
  missions: [
    { id: 'rentree', title: 'Défi rentrée', description: 'Transformer l’onboarding en mission utile.', percent: 70, steps: ['Installer la PWA', 'Activer les notifications', 'Consulter son planning', 'Lire les infos importantes'] },
    { id: 'spectacle', title: 'Préparation spectacle', description: 'Checklist ludique pour éviter les oublis.', percent: 45, steps: ['Costume prêt', 'Horaire vérifié', 'Message prof lu', 'Sac préparé'] },
    { id: 'bingo', title: 'Bingo artiste', description: 'Grille d’actions positives : répéter, encourager, consulter.', percent: 30, steps: ['Texte relu', 'Musique écoutée', 'Encouragement envoyé', 'Code secret trouvé'] }
  ],
  modules: [
    { id: 'hub', title: 'Mon aventure', href: 'quest.html', status: 'Brique 1', description: 'Hub autonome, carte profil, XP, modules et design commun.' },
    { id: 'avatar', title: 'Avatar Lab', href: 'quest-avatar.html', status: 'Brique 2', description: 'Créateur d’avatar premium : couleurs, yeux, accessoires, cadre.' },
    { id: 'codes', title: 'Codes secrets', href: 'quest-codes.html', status: 'Brique 3', description: 'Récompenses par codes prof/admin, historique, limites et aperçu admin.' },
    { id: 'defis', title: 'Défis & bingo', href: 'quest-defis.html', status: 'Brique 4', description: 'Défis rentrée, checklists, bingo spectacle et préparation utile.' },
    { id: 'roulette', title: 'Roulette impro', href: 'quest-roulette.html', status: 'Brique 5', description: 'Bandit manchot pédagogique : impro, chant, danse, musique et comédie musicale.' },
    { id: 'trophees', title: 'Salle des trophées', href: 'quest-trophees.html', status: 'Brique 6', description: 'Badges, titres, niveaux, raretés et progression globale FTS Quest.' },
    { id: 'aventure', title: 'Les Mystères des Coulisses', href: 'quest-aventure.html', status: 'Brique 7', description: 'Livre-jeu interactif : scènes, choix, inventaire, stats et fins multiples.' }
  ],
  codes: {
    'IMPRO-ETOILE': {
      id: 'impro-etoile', code: 'IMPRO-ETOILE', title: 'Étoile d’impro', xp: 50,
      reward: 'Titre prototype : Maître de l’impro', type: 'Cours', rarity: 'Rare',
      description: 'Code donné par un prof après un exercice d’impro.', target: 'Théâtre / Impro', expires: 'Permanent', maxUse: '1 fois par membre'
    },
    'SHOWTIME': {
      id: 'showtime', code: 'SHOWTIME', title: 'Prêt pour le show', xp: 80,
      reward: 'Badge prototype : Prêt pour le show', type: 'Spectacle', rarity: 'Épique',
      description: 'Code événementiel pour valoriser la préparation spectacle.', target: 'Tous les membres', expires: 'Permanent', maxUse: '1 fois par membre'
    },
    'FTS-QUEST': {
      id: 'fts-quest', code: 'FTS-QUEST', title: 'Fondateur FTS Quest', xp: 120,
      reward: 'Cadre prototype : Légendaire or', type: 'Prototype', rarity: 'Légendaire',
      description: 'Code de lancement pour tester le module sans Firebase.', target: 'Bêta testeurs', expires: 'Permanent', maxUse: '1 fois par membre'
    },
    'AVATAR-LAB': {
      id: 'avatar-lab', code: 'AVATAR-LAB', title: 'Créateur d’identité', xp: 65,
      reward: 'Badge prototype : Avatar personnalisé', type: 'Avatar', rarity: 'Rare',
      description: 'Récompense les tests du créateur d’avatar.', target: 'Tous les membres', expires: 'Permanent', maxUse: '1 fois par membre'
    },
    'COULISSES': {
      id: 'coulisses', code: 'COULISSES', title: 'Gardien des coulisses', xp: 90,
      reward: 'Titre prototype : Gardien des Coulisses', type: 'Aventure', rarity: 'Mythique',
      description: 'Prépare le futur livre-jeu illustré et roleplay.', target: 'Tous les membres', expires: 'Permanent', maxUse: '1 fois par membre'
    }
  },
  challengePacks: [
    {
      id: 'rentree-fts',
      type: 'checklist',
      icon: '🚀',
      title: 'Défi rentrée FTS',
      subtitle: 'Installer les bons réflexes app dès le début de saison.',
      audience: 'Tous les membres / parents',
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
      title: 'Bingo artiste',
      subtitle: 'Une grille ludique pour encourager les bons comportements.',
      audience: 'Tous les artistes',
      difficulty: 'Fun',
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
      title: 'Mini-défis scène',
      subtitle: 'Petites missions artistiques à valider quand on veut.',
      audience: 'Élèves motivés',
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
      { id: 'first-step', type: 'badge', rarity: 'common', discipline: 'Général', icon: '🌟', title: 'Premier pas sur scène', condition: 'Découvrir FTS Quest', xp: 25, unlocked: true },
      { id: 'avatar-maker', type: 'badge', rarity: 'common', discipline: 'Avatar', icon: '🎭', title: 'Créateur d’avatar', condition: 'Ouvrir Avatar Lab', xp: 40, unlocked: true },
      { id: 'secret-code', type: 'badge', rarity: 'rare', discipline: 'Codes', icon: '🔐', title: 'Décodeur FTS', condition: 'Entrer un code secret valide', xp: 80, unlocked: true },
      { id: 'challenge-start', type: 'badge', rarity: 'common', discipline: 'Défis', icon: '✅', title: 'Mission acceptée', condition: 'Cocher au moins un défi', xp: 50, unlocked: true },
      { id: 'bingo-line', type: 'badge', rarity: 'rare', discipline: 'Bingo', icon: '🎟️', title: 'Bingo de scène', condition: 'Compléter une ligne de bingo', xp: 120, unlocked: false },
      { id: 'roulette-first', type: 'badge', rarity: 'common', discipline: 'Impro', icon: '🎰', title: 'Premier tirage', condition: 'Lancer la roulette impro', xp: 60, unlocked: true },
      { id: 'impro-card', type: 'badge', rarity: 'rare', discipline: 'Théâtre', icon: '🎲', title: 'Carton d’impro', condition: 'Sauvegarder un tirage théâtre complet', xp: 150, unlocked: false },
      { id: 'singer-star', type: 'badge', rarity: 'rare', discipline: 'Chant', icon: '🎤', title: 'Interprète étoile', condition: 'Travailler une chanson tirée au sort', xp: 140, unlocked: false },
      { id: 'dance-pulse', type: 'badge', rarity: 'rare', discipline: 'Danse', icon: '💃', title: 'Pulse scénique', condition: 'Créer une phrase chorégraphique', xp: 140, unlocked: false },
      { id: 'band-ready', type: 'badge', rarity: 'rare', discipline: 'Musique', icon: '🎸', title: 'Esprit de groupe', condition: 'Faire un défi musique avec écoute des autres', xp: 140, unlocked: false },
      { id: 'musical-bridge', type: 'badge', rarity: 'epic', discipline: 'Comédie musicale', icon: '🎬', title: 'Triple menace', condition: 'Relier jeu, chant et mouvement', xp: 250, unlocked: false },
      { id: 'team-spirit', type: 'badge', rarity: 'common', discipline: 'Communauté', icon: '🤝', title: 'Esprit troupe', condition: 'Aider un autre élève', xp: 70, unlocked: false },
      { id: 'backstage-key', type: 'badge', rarity: 'epic', discipline: 'Coulisses', icon: '🗝️', title: 'Clé des coulisses', condition: 'Trouver la clé dorée dans le livre-jeu', xp: 260, unlocked: false },
      { id: 'backstage-detective', type: 'badge', rarity: 'rare', discipline: 'Aventure', icon: '🔎', title: 'Détective de scène', condition: 'Terminer “Les Mystères des Coulisses”', xp: 180, unlocked: false },
      { id: 'curtain-guardian', type: 'badge', rarity: 'legendary', discipline: 'Aventure', icon: '🎭', title: 'Gardien du rideau', condition: 'Obtenir la bonne fin du livre-jeu', xp: 360, unlocked: false },
      { id: 'showtime', type: 'badge', rarity: 'legendary', discipline: 'Spectacle', icon: '🏆', title: 'Fais Ton Show', condition: 'Valider plusieurs modules FTS Quest', xp: 500, unlocked: false },
      { id: 'mythic-artist', type: 'badge', rarity: 'mythic', discipline: 'Légende', icon: '👑', title: 'Légende FTS', condition: 'Récompense ultime prototype', xp: 1000, unlocked: false },
      { id: 'title-explorer', type: 'title', rarity: 'common', discipline: 'Titre', icon: '🏷️', title: 'Explorateur de scène', condition: 'Titre de départ', xp: 0, unlocked: true },
      { id: 'title-decodeur', type: 'title', rarity: 'rare', discipline: 'Titre', icon: '🏷️', title: 'Décodeur des coulisses', condition: 'Débloqué via codes secrets', xp: 0, unlocked: true },
      { id: 'title-improviser', type: 'title', rarity: 'rare', discipline: 'Titre', icon: '🏷️', title: 'Improvisateur agile', condition: 'Utiliser la roulette théâtre', xp: 0, unlocked: false },
      { id: 'title-showrunner', type: 'title', rarity: 'epic', discipline: 'Titre', icon: '🏷️', title: 'Showrunner FTS', condition: 'Compléter plusieurs missions', xp: 0, unlocked: false },
      { id: 'title-legende', type: 'title', rarity: 'legendary', discipline: 'Titre', icon: '🏷️', title: 'Légende des planches', condition: 'Atteindre l’acte V', xp: 0, unlocked: false },
      { id: 'title-backstage-guardian', type: 'title', rarity: 'epic', discipline: 'Titre', icon: '🏷️', title: 'Gardien des Coulisses', condition: 'Réussir le livre-jeu interactif', xp: 0, unlocked: false }
    ]
  }
};
