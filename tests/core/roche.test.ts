import { describe, it, expect } from 'vitest'
import { cornichesNues, comblements, PASSAGE_MIN_ROWS, type Dalle, type Marche } from '../../src/core/roche'
import { LEVELS } from '../../src/data/levels'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// « JE PEUX MARCHER SUR LA PIERRE MÊME SI J'AI LA TERRE AU-DESSUS »
//
// Retour du user avec capture. Le défaut : une dalle de pierre dont le sommet est à nu, surplombé de 1
// à 3 rangées par une plateforme de terre — un recoin de maçonnerie où le panda se pose sans rien
// pouvoir y faire. 313 colonnes concernées à la découverte, sur 26 terrains.
//
// ⚠️ LA LIMITE À NE PAS FRANCHIR : ne combler QUE ce qui n'est pas un passage. Le premier test ci-dessous
// est celui qui protège le contenu du jeu — un boyau de 4 rangées sous une corniche est un vrai chemin,
// et le comblement doit le laisser tranquille. C'est aussi ce qui rend le correctif sûr : la mesure a
// montré qu'aucun des 313 recoins n'atteignait 4 rangées, donc rien de jouable n'a été muré.

const dalle = (x: number, y: number, w: number, h: number): Dalle => ({ x, y, w, h, solid: true })
const terre = (x: number, y: number, w: number): Marche => ({ x, y, w })

describe('cornichesNues', () => {
  it('repère le recoin : pierre à nu sous une corniche de terre trop proche', () => {
    // pierre au sommet y=10, terre à y=8 → une seule rangée d'air (y=9) : impraticable
    const nues = cornichesNues([dalle(0, 10, 3, 5)], [terre(0, 8, 3)])
    expect(nues).toHaveLength(3)
    expect(nues[0]).toEqual({ x: 0, pierre: 10, terre: 8 })
  })

  it('LAISSE un vrai passage : 4 rangées d\'air sous la corniche, c\'est un chemin', () => {
    // c'est LE test qui empêche le comblement de murer du jouable
    expect(cornichesNues([dalle(0, 13, 3, 5)], [terre(0, 8, 3)])).toEqual([])
    // juste en dessous du seuil, en revanche, c'est bien un recoin
    expect(cornichesNues([dalle(0, 12, 3, 5)], [terre(0, 8, 3)])).toHaveLength(3)
    expect(PASSAGE_MIN_ROWS).toBe(4)
  })

  it('ignore une pierre COIFFÉE : la terre posée dessus en fait un corps, pas un balcon', () => {
    // c'est la construction normale du jeu (corniche de terre + corps de pierre) : rien à corriger
    expect(cornichesNues([dalle(0, 10, 3, 5)], [terre(0, 9, 3)])).toEqual([])
  })

  it('ignore une mesa à ciel ouvert : sans terre au-dessus, le sommet a le droit d\'être marchable', () => {
    expect(cornichesNues([dalle(0, 10, 3, 5)], [])).toEqual([])
    // une plateforme de terre AILLEURS en x ne surplombe pas la dalle
    expect(cornichesNues([dalle(0, 10, 3, 5)], [terre(40, 8, 3)])).toEqual([])
  })

  it('ignore un sommet ENTERRÉ sous une autre dalle : ce n\'est pas une surface', () => {
    // la dalle du bas (sommet y=10) est recouverte par celle du haut (y=6..9) : on ne s'y pose pas.
    // La dalle du HAUT, elle, est coiffée de terre (y=5) → tout est propre, rien à signaler.
    expect(cornichesNues([dalle(0, 10, 3, 5), dalle(0, 6, 3, 4)], [terre(0, 5, 3)])).toEqual([])
  })

  it('retient la terre la PLUS BASSE quand plusieurs surplombent', () => {
    const nues = cornichesNues([dalle(0, 10, 1, 5)], [terre(0, 8, 1), terre(0, 3, 1)])
    expect(nues[0]!.terre).toBe(8) // c'est elle qui plafonne le recoin
  })
})

describe('comblements', () => {
  it('remplit exactement les rangées d\'air, sans toucher à la terre ni à la pierre', () => {
    const [d] = comblements([dalle(0, 12, 3, 5)], [terre(0, 8, 3)])
    expect(d).toEqual({ x: 0, y: 9, w: 3, h: 3, solid: true }) // y=9..11, la terre (8) et la pierre (12) intactes
  })

  it('fusionne les colonnes voisines en UNE dalle', () => {
    expect(comblements([dalle(5, 10, 8, 4)], [terre(5, 8, 8)])).toHaveLength(1)
  })

  it('sépare deux recoins de géométries différentes', () => {
    const out = comblements([dalle(0, 10, 2, 4), dalle(20, 11, 2, 4)], [terre(0, 8, 2), terre(20, 8, 2)])
    expect(out).toHaveLength(2)
    expect(out.map((d) => d.h).sort()).toEqual([1, 2])
  })

  it('ne produit RIEN là où il n\'y a rien à corriger (idempotence)', () => {
    const rocks = [dalle(0, 12, 3, 5)]
    const plats = [terre(0, 8, 3)]
    const ajout = comblements(rocks, plats)
    // appliquer le comblement puis recommencer ne doit plus rien trouver
    expect(comblements([...rocks, ...ajout], plats)).toEqual([])
  })
})

describe('les 48 terrains du jeu', () => {
  it('n\'ont plus AUCUNE corniche de pierre nue', () => {
    const fautifs: string[] = []
    for (const l of Object.values(LEVELS)) {
      const n = cornichesNues(l.rockBands ?? [], l.platforms)
      if (n.length) fautifs.push(`${l.id} : ${n.length} colonnes (ex. x${n[0]!.x} pierre y${n[0]!.pierre} sous terre y${n[0]!.terre})`)
    }
    expect(fautifs).toEqual([])
  })
})
