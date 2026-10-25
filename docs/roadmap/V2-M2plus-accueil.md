# V2-M2+ — Accueil enrichi

**Objectif** : reprendre dans BuilderZ quatre comportements de vvd vus pendant la session REA du 2026-10-25 (`docs/outils/vvd/accueil-navigation.md`), choisis par Clément le même jour. On reprend leur ergonomie, jamais les fichiers de vvd.

**Ordre d'exécution** : 2+.1 → 2+.2 → 2+.3 → 2+.4, puis la recette.

---

## V2-2+.1 — Rail de mondes (#461)
- [ ] Un rail fin à gauche, déplié ou replié par un bouton en haut à gauche (état gardé dans les préférences de l'interface), sur la liste des mondes comme dans un monde
- [ ] En haut, « Mondes » (la liste) puis une icône ronde par monde récent (sa couverture, ou sa propre carte), le monde ouvert marqué ; « + » crée un monde ; en bas, les réglages
- [ ] Info-bulles avec le nom ; navigation au clavier (flèches dans le rail, Entrée ouvre)

**Critères d'acceptation** : changer de monde en un clic depuis n'importe où ; le rail replié ne prend aucune place ; 1028×749 sans débordement.

## V2-2+.2 — Home : compteurs et graph au centre (#462)
- [ ] Trois compteurs sous l'en-tête : mots écrits (cartes et chapitres), documents, connexions (liens entre cartes), chacun sur une fine barre
- [ ] Le graph du monde gagne la place centrale de la Home, en grand ; état vide « Rien à cartographier pour le moment »

**Critères d'acceptation** : les compteurs viennent de Rust (une commande, testée) et se mettent à jour après une modification ; la Home reste lisible d'un coup d'œil.

## V2-2+.3 — Menu d'un monde : épingler et dupliquer (#463)
- [ ] « Épingler en premier » / « Désépingler » : le monde reste en tête de la liste (et du rail), quel que soit le dernier ouvert
- [ ] « Dupliquer le monde » : une copie complète (base, médias, réglages) dans un nouveau dossier « <nom> (copie) », avec un nouvel identifiant ; elle apparaît dans la liste

**Critères d'acceptation** : la copie s'ouvre et vit sa vie sans toucher l'original (testé en Rust) ; un échec de copie ne laisse rien à moitié sur le disque.

## V2-2+.4 — Genres multiples (#464)
- [ ] En plus de son genre principal (qui guide les types de cartes proposés), un monde reçoit des **tonalités** au choix parmi une liste (grimdark, dark fantasy, mythologie, histoire alternative, dystopie, post-apocalyptique, steampunk, solarpunk, cozy, western, horreur, survie…)
- [ ] Choix en pastilles dans la création et les réglages du monde ; affichées sur la Home et dans la carte du monde
- [ ] ADR pour le changement de format de `world.json` (champ facultatif, les anciens mondes s'ouvrent tels quels)

**Critères d'acceptation** : un monde de la V1 s'ouvre sans perte ; fr et en ; clavier.

## V2-2+.5 — Recette (#465)
- [ ] Captures dans l'app réelle, deux thèmes ; issue de recette pour Clément
