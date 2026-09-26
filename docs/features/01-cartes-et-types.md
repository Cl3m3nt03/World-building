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

## Anatomie d'une carte

- **Nom**, modifiable directement.
- **Image**, choisie dans la médiathèque ou importée. Elle sert aussi de vignette dans la sidebar, le graph et le canvas.
- **Type et sous-type**, modifiables après coup.
- **Alias** : autres noms de la carte. Ils sont pris en compte par la recherche, les mentions et la détection de noms dans Quill.
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

**Types par défaut proposés** (à valider par Clément) :

| Genre | Types |
|---|---|
| Tous | Personnage, Lieu, Objet, Événement, Organisation, Créature, Note |
| Fantasy | + Système de magie, Religion, Race |
| Science-fiction | + Technologie, Vaisseau, Espèce, Planète |
| Cyberpunk | + Technologie, Corporation, Implant |
| Romance | + Relation, Lieu de rencontre |

Supprimer un type qui contient des cartes demande vers quel type déplacer ces cartes.

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
