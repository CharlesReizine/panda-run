import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../src/data/levels'
import { chainesContournables } from '../../src/core/level-validator'
import { MARCHES_RAMPE } from '../../src/data/level-modules'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE RELIEF SE JOUE — TROIS DETTES QUE LE JOUEUR AVAIT NOMMÉES, ET LEURS GARDE-FOUS
//
// Ces trois mesures ont vécu des mois dans ETAT-DU-PROJET.md sous forme de chiffres périmés, donc
// invérifiables. Elles vivent maintenant ici : un test qui tombe vaut mieux qu'une ligne de doc.
//
// ⚠️ LES TROIS TOLÉRANCES CI-DESSOUS SONT DE LA DETTE NOMMÉE, PAS DES DÉROGATIONS DE CONFORT.
// Chacune décrit un cas que la génération ne sait pas résoudre sans changer un motif de fond. Les
// baisser est un progrès ; les monter demande une raison écrite.

const nonBoss = Object.values(LEVELS).filter((l) => !l.boss)

describe('relief jouable', () => {
  // ── 1) « les sauts qu'on peut éviter, tu dégages le sol en dessous » ─────────────────────────
  // Une suite de plateformes suspendues avec du sol praticable dessous ne se joue jamais : on passe
  // dessous en marchant. La passe de creusement (level-modules) retire ce sol. Elle ne peut pas tout
  // faire : une chaîne dont l'intérieur porte un coffre, un pied d'échelle ou un trampoline reste
  // intacte — on ne creuse pas sous ce qui se pose au sol. Mesuré : 174 chaînes avant, 6 après.
  const TOLERANCE_CHAINES = 6
  it('les enchaînements de sauts ne se contournent pas en marchant dessous', () => {
    const restantes = nonBoss.flatMap((l) => chainesContournables(l).map((c) => `${l.id} x${c.x}+${c.w} (${c.plats} plateformes)`))
    expect(restantes.length, `chaînes contournables :\n   ${restantes.join('\n   ')}`).toBeLessThanOrEqual(TOLERANCE_CHAINES)
  })

  // ── 2) « j'en ai vu une qui revient et ça perturbe » ─────────────────────────────────────────
  // Deux corniches de terre à une ou deux rangées d'écart qui se recouvrent : on ne sait plus sur
  // laquelle on marche, et la plus basse ne sert à rien puisqu'on ne tient pas debout dessous. La
  // passe de rognage retire le recouvrement de la plus courte — sauf quand elle porte quelque chose
  // (un monstre, un coffre, un trampoline), auquel cas un doublon visuel vaut mieux qu'un ours qui
  // vole. Mesuré : 60 paires avant, 15 après.
  //
  // ⚠️ LE RÉSIDU EST CONCENTRÉ AUX COUTURES ENTRE MODULES, et c'est le prochain fil à tirer. Les x
  // restants tombent presque tous en fin de module (121-135, 565-586, 619, 682) : deux modules
  // voisins posent chacun leur corniche de raccord, à une ou deux rangées l'une de l'autre. Le rognage
  // ne peut pas trancher là sans risquer d'amputer un appui de liaison — ça se corrige côté couture,
  // pas côté nettoyage.
  const TOLERANCE_DOUBLES = 15
  it('deux corniches ne se recouvrent pas à moins d\'un saut l\'une de l\'autre', () => {
    const paires: string[] = []
    for (const l of nonBoss) {
      const p = l.platforms
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
        const a = p[i]!, b = p[j]!
        if (a.solid || b.solid) continue // la pierre pleine est un mur, pas une corniche
        const dy = Math.abs(a.y - b.y)
        if (dy === 0 || dy > 2) continue
        if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) < 3) continue
        paires.push(`${l.id} y${a.y}/${b.y} x${Math.max(a.x, b.x)}`)
      }
    }
    expect(paires.length, `doubles planchers :\n   ${paires.join('\n   ')}`).toBeLessThanOrEqual(TOLERANCE_DOUBLES)
  })

  // ── 3) « les marches géantes » ───────────────────────────────────────────────────────────────
  // Une RAMPE ne doit pas lâcher plus d'une hauteur de saut d'un coup : au-delà ce n'est plus une
  // marche, c'est une falaise. Deux causes trouvées, toutes deux corrigées : une largeur de rampe qui
  // ne comptait que la MONTÉE (en descente elle retombait à deux tuiles pour seize rangées), et une
  // allocation séquentielle où la redescente héritait des miettes. Mesuré : 11 avant, 1 après.
  //
  // Le cas restant est un arbitrage, pas un oubli : une cascade « au moins quatre fois le panda »
  // dans un module étroit ne laisse pas la place d'adoucir sa berge descendante. Aucune rampe ne peut
  // faire mieux avec trois tuiles — il faudrait raccourcir la cascade, c'est-à-dire renoncer au motif.
  const TOLERANCE_MARCHES = 1
  it('aucune rampe ne fabrique une marche plus haute qu\'un saut', () => {
    const detail = MARCHES_RAMPE.map((m) => `${m.kind} : ${m.de}→${m.a} sur ${m.w} tuiles`)
    expect(MARCHES_RAMPE.length, `marches de rampe :\n   ${detail.join('\n   ')}`).toBeLessThanOrEqual(TOLERANCE_MARCHES)
  })
})
