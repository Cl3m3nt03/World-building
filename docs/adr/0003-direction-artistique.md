# ADR 0003 — Direction artistique

- **Statut** : Accepté
- **Date** : 2026-09-26
- **Décideur** : Clément
- **Remplace** : la règle « l'app a sa propre direction artistique » de `docs/contexte.md`

## Contexte

`docs/contexte.md` prévoyait que BuilderZ reprenne les comportements de vvd.world, mais pas son identité visuelle. Après avoir revu les captures du board FigJam, Clément veut **la même direction artistique** que vvd : même ambiance, même organisation visuelle, même langage de composants.

L'app reste strictement personnelle, sans revente ni distribution. Il reste une limite : on reprend un **style**, pas des **fichiers**.

## Décision

### Ce qu'on reprend

L'ambiance et le langage visuel observés dans le board (nodes listés dans `docs/contexte.md`) :

| Élément | Règle |
|---|---|
| **Fond** | Une illustration plein écran derrière toute l'interface, floutée et assombrie. L'ambiance de référence est bleu nuit. |
| **Panneaux** | Effet verre dépoli : surface sombre translucide, flou d'arrière-plan, bordure fine claire, coins arrondis. Les panneaux flottent au-dessus du fond, avec une marge. |
| **Barre du haut** | Trois îlots séparés. À gauche, le monde courant. Au centre, les onglets en pilule : l'onglet actif affiche son icône et son libellé, les autres leur icône seule. À droite, les actions et l'heure. |
| **Typographie** | Titres en **monospace gras**, texte courant en sans-serif neutre, en petit corps. |
| **Couleur** | Une interface quasi monochrome. Une seule couleur d'accent **ocre**, pour les confirmations et l'état actif, et un rouge réservé aux actions destructives. |
| **Boutons** | Pilules compactes, avec une icône lucide et un libellé court. |
| **Écran vide** | Une invite « Commencer avec… » suivie d'une rangée de tuiles carrées (Carte, Map, Canvas, Graph). |
| **Densité** | Une sidebar dense (vignette + nom, arbre indenté) et des filets fins entre les sections plutôt que des cartes empilées. |

### Ce qu'on ne reprend pas

- **Aucun fichier de vvd** : ni illustrations, ni icônes propres, ni logo, ni polices sous licence, ni CSS, ni code.
- Ni le nom ni les textes de vvd. Les libellés sont écrits pour BuilderZ, dans `fr.json` et `en.json`.

L'illustration de fond est l'**image principale du monde ouvert**. Sans image, le fond est un dégradé sombre défini par les tokens. Sur la liste des mondes, c'est l'image du dernier monde ouvert.

### Tokens

Les valeurs ci-dessous sont le point de départ de l'issue 0.5. Elles vivent dans `src/styles/` sous forme de variables CSS, exposées à Tailwind. Aucun composant n'utilise de couleur en dur.

| Token | Sombre (référence) | Clair |
|---|---|---|
| `--bg` | `#0b0e17` | `#f5efe3` |
| `--backdrop-overlay` | `rgb(8 10 20 / 0.55)` | `rgb(245 239 227 / 0.6)` |
| `--surface` | `rgb(14 17 28 / 0.72)` | `rgb(255 251 243 / 0.78)` |
| `--surface-strong` | `rgb(10 12 20 / 0.92)` | `rgb(255 252 246 / 0.95)` |
| `--border` | `rgb(255 255 255 / 0.08)` | `rgb(60 40 10 / 0.12)` |
| `--border-strong` | `rgb(255 255 255 / 0.16)` | `rgb(60 40 10 / 0.22)` |
| `--text` | `#e8e9ee` | `#1f1a14` |
| `--text-muted` | `#9095a6` | `#6b6155` |
| `--accent` | `#c8912e` | `#a8741a` |
| `--accent-foreground` | `#1a1206` | `#fffaf0` |
| `--danger` | `#e5484d` | `#c93a3f` |

| Token | Valeur |
|---|---|
| `--radius-sm` / `--radius-md` / `--radius-lg` | `6px` / `10px` / `14px` |
| `--radius-pill` | `9999px` |
| `--blur-panel` | `16px` |
| `--blur-backdrop` | `24px` |

Le **thème sombre est la référence** de la DA. Le thème clair en est la variante crème (dans l'esprit du thème clair du wiki). Il reste obligatoire (voir `CLAUDE.md`). Par défaut, l'app suit le réglage du système.

### Polices

Les polices sont **libres (OFL) et embarquées** dans l'app via `@fontsource`, puisque la CSP interdit tout appel réseau :

- **Space Mono** (700) pour les titres ;
- **Inter** (variable) pour l'interface et le texte courant.

Les thèmes du wiki (M8) et de Quill (M9) pourront proposer d'autres polices, avec la même règle.

### Accessibilité et performance

- Le texte respecte un contraste **WCAG AA** en toutes circonstances : l'overlay du fond est calculé pour que ce soit vrai même sur une illustration claire.
- Avec `prefers-reduced-transparency` ou le réglage « Effets de transparence » désactivé, les surfaces deviennent opaques (`--surface-strong`) et le flou est retiré.
- `backdrop-filter` coûte cher dans WebView2. Il est réservé aux panneaux de la coque (barre du haut, sidebar, dialogues, panneaux de document), jamais appliqué élément par élément dans une liste.

## Alternatives écartées

| Alternative | Raison |
|---|---|
| **DA propre à BuilderZ** (décision initiale) | Clément préfère l'ergonomie visuelle de vvd, qu'il connaît et apprécie. |
| **Copier les assets et le CSS de vvd** | Ce ne sont pas nos fichiers. Le style se reproduit avec nos propres tokens et des ressources libres. |
| **Polices chargées depuis Google Fonts** | Interdit par la CSP (aucun appel réseau) et incompatible avec un usage hors ligne. |

## Conséquences

- ✅ L'interface est familière dès le départ, et les captures du board servent directement de référence visuelle pour chaque module.
- ✅ Un monde sans image garde une interface cohérente, grâce au fond par défaut.
- ⚠️ Le verre dépoli complique le contraste et pèse sur les performances. D'où les règles ci-dessus et le réglage pour désactiver la transparence.
- ⚠️ Deux dépendances de polices (`@fontsource/space-mono`, `@fontsource-variable/inter`) arrivent avec l'issue 0.5 et sont justifiées dans sa PR.
