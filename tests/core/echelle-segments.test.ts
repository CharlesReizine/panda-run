import { describe, it, expect } from 'vitest'
import { segmentsEchelle } from '../../src/core/vide'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UNE ÉCHELLE ARRIVE COLLÉE À LA TERRE, ELLE NE SE DESSINE PAS PAR-DESSUS
//
// Demande du joueur : « fais en sorte que l'échelle ne se superpose pas avec de la terre. Genre
// l'échelle arrive collée à une plateforme où y a de la terre, mais passe pas à travers. »
//
// Le montant était un seul TileSprite à la profondeur −1, donc DEVANT les plateformes (−4). Il les
// traverse bel et bien en JEU (agrippé, les corniches ne bloquent plus) et c'est voulu — ce qui n'allait
// pas, c'était de le MONTRER. On coupe le dessin, jamais l'échelle : la zone d'accroche et la hauteur
// restent intactes, donc la jouabilité ne change pas d'un pouce.

describe('segments visibles d\'une échelle', () => {
  it('sans rien à traverser, un seul segment sur toute la hauteur', () => {
    expect(segmentsEchelle(10, 9, [])).toEqual([{ y: 10, h: 9 }])
  })

  it('s\'interrompt PILE à la rangée de terre, et reprend dessous', () => {
    // échelle rangées 10..18, corniche en 14 → deux segments, la rangée 14 laissée à la terre
    expect(segmentsEchelle(10, 9, [14])).toEqual([{ y: 10, h: 4 }, { y: 15, h: 4 }])
  })

  it('gère plusieurs corniches traversées', () => {
    expect(segmentsEchelle(0, 10, [3, 7])).toEqual([{ y: 0, h: 3 }, { y: 4, h: 3 }, { y: 8, h: 2 }])
  })

  it('ignore les rangées hors de l\'échelle', () => {
    expect(segmentsEchelle(10, 5, [2, 40])).toEqual([{ y: 10, h: 5 }])
  })

  it('ne dessine rien si chaque rangée est pleine', () => {
    expect(segmentsEchelle(5, 3, [5, 6, 7])).toEqual([])
  })

  it('la somme des segments ne dépasse JAMAIS la hauteur de l\'échelle', () => {
    for (const pleines of [[], [10], [10, 11], [12, 15], [10, 12, 14, 16]]) {
      const segs = segmentsEchelle(10, 9, pleines)
      const total = segs.reduce((n, s) => n + s.h, 0)
      expect(total).toBeLessThanOrEqual(9)
      // et aucun segment ne sort de l'intervalle
      for (const s of segs) { expect(s.y).toBeGreaterThanOrEqual(10); expect(s.y + s.h).toBeLessThanOrEqual(19) }
    }
  })
})
