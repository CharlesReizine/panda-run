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
  //   • 'cascade'   → CASCADE REMONTABLE : colonne d'eau CLAIRE (bleu clair) en cuve de pierre, à
  //                   COURANT ASCENDANT — on la remonte comme une échelle et on NE SE NOIE PAS
  //                   (contrairement à 'basin'). Vers une corniche/coffre secret en hauteur.
  hazards?: { kind: 'spikes' | 'water'; x: number; w: number; top?: number; h?: number; water?: 'basin' | 'waterfall' | 'cascade' }[]
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

import { buildLevelFromModules } from './level-modules'

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

// ─── Zone 1 refondue (PHASE MODULES) : construite par le KIT DE MODULES (src/data/level-modules.ts,
// docs/level-module-kit.md). Fini les tours d'échelles verticales : chaque niveau est une LISTE de
// 6-10 modules collés bout à bout formant une SILHOUETTE COLLINES (montée douce → eau en cuve →
// détour → climax), ≤3 paliers empilés, eau en cuves marine (noyade) ET cascade (remontable), monstres
// au sol ET en hauteur + oiseaux en plein air, DÉPART à mi-hauteur, PORTE à altitude ≠. Chaque niveau
// enchaîne des familles DIFFÉRENTES → 4 rythmes distincts.

// zone1-1 : PRAIRIE — traversée douce → gué → colline → bassin d'apnée → cascade secrète → arène+PORTE.
function mkZone11(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['gloopy'], spawnHere: true },
    { kind: 'gue', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['angeling'], birds: ['corbeau'] },
    { kind: 'colline', widthRange: [16, 24], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['fabre', 'gloopy'], birds: ['corbeau'] },
    { kind: 'bassin', widthRange: [12, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['gloopy'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['mandragore'], birds: ['corbeau'] },
    { kind: 'descente', widthRange: [12, 18], rise: -12, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['fabre', 'angeling'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['gloopy', 'poring-dore'], exitHere: true }, // PORTE en contrebas, au sol (départ à mi-hauteur)
  ], { id: 'zone1-1', name: 'Prairie de Prontera', biome: 'plaine' })
}

// zone1-2 : CHAMPS — plateau → escalier montant → corniche & vide (oiseaux) → cascade → bassin →
// volée d'oiseaux → arène+PORTE. Plus long et plus aérien.
function mkZone12(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['gloopy'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['mandragore', 'lunatic'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['relief', 'oiseaux', 'danger'], ground: ['gloopy'], birds: ['corbeau', 'corbeau'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['mandragore'], birds: ['corbeau'] },
    { kind: 'bassin', widthRange: [12, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['louveteau'] },
    { kind: 'volee', widthRange: [16, 24], fillBelow: 'sol', fillAbove: 'air', tags: ['oiseaux', 'danger'], ground: ['gloopy'], birds: ['corbeau', 'corbeau', 'corbeau'] },
    { kind: 'colline', widthRange: [16, 22], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['mandragore', 'gloopy'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['louveteau', 'gloopy'], exitHere: true }, // PORTE tout en HAUT (départ à mi-hauteur)
  ], { id: 'zone1-2', name: 'Champs fleuris', biome: 'plaine' })
}

// zone1-3 : ORÉE — plateau → colline → grotte (roche/roche) → gué → bassin → escalier → crête (oiseaux)
// +PORTE. Rythme forêt : relief, tunnel, eau, arête aérienne.
function mkZone13(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['louveteau'], spawnHere: true },
    { kind: 'colline', widthRange: [18, 26], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['mandragore', 'poporing'], birds: ['corbeau'] },
    { kind: 'grotte', widthRange: [12, 18], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['louveteau', 'mandragore'] },
    { kind: 'gue', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['poporing'], birds: ['corbeau'] },
    { kind: 'bassin', widthRange: [12, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['louveteau'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['mandragore', 'louveteau'] },
    { kind: 'crete', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['poporing'], birds: ['corbeau', 'corbeau'], exitHere: true },
  ], { id: 'zone1-3', name: 'Orée de la forêt', biome: 'foret' })
}

// zone1-4 : FORÊT PROFONDE — plateau → escalier → cascade → grande vallée bassin → colline → corniche &
// vide (oiseaux) → descente → arène+PORTE. Le plus long, la plus grande cuve.
function mkZone14(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['louveteau'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['willow', 'mandragore'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 3, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['louveteau'], birds: ['corbeau'] },
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['rocker'] },
    { kind: 'colline', widthRange: [18, 26], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['mandragore', 'louveteau'], birds: ['corbeau'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['relief', 'oiseaux', 'danger'], ground: ['willow'], birds: ['corbeau', 'corbeau'] },
    { kind: 'descente', widthRange: [14, 20], rise: -12, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['rocker', 'louveteau'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['mandragore', 'louveteau'], exitHere: true }, // PORTE en contrebas, au sol (départ à mi-hauteur)
  ], { id: 'zone1-4', name: 'Forêt profonde', biome: 'foret' })
}

// ─── Zone 3 — JUNGLE (PHASE MODULES) : même kit que la zone 1, rythmes DISTINCTS. ───────────────
// Oiseau du biome : ara. Monstres jungle : singe-grimpeur, frelon-geant, flora-vorace, willow.

// zone3-1 : LISIÈRE — traversée → gué → colline (oiseaux) → bassin d'apnée → escalier → cascade
// secrète → arène+PORTE tout en HAUT. Silhouette montante : la lisière grimpe vers la canopée.
function mkZone31(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['willow'], spawnHere: true },
    { kind: 'gue', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['frelon-geant'], birds: ['ara'] },
    { kind: 'colline', widthRange: [18, 26], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['flora-vorace', 'singe-grimpeur'], birds: ['ara'] },
    { kind: 'bassin', widthRange: [14, 20], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['willow'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['singe-grimpeur', 'flora-vorace'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['frelon-geant'], birds: ['ara'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['singe-grimpeur', 'frelon-geant'], exitHere: true }, // PORTE tout en HAUT (départ à mi-hauteur)
  ], { id: 'zone3-1', name: 'Lisière de la jungle', biome: 'jungle' })
}

// zone3-2 : MARÉCAGES — escalier → bassin → corniche & vide (oiseaux) → cascade → bassin → grotte →
// descente → arène+PORTE en contrebas. Le plus AQUATIQUE (deux bassins) et le plus long de la zone.
function mkZone32(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['frelon-geant'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['singe-grimpeur', 'flora-vorace'] },
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['willow'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['relief', 'oiseaux', 'danger'], ground: ['flora-vorace'], birds: ['ara', 'ara'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['singe-grimpeur'], birds: ['ara'] },
    { kind: 'bassin', widthRange: [14, 20], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['willow', 'frelon-geant'] },
    { kind: 'grotte', widthRange: [12, 18], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['singe-grimpeur', 'flora-vorace'] },
    { kind: 'descente', widthRange: [14, 20], rise: -12, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['singe-grimpeur', 'flora-vorace'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['frelon-geant', 'singe-grimpeur'], exitHere: true }, // PORTE en contrebas, au sol (départ à mi-hauteur)
  ], { id: 'zone3-2', name: 'Marécages suspendus', biome: 'jungle' })
}

// ─── Route alternative PLAGE (PHASE MODULES) — oiseau : ara. Monstres : crabe-geant, meduse, harpie.

// plage-1 : RIVAGE — plateau → colline (oiseaux) → lagon d'apnée → gué → cascade → descente →
// arène+PORTE au ras du sable. Rythme court et côtier, finit en contrebas.
function mkPlage1(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['crabe-geant'], spawnHere: true },
    { kind: 'colline', widthRange: [16, 24], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['meduse'], birds: ['ara'] },
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['crabe-geant'] },
    { kind: 'gue', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['harpie'], birds: ['ara'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['meduse'], birds: ['ara'] },
    { kind: 'descente', widthRange: [12, 18], rise: -9, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['crabe-geant', 'harpie'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['meduse', 'crabe-geant'], exitHere: true }, // PORTE au ras du sable (départ à mi-hauteur)
  ], { id: 'plage-1', name: 'Rivage de corail', biome: 'plage' })
}

// plage-2 : RÉCIF IMMERGÉ — escalier → lagon → colline (oiseaux) → corniche & vide → cascade →
// second lagon → crête aérienne+PORTE. Le plus grand récif : deux lagons, finish sur une arête haute.
function mkPlage2(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['meduse'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['crabe-geant', 'harpie'] },
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['crabe-geant'] },
    { kind: 'colline', widthRange: [18, 26], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['meduse', 'harpie'], birds: ['ara'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['relief', 'oiseaux', 'danger'], ground: ['meduse'], birds: ['ara', 'ara'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['crabe-geant'], birds: ['ara'] },
    { kind: 'bassin', widthRange: [14, 20], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['meduse'] },
    { kind: 'crete', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['harpie', 'crabe-geant'], birds: ['ara', 'ara'], exitHere: true }, // PORTE sur l'arête haute (départ à mi-hauteur)
  ], { id: 'plage-2', name: 'Récif immergé', biome: 'plage' })
}

// ─── Zone 4 refondue (PHASE MODULES) : MONTAGNE + route alternative CARRIÈRE. Même KIT DE MODULES
// que la zone 1 (src/data/level-modules.ts) : 6-10 modules collés bout à bout, silhouette COLLINES,
// ≤3 paliers, eau en cuves (marine=noyade / cascade=remontable), DÉPART à mi-hauteur, PORTE à une
// altitude ≠. Montagne = crêtes aériennes & descentes de col ; carrière = galeries de roche & fosses.
// Monstres au sol ET en hauteur (posés sur les corniches des modules élevés) + faucons en plein air.

// zone4-1 : MONTAGNE — SENTIER DES CIMES. Ascension aérienne : plateau → escalier → colline → crête
// (oiseaux) → cascade secrète → lac alpin (bassin marine) → escalier → crête sommitale + PORTE en
// haut. Deux crêtes ventées, la plus « oiseaux » de la zone.
function mkZone41(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['yeti'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['harpie'] },
    { kind: 'colline', widthRange: [16, 24], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['yeti', 'harpie'], birds: ['faucon'] },
    { kind: 'crete', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['harpie'], birds: ['faucon', 'faucon'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 3, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['louveteau'], birds: ['faucon'] },
    { kind: 'bassin', widthRange: [12, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['yeti'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée', 'combat'], ground: ['harpie', 'yeti'] },
    { kind: 'crete', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['harpie'], birds: ['faucon', 'faucon'], exitHere: true }, // PORTE tout en HAUT sur la cime (départ à mi-hauteur)
  ], { id: 'zone4-1', name: 'Sentier des cimes', biome: 'montagne' })
}

// zone4-2 : MONTAGNE — COL GLACÉ. Traversée de col avec grotte de glace et grande descente : plateau
// → escalier → crête (oiseaux) → lac gelé (bassin marine) → grotte → longue descente → colline →
// arène + PORTE en contrebas. Rythme « passage » : on monte, on s'enfonce, puis on redescend le col.
function mkZone42(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['yeti'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['harpie'] },
    { kind: 'crete', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['harpie'], birds: ['faucon', 'faucon'] },
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['yeti'] },
    { kind: 'grotte', widthRange: [12, 18], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['yeti', 'louveteau'] },
    { kind: 'descente', widthRange: [14, 20], rise: -12, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['harpie', 'yeti'] },
    { kind: 'colline', widthRange: [16, 22], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['yeti'], birds: ['faucon'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['harpie', 'yeti'], exitHere: true }, // PORTE tout en bas du col (départ à mi-hauteur)
  ], { id: 'zone4-2', name: 'Col glacé', biome: 'montagne' })
}

// carriere-1 : CARRIÈRE — TERRASSES D'EXTRACTION. Descente dans la roche : plateau → escalier
// (terrasses) → galerie (grotte) → gué de dalles au-dessus de la fosse → bassin noyé → descente →
// arène gardée + PORTE en bas. Rythme minier : pierre, gouffres, un gardien au bout.
function mkCarriere1(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['golem-de-pierre'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['gobelin-mineur', 'golem-de-pierre'] },
    { kind: 'grotte', widthRange: [12, 18], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['golem-de-pierre', 'gobelin-mineur'] },
    { kind: 'gue', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['gobelin-mineur'], birds: ['faucon'] },
    { kind: 'bassin', widthRange: [12, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['golem-de-pierre'] },
    { kind: 'descente', widthRange: [14, 20], rise: -12, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['gobelin-mineur', 'golem-de-pierre'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['gardien-pierre', 'golem-de-pierre'], exitHere: true }, // arène gardée, PORTE au fond de la carrière (départ à mi-hauteur)
  ], { id: 'carriere-1', name: 'Carrière abandonnée', biome: 'carriere' })
}

// carriere-2 : CARRIÈRE — FOSSE DES GOLEMS. Le plus enterré : plateau → fosse noyée (bassin marine)
// → galerie → escalier → seconde galerie → source claire (cascade secrète) → corniche sur le vide
// (oiseaux) → arène gardée + PORTE tout en haut (on remonte de la fosse). Deux grottes, une remontée.
function mkCarriere2(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['gobelin-mineur'], spawnHere: true },
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['golem-de-pierre'] },
    { kind: 'grotte', widthRange: [12, 18], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['golem-de-pierre', 'gobelin-mineur'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['gobelin-mineur'] },
    { kind: 'grotte', widthRange: [12, 18], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['golem-de-pierre', 'gobelin-mineur'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 3, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['gobelin-mineur'], birds: ['faucon'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['relief', 'oiseaux', 'danger'], ground: ['gobelin-mineur'], birds: ['faucon', 'faucon'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['gardien-pierre', 'golem-de-pierre'], exitHere: true }, // PORTE tout en HAUT, sortie de la fosse (départ à mi-hauteur)
  ], { id: 'carriere-2', name: 'Fosse des golems', biome: 'carriere' })
}

// ─── Zone 5 — CIMETIÈRE (refondue PHASE MODULES) ────────────────────────────────────────────
// Ambiance sombre : tombes, tunnels, arêtes battues par les vents, embuscades. Eau en cuves
// (bassin marine = noyade, cascade claire remontable). Oiseau = harfang-spectral. DÉPART à
// mi-hauteur, PORTE à altitude ≠. Deux rythmes DISTINCTS entre 5-1 et 5-2.

// zone5-1 : NÉCROPOLE — plateau → descente vers les tombes → grotte → bassin d'apnée → corniche &
// vide (harfangs) → cascade secrète → colline (spectre-ancien) → arène+PORTE. Rythme « on s'enfonce
// dans la nécropole » : chute contrôlée, tunnel, embuscade en hauteur, climax d'arène.
function mkZone51(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['squelette'], spawnHere: true },
    { kind: 'descente', widthRange: [14, 20], rise: -8, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['goule', 'squelette'] },
    { kind: 'grotte', widthRange: [14, 20], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['fantome', 'goule'] },
    { kind: 'bassin', widthRange: [14, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['banshee'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['relief', 'oiseaux', 'danger'], ground: ['goule'], birds: ['harfang-spectral'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 3, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['fantome'], birds: ['harfang-spectral'] },
    { kind: 'colline', widthRange: [18, 26], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['spectre-ancien', 'goule'], birds: ['harfang-spectral'] },
    { kind: 'descente', widthRange: [16, 22], rise: -12, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['pretre-goule', 'banshee'], exitHere: true }, // gradins vers la fosse-arène, PORTE en contrebas (altitude ≠ départ)
  ], { id: 'zone5-1', name: 'Nécropole oubliée', biome: 'cimetiere' })
}

// zone5-2 : CRYPTES HURLANTES — plateau → gué → arête (harfangs) → bassin → escalier montant →
// corniche & vide → grotte → cascade secrète → arête+PORTE. Rythme AÉRIEN et sinueux : gouffres,
// arêtes fines au-dessus du vide, vagues de banshees, double eau.
function mkZone52(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['banshee'], spawnHere: true },
    { kind: 'gue', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['goule'], birds: ['harfang-spectral'] },
    { kind: 'crete', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['fantome'], birds: ['harfang-spectral', 'harfang-spectral'] },
    { kind: 'bassin', widthRange: [14, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['banshee'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['squelette', 'goule'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['relief', 'oiseaux', 'danger'], ground: ['goule'], birds: ['harfang-spectral'] },
    { kind: 'grotte', widthRange: [14, 20], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['pretre-goule', 'fantome'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['banshee'], birds: ['harfang-spectral'] },
    { kind: 'crete', widthRange: [16, 22], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['spectre-ancien'], birds: ['harfang-spectral'], exitHere: true },
  ], { id: 'zone5-2', name: 'Cryptes hurlantes', biome: 'cimetiere' })
}

// ─── Zone 6 — ENFER (refondue PHASE MODULES) ────────────────────────────────────────────────
// zone6-1 : SENTIER DES DAMNÉS — plateau → escalier (corbeaux) → rivière de feu (bassin) → corniche
// & vide → goulet gardé (gardien-flamme) → cascade secrète → grotte (mini-baphomet) → volée de
// corbeaux → descente vers l'arène-climax (dragon-flamme)+PORTE. Le plus long : ascension
// infernale, embuscades aériennes, chokepoint gardé. Oiseau = corbeau.
function mkZone61(): LevelDef {
  return buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['diablotin'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['gargouille', 'diablotin'], birds: ['corbeau'] },
    { kind: 'bassin', widthRange: [14, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['mage-noir'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['relief', 'oiseaux', 'danger'], ground: ['diablotin'], birds: ['corbeau', 'corbeau'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat', 'danger'], ground: ['gardien-flamme', 'gargouille'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 3, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['mage-noir'], birds: ['corbeau'] },
    { kind: 'grotte', widthRange: [14, 20], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['mini-baphomet', 'diablotin'] },
    { kind: 'volee', widthRange: [16, 24], fillBelow: 'sol', fillAbove: 'air', tags: ['oiseaux', 'danger'], ground: ['gargouille'], birds: ['corbeau', 'corbeau', 'corbeau'] },
    { kind: 'descente', widthRange: [16, 22], rise: -14, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['dragon-flamme', 'gargouille'], exitHere: true }, // longue dévalade vers l'arène-climax, PORTE en contrebas (altitude ≠ départ)
  ], { id: 'zone6-1', name: 'Sentier des Damnés', biome: 'enfer' })
}

const list: LevelDef[] = [
  mkZone11(),
  mkZone12(),
  mkZone13(),
  mkZone14(),
  { id: 'zone1-boss', name: 'Antre du Roi Gloopy', biome: 'foret', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'roi-gloopy' },
  // zone2-1 : DÉSERT (KIT MODULES) — Dunes de Sograt. Rythme dunaire : plateau (départ mi-hauteur) →
  // gué de dunes → colline/vista → oasis marine (apnée) → montée → corniche & vide (faucons) →
  // descente de combat → arène + PORTE en contrebas, au sol (altitude ≠ départ).
  buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['scorpion'], spawnHere: true },
    { kind: 'gue', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['scorpion'], birds: ['faucon'] },
    { kind: 'colline', widthRange: [18, 26], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['vautour', 'momie'], birds: ['faucon'] },
    { kind: 'bassin', widthRange: [12, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['momie'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['orc-guerrier'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['relief', 'oiseaux', 'danger'], ground: ['scorpion'], birds: ['faucon', 'faucon'] },
    { kind: 'descente', widthRange: [14, 20], rise: -12, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['orc-guerrier', 'vautour'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['scorpion', 'orc-seigneur'], exitHere: true }, // orc-seigneur = élite MVP en climax
  ], { id: 'zone2-1', name: 'Dunes de Sograt', biome: 'desert' }),
  // zone2-2 : DÉSERT (KIT MODULES) — Oasis perdue. Rythme aquatique : plateau (départ) → colline →
  // cascade claire secrète (remontable) → grande oasis marine (apnée) → gué → volée de faucons →
  // montée → arène + PORTE en HAUT (altitude ≠ départ).
  buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['scorpion'], spawnHere: true },
    { kind: 'colline', widthRange: [16, 24], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['vautour'], birds: ['faucon'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['momie'], birds: ['faucon'] },
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['momie'] },
    { kind: 'gue', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['scorpion'], birds: ['faucon'] },
    { kind: 'volee', widthRange: [16, 24], fillBelow: 'sol', fillAbove: 'air', tags: ['oiseaux', 'danger'], ground: ['scorpion'], birds: ['faucon', 'faucon', 'faucon'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['orc-guerrier'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['momie', 'vautour'], exitHere: true },
  ], { id: 'zone2-2', name: 'Oasis perdue', biome: 'desert' }),
  // zone2-3 : DÉSERT (KIT MODULES) — Vallée des tombeaux. Rythme sépulcral : plateau (départ) →
  // montée → grotte (tunnel de roche) → descente de combat → gué → oasis marine → remontée →
  // crête aérienne haute (faucons) + PORTE (altitude ≠ départ).
  buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['momie'], spawnHere: true },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['zombie'], birds: ['faucon'] },
    { kind: 'grotte', widthRange: [12, 18], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['momie', 'zombie'] },
    { kind: 'descente', widthRange: [14, 20], rise: -8, fillBelow: 'sol', fillAbove: 'air', tags: ['relief', 'combat'], ground: ['mini-baphomet', 'zombie'] }, // mini-baphomet = élite cornue des tombeaux
    { kind: 'gue', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'danger'], ground: ['vautour'], birds: ['faucon'] },
    { kind: 'bassin', widthRange: [12, 18], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['zombie'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 6, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['momie'] },
    { kind: 'crete', widthRange: [14, 20], fillBelow: 'vide', fillAbove: 'air', tags: ['traversée', 'oiseaux', 'danger'], ground: ['vautour'], birds: ['faucon', 'faucon'], exitHere: true },
  ], { id: 'zone2-3', name: 'Vallée des tombeaux', biome: 'desert' }),
  // cave-1 : CAVE (KIT MODULES) — Cave aux échos. Rythme souterrain : plateau (départ) → colline →
  // cascade claire secrète (remontable) → lac marin souterrain (apnée) → grotte (boyau de roche) →
  // gouffre à corniches (corbeaux) → montée → arène + PORTE (altitude ≠ départ).
  buildLevelFromModules([
    { kind: 'plateau', widthRange: [12, 16], fillBelow: 'sol', fillAbove: 'air', tags: ['respiration'], ground: ['chauve-souris'], spawnHere: true },
    { kind: 'colline', widthRange: [16, 24], rise: 0, fillBelow: 'sol', fillAbove: 'air', tags: ['relief'], ground: ['squelette'], birds: ['corbeau'] },
    { kind: 'cascade', widthRange: [18, 24], rise: 2, fillBelow: 'cascade', fillAbove: 'air', tags: ['eau', 'montée', 'secret'], ground: ['fantome'], birds: ['corbeau'] },
    { kind: 'bassin', widthRange: [16, 22], fillBelow: 'marine', fillAbove: 'air', tags: ['eau', 'danger'], ground: ['squelette'] },
    { kind: 'grotte', widthRange: [12, 18], fillBelow: 'roche', fillAbove: 'roche', tags: ['relief', 'danger'], ground: ['mage-noir', 'chauve-souris'] },
    { kind: 'corniche-vide', widthRange: [16, 24], fillBelow: 'vide', fillAbove: 'air', tags: ['relief', 'oiseaux', 'danger'], ground: ['squelette'], birds: ['corbeau', 'corbeau'] },
    { kind: 'escalier', widthRange: [14, 20], rise: 5, fillBelow: 'sol', fillAbove: 'air', tags: ['montée'], ground: ['fantome'] },
    { kind: 'arene', widthRange: [16, 22], fillBelow: 'sol', fillAbove: 'air', tags: ['combat'], ground: ['mage-noir', 'squelette', 'chauve-souris'], exitHere: true },
  ], { id: 'cave-1', name: 'Cave aux échos', biome: 'cave' }),
  { id: 'zone2-boss', name: 'Pyramide du Pharaon', biome: 'desert', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'pharaon-scarabee' },
  // Zone 3 — jungle (+ route alternative plage) — refondue PHASE MODULES (cf. mkZone31/mkZone32).
  mkZone31(),
  mkZone32(),
  { id: 'zone3-boss', name: 'Cœur de la Jungle', biome: 'jungle', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'seigneur-liane' },
  // Route alternative PLAGE — refondue PHASE MODULES (cf. mkPlage1/mkPlage2).
  mkPlage1(),
  mkPlage2(),
  // Zone 4 — montagne (+ route alternative carrière) — REFONDUE PAR MODULES (voir mkZone41/42 ci-dessus)
  mkZone41(),
  mkZone42(),
  { id: 'zone4-boss', name: 'Pic du Golem Ancien', biome: 'montagne', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'golem-ancien' },
  // carriere-1 / carriere-2 : route alternative CARRIÈRE — REFONDUE PAR MODULES (voir mkCarriere1/2 ci-dessus)
  mkCarriere1(),
  mkCarriere2(),
  // Zone 5 — cimetière (refondue PHASE MODULES ; cf. mkZone51 / mkZone52 ci-dessus)
  mkZone51(),
  mkZone52(),
  { id: 'zone5-boss', name: 'Trône du Roi Liche', biome: 'cimetiere', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'roi-liche' },
  // Zone 6 — enfer (refondue PHASE MODULES ; cf. mkZone61 ci-dessus)
  mkZone61(),
  { id: 'zone6-boss', name: 'Antre du Seigneur Déchu', biome: 'enfer', widthTiles: 40,
    platforms: [plat(8, 10, 4), plat(28, 10, 4)],
    spawns: [], boss: 'seigneur-dechu' },
]

export const LEVELS: Record<string, LevelDef> = Object.fromEntries(list.map((l) => [l.id, l]))
