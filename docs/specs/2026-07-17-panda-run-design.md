# Panda-Run — Design V1

*Spec validée le 2026-07-17.*

## Concept

Side-scroller 2D action-RPG jouable sur iPhone, esthétique inspirée de Ragnarok Online
(chibi, coloré, mignon). Le héros est un **panda hyper mignon** qui traverse des niveaux
de gauche à droite, tue des monstres, gagne de l'XP, débloque des skills, change de
classe et s'équipe de loot.

## Plateforme & distribution

- **Jeu HTML5** : Phaser 3 + TypeScript + Vite.
- **PWA installable** : manifest + service worker, plein écran, ajout à l'écran d'accueil iOS.
- **Hébergement statique** : GitHub Pages ou Vercel.
- **Sauvegarde** : localStorage (schéma versionné) + export/import JSON en secours
  (Safari peut purger le stockage d'un site jamais ouvert pendant longtemps).
- Repo perso dédié : `~/panda-run`, hors du monorepo Pretto.

## Boucle de jeu

- Side-scroller gauche → droite, orientation paysage.
- **Contrôles tactiles** : joystick virtuel à gauche (déplacement + saut),
  à droite un bouton d'attaque de base + **4 slots de skills équipés** avec cooldowns visibles.
- **Combat temps réel orienté DPS** : les ennemis tapent fort, il faut optimiser ses dégâts
  et sa survie. Barre de vie visible au-dessus de chaque ennemi.
- Patterns ennemis simples : contact, projectile, charge.
- Mort = retour à la carte du monde ; on conserve XP et loot ramassés dans la tentative.

## Héros : le panda

- Sprite pixel-art chibi **sur mesure** (généré/dessiné), car introuvable en pack libre.
- L'apparence évolue :
  - **par classe** : tenue/posture différente à chaque changement de classe ;
  - **par équipement** : l'arme équipée (et si possible un élément d'armure) est visible
    sur le sprite via des **overlays** ancrés au corps (calques arme/chapeau).
- Direction artistique : mignon avant tout — grosses joues, animations rebondies,
  petits effets (cœurs, étoiles, zzz).

## Progression

- XP par monstre tué, courbe de niveaux classique.
- **Classes** : on démarre **Novice** (panda de base). Au **niveau 10**, choix entre
  **Swordsman / Mage / Archer** — écran de changement de classe cérémonial à la RO,
  nouveau style visuel du panda.
- **Skills** : ~6 skills par classe, débloqués avec des points de skill gagnés par niveau.
  4 skills équipables à la fois (les 4 slots du HUD).
- **Stats dérivées simples** : ATK / DEF / HP / vitesse d'attaque.

## Monde & niveaux

- **Carte du monde entre les niveaux** : nœuds reliés par des routes ramifiées
  (style Super Mario World). Pour aller d'une ville A à une ville B, plusieurs chemins
  possibles, chacun avec son **biome et son bestiaire** (plaine → Porings-like ;
  désert → scorpions-like ; cave → squelettes).
- **V1 : 2 zones majeures, ~10 niveaux, 2 boss.**
  - Zone 1 : plaine/forêt (facile), boss 1.
  - Zone 2 : désert (dur), boss 2, avec une route alternative type cave
    (bestiaire différent) pour matérialiser le choix de chemin sur la carte.
- **Boss** : arène dédiée, patterns téléphonés, loot d'équipement garanti.

## Loot & équipement

- **3 slots** : arme, armure, accessoire.
- Drops monstres : or + potions de soin. Drops boss : équipement rare.
- Stats simples : +ATK, +DEF, +HP.
- Pas de craft, d'enchantement ni de raretés multiples en V1.

## Assets

- **Héros panda** : pixel-art sur mesure (spritesheet : idle, run, jump, attaque,
  cast, hit, mort) + overlays par classe et par arme.
- **Monstres, tilesets, décors, UI** : packs pixel-art **libres** (itch.io, OpenGameArt),
  choisis pour cohérence avec le style RO (chibi, coloré). Un pack de référence sera
  sélectionné au démarrage de l'implémentation.

## Découpage technique

- **Scènes Phaser** : `Boot/Preload`, `WorldMap`, `Level`, `BossLevel`,
  `UIOverlay` (HUD tactile, superposé), menus (perso, skills, inventaire).
- **Données de gameplay déclaratives** (JSON/TS) : monstres, skills, niveaux, tables de
  drop, courbe d'XP — équilibrage sans toucher au moteur.
- **Module de save unique** : lecture/écriture localStorage, schéma versionné avec
  migrations, export/import JSON.
- Physique : arcade physics de Phaser (plateformes, gravité, hitbox).

## Hors scope V1

- Multijoueur, cloud save, App Store/TestFlight.
- 2e changement de classe (Knight/Wizard/Hunter), stats à répartir (STR/AGI/INT).
- Craft, cartes de monstres, raretés d'objets.
- Son/musique : optionnel en V1 (un pack libre si le temps le permet).

## Critères de succès

- Jouable au pouce sur iPhone en Safari/PWA, 60 fps sur un niveau chargé.
- La boucle complète fonctionne : tuer → XP → level up → point de skill → équiper →
  plus fort → boss → loot → carte du monde → choisir sa route.
- Le changement de classe au niveau 10 est un vrai moment (écran dédié, nouveau look).
- La progression persiste entre sessions.
