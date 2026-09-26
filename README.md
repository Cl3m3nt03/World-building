# BuilderZ

Application desktop Windows de worldbuilding, locale et mono-utilisateur : cartes (fiches) typées, Map interactive, Graph, Relation Tree, Canvas, Wiki et Quill (écriture).

> Projet personnel, sans distribution. Voir `docs/contexte.md` pour l'origine du projet et les décisions déjà prises.

## Stack

Tauri 2 · Rust (SQLite via `sqlx`) · React 19 + TypeScript · Vite · Tailwind + shadcn/ui. Détails et justifications dans `docs/adr/0001-stack-technique.md`.

## Prérequis (Windows)

- Rust stable via `rustup`
- Visual Studio Build Tools, composant « Développement Desktop en C++ »
- WebView2 (déjà présent sur Windows 11)
- Node.js LTS et pnpm
- GitHub CLI (`gh`)
- `tauri-driver` (pour `pnpm test:e2e`) : `cargo install tauri-driver@2.0.6 --locked`
- `sqlx-cli` (pour `pnpm db:prepare`) : `cargo install sqlx-cli --no-default-features --features sqlite`

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm tauri dev` | Lancer l'app en développement |
| `pnpm check` | Tout vérifier : format, lint, typecheck, tests front et Rust (à lancer avant chaque PR) |
| `pnpm format` | Formater le TS (Biome) et le Rust (rustfmt) |
| `pnpm lint` | Biome + `cargo clippy -D warnings` |
| `pnpm typecheck` | Vérifier les types TypeScript |
| `pnpm test` / `pnpm test:rust` | Tests front (Vitest) / Rust (`cargo test`) |
| `pnpm bindings` | Régénérer `src/lib/bindings.ts` à partir des commandes Rust |
| `pnpm db:prepare` | Régénérer le cache sqlx `src-tauri/.sqlx/` (après une migration ou une requête ; nécessite `sqlx-cli`) |
| `pnpm test:e2e` | Tests de bout en bout (WebdriverIO + tauri-driver, voir `docs/architecture.md`) |
| `pnpm tauri build` | Construire l'installeur |

## Hooks Git

`pnpm install` installe les hooks **lefthook** :

- **pre-commit** : Biome sur les fichiers indexés, `cargo fmt --check` et `cargo clippy -D warnings` si du Rust a changé. Les hooks vérifient sans rien réécrire : en cas de refus, lancer `pnpm format`.
- **commit-msg** : commitlint, format Conventional Commits (voir ADR 0002).

## Documentation

| Dossier | Contenu |
|---|---|
| `docs/contexte.md` | Pourquoi le projet existe, décisions déjà prises |
| `docs/adr/` | Décisions structurantes (stack, workflow, direction artistique…) |
| `docs/features/` | Spécifications fonctionnelles, un fichier par module |
| `docs/roadmap/` | Milestones et découpage en issues |
| `docs/architecture.md` | Vue d'ensemble du code |
| `CLAUDE.md` | Règles de travail pour Claude Code |

## Contribuer

GitHub Flow : une issue = une branche = une PR, Conventional Commits, squash merge. Voir `docs/adr/0002-workflow-et-conventions.md`.
