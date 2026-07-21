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
  // en tuiles ; y depuis le haut. `solid` (défaut absent = false) : marche/plateforme de PIERRE
  // RIGIDE — collision PLEINE (on ne la traverse pas, ni par le bas ni par les côtés). Absent →
  // plateforme de TERRE one-way (traversable par le bas, cf. landsFromAbove). Les marches solides
  // sont posées ISOLÉES (trou d'air entre chaque) pour ne jamais coincer le panda.
  platforms: { x: number; y: number; w: number; solid?: boolean }[]
  // x en tuiles ; y (tuiles) OPTIONNEL = rangée de la corniche sur laquelle le monstre apparaît POSÉ
  // (pas en l'air, pas dans le sol). Absent → au sol. Sert à peupler la VERTICALE (monstres en hauteur).
  spawns: { monsterId: string; x: number; y?: number }[]
  props?: { kind: string; x: number; y?: number }[] // x en tuiles ; y (tuiles) seulement pour les coffres sur plateforme
  // spikes = danger ; water = plan d'eau. Pour les PICS, `top` = rangée de la surface qui PORTE les
  // pics (dessus d'une corniche/plateforme en hauteur) ; absent → pics au SOL (rétrocompat exacte).
  // Les pics infligent les mêmes dégâts et se chevauchent pareil, quelle que soit la hauteur.
  // Pour l'EAU : top = rangée de surface, h = profondeur en
  // rangées (sans top/h → ancienne bande près du sol, rétrocompat). Le champ `water` choisit la FORME
  // du plan d'eau :
  //   • absent      → nappe LIBRE héritée : aucun mur (rétrocompat exacte des niveaux non refondus).
  //   • 'basin'     → PUITS/BASSIN CONTENU : parois rocheuses RIGIDES (gauche/droite) qu'on ne
  //                   traverse pas en marchant ; on plonge par le HAUT et on nage dedans ; fond = sol
  //                   du monde (mettre h = groundRow - top) ; galets/algues/coquillages en déco de
  //                   fond (sans collision). Un coffre au fond = récompense de plongée.
  //   • 'waterfall' → CASCADE : source rocheuse visible en haut + rideau d'eau qui s'écoule (animé).
  //                   Réservée aux VRAIES chutes, jamais à un bassin.
  //   • 'cascade'   → CASCADE REMONTABLE : colonne d'eau CLAIRE (bleu clair) en cuve de pierre, à
  //                   COURANT ASCENDANT — on la remonte comme une échelle et on NE SE NOIE PAS
  //                   (contrairement à 'basin'). Vers une corniche/coffre secret en hauteur.
  //   • 'lave'      → CUVE DE LAVE (enfer) : même cuve de pierre que 'basin', mais rendue ROUGE/ORANGE
  //                   incandescente (lueur + bulles) et MORTELLE au contact (gros dégâts continus, cf.
  //                   LevelScene.updateLava). Aucun coffre au fond (y plonger = mourir).
  // `openSide` (eau uniquement) : ouvre une PAROI de la cuve (pas de mur rigide de ce côté) → PASSAGE
  // SOUS-MARIN. On plonge par le HAUT du lac et on ressort sur le CÔTÉ ouvert (nage immergée), vers
  // une corniche basse de la zone suivante. 'left' | 'right' | 'both'. Absent → cuve close (2 murs).
  hazards?: { kind: 'spikes' | 'water'; x: number; w: number; top?: number; h?: number; water?: 'basin' | 'waterfall' | 'cascade' | 'lave'; openSide?: 'left' | 'right' | 'both' }[]
  bridges?: { x: number; y: number; w: number }[] // ponts de planches (plateformes fines)
  // trous MORTELS dans le sol : à ces emplacements (x en tuiles, largeur w en tuiles) on ne
  // dessine PAS les rangées de sol pleines (groundRow/+1) → c'est le vide. Tomber dedans = mort.
  // Chaque trou doit rester FRANCHISSABLE au saut simple (w ≤ distance de saut confortable,
  // vérifié par level-validator.oversizedGaps / reachable.test.ts).
  gaps?: { x: number; w: number }[]
  // BANDES DE ROCHE décoratives (aucune collision) : dalles de pierre pleine rendues avec la texture
  // du biome. Servent à REFERMER visuellement un tunnel (PLAFOND de roche au-dessus de la surface
  // marchable + remplissage sous le sol de la grotte) et à donner un socle plein au départ (mesa).
  // Purement visuelles : la hauteur libre sous un plafond reste toujours >= un saut confortable (le
  // joueur ne se cogne jamais). NE PAS confondre avec le plafond du MONDE (traversable).
  // x,y,w,h en tuiles ; y = rangée du haut de la dalle. `solid` (défaut absent = false) : dalle de
  // PLAFOND DE ROCHE avec COLLISION PLEINE — on ne peut PAS la traverser au saut (le boyau garde un
  // dégagement > saut sous le plafond). Absent → dalle purement décorative (socle/mesa sous le sol).
  rockBands?: { x: number; y: number; w: number; h: number; solid?: boolean }[]
  ladders?: { x: number; y: number; h: number }[] // échelles (x tuile, y tuile du haut, hauteur en tuiles)
  checkpoints?: { x: number }[] // drapeaux de réapparition (x en tuiles)
  boss?: string
}

import { buildLevelFromModules, composeLevel } from './level-modules'

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

// ─── Zone 1 refondue (PHASE 2 — DOSAGE + COURBE DE DIFFICULTÉ) : construite par composeLevel du KIT
// DE MODULES (src/data/level-modules.ts, docs/level-module-kit.md §PHASE 2). La COURBE monte : le
// NIVEAU 1 est le plus SIMPLE (tier D1 SEULEMENT, aucune échelle, fillers + traversée douce) ; 1-2,
// 1-3, 1-4 montent doucement (D1-2), réintroduisent les ÉCHELLES et gagnent en variété. Chaque niveau
// est DISTINCT (tierCap, ending bas/haut, plans d'eau, longueur, seed) → 4 rythmes différents. Dosage
// ~30 % fillers / 40 % traversée+vertical / 20 % risque / 10 % tension. Départ mi-hauteur sans monstre
// (R127), PORTE à altitude ≠. Eau en cuves marine (noyade) ET cascade (remontable, courant descendant).

// zone1-1 : PRAIRIE — le plus SIMPLE et le plus COURT. Prairie PLATE et OUVERTE : longues bandes,
// un petit gué peu profond (petit trésor), quelques trous minuscules, descente de combat, PORTE tout
// en BAS. AUCUNE échelle, aucun bassin profond, aucun pic, aucune cascade. Rythme : respiration →
// traversée douce → petite eau → relief plat → combat. Silhouette quasi horizontale (le plus doux).
function mkZone11(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [14, 18], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], spawnHere: true },
    { kind: 'ligne-droite', widthRange: [14, 18], fillBelow: 'sol', fillAbove: 'air', tags: ['traversée'], ground: ['gloopy'] },
    { kind: 'petit-pont', widthRange: [12, 16], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'respiration'], ground: ['fabre'] }, // gué peu profond, petit trésor au fond
    { kind: 'couloir-large', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], birds: ['corbeau'] },
    { kind: 'gue', widthRange: [12, 16], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['angeling'], birds: ['corbeau'] }, // trous minuscules (corniches flottantes)
    { kind: 'descente-controlee', widthRange: [14, 18], rise: -8, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['gloopy', 'lapin-bondissant'] },
    { kind: 'arene', widthRange: [14, 20], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['fabre', 'angeling'], exitHere: true }, // PORTE tout en BAS
  ], { id: 'zone1-1', name: 'Prairie de Prontera', biome: 'plaine', seed: 'z1-1-flat' })
}

// zone1-2 : CHAMPS — introduit la VERTICALITÉ et les ÉCHELLES. Rythme « on grimpe » : escalier de
// dune, double-sol (échelle), un vrai BASSIN D'APNÉE (noyade, coffre au fond), zigzag, échelle-vs-
// sauts, puis grande REMONTÉE finale → PORTE tout en HAUT. Distinct du 1-1 (plat, sortie bas) par la
// hauteur, les échelles et l'eau profonde.
function mkZone12(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['gloopy', 'lapin-bondissant'] },
    { kind: 'double-sol', widthRange: [12, 18], fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['mandragore'] }, // 2 étages + échelle
    { kind: 'bassin', widthRange: [14, 20], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['fabre'] }, // apnée profonde, coffre au fond
    { kind: 'zigzag', widthRange: [14, 20], fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['willow'] },
    { kind: 'echelle-vs-sauts', widthRange: [14, 20], fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['gloopy'] }, // deux routes vers le palier
    { kind: 'marche', widthRange: [10, 14], fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['mandragore'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['willow'], exitHere: true }, // PORTE tout en HAUT
  ], { id: 'zone1-2', name: 'Champs fleuris', biome: 'plaine', seed: 'z1-2-climb' })
}

// zone1-3 : ORÉE de la forêt — rythme « TROUS + CASCADE ». Corniches FLOTTANTES au-dessus du vide
// (gué, corniche-vide), une CASCADE claire à remonter (coffre secret), un bassin d'apnée, puis grande
// dévalade de combat vers l'arène du fond (poring doré = MVP). Sortie EN BAS. Biome forêt (décor,
// oiseaux). Distinct du 1-2 (vertical sec) par les vides, la cascade et le MVP.
function mkZone13(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], spawnHere: true },
    { kind: 'colline', widthRange: [16, 22], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['louveteau'], birds: ['corbeau', 'corbeau'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['poporing'], birds: ['corbeau', 'corbeau', 'corbeau'] }, // corniches flottantes sur le vide
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['mandragore'], birds: ['corbeau'] }, // cascade claire remontable, coffre secret
    { kind: 'gue', widthRange: [12, 18], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['willow'], birds: ['corbeau'] },
    { kind: 'bassin', widthRange: [14, 20], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['louveteau'] }, // apnée, coffre au fond
    { kind: 'descente-controlee', widthRange: [16, 22], rise: -12, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['poring-dore', 'willow'] }, // dévalade de combat, poring doré = MVP
    { kind: 'arene', widthRange: [16, 20], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['mandragore', 'poporing'], exitHere: true }, // PORTE tout en BAS
  ], { id: 'zone1-3', name: 'Orée de la forêt', biome: 'foret', seed: 'z1-3-gaps' })
}

// zone1-4 : FORÊT PROFONDE — le plus LONG et le plus VARIÉ de la zone. Rythme AÉRIEN et complet :
// collines, cascade, arête de corniches sur le vide, bassin d'apnée, grande VOLÉE d'oiseaux, gué,
// zigzag, puis grande REMONTÉE finale → PORTE tout en HAUT. Deux plans d'eau (cascade + bassin), un
// beat d'oiseaux dense, MVP poring doré. Le plus dense/long des quatre (climax de la zone 1).
function mkZone14(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], spawnHere: true },
    { kind: 'colline', widthRange: [18, 24], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['louveteau'], birds: ['corbeau', 'corbeau'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['rocker'], birds: ['corbeau'] }, // cascade claire, coffre secret
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['willow'], birds: ['corbeau', 'corbeau', 'corbeau'] }, // arête de corniches flottantes
    { kind: 'bassin', widthRange: [14, 20], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['poporing'] }, // apnée, coffre au fond
    { kind: 'volee', widthRange: [18, 24], fillBelow: 'sol', fillAbove: 'air', tags: ['oiseaux', 'danger'], ground: ['mandragore'], birds: ['corbeau', 'corbeau', 'corbeau', 'corbeau'] }, // grande volée d'oiseaux
    { kind: 'gue', widthRange: [14, 18], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['louveteau'], birds: ['corbeau'] },
    { kind: 'zigzag', widthRange: [14, 20], fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['willow'] },
    { kind: 'ligne-droite', widthRange: [10, 14], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['mandragore', 'ronce-cracheuse'] }, // connecteur plat (accroche zigzag → escalier)
    { kind: 'escalier', widthRange: [16, 22], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['rocker', 'poring-dore'], exitHere: true }, // grande remontée, PORTE tout en HAUT, poring doré = MVP
  ], { id: 'zone1-4', name: 'Forêt profonde', biome: 'foret', seed: 'z1-4-long' })
}

// ─── Zone 3 — JUNGLE (PHASE MODULES) : construite par composeLevel du KIT (comme la zone 1), mais à
// une COURBE plus haute (D3) et deux RYTHMES DISTINCTS. Biome très AQUATIQUE : chaque niveau impose
// un bassin marine (noyade, coffre de plongée) ET une cascade claire remontable (plateformes des deux
// côtés). Oiseau : ara. Monstres jungle au sol ET en hauteur : willow, frelon-geant, flora-vorace,
// singe-grimpeur. Dosage ~30 % fillers / 40 % traversée+vertical / 20 % risque / 10 % tension ;
// départ mi-hauteur sans monstre (R127), PORTE à altitude ≠.

// zone3-1 : LISIÈRE — D3, sortie EN HAUT (la lisière grimpe vers la canopée). Bassin d'apnée +
// cascade secrète ; échelles réintroduites.
function mkZone31(): LevelDef {
  return composeLevel({
    id: 'zone3-1', name: 'Lisière de la jungle', biome: 'jungle',
    tierCap: 3, ending: 'haut', allowLadders: true, midCount: 6,
    ground: ['willow', 'frelon-geant', 'ronce-cracheuse', 'flora-vorace', 'ours-brun', 'singe-grimpeur'], birds: ['ara'],
    waterKinds: ['bassin', 'cascade'], seed: 'zone3-1a',
  })
}

// zone3-2 : MARÉCAGES — D3, le plus LONG et le plus AQUATIQUE de la zone (bassin-trésor profond +
// cascade), sortie EN BAS (grande dévalade vers l'arène-climax des marais).
function mkZone32(): LevelDef {
  return composeLevel({
    id: 'zone3-2', name: 'Marécages suspendus', biome: 'jungle',
    tierCap: 3, ending: 'bas', allowLadders: true, midCount: 7,
    ground: ['frelon-geant', 'flora-vorace', 'ronce-cracheuse', 'singe-grimpeur', 'ours-brun', 'willow'], birds: ['ara'],
    waterKinds: ['passage-immerge', 'cascade'], seed: 'zone3-2c', // passage SOUS-MARIN (marécages) + cascade remontable
  })
}

// ─── Route alternative PLAGE (PHASE MODULES, composeLevel) — oiseau : ara. Monstres côtiers au sol
// ET en hauteur : crabe-geant, meduse, harpie. Beaucoup d'eau (lagons marine + cascade).

// plage-1 : RIVAGE — D3, court et côtier, sortie EN BAS (arène au ras du sable). Lagon d'apnée +
// cascade.
function mkPlage1(): LevelDef {
  return composeLevel({
    id: 'plage-1', name: 'Rivage de corail', biome: 'plage',
    tierCap: 3, ending: 'bas', allowLadders: true, midCount: 6,
    ground: ['crabe-geant', 'meduse', 'harpie'], birds: ['ara'],
    waterKinds: ['bassin', 'cascade'], seed: 'plage-1h',
  })
}

// plage-2 : RÉCIF IMMERGÉ — D3+, le plus grand et le plus dur (tierCap 4 : tension à pics en hauteur),
// DEUX lagons marine, sortie EN HAUT sur une arête aérienne. Le climax de la route côtière.
function mkPlage2(): LevelDef {
  return composeLevel({
    id: 'plage-2', name: 'Récif immergé', biome: 'plage',
    tierCap: 4, ending: 'haut', allowLadders: true, midCount: 7,
    ground: ['meduse', 'harpie', 'crabe-geant'], birds: ['ara'],
    waterKinds: ['passage-immerge', 'bassin'], seed: 'plage-2b', // passage SOUS-MARIN (plonger par le haut, ressortir sur le côté)
  })
}

// ─── Zone 4 refondue (PHASE 2 — composeLevel) : MONTAGNE + route alternative CARRIÈRE. Construite par
// composeLevel (comme zone1) : DOSAGE 30/40/20/10, COURBE de difficulté par tierCap, DÉPART plat à
// mi-hauteur sans monstre (R127), PORTE à une altitude ≠ (ending bas/haut), eau en cuves (marine=noyade
// / cascade=remontable), coffres atteignables. Chaque niveau est DISTINCT (biome, tierCap, ending,
// midCount, waterKinds, pool de monstres, seed). Difficulté croissante : zone4-1≈D3, zone4-2≈D3-4,
// carriere-1≈D3, carriere-2≈D4 (les tiers 3-4 débloquent crêtes, pics en hauteur et galeries de roche).
// Montagne = crêtes/collines/vistas + cascades + pics d'altitude ; carrière = galeries de pierre
// (grotte/couloir-pics) + fosses noyées + gardien-pierre en climax. Monstres sol ET hauteur (posés sur
// les corniches des modules élevés par l'assembleur) + faucons en plein air.

// zone4-1 : MONTAGNE — SENTIER DES CIMES. D3, ASCENSION aérienne (ending haut), la plus « oiseaux » :
// deux plans d'eau (cascade secrète + lac alpin), crêtes/collines ventées, PORTE tout en haut.
function mkZone41(): LevelDef {
  return composeLevel({
    id: 'zone4-1', name: 'Sentier des cimes', biome: 'montagne',
    tierCap: 3, ending: 'haut', allowLadders: true, midCount: 6,
    ground: ['harpie', 'ours-brun', 'yeti', 'louveteau'], birds: ['faucon'],
    waterKinds: ['cascade', 'bassin'], seed: 'z4-1',
  })
}

// zone4-2 : MONTAGNE — COL GLACÉ. D3-4, TRAVERSÉE DE COL puis grande DESCENTE (ending bas) : on monte,
// on s'enfonce (galeries + pics d'altitude débloqués par le tier 4), puis on dévale vers l'arène en
// contrebas. Lac gelé unique (bassin), rythme « passage » distinct de l'ascension du 4-1.
function mkZone42(): LevelDef {
  return composeLevel({
    id: 'zone4-2', name: 'Col glacé', biome: 'montagne',
    tierCap: 4, ending: 'bas', allowLadders: true, midCount: 7,
    ground: ['yeti', 'harpie', 'louveteau'], birds: ['faucon'],
    waterKinds: ['bassin'], seed: 'z4-2',
  })
}

// carriere-1 : CARRIÈRE — TERRASSES D'EXTRACTION. D3, DESCENTE minière (ending bas) vers une arène
// GARDÉE par le gardien-pierre (mvp de climax). REPASSÉE en buildLevelFromModules (comme cave-1) pour
// GARANTIR de VRAIS TUNNELS DE PIERRE DENSES : quatre boyaux `grotte` (roche dessus ET dessous) + un
// couloir-pics enchaînés (le plafond famille-tension de composeLevel n'en laissait qu'un — trop peu de
// grottes pour une carrière). Le gardien-pierre veille dans un GOULET (dernier boyau) avant la grande
// dévalade vers l'arène du fond. Fosse noyée (bassin, coffre), biome pierre, faucons aux respirations.
function mkCarriere1(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], spawnHere: true },
    { kind: 'grotte', widthRange: [16, 22], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['gobelin-mineur'] }, // BOYAU DE PIERRE #1
    { kind: 'grotte', widthRange: [16, 22], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['golem-de-pierre'] }, // BOYAU DE PIERRE #2 (galerie continue avec #1)
    { kind: 'descente', widthRange: [14, 20], rise: -6, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['gargouille', 'scarabee-cornu'], birds: ['faucon', 'faucon'] }, // terrasse d'extraction, respiration à l'air
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['gobelin-mineur'] }, // fosse noyée, coffre au fond
    { kind: 'couloir-pics', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'roche', tags: ['tension', 'danger'], ground: ['golem-de-pierre'] }, // galerie basse à lits de pics (plafond de roche)
    { kind: 'grotte', widthRange: [16, 22], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['gargouille'] }, // BOYAU DE PIERRE #3
    { kind: 'grotte', widthRange: [14, 20], fillBelow: 'roche', fillAbove: 'roche', tags: ['tension', 'danger'], ground: ['gardien-pierre'] }, // GOULET GARDÉ : le gardien-pierre veille dans le tunnel
    { kind: 'descente-controlee', widthRange: [16, 22], rise: -28, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['golem-de-pierre'] }, // grande dévalade minière vers le fond
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['gobelin-mineur', 'gargouille'], exitHere: true }, // arène du fond + PORTE en contrebas
  ], { id: 'carriere-1', name: 'Carrière abandonnée', biome: 'carriere', seed: 'carr-1-tunnels' })
}

// carriere-2 : CARRIÈRE — FOSSE DES GOLEMS. D4, le plus enterré : on REMONTE de la fosse (ending haut,
// climax = grande escalade de sortie, ≠ de l'arène gardée du 1 en bas). REPASSÉE en buildLevelFromModules
// pour un MAXIMUM de galeries de pierre + pics : quatre boyaux `grotte` + couloir-pics + pics-quinconce
// (tier 4), impossibles à garantir via le plafond famille-tension de composeLevel. Deux plans d'eau
// (fosse noyée + source claire remontable), remontée finale par une échelle vers la PORTE tout en haut.
// (Le gardien-pierre veille dans carriere-1 ; ici le péril est la remontée à travers les galeries.)
function mkCarriere2(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], spawnHere: true },
    { kind: 'grotte', widthRange: [16, 22], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['gobelin-mineur'] }, // BOYAU DE PIERRE #1
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['golem-de-pierre'] }, // fosse noyée, coffre au fond
    { kind: 'grotte', widthRange: [16, 22], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['gargouille'] }, // BOYAU DE PIERRE #2
    { kind: 'couloir-pics', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'roche', tags: ['tension', 'danger'], ground: ['golem-de-pierre'] }, // galerie basse à lits de pics
    { kind: 'pics-quinconce', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['tension', 'danger'], ground: ['gargouille'] }, // slalom de pics en hauteur (tier 4)
    { kind: 'escalier-pierre', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['montée'] }, // MARCHES DE PIERRE rigides (blocs solides isolés, on ne les traverse pas)
    { kind: 'grotte', widthRange: [16, 22], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['gobelin-mineur'] }, // BOYAU DE PIERRE #3
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['golem-de-pierre'], birds: ['faucon'] }, // source claire remontable, coffre secret
    { kind: 'grotte', widthRange: [14, 20], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['gargouille'] }, // BOYAU DE PIERRE #4
    { kind: 'marche', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['gobelin-mineur'] },
    { kind: 'echelle-tranquille', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['golem-de-pierre'], exitHere: true }, // remontée finale, PORTE tout en HAUT
  ], { id: 'carriere-2', name: 'Fosse des golems', biome: 'carriere', seed: 'carr-2-tunnels' })
}

// ─── Zone 5 — CIMETIÈRE (refondue PHASE MODULES, composeLevel) ──────────────────────────────
// Les niveaux les PLUS DURS jusqu'ici (D4) : ambiance sombre — cryptes, tunnels de roche, arêtes
// battues par les vents, embuscades en hauteur. Dosage décalé vers la TENSION (tierCap 4 débloque
// couloir-pics / pics-quinconce / échelle-exposée + traversées D3 crêtes/triple-saut) tout en
// gardant ~30 % de respiration. Eau en cuves : bassin marine (noyade, coffre de plongée) + cascade
// claire remontable. Oiseau = harfang-spectral. MVP = spectre-ancien (climax). DÉPART mi-hauteur,
// PORTE à altitude ≠. Deux RYTHMES DISTINCTS : 5-1 PLONGE (sortie bas), 5-2 REMONTE (sortie haut).

// zone5-1 : NÉCROPOLE — D4, sortie EN BAS. Rythme « on s'enfonce » : longue dévalade finale vers la
// fosse-arène où veille le spectre ancien. Bassin d'apnée (coffre) + cascade secrète, harfangs en vol.
function mkZone51(): LevelDef {
  return composeLevel({
    id: 'zone5-1', name: 'Nécropole oubliée', biome: 'cimetiere',
    tierCap: 4, ending: 'bas', allowLadders: true, midCount: 7,
    ground: ['squelette', 'goule', 'totem-maudit', 'banshee', 'fantome', 'pretre-goule'], birds: ['harfang-spectral'],
    mvp: 'spectre-ancien', waterKinds: ['bassin', 'cascade'], seed: 'ossuaire',
  })
}

// zone5-2 : CRYPTES HURLANTES — D4, sortie EN HAUT (remontée finale vers une arête ventée). Rythme
// AÉRIEN et sinueux : arêtes fines sur le vide, gouffres, vagues de banshees. Bassin-trésor profond +
// cascade secrète, harfangs plus présents. Distinct de 5-1 (qui plonge) par l'eau, l'ordre et la sortie.
function mkZone52(): LevelDef {
  return composeLevel({
    id: 'zone5-2', name: 'Cryptes hurlantes', biome: 'cimetiere',
    tierCap: 4, ending: 'haut', allowLadders: true, midCount: 7,
    ground: ['goule', 'fantome', 'totem-maudit', 'banshee', 'squelette', 'pretre-goule'], birds: ['harfang-spectral'],
    mvp: 'spectre-ancien', waterKinds: ['tresor-bassin', 'cascade'], seed: 'arete',
  })
}

// ─── Zone 6 — ENFER (refondue PHASE MODULES, composeLevel) ──────────────────────────────────
// zone6-1 : SENTIER DES DAMNÉS — le niveau le PLUS DUR du jeu (D4-5, tierCap 5 débloque l'atterrissage
// étroit D5). Le plus LONG (midCount 8). Sortie EN BAS : longue dévalade vers l'arène-climax où rugit
// le dragon de flamme (MVP). Tension maximale — couloirs de pics, atterrissages étroits, triples sauts,
// embuscades de corbeaux ; un gardien-flamme posté en chokepoint sur le chemin. CUVE DE LAVE mortelle
// (rouge incandescent, pas de coffre : y plonger tue) + sortie humide secrète. Monstres au sol ET en
// hauteur : diablotin, mage-noir, gargouille, mini-baphomet, gardien-flamme ; corbeaux en vol ; dragon-flamme en climax.
function mkZone61(): LevelDef {
  return composeLevel({
    id: 'zone6-1', name: 'Sentier des Damnés', biome: 'enfer',
    tierCap: 5, ending: 'bas', allowLadders: true, midCount: 10,
    ground: ['diablotin', 'mage-noir', 'golem-de-lave', 'gargouille', 'mini-baphomet', 'gardien-flamme'], birds: ['corbeau'],
    mvp: 'dragon-flamme', waterKinds: ['bassin', 'sortie-humide'], lava: true, seed: 'damnes-2',
  })
}

const list: LevelDef[] = [
  mkZone11(),
  mkZone12(),
  mkZone13(),
  mkZone14(),
  // ARÈNE — Roi Gloopy (NOVICE bondissant). Clairière ouverte à trois pods rebondissants, sol
  // dégagé pour esquiver le bond fracassant. Silhouette basse et ludique.
  { id: 'zone1-boss', name: 'Antre du Roi Gloopy', biome: 'foret', widthTiles: 40,
    platforms: [plat(8, 11, 4), plat(18, 10, 5), plat(28, 11, 4)],
    spawns: [], boss: 'roi-gloopy' },
  // zone2-1 : DÉSERT (KIT MODULES) — DUNES DE SOGRAT (≈ D2). Le plus doux du désert : traversée
  // dunaire ensoleillée, deux points d'eau sûrs, pente de combat finale. plateau (départ mi-hauteur)
  // → escalier de dune → gué (crevasses de sable) → colline/vista (faucons) → petit-pont d'oasis
  // (bassin peu profond, petit trésor) → oasis d'apnée (bassin marine, coffre au fond) → descente de
  // combat → arène-climax + PORTE en contrebas, au sol (altitude ≠ départ). Dosage doux : ~½ filler/
  // traversée, un seul vrai risque (l'oasis profonde), pas de pics (réservés aux niveaux suivants).
  buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['scorpion'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['scorpion', 'fourmi-geante'] },
    { kind: 'gue', widthRange: [16, 22], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['vautour'], birds: ['faucon', 'faucon'] },
    { kind: 'colline', widthRange: [18, 26], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['momie'], birds: ['faucon', 'faucon', 'faucon'] },
    { kind: 'petit-pont', widthRange: [12, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'respiration'], ground: ['scorpion'] }, // gué d'oasis peu profond, petit trésor au fond
    { kind: 'bassin', widthRange: [14, 20], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['momie'] }, // oasis d'apnée, coffre au fond
    { kind: 'descente', widthRange: [14, 20], rise: -12, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['orc-guerrier', 'vautour', 'scarabee-cornu'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['scorpion', 'orc-seigneur'], exitHere: true }, // orc-seigneur = élite MVP en climax, PORTE au sol
  ], { id: 'zone2-1', name: 'Dunes de Sograt', biome: 'desert' }),
  // zone2-2 : DÉSERT (KIT MODULES) — OASIS PERDUE (≈ D2-3). Rythme AQUATIQUE et plus tendu : cascade
  // secrète à remonter, PREMIERS PICS en hauteur (faux-plat), grande oasis, volée de faucons, remontée
  // finale. plateau (départ) → colline (faucons) → cascade claire (remontable, coffre secret) →
  // faux-plat (corniche semée de pics isolés à enjamber, tier 3) → grande oasis marine (apnée, coffre)
  // → gué → volée de faucons → escalier → arène + PORTE tout en HAUT (altitude ≠ départ). Deux plans
  // d'eau (cascade + bassin), un beat de pics, un beat d'oiseaux : plus varié et plus long que 2-1.
  buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['scorpion'], spawnHere: true },
    { kind: 'colline', widthRange: [16, 24], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['vautour'], birds: ['faucon', 'faucon', 'faucon'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['momie'], birds: ['faucon'] },
    { kind: 'faux-plat', widthRange: [14, 20], fillBelow: 'sol', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['scorpion'] }, // pics isolés à enjamber sur la corniche (tier 3)
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['momie'] },
    { kind: 'gue', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['vautour'], birds: ['faucon', 'faucon'] },
    { kind: 'volee', widthRange: [18, 24], fillBelow: 'sol', fillAbove: 'air', tags: ['oiseaux', 'danger'], ground: ['scorpion'], birds: ['faucon', 'faucon', 'faucon', 'faucon', 'faucon'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['orc-guerrier'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['momie', 'zombie'], exitHere: true }, // PORTE tout en HAUT
  ], { id: 'zone2-2', name: 'Oasis perdue', biome: 'desert' }),
  // zone2-3 : DÉSERT (KIT MODULES) — VALLÉE DES TOMBEAUX (≈ D3). Le plus DUR du désert, sépulcral et
  // vertical : tunnel de roche, SLALOM DE PICS EN HAUTEUR (pics-quinconce, tier 4), embuscade d'élite,
  // finish sur une arête ventée. plateau (départ) → escalier → grotte (tunnel de pierre fermé) →
  // pics-quinconce (pics au sol + mini-corniches à pics, slalom en hauteur) → descente de combat
  // (mini-baphomet élite) → gué → oasis marine (apnée, coffre) → remontée → crête aérienne haute
  // (faucons) + PORTE (altitude ≠ départ). Tension marquée : un vrai tunnel + un beat de précision.
  buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['momie'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['zombie', 'scarabee-cornu'], birds: ['faucon'] },
    { kind: 'grotte', widthRange: [14, 20], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['momie', 'zombie'] }, // boyau de pierre fermé (roche dessus + dessous)
    { kind: 'pics-quinconce', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['tension', 'danger'], ground: ['zombie'] }, // slalom de pics en hauteur (tier 4)
    { kind: 'descente', widthRange: [14, 20], rise: -10, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['mini-baphomet', 'zombie'] }, // mini-baphomet = élite cornue des tombeaux
    { kind: 'gue', widthRange: [16, 22], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['vautour'], birds: ['faucon', 'faucon'] },
    { kind: 'bassin', widthRange: [12, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['zombie'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['momie'] },
    { kind: 'crete', widthRange: [16, 22], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['vautour'], birds: ['faucon', 'faucon', 'faucon'], exitHere: true }, // PORTE sur l'arête ventée, tout en haut
  ], { id: 'zone2-3', name: 'Vallée des tombeaux', biome: 'desert' }),
  // cave-1 : CAVE (KIT MODULES) — CAVE AUX ÉCHOS (≈ D3). Vrai niveau de GROTTE : DEUX tunnels de
  // pierre FERMÉS (roche au-dessus ET en dessous) + un couloir à pics sous plafond de roche encadrent
  // le parcours souterrain. plateau (départ) → colline (corbeaux) → cascade claire (source secrète,
  // coffre) → grotte (BOYAU DE PIERRE #1) → lac marin souterrain (apnée, coffre) → couloir-pics
  // (plafond de roche + lits de pics, tier 4) → grotte (BOYAU DE PIERRE #2) → escalier → arène-climax
  // + PORTE en HAUT (altitude ≠ départ). Ambiance fermée et resserrée, distincte des dunes ouvertes.
  buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['chauve-souris'], spawnHere: true },
    { kind: 'colline', widthRange: [16, 24], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['squelette'], birds: ['corbeau', 'corbeau', 'corbeau'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['fantome'], birds: ['corbeau'] },
    { kind: 'grotte', widthRange: [14, 20], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['gobelin-mineur', 'chauve-souris', 'fourmi-geante'] }, // boyau de pierre fermé #1
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['squelette'] }, // lac marin souterrain, coffre au fond
    { kind: 'couloir-pics', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'roche', tags: ['tension', 'danger'], ground: ['golem-de-pierre'] }, // plafond de roche + lits de pics (tier 4)
    { kind: 'grotte', widthRange: [14, 20], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['mage-noir', 'chauve-souris'] }, // boyau de pierre fermé #2
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['fantome'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['mage-noir', 'squelette', 'gobelin-mineur'], exitHere: true }, // PORTE en HAUT, sortie de la caverne
  ], { id: 'cave-1', name: 'Cave aux échos', biome: 'cave' }),
  // ARÈNE — Pharaon Scarabée (SABREUR). PYRAMIDE à gradins mirrorés convergeant vers un sommet
  // central : on grimpe pour esquiver les taillades bondissantes et le plongeon chargé.
  { id: 'zone2-boss', name: 'Pyramide du Pharaon', biome: 'desert', widthTiles: 44,
    platforms: [plat(7, 12, 6), plat(13, 10, 5), plat(18, 8, 8), plat(26, 10, 5), plat(32, 12, 6)],
    spawns: [], boss: 'pharaon-scarabee' },
  // Zone 3 — jungle (+ route alternative plage) — refondue PHASE MODULES (cf. mkZone31/mkZone32).
  mkZone31(),
  mkZone32(),
  // ARÈNE — Seigneur Liane (MAGE). Canopée à plateaux de lianes épars et décalés : on saute de
  // plateforme en plateforme pour trouver le TROU SÛR de la pluie de météores.
  { id: 'zone3-boss', name: 'Cœur de la Jungle', biome: 'jungle', widthTiles: 42,
    platforms: [plat(5, 11, 4), plat(13, 10, 5), plat(24, 10, 5), plat(33, 11, 4)],
    spawns: [], boss: 'seigneur-liane' },
  // Route alternative PLAGE — refondue PHASE MODULES (cf. mkPlage1/mkPlage2).
  mkPlage1(),
  mkPlage2(),
  // Zone 4 — montagne (+ route alternative carrière) — REFONDUE PAR MODULES (voir mkZone41/42 ci-dessus)
  mkZone41(),
  mkZone42(),
  // ARÈNE — Golem Ancien (ARCHER). Corniches de montagne en ESCALIER ASYMÉTRIQUE : on grimpe pour
  // couper la ligne de tir des salves perçantes et survivre au déluge de pierres.
  { id: 'zone4-boss', name: 'Pic du Golem Ancien', biome: 'montagne', widthTiles: 46,
    platforms: [plat(6, 12, 5), plat(14, 10, 4), plat(24, 11, 5), plat(34, 10, 4), plat(40, 12, 4)],
    spawns: [], boss: 'golem-ancien' },
  // carriere-1 / carriere-2 : route alternative CARRIÈRE — REFONDUE PAR MODULES (voir mkCarriere1/2 ci-dessus)
  mkCarriere1(),
  mkCarriere2(),
  // Zone 5 — cimetière (refondue PHASE MODULES ; cf. mkZone51 / mkZone52 ci-dessus)
  mkZone51(),
  mkZone52(),
  // ARÈNE — Roi Liche (SORCIER). AUTEL SYMÉTRIQUE : dais central (trône) encadré de deux gradins et
  // deux perchoirs hauts pour esquiver les novae nécrotiques.
  { id: 'zone5-boss', name: 'Trône du Roi Liche', biome: 'cimetiere', widthTiles: 44,
    platforms: [plat(6, 11, 6), plat(8, 9, 5), plat(17, 12, 10), plat(33, 11, 6), plat(31, 9, 5)],
    spawns: [], boss: 'roi-liche' },
  // Zone 6 — enfer (refondue PHASE MODULES ; cf. mkZone61 ci-dessus)
  mkZone61(),
  // ARÈNE FINALE — Seigneur Déchu (TOUTES CLASSES). La plus VASTE : sanctuaire infernal multi-paliers
  // avec autel central surélevé, de quoi grimper, esquiver et courir sous le déluge des quatre écoles.
  { id: 'zone6-boss', name: 'Antre du Seigneur Déchu', biome: 'enfer', widthTiles: 50,
    platforms: [plat(6, 12, 5), plat(15, 10, 7), plat(23, 8, 7), plat(31, 10, 7), plat(42, 12, 5)],
    spawns: [], boss: 'seigneur-dechu' },
]

export const LEVELS: Record<string, LevelDef> = Object.fromEntries(list.map((l) => [l.id, l]))
