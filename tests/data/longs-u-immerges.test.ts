import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { tunnelsTropLongs, maxSwimTiles } from '../../src/core/level-validator'
import { breathMaxMs } from '../../src/core/breath'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DE LONGS U EN APNÉE, PAS DES W
//
// Demande du joueur : « les passages dans des grottes sous-marines, je suis chaud d'avoir des passages
// longs en apnée, et c'est vraiment un looong U. Là je vois des W mais très peu de looong U. »
//
// ⚠️ LE « W » ÉTAIT ÉCRIT EN DUR, ET IL SORTAIT D'UNE PRUDENCE MAL PLACÉE. Les plafonds immergés
// étaient hachés en segments de SEPT colonnes séparés par deux tuiles d'air : on refaisait surface tous
// les sept pas, et la silhouette dessinait exactement le W décrit. Sept était une valeur de sécurité
// choisie à la main, sans rapport avec le souffle réel — et comme personne ne mesurait la longueur, il
// n'y avait aucune raison de la relever.
//
// ⚠️ UN TUNNEL PROFOND EST FORCÉMENT COURT, et c'est là que se jouait le vrai plafond. La longueur
// qu'un souffle permet dépend de la profondeur : il faut payer la descente ET la remontée avant de
// payer la traversée. À sept rangées sous la berge il ne restait que quatre colonnes de nage ; à trois,
// il en reste quatorze. Pour un LONG U, il faut le vouloir PEU PROFOND — c'est ce réglage-là, pas la
// borne, qui a débloqué la demande.
//
// ⚠️ ET UN PLAFOND IMMERGÉ NE FLOTTE PAS. La passe qui supprime les pierres en l'air (cf.
// pierres-flottantes) le voyait comme parfaitement isolé — de l'eau dessus, de l'eau dessous — et le
// SUPPRIMAIT : les tunnels sont tombés de quinze à trois sans qu'aucun test ne s'en aperçoive. Les deux
// règles se croisent, et c'est ce croisement que ce fichier surveille.

const SOUFFLE_DEBUTANT = breathMaxMs(1)

/** Longueur du plus long plafond immergé CONTIGU de ce plan d'eau, en colonnes. */
function plusLongTunnel(l: (typeof LEVELS)[string]): number {
  let best = 0
  for (const eau of (l.hazards ?? []).filter((h) => h.kind === 'water' && h.water !== 'cascade' && h.water !== 'lave')) {
    if (eau.w > l.widthTiles * 0.8) continue // terrain entièrement noyé : ce n'est pas un passage
    const surf = eau.top ?? 0, fond = surf + (eau.h ?? 0)
    let run = 0
    for (let x = eau.x; x < eau.x + eau.w; x++) {
      const couvert = (l.rockBands ?? []).some((r) => x >= r.x && x < r.x + r.w && r.y + r.h > surf && r.y < fond)
      run = couvert ? run + 1 : 0
      best = Math.max(best, run)
    }
  }
  return best
}

describe('longs U immergés', () => {
  it('aucun tunnel ne dépasse ce qu\'un débutant traverse d\'un souffle', () => {
    const noyants = Object.values(LEVELS).flatMap((l) =>
      tunnelsTropLongs(l, SOUFFLE_DEBUTANT).map((t) =>
        `${l.id} x${t.x} : ${t.w} colonnes à ${t.profondeur} de fond (max ${t.max})`))
    expect(noyants, `tunnels noyants :\n   ${noyants.join('\n   ')}`).toEqual([])
  })

  // ⚠️ ET IL FAUT QU'IL EN RESTE. C'est la moitié qui manquait : une borne seule aurait pu être
  // satisfaite en supprimant tous les tunnels, ce qui est précisément l'accident qui s'est produit.
  it('le jeu contient de VRAIS longs U, pas seulement des tunnels courts', () => {
    const tunnels = Object.values(LEVELS).map(plusLongTunnel).filter((n) => n > 0)
    expect(tunnels.length, 'plus aucun tunnel immergé dans le jeu').toBeGreaterThanOrEqual(10)
    const plusLong = Math.max(...tunnels)
    // ⚠️ ONZE, PAS SEPT, ET L'ÉCART EST TOUT LE SUJET. La borne n'est pas un chiffre choisi : c'est ce
    // qu'un panda de niveau 1 traverse d'un souffle à cette profondeur. Les quinze tunnels du jeu la
    // touchent tous — ils sont aussi longs que le souffle l'autorise, ce qui est exactement la demande.
    expect(plusLong, 'plus un seul long U : on est revenu aux W de sept colonnes').toBeGreaterThanOrEqual(11)
  })

  it('la borne se calcule, elle ne se décrète pas', () => {
    // plus c'est profond, plus c'est court : la descente et la remontée se paient avant la traversée
    const peu = maxSwimTiles(SOUFFLE_DEBUTANT, 3)
    const beaucoup = maxSwimTiles(SOUFFLE_DEBUTANT, 7)
    expect(peu).toBeGreaterThan(beaucoup)
    expect(peu).toBeGreaterThanOrEqual(12)
    // et un souffle plus long autorise plus loin : la règle suit le joueur, elle n'est pas figée
    expect(maxSwimTiles(breathMaxMs(30), 3)).toBeGreaterThan(peu)
  })
})
