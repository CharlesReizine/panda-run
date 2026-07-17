import type { StatBlock } from './types'
import type { PlayerState } from './player-state'
import { CLASSES } from '../data/classes'
import { ITEMS } from '../data/items'

export function computeStats(p: PlayerState): StatBlock {
  const c = CLASSES[p.classId]
  const lv = p.level - 1
  const s: StatBlock = {
    atk: c.baseStats.atk + c.growth.atk * lv,
    def: c.baseStats.def + c.growth.def * lv,
    maxHp: c.baseStats.maxHp + c.growth.maxHp * lv,
    attackSpeed: c.baseStats.attackSpeed,
  }
  for (const itemId of Object.values(p.equipment)) {
    const item = ITEMS[itemId]
    if (!item) continue
    s.atk += item.bonus.atk ?? 0
    s.def += item.bonus.def ?? 0
    s.maxHp += item.bonus.maxHp ?? 0
  }
  return s
}
