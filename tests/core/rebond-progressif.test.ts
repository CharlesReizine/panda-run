import { describe, it, expect } from 'vitest'
import {
  BOUNCE_GAIN, BOUNCE_SPEED, BOUNCE_SPEED_MAX, GRAVITY, TILE, bounceSpeedFrom, maxJumpHeightPx,
} from '../../src/core/platforming'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE REBOND S'AMPLIFIE — MAIS JAMAIS EN DESSOUS DU MINIMUM GARANTI
//
// « Est-ce que le trampoline peut faire rebondir de plus en plus haut selon la hauteur dont on tombe
// (avec une hauteur max) ? Genre il faut 3 sauts pour arriver à la hauteur max. »
//
// Deux propriétés à tenir en même temps, et elles tirent dans des sens opposés :
//   · le PLANCHER, dont dépendent les validateurs de terrain (une corniche posée au-dessus d'un
//     trampoline est déclarée atteignable en supposant BOUNCE_SPEED) ;
//   · l'AMPLIFICATION, qui doit saturer au TROISIÈME rebond — ni au deuxième (on ne sentirait pas la
//     montée), ni au cinquième (on aurait renoncé avant).
// C'est le genre d'accord qu'un réglage à l'œil casse en silence : d'où ce test.

const hauteur = (v: number) => (v * v) / (2 * GRAVITY)
const vitesseDeChuteDepuis = (h: number) => Math.sqrt(2 * GRAVITY * h)

describe('rebond de trampoline proportionnel à la chute', () => {
  it('se poser en douceur rend EXACTEMENT le minimum garanti', () => {
    // c'est le contrat avec les validateurs : marcher sur le tapis ne doit jamais rendre moins.
    expect(bounceSpeedFrom(0)).toBeCloseTo(BOUNCE_SPEED, 6)
  })

  it('ne rend jamais moins que le minimum, quelle que soit la chute', () => {
    for (const v of [-500, -1, 0, 1, 50, 400, 2000, 99999]) {
      expect(bounceSpeedFrom(v)).toBeGreaterThanOrEqual(BOUNCE_SPEED)
    }
  })

  it('le premier rebond vaut trois fois un saut normal', () => {
    expect(hauteur(bounceSpeedFrom(0)) / maxJumpHeightPx()).toBeCloseTo(3, 5)
  })

  it('TROIS rebonds enchaînés atteignent le plafond — pas deux', () => {
    const h1 = hauteur(bounceSpeedFrom(0))
    const h2 = hauteur(bounceSpeedFrom(vitesseDeChuteDepuis(h1)))
    const h3 = hauteur(bounceSpeedFrom(vitesseDeChuteDepuis(h2)))
    const plafond = hauteur(BOUNCE_SPEED_MAX)

    expect(h2).toBeGreaterThan(h1 * 1.25) // la montée se VOIT dès le deuxième
    // …mais elle n'y est pas encore. La marge est plus serrée qu'avant : le plafond ayant baissé (×2 →
    // ×1,5 de la hauteur de base, sur retour du user), le deuxième rebond en est mécaniquement plus près.
    expect(h2).toBeLessThan(plafond * 0.96)
    expect(h3).toBeCloseTo(plafond, 0) // le troisième touche le plafond
  })

  it('le plafond tient : au-delà, rebondir encore ne monte plus', () => {
    const plafond = hauteur(BOUNCE_SPEED_MAX)
    let h = plafond
    for (let i = 0; i < 5; i++) h = hauteur(bounceSpeedFrom(vitesseDeChuteDepuis(h)))
    expect(h).toBeCloseTo(plafond, 6)
  })

  it('le gain place la saturation au TROISIÈME rebond, par construction', () => {
    // 1 + G + G² doit valoir exactement le plafond (×1,5 de la hauteur de base) : c'est cette égalité
    // qui fait que le troisième rebond touche le plafond, ni le deuxième ni le cinquième. Écrit ici
    // parce que la formule seule ne dit pas d'où sort 0,366 — et parce que le plafond a déjà bougé une
    // fois (il était au double, le user a trouvé ça « nawak, juste trop trop haut »).
    expect(1 + BOUNCE_GAIN + BOUNCE_GAIN * BOUNCE_GAIN).toBeCloseTo(1.5, 10)
  })

  it('le plafond reste dans une échelle jouable, pas en orbite', () => {
    const tuiles = hauteur(BOUNCE_SPEED_MAX) / TILE
    expect(tuiles).toBeGreaterThan(14)
    expect(tuiles).toBeLessThan(22)
  })
})
