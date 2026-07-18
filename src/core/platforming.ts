// Constantes de plateforme partagées par le jeu (Player/main) ET les tests, pour qu'on
// ne puisse pas régler un saut / poser une plateforme qui la rendrait inatteignable
// sans casser un test.

export const TILE = 32
export const GROUND_ROW = 14 // rangée du sol (y en tuiles depuis le haut)
export const GRAVITY = 1200
export const JUMP_SPEED = 560 // magnitude de la vitesse de saut
export const RUN_SPEED = 220
const SAFETY = 0.6 // marge : on n'exige pas un saut parfait au pixel, il doit rester confortable

export function maxJumpHeightPx(): number {
  return (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)
}
export function maxJumpTiles(): number {
  return maxJumpHeightPx() / TILE
}

// Hauteur minimale d'une échelle, en tuiles : au moins deux fois la hauteur de saut max, pour
// qu'aucune échelle ne puisse se franchir d'un simple saut (elle doit se grimper).
export const MIN_LADDER_TILES = Math.ceil(2 * maxJumpTiles())

export function ladderTooShort(h: number): boolean {
  return h < MIN_LADDER_TILES
}

// Prédicat de collision « one-way » (plateformes traversables par le bas) : on ne retient
// la collision que si le joueur descend (velocityY >= 0) ET que ses pieds venaient d'au-dessus
// du haut de la plateforme. On monte donc librement à travers, puis on se pose dessus en
// retombant. Le processCallback du collider dans LevelScene s'appuie dessus.
export function landsOnOneWayPlatform(prevBottom: number, velocityY: number, platformTop: number, margin = 8): boolean {
  return velocityY >= 0 && prevBottom <= platformTop + margin
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

// Plateformes qu'on ne peut atteindre ni depuis le sol ni de proche en proche.
export function unreachablePlatforms(platforms: Plat[], widthTiles: number): Plat[] {
  const ground: Plat = { x: 0, y: GROUND_ROW, w: widthTiles }
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
