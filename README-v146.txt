Patch v146 — badges profs + notifications forum auteur

Fichiers à déployer :
- profs.html
- forum.html
- sw.js
- assets/js/pages/forum.js

Corrections ciblées :
1. Réaffiche l’onglet “🏅 Récompenser” dans profs.html pour les profs et admins.
   - Attribution badge temporaire
   - Artiste de la semaine
   - Prolonger / retirer une récompense active
   - Utilise fts-gamification.js déjà présent dans le projet.

2. Forum : renforce l’absence de notification à l’auteur de son propre message.
   - Les destinataires excluaient déjà l’auteur côté app.
   - Le push envoyé au worker ne transporte plus group/subgroup dans le payload UID par UID, pour éviter qu’un worker ne fasse un fanout de groupe incluant l’auteur.
   - Ajout de excludeUid/excludeUids en sécurité.

Non modifié :
- rules Firebase
- publication ressources
- MP
- annonces
- événements
- badges XP automatiques
- worker Cloudflare
