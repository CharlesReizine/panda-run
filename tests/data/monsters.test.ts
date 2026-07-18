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

  it('chaque MVP droppe au moins un item épique ou légendaire, sans être un boss', () => {
    const mvps = Object.values(MONSTERS).filter((m) => m.mvp)
    expect(mvps.length).toBeGreaterThanOrEqual(4)
    for (const m of mvps) {
      expect(m.boss, `${m.id} ne doit pas être un boss`).toBeFalsy()
      const hasRare = m.drops.some(
        (d) => d.kind === 'item' && ['epique', 'legendaire'].includes(ITEMS[d.itemId!]?.rarity ?? 'commun'),
      )
      expect(hasRare, `${m.id} doit droper un item épique/légendaire`).toBe(true)
    }
  })
})
