import { describe, it, expect } from 'vitest'
import { LEVELS, type LevelDef } from '../../src/data/levels'
import {
  unreachablePlatforms,
  laddersToNowhere,
  unreachableLadders,
  unreachableChests,
  oversizedGaps,
  oversizedLadders,
  maxStackedTiers,
  overStackedColumns,
  openWaterHazards,
  monstersOffSurface,
  startExitProblems,
} from '../../src/core/level-validator'
import { MAX_LADDER_TILES } from '../../src/core/platforming'
import { MONSTERS } from '../../src/data/monsters'

// Niveaux construits par le KIT DE MODULES (docs/level-module-kit.md) : ils doivent respecter les
// règles de jouabilité ET de cohérence supplémentaires du kit (les 15 autres niveaux, non refondus,
// gardent seulement les garanties historiques ci-dessus).
const MODULAR_IDS = ['zone1-1', 'zone1-2', 'zone1-3', 'zone1-4',
  'zone2-1', 'zone2-2', 'zone2-3', 'cave-1',
  'zone3-1', 'zone3-2', 'plage-1', 'plage-2',
  'zone4-1', 'zone4-2', 'carriere-1', 'carriere-2',
  'zone5-1', 'zone5-2', 'zone6-1']
const isAerial = (id: string) => !!MONSTERS[id]?.aerial

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

    it(`${level.id} — trous franchissables au saut simple`, () => {
      const bad = oversizedGaps(level)
      expect(bad, `${level.id}: trous infranchissables → ${JSON.stringify(bad)}`).toEqual([])
    })

    it(`${level.id} — aucune échelle plus longue que MAX_LADDER_TILES`, () => {
      const bad = oversizedLadders(level)
      expect(bad, `${level.id}: échelles interminables → ${JSON.stringify(bad)}`).toEqual([])
    })
  }
})

// ─── KIT DE MODULES : jouabilité + cohérence sur les niveaux modulaires (zone1-1..zone1-4) ──────
describe('kit de modules — jouabilité + cohérence des niveaux modulaires', () => {
  for (const id of MODULAR_IDS) {
    const level = LEVELS[id]!

    it(`${id} — ≤ 3 paliers empilés (silhouette collines, pas de tour)`, () => {
      const over = overStackedColumns(level, 3)
      expect(over, `${id}: colonnes > 3 paliers → ${JSON.stringify(over.slice(0, 8))}`).toEqual([])
      expect(maxStackedTiers(level)).toBeLessThanOrEqual(3)
    })

    it(`${id} — toute eau enclose dans une cuve (marine/cascade, jamais de nappe libre)`, () => {
      const bad = openWaterHazards(level)
      expect(bad, `${id}: eau non enclose → ${JSON.stringify(bad)}`).toEqual([])
    })

    it(`${id} — chaque monstre terrestre posé sur une surface où patrouiller`, () => {
      const bad = monstersOffSurface(level, isAerial)
      expect(bad, `${id}: monstres mal posés → ${JSON.stringify(bad)}`).toEqual([])
    })

    it(`${id} — départ à mi-hauteur, sortie à une autre altitude`, () => {
      const bad = startExitProblems(level)
      expect(bad, `${id}: ${bad.join(' ; ')}`).toEqual([])
    })

    it(`${id} — au moins un plan d'eau marine ET une cascade quelque part dans la zone`, () => {
      // (vérifié à l'échelle de la ZONE : chaque niveau a de l'eau, la zone couvre les deux formes)
      const waters = (level.hazards ?? []).filter((h) => h.kind === 'water')
      expect(waters.length, `${id}: aucune eau`).toBeGreaterThan(0)
    })
  }

  it('la zone modulaire contient bassin marine ET cascade remontable', () => {
    const allWaters = MODULAR_IDS.flatMap((id) => (LEVELS[id]!.hazards ?? []).filter((h) => h.kind === 'water'))
    expect(allWaters.some((h) => h.water === 'basin'), 'aucun bassin marine').toBe(true)
    expect(allWaters.some((h) => h.water === 'cascade'), 'aucune cascade').toBe(true)
  })
})

// CAS SYNTHÉTIQUES DE REJET du kit : le validateur doit casser sur une cuve sans mur (nappe libre)
// et sur 4 paliers empilés (une échelle de 14 est déjà rejetée plus bas par oversizedLadders).
describe('kit de modules — cas de rejet synthétiques', () => {
  it('cuve d’eau NON enclose (nappe libre) → rejetée', () => {
    const bad: LevelDef = {
      id: 'synthetique-nappe', name: 't', biome: 'plaine', widthTiles: 30, spawns: [], platforms: [],
      hazards: [{ kind: 'water', x: 5, w: 8, top: 8, h: 5 }], // pas de champ water → nappe libre
    }
    expect(openWaterHazards(bad)).toHaveLength(1)
  })

  it('bassin marine (basin) et cascade → acceptés (enclos)', () => {
    const ok: LevelDef = {
      id: 'synthetique-cuve', name: 't', biome: 'plaine', widthTiles: 30, spawns: [], platforms: [],
      hazards: [{ kind: 'water', x: 5, w: 8, top: 8, h: 5, water: 'basin' }, { kind: 'water', x: 20, w: 2, top: 6, h: 7, water: 'cascade' }],
    }
    expect(openWaterHazards(ok)).toEqual([])
  })

  it('4 paliers empilés à une colonne → rejeté (≤ 3 exigé)', () => {
    // sol (row 14) + 3 plateformes qui couvrent toutes la colonne x=10 → 4 paliers
    const bad: LevelDef = {
      id: 'synthetique-4tiers', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 8, y: 12, w: 6 }, { x: 8, y: 9, w: 6 }, { x: 8, y: 6, w: 6 }],
    }
    expect(maxStackedTiers(bad)).toBe(4)
    expect(overStackedColumns(bad, 3).length).toBeGreaterThan(0)
  })

  it('3 paliers empilés (sol + 2 plateformes) → accepté', () => {
    const ok: LevelDef = {
      id: 'synthetique-3tiers', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 8, y: 12, w: 6 }, { x: 8, y: 9, w: 6 }],
    }
    expect(maxStackedTiers(ok)).toBe(3)
    expect(overStackedColumns(ok, 3)).toEqual([])
  })
})

// PLAFOND DE LONGUEUR D'ÉCHELLE : aucune échelle ne doit dépasser MAX_LADDER_TILES. Une montée
// géante doit se faire en segments d'échelle empilés séparés par de vrais paliers (builder tower).
describe('plafond de longueur d’échelle (MAX_LADDER_TILES)', () => {
  const withLadderH = (h: number): LevelDef => ({
    id: `synthetique-ladder-h${h}`, name: 'test', biome: 'plaine', widthTiles: 30,
    platforms: [{ x: 6, y: 15 - h + 2, w: 4 }], spawns: [], ladders: [{ x: 10, y: 15 - h, h }],
  })

  it('échelle pile à MAX_LADDER_TILES → acceptée', () => {
    expect(oversizedLadders(withLadderH(MAX_LADDER_TILES))).toEqual([])
  })
  it('échelle de MAX_LADDER_TILES + 1 → rejetée', () => {
    const bad = oversizedLadders(withLadderH(MAX_LADDER_TILES + 1))
    expect(bad).toHaveLength(1)
    expect(bad[0]!.h).toBe(MAX_LADDER_TILES + 1)
  })
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
