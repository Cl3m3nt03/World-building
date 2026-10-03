# ADR 0008 — Export du wiki : le front rend les pages, le Rust écrit le site

- **Statut** : Proposé (pris pour avancer M8 ; à confirmer par Clément)
- **Date** : 2026-10-03
- **Décideur** : Claude, pour Clément

## Contexte

La spec du wiki (`docs/features/07-wiki.md`) demande un export en site statique, ouvert hors ligne par un double-clic sur `index.html`, recherche comprise, « généré en Rust avec une barre de progression ».

Le contenu d'une carte est un JSON de blocs, dont le texte est un document TipTap (ProseMirror) avec des mentions ; il y a aussi des galeries, des fiches de stats 5e et des maps. L'app sait déjà dessiner tout cela (React, TipTap). Deux pistes :

1. **Tout en Rust** : un moteur de rendu HTML des blocs et du JSON TipTap écrit en Rust.
2. **Le front rend, le Rust écrit** : le front produit le HTML de chaque page avec le même rendu que l'app (`@tiptap/html` pour le texte, composants statiques pour le reste) et le donne au Rust, qui écrit les fichiers, copie les images et les polices, et dit où il en est.

| | Tout en Rust | Le front rend, le Rust écrit |
|---|---|---|
| Une page exportée ressemble à la page de l'app | ❌ deux rendus à tenir alignés | ✅ un seul rendu |
| Nouveau bloc, nouvelle marque de texte | à écrire deux fois | une fois |
| Accès disque, copie des assets, progression | ✅ Rust | ✅ Rust (règle « le Rust possède les données ») |
| Taille des échanges | petits | le HTML des pages (quelques Mo au plus), envoyé par lots |

## Décision

**Piste 2.**

- Le front construit, page par page, un HTML autonome (thème du wiki en CSS, liens relatifs `pages/<id>.html`, images `assets/<id>`), plus `search.js` (l'index de recherche dans une variable JavaScript, lisible en `file://`, sans `fetch`) et un petit script de navigation.
- Une commande Rust reçoit le dossier choisi et les fichiers par lots, vérifie les chemins (relatifs, sans `..`), écrit, copie les assets et les polices utilisés depuis le monde, et émet des événements de progression.
- Le site n'appelle rien sur le réseau : polices et images sont dans le dossier.

## Conséquences

- La spec est respectée dans son but : le Rust fait tout l'accès disque et la progression ; le HTML vient du rendu partagé. La spec 07 le précise.
- Les composants du wiki ont une version « statique » (sans état ni interaction) pour l'export ; leurs tests vérifient que l'app et l'export montrent la même chose.
- Aucune nouvelle dépendance Rust ; côté front, `@tiptap/html` (de la même famille que l'éditeur déjà utilisé).
