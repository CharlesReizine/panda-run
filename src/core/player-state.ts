import type { ClassId, EquipSlot } from './types'

export const MAX_SKILL_RANK = 5

export interface PlayerState {
  name: string
  classId: ClassId
  level: number
  xp: number // XP accumulée dans le niveau courant
  skillPoints: number
  skillLevels: Record<string, number> // id → rang investi (1..MAX_SKILL_RANK) ; absent/0 = pas débloqué
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
    skillLevels: { 'calin-brutal': 1 },
    equippedSkills: ['calin-brutal', null, null, null],
    gold: 0,
    potions: 1,
    inventory: [],
    equipment: {},
    completedLevels: [],
    materials: {},
  }
}
