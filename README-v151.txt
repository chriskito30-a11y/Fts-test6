Version v151 — correction Admin contenu > Catégories officielles

- Corrige la liste vide des catégories officielles dans contenus-admin.html.
- Ajoute les helpers priorityLabel / normalizePriorityValue manquants qui faisaient planter renderCList().
- Quand on ouvre l’onglet Catégories, la première catégorie existante est chargée automatiquement dans le formulaire.
- Les catégories existantes peuvent maintenant être sélectionnées, modifiées et enregistrées : nom, icône, priorité, actif/masqué, sous-catégories.
- Ajoute un message visible si la lecture Firebase des catégories échoue.
- Incrémente la version JS contenus-admin et le cache service worker pour éviter l’ancien fichier en PWA.
