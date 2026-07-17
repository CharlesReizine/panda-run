import { describe, it, expect } from 'vitest'
import { newPlayer } from '../../src/core/player-state'
import { serialize, deserialize, save, load } from '../../src/core/save'

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

  it('migre une save v1 (sans materials) vers v2', () => {
    const p = newPlayer('Panda')
    const legacyPlayer: Record<string, unknown> = { ...p }
    delete legacyPlayer.materials
    const loaded = deserialize(JSON.stringify({ version: 1, player: legacyPlayer }))
    expect(loaded.materials).toEqual({})
    expect(loaded.gold).toBe(p.gold)
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
