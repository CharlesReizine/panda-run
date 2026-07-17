import { describe, it, expect } from 'vitest'
import { CooldownTracker } from '../../src/core/skill-executor'

describe('CooldownTracker', () => {
  it('slot dispo puis en cooldown puis re-dispo', () => {
    const t = new CooldownTracker()
    expect(t.canUse(0, 1000)).toBe(true)
    t.use(0, 1000, 3000)
    expect(t.canUse(0, 2000)).toBe(false)
    expect(t.remainingMs(0, 2000)).toBe(2000)
    expect(t.canUse(0, 4001)).toBe(true)
    expect(t.canUse(1, 2000)).toBe(true) // slots indépendants
  })
})
