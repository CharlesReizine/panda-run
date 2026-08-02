import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { xpToNext, grantXp, canChangeClass, changeClass, canEvolveClass, evolveClass, CLASS_CHANGE_LEVEL, CLASS_EVOLVE_LEVEL, STAT_POINTS_PER_LEVEL } from '../../src/core/progression'
import { CLASSES } from '../../src/data/classes'

describe('progression', () => {
  it('courbe croissante', () => {
    // le coût du niveau 1 suit le coefficient de la courbe (relevé quand les terrains ont été rallongés :
    // plus de monstres par terrain, donc plus d'XP, donc un niveau doit coûter davantage)
    // 235 : le coefficient suit la LONGUEUR et la DENSITÉ des terrains, qui viennent de doubler. Trouvé par
    // bissection contre les invariants d'équilibrage — au-dessus le joueur arrive sous-niveau, en dessous
    // des terrains deviennent triviaux. Valeur provisoire : le user a remis la passe d'équilibrage à plus tard.
    expect(xpToNext(1)).toBe(235)
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
    // ⚠️ AUCUNE COMPÉTENCE OFFERTE : on partait avec un point d'office sur le premier sort de la
    // nouvelle classe, le user l'a fait retirer (« quand on change de classe on a 0 skill de la nouvelle
    // classe »). Le cadeau volait le premier choix du joueur, qui est le moment intéressant d'une
    // évolution. Ce test garde la propriété dans l'autre sens : rien n'est débloqué tout seul.
    expect(p.skillLevels[CLASSES.chevalier.skillIds[0]!] ?? 0).toBe(0)
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
