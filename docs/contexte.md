# Contexte du projet

Ce document résume les discussions qui ont précédé la création du repo, pour qu'un lecteur, humain ou IA, sache **pourquoi** le projet existe et **ce qui a déjà été décidé**. Il complète les ADR sans les remplacer.

## Origine

Clément fait du worldbuilding et utilisait vvd.world (https://vvd.world), une plateforme web de worldbuilding payante. Pour son usage, l'abonnement ne se justifie pas. BuilderZ reproduit donc **les fonctionnalités et l'ergonomie** de vvd dans une application **desktop Windows (.exe)**, pour un usage strictement personnel. Il n'y aura ni revente ni distribution.

Les règles qui en découlent :

- On reproduit les **comportements** et la **direction artistique** de vvd (voir ADR 0003). Le nom, le logo, les assets, les textes et le code de vvd ne sont jamais repris : le style est reconstruit avec nos propres tokens et des ressources libres.
- Les exigences de départ sont une qualité maximale, pas le droit à l'erreur, et un projet reprenable dans 5 ans.

## Source des specs

Clément a découpé toutes les features de vvd dans un board FigJam : pour chaque module, un texte explicatif en anglais accompagné de captures d'écran.

- Board : https://www.figma.com/board/DcVIIr1VrAYJ95Ycq0FucC/Worldbuilding-APP-Claude
- Les specs rédigées à partir de ce board sont dans `docs/features/`. Pour le détail visuel d'un écran, consulter les captures situées **sous** le bloc de texte du module concerné, via le MCP Figma (`get_figjam`, file key `DcVIIr1VrAYJ95Ycq0FucC`).

| Module | Node du bloc de texte |
|---|---|
| Pitch | `3:5` |
| Interface | `3:18` |
| Cartes et types | `4:70` |
| Organisation | `4:197` |
| Map | `5:255` |
| Graph | `6:431` |
| Wiki | `8:516` |
| Canvas | `9:579` |
| Relation Tree | `11:726` |
| Quill | `14:880` |

## Décisions déjà prises

1. **Desktop uniquement** : pas de site web, pas de version mobile.
2. **Stack** : Tauri 2 + Rust (données) + React/TypeScript (interface). Voir ADR 0001. Clément a demandé « le meilleur en 2026 », sans contrainte de langage.
3. **Workflow** : GitHub Flow, une issue = une branche = une PR, Conventional Commits. Voir ADR 0002.
4. **Local et mono-utilisateur**. Adaptations validées par Clément :
   - Plan, abonnement, membres et collaboration temps réel : **retirés**.
   - Publication en ligne du wiki et des histoires : **remplacée par des exports** (site HTML statique ; PDF, DOCX, ePub).
   - Bibliothèques fournies par vvd (templates de maps, sons de la radio et du mode audio) : **remplacées par les fichiers importés** par l'utilisateur.
   - Recherche Google d'images dans le Canvas : **remplacée** par le glisser-déposer et le collage depuis le PC.
   - Fil de nouveautés et formulaire de bug/suggestion : **retirés** (les issues GitHub font ce travail).
5. **Nom de l'app** : BuilderZ (nom choisi par Clément dans le board).
6. **Direction artistique** : la même que vvd (fond illustré flouté, panneaux en verre dépoli, titres monospace, accent ocre), sans reprendre aucun de ses fichiers. Voir ADR 0003.

## Roadmap

Voir `docs/roadmap/README.md`.
