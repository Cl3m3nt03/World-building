# 00 — Interface, mondes et réglages

**Milestone** : M1 · **Figma** : node `3:18`

## Objectif

Définir la coque de l'application : comment on choisit un monde, comment on circule entre les grands modes, et où se trouvent les réglages.

## Liste des mondes (écran de démarrage)

C'est le premier écran au lancement, et on peut y revenir à tout moment par le bouton « Mondes » en haut à droite.

- Les mondes sont affichés en grille, avec l'image principale, le nom, le genre et la date de dernière ouverture.
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

C'est la page d'accueil du monde, qu'on voit quand on revient dessus. Elle affiche les documents récents, les épingles et un résumé du monde (nombre de cartes par type). On y accède aussi à la **gestion des types** (voir `01-cartes-et-types.md`) et à la **médiathèque**.

### Onglet World

C'est l'espace de travail principal. On y trouve la sidebar et l'éditeur du document ouvert (carte, map, graph, canvas ou arbre). Quand aucun document n'est ouvert, un clic au centre propose de créer un document.

## Genres

Le genre d'un monde détermine les **types de cartes proposés par défaut** à sa création (voir `01-cartes-et-types.md`). Les genres de départ sont : Fantasy, Science-fiction, Romance, Cyberpunk, Contemporain et Autre. On peut changer de genre plus tard sans rien perdre : les types déjà créés restent.

## Réglages de l'application

| Réglage | Valeurs |
|---|---|
| Apparence | Clair, sombre, système |
| Effets de transparence | Activés (par défaut), désactivés : surfaces opaques et sans flou (voir ADR 0003) |
| Langue | Français, English |
| Dossier par défaut des nouveaux mondes | Chemin |

Ces réglages sont stockés dans le dossier de config de l'app, pas dans un monde.

## Médiathèque

C'est la galerie de tous les fichiers importés dans le monde (images et, plus tard, sons). Elle permet d'importer par glisser-déposer ou collage, de renommer, de filtrer par type et de supprimer. Un fichier encore utilisé demande une confirmation avant d'être supprimé, et le message indique où il est utilisé. Tous les sélecteurs d'image de l'app (carte, map, canvas…) passent par la médiathèque.

## Radio

C'est un lecteur d'ambiance qui accompagne le travail. *Adaptation locale* : au lieu d'une bibliothèque en ligne, la radio lit les **pistes audio importées** par l'utilisateur, avec lecture/pause, piste suivante, volume et lecture en boucle ou aléatoire. La musique continue quand on change d'onglet.

## Retiré (voir `docs/contexte.md`)

Le plan, l'abonnement, les membres, le fil de nouveautés et le formulaire de suggestion ou de bug sont retirés.

## Critères d'acceptation globaux

- On peut créer deux mondes, passer de l'un à l'autre et retrouver l'état de chacun.
- Les réglages sont conservés entre deux lancements.
- Toute l'interface est traduite et fonctionne dans les deux thèmes.
