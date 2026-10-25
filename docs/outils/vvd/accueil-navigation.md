# vvd — accueil et navigation (observations)

Note d'étude pour V2-M2 (`docs/roadmap/V2-M2-accueil.md`), rédigée avec nos mots. Aucun fichier de vvd n'est repris (`docs/outils/rea.md`).

**Sources** : captures du board FigJam (bloc « Interface », node `3:18`), puis une session REA sur le compte de Clément le 2026-10-25 (vvd dans un Brave dédié, observé en lecture seule : aucun monde ni document créé, modifié ou supprimé). Les captures brutes restent hors du dépôt (`tools/rea/captures`).

## Barre du haut

- Trois îlots : à gauche le monde courant (icône + nom + badge), au centre les onglets en icônes, à droite les actions.
- Les onglets n'ont qu'une icône ; leur nom apparaît **au survol**, dans une petite étiquette sous l'icône. L'onglet actif porte aussi son nom dans l'îlot.
- Un clic sur l'îlot du monde ouvre un **popover du monde** : couverture à gauche, nom, description (« Cliquez pour ajouter une description »), une pastille de genre ; deux onglets en haut (le monde, le profil).

## Onglet World vide

- Au centre bas de l'espace de travail, une rubrique « Commencer avec » au-dessus d'un **dock de grandes tuiles** (carte, map, canvas, graph) : icône dans un carré de verre, libellé dessous.
- La sidebar reste visible à gauche, avec un pied d'actions en icônes.

## Home du monde

- Grand titre d'accueil en haut à gauche, sous lui une ligne « Reprendre là où vous en étiez » avec le dernier document en pastille, « ou essayer quelque chose de nouveau » et des pastilles de création.
- « Espaces récents » : une rangée de **tuiles image** (vignette du document, nom, date relative).
- À droite, une colonne « Gérer » : liste courte (types, médias, thème, réglages), chaque ligne en pastille avec icône.
- En bas, un aperçu du graph (vide : une icône et un texte d'aide).

## Écarts voulus avec BuilderZ

- Pas de profil ni de compte (local, mono-utilisateur) : le popover du monde n'a pas d'onglet « profil ».
- Pas de fil de nouveautés ni de bouton « Feedback ».
- La liste des mondes n'apparaît pas sur le board : on la conçoit pour BuilderZ (écran d'ouverture « atlas », ADR 0012).

## Session REA du 2026-10-25 (vvd actuel)

vvd a beaucoup changé depuis les captures du board. Ce qu'on y voit aujourd'hui :

### Rail et liste des mondes
- Un **rail fin à gauche**, qui se déplie depuis un bouton rond en haut à gauche. Il contient en haut : « Mondes » (la liste), le profil, **une icône par monde** (sa couverture, ronde), « + » (nouveau monde). En bas : déconnexion et paramètres du compte. Les info-bulles du rail sont grandes et en gras.
- La **liste des mondes** est minimaliste : un titre centré « Où aller ? » (sans-serif, 25 px, demi-gras), puis une **rangée par monde** (420 × 72 px, rayon ~19 px). Le nom et « Modifié il y a 2 min » sont à gauche, la couverture remplit la rangée en fond, et un menu « … » est à droite. Dessous, un « + Nouveau monde » en texte. Le fond est l'illustration floutée du monde.
- Le menu « … » d'un monde : **Épingler en premier**, **Dupliquer le monde**, **Supprimer le monde** (en rouge, séparé).

### Barre du haut d'un monde
- À gauche : la pastille du monde (couverture + nom), puis une **flèche « Infos du monde »**, puis des **onglets façon navigateur** : « Monde » (large), « W » (wiki), « + » (nouvel onglet). À droite : « Installer l'application », la radio et l'heure (« afficher le cadran »).
- La flèche « Infos du monde » ouvre un **grand popover de réglages**. À gauche, une navigation verticale : Infos du monde, Chemins, Types, Médias, Collaboration, Site & domaine, Thème, Importer (bêta), Exporter, Préférences, Archive. À droite : la couverture, le nom, la description, les **genres en pastilles à choix multiple** (une vingtaine : fantasy, SF, moderne, horreur, grimdark, dark fantasy, mythologie, steampunk, cozy…), le lien du wiki, puis « Enregistrer ».
- Un clic sur la pastille du monde mène à la **Home du monde** : « Bon retour », trois compteurs (mots, documents, connexions) posés sur de fines barres, une carte « Éditeur de monde → », le **graph du monde en grand au centre** (vide : « Rien à cartographier pour le moment »), et une petite barre d'outils verticale flottante à droite (réglages, filtres du graph).

### Espace de travail
- Sidebar vide : une icône, « Aucun document pour l'instant », « + Nouveau document », « Importer de n'importe où ». En tête : la recherche, les filtres, un nouveau dossier et le repli.
- Au centre, un **dock de grandes tuiles** (fiche, carte, toile, chronologie, « Plus ») et « Explorer les outils ». « Plus » déplie, en bas de la sidebar, une **grille d'emplacements d'outils** personnalisable.
- « Explorer les outils » ouvre un **catalogue d'outils** (Explorer, Bibliothèque, Workshop ; catégories par usage : JDR, jeu vidéo, écriture, scénario, BD, animation ; « Installé », « Nouveau » ; une suggestion d'outil par l'IA).
- Les documents s'ouvrent en **panneaux côte à côte**, chacun avec « agrandir » et « fermer ».
- « Nouveau document » ouvre un panneau **« Sélectionner un type »** : une recherche, les catégories à gauche (écologie, espèce, événement, faction, lieu, objet, personnage, savoir), les types à droite, « Ajouter un type », et l'aide clavier en bas (↑ ↓ naviguer, ↵ sélectionner).

### Premiers pas
- Un nouveau compte arrive sur « Commençons par le type d'histoire que vous souhaitez raconter » (campagne de JDR, fiction, création d'univers, film et TV, narration de jeu, autre chose). À côté, un **monde d'exemple** est ouvert (une fiche de personnage et une carte, marquées « Didacticiel »), avec « Passer » en haut à droite.

## Écarts avec BuilderZ après V2-M2, à trancher avec Clément

| vvd | BuilderZ aujourd'hui |
|---|---|
| Liste « Où aller ? » en rangées sobres | Bandeau du dernier monde + folios en grille |
| Rail de mondes à gauche (icônes) | Changement de monde dans la carte du monde (popover) |
| Réglages du monde en popover depuis la barre | Dialogue de réglages (depuis la carte du monde ou la Home) |
| Genres multiples | Un genre |
| Menu d'un monde : épingler en premier, dupliquer, supprimer | Ouvrir, afficher dans l'Explorateur, retirer de la liste |
| Home : compteurs mots / documents / connexions, graph au centre | En-tête du monde, documents récents, graph en bas |
| Onglets de documents et panneaux côte à côte | Un document à la fois |
| Dock de tuiles et catalogue d'outils | « Commencer avec… » en petites tuiles |
| Sélecteur de types en panneau, avec catégories | Menu des types |
| Premiers pas : type d'histoire + monde d'exemple | Accueil du premier lancement |
