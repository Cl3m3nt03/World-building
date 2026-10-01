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

**Réalisé en M2 (2.9)** : sous l'en-tête de la carte, le contenu est une suite de blocs. Une carte vide propose « Commencez à écrire… ». Le bloc Texte gère les titres (« # », « ## », « ### »), le gras (`Ctrl+B`), l'italique (`Ctrl+I`), les listes (« - », « 1. »), la citation (« > ») et son propre historique (`Ctrl+Z`, `Ctrl+Y`). On ajoute un bloc avec « Ajouter un bloc » ou en tapant « / » sur une ligne vide (la ligne vide disparaît si un bloc est inséré). Chaque bloc a une poignée pour le glisser (au clavier : Espace, flèches, Espace ; les lecteurs d'écran entendent les instructions et la position du bloc dans la langue de l'app, depuis #143) et un menu « Monter », « Descendre », « Supprimer le bloc ». Tout s'enregistre sans bouton, peu après la dernière frappe et en quittant la carte.

**Fiche de stats 5e (2.13)** : six caractéristiques (Force, Dextérité, Constitution, Intelligence, Sagesse, Charisme ; valeurs de 1 à 30) avec leur modificateur calculé, ⌊(valeur − 10) / 2⌋ ; classe d'armure, points de vie, dés de vie, vitesse, bonus de maîtrise (2 par défaut) ; les 18 compétences de la 5e, rangées par ordre alphabétique dans la langue de l'app, chacune avec sa caractéristique, une case « maîtrise » et son bonus calculé (modificateur, plus le bonus de maîtrise si maîtrisée) ; une liste d'actions (nom et description). Une saisie qui n'est pas un nombre entier est signalée et n'est pas enregistrée ; une valeur hors limites est ramenée dans les limites. Le bloc **Map** figure dans le menu des blocs, grisé, avec « arrive avec M4 ».

**Bloc image (2.11)** : « Image » dans le menu des blocs ajoute un bloc et ouvre aussitôt le sélecteur d'image ; annulé, le bloc reste vide et propose « Choisir une image ». L'image s'affiche avec une légende, modifiable sur place ; « Changer » (au survol ou au clavier) en choisit une autre. Si l'image a été supprimée de la médiathèque, le bloc le dit et propose d'en choisir une autre. Avant de supprimer une image de la médiathèque, la confirmation liste ses usages : image principale du monde, fond du thème du monde, image d'une carte, bloc image d'une carte (en précisant si la carte est à la corbeille).

**Mentions (2.10)** : taper `@` après une espace (ou en début de ligne) ouvre la liste des cartes, filtrée par nom et par alias en ignorant la casse et les accents (les noms d'abord, puis les alias, avec l'alias trouvé indiqué ; la carte en cours n'y est pas). Les flèches choisissent, Entrée ou Tab insère, Échap referme. La mention insère le nom de la carte, pas l'alias tapé. Elle affiche toujours le nom actuel de la carte (renommer la carte la met à jour) et l'ouvre d'un clic. Une mention d'une carte à la corbeille s'affiche barrée, avec son dernier nom ; d'une carte supprimée définitivement, barrée avec le nom qu'elle avait. Chaque mention crée un lien `mention` (une carte qui se mentionne elle-même n'en crée pas), donc une entrée dans « Cité dans » de la carte mentionnée.

**Noms de cartes dans le texte (2.18)** : trois préférences du monde (Réglages du monde › Préférences, toutes activées par défaut) agissent dans les blocs texte. Un « nom » est le nom ou un alias d'une carte vivante, d'au moins deux caractères, écrit comme un mot entier (la casse est ignorée) ; la carte en cours n'est jamais proposée, ni un nom partagé par deux cartes (ambigu), ni le texte tapé après `@` ou déjà mentionné.

- **Liens automatiques des mentions** : un nom tapé devient une mention dès le caractère suivant (espace, ponctuation) ou `Entrée`. **Retour arrière** juste après rend le texte tapé. Si un nom plus long commence par ce nom et ce séparateur (« Minas », puis une espace, avec une carte « Minas Tirith »), le lien attend le mot suivant : « Minas Tirith » est lié s'il est complété, sinon « Minas » est lié quand le mot suivant se termine (ou en fin de ligne).
- **Détection d'entités** : les noms déjà écrits (texte collé, écrit avant la carte, lien refusé par Retour arrière, liens automatiques désactivés) sont soulignés en pointillés. Quand on place le curseur sur l'un d'eux (clic, flèches), une petite pastille « Lier à « Gondor » » apparaît dessous ; elle le transforme en mention, comme `Alt+Entrée`. Elle n'apparaît jamais pendant la frappe.
- **Animer les nouveaux liens** : une mention créée par un lien automatique ou par « Lier » apparaît avec une courte animation, jamais si Windows demande de réduire les animations.

## Templates guidés

Chaque type peut avoir un template guidé : une liste de sections avec un titre et une question d'aide. Par exemple, pour un personnage : *Background*, *Personnalité*, *Apparence*.

Appliquer le template ajoute ces sections comme blocs texte pré-titrés, en place de texte indicatif. Cela ne remplace jamais du contenu déjà écrit. L'application est proposée sur une carte vide et reste disponible à tout moment.

**Réalisé en M2 (2.12)** : le template se modifie dans l'écran des types (section « Template guidé ») : ajouter une section, saisir son titre et sa question d'aide, la monter, la descendre ou la supprimer, sans bouton Enregistrer ; une section sans titre n'est pas gardée. Un sous-type sans template propre utilise celui de son type. Une carte vide propose « Utiliser le template « Personnage » » avec la liste des sections ; ensuite, « … › Appliquer le template » reste disponible. Chaque section devient un bloc texte à la fin de la carte : son titre en intertitre, et la question d'aide en texte indicatif sous le titre, qui disparaît dès qu'on écrit. Une section dont le titre existe déjà comme intertitre dans la carte n'est pas ajoutée à nouveau ; si tout est déjà là, un message le dit.

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

**Réalisé en M2 (2.7)** : une propriété ajoutée à un type s'affiche sur les cartes créées ensuite ; le bandeau « Appliquer les changements à toutes les cartes de ce type ? » propose de l'afficher aussi sur les cartes existantes (« Oui ») ou de les laisser telles quelles (« Ignorer »). Une propriété s'édite dans une petite fenêtre (nom, nature, suppression) ; changer sa nature efface ses valeurs. Sur une carte, les valeurs s'enregistrent sans bouton : un texte vide ou un nombre effacé retire la valeur, une saisie qui n'est pas un nombre est signalée et n'est pas enregistrée (la virgule décimale est acceptée). « Propriété propre à cette carte » en ajoute une qui ne concerne que cette carte. Pour une propriété lien (2.8), la fenêtre propose aussi les types de cartes acceptés (aucun coché : toutes les cartes ; un type accepte ses sous-types). Sur la carte, la valeur se choisit dans une liste qui recherche dans les noms et les alias, au clavier (flèches, Entrée) ; chaque carte liée s'affiche comme une étiquette qui l'ouvre et se retire d'un clic. Une carte liée introuvable (supprimée définitivement) s'affiche comme telle.

## Rétroliens

En bas de chaque carte, une section « Cité dans » liste les documents qui la mentionnent ou la référencent. Chaque document y figure une fois, avec la façon dont il la cite (le nom de la propriété lien, « mention »…), et s'ouvre d'un clic. Un document à la corbeille n'y figure pas, et revient s'il est restauré.

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
