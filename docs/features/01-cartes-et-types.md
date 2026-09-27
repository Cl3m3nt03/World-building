# 01 — Cartes et types de cartes

**Milestone** : M2 · **Figma** : node `4:70`

## Objectif

La carte est l'unité de base du monde. Chaque carte représente un élément de l'histoire : un personnage, un lieu, un objet, un événement, un système de magie… Le **type** d'une carte détermine ce qu'elle représente, ses propriétés par défaut et son template guidé.

## Créer une carte

On peut créer une carte de trois façons :

1. en cliquant au centre de l'espace de travail quand aucun document n'est ouvert ;
2. avec les boutons en bas de la sidebar ;
3. par un clic droit n'importe où dans la sidebar.

Dans les trois cas, on choisit d'abord un type (ou un sous-type). La carte s'ouvre alors directement en édition, avec un nom par défaut sélectionné pour être renommé.

**Réalisé en M2 (2.4)** : la tuile « Carte » de l'espace vide ouvre le menu de création : les types, leurs sous-types en retrait dessous, puis « Nouveau type » (qui ouvre l'écran des types). La carte créée s'appelle « <Type> sans nom » (« Untitled <Type> » en anglais) et s'ouvre avec ce nom sélectionné. Le même menu s'ouvre par le bouton « Nouvelle carte » en bas de la sidebar et par un clic droit n'importe où dans la sidebar (2.5). Après Échap, le focus revient là où il était ; après une création, il reste sur le nom de la nouvelle carte.

## Anatomie d'une carte

- **Nom**, modifiable directement.
- **Image**, choisie dans la médiathèque ou importée. Elle sert aussi de vignette dans la sidebar, le graph et le canvas.
- **Type et sous-type**, modifiables après coup.
- **Alias** : autres noms de la carte. Ils sont pris en compte par la recherche, les mentions et la détection de noms dans Quill. Une carte a 20 alias au plus ; les doublons (sans tenir compte de la casse) et les alias vides sont ignorés.
- L'image s'affiche en portrait (3:4) ou en paysage (16:9) selon l'orientation par défaut du type. Supprimer l'image de la médiathèque la retire des cartes qui l'utilisaient.
- « … › Mettre à la corbeille » range la carte dans la corbeille du monde (restaurable, voir 2.5).
- **Propriétés** : des champs structurés (voir plus bas).
- **Contenu** : une suite de **blocs**.

## Blocs

On ajoute des blocs avec un bouton « + » ou la commande `/` dans l'éditeur.

| Bloc | Rôle |
|---|---|
| Texte | Texte riche TipTap, avec mentions `@carte` |
| Image | Une image de la médiathèque, avec une légende |
| Map | Intègre une map existante, en aperçu cliquable |
| Fiche de stats 5e | Fiche de personnage pour le jeu de rôle (D&D 5e) : caractéristiques, modificateurs calculés, CA, PV, vitesse, compétences, actions |

Les blocs peuvent être réordonnés par glisser-déposer et supprimés.

## Templates guidés

Chaque type peut avoir un template guidé : une liste de sections avec un titre et une question d'aide. Par exemple, pour un personnage : *Background*, *Personnalité*, *Apparence*.

Appliquer le template ajoute ces sections comme blocs texte pré-titrés, en place de texte indicatif. Cela ne remplace jamais du contenu déjà écrit. L'application est proposée sur une carte vide et reste disponible à tout moment.

## Types et sous-types

- Les types se gèrent depuis Home › Types, ou depuis le menu de création d'une carte (« Nouveau type »).
- Un type a un nom, une icône, une couleur, un template guidé et des **propriétés par défaut**.
- Chaque type peut contenir des **sous-types**, affichés en menu déroulant sous le type. Un sous-type hérite des propriétés de son type et peut en ajouter.
- Des types par défaut sont créés selon le genre du monde. Ils se modifient et se suppriment comme les autres.

### Écran de gestion des types

D'après les captures du board (dialogue « Card Types ») :

- **à gauche**, la liste des types avec une recherche, un bouton « + » pour créer un type, et un chevron par type pour déplier ses sous-types (par exemple *Lieu* › Royaume, Ville, Hameau, Donjon, Point de repère) ;
- **à droite**, le type sélectionné : icône et nom, actions (dupliquer, supprimer), ses **propriétés par défaut** et ses **réglages de carte par défaut**.
- Modifier une propriété du type affiche un bandeau **« Appliquer les changements à toutes les cartes de ce type ? »** avec « Ignorer » et « Oui » (texte du board : « I will apply changes to all cards of this type »).
- Une propriété s'édite dans une petite fenêtre : nom, nature (Texte, Nombre, Lien…) et suppression.

**Réalisé en M2 (2.3)** : l'écran s'ouvre depuis Home › Gérer › Types. La liste se filtre par nom (un sous-type trouvé s'affiche sous son type) ; « + » crée un type « Nouveau type » aussitôt sélectionné. Le détail permet de changer l'icône (grille d'icônes), le nom (enregistré sans bouton ; un nom vide n'est jamais enregistré), la couleur (neuf couleurs, lisibles dans les deux thèmes), de dupliquer le type avec ses sous-types (« Nom (copie) ») et de le supprimer après confirmation. Les sous-types s'ajoutent par leur nom et reprennent l'icône et la couleur du type. L'orientation (portrait, paysage) et le format canvas (compact, standard, haut, large) sont des groupes de tuiles, au clavier avec les flèches. Les propriétés arrivent avec 2.7, et le choix du type de destination des cartes lors d'une suppression avec 2.4.

### Réglages de carte par défaut

Chaque type définit des réglages appliqués à la création de chaque nouvelle carte de ce type (texte du board : « default settings that act like a template for each card you create ») :

| Réglage | Valeurs |
|---|---|
| Orientation par défaut | Portrait, Paysage (forme de l'image de la carte) |
| Format sur le canvas | Quatre formats de vignette pour le canvas (voir `06-canvas.md`) |

**Types par défaut** (validés par Clément le 27/09/2026). Ils sont créés à la création du monde, selon son genre. Les sous-types de *Lieu* dépendent du genre : « Donjon » n'a pas de sens en science-fiction.

| Genre | Types ajoutés aux types communs | Sous-types de *Lieu* |
|---|---|---|
| Tous (types communs) | Personnage, Lieu, Objet, Événement, Faction, Lore, Note | — |
| Fantasy | Système de magie, Religion, Race, Créature, Écologie | Royaume, Ville, Hameau, Donjon, Point de repère |
| Science-fiction | Technologie, Vaisseau, Espèce, Planète | Système stellaire, Station, Colonie, Base |
| Cyberpunk | Technologie, Corporation, Implant | Mégalopole, Quartier, Planque, Réseau |
| Romance | Relation, Lieu de rencontre | Ville, Maison, Lieu de rencontre |
| Contemporain | Organisation, Relation | Pays, Ville, Quartier, Bâtiment |
| Autre | — | Région, Ville, Bâtiment |

Chaque type par défaut a une icône, une couleur et un template guidé (par exemple Personnage : Background, Personnalité, Apparence). Changer le genre d'un monde plus tard n'ajoute ni ne supprime aucun type. Un monde créé avant M2 reçoit les types de son genre à sa première ouverture.

Supprimer un type qui contient des cartes (les siennes et celles de ses sous-types, corbeille comprise) demande vers quel type déplacer ces cartes : la suppression n'est possible qu'une fois ce type choisi.

## Propriétés

Une propriété a un libellé et une nature :

| Nature | Exemple |
|---|---|
| Texte | Âge, titre, surnom |
| Nombre | Population, année de fondation |
| Lien vers une carte | Lieu de naissance → une carte Lieu |
| Liens vers plusieurs cartes | Alliés → plusieurs cartes Personnage |

Un lien peut être restreint à certains types. Chaque lien crée une entrée `property` dans la table des liens (voir `README.md`).

Les propriétés sont définies à deux niveaux :

- **Sur le type.** Ajouter une propriété au type (par exemple « Âge » sur Personnage) propose de **l'appliquer à toutes les cartes existantes** de ce type, et toutes les nouvelles cartes la reçoivent.
- **Sur une seule carte.** On peut aussi ajouter une propriété directement dans une carte, sans modifier son type.

Renommer une propriété de type la renomme partout. La supprimer demande une confirmation, qui indique le nombre de valeurs perdues.

**Réalisé en M2 (2.7)** : une propriété ajoutée à un type s'affiche sur les cartes créées ensuite ; le bandeau « Appliquer les changements à toutes les cartes de ce type ? » propose de l'afficher aussi sur les cartes existantes (« Oui ») ou de les laisser telles quelles (« Ignorer »). Une propriété s'édite dans une petite fenêtre (nom, nature, suppression) ; changer sa nature efface ses valeurs. Sur une carte, les valeurs s'enregistrent sans bouton : un texte vide ou un nombre effacé retire la valeur, une saisie qui n'est pas un nombre est signalée et n'est pas enregistrée (la virgule décimale est acceptée). « Propriété propre à cette carte » en ajoute une qui ne concerne que cette carte. Les natures lien arrivent avec 2.8.

## Rétroliens

En bas de chaque carte, une section « Cité dans » liste les documents qui la mentionnent ou la référencent.

## Modèle de données (indicatif)

- `card_types` : id, parent_id (sous-type), name, icon, color, guided_template (JSON), sort_order
- `property_definitions` : id, scope (type ou carte), owner_id, label, kind, target_type_ids, sort_order
- `cards` : document_id, type_id, image_asset_id, aliases (JSON), content (JSON TipTap), content_text (pour FTS)
- `property_values` : card_id, property_id, value (JSON)

## Critères d'acceptation

- On crée un type « Personnage » avec la propriété « Âge », puis trois cartes de ce type, qui affichent toutes le champ « Âge ».
- Une propriété lien vers une autre carte apparaît dans les rétroliens de la carte cible.
- Appliquer un template guidé à une carte qui a déjà du contenu ne détruit rien.
- La fiche 5e calcule les modificateurs à partir des caractéristiques.
