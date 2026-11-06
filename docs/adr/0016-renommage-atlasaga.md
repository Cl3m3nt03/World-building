# ADR 0016 — BuilderZ devient Atlasaga

- **Statut** : accepté (2026-11-06), décision de Clément (le nom) ; choix techniques ci-dessous
- **Contexte** : #570. Clément a de vrais mondes et des réglages créés par les versions 1.7.x installées.

## Contexte

Clément renomme le produit : **BuilderZ devient Atlasaga**, à partir de la 1.8. Le nom apparaît à deux sortes d'endroits : ce que la personne voit (titre de fenêtre, textes, installeur, raccourcis) et des identifiants techniques dont certains décident **où sont rangées les données**. Renommer les seconds sans précaution ferait « disparaître » les mondes récents et les réglages, ou laisserait deux applications installées. La sécurité des données passe avant la cohérence du nom.

## Ce que contrôle chaque identifiant

Vérifié dans le script NSIS que Tauri génère (`src-tauri/target/release/nsis/x64/installer.nsi`, Tauri CLI 2) et dans le code.

| Identifiant | Valeur 1.7.x | Ce qu'il contrôle |
|---|---|---|
| `productName` (`tauri.conf.json`) | `BuilderZ` | Nom de l'installeur (`BuilderZ_X.Y.Z_x64-setup.exe`), `PRODUCTNAME` du script NSIS : **dossier d'installation** (`%LOCALAPPDATA%\BuilderZ`, mode `currentUser`), **clé de désinstallation** `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\BuilderZ` (celle qui sert à détecter une installation existante et à proposer la mise à jour), clé `HKCU\Software\<publisher>\BuilderZ` (dossier d'installation), raccourcis `BuilderZ.lnk` (menu Démarrer, bureau), nom affiché dans « Applications installées », `ProductName`/`FileDescription` de l'exe. |
| `bundle.publisher` | `BuilderZ` | `MANUFACTURER` : clé `HKCU\Software\BuilderZ\…` et colonne « Éditeur ». |
| Titre de fenêtre (`app.windows[].title`, `index.html`) | `BuilderZ` | Barre de titre et barre des tâches avant que l'interface ne pose `document.title`. |
| `mainBinaryName` (non défini) | nom du paquet Cargo : `builderz` | Nom de l'exe installé (`builderz.exe`), processus à fermer avant une mise à jour. |
| `identifier` | `app.builderz.desktop` | **Dossiers de données** : `%APPDATA%\app.builderz.desktop` (`settings.json` : mondes récents, préférences, dossier des nouveaux mondes ; bibliothèque partagée), `%LOCALAPPDATA%\app.builderz.desktop` (logs, profil WebView2 `EBWebView` donc `localStorage`). Aussi l'AppUserModelID des raccourcis (épinglage, listes de raccourcis). |
| Dossier des nouveaux mondes | `Documents\BuilderZ` | Seulement l'emplacement **proposé** pour un nouveau monde. Les mondes existants sont retrouvés par leur chemin absolu, rangé dans les récents. |
| Format des mondes | `"format": "builderz-world"` dans `world.json`, `meta.created_by = 'BuilderZ'` | Reconnaissance d'un dossier de monde. Le changer rendrait les mondes existants « invalides ». |
| Protocoles `bzasset`, `bzlibrary`, `bztiles`, `bzthumb`, liens `https://builderz.invalid/` | — | Internes à la WebView et aux scènes Excalidraw rangées dans les mondes. Jamais montrés. |
| Variables `BUILDERZ_HOME`, `BUILDERZ_BACKGROUND_WINDOW` | — | Outils de test et de développement (e2e, vérifications dans l'app réelle). |
| Crates `builderz` / `builderz_lib`, paquet npm `builderz`, release-please | — | Code et outillage. `builderz_lib` est aussi le filtre de logs. |

## Décision

### On garde

- **`identifier` = `app.builderz.desktop`, inchangé.** C'est lui qui range les données ; le changer déplacerait réglages, mondes récents, bibliothèque, logs et `localStorage` vers des dossiers vides. Aucune raison ne justifie une migration. La personne ne voit cet identifiant que dans « À propos » (chemins des dossiers), ce qui est acceptable.
- **`mainBinaryName` non défini : l'exe reste `builderz.exe`.** Il n'est visible que dans le gestionnaire des tâches (qui affiche « Atlasaga » grâce à la description du fichier). Le garder évite au template NSIS sa migration de nom d'exe.
- **Format et marqueurs des mondes** (`builderz-world`, `created_by`), protocoles `bz*`, liens `builderz.invalid`, variables `BUILDERZ_*`, noms de crates et de paquet, filtre de logs : internes, jamais montrés, inchangés. Aucun nom de variable n'est donc à accepter « en plus » : les anciens noms restent les seuls.
- **Le nom du dépôt GitHub** (Clément décidera plus tard) et **les icônes** (le logo n'est pas prêt).
- **Les ADR et documents historiques** (roadmap, audits) restent écrits avec BuilderZ.

### On renomme

- `productName`, titre de fenêtre, `index.html`, `bundle.publisher` (« Atlasaga » pour l'instant), `longDescription`.
- Tous les textes fr/en (titre des pages, « À propos d'Atlasaga », bibliothèque, erreurs, pied de page du wiki exporté).
- Métadonnées des exports : générateur de l'ePub (`<meta name="generator">`) et **créateur du PDF** (qui était « Typst 0.15.1 », désormais « Atlasaga »).
- Titre des releases GitHub, README, `docs/features`, `docs/architecture.md`, `docs/contexte.md`, CLAUDE.md et les définitions d'agents.

### L'installeur remplace l'ancienne installation

Changer `productName` change la clé de désinstallation : l'installeur 1.8 **ne voit plus** l'installation 1.7.x et s'installerait à côté (`%LOCALAPPDATA%\Atlasaga` en plus de `%LOCALAPPDATA%\BuilderZ`, deux entrées dans « Applications installées », deux raccourcis). Garder les clés sous l'ancien nom aurait demandé de garder `productName` (donc le nom de l'installeur et des raccourcis), ce qui annule le renommage.

On ajoute donc un hook NSIS (`src-tauri/windows/installer-hooks.nsh`, `bundle.windows.nsis.installerHooks`), exécuté **après** l'installation d'Atlasaga (`NSIS_HOOK_POSTINSTALL`) :

1. il lit la clé de désinstallation et la clé du dossier d'installation de BuilderZ (`HKCU`) ;
2. il n'agit que sur une vraie installation BuilderZ : un dossier qui n'est pas une racine de disque (plus de 3 caractères), `builderz.exe` présent dedans, et une commande de désinstallation égale à `"<dossier>\uninstall.exe"` (guillemets compris). Sinon il ne touche ni fichier ni clé ;
3. il supprime `builderz.exe` ; s'il est encore là (fichier verrouillé, BuilderZ ouvert), **il garde toute l'ancienne installation** (fichiers, raccourcis, clés), qui reste visible et désinstallable dans « Applications installées ». Sinon il supprime `uninstall.exe` et le dossier s'il est vide (les autres fichiers d'un dossier partagé restent). Si Atlasaga a été installé dans ce même dossier, aucun fichier n'est supprimé ;
4. une fois l'ancienne installation partie, il supprime ses raccourcis `BuilderZ.lnk` (menu Démarrer, bureau) **seulement s'ils pointent vers son exe**, les désépingle, recrée un raccourci « Atlasaga » sur le bureau s'il y en avait un, puis supprime ses clés de registre (désinstallation, dossier d'installation, démarrage automatique).

Les registres utilisés par le hook (`$0` à `$3`, `$R6` à `$R8`) sont sauvegardés et rendus.

On ne lance pas l'ancien désinstalleur : son comportement exact en mode silencieux dépend de la version 1.7.x, alors que la suppression à la main ne touche que ce qu'on nomme. **Les données ne sont jamais touchées** : `%APPDATA%\app.builderz.desktop`, `%LOCALAPPDATA%\app.builderz.desktop` et les dossiers de mondes ne figurent pas dans le hook. Comme l'`identifier` ne change pas, Atlasaga lit les mêmes réglages et retrouve les mêmes mondes récents.

Le hook ne tourne qu'après une installation réussie : si elle échoue, BuilderZ reste en place. L'exe s'appelle toujours `builderz.exe`, donc la vérification « l'application est-elle ouverte ? » de l'installeur couvre aussi l'ancienne version.

### Le dossier des nouveaux mondes

- Si `Documents\BuilderZ` existe (quelqu'un a utilisé l'app avant le renommage), il **reste** le dossier proposé : les nouveaux mondes rejoignent les anciens, rien ne se disperse.
- Sinon, le dossier proposé est `Documents\Atlasaga`.
- Un dossier choisi dans les réglages (`defaultWorldsDir`) passe toujours avant. Les mondes déjà créés ne bougent pas : ils sont retrouvés par leur chemin.
- Les réglages affichent désormais le vrai dossier par défaut (donné par Rust), au lieu d'un texte fixe « Documents\BuilderZ ».

On ne renomme pas `Documents\BuilderZ` en `Documents\Atlasaga` : déplacer les mondes de quelqu'un casserait les chemins des récents et pourrait échouer à moitié (fichiers ouverts, OneDrive).

## Conséquences

- Après la mise à jour, une épingle de BuilderZ dans la barre des tâches disparaît (son raccourci est supprimé) : il faut épingler Atlasaga à nouveau. Les mondes, récents et réglages sont conservés.
- L'éditeur affiché devient « Atlasaga ». La clé `HKCU\Software\Atlasaga\Atlasaga` remplace `HKCU\Software\BuilderZ\BuilderZ`.
- « À propos » montre encore `app.builderz.desktop` dans les chemins : c'est voulu.
- Une mise à jour 1.8 → 1.9 suit le chemin normal de Tauri (même `productName`).
- **TODO (Clément)** : le titulaire du copyright. `bundle.copyright` reste « Copyright © 2026 Clément (Cl3m3nt03) » en attendant qu'il donne le nom à utiliser.

## Vérification

- Le hook a été testé dans un script NSIS jetable, avec des clés de registre de test et des dossiers temporaires : cinq cas : installation normale, dossier partagé avec d'autres fichiers, Atlasaga installé dans le même dossier, exe verrouillé, commande de désinstallation qui ne correspond pas. Partout, données, raccourci sans rapport et autre valeur de démarrage conservés, registres rendus ; exe verrouillé et commande différente ne touchent rien.
- Le chemin de mise à jour complet (installeur 1.7.1 puis 1.8) n'a pas été rejoué : l'installeur écrit dans le profil Windows de l'utilisateur courant, et il n'existe pas sur le poste de profil ni de bac à sable à jeter qui ne soit pas celui de Clément. À vérifier lors de la recette, sur son poste, avec l'installeur de la release.
