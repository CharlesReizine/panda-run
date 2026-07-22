import type { ClassId } from './types'
import type { PlayerState } from './player-state'
import { CLASSES } from '../data/classes'

export const CLASS_CHANGE_LEVEL = 10
export const CLASS_EVOLVE_LEVEL = 30
export const STAT_POINTS_PER_LEVEL = 2 // points de stat gagnés à chaque niveau

// XP GAGNÉE PAR LE JOUEUR = fonction du NIVEAU du monstre (retours playtest : caler la courbe de
// progression sur des repères — Prontera ~niv 7-8 en fin de plaine, Morocc ~niv 25-30 en fin de désert).
// On DÉCOUPLE volontairement la récompense de `MonsterDef.xp` : le champ `xp` reste l'invariant qui
// pilote la CALIBRATION des niveaux (src/core/mob-level.ts, inchangée), tandis que la récompense suit
// une courbe puissance du niveau. Comme les mobs de plaine sont niv ~1 et ceux du désert niv ~31, la
// courbe rend la plaine peu rémunératrice et le désert riche → gros SAUT de niveau (mur voulu) au
// passage plaine→désert, qui force à farmer. Réglé par MOB_XP_BASE / MOB_XP_EXP (cf. mob-level.test).
export const MOB_XP_BASE = 16   // XP d'un mob de niveau 1
export const MOB_XP_EXP = 1.3   // exposant de la courbe puissance (niveau^exp)

// XP accordée au joueur pour un monstre de niveau `level` (arrondi entier, ≥ 1).
export function playerXpForMobLevel(level: number): number {
  return Math.max(1, Math.round(MOB_XP_BASE * Math.pow(Math.max(1, level), MOB_XP_EXP)))
}

// XP réellement gagnée à la mort d'un monstre (dérivée de son niveau calibré).
export function playerXpGain(monster: { level: number }): number {
  return playerXpForMobLevel(monster.level)
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
