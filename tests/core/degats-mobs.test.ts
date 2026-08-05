import { describe, it, expect } from 'vitest'
import { DEGATS_MOBS_MULT, degatsSubis, physicalDamage } from '../../src/core/combat'
import { newPlayer, POTIONS_DEPART } from '../../src/core/player-state'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// PRISE EN MAIN : DIX POTIONS AU DÉPART, ET LES MOBS TAPENT 10 % MOINS FORT
//
// Deux demandes du joueur dans le même souffle : « fais commencer le jeu avec 10 potions (apparemment
// c'est un peu galère au début à prendre en main) » et « baisse de 10 % les dégâts faits par les mobs ».
// Elles visent la même chose, et elles sont chiffrées — donc testables.

describe('adoucissement du début de partie', () => {
  it('une partie neuve démarre avec dix potions', () => {
    expect(POTIONS_DEPART).toBe(10)
    expect(newPlayer('testeur').potions).toBe(POTIONS_DEPART)
  })

  it('la remise sur les dégâts de mob vaut bien 10 %', () => {
    expect(DEGATS_MOBS_MULT).toBeCloseTo(0.9)
  })

  // ⚠️ LA REMISE PORTE SUR LE DÉGÂT, PAS SUR L'ATTAQUE, ET LA NUANCE EST TOUT L'INTÉRÊT. Appliquée à
  // l'attaque, elle passerait AVANT la soustraction de la défense : sur un joueur bien protégé, 10 %
  // d'attaque en moins peut valoir 40 % de dégât en moins, et sur un joueur nu presque rien. Posée sur
  // le résultat, elle vaut exactement 10 % pour tout le monde — ce qui a été demandé.
  it('vaut 10 % quelle que soit la défense du joueur', () => {
    for (const def of [0, 5, 20, 60, 150]) {
      for (const atk of [20, 50, 120, 400]) {
        const plein = physicalDamage(atk, def)
        const remise = degatsSubis(atk, def)
        if (plein <= 1) { expect(remise).toBe(1); continue }
        expect(remise).toBe(Math.max(1, Math.round(plein * 0.9)))
        expect(remise).toBeLessThanOrEqual(plein)
      }
    }
  })

  it('un coup fait toujours au moins 1 : un coup à zéro ne se comprend pas', () => {
    expect(degatsSubis(1, 9999)).toBe(1)
    expect(degatsSubis(0, 0)).toBeGreaterThanOrEqual(1)
  })
})
