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
  it('7 classes ; novice 3 ; arbres combattants : 10 compétences (11 archer/chasseur avec la flèche autoguidée)', () => {
    expect(Object.keys(CLASSES)).toHaveLength(7)
    expect(CLASSES.novice.skillIds).toHaveLength(3)
    // arbres à branches offensives + buff unique + passifs (dont régén sabreur, réflexes archer,
    // et le vol arcanique côté mage/sorcier)
    for (const id of ['swordsman', 'chevalier', 'mage', 'sorcier'] as const) {
      expect(CLASSES[id].skillIds).toHaveLength(10)
    }
    // archer + chasseur (évolution) portent en plus la Flèche autoguidée
    for (const id of ['archer', 'chasseur'] as const) {
      expect(CLASSES[id].skillIds).toHaveLength(11)
    }
  })

  it('un seul skill de buff (kind buff, non-passif) par classe combattante', () => {
    for (const id of ['swordsman', 'mage', 'archer', 'chevalier', 'sorcier', 'chasseur'] as const) {
      const buffs = CLASSES[id].skillIds.filter((sid) => SKILLS[sid]!.kind === 'buff')
      expect(buffs, `${id}: ${buffs.join(',')}`).toHaveLength(1)
    }
  })

  it('chaque compétence à prérequis a son parent présent dans l arbre de la classe', () => {
    for (const c of Object.values(CLASSES)) {
      const ids = new Set(c.skillIds)
      for (const sid of c.skillIds) {
        const req = SKILLS[sid]!.requires
        if (req) expect(ids.has(req), `${c.id} → ${sid} requiert ${req}`).toBe(true)
      }
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
