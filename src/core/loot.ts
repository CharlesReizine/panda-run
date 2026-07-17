import type { DropEntry } from './types'

export interface DropResult { gold: number; potions: number; items: string[]; materials: string[] }

export function rollDrops(drops: DropEntry[], rng: () => number = Math.random): DropResult {
  const result: DropResult = { gold: 0, potions: 0, items: [], materials: [] }
  for (const d of drops) {
    if (rng() >= d.chance) continue
    const qty = d.min + Math.floor(rng() * (d.max - d.min + 1))
    if (d.kind === 'gold') result.gold += qty
    else if (d.kind === 'potion') result.potions += qty
    else if (d.itemId) result.items.push(d.itemId)
    else if (d.kind === 'material' && d.materialId) {
      for (let i = 0; i < qty; i++) result.materials.push(d.materialId)
    }
  }
  return result
}
