import { describe, it, expect } from 'vitest'
import { PROPS } from '../../src/data/props'
import { MATERIALS } from '../../src/data/materials'
import { ITEMS } from '../../src/data/items'

describe('données props', () => {
  it('4 props (herbe, champignon, roche, coffre)', () => {
    expect(Object.keys(PROPS).sort()).toEqual(['champignon', 'coffre', 'herbe', 'roche'])
  })

  it('les drops material des props pointent des matériaux existants', () => {
    for (const p of Object.values(PROPS)) {
      for (const d of p.drops) {
        if (d.kind === 'material') expect(MATERIALS[d.materialId!], `${p.id}:${d.materialId}`).toBeDefined()
        if (d.kind === 'item') expect(ITEMS[d.itemId!], `${p.id}:${d.itemId}`).toBeDefined()
      }
    }
  })

  it('hp positifs', () => {
    for (const p of Object.values(PROPS)) expect(p.hp).toBeGreaterThan(0)
  })
})
