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
- Chaque carte a un menu : Ouvrir, Afficher dans l'Explorateur, Retirer de la liste. Retirer demande une confirmation et ne touche jamais au dossier.
- Un monde introuvable, parce que son dossier a été déplacé ou supprimé, est signalé (« Introuvable ») au lieu d'échouer à l'ouverture. « Relocaliser » demande son nouveau dossier, qui doit contenir **le même monde** (même identifiant) ; il garde alors sa place dans la liste. Si le dossier choisi contient un autre monde, un message le dit (« Ce dossier contient un autre monde… ») et la liste ne change pas.

## Coque d'un monde ouvert

- **En haut à gauche** : le monde courant, avec la miniature de son image principale. Un clic ouvre les **réglages du monde** (voir plus bas), sur la section Général.
- **Fond** : celui du thème du monde (voir « Thème du monde »), flouté et assombri (ADR 0003). Par défaut, c'est l'image principale du monde ouvert ; sans image, le dégradé par défaut. Une image introuvable donne aussi le dégradé. Sur la liste des mondes, le fond est la vignette du dernier monde ouvert. Changer l'image principale met aussi à jour la vignette du monde dans la liste.
- **En haut au centre** : les onglets **Home**, **World**, **Wiki** et **Quill**. Une page rattachée à un onglet sans en être l'accueil (la médiathèque, sous Home) laisse cet onglet en surbrillance, et un clic dessus ramène à son accueil ; un clic sur l'onglet d'une page qui lui appartient déjà (une carte ouverte dans World) ne change rien.
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

**État en M5** : l'aperçu du graph est là : toutes les cartes et leurs liens, avec la loupe et les filtres du graph (rien n'y est enregistré) ; un clic fait ressortir une carte et ses voisins, un double-clic l'ouvre. Tant qu'aucune carte n'est reliée, un texte dit comment les relier (mentions @, propriétés de type lien).

**État en M2** : sous le titre, « Reprendre là où vous en étiez » propose la dernière carte ouverte, puis « ou essayer quelque chose de nouveau » avec un bouton « Nouvelle carte » (sans carte ouverte : « Commencez par créer votre première carte »). Les documents récents (8 au plus, hors corbeille) s'affichent en vignettes : image de la carte ou icône de son type, nom et date relative (« il y a 38 min »). Le résumé du monde indique le nombre de cartes et leur répartition par type (les sous-types comptent pour leur type ; les types sans carte sont omis).

**État en M1** : le titre est « Bienvenue dans <nom du monde> », avec l'image principale en miniature. Les documents récents et l'aperçu du graph affichent un état vide qui dit avec quel milestone ils arrivent (M2 et M5). Le bloc « Le monde » résume le genre, le nombre de fichiers de la médiathèque et la description ; sans description, un lien « Ajouter une description… » ouvre les réglages du monde. Dans le bloc Gérer, **Médiathèque** ouvre la médiathèque et **Réglages du monde** ouvre les réglages du monde (comme le bouton en haut à gauche). **Types** (M2) et **Thème** (2.17) étaient alors signalés « Bientôt disponible » ; **Thème** ouvre maintenant les réglages du monde sur la section Thème.

### Réglages du monde

Écran en sections, d'après les captures de vvd (27/09/2026), ouvert par le bouton du monde en haut à gauche et par Home › Gérer › Réglages du monde. Une barre de sections à gauche (flèches haut et bas au clavier), le contenu de la section à droite.

- **Général** : image principale (via le sélecteur d'image, ou « Retirer »), nom, genre, description, et le dossier du monde avec « Ouvrir le dossier » (Explorateur Windows). Tout est enregistré à la volée, sans bouton : le texte une demi-seconde après la dernière frappe, et aussitôt quand on change de section ou qu'on ferme l'écran. Un nom vide n'est jamais enregistré (l'ancien nom est conservé). Le nom se met à jour aussitôt dans la barre du haut et dans la liste des mondes.
- **Types** : nombre de types et « Gérer les types », qui ouvre l'écran des types (voir `01-cartes-et-types.md`).
- **Médias** : nombre de fichiers et « Ouvrir la médiathèque ». Depuis M3 (3.12), la **place sur le disque** : médias, base de données, sauvegardes avant mise à jour, total du monde et place libre sur son disque. « **Limiter la place de ce monde** » (désactivé par défaut) fixe une limite en Mo ou Go (10 Mo au minimum, enregistrée dans `world.json`) avec une barre d'occupation : à 90 % un message prévient, à 100 % les **nouveaux imports sont refusés** (bouton, glisser-déposer, collage, image piochée dans la bibliothèque) avec un message clair ; écrire, modifier et ouvrir restent possibles. Sous 500 Mo libres sur le disque, un avertissement s'affiche, limite ou non.
- **Thème** : voir « Thème du monde ».
- **Préférences** : les préférences d'écriture du monde, chacune avec un interrupteur et son explication : **Détection d'entités**, **Liens automatiques des mentions** et **Animer les nouveaux liens** (voir `01-cartes-et-types.md`, « Noms de cartes dans le texte »). Toutes sont activées par défaut, s'appliquent aussitôt et sont retrouvées après relance. La section se termine par la **zone dangereuse**. « Supprimer le monde » demande de taper le nom du monde (les espaces autour sont ignorés, pas la casse). Le monde est fermé, son dossier part dans la **corbeille de Windows** (on peut l'y restaurer, puis l'ouvrir avec « Ouvrir un monde »), il quitte la liste des mondes et l'app revient à cette liste. Si le dossier ne peut pas être déplacé (fichier ouvert ailleurs…), un message le dit et le monde reste ouvert, intact.

Collaboration et Site & domaine, présents chez vvd, sont retirés (voir `docs/contexte.md`). Importer et Exporter arriveront avec leurs modules.

### Thème du monde

Entrée **Thème** du bloc Gérer, et section Thème des réglages du monde. Le thème du monde est une ambiance visuelle propre au monde : l'image de fond et la couleur d'accent de toute l'app tant que le monde est ouvert. Il sera réutilisé par Quill (« garder le thème du monde » dans l'onglet Style, voir `08-quill.md`). Décidé avec Clément le 27/09/2026 d'après les captures de vvd.

- **Explorer** : une galerie de thèmes en cartes (illustration, nom, pastille de la couleur d'accent). « Par défaut » garde l'image principale et l'ocre ; les huit autres (Aube dorée, Forêt ancienne, Haute mer, Braises, Nuit étoilée, Cimes glacées, Dunes, Cerisiers) ont chacun une illustration dessinée pour BuilderZ, jamais reprise de vvd (ADR 0003). Au clavier, les flèches passent d'un thème à l'autre.
- **Modifier** : le thème propre au monde. L'image de fond est choisie dans la médiathèque (par défaut, l'image principale ; « Reprendre l'image principale » revient à ce défaut) ; la couleur d'accent est prise parmi dix couleurs proposées ou choisie librement. Le thème personnalisé part de l'accent affiché, et remplace le thème choisi dans Explorer.
- Tout choix s'applique **aussitôt** et est enregistré (une couleur libre, pendant qu'on la fait glisser, s'affiche aussitôt et s'enregistre quand elle se stabilise). Le thème est retrouvé après relance.
- L'accent reste lisible dans les deux modes : chaque mode en reçoit une variante, assombrie en mode clair ou éclaircie en mode sombre juste assez pour un contraste de 3:1 avec le fond, et le texte posé sur l'accent est clair ou foncé selon ce qui se lit le mieux.
- Une image utilisée comme fond du thème apparaît dans les usages de la médiathèque (« fond du thème du monde ») ; si elle est supprimée, le thème reprend l'image principale.
- Le mode clair ou sombre reste un réglage de l'app, pas du thème.

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

**Bibliothèque BuilderZ (M3, 3.13, ADR 0006)** : une section des réglages montre les images partagées entre les mondes, avec leur nombre et leur taille totale. « Importer » y ajoute des images du PC ; chaque vignette se **renomme** et se **retire** de la bibliothèque (confirmé : les mondes qui l'utilisent gardent leur copie). La bibliothèque vit dans le dossier de configuration de l'app, hors de tout monde. La place libre sur son disque est indiquée (3.12) ; la bibliothèque n'a pas de limite.

## Médiathèque

C'est la galerie de tous les fichiers importés dans le monde (images, sons et autres fichiers), en grille de vignettes avec le nom, le type et la taille. On y accède depuis l'onglet Home (bloc « Gérer »). On importe avec le bouton « Importer » (plusieurs fichiers à la fois), en glissant des fichiers sur la fenêtre, ou en collant une image (`Ctrl+V`, hors champ de saisie ; elle est nommée « Image collée » suivi de la date). On filtre par type (Tout, Images, Sons, Autres) et on recherche par nom. Chaque vignette a un bouton « … » et un menu au clic droit avec **Renommer** et **Supprimer** ; quand le bouton « … » a le focus, `F2` renomme et `Suppr` supprime. Renommer ne change que le nom affiché : le fichier garde son nom sur le disque. La suppression est toujours confirmée, et si le fichier est encore utilisé (par exemple comme image principale du monde), la confirmation indique où avant de proposer « Supprimer quand même ». Tous les sélecteurs d'image de l'app (carte, map, canvas…) passent par la médiathèque.

**Bibliothèque BuilderZ (M3, 3.13)** : le menu d'une image propose aussi « **Ajouter à la bibliothèque** » : elle est copiée, avec son nom, dans la bibliothèque partagée entre les mondes (un message le confirme, ou dit qu'elle y était déjà). Les sons et autres fichiers ne vont pas dans la bibliothèque.

**Place (M3, 3.12)** : le filtre « **Non utilisés** » montre les fichiers utilisés nulle part (ni image ou fond du monde, ni image ou bloc d'une carte, corbeille comprise), pour libérer de la place. Les avertissements de place (limite proche ou atteinte, disque presque plein) s'affichent aussi en haut de la médiathèque.

### Sélecteur d'image

C'est une fenêtre commune à tous les endroits où l'on choisit une image (image principale du monde, puis cartes, maps et canvas). Elle affiche les images de la médiathèque en grille, avec une recherche par nom. On sélectionne d'un clic, puis on valide avec « Choisir » ; un double-clic valide directement. Au clavier, les flèches parcourent la grille, `Début` et `Fin` vont à la première et à la dernière image, et `Entrée` valide. Le bouton « Importer une image » ouvre l'explorateur de fichiers : l'image importée entre dans la médiathèque et est choisie aussitôt. L'image actuelle est présélectionnée à l'ouverture.

Deux onglets (M3, 3.13) : **Ce monde** (la médiathèque du monde, par défaut) et **Bibliothèque BuilderZ** (les images partagées entre les mondes). Choisir une image de la bibliothèque la **copie dans le monde** (sans doublon si elle y est déjà), puis le monde l'utilise comme ses autres médias. Le sélecteur peut aussi servir à choisir **plusieurs images** (galerie d'un bloc image, 3.10) : on coche au clic ou avec Espace, puis « Ajouter N images ».

## Radio

C'est un lecteur d'ambiance qui accompagne le travail. *Adaptation locale* : au lieu d'une bibliothèque en ligne, la radio lit les **pistes audio importées** par l'utilisateur, avec lecture/pause, piste suivante, volume et lecture en boucle ou aléatoire. La musique continue quand on change d'onglet.

Le bouton Radio, en haut à droite, ouvre un petit panneau : la piste en cours, les boutons piste précédente, lecture/pause et piste suivante, le volume, le mode de lecture et la liste des pistes (un clic lance une piste). « Précédente » revient au début de la piste si elle joue depuis plus de trois secondes. Les trois modes sont **En boucle** (les pistes dans l'ordre, puis on recommence), **Répéter la piste** et **Aléatoire** (jamais deux fois la même piste de suite). Le volume et le mode sont des réglages de l'application : ils sont retrouvés au prochain lancement. La musique continue quand on change d'onglet ou d'écran (médiathèque comprise) et s'arrête quand on ferme le monde. Une piste supprimée de la médiathèque pendant qu'elle joue est arrêtée. Sans aucun son dans la médiathèque, le panneau invite à en importer.

## Retiré (voir `docs/contexte.md`)

Le plan, l'abonnement, les membres, le fil de nouveautés et le formulaire de suggestion ou de bug sont retirés.

## Critères d'acceptation globaux

- On peut créer deux mondes, passer de l'un à l'autre et retrouver l'état de chacun.
- Les réglages sont conservés entre deux lancements.
- Toute l'interface est traduite et fonctionne dans les deux thèmes.
