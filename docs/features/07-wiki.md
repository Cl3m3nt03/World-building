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
- La génération est faite en Rust, avec une barre de progression.

## Modèle de données (indicatif)

- `documents.wiki_visible` (socle commun)
- `wiki_settings` : title, description, banner_asset_id, featured (JSON : liste ordonnée d'ids), theme (JSON)

## Critères d'acceptation

- Rendre une carte visible la fait apparaître dans le wiki, et la masquer la retire.
- Modifier un texte depuis le wiki le modifie dans World.
- Le site exporté s'ouvre dans un navigateur sans connexion, et sa recherche fonctionne.
