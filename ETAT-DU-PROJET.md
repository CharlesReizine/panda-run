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

⚠️ **LE PLAN GRAVÉ CONTIENT LES LISTES DE MONSTRES** (`Module.ground` / `Module.birds`). Modifier un pool
de biome dans `levels.ts` ne change donc RIEN tant qu'on n'a pas regravé — le plan rejoue les espèces
telles qu'elles étaient au moment du tirage. Vérifié en dur : après avoir retiré `golem-de-pierre` du pool
des grottes, il continuait d'apparaître sur cave-1, et `grep golem-de-pierre src/data/level-seeds.generated.ts`
le montrait noir sur blanc. **Un changement de peuplement est un changement de génération.**

⚠️ **DEUX TESTS D'ÉQUILIBRAGE SUIVENT LES NIVEAUX DE MONSTRES**, et ils tombent en aval du resync :
`balance-invariant` (un terrain sans mob à son niveau calibré devient « absurdement trivial ») et
`shop-economy` (le revenu du parcours, donc le pécule d'arrivée, donc le prix plancher des chapeaux
rares). Les traiter fait partie du cycle, pas après.

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
| R343 | **plus aucun module ne déborde de sa portée** (298 → 0) · `ramp()` corrigé de façon asymétrique · 3 motifs qui posaient leur dernière pièce hors du module · `cascade-plus-haute` rendue joignable (elle ne l'était que par accident) · superpositions 14 → 1 · « départ dans l'eau » devient un critère de sélection de graine |

### Décisions de fond qui ne se rediscutent pas sans raison

- **Un puits, on y TOMBE ; l'échelle sert à REMONTER.** Sur `grotte-scellee`, l'échelle occupait la
  colonne d'arrivée du chemin : on l'agrippait avant d'avoir pu tomber, et descendre à l'échelle « c'est
  bizarre » (mot du joueur). Le puits fait donc trois colonnes, l'échelle contre la paroi du fond, et sa
  profondeur (≥ 10 rangées) interdit de ressortir au saut — ce que le jeu formalise déjà par
  `MIN_LADDER_TILES` (« deux fois la hauteur de saut »). Le joueur ne subit aucun dégât de chute : tomber
  est une invitation, pas une punition. Trois tuiles restent franchissables pour qui veut juste passer.
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

### ✅ Plus aucune superposition — 44 → 14 → 1 → 0, et le filtre d'affichage est retiré

`tests/data/superpositions.test.ts` est **VERT**. Il a été rouge volontairement pendant longtemps, sur
décision du joueur : « je préfère que ça soit un test qui fail et on le fix, plutôt que du dirty fix où on
peut avoir des patterns dégueulasses. Tu me fix ça, tu me le scotch pas. » Il a eu raison de tenir : la
cause n'était pas répartie dans les motifs, c'étaient **deux gestes** qui revenaient partout —
des modules qui débordaient de leur portée, et deux surfaces de même altitude traitées comme deux objets.

Conséquence : **le filtre TEMPORAIRE de `LevelScene` est supprimé** (il ne posait pas de tuile cassable là
où il y avait déjà de la matière). Sa condition de sortie était précisément ce test au vert. Le garder
maintenant cacherait la prochaine régression.

Ce qui protège l'acquis : `superpositions.test.ts` (l'effet), le garde-fou `DEBORDEMENTS` (la cause n° 1),
et `motifs-isoles.test.ts` (la cause n° 2, à **toutes** les largeurs, sans dérogation).

### Historique de cette dette (conservé : elle a coûté cher)

`tests/data/superpositions.test.ts` est **rouge** : **UNE** superposition restante, `plat/plat` sur
`plage-3`. Le compte a fait 44 → 14 → **1**. Les 44 premières sont tombées par un post-traitement
d'assemblage (`level-modules.ts`, juste avant le comblement des corniches nues) qui a éliminé la pierre
fragile mal posée et les doublons de dalles ; les 13 suivantes en corrigeant la CAUSE, c'est-à-dire les
modules qui débordaient de leur portée (section suivante). Le garde-fou `LARGEUR_UTILE = 3` reste : rogner
sans lui AMPUTAIT un appui et cassait l'atteignabilité de carriere-1 (huit tests rouges).

C'est délibéré, sur décision du joueur : « je préfère que ça soit un test qui fail et on le fix, plutôt que
du dirty fix où on peut avoir des patterns dégueulasses ». Le rendre vert en relâchant ses seuils serait
remettre du scotch.

**La dernière n'a pas été diagnostiquée** : elle se lit `plage-3 y17 x49`, deux plateformes de la même
rangée qui se recouvrent, alors qu'AUCUN module ne déborde plus (le nouveau test de portée est vert). Elle
vient donc d'un motif qui se superpose à lui-même, ou d'une couture entre deux modules à la même altitude.
Le chemin est balisé : `tests/data/motifs-isoles.test.ts` sait planter un motif seul, il suffit d'y ajouter
la détection de recouvrement pour trouver le fautif sans toucher aux terrains.

`LevelScene` filtre encore ces doublons à la pose (filtre marqué TEMPORAIRE dans le code) : à l'écran on ne
voit plus rien de superposé. Mais un filtre d'affichage ne peut rien contre « nager à travers la pierre » —
une cuve d'eau qui chevauche une dalle de roche est un défaut de génération. **Le filtre se supprime le jour
où ce test passe au vert.**

### ⚠️ LE GESTE FAUTIF QUI REVIENT : deux surfaces de MÊME altitude traitées comme deux objets

Cinq motifs avaient exactement le même défaut, et il produisait tantôt une superposition, tantôt une
sortie injoignable : une plateforme court vers la droite, PUIS une « corniche de sortie » est posée à
`w - bank`, à la MÊME altitude. Selon la largeur tirée, les deux se recouvrent (superposition visible) ou
s'écartent de 4 à 6 tuiles (sortie hors de portée : un vide de 4 tuiles à altitude égale ne se saute pas).

`trampoline-vide`, `trampoline-cascade`, `trampoline-echelle`, `echelle-descente-piegee` et les deux
`cascade-deux-passages` en sont morts. **La règle : deux surfaces contiguës de même altitude sont UNE
plateforme.** On la fait courir jusqu'au bord droit, et on ne pose pas de corniche séparée — sauf s'il y a
quelque chose entre les deux (dans `cascade-deux-passages-g`, le rideau de cascade : on part alors du plus
à droite des deux, jamais par-dessus le rideau, qui perdrait son sommet reconnaissable).

`tests/data/motifs-isoles.test.ts` couvre ce geste, **à toutes les largeurs** et sans dérogation possible.

### Le lot « génération »

**0. LES DÉBORDEMENTS DE MODULE SONT CORRIGÉS À LA SOURCE : 298 → 0.** (fait)

Un module écrivait de la géométrie **hors de la portée qui lui était allouée**, donc dans celle du suivant :
298 débordements sur 48 terrains, jusqu'à 30 tuiles. C'était la cause des superpositions de plateformes.
Quatre sources, toutes corrigées :

- **`ramp()`** avançait de 3 tuiles par palier même quand la portée n'en contenait pas autant.
  ⚠️ **La correction n'est PAS symétrique, et c'est tout le sujet.** En **descente**, borner le nombre de
  paliers par la place est gratuit : on tombe. En **montée**, raidir rend le pas infranchissable — mesuré,
  `plaine-7` n'a plus trouvé aucune graine en 30 passes (56 plateformes injoignables). En montée serrée on
  **resserre donc les paliers à 2 tuiles** au lieu de raidir. La version « borner dans les deux sens »,
  écrite ici avant vérification, est fausse : elle a coûté une regravure de 23 minutes pour rien.
- **`atterrissage-etroit`** posait sa berge de sortie après avoir consommé toute la largeur.
- **`grotte-depart`** dimensionnait son bassin sans réserver la corniche de sortie.
- **`lacs-cascade-descente`** décrétait `steps = 3` (42 tuiles) dans un module large de 20 à 30. Le nombre
  de paliers suit désormais la largeur, et sa portée au catalogue est passée à `[40, 46]`.

Un garde-fou est posé à l'assemblage : `DEBORDEMENTS` (dans `level-modules.ts`) consigne tout module qui
sort de sa portée, et `tests/data/superpositions.test.ts` exige que la liste reste vide. On **consigne** au
lieu de lever, parce qu'une exception abattrait la recherche de graines au lieu d'écarter une graine.

**0 bis. `cascade-plus-haute` ÉTAIT INJOIGNABLE PAR CONSTRUCTION, et c'est la vraie leçon du lot.** (fait)

Trois de ses cinq plateformes étaient hors d'atteinte, à toutes les largeurs : son plancher de grotte était
à 5 rangées de la berge d'entrée alors que le saut garanti en fait 3, et il n'était pas non plus un
« sommet de cascade » (2 rangées maximum sous le haut du rideau, il en était à 8). **Rien ne l'avait jamais
signalé** : les rampes des modules voisins débordaient sur sa portée et lui fabriquaient un escalier par
accident. Le jour où ces débordements ont disparu, les deux terrains qui imposent ce motif — `plaine-7` et
`desert-7` — n'ont plus trouvé une seule graine valide.

Le motif a donc chaque liaison explicite : bouche de grotte à `A + SIMPLE_JUMP_ROWS`, corniche d'émergence
au sommet du rideau (sans elle, remonter la cascade ne débouchait sur rien), et **échelle de sortie** de la
cavité vers le passage haut — l'invariant maison « toute cavité a un puits d'accès et une échelle de
sortie ».

`tests/data/motifs-isoles.test.ts` plante désormais **chaque motif SEUL** entre deux plateaux neutres, à
sa largeur minimale, médiane et maximale. Valider un motif *dans* un terrain ne le valide pas : un voisin
généreux masque le défaut, et on ne l'apprend que le jour où le voisin cesse de l'être. Quatre motifs sont
inventoriés avec leur raison (deux ne s'atteignent qu'au rebond, que ce modèle ne simule pas ; les deux
`cascade-deux-passages` gardent une plateforme hors de portée aux grandes largeurs — dette réelle, à
prendre avec le prochain lot puisqu'elle demande une regravure).

⚠️ **LES TROIS CHIFFRES CI-DESSOUS SONT PÉRIMÉS ET DOIVENT ÊTRE REMESURÉS.** Ils datent d'avant la
correction des débordements, qui a changé la géométrie de tous les terrains : « 12 superpositions dans
grotte-scellee », « 26 séquences de sauts », « 74 paires de surfaces » ne valent plus rien tels quels. Les
CAUSES décrites restent utiles, les comptes non. Remesurer avant de s'y remettre.

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

**2. Vingt-six séquences de sauts avec du sol praticable dessous** — ⚠️ **CREUSER LE SOL DESSOUS NE MARCHE
PAS.** Tenté en post-traitement d'assemblage (ajouter un `gap` sous chaque séquence de ≥ 3 plateformes
suspendues, en épargnant les bords de terrain et les zones déjà trouées) : **53 tests rouges**. Le sol qu'on
creuse EST la route principale du terrain ; les plateformes suspendues sont la variante haute, pas l'inverse.
La correction doit donc soit retirer la séquence redondante, soit la déplacer au-dessus d'un vide existant —
dans les MOTIFS, pas en post-traitement.

Détail du défaut d'origine :, sur 20 terrains (pire : `plaine-1
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

**Deux documents Firestore périmés** — `saves/panda` et `players/panda`, doublons de l'archer 29 sous une
clé abandonnée. Inoffensifs (le dédoublonnage les ignore, `chercher` ne les lit plus). Suppression bloquée
par le garde-fou de l'outil :
`firebase firestore:delete saves/panda --project panda-run-reizine`.

**Différé par le joueur** : équilibrage d'XP (6 terrains exemptés de la bande d'XP, 2 marqueurs de carte
abaissés — tout provisoire) et refonte des icônes de sorts.

**En attente de retour de jeu** : la pierre fragile se lit-elle comme cassable *avant* qu'on tape ? et la
pluie de flèches inopérante sous un plafond frustre-t-elle plus qu'elle ne plaît ?
