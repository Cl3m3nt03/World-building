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

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm tauri dev` | Lancer l'app en développement |
| `pnpm check` | Tout vérifier (à lancer avant chaque PR) |
| `pnpm test` / `cargo test` | Tests front / Rust |
| `pnpm test:e2e` | Tests de bout en bout |
| `pnpm tauri build` | Construire l'installeur |

Ces commandes arrivent avec les issues 0.2 et 0.3 de M0.

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
