# Refactor complet — extraction CSS/JS par page

Ce pack est basé sur le ZIP Git fourni (`Fts-test6-main.zip`).

## Ce qui a été fait

- Suppression des blocs `<style>` inline dans toutes les pages HTML.
- Extraction des styles par page dans `assets/css/pages/*.css`.
- Suppression des attributs `style="..."` statiques dans les HTML.
- Suppression des attributs `onclick`, `oninput`, `onchange`, `onkeydown` statiques dans les HTML.
- Conservation des scripts par page dans `assets/js/pages/*.js`.
- Remplacement des handlers générés dynamiquement par des attributs `data-fts-*` délégués via `fts-utils.js`.
- Ajout d'une hydratation légère pour les couleurs dynamiques via `data-fts-bg`.
- Correction des chemins PWA cassés dans `sw.js` : `assets/img/assets/img/...` -> `assets/img/...`.
- Passage du cache service worker en `fts-v13-full-refactor`.
- Manifest rendu plus compatible GitHub Pages avec chemins relatifs `./`.

## Vérifications effectuées

- Aucun `<style>` inline dans les HTML.
- Aucun `<script>` inline dans les HTML.
- Aucun attribut `style="..."` statique dans les HTML.
- Aucun attribut événement inline statique dans les HTML.
- Aucun ID dupliqué détecté dans les HTML.
- Tous les chemins locaux `assets/...` référencés par les HTML existent.
- `node --check` OK sur tous les fichiers JS.
- `node --check` OK sur `sw.js`.

## Fichiers importants ajoutés/modifiés

- `assets/css/pages/admin.css`
- `assets/css/pages/auth.css`
- `assets/css/pages/calendrier-admin.css`
- `assets/css/pages/contenus-admin.css`
- `assets/css/pages/forum-admin.css`
- `assets/css/pages/forum.css`
- `assets/css/pages/index.css`
- `assets/css/pages/messages.css`
- `assets/css/pages/profs.css`
- `assets/css/pages/saison-admin.css`
- `assets/css/pages/saison.css`
- `assets/css/pages/membres.css`
- `assets/js/fts-utils.js`
- `sw.js`
- `manifest.json`
- toutes les pages HTML racine.

## À tester après déploiement

- Auth inscription/connexion.
- Dashboard membres.
- Forum : ouverture canal, envoi message, upload média.
- Messages : conversation directe/groupe, envoi, édition/suppression.
- Admin forum : validation/modification membre.
- Admin contenus : onglets, sauvegarde ressources/catégories/questionnaire.
- Calendrier admin : création/modification/suppression événement.
- Saison admin : édition activités/formules.
- PWA : installation + notification push.
