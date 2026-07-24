import { describe, it, expect } from 'vitest'
import { xpToNext } from '../../src/core/progression'
import {
  playerLevelForXp,
  computeMonsterLevels,
  TERRAIN_RANK,
  LEVEL_ORDER,
  LEVEL_MUL,
  LEVEL_SUB,
  ELITE_LEVEL_BONUS,
  BOSS_LEVEL_BONUS,
} from '../../src/core/mob-level'
import { MONSTERS } from '../../src/data/monsters'
import { LEVELS } from '../../src/data/levels'
import { WORLD_EDGES } from '../../src/data/worldmap'

describe('playerLevelForXp', () => {
  it('0 XP reste au niveau 1', () => {
    expect(playerLevelForXp(0)).toBe(1)
  })

  it('XP négative reste au niveau 1', () => {
    expect(playerLevelForXp(-500)).toBe(1)
  })

  it('juste sous le palier ne monte pas ; au palier monte', () => {
    const need = xpToNext(1)
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

describe('rang de terrain (distance Dijkstra depuis Prairie)', () => {
  it('Prairie (plaine-1) est le rang 1', () => {
    expect(TERRAIN_RANK['plaine-1']).toBe(1)
  })

  it('le tronc de plaine monte 1,2,3,4,5,6', () => {
    expect(TERRAIN_RANK['plaine-2']).toBe(2)
    expect(TERRAIN_RANK['plaine-3']).toBe(3)
    expect(TERRAIN_RANK['plaine-4']).toBe(4)
    expect(TERRAIN_RANK['plaine-5']).toBe(5)
    expect(TERRAIN_RANK['plaine-6']).toBe(6)
  })

  it('deux terrains ADJACENTS sur la carte diffèrent d\'exactement 1 (carte = arbre)', () => {
    for (const [a, b] of WORLD_EDGES) {
      const ra = TERRAIN_RANK[a], rb = TERRAIN_RANK[b]
      if (ra === undefined || rb === undefined) continue // arête vers/depuis une ville (poids 0)
      expect(Math.abs(ra - rb), `${a}(${ra}) <-> ${b}(${rb})`).toBe(1)
    }
  })

  it('l\'ordre de progression (LEVEL_ORDER) est trié par rang croissant', () => {
    let prev = 0
    for (const l of LEVEL_ORDER) {
      const r = TERRAIN_RANK[l.id] ?? 999
      expect(r).toBeGreaterThanOrEqual(prev)
      prev = r
    }
  })
})

describe('computeMonsterLevels (niveau = 2×rang − 1 + bonus)', () => {
  const levels = computeMonsterLevels()

  it('attribue un niveau ≥ 1 à chaque monstre', () => {
    for (const m of Object.values(MONSTERS)) {
      expect(levels[m.id]).toBeGreaterThanOrEqual(1)
    }
  })

  it('le niveau stocké dans monsters.ts correspond au calcul', () => {
    for (const m of Object.values(MONSTERS)) {
      expect(m.level, m.id).toBe(levels[m.id])
    }
  })

  it('un mob normal du rang R vaut 2R−1 (gloopy, Prairie rang 1 → 1)', () => {
    expect(levels['gloopy']).toBe(LEVEL_MUL * 1 - LEVEL_SUB)
  })

  it('l\'élite (mvp) porte le bonus élite au-dessus de sa base de rang', () => {
    // angeling = base (2×rang de sa 1re apparition − 1) + bonus élite, quel que soit le rang exact.
    const angelingRank = Math.min(...Object.values(LEVELS)
      .filter((l) => l.spawns.some((s) => s.monsterId === 'angeling'))
      .map((l) => TERRAIN_RANK[l.id] ?? 999))
    expect(levels['angeling']).toBe(LEVEL_MUL * angelingRank - LEVEL_SUB + ELITE_LEVEL_BONUS)
  })

  it('le boss final porte le bonus boss', () => {
    const rank = TERRAIN_RANK['boss-09']!
    expect(levels['seigneur-dechu']).toBe(LEVEL_MUL * rank - LEVEL_SUB + BOSS_LEVEL_BONUS)
  })

  it('la progression globale est croissante (zone 1 << boss final)', () => {
    expect(MONSTERS['gloopy']!.level).toBeLessThan(MONSTERS['seigneur-dechu']!.level)
    expect(MONSTERS['poring-dore']!.level).toBeLessThan(MONSTERS['dragon-flamme']!.level)
  })

  it('plus d\'élite (mvp) sur la 2e map (Champs) — les élites sont gardées pour la fin de biome', () => {
    const plaine2 = LEVELS['plaine-2']!
    const elitesOnPlaine2 = plaine2.spawns.filter((s) => MONSTERS[s.monsterId]?.mvp)
    expect(elitesOnPlaine2, `élites sur plaine-2 : ${elitesOnPlaine2.map((s) => s.monsterId).join(', ')}`).toHaveLength(0)
  })
})
