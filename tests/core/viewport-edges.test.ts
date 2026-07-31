import { describe, it, expect, vi, afterEach } from 'vitest'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES BORDS DE L'ÉCRAN — LE PIÈGE QUI A DÉCALÉ TOUT LE HUD
//
// Le jeu dessine dans un espace de conception 0→960 qui est CENTRÉ sur un écran plus large
// (centerCamera décale la caméra de −BLEED_X). Donc `x = 8` n'est PAS « 8 px du bord de l'écran » :
// sur un iPhone en paysage il apparaît ~111 px plus à droite. C'est ce qui a mis le panneau de vie
// « au milieu gauche » au lieu du bord (retour user), et rendu invisible l'indicateur de l'arbre de
// compétences (un `VIEW_W - 16` qui tombait hors cadre).
//
// Ces tests figent l'arithmétique de fromLeft/fromRight SUR UN ÉCRAN LARGE. Le cas 960 (celui des
// autres tests, où window est absent) est justement celui où le bug est INVISIBLE : fromLeft(x) === x.
// Sans écran large simulé, un test ne prouverait rien du tout.

const loadViewport = async (w: number, h: number) => {
  vi.stubGlobal('window', { innerWidth: w, innerHeight: h })
  vi.resetModules()
  return import('../../src/core/viewport')
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe('sur un écran large (iPhone en paysage, ~2,16:1)', () => {
  it('élargit la largeur logique au format de l\'écran', async () => {
    const { VIEW_W, VIEW_H, BLEED_X } = await loadViewport(2340, 1080)
    expect(VIEW_H).toBe(540)
    expect(VIEW_W).toBeGreaterThan(960)
    expect(BLEED_X).toBeGreaterThan(0)
  })

  it('fromLeft colle au bord GAUCHE de l\'écran, donc EN DEHORS du cadre de conception', async () => {
    const { fromLeft, DESIGN_LEFT } = await loadViewport(2340, 1080)
    expect(fromLeft(0)).toBe(DESIGN_LEFT)
    expect(fromLeft(8)).toBe(DESIGN_LEFT + 8)
    // le point clé : à gauche de 0. Un littéral `8` serait à l'intérieur → visiblement décollé du bord.
    expect(fromLeft(8)).toBeLessThan(0)
  })

  it('fromRight colle au bord DROIT, donc au-delà de 960', async () => {
    const { fromRight, DESIGN_RIGHT } = await loadViewport(2340, 1080)
    expect(fromRight(0)).toBe(DESIGN_RIGHT)
    expect(fromRight(16)).toBeGreaterThan(960)
  })

  it('les deux bords encadrent exactement la largeur visible', async () => {
    const { DESIGN_LEFT, DESIGN_RIGHT, VIEW_W } = await loadViewport(2340, 1080)
    expect(DESIGN_RIGHT - DESIGN_LEFT).toBe(VIEW_W)
    expect(DESIGN_LEFT + DESIGN_RIGHT).toBe(960) // symétrique autour du centre de conception
  })
})

describe('sur un écran 16:9 (aucun débord)', () => {
  it('les deux repères se confondent avec le cadre de conception', async () => {
    const { fromLeft, fromRight, BLEED_X } = await loadViewport(1920, 1080)
    expect(BLEED_X).toBe(0)
    expect(fromLeft(8)).toBe(8)
    expect(fromRight(16)).toBe(944)
  })
})
