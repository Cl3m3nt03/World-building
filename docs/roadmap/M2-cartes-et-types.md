# M2 — Cartes et types

**Objectif** : créer et remplir les fiches de son monde. On crée des cartes typées (personnage, lieu, objet…), on les nomme, on leur donne une image, des alias et des propriétés, on écrit leur contenu en blocs (texte riche, image, fiche 5e), on relie les cartes entre elles (propriétés lien et mentions `@`), et chaque carte montre qui la cite. Les types se personnalisent entièrement, et un monde reçoit à sa création des types adaptés à son genre.

**Spec** : `docs/features/01-cartes-et-types.md` (board : node `4:70`, pavé « Cards and Cards type »). Socle commun : `docs/features/README.md` (documents, liens, éditeur, corbeille).

**Hors M2** : la sidebar complète (dossiers, parent/enfant, épingles, tri, filtres, recherche) est M3 ; M2 n'a qu'une **liste simple** des cartes pour les ouvrir et les créer. Le bloc Map attend les maps (M4) : il est visible mais signalé « Bientôt disponible ». La recherche plein texte (FTS5) et la détection de noms dans Quill utilisent les données posées ici, mais arrivent avec M3 et M9. Le thème du monde reste à cadrer.

**Ordre d'exécution** : 2.1 → 2.2 → 2.3, puis 2.4 → 2.5 → 2.6, puis 2.7 → 2.8, puis 2.9 → 2.10 → 2.11 → 2.12 → 2.13, puis 2.14 → 2.15.

---

## 2.1 — Socle des documents et corbeille
**Branche** : `feat/documents-core` · **Dépend de** : —

- [ ] Migration : table `documents` (id, nature, titre, dossier, parent, ordre, épinglé, visible dans le wiki, dates, date de mise à la corbeille), commune à tous les modules
- [ ] Commandes : lister, renommer, mettre à la corbeille, restaurer, supprimer définitivement, vider la corbeille
- [ ] Table `links` (source, cible, nature `mention` / `property` / `map_pin`) et sa mise à jour par le Rust, sans interface pour l'instant
- [ ] Tests Rust : corbeille réversible, suppression définitive qui garde les liens comme références mortes

**Critères d'acceptation** : un document mis à la corbeille disparaît des listes et se restaure à l'identique.

## 2.2 — Types de cartes et types par défaut selon le genre
**Branche** : `feat/card-types-core` · **Dépend de** : 2.1

- [ ] Migration : `card_types` (parent pour les sous-types, nom, icône, couleur, template guidé, orientation et format canvas par défaut, ordre)
- [ ] Commandes : lister, créer, renommer, changer icône et couleur, dupliquer, réordonner, supprimer (en déplaçant ses cartes vers un autre type)
- [ ] Types par défaut créés à la création d'un monde selon son genre (tableau validé de la spec), et une seule fois à l'ouverture d'un monde de M1 qui n'en a pas encore
- [ ] Changer le genre d'un monde n'ajoute ni ne supprime aucun type
- [ ] Tests Rust : types par défaut de chaque genre, sous-types, suppression avec déplacement des cartes

**Critères d'acceptation** : un monde Science-fiction reçoit Technologie, Vaisseau, Espèce et Planète en plus des types communs, et un monde créé en 0.2.0 reçoit ses types à la première ouverture.

## 2.3 — Écran de gestion des types (Home › Types)
**Branche** : `feat/card-types-screen` · **Dépend de** : 2.2

- [ ] Entrée **Types** du bloc Gérer activée : écran « Types de cartes », liste à gauche (recherche, « + », chevron pour les sous-types), détail à droite
- [ ] Détail d'un type : nom, icône (choix dans une grille lucide), couleur (palette de tokens), dupliquer, supprimer (avec choix du type de destination s'il a des cartes)
- [ ] Réglages de carte par défaut : orientation (portrait, paysage) et format canvas
- [ ] Création et suppression de sous-types
- [ ] Clavier complet, FR et EN, deux thèmes

**Critères d'acceptation** : on crée un type « Artefact » avec une icône et une couleur, un sous-type « Relique », et on les retrouve après relance.

## 2.4 — Cartes : création et page de la carte
**Branche** : `feat/cards-core` · **Dépend de** : 2.2

- [ ] Migration : `cards` (document, type, image, alias, contenu JSON, contenu texte)
- [ ] Commandes : créer une carte d'un type, lire, renommer, changer de type ou de sous-type, choisir l'image, gérer les alias
- [ ] Page de la carte (onglet World) : nom modifiable directement, image via le sélecteur de la médiathèque, type et sous-type modifiables, alias
- [ ] Orientation de l'image selon le réglage par défaut du type
- [ ] Mettre la carte à la corbeille depuis sa page

**Critères d'acceptation** : on crée une carte Personnage, on la renomme, on lui donne une image et deux alias, on change son type, et tout est conservé après relance.

## 2.5 — Liste des cartes et points de création
**Branche** : `feat/cards-list` · **Dépend de** : 2.4

- [ ] Sidebar de l'onglet World : liste simple des cartes (icône et couleur du type, nom), clic pour ouvrir, carte ouverte mise en évidence
- [ ] Trois façons de créer une carte : clic au centre de l'espace vide, boutons en bas de la sidebar, clic droit dans la sidebar
- [ ] Menu de création : types et sous-types (déroulants), plus « Nouveau type » ; la carte s'ouvre en édition avec son nom par défaut sélectionné
- [ ] Tuile « Carte » de l'onglet World activée ; les autres restent « Bientôt disponible »
- [ ] Corbeille minimale : liste des cartes supprimées, restaurer, vider

**Critères d'acceptation** : on crée une carte par chacun des trois chemins, et une carte supprimée se restaure depuis la corbeille.

## 2.6 — Documents récents sur l'onglet Home
**Branche** : `feat/home-recent` · **Dépend de** : 2.5

- [ ] « Reprendre là où vous en étiez » : le dernier document ouvert
- [ ] Documents récents en vignettes (image, nom, date relative)
- [ ] Résumé du monde : nombre de cartes par type

**Critères d'acceptation** : après avoir ouvert trois cartes, Home montre la dernière en « Reprendre » et les trois en récents, dans l'ordre.

## 2.7 — Propriétés texte et nombre
**Branche** : `feat/card-properties` · **Dépend de** : 2.3, 2.4

- [ ] Migration : `property_definitions` (portée type ou carte, libellé, nature, ordre) et `property_values`
- [ ] Sur le type (écran Types) : ajouter, renommer, réordonner, supprimer une propriété Texte ou Nombre ; bandeau « Appliquer les changements à toutes les cartes de ce type ? » (Ignorer / Oui)
- [ ] Un sous-type hérite des propriétés de son type et peut en ajouter
- [ ] Sur une carte : saisir les valeurs, ajouter une propriété propre à la carte
- [ ] Supprimer une propriété demande confirmation avec le nombre de valeurs perdues

**Critères d'acceptation** : on ajoute « Âge » au type Personnage, et trois cartes Personnage (existantes et nouvelles) affichent le champ « Âge ».

## 2.8 — Propriétés lien et rétroliens
**Branche** : `feat/card-link-properties` · **Dépend de** : 2.1, 2.7

- [ ] Natures « Lien vers une carte » et « Liens vers plusieurs cartes », restreintes ou non à certains types
- [ ] Choix des cartes par une recherche dans une liste déroulante (clavier)
- [ ] Chaque valeur crée un lien `property` dans la table des liens
- [ ] Section « Cité dans » en bas de chaque carte, cliquable

**Critères d'acceptation** : une propriété « Lieu de naissance » qui pointe vers une carte Lieu apparaît dans les rétroliens de ce lieu.

## 2.9 — Éditeur de blocs et bloc texte
**Branche** : `feat/card-blocks` · **Dépend de** : 2.4

- [ ] Contenu d'une carte en blocs ; bloc Texte en TipTap (titres, gras, italique, listes, citation), enregistré automatiquement
- [ ] Ajout de blocs par un bouton « + » et par la commande `/`
- [ ] Réordonner par glisser-déposer (dnd-kit) et au clavier, supprimer un bloc
- [ ] Texte brut dérivé et enregistré pour la future recherche
- [ ] `Ctrl+Z` / `Ctrl+Y` dans l'éditeur

**Critères d'acceptation** : on écrit trois blocs de texte, on les réordonne, on en supprime un, et le contenu est identique après relance.

## 2.10 — Mentions `@carte`
**Branche** : `feat/card-mentions` · **Dépend de** : 2.8, 2.9

- [ ] `@` dans un bloc texte ouvre une recherche de cartes (nom et alias) ; la mention s'insère et reste cliquable
- [ ] Chaque mention crée un lien `mention` ; les rétroliens les listent
- [ ] Une mention vers une carte à la corbeille ou supprimée s'affiche comme référence morte

**Critères d'acceptation** : mentionner une carte par un de ses alias crée un rétrolien sur cette carte.

## 2.11 — Bloc image
**Branche** : `feat/card-image-block` · **Dépend de** : 2.9

- [ ] Bloc Image : une image de la médiathèque (via le sélecteur) avec une légende
- [ ] Usages : supprimer l'image de la médiathèque signale les cartes qui l'utilisent (image de carte et blocs)

**Critères d'acceptation** : une image utilisée dans un bloc est signalée à la suppression dans la médiathèque.

## 2.12 — Templates guidés
**Branche** : `feat/guided-templates` · **Dépend de** : 2.3, 2.9

- [ ] Sur l'écran Types : éditer le template d'un type (sections : titre et question d'aide), avec des templates fournis pour les types par défaut
- [ ] Sur une carte vide : proposition d'appliquer le template ; ensuite disponible à tout moment dans le menu de la carte
- [ ] Appliquer ajoute des blocs texte pré-titrés avec texte indicatif, sans jamais remplacer du contenu existant

**Critères d'acceptation** : appliquer le template Personnage à une carte qui a déjà du texte ajoute Background, Personnalité et Apparence sans rien effacer.

## 2.13 — Fiche de stats 5e et bloc Map « bientôt »
**Branche** : `feat/stat-block-5e` · **Dépend de** : 2.9

- [ ] Bloc « Fiche de stats 5e » : caractéristiques, modificateurs calculés, CA, PV, vitesse, compétences, actions
- [ ] Bloc « Map » visible dans le menu des blocs, signalé « Bientôt disponible (M4) »

**Critères d'acceptation** : une Force de 15 affiche un modificateur de +2, et changer la valeur met le modificateur à jour.

## 2.14 — Tests de bout en bout M2
**Branche** : `test/e2e-m2` · **Dépend de** : 2.8, 2.10, 2.12

- [ ] Scénario : type Personnage avec « Âge », trois cartes qui affichent le champ
- [ ] Scénario : propriété lien et mention, rétroliens des deux cartes cibles
- [ ] Scénario : template guidé appliqué à une carte qui a déjà du contenu, rien n'est perdu

**Critères d'acceptation** : les critères d'acceptation de `01-cartes-et-types.md` sont couverts par les tests de bout en bout, qui passent en CI.

## 2.15 — Recette manuelle M2
**Branche** : — · **Dépend de** : 2.14

- [ ] Issue « Recette manuelle M2 » tenue à jour après chaque feature fusionnée, à valider par Clément

**Critères d'acceptation** : la recette est validée avant la release.

---

## Définition de « M2 terminé »

1. Les critères d'acceptation de `docs/features/01-cartes-et-types.md` sont remplis et testés.
2. Toute la nouvelle interface est traduite, accessible au clavier et fonctionne dans les deux thèmes.
3. Un monde créé en 0.2.0 s'ouvre sans perte et reçoit ses types par défaut.
4. La CI est verte sur `main`, et une release `v0.3.0` publie l'installeur.
