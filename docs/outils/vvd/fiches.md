# vvd — les fiches (observations)

Note d'étude pour V2-M3 (`docs/roadmap/V2-M3-fiches.md`), rédigée avec nos mots. Aucun fichier de vvd n'est repris (`docs/outils/rea.md`).

**Source** : session REA du 2026-10-25 sur le compte de Clément, dans son Brave dédié. Avec son accord, une fiche de test « Test BuilderZ — Personnage » a été créée dans son monde GOT. Sinon tout est observé en lecture seule : les menus sont ouverts puis refermés, et rien d'autre n'est modifié. Les captures brutes restent hors du dépôt (`tools/rea/captures/m3-*`).

## Créer une fiche

- « Nouveau document » ouvre un **panneau « Sélectionner un type »** à droite, à côté du document en cours. On y trouve une recherche (« Rechercher des types… »), les catégories à gauche, les types à droite (« 15 types »), « Ajouter un type », et l'aide clavier en pied (↑ ↓ Naviguer, ↵ Sélectionner). Taper un nom filtre (« Résultats de recherche · 1 type ») et Entrée crée la fiche.
- La fiche s'ouvre avec son **titre sélectionné** (« Nouveau Personnage »), prêt à être remplacé.
- Le **modèle du type est appliqué d'emblée** : la fiche vide contient déjà ses sections (Contexte, Personnalité, Apparence), chacune avec un titre qu'on peut modifier.

## En-tête de la fiche

- À gauche, le **titre** en grand (serif, environ 25 px). À droite du titre, la **pastille du type** (icône + nom) et un **œil** (visible dans le wiki). Tout à droite, une **image en portrait** (environ 200 × 270 px, coins arrondis). Une fiche neuve reçoit une illustration par défaut.
- Sous le titre, une ligne **Alias** compacte : l'icône d'étiquette, les alias en pastilles, et « + Ajouter » (une pastille, pas un champ). Une suggestion tirée du nom apparaît aussi en pastille « + … ».
- Puis « **+ Ajouter une propriété** » : un petit popover avec le nom de la propriété en tête, puis son type en deux familles. **Type** : texte, nombre, sélection, date. **Références** : une fiche d'un type précis (personnage, écologie, événement, faction, objet, lieu, savoir, espèce), chaque famille avec son sous-menu.
- La pastille du type ouvre un **sélecteur de type** : une recherche, les types avec leurs sous-types dépliables (le type actuel marqué « Sélectionné »), puis « Geler depuis le type » et « Effacer le type ».
- Le menu « … » de la fiche propose : ouvrir dans le wiki, historique des versions, commentaires, partager, ouvrir dans son propre onglet, focus, lancer le didacticiel, enregistrer comme modèle.

## Sections (blocs)

- Chaque section est un bloc avec une **barre de titre** : le titre en gras, sur une fine ligne qui court sur toute la largeur. Au survol, à droite, on trouve supprimer, un menu ⋮ et replier.
- Le menu ⋮ propose : ouvrir dans le panneau, ajouter un bloc (sous-menu), masquer la barre de titre, masquer de la version publiée, copier le bloc, supprimer le bloc (en rouge).
- Dans le texte, « / » ouvre un **menu d'insertion**. En tête, les blocs spéciaux (média, stat block), puis les **blocs de base** (paragraphe, titre 1 à 3 avec leur raccourci `#`, `##`, `###`, liste à puces `-`…). En pied, « Fermer le menu · Échap ».
- Le texte des fiches est en serif (Crimson Text, environ 15 px), comme les titres.

## Écarts avec BuilderZ (V1), à trancher dans V2-M3

| vvd | BuilderZ aujourd'hui |
|---|---|
| Panneau « Sélectionner un type » (recherche, catégories, clavier) | Menu des types (liste) |
| Modèle appliqué à la création, sections aux titres modifiables | « Utiliser le template » proposé sur une fiche vide |
| Titre à gauche, type + œil à droite, image en portrait à droite | Image à gauche, titre et type à droite |
| Alias en ligne compacte « + Ajouter » | Bloc « Alias » avec un champ et « Ajouter » |
| « + Ajouter une propriété » en popover (nom + type par familles) | « Propriété propre à cette carte » |
| Sections à barre de titre, outils au survol, repli | Blocs texte avec intertitres, poignée et menu |
| Menu « / » en familles avec raccourcis affichés | Menu « / » (liste des blocs) |
| Sélecteur de type sur la pastille, avec recherche et sous-types | Menu de la pastille |
