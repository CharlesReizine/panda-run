import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { laddersInRock } from '../../src/core/level-validator'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AUCUNE ÉCHELLE NE TRAVERSE DE LA PIERRE
//
// Retour joueur, capture à l'appui : « je te montre un chevauchement pierre / échelle qui rend le
// terrain infaisable ». Sur `plaine-2`, l'échelle x389 (rangées 10 → 33) est coupée net par une dalle
// solide aux rangées 23-24 : on grimpe, on bute dans la roche, et tout ce que l'échelle desservait
// est perdu. Une seconde échelle, x385, est carrément noyée sur neuf rangées dans la masse voisine.
//
// ⚠️ AUCUN DES VALIDATEURS EXISTANTS NE POUVAIT LE VOIR, et c'est la leçon du défaut.
// `unreachableLadders` juge le PIED, `laddersToNowhere` juge le SOMMET — les deux étaient contents.
// Personne ne regardait ce qu'il y a ENTRE les deux bouts. Un connecteur vertical, ça se valide sur
// toute sa longueur ou ça ne se valide pas.
//
// Les quatre cas relevés à l'introduction étaient TOUS des échelles SUSPENDUES (`hung`), posées dans
// le socle de pierre du module voisin : plaine-2 x385, montagne-2 x463, cimetiere-2 x40, enfer-7 x38.

describe('échelles et roche', () => {
  it("aucune échelle n'est traversée par une dalle de roche solide", () => {
    const fautes = Object.values(LEVELS)
      .flatMap((l) => laddersInRock(l).map((p) => `${l.id} échelle x${p.x} y${p.y} h${p.h} — ${p.rows} rangée(s) dans la pierre`))
    expect(fautes, `${fautes.length} échelle(s) murée(s) :\n   ${fautes.slice(0, 8).join('\n   ')}`).toEqual([])
  })
})
