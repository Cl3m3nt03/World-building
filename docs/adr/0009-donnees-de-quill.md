# ADR 0009 — Données de Quill : histoires à part, chapitres qui citent

- **Statut** : Proposé (pris pour avancer M9 ; à confirmer par Clément)
- **Date** : 2026-10-10
- **Décideur** : Claude, pour Clément

## Contexte

Quill (spec `docs/features/08-quill.md`) ajoute des histoires, faites de chapitres, eux-mêmes faits de brouillons. Le monde a déjà une table `documents` (cartes, maps, graphs, arbres, canvas) qui porte la sidebar, la corbeille, la recherche, les récents et « Cité dans ». La spec demande aussi que « les mentions et les liens créés dans Quill alimentent la table des liens (source = chapitre) ».

Deux questions : une histoire est-elle un document de World ? Et quel brouillon d'un chapitre cite les cartes ?

## Décision

1. **Les histoires ne sont pas des documents.** Tables propres : `stories`, `chapters`, `drafts`, `chapter_notes`, `writing_panel`. Elles ne sont ni dans la sidebar de World, ni dans sa corbeille, ni dans sa recherche : l'onglet Quill est leur seul lieu. Supprimer une histoire, un chapitre ou un brouillon est définitif et demande une confirmation.
2. **Le chapitre est la source des liens**, avec les mentions de son **brouillon courant** seulement : `links (source_id = id du chapitre, kind = 'mention')`, refaits à chaque enregistrement du brouillon courant et quand le brouillon courant change. Les autres brouillons ne citent rien (sinon une carte serait « citée » par une version abandonnée).
3. **« Cité dans » montre aussi les chapitres** : la requête des rétroliens joint `chapters` et `stories` en plus de `documents` ; une ligne de chapitre a le type de source `chapter` et le titre « Chapitre 2 — Mon histoire », et s'ouvre dans Quill. Le Graph et les arbres n'utilisent pas ces liens (ils relient des cartes entre elles).
4. **Le Rust dérive le texte et les mots** d'un brouillon (comme `content.rs` pour les cartes) : le front n'envoie que le JSON TipTap.

## Conséquences

- La sidebar et la corbeille de World restent celles du lore ; les histoires n'y font pas de bruit.
- Pas de corbeille pour Quill en M9 : la confirmation protège ; on pourra en ajouter une si le besoin vient.
- La table `links` reçoit des sources qui ne sont pas des documents : les requêtes qui joignent `documents` les ignorent déjà (jointure), seules les rétroliens les ajoutent explicitement.
- Supprimer un chapitre ou une histoire supprime ses liens.
