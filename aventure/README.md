# Aventure Fais Ton Show — prototype à valider

**Statut :** prototype sur branche séparée. Aucune mise en production.

## Accès après intégration

- `https://app.faistonshow.fr/aventure/`
- `https://app.faistonshow.fr/aventure/?source=mamie-2026`
- Sources reconnues : `mamie-2026`, `facebook`, `instagram`, `affiche`, `festival-2027` et accès direct.
- Avec un hébergement statique de type GitHub Pages, le chemin `/aventure` doit rediriger vers `/aventure/`. Il faut **vérifier le comportement réel** avant d’imprimer des QR codes.

## Fichiers

- `index.html` : accueil et structure des écrans, sans PWA installable exigée.
- `styles.css` : styles propres à la page, palette FTS `#0A0A0A / #F8E702 / #F5F2EE`.
- `config.js` : textes, univers, activités, règles d'âge vérifiées ou explicitement à vérifier.
- `app.js` : navigation, recommandations, adaptations et sorties.
- `preview-standalone.html` : démonstration autonome avec CSS et JS intégrés, pour lecture locale ou via un service d'aperçu HTML. Dans cette version de démonstration, les liens vers le site sont absolus.

## Expérience

- Accroche universelle « Et si tu te surprenais toi-même ? ».
- Quatre questions principales : pour qui, motivation, univers, moment.
- Âge facultatif seulement pour l'enfant ou l'ado, pas de date de naissance.
- Résultat personnalisé, deux pistes quand elles sont cohérentes, possibilité de consulter toutes les activités.
- « Surprenez-moi » propose deux activités de familles différentes lorsque c'est possible.
- Retour, modification des réponses et redémarrage.
- Appréhensions facultatives après le résultat.
- Aucune photo d'élève fictive ; visuel typographique CSS provisoire.
- Réduction du mouvement respectée par CSS.

## Absence de faux dispositifs

- Les disponibilités ne sont **pas** vérifiées : aucune place, date d'essai ou réservation n'est promise.
- `Je veux essayer` ouvre une **demande d'information par e-mail prérempli**, pas un outil de réservation.
- Les demandes pour la rentrée ouvrent également un e-mail, sans inscription automatique ni newsletter.
- Pas de champ de coordonnées ni d'enregistrement personnel sur le site.
- Aucun traceur ni collecte réseau dans le prototype. Des événements JavaScript locaux `fts:discovery` sont émis pour permettre une future intégration conforme, mais ne constituent **pas** des statistiques agrégées.

## Scénarios fonctionnels vérifiés avec simulation JavaScript

1. Adulte, collectif + jouer : Théâtre loisir / Improvisation.
2. Parent, enfant 8 ans, créer + jouer : Théâtre 7–9 ans / Comédie musicale Kids.
3. Provenance Mamie, adulte, collectif + voix : Chant / Singer Academy.
4. Enfant 6 ans : éviter la recommandation automatique de théâtre 7–9 ans.
5. Adolescent, découverte + « Surprenez-moi » : pistes contrastées.
6. Retour depuis le résultat et changement du moment : appel à l'action recalculé.

## Vérifications à compléter dans un véritable navigateur

- Affichage et interactions sur plusieurs appareils et tailles réelles.
- Navigation clavier et lecteur d'écran.
- Ouverture de la messagerie sur iOS/Android.
- Comportement `/aventure` sans slash après intégration sur l'hébergement final.
- Qualité et accessibilité des futurs visuels.
- Branche à fusionner **uniquement après validation**.
