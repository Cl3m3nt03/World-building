# 06 — Canvas (tableau blanc)

**Milestone** : M7 · **Figma** : node `9:579`

## Objectif

Offrir un espace visuel libre pour le brainstorming, les mood boards et le regroupement d'idées, dans lequel les éléments du monde restent interactifs.

## Base technique

Le canvas repose sur **Excalidraw** (licence MIT). Excalidraw fournit déjà le stylo, les formes, les flèches, les textes, les images, les cadres, le zoom et l'annuler/rétablir. Le travail consiste à y **intégrer les éléments BuilderZ** et à aligner le style sur notre design system. Voir ADR 0001.

## Éléments du monde sur le canvas

- On **glisse une carte** depuis la sidebar sur le canvas. Elle s'affiche comme une vignette avec son image, son nom et son type. Un double-clic ouvre la carte.
- On peut aussi insérer une **map**, un **graph** ou une **carte** par un sélecteur directement dans le canvas, sans passer par la sidebar. Maps et graphs s'affichent en aperçu, un double-clic les ouvre.
- Ces éléments restent **à jour** : si la carte est renommée, la vignette suit.

## Outils

| Outil | Comportement |
|---|---|
| **Stylo** | Dessin à main levée, pour annoter, entourer une carte à retravailler, relier deux idées par une flèche ou griffonner une note |
| **Notes** | Post-its qu'on glisse sur le canvas pour écrire dessus, avec un fond **quadrillé**, **ligné** ou **pointé** au choix |
| **Texte** | Zones de texte libres pour les titres, labels et remarques |
| **Formes** | Flèches, lignes, rectangles, ellipses, nuages, bulles ; couleur, trait et remplissage réglables |
| **Sections** | Des cadres nommés : tout ce qui se trouve à l'intérieur se déplace en bloc |
| **Images** | Depuis la médiathèque, par glisser-déposer depuis le PC ou par collage (`Ctrl+V`) |

Les formes « nuage » et « bulle » n'existent pas nativement dans Excalidraw et sont à ajouter.

## Navigation

On se déplace avec l'outil main, ou en maintenant le **bouton du milieu** de la souris. Le zoom se fait à la molette.

## Adaptation locale

La recherche d'images Google intégrée à vvd est remplacée par le glisser-déposer et le collage depuis le PC. Les images collées sont importées dans la médiathèque du monde.

## Sauvegarde

Le canvas est sauvegardé automatiquement. La scène Excalidraw est stockée en JSON dans la base, et les images sont des assets du monde, jamais des données base64 dans le JSON.

**Réalisé en M7 (7.1)** : le socle de données, sans interface pour l'instant (migration 0014). Un canvas est un document qui garde sa scène Excalidraw (`{ "elements": [...] }`) et l'état gardé (cadrage, grille…), en JSON. Le Rust refuse une scène qui n'est pas du JSON, trop grande (8 Mo, 50 000 éléments) ou qui contient des octets d'image (`dataURL`) : une image est un asset du monde, l'élément image garde seulement son id (`fileId`). À chaque enregistrement, les assets montrés sont notés : la médiathèque dit « image du canvas … » avant de supprimer une image utilisée ; supprimer l'asset laisse la scène telle quelle. Le canvas suit la corbeille, la duplication et la suppression des documents.

**Réalisé en M7 (7.2)** : créer et ouvrir un canvas. « Nouveau canvas » est dans le menu « Nouveau document », le clic droit de la sidebar et la tuile « Canvas » de l'espace de travail ; le canvas s'ouvre dans l'onglet World, avec son nom modifiable et un bouton « Recentrer ». Le dessin est Excalidraw, chargé à l'ouverture du premier canvas (pas au démarrage) : il suit le thème et la langue de l'app, et ses polices sont servies par l'app (aucune requête réseau). Ce qui n'a pas de sens ici est retiré : ouvrir ou enregistrer un fichier, collaboration, liens vers excalidraw.com, thème propre au canvas ; le menu garde « Enregistrer en image », « Effacer le canvas » et l'aide. Chaque modification et le cadrage (défilement, zoom) sont enregistrés après une courte pause ; au retour, le canvas rouvre au même endroit (ou cadré sur son contenu s'il n'a jamais été déplacé). Molette ou pavé tactile pour zoomer ; outil main, bouton du milieu ou espace enfoncé pour se déplacer.

**Réalisé en M7 (7.3)** : la barre d'outils du board remplace celle d'Excalidraw. Elle flotte en bas, au milieu, entre le zoom et l'annuler (à gauche) et l'aide (à droite) : sélection, main, stylo, notes, texte, formes, insérer, section, images. Notes, insérer et images sont visibles mais désactivés (« bientôt ») : ils arrivent avec les étapes 7.6, 7.5 et 7.9. Au-dessus de la barre, les options de l'outil actif : stylo ou gomme ; flèche, ligne, rectangle, ellipse ou losange (le bouton « Formes » reprend la dernière forme utilisée) ; couleur, épaisseur ; pour les formes, le fond (couleur et remplissage hachuré, quadrillé ou plein) et le trait (continu, tirets, pointillés ; dessiné à la main ou net) dans de petits menus ; pour le texte, la taille. Avec la sélection, ce sont les options que partagent les éléments choisis (une valeur qui diffère d'un élément à l'autre n'est pas cochée) et un bouton « Supprimer » ; changer un style s'annule avec `Ctrl+Z`. Les raccourcis d'Excalidraw (V, H, P, E, T, R, O, D, A, L, F) allument le bon outil, et la barre se parcourt au clavier. Les couleurs d'Excalidraw (accent, menus, boîtes de dialogue, police de l'interface) suivent nos tokens ; le fond du canvas est transparent : on voit le fond du monde, comme sur le board. Le panneau de style et la bibliothèque d'Excalidraw sont masqués.

**Réalisé en M7 (7.4)** : une carte de la sidebar glissée sur le canvas y pose sa vignette, centrée là où on la lâche : son image (ou l'icône de son type, dans sa couleur), son type et son nom. La vignette suit la carte : renommée, nouvelle image ou nouveau type, elle change aussitôt ; une carte à la corbeille ou supprimée montre « Carte introuvable », et revient si on la restaure. La vignette se sélectionne, se déplace, se redimensionne, se supprime et s'annule comme tout élément du canvas ; un double-clic ou son icône de lien ouvre la carte. Techniquement, c'est un élément « embed » d'Excalidraw dont le lien nomme la carte, sur un domaine réservé qui ne mène nulle part : aucune page web n'est chargée, et les autres embeds (vidéos, sites) sont refusés. L'image exportée (« Enregistrer en image ») ne montre pas encore les vignettes.

## Modèle de données (indicatif)

- `canvases` : document_id, scene (JSON Excalidraw sans les binaires), app_state (JSON : cadrage, grille)
- Les éléments BuilderZ sont stockés dans la scène avec une métadonnée `{ kind: "card" | "map" | "graph", documentId }`.

## Critères d'acceptation

- Glisser trois cartes, les regrouper dans une section, puis déplacer la section déplace les trois cartes.
- Renommer une carte met à jour sa vignette sur le canvas.
- Une image collée apparaît dans la médiathèque.
