import { describe, it, expect } from 'vitest'
import { CATALOG } from '../../src/data/level-modules'
import { LEVELS } from '../../src/data/levels'
import { deadEndSurfaces, oversizedGaps } from '../../src/core/level-validator'

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
  // ⚠️ ET « DÉCLARER LE VIDE » NE SUFFISAIT PAS — c'est la découverte qui a doublé ce chiffre.
  // `fillBelow: 'vide'` ne retirait que les SOCLES du motif : le sol du monde, lui, est PLEIN par
  // défaut, et un module ne fait un trou que là où il en pousse un explicitement. « Fond de vide » ne
  // voulait donc dire que « ses corniches flottent » — la moitié du contrat, et pas celle qui tue.
  // Le joueur l'a signalé une seconde fois, plus net : « je veux 0000000 sol en dessous pour me
  // rattraper ». L'assembleur ouvre maintenant le sol colonne par colonne sous ces modules.
  it('le sol du monde est réellement troué, et pas qu\'un peu', () => {
    let colonnes = 0, trouees = 0
    for (const l of Object.values(LEVELS)) {
      colonnes += l.widthTiles
      for (const g of l.gaps ?? []) trouees += g.w
    }
    const part = trouees / colonnes
    // 9 % quand seuls les motifs creusaient, 19 % depuis que le fond de vide ouvre vraiment le sol
    expect(part, `${Math.round(part * 100)} % du sol est un trou`).toBeGreaterThan(0.15)
    // et pas troué au point qu'avancer devienne une suite de sauts obligatoires
    expect(part, `${Math.round(part * 100)} % du sol est un trou`).toBeLessThan(0.30)
  })

  // ⚠️ TROIS CHOSES GARDENT LEUR SOL, ET CHACUNE A COÛTÉ UN TEST ROUGE avant d'être comprise.
  it('on n\'ouvre jamais sous un trampoline ni sous un trou déjà creusé', () => {
    for (const l of Object.values(LEVELS)) {
      for (const t of l.trampolines ?? []) {
        const auDessusDuVide = (l.gaps ?? []).some((g) => t.x >= g.x && t.x < g.x + g.w)
        expect(auDessusDuVide, `${l.id}: trampoline en x${t.x} au-dessus d'un trou`).toBe(false)
      }
      // aucun trou n'en recouvre un autre : les fusionner ferait disparaître celui du motif
      const trous = [...(l.gaps ?? [])].sort((a, b) => a.x - b.x)
      for (let i = 1; i < trous.length; i++) {
        expect(trous[i]!.x, `${l.id}: deux trous se chevauchent`).toBeGreaterThanOrEqual(trous[i - 1]!.x + trous[i - 1]!.w)
      }
    }
  })

  // ⚠️ ET SURTOUT : TOMBER DOIT TUER, JAMAIS ENFERMER. C'est la contrepartie non négociable du vide.
  it('ouvrir le sol n\'a enfermé personne', () => {
    const pieges = Object.values(LEVELS).flatMap((l) =>
      deadEndSurfaces(l).map((s) => `${l.id} x${s.x}+${s.w} y${s.y}`))
    expect(pieges, `surfaces sans issue :\n   ${pieges.join('\n   ')}`).toEqual([])
    const infranchissables = Object.values(LEVELS).flatMap((l) =>
      oversizedGaps(l).map((g) => `${l.id} x${g.x}+${g.w}`))
    expect(infranchissables, `trous que rien ne franchit :\n   ${infranchissables.join('\n   ')}`).toEqual([])
  })
})
