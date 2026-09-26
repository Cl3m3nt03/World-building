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

À compléter (issues 0.8, 0.9, 0.10) : couches `commands` / `domain` / `db` / `world`, `AppError`, logs.

## Format d'un monde

Voir ADR 0001, section « Format des données ». À compléter avec le schéma réel lors de l'issue 0.9.

## Tests

À compléter (issues 0.3, 0.4, 0.12) : Vitest, `cargo test`, WebdriverIO + `tauri-driver`.
