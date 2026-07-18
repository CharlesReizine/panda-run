import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
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
