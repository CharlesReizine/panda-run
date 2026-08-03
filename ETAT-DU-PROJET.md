# Panda-Run — état du projet

Jeu de plateformes 2D façon Ragnarök Online, joué **au doigt sur iPhone en paysage**.
Phaser 4 · TypeScript · Vite · vitest · pnpm · PWA · Firebase (Hosting + Firestore + auth anonyme).

Ce fichier est le point d'entrée : où en est le jeu, comment le vérifier, quels pièges connaître, et ce
qui reste à faire. Il se met à jour à chaque lot livré.

---

## Vérifier et déployer

```bash
pnpm verif       # tsc + 1690 tests + build + les six sondes navigateur
npx firebase-tools deploy --only hosting
```

`pnpm verif` est **la** commande. Elle existe parce que choisir les vérifications au cas par cas a laissé
partir plusieurs builds cassées : une régression passe rarement là où on la cherche.

| Sonde | Ce qu'elle attrape |
|---|---|
| `smoke-boot` | erreur JS au démarrage — a laissé partir une build morte en production |
| `smoke-sauvegarde` | un échec de lecture cloud déguisé en « partie absente » ; persistance après reload |
| `smoke-ecrans` | les 13 écrans, bouton par bouton — l'entraînement plantait à chaque frame |
| `smoke-culling` | objet masqué alors qu'il est dans la vue — « le sol disparaît » |
| `smoke-pierre` | la pierre fragile s'use puis cède, une tuile à la fois |
| `smoke-niveaux` | tous les terrains tournent, et mesure le rebond du trampoline |

**Regraver les plans de terrain** (obligatoire dès qu'on touche à la génération) :

```bash
GEN_GRAINES=1 npx vitest run tests/data/graines.test.ts   # ~100 s
```

Puis **resynchroniser les niveaux de monstres** : ils dérivent du premier biome où chaque espèce
apparaît, donc la regravure les décale. `tests/core/mob-level.test.ts` dit lesquels. Le calcul dépend des
niveaux stockés : **itérer jusqu'au point fixe** (deux ou trois passes).

### ⚠️ Toucher à la génération, c'est un cycle complet

modifier → **regraver (6 à 7 minutes)** → resynchroniser les monstres → 1690 tests → six sondes → déployer.

Trois tentatives ont échoué le 3 août faute d'avoir tenu ce cycle jusqu'au bout. Deux règles en découlent :

- **Grouper les corrections de génération, puis regraver UNE fois.** Une regravure par correctif, c'est
  vingt-cinq minutes de calcul pour rien.
- **Toujours lire `tests/data/couverture-motifs.test.ts`.** C'est le seul test qui dise qu'un motif a
  DISPARU du jeu. Un correctif de géométrie qui rend un motif intirable passe sinon pour un succès : tous
  les autres tests restent verts, et le contenu s'évapore en silence.

---

## Les pièges du dépôt

Ceux qui ont coûté du temps, dans l'ordre où ils mordent.

**`buildLevelFromModules` est PUR, `planModules` NON.** Le second consulte un compteur global (« le motif
le moins servi d'abord »). Graver une graine ne reproduit donc rien : on grave le **plan de modules**.

**Le `switch` de `buildModule` contient 56 `case` en double.** Le premier gagne ; ~1000 lignes sont mortes.
Avant d'ajouter un motif : `grep -n "case '<kind>'"` doit renvoyer **une** ligne. Cinq copies divergent, et
le correctif « couloir-large » n'a jamais tourné. Voir la dette plus bas.

**Le dessus d'une dalle de roche n'est compris que par `strictReach`.** `unreachablePlatforms` et
`deadEndSurfaces` ne raisonnent que sur les *plateformes*. Un toit de grotte doit donc être une plateforme
`solid`, pas une dalle de roche — sinon le motif est déclaré injoignable et écarté silencieusement.

**Phaser ne fait aucun culling de display-list.** D'où le découpage en tranches de 480 px. Un objet à
cheval sur plusieurs tranches doit être **re-révélé sur toute la fenêtre**, pas seulement sur la tranche
qui vient d'entrer : c'est le bug « le sol disparaît », arrivé deux fois.

**Les clés d'objet en double ne sont vues que par `tsc`.** JS garde la dernière. Vérifié sur
`SPECIAL_WATER_LEVELS`, `SPECIAL_FORCED`, `CATALOG`.

**Mesurer les performances avec RAF, c'est mesurer le vsync.** Pour un vrai chiffre :
`game.loop.sleep()` puis `game.step()` à la main.

**Le cadrage** : `Scale.NONE` + ajustement manuel depuis `visualViewport`. Ne jamais centrer avec
`centerCamera` (il scrolle de `-BLEED_X`) : passer par `fromLeft` / `fromRight` de `src/core/viewport.ts`.

---

## Sauvegarde — la partie la plus réparée du jeu

Cinq pertes de sauvegarde successives, **toutes avec une suite de tests verte**. Les fonctions pures
étaient correctes ; le défaut vivait chaque fois dans l'enchaînement au sein de `TitleScene`, qu'aucun test
ne peut atteindre (une scène Phaser ne s'instancie pas). D'où les règles actuelles :

1. **La clé du document EST le pseudo normalisé.** Le repli sur `'panda'` a été supprimé : il rangeait les
   parties là où personne ne les cherchait.
2. **`chercher()` rend trois états** — `trouve` / `absent` / `echec`. Seul `absent` autorise à proposer une
   nouvelle partie ; `echec` n'autorise qu'à réessayer. Confondre les deux transformait l'écran d'accueil
   en écran d'effacement.
3. **La synchro ne pousse jamais par-dessus ce qu'elle n'a pas pu lire** (état `impossible`).
4. **Entre deux sauvegardes, la plus AVANCÉE gagne** — jamais la plus récente : une ligne fantôme peut
   porter un horodatage plus frais tout en décrivant un personnage moins avancé.
5. **Correspondance par nom EXACT.** La correspondance par préfixe a été retirée : « j'ai écrit
   charlychoulov et ça m'a chargé charlychoulove ». Une lettre oubliée ouvrait la partie d'un autre, que
   l'autosave écrasait ensuite.
6. **`load()` ne lève jamais** et valide la forme : un JSON abîmé est traité comme absent.

La décision de reprise vit dans `src/core/reprise.ts`, pur et testé sur la matrice complète.

---

## Historique des lots

| Build | Ce qui a changé |
|---|---|
| R332 | clé = nom du joueur · mitraillette en tir continu + éventail ±15° · zone morte de caméra |
| R333 | **pierre cassable** (matière + 2 motifs + greffe sur `grotte-noyee`) · corniches de pierre nue comblées · trampoline recadré · attaques du ciel soumises à la gravité |
| R334 | `chercher()` à trois états · synchro qui ne pousse plus à l'aveugle · délai 6 s → 20 s |
| R335 | sonde de culling (mutation-testée) · persistance après reload · `load()` ne lève plus · changement de classe verrouillé |
| R336 | caméra : suivi horizontal direct (la zone morte faisait toute la largeur) |
| R337 | sous-sol sombre · texture `rock-body` · échelles percées · caméra qui rattrape l'altitude acquise |
| R338 | nom EXACT au chargement (le préfixe laissait une faute de frappe ouvrir la partie d'un autre) · ce fichier |

### Décisions de fond qui ne se rediscutent pas sans raison

- **La pierre fragile n'est jamais sur le chemin obligatoire.** Un mur à casser barrant la seule route,
  c'est un joueur bloqué s'il n'a pas compris qu'il faut frapper. Elle scelle toujours un à-côté.
- **Toute cavité a un puits d'accès et une échelle de sortie.** Sinon : injoignable, ou cul-de-sac.
- **Aucune compétence offerte au changement de classe.** Le cadeau volait le premier choix du joueur.
- **Les attaques venues du ciel sont des corps soumis à la gravité.** Bloquées par tout sol au-dessus,
  elles descendent jusqu'au sol en dessous. Conséquence assumée : en grotte, une pluie de flèches ne sert
  à rien.
- **On ne fabrique pas du vide en le teintant.** Deux voiles translucides ont échoué (rayures, puis
  patchwork de rectangles sur la jungle). Le sous-sol est **opaque** et sa limite suit la silhouette du
  terrain : là où une plateforme la couvre, aucune arête ne se voit.

---

## Dette et travaux ouverts

### ⚠️ Un test échoue volontairement

`tests/data/superpositions.test.ts` est **rouge** : 44 superpositions de géométrie (plat/plat=17,
pierre/plat=12, roche/roche=11, plat/roche=4). C'est délibéré, sur décision du joueur : « je préfère que ça
soit un test qui fail et on le fix, plutôt que du dirty fix où on peut avoir des patterns dégueulasses ».
Le rendre vert en relâchant ses seuils serait remettre du scotch.

`LevelScene` filtre encore ces doublons à la pose (filtre marqué TEMPORAIRE dans le code) : à l'écran on ne
voit plus rien de superposé. Mais un filtre d'affichage ne peut rien contre « nager à travers la pierre » —
une cuve d'eau qui chevauche une dalle de roche est un défaut de génération. **Le filtre se supprime le jour
où ce test passe au vert.**

### Le lot « génération » — quatre corrections, UNE regravure

À faire ensemble, dans cet ordre. Chacune est mesurée, localisée, et l'audit qui la trouve est décrit.

**1. Douze superpositions de textures dans `grotte-scellee`** — « dans tes nouveaux motifs y a parfois des
textures qui se superposent ». **Cause identifiée** : la hauteur de la cavité suivait celle du SOCLE, or
l'altitude d'entrée monte jusqu'à 27 rangées → caverne de 25 rangées et mur fragile à l'échelle, qui
traverse tout ce qui passe par là. Correctif écrit puis **abandonné faute d'avoir pu boucler le cycle**,
mais il est juste et la regravure a convergé (396 s) :

- `HAUT_CAV = 7` (plancher au sol du monde, intérieur 1..6, plafond en 7) ;
- socle RÉDUIT au-dessus de la cavité : `{ altBot: HAUT_CAV, altTop: alt - 1 }` au lieu de `1..alt-1` ;
- mur fragile sur `1..HAUT_CAV - 1`, plus sur toute la hauteur ;
- ⚠️ **`alt = Math.max(entryAlt, 9)`, PAS 12.** À 12 la rampe d'accroche devient trop raide pour les
  altitudes d'entrée basses : le motif est rejeté à chaque tirage et `couverture-motifs` le signale comme
  « jamais généré ». C'est l'erreur commise, et elle ne se voit qu'avec ce test.

**2. Vingt-six séquences de sauts avec du sol praticable dessous**, sur 20 terrains (pire : `plaine-1
x417→435`, six plateformes avec du sol utilisable 18 rangées plus bas ; `desert-3` en compte quatre).
Le contenu se contourne en marchant en dessous, donc il ne sert à rien. Détection : plateformes suspendues
enchaînées (écart ≤ 5 tuiles, Δy ≤ 4) dont les colonnes ont un sol ni troué ni enterré sous la roche.

**3. Soixante-quatorze paires de surfaces à moins d'un saut l'une de l'autre**, sur 45 terrains, presque
toutes à 2 rangées avec 3 colonnes de chevauchement — « j'en ai vu une qui revient et ça perturbe ».
Rehausser la corniche du dessus **par post-traitement global ne marche pas** : génération insoluble, plus de
dix-huit minutes de recherche sans une graine valide, contre cent secondes d'habitude. Il faut passer par
les motifs fautifs — chercher d'abord du côté des coutures entre modules et de `ramp()`.

**4. Le `switch` dupliqué de `buildModule`** — ~1000 lignes mortes, 56 `case` en double dont 5 divergents
(`couloir-large`, `passage-immerge`, `passerelles-zigzag`, `cascade-deux-passages-g`,
`colonnes-perilleuses`). Le correctif « un couloir large ne doit pas être nu » a été écrit dans la copie
morte : il n'a jamais tourné.

**74 paires de surfaces à moins d'un saut l'une de l'autre**, sur 45 terrains, presque toutes à 2 rangées
avec 3 colonnes de chevauchement — « j'en ai vu une qui revient et ça perturbe ». Une première tentative
(rehausser la corniche du dessus à un saut complet, en vérifiant que la rangée d'arrivée est libre) a été
ABANDONNÉE : elle rend la génération insoluble. Le générateur a cherché des graines valides pendant plus de
dix-huit minutes sans en trouver une seule, contre cent secondes d'habitude — rehausser en aveugle viole
d'autres invariants en cascade. La correction devra passer par les motifs fautifs, un par un, en repérant
d'où sortent ces paires (probablement les coutures entre modules et `ramp()`).

**26 séquences de sauts avec du sol praticable dessous**, sur 20 terrains (pire : `plaine-1 x417→435`,
six plateformes avec du sol utilisable 18 rangées plus bas ; `desert-3` en compte quatre). Le contenu est
contournable en marchant en dessous, donc inutile. Correction = génération, donc regravure.

**Deux documents Firestore périmés** — `saves/panda` et `players/panda`, doublons de l'archer 29 sous une
clé abandonnée. Inoffensifs (le dédoublonnage les ignore, `chercher` ne les lit plus). Suppression bloquée
par le garde-fou de l'outil :
`firebase firestore:delete saves/panda --project panda-run-reizine`.

**Différé par le joueur** : équilibrage d'XP (6 terrains exemptés de la bande d'XP, 2 marqueurs de carte
abaissés — tout provisoire) et refonte des icônes de sorts.

**En attente de retour de jeu** : la pierre fragile se lit-elle comme cassable *avant* qu'on tape ? et la
pluie de flèches inopérante sous un plafond frustre-t-elle plus qu'elle ne plaît ?
