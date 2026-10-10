# ADR 0010 — Quill avancé : sons ancrés, lecture et exports

- **Statut** : Proposé (pris pour avancer M10 ; à confirmer par Clément)
- **Date** : 2026-10-10
- **Décideur** : Claude, pour Clément

## Contexte

M10 (spec `docs/features/08-quill.md`, partie « Avancé ») ajoute à Quill :

- un **mode audio**, avec des effets sonores sur une ligne et des ambiances ou des musiques qui couvrent une section, pris dans la médiathèque ;
- une **lecture** (« Play ») qui fait entendre ces sons ligne par ligne ;
- une **prévisualisation de lecture**, avec ses réglages et trois gabarits (navigateur, mobile, liseuse) ;
- des **exports** PDF, DOCX et ePub, chapitre par chapitre, avec le brouillon choisi.

La stack (ADR 0001) a déjà retenu Three.js pour la couverture 3D, la Web Audio API pour le son, Typst pour le PDF et des crates dédiées pour DOCX et ePub. Il reste trois questions :

1. Comment un son tient-il à un passage du texte qui change ?
2. Où vivent les réglages de lecture ?
3. Qui fabrique les fichiers exportés, et à partir de quoi ?

## Décision

1. **Un son est ancré comme une note (ADR 0009).**
   - Une marque `audioCue` (attribut `cueId`) couvre le passage, et la table `audio_cues` porte le reste : brouillon, type (`effect` ou `ambience`), son de la médiathèque, volume (0 à 100), boucle.
   - Un **effet** se joue quand la lecture atteint le premier paragraphe marqué.
   - Une **ambiance** se joue du premier au dernier paragraphe marqué, puis s'éteint en fondu. Elle tourne en boucle si on le demande.
   - La marque suit le texte quand on écrit autour.
   - Copier un brouillon copie ses sons et renomme leurs ancres, comme pour les notes.
   - Supprimer un son retire sa marque. Supprimer un fichier de la médiathèque est refusé tant qu'un son l'utilise : il apparaît dans « Utilisé par », comme une couverture.
2. **Les réglages de lecture sont ceux de l'histoire.**
   - Ils tiennent dans une colonne `stories.reader_settings` (JSON lu avec tolérance, valeurs par défaut sinon). Ils couvrent le thème de page, le mode de lecture (défilement ou pages), le fond, la police et la mise en page des chapitres.
   - La prévisualisation et les trois exports les utilisent : ce qu'on règle est ce qu'on obtient.
3. **Le Rust fabrique les exports à partir d'un modèle de livre commun.**
   - Le Rust lit les chapitres choisis, avec un brouillon par chapitre (le courant par défaut). Il en tire un **modèle de livre** (`domain/book.rs`) : titres, paragraphes, gras, italique, barré, citations, séparateurs, images de la médiathèque. Les mentions deviennent leur texte, et les notes et les sons ne sont pas exportés.
   - Trois rédacteurs lisent ce modèle :
     - le PDF passe par Typst (`typst`, `typst-pdf` et les polices embarquées de `typst-kit`) ;
     - le DOCX passe par `docx-rs` ;
     - l'ePub passe par `epub-builder`.
   - La couverture (couleur, finition, illustration et titre) est dessinée par le front, envoyée en PNG et placée en première page.
   - Le fichier est écrit là où l'utilisateur l'a choisi, par la boîte de dialogue native.
4. **L'audio reste dans l'app.**
   - Le PDF et le DOCX n'en ont pas.
   - L'ePub non plus en M10 : le son ePub (media overlays) est mal lu par les liseuses, ce qui le reporte à plus tard avec une « liseuse HTML avec audio ».

## Conséquences

- Les sons ont le même cycle de vie que les notes, et les outils pour les marques existent déjà (`rename_note_marks`, suppression d'une marque).
- Les dépendances `typst`, `typst-pdf`, `typst-kit`, `docx-rs` et `epub-builder` sont ajoutées. Typst alourdit la compilation du Rust et l'installeur (polices incluses), mais il est le seul à donner un PDF typographié sans moteur externe.
- Les polices du PDF sont celles embarquées par Typst (Libertinus Serif, New Computer Modern, DejaVu Sans Mono). Les polices de lecture qui n'y sont pas se rabattent sur la plus proche, et la prévisualisation le dit.
- Une seule source de vérité pour le contenu exporté : les trois formats donnent le même texte, testé une fois sur le modèle de livre.
