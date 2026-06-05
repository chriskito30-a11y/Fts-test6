'use strict';
window.FTSQuestData = {
  player: {
    name: 'Chris',
    xp: 320,
    nextXp: 500,
    act: 'Acte II',
    levelLabel: 'Je m’entraîne',
    activeTitle: 'Explorateur de scène',
    activeAvatar: 'theatre_legend',
    stats: [
      { icon: '⚡', label: 'XP', value: '320' },
      { icon: '🏆', label: 'Titres', value: '4' },
      { icon: '◆', label: 'Badges', value: '8' },
      { icon: '✓', label: 'Défis', value: '12' }
    ]
  },
  avatars: [
    { id:'theatre_legend', name:'Le Masque Rouge', family:'Théâtre', rarity:'Légendaire', className:'avatar-theatre', unlocked:true, description:'Un avatar de scène, intense et mystérieux, pensé pour les comédiens.' },
    { id:'music_celeste', name:'Tempo Céleste', family:'Musique', rarity:'Rare', className:'avatar-music', unlocked:true, description:'Un artiste lumineux pour les musiciens, chanteurs et gardiens du rythme.' },
    { id:'dance_neon', name:'Nova Danse', family:'Danse', rarity:'Épique', className:'avatar-dance', unlocked:false, description:'Une silhouette énergie néon pour les défis danse et expression corporelle.' },
    { id:'show_star', name:'Broadway FTS', family:'Comédie musicale', rarity:'Mythique', className:'avatar-cinema', unlocked:false, description:'Un avatar showtime pour les artistes complets : chant, danse, théâtre.' }
  ],
  titles: [
    { name:'Nouveau Talent', description:'Titre de départ pour chaque membre qui découvre FTS Quest.', unlocked:true },
    { name:'Explorateur de scène', description:'Débloqué après les premiers défis et la découverte du hub.', unlocked:true },
    { name:'Maître de l’impro', description:'Débloqué via la future roulette impro et les défis théâtre.', unlocked:false },
    { name:'Star du Show', description:'Titre prestige lié aux spectacles, checklists et grands événements.', unlocked:false },
    { name:'Gardien des Coulisses', description:'Titre spécial lié au futur livre-jeu interactif.', unlocked:false },
    { name:'Esprit d’Équipe', description:'Récompense les comportements utiles dans la communauté.', unlocked:true }
  ],
  missions: [
    { title:'Défi rentrée', description:'Transformer l’onboarding en mission simple et utile.', percent:70, steps:['Installer la PWA','Activer les notifications','Consulter son planning','Lire les infos importantes'] },
    { title:'Préparation spectacle', description:'Checklist ludique pour éviter les oublis avant un événement.', percent:45, steps:['Costume prêt','Horaire vérifié','Message prof lu','Sac préparé'] },
    { title:'Bingo artiste', description:'Grille d’actions positives : répéter, encourager, consulter, participer.', percent:30, steps:['Texte relu','Musique écoutée','Encouragement envoyé','Code secret trouvé'] }
  ],
  modules: [
    { title:'quest.html', status:'Brique 1', description:'Hub FTS Quest autonome, carte profil, modules et design commun.' },
    { title:'quest-avatars.html', status:'Brique 2', description:'Choix avatar premium, rareté, déblocage et carte artiste.' },
    { title:'quest-codes.html', status:'Brique 3', description:'Codes secrets donnés par prof/admin, récompenses et historique.' },
    { title:'quest-defis.html', status:'Brique 4', description:'Défis rentrée, checklists, bingo spectacle et missions utiles.' },
    { title:'quest-roulette.html', status:'Brique 5', description:'Roulette impro en mode membre et en mode prof utilisable en cours.' },
    { title:'quest-aventure.html', status:'Gros module', description:'Livre-jeu illustré avec scènes, choix, rôleplay, inventaire et fins multiples.' }
  ],
  codes: {
    'IMPRO-ETOILE': { xp: 50, reward:'Titre provisoire : Maître de l’impro' },
    'SHOWTIME': { xp: 80, reward:'Badge prototype : Prêt pour le show' },
    'FTS-QUEST': { xp: 120, reward:'Avatar prototype : Le Masque Rouge' }
  }
};
