# 02 — Organisation (sidebar)

**Milestone** : M3 · **Figma** : node `4:197`

## Objectif

Retrouver instantanément n'importe quel document, même dans un monde qui en compte des milliers, et le ranger comme on veut.

## Structure de la sidebar

De haut en bas :

1. la **barre de recherche** et le bouton de filtres/tri ;
2. la section **Épinglés** ;
3. l'**arborescence** : dossiers et documents ;
4. les **boutons de création** en bas.

La sidebar peut être redimensionnée et repliée. Sa largeur et l'état ouvert/fermé des dossiers sont mémorisés pour chaque monde.


**Réalisé en M3 (3.1)** : le socle de données de l'arborescence existe (dossiers, parent / enfant, ordre manuel, place des épingles), sans interface pour l'instant. Choix validés par Clément le 01/10/2026 : dans la racine et dans un dossier, **dossiers et documents se mélangent librement** dans un même ordre ; mettre à la corbeille un document qui a des enfants **laisse ses enfants dans la sidebar**, à sa place. Un document restauré revient à son emplacement s'il existe encore, sinon à la racine. Les cartes d'un monde de la 0.3.0 sont à la racine, dans l'ordre de création.

**Réalisé en M3 (3.2)** : la sidebar affiche l'arborescence : dossiers, documents et leurs enfants, chacun avec son icône (pour une carte, l'icône et la couleur de son type), fermés au départ. Un clic sur un document l'ouvre ; un clic sur un dossier, ou sur le chevron d'un document qui a des enfants, l'ouvre ou le referme. Ouvrir un document, depuis la sidebar ou ailleurs, ouvre les dossiers et parents autour de lui et le fait défiler dans la vue ; il est mis en évidence. Au clavier, l'arbre est un seul arrêt de tabulation : flèches haut / bas pour se déplacer, droite pour ouvrir (puis aller au premier enfant), gauche pour refermer (puis remonter au parent), Début / Fin, Entrée ou Espace pour ouvrir. Seules les lignes visibles sont construites, ce qui garde la sidebar fluide avec des milliers de cartes. Les dossiers ouverts sont gardés pendant la session ; leur mémorisation par monde arrive en 3.9.

**Réalisé en M3 (3.3)** : on range à la souris en glissant une ligne (dossier ou document). Lâchée sur le **quart haut** d'une autre ligne, elle se place **avant** (trait au-dessus) ; sur le **quart bas**, **après** (trait en dessous) ; au **milieu**, **dedans** (ligne encadrée) : dans un dossier, ou sous un document dont elle devient l'enfant, à la fin. Un dépôt impossible est encadré en rouge et ne fait rien : un élément dans lui-même ou dans un de ses descendants, un dossier sous un document. Survoler un dossier ou un parent fermé pendant ~0,7 s l'ouvre ; après un dépôt « dedans », il s'ouvre pour que la ligne reste visible. Le déplacement s'affiche tout de suite et s'enregistre ; s'il est refusé, l'arbre revient tel qu'il était et l'erreur s'affiche en haut de la sidebar. Au clavier, le même rangement passera par « Déplacer vers… » du menu du document (3.6).

**Réalisé en M3 (3.4)** : on crée un dossier avec le bouton **Nouveau dossier** en bas de la sidebar (à la fin de la racine) ou par clic droit : dans le vide ou sur un document, « Nouveau dossier » (à la racine) ; sur un dossier, « Nouveau sous-dossier ». Le dossier apparaît avec son nom sélectionné, à taper aussitôt (Entrée ou quitter le champ pour garder, Échap pour annuler ; un nom vide garde l'ancien). Clic droit sur un dossier : **Renommer** (aussi `F2`), **Changer l'icône…** (icône dossier ou bibliothèque des types, enregistrée au clic) et **Supprimer le dossier…** (aussi `Suppr`). Un dossier vide se supprime après confirmation ; sinon on choisit **Remonter le contenu** (il prend sa place, dans le même ordre) ou **Mettre le contenu à la corbeille** (ses documents, avec le nombre indiqué, vont à la corbeille ; ses sous-dossiers sont supprimés). Le menu d'un dossier ne propose pas la création de carte ; celui d'un document le fait en attendant son propre menu (3.6).

**Réalisé en M3 (3.5)** : clic droit sur un document → **Épingler** (ou **Désépingler**). Les épinglés s'affichent en haut de la sidebar, section **Épinglés**, en vignettes avec l'image du document agrandie (à défaut, l'icône de son type) et son nom ; la section n'apparaît que s'il y a des épingles. Leur ordre se règle en glissant une vignette, ou au clavier (Espace pour saisir, flèches, Espace pour déposer) ; Entrée ouvre le document, son clic droit le désépingle. Un document épinglé **reste aussi à sa place dans l'arborescence** (l'épingle est un raccourci, pour ne pas défaire dossiers et hiérarchie ; choix à confirmer par Clément). Mis à la corbeille, il quitte les épingles ; restauré, il y revient à la même position.

**Réalisé en M3 (3.6)** : clic droit sur un document (ou `Maj+F10` / touche Menu sur sa ligne) : **Ouvrir** (Entrée), **Renommer** sur place (`F2`), **Épingler / Désépingler**, **Dupliquer** (une carte : « … (copie) », même type, image, alias, propriétés — celles propres à la carte sont recopiées —, valeurs, contenu et liens ; placée juste après l'original, non épinglée), **Déplacer vers…** (dialogue au clavier : on tape pour filtrer, flèches, Entrée ; la racine, chaque dossier et chaque document comme parent, sauf le document lui-même et ses descendants ; l'emplacement actuel est indiqué), **Visible dans le wiki** (grisé, arrive avec M8) et **Mettre à la corbeille** (`Suppr` ; si c'est la carte ouverte, l'espace de travail se vide). La création de carte passe dans un sous-menu « Nouvelle carte », suivi de « Nouveau dossier ».

**État en M2** : en attendant M3, la sidebar de l'onglet World est une liste simple des cartes du monde, par nom (icône et couleur de leur type). Un clic ouvre la carte, qui est mise en évidence. Un clic droit n'importe où ouvre le menu de création ; en bas, « Nouvelle carte » ouvre le même menu et l'icône **Corbeille** ouvre la corbeille du monde : chaque carte s'y restaure ou s'y supprime définitivement, et « Vider la corbeille » demande une confirmation qui indique le nombre de cartes.

## Recherche

- La recherche porte sur les noms, les alias et le texte des documents (FTS5).
- Les résultats s'affichent au fil de la frappe : correspondances de nom d'abord, puis correspondances dans le contenu avec un extrait.
- La navigation se fait au clavier : flèches, `Entrée` pour ouvrir, `Échap` pour fermer.
- Le raccourci global `Ctrl+K` ouvre la recherche depuis n'importe où.

## Filtres et tri

- **Filtres** par type de document (carte, map, graph, canvas, arbre) et par type ou sous-type de carte, cumulables.
- **Tri** : manuel (par défaut), alphabétique ou par date de création. On peut inverser l'ordre.
- Tant qu'un tri autre que manuel est actif, le glisser-déposer pour réordonner est désactivé, et un indicateur le signale.

## Ordre manuel

On réordonne les documents en les glissant vers le haut ou le bas. Cet ordre est enregistré.

## Épingles

Un clic droit sur un document permet de l'épingler ou de le désépingler. Les documents épinglés remontent dans la section Épinglés, avec une **image agrandie**. L'ordre des épingles se règle aussi par glisser-déposer.

## Dossiers

- On crée un dossier par clic droit ou avec un bouton.
- Un dossier a un nom et une **icône**, choisie parmi une bibliothèque d'icônes.
- Les dossiers peuvent être imbriqués.
- On range un document dans un dossier en le glissant dessus.
- Supprimer un dossier demande ce qu'il faut faire de son contenu : le remonter d'un niveau ou le mettre à la corbeille.

## Hiérarchie parent / enfant

Déposer un document **sur** un autre document fait du second le **parent** du premier. Le parent s'affiche alors avec un chevron pour déplier ses enfants. C'est une autre façon de ranger, indépendante des dossiers ; par exemple : Royaume › Ville › Taverne.

Pendant le glisser-déposer, un indicateur visuel distingue trois cas : *insérer avant*, *insérer après* et *devenir enfant de*. Les cycles sont interdits : un document ne peut pas devenir l'enfant de son propre descendant.

## Menu contextuel d'un document

Le clic droit sur un document propose : Ouvrir, Renommer, Épingler, Dupliquer, Déplacer vers…, Visible dans le wiki (case à cocher) et Supprimer.

## Critères d'acceptation

- La recherche trouve une carte par un de ses alias et par un mot de son contenu, en moins de 100 ms sur un monde de 5 000 cartes.
- L'ordre manuel, les épingles, les dossiers et la hiérarchie sont conservés après un redémarrage.
- Un glisser-déposer qui créerait un cycle est refusé.
