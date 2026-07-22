import { describe, it, expect } from 'vitest'
import { playerLevelAfterClear, simulateAll } from '../../src/core/playability-sim'
import { LEVEL_ORDER } from '../../src/core/mob-level'
import { MONSTERS } from '../../src/data/monsters'
import { LEVELS } from '../../src/data/levels'
import { WORLD_NODES } from '../../src/data/worldmap'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MODÈLE D'ÉQUILIBRAGE MAÎTRE ⭐ — invariant verrouillé.
//
// RÈGLE : à l'entrée d'un terrain T, un joueur qui a clear ~1,5× TOUS les terrains PRÉCÉDENTS doit
// arriver à un niveau PROCHE du mob le plus fort de T. Le boss d'une map est « à ton niveau » quand
// tu y arrives après avoir farmé la map. La fonction de référence est `playerLevelAfterClear`.
//
// TOLÉRANCES : le jeu est volontairement une « galère » — on arrive un peu SOUS le contenu et on
// farme le biome pour rattraper. L'écart est donc positif (déficit) mais BORNÉ. L'enveloppe atteinte
// (build R191) : déficit ≤ +9 au MUR d'entrée de biome (Orée forestière), qui se résorbe à ~0 en
// fin de biome. Ce test échoue si un terrain DÉRIVE FORTEMENT : trop dur (déficit ingérable) ou
// trivial (mobs très en dessous du joueur).

const isGardien = (id: string) => id.startsWith('gardien-')

// mob le plus fort d'un terrain (spawns hors gardiens + boss éventuel).
function maxMob(levelId: string): number {
  const l = LEVELS[levelId]
  if (!l) return 0
  let mx = 0
  for (const s of l.spawns) { const m = MONSTERS[s.monsterId]; if (m && !isGardien(s.monsterId)) mx = Math.max(mx, m.level) }
  if (l.boss) { const b = MONSTERS[l.boss]; if (b) mx = Math.max(mx, b.level) }
  return mx
}

const nonBoss = LEVEL_ORDER.filter((l) => !l.boss)

// TERRAINS SOUS-NIVELÉS PAR DESIGN (exceptions documentées, exclues du garde « trivial ») : routes
// alternatives réinsérées TRÈS loin dans la progression et alimentées par un pool RECYCLÉ d'une bande
// plus basse (cf. LATE_DESERT_GROUND + épave dans data/levels.ts). Le joueur y est sur-nivelé À DESSEIN
// (la difficulté y est portée par le burst/densité, cf. playability.test), pas par l'écart de niveau.
const UNDERLEVELED_BY_DESIGN = new Set(['desert-9', 'desert-10', 'desert-11', 'epave-1'])

describe('modèle d\'équilibrage maître ⭐', () => {
  it('playerLevelAfterClear(1,5×) est monotone non décroissant dans l\'ordre de progression', () => {
    let prev = 0
    for (const l of LEVEL_ORDER) {
      const f = playerLevelAfterClear(l.id)
      expect(f, `${l.id} recule (${f} < ${prev})`).toBeGreaterThanOrEqual(prev)
      prev = f
    }
  })

  it('AUCUN terrain n\'est brutalement TROP DUR (déficit maxMob − farmé ≤ 10)', () => {
    // 10 = enveloppe du mur d'entrée de biome (Orée ~+9). Au-delà, le terrain est injuste : le joueur
    // farmé 1,5× reste 11+ niveaux sous le mob le plus fort → dérive de calibration.
    const MAX_DEFICIT = 10
    const bad = nonBoss
      .filter((l, i) => i > 0)
      .map((l) => ({ id: l.id, gap: maxMob(l.id) - playerLevelAfterClear(l.id) }))
      .filter((r) => r.gap > MAX_DEFICIT)
    expect(bad.map((r) => `${r.id} (+${r.gap})`), `terrains trop durs : ${bad.map((r) => r.id).join(', ')}`).toEqual([])
  })

  it('AUCUN terrain (hors exceptions design) n\'est TRIVIAL (farmé − maxMob ≤ 4)', () => {
    // au-delà de +4 de sur-niveau, les mobs sont trop en dessous du joueur → terrain sans enjeu.
    const MAX_SURPLUS = 4
    const bad = nonBoss
      .filter((l, i) => i > 0 && !UNDERLEVELED_BY_DESIGN.has(l.id))
      .map((l) => ({ id: l.id, surplus: playerLevelAfterClear(l.id) - maxMob(l.id) }))
      .filter((r) => r.surplus > MAX_SURPLUS)
    expect(bad.map((r) => `${r.id} (−${r.surplus})`), `terrains triviaux : ${bad.map((r) => r.id).join(', ')}`).toEqual([])
  })

  it('à la FIN de chaque biome calibré, le joueur farmé est À NIVEAU (|écart| ≤ 6)', () => {
    // c'est là que la règle maître tient le plus serré : après avoir farmé un biome, on est au niveau
    // de son apex. On exclut désert et plage (leur dernier terrain d'ordre est une exception design).
    const EXCLUDE = new Set(['desert', 'plage'])
    const lastOfBiome: Record<string, string> = {}
    for (const l of nonBoss) lastOfBiome[l.biome] = l.id
    for (const [biome, id] of Object.entries(lastOfBiome)) {
      if (EXCLUDE.has(biome)) continue
      const gap = maxMob(id) - playerLevelAfterClear(id)
      expect(Math.abs(gap), `fin de biome ${biome} (${id}) écart ${gap}`).toBeLessThanOrEqual(6)
    }
  })

  it('le BOSS de chaque map est « à ton niveau » quand tu arrives farmé 1,5× (−3 ≤ boss − farmé ≤ 9)', () => {
    for (const l of LEVEL_ORDER) {
      if (!l.boss) continue
      const bl = MONSTERS[l.boss]?.level ?? 0
      const f = playerLevelAfterClear(l.id)
      const gap = bl - f
      expect(gap, `${l.id} (boss ${l.boss} niv ${bl}, farmé ${f})`).toBeGreaterThanOrEqual(-3)
      expect(gap, `${l.id} (boss ${l.boss} niv ${bl}, farmé ${f})`).toBeLessThanOrEqual(9)
    }
  })

  it('repères du re-calage : Prontera ~8, Morocc ~25-30, endgame ~65-75 (farmé 1,5×)', () => {
    const pront = playerLevelAfterClear('prontera')
    const moro = playerLevelAfterClear('morocc')
    const end = playerLevelAfterClear('boss-09')
    expect(pront, `Prontera ${pront}`).toBeGreaterThanOrEqual(8)
    expect(pront, `Prontera ${pront}`).toBeLessThanOrEqual(12)
    expect(moro, `Morocc ${moro}`).toBeGreaterThanOrEqual(24)
    expect(moro, `Morocc ${moro}`).toBeLessThanOrEqual(31)
    expect(end, `endgame ${end}`).toBeGreaterThanOrEqual(65)
    expect(end, `endgame ${end}`).toBeLessThanOrEqual(75)
  })
})

describe('métrique de difficulté (écart de niveau + burst/densité)', () => {
  const results = simulateAll()

  it('expose farmedLevel / maxMobLevel / apexGap cohérents', () => {
    for (const r of results) {
      expect(r.apexGap).toBe(r.maxMobLevel - r.farmedLevel)
      expect(r.farmedLevel).toBeGreaterThanOrEqual(1)
    }
  })

  it('est LISIBLE sur tout le jeu : un terrain sur-niveau > un terrain sous-niveau', () => {
    // desert-1 (mur d'entrée, sur-niveau) doit être nettement plus difficile qu'un terrain sous-nivelé
    // de fin de jeu (desert-11, exception design). C'est ce que l'ancienne métrique-PV ratait.
    const d1 = results.find((r) => r.levelId === 'desert-1')!
    const d11 = results.find((r) => r.levelId === 'desert-11')!
    expect(d1.apexGap).toBeGreaterThan(0)
    expect(d11.apexGap).toBeLessThan(0)
    expect(d1.difficulty).toBeGreaterThan(d11.difficulty)
  })

  it('un terrain « à ton niveau » de late-game n\'est plus plafonné à ~0,05 (fin de la fausse trivialité)', () => {
    // enfer-4 est ~à niveau (apexGap ≈ 0) : l'ancienne métrique-PV le donnait ~0,05 (mobs sous le
    // niveau → dégâts plafonnés). La métrique d'écart le remonte à une difficulté MOYENNE lisible.
    const e4 = results.find((r) => r.levelId === 'enfer-4')!
    expect(Math.abs(e4.apexGap)).toBeLessThanOrEqual(2)
    expect(e4.difficulty).toBeGreaterThan(0.15)
  })
})
