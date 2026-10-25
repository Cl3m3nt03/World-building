# REA — étudier vvd pour la V2

[REA](https://github.com/morluto/rea) (« Reverse Engineer Anything », licence MIT, paquet npm `rea-agents`) observe une application existante et en rend la structure : DOM, arbre d'accessibilité, scripts, routes, appels réseau, captures d'écran, déroulé d'une action. Clément a demandé le 2026-10-25 qu'on s'en serve pour chaque écran de la V2, avec vvd comme référence.

## Ce qu'on en tire, et ce qu'on n'en tire jamais

La règle du projet ne change pas (`docs/contexte.md`, ADR 0003, ADR 0012) : on reproduit les **comportements** et l'**ergonomie** de vvd, jamais ses fichiers.

| On garde | On ne reprend jamais |
|---|---|
| Ce que fait un écran : zones, ordre des actions, états (vide, chargement, erreur), raccourcis | Le code de vvd (JS, composants, CSS) |
| La hiérarchie et les mesures : largeurs, espacements, densité, nombre d'éléments visibles | Ses assets : images, icônes, logo, polices |
| Le déroulé d'une interaction : ce qui s'ouvre, dans quel ordre, ce qui est gardé | Ses textes et libellés |
| Les rôles et libellés d'accessibilité, comme point de comparaison | Ses données ou celles de ses utilisateurs |

Les observations vont dans une note par écran (`docs/outils/vvd/<écran>.md`), rédigée avec nos mots, puis dans la spec `docs/features/*`. Le code de BuilderZ est toujours écrit de zéro, avec nos tokens et nos primitives.

## Installation (déjà faite)

REA demande Node ≥ 24.22.1. Pour ne pas toucher au Node du PC, il est installé à part, avec son propre Node, dans `Workspace/WorldBuilding/tools/rea` (hors du dépôt) :

```powershell
cd C:\Users\cleme\Desktop\Workspace\WorldBuilding\tools\rea
$env:PATH = "$PWD\node_modules\node\bin;$PWD\node_modules\.bin;$env:PATH"
rea doctor
```

## Déroulé pour un écran de vvd

vvd demande un compte : c'est **Clément** qui s'y connecte, dans un Chrome à part, ouvert avec un port de débogage local. REA ne fait qu'observer ce navigateur (lecture passive, CDP sur `127.0.0.1`). Claude n'entre jamais d'identifiants.

1. Clément lance un Chrome dédié, avec un profil séparé de son Chrome habituel :

   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\BuilderZ-rea-chrome" https://vvd.world/
   ```

2. Il se connecte à vvd et ouvre l'écran à étudier (liste des mondes, Home d'un monde…).
3. Claude liste les pages et inspecte celle qui est ouverte :

   ```powershell
   rea list-browser-targets http://127.0.0.1:9222
   rea inspect-web-page http://127.0.0.1:9222 <targetId> --include-accessibility-text --observation-ms 1500
   rea capture-web-screenshot http://127.0.0.1:9222 <targetId>
   ```

   En une fois, `tools/rea/vvd-capture.ps1 <écran>` (hors du dépôt) fait les deux dans `tools/rea/captures/<écran>` : `page.json` (structure, accessibilité, réseau) et `screenshot.png`. Testé le 2026-10-25 sur la page publique de vvd, avec un Chrome sans fenêtre (`--headless=new`, profil jetable).

4. Pour une interaction (ouvrir un menu, créer un monde), Claude arme une observation et Clément fait le geste :

   ```powershell
   rea observe-web-session http://127.0.0.1:9222 <targetId>
   ```

5. Clément ferme ce Chrome à la fin : le port de débogage donne accès à la session ouverte, il ne doit pas rester ouvert.

Sans compte, seules les pages publiques de vvd (site vitrine) sont observables, avec `rea capture-browser-scenario`.

## Avec l'agent (MCP)

`npx rea-agents setup` enregistre REA comme serveur MCP de Claude Code. Ce n'est pas indispensable : la ligne de commande ci-dessus suffit et ne change aucune configuration. Si on l'active plus tard, il faudra pointer l'enregistrement vers le Node de `tools/rea`.
