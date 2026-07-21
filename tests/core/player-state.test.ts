import { describe, it, expect } from 'vitest'
import { newPlayer, recordKill } from '../../src/core/player-state'

describe('killsByMonster', () => {
  it('newPlayer démarre avec un suivi de kills vide', () => {
    expect(newPlayer('Panda').killsByMonster).toEqual({})
  })

  it('recordKill incrémente le compteur du type de monstre', () => {
    const p = newPlayer('Panda')
    recordKill(p, 'poring')
    expect(p.killsByMonster.poring).toBe(1)
    recordKill(p, 'poring')
    recordKill(p, 'lunatic')
    expect(p.killsByMonster).toEqual({ poring: 2, lunatic: 1 })
    // le compteur global n'est pas touché par recordKill
    expect(p.monstersKilled).toBe(0)
  })
})
