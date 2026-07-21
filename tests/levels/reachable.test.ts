import { describe, it, expect } from 'vitest'
import { LEVELS, LEVEL_MODULE_KINDS, type LevelDef } from '../../src/data/levels'
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
  unlevelWaterBanks,
  suspendedWaterBanks,
  deadEndSurfaces,
} from '../../src/core/level-validator'
import { MAX_LADDER_TILES } from '../../src/core/platforming'
import { MONSTERS } from '../../src/data/monsters'

// Niveaux construits par le KIT DE MODULES (docs/level-module-kit.md) : ils doivent respecter les
// règles de jouabilité ET de cohérence supplémentaires du kit (les 15 autres niveaux, non refondus,
// gardent seulement les garanties historiques ci-dessus).
// Monde carte A : les 48 terrains sont TOUS générés par le kit de modules (composeLevel) ; seules
// les 9 arènes de boss (boss-0X) sont hand-authored et exclues de ces contrôles supplémentaires.
const MODULAR_IDS = [
  'plaine-1', 'plaine-2', 'plaine-3', 'plaine-4', 'plaine-5', 'plaine-6', 'plaine-7',
  'foret-1', 'foret-2', 'foret-3', 'foret-4', 'foret-5', 'foret-6', 'foret-7',
  'desert-1', 'desert-2', 'desert-3', 'desert-4', 'desert-5', 'desert-6', 'desert-7', 'desert-8', 'desert-9', 'desert-10', 'desert-11',
  'jungle-1', 'jungle-2', 'jungle-3', 'jungle-4', 'jungle-5',
  'cave-1',
  'montagne-1', 'montagne-2', 'montagne-3',
  'cimetiere-1', 'cimetiere-2',
  'plage-1', 'plage-2', 'plage-3', 'plage-4',
  'carriere-1',
  'enfer-1', 'enfer-2', 'enfer-3', 'enfer-4', 'enfer-5', 'enfer-6', 'enfer-7',
]
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

    it(`${id} — rebords de plan d'eau À NIVEAU (surface horizontale, berges de même altitude)`, () => {
      const bad = unlevelWaterBanks(level)
      expect(bad, `${id}: rebords désaxés → ${JSON.stringify(bad)}`).toEqual([])
    })

    it(`${id} — aucun lac SUSPENDU (cuve fermée, jamais d'eau qui domine le vide sur un bord ouvert)`, () => {
      const bad = suspendedWaterBanks(level)
      expect(bad, `${id}: eau suspendue → ${JSON.stringify(bad)}`).toEqual([])
    })

    it(`${id} — aucun piège sans retour (remonter vers la sortie OU mourir, jamais coincé vivant)`, () => {
      const bad = deadEndSurfaces(level)
      expect(bad, `${id}: pièges sans retour → ${JSON.stringify(bad.slice(0, 6))}`).toEqual([])
    })
  }

  it('un niveau au moins pose un LAC EN U (plafond de roche submergé + colonnes ouvertes)', () => {
    const u = LEVELS['plage-2']!
    // le lac en U pose une cuve marine ET un plafond de roche SOLIDE immergé (toit du tunnel)
    expect((u.hazards ?? []).some((h) => h.kind === 'water' && h.water === 'basin')).toBe(true)
    expect((u.rockBands ?? []).some((r) => r.solid)).toBe(true)
    // pas de piège, rebords à niveau (les invariants s'appliquent aussi à ce niveau)
    expect(deadEndSurfaces(u)).toEqual([])
    expect(unlevelWaterBanks(u)).toEqual([])
  })

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

  it('coffre au fond d’un bassin ENTRABLE (berge atteignable + surface ouverte) → accepté', () => {
    const ok: LevelDef = {
      id: 'synth-basin-ok', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 3, y: 11, w: 4 }], // berge au niveau de la surface, atteignable du sol (rise 3)
      hazards: [{ kind: 'water', x: 7, w: 8, top: 11, h: 3, water: 'basin' }],
      props: [{ kind: 'coffre', x: 10 }], // AU FOND (sans y)
    }
    expect(unreachableChests(ok)).toEqual([])
  })

  it('coffre au fond d’un LAC INACCESSIBLE (aucune berge à son niveau) → rejeté', () => {
    const bad: LevelDef = {
      id: 'synth-lac-ko', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [], // rien au niveau de la surface : lac entouré de « falaises »
      hazards: [{ kind: 'water', x: 7, w: 8, top: 6, h: 8, water: 'basin' }],
      props: [{ kind: 'coffre', x: 10 }],
    }
    expect(unreachableChests(bad)).toHaveLength(1)
  })

  it('coffre au fond d’un bassin ENTIÈREMENT PONTÉ (aucune colonne ouverte) → rejeté', () => {
    const bad: LevelDef = {
      id: 'synth-basin-scelle', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 3, y: 11, w: 4 }],
      hazards: [{ kind: 'water', x: 7, w: 8, top: 11, h: 3, water: 'basin' }],
      bridges: [{ x: 7, y: 11, w: 8 }], // pont couvrant TOUTE la surface → impossible de plonger
      props: [{ kind: 'coffre', x: 10 }],
    }
    expect(unreachableChests(bad)).toHaveLength(1)
  })

  it('3 paliers empilés (sol + 2 plateformes) → accepté', () => {
    const ok: LevelDef = {
      id: 'synthetique-3tiers', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 8, y: 12, w: 6 }, { x: 8, y: 9, w: 6 }],
    }
    expect(maxStackedTiers(ok)).toBe(3)
    expect(overStackedColumns(ok, 3)).toEqual([])
  })

  it('rebords de bassin À NIVEAU (berges de même altitude) → accepté', () => {
    const ok: LevelDef = {
      id: 'synth-berges-ok', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 3, y: 11, w: 4 }, { x: 15, y: 11, w: 4 }], // berges gauche ET droite à row 11
      hazards: [{ kind: 'water', x: 7, w: 8, top: 11, h: 4, water: 'basin' }],
    }
    expect(unlevelWaterBanks(ok)).toEqual([])
  })

  it('rebord DROIT plus bas que le gauche → rejeté (surface d’eau non horizontale)', () => {
    const bad: LevelDef = {
      id: 'synth-berges-ko', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 3, y: 11, w: 4 }, { x: 15, y: 13, w: 4 }], // berge droite 2 rangées PLUS BAS
      hazards: [{ kind: 'water', x: 7, w: 8, top: 11, h: 4, water: 'basin' }],
    }
    const b = unlevelWaterBanks(bad)
    expect(b).toHaveLength(1)
    expect(b[0]!.side).toBe('droite')
  })

  it('bord OUVERT (passage sous-marin) → berge de ce côté exemptée par unlevelWaterBanks', () => {
    const ok: LevelDef = {
      id: 'synth-berges-open', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 3, y: 11, w: 4 }, { x: 15, y: 14, w: 4 }], // droite basse mais côté OUVERT
      hazards: [{ kind: 'water', x: 7, w: 8, top: 11, h: 6, water: 'basin', openSide: 'right' }],
    }
    expect(unlevelWaterBanks(ok)).toEqual([])
  })

  it('LAC SUSPENDU : bord OUVERT dont le sol voisin domine loin sous la surface → rejeté (eau qui vole)', () => {
    // reproduit le bug systémique du passage-immerge (plaine-3/7) : surface à row 11, mais le seul sol
    // du bord ouvert est 3 rangées PLUS BAS → la colonne d'eau flotte au-dessus du terrain.
    const bad: LevelDef = {
      id: 'synth-eau-suspendue', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 3, y: 11, w: 4 }, { x: 15, y: 14, w: 4 }],
      hazards: [{ kind: 'water', x: 7, w: 8, top: 11, h: 6, water: 'basin', openSide: 'right' }],
    }
    const b = suspendedWaterBanks(bad)
    expect(b).toHaveLength(1)
    expect(b[0]!.side).toBe('droite')
  })

  it('bord OUVERT dont le sol voisin est AU RAS de la surface → accepté (pas suspendu)', () => {
    const ok: LevelDef = {
      id: 'synth-eau-non-suspendue', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 3, y: 11, w: 4 }, { x: 15, y: 11, w: 4 }], // bord droit ouvert MAIS au niveau
      hazards: [{ kind: 'water', x: 7, w: 8, top: 11, h: 4, water: 'basin', openSide: 'right' }],
    }
    expect(suspendedWaterBanks(ok)).toEqual([])
  })

  it('cuve FERMÉE (aucun bord ouvert) → jamais signalée suspendue', () => {
    const ok: LevelDef = {
      id: 'synth-cuve-fermee', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 3, y: 11, w: 4 }, { x: 15, y: 11, w: 4 }],
      hazards: [{ kind: 'water', x: 7, w: 8, top: 11, h: 4, water: 'basin' }],
    }
    expect(suspendedWaterBanks(ok)).toEqual([])
  })

  it('piège sans retour : sortie HAUTE injoignable, aucune mort possible → rejeté', () => {
    const bad: LevelDef = {
      id: 'synth-softlock', name: 't', biome: 'plaine', widthTiles: 40, heightTiles: 20, spawns: [],
      start: { x: 4, y: 14 }, exit: { x: 35, y: 5 },
      // départ sur un palier bas (alt4, joignable du sol) ; sortie alt13 ISOLÉE (aucune échelle/marche) ;
      // aucun trou/eau → on ne peut pas mourir → coincé vivant sans retour.
      platforms: [{ x: 2, y: 14, w: 6 }, { x: 33, y: 5, w: 5 }],
    }
    expect(deadEndSurfaces(bad).length).toBeGreaterThan(0)
  })

  it('même sortie haute mais reliée par des paliers ≤3 → accepté (on remonte)', () => {
    const ok: LevelDef = {
      id: 'synth-softlock-ok', name: 't', biome: 'plaine', widthTiles: 40, heightTiles: 20, spawns: [],
      start: { x: 4, y: 14 }, exit: { x: 30, y: 5 },
      platforms: [{ x: 2, y: 14, w: 8 }, { x: 8, y: 11, w: 8 }, { x: 14, y: 8, w: 8 }, { x: 20, y: 6, w: 8 }, { x: 26, y: 5, w: 8 }],
    }
    expect(deadEndSurfaces(ok)).toEqual([])
  })

  it('cul-de-sac MAIS mortel (trou sous le palier) → toléré (on peut mourir)', () => {
    const okDie: LevelDef = {
      id: 'synth-softlock-die', name: 't', biome: 'plaine', widthTiles: 40, heightTiles: 20, spawns: [],
      start: { x: 4, y: 14 }, exit: { x: 35, y: 5 },
      gaps: [{ x: 0, w: 40 }], // TOUT le sol est un vide mortel : depuis le palier de départ, tomber = mourir
      platforms: [{ x: 2, y: 14, w: 6 }, { x: 33, y: 5, w: 5 }],
    }
    expect(deadEndSurfaces(okDie)).toEqual([])
  })
})

// ─── VARIÉTÉ DES MOTIFS : le générateur doit PARCOURIR le catalogue (anti-boring) ───────────────
// Retour user : « les terrains se ressemblent, tu utilises bien tous tes motifs ? ». On verrouille
// ici que les motifs jusque-là JAMAIS posés sont désormais utilisés, et qu'aucun motif ne monopolise.
describe('variété des motifs de niveau (couverture du catalogue)', () => {
  const freq: Record<string, number> = {}
  let totalModules = 0
  for (const kinds of Object.values(LEVEL_MODULE_KINDS)) for (const k of kinds) { freq[k] = (freq[k] ?? 0) + 1; totalModules++ }
  const usedKinds = Object.keys(freq).length

  it('les motifs d’eau jadis inutilisés (petit-pont, trou-filet, pas-japonais) sont désormais posés', () => {
    for (const k of ['petit-pont', 'trou-filet', 'pas-japonais']) {
      expect(freq[k] ?? 0, `${k} jamais utilisé`).toBeGreaterThan(0)
    }
  })

  it('les marches de PIERRE (escalier-pierre) apparaissent en biome rocheux', () => {
    expect(freq['escalier-pierre'] ?? 0, 'escalier-pierre jamais utilisé').toBeGreaterThan(0)
  })

  it('le générateur couvre largement le catalogue (≥ 38 motifs distincts)', () => {
    expect(usedKinds, `seulement ${usedKinds} motifs distincts`).toBeGreaterThanOrEqual(38)
  })

  it('aucun motif de MILIEU ne monopolise (hors plateau de spawn, < 40 % des modules)', () => {
    const nonSpawn = Object.entries(freq).filter(([k]) => k !== 'plateau')
    const maxShare = Math.max(...nonSpawn.map(([, n]) => n)) / totalModules
    expect(maxShare, `motif le plus fréquent = ${(maxShare * 100).toFixed(1)} %`).toBeLessThan(0.4)
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
