import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { computeStats } from '../../src/core/stats'
import { physicalDamage, inMeleeReach } from '../../src/core/combat'
import { CLASSES } from '../../src/data/classes'

describe('stats & combat', () => {
  it('niveau 1 = stats de base', () => {
    expect(computeStats(newPlayer('P'))).toEqual(CLASSES.novice.baseStats)
  })

  it('la croissance par niveau s applique', () => {
    const p = newPlayer('P')
    p.level = 3
    expect(computeStats(p).atk).toBe(CLASSES.novice.baseStats.atk + 2 * CLASSES.novice.growth.atk)
  })

  it('l équipement ajoute ses bonus', () => {
    const p = newPlayer('P')
    p.equipment.weapon = 'epee-bambou' // +5 atk
    expect(computeStats(p).atk).toBe(CLASSES.novice.baseStats.atk + 5)
  })

  it('stats réparties : à 0 partout, aucun effet', () => {
    const p = newPlayer('P')
    expect(computeStats(p)).toEqual(CLASSES.novice.baseStats)
  })

  it('stats réparties : STR/AGI/INT modifient les stats dérivées', () => {
    const p = newPlayer('P')
    p.allocated = { str: 3, agi: 5, int: 2 }
    const base = CLASSES.novice.baseStats
    const s = computeStats(p)
    expect(s.atk).toBe(base.atk + 2 * 3) // STR → +2 atk/pt
    expect(s.attackSpeed).toBeCloseTo(base.attackSpeed + 0.02 * 5) // AGI → +0.02 vit/pt
    expect(s.def).toBeCloseTo(base.def + 0.3 * 5) // AGI → +0.3 def/pt
    expect(s.maxHp).toBe(base.maxHp + 4 * 2) // INT → +4 pv/pt
  })

  it('dégâts = atk*mult - def, minimum 1', () => {
    expect(physicalDamage(20, 5)).toBe(15)
    expect(physicalDamage(20, 5, 2)).toBe(35)
    expect(physicalDamage(3, 100)).toBe(1)
  })

  it('portée de mêlée : touche un ennemi pile sur soi et devant, pas derrière ni trop haut', () => {
    expect(inMeleeReach(0, 20, 70)).toBe(true)   // pile sur le perso
    expect(inMeleeReach(50, 10, 70)).toBe(true)  // devant, dans la portée
    expect(inMeleeReach(-50, 10, 70)).toBe(false) // derrière
    expect(inMeleeReach(120, 10, 70)).toBe(false) // trop loin devant
    expect(inMeleeReach(30, 120, 70)).toBe(false) // décalé verticalement
  })
})
