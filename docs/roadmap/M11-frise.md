# M11 — Frise chronologique → `v1.3.0`

**Objectif** : raconter l'histoire du monde dans le temps. Chaque monde a son calendrier (ères, mois). Une frise est un document de World : des pistes, des événements et des périodes, reliés aux cartes, qu'on parcourt en zoomant des siècles aux jours.

**Spec** : `docs/features/09-frise.md`. Le board FigJam ne la décrit pas. Elle a d'abord été conçue d'après les outils de référence du worldbuilding, puis alignée sur la « Chronologie » de vvd d'après une capture envoyée par Clément (11.5b). **Décision** : ADR 0011.

**Choix de conception** :
- **Un document de World** : la frise a la sidebar, la corbeille, la recherche, les épingles et le wiki, comme la map et le graph.
- **Le calendrier appartient au monde** (`world.json`) et sert à toutes ses frises.
- **Des jours entiers** : une date est un nombre de jours depuis l'an 0, avec sa précision (année, mois ou jour). Le calendrier ne sert qu'à l'affichage et à la saisie.
- **Les cartes d'abord** : un élément représente volontiers une carte, et la carte voit la frise dans « Cité dans ».

**Ordre d'exécution** : 11.1 → 11.2 → 11.3 → 11.4 → 11.5 → 11.5b, puis 11.6, et 11.7, 11.8 en dernier.

---

## 11.1 — Socle : calendrier, frises, pistes, éléments (#388)
**Branche** : `feat/timeline-core` · **Dépend de** : —

- [ ] Migration :
  - `documents` reconstruite avec le type `timeline` ;
  - tables `timelines`, `timeline_tracks` et `timeline_items` ;
  - liens de type `timeline`.
- [ ] Calendrier du monde dans `world.json`, lu avec tolérance : des ères et des mois, douze mois de 30 jours par défaut.
- [ ] Commandes :
  - créer une frise (avec une première piste) et la lire ;
  - pistes : ajouter, renommer, colorer, réordonner, supprimer ;
  - éléments : créer, modifier, supprimer ;
  - lire et enregistrer le calendrier.
- [ ] Le Rust vérifie le contenu et refait les liens vers les cartes.

**Critères d'acceptation** : une frise créée a une piste ; un élément qui représente une carte la fait citer ; une période qui finit avant son début est refusée.

## 11.2 — Calendrier du monde (#389)
**Branche** : `feat/world-calendar` · **Dépend de** : 11.1

- [ ] Section « Calendrier » des réglages du monde : ères (nom, abréviation, année de départ) et mois (nom, jours), avec un exemple de date affichée en direct
- [ ] `calendar.ts` : passer d'une date (ère, année, mois, jour) à des jours, et l'inverse ; mise en forme (« 12 du 3e mois 298 DC ») ; lecture d'une saisie
- [ ] Un champ de date réutilisable (ère, année, mois, jour), au clavier

**Critères d'acceptation** : un calendrier à deux ères et douze mois nommés affiche « 12 du 3e mois 298 DC » et relit cette saisie.

## 11.3 — La frise : affichage et navigation (#390)
**Branche** : `feat/timeline-view` · **Dépend de** : 11.2

- [ ] Vue horizontale :
  - graduation qui s'adapte au zoom (siècles, décennies, années, mois, jours) ;
  - ères en bandes de fond ;
  - pistes nommées ;
  - événements en repères, périodes en barres, avec image de carte et titre.
- [ ] Défilement (molette, glisser), zoom autour du pointeur (Ctrl + molette, `+` / `-`), « Tout voir », « Aller à une date »
- [ ] Clavier : flèches, Tab d'un élément à l'autre, Entrée pour l'ouvrir ; noms accessibles (« Rébellion de Robert, de 282 à 283 DC »)

**Critères d'acceptation** : le zoom passe des siècles aux jours sans perdre le centre ; 500 éléments restent fluides.

## 11.4 — La frise : édition (#391)
**Branche** : `feat/timeline-edit` · **Dépend de** : 11.3

- [ ] Ajouter un événement ou une période (bouton, double-clic sur une piste) ; gérer les pistes (ajouter, renommer, couleur, réordonner, supprimer)
- [ ] Tirer un élément pour le déplacer (d'une piste à l'autre aussi) ; étirer une période par ses bords ; calage sur l'unité visible ; au clavier aussi
- [ ] Panneau d'élément : titre, dates, piste, couleur, description, carte représentée, supprimer ; annuler et rétablir

**Critères d'acceptation** : un élément tiré d'une année se retrouve un an plus tard après relance ; Ctrl + Z le remet.

## 11.5 — La frise et le monde (#392)
**Branche** : `feat/timeline-world` · **Dépend de** : 11.4

- [ ] « Ajouter des cartes » : choisir des cartes, une piste et une date
- [ ] Un élément lié ouvre sa carte (à côté) ; « Cité dans » d'une carte montre la frise et l'ouvre centrée sur l'élément
- [ ] Bloc « Frise » dans une carte (comme le bloc Map)

**Critères d'acceptation** : la carte Robert Baratheon, placée sur la frise, la montre dans « Cité dans », qui ouvre la frise centrée sur lui.

## 11.5b — Frise façon vvd (#403)
**Branche** : `feat/timeline-vvd` · **Dépend de** : 11.5

Ajoutée après la capture de la « Chronologie » de vvd envoyée par Clément.

- [ ] Vue « Axe » par défaut (axe, points, bulles), vue « Pistes » en second mode
- [ ] Carte d'élément flottante : image, nom, visibilité, supprimer, date, description, étiquettes, cartes
- [ ] Étiquettes (migration 0021) et filtre ; barre d'outils flottante en bas, zoom en bas à droite

**Critères d'acceptation** : la frise GoT ressemble à la capture vvd ; tout ce qui marchait en 11.3–11.5 marche dans les deux vues.

## 11.6 — La frise dans le wiki (#393)
**Branche** : `feat/timeline-wiki` · **Dépend de** : 11.3

- [ ] Une frise visible a sa page dans le wiki, en lecture : pistes, ères, éléments ; un élément ouvre la page de sa carte ; export HTML du wiki compris

**Critères d'acceptation** : la frise exportée se lit sans réseau.

## 11.7 — Tests de bout en bout M11 (#394)
**Branche** : `test/m11-e2e` · **Dépend de** : 11.5, 11.6

- [ ] Scénarios :
  - calendrier réglé ;
  - frise créée avec une période et un événement liés à des cartes ;
  - « Cité dans » ;
  - un élément déplacé gardé après rechargement.

**Critères d'acceptation** : la suite passe en CI Windows.

## 11.8 — Recette et release `v1.3.0` (#395)
**Branche** : — · **Dépend de** : 11.7

- [ ] Recette Playwright sur l'app réelle (FR et EN, clair et sombre, fenêtre étroite) ; une frise de démonstration dans le monde Game of Thrones ; questions à Clément (ADR 0011) ; release `v1.3.0`

**Critères d'acceptation** : la recette est validée avant la release.
