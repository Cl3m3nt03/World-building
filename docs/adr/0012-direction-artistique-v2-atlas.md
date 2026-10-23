# ADR 0012 — Direction artistique de la V2 : « Atlas ancien »

- **Statut** : Proposé (ambiance, priorité et thème choisis par Clément ; détails proposés)
- **Date** : 2026-10-23
- **Décideur** : Clément
- **Complète** : ADR 0003 (direction artistique de la V1), sans le remplacer sur ce qui reste vrai

## Contexte

La V1 est complète fonctionnellement (M0 à M11+, v1.4.0). Clément veut une **V2** : une refonte de l'ergonomie et du visuel, qui donne envie d'utiliser l'app. Le « liquid glass » façon Apple reste, mais l'app doit sentir le **worldbuilding** et non un outil générique.

Clément a choisi, le 2026-10-23 :

- l'ambiance **« Atlas ancien »** : le carnet du cartographe, chaleureux et noble ;
- de commencer, après le socle visuel, par **l'accueil et la navigation** ;
- un thème par défaut qui **suit Windows**, le clair et le sombre soignés à égalité.

L'ADR 0003 reste valable pour l'organisation de la coque (barre du haut en îlots, sidebar dense, fond plein écran, verre au-dessus) et pour ses règles d'accessibilité et de performance. Ce qui change, c'est la matière, la couleur, la typographie et le mouvement.

## Décision

### Le principe

**Un seul élément spectaculaire : l'atlas vivant en fond.** Ce sont des lignes de niveau et une rose des vents gravées, dessinées en SVG par l'app. Elles se fondent sous l'image du monde ouvert, avec un très léger effet de profondeur quand le pointeur bouge. Tout le reste est calme et discipliné : du verre, de l'encre et un seul or.

À éviter : le cliché « fond crème, serif, accent terre cuite » des interfaces générées. Pour s'en écarter, l'accent est un **or gravé** et non une terre cuite. Le secondaire est un **vert-de-gris** (les mers des vieilles cartes). La gravure de carte est en fond, et le sombre est aussi soigné que le clair.

### Couleurs

Ce sont les tokens `--bz-*` de `src/styles/tokens.css`, avec les mêmes noms qu'en V1 quand le rôle ne change pas.

| Rôle | Sombre (« encre ») | Clair (« vélin ») |
|---|---|---|
| Fond | `#13110d` encre chaude | `#f2e9d4` vélin |
| Texte | `#eee4cf` parchemin | `#2b2219` encre brune |
| Texte atténué | `#a89d86` | `#6e604c` |
| Accent (or gravé) | `#d4ad5a` | `#8c6a24` |
| Secondaire (vert-de-gris) | `#6fa596` | `#3d6f63` |
| Destruction (sang-de-bœuf) | `#d0645a` | `#a63c33` |

Les couleurs des types de cartes sont réaccordées pour rester lisibles sur ces fonds (contraste AA vérifié). L'accent propre à un monde (thème du monde, M2) remplace toujours l'or.

### Verre liquide

- **Trois niveaux** : *voile* (barre du haut, îlots), *panneau* (sidebar, documents) et *flottant* (dialogues, menus, cartes flottantes de la frise). Plus un niveau est haut, plus son flou et son ombre sont forts et son fond est opaque.
- **Matière** :
  - un reflet clair d'un pixel sur l'arête haute ;
  - une bordure intérieure légère et une ombre portée douce et teintée (pas de gris neutre) ;
  - un grain très fin, en SVG et non en image, pour éviter l'aspect plastique.
- **Rayons** : selon la hiérarchie (petit pour les champs, moyen pour les boutons, grand pour les panneaux, pilule pour les îlots), et non un seul rayon partout.
- Transparence coupée ou `prefers-reduced-transparency` : surfaces opaques, sans flou, comme en V1.

### Typographie

Les polices sont libres (OFL) et embarquées avec `@fontsource`, puisque la CSP interdit le réseau :

- **Alegreya** (variable) pour les titres et les noms des documents. C'est une serif humaniste dessinée pour la littérature, avec des petites capitales réelles pour les rubriques (« Cité dans », « Propriétés »).
- **Alegreya Sans** pour l'interface et le texte courant, de la même famille : les deux voix vont ensemble sans se confondre.

L'échelle typographique est modulaire (rapport 1,25), avec des interlignes plus amples pour la serif. Les rubriques en petites capitales espacées remplacent les capitales simulées.

Space Mono et Inter (V1) restent disponibles pour les thèmes du wiki et de Quill. Ils ne sont plus la voix de l'app.

### Mouvement

- Il répond toujours à un geste : ouvrir, déplier, confirmer, glisser.
- Les durées et courbes sont des tokens (`--bz-ease-*`, `--bz-duration-*`).
- Une seule séquence d'entrée est orchestrée, à l'ouverture d'un monde : l'atlas se dessine, puis les panneaux se posent.
- Avec `prefers-reduced-motion`, plus rien ne bouge, sauf les changements d'état nécessaires.

### Accessibilité et performance

Les règles de l'ADR 0003 restent valables : contraste AA en toutes circonstances (voile calculé sur l'image du monde), flou réservé aux panneaux de la coque, réglage « Effets de transparence ».

L'atlas vivant est un seul SVG statique par monde. Il se met en cache, et seule une transformation légère le fait bouger. Il est désactivé quand le mouvement est réduit ou la transparence coupée.

## Organisation

La V2 se découpe en milestones, comme la V1 (`docs/roadmap/V2.md`) :

1. **V2-M1 — Socle visuel** : tokens, verre, typographie, atlas vivant, mouvement, primitives (boutons, champs, menus, dialogues…), et une page « Système de design » pour tout voir.
2. **V2-M2 — Accueil et navigation** : liste des mondes, création d'un monde, Home du monde, barre du haut, sidebar.
3. **V2-M3 — Les fiches.**
4. **V2-M4 — Les documents** : map, graph, arbre, canvas, frise.
5. **V2-M5 — Wiki et Quill.**
6. **V2-M6 — Finitions et sortie `v2.0.0`.**

Chaque milestone se termine par une recette de Clément.

## Alternatives écartées

| Alternative | Raison |
|---|---|
| **Arcane nocturne** (sombre d'abord, lueurs runiques) | Plus spectaculaire, mais Clément a choisi l'atlas, et un sombre forcé aurait sacrifié le clair. |
| **Une DA qui change avec le genre du monde** | Plus ambitieux et plus fragile. Le thème du monde (M2) suffit à colorer chaque monde. |
| **Garder Space Mono et Inter** | La monospace sonne « outil de développeur », à l'opposé de l'atlas. |
| **Des textures en images (parchemin scanné)** | C'est lourd, flou à certaines tailles et trop littéral. Le SVG gravé reste net et léger. |

## Conséquences

- ✅ L'app prend une identité propre au worldbuilding, que la V1 n'avait pas encore.
- ✅ Le socle d'abord : chaque écran refait ensuite dans V2-M2 à M6 repose sur les mêmes tokens et primitives.
- ⚠️ Deux nouvelles dépendances de polices (`@fontsource-variable/alegreya`, `@fontsource/alegreya-sans`) sont justifiées dans la PR de V2-M1.
- ⚠️ Pendant la V2, les écrans pas encore refaits vivent avec les nouveaux tokens. Le socle est conçu pour qu'ils restent corrects avant leur passage.
