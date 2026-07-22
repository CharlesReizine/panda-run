import { describe, it, expect } from 'vitest'
import {
  expectedLevel,
  representativePlayer,
  simulateLevel,
  simulateAll,
} from '../../src/core/playability-sim'
import { LEVEL_ORDER } from '../../src/core/mob-level'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MOTEUR DE TEST DE JOUABILITÉ — garde-fou anti « niveau injouable ».
//
// Le moteur (src/core/playability-sim.ts) simule un joueur AU NIVEAU ATTENDU (dérivé de la courbe
// d'XP le long de la progression) traversant chaque terrain, et estime PV perdus vs PV max. Ces
// tests figent l'état SAIN de R188 (plaine-1 déjà corrigé) et échoueraient sur une vraie horreur
// (l'ancien plaine-1 : corbeaux Nv5 piquant en grappe sur un novice Nv1).
//
// SEUILS (calibrés pour que R188 passe, mais qu'un niveau réellement injuste échoue) :
//   • SURVIE : chaque terrain jouable doit être `survivable` — pic de burst < 1,35× PV max ET aucun
//     coup ne dépasse les PV max. Un pic VOLONTAIRE borné (transition plaine→désert) reste survivable.
//   • ONE-SHOT : aucun mob ne doit tuer en un seul coup au niveau attendu.
//   • DÉBUT DOUX : plaine-1 et plaine-2 (apprentissage) sous un plafond de difficulté doux.
const SOFT_EARLY_DIFFICULTY_CAP = 0.6

describe('niveau attendu (expectedLevel)', () => {
  it('plaine-1 est le tout début (Nv 1-2)', () => {
    expect(expectedLevel('plaine-1')).toBeLessThanOrEqual(2)
  })

  it('progresse le long des repères de la carte (Prontera ~8-12, Morocc ~20-27, endgame ≥ 55)', () => {
    expect(expectedLevel('prontera')).toBeGreaterThanOrEqual(8)
    expect(expectedLevel('prontera')).toBeLessThanOrEqual(14)
    expect(expectedLevel('morocc')).toBeGreaterThanOrEqual(20)
    expect(expectedLevel('morocc')).toBeLessThanOrEqual(27)
    expect(expectedLevel('boss-09')).toBeGreaterThanOrEqual(55)
  })

  it('est monotone non décroissant dans l\'ordre de progression', () => {
    let prev = 0
    for (const l of LEVEL_ORDER) {
      const e = expectedLevel(l.id)
      expect(e).toBeGreaterThanOrEqual(prev)
      prev = e
    }
  })
})

describe('joueur représentatif', () => {
  it('a des stats positives et croissantes avec le niveau', () => {
    const p1 = representativePlayer(1)
    const p40 = representativePlayer(40)
    expect(p1.maxHp).toBeGreaterThan(0)
    expect(p1.atk).toBeGreaterThan(0)
    expect(p40.maxHp).toBeGreaterThan(p1.maxHp)
    expect(p40.atk).toBeGreaterThan(p1.atk)
  })
})

describe('jouabilité de tous les terrains (état R188)', () => {
  const results = simulateAll()

  it('couvre tous les terrains jouables (hors arènes de boss)', () => {
    expect(results.length).toBe(LEVEL_ORDER.filter((l) => !l.boss).length)
    expect(results.length).toBeGreaterThan(40)
  })

  it('AUCUN terrain injouable au niveau attendu', () => {
    const dead = results.filter((r) => !r.survivable)
    const detail = dead.map((r) => `${r.levelId} (burst ${r.peakBurst}/${r.maxHp} PV, 1coup ${r.worstOneHit}, gap +${r.maxLevelGap})`)
    expect(detail, `terrains injouables : ${detail.join(' · ')}`).toEqual([])
  })

  it('AUCUN one-shot au niveau attendu', () => {
    const os = results.filter((r) => r.flags.includes('one-shot'))
    const detail = os.map((r) => `${r.levelId} (${r.worstMobId}, ${r.worstOneHit} ≥ ${r.maxHp} PV)`)
    expect(detail, `one-shot : ${detail.join(' · ')}`).toEqual([])
  })

  it('le tout début (plaine-1/2) reste sous le plafond de difficulté doux', () => {
    for (const id of ['plaine-1', 'plaine-2']) {
      const r = results.find((x) => x.levelId === id)!
      expect(r.difficulty, `${id} difficulté ${r.difficulty}`).toBeLessThanOrEqual(SOFT_EARLY_DIFFICULTY_CAP)
      expect(r.flags).not.toContain('début-trop-dur')
    }
  })

  it('les pics VOLONTAIRES (transition plaine→désert) restent bornés et survivables', () => {
    // le désert d'entrée est le mur assumé (mobs calibrés au-dessus, farm attendu) : dur mais tenable.
    const desert1 = results.find((r) => r.levelId === 'desert-1')!
    expect(desert1.survivable).toBe(true)
    expect(desert1.difficulty).toBeGreaterThan(0.4) // c'est bien un pic…
    expect(desert1.difficulty).toBeLessThan(0.95)   // …mais pas un mur infranchissable
  })
})

describe('le moteur ATTRAPE une vraie horreur (régression ancien plaine-1)', () => {
  // Reconstitue le plaine-1 injouable d'avant le fix : une GRAPPE de corbeaux (aériens piqueurs,
  // Nv5) fondant sur un novice Nv1. Le moteur DOIT le déclarer injouable — c'est sa raison d'être.
  it('plaine-1 avec une grappe de corbeaux est déclaré injouable', () => {
    const spawns = [
      { monsterId: 'corbeau', x: 14 }, { monsterId: 'corbeau', x: 16 },
      { monsterId: 'corbeau', x: 18 }, { monsterId: 'corbeau', x: 20 },
      { monsterId: 'gloopy', x: 25 }, { monsterId: 'lunatic', x: 30 },
    ]
    const r = simulateLevel('plaine-1', { spawns })
    expect(r.expectedLevel).toBeLessThanOrEqual(2)
    expect(r.survivable).toBe(false)
    expect(r.flags).toContain('swarm/cluster')
  })

  it('un mob qui frappe plus fort que les PV max au niveau attendu est flaggé one-shot', () => {
    // dragon-flamme (atk 235) contre le joueur Nv1 : un coup dépasse largement ses ~85 PV.
    const r = simulateLevel('plaine-1', { spawns: [{ monsterId: 'dragon-flamme', x: 20 }] })
    expect(r.flags).toContain('one-shot')
    expect(r.survivable).toBe(false)
  })
})
