// Constantes de plateforme partagées par le jeu (Player/main) ET les tests, pour qu'on
// ne puisse pas régler un saut / poser une plateforme qui la rendrait inatteignable
// sans casser un test.

export const TILE = 32
// Hauteur de monde par DÉFAUT (en tuiles) et rangée de sol associée. Un niveau peut désormais
// être plus HAUT (LevelDef.heightTiles) ; sa rangée de sol se calcule alors avec groundRowFor().
// GROUND_ROW reste la valeur historique (monde de 16 rangées) pour ne rien régresser.
export const DEFAULT_HEIGHT_TILES = 16
export const GROUND_ROW = 14 // rangée du sol par défaut (= DEFAULT_HEIGHT_TILES - 2)
export const GRAVITY = 1200
export const JUMP_SPEED = 560 // magnitude de la vitesse de saut
export const RUN_SPEED = 220
// Le sol est TOUJOURS au bas du monde : deux rangées pleines (sol + sous-sol) → groundRow = h - 2.
export function groundRowFor(heightTiles = DEFAULT_HEIGHT_TILES): number {
  return heightTiles - 2
}
// Marge de confort du saut. Resserrée (0.6 → 0.55) : « atteignable » signifie désormais
// CONFORTABLEMENT atteignable, pas « atteignable pile au pixel au sommet de la parabole ». On
// n'exige donc plus le saut parfait, mais on refuse les plateformes réellement trop écartées.
const SAFETY = 0.55

export function maxJumpHeightPx(): number {
  return (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)
}

// Distance horizontale FRANCHISSABLE d'un trou au saut SIMPLE (sol → sol) : vitesse de course ×
// temps de vol d'un saut à plat × marge de confort. Un trou plus large que ça n'est pas garanti
// franchissable (voir level-validator.oversizedGaps). Même marge SAFETY que canReach.
export function maxJumpGapPx(): number {
  const airtime = (2 * JUMP_SPEED) / GRAVITY // durée d'un saut à plat (montée + descente)
  return RUN_SPEED * airtime * SAFETY
}
export function maxJumpTiles(): number {
  return maxJumpHeightPx() / TILE
}

// Hauteur minimale d'une échelle, en tuiles : au moins deux fois la hauteur de saut max, pour
// qu'aucune échelle ne puisse se franchir d'un simple saut (elle doit se grimper).
export const MIN_LADDER_TILES = Math.ceil(2 * maxJumpTiles())

// Hauteur MAXIMALE d'une échelle, en tuiles. Au-delà, on obtient une « échelle de l'enfer » qui
// monte pendant des plombes — grotesque à grimper. Les GRANDES montées verticales se font donc en
// SEGMENTS d'échelle empilés (chacun ≤ MAX_LADDER_TILES) séparés par de VRAIS PALIERS (plateformes)
// où l'on sort de l'échelle, on marche, puis on reprend l'échelle suivante — voir le builder `tower`.
export const MAX_LADDER_TILES = 13

export function ladderTooShort(h: number): boolean {
  return h < MIN_LADDER_TILES
}

export function ladderTooLong(h: number): boolean {
  return h > MAX_LADDER_TILES
}

// Prédicat de collision « one-way » (plateformes traversables par le bas) : on ne retient la
// collision que si le joueur DESCEND (velocityY >= 0). Tant qu'il monte, il traverse librement
// par le bas ; en retombant, il se pose dessus. On le retient tant que ses pieds (mesurés au
// DÉBUT de la frame, d'où prevBottom) ne sont pas passés SOUS le dessous de la dalle.
//
// On borne sur le DESSOUS de la dalle (et non sur « le dessus + 8px ») par ROBUSTESSE : dès que
// les pieds chevauchent la dalle en descendant, chaque frame les re-pose, sans risque qu'un
// enfoncement de quelques pixels franchisse une limite trop serrée et laisse le panda repartir
// en chute libre. (La vraie cause de la traversée du 2e étage d'un escalier était ailleurs — un
// squash d'atterrissage vertical qui déformait le corps physique, corrigé dans Player ; ce
// seuil élargi est un filet supplémentaire.) Le processCallback dans LevelScene s'appuie dessus.
export function landsOnOneWayPlatform(prevBottom: number, velocityY: number, platformBottom: number, margin = 0): boolean {
  return velocityY >= 0 && prevBottom <= platformBottom + margin
}

export interface Plat { x: number; y: number; w: number }

// Peut-on, en sautant depuis une surface à la rangée surfaceRow, atteindre la plateforme b
// dont le bord horizontal le plus proche est à hgapTiles ? On modélise la vraie parabole :
// on doit pouvoir monter jusqu'à la hauteur de b ET avoir parcouru assez horizontalement
// (au moment où la trajectoire repasse à cette hauteur), le tout avec une marge de confort.
export function canReach(surfaceRow: number, b: Plat, hgapTiles: number): boolean {
  const rise = (surfaceRow - b.y) * TILE // > 0 : b est plus haute
  const H = maxJumpHeightPx()
  if (rise > H) return false // trop haut pour le saut
  const disc = JUMP_SPEED * JUMP_SPEED - 2 * GRAVITY * rise
  const t = (JUMP_SPEED + Math.sqrt(Math.max(0, disc))) / GRAVITY
  const dxReachPx = RUN_SPEED * t * SAFETY
  return hgapTiles * TILE <= dxReachPx
}

function hgap(a: Plat, b: Plat): number {
  return Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)))
}

// Plateformes qu'on ne peut atteindre ni depuis le sol ni de proche en proche. Le sol du niveau
// est à groundRow (bas du monde) — paramétrable pour les mondes hauts.
export function unreachablePlatforms(platforms: Plat[], widthTiles: number, groundRow = GROUND_ROW): Plat[] {
  const ground: Plat = { x: 0, y: groundRow, w: widthTiles }
  const reachable = new Set<number>()
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < platforms.length; i++) {
      if (reachable.has(i)) continue
      const b = platforms[i]!
      const surfaces = [ground, ...[...reachable].map((j) => platforms[j]!)]
      if (surfaces.some((a) => canReach(a.y, b, hgap(a, b)))) {
        reachable.add(i)
        changed = true
      }
    }
  }
  return platforms.filter((_, i) => !reachable.has(i))
}
