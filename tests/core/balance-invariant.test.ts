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

  it('AUCUN terrain n\'est brutalement TROP DUR (déficit maxMob − farmé ≤ 12)', () => {
    // 12 = enveloppe des MURS d'entrée de biome (fin de forêt-tronc / entrée désert, ~+11 sous l'échelle
    // Dijkstra où le joueur arrive sous-nivelé et farme). Au-delà, le terrain serait injuste.
    const MAX_DEFICIT = 12
    const bad = nonBoss
      .filter((l, i) => i > 0)
      .map((l) => ({ id: l.id, gap: maxMob(l.id) - playerLevelAfterClear(l.id) }))
      .filter((r) => r.gap > MAX_DEFICIT)
    expect(bad.map((r) => `${r.id} (+${r.gap})`), `terrains trop durs : ${bad.map((r) => r.id).join(', ')}`).toEqual([])
  })

  it('AUCUN terrain n\'est ABSURDEMENT trivial (farmé − maxMob ≤ 12)', () => {
    // Modèle « distance ×2 » : la carte a bien plus de terrains (58) que de niveaux (~47). Un joueur
    // qui farme 1,5× TOUTES les branches finit donc naturellement AU-DESSUS des mobs normaux de
    // late-game (les BOSS, +4, portent le défi). On ne garde qu'un garde-fou anti-absurde (≤ 12) :
    // au-delà, un terrain serait vraiment vidé de tout enjeu.
    const MAX_SURPLUS = 12
    const bad = nonBoss
      .filter((l, i) => i > 0 && !UNDERLEVELED_BY_DESIGN.has(l.id))
      .map((l) => ({ id: l.id, surplus: playerLevelAfterClear(l.id) - maxMob(l.id) }))
      .filter((r) => r.surplus > MAX_SURPLUS)
    expect(bad.map((r) => `${r.id} (−${r.surplus})`), `terrains triviaux : ${bad.map((r) => r.id).join(', ')}`).toEqual([])
  })

  it('à la FIN de chaque biome, le joueur farmé n\'est jamais LARGEMENT sous le contenu (déficit ≤ 6)', () => {
    // Après avoir farmé un biome, on est AU MOINS à son niveau (on peut être au-dessus — c'est le but
    // du farm). On borne donc seulement le DÉFICIT (jamais très en dessous de l'apex de fin de biome).
    const lastOfBiome: Record<string, string> = {}
    for (const l of nonBoss) lastOfBiome[l.biome] = l.id
    for (const [biome, id] of Object.entries(lastOfBiome)) {
      const deficit = maxMob(id) - playerLevelAfterClear(id)
      expect(deficit, `fin de biome ${biome} (${id}) déficit ${deficit}`).toBeLessThanOrEqual(6)
    }
  })

  it('le BOSS de chaque map est « à ton niveau » quand tu arrives farmé 1,5× (−6 ≤ boss − farmé ≤ 9)', () => {
    // Le boss porte le bonus +4 (BOSS_LEVEL_BONUS) : il reste proche du niveau du joueur farmé. En
    // late-game le joueur (qui a fait toutes les branches) est un peu au-dessus → le boss peut être
    // jusqu'à 6 sous lui, mais jamais trivialisé ni injuste.
    for (const l of LEVEL_ORDER) {
      if (!l.boss) continue
      const bl = MONSTERS[l.boss]?.level ?? 0
      const f = playerLevelAfterClear(l.id)
      const gap = bl - f
      expect(gap, `${l.id} (boss ${l.boss} niv ${bl}, farmé ${f})`).toBeGreaterThanOrEqual(-6)
      expect(gap, `${l.id} (boss ${l.boss} niv ${bl}, farmé ${f})`).toBeLessThanOrEqual(9)
    }
  })

  it('repères du re-calage (échelle Dijkstra ×2) : Prontera ~5-8, Morocc ~18-25, endgame ~52-62 (farmé 1,5×)', () => {
    const pront = playerLevelAfterClear('prontera')
    const moro = playerLevelAfterClear('morocc')
    const end = playerLevelAfterClear('boss-09')
    expect(pront, `Prontera ${pront}`).toBeGreaterThanOrEqual(5)
    expect(pront, `Prontera ${pront}`).toBeLessThanOrEqual(8)
    expect(moro, `Morocc ${moro}`).toBeGreaterThanOrEqual(18)
    expect(moro, `Morocc ${moro}`).toBeLessThanOrEqual(25)
    expect(end, `endgame ${end}`).toBeGreaterThanOrEqual(52)
    expect(end, `endgame ${end}`).toBeLessThanOrEqual(62)
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

  it('un terrain « à ton niveau » de mid/late-game n\'est plus plafonné à ~0,05 (fin de la fausse trivialité)', () => {
    // cimetiere-2 est ~à niveau (apexGap ≈ 0) : l'ancienne métrique-PV le donnait ~0,05 (mobs sous le
    // niveau → dégâts plafonnés). La métrique d'écart le remonte à une difficulté MOYENNE lisible.
    const c2 = results.find((r) => r.levelId === 'cimetiere-2')!
    expect(Math.abs(c2.apexGap)).toBeLessThanOrEqual(2)
    expect(c2.difficulty).toBeGreaterThan(0.15)
  })
})
