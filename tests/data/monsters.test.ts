import { describe, it, expect } from 'vitest'
import { MONSTERS } from '../../src/data/monsters'
import { ITEMS } from '../../src/data/items'
import { MATERIALS } from '../../src/data/materials'

describe('données monstres/items', () => {
  it('les drops item pointent des items existants', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const d of m.drops) {
        if (d.kind === 'item') expect(ITEMS[d.itemId!], `${m.id}:${d.itemId}`).toBeDefined()
      }
    }
  })

  it('les drops material pointent des matériaux existants', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const d of m.drops) {
        if (d.kind === 'material') expect(MATERIALS[d.materialId!], `${m.id}:${d.materialId}`).toBeDefined()
      }
    }
  })

  it('exactement 6 boss', () => {
    expect(Object.values(MONSTERS).filter((m) => m.boss)).toHaveLength(6)
  })
})
