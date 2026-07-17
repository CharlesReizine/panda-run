import type { ClassDef, ClassId } from '../core/types'

export const CLASSES: Record<ClassId, ClassDef> = {
  novice: {
    id: 'novice', name: 'Novice', tint: 0xffffff,
    baseStats: { atk: 10, def: 2, maxHp: 100, attackSpeed: 1.5 },
    growth: { atk: 2, def: 1, maxHp: 15, attackSpeed: 0 },
    skillIds: ['calin-brutal', 'bambou-jete'],
  },
  swordsman: {
    id: 'swordsman', name: 'Sabreur', tint: 0xff8888,
    baseStats: { atk: 16, def: 5, maxHp: 160, attackSpeed: 1.6 },
    growth: { atk: 3, def: 2, maxHp: 25, attackSpeed: 0 },
    skillIds: ['taillade', 'tourbillon', 'charge-bambou', 'cri-de-guerre', 'provocation', 'lame-ultime'],
  },
  mage: {
    id: 'mage', name: 'Mage', tint: 0x88aaff,
    baseStats: { atk: 20, def: 2, maxHp: 110, attackSpeed: 1.2 },
    growth: { atk: 4, def: 1, maxHp: 15, attackSpeed: 0 },
    skillIds: ['boule-de-feu', 'eclair', 'nova-de-givre', 'meteore', 'soin-du-panda', 'tempete-arcanique'],
  },
  archer: {
    id: 'archer', name: 'Archer', tint: 0x88dd88,
    baseStats: { atk: 15, def: 3, maxHp: 130, attackSpeed: 2.0 },
    growth: { atk: 3, def: 1, maxHp: 20, attackSpeed: 0 },
    skillIds: ['fleche-percante', 'double-tir', 'pluie-de-fleches', 'tir-charge', 'fleche-de-bambou', 'salve-ultime'],
  },
}
