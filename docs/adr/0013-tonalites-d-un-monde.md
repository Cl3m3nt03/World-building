# ADR 0013 — Tonalités d'un monde

- **Statut** : accepté (2026-10-25)
- **Contexte** : V2-M2+ (`docs/roadmap/V2-M2plus-accueil.md`, #464)

## Contexte

Pendant la session REA du 2026-10-25 (`docs/outils/vvd/accueil-navigation.md`), on a vu que vvd laisse choisir **plusieurs genres** pour un monde : une vingtaine de pastilles (fantasy, grimdark, steampunk, cozy…). Clément a demandé le même jour qu'on reprenne ce comportement.

Dans BuilderZ, le **genre** d'un monde (un seul, ADR de M2) a un rôle précis : il décide des types de cartes proposés à la création (`m2-decisions`). Le rendre multiple brouillerait ce rôle (quel jeu de types pour « fantasy + science-fiction » ?).

## Décision

1. Le **genre principal reste unique** et garde son rôle.
2. Un monde reçoit en plus des **tonalités**, de zéro à six, parmi une liste fermée de 17 valeurs : épique, grimdark, dark fantasy, mythologie, historique, uchronie, dystopie, post-apocalyptique, steampunk, solarpunk, gaslamp, horreur, mystère, survie, western, cozy, humour.
3. Elles sont stockées dans `world.json`, champ `tones` (liste de chaînes en camelCase, par exemple `"darkFantasy"`). Le champ est :
   - **facultatif** : absent, il vaut « aucune », et une liste vide n'est pas écrite ;
   - **lu avec tolérance** : une valeur inconnue (venue d'une version future) est ignorée avec un avertissement, les doublons sont retirés, au-delà de six on garde les six premières. Un monde n'est jamais refusé à cause de ce champ.
4. Aucune migration de la base : c'est une métadonnée du monde, comme le genre ou le thème.
5. Les tonalités se choisissent à la création et dans les réglages du monde (onglet Général). Elles s'affichent sur la Home et dans la carte du monde.

## Conséquences

- Les mondes de la V1 s'ouvrent tels quels (pas de `tones`). Une version antérieure de BuilderZ qui ouvre un monde récent ignore le champ, car `world.json` est lu de façon tolérante depuis 0.1.0.
- `create_world` reçoit la liste des tonalités, et `WorldPatch` (`update_world`) peut la changer.
- Les types de cartes proposés ne dépendent toujours que du genre principal.
- La liste est fermée, pour garder des libellés traduits (fr, en) et un choix lisible. L'élargir plus tard ne demande qu'une nouvelle valeur de l'énumération.
