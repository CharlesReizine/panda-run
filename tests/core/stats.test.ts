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
