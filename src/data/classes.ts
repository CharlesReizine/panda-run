import type { ClassDef, ClassId } from '../core/types'

export const CLASSES: Record<ClassId, ClassDef> = {
  novice: {
    id: 'novice', name: 'Novice', tint: 0xffffff,
    baseStats: { atk: 10, def: 2, maxHp: 85, attackSpeed: 1.5 },
    growth: { atk: 1.3, def: 1, maxHp: 11, attackSpeed: 0 },
    skillIds: ['calin-brutal', 'bambou-jete', 'rugissement-panda'],
  },
  swordsman: {
    id: 'swordsman', name: 'Sabreur', tint: 0xff8888,
    // atk de base/croissance réduites (retour playtest : tier-1 one-shotait les mobs après le
    // novice) → vise 3-5 coups à l'attaque de base pour un mob de même niveau, sans one-shot.
    baseStats: { atk: 13, def: 5, maxHp: 136, attackSpeed: 1.6 },
    growth: { atk: 1.7, def: 2, maxHp: 18, attackSpeed: 0 },
    skillIds: ['estoc-rapide', 'taillade', 'tourbillon', 'lancer-epee', 'attaque-chargee', 'plongeon', 'folie-enragee', 'regeneration'],
  },
  mage: {
    id: 'mage', name: 'Mage', tint: 0x88aaff,
    // atk réduite (cf. Sabreur) : le mage tapait le plus fort et one-shotait les mobs fragiles.
    baseStats: { atk: 16, def: 2, maxHp: 94, attackSpeed: 1.2 },
    growth: { atk: 2.2, def: 1, maxHp: 11, attackSpeed: 0 },
    skillIds: ['boule-de-feu', 'eclair', 'mur-de-flamme', 'nova-de-givre', 'soin-du-panda', 'aura-epines', 'maitrise-arcanique', 'vitalite-magique', 'meditation-arcanique'],
  },
  archer: {
    id: 'archer', name: 'Archer', tint: 0x88dd88,
    // ⚠️ LE PLUS FRAGILE DES COMBATTANTS, ET C'EST SON IDENTITÉ. Demande du user : « l'archer devrait être
    // beaucoup plus fragile et devrait avoir besoin de se battre pour rester à distance ». Il avait 110 PV
    // pour 85 au novice : il encaissait donc mieux que le personnage de départ tout en tirant de loin, si
    // bien que la distance n'était plus un choix tactique mais un confort. À 86 PV et 2 DÉF, se faire
    // rattraper coûte cher — reculer, poser un piège et gérer son espace redevient le cœur du jeu d'archer.
    // Son ATK monte d'un cran en compensation : fragile ET faible ne serait pas un archétype, juste un malus.
    baseStats: { atk: 13, def: 2, maxHp: 82, attackSpeed: 2.0 },
    growth: { atk: 1.8, def: 1, maxHp: 11, attackSpeed: 0 },
    skillIds: ['fleche-percante', 'tir-instinctif', 'double-tir', 'fleche-autoguidee', 'pluie-de-fleches', 'piege', 'course-rapide', 'oeil-de-lynx', 'reflexes-felins'],
  },
  chevalier: {
    id: 'chevalier', name: 'Chevalier', tint: 0xffcc44,
    baseStats: { atk: 28, def: 10, maxHp: 238, attackSpeed: 1.7 },
    growth: { atk: 3.2, def: 3, maxHp: 29, attackSpeed: 0 },
    skillIds: ['garde-imperiale', 'charge-lanciere', 'sceau-du-heaume', 'grand-croix', 'epee-fantome', 'devotion', 'frappe-doublee', 'double-saut'],
  },
  sorcier: {
    id: 'sorcier', name: 'Sorcier', tint: 0xaa66ff,
    baseStats: { atk: 36, def: 4, maxHp: 170, attackSpeed: 1.3 },
    growth: { atk: 4.5, def: 2, maxHp: 19, attackSpeed: 0 },
    skillIds: ['faille-du-neant', 'lance-flammes', 'pluie-de-meteores', 'tempete-foudroyante', 'blizzard', 'rayon-arcanique', 'benediction-du-panda', 'vol-arcanique'],
  },
  chasseur: {
    id: 'chasseur', name: 'Chasseur', tint: 0x33aa55,
    // CHASSEUR : même identité que l'archer, un cran au-dessus. Il reste le plus fragile des classes
    // évoluées (150 PV contre 238 au chevalier), et frappe plus fort pour compenser.
    baseStats: { atk: 30, def: 4, maxHp: 150, attackSpeed: 2.2 },
    growth: { atk: 3.4, def: 2, maxHp: 18, attackSpeed: 0 },
    skillIds: ['mitraillette', 'tir-du-faucon', 'blitz-faucon', 'nuee-de-fleches', 'fleche-mortelle', 'fleche-enflammee', 'fleche-explosive', 'bond-du-chasseur', 'fleches-entravantes'],
  },
}
