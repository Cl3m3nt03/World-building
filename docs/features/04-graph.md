# 04 — Graph (graphe du monde)

**Milestone** : M5 · **Figma** : node `6:431`

## Objectif

Offrir une vue d'ensemble de tout le monde et de ses connexions, pour comprendre les relations et repérer les manques (éléments isolés) ou les amas d'informations.

## Données affichées

- **Nœuds** : les cartes, avec leur image et leur nom.
- **Arêtes** : les entrées de la table des liens. Les mentions dans les textes et les propriétés de type lien alimentent le graph (`mention` et `property`). Il n'y a rien à dessiner à la main : le graph se construit tout seul.
- Plusieurs liens entre deux mêmes cartes sont fusionnés en une arête, dont l'épaisseur augmente avec le nombre de liens.

## Créer un graph

On crée un graph depuis l'espace World. Il affiche d'emblée toutes les cartes et leurs connexions.

## Recherche

La loupe ouvre un champ de recherche. Les cartes correspondantes sont mises en évidence et le reste est estompé. `Entrée` centre la vue sur le premier résultat.

## Filtres

On filtre par type et sous-type de carte. En filtrant sur « Personnage », par exemple, seuls les personnages et leurs liens entre eux restent affichés.

## Réglages

| Réglage | Effet |
|---|---|
| Afficher les labels | Montre ou cache les noms |
| Masquer les nœuds isolés | Cache les cartes sans aucun lien |
| Taille des nœuds | Taille des images des nœuds |
| Distance des liens | Longueur de repos des arêtes |
| Force des liens | Rigidité des arêtes |
| Répulsion | Force de répulsion entre nœuds |
| Collision | Rayon de collision |
| Gravité X / Gravité Y | Attraction vers l'axe horizontal ou vertical |

Ces réglages correspondent aux forces de `d3-force` : `forceLink`, `forceManyBody`, `forceCollide`, `forceX` et `forceY`. Chaque modification relance la simulation en douceur.

## Interactions

- Glisser un nœud le déplace, et la simulation réagit.
- Clic droit sur un nœud → **Épingler** : le nœud reste fixe, même si les réglages changent ou si l'on déplace le graph. On le libère avec « Désépingler ».
- Un clic sur un nœud sélectionne la carte et met en évidence ses voisins, un double-clic l'ouvre.
- Zoom et déplacement de la vue.

## Configurations sauvegardées

On enregistre la configuration courante (filtres, réglages, nœuds épinglés et leurs positions, cadrage) sous forme d'un **document graph** nommé, qui apparaît dans la sidebar. On peut ainsi garder plusieurs vues : « Politique du royaume », « Famille Stark »…

## Performance

L'affichage doit rester fluide avec 5 000 nœuds et 20 000 arêtes. Le rendu passe par Canvas 2D ou WebGL, jamais par un nœud DOM par élément. Au-delà d'un certain nombre de nœuds, les labels ne s'affichent qu'à partir d'un seuil de zoom.

**Réalisé en M5 (5.1)** : le socle de données, sans interface pour l'instant. Un graph est un document (`graphs`, migration 0011) qui garde sa configuration : filtres (types), réglages (labels, nœuds isolés, taille des nœuds, distance et force des liens, répulsion, collision, gravité X et Y, bornés), nœuds épinglés avec leur position, cadrage. Les réglages se lisent avec tolérance (un champ inconnu ou absent prend sa valeur par défaut). Les nœuds et arêtes ne sont pas stockés : `graph_data` renvoie les cartes vivantes et une arête par paire de cartes, toutes directions confondues, pondérée par le nombre de liens `mention` et `property` (les pins de map n'en sont pas). Le graph suit la corbeille, la duplication (« Enregistrer sous… » s'appuiera dessus) et la suppression des documents.

**Réalisé en M5 (5.2)** : « Nouveau graph » (menu « Nouveau document » en bas de la sidebar, clic droit dans l'arbre, tuile « Graph » de l'espace vide) crée « Graph sans nom » et l'ouvre : toutes les cartes et leurs liens, sans rien à dessiner. Il apparaît dans l'arbre (icône graph), se filtre (« Graphs »), se duplique et va à la corbeille comme les autres documents. Le dessin est un canvas (pas d'élément par nœud) : chaque nœud montre l'image de la carte, ou la couleur de son type et son initiale, avec son nom dessous ; une arête est plus épaisse avec le nombre de liens. La simulation `d3-force` tourne dans un Web Worker. La vue cadre tout le graph tant qu'on ne l'a pas déplacée ; molette pour zoomer autour du pointeur, glisser pour se déplacer, « Recentrer » ; au clavier, le graph prend le focus (Tab), les flèches le déplacent et `+` / `-` zooment. Le nom se modifie en haut à gauche. Sans carte, le graph dit comment il se construit.

**Réalisé en M5 (5.3)** : un clic sur un nœud sélectionne la carte : elle est entourée, ses voisins et leurs liens restent nets et le reste s'estompe ; un clic dans le vide ou `Échap` désélectionne. Un double-clic (ou `Entrée` sur le graph) ouvre la carte. Glisser un nœud le déplace et la simulation réagit. À côté du dessin, la liste des cartes affichées (« 6 cartes ») sert au clavier et aux lecteurs d'écran : flèches, `Début` / `Fin` pour sélectionner (la vue se centre sur la carte), `Entrée` pour l'ouvrir ; dessous, « Cartes liées à … » donne ses voisins, cliquables.

## Modèle de données (indicatif)

- `graphs` : document_id, filters (JSON), settings (JSON), viewport (JSON)
- `graph_pinned_nodes` : graph_id, card_id, x, y

## Questions ouvertes

- Faut-il que les relations de l'arbre de relations (`05`) apparaissent aussi dans le graph, par exemple avec une option dédiée ? Le board ne le précise pas.

## Critères d'acceptation

- Mentionner une carte dans le texte d'une autre fait apparaître l'arête dans le graph.
- Un nœud épinglé ne bouge plus quand on change la répulsion.
- Une configuration sauvegardée se rouvre exactement à l'identique.
