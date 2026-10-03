# 07 — Wiki

**Milestone** : M8 · **Figma** : node `8:516`

## Objectif

Présenter le monde sous une forme **lisible et soignée** : une page par carte ou par map, avec son propre thème. On peut aussi l'**exporter** comme site web statique pour le partager.

## Adaptation locale

Sur vvd, le wiki est un site public hébergé. Ici, il prend deux formes :

1. l'**onglet Wiki** dans l'app, une vue de lecture et d'édition du monde ;
2. l'**export HTML** : un dossier de site statique (HTML, CSS, JS et images), à ouvrir dans un navigateur ou à héberger où l'on veut.

## Contenu du wiki

- Seuls les documents marqués **« Visible dans le wiki »** y apparaissent : des cartes et des maps.
- Chaque page du wiki correspond à un document. Une page de carte affiche son image, ses propriétés, son contenu et ses rétroliens ; une page de map affiche la map en lecture seule, avec ses pins cliquables.
- Un lien vers un document qui n'est pas visible dans le wiki s'affiche en texte simple, jamais en lien mort.

## Page d'accueil

- Un **titre**, une **description** complète et une **bannière** (image de la médiathèque).
- Une **recherche** parmi les pages du wiki.
- Une **grille** de cartes mises en avant, qu'on choisit et réordonne à volonté.

## Style du site

Un panneau « Style du site », en bas de l'écran du wiki, permet de régler :

- un **thème** prédéfini (couleurs et polices) ;
- une **palette** modifiable couleur par couleur, qu'on peut enregistrer comme palette personnalisée ;
- les **polices** des titres et du texte courant, séparément.

## Synchronisation

Le wiki et l'onglet World lisent **les mêmes données**. Une modification faite dans l'un apparaît immédiatement dans l'autre. On peut éditer directement depuis le wiki (texte, images, propriétés) sans revenir à l'onglet World.

## Export

- « Exporter le wiki » : on choisit un dossier de destination, et le site statique y est généré avec le thème courant.
- Le site exporté fonctionne **hors ligne**, sans serveur : il s'ouvre en double-cliquant sur `index.html`, et sa recherche fonctionne côté client grâce à un index généré.
- La génération est faite en Rust, avec une barre de progression : le Rust écrit le dossier, copie les images et les polices, et dit où il en est ; le HTML des pages vient du même rendu que l'app (ADR 0008).

## Modèle de données (indicatif)

- `documents.wiki_visible` (socle commun)
- `wiki_settings` : title, description, banner_asset_id, featured (JSON : liste ordonnée d'ids), theme (JSON)

## Critères d'acceptation

- Rendre une carte visible la fait apparaître dans le wiki, et la masquer la retire.
- Modifier un texte depuis le wiki le modifie dans World.
- Le site exporté s'ouvre dans un navigateur sans connexion, et sa recherche fonctionne.

**Réalisé en M8 (8.1)** : le socle de données, sans interface pour l'instant (migration 0017). Une carte ou une map peut être marquée « Visible dans le wiki » (`documents.wiki_visible`) ; les autres documents (graphs, arbres, canvas) n'ont pas de page. Les pages du wiki sont les cartes et maps visibles qui ne sont pas à la corbeille, par titre, avec le type, l'image et les alias des cartes (pour la recherche). Les réglages du wiki (une seule ligne, `wiki_settings`) gardent le titre (vide : le nom du monde), la description, la bannière, les cartes mises en avant dans l'ordre, et le thème (thème fourni, palette modifiée, polices, palettes enregistrées), lu avec tolérance. Le Rust vérifie les longueurs, les couleurs `#rrggbb`, les clés de thème et de police, et chaque carte mise en avant une seule fois. La médiathèque sait qu'une image est la bannière du wiki et prévient avant de la supprimer.

**Réalisé en M8 (8.2)** : « Visible dans le wiki » se coche au clic droit d'une carte ou d'une map dans l'arborescence, dans le menu d'actions d'une carte, et par un bouton à globe dans l'en-tête d'une map. Une ligne visible porte un petit globe (annoncé aux lecteurs d'écran). Le menu de vue de l'arborescence filtre « Visibles dans le wiki ».

**Réalisé en M8 (8.3)** : l'onglet Wiki ouvre la page d'accueil. À gauche, une grande image passe d'une page à la une (avec image) à la suivante toutes les 7 secondes, avec son nom, des points pour choisir et un bouton pause ; elle s'arrête sous le pointeur ou le focus, et ne défile pas seule si le système demande moins d'animations. À droite : la bannière (choisie dans la médiathèque, changée ou retirée), le titre et la description écrits sur place (enregistrés en quittant le champ, Échap rend le texte enregistré ; un titre vide affiche le nom du monde), la recherche parmi les pages (nom ou alias, sans accents ni casse) et la grille « À la une ». « Modifier la grille » ajoute une page, la retire (✕) et la déplace en glissant ou au clavier (Espace puis flèches). Une page masquée ou à la corbeille disparaît de la grille mais garde sa place si elle revient. Sans page, l'accueil explique comment en faire une. Le wiki a son propre thème (variables `--wiki-*` sur sa racine, thème « parchemin » par défaut) : le clair / sombre de l'app ne le change pas. En fenêtre étroite, l'image passe au-dessus. Les pages s'ouvrent pour l'instant dans World ; leurs pages du wiki arrivent en 8.4 et 8.5.

**Réalisé en M8 (8.4)** : une page du wiki s'ouvre pour chaque carte visible (accueil, grille, recherche, diaporama). À gauche l'image de la carte ; à droite son titre, son type, l'encadré des propriétés, son contenu et « Cité dans ». C'est la même carte que dans World : le texte, l'image et les propriétés se modifient sur place et se retrouvent dans World. Une mention ou une propriété-lien vers une carte visible ouvre sa page du wiki ; vers une carte sans page, c'est son nom en texte simple. « Cité dans » ne garde que les pages du wiki. Une carte masquée depuis le dit sur sa page, avec un lien vers l'accueil. Les éditeurs repris de World prennent le thème du wiki (ses couleurs remplacent les tokens de l'app sous la racine du wiki, et le jeu clair ou sombre suit le fond du wiki) ; les titres prennent la police de titre du wiki. Les maps s'ouvrent encore dans World jusqu'à leur page du wiki (8.5).

**Réalisé en M8 (8.5)** : une map visible a sa page dans le wiki : la map en lecture seule (calques visibles seulement, avec zones, textes et pins). Un clic sur le pin d'une carte visible ouvre sa page ; le pin d'une carte sans page ne mène nulle part. Sous la map, « Sur cette map » liste les pages qui y ont un pin (accessible au clavier). Le bouton « Ouvrir la map » d'un bloc map, dans une page de carte, mène à la page de la map si elle est visible, et disparaît sinon. Une map masquée le dit sur sa page.

**Réalisé en M8 (8.6)** : une barre en haut du wiki : retour (historique), le nom du wiki (vers l'accueil), le menu « Pages » (toutes les pages, groupées par type de carte dans l'ordre des types, puis les maps : toute page est à deux clics de l'accueil), la recherche, et « Ouvrir dans World » sur une page. La recherche (barre et accueil) est celle du monde (nom, alias et texte, avec l'extrait trouvé), limitée aux pages du wiki. Dans World, « Ouvrir dans le wiki » est dans le menu d'actions d'une carte et dans l'en-tête d'une map, dès qu'elles sont visibles.

**Réalisé en M8 (8.7)** : le bouton « Style du site », en bas du wiki, ouvre trois onglets. **Thèmes** : cinq thèmes fournis (Parchemin, par défaut, Nuit, Forêt, Encre, Crépuscule), chacun avec ses couleurs et ses polices ; en choisir un efface les retouches. Les palettes enregistrées s'y appliquent ou s'y suppriment. **Couleurs** : fond, encadrés, texte, texte secondaire et accent, au sélecteur ou en `#rrggbb`, appliqués aussitôt ; un contraste trop faible du texte sur le fond (sous 4,5:1) est signalé ; « Enregistrer » garde la palette sous un nom, « Revenir aux couleurs du thème » efface la retouche. **Polices** : celle des titres et celle du texte, parmi six polices libres (SIL OFL) livrées avec l'app, donc disponibles hors ligne et pour l'export : Inter, Cinzel, Playfair Display, EB Garamond, Lora, Source Serif. Tout reste après relance et ne touche que le wiki ; un thème sombre fait passer les éditeurs repris de World en jeu sombre. Chaque thème fourni est vérifié par un test : texte, texte secondaire et accent à 4,5:1 au moins sur le fond.

**Réalisé en M8 (8.8)** : « Exporter le wiki », dans la barre du wiki, demande un dossier, y crée `<titre> - wiki` et y écrit le site avec une barre de progression (lecture des pages, écriture des fichiers, copie des images), puis propose « Ouvrir le dossier ». Le site contient `index.html` (accueil : diaporama des pages à la une, bannière, titre, description, recherche, grille), une page par carte ou map visible (`pages/<id>.html` : image, type, propriétés, contenu avec les mêmes mentions, galeries, fiches de stats, maps dessinées avec leurs zones, textes et pins, « Cité dans »), `style.css` (le thème du wiki), `fonts.css` (les deux polices du thème, intégrées), `search.js` (l'index : noms, alias, texte), `site.js` (recherche et diaporama) et `assets/` (les images utilisées). Il s'ouvre par un double-clic, sans serveur ni connexion ; un lien vers un document sans page est du texte simple. Les motifs des zones (hachures, points) sont rendus en aplat dans l'export.
