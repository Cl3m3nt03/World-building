# M1 — Mondes et interface

**Objectif** : une coque utilisable au quotidien. On gère ses mondes depuis une vraie liste (vignettes, genre, dossiers introuvables), on édite l'identité de son monde (nom, genre, description, image principale, qui devient le fond de l'app), on importe et range ses fichiers dans une médiathèque, on règle l'app dans un vrai écran de réglages, on arrive sur un onglet Home utile et on travaille en musique avec la radio.

**Spec** : `docs/features/00-interface.md` (board : node `3:18`, pavé « User Interface »).

**Hors M1** : les types de cartes et leur création selon le genre (M2), les documents récents et la reprise du dernier document (M2/M3), le thème du monde (question ouverte, voir la spec), l'indication des usages d'un fichier avant suppression pour les cartes, maps et canvas (au fil des modules).

**Ordre d'exécution** : 1.1, puis 1.2 → 1.3 → 1.4 → 1.5, puis 1.6 → 1.7 → 1.8 → 1.9 → 1.10, puis 1.11 → 1.12 → 1.13 → 1.14.

---

## 1.1 — Onglet World : tuiles de création signalées « bientôt »
**Branche** : `fix/world-tiles-coming-soon` · **Dépend de** : —

- [ ] Les tuiles Carte, Map, Canvas et Graph sont désactivées tant que leur module n'existe pas, avec une infobulle « Bientôt disponible » et le milestone prévu
- [ ] Elles restent visibles pour montrer ce qui arrive, mais ne donnent plus l'impression d'être cassées
- [ ] Même traitement pour les onglets Wiki et Quill : un écran « Bientôt disponible » qui dit ce que fera le module

**Critères d'acceptation** : aucun élément cliquable de l'interface ne reste sans effet sans l'indiquer.

## 1.2 — Métadonnées du monde : genre, description, image principale
**Branche** : `feat/world-metadata` · **Dépend de** : —

- [ ] Ajouter à `world.json` le genre (Fantasy, Science-fiction, Romance, Cyberpunk, Contemporain, Autre), la description et l'image principale (identifiant d'asset), lus avec tolérance (un monde existant sans ces champs s'ouvre toujours)
- [ ] Commande `update_world(patch)` : modifie nom, genre, description et image principale, avec écriture atomique et mise à jour des mondes récents
- [ ] `WorldInfo` expose ces champs au front
- [ ] Tests Rust : lecture d'un ancien `world.json`, mise à jour partielle, nom vide refusé, image inexistante refusée

**Critères d'acceptation** : un monde créé en 0.1.0 s'ouvre sans erreur, et ses nouvelles métadonnées survivent à une réouverture.

## 1.3 — Création de monde avec genre
**Branche** : `feat/world-genre` · **Dépend de** : 1.2

- [ ] Le dialogue « Nouveau monde » propose le genre (liste des six genres, Fantasy par défaut)
- [ ] `create_world` enregistre le genre
- [ ] Traduction des genres FR et EN

**Critères d'acceptation** : un monde créé en « Science-fiction » affiche ce genre après réouverture.

## 1.4 — Liste des mondes en grille avec vignettes
**Branche** : `feat/world-list-grid` · **Dépend de** : 1.2

- [ ] Vignette de chaque monde (image principale réduite), mise en cache dans le dossier de config de l'app : elle s'affiche sans ouvrir le monde
- [ ] Protocole dédié, en lecture seule, limité à ce cache
- [ ] L'écran de démarrage affiche les mondes en grille : vignette (ou visuel par défaut), nom, genre, date de dernière ouverture
- [ ] Navigation au clavier dans la grille

**Critères d'acceptation** : après avoir donné une image à un monde puis être revenu à la liste, sa vignette s'affiche sans l'ouvrir.

## 1.5 — Liste des mondes : retirer, monde introuvable, relocaliser
**Branche** : `feat/world-list-manage` · **Dépend de** : 1.4

- [ ] Menu d'un monde dans la liste : Ouvrir, Afficher dans l'Explorateur, Retirer de la liste (confirmation, le dossier n'est pas touché)
- [ ] Un monde dont le dossier n'existe plus est signalé (« Introuvable ») au lieu d'échouer à l'ouverture
- [ ] « Relocaliser » : choisir le nouveau dossier, qui doit contenir un monde de même identifiant

**Critères d'acceptation** : déplacer un dossier monde, le voir signalé, le relocaliser et l'ouvrir ; retirer un monde laisse son dossier intact.

## 1.6 — Médiathèque : données
**Branche** : `feat/media-library-data` · **Dépend de** : —

- [ ] Migration `0002` : table `assets` (identifiant = fichier `<sha256>.<ext>`, nom affiché, type image/audio/autre, taille, dimensions pour les images, date d'import)
- [ ] `import_asset` enregistre l'asset en base (un réimport du même contenu renvoie l'existant)
- [ ] Commandes `list_assets(filtre)`, `rename_asset`, `delete_asset` (supprime le fichier et la ligne)
- [ ] Tests Rust : import, dédoublonnage, renommage, suppression, liste filtrée

**Critères d'acceptation** : les assets importés en 0.1.0, déjà présents dans `assets/`, sont repris en base à l'ouverture du monde.

## 1.7 — Médiathèque : galerie et import
**Branche** : `feat/media-library-ui` · **Dépend de** : 1.6

- [ ] Écran Médiathèque (accessible depuis Home › Gérer) : grille de vignettes, nom, type, taille
- [ ] Import par bouton (sélecteur de fichiers), glisser-déposer sur la fenêtre et collage (`Ctrl+V`) d'une image
- [ ] Filtre par type (images, sons, autres) et recherche par nom
- [ ] Retire la zone d'import provisoire de 0.10

**Critères d'acceptation** : une image collée depuis le presse-papiers apparaît dans la galerie.

## 1.8 — Médiathèque : renommer et supprimer
**Branche** : `feat/media-library-manage` · **Dépend de** : 1.7

- [ ] Renommer un asset (nom affiché, le fichier garde son hash)
- [ ] Supprimer avec confirmation ; si l'asset est utilisé (image principale du monde en M1), le message dit où
- [ ] Menu contextuel et raccourcis clavier (`F2`, `Suppr`)

**Critères d'acceptation** : supprimer l'image principale du monde prévient de cet usage.

## 1.9 — Sélecteur d'image
**Branche** : `feat/image-picker` · **Dépend de** : 1.7

- [ ] Composant réutilisable : choisir une image de la médiathèque ou en importer une nouvelle
- [ ] Recherche, aperçu, validation au clavier
- [ ] Sera réutilisé par les cartes, les maps et le canvas

**Critères d'acceptation** : le sélecteur renvoie l'identifiant de l'image choisie ou importée.

## 1.10 — Panneau du monde courant et fond de l'app
**Branche** : `feat/world-panel` · **Dépend de** : 1.2, 1.9

- [ ] Clic sur le monde courant (en haut à gauche) : panneau avec image principale (via le sélecteur), nom, genre et description, enregistrés à la volée
- [ ] L'image principale devient le fond flouté de l'app (ADR 0003), et sa vignette est mise à jour pour la liste
- [ ] Le nom du monde se met à jour dans la barre du haut

**Critères d'acceptation** : changer l'image principale change le fond de l'app et la vignette dans la liste des mondes.

## 1.11 — Écran de réglages de l'application
**Branche** : `feat/app-settings` · **Dépend de** : —

- [ ] Dialogue Réglages (bouton engrenage) en remplacement du menu actuel : Apparence, Effets de transparence, Langue, Dossier par défaut des nouveaux mondes, À propos
- [ ] Le dossier par défaut est enregistré dans `settings.json` et utilisé par « Nouveau monde »
- [ ] Accessible aussi depuis l'écran de démarrage

**Critères d'acceptation** : chaque réglage est conservé après redémarrage.

## 1.12 — Onglet Home
**Branche** : `feat/home-tab` · **Dépend de** : 1.7, 1.10, 1.11

- [ ] Bienvenue avec le nom et l'image du monde
- [ ] Bloc « Gérer » : Médiathèque, Réglages ; Types et Thème affichés désactivés (« Bientôt disponible », M2 et thème à cadrer)
- [ ] Résumé du monde : genre, description, nombre de fichiers dans la médiathèque ; état vide des documents récents et de l'aperçu du graph, qui arrivent avec M2 à M5

**Critères d'acceptation** : l'onglet Home reflète le monde ouvert et chaque entrée active mène au bon écran.

## 1.13 — Radio
**Branche** : `feat/radio` · **Dépend de** : 1.7

- [ ] Bouton Radio (en haut à droite) : lecteur des pistes audio de la médiathèque
- [ ] Lecture/pause, piste suivante et précédente, volume, lecture en boucle ou aléatoire
- [ ] La musique continue quand on change d'onglet ; elle s'arrête quand on ferme le monde
- [ ] Volume et mode mémorisés dans les réglages de l'app

**Critères d'acceptation** : une piste importée se lit, et la lecture continue en passant de Home à World.

## 1.14 — Tests de bout en bout M1
**Branche** : `test/e2e-m1` · **Dépend de** : 1.3, 1.5, 1.10, 1.11

- [ ] Scénario : créer deux mondes avec des genres différents, donner une image au premier, passer de l'un à l'autre et retrouver l'état de chacun
- [ ] Scénario : changer la langue et le thème, relancer l'app, vérifier qu'ils sont conservés
- [ ] Scénario : monde introuvable signalé puis relocalisé

**Critères d'acceptation** : les critères globaux de `00-interface.md` sont couverts par les tests de bout en bout, qui passent en CI.

---

## Définition de « M1 terminé »

1. Les critères globaux de `docs/features/00-interface.md` sont remplis et testés.
2. Toute la nouvelle interface est traduite, accessible au clavier et fonctionne dans les deux thèmes.
3. La CI est verte sur `main`, et une release `v0.2.0` publie l'installeur.
