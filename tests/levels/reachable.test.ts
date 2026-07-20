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

// MONDE HAUT : le sol n'est plus figé à la rangée 14 mais au BAS du monde (heightTiles - 2). Le
// validateur doit prendre le groundRow DU NIVEAU, sinon un monde haut aurait un « sol fantôme »
// à la rangée 14 et jugerait à tort atteignables/injoignables des plateformes ou pieds d'échelle.
describe('monde haut : groundRow dérivé de heightTiles (sol au bas du monde)', () => {
  // monde de 44 rangées → sol row42. Un escalier depuis le sol (row39) grimpe de +3 en +3, puis
  // une échelle mène au sommet (row16). Tout est atteignable AVEC le bon groundRow.
  const tall: LevelDef = {
    id: 'synthetique-haut', name: 'test', biome: 'plaine', widthTiles: 60, heightTiles: 44,
    platforms: [{ x: 8, y: 39, w: 5 }, { x: 15, y: 36, w: 5 }, { x: 22, y: 33, w: 5 }, { x: 29, y: 30, w: 5 }, { x: 36, y: 27, w: 5 }, { x: 43, y: 24, w: 5 }, { x: 44, y: 16, w: 5 }],
    spawns: [], ladders: [{ x: 46, y: 14, h: 10 }],
  }

  it('toutes les plateformes atteignables avec le sol au bas (row42)', () => {
    expect(unreachablePlatforms(tall)).toEqual([])
  })
  it('l’échelle (pied row24 sur le palier, sommet row16) ne débouche pas sur le vide', () => {
    expect(laddersToNowhere(tall)).toEqual([])
    expect(unreachableLadders(tall)).toEqual([])
  })
  it('pied d’échelle : « touche le sol » dépend du groundRow DU niveau', () => {
    // échelle dont le pied (row24) ne repose sur AUCUNE plateforme. Son statut « grounded »
    // bascule selon la hauteur déclarée du monde → prouve que groundRow vient bien du niveau.
    const base: LevelDef = {
      id: 'x', name: 't', biome: 'plaine', widthTiles: 60, spawns: [],
      platforms: [{ x: 10, y: 16, w: 4 }], // sommet (drop 2 sous l.y=14)
      ladders: [{ x: 12, y: 14, h: 10 }], // pied à row24, dans le vide
    }
    // monde HAUT (sol row42) : pied row24 < 42 et rien dessous → « pied dans le vide »
    expect(laddersToNowhere({ ...base, heightTiles: 44 }).map((p) => p.reason)).toContain('pied-dans-le-vide')
    // monde COURT (sol row24) : le pied atteint le sol → aucune anomalie
    expect(laddersToNowhere({ ...base, heightTiles: 26 })).toEqual([])
  })
})
