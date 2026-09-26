# ADR 0001 — Stack technique

- **Statut** : Accepté
- **Date** : 2026-09-26
- **Décideur** : Clément

## Contexte

BuilderZ est une application de worldbuilding **desktop, Windows, 100 % locale, mono-utilisateur**, inspirée fonctionnellement de vvd.world. Elle est distribuée sous forme d'installeur `.exe`. Il n'y a ni serveur, ni compte, ni synchronisation cloud.

Les exigences structurantes sont les suivantes :

1. **Qualité et robustesse** : les données d'un monde ne doivent jamais être corrompues ni perdues.
2. **Pérennité** : le projet doit pouvoir être repris dans 5 ans, et les mondes créés doivent rester lisibles même sans l'application.
3. **Performance** : l'app doit rester fluide avec des milliers de cartes, des cartes géographiques de très grande taille et des graphes de plusieurs milliers de nœuds.
4. **Richesse d'interface** : éditeur riche, cartes interactives, graphe de forces, arbres de relations, tableau blanc, logiciel d'écriture (voir `docs/features/`).

## Décision

### Coque applicative : Tauri 2

L'application est une app Tauri 2. Le cœur est en Rust et l'interface est rendue par WebView2, déjà présent sur Windows 10 et 11. L'installeur est généré au format NSIS.

### Backend : Rust

Le Rust possède **toutes les données et tous les accès disque**. Le front ne touche jamais directement au système de fichiers ni à la base.

| Besoin | Choix |
|---|---|
| Base de données | **SQLite** via **`sqlx`**, requêtes vérifiées à la compilation (mode offline, cache `.sqlx/` versionné) |
| Migrations | `sqlx::migrate!`, embarquées dans le binaire |
| Recherche plein texte | **FTS5**, intégré à SQLite |
| Contrat front ↔ back | **`tauri-specta`** : génération automatique de `src/lib/bindings.ts` à partir des commandes Rust |
| Erreurs | Un type `AppError` unique (`thiserror`), sérialisé vers le front |
| Logs | `tracing` + fichier de log dans le dossier de logs de l'app |
| Images | Crate `image` : miniatures, et découpage en tuiles des grandes cartes géographiques |
| Exports (plus tard) | Typst (PDF), crates dédiées pour DOCX et ePub, génération du site wiki statique |

### Frontend : React + TypeScript

| Besoin | Choix |
|---|---|
| Framework | **React 19**, **TypeScript strict**, **Vite** |
| Routing | **TanStack Router** (typé) |
| Données serveur (IPC) | **TanStack Query** par-dessus les bindings générés |
| État d'interface | **Zustand** |
| Styles | **Tailwind CSS** + tokens en variables CSS (thème clair / sombre) |
| Composants | **shadcn/ui** (Radix), copiés dans le repo |
| Icônes | lucide |
| Validation | **Zod** |
| i18n | **react-i18next**, FR + EN dès le départ |
| Glisser-déposer | dnd-kit |

### Briques métier (introduites au fil des milestones)

| Module | Brique |
|---|---|
| Éditeur (cartes, wiki, Quill) | **TipTap** |
| Map | **Leaflet** (`CRS.Simple`) + couche SVG (motifs, `textPath` pour le texte en arc) |
| Graph | **d3-force** + rendu Canvas/WebGL |
| Relation Tree | **React Flow** (@xyflow/react) |
| Canvas | **Excalidraw** (MIT), étendu avec nos éléments |
| Panneaux Quill | **dockview** |
| Couverture 3D | **Three.js** |
| Mode audio | Web Audio API |

### Qualité

- **Tests** : Vitest + Testing Library (front), `cargo test` (Rust), **WebdriverIO + `tauri-driver`** pour le bout en bout (c'est l'approche officielle Tauri sur Windows).
- **Lint et format** : **Biome** (TS), `rustfmt` + `clippy -D warnings` (Rust).
- **Paquets** : **pnpm**, versions épinglées par les lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), tous deux versionnés.

### Format des données : un monde = un dossier autonome

```
MonMonde/
├── world.json   ← métadonnées + schema_version
├── world.db     ← SQLite (toutes les données structurées)
└── assets/      ← fichiers importés, nommés par hash de contenu (dédoublonnage)
```

Les règles sur ce format :

- Avant toute migration de schéma, `world.db` est copié en `world.db.bak-v<ancienne_version>`.
- Une app plus ancienne refuse d'ouvrir un monde au `schema_version` plus récent, sans le modifier.
- Les réglages de l'app (langue, thème, mondes récents) vivent à part, dans le dossier de config de l'app.
- Les données d'un monde ne passent jamais par `localStorage`.

### Sécurité

- Les *capabilities* Tauri 2 sont réduites au strict minimum : une permission par commande.
- Le protocole `asset:` est limité au dossier `assets/` du monde ouvert.
- La CSP est stricte, sans aucun appel réseau sortant.

## Alternatives écartées

| Alternative | Raison |
|---|---|
| **Electron** | Viable et 100 % TypeScript, mais l'installeur pèse plus de 150 Mo, l'app consomme beaucoup plus de RAM et son modèle de sécurité est moins strict. Le Rust apporte aussi la vérification des requêtes à la compilation. |
| **Flutter / Avalonia / Qt** | Leurs écosystèmes sont bien plus pauvres pour nos briques clés (éditeur riche, graphe, carte, tableau blanc). |
| **Next.js** | Le rendu serveur et le routing par fichiers sont inutiles dans une app desktop. Vite est plus simple et plus rapide. |
| **Drizzle (TS)** | Les données sont gérées côté Rust ; `sqlx` apporte la vérification à la compilation. |
| **Svelte / Solid** | Un peu plus performants en théorie, mais TipTap, React Flow et Excalidraw sont des références en React. |
| **tldraw** (canvas) | Licence payante pour un usage en production. |

## Conséquences

- ✅ L'installeur est léger, l'app démarre vite et consomme peu de mémoire.
- ✅ Le front et le back ne peuvent pas diverger : les types sont générés et la CI vérifie qu'ils sont à jour.
- ✅ Les mondes sont portables, sauvegardables et lisibles sans l'app, puisque SQLite est un format pérenne.
- ⚠️ Il y a deux langages à maintenir. On réduit ce coût en gardant le Rust centré sur les données, les fichiers et les traitements lourds, et en laissant toute la logique d'interface en TypeScript.
- ⚠️ Faute de certificat de signature, l'installeur non signé déclenche un avertissement SmartScreen au premier lancement. C'est acceptable pour un usage personnel.
