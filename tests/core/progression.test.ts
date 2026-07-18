import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { xpToNext, grantXp, canChangeClass, changeClass, canEvolveClass, evolveClass, CLASS_CHANGE_LEVEL, CLASS_EVOLVE_LEVEL, STAT_POINTS_PER_LEVEL } from '../../src/core/progression'
import { CLASSES } from '../../src/data/classes'

describe('progression', () => {
  it('courbe croissante', () => {
    expect(xpToNext(1)).toBe(100)
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1))
  })

  it('grantXp monte de niveau et donne des skill points', () => {
    const p = newPlayer('Panda')
    const { levelsGained } = grantXp(p, xpToNext(1) + 10)
    expect(levelsGained).toBe(1)
    expect(p.level).toBe(2)
    expect(p.xp).toBe(10)
    expect(p.skillPoints).toBe(1)
    expect(p.statPoints).toBe(STAT_POINTS_PER_LEVEL)
  })

  it('grantXp gère plusieurs niveaux d un coup', () => {
    const p = newPlayer('Panda')
    grantXp(p, xpToNext(1) + xpToNext(2))
    expect(p.level).toBe(3)
  })

  it('changement de classe au niveau 10, novice uniquement', () => {
    const p = newPlayer('Panda')
    expect(canChangeClass(p)).toBe(false)
    p.level = CLASS_CHANGE_LEVEL
    expect(canChangeClass(p)).toBe(true)
    changeClass(p, 'mage')
    expect(p.classId).toBe('mage')
    expect(canChangeClass(p)).toBe(false)
    expect(() => changeClass(p, 'archer')).toThrow()
  })

  it('évolution au niveau 30, uniquement depuis une classe de 1er palier', () => {
    const p = newPlayer('Panda')
    // novice ne peut pas évoluer
    p.level = CLASS_EVOLVE_LEVEL
    expect(canEvolveClass(p)).toBe(false)
    // devient sabreur mais trop bas niveau
    p.classId = 'swordsman'
    p.level = CLASS_EVOLVE_LEVEL - 1
    expect(canEvolveClass(p)).toBe(false)
    p.level = CLASS_EVOLVE_LEVEL
    expect(canEvolveClass(p)).toBe(true)
    const to = evolveClass(p)
    expect(to).toBe('chevalier')
    expect(p.classId).toBe('chevalier')
    // 1er nouveau skill débloqué au rang 1
    expect(p.skillLevels[CLASSES.chevalier.skillIds[0]!]).toBe(1)
    // plus d'évolution possible après le 2e palier
    expect(canEvolveClass(p)).toBe(false)
    expect(() => evolveClass(p)).toThrow()
  })

  it('mage → sorcier, archer → chasseur', () => {
    const m = newPlayer('M'); m.classId = 'mage'; m.level = CLASS_EVOLVE_LEVEL
    expect(evolveClass(m)).toBe('sorcier')
    const a = newPlayer('A'); a.classId = 'archer'; a.level = CLASS_EVOLVE_LEVEL
    expect(evolveClass(a)).toBe('chasseur')
  })
})
