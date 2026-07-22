import { describe, it, expect } from 'vitest'
import { MONSTERS } from '../../src/data/monsters'
import { LEVELS } from '../../src/data/levels'
import { statPower } from '../../src/core/mob-stats'

const GIANTS = Object.values(MONSTERS).filter((m) => m.id.endsWith('-geant') && m.artFrom)

describe('variantes géantes', () => {
  it('il existe plusieurs variantes géantes', () => {
    expect(GIANTS.length).toBeGreaterThanOrEqual(6)
  })

  it('chaque géant réutilise l\'art de sa base, est de gabarit grand, et de niveau + stats SUPÉRIEURS', () => {
    for (const g of GIANTS) {
      const base = MONSTERS[g.artFrom!]
      expect(base, `base ${g.artFrom} de ${g.id}`).toBeDefined()
      expect(g.size).toBe('grand')
      expect(g.level, `${g.id} niveau > base`).toBeGreaterThan(base!.level)
      expect(g.hp, `${g.id} PV > base`).toBeGreaterThan(base!.hp)
      expect(statPower(g.hp, g.atk, g.def)).toBeGreaterThan(statPower(base!.hp, base!.atk, base!.def))
    }
  })
})

describe('menaces aquatiques (font mal au nageur)', () => {
  const THREATS = ['requin', 'meduse', 'piranha']
  it('requin / méduse / piranha existent, nagent (aquatic) et ont une ATK > 0', () => {
    for (const id of THREATS) {
      const m = MONSTERS[id]
      expect(m, id).toBeDefined()
      expect(m!.aquatic, `${id} aquatic`).toBe(true)
      expect(m!.atk, `${id} atk`).toBeGreaterThan(0)
    }
  })

  it('les menaces d\'eau sont posées dans les plans d\'eau de plusieurs biomes (pas un seul)', () => {
    const biomesWithThreat = new Set<string>()
    for (const lv of Object.values(LEVELS)) {
      if (lv.spawns.some((s) => THREATS.includes(s.monsterId))) biomesWithThreat.add(lv.biome)
    }
    expect(biomesWithThreat.size).toBeGreaterThanOrEqual(3)
  })
})

describe('cohérence stats↔niveau sur le roster réel (mobs normaux)', () => {
  const normals = Object.values(MONSTERS).filter((m) => m.role) // rôle = stats dérivées du niveau
  it('aucun mob de niveau ≥ L+8 n\'est plus faible qu\'un mob de niveau L (fin des « niv7 = niv1 »)', () => {
    for (const a of normals) {
      for (const b of normals) {
        if (b.level >= a.level + 8) {
          expect(statPower(b.hp, b.atk, b.def), `${b.id}(L${b.level}) vs ${a.id}(L${a.level})`)
            .toBeGreaterThan(statPower(a.hp, a.atk, a.def))
        }
      }
    }
  })
})
