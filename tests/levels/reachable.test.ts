import { describe, it, expect } from 'vitest'
import { LEVELS, type LevelDef } from '../../src/data/levels'
import {
  unreachablePlatforms,
  laddersToNowhere,
  unreachableLadders,
  unreachableChests,
} from '../../src/core/level-validator'

// Garantit que CHAQUE niveau est physiquement jouable : toute plateforme est atteignable
// (au sol, de proche en proche, ou en grimpant une échelle), aucune échelle ne débouche sur
// le vide, aucun coffre n'est posé sur une plateforme injoignable.
describe('atteignabilité physique de chaque niveau', () => {
  for (const level of Object.values(LEVELS)) {
    it(`${level.id} — toutes les plateformes atteignables`, () => {
      const bad = unreachablePlatforms(level)
      expect(bad, `${level.id}: plateformes inatteignables → ${JSON.stringify(bad)}`).toEqual([])
    })

    it(`${level.id} — aucune échelle vers le vide`, () => {
      const bad = laddersToNowhere(level)
      expect(bad, `${level.id}: échelles vers le vide → ${JSON.stringify(bad)}`).toEqual([])
    })

    it(`${level.id} — pied de chaque échelle accessible`, () => {
      const bad = unreachableLadders(level)
      expect(bad, `${level.id}: échelles au pied injoignable → ${JSON.stringify(bad)}`).toEqual([])
    })

    it(`${level.id} — coffres sur plateforme atteignable`, () => {
      const bad = unreachableChests(level)
      expect(bad, `${level.id}: coffres injoignables → ${JSON.stringify(bad)}`).toEqual([])
    })
  }
})

// Règle du palier de SOMMET : à cause du décalage pieds↔centre du panda (~1,25 tuile), quand il
// grimpe jusqu'en haut ses pieds arrivent 1 à 2 rangées SOUS le haut du montant. Une plateforme
// posée pile à l.y est donc à hauteur de tête, injoignable (c'était le bug corrigé). Le
// validateur EXIGE désormais le palier à l.y+1..l.y+2 — on le verrouille ici pour empêcher tout
// retour à un palier posé à l.y (ou trop bas, décroché du sommet).
describe('palier de sommet d’échelle : rangée réellement atteignable (décalage pieds)', () => {
  // échelle x=10, haut à la rangée 3, pied au sol (3+11=14=GROUND_ROW) → seul le sommet est en jeu
  const withTopAtRow = (row: number): LevelDef => ({
    id: `synthetique-r${row}`, name: 'test', biome: 'plaine', widthTiles: 30,
    platforms: [{ x: 6, y: row, w: 4 }], // adjacent au montant x=10 (couvre 6..9, +1 rangée de marge)
    spawns: [], ladders: [{ x: 10, y: 3, h: 11 }],
  })

  it('palier pile au haut du montant (l.y) → rejeté (à hauteur de tête, injoignable)', () => {
    expect(laddersToNowhere(withTopAtRow(3)).map((p) => p.reason)).toEqual(['sommet-sans-plateforme'])
  })
  it('palier 1 rangée sous le haut (l.y+1) → accepté', () => {
    expect(laddersToNowhere(withTopAtRow(4))).toEqual([])
  })
  it('palier 2 rangées sous le haut (l.y+2) → accepté', () => {
    expect(laddersToNowhere(withTopAtRow(5))).toEqual([])
  })
  it('palier 3 rangées sous le haut (l.y+3) → rejeté (décroché du sommet)', () => {
    expect(laddersToNowhere(withTopAtRow(6)).map((p) => p.reason)).toEqual(['sommet-sans-plateforme'])
  })
})
