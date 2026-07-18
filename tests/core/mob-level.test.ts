import { describe, it, expect } from 'vitest'
import { xpToNext } from '../../src/core/progression'
import {
  playerLevelForXp,
  levelXp,
  cumXpBelow,
  mobLevelForZone,
  computeMonsterLevels,
  LEVEL_ORDER,
  ZONE_XP_FACTOR,
} from '../../src/core/mob-level'
import { MONSTERS } from '../../src/data/monsters'

describe('playerLevelForXp', () => {
  it('0 XP reste au niveau 1', () => {
    expect(playerLevelForXp(0)).toBe(1)
  })

  it('XP négative reste au niveau 1', () => {
    expect(playerLevelForXp(-500)).toBe(1)
  })

  it('juste sous le palier ne monte pas ; au palier monte', () => {
    const need = xpToNext(1) // XP pour passer du niveau 1 au niveau 2
    expect(playerLevelForXp(need - 1)).toBe(1)
    expect(playerLevelForXp(need)).toBe(2)
  })

  it('cohérent avec la somme des paliers (niveau 5 = somme xpToNext(1..4))', () => {
    const total = xpToNext(1) + xpToNext(2) + xpToNext(3) + xpToNext(4)
    expect(playerLevelForXp(total)).toBe(5)
    expect(playerLevelForXp(total - 1)).toBe(4)
  })

  it('est monotone croissant', () => {
    let prev = playerLevelForXp(0)
    for (let xp = 0; xp <= 400000; xp += 2500) {
      const lvl = playerLevelForXp(xp)
      expect(lvl).toBeGreaterThanOrEqual(prev)
      prev = lvl
    }
  })
})

describe('levelXp / cumXpBelow', () => {
  it('levelXp somme l\'XP des spawns et du boss', () => {
    const boss = LEVEL_ORDER.find((l) => l.boss && l.spawns.length === 0)!
    expect(levelXp(boss)).toBe(MONSTERS[boss.boss!]!.xp)
  })

  it('cumXpBelow(0) vaut 0 et croît avec l\'index', () => {
    expect(cumXpBelow(0)).toBe(0)
    let prev = 0
    LEVEL_ORDER.forEach((_, i) => {
      const cum = cumXpBelow(i)
      expect(cum).toBeGreaterThanOrEqual(prev)
      prev = cum
    })
  })
})

describe('invariant de calibrage', () => {
  // Pour chaque zone, le niveau de base des mobs doit rester entre le niveau-joueur à 1× et à 2×
  // le contenu situé en dessous, et coller à ~1,5×.
  it('mobLevelForZone(cum) est dans [playerLevelForXp(1×cum), playerLevelForXp(2×cum)]', () => {
    LEVEL_ORDER.forEach((_, i) => {
      const cum = cumXpBelow(i)
      const mob = mobLevelForZone(cum)
      expect(mob).toBeGreaterThanOrEqual(playerLevelForXp(1.0 * cum))
      expect(mob).toBeLessThanOrEqual(playerLevelForXp(2.0 * cum))
      expect(mob).toBe(playerLevelForXp(ZONE_XP_FACTOR * cum))
    })
  })
})

describe('computeMonsterLevels', () => {
  const levels = computeMonsterLevels()

  it('attribue un niveau ≥ 1 à chaque monstre', () => {
    for (const m of Object.values(MONSTERS)) {
      expect(levels[m.id]).toBeGreaterThanOrEqual(1)
    }
  })

  it('le niveau stocké dans monsters.ts correspond au calcul', () => {
    for (const m of Object.values(MONSTERS)) {
      expect(m.level).toBe(levels[m.id])
    }
  })

  it('la progression globale est croissante (zone 1 << boss final)', () => {
    expect(MONSTERS['gloopy']!.level).toBeLessThan(MONSTERS['seigneur-dechu']!.level)
    expect(MONSTERS['poring-dore']!.level).toBeLessThan(MONSTERS['dragon-flamme']!.level)
  })
})
