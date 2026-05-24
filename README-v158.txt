FTS v158 — Profs Danse OneDrive : masquer Cloudinary

Objectif :
- Ne pas toucher au Worker push.
- Ne pas toucher au Worker email.
- Conserver la logique OneDrive read/write.
- Masquer la zone "glisser déposer" Cloudinary quand une vidéo Danse utilise un dossier OneDrive configuré.

Fichiers à déployer :
- profs.html
- sw.js
- assets/js/pages/profs.js

Tests :
1. Prof/admin connecté > profs.html.
2. Catégorie Danse > Type Vidéo > Sous-catégorie Les Baby Show.
3. Le lien lecture se remplit dans le champ Lien.
4. Le bouton Déposer la vidéo dans OneDrive apparaît.
5. La zone Glisse ton fichier ici / Cloudinary disparaît.
6. Revenir sur PDF/audio/image/doc : la zone Cloudinary réapparaît.
