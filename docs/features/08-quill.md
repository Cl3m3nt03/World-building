# 08 — Quill (écriture)

**Milestones** : M9 (écriture) et M10 (avancé) · **Figma** : node `14:880` · **Roadmap** : `docs/roadmap/M9-quill.md`, `docs/roadmap/M10-quill-avance.md` · **Décisions** : ADR 0009 (données, liens des chapitres), ADR 0010 (sons ancrés, lecture, exports)

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

**Réalisé en M9 (9.8)** : « Minuteur », à côté des mots en bas du texte, propose une session de 15, 25, 45 ou 60 minutes, ou une autre durée (1 à 240 minutes). Le temps restant s'affiche discrètement, avec pause, reprise et arrêt. La session continue d'un chapitre à l'autre de l'histoire ; à sa fin, « Session terminée : N mots écrits » donne les mots ajoutés à l'histoire pendant la session (la version courante de chaque chapitre). Rien n'est enregistré : fermer l'histoire arrête la session.

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

**Réalisé en M9 (9.6)** : « Ajouter une note » sur un passage sélectionné crée une note et l'ouvre pour l'écrire. Le passage est surligné d'un pointillé, et une icône dans la marge droite, à sa hauteur, ouvre la note pour la lire, la modifier (enregistrée en quittant le champ) ou la supprimer (le surlignage part avec elle). La note est ancrée par une marque dans le texte : elle suit le passage quand on écrit autour, et reste après relance. Les notes de l'histoire sont listées par chapitre dans la colonne de gauche (avec le brouillon quand ce n'est pas le courant) ; un clic ouvre le passage et la note. Copier un brouillon copie aussi ses notes ; supprimer un brouillon, un chapitre ou une histoire supprime les leurs. L'onglet Home du panneau monde les reprendra (9.7).

### Panneau monde (à droite)

- **Onglet Home** : un espace de **blocs** librement disposés (cartes, notes, mood boards, graph du monde). On ajoute des blocs, on les déplace en les tirant par le haut et on les redimensionne par les bords et les coins.
- Les icônes en haut du panneau ouvrent des **onglets** supplémentaires (une carte, une map, le graph…), qui restent ouverts. Ainsi, plusieurs outils sont accessibles en même temps, sans quitter le texte.
- **Onglet Brouillons** : pour basculer entre les brouillons ou les comparer.
- **Onglet Style** : pour l'apparence du mode écriture (clair, sombre ou thème du monde).
- Techniquement, le panneau repose sur `dockview`.

**Réalisé en M9 (9.7)** : le panneau monde, à droite du texte, est un espace d'onglets (dockview) qu'on réorganise, sépare côte à côte ou ferme. **Home** porte des blocs libres : une carte (son résumé, « Ouvrir »), les notes de l'histoire, un mood board d'images de la médiathèque, le graph du monde ; on les ajoute, on les déplace en tirant leur barre et on les agrandit par leur coin, ou au clavier depuis la barre (flèches pour déplacer, Maj + flèches pour redimensionner). **Brouillons** compare deux brouillons du chapitre ouvert. **Style** règle l'apparence du mode écriture : thème du monde, clair ou sombre. Les icônes du haut ouvrent ces onglets, une carte (choisie dans une recherche), une map (en lecture, ses pins ouvrent leurs cartes) ou le graph (ses cartes s'ouvrent dans le panneau). Une mention ou un nom cliqué dans le texte ouvre la carte dans un onglet, modifiable ; l'onglet prend son nom. Les onglets, les blocs et le style sont gardés par histoire (`writing_panel`). Un bouton au-dessus du texte masque ou affiche le panneau.

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

**Réalisé en M10 (10.1)** : le socle de données, sans interface pour l'instant (migration 0019, ADR 0010).
- Un brouillon a ses **sons** : un effet ou une ambiance, un fichier audio de la médiathèque (refusé si ce n'en est pas un), un volume de 0 à 100 (80 au départ) et une boucle (oui pour une ambiance). Chaque son est ancré par une marque `audioCue` dans le texte.
- Copier un brouillon copie ses sons et renomme leurs marques. Supprimer un brouillon, un chapitre ou une histoire supprime les leurs.
- La médiathèque montre « son dans « Chapitre 1 » (Mon histoire) » avant de supprimer un fichier utilisé.
- Une histoire a ses **réglages de lecture**, lus avec tolérance :
  - thème de page : clair, sombre ou sépia ;
  - mode : défilement ou pages ;
  - fond `#rrggbb` ou celui du thème ;
  - police ;
  - taille du texte ;
  - mise en page des chapitres : image au-dessus, titre sur l'image ou sans image ;
  - vitesse de lecture : 60 à 600 mots par minute, 200 au départ.

**Réalisé en M10 (10.2)** : l'écran du livre (création et « Modifier le livre ») montre le livre en 3D (Three.js).
- Le livre a des plats, un dos et un bloc de pages crème. La couverture reprend celle de l'aperçu 2D : couleur, finition, illustration encadrée, titre à sa place. Le titre est aussi écrit le long du dos.
- Le cuir brille, la toile est mate.
- Il est vu de trois quarts, le dos visible. On le tourne en le tirant, ou au clavier avec les flèches (gauche et droite pour le tourner, haut et bas pour l'incliner). Double-clic ou Début le remet en place.
- Sans animation si l'utilisateur les réduit.
- Chaque réglage se voit aussitôt.
- Sans WebGL, l'aperçu 2D reste, et la liste des histoires garde l'aperçu 2D.

**Réalisé en M10 (10.3)** : une barre sous le texte passe d'**Écrire** à **Publier**. Audio et Lecture viendront avec 10.4 et 10.5.
- Le mode est dans l'adresse (`?mode=publish`), et un autre chapitre s'ouvre dans le même mode.
- Publier montre le livre comme un lecteur : la couverture, puis chaque chapitre (son brouillon courant) avec son ouverture (image au-dessus du titre, titre sur l'image, ou sans image) et son texte. On y voit les titres, citations, listes, séparateurs et images ; les mentions sont écrites, les notes ne se voient pas.
- La barre propose trois gabarits : **Navigateur**, **Mobile** (texte aligné à gauche) et **Liseuse**.
- Le panneau de droite devient **Style** : thème de page (clair, sépia, sombre), mode de lecture (défilement, ou pages tournées avec les boutons ou les flèches, « Page 2 sur 3 »), fond de page (celui du thème ou neuf autres, le texte restant lisible), police (les six polices libres de l'app), taille du texte et mise en page des chapitres.
- Chaque réglage se voit aussitôt et reste avec l'histoire.
- En défilement, le chapitre ouvert vient à l'écran.

**Réalisé en M10 (10.4)** : le mode **Audio** de la barre.
- Sur un passage sélectionné, le menu propose « Effet sonore » ou « Ambiance » (plus de carte ni de note dans ce mode).
- On choisit le son dans la médiathèque (chaque son s'écoute avant d'être choisi, on peut aussi en importer un du PC), et le passage est marqué : un effet est souligné d'une vague, une ambiance teintée tout du long (discrets hors du mode Audio).
- Une icône dans la marge, à la hauteur de chaque son, l'ouvre : l'écouter, régler son volume, le faire boucler (ambiance), le changer, le supprimer (la marque part avec lui).
- À droite, « Sons du chapitre » les liste dans l'ordre du texte, avec leur passage ; un clic montre le passage et ouvre le son. Un son dont le passage a été effacé y reste, pour être supprimé.
- Les marques suivent le texte et restent après relance ; un son dont le fichier a disparu est dit « Son introuvable ».
- Les icônes de marge (notes et sons) ont leur place à droite du texte à toute largeur : le texte ne défile plus de côté.

**Réalisé en M10 (10.5)** : le mode **Lecture** de la barre.
- Le chapitre s'y lit comme dans l'aperçu (réglages de lecture de l'histoire), la ligne en cours mise en avant et gardée à l'écran.
- « Lire » avance d'une ligne (un paragraphe, un titre, une citation…) à l'autre au rythme réglé : 60 à 600 mots par minute, gardé avec l'histoire, au moins une seconde et demie par ligne.
- Les sons (Web Audio API) :
  - un effet sonne quand sa première ligne arrive ;
  - une ambiance monte en fondu sur la première ligne de sa section, s'éteint en fondu après la dernière, et tourne en boucle si on l'a demandé ;
  - chacun a son volume ;
  - la pause les suspend et reprendre ne rejoue pas l'effet de la ligne.
- Boutons : début, ligne précédente, lire ou pause, ligne suivante, « Ligne 3 sur 12 », vitesse, volume général, couper le son. Au clavier : Espace, flèches, Début. Un clic sur une ligne y va, avec ses sons.
- Les sons sans fichier sont signalés et sautés.

**Réalisé en M10 (10.6)** : l'onglet **Export** du panneau Publier.
- On choisit le format, ePub pour l'instant ; PDF et Word suivent en 10.7 et 10.8.
- Les chapitres sont tous cochés au départ (« Tout cocher » ou « Tout décocher »), et pour chacun le brouillon (le courant par défaut, marqué d'une étoile).
- « Exporter » demande où enregistrer le livre (nommé d'après l'histoire), puis l'écrit et dit où.
- Le Rust lit les chapitres dans un **modèle de livre** commun aux trois formats (ADR 0010), où les mentions deviennent leur texte et où notes et sons ne passent pas. Il en fait un ePub 3 :
  - la couverture, dessinée comme le livre et envoyée en PNG ;
  - une table des matières ;
  - une page par chapitre, avec son image d'en-tête si la mise en page en a une, et les images du texte ;
  - le thème, le fond, la police et la taille des réglages de lecture.
- Les polices ne sont pas embarquées : la liseuse prend la sienne si elle ne les a pas.

**Réalisé en M10 (10.7)** : l'export **PDF** (Typst, compilé dans l'app, sans outil externe).
- Pages A5 :
  - la couverture en pleine page ;
  - une page de titre ;
  - la table des matières (s'il y a plusieurs chapitres) ;
  - chaque chapitre sur une nouvelle page, un peu plus bas ou sous son image d'en-tête ;
  - les pages numérotées en pied à partir du premier chapitre.
- Le texte est justifié, avec retrait de première ligne, titres, citations, listes, séparateurs et images.
- La police est celle des réglages si le PC l'a, sinon une proche (Georgia, Garamond…) ou Libertinus Serif, embarquée par Typst. Le fond et la taille du texte suivent aussi les réglages.
- Une image illisible est laissée de côté plutôt que de faire échouer le livre.

**Réalisé en M10 (10.8)** : l'export **Word (DOCX)**.
- Pages A5 comme le PDF :
  - la couverture ;
  - la page de titre ;
  - chaque chapitre sur une nouvelle page, avec son image d'en-tête et son titre au style « Titre 1 » : le volet de navigation de Word liste les chapitres, et les titres du texte suivent en Titre 2 à 4 ;
  - les pages numérotées.
- Le texte est justifié avec retrait de première ligne ; gras, italique, barré, souligné, citations en retrait, listes, séparateurs et images (ajustées à la page) sont gardés.
- La police des réglages est écrite ; Word la remplace s'il ne l'a pas.

## Modèle de données (indicatif)

- `stories` : id, title, book_style (JSON), cover (JSON : asset, position du texte), reader_settings (JSON), sort_order
- `chapters` : id, story_id, title, sort_order, current_draft_id
- `drafts` : id, chapter_id, name, content (JSON TipTap), content_text, word_count, updated_at
- `chapter_notes` : id, draft_id, anchor (JSON : positions), body, created_at
- `writing_panel` : story_id, layout (JSON dockview)
- `audio_cues` (M10) : id, draft_id, kind (effet / ambiance), asset_id, volume, loop ; l'ancre est une marque `audioCue` dans le texte (ADR 0010)

## Questions ouvertes

- La liste des **effets de texte** visuels (le board ne les détaille pas) : à définir à partir des captures d'écran.
- Les **styles de livre** proposés pour la couverture.

## Critères d'acceptation

- **M9** : on écrit un chapitre, on surligne un nom et on crée une carte depuis la sélection, puis la carte apparaît dans la sidebar et le nom est souligné partout dans l'histoire.
- **M9** : deux brouillons du même chapitre se comparent côte à côte.
- **M10** : l'export PDF des chapitres 1 à 3, brouillon courant, produit un fichier propre avec la couverture.
