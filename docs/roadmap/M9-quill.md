# M9 — Quill, écriture → `v1.1.0`

**Objectif** : écrire des histoires à côté du monde. L'onglet Quill liste les histoires ; une histoire a ses chapitres, chaque chapitre ses brouillons. On écrit au centre, les chapitres à gauche, le monde à droite (cartes, map, graph, notes), sans quitter le texte. Les noms de cartes écrits sont reconnus, une sélection devient une carte ou une note, et les chapitres apparaissent dans « Cité dans ».

**Spec** : `docs/features/08-quill.md`, partie M9 (board : node `14:880`, texte « Quill » relu ; MCP Figma limité, captures lues sur l'export local du board : écran de création avec le livre et ses réglages ; espace d'écriture en trois colonnes, histoire et chapitres à gauche, au centre le titre du chapitre, une image d'en-tête et la barre d'outils, à droite un panneau à icônes, Home, Brouillons, Style, avec des blocs ; menu de sélection « Create as Card », « Link to Card », note ; brouillons comparés côte à côte). **Décision** : ADR 0009 (données de Quill, liens des chapitres).

**Choix de conception** :
- **Les histoires ne sont pas des documents de World** : elles vivent dans l'onglet Quill, pas dans la sidebar ni la corbeille de World. Supprimer une histoire ou un chapitre demande une confirmation.
- **Le brouillon courant fait foi** : c'est lui qui compte pour les mots de l'histoire, les liens vers les cartes et, en M10, les exports. Les autres brouillons sont des versions de travail.
- **Un chapitre cite des cartes** : ses mentions (brouillon courant) entrent dans la table des liens avec le chapitre comme source ; « Cité dans » d'une carte montre « Chapitre 2 — Mon histoire » et l'ouvre dans Quill (ADR 0009).
- **Même éditeur, mêmes mentions** : le texte d'un chapitre utilise le schéma TipTap des cartes (mentions `@`, détection des noms), avec en plus les titres, séparateurs et citations par `/`.
- **Panneau monde** : `dockview` (choisi par l'ADR 0001) ; la disposition est gardée par histoire.
- **Les effets de texte** (spec, « liste à définir avec Clément ») ne sont pas dans M9 tant que la liste n'est pas validée ; ils sont proposés dans la recette.

**Ordre d'exécution** : 9.1 → 9.2 → 9.3, puis 9.4, 9.5, 9.6, 9.7, 9.8, et 9.9, 9.10 en dernier.

---

## 9.1 — Socle de données de Quill (#338)
**Branche** : `feat/quill-core` · **Dépend de** : —

- [ ] Migration : `stories` (titre, style de livre, couverture, ordre), `chapters` (histoire, titre, ordre, brouillon courant), `drafts` (chapitre, nom, contenu TipTap, texte, mots), `chapter_notes` (brouillon, ancre, texte), `writing_panel` (disposition par histoire)
- [ ] Commandes : histoires, chapitres et brouillons (créer, renommer, réordonner, supprimer, dupliquer un brouillon, choisir le courant), enregistrer un brouillon (texte et nombre de mots calculés par le Rust) ; le Rust vérifie (longueurs, contenu, ordre)

**Critères d'acceptation** : une histoire créée a « Chapitre 1 » avec un brouillon courant ; supprimer le dernier brouillon d'un chapitre est refusé.

## 9.2 — Onglet Quill : les histoires (#339)
**Branche** : `feat/quill-stories` · **Dépend de** : 9.1

- [ ] Liste des histoires (couverture, titre, chapitres, mots) ; « Nouvelle histoire » ouvre l'écran de création : titre, style de livre (couleurs de reliure), couverture (médiathèque) et position du titre, aperçu 2D du livre
- [ ] Créer ouvre « Chapitre 1 » ; renommer, modifier la couverture, supprimer une histoire

**Critères d'acceptation** : une histoire créée avec sa couverture s'ouvre sur « Chapitre 1 » et reste après relance.

## 9.3 — Espace d'écriture (#340)
**Branche** : `feat/quill-writing` · **Dépend de** : 9.2

- [ ] Trois colonnes : histoire et chapitres (créer, renommer, réordonner au glisser ou au clavier, supprimer), éditeur, panneau monde (vide jusqu'à 9.7)
- [ ] Éditeur : titre du chapitre, image d'en-tête, barre d'outils (police, taille, image, en-tête), `/` pour titres, séparateur et citation ; enregistrement continu ; Ctrl+Z
- [ ] Compteur de mots du chapitre et de l'histoire

**Critères d'acceptation** : un texte écrit dans un chapitre reste après relance, et les compteurs suivent.

## 9.4 — Brouillons (#341)
**Branche** : `feat/quill-drafts` · **Dépend de** : 9.3

- [ ] Sous chaque chapitre, ses brouillons : basculer, renommer, marquer courant, nouveau vide, dupliquer le courant, supprimer
- [ ] Comparer deux brouillons côte à côte, différences repérées

**Critères d'acceptation** : deux brouillons du même chapitre se comparent côte à côte.

## 9.5 — Le monde dans le texte (#342)
**Branche** : `feat/quill-world-links` · **Dépend de** : 9.3

- [ ] Mentions `@` et détection des noms et alias (soulignés) comme dans les cartes ; au survol, un aperçu de la carte ; au clic, la carte s'ouvre dans le panneau monde
- [ ] Menu de sélection : « Créer une carte » (la sélection devient son nom et une mention) et « Lier à une carte »
- [ ] Les mentions du brouillon courant alimentent les liens ; « Cité dans » montre le chapitre et l'ouvre dans Quill (ADR 0009)

**Critères d'acceptation** : on surligne un nom, on crée une carte, elle apparaît dans la sidebar et le nom est souligné partout dans l'histoire.

## 9.6 — Notes (#343)
**Branche** : `feat/quill-notes` · **Dépend de** : 9.5

- [ ] « Ajouter une note » depuis la sélection : ancrée au passage, une icône en marge l'ouvre ; modifier, supprimer
- [ ] Les notes de l'histoire, par chapitre (onglet Home du panneau en 9.7, liste en attendant)

**Critères d'acceptation** : une note ajoutée reste ancrée à son passage après des modifications autour, et après relance.

## 9.7 — Panneau monde (#344)
**Branche** : `feat/quill-panel` · **Dépend de** : 9.5, 9.6

- [ ] `dockview` (dépendance justifiée, ADR 0001) : onglet Home avec des blocs libres (carte, notes, mood board d'images, graph du monde), qu'on ajoute, déplace et redimensionne
- [ ] Icônes du haut : ouvrir une carte, une map, le graph… en onglets qui restent ; onglet Brouillons (9.4) ; onglet Style (clair, sombre, thème du monde)
- [ ] La disposition est gardée par histoire

**Critères d'acceptation** : une carte ouverte depuis le texte se modifie dans le panneau, et la disposition reste après relance.

## 9.8 — Minuteur de concentration (#345)
**Branche** : `feat/quill-timer` · **Dépend de** : 9.3

- [ ] Minuteur de session (durées proposées et libre) : décompte discret, pause, fin signalée, mots écrits pendant la session

**Critères d'acceptation** : une session de 1 minute se termine avec le nombre de mots écrits.

## 9.9 — Tests de bout en bout M9 (#346)
**Branche** : `test/m9-e2e` · **Dépend de** : 9.7, 9.8

- [ ] Scénarios : une histoire créée, un chapitre écrit et gardé, une carte créée depuis une sélection et retrouvée dans la sidebar et « Cité dans », deux brouillons comparés

**Critères d'acceptation** : la suite passe en CI Windows.

## 9.10 — Recette et release `v1.1.0` (#347)
**Branche** : — · **Dépend de** : 9.9

- [ ] Recette Playwright sur l'app réelle (FR et EN, clair et sombre, fenêtre étroite) ; questions à Clément (effets de texte, styles de livre) ; release `v1.1.0`

**Critères d'acceptation** : la recette est validée avant la release.
