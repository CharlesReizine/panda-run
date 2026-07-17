import type { ClassId } from './types'
import type { PlayerState } from './player-state'

export const CLASS_CHANGE_LEVEL = 10

export function xpToNext(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5))
}

export function grantXp(p: PlayerState, amount: number): { levelsGained: number } {
  p.xp += amount
  let levelsGained = 0
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level)
    p.level += 1
    p.skillPoints += 1
    levelsGained += 1
  }
  return { levelsGained }
}

export function canChangeClass(p: PlayerState): boolean {
  return p.classId === 'novice' && p.level >= CLASS_CHANGE_LEVEL
}

export function changeClass(p: PlayerState, to: ClassId): void {
  if (!canChangeClass(p)) throw new Error('changement de classe impossible')
  if (to === 'novice') throw new Error('classe cible invalide')
  p.classId = to
}
