# V2-M1 — Socle visuel

**Objectif** : poser la matière de la V2 (ADR 0012) avant de refaire les écrans. Tokens, verre, typographie, atlas vivant, mouvement et primitives. Toute l'app en profite sans être refaite, et une page « Système de design » montre chaque pièce dans les deux thèmes.

**Ordre d'exécution** : V2-1.1 → 1.2 → 1.3, puis 1.4 et 1.5, puis 1.6, et 1.7 en dernier.

---

## V2-1.1 — Tokens de la V2 (#425)
- [x] Palettes « encre » (sombre) et « vélin » (clair) de l'ADR 0012, avec les mêmes noms `--bz-*` quand le rôle ne change pas, et le vert-de-gris en secondaire
- [x] Couleurs des types de cartes réaccordées (contraste AA vérifié sur les surfaces des deux thèmes)
- [x] Rayons par hiérarchie, ombres teintées, durées et courbes de mouvement en tokens

**Critères d'acceptation** : toute l'app s'affiche avec les nouvelles couleurs, sans couleur en dur ; contrastes AA mesurés et listés dans la PR.

## V2-1.2 — Typographie Alegreya (#426)
- [x] `@fontsource-variable/alegreya` (titres, noms de documents) et `@fontsource/alegreya-sans` (interface), embarquées
- [x] Échelle modulaire (×1,25), interlignes, rubriques en petites capitales réelles

**Critères d'acceptation** : aucun appel réseau ; les titres de document, de dialogue et de section prennent la serif.

## V2-1.3 — Verre liquide en trois niveaux (#427)
- [x] Utilitaires `glass-veil`, `glass-panel`, `glass-float` (flou, fond, reflet sur l'arête haute, bordure intérieure, ombre, grain SVG)
- [x] La coque et les surfaces existantes passent au bon niveau ; repli opaque si la transparence est coupée

**Critères d'acceptation** : la profondeur se lit d'un coup d'œil ; performances inchangées (flou toujours réservé à la coque).

## V2-1.4 — L'atlas vivant (#428)
- [x] Fond SVG gravé (lignes de niveau, rose des vents) généré par l'app, fondu sous l'image du monde ou seul sans image
- [x] Profondeur légère au pointeur, désactivée si le mouvement est réduit ou la transparence coupée

**Critères d'acceptation** : un monde sans image a un fond « atlas » ; contraste du texte toujours AA.

## V2-1.5 — Mouvement (#429)
- [x] Ouverture et fermeture des dialogues, menus, popovers et panneaux flottants, avec les tokens de durée et de courbe
- [x] Une séquence d'entrée à l'ouverture d'un monde ; rien si `prefers-reduced-motion`

**Critères d'acceptation** : chaque mouvement répond à un geste ; mouvement réduit : rien ne bouge.

## V2-1.6 — Primitives (#430)
- [x] Boutons, champs, menus, dialogues, onglets, interrupteurs, listes déroulantes, info-bulles restylés sur les tokens et le verre
- [x] États : survol, focus visible, désactivé, pressé, erreur

**Critères d'acceptation** : les primitives shadcn gardent leur accessibilité ; clavier inchangé.

## V2-1.7 — Page « Système de design » et recette (#431)
- [x] Une page cachée (Réglages › À propos › « Système de design ») qui montre couleurs, typographie, verre, primitives et atlas dans les deux thèmes
- [ ] Captures dans l'app réelle ; recette de Clément

**Critères d'acceptation** : Clément valide le socle avant V2-M2.
