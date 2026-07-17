import { describe, it, expect } from 'vitest'
import { MATERIALS } from '../../src/data/materials'

describe('données matériaux', () => {
  it('8 matériaux, ids/noms/couleurs renseignés', () => {
    const all = Object.values(MATERIALS)
    expect(all).toHaveLength(8)
    for (const m of all) {
      expect(m.id.length).toBeGreaterThan(0)
      expect(m.name.length).toBeGreaterThan(0)
      expect(m.color).toBeGreaterThanOrEqual(0)
    }
  })

  it('la clé du record correspond à l id', () => {
    for (const [key, m] of Object.entries(MATERIALS)) expect(m.id).toBe(key)
  })
})
