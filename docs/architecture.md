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
| `/` | Écran de démarrage : créer, ouvrir, mondes récents (`src/features/world`) |
| `/world/$worldId` | Accessible seulement si ce monde est le monde ouvert côté Rust (sinon retour à `/`) ; redirige vers `/world/$worldId/home` |
| `/world/$worldId/home` · `/world` · `/wiki` · `/quill` | Onglets de la coque (`WorldLayout`) |

- L'historique est en **hash** (`#/world/…`) : l'app desktop n'a pas de serveur pour réécrire les liens profonds, et un rechargement garde la route courante.
- Les onglets de la barre du haut sont pilotés par l'URL (`WorldLayout`).
- **Garde** : le `beforeLoad` de `/world/$worldId` lit le monde ouvert (`current_world`, via le cache TanStack Query passé en contexte du router). Une URL seule ne peut donc pas « ouvrir » un monde : on passe toujours par `create_world` ou `open_world`.
- Le bouton « Mondes » ferme le monde (`close_world`) puis revient à `/`.
- Une route inconnue affiche `NotFoundScreen`.

### État

- **Données du monde** : TanStack Query, par-dessus les commandes Tauri (à partir de 0.8). Client configuré dans `src/lib/query.ts` (pas de retry, données fraîches jusqu'à invalidation, puisque le Rust est le seul à écrire). Conventions de clés décrites dans ce fichier : le domaine d'abord, puis le détail (`["cards", worldId, "detail", cardId]`), avec une fabrique de clés par feature dans `src/features/<module>/hooks/keys.ts`.
- **État d'interface** : Zustand, `src/app/stores/ui.ts` (thème, transparence, largeur de la sidebar). Jamais de données du monde dans ce store. `useThemeSync` répercute le thème et la transparence sur `<html>`.

### Erreurs

- Une erreur de rendu dans une route est captée par le router (`defaultErrorComponent`), une erreur hors du router par l'`ErrorBoundary` global. Les deux affichent `ErrorScreen` : message, détails techniques repliés, boutons « Recharger » et « Retour aux mondes ». Jamais d'écran blanc.

### Dossiers de l'app et `BUILDERZ_HOME`

`src-tauri/src/paths.rs` centralise les dossiers de l'app : réglages (`%APPDATA%pp.builderz.desktop`), logs (`%LOCALAPPDATA%pp.builderz.desktop\logs`) et emplacement proposé pour les nouveaux mondes (`Documents\BuilderZ`, via la commande `default_worlds_dir`). Si la variable d'environnement **`BUILDERZ_HOME`** est définie, les trois vont dans `$BUILDERZ_HOME\config`, `\logs` et `\worlds`. Les tests de bout en bout s'en servent pour ne jamais toucher aux vrais réglages ni au dossier Documents.

### Tests de bout en bout

- **WebdriverIO** pilote l'app réelle via **tauri-driver** (2.0.6), qui relaie vers **msedgedriver** (WebView2). Config : `e2e/wdio.conf.ts`, scénarios : `e2e/specs/*.e2e.ts`.
- `pnpm test:e2e` :
  1. installe dans `e2e/.bin/` le msedgedriver de la **même version** que le runtime WebView2 du poste (`scripts/install-msedgedriver.ps1`, version lue dans le registre) ;
  2. construit l'app en debug avec le front embarqué (`tauri build --debug --no-bundle`) ; `E2E_SKIP_BUILD=1` saute cette étape ;
  3. lance les scénarios avec un `BUILDERZ_HOME` temporaire, supprimé à la fin (`E2E_KEEP_HOME=1` pour le garder et l'inspecter).
- Prérequis local : `cargo install tauri-driver@2.0.6 --locked`.
- Sélecteurs : de préférence par rôle et libellé accessible (`aria/Nom`, `button=Créer`), ce qui vérifie aussi l'accessibilité.
- **Dialogues natifs** : WebDriver ne sait pas piloter les boîtes de dialogue de fichiers de Windows, et Tauri verrouille `window.__TAURI_INTERNALS__` (impossible de remplacer `invoke` depuis la page). Tous les sélecteurs de fichier ou de dossier du front passent donc par `openDialog` (`src/lib/dialogs.ts`). Dans une build faite pour les tests (`VITE_E2E=1`, posé par `e2e/wdio.conf.ts` avant la construction), `openDialog` prend d'abord ses réponses dans `window.__bzE2eDialogAnswers`, que les scénarios remplissent (`pickNext`). Vite remplace le drapeau à la construction : les builds normales ne contiennent pas ce code. Tout le reste (import, relocalisation…) passe réellement par Rust.
- Relancer l'app dans un scénario : `browser.reloadSession()` (tauri-driver relance l'exécutable, avec le même `BUILDERZ_HOME`).
- CI : job dédié « End-to-end tests » sur `windows-latest`. En cas d'échec, il publie l'artefact `e2e-logs` : log verbeux de msedgedriver (`E2E_DRIVER_LOG`), logs de l'app et de WebView2.

**Deux pièges du runner Windows, corrigés** (à ne pas défaire) :

1. **Profil WebView2** : msedgedriver crée le profil dans son dossier temporaire, qui est `C:\Windows\SystemTemp` sur le runner. WebView2 ne peut pas l'utiliser. `e2e/wdio.conf.ts` impose donc `webviewOptions.userDataFolder` dans le `BUILDERZ_HOME` du test (l'argument `--user-data-dir` est ignoré en mode WebView2).
2. **Arguments de WebView2** : Tauri passe ses propres arguments à WebView2 par l'API (`--disable-features=msWebOOUI,…`). Sur le runner, ils **remplacent** la variable `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` par laquelle msedgedriver demande `--remote-debugging-port` : la session échouait avec « DevToolsActivePort file doesn't exist ». La fenêtre principale est donc déclarée avec `"create": false` dans `tauri.conf.json` et créée dans `setup` (`src-tauri/src/window.rs`) avec la **fusion** des arguments de Tauri et de la variable d'environnement. Hors tests, la variable est vide et rien ne change.

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
- **Médiathèque** (`src-tauri/src/domain/media.rs`, requêtes dans `src-tauri/src/db/assets.rs`) : table `assets` (migration `0002`) avec, pour chaque fichier, le nom affiché (modifiable, le fichier garde son hash), le type (`image`, `audio`, `other`, déduit du type MIME), la taille, les dimensions des images (lues dans l'en-tête avec `imagesize`) et la date d'import. Commandes : `import_asset` (renvoie `{ asset, created }` ; un contenu déjà présent renvoie l'asset existant avec son nom actuel), `list_assets({ kind?, search? })` (plus récents d'abord ; les caractères `%` et `_` de la recherche sont pris littéralement), `rename_asset`, `delete_asset` (supprime la ligne et le fichier ; si c'était l'image principale du monde, le monde n'en a plus).
- **Collage** : `import_asset_data(name, data)` reçoit les octets d'une image collée (50 Mo au plus), les écrit dans un fichier temporaire de `assets/` puis suit le même chemin que `import_asset`, sous le nom donné.
- **Reprise des fichiers existants** : à l'ouverture d'un monde, les fichiers de `assets/` sans ligne en base (importés en 0.1.0) sont enregistrés, avec leur identifiant comme nom.

### Base de données

- **SQLite via sqlx**, requêtes écrites avec les macros `query!` / `query_scalar!`, vérifiées à la compilation contre le cache `src-tauri/.sqlx/` (versionné). La CI compile avec `SQLX_OFFLINE=true`, sans base.
- Après avoir modifié une migration ou une requête : `pnpm db:prepare` (installe une base de dev dans `src-tauri/target/sqlx-dev.db`, applique les migrations, régénère `.sqlx/`), puis committer `.sqlx/`. Il faut `sqlx-cli` : `cargo install sqlx-cli --no-default-features --features sqlite`.
- Migrations dans `src-tauri/migrations/`, nommées `NNNN_description.sql`. **On ne modifie jamais une migration fusionnée** : on en ajoute une.
- Connexion : journal WAL, `synchronous = NORMAL`, clés étrangères actives, `busy_timeout` de 5 s, pool de 4 connexions. Sans l'extension `load-extension` de SQLite.
- Tests : requêtes non vérifiées (`sqlx::query`) autorisées dans les tests qui utilisent les migrations de test (`src-tauri/tests/fixtures/`), dont les tables n'existent pas dans le vrai schéma.

### Vignettes des mondes

La liste des mondes affiche l'image principale de chaque monde **sans l'ouvrir** : une vignette (640 px au plus sur le grand côté, jamais agrandie, PNG) est mise en cache dans `<dossier de config>	humbnails\<id du monde>.png` (`src-tauri/src/thumbnails.rs`, crate `image`). Elle est regénérée quand l'image principale change (`set_world_main_image`), créée à l'ouverture d'un monde si elle manque, et supprimée si le monde n'a plus d'image. Les mondes récents mémorisent l'identifiant, le genre et la présence d'une vignette. Le protocole `bzthumb://<id>` la sert en lecture seule ; il n'accepte qu'un UUID, donc aucun autre fichier du dossier de config n'est atteignable. La CSP l'autorise pour `img-src` seulement.

### Réglages de l'app

`settings.json` dans `%APPDATA%pp.builderz.desktop\` : préférences (langue, thème, effets de transparence), dossier des nouveaux mondes (`defaultWorldsDir`, chemin absolu ou `null` pour `Documents\BuilderZ`, via `set_default_worlds_dir` ; `default_worlds_dir` renvoie ce choix sinon la valeur par défaut) et mondes récents (10 au plus, le plus récent d'abord). Écriture atomique. Un fichier absent donne les valeurs par défaut ; un fichier illisible est mis de côté (`settings.corrupted.json`) et remplacé par les valeurs par défaut, sans bloquer le démarrage. Les champs manquants ou inconnus sont tolérés.

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

Les fichiers JSON (`world.json`, `settings.json`) sont lus même s'ils commencent par un BOM UTF-8 (fichier retouché avec le Bloc-notes ou PowerShell).

`world.json` :

```json
{
  "format": "builderz-world",
  "id": "5f0c…",
  "name": "Eldefleur",
  "genre": "fantasy",
  "description": "Un royaume de brumes…",
  "mainImage": "2cf24dba…9824.png",
  "schemaVersion": 1,
  "createdAt": "2026-09-26T12:00:00Z",
  "updatedAt": "2026-09-26T12:00:00Z",
  "lastOpenedAt": "2026-09-26T12:00:00Z"
}
```

- `schemaVersion` est le numéro de la dernière migration appliquée. `format` permet de reconnaître un dossier BuilderZ.
- `genre` (`fantasy`, `scienceFiction`, `romance`, `cyberpunk`, `contemporary`, `other`), `description` et `mainImage` (identifiant d'asset) sont apparus après la 0.1.0 : ils sont optionnels à la lecture, un monde plus ancien s'ouvre avec `other`, une description vide et pas d'image. Ils se modifient avec `update_world(patch)` (nom, genre, description ; champs absents inchangés) et `set_world_main_image(assetId | null)` (l'asset doit exister dans `assets/`). Renommer un monde met aussi à jour son nom dans les mondes récents.
- **Création** (`create_world(parentDir, name)`) : le monde est créé dans un **nouveau dossier à son nom** dans `parentDir`. Le nom de dossier est dérivé par Rust (`world::folder_name`) : caractères interdits sous Windows et caractères de contrôle retirés, espaces fusionnés, pas de point ni d'espace final, noms réservés (`CON`, `NUL`, `COM1`…) suffixés par `_`, 100 caractères au plus. Ce dossier ne doit pas exister ou doit être vide. En cas d'échec, ce qui a été créé est retiré.
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

## Releases

Automatisées par **release-please** et **tauri-action** (`.github/workflows/release.yml`), versions SemVer (ADR 0002) :

1. À chaque push sur `main`, release-please ouvre ou met à jour la **PR de release** : `CHANGELOG.md` (sections `feat`, `fix`, `perf` ; le reste est masqué) et la version dans `package.json`, `src-tauri/Cargo.toml` et `src-tauri/Cargo.lock`. `tauri.conf.json` n'a volontairement pas de champ `version` : Tauri reprend celle de `Cargo.toml` (et l'updater JSON de release-please reformaterait tout le fichier). Configuration : `release-please-config.json`, dernière version publiée : `.release-please-manifest.json`.
2. **Fusionner la PR de release** crée le tag `vX.Y.Z` et la release GitHub.
3. Dans le même workflow, le job « Windows installer » construit l'installeur NSIS (`BuilderZ_X.Y.Z_x64-setup.exe`) et l'attache à la release.

En phase `0.x`, une `feat` monte la version mineure et un changement cassant aussi (`bump-minor-pre-major`). La première release est fixée à `0.1.0` (`initial-version`, sans quoi release-please propose `1.0.0`) ; la `1.0.0` sera décidée à la fin de M8.

Dans `Cargo.lock`, seule l'entrée `builderz` est ciblée (`$.package[?(@.name.value==='builderz')].version` : le parseur TOML de release-please expose chaque valeur sous la forme `{ start, end, value }`).

Points d'attention :

- **Pourquoi un seul workflow** : un tag ou une PR créés avec le `GITHUB_TOKEN` de GitHub Actions ne déclenchent aucun autre workflow. Le build de l'installeur suit donc release-please dans le même workflow. Un tag `v*` poussé à la main déclenche aussi le build.
- **Checks obligatoires sur la PR de release** : pour la même raison, la CI ne tourne pas d'elle-même sur une PR ouverte avec `GITHUB_TOKEN`, et `main` exige des checks verts. Deux solutions :
  - fermer puis rouvrir la PR de release à la main, ce qui déclenche la CI ;
  - ou créer un jeton personnel à portée fine (dépôt `World-building`, droits *Contents* et *Pull requests* en écriture) et l'enregistrer comme secret `RELEASE_PLEASE_TOKEN` : le workflow l'utilise automatiquement et la CI tourne sur chaque mise à jour de la PR.
- Le réglage du dépôt « Allow GitHub Actions to create and approve pull requests » doit rester activé.
- L'installeur n'est **pas signé** : SmartScreen demande une confirmation au premier lancement (accepté dans l'ADR 0001).
