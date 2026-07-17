export function physicalDamage(atk: number, def: number, multiplier = 1): number {
  return Math.max(1, Math.round(atk * multiplier - def))
}

// Une cible est à portée de mêlée si elle est devant (ou pile sur le perso) et pas trop
// décalée verticalement. La tolérance verticale (90) absorbe l'écart de hauteur entre le
// centre du panda (grand sprite) et celui des monstres (petits). dxFacing = (cible.x - perso.x) * facing.
export function inMeleeReach(dxFacing: number, dyAbs: number, reach: number): boolean {
  return dyAbs < 90 && dxFacing > -24 && dxFacing < reach + 20
}
