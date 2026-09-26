# 00 — Interface, mondes et réglages

**Milestone** : M1 · **Figma** : node `3:18`

## Objectif

Définir la coque de l'application : comment on choisit un monde, comment on circule entre les grands modes, et où se trouvent les réglages.

## Liste des mondes (écran de démarrage)

C'est le premier écran au lancement, et on peut y revenir à tout moment par le bouton « Mondes » en haut à droite.

- Les mondes sont affichés en grille, avec l'image principale, le nom, le genre et la date de dernière ouverture. L'image est une **vignette** mise en cache à part : elle s'affiche sans ouvrir le monde. Un monde sans image montre un visuel par défaut.
- On peut créer un monde (nom, genre, dossier sur le disque), ouvrir un dossier monde existant ou retirer un monde de la liste. Retirer un monde de la liste ne le supprime pas du disque.
- Un nouveau monde est créé dans un **nouveau dossier à son nom**, à l'emplacement choisi (par défaut `Documents\BuilderZ`). L'emplacement doit donc être le dossier parent, pas le dossier du monde lui-même.
- Revenir à la liste des mondes (bouton « Mondes ») ferme le monde ouvert.
- Un monde introuvable, parce que son dossier a été déplacé ou supprimé, est signalé et peut être relocalisé.

## Coque d'un monde ouvert

- **En haut à gauche** : le monde courant. Un clic ouvre un panneau pour modifier le nom, le genre, la description et l'image principale.
- **En haut au centre** : les onglets **Home**, **World**, **Wiki** et **Quill**.
- **En haut à droite** : la radio, les réglages et le bouton « Mondes ».
- **À gauche** : la sidebar (voir `02-organisation.md`), présente dans l'onglet World.
- **Au centre** : l'espace de travail, où l'on crée et édite.

### Onglet Home

C'est la page d'accueil du monde, qu'on voit quand on revient dessus (texte du board : « the landing page where you revisit and open your world »). D'après les captures du board, elle contient, de haut en bas :

- un titre de bienvenue ;
- une ligne **« Reprendre là où vous en étiez »**, avec le dernier document ouvert, suivie de « ou essayer quelque chose de nouveau » et de raccourcis de création ;
- les **documents récents**, en vignettes (image, nom, date relative : « il y a 38 min ») ;
- un bloc **Gérer**, à droite, avec quatre entrées : **Types** (voir `01-cartes-et-types.md`), **Médiathèque**, **Thème** et **Réglages** du monde ;
- un **aperçu du graph du monde** (voir `04-graph.md`), avec recherche et filtres. Tant qu'aucune carte n'est reliée, il affiche un état vide qui invite à créer des cartes et à les relier par des mentions `@`.

Tant que le Graph n'existe pas (M5), l'aperçu est remplacé par les épingles et un résumé du monde (nombre de cartes par type).

### Thème du monde

Entrée **Thème** du bloc Gérer. Le thème du monde est une ambiance visuelle propre au monde (image de fond, teinte des panneaux), réutilisée par Quill (« garder le thème du monde » dans l'onglet Style, voir `08-quill.md`).

**Question ouverte** : le board ne détaille pas les réglages du thème. Proposition à valider avec Clément : image de fond (par défaut l'image principale du monde), teinte d'accent, et choix clair/sombre forcé ou non.

### Onglet World

C'est l'espace de travail principal. On y trouve la sidebar et l'éditeur du document ouvert (carte, map, graph, canvas ou arbre). Quand aucun document n'est ouvert, un clic au centre propose de créer un document. Tant qu'un type de document n'est pas encore disponible, sa tuile reste visible mais est signalée « Bientôt disponible » avec le milestone qui l'apporte ; de même, les onglets Wiki et Quill expliquent ce qu'ils feront. Aucun élément cliquable ne reste sans effet sans l'indiquer.

## Genres

Le genre d'un monde détermine les **types de cartes proposés par défaut** à sa création (voir `01-cartes-et-types.md`). Les genres de départ sont : Fantasy, Science-fiction, Romance, Cyberpunk, Contemporain et Autre. Le genre se choisit dans le dialogue « Nouveau monde » (Fantasy par défaut). On peut changer de genre plus tard sans rien perdre : les types déjà créés restent.

## Réglages de l'application

| Réglage | Valeurs |
|---|---|
| Apparence | Clair, sombre, système |
| Effets de transparence | Activés (par défaut), désactivés : surfaces opaques et sans flou (voir ADR 0003) |
| Langue | Français, English |
| Dossier par défaut des nouveaux mondes | Chemin |

Ces réglages sont stockés dans le dossier de config de l'app, pas dans un monde. Ils s'ouvrent dans un dialogue **Réglages** (bouton engrenage), accessible depuis la barre du haut d'un monde ouvert et depuis la liste des mondes. Le dialogue contient aussi une section **À propos** (version et dossiers utilisés). Le dossier par défaut des nouveaux mondes est proposé par « Nouveau monde » ; « Par défaut » revient à `Documents\BuilderZ`.

## Médiathèque

C'est la galerie de tous les fichiers importés dans le monde (images, sons et autres fichiers), en grille de vignettes avec le nom, le type et la taille. On y accède depuis l'onglet Home (bloc « Gérer »). On importe avec le bouton « Importer » (plusieurs fichiers à la fois), en glissant des fichiers sur la fenêtre, ou en collant une image (`Ctrl+V`, hors champ de saisie ; elle est nommée « Image collée » suivi de la date). On filtre par type (Tout, Images, Sons, Autres) et on recherche par nom. Elle permet d'importer par glisser-déposer ou collage, de renommer, de filtrer par type et de supprimer. Un fichier encore utilisé demande une confirmation avant d'être supprimé, et le message indique où il est utilisé. Tous les sélecteurs d'image de l'app (carte, map, canvas…) passent par la médiathèque.

## Radio

C'est un lecteur d'ambiance qui accompagne le travail. *Adaptation locale* : au lieu d'une bibliothèque en ligne, la radio lit les **pistes audio importées** par l'utilisateur, avec lecture/pause, piste suivante, volume et lecture en boucle ou aléatoire. La musique continue quand on change d'onglet.

## Retiré (voir `docs/contexte.md`)

Le plan, l'abonnement, les membres, le fil de nouveautés et le formulaire de suggestion ou de bug sont retirés.

## Critères d'acceptation globaux

- On peut créer deux mondes, passer de l'un à l'autre et retrouver l'état de chacun.
- Les réglages sont conservés entre deux lancements.
- Toute l'interface est traduite et fonctionne dans les deux thèmes.
