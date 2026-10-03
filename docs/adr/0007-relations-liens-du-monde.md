# ADR 0007 — Les relations sont des liens du monde

- **Statut** : Accepté (décision de Clément le 2026-10-03, après la recette M7 : « le plus cohérent pour toi et pour l'expérience user »)
- **Date** : 2026-10-03
- **Décideur** : Clément, sur proposition de Claude

## Contexte

Jusqu'à M7, le monde connaît deux sortes de liens entre cartes, sans rapport entre elles :

- les **liens** de la table `links` : une carte citée dans un texte (`mention`), la valeur d'une propriété de lien (`property`), une carte épinglée sur une map (`map_pin`). Ils nourrissent le Graph et « Cité dans » ;
- les **relations des arbres** (M6) : parent, enfant, conjoint… tracées entre des nœuds d'arbre, avec un type de relation du monde. Elles ne sortent pas de l'arbre.

Clément veut que les relations tracées dans un arbre se voient dans le Graph, et qu'un nouvel arbre parte des personnages et relations déjà connus du monde.

## Décision

1. **Le Graph compte les relations des arbres.** Les relations tracées entre deux cartes dans les arbres vivants (pas à la corbeille), toutes variantes confondues, s'ajoutent aux citations et aux propriétés. Une relation compte une fois par paire de cartes et par type de relation, même si plusieurs arbres ou variantes la répètent. Un enfant rattaché au lien d'un couple (jonction) est relié à chacun des deux. Le calcul se fait à la lecture (les nœuds et liens du Graph ne sont jamais stockés, comme depuis M5) ; le Graph dit l'origine de chaque lien.
2. **Un arbre cite les cartes qu'il montre**, comme une map cite ses pins : nouveau type de lien `tree` (source : l'arbre, cible : la carte), réécrit à chaque enregistrement de l'arbre et retiré avec lui. « Cité dans » liste donc les arbres. La table `links` est recréée par une migration pour accepter ce type (SQLite ne modifie pas une contrainte `CHECK`).
3. **Une propriété de lien peut porter une relation** : `property_definitions.relation_type_id` (facultatif, une relation du monde). Ses valeurs deviennent des relations connues (« Parents » = *parent de* : la carte cible est parent de la carte qui porte la propriété).
4. **Les relations connues** d'un monde sont celles des arbres et des propriétés-relations. Un nouvel arbre peut les reprendre, au moment où on le demande : c'est une **copie**, pas une synchronisation. Ensuite l'arbre et les fiches vivent chacun leur vie, comme avant.
5. **Les citations ne sont pas des relations** : « Aragorn est cité dans la fiche de Gandalf » ne dit pas quel lien les unit ; elles restent dans le Graph, pas dans les arbres.

## Conséquences

- Le Graph devient la vue d'ensemble de tout ce qui relie les cartes ; il doit le dire (explication et origine des liens, étape 7.5.5).
- Pas de synchronisation fiche ↔ arbre : aucune règle de fusion ni de conflit à maintenir ; reprendre les relations connues dans un arbre existant ajoute seulement ce qui manque.
- Aucun « type personnage » deviné : les types sont libres et renommables ; ce sont les relations qui désignent les cartes à reprendre.
- Les mondes existants n'ont rien à migrer de leurs arbres : leurs relations apparaissent dans le Graph à la mise à jour, et leurs liens `tree` sont écrits à la migration.
