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
