# Architecture

> Squelette. Ce document est complété au fil des issues de M0, dès que le code correspondant existe.

## Vue d'ensemble

BuilderZ est une app Tauri 2 en deux couches (voir ADR 0001) :

- **Rust (`src-tauri/`)** : possède toutes les données et tous les accès disque. Il expose des commandes Tauri typées via `tauri-specta`.
- **React (`src/`)** : toute la logique d'interface. Il appelle le Rust uniquement par les bindings générés dans `src/lib/bindings.ts`, enveloppés dans des hooks TanStack Query.

```
React (UI)  ──bindings.ts──▶  commandes Tauri  ──▶  domain  ──▶  db (SQLite) / world (dossier)
```

## Front (`src/`)

À compléter (issues 0.2, 0.5, 0.6, 0.7) : coque, routing, état, design system (ADR 0003), i18n.

## Back (`src-tauri/`)

À compléter (issues 0.8, 0.9, 0.10) : couches `commands` / `domain` / `db` / `world`, `AppError`, logs.

## Format d'un monde

Voir ADR 0001, section « Format des données ». À compléter avec le schéma réel lors de l'issue 0.9.

## Tests

À compléter (issues 0.3, 0.4, 0.12) : Vitest, `cargo test`, WebdriverIO + `tauri-driver`.
