import { xpToNext } from './progression'
import { MONSTERS } from '../data/monsters'
import { LEVELS } from '../data/levels'
import type { LevelDef } from '../data/levels'
import type { MonsterDef } from './types'

// Calibrage du NIVEAU des monstres sur l'économie d'XP du jeu.
//
// Idée : le niveau affiché d'un monstre doit refléter le niveau qu'aurait un joueur arrivé
// à sa zone. On mesure ça uniquement à partir de l'XP réellement distribuée par les niveaux
// précédents, sans facteur d'époque ni réglage arbitraire.
//
// - playerLevelForXp(xp) : niveau atteint en partant du niveau 1 et en consommant xpToNext
//   palier par palier (même logique que grantXp dans progression.ts).
// - levelXp(level) : XP totale qu'un niveau distribue = somme de l'XP de ses spawns + boss.
// - cumXpBelow(i) : XP cumulée des niveaux STRICTEMENT avant le niveau i (dans l'ordre de jeu).
// - mobLevelForZone(cumXp) : niveau d'un joueur ayant fait 1,5× le contenu situé en dessous.
//   Le mob le plus coûteux de la zone (souvent le MVP ou le boss) reçoit +3.

// Marge d'avance supposée du joueur sur le contenu déjà traversé (1,5 = « a farmé un peu »).
export const ZONE_XP_FACTOR = 1.5

// Bonus de niveau du monstre le plus fort d'une zone (boss / MVP / mob le plus coûteux).
export const APEX_LEVEL_BONUS = 3

// Bonus de niveau des GARDIENS : ce sont des « boss de palier » postés en obstacle, calibrés
// nettement au-dessus des mobs de leur zone (increvables sans effort, mais tuables). On les
// exclut du calcul d'apex (ils ne « volent » pas le +3 au mob le plus coûteux de la zone) et on
// leur ajoute ce bonus fixe à la place.
export const GARDIEN_LEVEL_BONUS = 12

// Un gardien = obstacle immobile de très haut niveau (id préfixé « gardien- »).
const isGardien = (id: string): boolean => id.startsWith('gardien-')

// Ordre de progression : l'ordre du tableau `list` de levels.ts (préservé par Object.values,
// insertion order). Les routes alternatives (cave, plage, carrière) sont intercalées à leur
// place dans la progression, comme dans le fichier.
export const LEVEL_ORDER: LevelDef[] = Object.values(LEVELS)

// Niveau atteint en partant du niveau 1 avec `totalXp`, en consommant xpToNext palier par palier.
export function playerLevelForXp(totalXp: number): number {
  let level = 1
  let remaining = Math.max(0, totalXp)
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level)
    level += 1
  }
  return level
}

// XP totale distribuée par un niveau = somme de l'XP de ses spawns + celle du boss s'il y en a un.
export function levelXp(level: LevelDef): number {
  let sum = 0
  // les gardiens sont des obstacles optionnels (contournables par les plateformes) : leur XP ne
  // compte pas dans le calibrage de zone, sinon leur gros XP gonflerait le niveau de tous les
  // mobs des zones suivantes.
  for (const s of level.spawns) { if (!isGardien(s.monsterId)) sum += MONSTERS[s.monsterId]?.xp ?? 0 }
  if (level.boss) sum += MONSTERS[level.boss]?.xp ?? 0
  return sum
}

// XP cumulée des niveaux strictement avant l'index donné dans l'ordre de jeu.
export function cumXpBelow(index: number): number {
  let sum = 0
  for (let i = 0; i < index && i < LEVEL_ORDER.length; i++) sum += levelXp(LEVEL_ORDER[i]!)
  return sum
}

// Niveau de base des monstres d'une zone : le niveau d'un joueur ayant fait ZONE_XP_FACTOR×
// le contenu situé en dessous.
export function mobLevelForZone(cumXp: number): number {
  return playerLevelForXp(ZONE_XP_FACTOR * cumXp)
}

// Monstres d'un niveau (spawns dédupliqués + boss), dans l'ordre d'apparition.
function levelRoster(level: LevelDef): MonsterDef[] {
  const ids: string[] = []
  for (const s of level.spawns) if (!ids.includes(s.monsterId)) ids.push(s.monsterId)
  if (level.boss && !ids.includes(level.boss)) ids.push(level.boss)
  return ids.map((id) => MONSTERS[id]).filter((m): m is MonsterDef => !!m)
}

// Niveau calibré de chaque monstre, dérivé du PREMIER niveau où il apparaît :
// base = mobLevelForZone(cumXpBelow(premier niveau)), +APEX_LEVEL_BONUS si le monstre est le
// plus coûteux (XP max) de ce premier niveau (boss / MVP / mob le plus fort).
export function computeMonsterLevels(): Record<string, number> {
  const result: Record<string, number> = {}
  const firstSeen: Record<string, number> = {}
  const apexAt: Record<string, boolean> = {}

  LEVEL_ORDER.forEach((level, index) => {
    const roster = levelRoster(level)
    if (roster.length === 0) return
    // les gardiens sont exclus de l'apex : on ne veut pas qu'un gardien (XP élevée) prive le vrai
    // mob le plus coûteux de la zone de son +3, ni qu'il cumule apex + bonus gardien.
    const ranked = roster.filter((m) => !isGardien(m.id))
    const maxXp = ranked.length ? Math.max(...ranked.map((m) => m.xp)) : Infinity
    for (const m of roster) {
      if (firstSeen[m.id] === undefined) {
        firstSeen[m.id] = index
        apexAt[m.id] = !isGardien(m.id) && m.xp === maxXp
      }
    }
  })

  for (const m of Object.values(MONSTERS)) {
    const index = firstSeen[m.id]
    if (index === undefined) { result[m.id] = 1; continue }
    const base = mobLevelForZone(cumXpBelow(index))
    const bonus = isGardien(m.id) ? GARDIEN_LEVEL_BONUS : apexAt[m.id] ? APEX_LEVEL_BONUS : 0
    result[m.id] = base + bonus
  }
  return result
}
