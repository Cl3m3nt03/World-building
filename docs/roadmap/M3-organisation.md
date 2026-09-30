# M3 — Organisation

**Objectif** : retrouver instantanément n'importe quel document, même dans un monde qui en compte des milliers, et le ranger comme on veut. La liste simple des cartes de M2 devient une vraie sidebar : recherche plein texte, filtres et tri, épingles, dossiers, hiérarchie parent / enfant, ordre manuel par glisser-déposer. M3 intègre aussi les retours d'utilisateurs du 29/09/2026 classés ici (blocs, stockage, médiathèque partagée).

**Spec** : `docs/features/02-organisation.md` (board : node `4:197`, pavé « Cards organisation »). Retours : `docs/roadmap/README.md`, « Retours d'utilisateurs à intégrer ».

**Hors M3** : les autres natures de documents (map, graph, canvas, arbre) arrivent avec leurs milestones ; la sidebar les accepte déjà (filtres, dossiers, hiérarchie), mais seules les cartes existent. « Visible dans le wiki » est affiché dans le menu contextuel, signalé « arrive avec M8 ». La détection de noms dans Quill (M9) réutilisera l'index de recherche posé ici.

**Ordre d'exécution** : 3.1 → 3.2, puis 3.3 → 3.4 → 3.5 → 3.6, puis 3.7 → 3.8 → 3.9, puis 3.10 → 3.11 → 3.12 → 3.13, puis 3.14, et la recette 3.15 en dernier.

---

## 3.1 — Socle de l'arborescence
**Branche** : `feat/tree-core` · **Dépend de** : —

- [ ] Migration : table `folders` (parent, nom, icône, ordre) ; colonnes `folder_id`, `parent_id`, `sort_order`, `pinned_order` sur `documents` (nullables ou avec défaut, les mondes de la 0.3.0 s'ouvrent sans perte)
- [ ] Commandes : lire l'arbre (dossiers et documents), déplacer un document ou un dossier (dans un dossier, sous un parent, à une position), créer, renommer, changer l'icône et supprimer un dossier (remonter son contenu d'un niveau, ou le mettre à la corbeille)
- [ ] Les cycles sont refusés par le Rust (un document sous son propre descendant, un dossier dans son propre sous-dossier)
- [ ] Un document mis à la corbeille garde sa place ; restauré, il la retrouve (ou remonte à la racine si son dossier ou son parent a disparu)
- [ ] Tests Rust : déplacements, ordre stable, cycles refusés, suppression d'un dossier dans les deux modes, migration d'un monde 0.3.0

**Critères d'acceptation** : l'ordre, les dossiers et la hiérarchie sont conservés après réouverture ; un déplacement qui créerait un cycle est refusé.

## 3.2 — Sidebar en arborescence
**Branche** : `feat/sidebar-tree` · **Dépend de** : 3.1

- [ ] La liste simple devient un arbre : dossiers (icône, nom, chevron) et documents, les enfants d'un document sous un chevron
- [ ] Rôle `tree` accessible : flèches haut / bas, droite ouvre, gauche ferme ou remonte au parent, Entrée ouvre le document
- [ ] Rendu fluide avec 5 000 documents (liste virtualisée si nécessaire, dépendance justifiée dans la PR)
- [ ] La carte ouverte reste mise en évidence, ses dossiers et parents dépliés

**Critères d'acceptation** : un monde de 5 000 cartes rangées en dossiers se parcourt au clavier sans ralentissement.

## 3.3 — Glisser-déposer : ordre, dossiers, parent / enfant
**Branche** : `feat/sidebar-dnd` · **Dépend de** : 3.2

- [ ] Glisser un document vers le haut ou le bas pour le réordonner (ordre manuel enregistré)
- [ ] Le déposer sur un dossier pour l'y ranger ; sur un document pour en faire son enfant
- [ ] Indicateur visuel des trois cas : insérer avant, insérer après, devenir enfant de ; un dépôt qui créerait un cycle est montré refusé
- [ ] Au clavier : « Déplacer vers… » (3.6) fait la même chose

**Critères d'acceptation** : Royaume › Ville › Taverne se construit par glisser-déposer et reste après relance ; déposer Royaume sur Taverne est refusé.

## 3.4 — Dossiers
**Branche** : `feat/folders` · **Dépend de** : 3.2

- [ ] Créer un dossier par un bouton en bas de la sidebar et par clic droit ; le nommer aussitôt
- [ ] Choisir son icône dans la bibliothèque d'icônes (celle des types de cartes)
- [ ] Dossiers imbriqués ; renommer, supprimer avec le choix « remonter le contenu » ou « mettre le contenu à la corbeille »

**Critères d'acceptation** : un dossier « Personnages » avec une icône, un sous-dossier « Nobles », et leur contenu sont conservés après relance.

## 3.5 — Épingles
**Branche** : `feat/pins` · **Dépend de** : 3.2

- [ ] Épingler / désépingler par clic droit ; section « Épinglés » en haut de la sidebar, avec l'image agrandie du document
- [ ] Réordonner les épingles par glisser-déposer
- [ ] Un document épinglé mis à la corbeille quitte les épingles et les retrouve s'il est restauré

**Critères d'acceptation** : trois cartes épinglées dans un ordre choisi le gardent après relance.

## 3.6 — Menu contextuel d'un document
**Branche** : `feat/document-menu` · **Dépend de** : 3.3, 3.5

- [ ] Clic droit sur un document : Ouvrir, Renommer (sur place), Épingler, Dupliquer, Déplacer vers…, Visible dans le wiki (« arrive avec M8 »), Supprimer
- [ ] Dupliquer une carte : titre « … (copie) », type, image, alias, propriétés et contenu copiés, placée juste après l'original
- [ ] « Déplacer vers… » : choix d'un dossier ou d'un document parent au clavier, cycles non proposés

**Critères d'acceptation** : tout le menu s'utilise au clavier ; une carte dupliquée est identique à l'original, sauf son nom.

## 3.7 — Recherche plein texte
**Branche** : `feat/search` · **Dépend de** : 3.2

- [ ] Index FTS5 des noms, alias et contenus (`content_text`), tenu à jour par le Rust à chaque enregistrement ; construit à l'ouverture d'un monde de la 0.3.0
- [ ] Recherche au fil de la frappe dans la sidebar : correspondances de nom et d'alias d'abord, puis de contenu avec un extrait ; accents et casse ignorés
- [ ] Clavier : flèches, Entrée ouvre, Échap ferme ; `Ctrl+K` ouvre la recherche depuis n'importe où
- [ ] Test de performance : moins de 100 ms sur 5 000 cartes

**Critères d'acceptation** : une carte se trouve par un de ses alias et par un mot de son contenu, en moins de 100 ms sur 5 000 cartes.

## 3.8 — Filtres et tri
**Branche** : `feat/filters-sort` · **Dépend de** : 3.2

- [ ] Filtres cumulables par nature de document et par type ou sous-type de carte
- [ ] Tri manuel (par défaut), alphabétique ou par date de création, ordre inversable
- [ ] Hors tri manuel, le glisser-déposer pour réordonner est désactivé et un indicateur le dit

**Critères d'acceptation** : filtrer sur « Personnage » et trier par nom montre les personnages dans l'ordre alphabétique ; revenir au tri manuel rend l'ordre choisi.

## 3.9 — Sidebar redimensionnable, repliable, mémorisée par monde
**Branche** : `feat/sidebar-state` · **Dépend de** : 3.2, 3.8

- [ ] Largeur et repli de la sidebar, dossiers et parents ouverts, filtres et tri : mémorisés pour chaque monde (emplacement à décider dans la PR, sans passer par `localStorage` : CLAUDE.md)
- [ ] Repli au clavier, largeur au clavier (poignée focalisable)

**Critères d'acceptation** : deux mondes gardent chacun leur largeur et leurs dossiers ouverts après relance.

## 3.10 — Plusieurs images dans un bloc, avec défilement (#110)
**Branche** : `feat/image-gallery-block` · **Dépend de** : —

- [ ] À cadrer au démarrage de l'étape (retour d'utilisateur) : galerie défilante dans le bloc image (flèches, clavier, légende par image), réordonner et retirer les images
- [ ] Chaque image reste listée dans les usages de la médiathèque

**Critères d'acceptation** : un bloc de trois images se parcourt à la souris et au clavier, et reste identique après relance.

## 3.11 — Blocs côte à côte (#111)
**Branche** : `feat/block-columns` · **Dépend de** : —

- [ ] À cadrer au démarrage de l'étape : glisser un bloc à gauche ou à droite d'un autre pour former une ligne, largeur des colonnes, affichage sur une fenêtre étroite
- [ ] Au clavier depuis le menu du bloc

**Critères d'acceptation** : deux blocs placés côte à côte le restent après relance, et se remettent l'un sous l'autre sur une fenêtre étroite.

## 3.12 — Stockage : place utilisée et restante, limite (#112)
**Branche** : `feat/storage` · **Dépend de** : 3.13 (à cadrer ensemble)

- [ ] À cadrer : place utilisée (monde, médiathèque), place restante sur le disque, limite choisie par l'utilisateur et ce qui se passe quand elle est atteinte

## 3.13 — Médiathèque partagée entre les mondes (#113)
**Branche** : `feat/shared-media` · **Dépend de** : —

- [ ] **Décision à prendre avec Clément, puis ADR** : un monde doit rester autonome (ADR 0001). Piste proposée : une bibliothèque commune où l'on pioche, l'image choisie étant copiée dans le monde
- [ ] Puis la réalisation selon la décision

## 3.14 — Tests de bout en bout M3
**Branche** : `test/e2e-m3` · **Dépend de** : 3.3 à 3.9

- [ ] Scénarios : hiérarchie par glisser-déposer et cycle refusé ; dossier avec icône ; épingles ordonnées ; recherche par alias et par contenu ; filtre et tri ; état de la sidebar par monde après relance

**Critères d'acceptation** : les critères de `02-organisation.md` sont couverts et passent en CI.

## 3.15 — Recette M3
**Branche** : — · **Dépend de** : 3.14

- [ ] Issue « Recette M3 » tenue à jour après chaque étape, déroulée avec Playwright sur l'app réelle (FR et EN), puis validée par Clément

**Critères d'acceptation** : la recette est validée avant la release.

---

## Définition de « M3 terminé »

1. Les critères d'acceptation de `docs/features/02-organisation.md` sont remplis et testés, dont la recherche en moins de 100 ms sur 5 000 cartes.
2. Toute la nouvelle interface est traduite, accessible au clavier et fonctionne dans les deux thèmes.
3. Un monde créé en 0.3.0 s'ouvre sans perte, ses cartes à la racine dans l'ordre de création.
4. La CI est verte sur `main`, et une release `v0.4.0` publie l'installeur.
