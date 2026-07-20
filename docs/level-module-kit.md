# Kit de modules de niveau — Panda-Run

But : construire des niveaux variés en **collant des modules horizontalement**, gauche → droite.
On enchaîne **6 à 10 modules** par niveau (selon le terrain), dans un **ordre différent** à chaque fois
(rythme : traversée → combat → eau → détour → climax). On peut **répéter** un même module.

## Un module, c'est quoi

Un segment autonome défini par :
- **`largeur: [min, max]`** en tuiles — modulable (on tire une largeur dans l'intervalle).
- **`altEntrée` / `altSortie`** : rangée de la surface jouable au bord gauche / droit (pour l'accroche).
- **profil de surface** : comment la surface marchable évolue d'entrée à sortie.
- **fill BAS** (sous la surface) : `sol` (roche pleine) · `vide` (trou mortel) · `marine` (eau profonde en
  cuve, **noyade**) · `cascade` (eau claire **remontable, pas de noyade**).
- **fill HAUT** (au-dessus) : `air` (défaut) · `roche` (plafond/grotte) · `pics` (plafond de pics).
- **tags** : traversée / montée / combat / eau / oiseaux / détour / secret / danger / respiration.

Le générateur pose les modules bout à bout, remplit chaque colonne selon les fills, puis les validateurs
vérifient la jouabilité.

## Règles de composition (jouabilité — vérifiées par le validateur, cassent le build sinon)

- **Accroche** : `altSortie(N)` ≈ `altEntrée(N+1)` à **±1 saut simple** près (maxJumpTiles ≈ 4.08) ; sinon
  petit connecteur (marche/échelle courte).
- **≤ 3 paliers empilés** à toute colonne x (`maxStackedTiers ≤ 3`). Jamais de grande verticale.
- **Silhouette collines** : monte puis redescend (triangles/vallons), pas d'ascenseur.
- **Hauteur du monde variable**, jusqu'à ~5× l'écran (~85 tuiles) SEULEMENT si le profil le justifie.
- **Échelles ≤ 13 tuiles** (MAX_LADDER_TILES), segmentées + paliers.
- **Eau toujours en CUVE DE PIERRE** (murs de roche tout autour, jamais de bord d'eau flottant).
- **Départ** = milieu de hauteur (routes haut ET bas). **Arrivée** = altitude nettement différente.
- Tout **atteignable au saut simple de novice** depuis le spawn (reachable vert).

Légende : `▬` plateforme · `▓` vide · `✷` pics · `~` marine · `≈` cascade · `█` roche · `◆` coffre · `🐦` oiseau · `▲` monstre.

---

## A — Traversée & gaps

1. **Le gué** — plateformes au même niveau, gaps à sauter. `largeur [12–22]` · entrée=sortie · bas=`vide`, haut=`air` · traversée, danger
2. **L'escalier doux** — monte pas à pas. `[10–20]` · sortie>entrée · bas=`sol`, haut=`air` · traversée, montée
3. **Les dents de scie** — alternance légère haut/bas. `[12–20]` · entrée≈sortie · bas=`sol/vide`, haut=`air` · traversée
4. **Le grand saut** — 1 gap large ; ◆ au-delà réservé au double saut. `[8–12]` · bas=`vide`, haut=`air` · traversée, secret
5. **Le pont troué** — pont avec trous sur le vide. `[10–18]` · entrée=sortie · bas=`vide`, haut=`air` · traversée, danger
6. **Les colonnes de pierre** — sommets de piliers au-dessus d'une cuve marine (tomber=nager). `[12–20]` · bas=`marine`, haut=`air` · traversée, eau, danger
7. **Le radeau de pierres** — pas japonais sur une large cuve marine. `[14–24]` · bas=`marine`, haut=`air` · traversée, eau
8. **La crête étroite** — arête fine, vide des deux côtés, oiseaux. `[10–16]` · bas=`vide`, haut=`air` · traversée, oiseaux, danger

## B — Reliefs (collines, ≤3 paliers)

9. **La colline / vista** — sol monte vers un pic puis redescend. `[16–28]` · sortie≈entrée · bas=`sol`, haut=`air` · relief, respiration
10. **La corniche & le vide** — corniches larges sur trou mortel + oiseaux, ◆ bas optionnel. `[14–24]` · bas=`vide`, haut=`air` · relief, oiseaux, danger, secret
11. **La descente en paliers** — chute contrôlée corniche/corniche, 1 mob/palier. `[12–20]` · sortie<entrée · bas=`sol`, haut=`air` · relief, combat
12. **Les lacets courts** — montée segmentée (échelles ≤13) + paliers larges, mini-combat + vista. `[10–16]` · sortie>entrée · bas=`sol`, haut=`air` · montée, combat
13. **Les gradins** — larges marches descendantes vers une arène. `[16–26]` · sortie<entrée · bas=`sol`, haut=`air` · relief, combat
14. **Le plateau** — longue étendue plate (respiration/connecteur). `[14–30]` · entrée=sortie · bas=`sol`, haut=`air` · respiration

## C — Murs & détours

15. **Le mur par le haut** — mur de roche, on grimpe au-dessus. `[10–16]` · bas=`sol`, haut=`air` · détour, montée
16. **Le mur par le bas (eau)** — on plonge sous le mur par une cuve. `[12–18]` · bas=`marine`, haut=`roche` · détour, eau, danger
17. **Le choix (haut sec / bas mouillé)** — deux routes : haut (sec, +long, oiseaux) ou bas (cuve marine, noyade, +court, ◆). `[16–26]` · détour, choix, eau, secret
18. **La corniche en surplomb** — corniche sous un plafond de roche, vide dessous. `[12–20]` · bas=`vide`, haut=`roche` · détour, danger

## D — Eau (toujours en cuve de pierre)

19. **Le bassin d'apnée** — cuve marine profonde, ◆ au fond, remonter avant la noyade. `[10–18]` · bas=`marine`, haut=`air` · eau, secret, danger
20. **La cascade à remonter** — cascade claire qu'on remonte (courant, safe) vers une corniche secrète. `[8–14]` · sortie>entrée · bas/colonne=`cascade`, haut=`air` · eau, montée, secret
21. **Le passage immergé** — corridor sous l'eau à traverser vite (apnée), poche d'air à mi-chemin. `[14–24]` · bas=`marine`, haut=`roche` · eau, danger
22. **La double cuve** — cuve marine (plongée ◆) + cascade (remontée) côte à côte, au choix. `[16–24]` · eau, choix, secret
23. **Le rideau de cascade** — cascade claire qui masque une alcôve/◆ derrière. `[10–16]` · colonne=`cascade`, haut=`air` · eau, secret

## E — Combat & surprise

24. **L'arène** — salle plate large, grappe de monstres (beat de combat). `[16–26]` · entrée≈sortie · bas=`sol`, haut=`air` · combat
25. **L'embuscade en cuvette** — on tombe dans une cuvette, mobs convergent, sortie par échelle. `[12–20]` · bas=`sol`, haut=`air` · combat, danger
26. **La volée d'oiseaux** — plein air envahi d'oiseaux, abris épars. `[16–26]` · bas=`vide/sol`, haut=`air` · oiseaux, danger, traversée
27. **Le goulet gardé** — passage étroit gardé par un monstre élite. `[10–16]` · bas=`sol`, haut=`roche` · combat, danger

## F — Environnement

28. **La grotte** — tunnel creusé dans la roche : **roche au-dessus ET en dessous**, mobs/pics dans le boyau. `[12–20]` · bas=`roche`, haut=`roche` · relief, danger
29. **Le couloir de pics** — lits de pics au sol, sauter les intervalles. `[12–18]` · bas=`sol` (`pics` en surface), haut=`air` · danger, traversée
30. **Le balcon secret** — balcon haut optionnel (via cascade/corniches) avec ◆, se raccroche au flux. `[8–14]` · bas=`sol`, haut=`air` · secret

---

## Composer un niveau

- Tirer **6-10 modules** (répétitions autorisées), en variant les familles pour le rythme.
- Chaîner : `altSortie(N)` → `altEntrée(N+1)` (± saut simple, sinon connecteur).
- L'enveloppe des fills définit la hauteur locale du monde ; **≤3 paliers empilés** partout ; silhouette collines.
- **Spawn** dans un module d'accueil à mi-hauteur ; **PORTE de sortie** dans le dernier module, altitude ≠ départ.

Exemple (silhouette vallonnée, ~8 modules) :
`[14 Plateau spawn] → [9 Colline/vista] → [10 Corniche & vide + oiseaux] → [19 Bassin apnée ◆] →
[17 Le choix haut/bas] → [12 Lacets courts] → [28 Grotte] → [24 Arène + PORTE (altitude ≠)]`

---

## Monstres

- **Partout, pas qu'au sol** : spawns au sol ET en hauteur (`spawn.y` = rangée de la corniche), posés
  SUR la surface (jamais en l'air ni dans la roche).
- **Monstre terrestre = patrouille horizontale sûre** : il arpente sa plateforme/corniche en large, fait
  **demi-tour au BORD** (détection de vide devant : tuile devant+dessous vide → il se retourne) et contre
  les **murs**. Il **ne tombe JAMAIS** de sa corniche. (⇒ détection de rebord à ajouter dans `Enemy`.)
- **Oiseau** (nouveau) : **vole** (pas de gravité), patrouille sinus/stationnaire, **pique** vers le joueur
  puis remonte, tuable. Ignore sol/rebords. Vit dans les modules en plein air (corniche & vide, volée…).

## Tests (validateurs — cassent le build si violé)

**Jouabilité**
- `reachable` : tout (corniches, coffres, échelles, chaque monstre, la PORTE de sortie) atteignable au
  saut simple de novice DEPUIS le spawn.
- `maxStackedTiers ≤ 3` : jamais plus de 3 paliers empilés à une colonne x.
- `oversizedLadders` : aucune échelle > 13 tuiles.
- `oversizedGaps` : chaque trou mortel franchissable au saut simple.

**Cohérence (au vu du kit)**
- Toute eau est **enclose dans une cuve de pierre** (murs gauche+droit+fond) — aucun bord d'eau ouvert
  sur le vide ou l'air latéral. `marine`/`cascade` conformes à leur fill de module.
- **Accroche** : `altSortie(N)` et `altEntrée(N+1)` à ±1 saut simple (sinon connecteur présent).
- **Fill conforme** au module (grotte=roche/roche, bassin=marine en cuve, cascade=colonne cascade…).
- **Spawn** à mi-hauteur (ni collé au sol, ni au plafond) ; **sortie** à altitude ≠ départ.
- Chaque **monstre** est posé sur une surface ; un monstre terrestre dispose d'une plateforme d'au moins
  quelques tuiles pour patrouiller (pas coincé sur 1 tuile).
- La **largeur** de chaque module est dans son `[min, max]`.

---

## RÉVISION (retours user) — conventions EAU, CASCADE, TROUS

**Lac / bassin (marine, bleu marine, NOIE)**
- CUVE de pierre : parois rocheuses rigides à GAUCHE et à DROITE (on ne traverse pas latéralement).
- **FOND SOLIDE OBLIGATOIRE** : l'eau repose TOUJOURS sur une plateforme de TERRE PLEINE, sans le
  moindre espace vide en dessous (sol de base du monde OU une autre plateforme solide juste sous le
  fond de l'eau). JAMAIS d'eau qui « vole » / flotte au-dessus du vide.
- Entrée par le HAUT (plonger), on nage, coffre au fond possible.

**Cascade (bleu clair, REMONTABLE, ne noie pas)**
- **AUCUNE pierre autour** (pas de cadre rocheux, pas de parois). C'est de l'eau qui COULE, pas une cuve.
- **Effet d'écoulement VISIBLE** : le rideau défile (stries/vagues qui descendent) pour qu'on comprenne
  que ça coule et que ça se remonte.
- **Haut NON droit** : bord supérieur ondulé — petites VAGUES + REMOUS (écume qui bouge), pas une ligne
  plate.
- **Coule jusqu'en bas** : une cascade descend jusqu'au BAS DE LA CARTE, ou se jette dans un LAC à son
  pied. Elle ne s'arrête pas en l'air.
- **Mort en bas** : si on descend la cascade jusqu'au FOND DE LA CARTE (pas de lac au pied) → MORT
  (chute réelle). Si elle se jette dans un lac, on plonge dans le lac (pas de mort, mais noyade du lac
  s'applique).

**Trous mortels adjacents**
- Plusieurs trous côte à côte = les FUSIONNER en UN SEUL grand trou continu. PAS de barre/paroi
  verticale entre deux trous voisins. Bords marqués seulement aux extrémités extérieures du trou.

---

## PHASE 2 — CATALOGUE ÉTENDU + COURBE DE DIFFICULTÉ (retours user, CANONIQUE)

RÈGLE DIRECTRICE : **DIFFICULTÉ CROISSANTE** sur les 20 niveaux. Ce catalogue (≈40 motifs de l'user)
NE REMPLACE PAS la liste des 30 ci-dessus : il la COMPLÈTE. On GARDE les 30 + on ajoute ceux-ci,
dédupliqué (overlaps fusionnés) → bibliothèque totale ~50+. Le tri par tier de difficulté sert la courbe.
Chaque motif porte : **tier de difficulté D1..D5**, **tags entrée/sortie** ∈ {bas, milieu, haut}
(pour l'accroche : sortie(N) doit matcher entrée(N+1)), largeur variable réelle, et un flag ÉCHELLE si
le motif en utilise une (les échelles doivent REVENIR — elles avaient disparu).

### Règles de COMPOSITION (impératives)
- **COURBE DE DIFFICULTÉ** : le tier max autorisé monte avec la progression. Niveau 1 = D1 SEULEMENT
  (motifs simples). Puis élargir : zone1≈D1-2, zone2-3≈D2-3, zone4-5≈D3-4, zone6≈D4-5.
- **DOSAGE par niveau** : ~30% FILLERS/respiration · ~40% TRAVERSÉE+VERTICAL · ~20% RISQUE/récompense ·
  ~10% TENSION/précision. Décaler vers la tension au fil des 20 niveaux (garder ~30% filler partout
  pour respirer).
- **ANCRAGE** : sortie(N) altitude ≈ entrée(N+1) (± saut simple), sinon connecteur.
- Spawn = filler simple à mi-hauteur (aucun monstre, cf. R127). Sortie à altitude ≠.

### Fillers / respiration (D1)
F1 Ligne droite (sas plat) · F2 Marche simple · F3 Descente douce · F4 Couloir large (bassin déco
traversable) · F5 Petit pont (sur bassin peu profond) · F6 Échelle tranquille [ÉCHELLE] · F7 Balcon
(surélevé, bonus opt.) · F8 Double sol (2 étages plats reliés par échelle, même sortie) [ÉCHELLE]

### Traversée horizontale (D1–D3)
T9 L'escalier (3-4 marches) · T10 Gap grandissant (3 trous +larges) · T11 Îlots réguliers (rythme fixe)
· T12 Îlots irréguliers (rythme cassé) · T13 Trou avec filet (bassin au fond = raté→détour, pas mort)
· T14 Trou sec (D3, sans bassin) · T15 Pas japonais sur l'eau · T16 Faux plat (pics isolés à enjamber)

### Vertical / étages (D2–D4)
V17 Zigzag (plateformes alternées) · V18 Cage d'échelles (2-3 échelles + paliers) [ÉCHELLE] · V19
Échelle vs sauts (2 routes) [ÉCHELLE] · V20 Descente contrôlée (paliers + pics à l'atterrissage) ·
V21 Tour creuse (puits, plateformes en quinconce) [ÉCHELLE] · V22 Puits de chute (chute longue vers
bassin, obstacles en tombant)

### Risque / récompense (D2–D4)
R23 Chemin double (haut sûr long / bas rapide à pics) · R24 Trésor sous les pics · R25 Trésor au fond
du bassin (détour aquatique) · R26 Détour du balcon [ÉCHELLE opt.] · R27 Raccourci payant (trou qui
saute un étage, atterrissage précis) · R28 Fausse sortie (cul-de-sac visible, vrai chemin à observer)

### Tension / précision (D3–D5)
P29 Couloir de pics (plafond bas + pics sol) · P30 Échelle exposée (pics en haut, sortir du bon côté)
[ÉCHELLE] · P31 Pics en quinconce · P32 Atterrissage étroit (1 case entre 2 pics) · P33 Remontée
punitive (rater = retomber au début du pattern, pas la mort) · P34 Triple saut (3 gaps enchaînés)

### Eau / cascade (D2–D4) — respecter la RÉVISION eau/cascade ci-dessus
E35 Cascade rideau (pousse vers le bas, sauter en amont) · E36 Ascenseur inversé (descendre poussé
par la cascade dans un puits, ressortir par le bassin) · E37 Nage à contre-courant (bassin alimenté
par cascade qui dérive) · E38 Plongeon guidé (la cascade montre le point de chute sûr) · E39 Pics sous
l'eau (nager en surface, fond piégé) · E40 Sortie humide (sortie derrière une cascade, indice visuel)

NB : « échelle tranquille / cage d'échelles / échelle vs sauts / tour creuse / échelle exposée /
double sol » ⇒ les ÉCHELLES sont de nouveau des motifs de plein droit (mécanique déjà là dans Player).

---

## PHASE 2b — MOTEUR (prérequis à la refonte des 15 niveaux) — CANONIQUE

Le moteur (assembleur `level-modules.ts` + rendu `LevelScene.ts` + validateur `level-validator.ts`)
gagne quatre capacités. **APIs à connaître pour composer les niveaux qui suivent :**

### 1. Coffre TOUJOURS atteignable (bassin entrable)
- Un `bottom-chest` (coffre `props` SANS `y`, au fond de l'eau) ne se pose QUE dans un **bassin marine
  ENTRABLE** : parois de pierre, mais **trou de plongée** au-dessus (le pont a un TROU central) pour
  plonger ET ressortir. `bassin`, `tresor-bassin`, `petit-pont` respectent ça (trou central de 3 tuiles).
- Le validateur `unreachableChests` vérifie désormais l'**accès par NAGE** : un coffre en eau est
  atteignable si le bassin a une **colonne ouverte** en surface (par où plonger) ET qu'une **surface
  marchable atteignable BORDE** le bassin à son niveau. Un lac ceint de falaises ou entièrement ponté
  ⇒ **test ROUGE**. `reachable.test.ts` couvre les 19 niveaux + 3 cas de rejet synthétiques.

### 2. PLAFOND DE ROCHE — vrais tunnels fermés (`grotte`, `couloir-pics`)
- `grotte` rend maintenant un **tunnel FERMÉ** : roche pleine AU-DESSUS (plafond) ET EN DESSOUS (socle)
  de la surface marchable. Le plafond laisse un **dégagement `CAVE_CLEARANCE` (6 rangées > saut)** →
  on traverse le boyau sans se cogner. Les dalles sont **purement visuelles** (aucune collision), champ
  `LevelDef.rockBands: {x,y,w,h}` (texture du biome, depth −5). NE PAS confondre avec le plafond du
  MONDE (traversable). L'enveloppe verticale (`groundRow`) intègre les plafonds → le monde grandit pour
  les contenir.

### 3. PICS EN HAUTEUR (sur n'importe quelle corniche)
- Les pics se rendent sur **toute surface élevée** : hazard `spikes` avec `top` = rangée de la surface
  porteuse (absent → pics au sol, rétrocompat). Dégâts/overlap identiques (35).
- Nouveaux motifs (tier ≥ 3, hors zone 1) : **`faux-plat`** (pics isolés à enjamber), **`couloir-pics`**
  (plafond de roche + lits de pics), **`pics-quinconce`** (pics au sol + mini-corniches à pics),
  **`atterrissage-etroit`** (1 case entre 2 pics). Dans l'assembleur : `Piece.spikes` porte un `alt`.

### 4. DÉBUT STANDARDISÉ (bande plate)
- Le PREMIER module est TOUJOURS une **bande PLATE à un seul niveau** (aucune rampe d'amorce, aucun sol
  parallèle) : `startAlt ∈ {3,4}` (VARIABLE par niveau, joignable du sol au saut simple), spawn au
  MILIEU, socle plein dessous (mesa → un seul niveau visible), aucun monstre à `SAFE_SPAWN_TILES` (8).
  Ensuite la variété reprend. Concerne TOUS les niveaux modulaires (`buildLevelFromModules` + `composeLevel`).
