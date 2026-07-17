import { describe, it, expect } from 'vitest'
import { rollDrops } from '../../src/core/loot'
import type { DropEntry } from '../../src/core/types'

const drops: DropEntry[] = [
  { kind: 'gold', chance: 1, min: 5, max: 10 },
  { kind: 'potion', chance: 0.5, min: 1, max: 1 },
  { kind: 'item', itemId: 'epee-bambou', chance: 0.1, min: 1, max: 1 },
]

describe('rollDrops', () => {
  it('rng à 0 : tout drop, quantités min', () => {
    const r = rollDrops(drops, () => 0)
    expect(r.gold).toBe(5)
    expect(r.potions).toBe(1)
    expect(r.items).toEqual(['epee-bambou'])
  })

  it('rng à 0.99 : seul le drop garanti tombe, quantité max', () => {
    const r = rollDrops(drops, () => 0.99)
    expect(r.gold).toBe(10)
    expect(r.potions).toBe(0)
    expect(r.items).toEqual([])
  })
})
