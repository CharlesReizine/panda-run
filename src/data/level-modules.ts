// ─── KIT DE MODULES DE NIVEAU (couche d'authoring) ──────────────────────────────────────────
// Voir docs/level-module-kit.md. On décrit un niveau comme une LISTE DE MODULES composables posés
// bout à bout (gauche → droite). L'assembleur `buildLevelFromModules` tire une largeur déterministe
// dans chaque [min,max], accroche altSortie(N) ≈ altEntrée(N+1) (rebasage automatique de l'altitude
// courante → jamais de marche infranchissable), remplit chaque colonne selon fillBas/fillHaut, puis
// EXPAND vers la structure LevelDef existante (platforms/hazards/gaps/bridges/spawns/props/start/exit).
//
// PRINCIPE DE JOUABILITÉ (correct-par-construction) :
// - la surface marchable est une POLYLIGNE de paliers (steps) reliés par des marches ≤ 3 rangées,
//   horizontalement adjacentes → chaque palier est atteignable du précédent au saut simple, et la
//   chaîne part du SOL (alt 0) → tout est atteignable (reachable.test vert sans échelle).
// - chaque module a des BERGES solides à l'entrée et à la sortie (jonctions toujours praticables).
// - l'eau est TOUJOURS en cuve de pierre : 'marine' (bleu marine, noyade) ou 'cascade' (bleu clair,
//   REMONTABLE, pas de noyade) — jamais de nappe libre. Les murs/fond sont posés par le moteur.
// - silhouette COLLINES : on monte puis on redescend ; ≤ 3 paliers empilés partout ; hauteur du
//   monde = enveloppe des modules (souvent ~22-34 tuiles, pas de tour géante).

import type { LevelDef } from './levels'
import { MIN_LADDER_TILES, MAX_LADDER_TILES } from '../core/platforming'

// altitude = nombre de rangées AU-DESSUS du sol (0 = surface du sol). row = groundRow - alt.
// 'lave' = cuve de LAVE (enfer) : rendu rouge/orange incandescent, MORTELLE au contact (gros dégâts
// continus, cf. LevelScene.updateLava) — géométriquement une cuve de pierre comme 'marine', mais sans
// coffre de plongée (plonger = mourir).
export type Fill = 'air' | 'sol' | 'roche' | 'vide' | 'marine' | 'cascade' | 'lave' | 'pics'

// PHASE 2 — CATALOGUE ÉTENDU. On GARDE les 12 kinds historiques (les 15 niveaux non refondus en
// dépendent) et on AJOUTE ceux du catalogue user (docs/level-module-kit.md §PHASE 2), dédupliqués.
// Chaque kind porte des métadonnées de composition dans CATALOG (tier, famille, tags entrée/sortie,
// largeur variable). Les motifs à ÉCHELLE (flag ladder) réintroduisent la mécanique d'escalade.
export type ModuleKind =
  // historiques (12)
  | 'plateau' | 'colline' | 'escalier' | 'descente' | 'gue' | 'corniche-vide'
  | 'bassin' | 'cascade' | 'grotte' | 'arene' | 'crete' | 'volee'
  // fillers / respiration (D1)
  | 'ligne-droite' | 'marche' | 'descente-douce' | 'couloir-large' | 'petit-pont'
  | 'echelle-tranquille' | 'balcon' | 'double-sol'
  // traversée horizontale (D1–D3)
  | 'gap-grandissant' | 'ilots-reguliers' | 'ilots-irreguliers' | 'trou-filet' | 'pas-japonais' | 'triple-saut'
  // vertical / étages (D2–D4)
  | 'zigzag' | 'cage-echelles' | 'echelle-vs-sauts' | 'descente-controlee' | 'tour-creuse'
  // risque / récompense (D2–D4)
  | 'chemin-double' | 'detour-balcon' | 'fausse-sortie' | 'tresor-bassin'
  // tension / précision (D3–D5) — PHASE 2b : le moteur rend désormais les pics sur N'IMPORTE QUELLE
  // surface élevée (corniche/plateforme), pas seulement au sol → les motifs à PICS en hauteur sont
  // activés. Dégâts/overlap identiques quelle que soit la hauteur.
  | 'echelle-exposee' | 'couloir-pics' | 'pics-quinconce' | 'atterrissage-etroit' | 'faux-plat'
  // escaliers de PIERRE rigides (blocs solides isolés) — distincts des marches de TERRE one-way
  | 'escalier-pierre'
  // eau / cascade (D2–D4)
  | 'sortie-humide'
  // passage SOUS-MARIN : plonger par le haut d'un lac, ressortir sur le côté immergé
  | 'passage-immerge'

// Tier de difficulté (D1..D5) et tags d'accroche : altitude du bord GAUCHE (entrée) / DROIT (sortie).
export type Tier = 1 | 2 | 3 | 4 | 5
export type EdgeTag = 'bas' | 'milieu' | 'haut'
// Famille de composition (pour le DOSAGE par niveau, cf. composeLevel).
export type Family = 'filler' | 'traverse' | 'vertical' | 'risque' | 'tension'

export interface Module {
  kind: ModuleKind
  widthRange: [number, number] // largeur en tuiles (on tire dedans, déterministe)
  // delta d'altitude du module (exit - entry, en rangées) : l'assembleur rebase l'entrée sur
  // l'altitude courante, donc seul le DELTA compte (l'accroche est automatique).
  rise?: number
  fillBelow: Fill // sous la surface (sol/roche = solide, vide = trou mortel, marine/cascade = cuve)
  fillAbove: Fill // au-dessus (air par défaut, roche = plafond/grotte)
  tags: string[]
  // peuplement : ids de monstres terrestres (posés sur la surface) et aériens (oiseaux) — l'assembleur
  // les répartit sur la portée du module. Les coffres (secret) sont posés par le générateur du kind.
  ground?: string[]
  birds?: string[]
  spawnHere?: boolean // départ du joueur dans ce module (posé à mi-portée sur la surface)
  exitHere?: boolean // PORTE de sortie dans ce module
  // métadonnées (déduites de CATALOG si absentes) — servent au dosage / à la courbe de difficulté.
  tier?: Tier
  entry?: EdgeTag
  exit?: EdgeTag
}

// ─── RNG déterministe (mulberry32) : pas de Math.random (interdit) ──────────────────────────
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SIMPLE_JUMP_ROWS = 3 // marche maximale garantie au saut simple (rise ≈ 96px < 130px)

// ─── Représentation intermédiaire en espace ALTITUDE (converti en rows à la fin) ────────────
interface Piece {
  // `solid` : marche de PIERRE rigide (collision pleine, isolée pour ne pas coincer) ; absent = TERRE
  // one-way (traversable par le bas).
  platforms: { x: number; alt: number; w: number; solid?: boolean }[]
  // DALLES DE ROCHE : rectangle plein de altBot à altTop (altitudes inclusives). Sert au PLAFOND DE
  // ROCHE d'un tunnel (grotte : roche au-dessus de la surface, avec un dégagement >= saut confortable
  // → on ne se cogne jamais) et au remplissage plein sous le sol de la grotte / sous la bande de départ
  // (mesa). `solid` : le PLAFOND est une COLLISION pleine (on ne saute pas à travers) ; absent = socle
  // décoratif sous le sol (aucune collision).
  rocks: { x: number; altBot: number; altTop: number; w: number; solid?: boolean }[]
  gaps: { x: number; w: number }[]
  // pics : alt = altitude de la SURFACE qui porte les pics (corniche en hauteur). Absent → pics au sol.
  spikes: { x: number; w: number; alt?: number }[]
  bridges: { x: number; alt: number; w: number }[]
  // cuves d'eau : marine (noyade), cascade (remontable) ou lave (mortelle, enfer). bankAlt = rangée des
  // berges (surface juste dessous) ; le liquide descend jusqu'au sol (fond). Le moteur pose murs + fond + déco.
  // `openSide` : ouvre une paroi (passage sous-marin — on ressort par le côté immergé).
  waters: { x: number; w: number; kind: 'marine' | 'cascade' | 'lave'; bankAlt: number; openSide?: 'left' | 'right' | 'both' }[]
  // ÉCHELLES : montant vertical de topAlt (haut) jusqu'à topAlt-h (pied). h∈[MIN,MAX]_LADDER_TILES.
  // Correct-par-construction : pied posé sur une surface + palier de sortie 2 rangées sous le sommet.
  ladders: { x: number; topAlt: number; h: number }[]
  spawns: { monsterId: string; x: number; alt?: number; aerial?: boolean }[]
  props: { kind: string; x: number; alt?: number }[]
  start?: { x: number; alt: number }
  exit?: { x: number; alt: number }
  exitAlt: number // altitude de sortie (pour chaîner le module suivant)
}

function emptyPiece(exitAlt: number): Piece {
  return { platforms: [], rocks: [], gaps: [], spikes: [], bridges: [], waters: [], ladders: [], spawns: [], props: [], exitAlt }
}

// Dégagement libre (en rangées) garanti sous un PLAFOND DE ROCHE de tunnel : strictement supérieur à
// la hauteur de saut (≈ 4 tuiles) + la taille du panda, pour qu'il traverse le boyau sans se cogner
// (le plafond n'a AUCUNE collision, mais on garde un vrai vide pour que ça reste jouable et lisible).
const CAVE_CLEARANCE = 6
const CAVE_CEILING_THICK = 6 // épaisseur de la dalle de plafond (rangées de roche pleine) — plus épais

// ─── SOCLE DE PIERRE sous les surfaces pleines (chantier « fini le gazon empilé ») ──────────
// Sous la COIFFE marchable d'une surface PLEINE (biome en haut, ~1 tuile), on remplit le CORPS
// avec de la ROCHE (rendue en texture rocheuse, cf. LevelScene) qui DESCEND jusqu'au sol du monde
// → des FALAISES / MESAS de pierre à coiffe de biome, plus jamais de dalle de gazon qui flotte.
// Ne s'applique QU'AUX modules à fond plein/eau (sol/marine/cascade/lave) : les corniches
// au-dessus d'un TROU ('vide') et les plafonds de grotte ('roche') gardent leur rendu (elles
// DOIVENT flotter / sont déjà pleines). Les colonnes d'EAU restent OUVERTES (on ne bouche pas la
// cuve/la cascade). Purement RENDU (rockBands sans collision) → la jouabilité ne change pas.
function addPedestals(p: Piece, w: number) {
  // altitude de la plateforme la PLUS BASSE par colonne = la coiffe marchable de la silhouette.
  // Les plateformes BONUS (balcon/leurre/palier d'échelle), toujours plus HAUTES qu'un sol qui les
  // porte, ne sont jamais la plus basse → elles ne reçoivent PAS de socle et restent fines.
  const floorAlt = new Array<number>(w).fill(0)
  for (const pl of p.platforms) {
    for (let x = Math.max(0, pl.x); x < Math.min(w, pl.x + pl.w); x++) {
      if (floorAlt[x] === 0 || pl.alt < floorAlt[x]!) floorAlt[x] = pl.alt
    }
  }
  const blocked = (x: number) =>
    p.gaps.some((g) => x >= g.x && x < g.x + g.w) ||
    p.waters.some((wt) => x >= wt.x && x < wt.x + wt.w)
  // fusionne les colonnes de même altitude de coiffe en une seule bande de roche (1 → alt-1)
  let runX = -1
  let runAlt = 0
  const flush = (endX: number) => {
    // altBot 0 : le socle descend jusque DANS la bande de sol du monde (pas de liseré de fond
    // visible entre le bas de la falaise et le sol). Rendu derrière le sol (depth), sans collision.
    if (runX >= 0 && runAlt >= 2) p.rocks.push({ x: runX, altBot: 0, altTop: runAlt - 1, w: endX - runX })
    runX = -1
    runAlt = 0
  }
  for (let x = 0; x < w; x++) {
    const a = blocked(x) ? 0 : floorAlt[x]!
    if (a >= 2 && a === runAlt) continue
    flush(x)
    if (a >= 2) { runX = x; runAlt = a }
  }
  flush(w)
}

// ─── PLAFOND DE GROTTE VARIÉ (chantier « plafonds de grotte trop plats ») ────────────────────
// Rend le plafond de roche d'un tunnel avec un bord inférieur ONDULÉ (dents / marches / vagues)
// au lieu d'une ligne plate. Le sommet reste commun (masse connectée, épaisse) ; seul le BAS varie.
// Le dégagement libre reste TOUJOURS > saut (min 5 rangées > maxJump ≈ 4) → on traverse le boyau
// sans jamais se cogner. Purement RENDU (rockBands sans collision). `variant` ∈ {0,1,2}.
function pushVariedCeiling(p: Piece, w: number, alt: number, variant: number) {
  const base = alt + CAVE_CLEARANCE // dégagement de base (6 rangées)
  const topAlt = base + CAVE_CEILING_THICK + 2 // sommet commun → dalle pleine et connectée
  const seg = 4
  let i = 0
  for (let x = 0; x < w; x += seg, i++) {
    const sw = Math.min(seg, w - x)
    // offset du bord inférieur : négatif = DENT qui pend (dégagement plus court, jamais < 5),
    // positif = RECREUSE (plus de dégagement). Amplitude bornée [-1, +2] → dégagement ∈ [5, 8].
    let off: number
    if (variant === 0) off = i % 2 === 0 ? -1 : 2 // DENTS / créneaux
    else if (variant === 1) off = [0, 1, 2, 1][i % 4]! // MARCHES
    else off = [2, 1, 0, 1][i % 4]! // ONDULATION douce
    // PLAFOND SOLIDE : collision pleine → on ne saute pas à travers (le dégagement reste > saut).
    p.rocks.push({ x, altBot: base + off, altTop: topAlt, w: sw, solid: true })
  }
}

// Rampe de paliers : suite de plateformes ADJACENTES de fromAlt à toAlt par marches ≤3 rangées.
// Les alt ≤ 0 (niveau du sol) ne posent PAS de plateforme (on marche sur le sol) — sauf si
// keepGround (utile quand le sol est gappé et qu'il faut une vraie plateforme).
function ramp(x0: number, w: number, fromAlt: number, toAlt: number, keepGround = false): { x: number; alt: number; w: number }[] {
  const diff = toAlt - fromAlt
  const count = Math.max(1, Math.ceil(Math.abs(diff) / SIMPLE_JUMP_ROWS))
  const step = diff / count
  const segW = Math.max(3, Math.floor(w / count))
  const out: { x: number; alt: number; w: number }[] = []
  let x = x0
  for (let i = 0; i < count; i++) {
    const alt = Math.round(fromAlt + step * (i + 1))
    const segw = i === count - 1 ? x0 + w - x : segW
    if (segw <= 0) break
    if (alt >= 1 || keepGround) out.push({ x, alt: Math.max(keepGround ? 0 : 1, alt), w: segw })
    x += segw
  }
  return out
}

// répartit n items sur la portée [0,w) à des x réguliers (déterministe)
function spread(w: number, n: number): number[] {
  if (n <= 0) return []
  return Array.from({ length: n }, (_, i) => Math.round((w * (i + 1)) / (n + 1)))
}

// hauteur d'échelle bornée à [MIN,MAX]_LADDER_TILES (le validateur casse hors de cet intervalle).
const LADDER_H = Math.max(MIN_LADDER_TILES, Math.min(9, MAX_LADDER_TILES))

// ─── ÉCHELLES (motifs correct-par-construction) ─────────────────────────────────────────────
// Pose UN étage d'escalade : une plateforme-PIED à footAlt qui couvre le montant, un MONTANT de h
// tuiles (h∈[MIN,MAX]), et un PALIER DE SORTIE posé 2 rangées SOUS le sommet (drop=2, la règle du
// décalage pieds↔centre du panda — cf. level-validator.isLadderTop), horizontalement collé au
// montant. Le palier s'étend jusqu'à `landRight` pour raccorder la sortie du module. Renvoie
// l'altitude du palier (= altitude de sortie de l'escalade).
function poseLadder(p: Piece, xLad: number, footAlt: number, footX0: number, footW: number, landRight: number, h = LADDER_H): number {
  const fa = Math.max(1, footAlt)
  p.platforms.push({ x: footX0, alt: fa, w: footW }) // pied de l'échelle (surface d'accès)
  return poseLadderOn(p, xLad, fa, landRight, h)
}

// Ajoute un montant + palier de sortie SUR une surface de pied DÉJÀ posée à footAlt (couvrant xLad).
function poseLadderOn(p: Piece, xLad: number, footAlt: number, landRight: number, h = LADDER_H): number {
  const topAlt = footAlt + h
  p.ladders.push({ x: xLad, topAlt, h })
  const landAlt = topAlt - 2 // palier atteignable : 2 rangées sous le haut du montant (décalage pieds)
  p.platforms.push({ x: xLad, alt: landAlt, w: Math.max(4, landRight - xLad) }) // palier collé au montant
  return landAlt
}

// TOUR D'ÉCHELLES en LACET (cage / puits) : `stages` étages échelle+palier, l'échelle suivante part
// du bout du palier précédent (quinconce) → jamais plus de 2 paliers empilés (+ sol = 3). Renvoie
// l'altitude du palier de sommet.
function poseTower(p: Piece, w: number, entryAlt: number, stages: number): number {
  const seg = Math.max(6, Math.floor((w - 4) / (stages + 1)))
  let footAlt = Math.max(1, entryAlt)
  p.platforms.push({ x: 0, alt: footAlt, w: seg + 2 }) // plateforme-pied initiale
  let x = 2
  for (let i = 0; i < stages; i++) {
    const isLast = i === stages - 1
    const landRight = isLast ? w : Math.min(w, x + seg + 2)
    footAlt = poseLadderOn(p, x, footAlt, landRight)
    x = Math.min(w - 3, landRight - 2) // prochaine échelle au bout du palier
  }
  return footAlt
}

// ─── Générateur d'un module (espace altitude, x local 0..w) ─────────────────────────────────
function buildModule(m: Module, rng: () => number, w: number, entryAlt: number): Piece {
  const bank = 3 // largeur des berges solides d'entrée/sortie
  // DÉPART TOUJOURS SÛR : le module de spawn ne pose AUCUN monstre (ni au sol, ni en l'air) → le
  // panda apparaît seul sur son plateau. La marge de sécurité autour du x de départ est en plus
  // garantie globalement par l'assembleur (voir SAFE_SPAWN_TILES).
  const groundMobs = m.spawnHere ? [] : (m.ground ?? [])
  const birds = m.spawnHere ? [] : (m.birds ?? [])
  const p = emptyPiece(entryAlt)
  const rise = m.rise ?? 0
  const exitAlt = Math.max(0, entryAlt + rise)
  p.exitAlt = exitAlt
  // CUVE marine par défaut, sauf si le module est déclaré 'lave' (enfer) : la lave est mortelle et ne
  // porte JAMAIS de coffre de plongée (y plonger = mourir), à la différence de la marine (apnée + trésor).
  const basinKind: 'marine' | 'lave' = m.fillBelow === 'lave' ? 'lave' : 'marine'

  // pose les monstres terrestres sur la surface (alt lue plus bas selon le kind) et les oiseaux en l'air
  const placeBirds = (surfaceAlt: number) => {
    const xs = spread(w, birds.length)
    birds.forEach((id, i) => p.spawns.push({ monsterId: id, x: xs[i]!, alt: surfaceAlt + 6 + (i % 2) * 2, aerial: true }))
  }

  switch (m.kind) {
    case 'plateau':
    case 'arene': {
      const alt = entryAlt
      if (alt >= 1) p.platforms.push({ x: 0, alt, w })
      placeBirds(alt)
      p.exitAlt = alt
      break
    }
    case 'colline': {
      const peak = entryAlt + Math.max(3, 3 + Math.floor(rng() * 4))
      const half = Math.floor(w / 2)
      p.platforms.push(...ramp(0, half, entryAlt, peak))
      p.platforms.push(...ramp(half, w - half, peak, exitAlt))
      placeBirds(peak)
      break
    }
    case 'escalier':
    case 'descente': {
      p.platforms.push(...ramp(0, w, entryAlt, exitAlt))
      placeBirds(Math.max(entryAlt, exitAlt))
      break
    }
    case 'gue': {
      // gués : berges + pas de pierre au-dessus du VIDE (trous mortels ≤3 tuiles). Surface à alt courante.
      const alt = entryAlt
      const stoneW = 4, gapW = 3
      let x = 0
      if (alt >= 1) p.platforms.push({ x: 0, alt, w: bank }); x = bank
      while (x < w - bank - gapW) {
        p.gaps.push({ x, w: gapW }) // trou dans le sol
        x += gapW
        const sw = Math.min(stoneW, w - bank - x)
        if (sw <= 0) break
        if (alt >= 1) p.platforms.push({ x, alt, w: sw })
        x += sw
      }
      if (alt >= 1) p.platforms.push({ x: Math.max(x, w - bank), alt, w: bank }) // berge droite
      placeBirds(alt + 2)
      p.exitAlt = alt
      break
    }
    case 'corniche-vide':
    case 'crete': {
      // corniches/arête larges au-dessus d'un trou mortel + oiseaux. Berges solides à l'entrée/sortie,
      // VIDE (trous dans le sol) sur toute la zone centrale, corniches suspendues CONTIGUËS (hgap ≤3,
      // reliées de berge à berge → chaîne atteignable) à alt ~courant, légère ondulation.
      const alt = Math.max(entryAlt, m.kind === 'crete' ? 4 : 3)
      const bw = bank
      p.platforms.push({ x: 0, alt, w: bw }) // berge gauche
      const rightBergeX = w - bw
      // trou mortel sous toute la zone centrale (tranches de 3 tuiles, chacune franchissable)
      for (let gx = bw; gx < rightBergeX; gx += 3) p.gaps.push({ x: gx, w: Math.min(3, rightBergeX - gx) })
      // corniches larges 4, hgap 3 → chaîne saut simple ; dernière corniche flush à la berge droite
      let x = bw
      let toggle = 0
      const pw = 4
      while (x + pw < rightBergeX) {
        const calt = Math.max(2, alt - (toggle % 2))
        // clampe la largeur pour finir juste avant la berge droite
        const pwn = Math.min(pw, rightBergeX - x)
        p.platforms.push({ x, alt: calt, w: pwn })
        x += pwn + 3 // gap de 3 (≤ saut simple) jusqu'à la corniche suivante
        toggle++
      }
      // corniche de raccord flush à la berge droite si le dernier saut serait trop long
      if (rightBergeX - x > 0 && rightBergeX - x <= 4) p.platforms.push({ x, alt, w: rightBergeX - x })
      p.platforms.push({ x: rightBergeX, alt, w: bw }) // berge droite
      placeBirds(alt + 3)
      p.exitAlt = alt
      break
    }
    case 'bassin': {
      // cuve marine profonde en VALLÉE : berges hautes reliées par rampes, eau profonde au milieu
      // (murs rigides posés par le moteur), pont à trou central, coffre au FOND (plongée/apnée,
      // noyade). Berges 4 rangées au-dessus de l'entrée → eau vraiment profonde.
      const bankAlt = entryAlt + 4
      const rampW = 5
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt)) // berge gauche montante
      const wx = rampW, ww = w - 2 * rampW
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt })
      // pont à bankAlt en 2 segments avec un trou central de 3 tuiles (on plonge par le trou)
      const holeL = wx + Math.floor(ww / 2) - 1
      if (holeL - wx > 0) p.bridges.push({ x: wx, alt: bankAlt, w: holeL - wx })
      if (wx + ww - (holeL + 3) > 0) p.bridges.push({ x: holeL + 3, alt: bankAlt, w: wx + ww - (holeL + 3) })
      p.platforms.push(...ramp(wx + ww, w - (wx + ww), bankAlt, exitAlt)) // berge droite descendante
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) }) // au fond (sol) — jamais dans la lave
      placeBirds(bankAlt + 2)
      break
    }
    case 'cascade': {
      // cascade claire REMONTABLE (bleu clair, pas de noyade) : depuis la corniche BASSE on saute dans
      // la colonne et le courant ASCENDANT nous porte vers la corniche HAUTE + coffre secret. Une
      // RAMPE DE PALIERS parallèle garantit l'accès à la corniche haute au saut simple (reachable.test) ;
      // la cascade est le raccourci fun.
      const low = Math.max(entryAlt, 1)
      const top = low + Math.max(4, 4 + Math.floor(rng() * 2))
      // allocation séquentielle des portées (jamais de débordement) : corniche basse | colonne (2) |
      // rampe montante | corniche haute (5) | rampe de redescente jusqu'au bord droit.
      const L = Math.max(4, Math.floor(w * 0.22))
      const cornW = 5
      const upW = Math.max(4, Math.min(Math.floor(w * 0.3), w - L - 2 - cornW - 2))
      p.platforms.push({ x: 0, alt: low, w: L }) // corniche basse d'accès
      p.waters.push({ x: L, w: 2, kind: 'cascade', bankAlt: top }) // colonne de cascade (remontée fun + chute mortelle au fond)
      p.platforms.push(...ramp(L + 2, upW, low, top)) // rampe montante (accès garanti), sautée par-dessus la colonne
      const topX = L + 2 + upW
      p.platforms.push({ x: topX, alt: top, w: cornW }) // corniche haute (sortie de cascade)
      p.props.push({ kind: 'coffre', x: topX + 2, alt: top + 1 }) // coffre POSÉ sur la corniche (1 rangée au-dessus)
      const downStart = topX + cornW
      if (w - downStart >= 1) p.platforms.push(...ramp(downStart, w - downStart, top, exitAlt)) // redescente vers la sortie
      placeBirds(top + 2)
      break
    }
    case 'grotte': {
      // VRAI TUNNEL FERMÉ (phase 2b) : roche PLEINE au-dessus ET en dessous de la surface marchable.
      // - sol de roche marchable à `alt` ;
      // - remplissage plein SOUS le sol (de la surface jusqu'au bas du monde) → « tout pierre dessous » ;
      // - PLAFOND DE ROCHE au-dessus, laissant un dégagement CAVE_CLEARANCE (> saut confortable) pour
      //   qu'on traverse le boyau sans se cogner (plafond sans collision, purement visuel).
      const alt = Math.max(entryAlt, 2)
      if (alt >= 1) p.platforms.push({ x: 0, alt, w })
      // socle plein sous la surface (jusqu'au niveau du sol du monde ; le reste est fermé par le sol)
      if (alt - 1 >= 1) p.rocks.push({ x: 0, altBot: 1, altTop: alt - 1, w })
      // PLAFOND DE ROCHE VARIÉ (dents/marches/vagues) au lieu d'une dalle plate
      pushVariedCeiling(p, w, alt, Math.floor(rng() * 3))
      p.exitAlt = alt
      break
    }
    case 'volee': {
      // plein air envahi d'oiseaux, abris épars au sol. Surface à alt courant, quelques plateformes-abris.
      const alt = entryAlt
      if (alt >= 1) p.platforms.push({ x: 0, alt, w })
      const shelters = spread(w, 3)
      shelters.forEach((sx, i) => p.platforms.push({ x: Math.max(0, sx - 2), alt: alt + 3 + (i % 2), w: 4 }))
      placeBirds(alt + 4)
      p.exitAlt = alt
      break
    }

    // ─── PHASE 2 — FILLERS / respiration (D1) ────────────────────────────────────────────────
    case 'ligne-droite':
    case 'couloir-large': {
      const alt = entryAlt
      if (alt >= 1) p.platforms.push({ x: 0, alt, w })
      placeBirds(alt + 2)
      p.exitAlt = alt
      break
    }
    case 'marche': {
      // une marche simple qui monte de 2-3 rangées à mi-parcours
      const alt = entryAlt
      const step = Math.min(SIMPLE_JUMP_ROWS, 2 + Math.floor(rng() * 2))
      const half = Math.floor(w / 2)
      if (alt >= 1) p.platforms.push({ x: 0, alt, w: half })
      p.platforms.push({ x: half, alt: alt + step, w: w - half })
      p.exitAlt = alt + step
      break
    }
    case 'descente-douce': {
      const alt = entryAlt
      const drop = Math.min(SIMPLE_JUMP_ROWS, 2 + Math.floor(rng() * 2))
      const toAlt = Math.max(0, alt - drop)
      p.platforms.push(...ramp(0, w, alt, toAlt))
      p.exitAlt = toAlt
      break
    }
    case 'balcon': {
      // plateau + balcon surélevé (bonus optionnel), sortie = entrée
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      p.platforms.push({ x: Math.floor(w / 3), alt: alt + SIMPLE_JUMP_ROWS, w: Math.max(4, Math.floor(w / 3)) })
      placeBirds(alt + 4)
      p.exitAlt = alt
      break
    }
    case 'echelle-tranquille': {
      // F6 : montée par UNE échelle unique, palier de sortie jusqu'au bord droit
      const xLad = Math.max(3, Math.floor(w * 0.4))
      p.exitAlt = poseLadder(p, xLad, entryAlt, 0, xLad + 3, w)
      break
    }
    case 'double-sol': {
      // F8 : 2 étages plats reliés par une échelle, MÊME sortie que l'entrée (l'étage haut = bonus)
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w }) // sol bas, pleine largeur = chemin principal
      const xLad = Math.max(3, Math.floor(w * 0.35))
      const topAlt = alt + LADDER_H
      p.ladders.push({ x: xLad, topAlt, h: LADDER_H })
      p.platforms.push({ x: xLad, alt: topAlt - 2, w: Math.max(4, Math.floor(w / 2)) }) // étage haut
      p.exitAlt = alt
      break
    }

    // ─── PHASE 2 — TRAVERSÉE horizontale (D1–D3) ─────────────────────────────────────────────
    case 'gap-grandissant':
    case 'ilots-reguliers':
    case 'ilots-irreguliers':
    case 'triple-saut': {
      // sol à alt courant coupé de TROUS mortels (≤3 tuiles chacun, franchissables). Le motif change
      // le rythme des trous : croissant, régulier, irrégulier, ou triple saut serré.
      const alt = Math.max(1, entryAlt)
      const bank = 3
      p.platforms.push({ x: 0, alt, w: bank })
      let x = bank
      let i = 0
      const maxGaps = m.kind === 'triple-saut' ? 3 : 99
      while (x < w - bank - 2 && i < maxGaps) {
        let gw: number
        if (m.kind === 'gap-grandissant') gw = Math.min(1 + i, 3)
        else if (m.kind === 'ilots-irreguliers') gw = 1 + ((i * 2 + 1) % 3)
        else if (m.kind === 'triple-saut') gw = 3
        else gw = 2
        gw = Math.min(gw, 3, w - bank - x - 2)
        if (gw <= 0) break
        p.gaps.push({ x, w: gw }); x += gw
        const iw = m.kind === 'ilots-irreguliers' ? 3 + (i % 3) : 4
        const sw = Math.min(iw, w - bank - x)
        if (sw <= 0) break
        p.platforms.push({ x, alt, w: sw }); x += sw
        i++
      }
      p.platforms.push({ x: Math.max(x, w - bank), alt, w: bank }) // berge droite
      placeBirds(alt + 2)
      p.exitAlt = alt
      break
    }
    case 'petit-pont': {
      // F5 : pont au-dessus d'un bassin marine peu profond. Le pont a un TROU central (3 tuiles,
      // franchissable au saut) par lequel on PLONGE pour le petit trésor du fond puis on RESSORT —
      // sans le trou, le coffre du fond serait injoignable (bassin scellé). Bassin peu profond →
      // plongée/remontée triviale (survivable).
      const bankAlt = entryAlt + 2
      const rampW = 4
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt))
      const wx = rampW, ww = Math.max(6, w - 2 * rampW)
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt })
      const holeL = wx + Math.floor(ww / 2) - 1 // trou central de 3 tuiles : on plonge par là
      if (holeL - wx > 0) p.bridges.push({ x: wx, alt: bankAlt, w: holeL - wx })
      if (wx + ww - (holeL + 3) > 0) p.bridges.push({ x: holeL + 3, alt: bankAlt, w: wx + ww - (holeL + 3) })
      p.platforms.push(...ramp(wx + ww, w - (wx + ww), bankAlt, entryAlt))
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) }) // petit trésor au fond du bassin
      p.exitAlt = entryAlt
      break
    }
    case 'trou-filet':
    case 'pas-japonais': {
      // pas de pierre (bridges) au-dessus d'une cuve marine : rater = tomber à l'eau (nage), pas mourir
      const bankAlt = Math.max(entryAlt, 2)
      const bank = 3
      p.platforms.push({ x: 0, alt: bankAlt, w: bank })
      const wx = bank, ww = Math.max(6, w - 2 * bank)
      p.waters.push({ x: wx, w: ww, kind: 'marine', bankAlt })
      const stepW = m.kind === 'pas-japonais' ? 2 : 3
      let x = wx
      while (x < wx + ww) {
        const sw = Math.min(stepW, wx + ww - x)
        if (sw <= 0) break
        p.bridges.push({ x, alt: bankAlt, w: sw })
        x += sw + 3
      }
      p.platforms.push({ x: wx + ww, alt: bankAlt, w: bank })
      placeBirds(bankAlt + 2)
      p.exitAlt = bankAlt
      break
    }

    // ─── PHASE 2 — VERTICAL / étages (D2–D4) ─────────────────────────────────────────────────
    case 'zigzag': {
      // plateformes alternées contiguës (monte de 2, redescend de 1 → progression en dents de scie)
      const alt = Math.max(1, entryAlt)
      const seg = 4
      let x = 0, a = alt, i = 0
      while (x < w) {
        const sw = Math.min(seg, w - x)
        if (sw <= 0) break
        p.platforms.push({ x, alt: a, w: sw })
        x += sw
        a = Math.max(1, i % 2 === 0 ? a + 2 : a - 1)
        i++
      }
      p.exitAlt = a
      break
    }
    case 'descente-controlee': {
      // paliers descendants réguliers (chute contrôlée corniche → corniche)
      const alt = entryAlt
      const drop = Math.max(5, Math.abs(m.rise ?? 8))
      const toAlt = Math.max(0, alt - drop)
      p.platforms.push(...ramp(0, w, alt, toAlt))
      placeBirds(alt + 2)
      p.exitAlt = toAlt
      break
    }
    case 'cage-echelles': {
      // V18 : 2 échelles + paliers en lacet (quinconce)
      p.exitAlt = poseTower(p, w, entryAlt, 2)
      break
    }
    case 'tour-creuse': {
      // V21 : puits, plateformes en quinconce reliées par échelles (3 étages)
      p.exitAlt = poseTower(p, w, entryAlt, 3)
      break
    }
    case 'echelle-vs-sauts': {
      // V19 : deux routes vers le même palier — échelle (gauche) OU escalier de sauts (droite)
      const xLad = Math.max(3, Math.floor(w * 0.25))
      const rx = Math.floor(w * 0.5)
      const landAlt = poseLadder(p, xLad, entryAlt, 0, rx, rx)
      p.platforms.push(...ramp(rx, w - rx, entryAlt, landAlt)) // escalier alternatif à droite
      p.exitAlt = landAlt
      break
    }

    // ─── PHASE 2 — RISQUE / récompense (D2–D4) ───────────────────────────────────────────────
    case 'chemin-double': {
      // R23 : route HAUTE continue (sûre) + route BASSE à trous (rapide, risquée)
      const lowAlt = Math.max(1, entryAlt)
      const highAlt = lowAlt + SIMPLE_JUMP_ROWS
      p.platforms.push({ x: 0, alt: lowAlt, w: 4 })
      let x = 4
      while (x < w - 4) {
        const gw = Math.min(2, w - 4 - x)
        if (gw <= 0) break
        p.gaps.push({ x, w: gw }); x += gw
        const sw = Math.min(4, w - 4 - x)
        if (sw <= 0) break
        p.platforms.push({ x, alt: lowAlt, w: sw }); x += sw
      }
      p.platforms.push({ x: Math.max(x, w - 4), alt: lowAlt, w: 4 })
      p.platforms.push({ x: 2, alt: highAlt, w: Math.max(6, w - 4) }) // corniche haute continue
      p.exitAlt = lowAlt
      break
    }
    case 'fausse-sortie': {
      // R28 : chemin continu + leurre surélevé sans issue (cul-de-sac à observer)
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      p.platforms.push({ x: Math.floor(w / 3), alt: alt + SIMPLE_JUMP_ROWS, w: 5 }) // leurre
      p.exitAlt = alt
      break
    }
    case 'detour-balcon': {
      // R26 : chemin principal au sol + balcon-trésor optionnel via échelle (sortie = entrée)
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      const xLad = Math.max(3, Math.floor(w * 0.4))
      const topAlt = alt + LADDER_H
      p.ladders.push({ x: xLad, topAlt, h: LADDER_H })
      const balcAlt = topAlt - 2
      p.platforms.push({ x: xLad, alt: balcAlt, w: Math.max(4, Math.floor(w / 3)) })
      p.props.push({ kind: 'coffre', x: xLad + 2, alt: balcAlt + 1 })
      p.exitAlt = alt
      break
    }
    case 'tresor-bassin': {
      // R25 : cuve marine avec coffre au FOND (détour aquatique) — reprend le motif bassin
      const bankAlt = entryAlt + 4
      const rampW = 5
      p.platforms.push(...ramp(0, rampW, entryAlt, bankAlt))
      const wx = rampW, ww = Math.max(6, w - 2 * rampW)
      p.waters.push({ x: wx, w: ww, kind: basinKind, bankAlt })
      const holeL = wx + Math.floor(ww / 2) - 1
      if (holeL - wx > 0) p.bridges.push({ x: wx, alt: bankAlt, w: holeL - wx })
      if (wx + ww - (holeL + 3) > 0) p.bridges.push({ x: holeL + 3, alt: bankAlt, w: wx + ww - (holeL + 3) })
      p.platforms.push(...ramp(wx + ww, w - (wx + ww), bankAlt, entryAlt))
      if (basinKind !== 'lave') p.props.push({ kind: 'coffre', x: wx + Math.floor(ww / 2) })
      placeBirds(bankAlt + 2)
      break
    }

    // ─── PHASE 2 — TENSION / précision (D3–D5, sans pics — voir NOTE) ─────────────────────────
    case 'echelle-exposee': {
      // P30 : échelle exposée, il faut SORTIR DU BON CÔTÉ (palier à droite ; leurre court à gauche)
      const xLad = Math.max(4, Math.floor(w * 0.5))
      const landAlt = poseLadder(p, xLad, entryAlt, 0, xLad + 3, w)
      p.platforms.push({ x: Math.max(0, xLad - 6), alt: landAlt, w: 3 }) // leurre gauche (cul-de-sac)
      p.exitAlt = landAlt
      break
    }

    // ─── PHASE 2b — TENSION à PICS (pics rendus sur TOUTE surface élevée) ─────────────────────
    case 'faux-plat': {
      // T16 : corniche plate (en hauteur) semée de PICS ISOLÉS à enjamber. Surface pleine + pics
      // d'1 tuile posés SUR la corniche à intervalles réguliers → on saute par-dessus.
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      for (const sx of spread(w, 3)) p.spikes.push({ x: sx, w: 1, alt })
      p.exitAlt = alt
      break
    }
    case 'couloir-pics': {
      // P29 : couloir avec PLAFOND DE ROCHE (roche au-dessus) et LITS DE PICS sur la corniche : on
      // enchaîne des sauts par-dessus les lits, dégagement > saut sous le plafond.
      const alt = Math.max(2, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      pushVariedCeiling(p, w, alt, Math.floor(rng() * 3)) // plafond de roche varié
      let x = 3
      while (x < w - 4) { p.spikes.push({ x, w: 2, alt }); x += 6 } // lit de 2 pics + 4 tuiles libres
      p.exitAlt = alt
      break
    }
    case 'pics-quinconce': {
      // P31 : pics en QUINCONCE — lits de pics au sol de la corniche alternés avec des mini-corniches
      // surélevées elles aussi coiffées de pics → on slalome en hauteur.
      const alt = Math.max(1, entryAlt)
      p.platforms.push({ x: 0, alt, w })
      let x = 3, hi = false
      while (x < w - 4) {
        if (hi) { p.platforms.push({ x, alt: alt + 2, w: 3 }); p.spikes.push({ x, w: 3, alt: alt + 2 }) }
        else p.spikes.push({ x, w: 2, alt })
        x += 5; hi = !hi
      }
      p.exitAlt = alt
      break
    }
    case 'atterrissage-etroit': {
      // P32 : atterrissages ÉTROITS (1 case) encadrés de pics — précision de saut en hauteur.
      const alt = Math.max(2, entryAlt)
      p.platforms.push({ x: 0, alt, w: 3 }) // berge d'entrée
      let x = 3
      while (x < w - 4) {
        p.spikes.push({ x, w: 1, alt })
        p.platforms.push({ x: x + 1, alt, w: 1 }) // atterrissage d'une seule tuile
        p.spikes.push({ x: x + 2, w: 1, alt })
        x += 4
      }
      p.platforms.push({ x: Math.max(x, w - 3), alt, w: 3 }) // berge de sortie
      p.exitAlt = alt
      break
    }

    // ─── ESCALIER DE PIERRE (marches RIGIDES) ────────────────────────────────────────────────
    case 'escalier-pierre': {
      // Marches de PIERRE PLEINES et ISOLÉES (un trou d'air entre chaque) : collision pleine → on ne
      // les traverse PAS (ni par le bas), mais l'isolement empêche tout coincement (aucune arête
      // interne où se wedger). On monte bloc par bloc (écart +STEP_RISE rangées, GAP tuiles → saut
      // simple garanti et reachable). Le fond est du SOL PLEIN : rater un saut = retomber au sol,
      // jamais de piège. Contraste avec les marches de TERRE (rampes one-way traversables par le bas).
      const STEP_RISE = 2 // +2 rangées par marche (avec un trou de GAP=2 tuiles → CONFORTABLEMENT franchissable)
      const GAP = 2
      const stepW = 4
      const pitch = stepW + GAP // 6 tuiles par marche
      const from = Math.max(1, entryAlt)
      // autant de marches que la largeur en contient (≥2), la DERNIÈRE étant un large palier qui
      // rejoint le bord droit du module (contigu au module suivant → chaînage reachable).
      const count = Math.max(2, Math.min(5, Math.floor((w - stepW) / pitch) + 1))
      let x = 0
      for (let i = 0; i < count; i++) {
        const alt = from + i * STEP_RISE
        const last = i === count - 1
        const bw = last ? Math.max(stepW, w - x) : stepW // dernier bloc élargi jusqu'au bord droit
        p.platforms.push({ x, alt, w: bw, solid: true }) // bloc de PIERRE rigide
        x += pitch
      }
      p.exitAlt = from + (count - 1) * STEP_RISE
      break
    }

    // ─── PHASE 2 — EAU / cascade (D2–D4) ─────────────────────────────────────────────────────
    case 'sortie-humide': {
      // E40 : sortie derrière une cascade — reprend exactement le motif cascade (plateforme collée
      // à GAUCHE et à DROITE du rideau, courant DESCENDANT qu'on remonte en maintenant HAUT)
      const low = Math.max(entryAlt, 1)
      const top = low + Math.max(4, 4 + Math.floor(rng() * 2))
      const L = Math.max(4, Math.floor(w * 0.22))
      const cornW = 5
      const upW = Math.max(4, Math.min(Math.floor(w * 0.3), w - L - 2 - cornW - 2))
      p.platforms.push({ x: 0, alt: low, w: L }) // corniche basse collée à gauche du rideau
      p.waters.push({ x: L, w: 2, kind: 'cascade', bankAlt: top })
      p.platforms.push(...ramp(L + 2, upW, low, top)) // rampe collée à droite du rideau
      const topX = L + 2 + upW
      p.platforms.push({ x: topX, alt: top, w: cornW })
      p.props.push({ kind: 'coffre', x: topX + 2, alt: top + 1 })
      const downStart = topX + cornW
      if (w - downStart >= 1) p.platforms.push(...ramp(downStart, w - downStart, top, exitAlt))
      placeBirds(top + 2)
      break
    }

    // ─── PASSAGE SOUS-MARIN : plonger par le HAUT, ressortir sur le CÔTÉ immergé ──────────────
    case 'passage-immerge': {
      // Lac marine dont la paroi DROITE est OUVERTE (openSide) : on plonge depuis la berge gauche
      // HAUTE (par le haut du lac) puis, apnée rallongée (§1) aidant, on nage/descend et on RESSORT
      // sur le CÔTÉ par l'ouverture immergée → une corniche BASSE de la zone suivante (on ne remonte
      // pas par le haut). Le fond est du sol plein ; des poissons (cercles rouges) dérivent dans l'eau.
      const highBank = entryAlt + 5 // berge gauche HAUTE : le point de plongée
      const outAlt = Math.max(1, Math.min(entryAlt, 3)) // sortie latérale BASSE (joignable du sol côté validateur)
      const rampW = 4
      p.platforms.push(...ramp(0, rampW, entryAlt, highBank)) // rampe d'accès à la berge haute
      const wx = rampW
      const ww = Math.max(6, w - rampW - 3)
      p.waters.push({ x: wx, w: ww, kind: 'marine', bankAlt: highBank, openSide: 'right' })
      // corniche de SORTIE latérale, basse, collée au bord droit ouvert de l'eau (on émerge par là)
      p.platforms.push({ x: wx + ww, alt: outAlt, w: Math.max(3, w - (wx + ww)) })
      placeBirds(highBank + 2)
      p.exitAlt = outAlt
      break
    }
  }

  // Placement GÉNÉRIQUE des monstres terrestres : posés SUR les plateformes marchables assez larges
  // (≥4) à leur altitude réelle → jamais en l'air ni dans la roche, toujours de la place pour
  // patrouiller (validateur monstersOffSurface).
  const walkable = p.platforms.filter((pl) => pl.w >= 4).sort((a, b) => a.x - b.x)
  groundMobs.forEach((id, i) => {
    if (walkable.length === 0) { p.spawns.push({ monsterId: id, x: Math.round((w * (i + 1)) / (groundMobs.length + 1)) }); return }
    const pl = walkable[i % walkable.length]!
    const cx = Math.min(pl.x + pl.w - 2, Math.max(pl.x + 1, pl.x + Math.floor(pl.w / 2)))
    p.spawns.push({ monsterId: id, x: cx, alt: pl.alt })
  })

  // SOCLE DE PIERRE jusqu'au sol sous les surfaces PLEINES (mesa à coiffe de biome) + support
  // continu le long des CASCADES/berges. Exclut le VIDE ('vide' : corniches qui doivent flotter)
  // et la ROCHE ('roche' : grotte, déjà pleine + plafond). Colonnes d'eau laissées ouvertes.
  if (m.fillBelow === 'sol' || m.fillBelow === 'marine' || m.fillBelow === 'cascade' || m.fillBelow === 'lave') {
    addPedestals(p, w)
  }
  return p
}

export interface AssembleOpts {
  id: string
  name: string
  biome: string
  seed?: string
}

// ─── Assembleur : modules → LevelDef ────────────────────────────────────────────────────────
export function buildLevelFromModules(modules: Module[], opts: AssembleOpts): LevelDef {
  const seed = hashSeed(opts.seed ?? opts.id)
  // 1) pièces en espace altitude, chaînées (entrée = altitude courante)
  const pieces: { piece: Piece; x0: number; w: number }[] = []
  let cursorX = 2 // petite marge de bord gauche
  // DÉPART STANDARDISÉ (phase 2b) : le PREMIER module est TOUJOURS une bande PLATE à UN SEUL niveau
  // de sol — pas de rampe d'amorce (qui empilait des paliers « à deux niveaux » au spawn), pas de
  // plateforme parallèle. Sa hauteur VARIE d'un niveau à l'autre (startAlt ∈ {2,3,4}, toujours
  // joignable du sol au saut simple ; rise ≤ 4). Un SOCLE PLEIN (mesa, posé plus bas) referme le
  // dessous → une seule bande plate visible au départ. Ensuite la variété reprend (rester, grimper,
  // ou sauter dans l'eau/la cascade). Plage {3,4} : varie d'un niveau à l'autre, reste joignable du
  // sol (≤ 4) ET laisse ≥ 3 rangées d'écart avec une sortie tout en bas (validateur départ/sortie).
  const startAlt = 3 + (hashSeed(opts.id + ':startalt') % 2)
  let runningAlt = startAlt
  modules.forEach((m, i) => {
    const rng = mulberry32(seed + i * 2654435761)
    const [wmin, wmax] = m.widthRange
    const w = wmin + (hashSeed(opts.id + ':' + i + ':' + m.kind) % (wmax - wmin + 1))
    const piece = buildModule(m, rng, w, runningAlt)
    // départ / sortie
    if (m.spawnHere) {
      piece.start = { x: Math.floor(w / 2), alt: runningAlt }
      // le SOCLE PLEIN sous la bande de départ (mesa) est désormais posé par addPedestals (socle de
      // pierre générique sous toute surface pleine) → une seule bande plate visible au départ.
    }
    if (m.exitHere) piece.exit = { x: w - 3, alt: piece.exitAlt }
    pieces.push({ piece, x0: cursorX, w })
    cursorX += w
    runningAlt = piece.exitAlt
  })
  const totalWidth = cursorX + 2

  // 2) enveloppe verticale. On distingue le sommet des SURFACES MARCHABLES (platforms) de celui des
  // PLAFONDS DE ROCHE (rocks) pour NE PAS laisser de dalle de ciel morte au-dessus des grottes : le
  // plafond d'un tunnel monte souvent bien plus haut que la plus haute plateforme, et garder +6 tuiles
  // au-dessus donnait un grand vide bleu inutile. On garde donc juste ce qu'il faut :
  //   • SKY_PAD tuiles de dégagement au-dessus de la plus haute plateforme (> hauteur de saut ≈ 4 →
  //     on peut sauter du sommet sans sortir du monde, plafond du monde traversable R114) ;
  //   • le plafond de roche le plus haut tient dans le monde (+1 tuile).
  let maxPlatAlt = 0
  let maxRockAlt = 0
  let maxAerialAlt = 0 // les oiseaux volent AU-DESSUS des surfaces : le ciel doit les contenir (row ≥ 1)
  for (const { piece } of pieces) {
    for (const pl of piece.platforms) maxPlatAlt = Math.max(maxPlatAlt, pl.alt)
    for (const rk of piece.rocks) maxRockAlt = Math.max(maxRockAlt, rk.altTop)
    for (const s of piece.spawns) if (s.aerial && s.alt !== undefined) maxAerialAlt = Math.max(maxAerialAlt, s.alt)
  }
  const SKY_PAD = 5 // dégagement au-dessus de la plus haute plateforme (> saut ~4 tuiles), sans ciel mort
  const groundRow = Math.max(maxPlatAlt + SKY_PAD, maxRockAlt + 1, maxAerialAlt + 1)
  const heightTiles = groundRow + 2
  const row = (alt: number) => groundRow - alt

  // 3) EXPAND vers LevelDef
  const platforms: LevelDef['platforms'] = []
  const bridges: NonNullable<LevelDef['bridges']> = []
  const gaps: NonNullable<LevelDef['gaps']> = []
  const hazards: NonNullable<LevelDef['hazards']> = []
  const ladders: NonNullable<LevelDef['ladders']> = []
  const rockBands: NonNullable<LevelDef['rockBands']> = []
  const spawns: LevelDef['spawns'] = []
  const props: NonNullable<LevelDef['props']> = []
  let start: LevelDef['start']
  let exit: LevelDef['exit']

  for (const { piece, x0 } of pieces) {
    for (const pl of piece.platforms) platforms.push({ x: x0 + pl.x, y: row(pl.alt), w: pl.w, ...(pl.solid ? { solid: true } : {}) })
    for (const b of piece.bridges) bridges.push({ x: x0 + b.x, y: row(b.alt), w: b.w })
    for (const l of piece.ladders) ladders.push({ x: x0 + l.x, y: row(l.topAlt), h: l.h })
    for (const g of piece.gaps) gaps.push({ x: x0 + g.x, w: g.w })
    // dalles de roche (plafond de tunnel / socle) : y = rangée du HAUT de la dalle, h = épaisseur ;
    // `solid` = plafond à collision pleine (on ne saute pas à travers).
    for (const rk of piece.rocks) rockBands.push({ x: x0 + rk.x, y: row(rk.altTop), w: rk.w, h: rk.altTop - rk.altBot + 1, ...(rk.solid ? { solid: true } : {}) })
    // pics : `top` = rangée de la surface qui les porte (corniche en hauteur), sinon au sol (top absent)
    for (const s of piece.spikes) hazards.push({ kind: 'spikes', x: x0 + s.x, w: s.w, ...(s.alt !== undefined ? { top: row(s.alt) } : {}) })
    for (const wtr of piece.waters) {
      const top = row(wtr.bankAlt) // surface d'eau À RAS du rebord (berges) — pas de bande d'air au-dessus
      if (wtr.kind === 'cascade') {
        // CASCADE claire REMONTABLE : elle COULE JUSQU'AU BAS DE LA CARTE (rangée heightTiles), au
        // DESSUS DU VIDE (aucun sol dessous) — la descendre jusqu'au fond = chute mortelle
        // (checkPitDeath). Aucune pierre/cuve : c'est de l'eau qui s'écoule, pas un bassin.
        hazards.push({ kind: 'water', x: x0 + wtr.x, w: wtr.w, top, h: Math.max(2, heightTiles - top), water: 'cascade' })
        gaps.push({ x: x0 + wtr.x, w: wtr.w }) // VIDE sous la cascade → descendre au fond = mort
      } else {
        // CUVE de fond plein (marine OU lave) : le FOND repose TOUJOURS sur le SOL PLEIN, sans espace
        // vide. On étend le liquide jusqu'à recouvrir la surface du sol (rangée groundRow) → jamais de
        // liquide qui vole. 'lave' = cuve de pierre MORTELLE (enfer) ; 'marine' = bassin de noyade.
        hazards.push({ kind: 'water', x: x0 + wtr.x, w: wtr.w, top, h: Math.max(2, groundRow + 1 - top), water: wtr.kind === 'lave' ? 'lave' : 'basin', ...(wtr.openSide ? { openSide: wtr.openSide } : {}) })
      }
    }
    for (const s of piece.spawns) spawns.push({ monsterId: s.monsterId, x: x0 + s.x, ...(s.alt !== undefined ? { y: row(s.alt) } : {}) })
    for (const pr of piece.props) props.push({ kind: pr.kind, x: x0 + pr.x, ...(pr.alt !== undefined ? { y: row(pr.alt) } : {}) })
    if (piece.start) start = { x: x0 + piece.start.x, y: row(piece.start.alt) }
    if (piece.exit) exit = { x: x0 + piece.exit.x, y: row(piece.exit.alt) }
  }

  // quelques décorations au sol (herbe/champignon selon le biome) réparties sur la largeur
  const decoKind = opts.biome === 'foret' || opts.biome === 'jungle' ? 'champignon' : 'herbe'
  for (const f of [0.18, 0.45, 0.72]) props.push({ kind: decoKind, x: Math.round(totalWidth * f) })

  // DÉPART SÛR (marge globale) : aucun spawn — terrestre OU aérien — n'est laissé à moins de
  // SAFE_SPAWN_TILES tuiles du x de départ. Couvre les monstres des modules voisins et les oiseaux
  // qui, malgré le module de spawn vidé, se retrouveraient à portée du point d'apparition.
  const SAFE_SPAWN_TILES = 8
  const safeSpawns = start
    ? spawns.filter((s) => Math.abs(s.x - start!.x) >= SAFE_SPAWN_TILES)
    : spawns

  return {
    id: opts.id, name: opts.name, biome: opts.biome,
    widthTiles: totalWidth, heightTiles,
    start, exit,
    platforms, bridges, gaps, hazards, ladders, rockBands, spawns: safeSpawns, props,
  }
}

// ─── CATALOGUE : métadonnées de composition par kind (docs/level-module-kit.md §PHASE 2) ─────
// tier D1..D5 · family (dosage) · tags d'accroche entry/exit ∈ {bas,milieu,haut} · largeur VARIABLE
// (amplitude large ±40-60 %, tirée déterministiquement par l'assembleur) · fills · flags ladder /
// chest (coffre) / water (plan d'eau). Sert au helper composeLevel (dosage + courbe de difficulté).
export interface ModuleSpec {
  tier: Tier
  family: Family
  entry: EdgeTag
  exit: EdgeTag
  width: [number, number]
  below: Fill
  above: Fill
  ladder?: boolean
  chest?: boolean
  water?: boolean
  birds?: boolean // motif de plein air (accueille des oiseaux)
}

export const CATALOG: Record<ModuleKind, ModuleSpec> = {
  // historiques (12)
  plateau: { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [10, 18], below: 'sol', above: 'air' },
  colline: { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 28], below: 'sol', above: 'air', birds: true },
  escalier: { tier: 1, family: 'traverse', entry: 'bas', exit: 'haut', width: [12, 22], below: 'sol', above: 'air' },
  descente: { tier: 1, family: 'traverse', entry: 'haut', exit: 'bas', width: [12, 22], below: 'sol', above: 'air' },
  gue: { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [12, 22], below: 'vide', above: 'air', birds: true },
  'corniche-vide': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 26], below: 'vide', above: 'air', birds: true },
  bassin: { tier: 2, family: 'risque', entry: 'milieu', exit: 'milieu', width: [12, 22], below: 'marine', above: 'air', chest: true, water: true },
  cascade: { tier: 2, family: 'risque', entry: 'bas', exit: 'haut', width: [16, 26], below: 'cascade', above: 'air', chest: true, water: true },
  grotte: { tier: 2, family: 'tension', entry: 'milieu', exit: 'milieu', width: [12, 20], below: 'roche', above: 'roche' },
  arene: { tier: 2, family: 'tension', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'sol', above: 'air' },
  crete: { tier: 3, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [12, 22], below: 'vide', above: 'air', birds: true },
  volee: { tier: 2, family: 'tension', entry: 'milieu', exit: 'milieu', width: [14, 26], below: 'sol', above: 'air', birds: true },
  // fillers / respiration (D1)
  'ligne-droite': { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [8, 16], below: 'sol', above: 'air' },
  marche: { tier: 1, family: 'filler', entry: 'bas', exit: 'haut', width: [8, 16], below: 'sol', above: 'air' },
  'descente-douce': { tier: 1, family: 'filler', entry: 'haut', exit: 'bas', width: [8, 16], below: 'sol', above: 'air' },
  'couloir-large': { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [14, 30], below: 'sol', above: 'air' },
  'petit-pont': { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [10, 18], below: 'marine', above: 'air', chest: true, water: true },
  'echelle-tranquille': { tier: 1, family: 'filler', entry: 'bas', exit: 'haut', width: [10, 16], below: 'sol', above: 'air', ladder: true },
  balcon: { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [12, 20], below: 'sol', above: 'air', birds: true },
  'double-sol': { tier: 1, family: 'filler', entry: 'milieu', exit: 'milieu', width: [12, 20], below: 'sol', above: 'air', ladder: true },
  // traversée horizontale (D1–D3)
  'gap-grandissant': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [12, 22], below: 'vide', above: 'air' },
  'ilots-reguliers': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'vide', above: 'air' },
  'ilots-irreguliers': { tier: 3, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 26], below: 'vide', above: 'air' },
  'trou-filet': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'marine', above: 'air', water: true },
  'pas-japonais': { tier: 2, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'marine', above: 'air', water: true },
  'triple-saut': { tier: 3, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [14, 22], below: 'vide', above: 'air' },
  // vertical / étages (D2–D4)
  zigzag: { tier: 2, family: 'vertical', entry: 'bas', exit: 'haut', width: [14, 24], below: 'sol', above: 'air' },
  'cage-echelles': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [16, 26], below: 'sol', above: 'air', ladder: true },
  'echelle-vs-sauts': { tier: 2, family: 'vertical', entry: 'bas', exit: 'haut', width: [14, 24], below: 'sol', above: 'air', ladder: true },
  'descente-controlee': { tier: 2, family: 'vertical', entry: 'haut', exit: 'bas', width: [14, 24], below: 'sol', above: 'air', birds: true },
  'tour-creuse': { tier: 3, family: 'vertical', entry: 'bas', exit: 'haut', width: [18, 28], below: 'sol', above: 'air', ladder: true },
  // risque / récompense (D2–D4)
  'chemin-double': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [16, 26], below: 'vide', above: 'air' },
  'detour-balcon': { tier: 2, family: 'risque', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'sol', above: 'air', ladder: true, chest: true },
  'fausse-sortie': { tier: 3, family: 'risque', entry: 'milieu', exit: 'milieu', width: [12, 22], below: 'sol', above: 'air' },
  'tresor-bassin': { tier: 2, family: 'risque', entry: 'milieu', exit: 'milieu', width: [14, 24], below: 'marine', above: 'air', chest: true, water: true },
  // tension / précision (D3–D5)
  'echelle-exposee': { tier: 4, family: 'tension', entry: 'bas', exit: 'haut', width: [12, 20], below: 'sol', above: 'air', ladder: true },
  // PHASE 2b — motifs à PICS en hauteur (tier ≥ 3 → hors de la zone 1 : n'altèrent aucun niveau existant)
  'faux-plat': { tier: 3, family: 'traverse', entry: 'milieu', exit: 'milieu', width: [12, 20], below: 'sol', above: 'air' },
  'couloir-pics': { tier: 4, family: 'tension', entry: 'milieu', exit: 'milieu', width: [14, 22], below: 'sol', above: 'roche' },
  'pics-quinconce': { tier: 4, family: 'tension', entry: 'milieu', exit: 'milieu', width: [14, 22], below: 'sol', above: 'air' },
  'atterrissage-etroit': { tier: 5, family: 'tension', entry: 'milieu', exit: 'milieu', width: [12, 18], below: 'sol', above: 'air' },
  // escalier de PIERRE rigide (blocs solides isolés)
  'escalier-pierre': { tier: 2, family: 'traverse', entry: 'bas', exit: 'haut', width: [16, 24], below: 'sol', above: 'air' },
  // eau / cascade (D2–D4)
  'sortie-humide': { tier: 3, family: 'risque', entry: 'bas', exit: 'haut', width: [16, 26], below: 'cascade', above: 'air', chest: true, water: true },
  // passage sous-marin (plonger par le haut, ressortir sur le côté)
  'passage-immerge': { tier: 3, family: 'risque', entry: 'milieu', exit: 'bas', width: [16, 26], below: 'marine', above: 'air', water: true },
}

// Construit un Module à partir de son kind (fills + métadonnées du CATALOG) + peuplement/flags.
function mk(kind: ModuleKind, extra: Partial<Module> = {}): Module {
  const s = CATALOG[kind]
  return {
    kind, widthRange: s.width, fillBelow: s.below, fillAbove: s.above,
    tier: s.tier, entry: s.entry, exit: s.exit, tags: [s.family],
    ...extra,
  }
}

// ─── COMPOSITION : DOSAGE + COURBE DE DIFFICULTÉ ─────────────────────────────────────────────
// Assemble un niveau en respectant : (1) COURBE — tier PLAFONNÉ par la progression (tierCap) ;
// (2) DOSAGE — ~30 % fillers · ~40 % traversée+vertical · ~20 % risque · ~10 % tension ; (3) départ
// = filler simple à mi-hauteur SANS monstre (R127) ; (4) sortie à une altitude ≠ (ending bas/haut) ;
// (5) au moins UN plan d'eau + un coffre ; coffres plafonnés à 3. Déterministe (aucun Math.random).
export interface ComposeOpts {
  id: string
  name: string
  biome: string
  tierCap: Tier
  ending: 'bas' | 'haut' // sortie franchement plus BASSE ou plus HAUTE que le départ (mi-hauteur)
  ground: string[]       // pool de monstres terrestres (ordre = difficulté croissante)
  birds: string[]        // pool d'oiseaux du biome
  // pool de monstres AQUATIQUES posés sur/au-dessus des cuves d'eau (bassin, passage immergé…). Seuls
  // des mobs aquatiques (méduse, crabe) y sont cohérents ; par défaut VIDE → l'eau reste sans monstre
  // plutôt que d'y placer un terrestre (règle de cohérence : jamais de mob terrestre au-dessus de l'eau).
  aquatic?: string[]
  mvp?: string           // MVP rare posé dans un module de risque tardif
  midCount?: number      // nb de modules centraux (défaut 5)
  allowLadders?: boolean // autoriser les motifs à échelle (niveau 1 : false pour rester simple)
  waterKinds?: ModuleKind[] // plans d'eau imposés (variété entre niveaux)
  lava?: boolean // ENFER : les cuves marine (bassin/tresor-bassin/petit-pont) deviennent de la LAVE mortelle
  seed?: string
}

const FAMILY_BUCKET: Record<Family, 'filler' | 'traverse' | 'risque' | 'tension'> = {
  filler: 'filler', traverse: 'traverse', vertical: 'traverse', risque: 'risque', tension: 'tension',
}

export function composeLevel(o: ComposeOpts): LevelDef {
  const rng = mulberry32(hashSeed(o.seed ?? o.id))
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)] ?? arr[0]!
  // DENSITÉ D'OISEAUX : les beats de PLEIN AIR respirent trop avec 1 seul oiseau. On densifie selon le
  // motif — volée (grand ciel ouvert) 4-5, crêtes/corniches sur le vide 3, autres reliefs aérés 2.
  const birdCountFor = (k: ModuleKind): number =>
    k === 'volee' ? 4 + (hashSeed(o.id + ':' + k) % 2) : (k === 'crete' || k === 'corniche-vide') ? 3 : 2
  // On CONSOMME exactement UN tirage rng (comme avant) pour le 1er oiseau → le flux RNG qui pilote le
  // CHOIX des modules reste identique (géométrie inchangée) ; les oiseaux SUPPLÉMENTAIRES sont tirés
  // d'une source à part (hashSeed), donc densifier ne perturbe pas le terrain.
  const flock = (k: ModuleKind): string[] => {
    const first = pick(o.birds)
    const extra = Array.from({ length: Math.max(0, birdCountFor(k) - 1) },
      (_, i) => o.birds[hashSeed(o.id + ':bird:' + k + ':' + i) % o.birds.length] ?? first)
    return [first, ...extra]
  }
  const cap = o.tierCap
  const allowLadders = o.allowLadders ?? true
  const mid = o.midCount ?? 5

  // pools de kinds par bucket, filtrés par tier + échelles autorisées (on exclut les plans d'eau
  // des pools génériques : ils sont IMPOSÉS séparément pour garantir eau + coffre et leur variété).
  const kindsOf = (bucket: 'filler' | 'traverse' | 'risque' | 'tension'): ModuleKind[] =>
    (Object.keys(CATALOG) as ModuleKind[]).filter((k) => {
      const s = CATALOG[k]
      if (FAMILY_BUCKET[s.family] !== bucket) return false
      if (s.tier > cap) return false
      if (s.ladder && !allowLadders) return false
      if (s.water) return false // eau imposée séparément
      if (k === 'plateau' || k === 'arene') return false // réservés spawn / climax
      if (k === 'escalier-pierre') return false // marches de PIERRE : posées EXPLICITEMENT (biomes rocheux), pas au hasard
      return true
    })

  // séquence de familles pour les modules centraux (dosage 30/40/20/10, arrondi).
  const nFiller = Math.max(1, Math.round(mid * 0.3))
  const nRisque = Math.max(1, Math.round(mid * 0.2))
  const nTension = cap >= 2 ? Math.round(mid * 0.1) : 0
  const nTraverse = Math.max(1, mid - nFiller - nRisque - nTension)
  const bag: ('filler' | 'traverse' | 'risque' | 'tension')[] = [
    ...Array(nFiller).fill('filler'), ...Array(nTraverse).fill('traverse'),
    ...Array(nRisque).fill('risque'), ...Array(nTension).fill('tension'),
  ]
  // rythme : on ordonne selon un patron plaisant (traversée → filler → risque → tension tardif)
  const rhythm = ['traverse', 'filler', 'risque', 'traverse', 'filler', 'tension', 'traverse', 'risque', 'filler', 'traverse']
  const order: typeof bag = []
  for (const fam of rhythm) { const i = bag.indexOf(fam as never); if (i >= 0) { order.push(bag[i]!); bag.splice(i, 1) } }
  order.push(...bag)

  const modules: Module[] = []
  let chests = 0
  let lastKind: ModuleKind | null = null

  // 1) DÉPART : filler plat à mi-hauteur, AUCUN monstre (R127)
  modules.push(mk('plateau', { spawnHere: true, tags: ['respiration'] }))

  // 2) plan(s) d'eau imposé(s) : au moins un (eau + coffre), variété pilotée par waterKinds
  const waters = (o.waterKinds ?? ['bassin']).slice(0, 2)
  const waterSlots = new Set<number>()
  waters.forEach((_, i) => waterSlots.add(1 + Math.floor(((i + 1) * order.length) / (waters.length + 1))))

  // 3) modules centraux
  const groundQ = [...o.ground]
  const nextGround = (): string[] => (groundQ.length ? [groundQ.shift()!] : (o.ground.length ? [o.ground[0]!] : []))
  order.forEach((bucket, idx) => {
    if (waterSlots.has(idx + 1) && waters.length) {
      const wk = waters.shift()!
      const spec = CATALOG[wk]
      if (spec.chest && chests < 3) chests++
      modules.push(mk(wk, {
        ground: o.aquatic ?? [], birds: spec.birds ? [pick(o.birds)] : undefined,
        ...(o.lava && spec.below === 'marine' ? { fillBelow: 'lave' as Fill } : {}),
      }))
      lastKind = wk
      return
    }
    let cands = kindsOf(bucket)
    if (cands.length === 0) cands = kindsOf('traverse')
    if (cands.length === 0) cands = ['colline']
    // évite la répétition immédiate + respecte le plafond de coffres
    const fresh = cands.filter((k) => k !== lastKind)
    let kind = pick(fresh.length ? fresh : cands)
    if (CATALOG[kind].chest && chests >= 3) {
      const noChest = (fresh.length ? fresh : cands).filter((k) => !CATALOG[k].chest)
      if (noChest.length) kind = pick(noChest)
    }
    if (CATALOG[kind].chest) chests++
    const spec = CATALOG[kind]
    const mvpHere = o.mvp && bucket === 'risque' && idx >= order.length - 2 && !modules.some((m) => m.ground?.includes(o.mvp!))
    modules.push(mk(kind, {
      ground: [...(mvpHere ? [o.mvp!] : []), ...nextGround()],
      birds: spec.birds && o.birds.length ? flock(kind) : undefined,
    }))
    lastKind = kind
  })

  // 4) plan(s) d'eau non encore placé(s) (sécurité : garantit l'eau + un coffre)
  for (const wk of waters) {
    const spec = CATALOG[wk]
    if (spec.chest && chests < 3) chests++
    modules.push(mk(wk, {
      ground: o.aquatic ?? [], birds: spec.birds ? [pick(o.birds)] : undefined,
      ...(o.lava && spec.below === 'marine' ? { fillBelow: 'lave' as Fill } : {}),
    }))
  }

  // 5) SORTIE à altitude ≠ du départ (mi-hauteur = BASE_ALT 5) :
  //    ending 'bas'  → grande descente jusqu'au sol, arène-climax + PORTE en contrebas ;
  //    ending 'haut' → petite marche puis échelle/escalier, PORTE tout en haut.
  if (o.ending === 'bas') {
    modules.push(mk('descente-controlee', { rise: -40, ground: nextGround(), tags: ['relief', 'combat'] }))
    modules.push(mk('arene', { exitHere: true, ground: [...(o.mvp && !modules.some((m) => m.ground?.includes(o.mvp!)) ? [o.mvp] : []), ...nextGround()], tags: ['combat'] }))
  } else {
    modules.push(mk('marche', { ground: nextGround() }))
    const climb: ModuleKind = allowLadders ? 'echelle-tranquille' : 'escalier'
    if (climb === 'escalier') modules.push(mk('escalier', { rise: 6, exitHere: true, ground: nextGround(), tags: ['montée'] }))
    else modules.push(mk('echelle-tranquille', { exitHere: true, ground: nextGround(), tags: ['montée'] }))
  }

  return buildLevelFromModules(modules, { id: o.id, name: o.name, biome: o.biome, seed: o.seed })
}
