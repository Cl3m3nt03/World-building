# M7 — Canvas

**Objectif** : un tableau blanc libre pour le brainstorming et les mood boards, où les éléments du monde restent vivants. Un canvas se crée depuis World ; on y dessine au stylo, on pose des notes (fond quadrillé, ligné ou pointé), des textes, des formes (flèches, rectangles, ellipses, nuages, bulles), des sections qui déplacent leur contenu en bloc, et des images (médiathèque, glisser-déposer depuis le PC, collage). On y glisse des cartes depuis la sidebar, ou on insère une carte, une map ou un graph par un sélecteur : ils s'affichent en vignette ou en aperçu, restent à jour et s'ouvrent d'un double-clic. Tout s'enregistre seul.

**Spec** : `docs/features/06-canvas.md` (board : node `9:579`, texte « Canvas » relu, captures regardées : barre d'outils flottante en bas, notes colorées, insertion carte / map / graph, sections, médiathèque à droite). **Stack** : Excalidraw (`@excalidraw/excalidraw`, MIT, ADR 0001), compatible React 19.

**Hors M6 → M7** : un arbre de relations posé sur un canvas (« l'arbre posé sur un canvas arrive avec M7 », roadmap M6) entre dans 7.5 avec les maps et graphs.

**Hors M7** : la recherche d'images Google de vvd est remplacée par le glisser-déposer et le collage (contexte.md) ; la collaboration en temps réel d'Excalidraw n'est pas utilisée (mono-utilisateur).

**Choix de conception (dans les PR, sans ADR : ils suivent l'ADR 0001 et le modèle indicatif de la spec)** :
- **Comme une map ou un arbre**, le front tient la scène et l'envoie en entier à chaque sauvegarde (après une courte pause, en quittant, avant la fermeture) ; le Rust la vérifie (JSON, taille bornée, pas de binaire) et la remplace. Annuler / rétablir est celui d'Excalidraw.
- **Les éléments BuilderZ** (carte, map, graph, arbre) sont des éléments Excalidraw *embeddable* portant `customData: { kind, documentId }` ; le front les dessine lui-même (`renderEmbeddable`) à partir des données à jour du monde : renommer une carte met sa vignette à jour sans toucher à la scène.
- **Les notes** sont aussi des *embeddables* (`customData: { kind: "note", pattern, color }` et leur texte) : Excalidraw n'a ni fond quadrillé, ligné ou pointé, ni post-it.
- **Nuage et bulle** sont des lignes fermées générées (points calculés), donc redimensionnables, colorables et remplissables comme les autres formes.
- **Les images** sont des assets du monde : la scène ne garde que l'id du fichier ; à l'ouverture, le front charge chaque asset et le donne à Excalidraw. Jamais de base64 en base.
- Le style d'Excalidraw (couleurs, polices, barre d'outils en bas comme sur le board) suit nos tokens, en clair et en sombre ; la langue suit celle de l'app.

**Ordre d'exécution** : 7.1 → 7.2 → 7.3, puis 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, et la recette 7.12 en dernier.

---

## 7.1 — Socle de données des canvas (#268)
**Branche** : `feat/canvas-core` · **Dépend de** : —

- [ ] Migration : `canvases` (document_id, scene JSON, app_state JSON), relié au document (`ON DELETE CASCADE`) ; les assets cités par une scène sont connus (une image utilisée n'est pas supprimée de la médiathèque sans avertissement)
- [ ] Commandes : créer un canvas, le lire, enregistrer la scène et le cadrage en une fois, dupliquer
- [ ] Vérifications du Rust : JSON valide, taille bornée, aucune donnée binaire (`dataURL`) dans la scène
- [ ] Le canvas suit la corbeille, la duplication et la suppression des documents ; tests Rust

**Critères d'acceptation** : une scène se relit à l'identique ; une scène avec une image en base64 est refusée.

## 7.2 — Créer, ouvrir et parcourir un canvas (#269)
**Branche** : `feat/canvas-view` · **Dépend de** : 7.1

- [ ] « Nouveau canvas » : menu « Nouveau document », clic droit dans l'arbre des documents, tuile de l'espace vide (plus « bientôt ») ; icône, filtre, dupliquer, corbeille
- [ ] Excalidraw dans l'onglet World : thème clair / sombre de l'app, langue de l'app, nom modifiable en haut à gauche
- [ ] Navigation : outil main, bouton du milieu, molette ; « Recentrer » ; clavier
- [ ] Sauvegarde automatique (pause, en quittant, avant la fermeture) ; dépendance `@excalidraw/excalidraw` justifiée dans la PR

**Critères d'acceptation** : un dessin fait dans un canvas est là après relance, dans les deux thèmes.

## 7.3 — Barre d'outils et style (#270)
**Branche** : `feat/canvas-tools` · **Dépend de** : 7.2

- [ ] Barre d'outils flottante en bas, comme sur le board : sélection, main, stylo, notes, texte, formes, insérer, section, images ; options de l'outil au-dessus (couleur, épaisseur, trait, remplissage)
- [ ] Couleurs, polices et menus d'Excalidraw alignés sur nos tokens ; les éléments du menu d'Excalidraw sans objet ici (collaboration, export vers excalidraw.com…) retirés

**Critères d'acceptation** : chaque outil du board est accessible depuis la barre, à la souris et au clavier.

## 7.4 — Cartes glissées depuis la sidebar (#271)
**Branche** : `feat/canvas-cards` · **Dépend de** : 7.2

- [ ] Glisser une carte de la sidebar sur le canvas : une vignette (image, nom, type) à l'endroit lâché
- [ ] La vignette suit la carte (nom, image, type) ; double-clic ouvre la carte ; carte à la corbeille : vignette « introuvable »

**Critères d'acceptation** : renommer une carte met à jour sa vignette ; un double-clic l'ouvre.

## 7.5 — Insérer une carte, une map, un graph ou un arbre (#272)
**Branche** : `feat/canvas-embeds` · **Dépend de** : 7.4

- [ ] Outil « Insérer » : un sélecteur (recherche) de cartes, maps, graphs et arbres du monde, posé au centre de la vue
- [ ] Maps, graphs et arbres en aperçu ; double-clic ouvre le document

**Critères d'acceptation** : une map et un graph insérés s'affichent en aperçu et s'ouvrent d'un double-clic.

## 7.6 — Notes (#273)
**Branche** : `feat/canvas-notes` · **Dépend de** : 7.3

- [ ] Outil Notes : un post-it qu'on écrit aussitôt ; couleur ; fond quadrillé, ligné, pointé ou uni ; titre et texte modifiables sur place

**Critères d'acceptation** : une note lignée écrite est gardée après relance.

## 7.7 — Formes nuage et bulle (#274)
**Branche** : `feat/canvas-shapes` · **Dépend de** : 7.3

- [ ] Nuage et bulle dans les formes, à côté des flèches, lignes, rectangles et ellipses ; couleur, trait et remplissage réglables

**Critères d'acceptation** : un nuage et une bulle se posent, se redimensionnent et se colorent.

## 7.8 — Sections (#275)
**Branche** : `feat/canvas-sections` · **Dépend de** : 7.4

- [ ] Outil Section (cadres Excalidraw) : un cadre nommé ; ce qui est dedans se déplace en bloc

**Critères d'acceptation** : trois cartes glissées dans une section se déplacent avec elle.

## 7.9 — Images (#276)
**Branche** : `feat/canvas-images` · **Dépend de** : 7.2

- [ ] Depuis la médiathèque (panneau), par glisser-déposer depuis le PC et par collage (`Ctrl+V`) : l'image est importée comme asset du monde
- [ ] La scène garde l'id de l'asset ; à l'ouverture, les images se rechargent depuis la médiathèque

**Critères d'acceptation** : une image collée apparaît dans la médiathèque ; elle est là après relance.

## 7.10 — Sauvegarde, annuler et rétablir (#277)
**Branche** : `feat/canvas-history` · **Dépend de** : 7.3 à 7.9

- [ ] Chaque modification enregistrée après une courte pause, en quittant et avant la fermeture ; `Ctrl+Z` / `Ctrl+Y` (et boutons) couvrent aussi les éléments BuilderZ et les notes

**Critères d'acceptation** : dix actions annulées puis rétablies redonnent le même canvas, aussi après relance.

## 7.11 — Tests de bout en bout M7 (#278)
**Branche** : `test/e2e-m7` · **Dépend de** : 7.1 à 7.10

- [ ] Scénarios : trois cartes glissées puis regroupées dans une section déplacée en bloc, une carte renommée dont la vignette suit, une image collée dans la médiathèque, une note, relance

**Critères d'acceptation** : les critères de `06-canvas.md` sont couverts et passent en CI (fenêtre du runner : 1028×749).

## 7.12 — Recette M7 (#279)
**Branche** : — · **Dépend de** : 7.11

- [ ] Issue « Recette M7 » déroulée avec Playwright sur l'app réelle (FR et EN, clair et sombre, fenêtre étroite)

**Critères d'acceptation** : la recette est validée avant la release.

---

## Définition de « M7 terminé »

1. Les critères d'acceptation de `docs/features/06-canvas.md` sont remplis et testés.
2. Toute la nouvelle interface est traduite, utilisable au clavier et fonctionne dans les deux thèmes.
3. La CI est verte sur `main`, et une release `v0.7.0` publie l'installeur.
