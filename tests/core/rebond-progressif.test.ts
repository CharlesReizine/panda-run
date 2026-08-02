import { describe, it, expect } from 'vitest'
import {
  BOUNCE_SPEED, BOUNCE_SPEED_MAX, GRAVITY, TILE, bounceSpeedFrom, maxJumpHeightPx,
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

  it('le premier rebond vaut UN saut normal, le deuxième 2, le troisième 2,5', () => {
    // Réglage dicté par le user après essai : « le premier fait la hauteur d'un saut normal, le deuxième
    // 2, le troisième 2,5 × la hauteur normale ». Avant, le premier valait déjà 3 sauts et le troisième
    // montait à 24 tuiles — « c'est nawak, juste trop trop haut ».
    const saut = maxJumpHeightPx()
    const h1 = hauteur(bounceSpeedFrom(0))
    const h2 = hauteur(bounceSpeedFrom(vitesseDeChuteDepuis(h1)))
    const h3 = hauteur(bounceSpeedFrom(vitesseDeChuteDepuis(h2)))
    expect(h1 / saut).toBeCloseTo(1, 5)
    expect(h2 / saut).toBeCloseTo(2, 5)
    expect(h3 / saut).toBeCloseTo(2.5, 5)
  })


  it('le plafond tient : au-delà, rebondir encore ne monte plus', () => {
    const plafond = hauteur(BOUNCE_SPEED_MAX)
    let h = plafond
    for (let i = 0; i < 5; i++) h = hauteur(bounceSpeedFrom(vitesseDeChuteDepuis(h)))
    expect(h).toBeCloseTo(plafond, 6)
  })


  it('le plafond reste dans une échelle jouable, pas en orbite', () => {
    // 2,5 sauts ≈ 10 tuiles : on voit encore où l'on retombe, ce qui est la vraie contrainte.
    const tuiles = hauteur(BOUNCE_SPEED_MAX) / TILE
    expect(tuiles).toBeGreaterThan(8)
    expect(tuiles).toBeLessThan(13)
  })
})
