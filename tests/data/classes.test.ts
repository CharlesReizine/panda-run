import { describe, it, expect } from 'vitest'
import { CLASSES } from '../../src/data/classes'
import { SKILLS, skillsOf } from '../../src/data/skills'
import { EVOLUTIONS } from '../../src/core/progression'
import type { ClassId } from '../../src/core/types'

// classe de 1er palier dont une classe évoluée est issue (inverse de EVOLUTIONS)
const BASE_OF: Partial<Record<ClassId, ClassId>> = Object.fromEntries(
  Object.entries(EVOLUTIONS).map(([base, evolved]) => [evolved, base as ClassId]),
)

describe('données classes/skills', () => {
  it('7 classes, novice 3 skills, sabreur/chevalier 9 (Folie enragée), les autres 8', () => {
    expect(Object.keys(CLASSES)).toHaveLength(7)
    expect(CLASSES.novice.skillIds).toHaveLength(3)
    // le sabreur et son évolution portent Folie enragée en plus de leur arbre → 9 skills
    for (const id of ['swordsman', 'chevalier'] as const) {
      expect(CLASSES[id].skillIds).toHaveLength(9)
    }
    for (const id of ['mage', 'archer', 'sorcier', 'chasseur'] as const) {
      expect(CLASSES[id].skillIds).toHaveLength(8)
    }
  })

  it('tous les skillIds existent et pointent la classe (ou sa classe de base)', () => {
    for (const c of Object.values(CLASSES)) {
      const allowed = new Set<ClassId>([c.id])
      const base = BASE_OF[c.id]
      if (base) allowed.add(base)
      for (const sid of c.skillIds) {
        const s = SKILLS[sid]
        expect(s, sid).toBeDefined()
        expect(allowed.has(s!.classId), sid).toBe(true)
      }
    }
  })

  it('les 3 nouveaux skills de chaque classe évoluée lui appartiennent en propre', () => {
    for (const evolved of ['chevalier', 'sorcier', 'chasseur'] as const) {
      const own = CLASSES[evolved].skillIds.filter((sid) => SKILLS[sid]!.classId === evolved)
      expect(own, evolved).toHaveLength(3)
    }
  })

  it('skillsOf renvoie les skills dans l ordre', () => {
    expect(skillsOf('mage').map((s) => s.id)).toEqual(CLASSES.mage.skillIds)
    expect(skillsOf('sorcier').map((s) => s.id)).toEqual(CLASSES.sorcier.skillIds)
  })

  it('cooldowns et multiplicateurs positifs', () => {
    for (const s of Object.values(SKILLS)) {
      expect(s.cooldownMs).toBeGreaterThan(0)
      expect(s.multiplier).toBeGreaterThan(0)
    }
  })
})
