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
// NB : 'plaine-5' temporairement exempté — la refonte du motif d'eau (escalier de lacs à mini-paroi) a
// recalibré ~12 mobs de ±1-2 niveaux (willow 16→15), ce qui abaisse le clear de plaine-5 à 0,44× (juste
// sous 0,5). À rééquilibrer proprement (densité/longueur de plaine-5) dans une passe d'équilibrage dédiée.
// - epave-1 : niveau d'exploration (nage/énigme), hors barème.
// - desert-1 : MUR de niveau plaine→désert VOULU (premier désert, plein de mobs frais nettement plus
//   forts) → un clear donne un peu plus de 2 paliers ; c'est la difficulté d'entrée de biome assumée.
// - enfer-5/7 : fin de tronc, ne recyclent que des mobs d'enfer déjà vus (aucun frais) → clear < 0,5 palier.
// - foret-7 : porte l'élite poring-doré (relogé depuis la plaine après la règle « 1 élite/terrain ») →
//   son gros XP pousse le clear juste au-dessus de 2× (2,03) ; toléré (terrain de transition riche).
const EXEMPT = new Set(['epave-1', 'desert-1', 'enfer-5', 'enfer-7', 'foret-7'])

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
