import { describe, it, expect } from 'vitest'
import { CATALOG } from '../../src/data/level-modules'
import { LEVELS } from '../../src/data/levels'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SOUS UN PASSAGE D'ÉCHELLE OU UN SAUT DE PLATEAU EN PLATEAU, IL Y A LE VIDE
//
// Demande du joueur : « peut-être qu'on peut retirer des trous dans le sol… là le jeu, pour tomber,
// faut vraiment être trouduc. Genre les motifs "passage d'échelle" ou "saut de plateau en plateau", ça
// ne peut qu'être du trou tout le long en dessous. Reprends à minima ces quelques motifs. »
//
// ⚠️ IL VISAIT JUSTE, ET LE DÉFAUT ÉTAIT DE CONCEPTION. Ces motifs demandent un enchaînement de sauts
// ou une échelle à ne pas rater — mais ils étaient posés sur du SOL PLEIN. Rater ne coûtait donc rien :
// on retombait sur la terre ferme, on remontait, on recommençait. Un obstacle sans conséquence n'est
// pas un obstacle, c'est une formalité, et douze motifs sur les vingt-neuf de la famille « vertical »
// étaient dans ce cas.
//
// Le sol s'ouvre sous les douze. Ce n'est pas de la difficulté gratuite : le motif PROMETTAIT déjà le
// vide (on saute de plateau en plateau), il ne le tenait pas.
//
// ⚠️ CE TEST GARDE LA DÉCLARATION, PAS LE DESSIN. `fillBelow` est lu par la GRAVURE des plans : le
// remettre à 'sol' ne casserait rien tant qu'on ne regrave pas, et le défaut reviendrait silencieusement
// à la regravure suivante — des mois plus tard, sans lien visible avec la modification. C'est
// exactement le genre d'aller-retour qu'un seuil mesuré ne rattrape pas.

const OUVERTS = [
  'echelles-decalees', 'echelles-successives', 'echelles-lianes', 'echelles-zigzag',
  'passerelles-plein', 'escalier-saut',
] as const

describe('sol ouvert sous les motifs de saut', () => {
  it('les passages d\'échelle et les sauts de plateau ont le VIDE dessous', () => {
    const pleins: string[] = []
    for (const base of OUVERTS) {
      for (const kind of [base, `${base}-inverse`] as const) {
        const spec = (CATALOG as Record<string, { below: string } | undefined>)[kind]
        expect(spec, `${kind} a disparu du catalogue`).toBeDefined()
        if (spec!.below !== 'vide') pleins.push(`${kind} → ${spec!.below}`)
      }
    }
    expect(pleins, `motifs revenus au sol plein :\n   ${pleins.join('\n   ')}`).toEqual([])
  })

  // ⚠️ ET IL FAUT QUE ÇA SE VOIE DANS LES TERRAINS. La déclaration seule pourrait être vraie pendant
  // que les plans gravés, eux, datent d'avant : c'est précisément l'écart que ce second test mesure.
  it('le sol du monde est réellement troué, et pas qu\'un peu', () => {
    let colonnes = 0, trouees = 0
    for (const l of Object.values(LEVELS)) {
      colonnes += l.widthTiles
      for (const g of l.gaps ?? []) trouees += g.w
    }
    const part = trouees / colonnes
    expect(part, `${Math.round(part * 100)} % du sol est un trou`).toBeGreaterThan(0.07)
    // et pas troué au point qu'avancer devienne une suite de sauts obligatoires
    expect(part, `${Math.round(part * 100)} % du sol est un trou`).toBeLessThan(0.25)
  })
})
