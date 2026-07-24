import type { ClassId } from './types'
import type { PlayerState } from './player-state'
import { CLASSES } from '../data/classes'

export const CLASS_CHANGE_LEVEL = 10
export const CLASS_EVOLVE_LEVEL = 30
export const STAT_POINTS_PER_LEVEL = 2 // points de stat gagnés à chaque niveau

// XP GAGNÉE PAR LE JOUEUR = fonction du NIVEAU du monstre. C'est la RÉCOMPENSE joueur — à ne pas
// confondre avec `MonsterDef.xp`, l'invariant qui pilote la CALIBRATION des niveaux (mob-level.ts,
// inchangée). La récompense suit une courbe puissance du niveau.
//
// COURBE calée sur le MODÈLE D'ÉQUILIBRAGE MAÎTRE (cf. tests/core/balance-invariant.test.ts) : en
// ayant clear ~1,5× les terrains précédents, le joueur arrive sur chaque terrain à un niveau PROCHE
// du mob le plus fort qui l'attend (playerLevelAfterClear, playability-sim.ts). Repères 1,5× (échelle
// CONVEXE, cf. mob-level.ts) : Prontera ~niv 5, Morocc ~niv 20, endgame ~niv 57 (le boss final niv ~56,
// « à ton niveau » quand tu arrives après avoir farmé la map). La plaine (mobs niv ~1-7) reste peu
// rémunératrice et le désert (niv ~17-25) riche → le passage plaine→désert garde son MUR de niveau
// (galère voulue, cf. xp-curve.test). Réglé par MOB_XP_BASE / MOB_XP_EXP : la courbe de NIVEAU étant
// devenue convexe TRONQUÉE (1,1,2,3,4… mobs early très bas), la base a été RELEVÉE 14→21 pour que le
// joueur suive le rythme et arrive survivable au mur du désert, sans faire déborder le late-game.
export const MOB_XP_BASE = 21     // XP d'un mob de niveau 1
export const MOB_XP_EXP = 1.3     // exposant de la courbe puissance (niveau^exp)

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
