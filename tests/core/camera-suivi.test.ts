import { describe, it, expect } from 'vitest'
import {
  zoneMorte, lerpVertical, BANDE_MORTE_Y, LERP_X, LERP_Y_CALME, LERP_Y_MONTEE, SEUIL_MONTEE,
} from '../../src/core/camera-suivi'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA CAMÉRA SUIT EN X, PAS FORCÉMENT EN Y
//
// Deux retours du user qui tirent en sens opposés :
//   « fatigant que la caméra suive en hauteur à chaque fois » (assouplir le vertical)
//   « le terrain se décale plus assez vers la droite quand j'avance » (durcir l'horizontal)
//
// ⚠️ EN ASSOUPLISSANT LE VERTICAL, J'AVAIS GELÉ L'HORIZONTAL, et le commentaire du code affirmait le
// contraire — « toute la largeur, le défilement horizontal doit rester continu ». Dans Phaser, une zone
// morte est la région où la cible bouge SANS que la caméra suive : large comme l'écran, elle supprime le
// suivi horizontal. Le commentaire disait l'intention, le code faisait l'inverse, et rien ne pouvait le
// signaler puisqu'aucun test ne portait sur la caméra.
//
// D'où ces tests. Le premier est le seul qui compte vraiment : la zone morte horizontale doit être NULLE.

describe('zone morte de la caméra', () => {
  it('est NULLE en largeur — le décor suit le pas', () => {
    // la régression exacte : une largeur non nulle et le panda avance jusqu'au bord avant que ça défile
    expect(zoneMorte(540).w).toBe(0)
    expect(zoneMorte(1080).w).toBe(0)
  })

  it('couvre 62 % de la hauteur — un saut entier ne bouge rien', () => {
    expect(zoneMorte(540).h).toBeCloseTo(540 * 0.62)
    expect(BANDE_MORTE_Y).toBe(0.62)
  })

  it('reste dissymétrique quelle que soit la taille de l\'écran', () => {
    // la propriété qui porte l'intention : jamais de tolérance horizontale, toujours de la verticale
    for (const h of [320, 460, 540, 720, 1080, 1440]) {
      const z = zoneMorte(h)
      expect(z.w, `hauteur ${h}`).toBe(0)
      expect(z.h, `hauteur ${h}`).toBeGreaterThan(h * 0.5)
      expect(z.h, `hauteur ${h}`).toBeLessThan(h)
    }
  })
})

describe('lissage', () => {
  it('l\'horizontal est collé au panda', () => {
    expect(LERP_X).toBe(1)
  })

  it('le vertical est doux au repos et pendant une chute normale', () => {
    expect(lerpVertical(0)).toBe(LERP_Y_CALME)
    expect(lerpVertical(300)).toBe(LERP_Y_CALME)   // il tombe
    expect(lerpVertical(-200)).toBe(LERP_Y_CALME)  // petit saut
  })

  it('le vertical se durcit pendant une ASCENSION RAPIDE (rebond de trampoline)', () => {
    // « le problème d'un rebond très haut n'est pas la hauteur, c'est de ne plus voir où l'on retombe »
    expect(lerpVertical(SEUIL_MONTEE)).toBe(LERP_Y_MONTEE)
    expect(lerpVertical(-900)).toBe(LERP_Y_MONTEE)
    expect(LERP_Y_MONTEE).toBeGreaterThan(LERP_Y_CALME)
  })

  it('reste dans les bornes admises par Phaser (0 < lerp ≤ 1)', () => {
    for (const v of [-2000, -450, -100, 0, 500, 2000]) {
      expect(lerpVertical(v)).toBeGreaterThan(0)
      expect(lerpVertical(v)).toBeLessThanOrEqual(1)
    }
    expect(LERP_X).toBeGreaterThan(0)
    expect(LERP_X).toBeLessThanOrEqual(1)
  })
})
