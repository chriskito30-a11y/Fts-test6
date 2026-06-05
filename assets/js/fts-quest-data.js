'use strict';

window.FTSQuestData = {
  version: '0.2.0-avatar-lab',
  storageKeys: {
    player: 'ftsQuest.player.v2',
    avatar: 'ftsQuest.avatar.v2',
    log: 'ftsQuest.log.v2'
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
    { id: 'codes', title: 'Codes secrets', href: '#', status: 'À venir', description: 'Récompenses par codes prof/admin et historique.' },
    { id: 'defis', title: 'Défis & bingo', href: '#', status: 'À venir', description: 'Défis rentrée, checklists, bingo spectacle.' },
    { id: 'roulette', title: 'Roulette impro', href: '#', status: 'À venir', description: 'Mode membre + mode prof pour générer personnages et situations.' },
    { id: 'aventure', title: 'Livre-jeu', href: '#', status: 'Gros module', description: 'Aventure illustrée, roleplay, choix, inventaire et fins multiples.' }
  ],
  codes: {
    'IMPRO-ETOILE': { xp: 50, reward: 'Titre prototype : Maître de l’impro' },
    'SHOWTIME': { xp: 80, reward: 'Badge prototype : Prêt pour le show' },
    'FTS-QUEST': { xp: 120, reward: 'Cadre prototype : Légendaire or' }
  }
};
