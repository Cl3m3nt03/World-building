# M10 — Quill avancé → `v1.2.0`

**Objectif** : passer de l'écriture au livre. La couverture se règle sur un livre en 3D. Le texte reçoit des sons (effets sur une ligne, ambiances sur une section) qu'on entend en lecture. On prévisualise le livre comme un lecteur le verrait (navigateur, mobile, liseuse), puis on l'exporte en PDF, DOCX ou ePub, avec les chapitres et le brouillon choisis.

**Spec** : `docs/features/08-quill.md`, partie M10.

- **Board** : node `14:880`, texte « Quill » relu. Captures lues sur l'export local du board :
  - livre 3D sur l'écran de création, avec les styles de livre ;
  - barre en bas du texte : « Play », « Audio », « Write », « Publish » ;
  - en Publish, panneau « Styling » (thème clair ou sombre, mode de lecture par défaut, fond de page, neuf polices, trois mises en page de chapitre) et gabarits « Web », « Mobile », « E-Reader » en bas ;
  - onglet « Export » : EPUB, PDF, Word (DOCX), chapitres cochés, « Export ».
- **Décision** : ADR 0010 (sons ancrés, réglages de lecture, modèle de livre pour les exports).

**Choix de conception** :
- **Adaptations locales** (spec) : les sons viennent de la médiathèque, sans bibliothèque en ligne. « Publish » devient la prévisualisation suivie de l'export, sans mise en ligne ni lien de partage.
- **Les modes** : une barre en bas de l'espace d'écriture passe de **Écrire** à **Audio** (on place les sons), **Lecture** (on entend l'histoire) et **Publier** (prévisualisation, réglages, export).
- **Un son est ancré comme une note** (ADR 0010) : une marque dans le texte, une ligne dans `audio_cues`.
- **Ce qu'on règle est ce qu'on exporte** : les réglages de lecture de l'histoire servent à la prévisualisation et aux trois formats.
- **Les effets de texte** et d'autres **styles de livre** attendent la réponse de Clément (questions ouvertes de la spec) ; ils ne sont pas dans M10.

**Ordre d'exécution** : 10.1, puis 10.2 à 10.5 dans l'ordre, 10.6 → 10.7 → 10.8, et 10.9, 10.10 en dernier.

---

## 10.1 — Socle : sons et réglages de lecture (#362)
**Branche** : `feat/quill-m10-core` · **Dépend de** : —

- [ ] Migration : table `audio_cues` (brouillon, type effet ou ambiance, son, volume, boucle) et colonne `stories.reader_settings` (JSON)
- [ ] Commandes :
  - sons d'un brouillon et d'une histoire : créer, modifier, supprimer ;
  - réglages de lecture : lire et enregistrer, avec lecture tolérante et valeurs par défaut ;
  - copier un brouillon copie ses sons et renomme leurs ancres ;
  - la médiathèque montre qu'un fichier est le son d'un chapitre (« Utilisé par »)

**Critères d'acceptation** : un son créé sur un brouillon est copié avec lui ; un fichier audio utilisé le dit avant d'être supprimé.

## 10.2 — Couverture en 3D (#363)
**Branche** : `feat/quill-cover-3d` · **Dépend de** : 10.1

- [ ] L'écran du livre montre le livre en 3D (Three.js) : couverture (couleur, finition, illustration, titre à sa place), dos et tranche
- [ ] On le fait tourner à la souris ou au clavier (flèches), et il revient de face ; il ne tourne pas tout seul si l'utilisateur réduit les animations
- [ ] L'aperçu 2D reste le repli sans WebGL et dans la liste des histoires

**Critères d'acceptation** : changer la couleur, la finition, l'illustration ou la position du titre se voit aussitôt sur le livre 3D.

## 10.3 — Modes et prévisualisation de lecture (#364)
**Branche** : `feat/quill-reader` · **Dépend de** : 10.1

- [ ] Barre des modes en bas : Écrire, Audio, Lecture, Publier
- [ ] Publier montre le livre comme un lecteur : la couverture, puis les chapitres (brouillon courant) avec leur en-tête
- [ ] Panneau **Style** :
  - thème de page (clair, sombre, sépia) ;
  - mode de lecture (défilement ou pages) ;
  - fond ;
  - police (les polices libres de l'app) ;
  - mise en page des chapitres (image au-dessus du titre, titre sur l'image, sans image)
- [ ] Gabarits **Navigateur**, **Mobile** et **Liseuse**

**Critères d'acceptation** : un réglage se voit aussitôt dans la prévisualisation et reste après relance ; les trois gabarits montrent le même texte.

## 10.4 — Mode audio : placer les sons (#365)
**Branche** : `feat/quill-audio` · **Dépend de** : 10.1, 10.3

- [ ] En mode Audio, une sélection propose « Effet sonore » ou « Ambiance » : on choisit un son de la médiathèque (on peut en importer), et le passage est marqué
- [ ] Une icône dans la marge à chaque son : écouter, régler le volume, boucler (ambiance), changer le son, supprimer
- [ ] La liste des sons du chapitre, dans l'ordre du texte

**Critères d'acceptation** : un effet et une ambiance placés restent après relance et suivent le texte quand on écrit autour.

## 10.5 — Lecture avec le son (#366)
**Branche** : `feat/quill-play` · **Dépend de** : 10.3, 10.4

- [ ] Lecture : le chapitre en vue de lecture, la ligne en cours mise en avant, qui avance à une vitesse réglable (mots par minute), avec pause et retour ; un clic sur un paragraphe y va
- [ ] Les effets se jouent en atteignant leur ligne ; les ambiances couvrent leur section, en fondu au début et à la fin (Web Audio API), au volume réglé
- [ ] Volume général et coupure du son

**Critères d'acceptation** : un effet placé sur le paragraphe 3 se fait entendre quand la lecture atteint le paragraphe 3, et une ambiance s'arrête après sa section.

## 10.6 — Modèle de livre et export ePub (#367)
**Branche** : `feat/quill-export-epub` · **Dépend de** : 10.3

- [ ] Rust : le modèle de livre (`domain/book.rs`) tiré des chapitres choisis, avec un brouillon par chapitre
- [ ] Onglet **Export** du panneau Publier : format, chapitres cochés, brouillon de chacun (le courant par défaut), « Exporter » vers un fichier choisi
- [ ] La couverture est dessinée par le front et envoyée en PNG
- [ ] ePub 3 avec `epub-builder` : couverture, table des matières, chapitres, images, réglages de lecture (police et thème)

**Critères d'acceptation** : l'ePub des chapitres 1 à 3 passe la validation de structure (mimetype, conteneur, OPF, navigation) et s'ouvre avec sa couverture.

## 10.7 — Export PDF (Typst) (#368)
**Branche** : `feat/quill-export-pdf` · **Dépend de** : 10.6

- [ ] Le modèle de livre est rendu en source Typst, compilé et exporté par `typst-pdf`
- [ ] Polices embarquées de Typst ; couverture en première page, un chapitre par page de départ, en-têtes et numéros de page

**Critères d'acceptation** : l'export PDF des chapitres 1 à 3, brouillon courant, produit un fichier propre avec la couverture (critère de la spec).

## 10.8 — Export DOCX (#369)
**Branche** : `feat/quill-export-docx` · **Dépend de** : 10.6

- [ ] `docx-rs` : couverture, titres de chapitre en style Titre 1 (navigation de Word), paragraphes, gras, italique, barré, citations, séparateurs, images

**Critères d'acceptation** : le DOCX s'ouvre (structure valide) et garde les titres, la mise en forme et les images.

## 10.9 — Tests de bout en bout M10 (#370)
**Branche** : `test/m10-e2e` · **Dépend de** : 10.5, 10.8

- [ ] Scénarios :
  - un son placé puis retrouvé après rechargement ;
  - un réglage de lecture gardé ;
  - un export PDF, ePub et DOCX écrit dans le dossier choisi

**Critères d'acceptation** : la suite passe en CI Windows.

## 10.10 — Recette et release `v1.2.0` (#371)
**Branche** : — · **Dépend de** : 10.9

- [ ] Recette Playwright sur l'app réelle (FR et EN, clair et sombre, fenêtre étroite), y compris la lecture des fichiers exportés
- [ ] Questions à Clément : effets de texte, styles de livre, ADR 0010
- [ ] Release `v1.2.0`

**Critères d'acceptation** : la recette est validée avant la release.
