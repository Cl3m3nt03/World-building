# ADR 0014 — Propriétés « Sélection » et « Date »

- **Statut** : Proposé (les grandes lignes viennent de Clément ; les points marqués « à confirmer » ont été pris pour avancer)
- **Date** : 2026-10-30
- **Décideur** : Clément, et Claude pour les points à confirmer
- **Issue** : #482 (V2-3.3b, `docs/roadmap/V2-M3-fiches.md`)

## Contexte

vvd propose deux genres de propriétés que BuilderZ n'a pas (`docs/outils/vvd/fiches.md`) : une liste de choix propre à la propriété, et une date. Ajouter un genre change le format des données d'un monde : la table `property_definitions` limite `kind` par une contrainte `CHECK`, et les valeurs des cartes ont des formes connues (`PropertyValue`).

Clément a décidé que :

- une **Date** est une date du calendrier du monde, celui des frises (ADR 0011), et non une date réelle jj/mm/aaaa ;
- une **Sélection** a ses choix sur la propriété, et une carte retient l'**identifiant stable** du choix : renommer un choix garde les valeurs.

L'issue demande « une valeur ou plusieurs » : les deux existent.

## Décision

### Format

1. **Deux nouveaux genres** : `select` et `date`. La migration 0025 refait `property_definitions`, car SQLite ne sait pas changer un `CHECK`. Supprimer cette table viderait `property_values` par cascade : ses lignes sont donc mises de côté, puis la table est refaite. Tout se passe dans la transaction de la migration.
2. **Les choix sont sur la définition**, dans deux colonnes :
   - `options` : JSON, `[{ "id": "<uuid>", "label": "Vivant" }]`, dans l'ordre affiché ;
   - `multiple` : 0 ou 1, une carte peut tenir plusieurs choix.
3. **Un seul genre pour un ou plusieurs choix**, à la différence de `card` et `cards` : passer de l'un à l'autre est un réglage de la propriété et n'efface rien, alors que changer de genre efface les valeurs.
4. **Une valeur de sélection** est la liste des identifiants choisis, y compris pour un seul choix : `{ "kind": "select", "value": ["<uuid>"] }`.
5. **Une valeur de date** reprend le modèle des frises : `{ "kind": "date", "value": { "days": 107649, "precision": "day" } }`. `days` compte les jours depuis l'an 0 (`i32`, comme un élément de frise) et `precision` vaut `year`, `month` ou `day`.

### Comportement

6. **Le monde a toujours un calendrier** : sans réglage, c'est celui par défaut (douze mois de 30 jours, sans ère), comme pour les frises. Changer le calendrier ne modifie aucune valeur enregistrée : la date s'écrit autrement, exactement comme un élément de frise. On réutilise le champ de date et le formatage des frises (`DateField`, `formatDate`) ; il n'y a pas de second format.
7. **Retirer un choix utilisé** : l'interface dit combien de cartes l'ont et demande confirmation, comme pour la suppression d'une propriété. Une fois confirmé, le choix est retiré de ces cartes, dans la même transaction ; une carte qui n'avait que lui n'a plus de valeur. *(À confirmer.)*
8. **Repasser en choix unique** n'efface rien : une carte qui tient plusieurs choix les garde et peut en retirer, mais ne peut plus en ajouter. Choisir une autre valeur remplace le tout. *(À confirmer.)*
9. **Quitter le genre « Sélection »** efface ses valeurs (comme tout changement de genre) et ses choix.
10. **Lecture tolérante**. Une valeur illisible, d'un autre genre, ou qui ne cite que des choix disparus se lit « pas de valeur » ; les choix inconnus sont ignorés et les autres restent. Des `options` illisibles se lisent « aucun choix ». Rien de cela n'empêche d'ouvrir une carte.
11. **Limites** : 100 choix par propriété, 80 caractères par choix, un choix n'est jamais vide. Deux choix peuvent porter le même nom : l'identifiant les distingue. *(À confirmer.)*

### Ce qui n'en a pas besoin

- **`world.json`** ne porte pas les propriétés : il ne change pas.
- **La recherche** n'indexe aucune propriété aujourd'hui, et le **Graph** ne voit que les liens : ces deux genres n'y apparaissent pas.
- **L'export du wiki** écrit les libellés des choix et la date dans le calendrier du monde. Le site produit ne garde aucun identifiant.
- **Dupliquer une carte** recopie ses propriétés propres avec leurs choix et leurs identifiants : ses valeurs restent justes.

## Conséquences

- Les propriétés existantes ne changent pas : la migration recopie toutes les lignes, et les nouvelles colonnes ont une valeur par défaut. Une sauvegarde `world.db.bak-v<ancienne version>` est écrite avant la migration, comme à chaque fois.
- Une ancienne version de BuilderZ refuse un monde migré, comme pour toute migration plus récente qu'elle.
- Les couleurs de choix ne sont pas prévues. Un champ de plus dans `options` les permettrait sans migration, car la lecture ignore les champs inconnus.
- Trier ou filtrer les cartes par une date ou un choix reste possible plus tard : les jours se comparent et les identifiants sont stables.
