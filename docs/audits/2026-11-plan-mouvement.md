# Plan de mouvement de BuilderZ

Base : `origin/main` 22f10ad (v1.7.1). Passe de plan et de mesure : aucun code d'application n'a été modifié.
Mesures : exe debug `VITE_E2E=1`, fenêtre hors écran, monde de démonstration de l'audit reconstruit (35 documents, 8 139 mots), 1600×1000, thème clair. Harnais et captures (hors dépôt) : `wtmotion/motion/` (`m.mjs`, `run1.mjs`, `run2.mjs`, `probe.mjs`, `out/`).

## Le constat en une phrase

**L'app n'est pas lente, elle est abrupte.** Sur cette machine, presque tout répond en moins de 30 ms. Ce qui manque, c'est la continuité : un écran vide de 600 ms à l'ouverture d'un monde, un panneau qui disparaît une image entre deux fiches, une sidebar qui saute, des vues lourdes qui apparaissent d'un coup. Le gain vient d'abord de la suppression de ces ruptures, ensuite de quelques animations bien placées.

## 1. Principes

1. **Le mouvement explique.** Il dit d'où vient une chose et où elle va. Sans réponse à cette question, pas d'animation.
2. **Rien n'attend le mouvement.** La saisie reste active pendant toute animation, et une animation interrompue repart de l'état courant.
3. **Répéter ne coûte jamais plus.** Une séquence n'est orchestrée qu'une fois par session. Ensuite, c'est la version courte.
4. **Le contenu d'abord.** On n'anime jamais du vide : une transition démarre quand la cible est prête, sinon l'ancienne vue reste en place.
5. **Ce qui reste, reste.** Le verre et la coque ne clignotent pas. Seul le contenu change.
6. **`transform` et `opacity` uniquement** sur les surfaces fréquentes. Pas de `width`, `height`, `left` animés, sauf exception nommée ici.
7. **Une seule signature.** Conformément à l'ADR 0012, le seul moment notable est l'entrée dans un monde. Le reste est calme.
8. **Aucune dépendance nouvelle.** `tw-animate-css`, les transitions CSS, `@starting-style`, l'API Web Animations et les View Transitions de Chromium suffisent. Pas de `motion` ni de GSAP.

## 2. Vocabulaire commun

Les trois durées et les trois courbes existent déjà. Elles restent, avec les mêmes noms. Sont nouveaux les éléments marqués « neuf ».

| Token | Valeur | Usage |
|---|---|---|
| `--bz-duration-micro` (neuf) | 80 ms | pression, sortie de menu, retour d'état |
| `--bz-duration-fast` | 120 ms | entrée de menu, popover, infobulle, ligne de liste, dépôt d'un glisser |
| `--bz-duration-page` (neuf) | 160 ms | changement de page, de document, entrée de liste |
| `--bz-duration-base` | 200 ms | sidebar, rail, dialogue, pastille d'onglet, thème |
| `--bz-duration-slow` | 360 ms | image de fond, atlas, première entrée dans un monde. Jamais sur un geste répété |
| `--bz-stagger` (neuf) | 24 ms | décalage entre éléments, 6 éléments au plus |
| `--bz-ease-out` (`ease-atlas`) | existant | tout ce qui entre |
| `--bz-ease-in` (neuf, `ease-atlas-in`) | `cubic-bezier(0.4, 0, 1, 1)` | tout ce qui sort |
| `--bz-ease-in-out` (`ease-atlas-move`, neuf comme alias Tailwind) | existant | ce qui se déplace d'un endroit à un autre |
| `--bz-ease-spring` (`ease-atlas-spring`) | existant | la pastille d'onglet et le dépôt d'un élément, rien d'autre |
| `--bz-shift-sm` (neuf) | 4 px | entrée de menu, bloc, ligne |
| `--bz-shift-md` (neuf) | 8 px | changement de page dirigé |
| `--bz-scale-enter` (neuf) | 0,97 | surface flottante |

Règles :

- Une sortie dure environ 60 % de l'entrée.
- Plus la surface est petite ou fréquente, plus c'est court.
- Plus de `duration-300`, `duration-700` ni de durée JS en dur (`TreeCanvas.tsx` : 150 et 200, dnd-kit : 200 implicites). Un helper `motionMs("--bz-duration-base")`, tiré de `tokenDuration` (`navigation.ts`), sert au JS.
- Redéfinir `--default-transition-duration` sur `--bz-duration-fast` et `--default-transition-timing-function` sur `--bz-ease-out` dans `@theme` : les 18 `transition` sans durée deviennent tokenisés d'un coup.

## 3. Mesures

Lecture des colonnes : **Réaction**, du `pointerdown` à la première mutation du DOM. **Stable**, jusqu'à la dernière mutation. **Vide**, temps où le panneau surveillé contient moins de 25 % de son texte final. **Images > 33 ms**, pire image. **Tâche longue**, cumul. Médianes de 3 à 6 essais. 1× : machine réelle, 165 Hz, image à 6,1 ms au repos. 4× : main thread ralenti de 4 par `Emulation.setCPUThrottlingRate`, qui approche un portable modeste.

| Transition | Réaction 1× | Stable 1× | Pire image 1× | Réaction 4× | Stable 4× | Vide 4× | Pire image 4× | Tâche longue 4× | Images perdues à 60 Hz (4×) |
|---|---|---|---|---|---|---|---|---|---|
| Ouvrir un monde (DOM seul) | 33 | 47 | 36 | 108 | 195 | 0 | 152 | 69 | 17 (max 29) |
| Onglet Home > World | 5 | 21 | 12 | 26 | 123 | 109 | 115 | 98 | 5 |
| Onglet World > Wiki | 5 | 8 | 12 | 24 | 42 | 152 | 67 | 0 | 2 |
| Onglet Wiki > Quill | 4 | 11 | 36 | 21 | 50 | 0 | 36 | 0 | 1 |
| Onglet Quill > Home | 4 | 18 | 12 | 21 | 99 | 0 | 121 | 53 | 7 |
| Fiche, première ouverture | 8 | 30 | 6 | 52 | 191 | 121 | 85 | 102 | 7 |
| Fiche à fiche, en cache | 16 | 17 | 12 | 93 | 95 | 0 | 115 | 98 | 5 |
| Map | 12 | 12 | 12 | 75 | 78 | 73 | 103 | 78 | 4 |
| Arbre | 13 | 18 | 24 | 83 | 114 | 73 | 164 | 84 | 6 |
| Graph | 11 | 13 | 36 | 67 | 71 | 85 | 121 | 67 | 11 (max 16) |
| Frise | 11 | 22 | 12 | 60 | 146 | 18 | 73 | 60 | 4 |
| Canvas, à froid | | 398 | 55 | | 900 | | 340 | 498 | 33 |
| Canvas, en cache | 13 | 34 | 55 | 68 | 200 | 73 | 340 | 120 | 8 |
| Sidebar, replier | 7 | 8 | 6 | 33 | 43 | 0 | 18 | 0 | 0 |
| Sidebar, déplier | 12 | 12 | 6 | 55 | 55 | 0 | 55 | 0 | 2 |
| Sidebar, redimensionner (120 pas) | | | 6 à 30 | | | 0 | 61 | 58 | 7 |
| Dossier, déplier | 3 | 3 | 18 | 15 | 15 | 0 | 43 | 0 | 0 |
| Menu « nouveau document » | 15 | 15 | 18 | 92 | 92 | 0 | 133 | 104 | 6 |
| Menu contextuel | 16 | 16 | 30 | 101 | 101 | 0 | 176 | 107 | 6 |
| Dialogue Réglages, ouvrir | 13 | 13 | 18 | 89 | 89 | 0 | 152 | 94 | 5 |
| Dialogue, fermer | 126 | 126 | 6 | 138 | 138 | 0 | 55 | 0 | 4 |
| Rail des mondes | 9 | 18 | 12 | 50 | 97 | 0 | 97 | 55 | 4 |
| Thème (4 bascules) | 14 | 14 | 18 | 90 | 90 | 0 | 133 | 252 | 16 |
| Langue | 25 | 25 | 18 | 142 | 142 | 0 | 158 | 147 | 8 |
| Glisser un bloc | 12 | | 6 | 69 | | 0 | 43 | 0 | 2 |
| Glisser dans la sidebar | 37 | | 6 | 123 | | 0 | 61 | 0 | 3 |
| Balayage du pointeur (atlas) | | | 6 | | | 0 | 55 | 112 | 4 |
| Fermer un monde | 12 | 29 | 15 | | | | | | |

**Décalages de mise en page (CLS)** : sidebar repliée ou dépliée 0,161, rail 0,046, sidebar redimensionnée 0,069, première ouverture de fiche 0,034. Le reste est sous 0,01.

**Lecture image par image (screencast, 1×)** :

- *Ouvrir un monde* : la liste disparaît à 75-120 ms. **De 120 à environ 590 ms, l'écran ne contient que le fond et l'atlas.** La barre arrive à 590 ms, le contenu à 680 ms. L'aperçu du graphe de la Home bouge encore après 1 100 ms. L'attente est identique à chaque réouverture.
- *Fiche jamais vue* : à 39 ms, **le panneau de verre a entièrement disparu**, à 50 ms il revient avec le titre seul, à 80 ms avec le contenu. Trois états en 40 ms, soit un clignotement. La luminosité moyenne passe de 200 à 177 puis revient à 200.
- *Map* : même creux (200 > 177 > 202) avant l'image.
- *Onglet* : fondu propre sur 180 ms, sans direction.
- *Sidebar* : tout saute en une image.
- *Thème* : à 56 ms, plus de la moitié de l'écran a changé d'un coup, le reste suit en 180 ms. Le fondu est inégal, car seules les surfaces qui ont `transition-colors` en ont un.

## 4. Problèmes trouvés

| # | Problème | Preuve | Cause | Gravité |
|---|---|---|---|---|
| P1 | Écran vide à l'ouverture d'un monde | 470 ms sans aucun contenu | `atlas-settle` retarde la barre de 360 ms et le contenu de 540 ms, derrière un dessin de 1 080 ms. Le DOM est prêt à 47 ms | Haute |
| P2 | Clignotement à l'ouverture d'un document | frame à 39 ms, vide 121 ms à 4× | la page du document ne rend rien tant que ses données manquent (vu à l'écran, code de `CardPage` à confirmer), et `usePageFade` part du changement de clé | Haute |
| P3 | Le fondu de page touche le verre | luminosité 200 > 177 | `usePageFade` anime tout `<main>`, donc le panneau aussi, de 0,35 à 1 | Haute |
| P4 | Le fondu joue sur du vide | à 4× : 120 ms vides sur 200 ms de fondu | démarrage sur la clé, pas sur l'arrivée du contenu | Haute |
| P5 | Sidebar et rail sautent | CLS 0,161 et 0,046 | `react-resizable-panels` n'anime pas le repli, et le contenu est démonté aussitôt | Haute |
| P6 | Canvas à froid | 398 ms à 1×, 840 ms jusqu'au premier `canvas` lors du test dédié, 900 ms et 498 ms de tâche longue à 4× | chunk `CanvasView` de 1,1 Mo plus 1,8 Mo chargés au clic, avec seulement un `Suspense` | Moyenne |
| P7 | Coût de style à chaque surface flottante | 13-19 ms à 1×, tâche longue de 104 à 137 ms avant la première image à 4× | **Cause non établie.** Le verrouillage Radix pose `data-scroll-locked` et `pointer-events: none` sur `body` et `aria-hidden` sur 17 éléments. Le test de l'attribut seul coûte moins d'1 ms, donc `pointer-events`, propriété héritée, reste le suspect. À confirmer avec `modal={false}` | Moyenne |
| P8 | Atlas repeint au pointeur | style 33 ms à 1× et 217 ms à 4× pour 90 déplacements, tâche longue de 112 ms | `transition-transform` sur des `<g>` SVG : pas de couche GPU, repeinture du SVG plein écran sur le thread principal | Moyenne. Coût de peinture non mesuré |
| P9 | Thème inégal | 32 ms de style par bascule, 16 images perdues à 4× | transitions présentes sur une partie des surfaces seulement | Moyenne |
| P10 | Redimensionnement cher en JS | 3,3 ms par pas à 1×, 19 ms à 4×, soit au-delà du budget de 16,7 ms | `onResize` appelle `sidebar.update` à chaque pixel, donc re-rendu de la sidebar | Basse |
| P11 | Image de fond posée d'un coup | saut visible à 75-120 ms | `<img key={shown}>`, sans fondu ni `decode()` | Moyenne |
| P12 | Dépôt sec dans la sidebar | code | `dropAnimation={null}` | Basse |
| P13 | Pastille d'onglet sur `left, width` | source principale des décalages sur onglet | animation de layout, limitée à `TopBar` | Basse |
| P14 | Un crash du renderer | `Target crashed` en passant de la frise au Canvas, 1 fois sur environ 20 ouvertures | **Non reproduit** en 18 essais dédiés ou répétés. Cause inconnue, pas forcément l'app | À suivre par `testeur` |

Sans gravité : le dessin de l'atlas (`both`) reste listé par `getAnimations()` mais il est terminé, donc sans coût.

## 5. Tableau par transition

P = priorité (1 d'abord). Taille comme dans l'audit : S, moins d'une demi-journée ; M, environ une journée ; L, plusieurs jours.

### Monde et coque

| Transition | Aujourd'hui | Cible | Comment | P | Taille |
|---|---|---|---|---|---|
| Lancement, liste des mondes | apparaît | fondu des tuiles, 160 ms, décalage de 24 ms, 6 au plus | `@starting-style` et `--bz-stagger` sur `WorldCard` | 3 | S |
| Ouvrir un monde, 1re fois de la session | vide 470 ms | la tuile choisie s'efface vers le fond, l'image se fond en 360 ms, la barre descend à 80 ms, le contenu à 120 ms. Tout est posé à 320 ms, l'atlas se dessine derrière sans bloquer | retirer les délais de `atlas-settle`, fondu à deux `<img>` après `decode()` dans `Backdrop`, drapeau de session | 1 | M |
| Ouvrir un monde, ensuite ; changer de monde | même attente | fondu de page de 200 ms, atlas tracé d'emblée | même drapeau | 1 | inclus |
| Fermer un monde | sec, 29 ms | sortie du contenu en 80 ms, entrée de la liste en 160 ms | classes de sortie, `WorldListScreen` | 3 | S |
| Rail des mondes | saut, CLS 0,046 | glissement de 200 ms sans layout par image | hook de glissement partagé, voir sidebar | 2 | S |
| Thème | fondu partiel | fondu uniforme de 200 ms | `document.startViewTransition` dans `applyTheme`, avec `::view-transition { pointer-events: none }` et repli direct si l'API manque | 2 | S |
| Langue | texte remplacé | **rien** : geste rare, l'animer n'expliquerait rien | | - | - |
| Pastille d'onglet | `left, width`, ressort | même geste en `translate` ; largeur gardée, avec `contain: layout` | `TopBar.tsx` | 3 | S |

### Pages et documents

| Transition | Aujourd'hui | Cible | Comment | P | Taille |
|---|---|---|---|---|---|
| Changement d'onglet | fondu 0,35 > 1, sans direction | contenu qui entre de 8 px dans le sens de l'onglet, opacité de 0 à 1, 160 ms | `usePageFade` devient `usePageTransition`, avec sens tiré de l'ordre de `SHELL_TABS` | 1 | M |
| Fiche à fiche, document à document | panneau qui clignote | le verre ne bouge pas, seul le contenu change, en 160 ms | cibler `[data-page-content]` et non `<main>` | 1 | inclus |
| Première ouverture d'un document | vide, puis titre, puis contenu | l'ancienne vue reste jusqu'à ce que la nouvelle soit prête, 100 ms au plus, puis un seul changement | préchargement au survol et au `pointerdown`, `placeholderData` ou `useDeferredValue` sur le document courant | 1 | M |
| Fiche : pastille de type et propriétés qui décalent | CLS 0,034 | hauteur stable, en attente du constat F4 de l'audit | Lot 2 | 2 | inclus Lot 2 |
| Home | aperçu du graphe qui s'agite | layout calculé avant affichage, puis fondu de 200 ms | dans le Lot 5, qui possède `features/home/**` | 2 | S |
| Tuiles de la Home | entrent avec la page | décalage de 24 ms à la première visite, aucun ensuite | `@starting-style` | 3 | S |

### Sidebar

| Transition | Aujourd'hui | Cible | Comment | P | Taille |
|---|---|---|---|---|---|
| Replier, déplier | saut, CLS 0,161 | 200 ms en `ease-in-out`. La sidebar glisse et s'efface, le contenu suit par FLIP en `transform`, sans recalcul de mise en page à chaque image | largeur finale posée d'un coup, `<main>` animé par WAAPI depuis l'ancien décalage, démontage de `WorldSidebar` retardé. Sans `fill`, pour ne pas piéger les éléments fixes. Le focus actuel reste | 1 | M |
| Redimensionner | direct | direct, **jamais d'animation** | sauvegarde et `setState` en fin de glisser, la largeur vivant dans une ref pendant le geste | 3 | S |
| Dossier | chevron tourné, lignes instantanées | lignes suivantes décalées en 120 ms, nouvelles lignes en fondu | `transition: transform` sur les lignes virtualisées pendant 160 ms après un clic, sinon le défilement traînerait | 2 | M |
| Glisser une ligne | dépôt sec | retour de 120 ms | `dropAnimation` avec `--bz-ease-spring` | 3 | S |
| Élément créé ou supprimé | sec | fondu de 120 ms, `@starting-style` | `DocumentTreeView` | 3 | S |

### Surfaces flottantes

| Transition | Aujourd'hui | Cible | Comment | P | Taille |
|---|---|---|---|---|---|
| Menus, menu contextuel, select | 200 ms, 8 px, zoom 95 %, sortie 120 ms | 120 ms, 4 px, 0,97, sortie 80 ms | classes de `components/ui/*` | 1 | S |
| Popovers | 200 ms | 120 ms, depuis l'origine Radix, comme aujourd'hui | idem | 1 | inclus |
| Infobulle | 120 ms, 8 px | 120 ms, 4 px, et instantanée si une autre vient de se fermer | `skipDelayDuration` | 3 | S |
| Dialogue | 200 ms, sortie 120 ms | inchangé, zoom à 0,97 | idem | 2 | inclus |
| Coût à l'ouverture | jusqu'à 137 ms à 4× | moins de 50 ms à 4× | essayer `modal={false}` sur les menus, mesurer, garder si le clavier et le focus tiennent | 2 | S |

### Blocs et listes

| Transition | Aujourd'hui | Cible | Comment | P | Taille |
|---|---|---|---|---|---|
| Ajouter un bloc | apparaît | fondu et 4 px, 120 ms | `@starting-style` sur `[data-block]`, jamais au montage de la fiche | 2 | S |
| Supprimer un bloc | disparaît | sortie de 80 ms, voisins en FLIP de 120 ms | hook `useFlip` | 3 | M |
| Déplacer un bloc au glisser | dnd-kit, 200 ms en dur | même rendu, tokenisé | constante `SORTABLE_TRANSITION` partagée | 3 | S |
| Monter ou descendre par menu ou clavier | saut | FLIP de 120 ms | `useFlip` | 3 | S |
| Listes triables (propriétés, épinglés, chapitres, variantes, vedettes) | dnd-kit, 200 ms | même constante | une ligne par fichier | 3 | S |

### Documents lourds

| Transition | Aujourd'hui | Cible | Comment | P | Taille |
|---|---|---|---|---|---|
| Canvas | 398 à 900 ms sans retour | panneau de verre immédiat, puis fondu. Second accès sans attente | chunk préchargé au repos après l'ouverture du monde, `requestIdleCallback`, et `Suspense` avec un panneau de la bonne taille | 1 | S |
| Map | apparition | image en fondu de 160 ms | `MapView`, après `decode()` | 2 | S |
| Arbre | nœuds d'un coup | fondu du viewport de 160 ms après `fitView`, pas de cascade | `TreeCanvas`, durées en tokens | 2 | S |
| Graph | simulation visible, 11 à 16 images perdues à 4× | premières itérations hors écran, puis fondu | `GraphCanvas` | 2 | M |
| Frise | apparition | fondu de page seul | rien de spécifique | 3 | - |

### Atlas

| Transition | Aujourd'hui | Cible | Comment | P | Taille |
|---|---|---|---|---|---|
| Parallaxe au pointeur | `<g>` SVG repeint | même effet, en couche GPU | deux `<svg>` superposés, relief et rose, avec `will-change: transform` | 2 | S |

## 6. `prefers-reduced-motion`

- **Vérifié dans l'app** (`setEmulatedMedia`) : plus d'animation d'ouverture de menu ni de fondu de page, et plus de `transform` de l'atlas au pointeur.
- **Lu dans le code, non mesuré** : les tokens passent à 0, donc l'entrée de monde est immédiate.
- **Reste** : les transitions Tailwind sans durée, à 150 ms (couleurs de boutons, opacité d'icônes). Elles ne déplacent rien, ce que l'ADR 0012 tolère. Le passage du token par défaut (§2) les met à 0.
- **Non couvert par les tokens et à corriger** : dnd-kit (transition de 200 ms), durées React Flow de `TreeCanvas.tsx`. `motionMs` renvoie 0, donc les deux suivent.
- **Règles pour les nouveautés** : toute distance (`--bz-shift-*`, `--bz-scale-enter`) passe à sa valeur neutre sous `reduce`. FLIP et glissements se contentent d'appliquer l'état final. `startViewTransition` n'est pas appelé. `--bz-stagger` passe à 0.
- **Test** : un test qui vérifie que `usePageTransition`, `useFlip` et le hook de glissement ne lancent pas d'animation quand `tokenDuration` vaut 0. Puis une passe `Emulation.setEmulatedMedia` dans l'app réelle.

## 7. Lots, sans fichiers communs

L'audit fixe l'ordre 1, puis 2 et 3, puis 4 et suivants. Aucun lot de mouvement ne doit démarrer avant que les fichiers qu'il touche soient libres.

| Lot | Contenu | Fichiers | Taille | Après | Effet |
|---|---|---|---|---|---|
| **A. Vocabulaire et surfaces** | tokens, `--default-transition-*`, menus, popovers, dialogues, `motionMs` | `styles/tokens.css`, `styles/globals.css`, `components/ui/*`, `app/shell/navigation.ts` (helper seul) | S | Lot 1 de l'audit, même zone | les menus paraissent plus vifs |
| **B. Pages sans flash** | `usePageTransition`, verre fixe, sens des onglets, préchargement | `app/shell/navigation.ts`, `WorldLayout.tsx`, `Workspace.tsx` (`<main>`), `app/router.tsx`, un attribut dans `CardPage.tsx` | M | A et Lot 2 (pour `CardPage`) | **le plus fort avec C** |
| **C. Entrée du monde** | délais, fondu du fond, drapeau de session, parallaxe en couche GPU | `app/shell/Backdrop.tsx`, `Atlas.tsx`, `WorldLayout.tsx` (classes), `styles/globals.css` (`atlas-*`), `features/world/components/WorldListScreen.tsx`, `WorldCard.tsx`, ADR 0012 | M | B ; décisions de Clément, §8 | le plus fort |
| **D. Sidebar et rail** | glissement FLIP, sauvegarde en fin de geste, dossiers, dépôt | `app/shell/Workspace.tsx` (panneaux), nouveau `app/shell/useSlideCollapse.ts`, `WorldRail.tsx`, `features/sidebar/components/DocumentTreeView.tsx` | M | B (même `Workspace.tsx`) et Lot 3 | fort |
| **E. Thème** | View Transition | `app/theme.ts`, `styles/globals.css` (bloc `::view-transition`) | S | A | ponctuel, très visible |
| **F. Blocs et listes** | `useFlip`, `SORTABLE_TRANSITION`, entrée et sortie de bloc | `features/cards/blocks/BlockEditor.tsx`, `features/properties/components/SortablePropertyList.tsx`, `features/sidebar/components/PinnedSection.tsx`, nouveau `lib/motion.ts` | M | A, Lots 2 et 3 | moyen |
| **G. Documents lourds** | préchargement Canvas, fondus de Map, Arbre, Graph, Home | `CanvasPage.tsx`, `MapView.tsx`, `TreeCanvas.tsx`, `GraphCanvas.tsx`, `features/home/**` | M, en 4 petites PR | **critères ajoutés aux Lots 4, 5, 7, 8 de l'audit** : ce sont leurs fichiers | moyen |
| **H. Wiki et Quill** | `ChapterList`, `FeaturedGrid`, durées en dur (`WikiHero` 700 ms, `FeaturedGrid` 300 ms) | `features/wiki/**`, `features/quill/**` | S | Lots 9 et 10 | faible |

Ordre conseillé : Lot 1 de l'audit > **A** > (Lots 2 et 3) > **B** > **C** et **E** en parallèle > **D** > **F**. **G** et **H** suivent les lots M4 et M5. A et B peuvent se faire seuls si seul le Lot 1 est mergé, en reportant l'attribut de `CardPage` sur le Lot 2.

Chaque PR de mouvement livre un avant/après mesuré sur ce tableau, à 1× et à 4×, et met à jour `docs/features/` si le comportement change. Les tests existants de `Workspace.test.tsx` et `WorkspaceWindowResize.test.tsx` sont à garder verts, notamment le déplacement du focus après repli.

## 8. Décisions de Clément (novembre 2026)

1. **Entrée du monde : validée.** Les panneaux se posent **pendant** le dessin de l'atlas, et la séquence n'est orchestrée qu'une fois par session. L'ADR 0012 sera amendée avec le lot C, pas avant.
2. **Sens des onglets : validé.** Un changement d'onglet glisse de 8 px (`--bz-shift-md`) dans l'ordre Home, World, Wiki, Quill.
3. **Sidebar repliée : validé.** Le texte de la fiche se remet en page d'un coup au début du glissement, masqué par le mouvement.

## 9. Ce que ces chiffres ne disent pas

- **Machine très puissante** : à 1×, quasi rien ne dépasse 30 ms. Les problèmes de performance n'apparaissent qu'à 4×, et ce ralenti ne touche que le thread principal, pas le GPU.
- **`requestAnimationFrame` non bridé** : 6,1 ms stable sur tous les écrans, visibilité `visible`. Les chiffres du thread principal sont fiables hors écran.
- **Compositeur non fiable** : le coût GPU réel du verre (6 `backdrop-filter`), du `blur` du fond et des animations par-dessus n'est **pas mesuré**. Une fenêtre hors écran ne présente pas comme une vraie. C'est le premier point à vérifier sur un portable, fenêtre visible, par Clément.
- **Exe debug** : front compilé pour la production, mais Rust non optimisé. Les temps IPC sont donc pessimistes.
- **Monde petit** : 35 documents, 865 éléments DOM. Un monde de milliers de cartes n'a pas été testé (la sidebar est virtualisée, le Graph non).
- **Non mesurés** : frappe et Entrée dans un bloc (le focus de l'éditeur n'a pas été obtenu par le harnais, chiffres écartés), défilement à la molette (4 événements seulement, chiffres écartés), lancement à froid réel (642 ms jusqu'à la liste, avec une mesure peu précise), thème sombre, 1028×749, Quill et Wiki en profondeur, recherche Ctrl+K.
- **Screencast** : limité à environ 80 images/s, avec des images réduites. Il prouve une rupture, il ne la chronomètre pas à l'image près.
- **Cause de P7** : hypothèse seulement.
