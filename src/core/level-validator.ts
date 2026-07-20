// Validateur STATIQUE d'atteignabilité d'un niveau. Déterministe, fonctions PURES : on
// rejoue la géométrie (plateformes + échelles) avec le modèle de saut de platforming.ts pour
// garantir qu'un niveau est PHYSIQUEMENT jouable — chaque plateforme accessible, aucune
// échelle qui débouche sur le vide, aucun coffre posé sur une plateforme injoignable.
//
// Une échelle est modélisée comme un connecteur VERTICAL : contrairement au saut, elle relie
// son pied (au sol / sur une plateforme) à son sommet, quelle que soit la dénivelée. Le
// sommet d'une échelle est donc atteignable dès que son pied l'est, ce que le simple
// `unreachablePlatforms` de platforming.ts (sauts uniquement) ne sait pas modéliser.

import { groundRowFor, canReach, maxJumpGapPx, TILE, type Plat } from './platforming'
import type { LevelDef } from '../data/levels'

const ROW_TOL = 1 // tolérance verticale (en tuiles) pour « le dessus est à la rangée y »

interface Ladder { x: number; y: number; h: number }

export interface LadderProblem { x: number; y: number; h: number; reason: 'sommet-sans-plateforme' | 'pied-dans-le-vide' }
export interface ChestProblem { x: number; y: number }
export interface GapProblem { x: number; w: number }

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

// Plateformes qu'on ne peut atteindre ni du sol, ni de proche en proche par saut, ni en
// grimpant une échelle dont le pied est accessible. Point fixe (itération jusqu'à stabilité).
export function unreachablePlatforms(level: LevelDef): Plat[] {
  const platforms = level.platforms
  const ladders = (level.ladders ?? []) as Ladder[]
  const groundRow = groundRowFor(level.heightTiles)
  const ground: Plat = { x: 0, y: groundRow, w: level.widthTiles }
  const reachable = new Set<number>()
  let changed = true
  while (changed) {
    changed = false
    const surfaces = [ground, ...[...reachable].map((j) => platforms[j]!)]
    for (let i = 0; i < platforms.length; i++) {
      if (reachable.has(i)) continue
      const b = platforms[i]!
      // (1) atteignable par saut depuis le sol ou une plateforme déjà atteignable
      if (surfaces.some((a) => canReach(a.y, b, hgap(a, b)))) { reachable.add(i); changed = true; continue }
      // (2) sommet d'une échelle dont le pied est accessible
      if (ladders.some((l) => isLadderTop(b, l) && ladderFootReachable(l, platforms, reachable, groundRow))) {
        reachable.add(i); changed = true
      }
    }
  }
  return platforms.filter((_, i) => !reachable.has(i))
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

// Trous du sol trop LARGES pour être franchis au saut simple (w × TILE > distance de saut
// confortable). Le sol couvre toute la largeur (les plateformes restent atteignables du sol,
// donc un trou ne casse jamais l'atteignabilité) ; on ne vérifie ici que la franchissabilité.
export function oversizedGaps(level: LevelDef): GapProblem[] {
  const max = maxJumpGapPx()
  return (level.gaps ?? []).filter((g) => g.w * TILE > max).map((g) => ({ x: g.x, w: g.w }))
}

// Coffres posés sur plateforme (props avec y) dont la plateforme est absente ou injoignable.
export function unreachableChests(level: LevelDef): ChestProblem[] {
  const bad = new Set(unreachablePlatforms(level))
  const out: ChestProblem[] = []
  for (const c of level.props ?? []) {
    if (c.kind !== 'coffre' || c.y === undefined) continue
    const plat = level.platforms.find((p) => c.x >= p.x && c.x < p.x + p.w && c.y === p.y - 1)
    if (!plat || bad.has(plat)) out.push({ x: c.x, y: c.y })
  }
  return out
}
