# Panda-Run — état du projet

Jeu de plateformes 2D façon Ragnarök Online, joué **au doigt sur iPhone en paysage**.
Phaser 4 · TypeScript · Vite · vitest · pnpm · PWA · Firebase (Hosting + Firestore + auth anonyme).

Ce fichier est le point d'entrée : où en est le jeu, comment le vérifier, quels pièges connaître, et ce
qui reste à faire. Il se met à jour à chaque lot livré.

---

## Vérifier et déployer

```bash
pnpm verif       # tsc + 1764 tests + build + les six sondes navigateur
npx firebase-tools deploy --only hosting
```

`pnpm verif` est **la** commande. Elle existe parce que choisir les vérifications au cas par cas a laissé
partir plusieurs builds cassées : une régression passe rarement là où on la cherche.

| Sonde | Ce qu'elle attrape |
|---|---|
| `smoke-boot` | erreur JS au démarrage — a laissé partir une build morte en production |
| `smoke-sauvegarde` | un échec de lecture cloud déguisé en « partie absente » ; persistance après reload |
| `smoke-ecrans` | les 14 écrans, bouton par bouton — l'entraînement plantait à chaque frame |
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

modifier → **regraver (6 à 7 minutes)** → resynchroniser les monstres → 1764 tests → six sondes → déployer.

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

**Le `switch` de `buildModule` A ÉTÉ DÉDOUBLONNÉ (R346) — et le piège méritait son passage ici.** Il
contenait 56 `case` en double, ~1000 lignes mortes : le premier gagne, donc un correctif écrit dans la
seconde copie ne tourne JAMAIS. C'est arrivé (« couloir-large » n'a jamais tourné) et cinq copies avaient
divergé. Le bloc n'était PAS supprimable en entier : 15 décors n'existaient QUE dans la seconde moitié.
Supprimé décor par décor, et prouvé sans effet (géométrie des 58 terrains identique à l'octet).
`tests/data/pas-de-decor-en-double.test.ts` lit désormais le fichier source et tombe si ça revient.

**Le dessus d'une dalle de roche n'est compris que par `strictReach`.** `unreachablePlatforms` et
`deadEndSurfaces` ne raisonnent que sur les *plateformes*. Un toit de grotte doit donc être une plateforme
`solid`, pas une dalle de roche — sinon le motif est déclaré injoignable et écarté silencieusement.

**Phaser ne fait aucun culling de display-list.** D'où le découpage en tranches de 480 px. Un objet à
cheval sur plusieurs tranches doit être **re-révélé sur toute la fenêtre**, pas seulement sur la tranche
qui vient d'entrer : c'est le bug « le sol disparaît », arrivé deux fois.

**Une profondeur de cuve ne se déduit JAMAIS de la hauteur du monde.** L'assembleur écrivait
`h = groundRow + 1 - top` : le fond d'un bassin descendait au sol du terrain. Anodin à 16 rangées de
haut, mortel à 45 — trente cuves étaient devenues improngeables, coffre au fond compris. La profondeur
est désormais bornée par ce qu'une apnée permet (`profondeurCuveMax`, calé sur le tier), et on COMBLE en
roche sous le nouveau fond. Corollaire : « sans y = au sol » ne veut plus dire « au sol du MONDE » —
`spawnFeetRow` et le repositionnement des props résolvent le fond réel, sinon requins et coffres
finissent dans le socle.

**Un motif ne creuse jamais plus bas que `PROFONDEUR_MOTIF`.** S'il pose de la géométrie sous le fond
visé (marches de lit, plafond immergé), l'assembleur RENONCE à rogner la cuve — il faudrait murer ce que
le motif vient d'écrire. C'est ce qui rendait `bassin-creuse`, `lac-en-u`, `grotte-noyee` et
`boyau-immerge` incapables d'être bornés. Leur lit et leurs plafonds immergés pendent désormais de la
BERGE, plus du sol du monde.

**La rampe d'accroche des motifs INVERSÉS ne passait pas par `addPedestals`.** Elle est posée après le
`return` de la branche miroir : elle n'avait donc pas de socle, les socles des voisins la muraient des
deux côtés, et il restait un rectangle de décor de fond au milieu du terrain. 142 poches closes, dont
celles des captures du joueur. Un comblement de sécurité tourne en plus à l'assemblage
(`sealedVoids` → dalles de roche NON solides : les déclarer solides faisait aussitôt crier
`caveCeilingClearance` sur six « plafonds de grotte » qui n'en sont pas).

**Un socle n'enjambe jamais une échelle — et on renonce à TOUTE la bande, pas à sa colonne.** Épargner
la seule colonne laisserait une fente d'une tuile murée des deux côtés et coiffée : une poche close avec
l'échelle dedans. Une corniche qui surplombe une montée est un surplomb, et n'a pas de corps.

**Une largeur de rampe se calcule en VALEUR ABSOLUE.** `grotte-scellee` et `grotte-u-brisable`
dimensionnaient leur rampe d'accroche sur `(alt - entryAlt) * 2` : en DESCENTE la différence est
négative, le `max(2, …)` la ramenait à deux tuiles, et `ramp()` lâchait seize rangées d'un coup. Seul
le SIGNE du dénivelé change, jamais la place qu'il réclame.

**Un filet de sécurité n'a pas le droit de dépeupler.** Le nouveau replacement des monstres dont la
corniche a été rognée les SUPPRIMAIT quand il ne trouvait pas de surface. Or le niveau calibré d'une
espèce dérive du PREMIER biome où elle apparaît : retirer le dernier faucon d'un biome précoce l'a
fait bondir de 12 à 23, et tout l'équilibrage a suivi. Il repose donc au sol, et ne retire qu'en
dernier recours.

**Trois contraintes verrouillent la chambre de `sol-fragile`, et elles se contredisent si on en bouge
une.** L'échelle de remontée doit (1) faire au moins `MIN_LADDER_TILES`, (2) déboucher deux rangées
au-dessus du chemin pour que `isLadderTop` la voie, (3) ne pas ajouter un 4e palier dans sa colonne
(`overStackedColumns`). Une seule profondeur de chambre satisfait les trois : `MIN_LADDER_TILES - 2`
sous le chemin, sans palier intermédiaire. Et son puits ne passe PAS dans la dalle cassable — on ne
frappe pas vers le haut en étant agrippé, donc y déboucher est un cul-de-sac. La dalle est raccourcie
d'une tuile et le puits est coiffé de gazon. Chercher à déplacer le puits en trouant le socle a fait
tomber trente-cinq tests ; approfondir la chambre sans corriger le reste, vingt-sept.

**Une échelle ne traverse AUCUNE matière — la pierre fragile comprise.** Elle est « franchissable par
construction » (il suffit de taper) sauf agrippé à une échelle : on ne frappe pas vers le haut dans
cette position. Un pan fragile au-dessus d'une échelle est donc un mur. `grotte-u-brisable` plantait la
sienne DANS son propre pan : le pan qu'on casse pour entrer se refermait sur qui voulait ressortir, sur
huit terrains. `laddersInRock` regarde désormais les deux matières.

**Une sonde qui n'a pas rebuild ment.** `smoke-ecrans` sert `dist/` : lancée sans `pnpm build`, elle a
déclaré un écran neuf « inactif après démarrage » alors qu'il n'était simplement pas dans la build. Et
les sondes laissent des `vite preview` orphelins qui gardent leur port — un `--strictPort` suivant se
rabat en silence sur le serveur orphelin, donc sur une build d'il y a une heure. `pnpm verif` fait les
choses dans l'ordre ; l'appel direct d'une sonde, non.

**L'altitude plancher se pose DANS LE MOTIF, jamais au chaînage.** `runningAlt = Math.max(2, exitAlt)`
fait démarrer le module suivant au-dessus de la surface que le précédent a laissée : le raccord ment et
`passage-immerge` devient injoignable à toutes ses largeurs (plus 70 tests). En revanche
`Math.max(ALT_PLANCHER, entryAlt)` dans le calcul de plancher de chaque motif marche : 215 « deux sols
collés » → 77, au prix d'une regravure.

**Relever les planchers remonte les altitudes d'entrée, donc raidit les rampes.** Effet de bord mesuré :
les marches de rampe plus hautes qu'un saut passent de 1 à 13, sur deux motifs qui PLAFONNENT leur
propre altitude (`grotte-scellee`, `echelle-descente-piegee`) — leur rampe d'accroche doit alors lâcher
quarante rangées en huit tuiles. Dimensionner la rampe sur son dénivelé ne suffit pas : c'est le
plafond d'altitude du motif qu'il faut retirer. Dette nommée dans `relief-jouable`.

**UN TERRAIN PEUT ÊTRE ENTIÈREMENT « ATTEIGNABLE » ET PARFAITEMENT INFAISABLE.** C'est le trou de tout
l'outillage, et il aura fallu qu'un joueur se cogne pour qu'on le voie. Sur Colline, `unreachablePlatforms`,
`strictReach`, `deadEndSurfaces` et `unreachableLadders` répondaient tous ZÉRO devant un mur de huit
rangées au tout début du terrain : ils raisonnent en GRAPHE (« existe-t-il un chemin, quel qu'il soit ? »)
et il en existait un, par des échelles suspendues à l'autre bout du module. Le joueur, lui, avance vers
la droite et se cogne. `marchesInfranchissables` mesure la SILHOUETTE, pas la topologie.

**La rampe d'accroche des motifs INVERSÉS s'arrêtait en route quand la montée dépassait six tuiles.**
`ramp()` ne borne pas ses paliers en montée (raidir rend infranchissable) : elle en calculait six, n'avait
la place que pour trois, et coupait. D'où l'escalier 35 → 32 → 29 → 26 puis un mur de huit rangées au
début de Colline. Corrigé en DEUX PASSES — bâtir le motif une fois pour connaître son sommet, puis
rejouer avec la largeur que la montée réclame : `buildModule` est pur, le rejouer ne coûte que du calcul.

**Le prix de ce lot a été remboursé au tour suivant.** Les paliers ajoutés retombaient près du sol
(corniches collées 77 → 136, doubles planchers 0 → 4). Deux corrections l'ont effacé : **une rampe ne
pose plus de palier à l'altitude 1** — le sol du monde EST déjà cette surface, l'y doubler ne donne aucun
appui de plus — et les cinq derniers motifs qui plantaient leur plancher à 1 ont été relevés. Bilan final
contre l'état d'avant le lot : murs 202 → 160, marches de rampe 13 → **0**, collées 77 → 82, doubles
0 → 2.

⚠️ **LE DÉFAUT N'ÉTAIT PAS LA PENTE D'UNE RAMPE, C'ÉTAIT SON DERNIER PAS.** Deux tentatives pour
dimensionner la rampe sur son dénivelé avaient échoué (débordement de portée, puis sans effet). Supprimer
le palier qui écrase le sol fait tomber les « marches géantes » à zéro d'un coup.

**Sur la MÊME rangée, rogner un doublon n'ampute jamais rien.** Le garde-fou `LARGEUR_UTILE` (« pas de
moignon sous trois tuiles ») avait été appliqué aussi au dédoublonnage des plateformes de même altitude,
où il n'a aucun sens : ce qu'on retire de la plus courte est par construction couvert par la plus large,
au même niveau. Il laissait passer les bavures de couture entre une rampe et le motif qu'elle raccorde.

**L'assemblage s'est alourdi lot après lot, et des tests tombaient en TIMEOUT — pas sur leur verdict.**
Comblement des poches, rognage des doubles planchers, contrôle des pièges avant creusement : chaque
construction de terrain paie ce coût, et plusieurs fichiers construisent les 58 terrains puis les
parcourent. Sous exécution parallèle, certains frôlaient les 5 s par défaut de vitest. Le délai est passé
à 20 s dans `vite.config.ts` : un test instable ne protège plus rien.

**Une remise sur les dégâts se pose sur le DÉGÂT, pas sur l'attaque.** Appliquée à l'attaque, elle
passerait avant la soustraction de la défense : sur un joueur bien protégé, 10 % d'attaque en moins vaut
jusqu'à 40 % de dégât en moins, et sur un joueur nu presque rien. `degatsSubis` la pose sur le résultat,
donc elle vaut exactement 10 % pour tout le monde.

**Une corniche one-way ne rattrape jamais qui est DÉJÀ dedans.** Elle ne bloque que si les pieds
étaient au-dessus à la frame précédente — c'est ce qui empêche de se coincer contre la contremarche d'un
escalier, et ça ne se relâche pas. Mais agrippé à une échelle on TRAVERSE les corniches : on lâche donc
en étant déjà dans la tuile, la condition est fausse pour toujours, et on marche au travers. La
correction se fait à l'INSTANT du lâcher (`releveApresEchelle`, pure et testée), pas dans la règle de
collision.

**On ne fabrique pas du vide en le dessinant — QUATRIÈME fois dans `core/vide.ts`.** Le perçage de la
corniche au croisement d'une échelle existait « pour que le passage se voie ». Mais un trou dans le
décor est un trou dans la COLLISION : marcher dessus, c'était tomber, même sans être agrippé, même quand
l'échelle monte. Et il ne servait à rien — agrippé, les corniches de terre ne bloquent déjà plus
(`landsFromAbove`). Retiré, fonction supprimée, leçon gardée dans le fichier.

**Corollaire : une corniche traversée par une échelle ne doit JAMAIS être `ancree` ni `solid`.**
`landsFromAbove` ne s'applique qu'au groupe one-way ; la collision pleine bloquerait le grimpeur en
chemin. 487 corniches sont traversées dans le jeu, et `relief-jouable` exige qu'aucune ne bloque.

**`solid` VEUT DIRE « PIERRE », PAS « INFRANCHISSABLE » — et les confondre repeint la moitié du jeu.**
Il change la TEXTURE (maçonnerie) autant que la collision. Pour rendre une terre infranchissable sans
la transformer en roche, il a fallu une troisième matière : `ancree`. Une plateforme de terre est
traversable par le bas quand elle FLOTTE (c'est tout son intérêt) ; posée sur de la pierre ou sur le
sol, il n'y a rien dessous d'où sauter, et la traversée se retourne contre le joueur.

**Un socle survit à sa coiffe si on ne le surveille pas.** Les passes qui retirent une plateforme
(doublon avec le sol, rognage de double plancher) laissaient debout le socle de pierre posé pour la
porter : des colonnes de roche nues montant du sol au ciel. 66 cas. Le garde-fou ne juge QUE les dalles
qui descendent jusqu'au sol — un plafond de grotte ou une coiffe d'échelle suspendue a le droit de
n'avoir rien au-dessus.

**Les clés d'objet en double ne sont vues que par `tsc`.** JS garde la dernière. Vérifié sur
`SPECIAL_WATER_LEVELS`, `SPECIAL_FORCED`, `CATALOG`.

**Mesurer les performances avec RAF, c'est mesurer le vsync.** Pour un vrai chiffre :
`game.loop.sleep()` puis `game.step()` à la main.

**Le cadrage** : `Scale.NONE` + ajustement manuel depuis `visualViewport`. Ne jamais centrer avec
`centerCamera` (il scrolle de `-BLEED_X`) : passer par `fromLeft` / `fromRight` de `src/core/viewport.ts`.

---

## Sauvegarde — la partie la plus réparée du jeu

**Six** pertes de sauvegarde successives, **toutes avec une suite de tests verte**. Les fonctions pures
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
7. **Le nom EXACT vaut aussi pour le document trouvé À LA CLÉ.** `memeJoueur` n'était appliqué qu'au
   balayage de repli : un document rangé à la bonne clé mais portant le nom d'un autre était rendu les
   yeux fermés. C'est la sixième perte (4 août) — et son seul correctif a suffi à rendre la partie.
8. **Une poussée automatique en attente appartient à l'identité qui l'a demandée.** Changer de pseudo
   l'annule, et la clé s'arme AVANT la première sauvegarde. Sans ces deux gestes, la première
   sauvegarde d'une partie neuve part sous le pseudo du joueur précédent, trois secondes plus tard.
9. **Ce qui est PRÉ-REMPLI peut être validé par erreur** : on n'y met jamais le nom d'une partie qui
   existe. « Nouvelle partie » ne propose qu'une SUGGESTION en gris, libre par construction.

La décision de reprise vit dans `src/core/reprise.ts`, pur et testé sur la matrice complète.

---

## Historique des lots

| Build | Ce qui a changé |
|---|---|
| R352 | **journal de quêtes** (bandeau permanent et cliquable, notif qui dit où aller) · `grotte-u-brisable` : l'échelle montait DANS son propre pan fragile — piège sans retour · 41 corniches collées au sol du monde retirées |
| R351 | **`sol-fragile` était injouable** : son échelle de remontée débouchait sous la dalle cassable (qu'on ne peut pas frapper depuis une échelle) · trous redondants nettoyés · le bandeau de quête nomme la ville où rendre la récompense |
| R350 | **doubles planchers à ZÉRO** : `sol-fragile` posait le palier de son échelle une rangée au-dessus du chemin · une colonne d'échelle est enfin un passage vertical pour `sealedVoids` · coutures entre modules MESURÉES : aucune n'est infranchissable |
| R349 | **les trois dettes de relief traitées** : sol retiré sous les enchaînements de sauts contournables (174 → 6) · doubles planchers rognés (60 → 15) · marches géantes de rampe (11 → 1) · resynchro des niveaux de monstres |
| R348 | **sixième perte de sauvegarde élucidée et réparée sans écriture cloud** (poussée auto armée sur le pseudo précédent · document exact rendu sans contrôle du nom · repli « panda » résiduel) · pseudo SUGGÉRÉ au lieu de pré-rempli |
| R347 | **lacs plongeables** (fond borné par l'apnée, socle de pierre dessous) · **plus une seule poche de vide close** (142 → 0) · **plus une seule échelle murée** · trois valideurs neufs, deux entrés dans la sélection de graines |
| R332 | clé = nom du joueur · mitraillette en tir continu + éventail ±15° · zone morte de caméra |
| R333 | **pierre cassable** (matière + 2 motifs + greffe sur `grotte-noyee`) · corniches de pierre nue comblées · trampoline recadré · attaques du ciel soumises à la gravité |
| R334 | `chercher()` à trois états · synchro qui ne pousse plus à l'aveugle · délai 6 s → 20 s |
| R335 | sonde de culling (mutation-testée) · persistance après reload · `load()` ne lève plus · changement de classe verrouillé |
| R336 | caméra : suivi horizontal direct (la zone morte faisait toute la largeur) |
| R337 | sous-sol sombre · texture `rock-body` · échelles percées · caméra qui rattrape l'altitude acquise |
| R338 | nom EXACT au chargement (le préfixe laissait une faute de frappe ouvrir la partie d'un autre) · ce fichier |
| R346 | **19 motifs descendants au lieu de 4** (15 inversés par miroir gauche-droite) · catalogue dédoublonné (−1027 lignes mortes) · marches géantes 91 → 40 · `strictReach` entre dans la SÉLECTION des graines |
| R345 | évolution de classe façon Pokémon · bandeau de quêtes + notif + XP · coffres fer/or enfin posés · `grotte-u-brisable` |
| R344 | superpositions 44 → 0, filtre d'affichage supprimé · puits qu'on descend en tombant · pierre cassable par le dessous |
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

## ⇦ REPRENDRE ICI (fin de session du 4 août, après les lots R347 et R348)

**0. ✅ LA SIXIÈME PERTE DE SAUVEGARDE A EU LIEU — ET ELLE EST RÉPARÉE SANS AVOIR ÉCRIT DANS LE CLOUD.**
Constat : `smoke-sauvegarde` rouge, `saves/charlychoulove` contenait « megastock, niveau 1, novice ».
Lecture de la vraie base (REST, en lecture seule) :

| document | nom inscrit dedans | niveau | écrit le |
|---|---|---|---|
| `saves/charlychoulov` | charlychoulove | **30 chasseur** | 3 août 12 h 50 |
| `saves/panda` | charlychoulove | 29 archer | 2 août 19 h 02 |
| `saves/charlychoulove` | megastock | 1 novice | **4 août 10 h 58** |
| `saves/megastock` | megastock | 3 novice | 4 août 11 h 18 |

La vraie partie n'avait jamais disparu : elle dormait sous une clé tronquée, et c'est la CLÉ du joueur
qui avait été écrasée par la partie d'un autre personnage. Trois défauts, tous corrigés :

- **la poussée automatique était armée avec le pseudo PRÉCÉDENT.** `startFresh` sauvegardait AVANT
  d'armer la nouvelle clé ; le crochet `onSaved` programmait donc une poussée à +3 s portant l'ancienne
  clé, et `setAutoPushKey` ne l'annulait pas. Trois secondes plus tard, le niveau 1 partait sur
  `saves/charlychoulove`. Corrigé des deux côtés : la clé s'arme avant la première sauvegarde, ET tout
  changement d'identité annule la poussée en attente (`tests/cloud/poussee-auto.test.ts`, mutation-testé).
- **`chercher()` faisait confiance au document trouvé à la clé exacte.** `memeJoueur` n'était appliqué
  qu'au balayage de repli, jamais atteint puisque le document existait. Il est appliqué aux deux :
  la lecture rejette le document étranger et le repli retrouve le chasseur 30. **C'est ce seul correctif
  qui a rendu la partie au joueur** — aucune écriture dans Firestore.
- **le repli « panda » survivait dans `ui/pseudo-prompt.ts`.** Il avait été supprimé de `pseudoKey` mais
  pas là : un champ vide rangeait tout le monde dans le même document (d'où `saves/panda`).

⚠️ **`saves/charlychoulove` (megastock niv 1), `saves/charlychoulov`, `saves/panda` sont toujours là.**
Rien n'a été supprimé : le repli par le nom les rend inoffensifs, et tant qu'ils existent la trace de
l'incident aussi. À nettoyer un jour, sans urgence.

**1. ✅ LE CHAMP DU PSEUDO N'EST PLUS PRÉ-REMPLI SUR « NOUVELLE PARTIE ».**
Retour joueur : « le placeholder de prénom c'est Charly12 ou charly13 selon le nombre de comptes déjà
créés, là c'est charlychoulove ». Vérifié : « charlychoulove » n'est écrit NULLE PART dans le code (les
occurrences sont des commentaires d'anciens incidents) — c'est le nom MÉMORISÉ qui est pré-rempli.
Or la clé du document EST le pseudo : valider sans réfléchir tombe donc sur la partie existante et
l'autosave l'écrase. C'est la famille de bugs qui a déjà coûté cinq sauvegardes ici.
Fait : « Continuer » pré-remplit toujours (on retape rarement son propre nom), « Nouvelle partie » ne
pré-remplit plus rien et affiche EN GRIS un nom libre (`panda13` selon le nombre de comptes connus,
`identity.suggestionPseudo`, jamais un pseudo déjà pris). Valider à vide prend la suggestion ; sans
suggestion utilisable, la saisie refuse au lieu d'inventer un nom.

**2. ✅ LE SOL SOUS LES SAUTS CONTOURNABLES EST RETIRÉ (174 chaînes → 6).** La passe n'avait jamais
été commitée — seul son ÉCHEC l'avait été. Réécrite avec les quatre causes encodées, plus une
cinquième découverte au premier essai : creuser peut fabriquer un piège sans retour là où le modèle de
mouvement ne sait pas parcourir la chaîne (carriere-1, quatorze surfaces). La passe mesure donc les
pièges AVANT de creuser et rebouche un par un si le compte monte. Historique de la tentative :
Demande : « les sauts qu'on peut éviter, tu dégages le sol en dessous » (26 enchaînements mesurés).
Quatre tentatives, quatre causes distinctes, toutes réelles :
· creuser sous TOUTE la chaîne coupe le niveau en deux (le sol retiré est la route principale) → ne
  creuser que l'INTÉRIEUR, deux colonnes pleines de chaque côté ;
· le trou dépassait la largeur d'un saut → **corrigé** : `oversizedGaps` sait maintenant qu'un gouffre
  franchi de bout en bout par une chaîne de plateformes n'est pas un gouffre ;
· la chaîne avait une brèche → tolérance de chaînage resserrée à 3 tuiles ;
· un coffre posé au sol se retrouvait au-dessus du vide → ne pas creuser sous un coffre sans altitude.
La 4e tentative avait échoué sur `plateforme-murée`, réglée en R346. Garde-fou : `tests/data/relief-jouable.test.ts`.

**3. ✅ DOUBLES PLANCHERS (60 → 15) ET MARCHES GÉANTES DE RAMPE (11 → 1).** Les deux mesures vivent
désormais dans `tests/data/relief-jouable.test.ts` avec leur tolérance et sa raison, au lieu de dormir
en chiffres périmés ici. Ce qui reste :
· **les doubles planchers sont à ZÉRO** (l'hypothèse « c'est aux coutures » était FAUSSE : la mesure a
  montré deux motifs, et eux seuls — `sol-fragile`, corrigé, et `pics-quinconce`, dont les languettes à
  +2 sont le motif même) ;
· **les coutures entre modules ont été mesurées : aucune n'est infranchissable** sur les 58 terrains.
  Le chaînage par altitude et la rampe d'accroche font leur travail — il n'y a pas de « combo qui pose
  problème » entre motifs, tous les défauts restants sont INTERNES à un motif ;
· **la marche géante restante est un arbitrage** : une cascade « au moins 4× le panda » dans un module
  étroit ne laisse pas la place d'adoucir sa berge descendante ;
· 3 motifs qui refusent le miroir (`passerelles-zigzag` : son sol est le vide, donc cul-de-sac ; les 2
  cascades : jamais tirées) · 5 motifs inventoriés dans `motifs-isoles`, dont 3 sont des artefacts du
  modèle de mesure et non des défauts.

**3 bis. NI R347 NI R349 N'ONT DEMANDÉ DE REGRAVURE, et c'est une exception qui mérite d'être motivée.**
Les trois correctifs sont des corrections de CAUSE dans l'assemblage : ils s'appliquent au plan gravé
au moment de le rejouer. `tests/data/graines.test.ts` rejoue la validation complète sur les 58 plans et
passe — les plans restent donc valides. Regraver n'aurait rien corrigé et aurait entraîné le resync des
monstres, `balance-invariant` et `shop-economy` par-dessus le marché. La règle générale ne change pas :
**on regrave dès que les plans gravés ne valident plus.** Ici, ils validaient.

**4. Prix de boutique touchés en R344/R345** (5 chapeaux + 1 bâton relevés) : les coffres de fer et d'or
enrichissent le butin, donc la règle « un chapeau rare coûte 1,5× le pécule d'arrivée » ne tenait plus.
C'est de l'équilibrage modifié sans arbitrage du joueur — à lui confirmer.

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
