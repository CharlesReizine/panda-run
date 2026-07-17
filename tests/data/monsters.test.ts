import { describe, it, expect } from 'vitest'
import { MONSTERS } from '../../src/data/monsters'
import { ITEMS } from '../../src/data/items'

describe('données monstres/items', () => {
  it('les drops item pointent des items existants', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const d of m.drops) {
        if (d.kind === 'item') expect(ITEMS[d.itemId!], `${m.id}:${d.itemId}`).toBeDefined()
      }
    }
  })

  it('exactement 2 boss', () => {
    expect(Object.values(MONSTERS).filter((m) => m.boss)).toHaveLength(2)
  })
})
