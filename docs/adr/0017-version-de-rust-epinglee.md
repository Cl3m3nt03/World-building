# ADR 0017 — Version de Rust épinglée

- **Statut** : accepté (2026-11-18), décision de Clément
- **Contexte** : #596 (corrigé par #597), #600

## Contexte

Jusqu'ici, la CI installait Rust avec `dtolnay/rust-toolchain@stable` : chaque job prenait la dernière version stable du jour. Le 2026-11-09, `stable` est passé de 1.99.1 à **1.100.0**. Cette version range la sortie des scripts de build un niveau plus bas (`target/debug/build/<paquet>-<hash>/out` devient `target/debug/build/<paquet>/<hash>/out`). `tauri-build` 2.6.3 en déduisait mal le dossier `target`. Les ressources d'une build debug n'étaient plus copiées à côté de l'exe et l'e2e a échoué sur `main` **sans aucun changement de code** (#596). #597 a corrigé la cause en passant à `tauri-build` 2.7.5, mais le risque reste entier : une nouvelle version de Rust peut casser la CI, ou en changer le résultat, à n'importe quel moment et sans commit à relire.

En local, chacun compilait avec sa propre version (1.98.1 sur le poste de Clément), différente de la CI.

## Décision

1. La version de Rust est épinglée dans **`rust-toolchain.toml`, à la racine du dépôt** : `channel = "1.100.0"`, composants `clippy` et `rustfmt`, profil `minimal`. C'est le **seul endroit** où la version est écrite.
2. Ce fichier est à la racine parce que rustup le cherche dans le **dossier courant** et ses parents (et non à côté du `Cargo.toml` visé par `--manifest-path`). Il couvre donc tous les appels à cargo : les scripts pnpm (`cargo … --manifest-path src-tauri/Cargo.toml`, lancés depuis la racine), les hooks lefthook, `scripts/sqlx-prepare.mjs` (lancé dans `src-tauri/`), `pnpm tauri dev` et `pnpm tauri build` (Tauri lance cargo dans `src-tauri/`).
3. Les workflows (`ci.yml` : jobs « Lint, typecheck and tests », « Third-party licences », « End-to-end tests » ; `release.yml` : job « Windows installer ») n'utilisent plus `dtolnay/rust-toolchain`. Une étape lance `rustup toolchain install` sans argument, qui installe la version, les composants et le profil du fichier, puis affiche `rustc --version` dans le log. Aucune version n'est recopiée dans les workflows, donc il n'y a pas de copies à comparer.
4. Le cache `Swatinem/rust-cache@v2` change de clé avec la version, sans réglage de notre part. Sa clé contient le résultat de `rustc -vV` (version et commit du compilateur, lancé à la racine donc avec la version épinglée), celui de chaque toolchain installée, et le contenu de `rust-toolchain.toml`. Monter de version repart donc d'un cache vide, au lieu de restaurer un `target/` compilé par l'ancienne version (une des pistes de #596).

## Le prix

- **Une montée de version à la main** pour chaque release de Rust qu'on veut suivre (toutes les six semaines). Rien ne nous y oblige : on peut rester sur une version tant qu'aucune dépendance n'exige plus récent.
- Les correctifs du compilateur et de clippy n'arrivent plus d'eux-mêmes : on peut prendre du retard sans s'en apercevoir. Le risque est faible pour une app de bureau qui n'expose pas de code Rust à d'autres.
- **En local aussi, la version suit le fichier.** rustup installe 1.100.0 à la première commande cargo dans le dépôt (ou `rustup toolchain install` à la racine). La première build recompile tout : la sortie d'un autre compilateur ne se réutilise pas. En échange, le poste et la CI compilent, lintent et formatent avec la même version : un `clippy` ou un `rustfmt` plus récent sur la CI ne refuse plus un code accepté en local.
- Une nouvelle version de clippy ou de rustfmt n'arrive plus jamais au milieu d'une PR : ses nouveaux avertissements arrivent dans la PR de montée de version, qui les corrige.

## Monter de version

Une montée de version est une PR à elle seule, `ci: bump the Rust toolchain to 1.X.Y` :

1. Lire les notes de version de Rust **et de Cargo** de chaque version sautée, en cherchant ce qui touche la build : disposition de `target/` ou de `OUT_DIR` (la cause de #596), variables d'environnement des scripts de build, lints de clippy et de rustc passés en refus, changements de rustfmt, changements de l'édition 2024, cible `x86_64-pc-windows-msvc`.
2. Changer `channel` dans `rust-toolchain.toml`, et rien d'autre côté workflows.
3. En local : `pnpm check` (qui installe la nouvelle version à la première commande), puis corriger les nouveaux avertissements de clippy et le format. Si une dépendance de build (`tauri-build`, `sqlx`, `specta`…) dépend de la disposition des dossiers, la monter dans la même PR.
4. **CI verte, e2e compris** : c'est la build debug de l'e2e qui a révélé #596, les autres jobs étaient verts. Au besoin, lancer aussi `pnpm tauri build` en local pour vérifier l'installeur, puisque la CI ne construit l'installeur qu'à la release.
5. Aucun autre fichier à changer : le README et les workflows ne citent pas de numéro, ils renvoient au fichier. Cet ADR garde la version de départ comme trace de la décision.

## Conséquences

- Le compilateur, clippy et rustfmt de la CI ne changent plus que par un commit. Restent flottants, hors de cet ADR : l'image `windows-latest` (et son WebView2), Node `lts/*` et les actions en `@v4`.
- Un tag antérieur à ce fichier, reconstruit à la main par `release.yml`, n'a pas de `rust-toolchain.toml` : `rustup toolchain install` prend alors la toolchain par défaut du runner (la stable du jour), comme avant cet ADR. Le `rustc --version` du log le montre.
- Les versions de `tauri-driver` et de `cargo-about`, déjà épinglées dans les workflows, ne bougent pas.
- Le README dit que la version est épinglée, où, et renvoie à cet ADR.
