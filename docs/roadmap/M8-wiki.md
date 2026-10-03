# M8 — Wiki → `v1.0.0`

**Objectif** : présenter le monde sous une forme lisible et soignée, dans l'app et en site statique. L'onglet Wiki montre une page d'accueil (bannière, titre, description, recherche, cartes mises en avant) et une page par carte ou par map marquée « Visible dans le wiki », avec son propre thème. On y lit, et on y modifie directement le texte, les images et les propriétés : c'est la même donnée que l'onglet World. « Exporter le wiki » écrit un site HTML qui s'ouvre hors ligne, recherche comprise.

**Spec** : `docs/features/07-wiki.md` (board : node `8:516`, texte « Wiki » relu ; MCP Figma limité, captures lues sur l'export local du board : grande image à gauche qui défile entre les cartes mises en avant avec leur nom, à droite la bannière, le titre, la description, « Search through … » et la grille de cartes avec « Edit Layout » ; page de carte : image à gauche, titre, encadré des propriétés, sections ; fenêtre « Style du site » en bas avec les onglets Thèmes, Couleurs, Polices ; édition depuis le wiki qui se retrouve dans World). **Décision** : ADR 0008 (export).

**Choix de conception** :
- **Une seule donnée** : le wiki lit les mêmes cartes, maps, propriétés et contenus que World (mêmes requêtes, même cache) ; éditer depuis le wiki réutilise les éditeurs de la carte (texte, galerie, propriétés), présentés avec le thème du wiki.
- **Le thème du wiki est à lui** : des variables CSS posées sur la racine du wiki, jamais sur les tokens de l'app ; l'app garde son clair / sombre autour.
- **Visible ou pas** : seuls les documents marqués (cartes et maps) ont une page ; un lien vers un document non visible s'affiche en texte simple, jamais en lien mort, dans l'app comme dans l'export.
- **Polices** : un petit choix de polices libres (OFL) embarquées, pour qu'elles marchent hors ligne et dans l'export.
- **Export (ADR 0008)** : le front produit le HTML de chaque page avec le même rendu que l'app (contenu des cartes par `@tiptap/html`), le Rust écrit le dossier, copie les images et les polices, et donne la progression.

**Ordre d'exécution** : 8.1 → 8.2 → 8.3, puis 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, et la recette 8.10 en dernier.

---

## 8.1 — Socle de données du wiki (#316)
**Branche** : `feat/wiki-core` · **Dépend de** : —

- [ ] Migration : `documents.wiki_visible` ; `wiki_settings` (titre, description, bannière, cartes mises en avant ordonnées, thème JSON)
- [ ] Commandes : marquer un document visible ou non (cartes et maps), lister les pages du wiki, lire et enregistrer les réglages ; le Rust vérifie (longueurs, ids, thème) ; la bannière est un usage de son asset

**Critères d'acceptation** : une carte marquée visible est dans la liste des pages ; mise à la corbeille, elle n'y est plus.

## 8.2 — « Visible dans le wiki » (#317)
**Branche** : `feat/wiki-visibility` · **Dépend de** : 8.1

- [ ] Clic droit dans l'arbre des documents (cartes et maps), menu de la carte et de la map : « Visible dans le wiki » coché ou non ; un repère dans la sidebar et un filtre

**Critères d'acceptation** : rendre une carte visible la fait apparaître dans le wiki, la masquer la retire.

## 8.3 — Onglet Wiki : la page d'accueil (#318)
**Branche** : `feat/wiki-home` · **Dépend de** : 8.2

- [ ] Grande image à gauche qui passe d'une carte mise en avant à l'autre ; à droite bannière (médiathèque), titre et description modifiables sur place, recherche parmi les pages, grille des cartes mises en avant
- [ ] « Modifier la grille » : ajouter, retirer, réordonner (glisser, clavier) ; sans page, l'accueil dit comment en faire

**Critères d'acceptation** : le titre, la bannière et la grille restent après relance.

## 8.4 — Page de carte (#319)
**Branche** : `feat/wiki-card-page` · **Dépend de** : 8.3

- [ ] Image, type, propriétés, contenu et « Cité dans » (pages visibles seulement) ; mentions et liens vers une page visible cliquables, vers un document non visible en texte simple
- [ ] Modifier sur place le texte, les images et les propriétés : la carte change aussi dans World

**Critères d'acceptation** : modifier un texte depuis le wiki le modifie dans World.

## 8.5 — Page de map (#320)
**Branche** : `feat/wiki-map-page` · **Dépend de** : 8.3

- [ ] La map en lecture seule (calques visibles, zones, textes) ; un pin d'une carte visible ouvre sa page

**Critères d'acceptation** : un clic sur le pin d'une carte visible ouvre sa page du wiki.

## 8.6 — Naviguer dans le wiki (#321)
**Branche** : `feat/wiki-navigation` · **Dépend de** : 8.4

- [ ] Barre du site : accueil, pages par type, recherche (nom, alias, texte) ; retour arrière ; ouvrir la page dans World et inversement

**Critères d'acceptation** : toute page visible est atteignable depuis l'accueil en deux clics.

## 8.7 — Style du site (#322)
**Branche** : `feat/wiki-style` · **Dépend de** : 8.3

- [ ] Fenêtre « Style du site » en bas : thèmes prédéfinis (couleurs et polices), palette modifiable couleur par couleur et enregistrable comme palette personnalisée, polices des titres et du texte
- [ ] Polices libres embarquées (dépendance justifiée) ; contraste vérifié pour chaque thème fourni

**Critères d'acceptation** : un thème choisi s'applique à tout le wiki, reste après relance, et ne touche pas le reste de l'app.

## 8.8 — Export HTML (#323)
**Branche** : `feat/wiki-export` · **Dépend de** : 8.4, 8.5, 8.7

- [ ] « Exporter le wiki » : choix du dossier ; pages, styles du thème, polices, images, et index de recherche ; barre de progression ; ouvrir le dossier à la fin
- [ ] Le site s'ouvre en double-cliquant `index.html`, sans serveur ni connexion ; sa recherche marche ; aucun lien mort

**Critères d'acceptation** : le site exporté s'ouvre dans un navigateur sans connexion, et sa recherche fonctionne.

## 8.9 — Tests de bout en bout M8 (#324)
**Branche** : `test/m8-e2e` · **Dépend de** : 8.8

- [ ] Scénarios : une carte rendue visible puis masquée, un texte modifié depuis le wiki retrouvé dans World, un thème appliqué et gardé, un export ouvert hors ligne avec sa recherche

**Critères d'acceptation** : la suite passe en CI Windows.

## 8.10 — Recette et release `v1.0.0` (#325)
**Branche** : — · **Dépend de** : 8.9

- [ ] Recette Playwright sur l'app réelle (FR et EN, clair et sombre, fenêtre étroite) ; release `v1.0.0`

**Critères d'acceptation** : la recette est validée avant la release.

---

## Bilan (03/10)

Les dix étapes sont livrées (#327, #328, #330 à #336). Recette Playwright sur l'app réelle, FR et EN, app claire et sombre, fenêtre étroite : toutes les vérifications passent, détail dans #325. Trouvé en route et corrigé dans les PR : les images d'un site exporté dans un dossier profond dépassaient la limite de 260 caractères de Windows (noms d'images raccourcis, ADR 0008) ; le sélecteur de couleur et le champ hexadécimal portaient le même nom pour les lecteurs d'écran. Reste à confirmer l'ADR 0008 (statut « Proposé »).
