import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { xpToNext, grantXp, canChangeClass, changeClass, CLASS_CHANGE_LEVEL, STAT_POINTS_PER_LEVEL } from '../../src/core/progression'

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
})
