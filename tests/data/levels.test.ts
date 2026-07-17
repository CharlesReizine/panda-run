import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { MONSTERS } from '../../src/data/monsters'
import { PROPS } from '../../src/data/props'
import { WORLD_NODES, WORLD_EDGES, START_NODE, isNodeUnlocked } from '../../src/data/worldmap'

describe('niveaux et carte', () => {
  it('10 niveaux dont 2 boss', () => {
    const all = Object.values(LEVELS)
    expect(all).toHaveLength(10)
    expect(all.filter((l) => l.boss)).toHaveLength(2)
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
        const onPlatform = l.platforms.some((p) => c.x >= p.x && c.x < p.x + p.w && c.y === p.y - 1)
        expect(onPlatform, `${l.id}: coffre x=${c.x} y=${c.y}`).toBe(true)
      }
    }
  })

  it('chaque nœud de niveau pointe un LevelDef, chaque edge relie des nœuds connus', () => {
    const ids = new Set(WORLD_NODES.map((n) => n.id))
    for (const n of WORLD_NODES) if (n.levelId) expect(LEVELS[n.levelId], n.id).toBeDefined()
    for (const [a, b] of WORLD_EDGES) { expect(ids.has(a)).toBe(true); expect(ids.has(b)).toBe(true) }
  })

  it('déblocage : départ ouvert, suivant fermé puis ouvert après complétion', () => {
    expect(isNodeUnlocked(START_NODE, [])).toBe(true)
    expect(isNodeUnlocked('plaine-1', [])).toBe(true) // adjacent à la ville de départ
    expect(isNodeUnlocked('plaine-2', [])).toBe(false)
    expect(isNodeUnlocked('plaine-2', ['zone1-1'])).toBe(true)
  })

  it('déblocage multi-hop : plaine-1 → plaine-2 → foret-2 → boss-1 → morroc → desert-1', () => {
    const chain = ['zone1-1', 'zone1-2', 'zone1-4', 'zone1-boss']
    expect(isNodeUnlocked('desert-1', chain)).toBe(true)
    expect(isNodeUnlocked('desert-1', ['zone1-1', 'zone1-2', 'zone1-4'])).toBe(false) // sans zone1-boss, morroc inatteignable
  })
})
