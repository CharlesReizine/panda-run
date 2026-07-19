import type { StatBlock } from './types'
import type { PlayerState } from './player-state'
import { CLASSES } from '../data/classes'
import { ITEMS } from '../data/items'
import { SKILLS } from '../data/skills'
import { upgradedBonus } from './reforge'

// Effet d'un point de stat réparti sur les stats dérivées.
export const STR_ATK_PER_POINT = 2
export const AGI_ATTACK_SPEED_PER_POINT = 0.02
export const AGI_DEF_PER_POINT = 0.3
export const INT_MAX_HP_PER_POINT = 4

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
    // bonus majoré selon le niveau de réforge de la pièce (0 = bonus de base)
    const bonus = upgradedBonus(item.bonus, p.upgrades[itemId] ?? 0)
    s.atk += bonus.atk ?? 0
    s.def += bonus.def ?? 0
    s.maxHp += bonus.maxHp ?? 0
  }
  // Stats réparties (STR/AGI/INT), appliquées après base + croissance + équipement.
  // Mapping par point : STR → +2 atk ; AGI → +0.02 attackSpeed et +0.3 def ; INT → +4 maxHp.
  // À 0 partout, computeStats est inchangé.
  const a = p.allocated
  s.atk += STR_ATK_PER_POINT * a.str
  s.attackSpeed += AGI_ATTACK_SPEED_PER_POINT * a.agi
  s.def += AGI_DEF_PER_POINT * a.agi
  s.maxHp += INT_MAX_HP_PER_POINT * a.int
  // Passifs de compétence (mage/sorcier) : chaque passif APPRIS (rang > 0) ajoute son bonus de
  // stat × son rang, en permanence — sans occuper de slot équipé. Sans passif appris, aucun effet.
  for (const [id, rank] of Object.entries(p.skillLevels)) {
    if (rank <= 0) continue
    const passive = SKILLS[id]?.passive
    if (!passive) continue
    s.atk += (passive.atk ?? 0) * rank
    s.def += (passive.def ?? 0) * rank
    s.maxHp += (passive.maxHp ?? 0) * rank
    s.attackSpeed += (passive.attackSpeed ?? 0) * rank
  }
  return s
}
