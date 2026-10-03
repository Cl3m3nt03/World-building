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

## Modèle de données (indicatif)

- `canvases` : document_id, scene (JSON Excalidraw sans les binaires), app_state (JSON : cadrage, grille)
- Les éléments BuilderZ sont stockés dans la scène avec une métadonnée `{ kind: "card" | "map" | "graph", documentId }`.

## Critères d'acceptation

- Glisser trois cartes, les regrouper dans une section, puis déplacer la section déplace les trois cartes.
- Renommer une carte met à jour sa vignette sur le canvas.
- Une image collée apparaît dans la médiathèque.
