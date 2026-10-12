# 09 — Frise chronologique

**Milestone** : M11 · **Issue d'origine** : #114 · **Roadmap** : `docs/roadmap/M11-frise.md` · **Décision** : ADR 0011

## Objectif

Raconter l'histoire du monde dans le temps : ses ères, ses guerres, les vies de ses personnages, les règnes de ses maisons. La frise montre **quand** les choses arrivent et **combien de temps** elles durent. Elle reste reliée aux cartes, comme la map, le graph et les arbres.

vvd n'en documente pas le fonctionnement et le board FigJam ne la contient pas. La frise est donc conçue d'après les outils de référence du worldbuilding (World Anvil, LegendKeeper, Aeon Timeline) : calendrier propre au monde, ères, pistes parallèles, événements ponctuels et périodes, zoom.

## Calendrier du monde

Chaque monde a **son calendrier**, réglé dans les réglages du monde :

- des **ères**, chacune avec un nom, une abréviation et une année de départ. Exemple : « Avant la Conquête » (AC), puis « Après la Conquête » (DC), qui commence en l'an 0 ;
- des **mois** : un nom et un nombre de jours chacun. Par défaut, douze mois de 30 jours (« Mois 1 » à « Mois 12 ») ;
- le format affiché, par exemple « 298 DC », « 3e mois 298 DC » ou « 12 du 3e mois 298 DC ».

Une **date** est une année, avec un mois et un jour facultatifs. Une date sans mois couvre toute l'année. L'année est comptée dans l'ère où elle tombe.

## Une frise

- Une frise est un **document de World**, au même titre qu'une map ou un graph : elle est dans la sidebar, dans la corbeille, dans la recherche et dans les épingles. Un monde peut en avoir plusieurs (« Histoire de Westeros », « La vie de Jon »).
- Elle est faite de **pistes** horizontales nommées et colorées, qu'on réordonne. Par exemple une par maison, une pour les guerres, une pour les règnes.
- Sur les pistes se placent des **éléments** :
  - un **événement** à une date (un repère) ;
  - une **période** entre deux dates (une barre).
- Un élément a un titre, une couleur et une description courte, et peut **représenter une carte**. Il prend alors le nom et l'image de la carte, et la carte affiche la frise dans « Cité dans ».
- Les **ères** apparaissent en bandes de fond derrière les pistes.

## Navigation

- Défilement horizontal à la molette ou au glisser. Le zoom (Ctrl + molette, `+` / `-`) passe des siècles aux années, puis aux mois et aux jours. La graduation s'adapte au zoom.
- « Tout voir » cadre toute la frise. « Aller à une date » centre la vue sur une date.
- Au clavier : flèches pour se déplacer, Tab pour passer d'un élément à l'autre, Entrée pour ouvrir un élément.

## Édition

- « Ajouter un événement » ou « Ajouter une période » sur une piste (bouton, ou double-clic à l'endroit voulu).
- On déplace un élément en le tirant, et on étire une période par ses bords. La date se cale sur l'unité visible : année, mois ou jour.
- Un panneau d'élément permet de modifier le titre, les dates (saisies dans le calendrier du monde), la piste, la couleur, la description et la carte représentée, ou de supprimer l'élément.
- « Ajouter des cartes » place des cartes choisies sur une piste, à la date indiquée.
- Annuler et rétablir.

## Wiki

Une frise marquée visible apparaît dans le wiki en lecture : pistes, ères et éléments, chaque élément ouvrant la page de sa carte.

**Réalisé en M11 (11.1)** : le socle de données, sans interface pour l'instant (migration 0020, ADR 0011).
- Le monde a un **calendrier** dans `world.json` (ères et mois). Il est lu avec tolérance : un calendrier illisible devient celui par défaut, douze mois de 30 jours sans ère.
- Une **frise** est un document de type `timeline`. Elle naît avec une piste.
- **Pistes** : on les ajoute, renomme, colore (palette des types de cartes), réordonne et supprime. Une frise en garde toujours une.
- **Éléments** : un événement, ou une période qui ne peut pas finir avant de commencer. Leurs dates sont des jours depuis l'an 0, avec leur précision. Un élément reste sur sa frise.
- Un élément qui représente une carte la fait citer par la frise (lien `timeline`). Supprimer la frise retire ses pistes, ses éléments et ses liens.
- La table `documents` a été reconstruite pour accepter ce nouveau type, sans perte et en gardant ses liens et ses déclencheurs de recherche (vérifié sur une copie d'un vrai monde).

**Réalisé en M11 (11.2)** : le calendrier se règle dans *Réglages du monde › Calendrier*.
- **Modèles** : douze mois de 30 jours, ou le grégorien (mois nommés, sans années bissextiles).
- **Ères** : nom, abréviation et année de début. Une ère peut **compter à rebours** jusqu'à la suivante (« 2 AC » est l'an −2 quand « DC » débute en l'an 0). Deux ères ne débutent pas la même année. Sans ère, les années s'écrivent telles quelles.
- **Mois** : de 1 à 24, de 1 à 400 jours chacun. Un mois sans nom s'écrit « 3e mois ».
- Un **exemple** écrit en direct une date comme les frises l'écriront (« 12 du 3e mois 298 DC », « 12 Lune de feu 298 DC »). Le calendrier n'est enregistré que valide, par le bouton ; changer le calendrier ne déplace aucun élément, car les dates sont des jours.
- Le champ de date des frises (jour, mois, année comptée dans son ère, ère) est prêt pour l'édition (11.4).

## Critères d'acceptation

- Un calendrier à deux ères et douze mois nommés affiche « 12 du 3e mois 298 DC ».
- Une période de Robert (283–298 DC) et un événement (298 DC) liés à leurs cartes apparaissent sur deux pistes. La carte montre la frise dans « Cité dans ».
- Le zoom passe des siècles aux jours sans perdre le centre.
