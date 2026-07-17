import { describe, it, expect } from 'vitest'
import { CLASSES } from '../../src/data/classes'
import { SKILLS, skillsOf } from '../../src/data/skills'

describe('données classes/skills', () => {
  it('4 classes, novice 2 skills, les autres 6', () => {
    expect(Object.keys(CLASSES)).toHaveLength(4)
    expect(CLASSES.novice.skillIds).toHaveLength(2)
    for (const id of ['swordsman', 'mage', 'archer'] as const) {
      expect(CLASSES[id].skillIds).toHaveLength(6)
    }
  })

  it('tous les skillIds existent et pointent la bonne classe', () => {
    for (const c of Object.values(CLASSES)) {
      for (const sid of c.skillIds) {
        const s = SKILLS[sid]
        expect(s, sid).toBeDefined()
        expect(s!.classId).toBe(c.id)
      }
    }
  })

  it('skillsOf renvoie les skills dans l ordre', () => {
    expect(skillsOf('mage').map((s) => s.id)).toEqual(CLASSES.mage.skillIds)
  })

  it('cooldowns et multiplicateurs positifs', () => {
    for (const s of Object.values(SKILLS)) {
      expect(s.cooldownMs).toBeGreaterThan(0)
      expect(s.multiplier).toBeGreaterThan(0)
    }
  })
})
