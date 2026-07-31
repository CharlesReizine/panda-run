import { describe, it, expect } from 'vitest'
import { spreadLabels, type LabelBox } from '../../src/scenes/label-spread'

// Anti-chevauchement des étiquettes de ville. Ce qui compte : après application des décalages,
// PLUS AUCUNE paire ne se touche — et rien ne bouge quand il n'y avait rien à corriger.

const box = (x: number, y: number, w = 100, h = 18): LabelBox => ({ x, y, w, h })

// vérifie l'invariant de sortie sur les boîtes DÉCALÉES
function anyOverlap(boxes: LabelBox[], dy: number[], gapX = 6, gapY = 3): boolean {
  const moved = boxes.map((b, i) => ({ ...b, y: b.y + dy[i]! }))
  for (let i = 0; i < moved.length; i++) {
    for (let j = i + 1; j < moved.length; j++) {
      const a = moved[i]!, b = moved[j]!
      if (Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + gapX) continue
      if (a.y - a.h < b.y + gapY && b.y - b.h < a.y + gapY) return true
    }
  }
  return false
}

describe('spreadLabels', () => {
  it('ne bouge rien quand les étiquettes sont déjà séparées horizontalement', () => {
    const boxes = [box(100, 200), box(300, 200), box(500, 200)]
    expect(spreadLabels(boxes)).toEqual([0, 0, 0])
  })

  it('ne bouge rien quand elles sont déjà séparées verticalement', () => {
    const boxes = [box(100, 200), box(100, 160)]
    expect(spreadLabels(boxes)).toEqual([0, 0])
  })

  it('remonte l\'étiquette en conflit (et jamais vers le bas)', () => {
    const boxes = [box(100, 200), box(120, 200)] // quasi superposées
    const dy = spreadLabels(boxes)
    expect(dy.some((d) => d < 0)).toBe(true)
    expect(dy.every((d) => d <= 0)).toBe(true) // on ne descend JAMAIS
    expect(anyOverlap(boxes, dy)).toBe(false)
  })

  it('la plus BASSE garde sa place (elle est prioritaire)', () => {
    const boxes = [box(100, 180), box(100, 200)] // la 2e est plus bas
    const dy = spreadLabels(boxes)
    expect(dy[1]).toBe(0)
    expect(dy[0]).toBeLessThan(0)
  })

  it('résout un empilement de 4 étiquettes toutes superposées', () => {
    const boxes = [box(100, 200), box(105, 200), box(110, 200), box(95, 200)]
    const dy = spreadLabels(boxes)
    expect(anyOverlap(boxes, dy)).toBe(false)
  })

  it('ne décale pas horizontalement : une étiquette reste au-dessus de ce qu\'elle nomme', () => {
    // la fonction ne renvoie QUE des dy — le contrat interdit tout déplacement en x par construction
    const boxes = [box(100, 200), box(100, 200)]
    expect(spreadLabels(boxes)).toHaveLength(2)
  })

  it('tient sur une liste vide et sur une seule étiquette', () => {
    expect(spreadLabels([])).toEqual([])
    expect(spreadLabels([box(0, 0)])).toEqual([0])
  })
})
