// Constantes de plateforme partagées par le jeu (Player/main) ET les tests, pour qu'on
// ne puisse pas régler un saut qui rendrait des plateformes inatteignables sans casser un test.

export const TILE = 32
export const GROUND_ROW = 14 // rangée du sol (y en tuiles depuis le haut)
export const GRAVITY = 1200
export const JUMP_SPEED = 560 // magnitude de la vitesse de saut
export const MAX_HJUMP_TILES = 6 // portée horizontale approximative d'un saut

// hauteur max d'un saut, en pixels puis en tuiles : v²/(2g)
export function maxJumpHeightPx(): number {
  return (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)
}
export function maxJumpTiles(): number {
  return maxJumpHeightPx() / TILE
}

export interface Plat { x: number; y: number; w: number }

// Peut-on sauter de la surface a vers la plateforme b ?
// - b pas plus haute que le saut max au-dessus de a
// - intervalles horizontaux assez proches
function canJump(a: Plat, b: Plat, maxUp: number): boolean {
  const rise = a.y - b.y // > 0 : b est plus haute (il faut sauter)
  if (rise > maxUp) return false
  const gap = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)))
  return gap <= MAX_HJUMP_TILES
}

// Plateformes qu'on ne peut atteindre ni depuis le sol ni de proche en proche.
export function unreachablePlatforms(platforms: Plat[], widthTiles: number): Plat[] {
  const maxUp = maxJumpTiles()
  const ground: Plat = { x: 0, y: GROUND_ROW, w: widthTiles }
  const reachable = new Set<number>()
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < platforms.length; i++) {
      if (reachable.has(i)) continue
      const b = platforms[i]!
      const surfaces = [ground, ...[...reachable].map((j) => platforms[j]!)]
      if (surfaces.some((a) => canJump(a, b, maxUp))) {
        reachable.add(i)
        changed = true
      }
    }
  }
  return platforms.filter((_, i) => !reachable.has(i))
}
