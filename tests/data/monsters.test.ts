import { describe, it, expect } from 'vitest'
import { MONSTERS } from '../../src/data/monsters'
import { ITEMS } from '../../src/data/items'
import { MATERIALS } from '../../src/data/materials'
import { LEVELS } from '../../src/data/levels'

describe('données monstres/items', () => {
  it('les drops item pointent des items existants', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const d of m.drops) {
        if (d.kind === 'item') expect(ITEMS[d.itemId!], `${m.id}:${d.itemId}`).toBeDefined()
      }
    }
  })

  it('les drops material pointent des matériaux existants', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const d of m.drops) {
        if (d.kind === 'material') expect(MATERIALS[d.materialId!], `${m.id}:${d.materialId}`).toBeDefined()
      }
    }
  })

  it('exactement 10 boss (6 historiques + 4 nouveaux du monde carte A)', () => {
    expect(Object.values(MONSTERS).filter((m) => m.boss)).toHaveLength(10)
  })

  it('chaque MVP droppe au moins un item épique ou légendaire, sans être un boss', () => {
    const mvps = Object.values(MONSTERS).filter((m) => m.mvp)
    expect(mvps.length).toBeGreaterThanOrEqual(4)
    for (const m of mvps) {
      expect(m.boss, `${m.id} ne doit pas être un boss`).toBeFalsy()
      const hasRare = m.drops.some(
        (d) => d.kind === 'item' && ['epique', 'legendaire'].includes(ITEMS[d.itemId!]?.rarity ?? 'commun'),
      )
      expect(hasRare, `${m.id} doit droper un item épique/légendaire`).toBe(true)
    }
  })
})

describe('mobs de granularité (audit lot 3)', () => {
  // 7 mobs ajoutés pour combler les trous de niveau, épinglés à un terrain dont le niveau calibré
  // vise la bande à combler (cf. PINNED_SPAWNS dans levels.ts). niveau attendu = niveau calibré.
  const NEW_MOBS: { id: string; level: number; biome: string }[] = [
    { id: 'serpent-des-sables', level: 17, biome: 'desert' },
    { id: 'elementaire-de-sable', level: 21, biome: 'desert' },
    { id: 'djinn-mineur', level: 25, biome: 'desert' },
    { id: 'loup-des-neiges', level: 32, biome: 'montagne' },
    { id: 'liche-mineure', level: 32, biome: 'cimetiere' },
    { id: 'kraken-juvenile', level: 41, biome: 'plage' },
    { id: 'cerbere', level: 44, biome: 'enfer' },
  ]

  it('les 7 nouveaux mobs existent avec le niveau calibré attendu', () => {
    for (const { id, level } of NEW_MOBS) {
      const m = MONSTERS[id]
      expect(m, `${id} doit exister`).toBeDefined()
      expect(m!.level, `${id} niveau`).toBe(level)
    }
  })

  it('le kraken juvénile est aquatique', () => {
    expect(MONSTERS['kraken-juvenile']!.aquatic).toBe(true)
  })

  it('chaque nouveau mob apparaît MAJORITAIREMENT dans son biome (débordement toléré)', () => {
    // Le débordement inter-biome est autorisé (et même souhaité pour la variété) tant qu'il reste
    // thématiquement cohérent — mais la MAJORITÉ des apparitions doit rester le biome d'origine.
    for (const { id, biome } of NEW_MOBS) {
      const hosts = Object.values(LEVELS).filter((l) => l.spawns.some((s) => s.monsterId === id))
      expect(hosts.length, `${id} doit spawner quelque part`).toBeGreaterThan(0)
      const inBiome = hosts.filter((l) => l.biome === biome).length
      expect(inBiome, `${id} doit spawner dans son biome ${biome}`).toBeGreaterThan(0)
      expect(inBiome / hosts.length, `${id} majoritairement dans ${biome}`).toBeGreaterThanOrEqual(0.5)
    }
  })
})
