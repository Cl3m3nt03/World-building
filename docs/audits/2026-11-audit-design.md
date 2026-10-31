# Audit design de BuilderZ avant V2-M4

> Les captures citées (`audit/shots/`) ne sont pas versionnées : elles restent sur le poste de travail.

Base auditée : `origin/main` 8fada53 (v1.7.1), exe debug `VITE_E2E=1`, fenêtre en arrière-plan.
Monde de démo « Les Marches d'Ambrecôte » : 29 cartes dont 16 avec image, 2 maps, arbre à 2 variantes, graph, frise à 4 pistes, canvas, wiki, 3 histoires, plus 4 mondes secondaires dont un vide.

Captures : `audit/shots/<écran>-<L|D><largeur>.png`, soit L1028, D1028, L1600, D1600. Planches de lecture : `audit/sheets/`.
Les images du monde de démo sont générées et volontairement sommaires : aucun constat ne porte sur leur qualité.

Notation : **B** bloquant, **D** devrait, **N** bonus. Portée : **M4** (à faire dans V2-M4), **IND** (indépendant, peut passer avant), **M5** (wiki et Quill, à ranger dans V2-M5).
**[BUG]** marque un vrai défaut fonctionnel.

## Les trois doutes tranchés

**1. L'anneau or épais autour d'un bloc : à retirer.** C'est un bug de style, pas un choix. `TextBlockEditor.tsx:105` met `focus-visible:ring-3 ring-ring/50` sur la zone éditable. Or un `contenteditable` répond toujours à `:focus-visible`, même après un clic souris (mesuré : `fv: true` après un clic). Tout le bloc s'encadre donc de 3 px d'or à chaque clic, alors que le curseur suffit à montrer où l'on écrit. Voir F2.

**2. Le pied du menu « / » : confirmé, mais ce n'est pas exactement « en bas de fenêtre ».** Le cas fautif est le milieu haut de la fenêtre. Le menu fait 436 px. À 1028×749, relevé par position du paragraphe :

| Haut du paragraphe | Menu | Pied visible |
|---|---|---|
| y = 460 | s'ouvre au-dessus, 201 à 637 | oui |
| y = 340 | au-dessus, 60 à 496, sur la limite | oui |
| y = 300 | collé en haut, 0 à 422, passe sur la barre du haut | **non**, contenu 434 pour 420 |

Quand ni le dessus ni le dessous n'ont 436 px, le menu est réduit à la place disponible. Il défile alors de 14 px et le pied tombe dehors. Voir F3.

**3. « Lieu › Royaume » sous le titre à 1028 : le passage à la ligne est acceptable, son caractère aléatoire ne l'est pas.** Dans la même fenêtre, « Valdorée » garde la pastille à côté du titre et « Royaume d'Ambrecôte » la renvoie dessous (`badge y=143`, titre `y=81`). Toute la fiche bouge alors de 42 px d'une carte à l'autre. Forcer la ligne unique couperait les titres : il reste environ 250 px pour un titre qui en demande environ 265. Voir F4.

## Lots

Ordre conseillé : 1, puis 2 et 3 en parallèle, puis 4 qui ouvre V2-M4. Les lots 5 à 8 suivent après 4. Aucun lot ne touche les fichiers d'un autre.

| Lot | Sujet | Portée | Taille | Fichiers |
|---|---|---|---|---|
| 1 | Socle : défilement, focus, voile, dialogues | IND | M, 1 PR | `styles/globals.css`, `styles/tokens.css`, `components/ui/*`, `app/shell/Backdrop.tsx` |
| 2 | Fiche | IND | M, 1 PR | `features/cards/**`, `features/properties/**` |
| 3 | Sidebar et recherche | IND | S, 1 PR | `features/sidebar/**`, `src-tauri/src/domain/content.rs` |
| 4 | Barre commune des documents et états vides | M4 | L, 2 PR | les 5 `*Page.tsx`, nouveau composant partagé |
| 5 | Graph | M4 | M, 1 PR | `features/graphs/components/*` sauf `GraphPage.tsx`, `features/home/**` |
| 6 | Frise | M4 | L, 1 PR | `features/timelines/components/TimelineView.tsx`, `Minimap.tsx` |
| 7 | Arbre et Map | M4 | M, 1 PR | `features/trees/components/TreeCanvas.tsx`, `PersonNode.tsx`, `features/maps/components/MapView.tsx`, `PinMarker.tsx` |
| 8 | Canvas | M4 | S, 1 PR | `features/canvases/**` sauf `CanvasPage.tsx`, `vite.config.ts` |
| 9 | Wiki | M5 | M, 1 PR | `features/wiki/**` |
| 10 | Quill | M5 | M, 1 PR | `features/quill/**` |
| 11 | Réglages | IND | S, 1 PR | `features/settings/**` |

Tailles : S, moins d'une demi-journée de dev ; M, environ une journée ; L, plusieurs jours.

## Constats par lot, du plus grave au moins grave

### Lot 1 : socle (IND, M)

**F1. B. Toute l'app : barres de défilement Windows à flèches.**
Écrans : `02-home-L1600`, `04a-side-filtres-D1028`, `08-theme-L1600`, `16-settings-L1600`.
Quoi : barre native de 15 px avec flèches, claire et lumineuse, jusque dans les dialogues et les menus. À 1600 sur Home, elle flotte au milieu de la fenêtre (bord droit à x=1376), loin du bord.
Pourquoi : c'est le détail qui date le plus l'app. L'utilitaire `scrollbar-thin` existe mais il couvre 23 zones sur 61.
Correctif : déplacer les règles `::-webkit-scrollbar` de `@utility scrollbar-thin` vers `*` dans `@layer base` (10 px, piste transparente, pouce `--bz-border-strong` en pilule, `--bz-text-muted` au survol). Sur Home, passer l'`overflow-y-auto` sur le conteneur pleine largeur et garder `max-w-6xl` sur l'enfant.

**F5. B. Clair : le fond nu échoue au contraste AA.**
Écrans : `03-world-L1600`, `02-home-L1600`, `01-mondes-L1600`.
Quoi : avec une image de monde sombre, le vélin devient un taupe gris (`rgb(188,170,151)`). Mesuré, le texte atténué `#6e604c` y fait **2,6 à 3,1:1** : « Commencer avec… », légendes des tuiles, « mots / documents / connexions », « Autres mondes ». L'ADR 0003 exige AA en toutes circonstances.
Pourquoi : `--bz-backdrop-overlay` à 0,6 ne suffit pas. C'est aussi ce qui salit le clair, alors que le sombre est superbe.
Correctif : passer l'opacité à 0,82 en clair, et mesurer de nouveau. Tout texte posé directement sur le fond passe en `--bz-text`, ou sur une pilule `--bz-pill`.

**F6. D. Anneau de focus or trop lourd sur tous les champs.**
Écrans : `D1b-focus-champ-L1028`, `D1c-focus-input-L1028`, `05d-card-focus-D1028`, `01c-creer-D1028`.
Quoi : bordure or plus 3 px d'anneau à 50 %, y compris sur le titre de la fiche et la recherche, au simple clic. Un champ actif pèse plus que le bouton primaire.
Correctif : dans `components/ui/input.tsx` et `select.tsx`, garder `border-ring` et réduire à `focus-visible:ring-1 ring-ring/30`. Conserver `ring-2` sur boutons et onglets, où `:focus-visible` signifie vraiment clavier. La bordure or garde le focus visible au clavier.

**F7. D. Dialogues collés aux bords à 1028×749.**
Écrans : `01c-creer-D1028`, `07-types-D1028`.
Quoi : « Nouveau monde » et « Types de cartes » prennent toute la hauteur, sans marge, et leurs coins bas sont coupés. La croix de « Types » chevauche la barre de défilement.
Correctif : dans `components/ui/dialog.tsx`, `max-h-[calc(100dvh-2rem)]`, `flex flex-col`, corps en `min-h-0 overflow-y-auto`, pied fixe.

**F8. D. Police mono système hors identité.**
Écrans : `01c-creer-D1028`, `16-settings-L1600`.
Quoi : chemins en mono système, très « outil de développeur », ce que l'ADR 0012 écarte.
Correctif : `font-sans` pour les chemins, `text-muted-foreground`, et troncature au milieu.

**F9. N. Dialogue de création dense.**
Écran : `01c-creer-L1600`.
Quoi : 17 tonalités en pastilles pour un choix facultatif, ce qui rend le dialogue très haut.
Correctif : replier les tonalités derrière « Ajouter des tonalités » (`features/world/components/TonePicker.tsx`). Décision produit légère, à confirmer.

### Lot 2 : fiche (IND, M)

**F2. B. [BUG] Anneau or autour du bloc au simple clic.**
Écrans : `D1-focus-souris-L1028`, `D1-focus-souris-D1600`.
Correctif : `TextBlockEditor.tsx:105`, retirer `focus-visible:ring-3 focus-visible:ring-ring/50`. Le bloc actif se signale déjà par sa poignée, à passer en `group-focus-within:opacity-100`.

**F3. B. [BUG] Menu « / » : pied caché et menu sur la barre du haut.**
Écran : `D2-slash-coupe-300-L1028`.
Correctif : dans `BlockEditor.tsx:200`, séparer la liste défilante et le pied (`flex flex-col`, liste en `min-h-0 flex-1 overflow-y-auto`, pied `shrink-0`), et `collisionPadding={{ top: 56, bottom: 8 }}` pour ne plus passer sur la barre. Le pied reste visible à toute hauteur.

**F4. D. Pastille de type à position aléatoire à 1028.**
Écrans : `06b-card-lieu-D1028`, `06b-card-lieu2-D1028`, `D3-pastille-L1028`.
Correctif : rendre la ligne stable par une requête de conteneur sur l'en-tête de `CardPage.tsx:283`. Sous 700 px de largeur d'article, pastille, œil et menu vont toujours sous le titre, sur toutes les cartes. Au-dessus, ils restent à côté. Le titre passe en `field-sizing: content`, avec `min-w-0`.

**F10. D. Propriétés : un formulaire plutôt qu'une fiche.**
Écrans : `05-card-L1600`, `05-card-D1028`.
Quoi : 5 champs encadrés pèsent plus que le texte, et « Statut » mélange pastille et « Changer ».
Correctif : en repos, valeur en texte sans cadre sur `h-7`, cadre `--bz-field` au survol ou au focus seulement. Lignes à 28 px de pas.

**F11. D. Galerie plus haute que la fenêtre.**
Écrans : `05-cardb-L1600`, `05-card-D1028`.
Quoi : l'image occupe tout l'article et repousse le texte. À 1028, on ne voit que le ciel.
Correctif : `max-h-[min(60vh,420px)]` et `object-cover` sur l'image de `ImageBlockView.tsx`.

**F12. D. « Ajouter une propriété » déborde à 1028.**
Écran : `05f-card-prop-D1028`.
Quoi : le popover recouvre la barre du haut et cache le titre et son déclencheur, et ses derniers choix passent sous le pli.
Correctif : `collisionPadding={{ top: 56, bottom: 8 }}`, lignes en `h-7`, case « Plusieurs cartes » en pied fixe.

**F13. N. Fiche vide : plusieurs invites concurrentes.**
Écran : `06-card-vide-L1600`.
Quoi : « Commencez à écrire », « Utiliser le template », puis « Ajouter un bloc » : trois départs pour une action.
Correctif : garder le champ d'écriture, passer le template en lien discret dessous, masquer « Ajouter un bloc » tant que la fiche est vide.

À garder : l'en-tête titre plus portrait, les rubriques en petites capitales, le texte en lignes amples.

### Lot 3 : sidebar et recherche (IND, S)

**F14. D. Le globe sur chaque ligne fait du bruit.**
Écran : `04-side-open-L1600`.
Quoi : une icône identique en bout de chaque ligne ne dit rien et charge la colonne la plus dense de l'app. Le monde de démo a tout visible, le bruit réel dépend donc des mondes.
Correctif : `DocumentTreeView.tsx`, n'afficher l'icône qu'au survol ou au focus de la ligne.

**F15. D. Épingle d'une map : ni vignette ni bonne icône.**
Écrans : `03-world-L1600`, `03-world-D1028`.
Quoi : la tuile affiche une icône générique de formes alors que la map a une image et que l'arbre utilise la bonne icône. Titre coupé à 8 lettres (« Carte de… »).
Correctif : `PinnedSection.tsx:168`, utiliser l'image de fond de la map en vignette et l'icône de son genre. Titre sur 2 lignes.

**F16. D. Menu « Filtres et tri » plus haut que la fenêtre.**
Écrans : `04a-side-filtres-L1600`, `04a-side-filtres-D1028`.
Quoi : il dépasse même à 1000 px et cache son pied, avec « Tout réinitialiser ».
Correctif : `ViewMenu.tsx`, replier les sections Types et Tri en sous-menus, avec `collisionPadding={8}`.

**F17. N. [BUG] Extrait de recherche sans séparation.**
Écran : `17-searchb-L1600`.
Quoi : l'extrait colle le titre de section et le texte (« …Portrait Depuis la Nuit des Cloches »).
Correctif : séparer les blocs par « · » dans le texte dérivé de `domain/content.rs`.

### Lot 4 : barre commune des documents (M4, L)

**F18. B. Chaque module range ses outils ailleurs.**
Écrans : `09-map-L1600`, `10-tree-L1600`, `11-graph-L1600`, `12-frise-L1600`, `13-canvas-L1600`.
Quoi : « Recentrer » est en haut dans map, graph et canvas, en bas dans l'arbre et en bas à droite dans la frise. Les libellés sont longs dans la map et les icônes seules dans le graph.
Pourquoi : c'est la dette la plus visible avant M4. Les onglets et le dock poseront dessus.
Correctif : composant `DocumentChrome` avec en-tête unique (titre à gauche, actions du document à droite) et barre flottante basse unique (outils, séparateur, annuler / rétablir, séparateur, vue). Mêmes tailles (`h-9`), mêmes tooltips, même verre « voile ». À écrire dans la spec de V2-M4 avant les écrans.

**F19. D. Map à 1028 : la barre passe sur deux lignes.**
Écran : `09-map-D1028`.
Quoi : les actions en toutes lettres écrasent la map, qui ne prend qu'un tiers de la hauteur, avec des bandes vides dessus et dessous.
Correctif : la barre basse de F18, plus le panneau Calques replié en bouton sous 1200 px.

**F20. D. Phrase d'aide permanente sous chaque document.**
Écrans : `10-tree-D1028`, `11-graph-L1600`, `09-map-L1600`.
Quoi : une ligne en très petit corps, sur deux lignes à 1028, qui prend de la hauteur à chaque visite.
Correctif : la déplacer dans un bouton « ? » commun à la barre de F18, comme dans la frise.

**F21. D. États vides inégaux.**
Écrans : `37-vide-canvas-D1028`, `36-vide-graph-D1028`, `38-vide-frise-D1028`.
Quoi : le canvas vide n'a aucune invite. Graph et frise ont une phrase seule, sans action. « Recentrer » reste affiché sur une scène vide.
Correctif : composant commun d'état vide, repris de `33-vide-quill-D1028` qui est le bon modèle : icône, titre, phrase, bouton primaire. Désactiver « Recentrer » sans contenu.

**F22. D. « Commencer avec… » petit et perdu.**
Écrans : `03-world-L1600`, `31-vide-world-D1028`.
Quoi : 6 petits boutons au centre d'un écran vide.
Correctif : déjà prévu dans V2-M4 (dock en grandes tuiles). Largeur de tuile fixe, pour que « Arbre de relations » n'écarte plus la rangée.

### Lot 5 : Graph (M4, M)

**F23. B. Libellés illisibles, police hors identité.**
Écrans : `11-graph-L1600`, `02-home-L1600`, `02-home-D1028`.
Quoi : noms superposés dès 29 cartes. `GraphCanvas.tsx:316` et `:388` écrivent `sans-serif` en dur, d'où de l'Arial blanc en sombre.
Correctif : lire la police de l'app via `getComputedStyle`, `--bz-text` avec un halo de 3 px couleur de fond. Valeurs par défaut à essayer : distance 110, répulsion 300. Sous un zoom de 0,9, n'afficher que les libellés des nœuds les plus reliés, tous au survol.

**F24. D. Pastilles saturées, hors palette.**
Écrans : `11-graph-L1600`, `11-graph-D1028`.
Quoi : rouge, orange et violet pleins sont les éléments les plus forts de l'écran, à l'inverse de « du verre, de l'encre et un seul or ».
Correctif : fond `--bz-surface-strong`, anneau 1,5 px et lettre en couleur du type.

**F25. D. Aperçu de Home mal cadré.**
Écrans : `02-home-L1600`, `02-homeb-D1028`.
Quoi : le nuage n'occupe qu'une partie du cadre et domine pourtant Home, sans être lisible. À 749 il passe sous le pli.
Correctif : cadrage avec marge de 24 px, libellés masqués dans l'aperçu sauf au survol, hauteur limitée à `min(40vh,420px)`.

**F26. N. Réglages en plein milieu du graph.**
Écran : `11b-graph-reglages-L1600`.
Correctif : popover dans la colonne de droite, pour voir l'effet des curseurs.

### Lot 6 : Frise (M4, L)

**F27. B. Écran peu lisible, pistes absentes.**
Écrans : `12-frise-L1600`, `12-frise-D1028`.
Quoi : 4 pistes réduites à un seul trait multicolore. Les étiquettes, très petites à 1600, s'empilent autour de l'axe avec une grande hauteur vide. La première graduation est coupée à gauche.
Correctif : aligner sur la référence vvd de l'étape 11.5b : bulles à 13 px, tiges nettes, axe neutre, durées en barres teintées par piste. Marge de 32 px à gauche des graduations. La frise du wiki (`14e-wiki-frise-D1028`) respire déjà mieux : partir de ses espacements.

**F28. D. Minimap plus forte que le contenu.**
Écrans : `12-frise-L1600`, `38-vide-frise-D1028`.
Quoi : le cadre or est l'élément le plus visible, et un rectangle or vide apparaît sur une frise vide.
Correctif : `Minimap.tsx`, cadre 1 px `--bz-border-strong`, or réservé aux poignées, minimap masquée sans élément.

### Lot 7 : Arbre et Map (M4, M)

**F29. D. Arbre illisible après recadrage à 1028.**
Écrans : `10-tree-D1028`, `10-tree-L1600`.
Quoi : le recadrage réduit les nœuds et les noms deviennent illisibles.
Correctif : `FIT_VIEW` avec un zoom minimal d'environ 0,6 dans `TreeCanvas.tsx`, quitte à laisser l'arbre déborder. Nom à au moins 11 px à l'écran.

**F30. D. Map : étiquettes en collision.**
Écrans : `09-map-L1600`, `09-map-D1028`.
Quoi : le nom de zone passe sous les pins (« Mer Cendrée » sur « Port-Écume »). Les vignettes des pins restent grosses à 1028.
Correctif : nom de zone décalé si un pin occupe le centre, plaques des pins à fond `--bz-surface-strong`.

À garder : la carte-portrait des nœuds d'arbre et la barre d'actions du nœud sélectionné.

### Lot 8 : Canvas (M4, S)

**F31. D. [BUG mineur] Polices demandées sur esm.sh.**
Preuve : requêtes `esm.sh` en statut 0 et erreurs CSP en console, malgré `EXCALIDRAW_ASSET_PATH = "/excalidraw/"`, sur une app censée ne jamais appeler de CDN.
Effet : aucun visible. Excalifont répond bien en local (`loaded`). Les autres variantes n'ont pas été contrôlées une à une.
Correctif : voir pourquoi Excalidraw ajoute cette source de secours et la neutraliser dans `vite.config.ts`, avec un test qui compte zéro appel externe.

**F32. D. Le canvas ne cadre pas la scène à l'ouverture.**
Écrans : `13-canvas-L1600`, `13-canvas-D1028`.
Quoi : scène coupée à droite, avec un menu hamburger isolé et le zoom séparé des outils. Réserve : le monde de démo a un `appState` vide, à revérifier sur une scène enregistrée par l'app.
Correctif : `scrollToContent` à la première ouverture sans vue enregistrée, menu intégré à F18.

### Lot 9 : Wiki (M5, M)

**F33. B. « Style du site » flotte sur le contenu.**
Écrans : `14-wiki-D1028`, `14c-wiki-card-D1028`, `14e-wiki-frise-D1028`.
Quoi : le bouton centré en bas recouvre le texte et les tuiles.
Correctif : `SiteStyle.tsx:59`, le déplacer dans la barre du wiki, à côté de « Exporter le wiki ».

**F34. D. Accueil du wiki : image géante.**
Écrans : `14-wiki-L1600`, `14-wiki-D1028`.
Quoi : le diaporama prend la moitié de la largeur et agrandit fortement l'image. À 1600, un grand vide reste sous la grille.
Correctif : diaporama limité à 38 % et à `max-w-[560px]`, plus de place pour la grille.

**F35. D. Le wiki reste clair dans une app sombre, et ses popovers suivent l'app.**
Écrans : `14-wiki-D1028`, `14g-wiki-style-D1028`, `14f-wiki-export-D1028`.
Quoi : une plaque crème pleine fenêtre en mode sombre, puis un popover sombre posé dessus. C'est conforme à la spec mais brutal.
Correctif à décider par Clément : un thème « Atlas » par défaut, Alegreya et or, qui suit l'app. Les popovers du wiki passent sous `data-wiki-scheme`. **Question produit.**

**F36. D. Page de carte du wiki : commandes d'édition toujours visibles.**
Écrans : `14c-wiki-card-L1600`, `14c-wiki-card-D1028`.
Quoi : poignées, « Retirer l'image », croix des pastilles, « Ajouter une propriété » dans une page de lecture. L'édition sur place est voulue par la spec, c'est son affichage permanent qui gêne.
Correctif : masquées par défaut, visibles au survol ou au focus de leur zone.

**F37. N. Accueil vide : tuile blanche géante.**
Écran : `32-vide-wiki-D1028`.
Correctif : masquer la colonne de diaporama sans page.

### Lot 10 : Quill (M5, M)

**F38. B. À 1028, les chapitres disparaissent.**
Écrans : `15d-quill-chapter-D1028`, `15c-quill-story-D1028`.
Quoi : les notes prennent la colonne et la liste des chapitres tombe à un micro-défilement où un seul chapitre se voit.
Correctif : chapitres en `flex-1 min-h-[40%]`, notes repliées par défaut ou dans le panneau de droite.

**F39. D. Espace d'écriture à l'étroit.**
Écrans : `15d-quill-chapter-D1028`, `15d-quill-chapter-L1600`.
Quoi : à 1028, la colonne de texte reste étroite pendant que le panneau droit est vide. Le titre colle au haut du panneau. Le sélecteur de style est tronqué en « Norm: ».
Correctif : panneau droit replié tant qu'il n'a pas de bloc, marge haute de 32 px, déclencheur en `w-auto min-w-24`.

**F40. N. Bibliothèque peu habitée à 1600.**
Écran : `15-quill-L1600`.
Quoi : belles couvertures, mais 3 livres dans le coin haut gauche d'un grand panneau.
Correctif : couvertures plus grandes, sur une étagère en filet gravé.

À garder : le livre en 3D de la création d'histoire, le moment le plus réussi de l'app.

### Lot 11 : réglages (IND, S)

**F41. D. Deux logiques de réglages.**
Écrans : `16-settings-L1600`, `08b-reglages-monde-L1600`.
Quoi : les réglages du monde ont un rail à gauche, ceux de l'app sont une longue page qui mêle apparence, stockage et chemins techniques.
Correctif : même gabarit à rail : Apparence, Langue, Mondes, Bibliothèque, À propos.

### Hors lot : langue

**F42. N. Vocabulaire mêlé.**
Écrans : `03-world-L1600`, `04b-side-newdoc-L1600`.
Quoi : « Home », « World », « Map », « Graph » voisinent avec « Frise » et « Arbre de relations », et « carte » désigne à la fois une fiche et « Carte des Marches », une map.
Correctif : **question produit** pour Clément, à trancher avant les onglets de M4 puisque leurs libellés en dépendent.

## À ne pas toucher

- La liste des mondes (`01-mondes-D1028`), surtout en sombre : c'est le niveau visé pour tout le reste.
- Le thème sombre dans son ensemble, plus abouti que le clair.
- Les tuiles de thème (`08-theme-D1028`), le sélecteur de type (`05e-card-type-D1028`), la médiathèque.
- Les états vides de Quill et de Home (`33-vide-quill-D1028`, `30-vide-home-D1028`).

## Non évalué

- **Panneau d'un pin et d'une zone** : mon script n'a pas atteint le pin.
- **Confirmation de suppression** : le script n'a pas abouti (`19-delete` en échec), seule la corbeille est vue.
- **Quill** : modes Audio, Lecture et Publier, comparaison de brouillons.
- **Wiki** : export en cours et site exporté.
- **Radio** en lecture, car le monde de démo n'a pas de son.
- **Mouvement** : animations d'entrée et transitions, invisibles sur des captures fixes.
- **Survol** : vu seulement par endroits. **Chargement et erreur** : non provoqués.
- **Effets de transparence coupés**, `prefers-reduced-motion`, version anglaise.
- **Gros monde** : au-delà de 29 cartes, non mesuré.
- **vvd** : pas de nouvelle session REA, comparaison limitée à `docs/outils/vvd/` et aux notes.
- **Couverture des captures** : L1600 et les écrans principaux de D1028 lus en planches, D1600 sur une planche, L1028 sur quelques captures de doutes. Les corrections à 1028 ne sont donc confirmées qu'en sombre pour la plupart.
- **Contraste** : mesuré seulement sur le fond nu en clair. Les panneaux verre reposent sur la mesure du PR #425, non refaite ici.
