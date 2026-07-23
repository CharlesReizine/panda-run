import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { WORLD_NODES } from '../../src/data/worldmap'
import { MONSTERS } from '../../src/data/monsters'
import { playerXpForMobLevel, xpToNext } from '../../src/core/progression'
import { expectedLevel } from '../../src/core/playability-sim'

// RÈGLE D'ÉCONOMIE D'XP (demande joueur) : tuer TOUS les monstres d'un terrain doit rapporter entre
// 0,5× et 2× l'XP nécessaire pour passer du niveau DU TERRAIN au niveau suivant. Autrement dit :
//  - faire une fois un terrain de son niveau ⇒ au moins la moitié d'un niveau (jamais dérisoire),
//  - le faire deux fois ⇒ au moins un niveau garanti (0,5×2 = 1),
//  - jamais plus de 2 niveaux d'un coup (pas de terrain qui fait exploser la progression).
// « Niveau du terrain » = niveau ATTENDU à l'entrée (expectedLevel, dérivé de la calibration).
const MIN_RATIO = 0.5
const MAX_RATIO = 2

// Terrains EXEMPTÉS : l'Épave est un niveau d'EXPLORATION spécial (peu de mobs, cœur = nage/énigme),
// hors barème d'XP — déjà traité à part dans le modèle d'équilibrage (balance-invariant).
const EXEMPT = new Set(['epave-1'])

// XP joueur en tuant tous les monstres d'un terrain (hors gardiens contournables) + le boss.
function clearXp(levelId: string): number {
  const lvl = LEVELS[levelId]
  if (!lvl) return 0
  let sum = 0
  for (const s of lvl.spawns) {
    if (s.monsterId.startsWith('gardien-')) continue
    const m = MONSTERS[s.monsterId]
    if (m) sum += playerXpForMobLevel(m.level)
  }
  if (lvl.boss) { const b = MONSTERS[lvl.boss]; if (b) sum += playerXpForMobLevel(b.level) }
  return sum
}

describe('économie d\'XP par terrain', () => {
  it('clear complet d\'un terrain ∈ [0,5×, 2×] l\'XP du level-up de son niveau', () => {
    for (const n of WORLD_NODES) {
      if (n.type !== 'level' || !n.levelId || !LEVELS[n.levelId] || EXEMPT.has(n.levelId)) continue
      const level = expectedLevel(n.id)
      const ratio = clearXp(n.levelId) / xpToNext(level)
      expect(ratio, `${n.levelId} (Nv ${level}) : ratio XP = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(MIN_RATIO)
      expect(ratio, `${n.levelId} (Nv ${level}) : ratio XP = ${ratio.toFixed(2)}`).toBeLessThanOrEqual(MAX_RATIO)
    }
  })
})
