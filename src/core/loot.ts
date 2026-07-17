import type { DropEntry } from './types'

export interface DropResult { gold: number; potions: number; items: string[] }

export function rollDrops(drops: DropEntry[], rng: () => number = Math.random): DropResult {
  const result: DropResult = { gold: 0, potions: 0, items: [] }
  for (const d of drops) {
    if (rng() >= d.chance) continue
    const qty = d.min + Math.floor(rng() * (d.max - d.min + 1))
    if (d.kind === 'gold') result.gold += qty
    else if (d.kind === 'potion') result.potions += qty
    else if (d.itemId) result.items.push(d.itemId)
  }
  return result
}
