import { describe, it, expect } from 'vitest'
import {
  MENU, statsBox, materialsBox, materialRowsPerCol, materialCapacity,
  splitMaterials, materialsBottom,
} from '../../src/scenes/menu-layout'
import { MATERIALS } from '../../src/data/materials'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MENU — RIEN NE DÉBORDE, QUELLE QUE SOIT LA PARTIE.
//
// Retour user : « le menu cata cata ». Cause trouvée : deux listes de longueur VARIABLE posées sans
// aucune borne. Les compétences à `y = 110 + i * 50` → pour l'archer (15 sorts) la dernière ligne
// tombait à y = 810 sur un écran haut de 540. Et les matériaux à `y = 378 + i * 20`, sans plafond non
// plus : une collection un peu remplie sortait de l'écran.
//
// La liste de compétences a été RETIRÉE du menu (elle faisait doublon avec l'arbre de compétences, qui
// la présente correctement) ; les matériaux sont désormais en grille BORNÉE. Ce test vérifie que la
// borne tient pour TOUTES les tailles possibles de collection — y compris si un jour on double le
// nombre de matériaux du jeu.

describe('colonnes du menu', () => {
  it('les deux colonnes ne se recouvrent pas', () => {
    const a = statsBox(), b = materialsBox()
    expect(a.x + a.w).toBeLessThanOrEqual(b.x)
  })

  it('les deux colonnes restent dans la zone utile', () => {
    for (const [name, r] of Object.entries({ stats: statsBox(), materiaux: materialsBox() })) {
      expect(r.x, `${name}.x`).toBeGreaterThanOrEqual(MENU.left)
      expect(r.x + r.w, `${name} droite`).toBeLessThanOrEqual(MENU.right)
      expect(r.y, `${name}.y`).toBeGreaterThanOrEqual(MENU.top)
      expect(r.y + r.h, `${name} bas`).toBeLessThanOrEqual(MENU.bottom)
    }
  })
})

describe('grille de matériaux bornée', () => {
  it('la capacité est cohérente avec la place disponible', () => {
    expect(materialRowsPerCol()).toBeGreaterThan(0)
    expect(materialCapacity()).toBe(materialRowsPerCol() * MENU.matCols)
  })

  it('n\'affiche JAMAIS plus que la capacité, quelle que soit la collection', () => {
    // on va bien au-delà du nombre réel de matériaux du jeu : le jour où on en ajoutera, la borne
    // devra toujours tenir sans que personne n'y repense
    for (const n of [0, 1, 5, materialCapacity(), materialCapacity() + 1, 200]) {
      const { shown, hidden } = splitMaterials(new Array(n).fill(0))
      expect(shown.length, `n=${n}`).toBeLessThanOrEqual(materialCapacity())
      expect(shown.length + hidden, `n=${n} : total conservé`).toBe(n)
    }
  })

  it('annonce le reste dès que ça dépasse (jamais de disparition silencieuse)', () => {
    const over = materialCapacity() + 7
    const { hidden } = splitMaterials(new Array(over).fill(0))
    expect(hidden).toBeGreaterThan(0)
  })

  it('la dernière ligne affichée reste DANS la boîte, même collection pleine', () => {
    const box = materialsBox()
    for (const n of [1, 3, materialCapacity(), materialCapacity() + 50, 500]) {
      expect(materialsBottom(n), `n=${n}`).toBeLessThanOrEqual(box.y + box.h)
    }
  })

  it('la collection COMPLÈTE du jeu tient (ou est correctement tronquée)', () => {
    const n = Object.keys(MATERIALS).length
    const { shown, hidden } = splitMaterials(new Array(n).fill(0))
    expect(shown.length + hidden).toBe(n)
    expect(materialsBottom(n)).toBeLessThanOrEqual(materialsBox().y + materialsBox().h)
  })
})
