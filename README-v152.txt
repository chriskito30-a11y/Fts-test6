Patch v152 — Saison alimentée par Catégories officielles

Objectif :
- saison.html lit maintenant fts_content/categories comme source principale.
- Les cartes de saison s’ajoutent/s’enlèvent automatiquement selon les catégories actives.
- Les anciennes données fts_saison/config restent utilisées comme fallback/enrichissement pour ne pas casser l’existant.
- Admin contenu > Catégories officielles permet d’ajouter quelques champs Saison par catégorie et des détails pour les sous-catégories.

Fichiers principaux :
- saison.html
- assets/js/pages/saison.js
- assets/css/pages/saison.css
- contenus-admin.html
- assets/js/pages/contenus-admin.js
- sw.js
