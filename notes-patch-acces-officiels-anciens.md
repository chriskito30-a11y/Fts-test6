# Patch accès officiels / anciennes catégories — Fais Ton Show

## Objectif
Patch minimal ciblé sur les accès membres/admin, sans modification du Worker HelloAsso, sans modification du JSON Saison stable et sans changement des IDs avec underscores.

## Cause identifiée
- `forum-admin` chargeait les catégories officielles depuis `fts_content/categories`, mais l’édition d’un membre ne proposait que ces catégories officielles.
- Les anciennes catégories ou anciens sous-groupes encore présents dans `fts_users` n’étaient donc pas visibles dans la modale.
- La sauvegarde utilisait une mise à jour globale, ce qui ne garantissait pas un remplacement strict des accès reconstruits depuis les cases cochées.
- Côté membre, les disciplines affichées provenaient directement du profil, donc une ancienne catégorie pouvait encore apparaître même si elle n’existe plus dans la configuration active.

## Corrections appliquées

### `assets/js/pages/membres.js`
- Le dashboard membre ne garde que les catégories présentes dans la configuration officielle active chargée depuis `fts_content/categories`.
- Les anciennes catégories restent dans Firebase tant qu’elles n’ont pas été nettoyées côté admin, mais elles ne sont plus affichées comme accès valides côté membre.
- Les sous-groupes côté membre sont également filtrés sur les sous-catégories officielles actives.

### `assets/js/pages/forum-admin.js`
- Conservation d’une copie brute des profils `fts_users` et `fts_forum/users` pour ne pas perdre les champs non affichés lors d’un `set`.
- Dans la modale d’édition :
  - affichage des catégories officielles actuelles ;
  - ajout des anciennes catégories présentes dans le profil du membre/enfant ;
  - badge visuel `ancien` sur les catégories/sous-groupes obsolètes.
- Si une ancienne catégorie ou un ancien groupe reste coché, il est conservé.
- Si l’admin le décoche puis enregistre, il est supprimé de Firebase.
- Sauvegarde avec `set()` sur `fts_users/{uid}` en reconstruisant les accès depuis les cases cochées, tout en préservant les autres champs du profil brut.
- Mise à jour de `fts_forum/users/{uid}` avec conservation des champs existants comme badges/stats.
- Le résumé des accès exclut maintenant les rôles `admin` et `prof` : seuls les comptes `member` actifs sont comptés.

### `assets/css/pages/forum-admin.css`
- Style visuel pour les accès obsolètes : couleur différente + badge `ancien`.

### `sw.js`
- Version cache passée à `fts-v200-access-cleanup-admin-member`.

## Fichiers modifiés
- `assets/js/pages/membres.js`
- `assets/js/pages/forum-admin.js`
- `assets/css/pages/forum-admin.css`
- `sw.js`

## Tests rapides
1. Ouvrir `membres.html` avec un compte ayant d’anciens accès : seules les catégories officielles actives doivent apparaître.
2. Ouvrir `forum-admin.html#tab-members` puis éditer un membre concerné.
3. Vérifier que les anciennes catégories/sous-groupes apparaissent avec le badge `ancien`.
4. Enregistrer sans décocher : les anciens accès doivent rester dans Firebase.
5. Décocher une ancienne catégorie ou un ancien sous-groupe, enregistrer, rouvrir la modale : l’accès décoché doit avoir disparu.
6. Vérifier le résumé des accès : les comptes `admin` et `prof` ne doivent plus être comptés.
