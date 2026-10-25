# vvd — accueil et navigation (observations)

Note d'étude pour V2-M2 (`docs/roadmap/V2-M2-accueil.md`), rédigée avec nos mots. Aucun fichier de vvd n'est repris (`docs/outils/rea.md`).

**Sources** : captures du board FigJam (bloc « Interface », node `3:18`), le 2026-10-25. **À compléter** par une session REA sur le compte de Clément (mesures, états, interactions fines).

## Barre du haut

- Trois îlots : à gauche le monde courant (icône + nom + badge), au centre les onglets en icônes, à droite les actions.
- Les onglets n'ont qu'une icône ; leur nom apparaît **au survol**, dans une petite étiquette sous l'icône. L'onglet actif porte aussi son nom dans l'îlot.
- Un clic sur l'îlot du monde ouvre un **popover du monde** : couverture à gauche, nom, description (« Cliquez pour ajouter une description »), une pastille de genre ; deux onglets en haut (le monde, le profil).

## Onglet World vide

- Au centre bas de l'espace de travail, une rubrique « Commencer avec » au-dessus d'un **dock de grandes tuiles** (carte, map, canvas, graph) : icône dans un carré de verre, libellé dessous.
- La sidebar reste visible à gauche, avec un pied d'actions en icônes.

## Home du monde

- Grand titre d'accueil en haut à gauche, sous lui une ligne « Reprendre là où vous en étiez » avec le dernier document en pastille, « ou essayer quelque chose de nouveau » et des pastilles de création.
- « Espaces récents » : une rangée de **tuiles image** (vignette du document, nom, date relative).
- À droite, une colonne « Gérer » : liste courte (types, médias, thème, réglages), chaque ligne en pastille avec icône.
- En bas, un aperçu du graph (vide : une icône et un texte d'aide).

## Écarts voulus avec BuilderZ

- Pas de profil ni de compte (local, mono-utilisateur) : le popover du monde n'a pas d'onglet « profil ».
- Pas de fil de nouveautés ni de bouton « Feedback ».
- La liste des mondes n'apparaît pas sur le board : on la conçoit pour BuilderZ (écran d'ouverture « atlas », ADR 0012).
