import type { ClassId, EquipSlot } from './types'
import { START_NODE } from '../data/worldmap'

export const MAX_SKILL_RANK = 5

// Suivi d'une quête acceptée en ville : startCount capture le compteur de départ (ex.
// monstersKilled au moment de l'acceptation) pour calculer une progression relative, sans
// que des kills antérieurs à l'acceptation ne comptent.
export interface QuestState {
  startCount: number
  progress: number
  done: boolean
  claimed: boolean
}

export interface PlayerState {
  name: string
  classId: ClassId
  level: number
  xp: number // XP accumulée dans le niveau courant
  skillPoints: number
  statPoints: number // points de stat non dépensés
  allocated: { str: number; agi: number; int: number } // points de stat répartis

  skillLevels: Record<string, number> // id → rang investi (1..MAX_SKILL_RANK) ; absent/0 = pas débloqué
  equippedSkills: (string | null)[] // toujours longueur 4
  gold: number
  potions: number
  inventory: string[] // itemIds non équipés
  equipment: Partial<Record<EquipSlot, string>>
  completedLevels: string[]
  materials: Record<string, number> // matériaux collectés (id → quantité) — collection pure, craft à venir
  monstersKilled: number // compteur global, incrémenté dans LevelScene.onEnemyDied
  quests: Record<string, QuestState> // quêtes acceptées en ville (id → progression)
  currentNode: string // nœud courant sur la carte du monde (id dans WORLD_NODES)
}

export function newPlayer(name: string): PlayerState {
  return {
    name,
    classId: 'novice',
    level: 1,
    xp: 0,
    skillPoints: 0,
    statPoints: 0,
    allocated: { str: 0, agi: 0, int: 0 },
    skillLevels: { 'calin-brutal': 1 },
    equippedSkills: ['calin-brutal', null, null, null],
    gold: 0,
    potions: 1,
    inventory: [],
    equipment: {},
    completedLevels: [],
    materials: {},
    monstersKilled: 0,
    quests: {},
    currentNode: START_NODE,
  }
}
