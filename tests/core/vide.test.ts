import { describe, it, expect } from 'vitest'
import { bandesDeVide, BANDES, ALPHA_MIN, ALPHA_MAX } from '../../src/core/vide'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE VIDE DOIT RESSEMBLER À DU VIDE
//
// « Ce motif j'aime pas, je préférais du vrai vide en dessous. » Sous des plateformes suspendues, le fond
// illustré du biome se voyait en entier — prairie, rivière, château : rien ne disait que tomber tue.
// Le voile assombrit en dégradé de la surface jusqu'au bas du monde.
//
// ⚠️ CE QUI EST TESTÉ, C'EST QUE LE DÉGRADÉ RESTE UN DÉGRADÉ. Un aplat opaque effacerait le décor et
// donnerait un trou plat et laid ; c'est la progression qui raconte la chute. D'où les contrôles sur la
// monotonie des opacités et sur les bornes — plus la couverture exacte de la hauteur, sans trou ni
// débordement, qui laisserait une bande de fond clair au milieu du gouffre.

describe('bandesDeVide', () => {
  it('couvre EXACTEMENT la hauteur demandée, sans trou ni chevauchement', () => {
    const bs = bandesDeVide(100, 320, 200, 1000)
    expect(bs).toHaveLength(BANDES)
    expect(bs[0]!.y).toBe(200)
    expect(bs[bs.length - 1]!.y + bs[bs.length - 1]!.h).toBeCloseTo(1000)
    for (let i = 1; i < bs.length; i++) expect(bs[i]!.y).toBeCloseTo(bs[i - 1]!.y + bs[i - 1]!.h)
  })

  it('s\'assombrit vers le BAS, jamais l\'inverse', () => {
    const bs = bandesDeVide(0, 100, 0, 800)
    for (let i = 1; i < bs.length; i++) {
      expect(bs[i]!.alpha, `bande ${i}`).toBeGreaterThan(bs[i - 1]!.alpha)
    }
    expect(bs[0]!.alpha).toBeCloseTo(ALPHA_MIN)
    expect(bs[bs.length - 1]!.alpha).toBeCloseTo(ALPHA_MAX)
  })

  it('ne devient JAMAIS opaque : le décor doit rester devinable au fond', () => {
    for (const b of bandesDeVide(0, 100, 0, 800)) {
      expect(b.alpha).toBeGreaterThan(0)
      expect(b.alpha).toBeLessThan(1)
    }
  })

  it('garde la largeur et l\'abscisse du trou', () => {
    for (const b of bandesDeVide(64, 288, 100, 500)) {
      expect(b.x).toBe(64)
      expect(b.w).toBe(288)
    }
  })

  it('ne produit RIEN pour un trou sans profondeur ni largeur', () => {
    // empiler des bandes de hauteur nulle ne ferait que des objets inutiles à masquer au culling
    expect(bandesDeVide(0, 100, 500, 500)).toEqual([])
    expect(bandesDeVide(0, 100, 600, 500)).toEqual([])
    expect(bandesDeVide(0, 0, 100, 500)).toEqual([])
  })
})
