import type { ClassId, EquipSlot } from './types'

export interface PlayerState {
  name: string
  classId: ClassId
  level: number
  xp: number // XP accumulée dans le niveau courant
  skillPoints: number
  unlockedSkills: string[]
  equippedSkills: (string | null)[] // toujours longueur 4
  gold: number
  potions: number
  inventory: string[] // itemIds non équipés
  equipment: Partial<Record<EquipSlot, string>>
  completedLevels: string[]
  materials: Record<string, number> // matériaux collectés (id → quantité) — collection pure, craft à venir
}

export function newPlayer(name: string): PlayerState {
  return {
    name,
    classId: 'novice',
    level: 1,
    xp: 0,
    skillPoints: 0,
    unlockedSkills: ['calin-brutal'],
    equippedSkills: ['calin-brutal', null, null, null],
    gold: 0,
    potions: 1,
    inventory: [],
    equipment: {},
    completedLevels: [],
    materials: {},
  }
}
