# ADR 0015 — Thèmes riches d'un monde

- **Statut** : accepté (2026-11-05), choix de Clément ci-dessous
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
4. **Lecture tolérante, champ par champ** : une valeur inconnue de `material`, `ornament`, `headingFont` ou `scheme` (venue d'une version plus récente, ou d'une édition à la main) est lue comme sa valeur par défaut, avec un avertissement dans le journal, et réécrite telle quelle dans `world.json` tant que ce réglage n'est pas changé. Le reste du thème est gardé (on ne retombe plus sur le thème par défaut entier pour un seul champ inconnu). L'`accent` et le `background` gardent leurs règles actuelles. Plus largement, à partir de cette version, BuilderZ garde ce qu'il ne comprend pas dans `world.json` : les clés inconnues (en haut du fichier et dans `theme`) et un thème illisible sont réécrits tels quels (#547). Les clés inconnues du thème sont oubliées seulement si l'on choisit un thème d'une autre sorte.
5. Aucune migration de la base : c'est une métadonnée du monde, comme le genre, les tonalités et le thème actuel.
6. `set_world_theme` reçoit la forme élargie. `create_world` reçoit un thème facultatif : celui proposé ou choisi dans « Nouveau monde » (absent : `default`).
7. La table qui propose un thème à partir du genre et des tonalités vit dans le front. Elle n'est pas stockée : seul le thème retenu l'est.
8. Le wiki gagne un thème fourni `atlas` (`WikiTheme.preset`), qui suit le thème du monde et le mode affiché. Il devient le défaut de **tous** les mondes sans réglage de wiki, existants compris (choix de Clément). Un monde qui a déjà choisi un thème de wiki le garde.

## Conséquences

- Les mondes actuels s'ouvrent tels quels : aucun champ nouveau, donc Vélin, aucun ornement, Alegreya, mode de l'app. Leur rendu ne change pas.
- **Version antérieure qui ouvre un monde récent** : serde ignore les champs inconnus, donc un thème `custom` élargi s'affiche avec son fond et son accent, sans le reste. Un `preset` nouveau (`grimoire`…) s'affiche comme « Par défaut ». La 1.7.1 et les versions avant elle réécrivent `world.json` à chaque ouverture (date de dernière ouverture) : les nouveaux champs sont donc perdus **dès la première ouverture** dans l'une d'elles, pas seulement si l'on y change le thème. C'est accepté par le manager (pas de correctif 1.7.x : un seul utilisateur, retour en arrière peu probable) : seul le thème est concerné, jamais le contenu. Les versions qui suivent celle-ci gardent les champs inconnus.
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

## Choix de Clément (2026-11-05)

1. Les trois ambiances des maquettes, complètes : Grimoire, Station, Crypte.
2. Police des titres de Station : **Oxanium** (SIL OFL), livrée avec l'app.
3. Un monde peut imposer le mode clair ou sombre ; « Suivre l'app » reste le défaut.
4. À la création, le thème proposé selon le genre et les tonalités est **présélectionné**, et on peut le changer.
5. Le thème Atlas du wiki s'applique aussi aux mondes existants sans réglage de wiki.

## Amendement (2026-11-06, choix de Clément, #574)

1. **Crypte impose le sombre.** C'est le premier thème fourni à user du §3 : son `look` dans `presets.ts` porte `scheme: "dark"`, appliqué comme le « Toujours sombre » d'un thème personnalisé (#550). Grimoire, Station et les huit autres suivent l'app. `world.json` ne change pas (`{ "kind": "preset", "id": "crypt" }`).
2. **« Modifier » garde les deux accents.** Le thème `custom` gagne un champ facultatif `accentLight` (`#rrggbb`, l'accent du mode clair) ; `accent` reste l'accent sombre, et celui du clair quand `accentLight` manque. Absent, il n'est pas écrit : les thèmes de la 1.7.x et de la 1.8 s'ouvrent et se réécrivent à l'identique. Une valeur qui n'est pas une couleur est lue comme absente, avec un avertissement, et réécrite telle quelle (comme les choix du §4). Choisir une autre couleur d'accent retire `accentLight`. « Modifier » reprend aussi le mode imposé dans `scheme` : une Crypte personnalisée reste sombre (pour Clément, c'est toujours Crypte) ; Grimoire et Station personnalisés suivent l'app.
3. **Version antérieure** : la 1.8 garde `accentLight` comme clé inconnue et affiche l'accent clair dérivé de `accent`. Si l'on y change l'accent, l'ancien `accentLight` reste écrit et reviendra en clair dans une version plus récente : accepté (un seul utilisateur, retour en arrière peu probable, seul l'accent est en jeu).
4. Les titres de Station restent tels qu'on les tape (pas de capitales imposées), et le thème du wiki des mondes existants n'est pas changé automatiquement (§8 inchangé).
