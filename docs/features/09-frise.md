# 09 — Frise chronologique

**Milestone** : M11 · **Issue d'origine** : #114 · **Roadmap** : `docs/roadmap/M11-frise.md` · **Décision** : ADR 0011

## Objectif

Raconter l'histoire du monde dans le temps : ses ères, ses guerres, les vies de ses personnages, les règnes de ses maisons. La frise montre **quand** les choses arrivent et **combien de temps** elles durent. Elle reste reliée aux cartes, comme la map, le graph et les arbres.

Le board FigJam ne la contient pas. La frise a d'abord été conçue d'après les outils de référence du worldbuilding (World Anvil, LegendKeeper, Aeon Timeline) : calendrier propre au monde, ères, pistes parallèles, événements ponctuels et périodes, zoom. Une capture de la « Chronologie » de vvd, envoyée par Clément, a ensuite fixé son apparence : un axe sur fond pointillé, des bulles au-dessus, une carte d'élément flottante, une barre d'outils en bas (11.5b).

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

**Réalisé en M11 (11.3)** : la frise s'ouvre et se parcourt.
- On la crée par *Nouveau document › Nouvelle frise* (sidebar, clic droit) ou par la tuile « Frise » d'un espace vide. Elle naît avec la piste « Événements ». Comme les autres documents, elle se renomme, s'épingle, se duplique (pistes et éléments copiés) et passe par la corbeille. Elle apparaît dans « Cité dans » des cartes qu'elle représente, et le filtre de la sidebar connaît le type « Frises ».
- **Vue** : la graduation suit le zoom, des millions d'années jusqu'aux jours, et s'écrit dans le calendrier du monde (« 298 AC », « 3e mois », « 12 »). Les ères sont des bandes de fond nommées dans la règle. Chaque piste a son nom et sa couleur à gauche. Les éléments qui se chevaucheraient, barre ou nom, passent sur une ligne en dessous.
- Un **événement** est un losange suivi de son nom. Une **période** est une barre de sa couleur, dont le nom reste visible quand son début sort de la vue. Un élément qui représente une carte prend son nom (s'il n'en a pas) et son image.
- **Navigation** : la molette fait défiler, Ctrl + molette zoome autour du pointeur, le glisser déplace la vue. Les boutons « Zoomer » et « Dézoomer », « Tout voir » (qui cadre tous les éléments) et « Aller à une date » (une date du calendrier du monde, la vue s'y centre et zoome assez pour en voir l'unité) complètent la barre.
- **Clavier** : flèches pour se déplacer (avec Maj, plus loin), `+` et `−` pour zoomer, `0` pour tout voir, Tab d'un élément à l'autre (un élément hors de vue vient au centre), Entrée pour l'ouvrir, Échap pour le refermer. Chaque élément a un nom complet (« Rébellion de Robert, de 282 AC à 283 AC »).
- **Ouvrir un élément** le sélectionne et ouvre son panneau (voir 11.4).

**Réalisé en M11 (11.4)** : la frise s'édite.
- **Ajouter** : le menu « Ajouter › Un événement / Une période » place l'élément au centre de la vue, sur la piste de l'élément sélectionné (ou la première), calé sur l'unité visible ; une période couvre trois unités. Un double-clic sur une piste y ajoute un événement. Le nouvel élément prend la couleur de sa piste et s'ouvre dans le panneau, pour être nommé.
- **Tirer** un élément le déplace, d'une piste à l'autre aussi ; tirer un bord d'une période l'étire, sans que sa fin passe avant son début. Le pas est l'unité visible, jamais plus fin que la précision de l'élément (un élément daté à l'année avance d'un an). Un élément déplacé de N années ou N mois garde son mois et son jour.
- **Au clavier**, sur un élément : Alt + flèche gauche ou droite le déplace d'une unité (avec Maj, étire sa fin), Alt + flèche haut ou bas le passe sur la piste voisine, Suppr le supprime.
- **Panneau d'élément** (à droite) : nom (vide, il prend celui de la carte), carte représentée (choisie dans la recherche de cartes, ouverte d'un clic, ou détachée en gardant son nom), date ou début et fin (« Période » ajoute une fin), piste, couleur, description, « Supprimer l'élément ». Chaque changement est enregistré aussitôt (nom et description quand on quitte le champ). Une fin avant le début est refusée avec un message.
- **Pistes** : un dialogue les renomme, les colore, les monte ou descend, en ajoute (couleur suivante de la palette, 50 au plus) et en supprime. Supprimer une piste qui porte des éléments demande une confirmation ; la dernière piste reste.
- **Annuler et rétablir** (boutons, Ctrl + Z, Ctrl + Y ou Ctrl + Maj + Z) : ajouts, déplacements, modifications et suppressions d'éléments, noms, couleurs et ordre des pistes. Ajouter ou supprimer une piste ne s'annule pas, et supprimer une piste efface l'historique, puisque ses éléments ont disparu.

**Réalisé en M11 (11.5)** : la frise et le monde.
- **« Ajouter › Des cartes… »** ouvre un dialogue : on coche des cartes (recherche sur les noms et alias ; celles déjà sur la frise sont signalées), on choisit une piste et une date du calendrier du monde, et « Placer N cartes » en fait des événements. Chacun prend le nom et l'image de sa carte et la couleur de la piste. L'ajout s'annule d'un seul Ctrl + Z.
- Un **double-clic** sur un élément qui représente une carte ouvre la carte. Le panneau d'élément l'ouvre aussi.
- **« Cité dans »** d'une carte placée sur une frise montre la frise ; le lien l'ouvre centrée sur l'élément de la carte, sélectionné.
- **Bloc « Frise »** dans une carte (menu « + » ou « / ») : on choisit une frise du monde, elle s'affiche en lecture, centrée sur l'élément de cette carte s'il existe. La molette fait défiler la carte, Ctrl + molette zoome. « Ouvrir la frise » l'ouvre centrée sur cette carte, « Changer » en choisit une autre. L'export HTML du wiki laisse ce bloc de côté jusqu'en 11.6.

**Réalisé en M11 (11.5b)** : la frise prend le visage de celle de vvd (capture envoyée par Clément).
- **Vue « Axe »**, par défaut : un axe horizontal sur un fond pointillé, graduation dessous. Chaque élément est un point sur l'axe, son nom une bulle au-dessus (avec l'image de l'élément ou de sa carte), reliée par un trait. Une période est un segment épais sur l'axe, dont les bouts l'étirent. Les bulles montent d'un cran quand elles se chevaucheraient, et l'axe descend pour leur laisser la place. Les ères sont des bandes nommées quand il y a la place.
- **Vue « Pistes »** : celle de 11.3, au choix dans la barre d'outils.
- **Barre d'outils flottante** en bas : « Ajouter » (un événement, une période, des cartes), filtre par étiquette, « Gérer les pistes », annuler, rétablir, choix Axe / Pistes. **Zoom** en bas à droite (zoomer, dézoomer, tout voir) ; l'aide des raccourcis derrière le « ? » en bas à gauche.
- **Carte d'élément flottante** : image (un clic la choisit dans la médiathèque), nom, œil (masquer l'élément dans le wiki), corbeille, date (un clic ouvre les champs de date et la bascule période), description, « Étiquettes » repliables, « Piste et couleur » repliable, et « Ajouter une carte » (ou la carte représentée, à ouvrir ou détacher).
- **Étiquettes** : libres, 20 par élément au plus (40 caractères), sans doublon ; le filtre estompe les éléments qui n'en portent aucune des choisies.
- Données (migration 0021) : `image_asset_id`, `tags` (liste JSON) et `hidden` sur les éléments. L'image d'un élément compte dans « Utilisée par » de la médiathèque.

**Réalisé en M11 (11.6)** : la frise dans le wiki.
- Une frise se rend **visible dans le wiki** par le bouton « Visible dans le wiki » de son en-tête ou le clic droit de la sidebar ; « Ouvrir dans le wiki » l'y ouvre. Elle apparaît dans le menu « Pages » du wiki, rubrique « Frises ».
- Sa **page** montre la frise en lecture (vue Axe : on la parcourt, on la zoome, un double-clic sur un élément ouvre la page de sa carte), puis la **chronologie** : chaque élément avec ses dates, son image, sa description et ses étiquettes ; son nom mène à la page de sa carte si elle en a une. Les éléments masqués par l'œil n'y sont pas.
- L'**export HTML** du wiki écrit une page par frise : la frise dessinée sans script (axe, ères, bulles placées en pourcentages, donc à toutes les largeurs) et la chronologie ; le bloc « Frise » des cartes y est dessiné aussi. Tout se lit sans réseau ; les images des éléments sont copiées avec le site.

**Après M11 (v1.3.x)** : une carte de la sidebar se **glisse directement sur la frise**. Pendant le glisser, un trait en pointillé et la date montrent où elle tombera (calée sur l'unité visible). Lâchée, elle devient un événement à cette date : sur la piste sous le pointeur en vue Pistes, sinon sur celle de l'élément sélectionné (ou la première). L'élément prend le nom, l'image de la carte et la couleur de la piste, et s'ouvre dans sa carte flottante ; Ctrl + Z l'annule.
Lâchée **sur un élément** (sa bulle, son segment ou sa barre, entouré pendant le glisser), la carte est liée à cet élément au lieu d'en créer un : il la représente et garde son nom s'il en avait un (M11+, #414).

**Âges (M11+, #415)** : une période qui représente une carte peut être marquée comme sa **vie** (« C'est la vie de … (naissance → mort) », dans les dates de l'élément ; migration 0022). La carte de tout autre élément liste alors, sous « Vivants à cette date », les cartes vivantes à sa date avec leur âge en années pleines dans le calendrier du monde (un anniversaire pas encore atteint compte un an de moins ; « moins d'un an » sinon), de la plus âgée à la plus jeune ; un clic sélectionne la vie. Une période sans carte, ou un règne non marqué, ne compte pas.

**Mini-carte (M11+, #416)** : une bande fine au-dessus de la barre d'outils montre toute la frise (ères, éléments à leur couleur) et, encadrée, la portion visible. Un clic ou un glisser y centre la vue sans changer le zoom. Au clavier, c'est un curseur (« Mini-carte de la frise ») : flèches pour se déplacer, Page haut / bas pour aller plus loin, Début / Fin pour le premier et le dernier élément ; la date du centre est annoncée.

**Lecture (M11+, #417)** : le bouton « Lecture : raconter la frise » de la barre d'outils raconte la frise élément par élément, dans l'ordre du temps (en partant de l'élément sélectionné, et en sautant ceux qu'estompe le filtre d'étiquettes). Chaque élément est centré et sa carte s'ouvre ; la lecture passe au suivant toutes les 5 secondes et s'arrête au dernier. La barre devient un lecteur : précédent, pause ou reprise (au bout, la reprise recommence au début), suivant, position (« 3 / 17 »), « Quitter ». Au clavier : flèches gauche et droite, Espace, Échap.

**Cause et effet (M11+, #418)** : dans la carte d'un élément, « Cause et effet » relie l'élément à un autre de la frise (« Relier à un élément » : les éléments avec leurs dates, deux pouvant porter le même nom). La section liste ce à quoi il **mène** et ce dont il **vient** ; un clic sélectionne l'autre élément, la croix retire la flèche. Les flèches se dessinent en courbe au-dessus des bulles (vue Axe) ou des éléments (vue Pistes) ; celles de l'élément sélectionné ressortent. Supprimer un élément retire ses flèches ; Ctrl + Z rend l'élément et ses flèches. Dans le wiki et son export, la chronologie indique « Mène à : … ».

## Critères d'acceptation

- Un calendrier à deux ères et douze mois nommés affiche « 12 du 3e mois 298 DC ».
- Une période de Robert (283–298 DC) et un événement (298 DC) liés à leurs cartes apparaissent sur deux pistes. La carte montre la frise dans « Cité dans ».
- Le zoom passe des siècles aux jours sans perdre le centre.
