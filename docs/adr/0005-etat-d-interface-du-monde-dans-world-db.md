# ADR 0005 — État d'interface d'un monde dans `world.db`

- **Statut** : Proposé (à valider par Clément avec la PR de l'étape 3.9)
- **Date** : 2026-10-01
- **Décideur** : Claude, sur la demande de l'issue #133 (« emplacement à décider dans la PR »)

## Contexte

L'étape 3.9 mémorise **pour chaque monde** l'état de sa sidebar : largeur, repli, dossiers et parents ouverts, filtres et tri. CLAUDE.md interdit `localStorage` pour les données d'un monde, et cet état doit suivre le monde (deux mondes gardent chacun le leur).

Ce n'est pas un réglage choisi une fois (ADR 0004) mais un état qui change souvent (chaque dossier ouvert ou fermé, chaque glissement de la poignée), et dont une partie peut être longue (les dossiers ouverts d'un monde de milliers de cartes).

Emplacements possibles :

1. `settings.json` de l'app, indexé par monde : ne voyage pas avec le monde ; deux copies d'un même monde partageraient le même état.
2. `world.json` (comme ADR 0004) : réécrit en entier à chaque dossier ouvert ; une liste de centaines d'identifiants rendrait illisible un fichier fait pour être court et lisible ; non sauvegardé avec la base (`VACUUM INTO`).
3. `world.db`, une table clé → JSON : écriture transactionnelle et rapide, sauvegardée et migrée avec la base, et la forme du JSON peut évoluer sans migration.

## Décision

L'état d'interface d'un monde vit dans **`world.db`**, table `ui_state (key TEXT PRIMARY KEY, value TEXT)` (migration `0009`). Une clé par zone d'interface ; la première est `sidebar` :

```json
{ "width": 280, "collapsed": false, "expanded": ["f:<id>", "d:<id>"],
  "view": { "kinds": [], "typeIds": [], "sort": "manual", "reversed": false } }
```

Règles :

- **Lecture tolérante**, comme ADR 0004 : une clé absente donne l'état par défaut ; un JSON illisible ou un champ inconnu aussi, avec un avertissement dans les logs, sans erreur pour l'utilisateur.
- **Écriture bornée** : le Rust borne la largeur et la longueur des listes avant d'écrire.
- Les identifiants d'éléments supprimés restent dans `expanded` sans gêner (ils ne correspondent plus à rien) ; la liste est bornée.
- Le front écrit avec un court délai (un glissement de poignée ou plusieurs dossiers ouverts d'affilée font une écriture).

## Conséquences

- Une migration crée la table ; ensuite, l'évolution de la forme d'un état ne demande pas de migration (lecture tolérante).
- `world.json` reste réservé aux métadonnées et réglages choisis (ADR 0004).
- Cet état n'est pas une donnée du monde : un futur export pourra l'ignorer.
