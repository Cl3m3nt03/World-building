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
