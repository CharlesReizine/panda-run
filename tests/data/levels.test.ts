import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { MONSTERS } from '../../src/data/monsters'
import { PROPS } from '../../src/data/props'
import { WORLD_NODES, WORLD_EDGES, START_NODE, isNodeUnlocked, neighborsOf } from '../../src/data/worldmap'
import { maxJumpTiles, MIN_LADDER_TILES, groundRowFor } from '../../src/core/platforming'
import {
  unreachablePlatforms, unreachableChests, unlevelWaterBanks, suspendedWaterBanks, caveCeilingClearance,
} from '../../src/core/level-validator'
import { breathMaxMs, BREATH_BASE_MS, BREATH_PER_LEVEL_MS } from '../../src/core/breath'

describe('niveaux et carte', () => {
  it('58 niveaux dont 9 boss (monde carte A : 48 terrains + Épave sous-marine + 9 arènes)', () => {
    const all = Object.values(LEVELS)
    expect(all).toHaveLength(58)
    expect(all.filter((l) => l.boss)).toHaveLength(9)
  })

  // atteignabilité au sens PHYSIQUE : saut de proche en proche OU montée d'échelle. Les paliers
  // de sommet d'échelle (rangée 5) ne sont joignables qu'en grimpant, pas au saut — d'où le
  // validateur qui modélise l'échelle comme connecteur vertical (voir level-validator.ts).
  it('aucune plateforme inatteignable (saut de proche en proche ou échelle)', () => {
    expect(maxJumpTiles()).toBeGreaterThan(3) // le saut couvre au moins 3 tuiles
    for (const l of Object.values(LEVELS)) {
      const bad = unreachablePlatforms(l)
      expect(bad, `${l.id}: plateformes inatteignables → ${JSON.stringify(bad)}`).toEqual([])
    }
  })

  it('chaque échelle fait au moins 2× la hauteur de saut max (h >= MIN_LADDER_TILES)', () => {
    expect(MIN_LADDER_TILES).toBeGreaterThanOrEqual(Math.ceil(2 * maxJumpTiles()))
    for (const l of Object.values(LEVELS)) {
      for (const ld of l.ladders ?? []) {
        expect(ld.h, `${l.id}: échelle x=${ld.x} h=${ld.h} < ${MIN_LADDER_TILES}`).toBeGreaterThanOrEqual(MIN_LADDER_TILES)
      }
    }
  })

  it('spawns et boss pointent des monstres existants', () => {
    for (const l of Object.values(LEVELS)) {
      for (const s of l.spawns) expect(MONSTERS[s.monsterId], `${l.id}:${s.monsterId}`).toBeDefined()
      if (l.boss) expect(MONSTERS[l.boss]!.boss).toBe(true)
    }
  })

  it('pas de props sur les niveaux boss ; 2-4 props au sol + ~1 coffre ailleurs, kinds connus', () => {
    for (const l of Object.values(LEVELS)) {
      if (l.boss) {
        expect(l.props ?? []).toHaveLength(0)
        continue
      }
      // Épave : niveau bespoke tout-immergé — aucune végétation de sol, mais BEAUCOUP de coffres de
      // plongée. Il échappe au quota générique (2-4 props sol + 1-3 coffres) et a son propre test.
      if (l.id === 'epave-1') continue
      expect(l.props, l.id).toBeDefined()
      const ground = l.props!.filter((p) => p.kind !== 'coffre')
      const chests = l.props!.filter((p) => p.kind === 'coffre')
      expect(ground.length, l.id).toBeGreaterThanOrEqual(2)
      expect(ground.length, l.id).toBeLessThanOrEqual(4)
      expect(chests.length, l.id).toBeGreaterThanOrEqual(1)
      expect(chests.length, l.id).toBeLessThanOrEqual(3)
      for (const p of l.props!) expect(PROPS[p.kind], `${l.id}:${p.kind}`).toBeDefined()
    }
  })

  it('les coffres sont posés sur une plateforme existante (x dans [p.x, p.x+p.w), y = p.y - 1)', () => {
    for (const l of Object.values(LEVELS)) {
      const chests = (l.props ?? []).filter((p) => p.kind === 'coffre')
      for (const c of chests) {
        const onGround = c.y === undefined // posé au sol
        const onPlatform = l.platforms.some((p) => c.x >= p.x && c.x < p.x + p.w && c.y === p.y - 1)
        expect(onGround || onPlatform, `${l.id}: coffre x=${c.x} y=${c.y}`).toBe(true)
      }
    }
  })

  it('chaque nœud de niveau pointe un LevelDef, chaque edge relie des nœuds connus', () => {
    const ids = new Set(WORLD_NODES.map((n) => n.id))
    for (const n of WORLD_NODES) if (n.levelId) expect(LEVELS[n.levelId], n.id).toBeDefined()
    for (const [a, b] of WORLD_EDGES) { expect(ids.has(a)).toBe(true); expect(ids.has(b)).toBe(true) }
  })

  it('déblocage : départ ouvert (Prairie), suivant fermé puis ouvert après complétion', () => {
    expect(isNodeUnlocked(START_NODE, [])).toBe(true) // plaine-1 (Prairie)
    expect(isNodeUnlocked('plaine-2', [])).toBe(false) // gating : suivant fermé tant que Prairie non complétée
    expect(isNodeUnlocked('plaine-2', ['plaine-1'])).toBe(true) // ouvert après complétion de Prairie
    expect(isNodeUnlocked('plaine-3', [])).toBe(false)
    expect(isNodeUnlocked('plaine-3', ['plaine-1', 'plaine-2'])).toBe(true)
  })

  it('déblocage multi-hop : Prairie → plaines → Prontera, puis au-delà', () => {
    const toProntera = ['plaine-1', 'plaine-2', 'plaine-3', 'plaine-4', 'plaine-5']
    expect(isNodeUnlocked('prontera', toProntera)).toBe(true) // on atteint la ville juste après la plaine
    expect(isNodeUnlocked('prontera', ['plaine-1', 'plaine-2', 'plaine-3'])).toBe(false) // plaine incomplète → Prontera fermée
    const chain = [...toProntera, 'plaine-6', 'foret-1', 'plaine-7', 'foret-7']
    expect(isNodeUnlocked('desert-1', chain)).toBe(true)
    expect(isNodeUnlocked('desert-1', [...toProntera, 'plaine-6', 'foret-1', 'plaine-7'])).toBe(false) // sans foret-7, desert-1 inatteignable
  })
})

// ─── ÉPAVE : niveau bespoke ENTIÈREMENT SOUS-MARIN branché à gauche de la plage (Corail) ─────────
describe('niveau Épave (sous-marin)', () => {
  const epave = LEVELS['epave-1']!

  it('epave-1 existe, pointe un nœud « Épave » de type level à GAUCHE de Corail (plage-4)', () => {
    expect(epave).toBeDefined()
    const node = WORLD_NODES.find((n) => n.id === 'epave-1')!
    expect(node, 'nœud epave-1 absent de la carte').toBeDefined()
    expect(node.type).toBe('level')
    expect(node.levelId).toBe('epave-1')
    const corail = WORLD_NODES.find((n) => n.id === 'plage-4')!
    expect(node.x, 'Épave doit être à GAUCHE de Corail').toBeLessThan(corail.x)
  })

  it('epave-1 est atteignable depuis plage-4 (arête plage-4 ↔ epave-1)', () => {
    expect(neighborsOf('plage-4')).toContain('epave-1')
    expect(neighborsOf('epave-1')).toContain('plage-4')
    // débloqué dès que la branche plage est faite jusqu'à Corail (gating isNodeUnlocked existant)
    const done = ['plaine-1', 'plaine-2', 'plaine-3', 'plaine-4', 'plaine-5', 'plaine-6', 'foret-1',
      'plaine-7', 'foret-7', 'desert-1', 'desert-2', 'desert-3', 'desert-4', 'desert-7', 'jungle-1',
      'desert-8', 'desert-9', 'montagne-1', 'desert-10', 'plage-1', 'plage-2', 'plage-3', 'plage-4']
    expect(isNodeUnlocked('epave-1', done)).toBe(true)
    expect(isNodeUnlocked('epave-1', [])).toBe(false) // gating : fermé tant que la branche plage n'est pas faite
  })

  it('niveau TOUT-MARINE : une cuve marine couvre toute la largeur, aucune autre forme d’eau', () => {
    const waters = (epave.hazards ?? []).filter((h) => h.kind === 'water')
    expect(waters.length).toBeGreaterThan(0)
    expect(waters.every((h) => h.water === 'basin'), 'toute l’eau doit être marine').toBe(true)
    const full = waters.find((h) => h.x === 0 && h.w === epave.widthTiles)!
    expect(full, 'la cuve doit couvrir toute la largeur (tout immergé)').toBeDefined()
    expect(full.top).toBe(0) // eau jusqu’à la voûte → pas de surface d’air praticable
  })

  it('cuve FERMÉE à bancs égaux : aucun lac SUSPENDU, aucun rebord désaxé', () => {
    expect((epave.hazards ?? []).every((h) => h.kind !== 'water' || h.openSide === undefined), 'aucun bord ouvert').toBe(true)
    expect(suspendedWaterBanks(epave), 'eau suspendue').toEqual([])
    expect(unlevelWaterBanks(epave), 'rebords désaxés').toEqual([])
  })

  it('BEAUCOUP de coffres (récompenses de plongée), tous atteignables, aucun prop de sol', () => {
    const chests = (epave.props ?? []).filter((p) => p.kind === 'coffre')
    const ground = (epave.props ?? []).filter((p) => p.kind !== 'coffre')
    expect(chests.length, 'beaucoup de coffres attendus').toBeGreaterThanOrEqual(6)
    expect(ground.length, 'aucune végétation de sol dans l’épave').toBe(0)
    expect(unreachablePlatforms(epave), 'débris injoignables').toEqual([])
    expect(unreachableChests(epave), 'coffres injoignables').toEqual([])
    expect(caveCeilingClearance(epave), 'toit de roche trop bas').toEqual([])
  })

  it('mobs AQUATIQUES uniquement (crabe géant / méduse), qui ne se noient pas', () => {
    expect(epave.spawns.length).toBeGreaterThan(0)
    for (const s of epave.spawns) {
      const m = MONSTERS[s.monsterId]!
      expect(m, s.monsterId).toBeDefined()
      expect(m.aquatic, `${s.monsterId} n’est pas aquatique`).toBe(true)
    }
    expect(epave.spawns.some((s) => s.monsterId === 'crabe-geant')).toBe(true)
    expect(epave.spawns.some((s) => s.monsterId === 'meduse')).toBe(true)
  })

  it('POCHES D’AIR présentes et immergées (dans la cuve), de quoi enchaîner poche → coffre → poche', () => {
    const pockets = epave.airPockets ?? []
    expect(pockets.length, 'aucune poche d’air').toBeGreaterThanOrEqual(4)
    const water = (epave.hazards ?? []).find((h) => h.kind === 'water')!
    const groundRow = groundRowFor(epave.heightTiles)
    for (const p of pockets) {
      expect(p.x, 'poche hors largeur').toBeGreaterThanOrEqual(water.x)
      expect(p.x, 'poche hors largeur').toBeLessThan(water.x + water.w)
      expect(p.y, 'poche au-dessus de la ligne d’eau').toBeGreaterThanOrEqual(water.top ?? 0)
      expect(p.y, 'poche sous le fond').toBeLessThan(groundRow)
    }
  })
})

// ─── APNÉE liée au NIVEAU DU PERSO : 5000 + 250·niveau (cf. core/breath.ts) ──────────────────────
describe('apnée dynamique (souffle max lié au niveau du perso)', () => {
  it('breathMaxMs = 5000 + 250·niveau', () => {
    expect(BREATH_BASE_MS).toBe(5000)
    expect(BREATH_PER_LEVEL_MS).toBe(250)
    expect(breathMaxMs(1)).toBe(5250)
    expect(breathMaxMs(10)).toBe(7500)
    expect(breathMaxMs(48)).toBe(17000)
  })

  it('le souffle max croît strictement avec le niveau', () => {
    expect(breathMaxMs(20)).toBeGreaterThan(breathMaxMs(19))
    expect(breathMaxMs(50) - breathMaxMs(49)).toBe(BREATH_PER_LEVEL_MS)
  })
})

// ─── DÉBUT CHILL + DÉCLUSTERING (retour joueur build R186) ───────────────────────────────────────
// Le tout premier niveau (plaine-1) était injouable : nuées de corbeaux (Nv4, aériens piqueurs) en
// grappes, mobs collés. On garantit désormais : (1) plaine-1 ne contient QUE des mobs de CONTACT
// faibles (gloopy/fabre), aucun oiseau/chargeur ; (2) un espacement MINIMUM entre spawns terrestres/
// aériens sur TOUS les niveaux générés (plus de grappes). Les mobs AQUATIQUES (bancs en cuve d'eau,
// menace de nage) sont hors périmètre du déclustering — ils ne jalonnent pas le chemin.
const MIN_SPAWN_SPACING = 10
describe('début accessible + déclustering', () => {
  it('plaine-1 = uniquement gloopy/fabre de CONTACT, aucun corbeau ni aérien ni chargeur', () => {
    const l = LEVELS['plaine-1']!
    expect(l.spawns.length).toBeGreaterThan(0)
    for (const s of l.spawns) {
      const m = MONSTERS[s.monsterId]!
      expect(['gloopy', 'fabre'], `${s.monsterId} interdit en plaine-1`).toContain(s.monsterId)
      expect(m.behavior, `${s.monsterId} doit être de contact`).toBe('contact')
      expect(!!m.aerial, `${s.monsterId} ne doit pas être aérien`).toBe(false)
    }
    expect(l.spawns.some((s) => s.monsterId === 'corbeau'), 'aucun corbeau en plaine-1').toBe(false)
    // gloopy présent (le mob-école Nv1) ; fabre est l'apex de contact du niveau (lent, inoffensif).
    expect(l.spawns.some((s) => s.monsterId === 'gloopy')).toBe(true)
  })

  it('rampe aérienne : plaine-1 sans corbeau, plaine-2/3 en introduisent peu et ESPACÉS (aucune nuée)', () => {
    const crowsAt = (id: string) => LEVELS[id]!.spawns.filter((s) => s.monsterId === 'corbeau')
    expect(crowsAt('plaine-1').length, 'plaine-1 : zéro corbeau').toBe(0)
    for (const id of ['plaine-2', 'plaine-3']) {
      const crows = crowsAt(id).map((s) => s.x).sort((a, b) => a - b)
      expect(crows.length, `${id}: trop de corbeaux`).toBeLessThanOrEqual(4)
      // ESPACÉS : jamais deux corbeaux collés (pas de nuée piqueuse) — au moins la marge de déclustering.
      for (let i = 1; i < crows.length; i++) {
        expect(crows[i]! - crows[i - 1]!, `${id}: corbeaux en nuée`).toBeGreaterThanOrEqual(MIN_SPAWN_SPACING)
      }
    }
  })

  it('espacement ≥ 10 tuiles entre spawns terrestres/aériens sur tous les niveaux générés', () => {
    for (const l of Object.values(LEVELS)) {
      if (l.boss || l.id === 'epave-1') continue // arènes de boss + épave bespoke : hors générateur
      const sp = l.spawns.filter((s) => !MONSTERS[s.monsterId]?.aquatic).sort((a, b) => a.x - b.x)
      for (let i = 1; i < sp.length; i++) {
        expect(
          sp[i]!.x - sp[i - 1]!.x,
          `${l.id}: ${sp[i - 1]!.monsterId}@${sp[i - 1]!.x} & ${sp[i]!.monsterId}@${sp[i]!.x} collés`,
        ).toBeGreaterThanOrEqual(MIN_SPAWN_SPACING)
      }
    }
  })
})
