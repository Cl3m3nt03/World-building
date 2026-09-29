# Roadmap

L'ordre suit les dépendances : le Graph a besoin des liens entre cartes, le Canvas embarque tous les autres modules, et Quill s'appuie sur l'éditeur et les cartes. Chaque milestone doit produire une app utilisable, jamais un chantier à moitié fini.

| Milestone | Contenu | Spec |
|---|---|---|
| **M0 Fondations** | Repo, CI, squelette Tauri, design system, i18n, couche données, premier `.exe` | `M0-fondations.md` |
| **M1 Mondes & interface** | Liste des mondes, création, réglages du monde et de l'app, onglet Home, médiathèque | `M1-mondes-et-interface.md` |
| **M2 Cartes & types** | Types et sous-types, propriétés, blocs, templates guidés, alias | `M2-cartes-et-types.md` |
| **M3 Organisation** | Sidebar, dossiers, parent/enfant, épingles, tri, filtres, recherche | `features/02-organisation.md` |
| **M4 Map** | Pins, zones, calques, texte, fond | `features/03-map.md` |
| **M5 Graph** | Graphe de forces, filtres, réglages, configurations sauvegardées | `features/04-graph.md` |
| **M6 Relation Tree** | Nœuds, relations, jonctions, variantes | `features/05-relation-tree.md` |
| **M7 Canvas** | Tableau blanc et intégration des autres modules | `features/06-canvas.md` |
| **M8 Wiki** → `v1.0.0` | Vue lecture et édition, thèmes, export HTML | `features/07-wiki.md` |
| **M9 Quill – écriture** | Histoires, chapitres, brouillons, notes, panneau monde | `features/08-quill.md` |
| **M10 Quill – avancé** | Couverture 3D, mode audio, prévisualisation, exports PDF/DOCX/ePub | `features/08-quill.md` |
| **M11 Frise chronologique** | Frise du monde (nouvelle feature de vvd, à spécifier) : #114 | à écrire (`features/09-frise.md`) |

Les milestones M1 et suivants sont découpés en issues au démarrage de chacun, dans un fichier `Mx-<nom>.md` de ce dossier, sur le modèle de `M0-fondations.md`.

## Retours d'utilisateurs à intégrer

Retours reçus le 29/09/2026, classés par milestone (une issue chacun, à cadrer au démarrage du milestone) :

| Retour | Milestone | Issue |
|---|---|---|
| Un nouveau monde affichait les données (cartes, types, images) du précédent | M2, corrigé avant la v0.3.0 | #109 |
| Plusieurs images dans un même bloc, avec défilement | M3 | #110 |
| Blocs de carte côte à côte sur une même ligne | M3 | #111 |
| Stockage : place utilisée et restante, limite choisie par l'utilisateur | M3 | #112 |
| Médiathèque partagée entre les mondes (ADR à écrire : un monde doit rester autonome, ADR 0001) | M3 | #113 |
| Frise chronologique (nouvelle feature de vvd) | M11 | #114 |

