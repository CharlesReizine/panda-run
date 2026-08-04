import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { maxDiveRows, overDeepBasins } from '../../src/core/level-validator'
import { breathMaxMs } from '../../src/core/breath'
import { expectedLevel } from '../../src/core/playability-sim'
import { SWIM_SPEED, TILE } from '../../src/core/platforming'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UN LAC SE PLONGE ET SE REMONTE DANS UNE SEULE APNÉE — AU NIVEAU ATTENDU DU TERRAIN
//
// Retour joueur : « sur les premiers terrains les lacs sont trop profonds, y a 0 moyen que j'atteigne
// ça sans mourir ». Il avait raison, et le défaut était SYSTÉMIQUE : l'assembleur écrivait pour toute
// cuve marine `h = groundRow + 1 - top`, c'est-à-dire « le fond descend jusqu'au sol du monde ».
// Écrit quand les terrains faisaient 16 rangées de haut, c'était anodin ; à 45-70 rangées, un bassin
// dont la berge est à mi-hauteur fait trente rangées de fond. Mesuré avant correction : 30 cuves sur
// 20 terrains hors budget, dont plaine-1 (6 400 ms d'aller-retour pour 5 250 ms de souffle) et
// plaine-2 (jusqu'à 14 933 ms pour 5 500 ms) — avec un COFFRE au fond de presque toutes.
//
// Le budget se mesure au NIVEAU ATTENDU du terrain (`expectedLevel`, le joueur « juste à l'heure »,
// pas celui qui a farmé) et sur la RÉSERVE DE SOUFFLE SEULE. Les cinq secondes qui suivent la barre
// vide sont un compte à rebours de mort, pas du rab : les compter reviendrait à demander au joueur
// de remonter en se noyant déjà. On garde en plus 30 % de marge — il faut avoir le temps de VISER le
// coffre, pas seulement de faire demi-tour au millimètre.
//
// ⚠️ CE TEST DÉPEND DE `SWIM_SPEED` (core/platforming). Si la nage est ralentie un jour, ce test
// tombe — et c'est exactement ce qu'on veut : ralentir la nage rend des cuves existantes mortelles.

const nonBoss = Object.values(LEVELS).filter((l) => !l.boss)

describe('profondeur des lacs vs apnée', () => {
  it('la borne de plongée suit bien le souffle et la vitesse de nage', () => {
    // aller-retour de `maxDiveRows` rangées : doit tenir dans 70 % de la barre, pas au-delà
    const souffle = breathMaxMs(1)
    const rows = maxDiveRows(souffle)
    const allerRetourMs = ((2 * rows * TILE) / SWIM_SPEED) * 1000
    expect(allerRetourMs).toBeLessThanOrEqual(souffle * 0.7)
    expect(((2 * (rows + 1) * TILE) / SWIM_SPEED) * 1000).toBeGreaterThan(souffle * 0.7)
  })

  it('aucune cuve noyante ne dépasse ce que le souffle du niveau attendu permet', () => {
    const fautes = nonBoss.flatMap((l) => {
      const nv = expectedLevel(l.id)
      return overDeepBasins(l, maxDiveRows(breathMaxMs(nv))).map((b) => {
        const ms = Math.round(((2 * b.depth * TILE) / SWIM_SPEED) * 1000)
        return `${l.id} (nv ${nv}) cuve x${b.x} w${b.w} : ${b.depth} rangées (max ${b.max}) → ${ms} ms d'aller-retour pour ${breathMaxMs(nv)} ms de souffle`
      })
    })
    expect(fautes, `${fautes.length} cuve(s) hors budget d'apnée :\n   ${fautes.slice(0, 10).join('\n   ')}`).toEqual([])
  })
})
