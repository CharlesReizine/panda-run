import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { PORTEES } from '../../src/data/level-modules'
import { WORLD_NODES } from '../../src/data/worldmap'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES OBSTACLES DURS N'ARRIVENT PAS AU DÉBUT
//
// Demande du joueur : « mets les gravures dures pas au début du jeu, au début faut commencer un peu en
// douceur. »
//
// ⚠️ IL AVAIT RAISON SUR UN CAS PRÉCIS ET IL AVAIT DE QUOI : je venais de poser un saut mortel
// au-dessus du vide sur `plaine-6`, CINQUIÈME terrain de la carte — avant même que le joueur ait eu le
// temps de comprendre à quoi sert un trampoline (l'atelier de plaine-3 est deux terrains plus tôt).
// Un obstacle qui exige une mécanique doit arriver APRÈS celui qui l'enseigne, avec de la marge.
//
// La rampe est donc : atelier (rang 2) → vide, qui pardonne car on retombe au sol (rang 12+) → eau, qui
// amortit (rang 19+) → flammes, qui brûlent mais laissent le sol dessous (rang 33+) → fosse de lave,
// où rater c'est mourir (rang 43+). Ce test interdit qu'un motif remonte la pente.

/** Rang du terrain sur la carte : sa distance à Prairie, dans l'ordre de la carte du monde. */
const RANG = new Map(WORLD_NODES.filter((n) => n.levelId).map((n, i) => [n.levelId!, i]))

/** Rang MINIMUM à partir duquel chaque motif de rebond a le droit d'apparaître. */
const PLUS_TOT_QUE: Record<string, number> = {
  'trampoline-plat': 0,            // l'atelier : il ENSEIGNE, il peut arriver tôt
  'trampoline-corniche': 10,
  'trampoline-saut-vide': 10,
  'trampoline-mur': 15,
  'trampoline-saut-eau': 15,
  'trampoline-mur-trou': 25,
  'trampoline-saut-flammes': 30,
  'trampoline-fosse-ardente': 40,
}

describe('rampe de difficulté', () => {
  it('aucun obstacle de rebond n\'arrive avant son tour', () => {
    const tropTot: string[] = []
    // ⚠️ ON LIT LES MOTIFS RÉELLEMENT POSÉS, PAS LA CONSIGNE. `PORTEES` est rempli à l'assemblage de
    // chaque terrain : c'est la seule source qui dise ce qui est VRAIMENT dans le jeu. La table des
    // motifs imposés, elle, peut être juste pendant que la gravure n'a pas encore été refaite.
    void Object.keys(LEVELS).length // force l'assemblage de tous les terrains
    for (const [id, modules] of Object.entries(PORTEES)) {
      const rang = RANG.get(id)
      if (rang === undefined) continue
      for (const kind of modules.map((m) => m.kind)) {
        const mini = PLUS_TOT_QUE[kind]
        if (mini !== undefined && rang < mini) {
          tropTot.push(`${id} (rang ${rang}) porte ${kind}, réservé au rang ${mini}+`)
        }
      }
    }
    expect(tropTot, `obstacles trop précoces :\n   ${tropTot.join('\n   ')}`).toEqual([])
  })

  // ⚠️ ET L'ATELIER DOIT PRÉCÉDER LE PREMIER OBSTACLE. Sans lui, on découvre le rebond au-dessus d'un
  // vide mortel : une mort gratuite, et le joueur n'a même pas compris ce qu'il aurait dû faire.
  it('l\'atelier arrive avant le premier obstacle qui exige le rebond', () => {
    void Object.keys(LEVELS).length
    const rangDe = (kind: string) => Object.entries(PORTEES)
      .filter(([, modules]) => modules.some((m) => m.kind === kind))
      .map(([id]) => RANG.get(id) ?? 999)
    const atelier = Math.min(...rangDe('trampoline-plat'), 999)
    const premierObstacle = Math.min(...['trampoline-mur', 'trampoline-mur-trou', 'trampoline-saut-vide',
      'trampoline-saut-eau', 'trampoline-saut-flammes', 'trampoline-fosse-ardente'].flatMap(rangDe), 999)
    expect(atelier, 'aucun atelier de trampoline sur la carte').toBeLessThan(900)
    expect(atelier, "l'atelier doit précéder l'obstacle").toBeLessThan(premierObstacle)
    // et de plusieurs terrains, pas d'un seul : on apprend, on joue, puis on est mis à l'épreuve
    expect(premierObstacle - atelier, 'trop peu de marge entre apprendre et devoir').toBeGreaterThanOrEqual(5)
  })
})
