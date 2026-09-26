# Spécifications fonctionnelles

Un fichier par module. Chacun décrit le comportement attendu, les règles, les cas limites et les adaptations au contexte local. Ces fichiers sont **la référence**. Quand le code change le comportement d'un module, son fichier est mis à jour dans la même PR.

Ils sont rédigés à partir du board FigJam (voir `docs/contexte.md`). Pour chaque module, le **pavé de texte en anglais** du board décrit le fonctionnement attendu : c'est la source principale. Les captures placées dessous l'illustrent et précisent l'interface. Avant de travailler sur un module, relire ce texte et vérifier que la spec le couvre.

Les modèles de données proposés dans ces fichiers sont **indicatifs**. Le schéma définitif est fixé dans la PR qui introduit les migrations, et il doit rester cohérent avec les concepts ci-dessous.

## Sommaire

| Fichier | Module | Milestone |
|---|---|---|
| `00-interface.md` | Coque, mondes, réglages, médiathèque, radio | M1 |
| `01-cartes-et-types.md` | Cartes, types, sous-types, propriétés, blocs, templates | M2 |
| `02-organisation.md` | Sidebar, dossiers, hiérarchie, épingles, tri, filtres, recherche | M3 |
| `03-map.md` | Cartes géographiques interactives | M4 |
| `04-graph.md` | Graphe du monde | M5 |
| `05-relation-tree.md` | Arbres de relations | M6 |
| `06-canvas.md` | Tableau blanc | M7 |
| `07-wiki.md` | Wiki intégré et export | M8 |
| `08-quill.md` | Écriture d'histoires | M9–M10 |

## Concepts transversaux

### Vocabulaire

Pour éviter toute confusion entre les deux sens du mot « carte » :

| Terme (doc FR) | Terme (code) | Sens |
|---|---|---|
| **Carte** | `card` | Une fiche du monde (personnage, lieu, objet…) |
| **Map** | `map` | Une carte géographique interactive |
| **Monde** | `world` | Un projet complet (un dossier sur le disque) |
| **Document** | `document` | Tout élément rangé dans la sidebar |

### Documents

Tout ce qui apparaît dans la sidebar est un **document** : une carte, une map, une configuration de graph, un canvas ou un arbre de relations. Les documents partagent un socle commun : identifiant, type de document, titre, dossier, parent, ordre manuel, épinglage, visibilité wiki et dates. Chaque type ajoute ensuite ses données propres dans ses tables.

Ce socle commun permet à la sidebar, à la recherche, aux épingles, aux dossiers et au wiki de fonctionner pareil pour tous les modules. Les histoires de Quill vivent dans l'onglet Quill et ne sont pas des documents de la sidebar.

### Liens

Une table centrale de **liens** relie une source (un document, ou un chapitre de Quill) à une carte cible. Chaque lien a une nature :

- `mention` : la carte est citée dans un texte (TipTap) ;
- `property` : la carte est la valeur d'une propriété de type lien ;
- `map_pin` : la carte est épinglée sur une map.

Cette table est maintenue par le Rust à chaque sauvegarde. Elle alimente le Graph, les rétroliens (« cité dans… ») et la détection de noms dans Quill.

### Éditeur de texte

Un seul éditeur basé sur TipTap sert partout : cartes, wiki, notes, Quill. Il gère les mentions `@carte`, les commandes `/` et les blocs personnalisés. Son contenu est stocké en JSON TipTap, et une version texte brut est dérivée pour la recherche FTS5.

### Suppression

Supprimer un document le place dans une **corbeille** au niveau du monde : il reste restaurable jusqu'à ce qu'on vide la corbeille. Les liens vers un document supprimé sont conservés tant qu'il est dans la corbeille et deviennent des références mortes, affichées comme telles, s'il est supprimé définitivement.

### Annuler / rétablir

Chaque éditeur gère `Ctrl+Z` et `Ctrl+Y` dans son propre périmètre : texte, map, canvas, arbre.
