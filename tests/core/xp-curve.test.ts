import { describe, it, expect } from 'vitest'
import { MONSTERS } from '../../src/data/monsters'
import { LEVELS } from '../../src/data/levels'
import { playerXpForMobLevel } from '../../src/core/progression'
import { playerLevelForXp } from '../../src/core/mob-level'

describe('récompense d\'XP ∝ niveau du monstre', () => {
  it('playerXpForMobLevel est strictement croissant et ≥ 1', () => {
    let prev = 0
    for (let L = 1; L <= 80; L++) {
      const r = playerXpForMobLevel(L)
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeGreaterThan(prev)
      prev = r
    }
  })
})

// XP cumulée le long du TRONC PRINCIPAL de la carte (worldmap) jusqu'aux villes-repères.
function trunkReward(levelIds: string[]): number {
  let sum = 0
  for (const id of levelIds) {
    const lv = LEVELS[id]
    if (!lv) continue
    for (const s of lv.spawns) {
      const m = MONSTERS[s.monsterId]
      if (m && !s.monsterId.startsWith('gardien-')) sum += playerXpForMobLevel(m.level)
    }
    if (lv.boss) { const b = MONSTERS[lv.boss]; if (b) sum += playerXpForMobLevel(b.level) }
  }
  return sum
}

const TO_PRONTERA = ['plaine-1', 'plaine-2', 'plaine-3', 'plaine-4', 'plaine-5']
const TO_MOROCC = [...TO_PRONTERA, 'plaine-6', 'foret-1', 'plaine-7', 'foret-7', 'desert-1', 'desert-2', 'desert-3']

describe('repères de progression (playthrough tronc principal)', () => {
  it('PRONTERA (fin de plaine) ≈ niveau 4-6', () => {
    // Échelle « distance Dijkstra ×2 » (cf. mob-level.ts) : la plaine est le rang 1-6, on arrive à
    // Prontera vers le niveau 5 en tuant une fois le tronc.
    const lvl = playerLevelForXp(trunkReward(TO_PRONTERA))
    expect(lvl).toBeGreaterThanOrEqual(4)
    expect(lvl).toBeLessThanOrEqual(6)
  })

  it('MOROCC (fin de désert accessible) ≈ niveau 15-20', () => {
    const lvl = playerLevelForXp(trunkReward(TO_MOROCC))
    expect(lvl).toBeGreaterThanOrEqual(15)
    expect(lvl).toBeLessThanOrEqual(20)
  })

  it('le passage plaine→désert est un MUR de niveau (gros saut) qui force à farmer', () => {
    const pront = playerLevelForXp(trunkReward(TO_PRONTERA))
    const moro = playerLevelForXp(trunkReward(TO_MOROCC))
    expect(moro - pront).toBeGreaterThanOrEqual(10)
  })
})
