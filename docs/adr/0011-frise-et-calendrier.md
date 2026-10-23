# ADR 0011 — La frise : un document, un calendrier par monde, des dates entières

- **Statut** : Proposé (pris pour avancer M11, Clément n'ayant pas encore cadré la frise ; à confirmer)
- **Date** : 2026-10-12
- **Décideur** : Claude, pour Clément

## Contexte

La frise chronologique (#114, spec `docs/features/09-frise.md`) est demandée sans description de vvd. Il faut décider :

1. où elle vit ;
2. comment un monde compte le temps ;
3. comment ranger les dates pour trier, zoomer et comparer ;
4. comment elle se relie aux cartes.

## Décision

1. **La frise est un document de World** (`kind = 'timeline'`). Elle a ainsi la sidebar, la corbeille, la recherche, les épingles et la visibilité dans le wiki, comme la map et le graph.
   - La contrainte `CHECK` de `documents` ne se modifie pas en SQLite. Une migration reconstruit donc la table avec le nouveau type, en gardant ses données, comme la migration 0015 pour les liens.
2. **Un calendrier par monde**, dans `world.json`, comme le thème (ADR 0004) : des ères (nom, abréviation, année de départ) et des mois (nom, nombre de jours).
   - Par défaut : une ère sans nom et douze mois de 30 jours. Changer le calendrier ne déplace aucun élément.
3. **Une date est rangée en jours entiers** depuis l'an 0 du calendrier (un `i64`), avec sa **précision** (année, mois ou jour).
   - L'ordre, les durées et le zoom restent de l'arithmétique simple. L'affichage repasse par le calendrier (ère, année, mois, jour).
   - Une année vaut la somme des jours de ses mois, sans années bissextiles en M11.
   - Les ères ne font que nommer des plages d'années : elles ne changent pas le compte des jours.
4. **Les éléments citent leurs cartes** : un élément qui représente une carte crée un lien `links (source = frise, kind = 'timeline')`. « Cité dans » montre alors la frise, comme pour les arbres (ADR 0007).
5. **Tables propres** : `timelines`, `timeline_tracks` (ordre, nom, couleur) et `timeline_items` (piste, carte, titre, couleur, description, début, fin facultative, précision). Le Rust vérifie qu'un élément tient sur une piste de sa frise et qu'une période finit après son début.

## Conséquences

- La frise profite sans code nouveau de la sidebar, de la corbeille, de la recherche, des épingles et du wiki.
- Le calendrier, partagé par toutes les frises d'un monde, sert de base aux dates qu'on pourra plus tard donner aux cartes (naissance, mort, fondation), sans changer le format.
- Les années bissextiles et les calendriers lunaires ne sont pas pris en charge ; le format en jours permettrait de les ajouter.

## Ajouts après M11

Les mêmes principes valent pour ce qui a été ajouté ensuite, sans nouvel ADR :

- **Migration 0021** (11.5b, aspect vvd) : un élément a une image à lui, des étiquettes (liste JSON) et un drapeau « masqué dans le wiki ».
- **Migration 0022** (#415) : une période qui représente une carte peut être marquée comme sa **vie** (naissance → mort). Les âges en découlent, dans le calendrier du monde. Ce marquage est explicite : un règne ou une campagne liés à une carte ne sont pas une vie.
- **Migration 0023** (#418) : `timeline_links`, une flèche de cause à effet d'un élément vers un autre de la même frise (« mène à »). Une flèche est unique par paire, ne relie pas un élément à lui-même et disparaît avec l'un de ses éléments ou avec la frise. Dupliquer la frise copie ses flèches.
