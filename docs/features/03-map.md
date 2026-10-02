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
