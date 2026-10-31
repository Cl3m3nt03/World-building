# Workflow des agents

Le travail passe par une équipe d'agents, chacun avec une compétence et une mission. Clément décide, le manager (la session principale) oriente et merge, les agents produisent. Les définitions sont dans `.claude/agents/`.

## L'équipe

| Agent | Mission | Écrit du code ? |
|---|---|---|
| `architecte` | Transforme un besoin en spec, issue et critères vérifiables | Non (docs seulement) |
| `dev` | Livre une issue : code, tests, docs, PR | Oui |
| `animateur` | Rend chaque transition fluide, légère et désirable | Oui |
| `testeur` | Casse la feature dans l'app réelle, chiffres à l'appui | Non |
| `critique-design` | Juge le visuel et l'expérience au niveau d'une app de 2026 | Non |
| `relecteur` | Relit le diff : bugs, données, conformité aux règles | Non |
| `correcteur` | Corrige les retours bloquants sur une PR existante | Oui |

## Le circuit d'une feature

1. **Cadrage** : `architecte` écrit la spec et l'issue. Une question produit remonte à Clément par le manager.
2. **Réalisation** : `dev` ouvre la PR, CI verte, sans merger.
3. **Contrôle** : `testeur`, `critique-design` et `relecteur` passent en parallèle sur la PR. Aucun ne corrige lui-même : celui qui a écrit le code n'est pas celui qui le juge.
4. **Correction** : `correcteur` traite les retours bloquants, puis le contrôleur concerné revérifie. Trois allers-retours au plus, ensuite le manager décide.
5. **Merge** : le manager relit le rapport et merge. Une migration est toujours relue par le manager.
6. **Recette** : à la fin d'un jalon, `testeur` passe sur l'ensemble, puis Clément valide. La release vient après sa validation.

## Règles communes

- Lire `CLAUDE.md` avant tout. Ces règles s'ajoutent, elles ne remplacent rien.
- **Un agent par worktree**, sur un chemin court (`C:/Users/cleme/AppData/Local/Temp/claude/wt<sujet>`), jamais le dossier principal : au-delà de 260 caractères, `node_modules` casse.
- `CARGO_TARGET_DIR` pointe vers `src-tauri/target` du dossier principal, pour ne pas multiplier les 15 Go.
- Vérifier dans l'app réelle : exe debug du worktree, `BUILDERZ_BACKGROUND_WINDOW=1`, `BUILDERZ_HOME` et `WEBVIEW2_USER_DATA_FOLDER` propres à l'agent, un port DevTools donné par le manager.
- Ne jamais afficher de fenêtre sur l'écran de Clément, ne jamais lancer WebdriverIO en local, ne jamais ouvrir ses vrais mondes (une copie au besoin, supprimée à la fin, rien de son contenu sur GitHub : le repo est public).
- Ne jamais arrêter un processus qu'on n'a pas lancé.
- Committer et pousser souvent : GitHub est le lieu de coordination. Jamais `--no-verify`.
- Les agents ne mergent pas et ne publient pas. Une décision produit ou de format de données remonte, elle ne se devine pas.
- Rapport final court : faits, numéros, preuves mesurées, et ce qui n'a pas été vérifié.

## Sobriété

Chaque agent démarre à froid et consomme. Le manager en fait tourner **trois au plus** en même temps, ne lance `critique-design` que si l'interface change, et donne à chaque agent le contexte utile plutôt que de lui faire tout relire.
