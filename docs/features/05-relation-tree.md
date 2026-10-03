# 05 — Relation Tree (arbres de relations)

**Milestone** : M6 · **Figma** : node `11:726`

## Objectif

Visualiser des arbres généalogiques ou des relations complexes entre personnages, entièrement personnalisables et capables d'évoluer au fil de l'histoire grâce aux variantes.

Contrairement au Graph, qui se construit tout seul, l'arbre est **construit à la main**.

## Démarrer un arbre

Un nouvel arbre s'ouvre avec un **nœud vide**. En cliquant dessus, on choisit :

- une **carte existante** : le nœud affiche alors son image et son nom ;
- ou un **simple nom** : le nœud n'est lié à aucune carte.

## Ajouter des relations

- Des icônes « + » entourent le nœud sélectionné et indiquent où créer une connexion.
- Un clic sur un « + » ouvre la liste des relations :
  - les relations familiales (parent, enfant, frère/sœur…) ;
  - les relations de couple (partenaire, époux·se) ;
  - « Passer pour l'instant », qui crée un lien sans type ;
  - « Relation personnalisée », avec un nom et une icône.
- Choisir une relation crée un nouveau nœud vide, déjà relié au premier, qu'on remplit ensuite.
- Au survol d'une connexion, une infobulle indique la relation.
- Le bouton « Ajouter un nœud » crée un nœud isolé.

## Relier des nœuds existants

- On tire une ligne depuis le point d'accroche d'un nœud. Elle **s'aimante** aux points des autres nœuds, et il suffit de relâcher pour la connecter.
- On peut rebrancher une connexion en faisant glisser l'une de ses extrémités vers un autre nœud.
- Un clic sur une connexion ouvre son panneau : type de relation et **style de trait** (plein, tirets ou pointillés).

## Jonctions

On peut tirer une connexion **depuis une autre connexion**, et pas seulement depuis un nœud. Cela crée une jonction : par exemple, un enfant rattaché au lien entre ses deux parents.

## Annotations

On peut ajouter du **dessin à main levée** et des **textes libres** par-dessus l'arbre, pour des labels ou des remarques.

## Variantes

- Le bouton « Ajouter une variante » crée une copie nommée de l'arbre courant, par exemple « Tome 1 » ou « Après la guerre ».
- On passe d'une variante à l'autre par des onglets pour comparer, et chaque variante s'édite indépendamment.
- On peut renommer, dupliquer et supprimer une variante. La dernière ne peut pas être supprimée.

## Types de relations

Les types de relations personnalisés (nom, icône, et relation inverse éventuelle, comme parent ↔ enfant) sont définis **au niveau du monde**, pour être réutilisés dans tous les arbres.

**Réalisé en M6 (6.1)** : le socle de données, sans interface pour l'instant (migration 0012). Un arbre est un document avec des variantes ordonnées ; chacune garde ses nœuds (une carte, un simple nom ou vide, avec leur position), ses liens (depuis un nœud ou depuis un autre lien — jonction —, vers un nœud, avec un type de relation éventuel et un style de trait) et ses annotations (tracés à main levée et textes). Le contenu d'une variante est enregistré en une fois et vérifié par le Rust (liens dans la variante, pas de boucle ni de cycle de jonctions, types connus, tailles bornées). Une variante se crée par copie d'une autre, se renomme, se réordonne et se supprime (pas la dernière). Les types de relations sont ceux du monde : les cinq fournis (parent ↔ enfant, frère / sœur, partenaire, époux·se, traduits par le front) et ceux qu'on crée (nom, icône, catégorie, inverse gardé dans les deux sens) ; supprimer un type rend ses liens « sans type ». L'arbre suit la corbeille, la duplication et la suppression des documents.

**Réalisé en M6 (6.2)** : on crée un arbre depuis le menu « Nouveau document » de la sidebar, son clic droit ou la tuile « Arbre de relations » de l'espace vide ; il s'ouvre (route `tree/$treeId` de l'onglet Monde) avec un personnage vide « Nouveau personnage ». Il a son icône dans la sidebar, son filtre « Arbres de relations », se renomme, se duplique, va à la corbeille et en revient. La vue (React Flow, ADR 0001) zoome à la molette, se déplace en glissant le fond et, une fois focalisée, au clavier (flèches, + et -) ; « Recentrer » cadre tous les nœuds. Un nœud montre l'image de sa carte (ou l'icône de son type) et son nom, un simple nom, ou reste vide ; on le place en le glissant, et sa position s'enregistre toute seule. Pour l'instant, seule la première variante s'affiche.

**Réalisé en M6 (6.3)** : comme sur le board, les outils flottent en bas de la vue (« Ajouter un nœud », « Recentrer ») et un nœud montre l'image de sa carte (ou l'icône de son type) avec son nom dans une pastille posée sur le bord bas. Un clic sur un nœud vide ouvre la recherche : une carte (par nom ou alias) ou, en dernière option, « Utiliser le nom « … » » pour un simple nom. Le nœud sélectionné a sa barre : « Choisir une carte ou un nom » / « Remplacer », « Ouvrir la carte » (aussi au double-clic) et la corbeille, qui supprime le nœud avec ses liens et les jonctions qui en partent. « Ajouter un nœud » pose un nœud vide au centre de la vue, à côté des autres, et ouvre sa recherche. Au clavier : Tab jusqu'à un nœud, Entrée ouvre sa recherche, Suppr le supprime ; à la fermeture de la recherche, le focus revient sur le nœud. Un nœud dont la carte est à la corbeille ou supprimée affiche « Carte introuvable » et se remplace.

**Réalisé en M6 (6.4)** : le nœud sélectionné a un « + » de chaque côté (celui du haut entre le nœud et sa barre, comme sur le board). Un « + » ouvre la liste des relations, en deux colonnes : famille (parent, enfant, frère / sœur, demi-frère / demi-sœur, enfant adopté·e, parent adoptif, beau-parent, bel-enfant), couple (partenaire, époux·se, ex), les relations du monde, « Relation personnalisée… » (un nom et une icône ; elle rejoint les relations du monde) et « Passer pour l'instant » (lien sans type). Le choix pose un nœud vide de ce côté-là, déjà relié, sélectionné et sa recherche ouverte ; s'il y a déjà quelqu'un, il glisse le long de la rangée (deux parents côte à côte). Au clavier, le bouton « Ajouter une relation » de la barre ouvre la même liste : les parents vont au-dessus, les enfants en dessous, le reste à droite. Les liens sont tracés à angles droits entre les côtés qui se font face ; au survol (ou une fois sélectionné), un lien affiche sa relation dans son sens : « Gilraen : parent de Aragorn ».

**Sens d'un lien** : un lien va de la source vers la cible ; son type dit ce qu'est la cible pour la source (Aragorn → Gilraen, « parent » : Gilraen est le parent d'Aragorn). Les types fournis (migration 0013) suivent la liste du board, avec époux·se en plus ; chacun a son inverse (parent ↔ enfant, enfant adopté·e ↔ parent adoptif, beau-parent ↔ bel-enfant) ou est symétrique.

**Réalisé en M6 (6.5)** : chaque nœud a un point d'accroche par côté, visible au survol et sur le nœud sélectionné. On tire une ligne depuis l'un d'eux ; elle s'aimante au point le plus proche d'un autre nœud (jusqu'à une trentaine de pixels) et, une fois relâchée, crée un lien sans type dont la liste des relations s'ouvre aussitôt. Un clic sur un lien le sélectionne : ses deux extrémités deviennent des poignées qu'on glisse vers un autre nœud pour le rebrancher, et sa barre (comme sur le board) donne sa relation (à changer), « Inverser le sens du lien », le style du trait (plein, tirets, pointillés) et « Supprimer le lien » (avec les jonctions qui en partent). La barre se place au-dessus du milieu du lien, sinon en dessous ou à droite, pour ne jamais cacher ses extrémités. Au clavier : Tab jusqu'à un lien, Entrée le sélectionne (sa barre apparaît), Suppr le supprime.

**Réalisé en M6 (6.6)** : le milieu d'un lien est un point de jonction, visible au survol du lien (ou du point), quand le lien est sélectionné, pendant qu'on tire une ligne, et en permanence dès qu'une jonction en part. On tire une ligne depuis ce point vers un nœud (ou d'un nœud vers ce point) : le lien part alors du lien, par exemple un enfant rattaché au lien entre ses deux parents, puis on choisit sa relation. Au clavier, la barre du lien a « Rattacher un nœud à ce lien », qui pose un nœud vide sous le lien (sur la rangée de ses autres enfants s'il en a) avec la relation choisie. La jonction suit le lien quand ses nœuds bougent ; son infobulle nomme le couple (« Eldarion : enfant de Aragorn et Arwen ») ; on ne rattache pas à un lien l'un de ses propres bouts ; supprimer le lien supprime ses jonctions. Une jonction garde son départ : seule son autre extrémité se rebranche.

**Réalisé en M6 (6.7)** : la barre du bas a, comme sur le board, les outils Sélection, Main (elle déplace la vue sans rien bouger d'autre), Dessin et Texte ; Échap revient à la sélection. En Dessin, une barre au-dessus offre le crayon et la gomme, quatre épaisseurs et une palette (couleur du texte, gris et les couleurs des types, qui suivent le thème) ; on trace à main levée n'importe où, même par-dessus les nœuds, et la molette zoome toujours. En Texte, une barre offre trois tailles et la palette ; un clic pose un texte qu'on écrit aussitôt (Entrée ou un clic ailleurs le garde, vide il disparaît). Avec la sélection, un clic (ou Tab) sélectionne un dessin ou un texte : on le déplace en le glissant (ou aux flèches), on change sa couleur et sa taille dans la barre du haut, Suppr ou la corbeille le supprime ; un double clic (ou Entrée) modifie un texte. La gomme supprime d'un clic. Les annotations suivent le zoom et le déplacement de l'arbre et s'enregistrent avec la variante.

**Réalisé en M6 (6.8)** : « Ajouter une variante », dans la barre du bas, demande un nom (« Variante 2 » proposé) et crée une copie de la variante affichée, ouverte aussitôt (ce qui attendait d'être enregistré l'est avant la copie). Dès qu'il y a deux variantes, leurs onglets apparaissent au-dessus de la barre, comme sur le board : un clic (ou les flèches, Début, Fin) passe de l'une à l'autre sans bouger la vue, pour comparer ; un double clic renomme ; « + » en ajoute une. La variante affichée a un menu : Renommer, Dupliquer (« … (copie) »), Déplacer à gauche ou à droite, Supprimer la variante (après confirmation ; pas la dernière). On réordonne aussi les onglets en les glissant. Chaque variante s'édite et s'enregistre seule.

**Réalisé en M6 (6.9)** : « Relation personnalisée… » et la fenêtre « Gérer les relations… » (au bas de chaque liste des relations) décrivent une relation du monde : nom, icône, catégorie (famille, couple ou autre : la section où elle apparaît dans la liste) et relation inverse (aucune, elle-même pour une relation symétrique, ou une autre relation du monde ; gardée dans les deux sens). Les relations fournies sont listées sans pouvoir changer, et ne peuvent pas servir d'inverse (leurs paires restent). Une relation créée dans un arbre est proposée dans tous les arbres du monde. La supprimer demande confirmation en disant combien de liens l'utilisent : ils deviennent « sans type » dans tous les arbres, celui ouvert compris.

**Réalisé en M6 (6.10)** : chaque modification est enregistrée après un court délai (la variante entière), en quittant l'arbre et avant la fermeture du monde ou de la fenêtre. Chaque variante a son historique (100 pas au plus, comme la map) : Ctrl+Z annule, Ctrl+Y ou Ctrl+Maj+Z rétablit, et les boutons Annuler / Rétablir de la barre du bas font de même ; les champs de texte gardent leur propre annulation. Un texte posé ne compte qu'une fois écrit (rien de vide n'est enregistré), et des déplacements au clavier rapprochés ne font qu'un pas. Supprimer une relation du monde l'efface aussi de l'historique. L'historique repart de zéro à l'ouverture de l'arbre.

## Modèle de données (indicatif)

- `relation_types` : id, name, icon, inverse_id, category (famille / couple / autre / custom)
- `trees` : document_id
- `tree_variants` : id, tree_id, name, sort_order
- `tree_nodes` : id, variant_id, card_id (nullable), label, x, y
- `tree_edges` : id, variant_id, source (nœud ou arête), target_node_id, relation_type_id, line_style
- `tree_annotations` : id, variant_id, kind (dessin / texte), data (JSON)

## Critères d'acceptation

- On construit une famille de trois générations en n'utilisant que les « + ».
- On crée une jonction entre un couple et un enfant.
- Modifier une variante ne modifie pas les autres.

**Réalisé en M7.5 (7.5.2)** : un arbre cite les cartes qu'il montre, comme une map cite ses pins (ADR 0007, lien `tree`, migration 0015) : « Cité dans » d'une carte liste les arbres où elle figure, dans n'importe quelle variante, avec leur icône ; un clic ouvre l'arbre. Les liens sont réécrits à chaque enregistrement de l'arbre, d'une variante ajoutée ou supprimée ; un arbre à la corbeille n'apparaît plus. Les arbres déjà dessinés citent leurs cartes dès la mise à jour. Depuis 7.5.1, ses relations entre cartes relient aussi ces cartes dans le Graph.
