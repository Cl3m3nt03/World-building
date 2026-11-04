# ADR 0015 — Thèmes riches d'un monde

- **Statut** : proposé (2026-11-05), en attente des choix de Clément
- **Contexte** : thème du monde (`docs/features/00-interface.md`, « Thème du monde » et « Thèmes riches »), ADR 0003, 0012, 0013, audit F35 (`docs/audits/2026-11-audit-design.md`), #528

## Contexte

Le thème d'un monde est aujourd'hui une image de fond et une couleur d'accent. Il est stocké dans `world.json`, champ `theme`, sous trois formes :

```json
{ "kind": "default" }
{ "kind": "preset", "id": "dawn" }
{ "kind": "custom", "background": "<id d'asset ou null>", "accent": "#5fcdc0" }
```

Le champ est lu avec tolérance (`src-tauri/src/world/theme.rs`, `deserialize_lenient`) : un thème illisible donne le thème par défaut, jamais un refus d'ouvrir le monde. Le front affiche un `id` de thème fourni qu'il ne connaît pas comme le thème par défaut.

Clément a accepté d'aller plus loin : une matière des panneaux, des ornements, une police des titres, un mode clair ou sombre propre au monde, un thème proposé à la création et une galerie avec aperçu. L'ADR 0012 avait écarté « une DA qui change avec le genre du monde ». Cette décision la nuance sans la renverser : la grammaire reste celle de l'Atlas ancien (coque, trois niveaux de surface, texte courant, atlas gravé). Seuls changent des réglages pris dans des listes fermées, et chaque combinaison reste AA.

## Décision

1. La forme `custom` gagne quatre champs **facultatifs** :

   ```json
   {
     "kind": "custom",
     "background": null,
     "accent": "#4fd6f0",
     "material": "coldGlass",
     "ornament": "marks",
     "headingFont": "cinzel",
     "scheme": "dark"
   }
   ```

   | Champ | Valeurs | Absent |
   |---|---|---|
   | `material` | `vellum`, `parchment`, `coldGlass`, `stone` | `vellum` |
   | `ornament` | `none`, `rules`, `marks`, `edge` | `none` |
   | `headingFont` | `alegreya`, `cinzel`, `ebGaramond`, `playfair`, plus la police technique retenue | `alegreya` |
   | `scheme` | `app`, `light`, `dark` | `app` |

   Une valeur par défaut n'est pas écrite.

2. Les formes `default` et `preset` ne changent pas. Un thème fourni porte lui-même sa matière, son ornement, sa police et son mode : ils sont définis dans le front (`presets.ts`), pas dans `world.json`. De nouveaux `id` s'ajoutent : `grimoire`, `station`, `crypt`.
3. `scheme` vit dans le thème, et non à côté, pour qu'un thème fourni puisse l'imposer et que « Modifier » le reprenne avec le reste. Les huit thèmes actuels et les trois nouveaux valent `app` : imposer un mode reste un choix de l'auteur.
4. **Lecture tolérante, champ par champ** : une valeur inconnue de `material`, `ornament`, `headingFont` ou `scheme` (venue d'une version plus récente, ou d'une édition à la main) est remplacée par sa valeur par défaut, avec un avertissement dans le journal. Le reste du thème est gardé (on ne retombe plus sur le thème par défaut entier pour un seul champ inconnu). L'`accent` et le `background` gardent leurs règles actuelles.
5. Aucune migration de la base : c'est une métadonnée du monde, comme le genre, les tonalités et le thème actuel.
6. `set_world_theme` reçoit la forme élargie. `create_world` reçoit un thème facultatif : celui proposé ou choisi dans « Nouveau monde » (absent : `default`).
7. La table qui propose un thème à partir du genre et des tonalités vit dans le front. Elle n'est pas stockée : seul le thème retenu l'est.
8. Le wiki gagne un thème fourni `atlas` (`WikiTheme.preset`), qui suit le thème du monde et le mode affiché. Il devient le défaut des **nouveaux** mondes. Le défaut lu pour un monde existant sans réglage reste `parchment`, pour ne rien changer sous les pieds de l'utilisateur (voir les questions).

## Conséquences

- Les mondes actuels s'ouvrent tels quels : aucun champ nouveau, donc Vélin, aucun ornement, Alegreya, mode de l'app. Leur rendu ne change pas.
- **Version antérieure qui ouvre un monde récent** : serde ignore les champs inconnus, donc un thème `custom` élargi s'affiche avec son fond et son accent, sans le reste. Un `preset` nouveau (`grimoire`…) s'affiche comme « Par défaut ». Si cette version réenregistre le thème (l'utilisateur le change), les nouveaux champs sont perdus. C'est accepté : seul le thème est concerné, jamais le contenu.
- Les polices ajoutées sont embarquées (`@fontsource`, SIL OFL), comme Alegreya et les polices du wiki. Leur licence est vérifiée avant l'ajout et citée dans la page « À propos ». La CSP (`font-src 'self'`) ne change pas.
- Chaque matière définit ses tokens `--bz-*` en clair et en sombre. Un test vérifie pour chacune : texte et texte atténué ≥ 4,5:1 sur ses surfaces, accent ≥ 3:1, texte sur l'accent ≥ 4,5:1. Sur une image, le voile calculé par image (#528) est requis avant la sortie.
- Le mode imposé par un monde passe avant le réglage « Apparence » de l'app tant que le monde est ouvert. La liste des mondes et les réglages de l'app suivent toujours l'app.
- La transition entre deux thèmes passe par le lot E du plan de mouvement (`docs/audits/2026-11-plan-mouvement.md`).

## Alternatives écartées

| Alternative | Raison |
|---|---|
| **Des thèmes libres (CSS ou tokens écrits par l'utilisateur)** | Aucune garantie de contraste, et le format deviendrait une API à maintenir. |
| **Une DA par genre, sans choix** | Écartée par l'ADR 0012. Ici, le genre ne fait que proposer, l'utilisateur décide. |
| **`scheme` à côté de `theme` dans `world.json`** | Un thème fourni ne pourrait pas l'imposer, et « Modifier » devrait gérer deux champs. |
| **Textures en images (parchemin ou pierre scannés)** | Écarté par l'ADR 0012 : lourd et flou. Grain et ornements restent en SVG et CSS. |
| **Polices chargées depuis un CDN** | Interdit par la CSP, et l'app doit marcher hors ligne. |

## Questions pour Clément

1. Jusqu'où aller : les trois ambiances des maquettes, ou seulement certains réglages (matière et police, sans ornement par exemple) ?
2. Police technique de Station : Chakra Petch, Oxanium ou Exo 2 (toutes SIL OFL) ? La maquette utilise Bahnschrift, police système de Windows, qu'on ne peut pas livrer.
3. Mode imposé par le monde : le garder (avec « Suivre l'app » par défaut), ou le laisser à l'app seule ?
4. À la création : thème proposé **présélectionné** (on peut le changer), ou seulement suggéré, « Par défaut » restant présélectionné ?
5. Wiki : le thème Atlas pour les mondes existants sans réglage de wiki, ou seulement pour les nouveaux ?
