'use strict';

window.FTSQuestAdventureData = {
  title: 'Les Mystères des Coulisses',
  startScene: 'scene_001',
  stats: [
    { id: 'audace', label: 'Audace', icon: '⚡' },
    { id: 'ecoute', label: 'Écoute', icon: '👂' },
    { id: 'creativite', label: 'Créativité', icon: '✨' },
    { id: 'equipe', label: 'Esprit d’équipe', icon: '🤝' },
    { id: 'concentration', label: 'Concentration', icon: '🎯' }
  ],
  items: {
    ticket_rouge: { label: 'Ticket rouge', icon: '🎟️', description: 'Un ancien ticket de spectacle avec un numéro au dos.' },
    cle_doree: { label: 'Clé dorée', icon: '🗝️', description: 'La clé qui ouvre la petite porte près de la régie.' },
    carnet_scene: { label: 'Carnet de scène', icon: '📓', description: 'Un carnet rempli de croquis, d’entrées et de notes de répétition.' },
    ruban_danse: { label: 'Ruban de danse', icon: '🎀', description: 'Un ruban trouvé dans la salle de danse. Il porte une trace de poussière dorée.' },
    mediator: { label: 'Médiator mystérieux', icon: '🎸', description: 'Un médiator gravé avec une étoile et les lettres FTS.' },
    lampe_regie: { label: 'Lampe de régie', icon: '🔦', description: 'Une petite lampe utile pour inspecter les coulisses.' },
    partition_finale: { label: 'Partition finale', icon: '🎼', description: 'Le morceau manquant du final du spectacle.' },
    masque_theatre: { label: 'Masque de théâtre', icon: '🎭', description: 'Un masque ancien qui semble connaître le chemin des coulisses.' }
  },
  chapters: {
    chapitre_1: 'Chapitre 1 — Le soir où les lumières ont clignoté',
    chapitre_2: 'Chapitre 2 — La clé des coulisses',
    chapitre_3: 'Chapitre 3 — Le passage sous la scène',
    final: 'Final — Le dernier rappel'
  },
  scenes: {
    scene_001: {
      chapter: 'chapitre_1',
      title: 'Le hall après la répétition',
      mood: 'La nuit tombe sur Fais Ton Show. Les dernières voix s’éloignent dans le couloir.',
      icon: '🌙',
      text: [
        'Tu es resté quelques minutes de plus après la répétition. Dans le hall, les affiches des anciens spectacles tremblent doucement, comme si quelqu’un venait de passer derrière le mur.',
        'Soudain, trois lumières clignotent : une vers la salle de théâtre, une vers la salle de danse, une vers la salle de musique. Enjoy, le chien, gratte le sol et lâche un petit aboiement inquiet.',
        'Sur le tableau d’accueil, une phrase apparaît à la craie : “Le rideau ne s’ouvrira que si la troupe retrouve ce qui rassemble les artistes.”'
      ],
      choices: [
        { label: 'Suivre Enjoy vers la salle de théâtre', target: 'scene_002', effects: { audace: 1, ecoute: 1 } },
        { label: 'Observer les affiches du hall', target: 'scene_003', effects: { concentration: 1 }, addItems: ['ticket_rouge'] },
        { label: 'Appeler calmement un adulte', target: 'scene_004', effects: { equipe: 1, concentration: 1 } }
      ]
    },
    scene_002: {
      chapter: 'chapitre_1',
      title: 'La salle de théâtre silencieuse',
      mood: 'Le plateau est vide, mais une chaise est placée exactement sous un projecteur.',
      icon: '🎭',
      text: [
        'Christophe est là, une lampe à la main. Il ne panique pas : il observe. “Un spectacle, c’est comme une enquête, dit-il. Le public voit la scène, mais la vérité se cache souvent dans les coulisses.”',
        'Sur la chaise, tu trouves un masque ancien. Quand tu le soulèves, une voix semble murmurer : “Cherche la clé, mais n’oublie pas d’écouter les autres.”'
      ],
      choices: [
        { label: 'Prendre le masque et inspecter le plateau', target: 'scene_005', effects: { audace: 1, concentration: 1 }, addItems: ['masque_theatre'] },
        { label: 'Demander à Christophe ce qu’il a vu', target: 'scene_004', effects: { ecoute: 1, equipe: 1 } },
        { label: 'Retourner vers le hall et les affiches', target: 'scene_003', effects: { concentration: 1 } }
      ]
    },
    scene_003: {
      chapter: 'chapitre_1',
      title: 'La salle des affiches',
      mood: 'Les anciens spectacles forment une galerie de souvenirs, de dates et de petites victoires.',
      icon: '🖼️',
      text: [
        'Derrière une affiche un peu décollée, tu découvres un ticket rouge. Le numéro imprimé dessus est à moitié effacé : 7 — 3 — ?.',
        'Une photo attire ton attention : Virginie au piano, Lilou en répétition danse, Sébastien avec une basse, Anne-Sophie au milieu des décors. Au dos de la photo, quelqu’un a écrit : “Aucun artiste ne réussit seul.”'
      ],
      choices: [
        { label: 'Garder le ticket rouge et rejoindre Virginie', target: 'scene_006', effects: { ecoute: 1 }, addItems: ['ticket_rouge'] },
        { label: 'Chercher le numéro manquant avec méthode', target: 'scene_007', effects: { concentration: 2 }, requiresAny: ['ticket_rouge'] },
        { label: 'Suivre les traces de paillettes vers la danse', target: 'scene_008', effects: { creativite: 1 } }
      ]
    },
    scene_004: {
      chapter: 'chapitre_1',
      title: 'Le conseil improvisé',
      mood: 'Une petite troupe se forme dans le couloir, comme avant une entrée en scène.',
      icon: '🤝',
      text: [
        'Virginie arrive avec un classeur de partitions. Christophe vérifie la régie. Lilou remarque des marques au sol. Enjoy tourne autour de toi, fier d’avoir rassemblé tout le monde.',
        'Brigitte, l’ancienne qui râle tout le temps, soupire : “De mon temps, on rangeait les clés au bon endroit.” Pourtant, elle désigne une petite armoire que personne n’avait remarquée.'
      ],
      choices: [
        { label: 'Ouvrir l’armoire indiquée par Brigitte', target: 'scene_007', effects: { ecoute: 1, equipe: 1 } },
        { label: 'Demander à Lilou de suivre les marques au sol', target: 'scene_008', effects: { equipe: 1, creativite: 1 } },
        { label: 'Accompagner Christophe à la régie', target: 'scene_009', effects: { concentration: 1 } }
      ]
    },
    scene_005: {
      chapter: 'chapitre_2',
      title: 'Le plateau et le souffle du rideau',
      mood: 'Le rideau bouge sans courant d’air. Le théâtre semble attendre une décision.',
      icon: '🎬',
      text: [
        'En inspectant le plateau avec le masque, tu vois une petite fente dans le plancher. Elle contient un papier plié : “Quand le piano hésite, la danse répond. Quand la guitare rit, la troupe avance.”',
        'Au loin, tu entends quelques notes maladroites. On dirait Jean Michel à Moitié, le pianiste qui ne termine jamais ses phrases musicales.'
      ],
      choices: [
        { label: 'Suivre les notes vers le vieux piano', target: 'scene_006', effects: { ecoute: 1, creativite: 1 } },
        { label: 'Soulever le plancher avec prudence', target: 'scene_010', effects: { audace: 1 }, requiresAny: ['cle_doree','lampe_regie'] },
        { label: 'Prévenir la troupe avant de continuer', target: 'scene_004', effects: { equipe: 1 } }
      ]
    },
    scene_006: {
      chapter: 'chapitre_2',
      title: 'Le vieux piano de Jean Michel à Moitié',
      mood: 'Dans un coin, le piano joue presque juste. Presque.',
      icon: '🎹',
      text: [
        'Jean Michel à Moitié tape trois notes puis s’arrête. “Je connais le début, jamais la fin”, dit-il. Virginie sourit : “C’est exactement le problème du spectacle : il manque la partition finale.”',
        'Laetitia fredonne une mélodie sans paroles pour t’aider à retrouver le rythme. Sébastien écoute les vibrations du mur et découvre un médiator coincé entre deux lames de bois.'
      ],
      choices: [
        { label: 'Prendre le médiator et suivre la vibration', target: 'scene_009', effects: { ecoute: 1, concentration: 1 }, addItems: ['mediator'] },
        { label: 'Aider Jean Michel à finir la phrase musicale', target: 'scene_011', effects: { creativite: 2, equipe: 1 } },
        { label: 'Chercher la clé dans le banc du piano', target: 'scene_007', effects: { concentration: 1 } }
      ]
    },
    scene_007: {
      chapter: 'chapitre_2',
      title: 'L’armoire des accessoires oubliés',
      mood: 'Ça sent le bois, la poussière et les spectacles rangés trop vite.',
      icon: '🗝️',
      text: [
        'Dans l’armoire, il y a des boutons, des plumes, une vieille baguette de magie, un micro ancien et une boîte fermée par un code à trois chiffres.',
        'Si tu as observé les affiches, le ticket rouge t’aide à compléter le code : 7 — 3 — 0, comme les trois coups frappés avant l’entrée en scène.'
      ],
      choices: [
        { label: 'Entrer le code du ticket rouge', target: 'scene_009', effects: { concentration: 1 }, requiresAll: ['ticket_rouge'], addItems: ['cle_doree'] },
        { label: 'Fouiller sans forcer la serrure', target: 'scene_008', effects: { ecoute: 1 }, addItems: ['ruban_danse'] },
        { label: 'Utiliser le masque pour chercher un indice', target: 'scene_005', effects: { creativite: 1 }, requiresAll: ['masque_theatre'] }
      ]
    },
    scene_008: {
      chapter: 'chapitre_2',
      title: 'La salle de danse et les traces dorées',
      mood: 'Le miroir reflète plus que la pièce : il reflète les hésitations.',
      icon: '💃',
      text: [
        'Lilou et Elina observent les traces de pas. Elles ne vont pas au hasard : elles dessinent une chorégraphie simple, comme un chemin codé sur le sol.',
        'Matheo, le jeune et plus ancien de FTS, reconnaît une entrée de scène d’un vieux spectacle. “Ça mène vers la régie, mais il faut le faire ensemble.”'
      ],
      choices: [
        { label: 'Suivre la chorégraphie avec Lilou et Elina', target: 'scene_009', effects: { equipe: 1, creativite: 1 }, addItems: ['ruban_danse'] },
        { label: 'Noter les pas dans le carnet de scène', target: 'scene_011', effects: { concentration: 1 }, addItems: ['carnet_scene'] },
        { label: 'Courir seul vers la régie', target: 'scene_012_risk', effects: { audace: 2 } }
      ]
    },
    scene_009: {
      chapter: 'chapitre_3',
      title: 'La régie lumière',
      mood: 'Des boutons brillent comme un ciel étoilé. Un seul mauvais geste peut plonger la salle dans le noir.',
      icon: '💡',
      text: [
        'Christophe te confie une petite lampe de régie. “La technique, ce n’est pas pousser des boutons au hasard. C’est écouter la scène et aider les artistes à être vus.”',
        'Sur l’écran de contrôle, trois symboles clignotent : un masque, un ruban, un médiator. La régie attend une preuve que théâtre, danse et musique peuvent se répondre.'
      ],
      choices: [
        { label: 'Assembler masque, ruban et médiator', target: 'scene_010', effects: { equipe: 2, creativite: 1 }, requiresAll: ['masque_theatre','ruban_danse','mediator'], addItems: ['lampe_regie','carnet_scene'] },
        { label: 'Utiliser la clé dorée sur la petite porte', target: 'scene_010', effects: { audace: 1, concentration: 1 }, requiresAll: ['cle_doree'], addItems: ['lampe_regie'] },
        { label: 'Demander un avis à toute la troupe', target: 'scene_011', effects: { equipe: 1, ecoute: 1 }, addItems: ['lampe_regie'] }
      ]
    },
    scene_010: {
      chapter: 'chapitre_3',
      title: 'Le passage sous la scène',
      mood: 'Sous les planches, les voix des anciens spectacles semblent encore vibrer.',
      icon: '🕯️',
      text: [
        'La trappe s’ouvre. Enjoy passe devant, très sérieux. Tu descends sous la scène avec la lampe de régie. Des caisses portent les noms des anciens spectacles, des ateliers décors, des costumes et des musiques.',
        'Au centre, un pupitre attend. Il manque une dernière page. Anne-Sophie reconnaît le papier : “C’est caché dans un décor, pas dans un tiroir.”'
      ],
      choices: [
        { label: 'Inspecter les décors avec Anne-Sophie', target: 'scene_011', effects: { concentration: 1, equipe: 1 }, addItems: ['partition_finale'] },
        { label: 'Suivre Enjoy dans le couloir interdit', target: 'scene_012_risk', effects: { audace: 1 } },
        { label: 'Lire le carnet de scène avant d’agir', target: 'scene_013_good', effects: { ecoute: 1, concentration: 1 }, requiresAll: ['carnet_scene'] }
      ]
    },
    scene_011: {
      chapter: 'chapitre_3',
      title: 'Le cercle de la troupe',
      mood: 'Personne ne tient tout le spectacle. Chacun tient un morceau.',
      icon: '🌟',
      text: [
        'Virginie replace les notes, Lilou ajuste le rythme, Sébastien donne le tempo, Laetitia trouve l’intention, Anne-Sophie révèle une cache dans le décor. Même Brigitte arrête de râler deux secondes : “Bon… là, c’est propre.”',
        'Tu comprends que l’objet perdu n’était pas seulement une partition. C’était le lien entre tous les métiers de la scène.'
      ],
      choices: [
        { label: 'Apporter la partition finale sur scène', target: 'scene_013_good', effects: { equipe: 2, ecoute: 1 }, addItems: ['partition_finale'] },
        { label: 'Tenter d’ouvrir le rideau sans vérifier', target: 'scene_014_soft', effects: { audace: 1 } },
        { label: 'Relire tous les indices une dernière fois', target: 'scene_013_good', effects: { concentration: 2 }, requiresAny: ['carnet_scene','partition_finale'] }
      ]
    },
    scene_012_risk: {
      chapter: 'chapitre_3',
      title: 'Le couloir interdit',
      mood: 'Le courage ouvre des portes. La précipitation, elle, en ferme parfois.',
      icon: '🚪',
      text: [
        'Tu avances vite, trop vite. Le couloir mène bien sous la scène, mais tu arrives de l’autre côté du rideau sans avoir rassemblé tous les indices.',
        'Enjoy gémit. Tu peux encore sauver la soirée, mais il faudra accepter de demander de l’aide au lieu de jouer au héros solitaire.'
      ],
      choices: [
        { label: 'Reconnaître que tu as besoin de la troupe', target: 'scene_011', effects: { equipe: 2, ecoute: 1 } },
        { label: 'Forcer le mécanisme du rideau', target: 'scene_014_soft', effects: { audace: 1 } },
        { label: 'Retourner à la régie chercher la lumière', target: 'scene_009', effects: { concentration: 1 } }
      ]
    },
    scene_013_good: {
      chapter: 'final',
      title: 'La bonne fin — Le rideau s’ouvre',
      mood: 'Les lumières chauffent. Le silence devient promesse.',
      icon: '🏆',
      ending: 'good',
      rewards: ['backstage-detective','curtain-guardian','title-backstage-guardian'],
      text: [
        'Tu poses la partition finale sur le pupitre. Virginie donne le départ, Sébastien installe le tempo, Lilou transforme les traces au sol en chorégraphie, Christophe lance la lumière, Anne-Sophie ajuste le décor.',
        'Le rideau s’ouvre sans bruit. Sur le plateau, tu ne vois pas un héros seul : tu vois une troupe. Enjoy aboie une fois, comme un top départ. Le spectacle peut commencer.',
        'Tu as résolu le mystère des coulisses en comprenant la vraie règle de Fais Ton Show : chacun apporte sa scène, mais c’est ensemble qu’on fait le show.'
      ],
      choices: [
        { label: 'Rejouer l’aventure autrement', target: 'scene_001', resetRun: true },
        { label: 'Voir la Salle des trophées', href: 'quest-trophees.html' },
        { label: 'Retour au hub FTS Quest', href: 'quest.html' }
      ]
    },
    scene_014_soft: {
      chapter: 'final',
      title: 'Fin alternative — Le rideau entrouvert',
      mood: 'La soirée est sauvée, mais quelque chose reste à découvrir.',
      icon: '🎟️',
      ending: 'soft',
      rewards: ['backstage-detective'],
      text: [
        'Le rideau finit par s’ouvrir, mais pas complètement. La troupe improvise avec talent, Brigitte râle dans un coin, et le public croit presque que tout était prévu.',
        'Tu as trouvé une partie du mystère, mais pas toute la vérité. Le carnet de scène indique encore un passage oublié sous le plateau.',
        'Parfois, une fin imparfaite est une invitation : revenir, mieux écouter, mieux observer, et choisir l’équipe plutôt que la vitesse.'
      ],
      choices: [
        { label: 'Reprendre depuis la régie', target: 'scene_009', effects: { concentration: 1 } },
        { label: 'Rejouer depuis le début', target: 'scene_001', resetRun: true },
        { label: 'Retour au hub FTS Quest', href: 'quest.html' }
      ]
    }
  }
};
