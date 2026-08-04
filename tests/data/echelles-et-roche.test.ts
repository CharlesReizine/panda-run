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
//
// ⚠️ LA PIERRE FRAGILE COMPTE AUTANT QUE LA ROCHE, et l'avoir exclue a livré un piège sans retour.
// Elle est « franchissable par construction » — il suffit de taper — sauf agrippé à une échelle : on
// ne frappe pas vers le haut dans cette position. Huit terrains portaient une échelle de
// `grotte-u-brisable` plantée dans son propre pan fragile : le pan qu'on casse pour ENTRER se
// refermait sur qui voulait RESSORTIR. « Y a du terrain destructible en haut de l'échelle qui bloque
// la sortie. »

describe('échelles et roche', () => {
  it("aucune échelle n'est traversée par une dalle de roche solide", () => {
    const fautes = Object.values(LEVELS)
      .flatMap((l) => laddersInRock(l).map((p) => `${l.id} échelle x${p.x} y${p.y} h${p.h} — ${p.rows} rangée(s) dans ${p.matiere}`))
    expect(fautes, `${fautes.length} échelle(s) murée(s) :\n   ${fautes.slice(0, 8).join('\n   ')}`).toEqual([])
  })
})
