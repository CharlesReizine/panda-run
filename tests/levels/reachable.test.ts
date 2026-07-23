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
  caveCeilingClearance,
  shortCascades,
  longEmptyFlats,
} from '../../src/core/level-validator'
import { MAX_LADDER_TILES, groundRowFor } from '../../src/core/platforming'
import { MIN_CASCADE_TILES } from '../../src/data/level-modules'
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

// ─── ANTI-ENNUI : aucune LONGUE BANDE DE PLAT VIDE (retour user « une immense bande de plat sans
// rien, je me fais chier ») ────────────────────────────────────────────────────────────────────
// La génération n'accepte QUE les seeds sans bande de sol plat vide > seuil (16, assoupli à 18-20 au
// pire, cf. clean() dans levels.ts). On vérifie ici (1) que TOUS les niveaux générés respectent le
// plafond DUR (20 tuiles) — le garde-fou est toujours actif ; (2) que la détection accepte/rejette
// correctement des cas synthétiques ; (3) que les décorations pures (herbe) ne « meublent » pas.
describe('anti-ennui — pas de longue bande de plat vide', () => {
  const HARD_CEIL = 20 // plafond DUR (le seuil visé est 16, assoupli au pire à 20)

  for (const id of MODULAR_IDS) {
    const level = LEVELS[id]!
    it(`${id} : aucune bande de plat vide au-delà du plafond (${HARD_CEIL})`, () => {
      const bad = longEmptyFlats(level, HARD_CEIL)
      expect(bad, `${id} bandes vides : ${bad.map((b) => `x${b.x} w${b.w}`).join(' · ')}`).toEqual([])
    })
  }

  it('tous les terrains respectent AUSSI le seuil visé de 16 (état R190)', () => {
    const over = MODULAR_IDS
      .map((id) => ({ id, runs: longEmptyFlats(LEVELS[id]!, 16) }))
      .filter((e) => e.runs.length > 0)
      .map((e) => `${e.id} (${e.runs.map((r) => `w${r.w}`).join(',')})`)
    expect(over, `bandes > 16 : ${over.join(' · ')}`).toEqual([])
  })

  it('une longue bande de sol plat SANS rien → détectée', () => {
    const bad: LevelDef = {
      id: 'synth-plat-vide', name: 't', biome: 'plaine', widthTiles: 40, heightTiles: 16, spawns: [],
      start: { x: 2, y: 14 }, exit: { x: 38, y: 14 }, platforms: [],
    }
    // sol plein (row14) sur 40 tuiles, aucun monstre / relief / obstacle → une bande vide géante
    const runs = longEmptyFlats(bad, 16)
    expect(runs.length).toBeGreaterThan(0)
    expect(runs[0]!.w).toBeGreaterThan(16)
  })

  it('la MÊME bande MEUBLÉE (monstre + plateforme en surplomb + coffre) → acceptée', () => {
    const ok: LevelDef = {
      id: 'synth-plat-meuble', name: 't', biome: 'plaine', widthTiles: 40, heightTiles: 16,
      start: { x: 2, y: 14 }, exit: { x: 38, y: 14 },
      platforms: [{ x: 18, y: 10, w: 5 }], // relief en surplomb au milieu → coupe la bande en deux
      spawns: [{ monsterId: 'gloopy', x: 10 }, { monsterId: 'gloopy', x: 30 }],
      props: [{ kind: 'coffre', x: 26, y: 9 }],
    }
    expect(longEmptyFlats(ok, 16)).toEqual([])
  })

  it('les décorations PURES (herbe) ne meublent PAS une bande vide', () => {
    const bad: LevelDef = {
      id: 'synth-plat-herbe', name: 't', biome: 'plaine', widthTiles: 40, heightTiles: 16, spawns: [],
      start: { x: 2, y: 14 }, exit: { x: 38, y: 14 }, platforms: [],
      props: [{ kind: 'herbe', x: 10 }, { kind: 'herbe', x: 20 }, { kind: 'herbe', x: 30 }],
    }
    expect(longEmptyFlats(bad, 16).length).toBeGreaterThan(0)
  })

  it('un trou / une cuve d’eau BORNE la bande (rupture de platitude)', () => {
    const ok: LevelDef = {
      id: 'synth-plat-coupe', name: 't', biome: 'plaine', widthTiles: 40, heightTiles: 16, spawns: [],
      start: { x: 2, y: 14 }, exit: { x: 38, y: 14 }, platforms: [],
      gaps: [{ x: 19, w: 2 }], // le vide coupe la bande de 40 en deux tronçons ≤ 18
    }
    // deux tronçons de ~18/19 : le trou coupe, mais chaque tronçon reste sous le plafond assoupli
    expect(longEmptyFlats(ok, 20)).toEqual([])
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

  it('le générateur couvre largement le catalogue (≥ 43 motifs distincts)', () => {
    // couverture RELEVÉE (lot « anti-répétition + nouveaux motifs ») : la variété des rôles fixes
    // (départ / descente / montée) + les 3 nouvelles familles + le biais tension font sortir bien
    // plus de motifs qu'avant (≥ 43 sur 47, contre 40 auparavant).
    expect(usedKinds, `seulement ${usedKinds} motifs distincts`).toBeGreaterThanOrEqual(43)
  })

  it('les 3 NOUVELLES familles apparaissent dans la génération', () => {
    for (const k of ['passerelles-zigzag', 'grotte-tunnel', 'grotte-noyee']) {
      expect(freq[k] ?? 0, `${k} jamais posé`).toBeGreaterThan(0)
    }
  })

  it('les motifs de TENSION jadis inutilisés (échelle exposée, pics en quinconce) sortent enfin', () => {
    for (const k of ['echelle-exposee', 'pics-quinconce']) {
      expect(freq[k] ?? 0, `${k} jamais posé`).toBeGreaterThan(0)
    }
  })

  it('les grottes-tunnels ne sortent QUE dans des biomes rocheux / souterrains / jungle', () => {
    const rocky = new Set(['cave', 'montagne', 'carriere', 'enfer', 'jungle', 'foret'])
    for (const id of Object.keys(LEVEL_MODULE_KINDS)) {
      if (LEVEL_MODULE_KINDS[id]!.includes('grotte-tunnel')) {
        expect(rocky.has(LEVELS[id]!.biome), `${id} (${LEVELS[id]!.biome}) ne devrait pas avoir de grotte-tunnel`).toBe(true)
      }
    }
  })

  it('aucun motif de MILIEU ne monopolise (hors plateau de spawn, < 40 % des modules)', () => {
    const nonSpawn = Object.entries(freq).filter(([k]) => k !== 'plateau')
    const maxShare = Math.max(...nonSpawn.map(([, n]) => n)) / totalModules
    expect(maxShare, `motif le plus fréquent = ${(maxShare * 100).toFixed(1)} %`).toBeLessThan(0.4)
  })

  it('aucun motif ne se répète plus de 2 fois DANS un même niveau (hors rôles structurels)', () => {
    // le plafond de répétition (MAX_REPEAT) borne la redondance intra-niveau des motifs CENTRAUX.
    // Les rôles structurels (spawn plat, arène-climax, descente/montée de fin) sont exemptés.
    const STRUCT = new Set(['plateau', 'ligne-droite', 'couloir-large', 'arene', 'descente', 'descente-controlee', 'marche', 'escalier', 'echelle-tranquille'])
    for (const [id, kinds] of Object.entries(LEVEL_MODULE_KINDS)) {
      const count: Record<string, number> = {}
      for (const k of kinds) count[k] = (count[k] ?? 0) + 1
      for (const [k, n] of Object.entries(count)) {
        if (STRUCT.has(k)) continue
        expect(n, `${id}: ${k} posé ${n} fois`).toBeLessThanOrEqual(3)
      }
    }
  })
})

// ─── NOUVELLES FAMILLES : grottes, grotte sous-marine en U, passerelles flottantes en zigzag ─────
describe('nouvelles familles de motifs — jouabilité', () => {
  it('tous les niveaux : plafonds de grotte avec dégagement de saut (≥ 5 rangées)', () => {
    for (const level of Object.values(LEVELS)) {
      const bad = caveCeilingClearance(level)
      expect(bad, `${level.id}: plafonds trop bas → ${JSON.stringify(bad)}`).toEqual([])
    }
  })

  it('plafond de grotte trop BAS (dégagement < 5) → rejeté', () => {
    // surface marchable row 12 ; plafond solide dont le bas est en row 10 → dégagement 2 (< 5)
    const bad: LevelDef = {
      id: 'synth-plafond-bas', name: 't', biome: 'cave', widthTiles: 20, spawns: [],
      platforms: [{ x: 2, y: 12, w: 12 }],
      rockBands: [{ x: 2, y: 6, w: 12, h: 5, solid: true }], // bas de dalle = row 10, surface row 12 → 2
    }
    const b = caveCeilingClearance(bad)
    expect(b).toHaveLength(1)
    expect(b[0]!.clearance).toBe(2)
  })

  it('plafond de grotte avec dégagement suffisant (≥ 5) → accepté', () => {
    const ok: LevelDef = {
      id: 'synth-plafond-ok', name: 't', biome: 'cave', widthTiles: 20, spawns: [],
      platforms: [{ x: 2, y: 13, w: 12 }],
      rockBands: [{ x: 2, y: 2, w: 12, h: 5, solid: true }], // bas de dalle = row 6, surface row 13 → 7
    }
    expect(caveCeilingClearance(ok)).toEqual([])
  })

  it('plafond IMMERGÉ (aucun chemin d’air dessous) → non concerné', () => {
    // plafond solide au-dessus d'une SEULE surface d'eau qui est PLUS HAUTE que lui → rien en dessous
    const ok: LevelDef = {
      id: 'synth-plafond-immerge', name: 't', biome: 'plage', widthTiles: 20, spawns: [], platforms: [],
      rockBands: [{ x: 4, y: 10, w: 8, h: 3, solid: true }], // bas row 12, aucune surface sous row 12
      hazards: [{ kind: 'water', x: 4, w: 8, top: 9, h: 6, water: 'basin' }], // surface row 9 (au-dessus)
    }
    expect(caveCeilingClearance(ok)).toEqual([])
  })

  it('un niveau au moins pose une GROTTE NOYÉE (lac en U sous toit de roche + coffre au fond)', () => {
    const id = Object.keys(LEVEL_MODULE_KINDS).find((k) => LEVEL_MODULE_KINDS[k]!.includes('grotte-noyee'))
    expect(id, 'aucune grotte noyée générée').toBeDefined()
    const lvl = LEVELS[id!]!
    // cuve marine + plafond de roche SOLIDE (toit + tunnel immergé) + coffre au fond, tout jouable
    expect((lvl.hazards ?? []).some((h) => h.kind === 'water' && h.water === 'basin')).toBe(true)
    expect((lvl.rockBands ?? []).some((r) => r.solid)).toBe(true)
    expect((lvl.props ?? []).some((p) => p.kind === 'coffre')).toBe(true)
    expect(unreachableChests(lvl), `${id}: coffre de plongée injoignable`).toEqual([])
    expect(deadEndSurfaces(lvl), `${id}: piège sans retour`).toEqual([])
    expect(unlevelWaterBanks(lvl)).toEqual([])
    expect(suspendedWaterBanks(lvl)).toEqual([])
    expect(caveCeilingClearance(lvl)).toEqual([])
  })

  it('un niveau au moins pose des PASSERELLES EN ZIGZAG (jouable : atteignable, sauts francs, pas de piège)', () => {
    const ids = Object.keys(LEVEL_MODULE_KINDS).filter((k) => LEVEL_MODULE_KINDS[k]!.includes('passerelles-zigzag'))
    expect(ids.length, 'aucune passerelle zigzag générée').toBeGreaterThan(0)
    for (const id of ids) {
      const lvl = LEVELS[id]!
      expect(unreachablePlatforms(lvl), `${id}: passerelle injoignable`).toEqual([])
      expect(oversizedGaps(lvl), `${id}: saut de passerelle infranchissable`).toEqual([])
      expect(deadEndSurfaces(lvl), `${id}: piège sans retour`).toEqual([])
    }
  })

  it('passerelles flottantes SYNTHÉTIQUES : montée alternée franchissable + chute mortelle (pas de softlock)', () => {
    // reproduit la géométrie du motif : deux colonnes (xL=3, xR=8), +2 rangées / palier, écart 2 tuiles,
    // vide dessous (chute mortelle). Départ en bas, sortie au sommet → tout atteignable, aucun coincement.
    const zz: LevelDef = {
      id: 'synth-zigzag', name: 't', biome: 'plaine', widthTiles: 20, heightTiles: 22, spawns: [],
      start: { x: 1, y: 17 }, exit: { x: 16, y: 7 },
      platforms: [
        { x: 0, y: 17, w: 3 }, // berge d'entrée (alt bas)
        { x: 3, y: 17, w: 3 }, { x: 8, y: 15, w: 3 }, { x: 3, y: 13, w: 3 }, { x: 8, y: 11, w: 3 }, { x: 3, y: 9, w: 3 }, { x: 8, y: 7, w: 8 },
      ],
      gaps: [{ x: 3, w: 3 }, { x: 6, w: 3 }, { x: 9, w: 3 }, { x: 12, w: 3 }, { x: 15, w: 3 }],
    }
    expect(unreachablePlatforms(zz)).toEqual([])
    expect(oversizedGaps(zz)).toEqual([])
    expect(deadEndSurfaces(zz)).toEqual([])
  })
})

// ─── REFONTE DES MOTIFS (retour joueur) : eau = vrai PASSAGE, chaînes verticales variées, etc. ────
// On verrouille que les NOUVEAUX motifs sont bien générés ET jouables (atteignables, sauts francs,
// pas de piège, cuves fermées à bancs égaux, plafonds de grotte dégagés).
describe('refonte des motifs — eau-passage, plongeoir, puits, chaînes verticales variées', () => {
  const kindsOfLevel = (id: string): string[] => LEVEL_MODULE_KINDS[id] ?? []
  const levelsWith = (kind: string) => Object.keys(LEVEL_MODULE_KINDS).filter((id) => kindsOfLevel(id).includes(kind))
  const playable = (id: string) => {
    const lvl = LEVELS[id]!
    expect(unreachablePlatforms(lvl), `${id}: plateforme injoignable`).toEqual([])
    expect(unreachableChests(lvl), `${id}: coffre injoignable`).toEqual([])
    expect(oversizedGaps(lvl), `${id}: saut infranchissable`).toEqual([])
    expect(deadEndSurfaces(lvl), `${id}: piège sans retour`).toEqual([])
    expect(unlevelWaterBanks(lvl), `${id}: rebords désaxés`).toEqual([])
    expect(suspendedWaterBanks(lvl), `${id}: eau suspendue`).toEqual([])
    expect(caveCeilingClearance(lvl), `${id}: plafond de grotte trop bas`).toEqual([])
  }

  it('les nouveaux motifs d’EAU-PASSAGE sont générés (plongeoir, puits, cascade-bassin, boyau immergé)', () => {
    for (const k of ['plongeoir', 'puits', 'cascade-bassin', 'boyau-immerge']) {
      const ids = levelsWith(k)
      expect(ids.length, `${k} jamais généré`).toBeGreaterThan(0)
      for (const id of ids) playable(id)
    }
  })

  it('le BOYAU IMMERGÉ pose une cuve marine à paroi OUVERTE (openSide) — vrai passage à la nage', () => {
    const ids = levelsWith('boyau-immerge')
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      const lvl = LEVELS[id]!
      expect((lvl.hazards ?? []).some((h) => h.kind === 'water' && h.water === 'basin' && h.openSide), `${id}: pas de cuve ouverte`).toBe(true)
      // plafond de roche IMMERGÉ (on nage dessous) + rebords non suspendus (banc de sortie à niveau)
      expect((lvl.rockBands ?? []).some((r) => r.solid), `${id}: pas de plafond immergé`).toBe(true)
      expect(suspendedWaterBanks(lvl), `${id}: cuve ouverte suspendue`).toEqual([])
    }
  })

  it('ITEM 1 — GROTTE DE DÉPART souterraine générée (bassin immergé + toit de roche) et jouable', () => {
    const ids = levelsWith('grotte-depart')
    expect(ids.length, 'aucune grotte de départ générée').toBeGreaterThan(0)
    for (const id of ids) {
      const lvl = LEVELS[id]!
      expect((lvl.hazards ?? []).some((h) => h.kind === 'water' && h.water === 'basin'), `${id}: pas de bassin de nage`).toBe(true)
      expect((lvl.rockBands ?? []).some((r) => r.solid), `${id}: pas de roche solide (grotte fermée)`).toBe(true)
      playable(id)
    }
  })

  it('ITEM 6 — chaînes verticales variées générées (échelle-trou-échelle, échelle-zigzag, échelles décalées)', () => {
    for (const k of ['echelle-trou-echelle', 'echelle-zigzag', 'echelles-decalees']) {
      const ids = levelsWith(k)
      expect(ids.length, `${k} jamais généré`).toBeGreaterThan(0)
      for (const id of ids) playable(id)
    }
  })

  it('ITEM 8 — les DEUX variantes de passerelles flottantes existent : full trou ET full sol', () => {
    expect(levelsWith('passerelles-zigzag').length, 'variante full-trou absente').toBeGreaterThan(0)
    expect(levelsWith('passerelles-plein').length, 'variante full-sol absente').toBeGreaterThan(0)
    for (const id of levelsWith('passerelles-plein')) playable(id)
  })

  it('ITEM 7 — ZIGZAG dès le tout début du jeu (plaine-1 ouvre sur un zigzag)', () => {
    expect(kindsOfLevel('plaine-1'), 'plaine-1 sans zigzag d’ouverture').toContain('zigzag')
  })

  it('ITEM 10 — plaine-1/2/3 (Prairie/Champs/Vallon) ont des signatures de motifs DISTINCTES', () => {
    const a = kindsOfLevel('plaine-1').join(',')
    const b = kindsOfLevel('plaine-2').join(',')
    const c = kindsOfLevel('plaine-3').join(',')
    expect(a).not.toBe(b)
    expect(b).not.toBe(c)
    expect(a).not.toBe(c)
  })

  it('ITEM 11 — maps de hauteurs VARIÉES (plusieurs hauteurs distinctes, certaines nettement plus hautes)', () => {
    const heights = Object.values(LEVELS).map((l) => l.heightTiles ?? 16)
    const distinct = new Set(heights)
    expect(distinct.size, 'hauteurs trop uniformes').toBeGreaterThanOrEqual(8)
    expect(Math.max(...heights), 'aucune map vraiment haute').toBeGreaterThanOrEqual(30)
  })

  it('ITEM 12 — arènes de boss PLUS GRANDES avec PLUS de plateformes (toutes atteignables)', () => {
    const arenas = Object.values(LEVELS).filter((l) => l.boss)
    expect(arenas.length).toBe(9)
    for (const a of arenas) {
      expect(a.platforms.length, `${a.id}: trop peu de plateformes`).toBeGreaterThanOrEqual(6)
      expect(a.widthTiles, `${a.id}: arène trop petite`).toBeGreaterThanOrEqual(50)
      expect(unreachablePlatforms(a), `${a.id}: plateforme d’arène injoignable`).toEqual([])
    }
  })
})

// ─── R168 — NIVEAUX PLUS LONGS + ÉCHELLE-DESCENTE PIÉGÉE + VARIANTES DE CASCADES ─────────────────
describe('R168 — niveaux plus longs, échelle-descente piégée, cascades variées, plongeoir « saut de la foi »', () => {
  const kindsOfLevel = (id: string): string[] => LEVEL_MODULE_KINDS[id] ?? []
  const levelsWith = (kind: string) => Object.keys(LEVEL_MODULE_KINDS).filter((id) => kindsOfLevel(id).includes(kind))
  const playable = (id: string) => {
    const lvl = LEVELS[id]!
    expect(unreachablePlatforms(lvl), `${id}: plateforme injoignable`).toEqual([])
    expect(unreachableChests(lvl), `${id}: coffre injoignable`).toEqual([])
    expect(oversizedGaps(lvl), `${id}: saut infranchissable`).toEqual([])
    expect(deadEndSurfaces(lvl), `${id}: piège sans retour`).toEqual([])
    expect(unlevelWaterBanks(lvl), `${id}: rebords désaxés`).toEqual([])
    expect(suspendedWaterBanks(lvl), `${id}: eau suspendue`).toEqual([])
    expect(caveCeilingClearance(lvl), `${id}: plafond de grotte trop bas`).toEqual([])
  }

  it('NIVEAUX PLUS LONGS : largeur moyenne nettement relevée + progression (early < late)', () => {
    const ws = Object.values(LEVELS).filter((l) => !l.boss && l.id !== 'epave-1').map((l) => l.widthTiles)
    const avg = ws.reduce((a, b) => a + b, 0) / ws.length
    expect(avg, `largeur moyenne = ${avg.toFixed(0)}`).toBeGreaterThan(220) // avant ~179
    // PROGRESSION dans la plaine : le 1er terrain est plus court que le dernier
    expect(LEVELS['plaine-1']!.widthTiles).toBeLessThan(LEVELS['plaine-7']!.widthTiles)
  })

  it('ÉCHELLE-DESCENTE PIÉGÉE générée et jouable (échelle + trou mortel + passerelle coiffée de roche)', () => {
    const ids = levelsWith('echelle-descente-piegee')
    expect(ids.length, 'echelle-descente-piegee jamais générée').toBeGreaterThan(0)
    for (const id of ids) {
      const lvl = LEVELS[id]!
      expect((lvl.ladders ?? []).length, `${id}: pas d’échelle`).toBeGreaterThan(0)
      expect((lvl.bridges ?? []).length, `${id}: pas de passerelle`).toBeGreaterThan(0)
      expect((lvl.rockBands ?? []).some((r) => r.solid), `${id}: pas de roche coiffante`).toBe(true)
      expect((lvl.gaps ?? []).length, `${id}: pas de trou mortel`).toBeGreaterThan(0)
      playable(id)
    }
  })

  it('les 5 VARIANTES DE CASCADES sont générées et jouables', () => {
    for (const k of ['cascade-grotte', 'cascade-trou', 'cascade-large', 'cascade-trouee', 'cascade-cul-de-sac']) {
      const ids = levelsWith(k)
      expect(ids.length, `${k} jamais générée`).toBeGreaterThan(0)
      for (const id of ids) playable(id)
    }
  })

  it('CASCADE → GROTTE : cascade remontable + grotte gardée par de la ROCHE SOLIDE au-dessus ET en-dessous + coffre', () => {
    const id = levelsWith('cascade-grotte')[0]!
    const lvl = LEVELS[id]!
    // cascade remontable (seul accès à la grotte) + coffre au fond
    expect((lvl.hazards ?? []).some((h) => h.kind === 'water' && h.water === 'cascade')).toBe(true)
    expect((lvl.props ?? []).some((p) => p.kind === 'coffre')).toBe(true)
    // DEUX pans de roche SOLIDE (plafond au-dessus + falaise en-dessous) → la grotte n'est atteignable
    // qu'en grimpant la cascade (rien de traversable : la pierre est pleine).
    expect((lvl.rockBands ?? []).filter((r) => r.solid).length, `${id}: il faut de la roche solide dessus ET dessous`).toBeGreaterThanOrEqual(2)
    playable(id)
  })

  it('CASCADE LARGE : rideau large (≥5 colonnes) qui alimente un bassin, SANS trou mortel sous la chute', () => {
    const id = levelsWith('cascade-large')[0]!
    const lvl = LEVELS[id]!
    const wide = (lvl.hazards ?? []).find((h) => h.kind === 'water' && h.water === 'cascade' && h.w >= 5)
    expect(wide, `${id}: pas de rideau large`).toBeDefined()
    expect(oversizedGaps(lvl), `${id}: le rideau large ne doit PAS créer de trou infranchissable`).toEqual([])
  })

  it('PLONGEOIR « saut de la foi » : perchoir TRÈS HAUT (échelle) + PANNEAU + lac ALIGNÉ dessous', () => {
    const ids = levelsWith('plongeoir')
    expect(ids.length, 'plongeoir jamais généré').toBeGreaterThan(0)
    for (const id of ids) {
      const lvl = LEVELS[id]!
      expect((lvl.signs ?? []).length, `${id}: pas de panneau`).toBeGreaterThan(0)
      expect((lvl.ladders ?? []).length, `${id}: pas d’échelle de plongeoir`).toBeGreaterThan(0)
      // le lac (bassin) est bien présent sous le point de saut
      expect((lvl.hazards ?? []).some((h) => h.kind === 'water' && h.water === 'basin'), `${id}: pas de lac`).toBe(true)
      playable(id)
    }
  })

  it('les maps montent PLUS HAUT (les nouveaux perchoirs/tours de cascade créent des mondes hauts)', () => {
    const maxH = Math.max(...Object.values(LEVELS).map((l) => l.heightTiles ?? 16))
    expect(maxH, 'aucune map vraiment haute').toBeGreaterThanOrEqual(30)
  })
})

// ─── R171 — VARIÉTÉ DES DÉPARTS + NOUVEAUX MOTIFS (lac→cascade→plateau, verticaux, grotte tôt) ────
describe('R171 — départs variés, lac→cascade→plateau, motifs verticaux, grotte sous-marine tôt', () => {
  const kindsOfLevel = (id: string): string[] => LEVEL_MODULE_KINDS[id] ?? []
  const levelsWith = (kind: string) => Object.keys(LEVEL_MODULE_KINDS).filter((id) => kindsOfLevel(id).includes(kind))
  const playable = (id: string) => {
    const lvl = LEVELS[id]!
    expect(unreachablePlatforms(lvl), `${id}: plateforme injoignable`).toEqual([])
    expect(unreachableChests(lvl), `${id}: coffre injoignable`).toEqual([])
    expect(oversizedGaps(lvl), `${id}: saut infranchissable`).toEqual([])
    expect(deadEndSurfaces(lvl), `${id}: piège sans retour`).toEqual([])
    expect(unlevelWaterBanks(lvl), `${id}: rebords désaxés`).toEqual([])
    expect(suspendedWaterBanks(lvl), `${id}: eau suspendue`).toEqual([])
    expect(caveCeilingClearance(lvl), `${id}: plafond de grotte trop bas`).toEqual([])
    expect(startExitProblems(lvl), `${id}: départ/sortie`).toEqual([])
  }
  const terrains = Object.values(LEVELS).filter((l) => !l.boss && l.id !== 'epave-1' && l.start)

  it('DÉPARTS VARIÉS : certains niveaux démarrent AU SOL, d’autres SURÉLEVÉS (plus de départ uniforme)', () => {
    let ground = 0, high = 0
    for (const l of terrains) {
      const alt = groundRowFor(l.heightTiles) - l.start!.y
      if (alt <= 0) ground++
      else if (alt >= 3) high++
    }
    expect(ground, 'aucun départ au sol').toBeGreaterThan(0)
    expect(high, 'aucun départ surélevé').toBeGreaterThan(0)
  })

  it('ZONE DE SPAWN DÉGAGÉE : jamais de monstre collé au départ ni de départ DANS l’eau', () => {
    for (const l of terrains) {
      const sx = l.start!.x
      // aucun spawn (terrestre ou aérien) à moins de 6 tuiles du point d’apparition
      for (const s of l.spawns) {
        expect(Math.abs(s.x - sx), `${l.id}: monstre ${s.monsterId} collé au départ`).toBeGreaterThanOrEqual(6)
      }
      // la colonne de départ n’est jamais dans une cuve marine / lave (surface d’eau)
      const inWater = (l.hazards ?? []).some((h) => h.kind === 'water' && (h.water === 'basin' || h.water === 'lave') && sx >= h.x && sx < h.x + h.w)
      expect(inWater, `${l.id}: départ dans l’eau`).toBe(false)
    }
  })

  it('LAC → CASCADE → PLATEAU : lac marine + cascade remontable + plateau haut, jouable', () => {
    const ids = levelsWith('lac-cascade-plateau')
    expect(ids.length, 'lac-cascade-plateau jamais généré').toBeGreaterThan(0)
    for (const id of ids) {
      const lvl = LEVELS[id]!
      expect((lvl.hazards ?? []).some((h) => h.kind === 'water' && h.water === 'basin'), `${id}: pas de lac`).toBe(true)
      expect((lvl.hazards ?? []).some((h) => h.kind === 'water' && h.water === 'cascade'), `${id}: pas de cascade`).toBe(true)
      playable(id)
    }
  })

  it('MOTIFS VERTICAUX : escalier à grands pas ET échelles successives générés et jouables', () => {
    for (const k of ['escalier-saut', 'echelles-successives']) {
      const ids = levelsWith(k)
      expect(ids.length, `${k} jamais généré`).toBeGreaterThan(0)
      for (const id of ids) playable(id)
    }
  })

  it('GROTTE SOUS-MARINE TÔT : une grotte noyée / lac en U apparaît dès les premiers terrains (plaine/forêt)', () => {
    const early = ['plaine-1', 'plaine-2', 'plaine-3', 'plaine-4', 'plaine-5', 'plaine-6', 'foret-1', 'foret-2', 'foret-3', 'foret-4']
    const hits = early.filter((id) => kindsOfLevel(id).some((k) => k === 'grotte-noyee' || k === 'lac-en-u'))
    expect(hits.length, 'aucune grotte sous-marine dans les premiers niveaux').toBeGreaterThan(0)
    for (const id of hits) playable(id)
  })

  it('PLONGEOIR : panneau + lac dessous, jouable ; et un perchoir TRÈS HAUT (≥ 9 rangées) existe bien', () => {
    const ids = levelsWith('plongeoir')
    expect(ids.length, 'plongeoir jamais généré').toBeGreaterThan(0)
    // hauteur max du perchoir au-dessus de son lac, sur l’ensemble des plongeoirs (montée échelle → très haut)
    let maxPerch = 0
    for (const id of ids) {
      const lvl = LEVELS[id]!
      expect((lvl.signs ?? []).length, `${id}: pas de panneau télégraphe`).toBeGreaterThan(0)
      expect((lvl.hazards ?? []).some((h) => h.kind === 'water' && h.water === 'basin'), `${id}: pas de lac sous le plongeoir`).toBe(true)
      const basins = (lvl.hazards ?? []).filter((h) => h.kind === 'water' && h.water === 'basin')
      for (const sg of lvl.signs ?? []) for (const b of basins) {
        if (sg.x >= b.x - 1 && sg.x <= b.x + b.w) maxPerch = Math.max(maxPerch, (b.top ?? 0) - sg.y)
      }
      playable(id)
    }
    // au moins un plongeoir « saut de la foi » culmine bien plus haut que l’ancien perchoir (+7)
    expect(maxPerch, `perchoir max = ${maxPerch}`).toBeGreaterThanOrEqual(9)
  })
})

// ─── R180 — CASCADES REMONTABLES ≥ 4× LA TAILLE DU PANDA (retour joueur : trop courtes = chiantes) ─
// Une cascade doit se GRIMPER, pas se franchir d'un saut : sa dénivelée jouable doit atteindre AU
// MOINS MIN_CASCADE_TILES rangées (= 4× le panda, ≈ 2 tuiles → 8). Verrouillé sur tous les niveaux.
describe('R180 — cascades remontables assez hautes (≥ 4× le panda)', () => {
  it(`MIN_CASCADE_TILES ≥ 8 rangées (4× la taille du panda ≈ 2 tuiles)`, () => {
    expect(MIN_CASCADE_TILES).toBeGreaterThanOrEqual(8)
  })

  for (const id of MODULAR_IDS) {
    it(`${id} — aucune cascade plus courte que ${MIN_CASCADE_TILES} rangées`, () => {
      const bad = shortCascades(LEVELS[id]!, MIN_CASCADE_TILES)
      expect(bad, `${id}: cascades trop courtes → ${JSON.stringify(bad)}`).toEqual([])
    })
  }

  it('cascade synthétique TROP COURTE (berge à 3 rangées sous le sommet) → rejetée', () => {
    const bad: LevelDef = {
      id: 'synth-cascade-courte', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 0, y: 10, w: 5 }], // berge bordant la colonne (x+w=5=cascade.x), 3 rangées SOUS le sommet
      hazards: [{ kind: 'water', x: 5, w: 2, top: 7, h: 20, water: 'cascade' }],
    }
    const b = shortCascades(bad, MIN_CASCADE_TILES)
    expect(b).toHaveLength(1)
    expect(b[0]!.climb).toBe(3)
  })

  it('cascade synthétique assez HAUTE (berge à 9 rangées sous le sommet) → acceptée', () => {
    const ok: LevelDef = {
      id: 'synth-cascade-haute', name: 't', biome: 'plaine', widthTiles: 30, spawns: [],
      platforms: [{ x: 0, y: 16, w: 5 }], // berge 9 rangées sous le sommet → climb 9 ≥ 8
      hazards: [{ kind: 'water', x: 5, w: 2, top: 7, h: 20, water: 'cascade' }],
    }
    expect(shortCascades(ok, MIN_CASCADE_TILES)).toEqual([])
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
