export type Biome = string // clé du registre BIOMES

export interface LevelDef {
  id: string
  name: string
  biome: Biome
  widthTiles: number
  // Hauteur du monde en tuiles. Défaut 16 (comportement historique : sol rangée 14, un écran de
  // haut). Un niveau HAUT (ex. 40-52) fait scroller la caméra en vertical ; le sol reste au bas
  // (groundRow = heightTiles - 2). Tous les y (plateformes, échelles, eau…) sont comptés DEPUIS LE
  // HAUT, donc les rangées basses (proches du sol) ont un y proche de groundRow.
  heightTiles?: number
  // Point de DÉPART du joueur (tuiles ; y = rangée de la corniche sur laquelle il se pose). Absent →
  // sol, bord gauche (comportement historique). Placé en MILIEU de hauteur, il ouvre de vraies routes
  // vers le HAUT et vers le BAS depuis le départ (on n'est plus scotché à l'altitude 0).
  start?: { x: number; y: number }
  // SORTIE de fin de niveau (tuiles ; y = rangée de la corniche sous la porte). Absent → sol, bord
  // droit. Placée à une altitude NETTEMENT différente du départ (plus haut ou plus bas).
  exit?: { x: number; y: number }
  platforms: { x: number; y: number; w: number }[] // en tuiles ; y depuis le haut
  // x en tuiles ; y (tuiles) OPTIONNEL = rangée de la corniche sur laquelle le monstre apparaît POSÉ
  // (pas en l'air, pas dans le sol). Absent → au sol. Sert à peupler la VERTICALE (monstres en hauteur).
  spawns: { monsterId: string; x: number; y?: number }[]
  props?: { kind: string; x: number; y?: number }[] // x en tuiles ; y (tuiles) seulement pour les coffres sur plateforme
  // spikes = danger (bande au sol) ; water = plan d'eau. top = rangée de surface, h = profondeur en
  // rangées (sans top/h → ancienne bande près du sol, rétrocompat). Le champ `water` choisit la FORME
  // du plan d'eau :
  //   • absent      → nappe LIBRE héritée : aucun mur (rétrocompat exacte des niveaux non refondus).
  //   • 'basin'     → PUITS/BASSIN CONTENU : parois rocheuses RIGIDES (gauche/droite) qu'on ne
  //                   traverse pas en marchant ; on plonge par le HAUT et on nage dedans ; fond = sol
  //                   du monde (mettre h = groundRow - top) ; galets/algues/coquillages en déco de
  //                   fond (sans collision). Un coffre au fond = récompense de plongée.
  //   • 'waterfall' → CASCADE : source rocheuse visible en haut + rideau d'eau qui s'écoule (animé).
  //                   Réservée aux VRAIES chutes, jamais à un bassin.
  hazards?: { kind: 'spikes' | 'water'; x: number; w: number; top?: number; h?: number; water?: 'basin' | 'waterfall' }[]
  bridges?: { x: number; y: number; w: number }[] // ponts de planches (plateformes fines)
  // trous MORTELS dans le sol : à ces emplacements (x en tuiles, largeur w en tuiles) on ne
  // dessine PAS les rangées de sol pleines (groundRow/+1) → c'est le vide. Tomber dedans = mort.
  // Chaque trou doit rester FRANCHISSABLE au saut simple (w ≤ distance de saut confortable,
  // vérifié par level-validator.oversizedGaps / reachable.test.ts).
  gaps?: { x: number; w: number }[]
  ladders?: { x: number; y: number; h: number }[] // échelles (x tuile, y tuile du haut, hauteur en tuiles)
  checkpoints?: { x: number }[] // drapeaux de réapparition (x en tuiles)
  boss?: string
}

const plat = (x: number, y: number, w: number) => ({ x, y, w })
const prop = (kind: string, x: number, y?: number) => ({ kind, x, y })
const ladder = (x: number, y: number, h: number) => ({ x, y, h })
const gap = (x: number, w: number) => ({ x, w })

// ─── Constructeurs de terrain vertical (correct-par-construction pour reachable.test) ───────
// Escalier de marches. dir=+1 : monte quand x croît ; dir=-1 : descend quand x croît. Chaque marche
// = un palier de largeur w ; écart vertical stepUp (≤3 → toujours au saut simple), écart horizontal
// stepX-w (≤3 → atteignable). Reproduit le motif d'escalier déjà validé des anciens niveaux.
const stair = (x0: number, yStart: number, count: number, o: { w?: number; stepX?: number; stepUp?: number; dir?: 1 | -1 } = {}) => {
  const { w = 5, stepX = 7, stepUp = 3, dir = 1 } = o
  return Array.from({ length: count }, (_, i) => plat(x0 + i * stepX, yStart - i * stepUp * dir, w))
}
// TOUR D'ÉCHELLES SEGMENTÉE en lacets (correct-par-construction pour reachable.test) : grimpe une
// falaise depuis baseRow (rangée où repose le PIED de la 1re échelle — le sol du monde, ou un palier
// déjà atteignable). Chaque étage = UNE échelle COURTE (h ≤ MAX_LADDER_TILES) + un PALIER LARGE (w~10)
// posé 2 rangées SOUS son sommet (règle du décalage pieds↔centre, cf. level-validator). L'échelle de
// l'étage suivant part de l'AUTRE bout du palier (décalage dx) → on SORT de l'échelle, on MARCHE sur
// une vraie corniche, puis on reprend l'échelle suivante : fini l'échelle interminable. Monte de
// (h-2) rangées par étage. Renvoie échelles + paliers (dont `landings` pour y poser départ/sortie/
// monstres) + le palier de sommet (row/x/w) pour chaîner un escalier ou poser un coffre.
const tower = (lx: number, baseRow: number, stages: number, o: { h?: number; w?: number; dx?: number } = {}) => {
  const { h = 11, w = 10, dx = 7 } = o
  const platforms: { x: number; y: number; w: number }[] = []
  const ladders: { x: number; y: number; h: number }[] = []
  const landings: { x: number; y: number; w: number }[] = []
  let base = baseRow
  let x = lx
  let dir: 1 | -1 = 1
  for (let i = 0; i < stages; i++) {
    const T = base - h // rangée du haut du montant
    ladders.push(ladder(x, T, h))
    const nextX = x + dir * dx // prochaine échelle à l'AUTRE bout du palier → on marche pour la rejoindre
    const left = Math.min(x, nextX) - 1
    const pw = Math.max(w, Math.abs(nextX - x) + 3) // palier LARGE couvrant les deux montants
    const pal = plat(left, T + 2, pw) // palier 2 rangées sous le sommet (atteignable, décalage pieds)
    platforms.push(pal)
    landings.push(pal)
    base = T + 2 // le pied de l'échelle suivante repose sur ce palier
    x = nextX
    dir = dir === 1 ? -1 : 1
  }
  const top = landings[landings.length - 1]!
  return { platforms, ladders, landings, topRow: top.y, topX: top.x, topW: top.w }
}
// BASSIN CONTENU traversé par un pont. Parois rigides gérées côté moteur (water:'basin') : le sol du
// monde fait le FOND (top = gRow - depth). Un pont en DEUX segments (trou central de 2 tuiles) passe
// juste au-dessus de la surface → on marche dessus, on saute le trou (≤ saut simple) OU on plonge par
// le trou pour le coffre du fond puis on remonte (remontée survivable : profondeur courte). Escalier
// d'accès depuis le sol côté gauche (le côté droit se rejoint en retombant sur le sol).
const basinCrossing = (x: number, w: number, depth: number, gRow: number) => {
  const surface = gRow - depth
  const bridgeRow = surface - 1
  const holeL = x + Math.floor(w / 2) - 1 // trou central de 3 tuiles (holeL, +1, +2) : franchissable
  const hazard = { kind: 'water' as const, x, w, top: surface, h: depth, water: 'basin' as const } //   au saut ET assez large pour plonger confortablement par le dessus
  const bridges = [
    { x: x - 1, y: bridgeRow, w: holeL - (x - 1) }, // segment gauche : du mur gauche au trou
    { x: holeL + 3, y: bridgeRow, w: (x + w) - (holeL + 3) + 1 }, // segment droit : du trou au mur droit
  ].filter((b) => b.w > 0)
  // escalier d'accès gauche : du sol jusqu'au niveau du pont, marche de sommet adjacente au pont.
  // écart horizontal 2 tuiles (spacing 6, largeur 4) pour rester atteignable à +3 rangées de saut.
  const steps = Math.max(1, Math.ceil(depth / 3))
  const stairs = Array.from({ length: steps }, (_, i) => plat(x - 2 - (steps - 1 - i) * 6, bridgeRow + (steps - 1 - i) * 3, 4))
  const chest = prop('coffre', x + Math.floor(w / 2)) // au FOND (plancher = sol), sous le trou
  return { hazard, bridges, platforms: stairs, chest }
}

// RÈGLES DE VERTICALITÉ (toutes vérifiées par level-validator.ts, saut SIMPLE) :
// - saut max ≈ 4 tuiles de haut ; le SOL couvre toute la largeur (écart horizontal = 0 vers
//   n'importe quelle plateforme), donc toute plateforme à la rangée ≥ groundRow-4 est atteignable du sol.
// - pour MONTER plus haut on enchaîne des paliers : +4 ou +3 rangées → écart ≤ 2 tuiles ; +2/+1
//   ou même rangée → écart ≤ 3 ; en DESCENDANT → écart ≤ 4.
// - échelle : hauteur ≥ 9 tuiles, pied au sol (l.y + h ≥ groundRow) ou sur une plateforme, palier
//   de sommet posé 1 à 2 rangées SOUS le haut du montant (l.y+1..l.y+2) et adjacent horizontalement.
// Chaque niveau normal est LARGE (terrain long à explorer) ET HAUT (caméra verticale), avec un
// PROFIL DISTINCT (nb d'étages, position des échelles, alternance haut/bas, pics/eau) : escalier,
// buttes, tour d'échelle, vallée, zigzag, colonnes, cimes, vagues…

// ─── Zone 1 refondue (PHASE 1) : mondes HAUTS (~8× le viewport) et LARGES (~2×), verticale REMPLIE
// de bas en haut par des falaises à échelles (tower), des crêtes descendantes (stair dir:-1) et des
// bassins d'eau CONTENUS (basinCrossing : parois rigides + pont à trou + coffre au fond) reliés au
// sol. Chaque plan d'eau est soit un bassin contenu, soit une cascade à source — plus jamais de
// colonne d'eau nue. Toute plateforme/échelle/coffre reste atteignable au saut simple (reachable.test).

// zone1-1 : PRAIRIE — falaise gauche à échelles SEGMENTÉES (paliers larges), crête descendante peuplée
// de monstres, 2e falaise à droite, bassin de vallée contenu (coffre au fond), cascade sur le flanc
// gauche. DÉPART à mi-hauteur sur un palier de la falaise (routes haut+bas) ; SORTIE tout en HAUT.
function mkZone11(): LevelDef {
  const gRow = 118
  const t1 = tower(14, gRow, 11) // falaise gauche : sol → cime (row 19), paliers larges tous les 9 rangs
  const crest = stair(t1.topX + t1.topW - 2, t1.topRow + 1, 8, { dir: -1, w: 8, stepX: 10, stepUp: 3 }) // crête large descendante depuis la cime
  const t2 = tower(150, gRow, 9) // 2e falaise droite (cime row 37)
  const basin = basinCrossing(118, 12, 5, gRow) // bassin de vallée + pont + coffre au fond
  return {
    id: 'zone1-1', name: 'Prairie de Prontera', biome: 'plaine', widthTiles: 175, heightTiles: 120,
    start: { x: 17, y: 64 }, // mi-hauteur, sur un palier de la falaise gauche
    exit: { x: 16, y: t1.topRow }, // tout en haut de la falaise (altitude très différente du départ)
    platforms: [...t1.platforms, ...crest, ...t2.platforms, ...basin.platforms],
    ladders: [...t1.ladders, ...t2.ladders],
    bridges: [...basin.bridges],
    hazards: [basin.hazard, { kind: 'water', x: 8, w: 3, top: 16, h: 54, water: 'waterfall' }, { kind: 'spikes', x: 100, w: 3 }],
    gaps: [gap(165, 2)],
    props: [prop('coffre', 151, 36), prop('coffre', 91, 40), basin.chest, prop('herbe', 30), prop('champignon', 78), prop('herbe', 158)],
    spawns: [
      { monsterId: 'gloopy', x: 8 }, { monsterId: 'angeling', x: 30 }, { monsterId: 'fabre', x: 48 }, { monsterId: 'gloopy', x: 100 }, { monsterId: 'gloopy', x: 145 },
      // monstres EN HAUTEUR (posés sur les corniches) : crête + paliers de falaise
      { monsterId: 'mandragore', x: 25, y: 20 }, { monsterId: 'fabre', x: 45, y: 26 }, { monsterId: 'angeling', x: 75, y: 35 }, { monsterId: 'gloopy', x: 88, y: 38 },
      { monsterId: 'mandragore', x: 17, y: 28 }, { monsterId: 'poring-dore', x: 153, y: 37 },
    ],
    checkpoints: [{ x: 30 }, { x: 100 }, { x: 150 }],
  }
}

// zone1-2 : CHAMPS — falaise gauche à échelles segmentées → longue crête large descendante peuplée,
// 2e falaise droite, DEUX bassins contenus (coffres au fond), cascade médiane. DÉPART à mi-hauteur ;
// SORTIE tout en BAS au sol, bord droit (altitude très différente).
function mkZone12(): LevelDef {
  const gRow = 122
  const t1 = tower(14, gRow, 12) // falaise gauche → cime (row 14)
  const crest = stair(t1.topX + t1.topW - 2, t1.topRow + 1, 14, { dir: -1, w: 8, stepX: 10, stepUp: 3 }) // crête large row15→54
  const t2 = tower(185, gRow, 10) // falaise droite (cime row 32)
  const basinA = basinCrossing(90, 12, 5, gRow)
  const basinB = basinCrossing(235, 12, 5, gRow)
  return {
    id: 'zone1-2', name: 'Champs fleuris', biome: 'plaine', widthTiles: 300, heightTiles: 124,
    start: { x: 17, y: 68 }, // mi-hauteur sur la falaise gauche
    exit: { x: 295, y: gRow }, // tout en bas, au sol (le départ est bien plus haut)
    platforms: [...t1.platforms, ...crest, ...t2.platforms, ...basinA.platforms, ...basinB.platforms],
    ladders: [...t1.ladders, ...t2.ladders],
    bridges: [...basinA.bridges, ...basinB.bridges],
    hazards: [basinA.hazard, basinB.hazard, { kind: 'water', x: 160, w: 3, top: 12, h: 58, water: 'waterfall' }, { kind: 'spikes', x: 120, w: 3 }, { kind: 'spikes', x: 265, w: 3 }],
    gaps: [gap(150, 2), gap(285, 2)],
    props: [prop('coffre', 186, 31), prop('coffre', 153, 53), basinA.chest, prop('herbe', 40), prop('champignon', 130), prop('herbe', 270)],
    spawns: [
      { monsterId: 'gloopy', x: 10 }, { monsterId: 'mandragore', x: 30 }, { monsterId: 'lunatic', x: 55 }, { monsterId: 'gloopy', x: 110 }, { monsterId: 'louveteau', x: 180 }, { monsterId: 'gloopy', x: 255 }, { monsterId: 'mandragore', x: 275 }, { monsterId: 'gloopy', x: 295 },
      // monstres EN HAUTEUR : le long de la crête + paliers de falaise
      { monsterId: 'mandragore', x: 24, y: 15 }, { monsterId: 'gloopy', x: 64, y: 27 }, { monsterId: 'louveteau', x: 104, y: 39 }, { monsterId: 'lunatic', x: 144, y: 51 },
      { monsterId: 'mandragore', x: 17, y: 32 }, { monsterId: 'louveteau', x: 188, y: 32 },
    ],
    checkpoints: [{ x: 40 }, { x: 130 }, { x: 250 }],
  }
}

// zone1-3 : ORÉE — deux falaises à échelles segmentées reliées par une longue crête large peuplée,
// deux bassins contenus, cascade. DÉPART à mi-hauteur sur la falaise gauche ; SORTIE tout en HAUT de
// la falaise droite (altitude très différente).
function mkZone13(): LevelDef {
  const gRow = 126
  const t1 = tower(14, gRow, 12) // falaise gauche (cime row 18)
  const t2 = tower(150, gRow, 12) // falaise droite (cime row 18)
  const crest = stair(t1.topX + t1.topW - 2, t1.topRow + 1, 12, { dir: -1, w: 8, stepX: 10, stepUp: 3 }) // crête large row19→52
  const basinA = basinCrossing(100, 12, 5, gRow)
  const basinB = basinCrossing(210, 12, 5, gRow)
  return {
    id: 'zone1-3', name: 'Orée de la forêt', biome: 'foret', widthTiles: 300, heightTiles: 128,
    start: { x: 17, y: 72 }, // mi-hauteur sur la falaise gauche
    exit: { x: 153, y: t2.topRow }, // tout en haut de la falaise droite
    platforms: [...t1.platforms, ...t2.platforms, ...crest, ...basinA.platforms, ...basinB.platforms],
    ladders: [...t1.ladders, ...t2.ladders],
    bridges: [...basinA.bridges, ...basinB.bridges],
    hazards: [basinA.hazard, basinB.hazard, { kind: 'water', x: 232, w: 3, top: 14, h: 56, water: 'waterfall' }, { kind: 'spikes', x: 130, w: 3 }, { kind: 'spikes', x: 270, w: 3 }],
    props: [prop('coffre', 15, 17), prop('coffre', 133, 51), basinA.chest, prop('herbe', 45), prop('champignon', 120), prop('herbe', 260)],
    spawns: [
      { monsterId: 'louveteau', x: 10 }, { monsterId: 'gardien-sylve', x: 35 }, { monsterId: 'mandragore', x: 55 }, { monsterId: 'louveteau', x: 85 }, { monsterId: 'poporing', x: 160 }, { monsterId: 'mandragore', x: 190 }, { monsterId: 'louveteau', x: 290 },
      // monstres EN HAUTEUR : crête + paliers des deux falaises
      { monsterId: 'poporing', x: 24, y: 19 }, { monsterId: 'louveteau', x: 64, y: 31 }, { monsterId: 'mandragore', x: 104, y: 43 },
      { monsterId: 'louveteau', x: 17, y: 36 }, { monsterId: 'poporing', x: 153, y: 36 },
    ],
    checkpoints: [{ x: 40 }, { x: 120 }, { x: 245 }],
  }
}

// zone1-4 : FORÊT PROFONDE — VALLÉE : falaise gauche à échelles segmentées → longue crête large
// peuplée, GRAND bassin central contenu et profond (coffre au fond), 2e falaise droite, second bassin,
// grande cascade. DÉPART à mi-hauteur sur la falaise gauche ; SORTIE tout en HAUT (altitude différente).
function mkZone14(): LevelDef {
  const gRow = 120
  const t1 = tower(14, gRow, 11) // falaise gauche (cime row 21)
  const crest = stair(t1.topX + t1.topW - 2, t1.topRow + 1, 14, { dir: -1, w: 8, stepX: 10, stepUp: 3 }) // crête large row22→61
  const t2 = tower(200, gRow, 10) // falaise droite (cime row 30)
  const basinBig = basinCrossing(110, 16, 6, gRow) // grand bassin de vallée profond
  const basinB = basinCrossing(260, 12, 5, gRow)
  return {
    id: 'zone1-4', name: 'Forêt profonde', biome: 'foret', widthTiles: 320, heightTiles: 122,
    start: { x: 17, y: 66 }, // mi-hauteur sur la falaise gauche
    exit: { x: 16, y: t1.topRow }, // tout en haut de la falaise gauche
    platforms: [...t1.platforms, ...crest, ...t2.platforms, ...basinBig.platforms, ...basinB.platforms],
    ladders: [...t1.ladders, ...t2.ladders],
    bridges: [...basinBig.bridges, ...basinB.bridges],
    hazards: [basinBig.hazard, basinB.hazard, { kind: 'water', x: 140, w: 4, top: 18, h: 90, water: 'waterfall' }, { kind: 'spikes', x: 75, w: 3 }, { kind: 'spikes', x: 295, w: 3 }],
    gaps: [gap(185, 2)],
    props: [prop('coffre', 201, 29), prop('coffre', 153, 60), basinBig.chest, prop('herbe', 40), prop('champignon', 175), prop('herbe', 305)],
    spawns: [
      { monsterId: 'louveteau', x: 10 }, { monsterId: 'willow', x: 35 }, { monsterId: 'mandragore', x: 45 }, { monsterId: 'louveteau', x: 90 }, { monsterId: 'rocker', x: 165 }, { monsterId: 'mandragore', x: 230 }, { monsterId: 'louveteau', x: 300 },
      // monstres EN HAUTEUR : crête + paliers des deux falaises
      { monsterId: 'rocker', x: 24, y: 22 }, { monsterId: 'willow', x: 64, y: 34 }, { monsterId: 'mandragore', x: 104, y: 46 }, { monsterId: 'louveteau', x: 134, y: 55 },
      { monsterId: 'louveteau', x: 17, y: 39 }, { monsterId: 'rocker', x: 203, y: 30 },
    ],
    checkpoints: [{ x: 40 }, { x: 135 }, { x: 270 }],
  }
}

const list: LevelDef[] = [
  mkZone11(),
  mkZone12(),
  mkZone13(),
  mkZone14(),
  { id: 'zone1-boss', name: 'Antre du Roi Gloopy', biome: 'foret', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'roi-gloopy' },
  // zone2-1 : DÉSERT — ZIGZAG TRÈS HAUT (50 rangées, sol row48, w160). Longue ascension gauche en
  // sept paliers → échelle-sommet, deux oasis profondes à ponts, escalier central → échelle-sommet,
  // escalier de sortie. Pics au sol. Ascension la plus longue de la zone 2.
  { id: 'zone2-1', name: 'Dunes de Sograt', biome: 'desert', widthTiles: 160, heightTiles: 50,
    platforms: [
      plat(14, 45, 5), plat(21, 42, 5), plat(28, 39, 5), plat(35, 36, 5), plat(42, 33, 5), plat(49, 30, 5), plat(56, 27, 5), plat(57, 18, 5),
      plat(88, 45, 4), plat(94, 42, 4), plat(100, 39, 4), plat(106, 36, 4), plat(106, 27, 4),
      plat(140, 45, 4), plat(146, 42, 4), plat(152, 39, 4)],
    spawns: [{ monsterId: 'scorpion', x: 18 }, { monsterId: 'orc-seigneur', x: 38 }, { monsterId: 'scorpion', x: 50 }, { monsterId: 'vautour', x: 62 }, { monsterId: 'orc-guerrier', x: 74 }, { monsterId: 'scorpion', x: 88 }, { monsterId: 'vautour', x: 100 }, { monsterId: 'orc-guerrier', x: 112 }, { monsterId: 'scorpion', x: 124 }, { monsterId: 'orc-seigneur', x: 136 }, { monsterId: 'vautour', x: 148 }, { monsterId: 'scorpion', x: 156 }],
    props: [prop('roche', 30), prop('herbe', 84), prop('roche', 155), prop('coffre', 59, 17), prop('coffre', 108, 26), prop('coffre', 148, 41)],
    hazards: [{ kind: 'water', x: 66, w: 14, top: 30, h: 18 }, { kind: 'spikes', x: 62, w: 4 }, { kind: 'water', x: 120, w: 12, top: 32, h: 16 }, { kind: 'spikes', x: 134, w: 4 }],
    bridges: [{ x: 65, y: 32, w: 16 }],
    ladders: [ladder(59, 16, 11), ladder(108, 25, 11)],
    checkpoints: [{ x: 40 }, { x: 90 }, { x: 145 }] },
  // zone2-2 : MONDE HAUT DÉMO (46 rangées, sol row44). Ascension d'oasis à gauche (row41→29) →
  // échelle vers le sommet (row21) → vaste OASIS profonde au centre (nage) franchie par un pont →
  // remontée droite en paliers, pic au sol. Deux checkpoints.
  { id: 'zone2-2', name: 'Oasis perdue', biome: 'desert', widthTiles: 110, heightTiles: 46,
    platforms: [
      plat(10, 41, 5), plat(17, 38, 5), plat(24, 35, 5), plat(31, 32, 5), plat(38, 29, 5),
      plat(39, 21, 5),
      plat(66, 41, 5), plat(73, 38, 5), plat(80, 35, 5), plat(90, 40, 5), plat(97, 37, 5)],
    spawns: [{ monsterId: 'scorpion', x: 14 }, { monsterId: 'gardien-pierre', x: 27 }, { monsterId: 'momie', x: 40 }, { monsterId: 'vautour', x: 68 }, { monsterId: 'momie', x: 80 }, { monsterId: 'scorpion', x: 100 }],
    props: [prop('roche', 6), prop('herbe', 70), prop('roche', 105), prop('coffre', 12), prop('coffre', 40, 20), prop('coffre', 81, 34)],
    hazards: [{ kind: 'water', x: 48, w: 15, top: 22, h: 23 }, { kind: 'spikes', x: 84, w: 4 }],
    bridges: [{ x: 48, y: 30, w: 14 }],
    gaps: [gap(102, 3)],
    ladders: [ladder(41, 19, 10)],
    checkpoints: [{ x: 30 }, { x: 75 }] },
  // zone2-3 : DÉSERT — FOSSE puis PIC (44 rangées, sol row42, w170). Départ dans une fosse basse
  // (plateformes rases + eau + pics), longue montée centrale → échelle-sommet, second bassin,
  // escalier à échelle vers un pic, sortie basse. Deux sommets et trois pics.
  { id: 'zone2-3', name: 'Vallée des tombeaux', biome: 'desert', widthTiles: 170, heightTiles: 44,
    platforms: [
      plat(16, 39, 5), plat(24, 39, 5),
      plat(48, 39, 5), plat(55, 36, 5), plat(62, 33, 5), plat(69, 30, 5), plat(76, 27, 5), plat(77, 18, 5),
      plat(112, 39, 4), plat(118, 36, 4), plat(124, 33, 4), plat(130, 30, 4), plat(130, 21, 4),
      plat(150, 39, 5), plat(158, 39, 4)],
    spawns: [{ monsterId: 'momie', x: 14 }, { monsterId: 'vautour', x: 30 }, { monsterId: 'zombie', x: 48 }, { monsterId: 'momie', x: 62 }, { monsterId: 'vautour', x: 76 }, { monsterId: 'zombie', x: 90 }, { monsterId: 'mini-baphomet', x: 105 }, { monsterId: 'vautour', x: 118 }, { monsterId: 'momie', x: 132 }, { monsterId: 'zombie', x: 146 }, { monsterId: 'vautour', x: 158 }],
    props: [prop('roche', 40), prop('herbe', 88), prop('roche', 150), prop('coffre', 79, 17), prop('coffre', 132, 20), prop('coffre', 57, 35)],
    hazards: [{ kind: 'water', x: 30, w: 12, top: 28, h: 14 }, { kind: 'spikes', x: 18, w: 4 }, { kind: 'spikes', x: 44, w: 4 }, { kind: 'water', x: 92, w: 12, top: 28, h: 14 }, { kind: 'spikes', x: 106, w: 4 }],
    bridges: [{ x: 29, y: 30, w: 14 }],
    ladders: [ladder(79, 16, 11), ladder(132, 19, 11)],
    checkpoints: [{ x: 44 }, { x: 90 }, { x: 145 }] },
  // cave-1 : CAVE PROFONDE (52 rangées, sol row50, w165) — le monde le plus profond. Tour de deux
  // échelles à gauche montant à une corniche haute (row17), immense LAC souterrain central franchi
  // par un long pont, escalier à échelle au centre, second plan d'eau, escalier de sortie.
  { id: 'cave-1', name: 'Cave aux échos', biome: 'cave', widthTiles: 165, heightTiles: 52,
    platforms: [
      plat(12, 47, 5), plat(19, 44, 5), plat(26, 41, 5), plat(33, 38, 5), plat(40, 35, 5), plat(41, 26, 5), plat(42, 17, 5),
      plat(80, 47, 5), plat(87, 44, 5), plat(94, 41, 5), plat(101, 38, 5), plat(102, 29, 5),
      plat(138, 47, 4), plat(144, 44, 4), plat(150, 41, 4), plat(156, 38, 4)],
    spawns: [{ monsterId: 'chauve-souris', x: 14 }, { monsterId: 'squelette', x: 30 }, { monsterId: 'fantome', x: 44 }, { monsterId: 'mage-noir', x: 55 }, { monsterId: 'chauve-souris', x: 70 }, { monsterId: 'squelette', x: 82 }, { monsterId: 'fantome', x: 94 }, { monsterId: 'mage-noir', x: 108 }, { monsterId: 'chauve-souris', x: 122 }, { monsterId: 'squelette', x: 136 }, { monsterId: 'fantome', x: 150 }, { monsterId: 'chauve-souris', x: 160 }],
    props: [prop('roche', 30), prop('champignon', 86), prop('roche', 150), prop('coffre', 44, 16), prop('coffre', 104, 28), prop('coffre', 152, 40)],
    hazards: [{ kind: 'water', x: 54, w: 18, top: 26, h: 24 }, { kind: 'spikes', x: 74, w: 4 }, { kind: 'water', x: 118, w: 12, top: 34, h: 16 }, { kind: 'spikes', x: 112, w: 4 }, { kind: 'spikes', x: 132, w: 4 }],
    bridges: [{ x: 53, y: 28, w: 20 }],
    ladders: [ladder(43, 24, 11), ladder(44, 15, 11), ladder(104, 27, 11)],
    checkpoints: [{ x: 45 }, { x: 90 }, { x: 145 }] },
  { id: 'zone2-boss', name: 'Pyramide du Pharaon', biome: 'desert', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'pharaon-scarabee' },
  // Zone 3 — jungle (+ route alternative plage)
  // zone3-1 : JUNGLE — CANOPÉE (48 rangées, sol row46, w200). Trois escaliers de canopée montant à
  // des cimes par échelle, séparés par une GRANDE rivière et un second plan d'eau à ponts. Très long.
  { id: 'zone3-1', name: 'Lisière de la jungle', biome: 'jungle', widthTiles: 200, heightTiles: 48,
    platforms: [
      plat(12, 43, 5), plat(19, 40, 5), plat(26, 37, 5), plat(33, 34, 5), plat(40, 31, 5), plat(41, 22, 5),
      plat(80, 43, 5), plat(87, 40, 5), plat(94, 37, 5), plat(101, 34, 5), plat(102, 25, 5),
      plat(142, 43, 5), plat(149, 40, 5), plat(156, 37, 5), plat(163, 34, 5), plat(164, 25, 5),
      plat(184, 43, 5), plat(192, 43, 4)],
    spawns: [{ monsterId: 'poporing', x: 10 }, { monsterId: 'frelon-geant', x: 22 }, { monsterId: 'singe-grimpeur', x: 40 }, { monsterId: 'flora-vorace', x: 52 }, { monsterId: 'gardien-sylve', x: 63 }, { monsterId: 'singe-grimpeur', x: 80 }, { monsterId: 'flora-vorace', x: 92 }, { monsterId: 'frelon-geant', x: 104 }, { monsterId: 'poporing', x: 118 }, { monsterId: 'singe-grimpeur', x: 132 }, { monsterId: 'flora-vorace', x: 146 }, { monsterId: 'frelon-geant', x: 160 }, { monsterId: 'gardien-sylve', x: 172 }, { monsterId: 'singe-grimpeur', x: 186 }, { monsterId: 'poporing', x: 196 }],
    props: [prop('champignon', 30), prop('herbe', 88), prop('champignon', 150), prop('coffre', 43, 21), prop('coffre', 104, 24), prop('coffre', 166, 24)],
    hazards: [{ kind: 'water', x: 55, w: 16, top: 26, h: 20 }, { kind: 'spikes', x: 74, w: 4 }, { kind: 'water', x: 118, w: 14, top: 30, h: 16 }, { kind: 'spikes', x: 176, w: 4 }],
    bridges: [{ x: 54, y: 28, w: 18 }],
    gaps: [gap(108, 3)],
    ladders: [ladder(43, 20, 11), ladder(104, 23, 11), ladder(166, 23, 11)],
    checkpoints: [{ x: 48 }, { x: 100 }, { x: 160 }] },
  // zone3-2 : JUNGLE — MARÉCAGE SUSPENDU (46 rangées, sol row44, w210). Quatre escaliers à
  // échelle-sommet séparés par TROIS bassins profonds à ponts. Alternance montée/plateau/nage sur
  // toute la longueur ; le plus « aquatique » de la zone.
  { id: 'zone3-2', name: 'Marécages suspendus', biome: 'jungle', widthTiles: 210, heightTiles: 46,
    platforms: [
      plat(16, 41, 4), plat(22, 38, 4), plat(28, 35, 4), plat(34, 32, 4), plat(40, 29, 4), plat(40, 20, 5),
      plat(72, 41, 4), plat(78, 38, 4), plat(84, 35, 4), plat(90, 32, 4), plat(90, 23, 4),
      plat(126, 41, 5), plat(133, 38, 5), plat(140, 35, 5), plat(141, 26, 4),
      plat(178, 41, 5), plat(185, 38, 5), plat(192, 35, 5), plat(199, 32, 5)],
    spawns: [{ monsterId: 'frelon-geant', x: 12 }, { monsterId: 'singe-grimpeur', x: 26 }, { monsterId: 'flora-vorace', x: 45 }, { monsterId: 'frelon-geant', x: 60 }, { monsterId: 'singe-grimpeur', x: 74 }, { monsterId: 'flora-vorace', x: 88 }, { monsterId: 'frelon-geant', x: 102 }, { monsterId: 'singe-grimpeur', x: 116 }, { monsterId: 'flora-vorace', x: 130 }, { monsterId: 'frelon-geant', x: 144 }, { monsterId: 'singe-grimpeur', x: 158 }, { monsterId: 'flora-vorace', x: 172 }, { monsterId: 'frelon-geant', x: 186 }, { monsterId: 'singe-grimpeur', x: 200 }],
    props: [prop('champignon', 22), prop('herbe', 100), prop('champignon', 165), prop('coffre', 42, 19), prop('coffre', 92, 22), prop('coffre', 143, 25)],
    hazards: [{ kind: 'water', x: 50, w: 12, top: 26, h: 18 }, { kind: 'spikes', x: 66, w: 4 }, { kind: 'water', x: 104, w: 12, top: 28, h: 16 }, { kind: 'spikes', x: 120, w: 4 }, { kind: 'water', x: 156, w: 12, top: 30, h: 14 }, { kind: 'spikes', x: 172, w: 4 }],
    bridges: [{ x: 49, y: 28, w: 14 }, { x: 155, y: 32, w: 14 }],
    ladders: [ladder(42, 18, 11), ladder(92, 21, 11), ladder(143, 24, 11)],
    checkpoints: [{ x: 55 }, { x: 110 }, { x: 170 }] },
  { id: 'zone3-boss', name: 'Cœur de la Jungle', biome: 'jungle', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'seigneur-liane' },
  // plage-1 : MONDE HAUT DÉMO (42 rangées, sol row40). Récifs montants à gauche (row37→25) →
  // échelle vers le sommet (row17) → grand LAGON profond au centre (nage) franchi par un pont →
  // récifs de droite en paliers, pic au sol. Deux checkpoints.
  { id: 'plage-1', name: 'Rivage de corail', biome: 'plage', widthTiles: 110, heightTiles: 42,
    platforms: [
      plat(10, 37, 5), plat(17, 34, 5), plat(24, 31, 5), plat(31, 28, 5), plat(38, 25, 5),
      plat(39, 17, 5),
      plat(68, 37, 5), plat(75, 34, 5), plat(82, 31, 5), plat(95, 36, 5), plat(102, 33, 5)],
    spawns: [{ monsterId: 'crabe-geant', x: 12 }, { monsterId: 'meduse', x: 24 }, { monsterId: 'roi-crabe', x: 36 }, { monsterId: 'crabe-geant', x: 46 }, { monsterId: 'meduse', x: 70 }, { monsterId: 'crabe-geant', x: 78 }, { monsterId: 'meduse', x: 90 }, { monsterId: 'crabe-geant', x: 100 }, { monsterId: 'meduse', x: 104 }],
    props: [prop('roche', 6), prop('herbe', 70), prop('roche', 107), prop('coffre', 12), prop('coffre', 40, 16), prop('coffre', 83, 30)],
    hazards: [{ kind: 'water', x: 48, w: 16, top: 18, h: 23 }, { kind: 'spikes', x: 88, w: 4 }],
    bridges: [{ x: 48, y: 26, w: 15 }],
    ladders: [ladder(41, 15, 10)],
    checkpoints: [{ x: 30 }, { x: 78 }] },
  // plage-2 : PLAGE — GRAND LAGON (44 rangées, sol row42, w185). Récifs en dents de scie montant à
  // des cimes par échelle, un IMMENSE lagon profond central et un second lagon à ponts. Traversées
  // à la nage entre les colonnes de corail.
  { id: 'plage-2', name: 'Récif immergé', biome: 'plage', widthTiles: 185, heightTiles: 44,
    platforms: [
      plat(14, 39, 4), plat(20, 36, 4), plat(26, 33, 4), plat(32, 30, 4), plat(38, 27, 4), plat(38, 18, 5),
      plat(76, 39, 4), plat(82, 36, 4), plat(88, 33, 4), plat(94, 30, 4), plat(94, 21, 4),
      plat(128, 39, 5), plat(135, 36, 5), plat(142, 33, 5), plat(149, 30, 5), plat(150, 21, 4),
      plat(170, 39, 5), plat(178, 39, 4)],
    spawns: [{ monsterId: 'meduse', x: 10 }, { monsterId: 'crabe-geant', x: 28 }, { monsterId: 'meduse', x: 42 }, { monsterId: 'crabe-geant', x: 60 }, { monsterId: 'meduse', x: 72 }, { monsterId: 'crabe-geant', x: 82 }, { monsterId: 'meduse', x: 94 }, { monsterId: 'crabe-geant', x: 108 }, { monsterId: 'meduse', x: 122 }, { monsterId: 'crabe-geant', x: 136 }, { monsterId: 'meduse', x: 150 }, { monsterId: 'crabe-geant', x: 164 }, { monsterId: 'meduse', x: 176 }],
    props: [prop('roche', 30), prop('herbe', 100), prop('roche', 165), prop('coffre', 40, 17), prop('coffre', 96, 20), prop('coffre', 152, 20)],
    hazards: [{ kind: 'water', x: 50, w: 18, top: 22, h: 20 }, { kind: 'spikes', x: 70, w: 4 }, { kind: 'water', x: 108, w: 12, top: 28, h: 14 }, { kind: 'spikes', x: 102, w: 4 }, { kind: 'spikes', x: 162, w: 4 }],
    bridges: [{ x: 49, y: 24, w: 20 }],
    ladders: [ladder(40, 16, 11), ladder(96, 19, 11), ladder(152, 19, 11)],
    checkpoints: [{ x: 45 }, { x: 100 }, { x: 155 }] },
  // Zone 4 — montagne (+ route alternative carrière)
  // zone4-1 : MONTAGNE — CIMES (52 rangées, sol row50, w210) — le point le plus HAUT du jeu (row11).
  // Ascension gauche de sept paliers puis deux échelles jusqu'au sommet ; escaliers centraux à
  // échelle-cime, petits lacs alpins à ponts, longue crête de sortie.
  { id: 'zone4-1', name: 'Sentier des cimes', biome: 'montagne', widthTiles: 210, heightTiles: 52,
    platforms: [
      plat(16, 47, 4), plat(22, 44, 4), plat(28, 41, 4), plat(34, 38, 4), plat(40, 35, 4), plat(46, 32, 4), plat(52, 29, 4), plat(52, 20, 4), plat(52, 11, 4),
      plat(86, 47, 4), plat(92, 44, 4), plat(98, 41, 4), plat(104, 38, 4), plat(104, 29, 4),
      plat(140, 47, 4), plat(146, 44, 4), plat(152, 41, 4), plat(158, 38, 4), plat(164, 35, 4), plat(164, 26, 4),
      plat(186, 47, 4), plat(194, 47, 4), plat(202, 47, 4)],
    spawns: [{ monsterId: 'harpie', x: 12 }, { monsterId: 'yeti', x: 28 }, { monsterId: 'harpie', x: 42 }, { monsterId: 'yeti', x: 58 }, { monsterId: 'harpie', x: 72 }, { monsterId: 'yeti', x: 88 }, { monsterId: 'harpie', x: 102 }, { monsterId: 'yeti', x: 116 }, { monsterId: 'harpie', x: 130 }, { monsterId: 'yeti', x: 144 }, { monsterId: 'harpie', x: 158 }, { monsterId: 'yeti', x: 172 }, { monsterId: 'harpie', x: 186 }, { monsterId: 'yeti', x: 200 }],
    props: [prop('roche', 30), prop('herbe', 88), prop('roche', 150), prop('coffre', 54, 10), prop('coffre', 106, 28), prop('coffre', 166, 25)],
    hazards: [{ kind: 'water', x: 64, w: 10, top: 40, h: 10 }, { kind: 'spikes', x: 78, w: 4 }, { kind: 'water', x: 118, w: 10, top: 38, h: 12 }, { kind: 'spikes', x: 112, w: 4 }, { kind: 'spikes', x: 132, w: 4 }, { kind: 'spikes', x: 178, w: 4 }],
    bridges: [{ x: 63, y: 42, w: 12 }],
    ladders: [ladder(54, 18, 11), ladder(54, 9, 11), ladder(106, 27, 11), ladder(166, 24, 11)],
    checkpoints: [{ x: 45 }, { x: 100 }, { x: 160 }] },
  // zone4-2 : MONTAGNE — COL GLACÉ (50 rangées, sol row48, w220). Nombreux PICS traîtres, quatre
  // escaliers à échelle-sommet et trois lacs gelés à ponts. Le plus « piégeux » de la zone.
  { id: 'zone4-2', name: 'Col glacé', biome: 'montagne', widthTiles: 220, heightTiles: 50,
    platforms: [
      plat(14, 45, 4), plat(20, 42, 4), plat(26, 39, 4), plat(32, 36, 4), plat(38, 33, 4), plat(38, 24, 4),
      plat(70, 45, 4), plat(76, 42, 4), plat(82, 39, 4), plat(88, 36, 4), plat(88, 27, 4),
      plat(124, 45, 5), plat(131, 42, 5), plat(138, 39, 5), plat(139, 30, 4),
      plat(176, 45, 5), plat(183, 42, 5), plat(190, 39, 5), plat(197, 36, 5), plat(210, 45, 4)],
    spawns: [{ monsterId: 'yeti', x: 10 }, { monsterId: 'harpie', x: 26 }, { monsterId: 'yeti', x: 40 }, { monsterId: 'harpie', x: 58 }, { monsterId: 'yeti', x: 72 }, { monsterId: 'harpie', x: 86 }, { monsterId: 'yeti', x: 100 }, { monsterId: 'harpie', x: 114 }, { monsterId: 'yeti', x: 128 }, { monsterId: 'harpie', x: 142 }, { monsterId: 'yeti', x: 156 }, { monsterId: 'harpie', x: 170 }, { monsterId: 'yeti', x: 184 }, { monsterId: 'harpie', x: 198 }, { monsterId: 'yeti', x: 212 }],
    props: [prop('roche', 30), prop('champignon', 100), prop('roche', 165), prop('coffre', 40, 23), prop('coffre', 90, 26), prop('coffre', 141, 29)],
    hazards: [{ kind: 'spikes', x: 44, w: 4 }, { kind: 'water', x: 48, w: 12, top: 30, h: 18 }, { kind: 'spikes', x: 64, w: 4 }, { kind: 'spikes', x: 96, w: 4 }, { kind: 'water', x: 102, w: 12, top: 34, h: 14 }, { kind: 'spikes', x: 118, w: 4 }, { kind: 'water', x: 154, w: 10, top: 38, h: 10 }, { kind: 'spikes', x: 168, w: 4 }],
    bridges: [{ x: 47, y: 32, w: 14 }, { x: 153, y: 40, w: 12 }],
    ladders: [ladder(40, 22, 11), ladder(90, 25, 11), ladder(141, 28, 11)],
    checkpoints: [{ x: 55 }, { x: 110 }, { x: 170 }] },
  { id: 'zone4-boss', name: 'Pic du Golem Ancien', biome: 'montagne', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'golem-ancien' },
  // carriere-1 : CARRIÈRE — TERRASSES (46 rangées, sol row44, w180). Terrasses d'extraction montant
  // droit à gauche → échelle-sommet, gouffre d'eau à pont, terrasses centrales → échelle-sommet,
  // second bassin, terrasses de sortie. Pics sous les montées.
  { id: 'carriere-1', name: 'Carrière abandonnée', biome: 'carriere', widthTiles: 180, heightTiles: 46,
    platforms: [
      plat(14, 41, 5), plat(21, 38, 5), plat(28, 35, 5), plat(35, 32, 5), plat(42, 29, 5), plat(49, 26, 5), plat(50, 17, 5),
      plat(88, 41, 4), plat(94, 38, 4), plat(100, 35, 4), plat(106, 32, 4), plat(106, 23, 4),
      plat(140, 41, 5), plat(147, 38, 5), plat(154, 35, 5), plat(161, 32, 5), plat(174, 41, 4)],
    spawns: [{ monsterId: 'golem-de-pierre', x: 10 }, { monsterId: 'gobelin-mineur', x: 22 }, { monsterId: 'golem-de-pierre', x: 32 }, { monsterId: 'gardien-pierre', x: 41 }, { monsterId: 'golem-de-pierre', x: 58 }, { monsterId: 'gobelin-mineur', x: 70 }, { monsterId: 'golem-de-pierre', x: 82 }, { monsterId: 'gobelin-mineur', x: 95 }, { monsterId: 'golem-de-pierre', x: 108 }, { monsterId: 'gobelin-mineur', x: 122 }, { monsterId: 'golem-de-pierre', x: 136 }, { monsterId: 'gardien-pierre', x: 150 }, { monsterId: 'gobelin-mineur', x: 164 }, { monsterId: 'golem-de-pierre', x: 176 }],
    props: [prop('roche', 30), prop('roche', 84), prop('roche', 160), prop('coffre', 52, 16), prop('coffre', 108, 22), prop('coffre', 156, 34)],
    hazards: [{ kind: 'water', x: 64, w: 14, top: 28, h: 16 }, { kind: 'spikes', x: 58, w: 4 }, { kind: 'spikes', x: 84, w: 4 }, { kind: 'water', x: 120, w: 12, top: 32, h: 12 }, { kind: 'spikes', x: 134, w: 4 }],
    bridges: [{ x: 63, y: 30, w: 16 }],
    ladders: [ladder(52, 15, 11), ladder(108, 21, 11)],
    checkpoints: [{ x: 45 }, { x: 95 }, { x: 150 }] },
  // carriere-2 : CARRIÈRE — FOSSE & TOUR (48 rangées, sol row46, w185). Tour de trois échelles à
  // gauche (escalade d'une fosse jusqu'à row16), eau de fond de fosse, escaliers centraux et droits
  // à échelle-sommet, second bassin, sortie basse.
  { id: 'carriere-2', name: 'Fosse des golems', biome: 'carriere', widthTiles: 185, heightTiles: 48,
    platforms: [
      plat(14, 43, 5), plat(16, 34, 5), plat(18, 25, 5), plat(20, 16, 5),
      plat(56, 43, 4), plat(62, 40, 4), plat(68, 37, 4), plat(74, 34, 4), plat(74, 25, 4),
      plat(108, 43, 5), plat(115, 40, 5), plat(122, 37, 5), plat(129, 34, 5), plat(130, 25, 4),
      plat(152, 43, 5), plat(160, 43, 4), plat(170, 43, 4)],
    spawns: [{ monsterId: 'gobelin-mineur', x: 10 }, { monsterId: 'golem-de-pierre', x: 26 }, { monsterId: 'gobelin-mineur', x: 40 }, { monsterId: 'golem-de-pierre', x: 55 }, { monsterId: 'gobelin-mineur', x: 70 }, { monsterId: 'golem-de-pierre', x: 80 }, { monsterId: 'gobelin-mineur', x: 92 }, { monsterId: 'golem-de-pierre', x: 105 }, { monsterId: 'gobelin-mineur', x: 118 }, { monsterId: 'golem-de-pierre', x: 132 }, { monsterId: 'gobelin-mineur', x: 146 }, { monsterId: 'golem-de-pierre', x: 160 }, { monsterId: 'gobelin-mineur', x: 174 }],
    props: [prop('roche', 40), prop('champignon', 90), prop('roche', 160), prop('coffre', 22, 15), prop('coffre', 76, 24), prop('coffre', 132, 24)],
    hazards: [{ kind: 'water', x: 34, w: 12, top: 34, h: 12 }, { kind: 'spikes', x: 48, w: 4 }, { kind: 'water', x: 88, w: 12, top: 32, h: 14 }, { kind: 'spikes', x: 102, w: 4 }, { kind: 'spikes', x: 144, w: 4 }],
    bridges: [{ x: 33, y: 36, w: 14 }],
    ladders: [ladder(18, 32, 11), ladder(20, 23, 11), ladder(22, 14, 11), ladder(76, 23, 11), ladder(132, 23, 11)],
    checkpoints: [{ x: 45 }, { x: 95 }, { x: 155 }] },
  // Zone 5 — cimetière
  // zone5-1 : CIMETIÈRE — NÉCROPOLE (46 rangées, sol row44, w210). Quatre escaliers à échelle-sommet
  // en terrasses, deux bassins à ponts, pics épars. Nécropole à étages étalée sur toute la largeur.
  { id: 'zone5-1', name: 'Nécropole oubliée', biome: 'cimetiere', widthTiles: 210, heightTiles: 46,
    platforms: [
      plat(16, 41, 4), plat(22, 38, 4), plat(28, 35, 4), plat(34, 32, 4), plat(40, 29, 4), plat(40, 20, 5),
      plat(74, 41, 4), plat(80, 38, 4), plat(86, 35, 4), plat(92, 32, 4), plat(92, 23, 4),
      plat(128, 41, 5), plat(135, 38, 5), plat(142, 35, 5), plat(143, 26, 4),
      plat(164, 41, 5), plat(171, 38, 5), plat(178, 35, 5), plat(185, 32, 5), plat(198, 41, 4)],
    spawns: [{ monsterId: 'goule', x: 10 }, { monsterId: 'banshee', x: 28 }, { monsterId: 'goule', x: 42 }, { monsterId: 'pretre-goule', x: 50 }, { monsterId: 'banshee', x: 58 }, { monsterId: 'goule', x: 72 }, { monsterId: 'spectre-ancien', x: 78 }, { monsterId: 'banshee', x: 88 }, { monsterId: 'goule', x: 102 }, { monsterId: 'banshee', x: 118 }, { monsterId: 'goule', x: 132 }, { monsterId: 'spectre-ancien', x: 146 }, { monsterId: 'banshee', x: 160 }, { monsterId: 'goule', x: 174 }, { monsterId: 'pretre-goule', x: 188 }, { monsterId: 'banshee', x: 200 }],
    props: [prop('roche', 30), prop('herbe', 100), prop('roche', 165), prop('coffre', 42, 19), prop('coffre', 94, 22), prop('coffre', 145, 25)],
    hazards: [{ kind: 'water', x: 52, w: 12, top: 26, h: 18 }, { kind: 'spikes', x: 68, w: 4 }, { kind: 'water', x: 106, w: 12, top: 28, h: 16 }, { kind: 'spikes', x: 122, w: 4 }, { kind: 'spikes', x: 158, w: 4 }],
    bridges: [{ x: 51, y: 28, w: 14 }],
    gaps: [gap(45, 3)],
    ladders: [ladder(42, 18, 11), ladder(94, 21, 11), ladder(145, 24, 11)],
    checkpoints: [{ x: 48 }, { x: 100 }, { x: 160 }] },
  // zone5-2 : CIMETIÈRE — CRYPTES (50 rangées, sol row48, w225). Flèche de crypte à gauche (deux
  // échelles jusqu'à row12), vagues de montées/descentes, escalier à échelle-sommet, TROIS bassins
  // à ponts. Motif ondulant sur toute la longueur.
  { id: 'zone5-2', name: 'Cryptes hurlantes', biome: 'cimetiere', widthTiles: 225, heightTiles: 50,
    platforms: [
      plat(14, 45, 4), plat(20, 42, 4), plat(26, 39, 4), plat(32, 36, 4), plat(38, 33, 4), plat(44, 30, 4), plat(44, 21, 5), plat(44, 12, 4),
      plat(80, 45, 4), plat(86, 42, 4), plat(92, 45, 4), plat(98, 42, 4),
      plat(128, 45, 5), plat(135, 42, 5), plat(142, 39, 5), plat(149, 36, 5), plat(150, 27, 4),
      plat(184, 45, 5), plat(191, 42, 5), plat(198, 39, 5), plat(205, 36, 5), plat(218, 45, 4)],
    spawns: [{ monsterId: 'banshee', x: 10 }, { monsterId: 'goule', x: 26 }, { monsterId: 'banshee', x: 38 }, { monsterId: 'goule', x: 55 }, { monsterId: 'banshee', x: 66 }, { monsterId: 'goule', x: 80 }, { monsterId: 'banshee', x: 92 }, { monsterId: 'goule', x: 108 }, { monsterId: 'banshee', x: 120 }, { monsterId: 'goule', x: 134 }, { monsterId: 'banshee', x: 148 }, { monsterId: 'goule', x: 162 }, { monsterId: 'banshee', x: 176 }, { monsterId: 'goule', x: 190 }, { monsterId: 'banshee', x: 204 }, { monsterId: 'goule', x: 218 }],
    props: [prop('roche', 30), prop('champignon', 100), prop('roche', 170), prop('coffre', 46, 11), prop('coffre', 152, 26), prop('coffre', 200, 38)],
    hazards: [{ kind: 'water', x: 56, w: 14, top: 28, h: 20 }, { kind: 'spikes', x: 72, w: 4 }, { kind: 'water', x: 108, w: 12, top: 32, h: 16 }, { kind: 'spikes', x: 122, w: 4 }, { kind: 'water', x: 164, w: 12, top: 34, h: 14 }, { kind: 'spikes', x: 178, w: 4 }],
    bridges: [{ x: 55, y: 30, w: 16 }, { x: 163, y: 36, w: 14 }],
    ladders: [ladder(46, 19, 11), ladder(46, 10, 11), ladder(152, 25, 11)],
    checkpoints: [{ x: 50 }, { x: 110 }, { x: 175 }] },
  { id: 'zone5-boss', name: 'Trône du Roi Liche', biome: 'cimetiere', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'roi-liche' },
  // Zone 6 — enfer (zone finale) : le niveau le plus vertical ET le plus long (52 rangées, sol
  // row50, w235). Deux sommets atteints par doubles échelles (row11 et row19), un troisième par
  // échelle simple, séparés par des rivières de feu (eau) à ponts et des fosses de lave (pics).
  { id: 'zone6-1', name: 'Sentier des Damnés', biome: 'enfer', widthTiles: 235, heightTiles: 52,
    platforms: [
      plat(16, 47, 4), plat(22, 44, 4), plat(28, 41, 4), plat(34, 38, 4), plat(40, 35, 4), plat(46, 32, 4), plat(52, 29, 4), plat(52, 20, 4), plat(52, 11, 4),
      plat(86, 47, 4), plat(92, 44, 4), plat(98, 41, 4), plat(104, 38, 4), plat(104, 28, 4), plat(104, 19, 4),
      plat(140, 47, 4), plat(146, 44, 4), plat(152, 41, 4), plat(158, 38, 4), plat(158, 29, 4),
      plat(192, 47, 4), plat(198, 44, 4), plat(204, 41, 4), plat(210, 38, 4), plat(216, 35, 4), plat(228, 47, 4)],
    spawns: [{ monsterId: 'diablotin', x: 10 }, { monsterId: 'gargouille', x: 28 }, { monsterId: 'diablotin', x: 40 }, { monsterId: 'dragon-flamme', x: 48 }, { monsterId: 'gargouille', x: 55 }, { monsterId: 'diablotin', x: 66 }, { monsterId: 'gargouille', x: 78 }, { monsterId: 'diablotin', x: 92 }, { monsterId: 'gargouille', x: 108 }, { monsterId: 'gardien-flamme', x: 127 }, { monsterId: 'gargouille', x: 135 }, { monsterId: 'diablotin', x: 148 }, { monsterId: 'gargouille', x: 162 }, { monsterId: 'diablotin', x: 176 }, { monsterId: 'dragon-flamme', x: 190 }, { monsterId: 'gargouille', x: 204 }, { monsterId: 'diablotin', x: 218 }, { monsterId: 'gargouille', x: 230 }],
    props: [prop('roche', 30), prop('champignon', 100), prop('roche', 180), prop('coffre', 54, 10), prop('coffre', 106, 18), prop('coffre', 160, 28)],
    hazards: [{ kind: 'water', x: 64, w: 12, top: 32, h: 18 }, { kind: 'spikes', x: 60, w: 4 }, { kind: 'spikes', x: 82, w: 4 }, { kind: 'water', x: 118, w: 12, top: 34, h: 16 }, { kind: 'spikes', x: 114, w: 4 }, { kind: 'spikes', x: 136, w: 4 }, { kind: 'water', x: 172, w: 12, top: 36, h: 14 }, { kind: 'spikes', x: 188, w: 4 }],
    bridges: [{ x: 63, y: 34, w: 14 }, { x: 171, y: 38, w: 14 }],
    ladders: [ladder(54, 18, 11), ladder(54, 9, 11), ladder(106, 27, 11), ladder(106, 17, 11), ladder(160, 27, 11)],
    checkpoints: [{ x: 50 }, { x: 110 }, { x: 175 }] },
  { id: 'zone6-boss', name: 'Antre du Seigneur Déchu', biome: 'enfer', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'seigneur-dechu' },
]

export const LEVELS: Record<string, LevelDef> = Object.fromEntries(list.map((l) => [l.id, l]))
