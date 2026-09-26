# CLAUDE.md — BuilderZ

BuilderZ est une application desktop Windows (Tauri 2) de worldbuilding, locale et mono-utilisateur. Elle comprend des cartes (fiches) typées, une Map interactive, un Graph, un Relation Tree, un Canvas, un Wiki et Quill (écriture).
Les specs fonctionnelles sont dans `docs/features/`, les décisions dans `docs/adr/` et la roadmap dans `docs/roadmap/`.
**Avant toute tâche, lis `docs/contexte.md` (pourquoi le projet existe, décisions déjà prises), l'ADR 0001 (stack) et l'ADR 0002 (workflow). Avant toute tâche d'interface, lis aussi l'ADR 0003 (direction artistique).**
Avant de travailler sur un module, lis sa spec dans `docs/features/`. Pour le détail visuel, consulte les captures du board FigJam via le MCP Figma : le file key et les nodes sont indiqués dans `docs/contexte.md`. On reproduit les comportements et la direction artistique de vvd, mais jamais ses fichiers (assets, logo, polices, CSS, textes).

## Règles de travail (non négociables)

1. **Une issue = une branche = une PR.** Ne jamais committer ni pousser sur `main`.
2. Branche nommée `<type>/<sujet>`, commits au format Conventional Commits en anglais.
3. Avant d'ouvrir une PR, `pnpm check` doit passer (lint, typecheck, tests front et Rust).
4. La PR suit le template, référence l'issue (`Closes #N`) et coche ses critères d'acceptation.
5. Si le comportement d'un module change, mettre à jour `docs/features/<module>.md` **dans la même PR**.
6. Toute décision structurante (nouvelle dépendance majeure, changement de format de données, choix d'architecture) donne lieu à un **nouvel ADR** dans la PR. Si le doute existe, demander à Clément avant d'agir.
7. Ne jamais ajouter de dépendance sans justification dans la description de la PR.

## Architecture (règles)

- **Le Rust possède les données.** Tout accès disque ou base passe par une commande Tauri. Le front n'utilise jamais `fs` directement.
- Toutes les commandes sont exposées via `tauri-specta`. Après modification, régénérer `src/lib/bindings.ts` (`pnpm bindings`) et le committer. Chaque nouvelle commande est aussi ajoutée à `COMMANDS` dans `src-tauri/build.rs` et accordée (`allow-<commande>`) dans `capabilities/default.json` (voir `docs/architecture.md`).
- Les erreurs passent par le type `AppError`. Pas de `unwrap()` ni d'`expect()` hors des tests.
- Les requêtes SQL passent par les macros `sqlx::query!` / `query_as!`, vérifiées à la compilation. Après une modification, lancer `pnpm db:prepare` (qui appelle `cargo sqlx prepare`) et committer `.sqlx/`.
- **Toute modification du schéma se fait par une nouvelle migration.** On ne modifie jamais une migration déjà fusionnée.
- Les données d'un monde ne passent jamais par `localStorage`.
- Aucune chaîne d'interface n'est écrite en dur : clés i18n, avec `fr.json` **et** `en.json` complétés ensemble.
- Les styles passent uniquement par les tokens (variables CSS) et Tailwind : pas de couleur en dur, et les deux thèmes doivent fonctionner.
- Accessibilité : utiliser les primitives Radix/shadcn, rendre tout le clavier navigable et libeller correctement.

## Arborescence

```
src/                      # Front React
├── app/                  # router, providers, layout de la coque
├── features/<module>/    # cards, map, graph, tree, canvas, wiki, quill, world…
│   ├── components/
│   ├── hooks/            # hooks TanStack Query autour des bindings
│   └── index.ts
├── components/ui/        # shadcn/ui
├── lib/                  # bindings.ts (généré), utils
├── i18n/                 # fr.json, en.json
└── styles/               # tokens, thèmes
src-tauri/
├── src/
│   ├── commands/         # commandes Tauri (couche fine)
│   ├── domain/           # logique métier, sans dépendance à Tauri
│   ├── db/               # accès SQLite
│   ├── world/            # format du dossier monde, migrations, sauvegardes
│   └── error.rs
├── migrations/
├── capabilities/
└── tauri.conf.json
e2e/                      # WebdriverIO
docs/                     # adr/, features/, roadmap/, architecture.md
```

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm tauri dev` | Lancer l'app en développement |
| `pnpm check` | Tout vérifier (à lancer avant chaque PR) |
| `pnpm test` / `cargo test` | Tests front / Rust |
| `pnpm test:e2e` | Tests de bout en bout |
| `pnpm tauri build` | Construire l'installeur |

## Langues

Le code, les commits et les PR sont en anglais. La documentation est en français.
