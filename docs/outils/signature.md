# Signature de l'installeur Windows

Un installeur non signé n'a ni éditeur vérifiable ni réputation. Windows Defender peut alors le classer comme menace sur une simple heuristique (faux positif), et SmartScreen demande une confirmation au premier lancement. La réponse légitime est de **signer** l'app et l'installeur, de donner des **métadonnées complètes**, et de **déclarer le faux positif** à Microsoft. On ne contourne jamais la détection : pas d'obfuscation, pas de packer, pas d'exclusion Defender.

## Ce qui est déjà en place

- **Métadonnées Windows** (`src-tauri/tauri.conf.json`, section `bundle`) : `publisher`, `copyright`, `shortDescription`, `longDescription`, `homepage`, `category`. Elles remplissent les propriétés de l'exe (Société, Copyright, Description) et de l'installeur NSIS.
- **WebView2 en `embedBootstrapper`** : l'installeur embarque le petit programme d'installation de Microsoft (environ 1,8 Mo) au lieu de le télécharger puis l'exécuter, un comportement « télécharge et lance un exe » que les antivirus jugent suspect. Sur Windows 11, WebView2 est déjà installé et rien n'est lancé.
- **Étape de signature prête** dans `.github/workflows/release.yml`. Elle est **inactive** tant que la variable `WINDOWS_SIGNING` n'est pas définie : les releases continuent de sortir, non signées.

## Option 1 (recommandée) : SignPath Foundation

Certificat gratuit pour les projets open source, détenu par SignPath (le certificat est au nom de « SignPath Foundation », le projet est cité comme éditeur). La clé ne quitte jamais leur HSM : aucun fichier de certificat à protéger.

Ce que Clément doit faire :

1. **Ajouter une licence open source** approuvée par l'OSI (MIT, Apache-2.0, GPL-3.0…) au dépôt : c'est une condition d'éligibilité. C'est un choix de Clément.
2. Remplir la demande sur <https://signpath.org/apply> (dépôt `Cl3m3nt03/World-building`, release publique, page du projet). Leurs conditions : projet maintenu, releases publiques, pas de logiciel malveillant, politique de signature affichée dans le README.
3. Une fois accepté : dans SignPath, installer l'**app GitHub de SignPath** sur le dépôt, créer le projet (slug `builderz`), une *artifact configuration* qui signe le fichier `.exe` de l'installeur, et la politique `release-signing`.
4. Dans GitHub, **Settings > Secrets and variables > Actions** :
   - secret `SIGNPATH_API_TOKEN` (jeton d'un utilisateur CI de SignPath) ;
   - variables `WINDOWS_SIGNING` = `signpath`, `SIGNPATH_ORGANIZATION_ID`, et au besoin `SIGNPATH_PROJECT_SLUG` (défaut `builderz`), `SIGNPATH_POLICY_SLUG` (défaut `release-signing`), `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` (défaut `initial`).

Limite : SignPath signe l'installeur tel qu'il est envoyé ; l'exe de l'app compressé dedans reste non signé. C'est l'installeur que Defender et SmartScreen examinent au téléchargement.

## Option 2 : certificat classique (Certum Open Source ou autre)

Certum vend un certificat « Open Source Code Signing » à prix réduit (environ 30 à 70 € par an), au nom du développeur après vérification d'identité. Depuis 2023, la clé doit rester sur une carte à puce ou un HSM cloud (SimplySign chez Certum) : on ne peut plus l'exporter en `.pfx`. La signature passe alors par une **commande** (`signCommand`) fournie par le service.

Ce que Clément doit faire :

1. Commander le certificat sur <https://shop.certum.eu> (« Open Source Code Signing »), passer la vérification d'identité, activer SimplySign.
2. Choisir le mode dans GitHub (**Settings > Secrets and variables > Actions**) :
   - **Certificat exportable `.pfx`** (ancien certificat ou autre CA) : variable `WINDOWS_SIGNING` = `certificate`, secrets `WINDOWS_CERTIFICATE` (le `.pfx` encodé en base64 : `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))`) et `WINDOWS_CERTIFICATE_PASSWORD`. Tauri signe alors l'app, l'installeur et le désinstalleur.
   - **Commande de signature** (HSM cloud, Azure Trusted Signing…) : variable `WINDOWS_SIGNING` = `command`, variable `WINDOWS_SIGN_COMMAND` = la commande, où `%1` est le fichier à signer (ex. `trusted-signing-cli -e https://weu.codesigning.azure.net -a <compte> -c <profil> %1`). Les identifiants de cette commande vont en secrets, jamais dans la variable.
   - Variable facultative `WINDOWS_TIMESTAMP_URL` (défaut `http://time.certum.pl`).
3. Mettre `bundle.publisher` dans `tauri.conf.json` au nom exact du certificat, pour que l'éditeur affiché et la signature concordent.

Aucun secret ne va dans le dépôt : ni `.pfx`, ni mot de passe, ni jeton.

## Déclarer un faux positif à Microsoft

À faire à chaque détection, même une fois signé (une nouvelle version peut être reprise par une heuristique).

1. Noter le **nom exact de la menace** : Sécurité Windows > Protection contre les virus et menaces > Historique de protection (par exemple `Trojan:Win32/Wacatac.B!ml`).
2. Aller sur <https://www.microsoft.com/wdsi/filesubmission>, se connecter avec un compte Microsoft.
3. Choisir **« Software developer »** (je suis l'éditeur), produit **Microsoft Defender Antivirus**, envoyer l'installeur (`BuilderZ_X.Y.Z_x64-setup.exe`, ou un `.zip` s'il dépasse la limite).
4. Indiquer « Incorrectly detected as malware/malicious », le nom de la menace, le lien de la release GitHub et le dépôt public.
5. Une fois la réponse reçue (souvent sous 1 à 3 jours), mettre à jour les définitions : `"%ProgramFiles%\Windows Defender\MpCmdRun.exe" -SignatureUpdate`.

## Vérifier un build en local

Scanner un fichier sans rien supprimer ni modifier :

```
"%ProgramFiles%\Windows Defender\MpCmdRun.exe" -Scan -ScanType 3 -File <chemin> -DisableRemediation
```

Lire les propriétés de l'exe (clic droit > Propriétés > Détails) et la signature (`Get-AuthenticodeSignature <chemin>` dans PowerShell).
