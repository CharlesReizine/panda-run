import { describe, it, expect } from 'vitest'
import { landsOnOneWayPlatform } from '../../src/core/platforming'

describe('plateformes one-way (traversables par le bas)', () => {
  const TOP = 256 // dessus de la plateforme

  it('atterrit quand le joueur descend et venait d\'au-dessus', () => {
    expect(landsOnOneWayPlatform(TOP - 2, 200, TOP)).toBe(true) // pieds au-dessus, en chute
    expect(landsOnOneWayPlatform(TOP, 0, TOP)).toBe(true) // posé, immobile
  })

  it('traverse en montant (vitesse verticale négative)', () => {
    expect(landsOnOneWayPlatform(TOP + 40, -300, TOP)).toBe(false)
    expect(landsOnOneWayPlatform(TOP - 2, -300, TOP)).toBe(false) // même au-dessus, s\'il monte
  })

  it('traverse quand les pieds sont sous le dessus (on est passé à travers)', () => {
    expect(landsOnOneWayPlatform(TOP + 40, 200, TOP)).toBe(false)
  })

  it('tolère une petite marge pour ne pas rater l\'atterrissage (anti-tunneling)', () => {
    expect(landsOnOneWayPlatform(TOP + 6, 400, TOP, 8)).toBe(true)
    expect(landsOnOneWayPlatform(TOP + 20, 400, TOP, 8)).toBe(false)
  })
})
