import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { serialize, deserialize, save, load } from '../../src/core/save'
import { START_NODE } from '../../src/data/worldmap'

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size },
  } as Storage
}

describe('save', () => {
  it('newPlayer a les valeurs de départ', () => {
    const p = newPlayer('Panda')
    expect(p.classId).toBe('novice')
    expect(p.level).toBe(1)
    expect(p.equippedSkills).toHaveLength(4)
  })

  it('round-trip serialize/deserialize', () => {
    const p = newPlayer('Panda')
    p.gold = 42
    expect(deserialize(serialize(p))).toEqual(p)
  })

  it('rejette une version inconnue', () => {
    expect(() => deserialize('{"version":99,"player":{}}')).toThrow(/version/i)
  })

  it('migre une save v1 → v3 (materials + skillLevels depuis unlockedSkills)', () => {
    const p = newPlayer('Panda')
    const legacy: Record<string, unknown> = { ...p }
    delete legacy.materials
    delete legacy.skillLevels
    legacy.unlockedSkills = ['calin-brutal', 'taillade']
    const loaded = deserialize(JSON.stringify({ version: 1, player: legacy }))
    expect(loaded.materials).toEqual({})
    expect(loaded.skillLevels).toEqual({ 'calin-brutal': 1, taillade: 1 })
    expect((loaded as unknown as Record<string, unknown>).unlockedSkills).toBeUndefined()
  })

  it('migre une save v3 → v4 (monstersKilled + quests par défaut)', () => {
    const p = newPlayer('Panda')
    const legacy: Record<string, unknown> = { ...p }
    delete legacy.monstersKilled
    delete legacy.quests
    const loaded = deserialize(JSON.stringify({ version: 3, player: legacy }))
    expect(loaded.monstersKilled).toBe(0)
    expect(loaded.quests).toEqual({})
  })

  it('migre une save v4 → v5 (currentNode par défaut)', () => {
    const p = newPlayer('Panda')
    const legacy: Record<string, unknown> = { ...p }
    delete legacy.currentNode
    const loaded = deserialize(JSON.stringify({ version: 4, player: legacy }))
    expect(loaded.currentNode).toBe(START_NODE)
  })

  it('migre une save v5 → v6 (statPoints + allocated par défaut)', () => {
    const p = newPlayer('Panda')
    const legacy: Record<string, unknown> = { ...p }
    delete legacy.statPoints
    delete legacy.allocated
    const loaded = deserialize(JSON.stringify({ version: 5, player: legacy }))
    expect(loaded.statPoints).toBe(0)
    expect(loaded.allocated).toEqual({ str: 0, agi: 0, int: 0 })
  })

  it('migre une save v6 → v7 (upgrades par défaut)', () => {
    const p = newPlayer('Panda')
    const legacy: Record<string, unknown> = { ...p }
    delete legacy.upgrades
    const loaded = deserialize(JSON.stringify({ version: 6, player: legacy }))
    expect(loaded.upgrades).toEqual({})
  })

  it('save/load via storage', () => {
    const s = fakeStorage()
    const p = newPlayer('Panda')
    save(p, s)
    expect(load(s)).toEqual(p)
  })

  it('load renvoie null sans sauvegarde', () => {
    expect(load(fakeStorage())).toBeNull()
  })
})
