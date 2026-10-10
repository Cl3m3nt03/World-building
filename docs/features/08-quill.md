# 08 — Quill (écriture)

**Milestones** : M9 (écriture) et M10 (avancé) · **Figma** : node `14:880` · **Roadmap** : `docs/roadmap/M9-quill.md` · **Décision** : ADR 0009 (données, liens des chapitres)

## Objectif

Quill sert à écrire des chapitres, des nouvelles, des romans ou des scénarios **à côté du monde**. Le lore et les brouillons cohabitent : on consulte ou on modifie une carte, puis on retourne à son chapitre sans casser le flux d'écriture.

---

## M9 — Écriture

**Réalisé en M9 (9.1)** : le socle de données, sans interface pour l'instant (migration 0018, ADR 0009). Une histoire (titre, style de livre : couleur `#rrggbb` et finition toile, cuir ou papier ; couverture : image de la médiathèque et position du titre en haut, au milieu ou en bas) naît avec « Chapitre 1 » et son premier brouillon, qui est le brouillon courant. Les chapitres se créent, se renomment, se réordonnent, reçoivent une image d'en-tête et se suppriment, mais une histoire en garde toujours un. Les brouillons se créent vides ou par copie d'un brouillon du même chapitre, se renomment, deviennent courants et se suppriment, mais un chapitre en garde toujours un ; si le brouillon courant disparaît, le premier autre prend sa place. Le Rust vérifie le contenu (un document TipTap de 8 Mo au plus), en tire le texte et le nombre de mots. Le chapitre cite les cartes mentionnées par son brouillon courant (table des liens). Supprimer une histoire ou un chapitre supprime ses liens. Les notes ont leur table ; leur ancre sera une marque dans le texte (9.6).

### Histoires

- L'onglet Quill liste les histoires du monde.
- Créer une histoire se fait sur un écran de configuration : titre, style de livre et couverture. (La vue 3D arrive en M10 ; en M9, un aperçu 2D suffit.)
- Après la création, on accède à « Chapitre 1 ».

**Réalisé en M9 (9.2)** : l'onglet Quill liste les histoires sous forme de livres en 2D (couleur, finition en toile, cuir ou papier, illustration encadrée par la reliure, titre en haut, au milieu ou en bas), avec leurs nombres de chapitres et de mots. « Nouvelle histoire » ouvre l'écran du livre : titre, neuf couleurs proposées ou une autre au choix, finition, illustration de la médiathèque, position du titre, avec l'aperçu du livre qui suit les réglages. Créer ouvre « Chapitre 1 ». Le menu d'une histoire propose « Modifier le livre » (même écran) et « Supprimer l'histoire », qui demande une confirmation et annonce ce qui sera perdu. La médiathèque sait qu'une image est la couverture d'une histoire ou l'en-tête d'un chapitre.

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

**Réalisé en M9 (9.3)** : l'espace d'écriture. À gauche, l'histoire (mots) et ses chapitres : « Nouveau chapitre » l'ouvre, le menu d'un chapitre le renomme (ou un double-clic) ou le supprime après confirmation (une histoire garde un chapitre), et on les réordonne au glisser ou au clavier (Espace puis flèches, annoncé). Au centre, l'image d'en-tête du chapitre (médiathèque, retirée d'un clic), son titre écrit sur place, puis le texte du brouillon courant, enregistré une demi-seconde après la dernière frappe et avant la fermeture. La barre d'outils règle la police (les six polices libres de l'app) et la taille de la sélection, le gras, l'italique, le barré, la citation, insère une image de la médiathèque, choisit l'en-tête, annule et rétablit. « / » en début de ligne propose Titre 1 à 3, Séparateur, Citation et Image. En bas, les mots du chapitre (pendant la frappe) et de l'histoire. Le panneau monde viendra à droite (9.7).

### Brouillons

Chaque chapitre a un ou plusieurs brouillons, dont un est marqué comme **version courante**. On peut créer un brouillon vide ou dupliquer le brouillon courant. L'onglet « Brouillons » du panneau de droite permet de les comparer côte à côte.

**Réalisé en M9 (9.4)** : sous le chapitre ouvert, ses brouillons avec leurs mots, la version courante marquée d'une étoile. On en ouvre un autre : un bandeau rappelle qu'il n'est pas la version courante (ses mots et ses cartes citées ne comptent pas encore) et propose « En faire la version courante ». « Nouveau brouillon » crée un brouillon vide ou une copie du courant, qui s'ouvre. Le menu d'un brouillon le rend courant, le renomme (ou double-clic), le duplique ou le supprime après confirmation (un chapitre en garde un). « Comparer » met deux brouillons côte à côte, choisis dans deux listes : les paragraphes égaux se font face, les mots retirés sont barrés à gauche, les mots ajoutés surlignés à droite (annoncés aux lecteurs d'écran). L'onglet Brouillons du panneau monde reprendra cette vue (9.7).

### Interactions avec le monde

- **Détection automatique** : un nom ou alias de carte écrit dans le texte est souligné. Au survol, un aperçu de la carte apparaît ; un clic l'ouvre dans le panneau de droite.
- **Menu de sélection** : quand on surligne un passage, un menu propose :
  - **Créer une carte** à partir de la sélection (le texte devient le nom, et le passage est lié) ;
  - **Lier à une carte existante** ;
  - **Ajouter une note ou un commentaire**, qui est ancré au passage et classé par chapitre. Une icône en marge l'indique, et toutes les notes sont aussi visibles dans l'onglet Home du panneau ;
  - **Effet de texte** : un style visuel appliqué au passage (liste d'effets à définir avec Clément).
- Les mentions et les liens créés dans Quill alimentent la table des liens (source = chapitre).

**Réalisé en M9 (9.5)** : le texte d'un chapitre connaît le monde comme celui d'une carte : `@` propose les cartes, les noms et alias écrits deviennent des mentions (lien automatique) ou sont soulignés (détection), selon les préférences du monde. Au survol d'un nom, un aperçu montre l'image, le type, les autres noms et le début du texte de la carte ; un clic l'ouvre à droite, modifiable comme dans World (en attendant les onglets du panneau, 9.7). Sur un passage sélectionné, un menu propose « Créer une carte » (on choisit son type ; le passage devient son nom et une mention) et « Lier à une carte » (le passage devient une mention de la carte choisie). Les mentions du brouillon courant font apparaître le chapitre dans « Cité dans » de la carte (« Chapitre 2 — Mon histoire », qui l'ouvre dans Quill) ; le wiki ne les montre pas.

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
