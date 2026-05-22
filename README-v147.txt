PATCH V147 — Notification directe au membre récompensé

Fichiers à déployer :
- assets/js/fts-gamification.js
- profs.html
- forum.html
- sw.js

Correction :
- Quand un prof/admin attribue un badge temporaire ou définit l'Artiste de la semaine, le message public continue d'être publié dans le forum général.
- En plus, une notification directe est envoyée au compte récompensé via UID, sans dépendre du fanout forum général.
- Une trace est ajoutée dans fts_user_notifications/{uid} et fts_debug_notifications, sans bloquer l'attribution si une trace échoue.

Non modifié :
- rules Firebase
- forum.js
- messages privés
- annonces
- événements
- ressources
- XP
