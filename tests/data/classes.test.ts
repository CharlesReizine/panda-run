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
  it('7 classes ; novice 3 ; arbres combattants refondus (dédoublonnage base ↔ évolué)', () => {
    expect(Object.keys(CLASSES)).toHaveLength(7)
    expect(CLASSES.novice.skillIds).toHaveLength(3)
    // Tailles d'arbre après refonte : le premier palier garde ses branches + passifs ; l'évolué
    // porte un kit PROPRE (aucun skill partagé avec sa base) plus resserré autour de sa signature.
    const expected: Record<string, number> = {
      swordsman: 8, mage: 9, archer: 9,
      chevalier: 8, sorcier: 8, chasseur: 9,
    }
    for (const [id, n] of Object.entries(expected)) {
      expect(CLASSES[id as ClassId].skillIds, id).toHaveLength(n)
    }
  })

  it('au plus un skill actif de buff/aura (kind buff ou aura) par classe combattante', () => {
    for (const id of ['swordsman', 'mage', 'archer', 'chevalier', 'sorcier', 'chasseur'] as const) {
      const buffs = CLASSES[id].skillIds.filter((sid) => SKILLS[sid]!.kind === 'buff' || SKILLS[sid]!.kind === 'aura')
      expect(buffs.length, `${id}: ${buffs.join(',')}`).toBeLessThanOrEqual(1)
    }
  })

  it('dédoublonnage : une classe évoluée ne partage AUCUN skill de sa classe de base', () => {
    // Sabreur→Chevalier, Archer→Chasseur : zéro skill commun (les skills stylés migrent, ils ne
    // sont pas dupliqués). Mage→Sorcier peut relayer la pluie de météores (déplacée du mage).
    for (const evolved of ['chevalier', 'chasseur'] as const) {
      const base = BASE_OF[evolved]!
      const shared = CLASSES[evolved].skillIds.filter((sid) => CLASSES[base].skillIds.includes(sid))
      expect(shared, `${evolved} partage avec ${base}: ${shared.join(',')}`).toHaveLength(0)
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

  it('chaque classe évoluée porte ses skills propres (kit signature exclusif)', () => {
    // chevalier : kit royal 100% propre. sorcier : signatures propres (la pluie de météores reste
    // classée « mage » car déplacée depuis lui). chasseur : signatures propres (flèche enflammée/
    // explosive restent classées « archer », déplacées depuis la base).
    const ownCount: Record<'chevalier' | 'sorcier' | 'chasseur', number> = { chevalier: 8, sorcier: 7, chasseur: 7 }
    for (const evolved of ['chevalier', 'sorcier', 'chasseur'] as const) {
      const own = CLASSES[evolved].skillIds.filter((sid) => SKILLS[sid]!.classId === evolved)
      expect(own, evolved).toHaveLength(ownCount[evolved])
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
