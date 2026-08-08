import { describe, it, expect } from 'vitest'
import { LEVELS, type LevelDef } from '../../src/data/levels'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UNE ÉCHELLE S'APPUIE SUR DE LA PIERRE, ELLE NE PEND PAS DANS LE VIDE
//
// Demande du joueur : « sur mes motifs sauts d'échelle en échelle, j'ai des échelles qui volent et ça
// c'est mort. Je veux de la pierre partout pour faire un peu comme un T. »
//
// ⚠️ COIFFER LE SOMMET NE RÉPONDAIT QU'À LA MOITIÉ DU DÉFAUT. `echellesSansAppui` vérifie que l'échelle
// DÉBOUCHE sur quelque chose ; rien ne vérifiait que quelque chose la PORTE. Un palier d'échelle est une
// barre horizontale suspendue avec un montant filiforme dessous : l'œil cherche ce qui tient l'ensemble
// et ne trouve rien. Le joueur nomme exactement la forme manquante — la barre du T était là, le PIED
// n'avait jamais été posé.

const dur = (l: LevelDef, x: number, y: number): boolean =>
  (l.rockBands ?? []).some((r: { x: number; y: number; w: number; h: number }) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
  || l.platforms.some((p: { x: number; y: number; w: number }) => x >= p.x && x < p.x + p.w && p.y === y)

/** Le montant est-il épaulé : de la pierre pleine dans une colonne voisine, sur sa hauteur ? */
function epaulee(l: LevelDef, lad: { x: number; y: number; h: number }): boolean {
  const milieu = lad.y + Math.floor(lad.h / 2)
  return dur(l, lad.x - 1, milieu) || dur(l, lad.x + 1, milieu)
}

const engendres = Object.values(LEVELS).filter((l) => (l.ladders ?? []).length > 0)

describe('le pied du T', () => {
  it('la grande majorité des échelles est épaulée par de la pierre', () => {
    let total = 0, nues = 0
    for (const l of engendres) for (const lad of l.ladders ?? []) { total++; if (!epaulee(l, lad)) nues++ }
    expect(total, 'plus aucune échelle dans le jeu ?').toBeGreaterThan(100)
    // ⚠️ PAS ZÉRO, ET LE CHIFFRE EST ÉCRIT PLUTÔT QUE LISSÉ : 423 sur 593. Les 170 restantes ont chacune
    // une raison mesurée — 72 n'ont aucun palier de sortie (échelles de puits, de cascade, de cuve : rien
    // à épauler), 12 ont le pied dans le vide, 8 n'ont de palier d'aucun côté, une plonge dans l'eau, et
    // le reste tombe sous le filet de sécurité. 434 échelles sur 593 sont désormais épaulées. Le pilier est un MUR : là où il enfermerait un monstre ou
    // scellerait une salle habitée, on le retire. Un décor imparfait vaut mieux qu'un chemin coupé.
    expect(nues / total, `${nues}/${total} échelles pendent encore dans le vide`).toBeLessThan(0.28) // mesuré 0,268 — le plafond reste collé au réel, sinon il ne protège rien
  })

  // ⚠️ LE PILIER NE VA JAMAIS DANS LA COLONNE DU MONTANT. Une pierre pleine dans l'échelle elle-même la
  // boucherait : on ne grimperait plus. C'est l'erreur évidente que ce test rend impossible.
  it('aucun pilier ne bouche la colonne qu\'on grimpe', () => {
    const bouchees: string[] = []
    for (const l of engendres) for (const lad of l.ladders ?? []) {
      for (let y = lad.y; y < lad.y + lad.h; y++) {
        if ((l.rockBands ?? []).some((r) => lad.x >= r.x && lad.x < r.x + r.w && y >= r.y && y < r.y + r.h)) {
          bouchees.push(`${l.id} (${lad.x},${y})`)
        }
      }
    }
    // ⚠️ AUCUNE PIERRE, PAS SEULEMENT LA PIERRE « PLEINE ». Le validateur le dit déjà pour les monstres :
    // « il n'y a pas de pierre décorative, la pierre est de la pierre ». Une dalle sans collision posée
    // dans la colonne qu'on grimpe se verrait quand même — le panda traverserait un mur à chaque barreau.
    expect(bouchees.slice(0, 8), 'de la roche DANS une échelle').toEqual([])
  })
})
