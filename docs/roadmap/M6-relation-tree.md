# M6 — Relation Tree

**Objectif** : dessiner à la main des arbres généalogiques et des relations entre personnages. Un arbre se crée depuis World et commence par un nœud vide, qu'on relie à une carte ou qu'on nomme ; les « + » autour d'un nœud créent un parent, un enfant, un partenaire… déjà relié ; on tire des liens entre nœuds, et même depuis un lien (jonction : un enfant rattaché au couple) ; on annote à main levée ou par des textes ; des variantes (« Tome 1 », « Après la guerre ») gardent plusieurs états de l'arbre. Tout s'enregistre seul, `Ctrl+Z` / `Ctrl+Y` fonctionnent.

**Spec** : `docs/features/05-relation-tree.md` (board : node `11:726`, texte « Relation Tree » relu). **Stack** : React Flow (`@xyflow/react`, ADR 0001).

**Hors M6** : les relations des arbres dans le Graph (question ouverte de `04-graph.md`) et les rétroliens « Cité dans » depuis un arbre attendent l'avis de Clément ; l'arbre posé sur un canvas arrive avec M7.

**Choix de conception (dans les PR, sans ADR : ils suivent l'ADR 0001 et le modèle indicatif de la spec)** :
- **Comme une map**, le front tient le contenu d'une variante (nœuds, liens, annotations) et l'envoie en entier à chaque sauvegarde ; le Rust le vérifie et le remplace dans une transaction. Annuler / rétablir travaille sur des instantanés de ce contenu, par variante.
- **Les types de relations vivent au niveau du monde** (`relation_types`). Ceux fournis (parent ↔ enfant, frère / sœur, partenaire, époux·se) sont des lignes avec une clé (`builtin`) que le front traduit ; les types personnalisés ont un nom, une icône et une relation inverse éventuelle.
- **Jonction** : un lien dont la source est un autre lien. React Flow ne relie que des nœuds : le front pose un petit nœud invisible au milieu du lien source et y rattache le nouveau lien ; seul le modèle (« source : lien ») est enregistré.
- Un lien a un **sens** (de la source vers la cible) pour les relations asymétriques : « Aragorn — parent de → Eldarion » ; l'infobulle et le panneau disent la relation dans ce sens.

**Ordre d'exécution** : 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6, puis 6.7, 6.8, 6.9, 6.10, et la recette 6.12 en dernier.

---

## 6.1 — Socle de données des arbres (#235)
**Branche** : `feat/tree-core` · **Dépend de** : —

- [ ] Migration : `relation_types` (avec les types fournis), `trees`, `tree_variants`, `tree_nodes`, `tree_edges` (source nœud ou lien), `tree_annotations`, reliés au document (`ON DELETE CASCADE`)
- [ ] Commandes : créer un arbre (une variante, un nœud vide), le lire, enregistrer le contenu d'une variante en une fois ; ajouter (copie de la variante courante), renommer, dupliquer, réordonner et supprimer une variante (pas la dernière) ; lister, créer, modifier et supprimer les types de relations
- [ ] Vérifications du Rust : ids uniques, liens vers des nœuds ou liens de la même variante, pas de lien de soi à soi, tailles bornées
- [ ] L'arbre suit la corbeille, la duplication et la suppression des documents
- [ ] Tests Rust

**Critères d'acceptation** : un arbre et ses variantes se relisent à l'identique ; modifier une variante ne touche pas les autres.

## 6.2 — Créer, ouvrir et parcourir un arbre (#236)
**Branche** : `feat/tree-view` · **Dépend de** : 6.1

- [ ] « Nouvel arbre » : menu « Nouveau document » de la sidebar, clic droit dans l'arbre des documents, tuile de l'espace vide ; il s'ouvre avec un nœud vide ; dans la sidebar (icône), filtre, recherche, épingles, récents, dupliquer, corbeille
- [ ] Vue React Flow : zoom, déplacement, « Recentrer », clavier ; nom modifiable en haut à gauche
- [ ] Nœuds : image et nom de la carte, ou nom seul, ou « Nouveau personnage » vide ; on les déplace en les glissant
- [ ] Dépendance `@xyflow/react` justifiée dans la PR

**Critères d'acceptation** : un arbre créé s'ouvre avec son nœud vide, se parcourt à la souris et au clavier, et se retrouve dans la sidebar après relance.

## 6.3 — Remplir un nœud (#237)
**Branche** : `feat/tree-nodes` · **Dépend de** : 6.2

- [ ] Clic sur un nœud vide : choisir une carte (recherche, nom ou alias) ou taper un simple nom
- [ ] Barre du nœud sélectionné : « Remplacer » (autre carte ou nom), « Ouvrir la carte », « Supprimer » (et ses liens) ; double-clic ouvre la carte
- [ ] « Ajouter un nœud » crée un nœud isolé

**Critères d'acceptation** : un nœud relié à une carte montre son image et son nom, et l'ouvre ; un nœud nommé garde son nom après relance.

## 6.4 — Les « + » et les relations (#238)
**Branche** : `feat/tree-relations` · **Dépend de** : 6.3

- [ ] Des « + » autour du nœud sélectionné (haut, bas, gauche, droite) ; un clic ouvre la liste : famille (parent, enfant, frère / sœur), couple (partenaire, époux·se), types personnalisés, « Passer pour l'instant », « Relation personnalisée… »
- [ ] Le choix crée un nouveau nœud vide, placé dans la direction du « + » et déjà relié ; au clavier, le menu s'ouvre depuis la barre du nœud
- [ ] Survol d'un lien : infobulle avec la relation (dans le sens du lien)

**Critères d'acceptation** : on construit une famille de trois générations en n'utilisant que les « + ».

## 6.5 — Tirer, rebrancher et régler les liens (#239)
**Branche** : `feat/tree-edges` · **Dépend de** : 6.4

- [ ] Tirer une ligne depuis le point d'accroche d'un nœud : elle s'aimante aux points des autres nœuds, on relâche pour relier (puis on choisit la relation)
- [ ] Glisser une extrémité d'un lien vers un autre nœud le rebranche
- [ ] Clic sur un lien : panneau avec le type de relation, le sens et le style de trait (plein, tirets, pointillés) ; « Supprimer le lien »

**Critères d'acceptation** : deux nœuds existants se relient à la souris, un lien se rebranche, son style se garde après relance.

## 6.6 — Jonctions (#240)
**Branche** : `feat/tree-junctions` · **Dépend de** : 6.5

- [ ] Tirer une ligne depuis le milieu d'un lien (un point y apparaît au survol) crée un lien qui part de ce lien : par exemple un enfant rattaché au lien entre ses deux parents
- [ ] La jonction suit le lien quand ses nœuds bougent ; supprimer le lien source supprime ses jonctions

**Critères d'acceptation** : on crée une jonction entre un couple et un enfant, gardée après relance.

## 6.7 — Annotations (#241)
**Branche** : `feat/tree-annotations` · **Dépend de** : 6.2

- [ ] Outil Dessin : tracés à main levée (couleur, épaisseur), qu'on sélectionne, déplace et supprime
- [ ] Outil Texte : textes libres posés sur l'arbre, modifiables sur place

**Critères d'acceptation** : un dessin et un texte posés par-dessus l'arbre sont gardés après relance.

## 6.8 — Variantes (#242)
**Branche** : `feat/tree-variants` · **Dépend de** : 6.1, 6.2

- [ ] Onglets des variantes en bas ; « Ajouter une variante » demande un nom et copie la variante courante ; chaque variante s'édite seule
- [ ] Menu d'une variante : renommer, dupliquer, supprimer (pas la dernière), réordonner (glisser et clavier)

**Critères d'acceptation** : modifier une variante ne modifie pas les autres ; on passe de l'une à l'autre pour comparer.

## 6.9 — Types de relations du monde (#243)
**Branche** : `feat/relation-types` · **Dépend de** : 6.4

- [ ] « Relation personnalisée… » et une fenêtre de gestion : nom, icône, relation inverse (parent ↔ enfant), catégorie ; utilisés dans tous les arbres du monde
- [ ] Supprimer un type utilisé : ses liens deviennent « sans type », après confirmation

**Critères d'acceptation** : une relation personnalisée créée dans un arbre est proposée dans un autre.

## 6.10 — Sauvegarde automatique, annuler et rétablir (#244)
**Branche** : `feat/tree-history` · **Dépend de** : 6.3 à 6.8

- [ ] Chaque modification est enregistrée après un court délai, en quittant l'arbre et avant la fermeture
- [ ] `Ctrl+Z` / `Ctrl+Y` (et boutons) par variante, historique borné

**Critères d'acceptation** : dix actions annulées puis rétablies redonnent le même arbre, aussi après relance.

## 6.11 — Tests de bout en bout M6 (#245)
**Branche** : `test/e2e-m6` · **Dépend de** : 6.1 à 6.10

- [ ] Scénarios : trois générations avec les « + », une jonction couple → enfant, un lien tiré et rebranché, une annotation, deux variantes indépendantes, relance

**Critères d'acceptation** : les critères de `05-relation-tree.md` sont couverts et passent en CI.

## 6.12 — Recette M6 (#246)
**Branche** : — · **Dépend de** : 6.11

- [ ] Issue « Recette M6 » déroulée avec Playwright sur l'app réelle (FR et EN, clair et sombre, fenêtre étroite)

**Critères d'acceptation** : la recette est validée avant la release.

---

## Définition de « M6 terminé »

1. Les critères d'acceptation de `docs/features/05-relation-tree.md` sont remplis et testés.
2. Toute la nouvelle interface est traduite, utilisable au clavier et fonctionne dans les deux thèmes.
3. La CI est verte sur `main`, et une release `v0.6.0` publie l'installeur.
