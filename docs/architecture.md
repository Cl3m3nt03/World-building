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
- Scénarios : `smoke` (création d'un monde), `m1-worlds` (mondes, réglages, relocalisation), `m2-cards` (propriété de type sur les cartes anciennes et nouvelles, propriété lien et mention avec leurs rétroliens, template guidé appliqué sans rien perdre). Chaque fichier crée ses propres mondes ; ils partagent le `BUILDERZ_HOME` de la série.
- Les menus Radix s'ouvrent par un clic WebDriver. Pour nommer une carte, le scénario clique dans le titre et le sélectionne (`Ctrl+A`) au lieu de compter sur la sélection automatique du titre d'une nouvelle carte, dont le moment dépend de WebDriver ; ce comportement est couvert par les tests unitaires. Un sélecteur WebdriverIO ne mélange pas CSS et texte : `$("section…").$("a=Gondor")`.
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

`src/app/shell/` : `Backdrop` (image du monde floutée, ou dégradé des tokens), `TopBar` (trois îlots : monde courant, onglets Home / World / Wiki / Quill, actions) et `Workspace` (sidebar redimensionnable et zone centrale de l'onglet World, placeholders des autres onglets). `WorldLayout` monte aussi les écrans ouverts depuis plusieurs endroits : types de cartes et réglages du monde.

Les réglages du monde (`src/features/world-settings`) assemblent plusieurs features (monde, médiathèque, types) : ils vivent à part pour que `features/world` ne dépende d'aucune d'elles. La section ouverte est dans le store UI (`worldSettings`, `null` quand l'écran est fermé), ce qui permet d'ouvrir l'écran sur une section précise. Les onglets des sections utilisent les primitives Radix, et non les composants shadcn : les styles verticaux de ces derniers (`group-data-vertical/tabs`) s'appliqueraient aussi aux onglets horizontaux imbriqués (Explorer / Modifier du thème).

Le thème du monde (`src/features/world-theme`) : `presets.ts` (thèmes fournis, couleurs proposées, `resolveTheme` qui donne le fond et l'accent d'un thème), `accent.ts` (variante lisible de l'accent pour chaque mode, contraste 3:1 avec `--bz-bg`, et texte posé sur l'accent). `Backdrop` affiche le fond du thème et applique son accent avec `useWorldAccent`, qui pose `--bz-world-accent-{light,dark}` et `--bz-world-accent-foreground-{light,dark}` sur `<html>` ; `tokens.css` en fait `--bz-accent`, avec l'ocre par défaut quand elles sont absentes. `useSetWorldTheme` affiche le nouveau thème avant la réponse du Rust et revient au thème enregistré en cas d'échec. Les illustrations sont des SVG générés par `scripts/theme-illustrations.py` (déterministe).

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
- **Médiathèque** (`src-tauri/src/domain/media.rs`, requêtes dans `src-tauri/src/db/assets.rs`) : table `assets` (migration `0002`) avec, pour chaque fichier, le nom affiché (modifiable, le fichier garde son hash), le type (`image`, `audio`, `other`, déduit du type MIME), la taille, les dimensions des images (lues dans l'en-tête avec `imagesize`) et la date d'import. Commandes : `import_asset` (renvoie `{ asset, created }` ; un contenu déjà présent renvoie l'asset existant avec son nom actuel), `list_assets({ kind?, search? })` (plus récents d'abord ; les caractères `%` et `_` de la recherche sont pris littéralement), `rename_asset`, `delete_asset` (supprime la ligne et le fichier ; si c'était l'image principale du monde ou le fond de son thème, le monde ne l'utilise plus).
- **Collage** : `import_asset_data(name, data)` reçoit les octets d'une image collée (50 Mo au plus), les écrit dans un fichier temporaire de `assets/` puis suit le même chemin que `import_asset`, sous le nom donné.
- **Reprise des fichiers existants** : à l'ouverture d'un monde, les fichiers de `assets/` sans ligne en base (importés en 0.1.0) sont enregistrés, avec leur identifiant comme nom.

### Base de données

- **SQLite via sqlx**, requêtes écrites avec les macros `query!` / `query_scalar!`, vérifiées à la compilation contre le cache `src-tauri/.sqlx/` (versionné). La CI compile avec `SQLX_OFFLINE=true`, sans base.
- Après avoir modifié une migration ou une requête : `pnpm db:prepare` (installe une base de dev dans `src-tauri/target/sqlx-dev.db`, applique les migrations, régénère `.sqlx/`), puis committer `.sqlx/`. Il faut `sqlx-cli` : `cargo install sqlx-cli --no-default-features --features sqlite`.
- Migrations dans `src-tauri/migrations/`, nommées `NNNN_description.sql`. **On ne modifie jamais une migration fusionnée** : on en ajoute une.
- Connexion : journal WAL, `synchronous = NORMAL`, clés étrangères actives, `busy_timeout` de 5 s, pool de 4 connexions. Sans l'extension `load-extension` de SQLite.
- Tests : requêtes non vérifiées (`sqlx::query`) autorisées dans les tests qui utilisent les migrations de test (`src-tauri/tests/fixtures/`), dont les tables n'existent pas dans le vrai schéma.

### Documents, corbeille et liens

- **Documents** (`src-tauri/src/domain/documents.rs`, requêtes dans `src-tauri/src/db/documents.rs`, migration `0003`) : table `documents` commune à tous les modules (carte, map, graph, canvas, arbre) avec l'identifiant (UUID), la nature, le titre (sans espaces autour, 200 caractères au plus, jamais vide), les dates de création, de modification, de dernière ouverture et de mise à la corbeille. Chaque module ajoute ses propres tables, reliées à `documents` par une clé étrangère `ON DELETE CASCADE`. Les colonnes de M3 (dossier, parent, ordre, épingle) et de M8 (visibilité wiki) arriveront par leurs propres migrations.
- **Corbeille** : `trash_document` renseigne `trashed_at`, `restore_document` l'efface ; un document à la corbeille n'apparaît plus dans les listes. `delete_document` (réservé aux documents de la corbeille) et `empty_trash` suppriment pour de bon, avec les liens *émis* par le document. `list_documents({ kind?, trashed })` trie par titre. `rename_document` renomme.
- **Liens** (`src-tauri/src/domain/links.rs`, table `links`) : source (document, plus tard chapitre de Quill), cible, nature (`mention`, `property`, `map_pin`) et détail (identifiant de propriété, d'épingle… ou vide). Chaque module remplace les liens qu'il possède à chaque sauvegarde (`links::replace`). La table n'a pas de clé étrangère : un lien vers un document supprimé pour de bon reste, comme **référence morte**.

### Types de cartes

- **Types** (`src-tauri/src/domain/card_types.rs`, requêtes dans `src-tauri/src/db/card_types.rs`, migration `0004`) : table `card_types` avec le parent (pour un sous-type ; un sous-type n'a pas de sous-types, et supprimer un type supprime ses sous-types), le nom (80 caractères au plus), l'icône (nom lucide en kebab-case), la couleur (une des couleurs de la palette des types : `red`, `orange`, `amber`, `green`, `teal`, `blue`, `violet`, `pink`, `slate`), le template guidé (JSON `[{ title, prompt }]`), l'orientation (`portrait`, `landscape`), le format canvas (`compact`, `standard`, `tall`, `wide`, vérifié côté Rust et non par la base, pour pouvoir évoluer avec le canvas) et l'ordre.
- **Commandes** : `list_card_types` (chaque type suivi de ses sous-types), `create_card_type`, `update_card_type(id, patch)`, `duplicate_card_type(id, name)` (avec les sous-types), `reorder_card_types(ids)` (tous les frères, dans le nouvel ordre), `delete_card_type(id, moveCardsTo)`.
- **Types par défaut** (`src-tauri/src/domain/card_types/defaults.rs`) : créés à la création d'un monde selon son genre, et une seule fois à la première ouverture d'un monde plus ancien. Leurs noms et templates sont écrits dans la langue de l'app à ce moment-là : ce sont des données du monde, modifiables ensuite. La clé `card_types_seeded` de la table `meta` retient que c'est fait : supprimer tous les types ne les fait pas revenir. Un échec n'empêche pas d'ouvrir le monde (il est journalisé).

### Cartes

- **Cartes** (`src-tauri/src/domain/cards.rs`, requêtes dans `src-tauri/src/db/cards.rs`, migration `0005`) : table `cards` reliée à `documents` (`ON DELETE CASCADE`) avec le type ou sous-type, l'image (identifiant d'asset, sans clé étrangère : supprimer l'asset la retire des cartes), les alias (JSON), le contenu en blocs (JSON, 2.9) et son texte brut (pour la recherche). La carte se lit jointe à son document (titre, dates, corbeille).
- **Commandes** : `create_card(typeId, title)` (le document et la carte sont écrits dans une même transaction), `get_card`, `set_card_type`, `set_card_image(id, assetId | null)`, `set_card_aliases` (sans espaces autour, sans doublons ni vides, 20 au plus), `count_type_cards` ; le titre se change avec `rename_document`, la corbeille avec `trash_document`. Chaque modification met à jour la date de modification du document.
- **Suppression d'un type** : `delete_card_type` refuse de supprimer un type qui a des cartes (les siennes ou celles de ses sous-types) sans type de destination, et les y déplace dans la même transaction que la suppression.
- **Front** : route `/world/$worldId/world/card/$cardId` (page de la carte dans l'espace de travail) ; `/world/$worldId/world` sans document affiche « Commencer par… ».
- **Récents** : la page d'une carte appelle `mark_document_opened` à son ouverture (colonne `opened_at`) ; `recent_documents(limit)` renvoie les documents ouverts, hors corbeille, du plus récent au plus ancien, avec l'image et le type des cartes ; `count_cards_by_type` compte les cartes hors corbeille par type ou sous-type.
- **Liste** : `list_cards(trashed)` renvoie les cartes (ou celles de la corbeille) par nom, avec leur type, pour la sidebar de M2 et la corbeille.
- **Création depuis un menu** : l'élément de menu qui lance la création est démonté quand le menu se ferme ; la suite (ouvrir la carte) passe donc par la promesse de `mutateAsync`, pas par les callbacks de `mutate`, qui ne s'exécutent pas pour un appelant démonté.

### Propriétés des cartes

- **Tables** (`src-tauri/src/domain/properties.rs`, requêtes dans `src-tauri/src/db/properties.rs`, migration `0006`) : `property_definitions` (propriétaire : un type **ou** une carte, libellé, nature `text` / `number` / `card` / `cards`, types cibles des liens, `applies_to_existing`, ordre, date de création) et `property_values` (une valeur JSON par carte et propriété ; supprimer la carte ou la propriété supprime ses valeurs).
- **Ce qu'une carte affiche** (`card_properties`) : les propriétés du type parent (pour un sous-type), puis celles de son type, puis les siennes. Une propriété de type ne s'affiche sur une carte créée avant elle que si `applies_to_existing` est vrai (`apply_property_to_existing`, le « Oui » du bandeau).
- **Valeurs** (`set_property_value`) : la nature doit correspondre ; texte de 10 000 caractères au plus, nombre fini, 200 cartes au plus par lien multiple ; une valeur vide est retirée. Une valeur lien doit viser une carte hors corbeille d'un type autorisé (un sous-type est autorisé si son type l'est), et remplace les liens `property` de la carte pour cette propriété.
- **Commandes** : `list_type_properties`, `card_properties`, `create_property(owner, label, kind)`, `rename_property`, `set_property_kind` (efface les valeurs et leurs liens si la nature change), `apply_property_to_existing`, `reorder_properties`, `count_property_values`, `delete_property` (avec ses valeurs et ses liens), `set_property_value`.

### Enregistrements en attente et fermeture

Le texte (blocs, nom de la carte, propriétés texte) est enregistré peu après la dernière frappe. Un enregistrement envoyé après la fermeture du monde échouerait (`no_world_open`) et le texte serait perdu. Chaque éditeur déclare donc comment s'enregistrer tout de suite (`usePendingSave`, `src/lib/pendingSaves.ts`) ; `flushPendingSaves()` les envoie et les attend, avec un délai maximal (un enregistrement bloqué n'empêche jamais de fermer).

- **Fermer le monde** (« Mondes ») et **ouvrir un autre monde** : `useCloseWorld` et `useOpenWorld` appellent `flushPendingSaves()` avant la commande Rust.
- **Fermer la fenêtre** (`src-tauri/src/closing.rs`) : la première demande de fermeture est retenue et le Rust envoie `bz://before-close` au front, qui enregistre puis appelle `finish_close`. L'app se termine au plus tard 5 s après la demande, même si le front ne répond pas ; une seconde demande (nouveau clic sur la croix) ferme aussitôt. L'app se termine (`exit(0)`) au lieu de détruire la fenêtre : WebView2 refuse de détruire une fenêtre dont la fermeture a été retenue (« failed to send message to the webview »), et l'app n'a qu'une fenêtre.

### Contenu des cartes (blocs)

- **Format** (`src-tauri/src/domain/content.rs`) : `cards.content` contient un tableau JSON de blocs `{ id, type, … }` ; le bloc texte a un document TipTap dans `doc`. Le Rust vérifie le plan (tableau, identifiants uniques, type connu : `text`, `image`, `stats5e`, `map`), la taille (4 Mo, 500 blocs), et dérive `content_text` (texte des blocs texte, libellé des mentions, légendes d'images) pour la recherche. La forme interne des blocs appartient au front.
- **Commandes** : `get_card_content(id)` et `set_card_content(id, content)` (chaîne JSON) ; l'enregistrement met à jour la date de modification du document.
- **Front** (`src/features/cards/blocks/`) : `BlockEditor` garde les blocs en mémoire et les enregistre 600 ms après la dernière modification, immédiatement pour un ajout, un déplacement ou une suppression, en quittant la carte, et avant la fermeture du monde ou de la fenêtre (voir « Enregistrements en attente »). Chaque bloc texte est un éditeur TipTap (StarterKit + Placeholder) ; le réordonnancement utilise dnd-kit (souris et clavier). Les modifications successives s'appliquent au dernier état connu (référence), jamais à un état figé au rendu.
- **Fiche 5e** : bloc `stats5e` (`src/features/cards/blocks/stats/`) avec les caractéristiques, CA, PV, dés de vie, vitesse, bonus de maîtrise, compétences maîtrisées et actions. Les règles (modificateur, bonus de compétence, lecture d'un entier borné) sont des fonctions pures dans `rules.ts`. Un bloc relu avec des valeurs manquantes ou hors limites reprend les valeurs par défaut ou est borné ; une compétence inconnue est ignorée. Le texte de recherche ne l'inclut pas.
- **Templates guidés** : un bloc texte issu d'un template porte un champ `prompt` (la question d'aide), affiché par l'extension Placeholder dans le premier paragraphe vide qui suit un intertitre (`showOnlyCurrent: false`). Le calcul des blocs à ajouter (`templateBlocks`, `src/features/cards/blocks/template.ts`) est une fonction pure : elle ajoute à la fin et saute les sections dont le titre est déjà un intertitre de la carte.
- **Bloc image** : `{ id, type: "image", assetId, caption }` (`assetId` nul tant qu'aucune image n'est choisie). Supprimer l'asset ne réécrit pas le contenu des cartes : le bloc se sait orphelin en comparant son `assetId` à la liste de la médiathèque (le WebView peut garder l'image en cache, le protocole `bzasset` la servant comme immuable), et aussi si le fichier ne se charge pas.
- **Usages d'un asset** (`asset_usages`) : image principale du monde, fond du thème du monde, puis les cartes (corbeille comprise) qui l'ont pour image ou dans un bloc image, trouvées avec les fonctions JSON de SQLite (`json_each`, `json_extract`) sur `cards.content`.
- **Mentions** : nœud TipTap `mention` (`@tiptap/extension-mention`, déclenché par `@tiptap/suggestion`) avec les attributs `id` (carte) et `label` (nom à l'insertion). À chaque enregistrement, `set_card_content` remplace les liens `mention` de la carte dans **la même transaction** que le contenu (`links::replace_in`) ; les cartes mentionnées ne sont pas vérifiées, pour garder les références mortes. La liste de suggestions est un composant React (pas de tippy.js) alimenté par un petit magasin externe ; la vue du nœud lit les cartes vivantes et la corbeille par un contexte fourni par la page de carte. Limite connue : le texte de recherche garde le nom de la mention au moment de son insertion, jusqu'au prochain enregistrement du bloc.
- **Noms de cartes dans le texte** (préférences du monde) : `mentions/entities.ts` (noms et alias des cartes, correspondance en mots entiers, `nameToLink` qui fait attendre un nom quand un plus long peut suivre) et `mentions/entityExtension.ts`, une extension TipTap. Les liens automatiques sont une règle de saisie (`InputRule`) : `Retour arrière` juste après l'annule grâce à `undoInputRule` du clavier de TipTap ; `Entrée` passe par un raccourci qui lie puis laisse créer la ligne. La détection est un plugin ProseMirror de décorations, recalculé à chaque changement du document ou sur demande (`REFRESH_ENTITIES`, quand les cartes ou les préférences changent) ; le texte d'un paragraphe y compte un caractère par position (une mention vaut `\uFFFC`). La pastille « Lier » est un composant React placé d'après `coordsAtPos`. Les mentions nouvellement créées sont gardées dans un `WeakSet` (`mentions/fresh.ts`) : la vue du nœud joue son animation une fois. Les préférences arrivent par le contexte des mentions (page de carte, depuis le monde courant).
- **Dépendances** : `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder` et `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, conformes à l'ADR 0001 (TipTap pour l'éditeur, dnd-kit pour le glisser-déposer).

### Rétroliens

`card_backlinks(cardId)` (`src-tauri/src/domain/links.rs`) : les liens vers la carte dont la source est un document vivant (ni à la corbeille, ni supprimé), avec le titre et le type de la source et, pour un lien de propriété, le libellé de la propriété. Chaque source apparaît une fois, avec toutes ses façons de citer la carte. Côté front, la requête est rangée sous les clés des documents : toute modification de carte ou de valeur lien la rafraîchit.

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
  "theme": { "kind": "preset", "id": "dawn" },
  "preferences": { "entityDetection": true, "autoMentionLinks": false, "animateNewLinks": true },
  "schemaVersion": 1,
  "createdAt": "2026-09-26T12:00:00Z",
  "updatedAt": "2026-09-26T12:00:00Z",
  "lastOpenedAt": "2026-09-26T12:00:00Z"
}
```

- `theme` (ADR 0004, `src-tauri/src/world/theme.rs`) : absent pour le thème par défaut, sinon `{ "kind": "preset", "id" }` (thème fourni, identifiant `[a-z0-9-]`) ou `{ "kind": "custom", "background": <asset id> | null, "accent": "#rrggbb" }`. Lu avec tolérance (illisible = thème par défaut, avec un avertissement dans les logs), écrit par `set_world_theme(theme)` après validation (un fond doit exister dans `assets/`). `forget_asset` retire un asset supprimé de l'image principale et du fond du thème.
- `preferences` (ADR 0004, `src-tauri/src/world/preferences.rs`) : préférences d'écriture, absentes quand toutes sont activées (la valeur par défaut). Lues champ par champ : un champ absent ou qui n'est pas un booléen reprend sa valeur par défaut. Écrites par `set_world_preferences(preferences)`.
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
- **Suppression** (`delete_world`) : le monde ouvert est fermé (ce qui libère la base, verrouillée par Windows tant qu'elle est ouverte), puis `world::remove_folder` relit le `world.json` du dossier et refuse d'y toucher s'il ne contient pas le même monde (même id). Le dossier part dans la corbeille de Windows (crate `trash`). En cas d'échec, le monde est rouvert et l'erreur remontée ; sinon il quitte les mondes récents et sa vignette est effacée.
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
