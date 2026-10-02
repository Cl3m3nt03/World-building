# 03 — Map (cartes géographiques interactives)

**Milestone** : M4 · **Figma** : node `5:255`

## Objectif

Transformer une illustration de carte du monde en espace interactif : des pins reliés aux cartes, des régions, des calques et des textes.

## Créer une map

On crée une map depuis l'espace World, comme les autres documents, en important une image de fond (via la médiathèque). La map s'ouvre alors en édition. Son nom se modifie en haut à gauche et elle apparaît dans la sidebar.

*Adaptation locale* : vvd propose une bibliothèque de templates de maps. Ici, on importe ses propres images uniquement. Une bibliothèque de fonds pourra être ajoutée plus tard, à partir d'images libres de droits.

## Navigation

- Zoom à la molette ou au pavé tactile, déplacement par glisser ou au bouton du milieu de la souris.
- Bouton « recentrer » pour revenir à la vue d'ensemble.
- Les très grandes images (plus de 8 000 px de côté) sont découpées en tuiles par le Rust à l'import, pour rester fluides.

## Pins

- **Pin lié à une carte** : on glisse une carte depuis la sidebar sur la map. Le pin affiche l'image ou l'icône de la carte. Un clic affiche un aperçu, un double-clic ouvre la carte.
- **Pin vide** : un clic droit sur la map propose « Ajouter un pin ». Ce pin ne correspond à aucune carte : il sert de repère visuel et a une icône, une couleur et un libellé.
- Le clic droit propose aussi « Ajouter une carte ici » pour choisir une carte existante.
- Un pin se déplace par glisser-déposer. Il a une taille réglable et appartient à un calque.

## Zones et régions

**Tracer une zone :**

1. On active l'outil Zone.
2. Chaque clic pose un sommet. Une ligne pointillée suit la souris pour montrer le prochain bord.
3. Au survol du **premier** sommet, celui-ci s'allume en vert, et cliquer dessus ferme la forme.
4. `Échap` annule le tracé en cours, `Retour arrière` retire le dernier sommet.

**Éditer une zone** (panneau de propriétés) :

- **Label** : texte, police, taille.
- **Carte liée** : la région entière pointe vers une carte.
- **Forme** : on déplace un sommet, on en ajoute un en cliquant sur un bord, on en supprime un par clic droit.
- **Apparence** : couleur, opacité et **motif de remplissage** (plein, hachures, points, croisillons).
- **Calque** d'appartenance.

## Calques

- Une liste de calques nommés, avec un **œil** pour masquer ou afficher chacun.
- Chaque pin, zone et texte appartient à un calque. Un calque par défaut est créé avec la map.
- On peut réordonner les calques, ce qui change l'ordre d'affichage.

## Textes

- On active l'outil Texte, puis on clique sur la map pour poser un texte.
- Réglages : police, taille, échelle (le texte suit ou non le zoom), **espacement des lettres**, **courbure en arc** (positive ou négative) et calque.

## Fond

Le bouton « Fond » remplace l'image de la map **sans rien perdre** de ce qui est posé dessus, ce qui permet de faire évoluer la géographie au fil de l'histoire. Les positions sont exprimées en coordonnées relatives à l'image, pour survivre à un changement de résolution.

## Sauvegarde

La map est **sauvegardée automatiquement** : chaque modification est persistée après un court délai d'inactivité. `Ctrl+Z` et `Ctrl+Y` fonctionnent dans la map.

## Intégration

- Une map peut être intégrée comme bloc dans une carte (`01`) ou posée sur un canvas (`06`).
- Les pins liés à une carte créent des liens `map_pin`, visibles dans les rétroliens de la carte.

**Réalisé en M4 (4.1)** : le socle de données (tables ci-dessous, enregistrement du contenu en une fois, liens `map_pin` vers les cartes, fond remplaçable, duplication, corbeille), sans interface pour l'instant.

**Réalisé en M4 (4.2)** : « Nouvelle map » (bouton en bas de la sidebar, clic droit dans l'arbre, tuile « Map » de l'espace vide) ouvre le sélecteur d'image pour choisir le fond ; la map est créée (« Map sans nom », un calque « Calque 1 ») et s'ouvre. Elle apparaît dans l'arbre avec une icône de map, se filtre (« Map » dans Filtres et tri), se trouve par la recherche, s'épingle et figure dans les documents récents ; ses rétroliens et ses liens ouvrent la map. Le nom se modifie en haut à gauche. Navigation : molette ou pavé tactile pour zoomer, glisser (ou bouton du milieu) pour se déplacer, « Recentrer » pour revenir à la vue d'ensemble ; au clavier, la map prend le focus (Tab), les flèches la déplacent et `+` / `-` zooment. Si l'image de fond a été supprimée de la médiathèque, la map le dit.

**Réalisé en M4 (4.4)** : un panneau **Calques** à droite de la map, le calque du dessus en premier. « Nouveau calque » (+) l'ajoute au-dessus et le nomme aussitôt ; un clic choisit le **calque actif** (celui qui reçoit ce qu'on pose) ; l'œil masque ou affiche ; le menu « … » renomme (aussi double-clic ou `F2`), monte ou descend (aussi `Alt+↑` / `Alt+↓`) et supprime : un calque vide disparaît aussitôt, sinon on choisit de déplacer son contenu vers le calque voisin ou de tout supprimer ; le dernier calque ne se supprime pas. Tout s'enregistre seul, peu après la dernière modification et en quittant la map.

**Réalisé en M4 (4.5)** : **pins**. « Ajouter un pin » (barre du haut) pose un repère au centre de la vue ; « Ajouter une carte » cherche une carte (nom ou alias) et pose son pin au centre ; un clic droit sur la map propose « Ajouter un pin » et « Ajouter une carte ici… » au point cliqué ; glisser une carte de la sidebar sur la map y pose son pin. Le pin d'une carte montre son image (ou l'icône et la couleur de son type) et son nom ; un repère a son libellé, son icône et sa couleur. Un clic sélectionne le pin : ses propriétés s'affichent sous les calques (libellé, couleur, icône pour un repère ; « Ouvrir la carte » pour une carte ; taille, calque, « Supprimer le pin »). Le pin se déplace en le glissant ; au clavier (Tab jusqu'au pin), les flèches le déplacent (Maj pour aller plus vite), Entrée le sélectionne puis ouvre sa carte, Suppr le supprime. Un double-clic ouvre la carte. Les pins d'un calque masqué sont cachés. Les pins de cartes sont des liens `map_pin` : la map apparaît dans les rétroliens de la carte.

**Réalisé en M4 (4.6)** : **zones**. « Tracer une zone » active l'outil (le bouton reste enfoncé, un message rappelle les gestes) : chaque clic pose un sommet, une ligne pointillée suit la souris, le premier sommet s'allume en vert au survol dès 3 sommets et un clic dessus ferme la forme (`Entrée` aussi) ; `Retour arrière` retire le dernier sommet, `Échap` annule. La zone fermée est sélectionnée : son panneau donne le label (texte, police, taille), la carte liée (recherche, ouvrir, délier), la couleur, l'opacité, le motif (plein, hachures, points, croisillons, en SVG) et le calque, et « Supprimer la zone ». Sur la map, la zone sélectionnée montre ses sommets (à glisser ; clic droit pour en retirer un, 3 au minimum) et le milieu de chaque bord (un clic y ajoute un sommet). Le label s'affiche au centre de la zone. Les zones d'un calque masqué sont cachées ; une zone liée à une carte crée un lien `map_pin`. Le tracé se fait à la souris ; les propriétés sont accessibles au clavier.

**Réalisé en M4 (4.7)** : **textes**. « Ajouter un texte » attend un clic sur la map (`Échap` ou le bouton pour renoncer) et y pose « Texte », sélectionné, son champ prêt à être tapé. Son panneau règle le texte, la police, la taille, « Suit le zoom » (sinon il garde sa taille à l'écran), l'espacement des lettres, la courbure (de -100 % vers le bas à +100 % vers le haut, en SVG `textPath`) et le calque. Un texte se déplace en le glissant ou aux flèches (Maj pour aller plus vite), `Suppr` le supprime ; ceux d'un calque masqué sont cachés. Les textes sont sous les pins.

**Réalisé en M4 (4.8)** : le bouton « Fond » ouvre le sélecteur d'image (médiathèque du monde ou bibliothèque BuilderZ, l'image actuelle présélectionnée) ; la nouvelle image remplace le fond et la vue se recadre, pins, zones et textes gardent leur place relative.

**Réalisé en M4 (4.9)** : tout s'enregistre seul, peu après la dernière modification et en quittant la map (depuis 4.4). **Annuler** et **Rétablir** (boutons, `Ctrl+Z`, `Ctrl+Y` ou `Ctrl+Maj+Z`) parcourent les 100 dernières étapes ; des changements rapprochés (taper un libellé, glisser un curseur) font une seule étape ; dans un champ de texte, `Ctrl+Z` reste celui du champ. Une étape annulée ou rétablie est enregistrée comme les autres.

**Réalisé en M4 (4.10)** : le bloc **Map** d'une carte (menu des blocs ou « / ») choisit une map du monde, puis l'affiche en lecture : ses pins, zones et textes (calques visibles), déplacement en la glissant, zoom avec `+` / `-` (la molette fait défiler la carte), « Ouvrir la map » et « Changer ». Sans map dans le monde, le bloc dit comment en créer une.

## Modèle de données (indicatif)

- `maps` : document_id, background_asset_id, width, height, tiles_path
- `map_layers` : id, map_id, name, visible, sort_order
- `map_pins` : id, map_id, layer_id, card_id (nullable), x, y, icon, color, label, size
- `map_zones` : id, map_id, layer_id, points (JSON), label, label_style (JSON), card_id, fill_color, opacity, pattern
- `map_texts` : id, map_id, layer_id, x, y, text, style (JSON : font, size, spacing, arc, scale_with_zoom)

## Critères d'acceptation

- On trace un polygone de 10 sommets, on le ferme sur le premier point et on le lie à une carte.
- Masquer un calque cache tout son contenu.
- Remplacer le fond conserve les pins, les zones et les textes.
- La navigation reste fluide sur une image de 16 000 × 16 000 px.
