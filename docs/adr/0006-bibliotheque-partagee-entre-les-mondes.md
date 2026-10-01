# ADR 0006 — Bibliothèque partagée entre les mondes : piocher et copier

- **Statut** : Accepté (validé par Clément le 2026-10-01, issue #113)
- **Date** : 2026-10-01
- **Décideur** : Clément, sur proposition de Claude

## Contexte

Clément veut réutiliser dans un monde une image déjà importée dans un autre, sans la réimporter depuis le PC (retour du 29/09/2026, étape 3.13).

L'ADR 0001 pose qu'**un monde est un dossier autonome** : `world.json`, `world.db` et `assets/` contiennent tout ce qu'il faut pour copier, sauvegarder ou déplacer un monde seul, sur un autre PC. Les médias d'un monde sont rangés par empreinte de contenu (`<sha256>.<ext>`) : une même image n'y est stockée qu'une fois, quel que soit le nombre de ses usages.

Deux pistes :

1. **Piocher et copier** : une bibliothèque commune à l'app ; choisir une de ses images la copie dans le monde, qui l'utilise ensuite comme n'importe quel média.
2. **Références partagées** : les mondes pointent vers les fichiers de la bibliothèque.

| | Piocher et copier | Références partagées |
|---|---|---|
| Monde autonome (copie sur un autre PC, sauvegarde) | ✅ tout est dans le dossier du monde | ❌ images manquantes hors de ce PC |
| Retirer une image de la bibliothèque | ✅ les mondes la gardent | ❌ elle disparaît de tous les mondes |
| Place sur le disque | une copie par monde qui l'utilise | une seule copie |
| Complexité | faible : on réutilise l'import | élevée : deux sources d'assets, images manquantes, chemins |

## Décision

**Piste 1 : une bibliothèque où l'on pioche, l'image étant copiée dans le monde.**

- La **Bibliothèque BuilderZ** est un dossier de l'app : `library/` dans le dossier de configuration (`%APPDATA%\app.builderz.desktop\library\`, ou `$BUILDERZ_HOME\config\library\` pour les tests). Il a **le même format qu'une médiathèque de monde** : les fichiers `<sha256>.<ext>` dans `library/assets/`, et leurs métadonnées dans `library/library.db`, table `assets` identique à celle de `world.db` (ses propres migrations, `src-tauri/library-migrations/`). Le code d'import, de liste et de renommage des médias d'un monde sert donc aussi pour la bibliothèque.
- La base de la bibliothèque est ouverte à la première utilisation, pas au démarrage de l'app.
- **Y ajouter** : depuis la médiathèque d'un monde (« Ajouter à la bibliothèque », le nom du média est repris), ou par un import depuis le PC dans l'écran Bibliothèque des réglages de l'app.
- **Y piocher** : le sélecteur d'image a un onglet « Bibliothèque ». Choisir une image la **copie dans le monde** (même empreinte, donc pas de doublon si elle y est déjà) avec son nom, puis le monde l'utilise comme ses autres médias.
- **Gérer** : un écran Bibliothèque dans les réglages de l'app (renommer, retirer, importer, taille).
- Les fichiers de la bibliothèque sont servis au WebView par un protocole dédié, `bzlibrary://`, limité à `library/assets/` (même vérification stricte des identifiants que `bzasset://`).
- Le dossier de la bibliothèque n'est pas encore modifiable ; en choisir un autre (par exemple synchronisé) pourra venir plus tard.

## Conséquences

- ✅ Un monde reste autonome : rien dans `world.db` ni `world.json` ne pointe vers la bibliothèque.
- ✅ Retirer une image de la bibliothèque ne touche à aucun monde.
- ✅ Peu de code nouveau : la bibliothèque est une médiathèque de plus, hors de tout monde.
- ⚠️ Une image utilisée dans trois mondes est stockée quatre fois (bibliothèque comprise). La place utilisée sera affichée avec l'étape 3.12.
- ⚠️ Renommer une image dans la bibliothèque ne renomme pas ses copies dans les mondes (ce sont des médias indépendants).
