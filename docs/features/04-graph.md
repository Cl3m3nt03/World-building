# 04 — Graph (graphe du monde)

**Milestone** : M5 · **Figma** : node `6:431`

## Objectif

Offrir une vue d'ensemble de tout le monde et de ses connexions, pour comprendre les relations et repérer les manques (éléments isolés) ou les amas d'informations.

## Données affichées

- **Nœuds** : les cartes, avec leur image et leur nom.
- **Arêtes** : les entrées de la table des liens. Les mentions dans les textes et les propriétés de type lien alimentent le graph (`mention` et `property`), ainsi que les relations tracées entre deux cartes dans les arbres (ADR 0007). Il n'y a rien à dessiner à la main : le graph se construit tout seul.
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

**Réalisé en M5 (5.4)** : la barre du bas du graph porte la loupe. Elle ouvre un champ (« Nom ou alias… ») : les cartes dont le nom ou un alias contient ce qui est tapé, sans accent ni casse, restent nettes et le reste s'estompe ; le nombre de cartes trouvées est annoncé. `Entrée` centre la vue sur la première (par ordre alphabétique), `Échap` ou la croix referme le champ et rend le focus à la loupe.

**Réalisé en M5 (5.5)** : le bouton « Filtrer par type » de la barre du bas ouvre la liste des types et sous-types, à cocher à la souris ou au clavier (le menu reste ouvert) ; un type inclut ses sous-types. Seules les cartes des types cochés et les liens entre elles restent ; les autres cartes gardent leur place pour quand on les réaffiche. Le bouton signale un filtre actif ; « Tout afficher » l'enlève. Quand plus aucune carte ne correspond, le graph le dit (la barre reste là pour changer les filtres).

**Réalisé en M5 (5.6)** : le bouton « Réglages du graph » ouvre le panneau : afficher les noms, masquer les cartes sans lien, et les curseurs taille des nœuds, distance et force des liens, répulsion, collision, gravité X et Y (bornes du Rust). Chaque changement relance la simulation en douceur ; « Revenir aux réglages par défaut » remet tout.

**Réalisé en M5 (5.7)** : clic droit sur un nœud : « Épingler » / « Désépingler » et « Ouvrir la carte » ; au clavier, le bouton « Épingler … » sous la liste agit sur la carte sélectionnée. Un nœud épinglé porte un point de la couleur principale (et « épinglée » dans la liste) ; il ne bouge plus, quels que soient les réglages ou les déplacements de la vue. Le glisser le déplace : il reste épinglé là où on le lâche.

**Réalisé en M5 (5.8)** : la configuration du graph (filtres, réglages, nœuds épinglés avec leur position, cadrage) s'enregistre seule, peu après chaque changement, en quittant le graph et avant la fermeture du monde ou de la fenêtre ; rouvert, même après relance, le graph revient avec la même configuration et le même cadrage (les nœuds libres se replacent d'eux-mêmes). « Recentrer » revient au cadrage qui montre tout. « Enregistrer sous… » (barre du bas) crée un nouveau graph nommé avec la configuration courante, qui s'ouvre et apparaît dans la sidebar (*adaptation locale* : dans vvd, la vue n'existe que si on l'enregistre ; ici rien ne se perd).

**Réalisé en M5 (5.9)** : le dessin ne trace que ce qui est à l'écran, regroupe les arêtes en quelques traits (par épaisseur et par luminosité) et les nœuds sans image par couleur, et garde des vignettes réduites des images des cartes. Au-delà de 300 nœuds, les noms n'apparaissent qu'en zoomant (et jamais plus de 400 à la fois) ; les initiales, à partir d'une taille lisible. Mesuré sur 5 000 cartes et 19 315 liens (app réelle, build de debug) : graph affiché en 1,1 s, 7,6 ms par image en médiane pendant la simulation, le zoom, le déplacement et le glisser d'un nœud (40 ms par image avant), aucune tâche longue sur le fil principal.

## Modèle de données (indicatif)

- `graphs` : document_id, filters (JSON), settings (JSON), viewport (JSON)
- `graph_pinned_nodes` : graph_id, card_id, x, y

## Questions ouvertes

- Faut-il que les relations de l'arbre de relations (`05`) apparaissent aussi dans le graph, par exemple avec une option dédiée ? Le board ne le précise pas.

## Critères d'acceptation

- Mentionner une carte dans le texte d'une autre fait apparaître l'arête dans le graph.
- Un nœud épinglé ne bouge plus quand on change la répulsion.
- Une configuration sauvegardée se rouvre exactement à l'identique.

**Réalisé en M7.5 (7.5.1)** : les relations tracées dans les arbres relient aussi les cartes dans le graph (ADR 0007). Elles viennent des arbres vivants, toutes variantes confondues, une fois par sens et par type de relation ; un enfant rattaché au lien d'un couple (jonction) est relié à chacun des deux ; un arbre à la corbeille ne compte plus. Chaque arête garde ses raisons : les citations (quelle fiche cite l'autre), les propriétés (leur nom), les relations (qui est quoi de qui, et dans quel arbre) ; son épaisseur en est le nombre. L'interface les montre à l'étape 7.5.5.

**Réalisé en M7.5 (7.5.5)** : le Graph s'explique. Le bouton « À quoi sert le Graph ? » de la barre du bas dit en quelques lignes ce qu'on voit (chaque point est une carte, chaque trait dit que deux cartes sont liées, son épaisseur combien), d'où viennent les liens (citations @, propriétés de lien, relations des arbres : rien à dessiner) et à quoi ça sert (voir les groupes, les cartes isolées, naviguer, garder une vue avec « Enregistrer sous… »). Une carte sélectionnée liste ses voisines avec, pour chacune, pourquoi elles sont liées : « Aragorn la cite dans son texte », « Arathorn : parent de Aragorn — propriété « Parents » », « Arwen : époux·se de Aragorn — arbre « Maison d'Elendil » » ; un clic sur le nom la sélectionne, l'icône à côté l'ouvre. Sans carte, le Graph rappelle que les relations des arbres le nourrissent aussi.
