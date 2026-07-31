import { describe, it, expect } from 'vitest'
import { flammeGain, flammeIntervalle, flammeAudible, FLAMME_PORTEE } from '../../src/core/flame-ambience'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AMBIANCE SONORE DES MURS DE FLAMMES
//
// Demande du user : « même quand y a des petits murs de flamme tu peux mettre un petit bruit de fond
// flamme, ça me choquerait pas ».
//
// Ce qui se teste ici sans audio : les deux courbes sont MONOTONES et BORNÉES, et l'ambiance est
// vraiment MUETTE hors de portée. Ce dernier point est le plus important : un terrain compte jusqu'à une
// dizaine de murs de flammes, et si chacun restait audible de loin, le niveau crépiterait en permanence
// d'un bout à l'autre — le son ne dirait plus où il faut faire attention.

describe('volume', () => {
  it('décroît quand on s\'éloigne', () => {
    let prec = Number.POSITIVE_INFINITY
    for (let d = 0; d < FLAMME_PORTEE; d += 20) {
      const g = flammeGain(d)
      expect(g, `distance ${d}`).toBeLessThanOrEqual(prec)
      prec = g
    }
  })

  it('est nul hors de portée, jamais négatif, jamais au-delà de 1', () => {
    expect(flammeGain(FLAMME_PORTEE)).toBe(0)
    expect(flammeGain(FLAMME_PORTEE + 1000)).toBe(0)
    for (let d = 0; d < 2000; d += 37) {
      expect(flammeGain(d)).toBeGreaterThanOrEqual(0)
      expect(flammeGain(d)).toBeLessThanOrEqual(1)
    }
  })

  it('reste audible au contact : une ambiance à 0 tout près n\'existerait pas', () => {
    expect(flammeGain(0)).toBeGreaterThan(0.3)
  })

  it('un feu à la limite de portée reste discret', () => {
    expect(flammeGain(FLAMME_PORTEE - 1)).toBeLessThan(0.2)
  })
})

describe('cadence', () => {
  it('s\'allonge quand on s\'éloigne — près du feu ça crépite souvent', () => {
    let prec = 0
    for (let d = 0; d < FLAMME_PORTEE; d += 20) {
      const i = flammeIntervalle(d)
      expect(i, `distance ${d}`).toBeGreaterThanOrEqual(prec)
      prec = i
    }
  })

  it('ne descend jamais sous un seuil qui ferait mitraillette', () => {
    for (let d = 0; d < 2000; d += 37) expect(flammeIntervalle(d)).toBeGreaterThanOrEqual(250)
  })

  it('ne dépasse pas une seconde : au-delà on n\'entend plus un foyer mais des clics isolés', () => {
    for (let d = 0; d < FLAMME_PORTEE; d += 37) expect(flammeIntervalle(d)).toBeLessThanOrEqual(1000)
  })
})

describe('portée', () => {
  it('audible en dessous, muet au-delà', () => {
    expect(flammeAudible(0)).toBe(true)
    expect(flammeAudible(FLAMME_PORTEE - 1)).toBe(true)
    expect(flammeAudible(FLAMME_PORTEE)).toBe(false)
  })

  it('la portée reste de l\'ordre d\'un écran, pas du terrain entier', () => {
    // la largeur logique vaut 960 à 1404 : une flamme ne doit pas s'entendre depuis l'autre bout
    expect(FLAMME_PORTEE).toBeLessThan(700)
    expect(FLAMME_PORTEE).toBeGreaterThan(200)
  })
})
