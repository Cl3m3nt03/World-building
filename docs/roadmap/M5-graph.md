# M5 — Graph

**Objectif** : voir tout le monde d'un coup d'œil. Un graph se crée depuis World et montre aussitôt toutes les cartes et leurs liens (mentions et propriétés), sans rien dessiner à la main. On cherche, on filtre par type, on règle les forces, on épingle des nœuds, et chaque graph garde sa configuration dans la sidebar (« Politique du royaume », « Famille Stark »…). Fluide jusqu'à 5 000 nœuds et 20 000 arêtes.

**Spec** : `docs/features/04-graph.md` (board : node `6:431`, texte « Graph Visualiser » relu). **Stack** : `d3-force` + rendu Canvas 2D (ADR 0001).

**Hors M5** : les relations de l'arbre de relations (`05`) dans le graph, question ouverte de la spec, se tranchera avec M6.

**Choix de conception (dans les PR, sans ADR : ils suivent l'ADR 0001 et le modèle indicatif de la spec)** :
- **Un graph est un document qui s'enregistre seul**, comme une map : « Nouveau graph » le crée (« Graph sans nom ») et chaque changement de filtres, réglages, épingles ou cadrage est gardé. Le bouton « Enregistrer » du board devient « Enregistrer sous… » : il crée un nouveau graph nommé avec la configuration courante, pour garder plusieurs vues. *Adaptation locale* : dans vvd, la vue n'est gardée que si on l'enregistre ; ici rien ne se perd, comme partout dans BuilderZ.
- **Les arêtes viennent de la table `links`** (`mention` et `property`, d'une carte vers une autre, pas `map_pin`), calculées par le Rust : une arête par paire de cartes, non orientée, avec le nombre de liens (épaisseur).
- **La simulation tourne dans un Web Worker** (`d3-force`), qui renvoie les positions ; le fil principal ne fait que dessiner (Canvas 2D, images mises en cache) et répondre à la souris. Le survol et le clic passent par un `quadtree` (dépendance de `d3-force`).
- **Accessibilité** : un canvas n'est pas lisible par un lecteur d'écran. À côté du dessin, une liste des cartes affichées (avec leurs voisins) se parcourt au clavier, et la sélection suit dans les deux sens.

**Ordre d'exécution** : 5.1 → 5.2 → 5.3, puis 5.4 → 5.5 → 5.6 → 5.7 → 5.8, puis 5.9, 5.10, 5.12, et la recette 5.11 en dernier.

---

## 5.1 — Socle de données des graphs (#209)
**Branche** : `feat/graph-core` · **Dépend de** : —

- [ ] Migration : table `graphs` (document, filtres, réglages, cadrage en JSON) et `graph_pinned_nodes` (graph, carte, x, y), reliées au document (`ON DELETE CASCADE`)
- [ ] Commandes : créer un graph (configuration par défaut), le lire, enregistrer sa configuration (filtres, réglages, épingles, cadrage) en une fois, le dupliquer
- [ ] Commande `graph_data` : les cartes vivantes (id, nom, type, image) et les arêtes fusionnées par paire (nombre de liens `mention` et `property`)
- [ ] Vérifications du Rust : réglages bornés, cartes épinglées existantes, JSON lisible (lecture tolérante)
- [ ] Le graph suit la corbeille, la duplication et la suppression des documents
- [ ] Tests Rust

**Critères d'acceptation** : une configuration se relit à l'identique ; mentionner une carte dans le texte d'une autre ajoute une arête dans `graph_data`, deux liens entre les mêmes cartes en font une seule de poids 2.

## 5.2 — Créer, ouvrir et parcourir un graph (#210)
**Branche** : `feat/graph-view` · **Dépend de** : 5.1

- [ ] « Nouveau graph » dans la sidebar (bouton, clic droit, tuile « Graph » de l'espace vide) : le graph s'ouvre ; dans l'arbre (icône graph), filtre « Graph » actif, recherche, épingles, récents
- [ ] Rendu Canvas 2D : nœuds avec l'image de la carte (ou l'icône et la couleur de son type) et son nom ; arêtes dont l'épaisseur suit le nombre de liens
- [ ] Simulation `d3-force` dans un Web Worker ; zoom à la molette, déplacement au glisser, « Recentrer » ; au clavier, `+` / `-` et flèches
- [ ] Nom modifiable en haut à gauche ; dépendance `d3-force` justifiée dans la PR

**Critères d'acceptation** : un graph créé dans un monde de cartes liées montre toutes les cartes et leurs liens, se zoome et se déplace ; il est dans la sidebar après relance.

## 5.3 — Interactions avec les nœuds (#211)
**Branche** : `feat/graph-nodes` · **Dépend de** : 5.2

- [ ] Glisser un nœud le déplace, la simulation réagit
- [ ] Clic : sélectionne la carte, met en évidence ses voisins et estompe le reste ; double-clic (ou Entrée) : ouvre la carte
- [ ] Liste accessible des cartes affichées, à côté du dessin : flèches, Entrée ouvre, la sélection suit le dessin et inversement

**Critères d'acceptation** : un clic sur une carte montre ses voisins ; au clavier seul, on atteint et on ouvre n'importe quelle carte du graph.

## 5.4 — Recherche (#212)
**Branche** : `feat/graph-search` · **Dépend de** : 5.3

- [ ] La loupe (barre du bas) ouvre un champ : les cartes qui correspondent (nom ou alias, sans accent ni casse) sont mises en évidence, le reste estompé ; `Entrée` centre la vue sur la première, `Échap` referme

**Critères d'acceptation** : chercher « aragorn » met Aragorn en évidence et `Entrée` la centre.

## 5.5 — Filtres (#213)
**Branche** : `feat/graph-filters` · **Dépend de** : 5.3

- [ ] Menu des filtres (barre du bas) : types et sous-types, cochés au clavier ; un type inclut ses sous-types ; seules les cartes filtrées et leurs liens entre elles restent

**Critères d'acceptation** : filtrer sur « Personnage » ne montre que les personnages et les liens entre eux.

## 5.6 — Réglages (#214)
**Branche** : `feat/graph-settings` · **Dépend de** : 5.3

- [ ] Panneau des réglages (barre du bas) : afficher les labels, masquer les nœuds isolés, taille des nœuds, distance et force des liens, répulsion, collision, gravité X et Y
- [ ] Chaque changement relance la simulation en douceur ; « Réinitialiser » revient aux valeurs par défaut

**Critères d'acceptation** : chaque réglage change le dessin comme décrit dans la spec ; masquer les isolés cache les cartes sans lien.

## 5.7 — Épingler des nœuds (#215)
**Branche** : `feat/graph-pins` · **Dépend de** : 5.3

- [ ] Clic droit sur un nœud (et menu au clavier dans la liste) : « Épingler » / « Désépingler » ; un nœud épinglé est marqué et ne bouge plus, quels que soient les réglages ou les déplacements de la vue ; glisser un nœud épinglé le déplace et il reste épinglé

**Critères d'acceptation** : un nœud épinglé ne bouge plus quand on change la répulsion.

## 5.8 — Configurations enregistrées (#216)
**Branche** : `feat/graph-config` · **Dépend de** : 5.4 à 5.7

- [ ] Filtres, réglages, épingles (avec leurs positions) et cadrage s'enregistrent seuls dans le graph, peu après chaque changement et en le quittant
- [ ] « Enregistrer sous… » (barre du bas) : un nouveau graph nommé avec la configuration courante, qui s'ouvre et apparaît dans la sidebar

**Critères d'acceptation** : une configuration enregistrée se rouvre exactement à l'identique, aussi après relance.

## 5.9 — Performance (#217)
**Branche** : `feat/graph-perf` · **Dépend de** : 5.2 à 5.6

- [ ] 5 000 nœuds et 20 000 arêtes : dessin seulement de ce qui est visible, images en cache réduites, labels à partir d'un seuil de zoom quand les nœuds sont nombreux ; simulation qui s'arrête quand elle est stable
- [ ] Mesure (images par seconde, temps de la simulation) notée dans la PR

**Critères d'acceptation** : sur 5 000 nœuds et 20 000 arêtes, zoomer, déplacer et glisser un nœud restent fluides.

## 5.10 — Tests de bout en bout M5 (#218)
**Branche** : `test/e2e-m5` · **Dépend de** : 5.1 à 5.9

- [ ] Scénarios : mention qui crée une arête, filtre « Personnage », recherche, nœud épinglé qui ne bouge pas en changeant la répulsion, configuration enregistrée sous un nom et rouverte à l'identique après relance

**Critères d'acceptation** : les critères de `04-graph.md` sont couverts et passent en CI.

## 5.12 — Aperçu du graph dans Home (#233)
**Branche** : `feat/home-graph` · **Dépend de** : 5.5 · *Ajoutée pendant M5 : la spec de Home la prévoyait (`00-interface.md`)*

- [ ] Home : le graph du monde, avec la loupe et les filtres, rien d'enregistré ; clic et double-clic comme dans un graph
- [ ] Sans lien entre cartes, un texte qui dit comment en créer (mentions @, propriétés de type lien)

**Critères d'acceptation** : dès que deux cartes sont reliées, Home montre leur graph.

## 5.11 — Recette M5 (#219)
**Branche** : — · **Dépend de** : 5.10

- [ ] Issue « Recette M5 » tenue à jour, déroulée avec Playwright sur l'app réelle (FR et EN, clair et sombre)

**Critères d'acceptation** : la recette est validée avant la release.

---

## Définition de « M5 terminé »

1. Les critères d'acceptation de `docs/features/04-graph.md` sont remplis et testés, dont la fluidité sur 5 000 nœuds et 20 000 arêtes.
2. Toute la nouvelle interface est traduite, utilisable au clavier (liste accessible) et fonctionne dans les deux thèmes.
3. La CI est verte sur `main`, et une release `v0.5.0` publie l'installeur.
