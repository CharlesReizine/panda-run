import { describe, it, expect } from 'vitest'
import { diesOnFall, hasFallenOutOfWorld } from '../../src/core/mob-fall'

describe('chute hors map = mort nette', () => {
  it('un monstre terrestre tombé dans un trou MEURT (pas de remontée)', () => {
    expect(diesOnFall({})).toBe(true)
  })

  it('volants, aquatiques et boss ne meurent PAS de chute (exemptés)', () => {
    expect(diesOnFall({ aerial: true })).toBe(false)
    expect(diesOnFall({ aquatic: true })).toBe(false)
    expect(diesOnFall({ boss: true })).toBe(false)
  })

  it('hors map dès que le bas du corps atteint le fond du monde (marge 4 px)', () => {
    const worldBottom = 1000
    expect(hasFallenOutOfWorld(500, worldBottom)).toBe(false)
    expect(hasFallenOutOfWorld(995, worldBottom)).toBe(false)
    expect(hasFallenOutOfWorld(996, worldBottom)).toBe(true)
    expect(hasFallenOutOfWorld(1200, worldBottom)).toBe(true)
  })
})
