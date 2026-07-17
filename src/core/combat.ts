export function physicalDamage(atk: number, def: number, multiplier = 1): number {
  return Math.max(1, Math.round(atk * multiplier - def))
}
