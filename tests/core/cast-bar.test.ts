import { describe, it, expect } from 'vitest'
import { CAST_BAR, castProgress, casting, castBarWidth, castBarTotalH } from '../../src/core/cast-bar'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// BARRE DE CHARGEMENT D'ATTAQUE
//
// Demande du user : « j'aimerais que les attaques et sorts des monstres aient un chargement (voir que je
// l'ai aussi) + qu'on voie le nom de l'attaque, ça serait plus simple. »
//
// Ce qui se teste ici sans rendu, et qui compte vraiment : la progression est BORNÉE. L'horloge d'une
// scène Phaser n'est pas continue — elle saute après une mise en pause (menu, écran de compétences, gel
// d'impact). Une progression non bornée donnerait une jauge qui dépasse son cadre ou repart en arrière.

describe('progression du chargement', () => {
  it('vaut 0 au départ et 1 à l\'échéance', () => {
    expect(castProgress(1000, 1000, 400)).toBe(0)
    expect(castProgress(1400, 1000, 400)).toBe(1)
    expect(castProgress(1200, 1000, 400)).toBe(0.5)
  })

  it('reste BORNÉE quand l\'horloge saute (reprise après une pause)', () => {
    expect(castProgress(99999, 1000, 400)).toBe(1)
    expect(castProgress(0, 1000, 400)).toBe(0)
  })

  it('une durée nulle ou négative est déjà terminée (pas de division par zéro)', () => {
    expect(castProgress(1000, 1000, 0)).toBe(1)
    expect(castProgress(1000, 1000, -50)).toBe(1)
  })
})

describe('fenêtre de chargement', () => {
  it('court du début à l\'échéance, bornes comprises comme il faut', () => {
    expect(casting(1000, 1000, 400)).toBe(true)
    expect(casting(1399, 1000, 400)).toBe(true)
    expect(casting(1400, 1000, 400)).toBe(false) // à l'échéance, l'attaque part : la barre s'efface
    expect(casting(900, 1000, 400)).toBe(false)
  })

  it('une durée nulle ne charge jamais', () => {
    expect(casting(1000, 1000, 0)).toBe(false)
  })
})

describe('largeur de la barre', () => {
  it('s\'adapte au nom sans jamais devenir illisible ni démesurée', () => {
    expect(castBarWidth('Tir')).toBe(CAST_BAR.minW)
    expect(castBarWidth('Onde de choc')).toBeGreaterThan(CAST_BAR.minW)
    expect(castBarWidth('x'.repeat(200))).toBe(CAST_BAR.maxW)
  })

  it('un nom réaliste tient dans la largeur allouée', () => {
    for (const name of ['Attaque', 'Charge', 'Tir', 'Éruption', 'Salve', 'Onde de choc', 'Boule de feu']) {
      expect(name.length * CAST_BAR.charW, name).toBeLessThanOrEqual(castBarWidth(name))
    }
  })
})

describe('encombrement vertical', () => {
  it('reste assez plat pour tenir au-dessus d\'une tête sans manger l\'écran', () => {
    expect(castBarTotalH()).toBeLessThan(28)
    expect(CAST_BAR.gap).toBeGreaterThan(CAST_BAR.h) // la barre ne colle pas au sprite
  })
})
