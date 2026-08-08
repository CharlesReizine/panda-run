import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ON NE LAISSE PAS DE RECOIN OÙ L'ON NE TIENT PAS DEBOUT
//
// Demande du joueur : « regarde juste graphiquement s'il y a des terrains qui ont moins d'un saut
// d'écart. Et là c'est du terre → pierre. »
//
// ⚠️ « MOINS D'UN SAUT » PRIS AU PIED DE LA LETTRE AURAIT REPEINT LE JEU. La mesure est sans appel :
// DEUX MILLE TROIS CENT TRENTE colonnes ont moins de quatre rangées de dégagement. C'est exactement le
// piège déjà rencontré avec `solid`, qui aurait transformé deux mille cinq cents corniches de terre en
// pierre et qui a valu l'invention d'`ancree` — une règle juste, appliquée trop large, défigure.
//
// Le vrai défaut est plus étroit, et il se mesure : le panda fait DEUX rangées. Une corniche coiffée à
// UNE rangée n'est pas « un peu basse », elle est INUTILISABLE — on ne peut pas s'y tenir, elle ne sert
// qu'à masquer le sol et à donner l'impression d'un décor à moitié fondu. 201 colonnes sur 27 terrains.
// À deux rangées on passe, debout ou non : on n'y touche pas.
//
// ⚠️ ET LES ARÈNES DE BOSS SONT HORS PÉRIMÈTRE, PARCE QU'ELLES SONT ÉCRITES À LA MAIN. Elles ne passent
// pas par l'assembleur : les 117 recoins qui subsistent leur appartiennent toutes, et les « corriger »
// depuis un test reviendrait à retoucher un décor composé exprès, sans en connaître l'intention.

const genere = Object.values(LEVELS).filter((l) => !l.boss)

/** Colonnes où une surface est coiffée à moins de la hauteur du panda. */
function recoinsTropBas(l: (typeof LEVELS)[string]): number {
  let n = 0
  for (const bas of l.platforms) {
    for (let x = bas.x; x < bas.x + bas.w; x++) {
      let plafond = -1
      for (const p of l.platforms) {
        if (p !== bas && x >= p.x && x < p.x + p.w && p.y < bas.y && p.y > plafond) plafond = p.y
      }
      for (const r of l.rockBands ?? []) {
        if (x >= r.x && x < r.x + r.w && r.y + r.h - 1 < bas.y && r.y + r.h - 1 > plafond) plafond = r.y + r.h - 1
      }
      if (plafond >= 0 && bas.y - plafond - 1 === 1) n++
    }
  }
  return n
}

describe('recoins impraticables', () => {
  // ⚠️ HUIT TERRAINS GARDENT LEURS RECOINS, ET C'EST LE FILET DE SÉCURITÉ QUI L'A DÉCIDÉ. Combler peut
  // MURER : un recoin d'une rangée est parfois l'ENTRÉE d'une région, et le boucher scelle tout ce qu'il
  // y a derrière. Sans garde, le premier jet a produit deux poches closes de MILLE QUATRE CENT
  // QUATRE-VINGT-DOUZE et SEPT CENT HUIT cases, plus deux monstres emmurés vivants. La passe mesure donc
  // avant/après (poches closes, monstres dans la roche, culs-de-sac) et retire tout ce qu'elle vient de
  // poser au moindre recul — par terrain entier, faute de pouvoir se le permettre colonne par colonne.
  //
  // Soixante-trois colonnes sur deux cent une restent donc telles quelles. Un recoin qu'on ne peut pas
  // combler sans emmurer quelqu'un est le moindre mal, et le chiffre est écrit ici plutôt que lissé.
  const DETTE = 63

  it('presque plus aucune surface générée n\'est coiffée à une seule rangée', () => {
    const fautifs = genere.map((l) => ({ id: l.id, n: recoinsTropBas(l) })).filter((r) => r.n > 0)
    const total = fautifs.reduce((n, r) => n + r.n, 0)
    expect(total, `recoins restants :\n   ${fautifs.map((r) => `${r.id} : ${r.n}`).join('\n   ')}`)
      .toBeLessThanOrEqual(DETTE)
  })

  // ⚠️ ET LE COMBLEMENT DOIT AVOIR SERVI À QUELQUE CHOSE. Un seuil seul se satisferait d'une passe qui
  // ne fait rien : celui-ci exige que la grande majorité ait bien été traitée.
  it('la grande majorité des recoins a bien été comblée', () => {
    const total = genere.reduce((n, l) => n + recoinsTropBas(l), 0)
    expect(total, 'la passe de comblement ne fait plus rien').toBeLessThan(201 * 0.4)
  })

  // ⚠️ ET ON N'A PAS TOUT COMBLÉ POUR AUTANT. Deux rangées de dégagement se traversent : les combler
  // aussi transformerait le relief en bloc plein. Ce test dit que la règle est RESTÉE étroite — sans
  // lui, un futur élargissement passerait pour une amélioration.
  it('les passages à DEUX rangées sont préservés : la règle reste étroite', () => {
    let deux = 0
    for (const l of genere) {
      for (const bas of l.platforms) {
        for (let x = bas.x; x < bas.x + bas.w; x++) {
          let plafond = -1
          for (const p of l.platforms) {
            if (p !== bas && x >= p.x && x < p.x + p.w && p.y < bas.y && p.y > plafond) plafond = p.y
          }
          for (const r of l.rockBands ?? []) {
            if (x >= r.x && x < r.x + r.w && r.y + r.h - 1 < bas.y && r.y + r.h - 1 > plafond) plafond = r.y + r.h - 1
          }
          if (plafond >= 0 && bas.y - plafond - 1 === 2) deux++
        }
      }
    }
    expect(deux, 'plus aucun passage bas : la règle a été élargie sans le dire').toBeGreaterThan(200)
  })
})
