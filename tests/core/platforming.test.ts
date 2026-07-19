import { describe, it, expect } from 'vitest'
import { landsOnOneWayPlatform } from '../../src/core/platforming'

describe('plateformes one-way (traversables par le bas)', () => {
  const TOP = 256 // dessus de la plateforme
  const BOTTOM = TOP + 32 // dessous (dalle d'une tuile)

  it('atterrit quand le joueur descend et venait d\'au-dessus', () => {
    expect(landsOnOneWayPlatform(TOP - 2, 200, BOTTOM)).toBe(true) // pieds au-dessus, en chute
    expect(landsOnOneWayPlatform(TOP, 0, BOTTOM)).toBe(true) // posé, immobile
  })

  it('traverse en montant (vitesse verticale négative)', () => {
    expect(landsOnOneWayPlatform(BOTTOM + 40, -300, BOTTOM)).toBe(false)
    expect(landsOnOneWayPlatform(TOP - 2, -300, BOTTOM)).toBe(false) // même au-dessus, s\'il monte
  })

  it('traverse quand les pieds sont passés SOUS le dessous de la dalle', () => {
    expect(landsOnOneWayPlatform(BOTTOM + 1, 200, BOTTOM)).toBe(false)
  })

  // Régression du bug « 2e étage » : en se posant, le corps s'enfonce dans la dalle ; il faut
  // le RETENIR tant que ses pieds restent dans l'épaisseur de la dalle, sinon il retraverse et
  // tombe jusqu'au sol. L'ancienne marge de 8px au-dessus du dessus lâchait dès ~9px d'enfoncement.
  it('retient le panda qui s\'enfonce dans la dalle (anti-traversée du 2e étage)', () => {
    expect(landsOnOneWayPlatform(TOP + 9, 400, BOTTOM)).toBe(true) // enfoncé de 9px : jadis KO
    expect(landsOnOneWayPlatform(TOP + 20, 400, BOTTOM)).toBe(true) // enfoncé de 20px, encore dans la dalle
    expect(landsOnOneWayPlatform(BOTTOM, 400, BOTTOM)).toBe(true) // pieds pile au dessous : retenu
  })

  it('marge optionnelle d\'anti-tunneling sous le dessous', () => {
    expect(landsOnOneWayPlatform(BOTTOM + 6, 400, BOTTOM, 8)).toBe(true)
    expect(landsOnOneWayPlatform(BOTTOM + 20, 400, BOTTOM, 8)).toBe(false)
  })
})
