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

### Démarrage

`src/main.tsx` applique le thème initial, initialise i18n, puis rend `App`. `App` empile, de l'extérieur vers l'intérieur : `ErrorBoundary` global, `QueryClientProvider`, `TooltipProvider` et `RouterProvider`.

### Routing

**TanStack Router**, routes déclarées en code et typées dans `src/app/router.tsx` :

| Route | Écran |
|---|---|
| `/` | Liste des mondes (`src/features/world`) |
| `/world/$worldId` | Redirige vers `/world/$worldId/home` |
| `/world/$worldId/home` · `/world` · `/wiki` · `/quill` | Onglets de la coque (`WorldLayout`) |

- L'historique est en **hash** (`#/world/…`) : l'app desktop n'a pas de serveur pour réécrire les liens profonds, et un rechargement garde la route courante.
- Les onglets de la barre du haut sont pilotés par l'URL (`WorldLayout`).
- Une route inconnue affiche `NotFoundScreen`.

### État

- **Données du monde** : TanStack Query, par-dessus les commandes Tauri (à partir de 0.8). Client configuré dans `src/lib/query.ts` (pas de retry, données fraîches jusqu'à invalidation, puisque le Rust est le seul à écrire). Conventions de clés décrites dans ce fichier : le domaine d'abord, puis le détail (`["cards", worldId, "detail", cardId]`), avec une fabrique de clés par feature dans `src/features/<module>/hooks/keys.ts`.
- **État d'interface** : Zustand, `src/app/stores/ui.ts` (thème, transparence, largeur de la sidebar). Jamais de données du monde dans ce store. `useThemeSync` répercute le thème et la transparence sur `<html>`.

### Erreurs

- Une erreur de rendu dans une route est captée par le router (`defaultErrorComponent`), une erreur hors du router par l'`ErrorBoundary` global. Les deux affichent `ErrorScreen` : message, détails techniques repliés, boutons « Recharger » et « Retour aux mondes ». Jamais d'écran blanc.

### Tests front

Vitest, avec Testing Library et jsdom pour les tests de composants (directive `// @vitest-environment jsdom` en tête de fichier). `src/test/setup.ts` initialise i18n et fournit les API absentes de jsdom (`matchMedia`, `ResizeObserver`, `scrollTo`).

### Internationalisation

- **react-i18next**, initialisé dans `src/i18n/index.ts` avant le premier rendu. Français par défaut, anglais disponible. La langue choisie sera enregistrée dans les réglages de l'app (0.9).
- **Fichiers** : `src/i18n/fr.json` et `src/i18n/en.json`, avec des **clés plates** (`"shell.tabs.home"`), séparateurs de clés et de namespaces désactivés.
- **Typage** : `src/i18n/i18next.d.ts` branche les clés de `fr.json` sur les types d'i18next. Un `t("clé.inexistante")` ne compile pas.
- **Garde-fous** :
  - la règle Biome `style/noJsxLiterals` est en erreur : un texte écrit en dur dans du JSX fait échouer le lint (y compris dans `src/components/ui/`) ;
  - le test `src/i18n/i18n.test.ts`, lancé en CI, vérifie que `fr.json` et `en.json` ont exactement les mêmes clés et qu'aucune traduction n'est vide.
- Dans un composant : `const { t } = useTranslation();`. Les listes de libellés stockent des `TranslationKey`, traduites au rendu.
- `<html lang>` suit la langue active.

### Design system (ADR 0003)

- **Tokens** : `src/styles/tokens.css` définit la palette brute de l'ADR 0003, préfixée `--bz-*` (le thème clair est la base, le sombre la surcharge sous `[data-theme="dark"]`). Le préfixe évite le conflit avec les noms de shadcn : l'`--accent` ocre de l'ADR est `--bz-accent`, alors que l'`--accent` de shadcn désigne la surface de survol.
- **Couche sémantique** : `src/styles/globals.css` mappe les variables shadcn (`--background`, `--primary`, `--muted`…) sur les `--bz-*` et les expose à Tailwind (`bg-primary`, `text-muted-foreground`, `rounded-lg`…). Les composants n'utilisent que ces noms sémantiques, jamais les `--bz-*` ni une couleur en dur.
- **Verre dépoli** : l'utilitaire Tailwind `glass` (fond `--bz-surface`, bordure, `backdrop-filter`). Il est réservé aux panneaux de la coque. Quand la transparence est coupée (`<html data-transparency="off">` ou `prefers-reduced-transparency`), les tokens deviennent opaques et le flou tombe à zéro, sans toucher aux composants.
- **Thème** : `src/app/theme.ts` résout la préférence (clair, sombre, système) et la pose sur `<html data-theme>`. La variante Tailwind `dark:` s'appuie sur cet attribut. Par défaut, l'app suit le système et réagit à ses changements.
- **Polices** : Inter (texte, `font-sans`) et Space Mono 700 (titres, `font-heading`), embarquées via `@fontsource`.
- **Composants** : shadcn/ui (Radix) dans `src/components/ui/`, copiés dans le repo. Ils sont adaptés à `exactOptionalPropertyTypes` quand c'est nécessaire.

### Coque

`src/app/shell/` : `Backdrop` (image du monde floutée, ou dégradé des tokens), `TopBar` (trois îlots : monde courant, onglets Home / World / Wiki / Quill, actions) et `Workspace` (sidebar redimensionnable et zone centrale de l'onglet World, placeholders des autres onglets).

## Back (`src-tauri/`)

| Module | Rôle |
|---|---|
| `commands/` | Commandes Tauri, couche fine (voir plus bas) |
| `world/` | Format du dossier monde : création, ouverture, sauvegarde et migration, refus des versions plus récentes |
| `db/` | Connexion SQLite (WAL, clés étrangères), migrations embarquées (`MIGRATOR`), sauvegarde `VACUUM INTO` |
| `settings.rs` | Réglages de l'app (`settings.json` dans le dossier de config) |
| `state.rs` | État partagé : réglages et monde ouvert (un seul à la fois) |
| `domain/` | Logique métier, à venir avec M1 et M2 |

### Assets

- **Import** (`import_asset`, `src-tauri/src/world/assets.rs`) : le fichier est copié dans `assets/` du monde ouvert sous le nom `<sha256>.<ext>` (extension en minuscules, gardée seulement si elle est courte et alphanumérique). Le hachage se fait pendant la copie, dans un fichier temporaire ensuite renommé. Importer deux fois le même contenu ne le stocke qu'une fois (`created: false`). L'**identifiant d'un asset est ce nom de fichier**.
- **Affichage** : protocole dédié `bzasset://` (`src-tauri/src/protocol.rs`), servi sur Windows à `http://bzasset.localhost/<id>`. Côté front, `useAssetUrl(assetId)` / `assetUrl(assetId)` (`src/lib/assets.ts`) construisent l'URL, et `AssetImage` affiche une image.
- **Sécurité** (règle de l'ADR 0001 : « le protocole d'assets est limité au dossier `assets/` du monde ouvert ») :
  - le protocole `asset:` générique de Tauri n'est **pas** activé : il donne accès à des chemins arbitraires dans son scope ;
  - `bzasset://` n'accepte qu'un identifiant au format exact `<64 hexa>[.<ext>]`, vérifié avant tout accès disque (pas de séparateur, pas de `..`, pas de chemin absolu), et ne lit que dans `assets/` du monde **ouvert** : sans monde ouvert, tout est 404 ;
  - réponses avec `X-Content-Type-Options: nosniff` et une CSP `default-src 'none'` (un SVG ouvert seul ne peut pas exécuter de script) ;
  - la CSP de l'app n'autorise `bzasset:` que pour `img-src` et `media-src`.
- La médiathèque (M1) ajoutera les métadonnées des assets (nom, type, usages) dans la base.

### Base de données

- **SQLite via sqlx**, requêtes écrites avec les macros `query!` / `query_scalar!`, vérifiées à la compilation contre le cache `src-tauri/.sqlx/` (versionné). La CI compile avec `SQLX_OFFLINE=true`, sans base.
- Après avoir modifié une migration ou une requête : `pnpm db:prepare` (installe une base de dev dans `src-tauri/target/sqlx-dev.db`, applique les migrations, régénère `.sqlx/`), puis committer `.sqlx/`. Il faut `sqlx-cli` : `cargo install sqlx-cli --no-default-features --features sqlite`.
- Migrations dans `src-tauri/migrations/`, nommées `NNNN_description.sql`. **On ne modifie jamais une migration fusionnée** : on en ajoute une.
- Connexion : journal WAL, `synchronous = NORMAL`, clés étrangères actives, `busy_timeout` de 5 s, pool de 4 connexions. Sans l'extension `load-extension` de SQLite.
- Tests : requêtes non vérifiées (`sqlx::query`) autorisées dans les tests qui utilisent les migrations de test (`src-tauri/tests/fixtures/`), dont les tables n'existent pas dans le vrai schéma.

### Réglages de l'app

`settings.json` dans `%APPDATA%pp.builderz.desktop\` : préférences (langue, thème, effets de transparence) et mondes récents (10 au plus, le plus récent d'abord). Écriture atomique. Un fichier absent donne les valeurs par défaut ; un fichier illisible est mis de côté (`settings.corrupted.json`) et remplacé par les valeurs par défaut, sans bloquer le démarrage. Les champs manquants ou inconnus sont tolérés.

Côté front, `loadPreferences()` charge les préférences **avant** le premier rendu (pas de flash de thème), puis `usePreferencesSync()` les enregistre à chaque changement.

### Commandes et contrat front ↔ back

- Les commandes vivent dans `src-tauri/src/commands/` (couche fine : validation, appel du domaine, conversion des erreurs). Chacune est annotée `#[tauri::command]` et `#[specta::specta]`, puis enregistrée dans `specta_builder()` (`src-tauri/src/lib.rs`).
- **Bindings** : `src/lib/bindings.ts` est généré par **tauri-specta** à partir de `specta_builder()`. La génération se fait dans le test Rust `export_bindings`, donc à chaque `cargo test`. Pour la lancer seule : `pnpm bindings`. Le fichier est versionné, et la CI échoue s'il diffère de ce que produit le code (`git diff --exit-code`).
- Côté front, une commande renvoie `{ status: "ok", data } | { status: "error", error }`. Dans les hooks TanStack Query, `unwrap()` (`src/lib/ipc.ts`) transforme l'erreur en `IpcError`.
- **Permissions** : une permission par commande (ADR 0001). La liste des commandes est déclarée dans `src-tauri/build.rs` (`COMMANDS`). Tauri génère une permission `allow-<commande>` pour chacune, à accorder dans `capabilities/default.json`. Une commande absente de ces deux endroits est refusée à l'exécution.

Ajouter une commande : l'écrire dans `commands/`, l'ajouter à `specta_builder()` et à `COMMANDS`, accorder `allow-<commande>`, lancer `pnpm bindings` et committer `bindings.ts`.

### Erreurs

- Un seul type, `AppError` (`src-tauri/src/error.rs`, `thiserror`). Il est sérialisé en `{ code, message }` : `code` (`io`, `path_unavailable`, `internal`…) est traduit côté front par la clé i18n `errors.<code>`, et `message` n'est affiché que comme détail technique.
- Côté front, `AppErrorMessage` affiche le message traduit et le détail.
- Pas de `unwrap()` ni d'`expect()` hors des tests : clippy les refuse (`Cargo.toml`, `[lints.clippy]`).

### Logs

`tracing` écrit dans un fichier journalier de `%LOCALAPPDATA%\app.builderz.desktop\logs\` (14 fichiers gardés), et aussi sur la sortie d'erreur en debug. Le niveau par défaut est `info` (`debug` pour BuilderZ), modifiable avec `RUST_LOG`. Initialisation dans `src-tauri/src/logging.rs`.

### Windows : manifeste et tests

Tauri n'embarque le manifeste Windows (Common Controls v6) que dans l'exécutable de l'app. Les binaires de test plantaient donc au lancement (`STATUS_ENTRYPOINT_NOT_FOUND`). `build.rs` désactive ce manifeste et embarque `windows-app-manifest.xml` dans toutes les cibles via l'éditeur de liens.

## Format d'un monde

Voir ADR 0001, section « Format des données ». Implémenté dans `src-tauri/src/world/`.

```
MonMonde/
├── world.json            métadonnées (voir ci-dessous)
├── world.db              SQLite (+ world.db-wal / -shm pendant l'utilisation)
├── world.db.bak-v<N>     sauvegarde faite avant de migrer depuis la version N
└── assets/
```

`world.json` :

```json
{
  "format": "builderz-world",
  "id": "5f0c…",
  "name": "Eldefleur",
  "schemaVersion": 1,
  "createdAt": "2026-09-26T12:00:00Z",
  "updatedAt": "2026-09-26T12:00:00Z",
  "lastOpenedAt": "2026-09-26T12:00:00Z"
}
```

- `schemaVersion` est le numéro de la dernière migration appliquée. `format` permet de reconnaître un dossier BuilderZ.
- **Création** (`create_world`) : le dossier ne doit pas exister ou doit être vide. En cas d'échec, ce qui a été créé est retiré.
- **Ouverture** (`open_world`) :
  1. `world.json` doit être lisible et au bon format, sinon `world_invalid` ;
  2. un `schemaVersion` plus récent que l'app donne `world_too_new`, **sans rien modifier** ;
  3. `world.db` doit exister et être une base SQLite lisible, sinon `world_invalid` (jamais de base vide créée à la place) ;
  4. la version réellement appliquée est lue dans la base (`_sqlx_migrations`) ; plus récente que l'app, elle donne aussi `world_too_new` ;
  5. si des migrations sont en attente : copie cohérente dans `world.db.bak-v<N>` (`VACUUM INTO`), puis migration ;
  6. `world.json` est mis à jour (version, dates) par écriture atomique, et `assets/` est recréé s'il manque.
- **Un seul monde ouvert** : ouvrir un monde ferme le précédent, une fois le nouveau entièrement ouvert. Chaque ouverture met à jour les mondes récents.
- Le schéma initial (`0001_init.sql`) ne contient qu'une table `meta` (clé/valeur). Les tables métier arrivent avec leurs milestones.

## Tests

À compléter (issues 0.3, 0.4, 0.12) : Vitest, `cargo test`, WebdriverIO + `tauri-driver`.
