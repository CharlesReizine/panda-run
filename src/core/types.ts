export type ClassId = 'novice' | 'swordsman' | 'mage' | 'archer'
export type EquipSlot = 'weapon' | 'armor' | 'accessory' | 'hat'

export interface StatBlock {
  atk: number
  def: number
  maxHp: number
  attackSpeed: number // attaques de base par seconde
}

export interface ClassDef {
  id: ClassId
  name: string
  tint: number // teinte placeholder du panda pour cette classe
  baseStats: StatBlock
  growth: StatBlock // gain par niveau (attackSpeed ignoré)
  skillIds: string[]
}

export type SkillKind = 'melee' | 'projectile' | 'aoe' | 'heal'

export interface SkillDef {
  id: string
  name: string
  classId: ClassId
  kind: SkillKind
  multiplier: number // × ATK (heal : fraction de maxHp)
  cooldownMs: number
  range: number // px (melee: portée hitbox, aoe: rayon, projectile: durée de vie en px)
  pierce?: boolean // projectile qui traverse tout (ne s'arrête pas au premier impact)
  arc?: boolean // projectile lancé en cloche (soumis à la gravité, rebondit)
}

export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire'

export interface ItemDef {
  id: string
  name: string
  slot: EquipSlot
  bonus: Partial<Pick<StatBlock, 'atk' | 'def' | 'maxHp'>>
  rarity?: Rarity // défaut 'commun' si absent
}

export interface DropEntry {
  kind: 'gold' | 'potion' | 'item' | 'material'
  itemId?: string
  materialId?: string
  chance: number // 0..1
  min: number // quantité min (gold) ; 1 pour potion/item/material
  max: number
}

export type MonsterBehavior = 'contact' | 'projectile' | 'charge' | 'caster'

export interface MonsterDef {
  id: string
  name: string
  color: number // couleur placeholder
  hp: number
  atk: number
  def: number
  xp: number
  speed: number // px/s
  behavior: MonsterBehavior
  boss?: boolean
  drops: DropEntry[]
}
