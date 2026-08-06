import { describe, it, expect } from 'vitest'
import { traverseCornichesEnGrimpant } from '../../src/core/platforming'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DEBOUT SOUS UNE ÉCHELLE, ON SE TIENT SUR CE QU'ON VOIT
//
// Le joueur l'a signalé trois fois, et deux corrections précédentes s'étaient trompées de coupable :
// « on passe à travers le sol quand on est sur de la terre sous une échelle (même quand l'échelle
// monte), sans être agrippé ou quoi, juste en marchant ou en sautant là », puis « je tombe à travers
// quand je suis sur un sol avec une échelle au-dessus, c'est hyper contre-intuitif ».
//
// ⚠️ LA CAUSE ÉTAIT UNE PORTE TROP LARGE, PAS LE TERRAIN. Le processCallback des corniches
// traversables rendait `false` — c'est-à-dire « aucune collision » — dès que `onLadder` était vrai. Or
// `onLadder` ne veut pas dire « agrippé » : il est vrai dès que le CENTRE du panda entre dans le
// rectangle de l'échelle, donc simplement debout dessous. Le sol disparaissait sans qu'il ait rien
// demandé.
//
// Le perçage des corniches sous les échelles avait été supprimé POUR CE SYMPTÔME, à tort : le trou
// n'était pas la cause. La traversée garde sa raison d'être — « une échelle que je peux pas
// descendre » — mais elle ne vaut que pendant la GRIMPE, et grimper suppose d'avoir poussé haut ou bas.

describe('corniche sous une échelle', () => {
  it('debout sous une échelle, la corniche porte', () => {
    expect(traverseCornichesEnGrimpant(false)).toBe(false)
  })

  it('en train de grimper, la corniche laisse passer', () => {
    expect(traverseCornichesEnGrimpant(true)).toBe(true)
  })
})
