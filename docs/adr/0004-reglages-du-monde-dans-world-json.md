# ADR 0004 — Réglages propres au monde dans `world.json`

- **Statut** : Accepté
- **Date** : 2026-09-27
- **Décideur** : Clément (captures de vvd du 27/09/2026 : thème et préférences du monde)

## Contexte

La fin de M2 ajoute des réglages qui appartiennent à un monde et non à l'app : son **thème** (2.17) et ses **préférences d'écriture** (2.18 : détection d'entités, liens automatiques des mentions, animation des nouveaux liens). Ils doivent suivre le monde quand on copie ou déplace son dossier, et survivre à une relance.

Trois emplacements étaient possibles :

1. `settings.json` de l'app : il ne voyage pas avec le monde, et deux copies d'un même monde partageraient les mêmes réglages.
2. La base `world.db` (table `meta` ou une nouvelle table) : chaque changement de forme demanderait une migration, et la base n'est lisible qu'une fois le monde ouvert.
3. `world.json` : déjà le fichier des métadonnées du monde (nom, genre, description, image principale), petit, lisible sans ouvrir la base, écrit de façon atomique.

## Décision

Les réglages propres au monde vivent dans **`world.json`**, dans des champs dédiés :

- `theme` : `{ "kind": "default" }` (absent du fichier), `{ "kind": "preset", "id": "dawn" }` ou `{ "kind": "custom", "background": "<asset id>" | null, "accent": "#rrggbb" }` ;
- `preferences` (2.18) : un objet de booléens.

Règles :

- **Lecture tolérante** : un champ absent donne la valeur par défaut ; un champ illisible (écrit à la main, ou par une version plus récente de l'app) donne aussi la valeur par défaut, avec un avertissement dans les logs, **sans jamais refuser d'ouvrir le monde**.
- **Écriture stricte** : le Rust valide ce qu'il reçoit (identifiant de thème, couleur `#rrggbb`, asset existant dans `assets/`) avant d'écrire.
- Une valeur par défaut n'est pas écrite, pour garder `world.json` court et lisible.
- Les identifiants des thèmes fournis sont connus du front seulement ; un identifiant inconnu (thème ajouté par une version plus récente) s'affiche comme le thème par défaut, sans perdre le réglage.
- Un réglage qui dépend d'un asset est lié à la médiathèque comme l'image principale : il apparaît dans les usages de l'asset, et la suppression de l'asset le remet à sa valeur par défaut.

## Conséquences

- Pas de migration de base pour ces réglages ; `schemaVersion` ne change pas.
- Une version plus ancienne de l'app qui ouvrirait le monde réécrirait `world.json` sans les champs qu'elle ne connaît pas : le thème et les préférences seraient perdus. C'est accepté : l'app est toujours mise à jour vers l'avant (il n'y a qu'un utilisateur), et un monde plus récent que l'app est déjà refusé par `schemaVersion` dès qu'une migration a eu lieu.
- Les illustrations des thèmes fournis sont des fichiers de l'app (`src/features/world-theme/illustrations`), générés par `scripts/theme-illustrations.py` : elles ne sont pas copiées dans le monde.
