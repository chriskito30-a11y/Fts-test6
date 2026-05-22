Patch v148 — Récompenses actives prof/admin

Correction ciblée : après attribution d'un badge par un prof/admin, la liste "Récompenses actives" lit désormais le badge officiel depuis fts_forum/users/{uid}/specialBadge.

Pourquoi : l'écriture miroir vers fts_users/{uid}/specialBadge est non bloquante et peut être refusée par les rules pour un prof. L'attribution, le forum et la notification fonctionnaient, mais la liste active lisait une donnée qui pouvait ne pas être mise à jour.

Fichiers à déployer :
- profs.html
- sw.js

Aucun changement sur : rules Firebase, notifications, forum.js, messages, annonces, événements, ressources.
