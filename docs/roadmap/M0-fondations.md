# M0 — Fondations

**Objectif** : obtenir une coque applicative complète, testée et distribuable, sans aucune feature métier. À la fin de M0, on installe BuilderZ depuis un `.exe`, on crée un monde vide sur le disque, et on le retrouve au relancement.

**Prérequis poste (Windows)** : Rust stable via `rustup`, Visual Studio Build Tools (composant « Développement Desktop en C++ »), WebView2 (déjà présent sur Windows 11), Node.js LTS, pnpm, GitHub CLI (`gh`).

**Ordre d'exécution** : 0.1 → 0.2 → 0.3 → 0.4, puis 0.5 à 0.9 dans l'ordre, puis 0.10 → 0.13.

---

## 0.1 — Initialisation du repo
**Branche** : `chore/repo-init` · **Dépend de** : —

- [ ] Créer le repo GitHub privé `builderz`
- [ ] Ajouter `README.md` (présentation, prérequis, commandes), `.gitignore` (Node + Rust + Tauri), `.editorconfig` et `.gitattributes` (fins de ligne LF)
- [ ] Ajouter `CLAUDE.md`, `docs/adr/0001`, `docs/adr/0002`, `docs/adr/0003` et `docs/roadmap/M0-fondations.md`
- [ ] Créer les dossiers `docs/features/` (un `.md` par module, rédigé à partir du board Figma) et `docs/architecture.md` (squelette)
- [ ] Ajouter les templates GitHub : `.github/pull_request_template.md` et `.github/ISSUE_TEMPLATE/feature.md`
- [ ] Créer les milestones M0 à M10 et les issues de M0 via `gh`

**Critères d'acceptation** : le repo existe, la doc est en place et toutes les issues de M0 sont créées et rattachées au milestone.

## 0.2 — Squelette Tauri + React
**Branche** : `chore/scaffold-tauri` · **Dépend de** : 0.1

- [ ] Initialiser Tauri 2 + React + TypeScript + Vite avec pnpm
- [ ] Configurer TypeScript en mode strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- [ ] Remplir `tauri.conf.json` : nom `BuilderZ`, identifiant `app.builderz.desktop`, fenêtre 1440×900 (minimum 1024×680), installeur NSIS
- [ ] Organiser l'arborescence comme décrit dans `CLAUDE.md`

**Critères d'acceptation** : `pnpm tauri dev` ouvre une fenêtre BuilderZ vide.

## 0.3 — Outillage qualité
**Branche** : `chore/tooling` · **Dépend de** : 0.2

- [ ] Configurer Biome (lint + format) pour le TS
- [ ] Configurer `rustfmt` et `clippy` avec `-D warnings`
- [ ] Mettre en place les hooks pre-commit avec **lefthook** : format, lint et **commitlint** (Conventional Commits)
- [ ] Créer les scripts `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm test` et `pnpm check` (qui lance tout)

**Critères d'acceptation** : un commit mal formaté ou avec un message non conforme est refusé.

## 0.4 — Intégration continue
**Branche** : `ci/github-actions` · **Dépend de** : 0.3

- [ ] Écrire un workflow `ci.yml` sur chaque PR, avec un runner `windows-latest` : lint, typecheck, Vitest, `cargo fmt --check`, `cargo clippy`, `cargo test`
- [ ] Mettre en cache pnpm et cargo
- [ ] Protéger `main` : PR obligatoire, CI verte obligatoire, pas de push direct

**Critères d'acceptation** : une PR avec un test en échec ne peut pas être fusionnée.

## 0.5 — Design system + coque d'interface
**Branche** : `feat/ui-shell` · **Dépend de** : 0.4

- [ ] Installer Tailwind et définir les tokens en variables CSS (couleurs, rayons, flous, espacements, typographie) à partir de l'ADR 0003
- [ ] Embarquer les polices Space Mono et Inter via `@fontsource`
- [ ] Mettre en place le thème clair et le thème sombre, en suivant par défaut le réglage du système
- [ ] Fond illustré flouté (image principale du monde, ou dégradé par défaut) et surfaces en verre dépoli, avec repli opaque si la transparence est désactivée
- [ ] Initialiser shadcn/ui et ajouter les composants de base (Button, Input, Dialog, DropdownMenu, Tooltip, ContextMenu, Tabs, ScrollArea)
- [ ] Construire la coque : barre du haut (monde courant, onglets Home / World / Wiki / Quill, actions), sidebar redimensionnable et zone centrale. Pour l'instant, ce sont des placeholders.

**Critères d'acceptation** : la coque s'affiche dans les deux thèmes et la sidebar se redimensionne.

## 0.6 — Internationalisation
**Branche** : `feat/i18n` · **Dépend de** : 0.5

- [ ] Configurer react-i18next avec les fichiers `src/i18n/fr.json` et `src/i18n/en.json`
- [ ] Utiliser le français par défaut et permettre de changer de langue
- [ ] Ajouter un contrôle dans la CI : les deux fichiers doivent avoir exactement les mêmes clés

**Critères d'acceptation** : toute la coque bascule entre FR et EN, et aucune chaîne n'est écrite en dur.

## 0.7 — Routing et état
**Branche** : `feat/routing-state` · **Dépend de** : 0.5

- [ ] Définir les routes TanStack Router : `/` (liste des mondes), `/world/$worldId/...` (onglets)
- [ ] Mettre en place TanStack Query (provider, conventions de clés) et Zustand (store UI : sidebar, thème)
- [ ] Ajouter un error boundary global avec un écran d'erreur propre

**Critères d'acceptation** : la navigation entre les routes fonctionne et une erreur de rendu affiche l'écran d'erreur au lieu d'un écran blanc.

## 0.8 — IPC typé et gestion d'erreurs
**Branche** : `feat/typed-ipc` · **Dépend de** : 0.2

- [ ] Intégrer `tauri-specta` et générer `src/lib/bindings.ts`
- [ ] Créer le type `AppError` (`thiserror`), sérialisé avec un code et un message traduisible
- [ ] Brancher les logs `tracing` : fichier de log dans le dossier de logs de l'app, avec rotation
- [ ] Ajouter une vérification CI qui échoue si les bindings ne sont pas à jour
- [ ] Écrire une commande d'exemple `app_info` (version, chemins) affichée dans l'interface

**Critères d'acceptation** : le front appelle une commande Rust avec des types générés, et une erreur Rust s'affiche proprement côté front.

## 0.9 — Couche données
**Branche** : `feat/world-storage` · **Dépend de** : 0.8

- [ ] Intégrer `sqlx` avec SQLite (WAL activé, clés étrangères actives)
- [ ] Écrire le module `world` : `create_world(path, name)`, `open_world(path)`, `close_world()`, avec un seul monde ouvert à la fois
- [ ] Définir le format du dossier : `world.json` (id, nom, `schema_version`, dates), `world.db` et `assets/`
- [ ] Embarquer les migrations et faire une sauvegarde automatique avant chaque migration
- [ ] Refuser d'ouvrir un monde dont le `schema_version` est plus récent que celui de l'app
- [ ] Stocker les réglages de l'app (langue, thème, mondes récents) dans le dossier de config de l'app
- [ ] Mettre en place le cache `.sqlx/` versionné et `SQLX_OFFLINE=true` en CI
- [ ] Écrire les tests Rust dans des dossiers temporaires : création, réouverture, migration, refus de version, dossier corrompu

**Critères d'acceptation** : tous les cas ci-dessus sont couverts par des tests qui passent.

## 0.10 — Stockage des assets
**Branche** : `feat/assets` · **Dépend de** : 0.9

- [ ] Écrire la commande `import_asset(file)`, qui copie le fichier dans `assets/` sous le nom `<sha256>.<ext>` (dédoublonnage)
- [ ] Limiter le protocole `asset:` au dossier `assets/` du monde ouvert
- [ ] Écrire un hook front `useAssetUrl(assetId)`

**Critères d'acceptation** : une image importée s'affiche dans l'interface, et un chemin hors du dossier `assets/` est refusé.

## 0.11 — Écran de démarrage minimal
**Branche** : `feat/world-picker` · **Dépend de** : 0.6, 0.7, 0.9

- [ ] Sur l'écran `/`, permettre de créer un monde (nom + choix du dossier), d'ouvrir un monde existant et d'afficher la liste des mondes récents
- [ ] Ouvrir la coque de l'app quand un monde est ouvert

**Critères d'acceptation** : on crée un monde, on ferme l'app, on la relance et le monde apparaît dans les récents et s'ouvre. (La Home complète arrivera en M1.)

## 0.12 — Tests de bout en bout
**Branche** : `test/e2e-setup` · **Dépend de** : 0.11

- [ ] Installer WebdriverIO + `tauri-driver` et Edge WebDriver
- [ ] Écrire un scénario smoke : lancer l'app, créer un monde, vérifier qu'il s'ouvre
- [ ] Ajouter un job CI dédié sur `windows-latest`

**Critères d'acceptation** : le scénario passe en CI.

## 0.13 — Release et installeur
**Branche** : `ci/release` · **Dépend de** : 0.12

- [ ] Configurer release-please pour le `CHANGELOG.md`, la montée de version (`package.json` + `Cargo.toml` + `tauri.conf.json`) et la PR de release
- [ ] Sur un tag `v*`, construire l'installeur NSIS avec `tauri-action` et l'attacher à la GitHub Release

**Critères d'acceptation** : la release `v0.1.0` contient un `.exe` qui s'installe et lance BuilderZ.

---

## Définition de « M0 terminé »

1. Le `.exe` de `v0.1.0` s'installe sur une machine Windows propre.
2. On peut créer, fermer, rouvrir et retrouver un monde.
3. La CI est verte sur `main`, avec le lint, les tests Rust et front et le test de bout en bout.
4. Les ADR, le `CLAUDE.md`, `docs/features/` et `docs/architecture.md` sont à jour.
