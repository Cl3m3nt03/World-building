# ADR 0002 — Workflow Git et conventions

- **Statut** : Accepté
- **Date** : 2026-09-26
- **Décideur** : Clément

## Contexte

Le projet doit rester lisible et reprenable dans plusieurs années. Chaque changement doit donc être traçable, relu et documenté.

## Décision

### Branches : GitHub Flow

- **`main`** est toujours stable et protégée. Les push directs sont interdits et une PR ne peut être fusionnée que si la CI est verte.
- On suit la règle **une issue = une branche = une PR**.
- Les branches sont nommées `<type>/<sujet-court>`, par exemple `feat/world-create`, `fix/sidebar-drag`, `docs/adr-stack`, `chore/biome`, `ci/release`, `refactor/db-layer` ou `test/e2e-smoke`.
- Les PR sont fusionnées en **squash merge**, avec un titre au format Conventional Commits. La branche est supprimée après la fusion.

### Commits : Conventional Commits

Le format est `type(scope): description`, où `type` vaut `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci` ou `chore`.
Le scope reprend le module concerné : `cards`, `map`, `graph`, `tree`, `canvas`, `wiki`, `quill`, `world`, `ui`, `db`, `i18n`, etc.
Un `commitlint` vérifie ce format en pre-commit.

### Versions et releases

- Le projet suit le **SemVer**. Les versions `0.x` couvrent la phase de construction ; la `1.0.0` correspondra à la fin de M8 (Wiki).
- **release-please** génère le `CHANGELOG.md` et les tags à partir des commits.
- Un tag `v*` déclenche le build de l'installeur `.exe`, publié dans la GitHub Release correspondante.

### Pilotage

- Chaque milestone GitHub correspond à une phase de la roadmap (`docs/roadmap/`).
- Chaque feature fait l'objet d'une issue, avec des critères d'acceptation cochables.
- Un board GitHub Projects suit l'avancement en trois colonnes : Todo, In progress, Done.

### Documentation

| Dossier | Contenu |
|---|---|
| `docs/adr/` | Toute décision structurante, numérotée et jamais réécrite. Une décision qui change donne lieu à un nouvel ADR, qui remplace l'ancien. |
| `docs/features/` | Un fichier par module, qui décrit son comportement attendu. Il est mis à jour dans la même PR que le code. |
| `docs/roadmap/` | Le découpage des milestones en issues. |
| `docs/architecture.md` | La vue d'ensemble du code. |
| `CLAUDE.md` | Les règles de travail pour Claude Code. |

### Langues

- Le **code, les noms de branches, les commits et les PR** sont en **anglais**.
- La **documentation** (`docs/`, `README`) est en **français**.
- L'**interface** est bilingue FR/EN. Aucune chaîne n'est écrite en dur dans les composants.

## Conséquences

L'historique de `main` se lit comme un journal des fonctionnalités, avec un commit par feature. Le changelog et les versions sont générés automatiquement. Le coût est une petite discipline à chaque tâche, en échange d'un projet reprenable à tout moment.
