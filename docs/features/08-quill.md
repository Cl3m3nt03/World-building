# 08 — Quill (écriture)

**Milestones** : M9 (écriture) et M10 (avancé) · **Figma** : node `14:880`

## Objectif

Quill sert à écrire des chapitres, des nouvelles, des romans ou des scénarios **à côté du monde**. Le lore et les brouillons cohabitent : on consulte ou on modifie une carte, puis on retourne à son chapitre sans casser le flux d'écriture.

---

## M9 — Écriture

### Histoires

- L'onglet Quill liste les histoires du monde.
- Créer une histoire se fait sur un écran de configuration : titre, style de livre et couverture. (La vue 3D arrive en M10 ; en M9, un aperçu 2D suffit.)
- Après la création, on accède à « Chapitre 1 ».

### Espace d'écriture

L'écran se divise en trois colonnes :

- **à gauche**, l'histoire et la liste de ses chapitres, qu'on crée, renomme et réordonne. Sous chaque chapitre apparaissent ses **brouillons**, entre lesquels on bascule pour comparer ;
- **au centre**, l'éditeur de document ;
- **à droite**, le panneau monde (voir plus bas).

### Éditeur

- La barre d'outils du haut propose la police, la taille, les images et l'en-tête.
- La commande **`/`** insère des titres, des séparateurs et des citations.
- Un **minuteur** de concentration lance une session d'écriture chronométrée.
- Un compteur de mots s'affiche pour le chapitre et pour l'histoire.

### Brouillons

Chaque chapitre a un ou plusieurs brouillons, dont un est marqué comme **version courante**. On peut créer un brouillon vide ou dupliquer le brouillon courant. L'onglet « Brouillons » du panneau de droite permet de les comparer côte à côte.

### Interactions avec le monde

- **Détection automatique** : un nom ou alias de carte écrit dans le texte est souligné. Au survol, un aperçu de la carte apparaît ; un clic l'ouvre dans le panneau de droite.
- **Menu de sélection** : quand on surligne un passage, un menu propose :
  - **Créer une carte** à partir de la sélection (le texte devient le nom, et le passage est lié) ;
  - **Lier à une carte existante** ;
  - **Ajouter une note ou un commentaire**, qui est ancré au passage et classé par chapitre. Une icône en marge l'indique, et toutes les notes sont aussi visibles dans l'onglet Home du panneau ;
  - **Effet de texte** : un style visuel appliqué au passage (liste d'effets à définir avec Clément).
- Les mentions et les liens créés dans Quill alimentent la table des liens (source = chapitre).

### Panneau monde (à droite)

- **Onglet Home** : un espace de **blocs** librement disposés (cartes, notes, mood boards, graph du monde). On ajoute des blocs, on les déplace en les tirant par le haut et on les redimensionne par les bords et les coins.
- Les icônes en haut du panneau ouvrent des **onglets** supplémentaires (une carte, une map, le graph…), qui restent ouverts. Ainsi, plusieurs outils sont accessibles en même temps, sans quitter le texte.
- **Onglet Brouillons** : pour basculer entre les brouillons ou les comparer.
- **Onglet Style** : pour l'apparence du mode écriture (clair, sombre ou thème du monde).
- Techniquement, le panneau repose sur `dockview`.

---

## M10 — Avancé

### Couverture 3D

La couverture est présentée en **vue 3D** d'un livre, qu'on peut faire tourner. On y règle le style de livre (reliure, couleur), l'illustration de couverture et la **position du texte** sur la jaquette. Le rendu utilise Three.js.

### Mode audio

- On ajoute des **effets sonores sur une ligne** précise et des **ambiances ou musiques** qui couvrent une section du texte.
- *Adaptation locale* : les sons proviennent de la **médiathèque** (fichiers importés par l'utilisateur, y compris des narrations), pas d'une bibliothèque en ligne.
- Le bouton **Lecture** lance l'aperçu de l'expérience de lecture avec l'audio synchronisé ligne par ligne.

### Publication → prévisualisation et export

- *Adaptation locale* : la publication en ligne est remplacée par une **prévisualisation de lecture** suivie d'un **export**.
- Le mode lecteur permet de régler la couverture, le thème de page, le mode de lecture (défilement ou pages), l'arrière-plan, les polices et la mise en page des chapitres.
- Un aperçu est disponible dans trois gabarits : **navigateur**, **mobile** et **liseuse**.
- **Export** : on choisit les chapitres **et le brouillon** à utiliser pour chacun, puis le format :
  - **PDF**, via Typst côté Rust ;
  - **DOCX** ;
  - **ePub**.
- L'audio n'est pas exportable en PDF ni en DOCX. Un export « liseuse HTML avec audio » pourra être envisagé plus tard.

## Modèle de données (indicatif)

- `stories` : id, title, book_style (JSON), cover (JSON : asset, position du texte), reader_settings (JSON), sort_order
- `chapters` : id, story_id, title, sort_order, current_draft_id
- `drafts` : id, chapter_id, name, content (JSON TipTap), content_text, word_count, updated_at
- `chapter_notes` : id, draft_id, anchor (JSON : positions), body, created_at
- `writing_panel` : story_id, layout (JSON dockview)
- `audio_cues` (M10) : id, draft_id, anchor, kind (effet / ambiance), asset_id, volume, range (JSON)

## Questions ouvertes

- La liste des **effets de texte** visuels (le board ne les détaille pas) : à définir à partir des captures d'écran.
- Les **styles de livre** proposés pour la couverture.

## Critères d'acceptation

- **M9** : on écrit un chapitre, on surligne un nom et on crée une carte depuis la sélection, puis la carte apparaît dans la sidebar et le nom est souligné partout dans l'histoire.
- **M9** : deux brouillons du même chapitre se comparent côte à côte.
- **M10** : l'export PDF des chapitres 1 à 3, brouillon courant, produit un fichier propre avec la couverture.
