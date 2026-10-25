# V2-M3 — Les fiches

**Objectif** : la fiche est le cœur du monde. On la rend aussi directe que celle de vvd (`docs/outils/vvd/fiches.md`, session REA du 2026-10-25) et on la pose dans le socle V2 (ADR 0012) : en-tête clair, propriétés ajoutées en deux gestes, sections lisibles, menus rapides au clavier. On reprend l'ergonomie de vvd, jamais ses fichiers.

**Ordre d'exécution** : 3.1 → 3.2 → 3.3 → 3.4 → 3.5, puis 3.6, et 3.7 en dernier.

---

## V2-3.1 — Sélecteur de types en panneau (#472)
- [ ] « Nouvelle carte » (sidebar, Home, « Commencer avec ») ouvre un panneau « Choisir un type » : une recherche, les types principaux à gauche, leurs sous-types à droite, « Nouveau type » et l'aide clavier en pied (↑ ↓ naviguer, ↵ créer, Échap fermer)
- [ ] La pastille de type d'une fiche ouvre le même choix (recherche, sous-types) pour changer le type

**Critères d'acceptation** : créer une carte d'un type au clavier seul (taper, Entrée) ; aucune régression des types de M2.

## V2-3.2 — En-tête de la fiche (#473)
- [ ] Titre en grand à gauche ; pastille du type et visibilité dans le wiki à sa droite ; l'image en portrait à droite (ou un emplacement « Ajouter une image »)
- [ ] Alias sur une ligne compacte : pastilles et « + Ajouter » qui devient un champ sur place ; une carte neuve a son titre sélectionné

**Critères d'acceptation** : à 1028×749, rien ne déborde ; clavier complet ; e2e M2 inchangés ou mis à jour.

## V2-3.3 — Propriétés (#474)
- [ ] « + Ajouter une propriété » ouvre un popover : son nom, puis son genre en familles (texte, nombre, sélection, date ; lien vers une carte d'un type donné)
- [ ] Lignes de propriétés compactes (libellé, valeur), réordonnables comme aujourd'hui

**Critères d'acceptation** : toutes les propriétés de M2 (types, propres à la carte, liens) gardent leur comportement et leurs tests.

## V2-3.4 — Sections et menu « / » (#475)
- [ ] Les intertitres d'une carte deviennent des barres de section (titre, fine ligne) ; au survol : déplier ou replier, et le menu du bloc (ajouter un bloc dessous, monter, descendre, copier, supprimer)
- [ ] Le menu « / » est rangé en familles (blocs de la carte, blocs de texte) avec leurs raccourcis affichés (`#`, `##`, `-`…) et « Échap » en pied

**Critères d'acceptation** : le contenu existant s'affiche sans migration ; clavier et lecteur d'écran comme en M2.

## V2-3.5 — Modèle appliqué à la création (#476)
- [ ] Une carte neuve reçoit d'emblée les sections du modèle de son type (réglage du type « Appliquer à la création », activé par défaut) ; « Appliquer le template » reste au menu

**Critères d'acceptation** : jamais de contenu écrasé ; un type sans modèle donne une carte vide.

## V2-3.6 — Écran des types (#477)
- [ ] L'écran de gestion des types repris sur le socle V2 (liste et détail, icône et couleur, propriétés par défaut, modèle guidé)

**Critères d'acceptation** : mêmes fonctions qu'en M2, plus lisibles ; deux thèmes.

## V2-3.7 — E2E et recette (#478)
- [ ] E2E mis à jour (création par le panneau, en-tête, propriétés, sections) à 1028×749 ; captures dans l'app réelle ; issue de recette pour Clément

**Critères d'acceptation** : Clément valide les fiches avant V2-M4.
