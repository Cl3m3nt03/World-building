# M4 — Map

**Objectif** : transformer une illustration de carte du monde en espace interactif. On crée une map depuis World avec une image de fond, on y pose des pins reliés aux cartes (ou de simples repères), on trace des zones, on écrit des textes, le tout rangé en calques qu'on masque ou réordonne. Le fond peut changer sans rien perdre, tout s'enregistre seul, `Ctrl+Z` / `Ctrl+Y` fonctionnent, et une map s'intègre comme bloc dans une carte.

**Spec** : `docs/features/03-map.md` (board : node `5:255`). **Stack** : Leaflet en `CRS.Simple` + couche SVG (ADR 0001).

**Hors M4** : la map posée sur un canvas arrive avec M7 ; une bibliothèque de fonds libres de droits pourra venir plus tard (adaptation locale de la spec).

**Choix de conception (dans les PR, sans ADR : ils suivent l'ADR 0001 et le modèle indicatif de la spec)** :
- Positions en **coordonnées relatives à l'image** (0 à 1), pour survivre à un changement de fond ou de résolution.
- Le front tient l'état de la map (calques, pins, zones, textes) et l'envoie **en entier** à chaque sauvegarde ; le Rust le vérifie et remplace le contenu de la map dans une transaction, et recalcule les liens `map_pin`. Annuler / rétablir travaille donc sur des instantanés de cet état.

**Ordre d'exécution** : 4.1 → 4.2 → 4.3, puis 4.4 → 4.5 → 4.6 → 4.7 → 4.8 → 4.9, puis 4.10, 4.11, et la recette 4.12 en dernier.

---

## 4.1 — Socle de données des maps (#159)
**Branche** : `feat/map-core` · **Dépend de** : —

- [ ] Migration : tables `maps` (document, fond, largeur, hauteur, tuiles), `map_layers`, `map_pins`, `map_zones`, `map_texts` (modèle de la spec), reliées au document (`ON DELETE CASCADE`)
- [ ] Commandes : créer une map (titre, image de fond de la médiathèque : un calque par défaut), lire une map, enregistrer son contenu (calques, pins, zones, textes) en une fois, changer le fond
- [ ] Vérifications du Rust : coordonnées entre 0 et 1, calques existants, au moins 3 sommets par zone, tailles bornées
- [ ] Les pins liés à une carte créent des liens `map_pin` (rétroliens de la carte), remplacés à chaque enregistrement
- [ ] La map suit la corbeille, la duplication et la suppression des documents
- [ ] Tests Rust

**Critères d'acceptation** : une map et tout son contenu se relisent à l'identique après réouverture ; un pin lié à une carte apparaît dans ses rétroliens.

## 4.2 — Créer, ouvrir et parcourir une map (#160)
**Branche** : `feat/map-view` · **Dépend de** : 4.1

- [ ] « Nouvelle map » dans la sidebar (bouton et clic droit) : le sélecteur d'image choisit le fond, la map s'ouvre ; elle apparaît dans l'arbre (icône map), filtres et recherche compris
- [ ] Vue Leaflet `CRS.Simple` : zoom molette / pavé, déplacement par glisser ou bouton du milieu, bouton « Recentrer », zoom au clavier (`+` / `-`, flèches pour se déplacer)
- [ ] Nom modifiable en haut à gauche, comme une carte
- [ ] Dépendance `leaflet` justifiée dans la PR

**Critères d'acceptation** : une map créée avec une image s'ouvre, se zoome et se déplace à la souris et au clavier, et se retrouve dans la sidebar après relance.

## 4.3 — Très grandes images en tuiles (#161)
**Branche** : `feat/map-tiles` · **Dépend de** : 4.2

- [ ] Au-delà de 8 000 px de côté, le Rust découpe le fond en tuiles (pyramide de niveaux) dans le dossier du monde, une fois, en tâche de fond avec un état « préparation… »
- [ ] Leaflet charge les tuiles par un protocole limité au dossier des tuiles du monde ouvert
- [ ] Les tuiles sont refaites si le fond change, et supprimées avec la map

**Critères d'acceptation** : la navigation reste fluide sur une image de 16 000 × 16 000 px.

## 4.4 — Calques (#162)
**Branche** : `feat/map-layers` · **Dépend de** : 4.2

- [ ] Panneau des calques : créer, renommer, supprimer (son contenu va au calque voisin, ou est supprimé, au choix), réordonner (glisser et clavier), œil pour masquer / afficher
- [ ] Le calque actif reçoit ce qu'on pose ; l'ordre des calques est l'ordre d'affichage

**Critères d'acceptation** : masquer un calque cache tout son contenu ; l'ordre et la visibilité sont conservés après relance.

## 4.5 — Pins (#163)
**Branche** : `feat/map-pins` · **Dépend de** : 4.4

- [ ] Glisser une carte de la sidebar sur la map pose un pin lié (image ou icône de la carte) ; clic droit › « Ajouter une carte ici » (choix au clavier) ; clic droit › « Ajouter un pin » (repère : icône, couleur, libellé)
- [ ] Un pin se déplace par glisser (et aux flèches quand il a le focus), a une taille réglable et un calque
- [ ] Clic : aperçu de la carte ; double-clic ou Entrée : ouvre la carte
- [ ] Supprimer un pin (menu, `Suppr`)

**Critères d'acceptation** : un pin lié à une carte l'ouvre et apparaît dans ses rétroliens ; un pin vide garde son icône, sa couleur et son libellé après relance.

## 4.6 — Zones (#164)
**Branche** : `feat/map-zones` · **Dépend de** : 4.4

- [ ] Outil Zone : chaque clic pose un sommet, une ligne pointillée suit la souris, le premier sommet s'allume au survol et ferme la forme ; `Échap` annule, `Retour arrière` retire le dernier sommet
- [ ] Panneau de propriétés : label (texte, police, taille), carte liée, couleur, opacité, motif (plein, hachures, points, croisillons), calque
- [ ] Édition de la forme : déplacer un sommet, en ajouter un en cliquant sur un bord, en supprimer un par clic droit

**Critères d'acceptation** : on trace un polygone de 10 sommets, on le ferme sur le premier point et on le lie à une carte.

## 4.7 — Textes (#165)
**Branche** : `feat/map-texts` · **Dépend de** : 4.4

- [ ] Outil Texte : un clic pose un texte, modifiable sur place
- [ ] Réglages : police, taille, suit le zoom ou non, espacement des lettres, courbure en arc (SVG `textPath`, positive ou négative), calque

**Critères d'acceptation** : un texte en arc avec un espacement choisi est identique après relance, au zoom près s'il ne suit pas le zoom.

## 4.8 — Changer le fond (#166)
**Branche** : `feat/map-background` · **Dépend de** : 4.5, 4.6, 4.7

- [ ] Bouton « Fond » : le sélecteur d'image remplace le fond ; pins, zones et textes gardent leur place relative

**Critères d'acceptation** : remplacer le fond conserve les pins, les zones et les textes.

## 4.9 — Sauvegarde automatique, annuler et rétablir (#167)
**Branche** : `feat/map-history` · **Dépend de** : 4.5, 4.6, 4.7

- [ ] Chaque modification est enregistrée après un court délai d'inactivité, et à la fermeture
- [ ] `Ctrl+Z` / `Ctrl+Y` (et boutons) dans la map, historique borné

**Critères d'acceptation** : dix actions annulées puis rétablies redonnent la même map, aussi après relance.

## 4.10 — Map dans une carte (#168)
**Branche** : `feat/map-block` · **Dépend de** : 4.2

- [ ] Bloc « Map » dans une carte : choisir une map du monde, aperçu navigable en lecture, bouton pour l'ouvrir

**Critères d'acceptation** : une map intégrée dans une carte s'affiche, se déplace et s'ouvre en grand.

## 4.11 — Tests de bout en bout M4 (#169)
**Branche** : `test/e2e-m4` · **Dépend de** : 4.1 à 4.10

- [ ] Scénarios : créer une map, poser un pin lié et un pin vide, tracer une zone de 10 sommets liée à une carte, un texte en arc, masquer un calque, changer le fond, annuler / rétablir, relance

**Critères d'acceptation** : les critères de `03-map.md` sont couverts et passent en CI.

## 4.12 — Recette M4 (#170)
Checklist tenue dans l'issue de recette, déroulée sur l'app réelle avant la release.
