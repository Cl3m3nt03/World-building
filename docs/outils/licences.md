# Licences tierces

Atlasaga est propriétaire, mais il contient du code et des polices de tiers. Presque toutes leurs licences (MIT, BSD, ISC, Apache-2.0, Unicode-3.0, OFL-1.1, SDK WebView2) demandent de reproduire le copyright et le texte de la licence avec l'app. Ces notices sont générées à chaque build de release, livrées dans l'installeur et affichées dans l'app. Ce n'est pas un avis juridique : un doute sur une licence se tranche avec un juriste.

## Ce qui est généré

`pnpm notices` (`scripts/third-party-notices.mjs`) écrit `src-tauri/notices/THIRD-PARTY-NOTICES.txt`, qui n'est pas versionné. Le fichier rassemble :

- **Crates Rust** : `cargo about generate` avec `src-tauri/about.toml`, pour la cible `x86_64-pc-windows-msvc`, sans les build-deps ni les dev-deps. Atlasaga lui-même (`publish = false`) est ignoré.
- **Paquets JavaScript de production** : `pnpm licenses list --prod`, puis les fichiers `LICENSE`/`COPYING` de chaque paquet. Un paquet MIT sans fichier reçoit le texte MIT standard avec son auteur.
- **Ressources embarquées** que ni cargo ni pnpm ne listent : `licenses/bundled.json` (polices du PDF dans `src-tauri/fonts/`, polices d'Excalidraw, styles CSL de hayagriva en CC-BY-SA 3.0, SDK et bootstrapper WebView2). Les textes sont dans `licenses/`.
- **Fichiers `NOTICE`** des crates et des paquets (Apache-2.0 §4(d)), copiés tels quels.
- Pour les licences MPL-2.0, le lien vers le code source de chaque composant (MPL §3.2).

Les textes identiques sont regroupés : chaque section donne une licence, les composants concernés et le texte, en anglais.

Le fichier est livré par `bundle.resources` (`tauri.conf.json`) à côté de l'exe (`THIRD-PARTY-NOTICES.txt` dans le dossier d'installation) et s'affiche dans **Réglages › À propos › Licences tierces** (commande `third_party_notices`), avec une recherche par composant ou par licence.

Le wiki exporté embarque ses polices en base64 : `fonts.css` commence par le copyright de chaque police utilisée et le texte de l'OFL (`src/features/wiki/export/fonts.ts`).

## Quand il est généré

- **Release** : `beforeBuildCommand` lance `pnpm notices` avant `pnpm build`. Le workflow `release.yml` installe cargo-about. Un build release sans le vrai fichier échoue (`src-tauri/build.rs`).
- **Développement** : `cargo build`, `cargo test` et `pnpm tauri dev` n'ont pas besoin de cargo-about. Si le fichier manque, `build.rs` écrit un fichier d'attente, que l'écran affiche tel quel. `pnpm notices` le remplace par le vrai.
- **CI** : le job `licences` (Ubuntu, en parallèle des autres) génère les notices à chaque PR et les joint en artefact `third-party-notices`.

Installer l'outil en local, une fois : `cargo install cargo-about@0.9.3 --locked --features cli`. La CI prend le binaire précompilé de la même version (`taiki-e/install-action`) ; changer de version, c'est changer `ci.yml`, `release.yml` et cette page ensemble.

## Licences acceptées

La liste unique est `accepted` dans `src-tauri/about.toml`. Le script la relit pour les paquets JavaScript. Elle ne contient que des licences permissives, plus MPL-2.0 (copyleft limité au fichier, sans effet sur le reste de l'app tant que les fichiers MPL ne sont pas modifiés) et OFL-1.1 (polices). Pas de GPL, LGPL ni AGPL : une dépendance sous l'une d'elles, ou sans licence reconnue, fait échouer la génération.

Pour une expression `A OR B`, une seule licence acceptée suffit ; pour `A AND B`, il faut les deux.

## Quand la CI échoue

Le job `licences` affiche la crate ou le paquet en cause et sa licence.

1. **Licence copyleft (GPL, AGPL, LGPL) ou propriétaire** : ne pas l'ajouter à la liste. Chercher une autre dépendance, une feature qui l'évite, ou retirer la fonction. Faire remonter au manager si aucune option ne convient.
2. **Licence permissive absente de la liste** (par exemple `BlueOak-1.0.0`) : vérifier le texte, puis l'ajouter à `accepted` dans la même PR, en le justifiant dans sa description.
3. **Licence inconnue ou mal déclarée** (champ `license` vide, texte non reconnu) :
   - crate : une exception dans `about.toml`, pour cette crate seulement, avec la licence lue dans son dépôt :
     ```toml
     [nom-de-la-crate.clarify]
     license = "MIT"

     [[nom-de-la-crate.clarify.files]]
     path = "LICENSE"
     license = "MIT"
     checksum = "<sha256 du fichier>"
     ```
   - paquet JavaScript : une entrée dans `JS_OVERRIDES` en haut de `scripts/third-party-notices.mjs`, avec un commentaire qui dit d'où vient la licence (exemple : `khroma`, dont le `package.json` n'a pas de champ `license` mais dont le fichier est MIT).
4. **Fichier de licence d'une ressource manquant** : le chemin de `licenses/bundled.json` est faux ou le fichier a été déplacé.

## Ajouter une ressource embarquée

Une police, une image ou des données livrées sans passer par cargo ou pnpm (copiées par un plugin Vite, `include_bytes!`, `bundle.resources`) : ajouter son texte de licence avec son copyright sous `licenses/`, puis une entrée dans `licenses/bundled.json` (`name`, `licence` en SPDX, `file`).

## Cas connus

- **Liberation Sans** (polices d'Excalidraw) n'est pas copiée dans l'app (`vite.config.ts`) : Excalidraw livre la version 1.05, d'avant le passage de Liberation à l'OFL (GPL-2.0 avec exception de police). Excalidraw ne s'en sert que pour ses exports côté serveur ; elle n'apparaît pas dans son choix de polices.
- **Excalifont** et **Xiaolai** ne portent pas de licence dans leurs métadonnées : Excalidraw les publie sous OFL-1.1 (texte dans `licenses/fonts/excalidraw/`). À vérifier contre le dépôt d'Excalidraw si sa version change.
- **WebView2** : le SDK lié par `webview2-com-sys` est sous une licence de type BSD-3-Clause (Microsoft) ; le bootstrapper embarqué par l'installeur et le runtime restent sous les conditions de Microsoft, citées avec leurs liens. Le texte exact à afficher pour le runtime est à confirmer par un juriste.
- **typst-assets** : son fichier `NOTICE` cite aussi des polices que l'app n'embarque plus (feature `fonts` coupée, #564) ; il est reproduit tel quel.
- Atlasaga n'a pas encore de fichier `LICENSE` ni de titulaire du copyright déclaré : c'est à Clément de les fixer.
