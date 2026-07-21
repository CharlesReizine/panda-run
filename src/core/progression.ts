import type { ClassId } from './types'
import type { PlayerState } from './player-state'
import { CLASSES } from '../data/classes'

export const CLASS_CHANGE_LEVEL = 10
export const CLASS_EVOLVE_LEVEL = 30
export const STAT_POINTS_PER_LEVEL = 2 // points de stat gagnés à chaque niveau

// Multiplicateur appliqué au GAIN d'XP du joueur (retours user successifs : la progression allait
// trop vite). Deux réductions cumulatives de −30% : 0.7 (1er retour) puis ×0.7 (2e retour) = 0.49.
// Volontairement appliqué au gain côté joueur et NON à MonsterDef.xp : la valeur `xp` d'un
// monstre reste l'invariant qui pilote computeMonsterLevels (src/core/mob-level.ts). On ne touche
// donc pas à la courbe de niveaux des monstres ; seule la vitesse de montée du joueur ralentit.
// Source de vérité unique — importée au point d'attribution d'XP (LevelScene.onEnemyDied).
export const XP_GAIN_MULTIPLIER = 0.49

// Convertit la récompense brute d'un monstre (MonsterDef.xp) en XP réellement gagnée par le joueur,
// après le multiplicateur ci-dessus (arrondi au plus proche pour rester entier).
export function playerXpGain(monsterXp: number): number {
  return Math.round(monsterXp * XP_GAIN_MULTIPLIER)
}

// voies d'évolution : classe de 1er palier → classe évoluée (2e palier, niveau 30)
export const EVOLUTIONS: Partial<Record<ClassId, ClassId>> = {
  swordsman: 'chevalier',
  mage: 'sorcier',
  archer: 'chasseur',
}

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
    p.statPoints += STAT_POINTS_PER_LEVEL
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

export function canEvolveClass(p: PlayerState): boolean {
  return p.classId in EVOLUTIONS && p.level >= CLASS_EVOLVE_LEVEL
}

export function evolveClass(p: PlayerState): ClassId {
  if (!canEvolveClass(p)) throw new Error('évolution impossible')
  const to = EVOLUTIONS[p.classId]!
  p.classId = to
  const firstSkill = CLASSES[to].skillIds[0]!
  if (!p.skillLevels[firstSkill]) p.skillLevels[firstSkill] = 1
  return to
}
