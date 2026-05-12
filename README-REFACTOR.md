# Fais Ton Show — Refactor extraction JS inline vers services

Ce pack conserve les pages HTML existantes mais supprime le JavaScript inline.

## Changements principaux

- Création de `assets/js/pages/` : un module par page HTML.
- Création de `assets/js/services/` : couche de services Firebase claire.
- Conservation des fichiers communs existants : `fts-utils.js`, `fts-firebase.js`, `fts-chat.js`, `fts-pwa.js`.
- Déplacement logique des assets dans `assets/css`, `assets/js`, `assets/img`.
- Manifest PWA complété avec icônes, scope, start_url et raccourcis.

## Services ajoutés

- `auth.service.js`
- `users.service.js`
- `resources.service.js`
- `events.service.js`
- `forum.service.js`
- `messages.service.js`
- `content.service.js`
- `notifications.service.js`
- `season.service.js`

## Important

Les modules de pages gardent volontairement la logique existante pour limiter les risques de régression.
La prochaine étape recommandée est de remplacer progressivement les appels directs `db.ref(...)` dans les pages par les services `FTS.Services.*`.

## Structure

```txt
/assets
  /css
  /img
  /js
    /pages
    /services
```
