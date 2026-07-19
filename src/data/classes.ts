import type { ClassDef, ClassId } from '../core/types'

export const CLASSES: Record<ClassId, ClassDef> = {
  novice: {
    id: 'novice', name: 'Novice', tint: 0xffffff,
    baseStats: { atk: 10, def: 2, maxHp: 85, attackSpeed: 1.5 },
    growth: { atk: 2, def: 1, maxHp: 13, attackSpeed: 0 },
    skillIds: ['calin-brutal', 'bambou-jete', 'rugissement-panda'],
  },
  swordsman: {
    id: 'swordsman', name: 'Sabreur', tint: 0xff8888,
    baseStats: { atk: 16, def: 5, maxHp: 136, attackSpeed: 1.6 },
    growth: { atk: 3, def: 2, maxHp: 21, attackSpeed: 0 },
    skillIds: ['taillade', 'estoc-rapide', 'tourbillon', 'attaque-chargee', 'lancer-epee', 'epee-enflammee', 'plongeon', 'lame-ultime'],
  },
  mage: {
    id: 'mage', name: 'Mage', tint: 0x88aaff,
    baseStats: { atk: 20, def: 2, maxHp: 94, attackSpeed: 1.2 },
    growth: { atk: 4, def: 1, maxHp: 13, attackSpeed: 0 },
    skillIds: ['boule-de-feu', 'eclair', 'nova-de-givre', 'meteore', 'soin-du-panda', 'tempete-arcanique', 'soin-majeur', 'rayon-arcanique'],
  },
  archer: {
    id: 'archer', name: 'Archer', tint: 0x88dd88,
    baseStats: { atk: 15, def: 3, maxHp: 110, attackSpeed: 2.0 },
    growth: { atk: 3, def: 1, maxHp: 17, attackSpeed: 0 },
    skillIds: ['fleche-percante', 'tir-instinctif', 'double-tir', 'piege', 'fleche-enflammee', 'fleche-explosive', 'tir-charge', 'pluie-de-fleches'],
  },
  chevalier: {
    id: 'chevalier', name: 'Chevalier', tint: 0xffcc44,
    baseStats: { atk: 28, def: 10, maxHp: 238, attackSpeed: 1.7 },
    growth: { atk: 5, def: 3, maxHp: 34, attackSpeed: 0 },
    skillIds: ['garde-imperiale', 'sceau-du-heaume', 'jugement-royal', 'taillade', 'attaque-chargee', 'plongeon', 'epee-enflammee', 'lame-ultime'],
  },
  sorcier: {
    id: 'sorcier', name: 'Sorcier', tint: 0xaa66ff,
    baseStats: { atk: 36, def: 4, maxHp: 170, attackSpeed: 1.3 },
    growth: { atk: 7, def: 2, maxHp: 22, attackSpeed: 0 },
    skillIds: ['cataclysme', 'faille-du-neant', 'benediction-du-panda', 'boule-de-feu', 'meteore', 'tempete-arcanique', 'rayon-arcanique', 'soin-majeur'],
  },
  chasseur: {
    id: 'chasseur', name: 'Chasseur', tint: 0x33aa55,
    baseStats: { atk: 26, def: 6, maxHp: 195, attackSpeed: 2.2 },
    growth: { atk: 5, def: 2, maxHp: 29, attackSpeed: 0 },
    skillIds: ['fleche-mortelle', 'nuee-de-fleches', 'tir-du-faucon', 'fleche-percante', 'fleche-enflammee', 'fleche-explosive', 'pluie-de-fleches', 'tir-charge'],
  },
}
