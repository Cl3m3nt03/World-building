# 02 — Organisation (sidebar)

**Milestone** : M3 · **Figma** : node `4:197`

## Objectif

Retrouver instantanément n'importe quel document, même dans un monde qui en compte des milliers, et le ranger comme on veut.

## Structure de la sidebar

De haut en bas :

1. la **barre de recherche** et le bouton de filtres/tri ;
2. la section **Épinglés** ;
3. l'**arborescence** : dossiers et documents ;
4. les **boutons de création** en bas.

La sidebar peut être redimensionnée et repliée. Sa largeur et l'état ouvert/fermé des dossiers sont mémorisés pour chaque monde.


**Réalisé en M3 (3.1)** : le socle de données de l'arborescence existe (dossiers, parent / enfant, ordre manuel, place des épingles), sans interface pour l'instant. Choix validés par Clément le 01/10/2026 : dans la racine et dans un dossier, **dossiers et documents se mélangent librement** dans un même ordre ; mettre à la corbeille un document qui a des enfants **laisse ses enfants dans la sidebar**, à sa place. Un document restauré revient à son emplacement s'il existe encore, sinon à la racine. Les cartes d'un monde de la 0.3.0 sont à la racine, dans l'ordre de création.

**État en M2** : en attendant M3, la sidebar de l'onglet World est une liste simple des cartes du monde, par nom (icône et couleur de leur type). Un clic ouvre la carte, qui est mise en évidence. Un clic droit n'importe où ouvre le menu de création ; en bas, « Nouvelle carte » ouvre le même menu et l'icône **Corbeille** ouvre la corbeille du monde : chaque carte s'y restaure ou s'y supprime définitivement, et « Vider la corbeille » demande une confirmation qui indique le nombre de cartes.

## Recherche

- La recherche porte sur les noms, les alias et le texte des documents (FTS5).
- Les résultats s'affichent au fil de la frappe : correspondances de nom d'abord, puis correspondances dans le contenu avec un extrait.
- La navigation se fait au clavier : flèches, `Entrée` pour ouvrir, `Échap` pour fermer.
- Le raccourci global `Ctrl+K` ouvre la recherche depuis n'importe où.

## Filtres et tri

- **Filtres** par type de document (carte, map, graph, canvas, arbre) et par type ou sous-type de carte, cumulables.
- **Tri** : manuel (par défaut), alphabétique ou par date de création. On peut inverser l'ordre.
- Tant qu'un tri autre que manuel est actif, le glisser-déposer pour réordonner est désactivé, et un indicateur le signale.

## Ordre manuel

On réordonne les documents en les glissant vers le haut ou le bas. Cet ordre est enregistré.

## Épingles

Un clic droit sur un document permet de l'épingler ou de le désépingler. Les documents épinglés remontent dans la section Épinglés, avec une **image agrandie**. L'ordre des épingles se règle aussi par glisser-déposer.

## Dossiers

- On crée un dossier par clic droit ou avec un bouton.
- Un dossier a un nom et une **icône**, choisie parmi une bibliothèque d'icônes.
- Les dossiers peuvent être imbriqués.
- On range un document dans un dossier en le glissant dessus.
- Supprimer un dossier demande ce qu'il faut faire de son contenu : le remonter d'un niveau ou le mettre à la corbeille.

## Hiérarchie parent / enfant

Déposer un document **sur** un autre document fait du second le **parent** du premier. Le parent s'affiche alors avec un chevron pour déplier ses enfants. C'est une autre façon de ranger, indépendante des dossiers ; par exemple : Royaume › Ville › Taverne.

Pendant le glisser-déposer, un indicateur visuel distingue trois cas : *insérer avant*, *insérer après* et *devenir enfant de*. Les cycles sont interdits : un document ne peut pas devenir l'enfant de son propre descendant.

## Menu contextuel d'un document

Le clic droit sur un document propose : Ouvrir, Renommer, Épingler, Dupliquer, Déplacer vers…, Visible dans le wiki (case à cocher) et Supprimer.

## Critères d'acceptation

- La recherche trouve une carte par un de ses alias et par un mot de son contenu, en moins de 100 ms sur un monde de 5 000 cartes.
- L'ordre manuel, les épingles, les dossiers et la hiérarchie sont conservés après un redémarrage.
- Un glisser-déposer qui créerait un cycle est refusé.
