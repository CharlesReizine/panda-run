// Validateur STATIQUE d'atteignabilité d'un niveau. Déterministe, fonctions PURES : on
// rejoue la géométrie (plateformes + échelles) avec le modèle de saut de platforming.ts pour
// garantir qu'un niveau est PHYSIQUEMENT jouable — chaque plateforme accessible, aucune
// échelle qui débouche sur le vide, aucun coffre posé sur une plateforme injoignable.
//
// Une échelle est modélisée comme un connecteur VERTICAL : contrairement au saut, elle relie
// son pied (au sol / sur une plateforme) à son sommet, quelle que soit la dénivelée. Le
// sommet d'une échelle est donc atteignable dès que son pied l'est, ce que le simple
// `unreachablePlatforms` de platforming.ts (sauts uniquement) ne sait pas modéliser.

import { groundRowFor, canReach, maxJumpGapPx, MAX_LADDER_TILES, TILE, type Plat } from './platforming'
import type { LevelDef } from '../data/levels'

const ROW_TOL = 1 // tolérance verticale (en tuiles) pour « le dessus est à la rangée y »

interface Ladder { x: number; y: number; h: number }

export interface LadderProblem { x: number; y: number; h: number; reason: 'sommet-sans-plateforme' | 'pied-dans-le-vide' }
export interface ChestProblem { x: number; y: number }
export interface GapProblem { x: number; w: number }
export interface OversizedLadder { x: number; y: number; h: number }

function hgap(a: Plat, b: Plat): number {
  return Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)))
}

// Décalage PIEDS↔CENTRE du panda ≈ 40px ≈ 1,25 tuile : en grimpant jusqu'en haut, son CENTRE
// atteint ~la rangée du haut du montant (l.y) et ses PIEDS sont ~1,25 tuile PLUS BAS. Une
// plateforme posée pile à l.y serait donc à hauteur de tête, inatteignable. Elle n'est
// « posable » au sommet que si son dessus est 1 à 2 rangées SOUS le haut de l'échelle
// (l.y+1..l.y+2) — là où les pieds arrivent, avec un petit saut vers le bas pour s'y poser —
// ET qu'elle est horizontalement adjacente au montant (l'x de l'échelle tombe entre platX-1 et
// platX+platW+1, à gauche OU à droite).
const LADDER_TOP_MIN_DROP = 1 // rangées sous l.y : borne HAUTE atteignable (pieds à ~1,25 tuile sous le centre)
const LADDER_TOP_MAX_DROP = 2 // rangées sous l.y : borne BASSE (au-delà, la plateforme décroche du sommet)
function isLadderTop(p: Plat, l: Ladder): boolean {
  const drop = p.y - l.y
  return drop >= LADDER_TOP_MIN_DROP && drop <= LADDER_TOP_MAX_DROP && l.x >= p.x - 1 && l.x <= p.x + p.w + 1
}

// Le pied de l'échelle (rangée y+h) rejoint-il le sol (au BAS du monde) ou une plateforme ? (b)
function ladderFootGrounded(l: Ladder, platforms: Plat[], groundRow: number): boolean {
  const bottom = l.y + l.h
  if (bottom >= groundRow) return true // descend jusqu'au sol
  return platforms.some((p) => Math.abs(p.y - bottom) <= ROW_TOL && l.x >= p.x - 1 && l.x <= p.x + p.w + 1)
}

// Le pied de l'échelle repose-t-il sur une surface DÉJÀ atteignable (sol, ou plateforme du
// set) ? — condition pour pouvoir emprunter l'échelle et donc atteindre son sommet.
function ladderFootReachable(l: Ladder, platforms: Plat[], reachable: Set<number>, groundRow: number): boolean {
  const bottom = l.y + l.h
  if (bottom >= groundRow) return true // pied au sol : toujours accessible
  return platforms.some((p, i) => reachable.has(i)
    && Math.abs(p.y - bottom) <= ROW_TOL && l.x >= p.x - 1 && l.x <= p.x + p.w + 1)
}

// Graphe d'atteignabilité (point fixe) : surfaces joignables du sol, de proche en proche par saut,
// ou par une échelle dont le pied est accessible. Les PONTS sont des surfaces marchables (one-way)
// au même titre que les plateformes : inclus comme relais, sinon une traversée qui passe par un pont
// (ex. franchir une cuve) ferait croire la rive opposée injoignable. Renvoie les nœuds (plateformes
// PUIS ponts), l'ensemble des indices atteignables, le nb de plateformes et le sol.
interface ReachInfo { nodes: Plat[]; reachable: Set<number>; nPlat: number; groundRow: number; ground: Plat }
function computeReach(level: LevelDef): ReachInfo {
  const platforms = level.platforms
  const bridges = (level.bridges ?? []).map((b) => ({ x: b.x, y: b.y, w: b.w }))
  const nodes: Plat[] = [...platforms, ...bridges]
  const ladders = (level.ladders ?? []) as Ladder[]
  const groundRow = groundRowFor(level.heightTiles)
  const ground: Plat = { x: 0, y: groundRow, w: level.widthTiles }
  const reachable = new Set<number>()
  let changed = true
  while (changed) {
    changed = false
    const surfaces = [ground, ...[...reachable].map((j) => nodes[j]!)]
    for (let i = 0; i < nodes.length; i++) {
      if (reachable.has(i)) continue
      const b = nodes[i]!
      // (1) atteignable par saut depuis le sol ou une surface déjà atteignable
      if (surfaces.some((a) => canReach(a.y, b, hgap(a, b)))) { reachable.add(i); changed = true; continue }
      // (2) sommet d'une échelle dont le pied est accessible (plateformes uniquement)
      if (i < platforms.length && ladders.some((l) => isLadderTop(b, l) && ladderFootReachable(l, platforms, reachable, groundRow))) {
        reachable.add(i); changed = true
      }
    }
  }
  return { nodes, reachable, nPlat: platforms.length, groundRow, ground }
}

// Plateformes qu'on ne peut atteindre ni du sol, ni de proche en proche par saut, ni en
// grimpant une échelle dont le pied est accessible.
export function unreachablePlatforms(level: LevelDef): Plat[] {
  const { nodes, reachable, nPlat } = computeReach(level)
  return nodes.slice(0, nPlat).filter((_, i) => !reachable.has(i))
}

// Échelles « vers le vide » : sommet sans plateforme posable (a) ou pied qui ne rejoint ni
// le sol ni une plateforme (b).
export function laddersToNowhere(level: LevelDef): LadderProblem[] {
  const groundRow = groundRowFor(level.heightTiles)
  const out: LadderProblem[] = []
  for (const l of (level.ladders ?? []) as Ladder[]) {
    const hasTop = level.platforms.some((p) => isLadderTop(p, l))
    if (!hasTop) { out.push({ x: l.x, y: l.y, h: l.h, reason: 'sommet-sans-plateforme' }); continue }
    if (!ladderFootGrounded(l, level.platforms, groundRow)) out.push({ x: l.x, y: l.y, h: l.h, reason: 'pied-dans-le-vide' })
  }
  return out
}

// Échelles dont le pied n'est pas accessible à pied (sol ou plateforme atteignable). Utile en
// complément : une échelle peut avoir un sommet correct mais un pied injoignable.
export function unreachableLadders(level: LevelDef): LadderProblem[] {
  const groundRow = groundRowFor(level.heightTiles)
  const bad = new Set(unreachablePlatforms(level))
  const reachable = new Set<number>()
  level.platforms.forEach((p, i) => { if (!bad.has(p)) reachable.add(i) })
  const out: LadderProblem[] = []
  for (const l of (level.ladders ?? []) as Ladder[]) {
    if (!ladderFootReachable(l, level.platforms, reachable, groundRow)) {
      out.push({ x: l.x, y: l.y, h: l.h, reason: 'pied-dans-le-vide' })
    }
  }
  return out
}

// Échelles trop LONGUES (h > MAX_LADDER_TILES) : une échelle unique géante est proscrite — une
// grande montée doit être découpée en SEGMENTS empilés séparés par des paliers (voir builder tower).
export function oversizedLadders(level: LevelDef): OversizedLadder[] {
  return ((level.ladders ?? []) as Ladder[])
    .filter((l) => l.h > MAX_LADDER_TILES)
    .map((l) => ({ x: l.x, y: l.y, h: l.h }))
}

// Trous du sol trop LARGES pour être franchis au saut simple (w × TILE > distance de saut
// confortable). Le sol couvre toute la largeur (les plateformes restent atteignables du sol,
// donc un trou ne casse jamais l'atteignabilité) ; on ne vérifie ici que la franchissabilité.
export function oversizedGaps(level: LevelDef): GapProblem[] {
  const max = maxJumpGapPx()
  return (level.gaps ?? []).filter((g) => g.w * TILE > max).map((g) => ({ x: g.x, w: g.w }))
}

// ─── VALIDATEURS DU KIT DE MODULES (jouabilité + cohérence, cf. docs/level-module-kit.md) ────

export interface TierProblem { x: number; tiers: number }
export interface WaterProblem { x: number; w: number; water?: string }
export interface SpawnProblem { monsterId: string; x: number; y?: number; reason: string }

// Nombre MAXIMAL de paliers empilés (plateformes/ponts + sol) à une colonne x. Une grande verticale
// (tour d'échelles) empile beaucoup de paliers ; le kit impose ≤ 3 (silhouette collines).
export function maxStackedTiers(level: LevelDef): number {
  const groundRow = groundRowFor(level.heightTiles)
  const isGap = (x: number) => (level.gaps ?? []).some((g) => x >= g.x && x < g.x + g.w)
  const surfaces = [
    ...level.platforms.map((p) => ({ x: p.x, w: p.w })),
    ...(level.bridges ?? []).map((b) => ({ x: b.x, w: b.w })),
  ]
  let max = 0
  for (let x = 0; x < level.widthTiles; x++) {
    let n = isGap(x) ? 0 : 1 // le sol compte comme 1 palier (sauf trou)
    for (const s of surfaces) if (x >= s.x && x < s.x + s.w) n++
    if (n > max) max = n
  }
  return max
}

// Renvoie les colonnes où plus de `limit` paliers sont empilés (défaut 3).
export function overStackedColumns(level: LevelDef, limit = 3): TierProblem[] {
  const groundRow = groundRowFor(level.heightTiles)
  const isGap = (x: number) => (level.gaps ?? []).some((g) => x >= g.x && x < g.x + g.w)
  const surfaces = [
    ...level.platforms.map((p) => ({ x: p.x, w: p.w })),
    ...(level.bridges ?? []).map((b) => ({ x: b.x, w: b.w })),
  ]
  const out: TierProblem[] = []
  for (let x = 0; x < level.widthTiles; x++) {
    let n = isGap(x) ? 0 : 1
    for (const s of surfaces) if (x >= s.x && x < s.x + s.w) n++
    if (n > limit) out.push({ x, tiers: n })
  }
  void groundRow
  return out
}

// Eau NON ENCLOSE dans une cuve de pierre : le kit n'autorise que 'basin' (marine) et 'cascade' —
// des formes contenues (murs/fond posés par le moteur). Une nappe LIBRE (water absent) ou une
// 'waterfall' décorative n'est pas une cuve jouable → rejetée pour un niveau modulaire.
export function openWaterHazards(level: LevelDef): WaterProblem[] {
  return (level.hazards ?? [])
    .filter((h) => h.kind === 'water' && h.water !== 'basin' && h.water !== 'cascade')
    .map((h) => ({ x: h.x, w: h.w, water: h.water }))
}

// Monstres TERRESTRES (non aériens) mal posés : un spawn avec y doit reposer sur une surface
// (plateforme) présente à cette rangée, assez large pour patrouiller (≥ minWidth tuiles). Les
// oiseaux (aerial) volent → exclus. Les spawns sans y sont au sol (toujours valides).
export function monstersOffSurface(level: LevelDef, isAerial: (id: string) => boolean, minWidth = 3): SpawnProblem[] {
  const out: SpawnProblem[] = []
  for (const s of level.spawns) {
    if (s.y === undefined || isAerial(s.monsterId)) continue
    const plat = level.platforms.find((p) => s.x >= p.x - 1 && s.x <= p.x + p.w && p.y === s.y)
    if (!plat) { out.push({ monsterId: s.monsterId, x: s.x, y: s.y, reason: 'aucune-surface' }); continue }
    if (plat.w < minWidth) out.push({ monsterId: s.monsterId, x: s.x, y: s.y, reason: 'surface-trop-etroite' })
  }
  return out
}

// Problèmes de DÉPART / SORTIE : le départ doit exister à MI-HAUTEUR (ni collé au sol, ni au
// plafond) et la sortie doit exister à une altitude NETTEMENT différente du départ (≥ 3 rangées).
export function startExitProblems(level: LevelDef, minAltGap = 3): string[] {
  const groundRow = groundRowFor(level.heightTiles)
  const out: string[] = []
  if (!level.start) { out.push('départ absent'); return out }
  if (!level.exit) { out.push('sortie absente'); return out }
  if (level.start.y >= groundRow) out.push('départ collé au sol (pas mi-hauteur)')
  if (level.start.y <= 2) out.push('départ collé au plafond (pas mi-hauteur)')
  if (Math.abs(level.start.y - level.exit.y) < minAltGap) out.push('sortie à la même altitude que le départ')
  return out
}

// Un coffre AU FOND (sans y) est atteignable par NAGE si son plan d'eau (bassin marine) est ENTRABLE
// depuis une surface marchable atteignable adjacente : il faut (1) une COLONNE OUVERTE en surface
// (non scellée par un pont) pour PLONGER, et (2) une surface marchable ATTEIGNABLE qui BORDE le
// bassin au niveau de sa surface (pour rejoindre le point de plongée puis RESSORTIR). Un lac entouré
// de falaises (aucune surface joignable à son niveau) ou entièrement ponté rend le coffre injoignable.
function bottomChestReachable(level: LevelDef, cx: number, reachSurfaces: Plat[], groundRow: number): boolean {
  const water = (level.hazards ?? []).find((h) => h.kind === 'water' && h.water === 'basin' && cx >= h.x && cx < h.x + h.w)
  if (!water) {
    // pas dans l'eau → coffre posé au sol : injoignable seulement s'il est au-dessus d'un trou mortel
    return !(level.gaps ?? []).some((g) => cx >= g.x && cx < g.x + g.w)
  }
  const surfaceRow = water.top ?? groundRow - 2
  const covers = (x: number) => [...level.platforms, ...(level.bridges ?? [])]
    .some((p) => x >= p.x && x < p.x + p.w && Math.abs(p.y - surfaceRow) <= 1)
  // (1) au moins une colonne d'eau OUVERTE en surface (par où plonger dans le bassin)
  let open = false
  for (let x = water.x; x < water.x + water.w; x++) if (!covers(x)) { open = true; break }
  if (!open) return false
  // (2) une surface marchable ATTEIGNABLE borde le bassin au niveau de sa surface (accès + sortie)
  return reachSurfaces.some((s) => Math.abs(s.y - surfaceRow) <= 1 && s.x <= water.x + water.w && s.x + s.w >= water.x)
}

// Coffres injoignables : posés sur une plateforme absente/injoignable (coffre AVEC y), OU au fond
// d'un bassin qu'on ne peut pas entrer/ressortir à la nage (coffre SANS y). Le test casse le build
// si un seul coffre est injoignable (bug du coffre dans un lac inaccessible).
export function unreachableChests(level: LevelDef): ChestProblem[] {
  const bad = new Set(unreachablePlatforms(level))
  const reach = computeReach(level)
  const reachSurfaces = [reach.ground, ...[...reach.reachable].map((i) => reach.nodes[i]!)]
  const out: ChestProblem[] = []
  for (const c of level.props ?? []) {
    if (c.kind !== 'coffre') continue
    if (c.y !== undefined) {
      // coffre POSÉ sur une plateforme : elle doit exister ET être atteignable
      const plat = level.platforms.find((p) => c.x >= p.x && c.x < p.x + p.w && c.y === p.y - 1)
      if (!plat || bad.has(plat)) out.push({ x: c.x, y: c.y })
      continue
    }
    // coffre AU FOND (sans y) : au sol marchable, ou au fond d'un bassin atteignable à la NAGE
    if (!bottomChestReachable(level, c.x, reachSurfaces, reach.groundRow)) out.push({ x: c.x, y: reach.groundRow - 1 })
  }
  return out
}
