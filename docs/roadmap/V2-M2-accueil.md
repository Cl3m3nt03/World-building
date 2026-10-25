# V2-M2 — Accueil et navigation

**Objectif** : les premiers écrans qu'on voit et ceux qu'on traverse sans cesse donnent envie d'entrer dans son monde. On refait la liste des mondes, la création d'un monde, la Home du monde, la barre du haut et la sidebar avec le socle de V2-M1 (ADR 0012).

**Référence** : vvd, étudié avec REA (`docs/outils/rea.md`). On reprend ses comportements et son ergonomie, jamais ses fichiers. Chaque écran commence par une note d'observation (`docs/outils/vvd/<écran>.md`), écrite avec nos mots.

**Ordre d'exécution** : V2-2.0 d'abord (elle sert toutes les autres), puis 2.1 → 2.2, 2.3, 2.4 → 2.5, 2.6, et 2.7 en dernier.

---

## V2-2.0 — Étude de vvd avec REA (#442)
- [ ] Clément ouvre vvd dans un Chrome dédié (port de débogage local) ; Claude observe la liste des mondes, la création d'un monde, la Home, la barre du haut et la sidebar
- [ ] Une note par écran : zones, hiérarchie, mesures, états, interactions, raccourcis, accessibilité ; écarts voulus avec BuilderZ (local, mono-utilisateur)

**Critères d'acceptation** : aucune ressource ni ligne de code de vvd dans le dépôt ; chaque issue suivante cite sa note.

## V2-2.1 — Liste des mondes (#443)
- [ ] L'écran d'ouverture devient un atlas : en-tête sur l'atlas vivant, mondes en « folios » (couverture, nom en serif, genre, dernière ouverture), le dernier ouvert mis en avant
- [ ] Actions claires (créer, ouvrir un dossier), menu d'un monde, recherche et tri quand il y en a beaucoup
- [ ] État vide accueillant (premier lancement) et monde introuvable

**Critères d'acceptation** : clavier complet (flèches dans la grille, Entrée ouvre) ; 1028×749 sans débordement ; deux thèmes.

## V2-2.2 — Création d'un monde (#444)
- [ ] Un dialogue en étapes courtes : nom, genre (choix illustrés), image (facultative), dossier ; aperçu du monde (son atlas, son accent)
- [ ] Le monde s'ouvre sur sa Home avec la séquence d'entrée

**Critères d'acceptation** : créable au clavier seul ; erreurs (nom vide, dossier existant, disque) expliquées sur place.

## V2-2.3 — Home du monde (#445)
- [ ] Un en-tête de monde : couverture, nom en serif, description, genre et chiffres clés
- [ ] Reprendre là où on en était (documents récents en folios), créer (nouvelle carte, map, frise…), gérer (types, médiathèque, thème, réglages)
- [ ] L'aperçu du graph et les sections gardent leur rôle, avec la hiérarchie de la V2

**Critères d'acceptation** : lisible d'un coup d'œil ; un monde vide guide vers la première carte.

## V2-2.4 — Barre du haut (#446)
- [ ] Îlots retravaillés : monde courant (avec changement rapide de monde), onglets avec libellés au survol et au focus, actions (radio, réglages, mondes)
- [ ] Recherche globale (Ctrl+K) visible depuis la barre

**Critères d'acceptation** : ordre de tabulation logique ; raccourcis inchangés ; aucun débordement à 1028 px.

## V2-2.5 — Sidebar (#447)
- [ ] Hiérarchie V2 : recherche, épinglés, arbre des documents (icônes de types, dossiers), pied d'actions ; densité et états (survol, sélection, glisser-déposer) sur les tokens
- [ ] Le pied de la sidebar ne déborde plus (bug connu depuis M6), pas de barre de défilement horizontale, libellés tronqués avec info-bulle

**Critères d'acceptation** : toutes les actions de M3 (organisation) inchangées et couvertes par l'e2e existant.

## V2-2.6 — Transitions de navigation (#448)
- [ ] Changement d'onglet, ouverture d'un document et retour à la liste avec les tokens de mouvement ; focus placé au bon endroit après chaque navigation

**Critères d'acceptation** : mouvement réduit : rien ne bouge ; lecteur d'écran : chaque navigation annonce sa page.

## V2-2.7 — E2E et recette (#449)
- [ ] E2E mis à jour pour les nouveaux écrans (liste, création, Home, barre, sidebar) à 1028×749
- [ ] Captures dans l'app réelle, deux thèmes ; issue de recette pour Clément

**Critères d'acceptation** : Clément valide l'accueil et la navigation avant V2-M3.
